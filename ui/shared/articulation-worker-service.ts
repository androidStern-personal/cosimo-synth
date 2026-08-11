import type { PatchConnectionLike } from "./cmajor-react";
import {
    ARTICULATIONS_V3_STATE_KEY,
    createEmptyArticulationsState,
    parseArticulationsV3,
    resolveArticulationImages,
    type ArticulationsState,
} from "./articulation-image";
import {
    ARTICULATION_MAX_SLOTS,
    ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    createDisabledArticulationRuntimeUpload,
    type ArticulationSnapshotRuntimeUpload,
} from "./articulations";
import {
    UI_PATCH_VALUES_STATE_KEY,
    buildArticulationPatchVoiceBase,
    createDefaultUiPatchValues,
    deserializeUiPatchValues,
    getArticulationModulationDependencyToken,
    getArticulationPatchValuesDependencyToken,
} from "./articulation-runtime-base";
import {
    MODULATION_STATE_KEY,
    createDefaultModulationState,
    parseModulationState,
    type ModulationState,
} from "./modulation";
import { getModulationArticulationCellIndex } from "./modulation-runtime-program";
import {
    RuntimeInstallLane,
    type RuntimeInstallOutcome,
} from "./runtime-install-channel";

const runtimeStateEndpointID = "runtimeState";
const runtimeRecoveryDelayMilliseconds = 1_000;

const bootStoredStateKeys = [
    ARTICULATIONS_V3_STATE_KEY,
    UI_PATCH_VALUES_STATE_KEY,
    MODULATION_STATE_KEY,
] as const;

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

    if (hasOwnValue(values, key)) {
        return values[key];
    }
    if (hasOwnValue(fullState, key)) {
        return fullState[key];
    }
    return undefined;
}

function getRuntimeDspSessionId(value: unknown) {
    if (!value || typeof value !== "object") {
        return 0;
    }
    return Math.trunc(Number((value as { dspSessionId?: unknown }).dspSessionId) || 0);
}

function parseStoredArticulationsV3(
    value: unknown,
    acceptedRouteIds: ReadonlySet<string>,
): ArticulationsState {
    if (value === undefined) {
        return createEmptyArticulationsState();
    }
    let document: unknown = value;
    if (typeof document === "string") {
        try {
            document = JSON.parse(document);
        } catch {
            throw new Error(`${ARTICULATIONS_V3_STATE_KEY} is not valid JSON.`);
        }
    }
    const parsed = parseArticulationsV3(document, acceptedRouteIds);
    if (parsed._tag === "err") {
        throw parsed.error;
    }
    return parsed.value;
}

function toStableToken(value: unknown) {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export class ArticulationWorkerService {
    private articulationBank: ArticulationsState = createEmptyArticulationsState();
    private modulationState: ModulationState = createDefaultModulationState();
    private uiPatchValues: Record<string, number> = createDefaultUiPatchValues();
    private hasArticulationState = false;
    private hasModulationState = false;
    private hasPatchValues = false;
    private hasRuntimeState = false;
    private modulationDependencyToken: string | null = null;
    private patchValuesDependencyToken: string | null = null;
    private pendingBootStoredValues: Map<string, unknown> | null = null;
    private runtimeDspSessionId = 0;
    private runtimeGeneration = 0;
    private started = false;
    private deliveryInProgress = false;
    private deliveryRefreshPending = false;
    private lastAppliedRuntimeGeneration = -1;
    private lastAppliedUploadTokens: Array<string | null> = Array.from(
        { length: ARTICULATION_MAX_SLOTS },
        () => null,
    );
    private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    private lastRejectedReplayToken: string | null = null;
    private readonly installLane: RuntimeInstallLane;

    private readonly handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
    private readonly handleRuntimeStateBound = this.handleRuntimeState.bind(this);

    constructor(private readonly connection: PatchConnectionLike) {
        this.installLane = new RuntimeInstallLane(connection, {
            laneKind: "articulation",
        });
    }

    start() {
        if (this.started) {
            return;
        }
        this.started = true;
        this.installLane.start();
        this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound);
        this.connection.addEndpointListener?.(runtimeStateEndpointID, this.handleRuntimeStateBound);
        this.requestBootState();
    }

    stop() {
        if (!this.started) {
            return;
        }
        this.started = false;
        this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound);
        this.connection.removeEndpointListener?.(runtimeStateEndpointID, this.handleRuntimeStateBound);
        this.clearRecoveryTimer();
        this.lastRejectedReplayToken = null;
        this.installLane.stop();
    }

    private requestBootState() {
        if (typeof this.connection.requestFullStoredState === "function") {
            this.connection.requestFullStoredState((storedState) => {
                this.applyModulationState(getFullStoredStateValue(storedState, MODULATION_STATE_KEY));
                this.applyPatchValues(getFullStoredStateValue(storedState, UI_PATCH_VALUES_STATE_KEY));
                this.applyArticulationState(getFullStoredStateValue(storedState, ARTICULATIONS_V3_STATE_KEY));
            });
            return;
        }

        if (typeof this.connection.requestStoredStateValue !== "function") {
            this.applyModulationState(undefined);
            this.applyPatchValues(undefined);
            this.applyArticulationState(undefined);
            return;
        }

        this.pendingBootStoredValues = new Map();
        for (const key of bootStoredStateKeys) {
            this.connection.requestStoredStateValue(key);
        }
    }

    private handleStoredStateValue(message: unknown) {
        if (!message || typeof message !== "object") {
            return;
        }
        const nextMessage = message as { key?: unknown; value?: unknown };
        if (typeof nextMessage.key === "string"
            && this.pendingBootStoredValues !== null
            && bootStoredStateKeys.some((key) => key === nextMessage.key)) {
            this.pendingBootStoredValues.set(nextMessage.key, nextMessage.value);
            if (this.pendingBootStoredValues.size === bootStoredStateKeys.length) {
                const bootValues = this.pendingBootStoredValues;
                this.pendingBootStoredValues = null;
                this.applyModulationState(bootValues.get(MODULATION_STATE_KEY));
                this.applyPatchValues(bootValues.get(UI_PATCH_VALUES_STATE_KEY));
                this.applyArticulationState(bootValues.get(ARTICULATIONS_V3_STATE_KEY));
            }
            return;
        }
        if (nextMessage.key === ARTICULATIONS_V3_STATE_KEY) {
            this.applyArticulationState(nextMessage.value);
        } else if (nextMessage.key === UI_PATCH_VALUES_STATE_KEY) {
            this.applyPatchValues(nextMessage.value);
        } else if (nextMessage.key === MODULATION_STATE_KEY) {
            this.applyModulationState(nextMessage.value);
        }
    }

    private handleRuntimeState(value: unknown) {
        const nextDspSessionId = getRuntimeDspSessionId(value);
        this.installLane.observeRuntime(nextDspSessionId);
        if (!this.hasRuntimeState) {
            this.hasRuntimeState = true;
            this.runtimeDspSessionId = nextDspSessionId;
            this.applyRuntimeStateIfReady();
            return;
        }
        if (nextDspSessionId === this.runtimeDspSessionId) {
            return;
        }
        this.runtimeDspSessionId = nextDspSessionId;
        this.runtimeGeneration += 1;
        this.clearRecoveryTimer();
        this.lastRejectedReplayToken = null;
        this.applyRuntimeStateIfReady();
    }

    private applyArticulationState(value: unknown): boolean {
        let nextBank: ArticulationsState;
        try {
            nextBank = parseStoredArticulationsV3(value, this.currentArticulationRouteIds());
        } catch (error) {
            console.error("[articulation-worker] Stored v3 articulation state is invalid.", error);
            if (!this.hasArticulationState) {
                this.hasArticulationState = true;
                this.applyRuntimeStateIfReady();
            }
            return false;
        }
        this.articulationBank = nextBank;
        this.hasArticulationState = true;
        this.applyRuntimeStateIfReady();
        return true;
    }

    private applyPatchValues(value: unknown) {
        let nextPatchValues: Record<string, number>;
        try {
            nextPatchValues = deserializeUiPatchValues(value);
        } catch (error) {
            console.error("[articulation-worker] Stored patch-base state is invalid.", error);
            if (this.hasPatchValues) {
                return;
            }
            nextPatchValues = createDefaultUiPatchValues();
        }
        const nextDependencyToken = getArticulationPatchValuesDependencyToken(nextPatchValues);
        const dependencyChanged = nextDependencyToken !== this.patchValuesDependencyToken;
        this.uiPatchValues = nextPatchValues;
        this.patchValuesDependencyToken = nextDependencyToken;
        const wasReady = this.hasPatchValues;
        this.hasPatchValues = true;
        if (!wasReady || dependencyChanged) {
            this.applyRuntimeStateIfReady();
        }
    }

    private applyModulationState(value: unknown) {
        let nextModulationState = createDefaultModulationState();
        if (value !== undefined) {
            const parsedState = parseModulationState(value);
            if (parsedState._tag === "err") {
                console.error("[articulation-worker] Stored modulation state is invalid.", parsedState.error);
                return;
            } else {
                nextModulationState = parsedState.value;
            }
        }
        const nextDependencyToken = getArticulationModulationDependencyToken(nextModulationState);
        const dependencyChanged = nextDependencyToken !== this.modulationDependencyToken;
        this.modulationState = nextModulationState;
        this.modulationDependencyToken = nextDependencyToken;
        const wasReady = this.hasModulationState;
        this.hasModulationState = true;
        if (!wasReady || dependencyChanged) {
            this.applyRuntimeStateIfReady();
        }
    }

    private buildUploadsBySelector() {
        const uploads = resolveArticulationImages(
            buildArticulationPatchVoiceBase(this.modulationState, this.uiPatchValues),
            this.articulationBank,
        );
        return new Map<number, ArticulationSnapshotRuntimeUpload>(
            uploads.map((upload) => [upload.selectorA, upload]),
        );
    }

    private currentArticulationRouteIds(): ReadonlySet<string> {
        return new Set(this.modulationState.routes.flatMap((route) => (
            getModulationArticulationCellIndex(route) === null ? [] : [route.id]
        )));
    }

    private applyRuntimeStateIfReady() {
        if (!this.hasArticulationState
            || !this.hasModulationState
            || !this.hasPatchValues
            || !this.hasRuntimeState) {
            return;
        }
        if (this.deliveryInProgress) {
            this.deliveryRefreshPending = true;
            return;
        }

        this.clearRecoveryTimer();
        this.deliveryInProgress = true;
        this.deliveryRefreshPending = false;
        void this.deliverRuntimeState().catch((error: unknown) => {
            console.error("[articulation-worker] Acknowledged snapshot delivery failed unexpectedly.", {
                errorType: error instanceof Error ? error.name : typeof error,
            });
            this.scheduleRecovery();
            this.finishDelivery(false, this.runtimeGeneration, this.lastAppliedUploadTokens);
        });
    }

    private async deliverRuntimeState() {
        const capturedRuntimeGeneration = this.runtimeGeneration;
        const baselineOutcome = await this.installLane.waitForSessionBaseline();
        if (baselineOutcome._tag !== "accepted") {
            this.handleInstallOutcome(
                baselineOutcome,
                capturedRuntimeGeneration,
                this.lastAppliedUploadTokens,
            );
            return;
        }

        const uploadsBySelector = this.buildUploadsBySelector();
        const nextUploadTokens = Array.from(
            { length: ARTICULATION_MAX_SLOTS },
            (_, selector) => {
                const upload = uploadsBySelector.get(selector);
                return upload ? toStableToken(upload) : null;
            },
        );
        const sessionRefresh = this.lastAppliedRuntimeGeneration !== capturedRuntimeGeneration;
        const mustClearUnknownSelectors = sessionRefresh
            && this.installLane.getAcceptedFrontier() !== 0;
        const events: Array<{ endpointID: string; value: unknown }> = [];

        for (let selector = 0; selector < ARTICULATION_MAX_SLOTS; selector += 1) {
            const upload = uploadsBySelector.get(selector);
            const changed = nextUploadTokens[selector] !== this.lastAppliedUploadTokens[selector];
            if (mustClearUnknownSelectors) {
                events.push({
                    endpointID: ARTICULATION_SNAPSHOT_ENDPOINT_ID,
                    value: upload ?? createDisabledArticulationRuntimeUpload(selector),
                });
            } else if (sessionRefresh) {
                if (upload) {
                    events.push({ endpointID: ARTICULATION_SNAPSHOT_ENDPOINT_ID, value: upload });
                }
            } else if (changed) {
                events.push({
                    endpointID: ARTICULATION_SNAPSHOT_ENDPOINT_ID,
                    value: upload ?? createDisabledArticulationRuntimeUpload(selector),
                });
            }
        }

        if (events.length === 0) {
            this.finishDelivery(true, capturedRuntimeGeneration, nextUploadTokens);
            return;
        }

        this.handleInstallOutcome(
            await this.installLane.sendBatch(events),
            capturedRuntimeGeneration,
            nextUploadTokens,
        );
    }

    private handleInstallOutcome(
        outcome: RuntimeInstallOutcome,
        runtimeGeneration: number,
        uploadTokens: Array<string | null>,
    ) {
        switch (outcome._tag) {
            case "accepted":
                this.clearRecoveryTimer();
                this.lastRejectedReplayToken = null;
                this.finishDelivery(true, runtimeGeneration, uploadTokens);
                return;
            case "superseded":
            case "stopped":
                this.finishDelivery(false, runtimeGeneration, uploadTokens);
                return;
            case "transport-timeout":
                console.error("[articulation-worker] Runtime acknowledgement timed out; retry is scheduled.", {
                    dspSessionId: this.runtimeDspSessionId,
                });
                this.scheduleRecovery();
                this.finishDelivery(false, runtimeGeneration, uploadTokens);
                return;
            case "rejected":
                const rejectedReplayToken = toStableToken(uploadTokens);
                const fullReplayScheduled = rejectedReplayToken !== this.lastRejectedReplayToken;
                console.error("[articulation-worker] DSP rejected an acknowledged snapshot.", {
                    dspSessionId: this.runtimeDspSessionId,
                    rejectedSerial: outcome.acknowledgement.rejectedSerial,
                    rejectionReason: outcome.acknowledgement.rejectionReason,
                    fullReplayScheduled,
                });
                if (fullReplayScheduled) {
                    this.lastRejectedReplayToken = rejectedReplayToken;
                    this.scheduleRecovery();
                }
                this.finishDelivery(false, runtimeGeneration, uploadTokens);
                return;
            case "unavailable":
                if (this.started) {
                    console.error("[articulation-worker] Runtime install lane was unavailable; retry is scheduled.", {
                        dspSessionId: this.runtimeDspSessionId,
                        reason: outcome.reason,
                    });
                    this.scheduleRecovery();
                }
                this.finishDelivery(false, runtimeGeneration, uploadTokens);
        }
    }

    private clearRecoveryTimer() {
        if (this.recoveryTimer === null) {
            return;
        }
        clearTimeout(this.recoveryTimer);
        this.recoveryTimer = null;
    }

    private scheduleRecovery() {
        if (!this.started || this.recoveryTimer !== null) {
            return;
        }
        this.recoveryTimer = setTimeout(() => {
            this.recoveryTimer = null;
            this.applyRuntimeStateIfReady();
        }, runtimeRecoveryDelayMilliseconds);
    }

    private finishDelivery(
        delivered: boolean,
        runtimeGeneration: number,
        uploadTokens: Array<string | null>,
    ) {
        this.deliveryInProgress = false;
        if (!this.started) {
            return;
        }
        if (delivered) {
            this.lastAppliedRuntimeGeneration = runtimeGeneration;
            this.lastAppliedUploadTokens = uploadTokens;
        }
        const shouldRefresh = this.deliveryRefreshPending
            || runtimeGeneration !== this.runtimeGeneration;
        this.deliveryRefreshPending = false;
        if (shouldRefresh) {
            this.applyRuntimeStateIfReady();
        }
    }
}

export function createArticulationWorkerService(connection: PatchConnectionLike) {
    return new ArticulationWorkerService(connection);
}
