import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { decodeBounceBank } from "../../bounce/bank-format.mjs";
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

declare global {
    // Browser acceptance tests may shorten duration/root count while still
    // traversing the real worker/persistence/install transaction.
    // eslint-disable-next-line no-var
    var __COSIMO_BOUNCE_TEST_CONFIG__: BounceTestConfig | undefined;
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
        ));
}

function assertCapture(capture: {
    bytes: Uint8Array;
    bank: BounceBankView;
}) {
    const decoded = decodeBounceBank(capture.bytes) as BounceBankView;
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

/** Browser product controller for snapshot -> workers -> OPFS -> live flip. */
export function useBounceInPlace() {
    const connection = usePatchConnection();
    const resourceClient = useResourceClient();
    const store = useMemo(() => createBrowserBounceBankStore(), [connection]);
    const [state, setState] = useState<BounceUIState>(INITIAL_STATE);
    const preparationAbortRef = useRef<AbortController | null>(null);
    const hydrationRevisionRef = useRef(0);
    const captureStateKeysRef = useRef(new Set<string>());

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
        capture: (request: Record<string, unknown>) => captureBounceBank({
            ...request,
            workerURL: new URL("patch_gui/bounce-render-worker.js", getDefaultPatchRootUrl()),
            engineModuleURL: new URL("cmaj_Cosimo_Synth.offline.js", getDefaultPatchRootUrl()),
        }),
        persistBank: (capture: { digest: string; bytes: Uint8Array }) => (
            store.put(capture.digest, capture.bytes)
        ),
        stageBankInstall: async (bank: BounceBankView, options: {
            generation: number;
            signal?: AbortSignal;
            onProgress?: (progress: unknown) => void;
        }) => {
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
        verifyCapture: (capture: { bytes: Uint8Array; bank: BounceBankView }) => assertCapture(capture),
        applyPatchDocument,
        readBankByDigest: async (digest: string) => {
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
            const bank = decodeBounceBank(bytes) as BounceBankView;
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
            const recipe = await createProductBounceCaptureSnapshot({
                patchDocument,
                resourceClient,
                sampleRate: engineStatus.sampleRateHz,
                tempoBpm: engineStatus.tempoBpm,
                signal: abortController.signal,
                onProgress: (preparation) => setState((current) => ({ ...current, preparation })),
            });
            const testConfig = readTestConfig();
            const planOptions = {
                ...(testConfig.roots ? { roots: testConfig.roots } : {}),
                ...(testConfig.holdSeconds ? { holdSeconds: testConfig.holdSeconds } : {}),
                ...(testConfig.tailCapSeconds ? { tailCapSeconds: testConfig.tailCapSeconds } : {}),
            };
            const result = await coordinator.bounce({
                preBouncePatchDocument: patchDocument,
                captureRequest: {
                    snapshot: recipe.snapshot,
                    planOptions,
                    ...(testConfig.concurrency ? { concurrency: testConfig.concurrency } : {}),
                    signal: abortController.signal,
                },
            });
            const metrics = result.capture.metrics as ReadonlyArray<{
                rootNote: number;
                realtimeMultiplier: number | null;
                elapsedMilliseconds: number;
            }>;
            console.info("[bounce] capture completed (absolute VM timing is advisory)", {
                roots: result.capture.plan.roots.length,
                sampleRate: result.capture.plan.snapshot.sampleRate,
                workers: testConfig.concurrency ?? "auto",
                metrics,
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
