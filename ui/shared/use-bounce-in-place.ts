import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { decodeBounceBank } from "../../bounce/bank-format.mjs";
import { retireSupersededBounceBanks } from "../../bounce/bank-retention.mjs";
import { createBrowserBounceBankStore } from "../../bounce/browser-bank-store.mjs";
import { captureBounceBank } from "../../bounce/capture.mjs";
import {
    BOUNCE_STATE_KEY,
    parseBounceDocument,
    readBounceDocumentFromPatch,
} from "../../bounce/document.mjs";
import {
    allocateBounceRuntimeGeneration,
    requestBounceEngineStatus,
    stageBounceBankInstall,
} from "../../bounce/live-bank-install.mjs";
import {
    applyLiveBouncePatchDocument,
    captureLiveBouncePatchDocument,
} from "../../bounce/patch-document-adapter.mjs";
import { BounceTransitionCoordinator } from "../../bounce/transition.mjs";
import { usePatchConnection, useResourceClient } from "./cmajor-react";
import { getDefaultPatchRootUrl } from "./resource-client";
import {
    createProductBounceCaptureSnapshot,
    type BounceRecipeProgress,
} from "./bounce-capture-recipe";
import {
    createDefaultModulationState,
    serializeModulationState,
} from "./modulation";
import {
    createDefaultLaneState,
    serializeLaneState,
} from "./lane-state";
import {
    createEmptyArticulationsState,
    serializeArticulationsV4,
} from "./articulation-image";
import { EFFECT_PRESETS_V2_STATE_KEY } from "./effects/effect-preset-store-v2";

const PRODUCT_STORED_STATE_DEFAULTS = Object.freeze({
    "modulation.v6": serializeModulationState(createDefaultModulationState()),
    "articulations.v4": serializeArticulationsV4(createEmptyArticulationsState()),
    "lane.v1": serializeLaneState(createDefaultLaneState()),
});

export type BounceUIPhase =
    | "hydrating"
    | "idle"
    | "preparing"
    | "capturing"
    | "validating"
    | "persisting"
    | "installing"
    | "verifying"
    | "flipping"
    | "reverting"
    | "complete";

export type BounceBankView = {
    readonly sampleRate: number;
    readonly roots: ReadonlyArray<{
        readonly note: number;
        readonly frameOffset: number;
        readonly frameCount: number;
        readonly noteOffFrameOffset: number;
    }>;
    readonly totalFrameCount: number;
    readonly pcm: Int16Array;
};

type BounceTestConfig = {
    roots?: number[];
    holdSeconds?: number;
    tailCapSeconds?: number;
    concurrency?: number;
};

type BounceTestDiagnostics = {
    captures: Array<{
        generation: number;
        sourceGeneration: number;
        digest: string;
        roots: number[];
        wasmMemoryPages: Array<number | null>;
    }>;
    retirements: Array<unknown>;
};

declare global {
    // Browser acceptance tests may shorten duration/root count while still
    // traversing the real worker/persistence/install transaction.
    // eslint-disable-next-line no-var
    var __COSIMO_BOUNCE_TEST_CONFIG__: BounceTestConfig | undefined;
    // Test-only bounded telemetry for G5. It contains counters/digests only,
    // never PCM or a retained performer.
    // eslint-disable-next-line no-var
    var __COSIMO_BOUNCE_TEST_DIAGNOSTICS__: BounceTestDiagnostics | undefined;
}

export type BounceUIState = {
    readonly hydrated: boolean;
    readonly captureReady: boolean;
    readonly sampled: boolean;
    readonly phase: BounceUIPhase;
    readonly busy: boolean;
    readonly cancellable: boolean;
    readonly completedRoots: number;
    readonly totalRoots: number;
    readonly completedFrames: number;
    readonly totalFrames: number;
    readonly preparation: BounceRecipeProgress | null;
    readonly document: ReturnType<typeof parseBounceDocument> | null;
    readonly bank: BounceBankView | null;
    readonly error: string | null;
};

const INITIAL_STATE: BounceUIState = Object.freeze({
    hydrated: false,
    captureReady: false,
    sampled: false,
    phase: "hydrating",
    busy: false,
    cancellable: false,
    completedRoots: 0,
    totalRoots: 0,
    completedFrames: 0,
    totalFrames: 0,
    preparation: null,
    document: null,
    bank: null,
    error: null,
});

function errorMessage(cause: unknown) {
    return cause instanceof Error ? cause.message : String(cause);
}

function isAbort(cause: unknown) {
    return cause instanceof DOMException && cause.name === "AbortError"
        || Boolean(cause && typeof cause === "object" && (
            (cause as { name?: unknown }).name === "AbortError"
            || (cause as { code?: unknown }).code === "cancelled"
        ));
}

function fullStoredStateValues(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const record = value as Record<string, unknown>;
    return record.values && typeof record.values === "object" && !Array.isArray(record.values)
        ? record.values as Record<string, unknown>
        : record;
}

function matchesBounceDocument(bank: BounceBankView, document: ReturnType<typeof parseBounceDocument>) {
    return bank.sampleRate === document.capture.sampleRate
        && bank.roots.length === document.roots.length
        && bank.roots.every((root, index) => (
            root.note === document.roots[index]
            && root.frameOffset === document.segments[index].frameOffset
            && root.frameCount === document.segments[index].frameCount
            && (root.noteOffFrameOffset === 0
                || root.noteOffFrameOffset === document.segments[index].noteOffFrameOffset)
        ));
}

function assertCapture(capture: {
    bytes: Uint8Array;
    bank: BounceBankView;
}) {
    const decoded = decodeBounceBank(capture.bytes);
    if (decoded.sampleRate !== capture.bank.sampleRate
        || decoded.totalFrameCount !== capture.bank.totalFrameCount
        || decoded.roots.length !== capture.bank.roots.length) {
        throw new Error("Encoded Bounce bank did not round-trip its capture metadata");
    }
    let peak = 0;
    for (const sample of decoded.pcm) peak = Math.max(peak, Math.abs(sample));
    if (peak === 0) throw new Error("Bounce verification decoded a silent bank");
}

function readTestConfig(): BounceTestConfig {
    const value = globalThis.__COSIMO_BOUNCE_TEST_CONFIG__;
    return value && typeof value === "object" ? value : {};
}

function recordTestDiagnostic(
    kind: keyof BounceTestDiagnostics,
    value: BounceTestDiagnostics[typeof kind][number],
) {
    if (!globalThis.__COSIMO_BOUNCE_TEST_CONFIG__) return;
    const diagnostics = globalThis.__COSIMO_BOUNCE_TEST_DIAGNOSTICS__ ??= {
        captures: [],
        retirements: [],
    };
    const values = diagnostics[kind] as unknown[];
    values.push(value);
    if (values.length > 64) values.splice(0, values.length - 64);
}

function hasExternalPresetFileStore() {
    const scope = globalThis as typeof globalThis & {
        chocUserFiles?: unknown;
        window?: { chocUserFiles?: unknown };
    };
    return Boolean(scope.chocUserFiles ?? scope.window?.chocUserFiles);
}

/** Browser product controller for snapshot -> workers -> OPFS -> live flip. */
export function useBounceInPlace() {
    const connection = usePatchConnection();
    const resourceClient = useResourceClient();
    const store = useMemo(() => createBrowserBounceBankStore(), [connection]);
    const [state, setState] = useState<BounceUIState>(INITIAL_STATE);
    const preparationAbortRef = useRef<AbortController | null>(null);
    const hydrationRevisionRef = useRef(0);
    const captureStateKeysRef = useRef(new Set<string>());
    const userPresetStateRef = useRef<unknown>(null);
    const userPresetStateKnownRef = useRef(false);

    const applyPatchDocument = useCallback((document: {
        storedState: Readonly<Record<string, unknown>>;
    }) => {
        const bounceValue = document.storedState[BOUNCE_STATE_KEY] ?? null;
        if (bounceValue !== null) {
            connection.acceptCommittedBounceDocument?.(bounceValue);
        }
        return applyLiveBouncePatchDocument(connection, document);
    }, [connection]);

    const coordinator = useMemo(() => new BounceTransitionCoordinator({
        capture: (request) => captureBounceBank({
            ...request,
            workerURL: new URL("patch_gui/bounce-render-worker.js", getDefaultPatchRootUrl()),
            engineModuleURL: new URL("cmaj_Cosimo_Synth.offline.js", getDefaultPatchRootUrl()),
        }),
        persistBank: (capture) => (
            store.put(capture.digest, capture.bytes)
        ),
        stageBankInstall: async (bank, options) => {
            const engineStatus = await requestBounceEngineStatus(connection, {
                signal: options.signal,
            });
            return stageBounceBankInstall(connection, bank, {
                dspSessionId: engineStatus.dspSessionId,
                generation: allocateBounceRuntimeGeneration(connection, options.generation),
                signal: options.signal,
                onProgress: options.onProgress,
            });
        },
        verifyCapture: (capture) => assertCapture(capture),
        applyPatchDocument,
        readBankByDigest: async (digest) => {
            const bytes = await store.get(digest);
            return bytes === null ? null : decodeBounceBank(bytes);
        },
    }), [applyPatchDocument, connection, store]);

    useEffect(() => coordinator.subscribe((next: {
        phase: BounceUIPhase;
        busy: boolean;
        cancellable: boolean;
        completedRoots?: number;
        totalRoots?: number;
        completedFrames?: number;
        totalFrames?: number;
    }) => {
        setState((current) => ({
            ...current,
            phase: next.phase,
            busy: next.busy,
            cancellable: next.cancellable,
            completedRoots: next.completedRoots ?? current.completedRoots,
            totalRoots: next.totalRoots ?? current.totalRoots,
            completedFrames: next.completedFrames ?? current.completedFrames,
            totalFrames: next.totalFrames ?? current.totalFrames,
            error: null,
        }));
    }), [coordinator]);

    const presentStoredReference = useCallback(async (rawValue: unknown) => {
        const revision = hydrationRevisionRef.current += 1;
        if (rawValue === null || rawValue === undefined || rawValue === "") {
            setState((current) => ({
                ...current,
                hydrated: true,
                sampled: false,
                phase: current.busy ? current.phase : "idle",
                document: null,
                bank: null,
                error: null,
            }));
            return;
        }
        let document: ReturnType<typeof parseBounceDocument>;
        try {
            document = parseBounceDocument(rawValue);
        } catch (cause) {
            if (revision !== hydrationRevisionRef.current) return;
            setState((current) => ({
                ...current,
                hydrated: true,
                sampled: true,
                phase: current.busy ? current.phase : "idle",
                document: null,
                bank: null,
                error: `Saved Bounce reference is invalid: ${errorMessage(cause)}`,
            }));
            return;
        }
        setState((current) => ({
            ...current,
            hydrated: true,
            sampled: true,
            phase: current.busy ? current.phase : "idle",
            document,
            bank: current.document?.digest === document.digest ? current.bank : null,
            error: null,
        }));
        try {
            const bytes = await store.get(document.digest);
            if (bytes === null) {
                throw new Error(
                    `Bounce bank ${document.digest.slice(0, 12)}… is missing. Revert or restore its bank file.`,
                );
            }
            const bank = decodeBounceBank(bytes);
            if (!matchesBounceDocument(bank, document)) {
                throw new Error("The persisted Bounce bank does not match its patch reference.");
            }
            if (revision !== hydrationRevisionRef.current) return;
            setState((current) => ({ ...current, document, bank, error: null }));
        } catch (cause) {
            if (revision !== hydrationRevisionRef.current) return;
            setState((current) => ({ ...current, document, bank: null, error: errorMessage(cause) }));
        }
    }, [store]);

    useEffect(() => {
        captureStateKeysRef.current = new Set();
        const requiredCaptureKeys = ["modulation.v6", "articulations.v4", "lane.v1"];
        const acceptCaptureKey = (key: string) => {
            if (!requiredCaptureKeys.includes(key)) return;
            captureStateKeysRef.current.add(key);
            const captureReady = requiredCaptureKeys.every((candidate) => (
                captureStateKeysRef.current.has(candidate)
            ));
            setState((current) => current.captureReady === captureReady
                ? current
                : { ...current, captureReady });
        };
        const handleStoredState = (message: unknown) => {
            const event = message && typeof message === "object" && "event" in message
                ? (message as { event: unknown }).event
                : message;
            if (!event || typeof event !== "object") return;
            const record = event as Record<string, unknown>;
            if (typeof record.key === "string") acceptCaptureKey(record.key);
            if (record.key === EFFECT_PRESETS_V2_STATE_KEY) {
                userPresetStateRef.current = record.value ?? null;
                userPresetStateKnownRef.current = true;
            }
            if (record.key === BOUNCE_STATE_KEY) void presentStoredReference(record.value);
        };
        connection.addStoredStateValueListener?.(handleStoredState);
        if (typeof connection.requestFullStoredState === "function") {
            connection.requestFullStoredState((storedState) => {
                const values = fullStoredStateValues(storedState);
                // Missing structured keys in a never-edited sound mean their
                // canonical defaults. A completed full-state reply makes that
                // absence authoritative, rather than a hydration race.
                Object.keys(PRODUCT_STORED_STATE_DEFAULTS).forEach(acceptCaptureKey);
                Object.keys(values).forEach(acceptCaptureKey);
                userPresetStateRef.current = values[EFFECT_PRESETS_V2_STATE_KEY] ?? null;
                userPresetStateKnownRef.current = true;
                void presentStoredReference(values[BOUNCE_STATE_KEY] ?? null);
            });
        } else {
            setState((current) => ({
                ...current,
                hydrated: true,
                phase: "idle",
                error: "Bounce state cannot hydrate because stored-state reads are unavailable.",
            }));
        }
        return () => {
            hydrationRevisionRef.current += 1;
            connection.removeStoredStateValueListener?.(handleStoredState);
        };
    }, [connection, presentStoredReference]);

    const bounce = useCallback(async () => {
        if (state.busy || preparationAbortRef.current !== null) return;
        const abortController = new AbortController();
        preparationAbortRef.current = abortController;
        setState((current) => ({
            ...current,
            phase: "preparing",
            busy: true,
            cancellable: true,
            completedRoots: 0,
            totalRoots: 0,
            completedFrames: 0,
            totalFrames: 0,
            preparation: null,
            error: null,
        }));
        try {
            // Both host reads are requested in the Bounce press turn. The
            // resulting document is immutable before any resource/FFT work.
            const [patchDocument, engineStatus] = await Promise.all([
                captureLiveBouncePatchDocument(connection, {
                    storedStateDefaults: PRODUCT_STORED_STATE_DEFAULTS,
                }),
                requestBounceEngineStatus(connection, { signal: abortController.signal }),
            ]);
            const previousBounceDocument = readBounceDocumentFromPatch(patchDocument);
            const recursive = Math.round(Number(patchDocument.parameters.sourceMode) || 0) === 1;
            let recursiveRoots: ReadonlyArray<number> | null = null;
            let sourceBank: BounceBankView | null = null;
            if (recursive) {
                if (previousBounceDocument === null) {
                    throw new Error("Recursive Bounce has no current bounce.v1 reference");
                }
                const sourceBytes = await store.get(previousBounceDocument.digest);
                if (sourceBytes === null) {
                    throw new Error(
                        `Recursive Bounce bank ${previousBounceDocument.digest.slice(0, 12)}… is missing`,
                    );
                }
                if (sourceBytes.byteLength !== previousBounceDocument.bankByteLength) {
                    throw new Error("Recursive Bounce bank byte length does not match bounce.v1");
                }
                recursiveRoots = previousBounceDocument.roots;
                sourceBank = decodeBounceBank(sourceBytes);
            }
            const recipe = await createProductBounceCaptureSnapshot({
                patchDocument,
                resourceClient,
                sourceBank,
                sampleRate: engineStatus.sampleRateHz,
                tempoBpm: engineStatus.tempoBpm,
                signal: abortController.signal,
                onProgress: (preparation) => setState((current) => ({ ...current, preparation })),
            });
            const testConfig = readTestConfig();
            const planOptions = {
                ...(recursiveRoots !== null
                    ? { roots: [...recursiveRoots] }
                    : (testConfig.roots ? { roots: testConfig.roots } : {})),
                ...(testConfig.holdSeconds ? { holdSeconds: testConfig.holdSeconds } : {}),
                ...(testConfig.tailCapSeconds ? { tailCapSeconds: testConfig.tailCapSeconds } : {}),
            };
            const result = await coordinator.bounce({
                preBouncePatchDocument: patchDocument,
                captureRequest: {
                    snapshot: recipe.snapshot,
                    planOptions,
                    ...((testConfig.concurrency ?? (recursive ? 1 : null))
                        ? { concurrency: testConfig.concurrency ?? 1 }
                        : {}),
                    signal: abortController.signal,
                },
            });
            const metrics = result.capture.metrics;
            console.info("[bounce] capture completed (absolute VM timing is advisory)", {
                roots: result.capture.plan.roots.length,
                sampleRate: result.capture.plan.snapshot.sampleRate,
                workers: testConfig.concurrency ?? (recursive ? 1 : "auto"),
                metrics,
            });
            recordTestDiagnostic("captures", {
                generation: result.bounceDocument.generation,
                sourceGeneration: recipe.snapshot.sourceGeneration,
                digest: result.capture.digest,
                roots: [...result.capture.plan.roots],
                wasmMemoryPages: metrics.map((entry) => entry.wasmMemoryPages),
            });
            setState((current) => ({
                ...current,
                hydrated: true,
                sampled: true,
                document: result.bounceDocument,
                bank: result.capture.bank,
                preparation: null,
                error: null,
            }));

            // A successful install overwrote the inactive DSP slot. Starting
            // with generation 3, the prior document's own Revert bank is now
            // beyond the locked one-level history and can be retired only if
            // no live patch, preset, or state save still roots it.
            const supersededDigest = previousBounceDocument?.revertRef.bankDigest ?? null;
            let retirement: unknown;
            try {
                if (supersededDigest === null) {
                    const usage = await store.usage();
                    retirement = Object.freeze({
                        completed: true,
                        reason: "no-superseded-bank",
                        deletedDigests: Object.freeze([]),
                        before: usage,
                        after: usage,
                    });
                } else {
                    retirement = await retireSupersededBounceBanks({
                        store,
                        candidateDigests: [supersededDigest],
                        dspOverwrittenDigests: [supersededDigest],
                        livePatchDocument: result.patchDocument,
                        userPresetState: userPresetStateRef.current,
                        userPresetStateKnown: userPresetStateKnownRef.current,
                        hasExternalPresetFileStore: hasExternalPresetFileStore(),
                    });
                }
            } catch (cause) {
                // Retirement is strictly post-commit housekeeping. Its safe
                // failure mode is retaining bytes, never misreporting or
                // rolling back a Bounce that is already audible.
                retirement = Object.freeze({
                    completed: false,
                    reason: `gc-failed: ${errorMessage(cause)}`,
                    deletedDigests: Object.freeze([]),
                    before: null,
                    after: null,
                });
            }
            recordTestDiagnostic("retirements", retirement);
            console.info("[bounce] bank retention", retirement);
        } catch (cause) {
            setState((current) => ({
                ...current,
                phase: "idle",
                busy: false,
                cancellable: false,
                preparation: null,
                error: isAbort(cause) ? null : errorMessage(cause),
            }));
        } finally {
            if (preparationAbortRef.current === abortController) {
                preparationAbortRef.current = null;
            }
        }
    }, [connection, coordinator, resourceClient, state.busy]);

    const cancel = useCallback(() => {
        preparationAbortRef.current?.abort();
        coordinator.cancel();
    }, [coordinator]);

    const revert = useCallback(async () => {
        if (state.busy || !state.document) return;
        setState((current) => ({
            ...current,
            phase: "reverting",
            busy: true,
            cancellable: false,
            error: null,
        }));
        try {
            const currentPatchDocument = await captureLiveBouncePatchDocument(connection, {
                storedStateDefaults: PRODUCT_STORED_STATE_DEFAULTS,
            });
            const previousDocument = await coordinator.revert(currentPatchDocument);
            const previousBounce = readBounceDocumentFromPatch(previousDocument);
            await presentStoredReference(previousBounce ?? null);
        } catch (cause) {
            setState((current) => ({
                ...current,
                phase: "idle",
                busy: false,
                cancellable: false,
                error: errorMessage(cause),
            }));
        }
    }, [connection, coordinator, presentStoredReference, state.busy, state.document]);

    useEffect(() => () => {
        preparationAbortRef.current?.abort();
        coordinator.cancel();
    }, [coordinator]);

    return useMemo(() => ({ state, bounce, cancel, revert }), [bounce, cancel, revert, state]);
}
