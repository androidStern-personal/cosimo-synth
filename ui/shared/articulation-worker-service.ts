import type { PatchConnectionLike } from "./cmajor-react";
import {
    ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    ARTICULATION_STATE_KEY,
    buildArticulationRuntimeUploads,
    normalizeArticulationBank,
    type ArticulationBank,
} from "./articulations";
import {
    MODULATION_STATE_KEY,
    deserializeModulationState,
    type ModulationState,
} from "./modulation";

const runtimeStateEndpointID = "runtimeState";

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

function toStableToken(value: unknown) {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export class ArticulationWorkerService {
    private articulationBank: ArticulationBank = normalizeArticulationBank(undefined);
    private modulationState: ModulationState = deserializeModulationState(undefined);
    private hasArticulationState = false;
    private hasModulationState = false;
    private hasRuntimeState = false;
    private runtimeDspSessionId = 0;
    private started = false;
    private lastAppliedToken: string | null = null;

    private readonly handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
    private readonly handleRuntimeStateBound = this.handleRuntimeState.bind(this);

    constructor(private readonly connection: PatchConnectionLike) {}

    start() {
        if (this.started) {
            return;
        }

        this.started = true;
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
    }

    private requestBootState() {
        if (typeof this.connection.requestFullStoredState === "function") {
            this.connection.requestFullStoredState((storedState) => {
                this.applyArticulationState(getFullStoredStateValue(storedState, ARTICULATION_STATE_KEY));
                this.applyModulationState(getFullStoredStateValue(storedState, MODULATION_STATE_KEY));
            });
            return;
        }

        if (typeof this.connection.requestStoredStateValue === "function") {
            this.connection.requestStoredStateValue(ARTICULATION_STATE_KEY);
            this.connection.requestStoredStateValue(MODULATION_STATE_KEY);
            return;
        }

        this.applyArticulationState(undefined);
        this.applyModulationState(undefined);
    }

    private handleStoredStateValue(message: unknown) {
        if (!message || typeof message !== "object") {
            return;
        }

        const nextMessage = message as { key?: unknown; value?: unknown };

        if (nextMessage.key === ARTICULATION_STATE_KEY) {
            this.applyArticulationState(nextMessage.value);
            return;
        }

        if (nextMessage.key === MODULATION_STATE_KEY) {
            this.applyModulationState(nextMessage.value);
        }
    }

    private handleRuntimeState(value: unknown) {
        this.runtimeDspSessionId = getRuntimeDspSessionId(value);
        this.hasRuntimeState = true;
        this.applyRuntimeStateIfReady();
    }

    private applyArticulationState(value: unknown) {
        this.articulationBank = normalizeArticulationBank(value);
        this.hasArticulationState = true;
        this.applyRuntimeStateIfReady();
    }

    private applyModulationState(value: unknown) {
        this.modulationState = deserializeModulationState(value);
        this.hasModulationState = true;
        this.applyRuntimeStateIfReady();
    }

    private applyRuntimeStateIfReady() {
        if (!this.hasArticulationState || !this.hasModulationState || !this.hasRuntimeState) {
            return;
        }

        const uploads = buildArticulationRuntimeUploads(this.articulationBank, this.modulationState.routes);
        const nextAppliedToken = toStableToken({
            runtimeDspSessionId: this.runtimeDspSessionId,
            uploads,
        });

        if (nextAppliedToken === this.lastAppliedToken) {
            return;
        }

        for (const upload of uploads) {
            this.connection.sendEventOrValue?.(ARTICULATION_SNAPSHOT_ENDPOINT_ID, upload);
        }

        this.lastAppliedToken = nextAppliedToken;
    }
}

export function createArticulationWorkerService(connection: PatchConnectionLike) {
    return new ArticulationWorkerService(connection);
}
