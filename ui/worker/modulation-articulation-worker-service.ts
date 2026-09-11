import type { PatchConnectionLike } from "../shared/cmajor-react";
import type { CmajorStatePublicationOutcome } from "../../kit/ui/plugin-state-cmajor";
import type { EngineApplication } from "../../kit/ui/plugin-state-engine";
import {
    ARTICULATIONS_V4_STATE_KEY,
    buildArticulationTriggerConfigV4,
    compileArticulationOverrideImages,
    createEmptyArticulationsState,
    parseArticulationsV4,
    type ArticulationsState,
} from "../shared/articulation-image";
import {
    ARTICULATION_MAX_SLOTS,
    ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    createDisabledArticulationRuntimeUpload,
    sendNativeArticulationTriggerConfig,
    type ArticulationTriggerConfig,
    type ArticulationSnapshotRuntimeUpload,
} from "../shared/articulations";
import {
    MODULATION_STATE_KEY,
    buildModulationRuntimeEvents,
    createDefaultModulationState,
    parseModulationState,
    type ModulationState,
} from "../shared/modulation";
import type { MsegShape } from "../shared/mseg";
import { getModulationArticulationCellIndex } from "../shared/modulation-runtime-program";
import {
    RUNTIME_STATE_ENDPOINT_ID,
    getRuntimeDspSessionId,
} from "../shared/runtime-dsp-session";
import {
    RuntimeInstallLane,
    RUNTIME_SYNC_REQUEST_ENDPOINT_ID,
    RUNTIME_INSTALL_SEND_TIMEOUT_MS,
    type RuntimeInstallOutcome,
    type RuntimeInstallCommand,
} from "../shared/runtime-install-channel";

const runtimeRecoveryDelayMilliseconds = 1_000;
const bootStoredStateKeys = [MODULATION_STATE_KEY, ARTICULATIONS_V4_STATE_KEY] as const;

/** The state framework supplies modulation; articulation retains its existing stored input. */
export type FrameworkModulationInput = {
    readonly publishTriggerConfig: (config: ArticulationTriggerConfig) => Promise<CmajorStatePublicationOutcome>;
    readonly onDefect: (error: unknown) => void;
    readonly curveCommand?: (slotIndex: number, shapeIndex: number, shape: MsegShape) => RuntimeInstallCommand;
};

type StoredStateMessage = { key?: unknown; value?: unknown };
type BootStoredState = Record<string, unknown>;

function hasOwnValue(record: Record<string, unknown>, key: string) {
    return Object.prototype.hasOwnProperty.call(record, key);
}

function getFullStoredStateValue(storedState: unknown, key: string) {
    const fullState = storedState && typeof storedState === "object"
        ? storedState as Record<string, unknown>
        : {};
    const values = fullState.values && typeof fullState.values === "object"
        ? fullState.values as Record<string, unknown>
        : {};

    if (hasOwnValue(values, key)) return values[key];
    if (hasOwnValue(fullState, key)) return fullState[key];
    return undefined;
}

function parseStoredArticulations(
    value: unknown,
    acceptedRouteIds: ReadonlySet<string>,
): ArticulationsState | null {
    if (value === undefined) return createEmptyArticulationsState();

    let document = value;
    if (typeof document === "string") {
        try {
            document = JSON.parse(document);
        } catch {
            return null;
        }
    }
    const parsed = parseArticulationsV4(document, acceptedRouteIds);
    return parsed._tag === "ok" ? parsed.value : null;
}

function articulationRouteIds(state: ModulationState): ReadonlySet<string> {
    return new Set(state.routes.flatMap((route) => (
        getModulationArticulationCellIndex(route) === null ? [] : [route.id]
    )));
}

function stableToken(value: unknown) {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function installFailure(lane: "modulation" | "articulation", outcome: RuntimeInstallOutcome): EngineApplication | undefined {
    switch (outcome._tag) {
        case "accepted":
        case "superseded":
        case "stopped": return undefined;
        case "rejected": return { kind: "failed", error: { kind: "engine-rejected", message: `The ${lane} runtime rejected the update (reason ${outcome.acknowledgement.rejectionReason}).` } };
        case "transport-timeout": return { kind: "failed", error: { kind: "transport", message: `The ${lane} runtime did not acknowledge the update.` } };
        case "unavailable": return { kind: "failed", error: { kind: "resource", message: `The ${lane} runtime is unavailable (${outcome.reason}).` } };
    }
}

/**
 * One delivery coordinator for the two dependent runtime lanes.
 * Modulation is acknowledged before articulation is compiled and published.
 */
export class ModulationArticulationWorkerService {
    private modulationState = createDefaultModulationState();
    private articulationBank = createEmptyArticulationsState();
    private hasModulationState = false;
    private hasArticulationState = false;
    private hasRuntimeState = false;
    private dspSessionId = 0;
    private runtimeGeneration = 0;
    private started = false;
    private lifecycleEpoch = 0;
    private bootPending = false;
    private pendingBootKeys: Map<string, unknown> | null = null;
    private readonly bootEvents: Array<{ key: string; value: unknown }> = [];
    private deliveryInProgress = false;
    private deliveryRefreshPending = false;
    private lastAppliedModulationState: ModulationState | null = null;
    private lastAppliedModulationGeneration = -1;
    private lastAppliedArticulationGeneration = -1;
    private lastAppliedArticulationTokens: Array<string | null | undefined> = Array.from(
        { length: ARTICULATION_MAX_SLOTS },
        () => null,
    );
    private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly lastRejectedToken = new Map<"modulation" | "articulation", string>();
    private readonly modulationLane: RuntimeInstallLane;
    private readonly articulationLane: RuntimeInstallLane;
    private deliveryObserver: ((status: EngineApplication) => void) | undefined;

    private readonly handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
    private readonly handleRuntimeStateBound = this.handleRuntimeState.bind(this);

    constructor(
        private readonly connection: PatchConnectionLike,
        private readonly frameworkInput?: FrameworkModulationInput,
    ) {
        this.modulationLane = new RuntimeInstallLane(connection, { laneKind: "modulation" });
        this.articulationLane = new RuntimeInstallLane(connection, { laneKind: "articulation" });
    }

    /** Replace desired engine data already accepted by the framework, without persisting it. */
    replaceModulation(state: ModulationState, observer: (status: EngineApplication) => void) {
        if (!this.frameworkInput) throw new Error("Stored modulation input cannot accept framework replacements.");
        this.modulationState = state;
        this.hasModulationState = true;
        this.deliveryObserver = observer;
        this.applyRuntimeStateIfReady();
    }

    private get bootKeys(): readonly string[] {
        return this.frameworkInput ? [ARTICULATIONS_V4_STATE_KEY] : bootStoredStateKeys;
    }

    start() {
        if (this.started) return;
        this.started = true;
        this.lifecycleEpoch += 1;
        this.modulationLane.start();
        this.articulationLane.start();
        this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound);
        this.connection.addEndpointListener?.(RUNTIME_STATE_ENDPOINT_ID, this.handleRuntimeStateBound);
        this.requestBootState(this.lifecycleEpoch);
    }

    stop() {
        if (!this.started) return;
        this.started = false;
        this.lifecycleEpoch += 1;
        this.bootPending = false;
        this.pendingBootKeys = null;
        this.bootEvents.length = 0;
        this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound);
        this.connection.removeEndpointListener?.(RUNTIME_STATE_ENDPOINT_ID, this.handleRuntimeStateBound);
        this.clearRecoveryTimer();
        this.lastRejectedToken.clear();
        this.articulationLane.stop();
        this.modulationLane.stop();
    }

    private requestBootState(epoch: number) {
        this.bootPending = true;
        this.bootEvents.length = 0;

        if (typeof this.connection.requestFullStoredState === "function") {
            this.connection.requestFullStoredState((storedState) => {
                if (!this.started || epoch !== this.lifecycleEpoch) return;
                this.applyBootState(storedState);
                this.finishBoot();
            });
            return;
        }

        if (typeof this.connection.requestStoredStateValue === "function") {
            this.pendingBootKeys = new Map();
            for (const key of this.bootKeys) this.connection.requestStoredStateValue(key);
            return;
        }

        this.applyBootState({});
        this.finishBoot();
    }

    private finishBoot() {
        const events = this.bootEvents.splice(0);
        this.bootPending = false;
        this.pendingBootKeys = null;
        for (const event of events) this.applyLiveStoredState(event.key, event.value);
        this.applyRuntimeStateIfReady();
    }

    private applyBootState(storedState: unknown) {
        const rawModulation = getFullStoredStateValue(storedState, MODULATION_STATE_KEY);
        const parsedModulation = this.frameworkInput
            ? { _tag: "ok", value: this.modulationState } as const
            : rawModulation === undefined
            ? { _tag: "ok", value: createDefaultModulationState() } as const
            : parseModulationState(rawModulation);
        if (parsedModulation._tag === "err") {
            console.error(`[runtime-state-worker] ${MODULATION_STATE_KEY} is invalid; boot state was not installed.`);
            const rawArticulations = getFullStoredStateValue(storedState, ARTICULATIONS_V4_STATE_KEY);
            const independentArticulations = parseStoredArticulations(rawArticulations, new Set());
            if (independentArticulations !== null) {
                this.articulationBank = independentArticulations;
                this.hasArticulationState = true;
            }
            return;
        }
        this.modulationState = parsedModulation.value;
        this.hasModulationState = true;
        const rawArticulations = getFullStoredStateValue(storedState, ARTICULATIONS_V4_STATE_KEY);
        const parsedArticulations = parseStoredArticulations(
            rawArticulations,
            articulationRouteIds(parsedModulation.value),
        );
        if (parsedArticulations === null) {
            console.error(`[runtime-state-worker] ${ARTICULATIONS_V4_STATE_KEY} is invalid; boot state was not installed.`);
            return;
        }

        this.articulationBank = parsedArticulations;
        this.hasArticulationState = true;
    }

    private handleStoredStateValue(message: unknown) {
        if (!this.started || !message || typeof message !== "object") return;
        const next = message as StoredStateMessage;
        if (typeof next.key !== "string" || !this.bootKeys.includes(next.key)) {
            return;
        }

        if (this.bootPending) {
            if (this.pendingBootKeys !== null) {
                this.pendingBootKeys.set(next.key, next.value);
                if (this.pendingBootKeys.size === this.bootKeys.length) {
                    const bootState: BootStoredState = Object.fromEntries(this.pendingBootKeys);
                    this.applyBootState(bootState);
                    this.finishBoot();
                }
                return;
            }
            this.bootEvents.push({ key: next.key, value: next.value });
            return;
        }

        this.applyLiveStoredState(next.key, next.value);
    }

    private applyLiveStoredState(key: string, value: unknown) {
        if (key === MODULATION_STATE_KEY) {
            const parsed = parseModulationState(value);
            if (parsed._tag === "err") {
                console.error(`[runtime-state-worker] Rejected invalid ${MODULATION_STATE_KEY}.`);
                return;
            }
            this.modulationState = parsed.value;
            this.hasModulationState = true;
            this.applyRuntimeStateIfReady();
            return;
        }

        const parsed = parseStoredArticulations(value, articulationRouteIds(this.modulationState));
        if (parsed === null) {
            console.error(`[runtime-state-worker] Rejected invalid ${ARTICULATIONS_V4_STATE_KEY}.`);
            return;
        }
        this.articulationBank = parsed;
        this.hasArticulationState = true;
        this.applyRuntimeStateIfReady();
    }

    private handleRuntimeState(value: unknown) {
        if (!this.started) return;
        const nextDspSessionId = getRuntimeDspSessionId(value);
        this.modulationLane.observeRuntime(nextDspSessionId);
        this.articulationLane.observeRuntime(nextDspSessionId);
        if (!this.hasRuntimeState) {
            this.hasRuntimeState = true;
            this.dspSessionId = nextDspSessionId;
            this.clearRecoveryTimer();
            this.applyRuntimeStateIfReady();
            return;
        }
        if (nextDspSessionId === this.dspSessionId) return;
        this.dspSessionId = nextDspSessionId;
        this.runtimeGeneration += 1;
        this.clearRecoveryTimer();
        this.lastRejectedToken.clear();
        this.applyRuntimeStateIfReady();
    }

    private applyRuntimeStateIfReady() {
        if (!this.started
            || this.bootPending
            || !this.hasModulationState
            || !this.hasArticulationState) {
            return;
        }
        if (!this.hasRuntimeState) {
            // An owner can attach after the startup announcement. This query
            // emits runtimeState without installing a bank; retry a lost
            // handoff using the same bounded recovery timer as lane delivery.
            if (this.frameworkInput && this.recoveryTimer === null) {
                this.connection.sendEventOrValue?.(RUNTIME_SYNC_REQUEST_ENDPOINT_ID, 0, undefined, RUNTIME_INSTALL_SEND_TIMEOUT_MS);
                if (!this.hasRuntimeState) this.scheduleRecovery();
            }
            return;
        }
        if (this.deliveryInProgress) {
            this.deliveryRefreshPending = true;
            return;
        }

        this.deliveryInProgress = true;
        this.deliveryRefreshPending = false;
        const lifecycle = this.lifecycleEpoch;
        void this.deliverRuntimeState().catch((error: unknown) => {
            if (!this.started || lifecycle !== this.lifecycleEpoch) return;
            if (this.frameworkInput) {
                this.stop();
                this.frameworkInput.onDefect(error);
                return;
            }
            console.error("[runtime-state-worker] Runtime delivery failed unexpectedly.", error);
            this.scheduleRecovery();
            this.finishDelivery();
        });
    }

    private async deliverRuntimeState() {
        const capturedLifecycle = this.lifecycleEpoch;
        const capturedGeneration = this.runtimeGeneration;
        const capturedModulation = this.modulationState;
        const capturedArticulations = this.articulationBank;
        const capturedObserver = this.deliveryObserver;
        const modulationSessionRefresh = this.lastAppliedModulationGeneration !== capturedGeneration;
        const previous = modulationSessionRefresh ? null : this.lastAppliedModulationState;
        const modulationEvents = this.frameworkInput?.curveCommand
            ? buildModulationRuntimeEvents(capturedModulation, previous, this.frameworkInput.curveCommand)
            : buildModulationRuntimeEvents(capturedModulation, previous);
        const modulationOutcome = await this.modulationLane.sendBatch(modulationEvents);
        if (!this.started || capturedLifecycle !== this.lifecycleEpoch) return;
        if (!this.acceptOutcome("modulation", modulationOutcome, capturedModulation)) {
            // Earlier packets may already have changed the DSP. An interrupted
            // bank is not the previous complete bank, even when Undo wants it.
            this.lastAppliedModulationState = null;
            this.lastAppliedModulationGeneration = -1;
            const failure = installFailure("modulation", modulationOutcome);
            if (failure) capturedObserver?.(failure);
            this.finishDelivery();
            return;
        }
        this.lastAppliedModulationState = capturedModulation;
        this.lastAppliedModulationGeneration = capturedGeneration;

        if (this.desiredStateChanged(capturedGeneration, capturedModulation, capturedArticulations)) {
            this.deliveryRefreshPending = true;
            this.finishDelivery();
            return;
        }

        const uploadsBySelector = this.buildUploadsBySelector(capturedModulation, capturedArticulations);
        const nextTokens = Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, selector) => {
            const upload = uploadsBySelector.get(selector);
            return upload ? stableToken(upload) : null;
        });
        const articulationSessionRefresh = this.lastAppliedArticulationGeneration !== capturedGeneration;
        const mustClearUnknownSelectors = articulationSessionRefresh
            && this.articulationLane.getAcceptedFrontier() !== 0;
        const articulationEvents: Array<{ endpointID: string; value: ArticulationSnapshotRuntimeUpload }> = [];

        for (let selector = 0; selector < ARTICULATION_MAX_SLOTS; selector += 1) {
            const upload = uploadsBySelector.get(selector);
            const changed = nextTokens[selector] !== this.lastAppliedArticulationTokens[selector];
            if (mustClearUnknownSelectors) {
                articulationEvents.push({
                    endpointID: ARTICULATION_SNAPSHOT_ENDPOINT_ID,
                    value: upload ?? createDisabledArticulationRuntimeUpload(selector),
                });
            } else if (articulationSessionRefresh) {
                if (upload) articulationEvents.push({ endpointID: ARTICULATION_SNAPSHOT_ENDPOINT_ID, value: upload });
            } else if (changed) {
                articulationEvents.push({
                    endpointID: ARTICULATION_SNAPSHOT_ENDPOINT_ID,
                    value: upload ?? createDisabledArticulationRuntimeUpload(selector),
                });
            }
        }

        const articulationOutcome = await this.articulationLane.sendBatch(articulationEvents);
        if (!this.started || capturedLifecycle !== this.lifecycleEpoch) return;
        if (this.acceptOutcome("articulation", articulationOutcome, nextTokens)) {
            this.lastAppliedArticulationGeneration = capturedGeneration;
            this.lastAppliedArticulationTokens = nextTokens;
            const triggerConfig = buildArticulationTriggerConfigV4(capturedArticulations);
            if (this.frameworkInput) {
                const outcome = await this.frameworkInput.publishTriggerConfig(triggerConfig);
                if (!this.started || capturedLifecycle !== this.lifecycleEpoch) return;
                if (outcome.kind !== "cancelled") capturedObserver?.(outcome);
            } else {
                sendNativeArticulationTriggerConfig(triggerConfig, this.connection);
            }
            this.clearRecoveryTimer();
            this.lastRejectedToken.clear();
        } else {
            // A partial batch leaves only its attempted selectors uncertain.
            // Reconcile those even if the next desired bank is the old bank.
            for (const event of articulationEvents) this.lastAppliedArticulationTokens[event.value.selectorA] = undefined;
            const failure = installFailure("articulation", articulationOutcome);
            if (failure) capturedObserver?.(failure);
        }
        this.finishDelivery();
    }

    private desiredStateChanged(
        generation: number,
        modulation: ModulationState,
        articulations: ArticulationsState,
    ) {
        return generation !== this.runtimeGeneration
            || modulation !== this.modulationState
            || articulations !== this.articulationBank;
    }

    private buildUploadsBySelector(modulation: ModulationState, articulations: ArticulationsState) {
        const routeCells = Object.fromEntries(modulation.routes.flatMap((route) => {
            const cellIndex = getModulationArticulationCellIndex(route);
            return cellIndex === null ? [] : [[route.id, cellIndex] as const];
        }));
        return new Map<number, ArticulationSnapshotRuntimeUpload>(
            compileArticulationOverrideImages(articulations, routeCells)
                .map((upload) => [upload.selectorA, upload]),
        );
    }

    private acceptOutcome(
        lane: "modulation" | "articulation",
        outcome: RuntimeInstallOutcome,
        desired: unknown,
    ) {
        if (outcome._tag === "accepted") return true;
        if (outcome._tag === "superseded" || outcome._tag === "stopped") return false;

        const token = stableToken(desired);
        const shouldRetry = outcome._tag !== "rejected" || this.lastRejectedToken.get(lane) !== token;
        if (outcome._tag === "rejected") this.lastRejectedToken.set(lane, token);
        console.error(`[runtime-state-worker] ${lane} delivery was not accepted.`, { outcome: outcome._tag });
        if (shouldRetry) this.scheduleRecovery();
        return false;
    }

    private scheduleRecovery() {
        if (!this.started || this.recoveryTimer !== null) return;
        this.recoveryTimer = setTimeout(() => {
            this.recoveryTimer = null;
            this.applyRuntimeStateIfReady();
        }, runtimeRecoveryDelayMilliseconds);
    }

    private clearRecoveryTimer() {
        if (this.recoveryTimer === null) return;
        clearTimeout(this.recoveryTimer);
        this.recoveryTimer = null;
    }

    private finishDelivery() {
        this.deliveryInProgress = false;
        if (!this.started) return;
        const shouldRefresh = this.deliveryRefreshPending;
        this.deliveryRefreshPending = false;
        if (shouldRefresh) this.applyRuntimeStateIfReady();
    }
}

export function createModulationArticulationWorkerService(connection: PatchConnectionLike) {
    return new ModulationArticulationWorkerService(connection);
}
