import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import {
    SPECTRAL_PARTIAL_STATE_KEY,
    buildPartialShapeUpload,
    createDefaultSpectralPartialState,
    normalizeSpectralPartialState,
    parseStrictSpectralPartialStateV1,
    serializeSpectralPartialState,
    type SpectralPartialShapeState,
} from "./spectral-partial-state";

export const SPECTRAL_PARTIAL_ENDPOINTS = {
    partialShapeUpload: "partialShapeUpload",
} as const;

type StoredStateMessage = {
    key?: unknown;
    value?: unknown;
};

type BridgeListener = (state: SpectralPartialShapeState) => void;

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
        return {
            found: true,
            value: values[key],
        };
    }

    if (hasOwnValue(fullState, key)) {
        return {
            found: true,
            value: fullState[key],
        };
    }

    return {
        found: false,
        value: undefined,
    };
}

function toEchoToken(value: unknown): string {
    return typeof value === "string" ? value : JSON.stringify(value);
}

export class SpectralPartialShapeRuntimeBridge {
    private state: SpectralPartialShapeState = createDefaultSpectralPartialState();
    private readonly stateListeners = new Set<BridgeListener>();
    private readonly pendingStoredEchoes = new Map<string, number>();
    private attached = false;
    private bootStoredStatePending = false;
    private liveEditActive = false;
    private liveEditDirty = false;
    private pendingLiveUpload = false;
    private pendingLiveFrame: number | null = null;

    private readonly handleStoredStateValue = (message: unknown) => {
        const stored = message as StoredStateMessage;

        if (stored?.key !== SPECTRAL_PARTIAL_STATE_KEY) {
            return;
        }

        if (this.consumeStoredEcho(stored.value)) {
            return;
        }

        const isBootResponse = this.bootStoredStatePending;
        this.bootStoredStatePending = false;

        if (isBootResponse) {
            this.applyBootStoredState(stored.value);
            return;
        }

        this.cancelLiveEdit();
        this.state = stored.value == null
            ? createDefaultSpectralPartialState()
            : parseStrictSpectralPartialStateV1(stored.value);
        this.uploadRuntimeState();
        this.notifyStateListeners();
    };

    constructor(private readonly patchConnection: PatchConnectionLike) {}

    attach() {
        if (this.attached) {
            return;
        }

        this.attached = true;
        this.patchConnection.addStoredStateValueListener?.(this.handleStoredStateValue);
    }

    detach() {
        if (!this.attached) {
            return;
        }

        this.commitLiveEdit();
        this.attached = false;
        this.patchConnection.removeStoredStateValueListener?.(this.handleStoredStateValue);
    }

    requestBootState() {
        if (typeof this.patchConnection.requestFullStoredState === "function") {
            this.patchConnection.requestFullStoredState((storedState) => {
                const storedValue = getFullStoredStateValue(storedState, SPECTRAL_PARTIAL_STATE_KEY);

                if (storedValue.found) {
                    this.bootStoredStatePending = false;
                    this.applyBootStoredState(storedValue.value);
                    return;
                }

                if (typeof this.patchConnection.requestStoredStateValue === "function") {
                    this.bootStoredStatePending = true;
                    this.patchConnection.requestStoredStateValue(SPECTRAL_PARTIAL_STATE_KEY);
                    return;
                }

                this.bootStoredStatePending = false;
                this.applyBootStoredState(undefined);
            });
            return;
        }

        if (typeof this.patchConnection.requestStoredStateValue === "function") {
            this.bootStoredStatePending = true;
            this.patchConnection.requestStoredStateValue(SPECTRAL_PARTIAL_STATE_KEY);
            return;
        }

        this.applyBootStoredState(undefined);
    }

    subscribe(listener: BridgeListener) {
        this.stateListeners.add(listener);
        listener(this.state);

        return () => {
            this.stateListeners.delete(listener);
        };
    }

    getState() {
        return this.state;
    }

    setState(nextState: SpectralPartialShapeState) {
        this.state = normalizeSpectralPartialState(nextState);

        if (this.liveEditActive) {
            this.liveEditDirty = true;
            this.scheduleLiveRuntimeUpdate();
            this.notifyStateListeners();
            return;
        }

        this.uploadRuntimeState();
        this.persistState();
        this.notifyStateListeners();
    }

    replaceStateFromPreset(nextState: SpectralPartialShapeState) {
        this.cancelLiveEdit();
        this.state = normalizeSpectralPartialState(nextState);
        this.uploadRuntimeState();
        this.persistState();
        this.notifyStateListeners();
    }

    beginLiveEdit() {
        if (this.liveEditActive) {
            return;
        }

        this.liveEditActive = true;
        this.liveEditDirty = false;
    }

    commitLiveEdit() {
        if (!this.liveEditActive) {
            return;
        }

        this.flushLiveRuntimeUpdate();
        const shouldPersist = this.liveEditDirty;
        this.liveEditActive = false;
        this.liveEditDirty = false;

        if (shouldPersist) {
            this.persistState();
        }
    }

    cancelLiveEdit() {
        if (this.pendingLiveFrame !== null && typeof globalThis.cancelAnimationFrame === "function") {
            globalThis.cancelAnimationFrame(this.pendingLiveFrame);
        }

        this.liveEditActive = false;
        this.liveEditDirty = false;
        this.pendingLiveUpload = false;
        this.pendingLiveFrame = null;
    }

    private applyBootStoredState(rawState: unknown) {
        this.cancelLiveEdit();
        this.state = rawState == null
            ? createDefaultSpectralPartialState()
            : parseStrictSpectralPartialStateV1(rawState);
        this.uploadRuntimeState();
        this.notifyStateListeners();
    }

    private scheduleLiveRuntimeUpdate() {
        this.pendingLiveUpload = true;

        if (this.pendingLiveFrame !== null) {
            return;
        }

        if (typeof globalThis.requestAnimationFrame !== "function") {
            this.flushLiveRuntimeUpdate();
            return;
        }

        this.pendingLiveFrame = globalThis.requestAnimationFrame(() => {
            this.pendingLiveFrame = null;
            this.flushLiveRuntimeUpdate();
        });
    }

    private flushLiveRuntimeUpdate() {
        if (!this.pendingLiveUpload) {
            return;
        }

        if (this.pendingLiveFrame !== null && typeof globalThis.cancelAnimationFrame === "function") {
            globalThis.cancelAnimationFrame(this.pendingLiveFrame);
        }

        this.pendingLiveUpload = false;
        this.pendingLiveFrame = null;
        this.uploadRuntimeState();
    }

    private uploadRuntimeState() {
        this.patchConnection.sendEventOrValue?.(
            SPECTRAL_PARTIAL_ENDPOINTS.partialShapeUpload,
            buildPartialShapeUpload(this.state),
        );
    }

    private persistState() {
        const serialized = serializeSpectralPartialState(this.state);
        this.rememberStoredEcho(serialized);
        this.patchConnection.sendStoredStateValue?.(SPECTRAL_PARTIAL_STATE_KEY, serialized);
    }

    private rememberStoredEcho(value: unknown) {
        const token = toEchoToken(value);
        this.pendingStoredEchoes.set(token, (this.pendingStoredEchoes.get(token) ?? 0) + 1);
    }

    private consumeStoredEcho(value: unknown) {
        const token = toEchoToken(value);
        const count = this.pendingStoredEchoes.get(token) ?? 0;

        if (count <= 0) {
            return false;
        }

        if (count === 1) {
            this.pendingStoredEchoes.delete(token);
        } else {
            this.pendingStoredEchoes.set(token, count - 1);
        }

        return true;
    }

    private notifyStateListeners() {
        for (const listener of this.stateListeners) {
            listener(this.state);
        }
    }
}
