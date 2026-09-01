import type { PatchConnectionLike } from "./cmajor-react";

export type RuntimeEvent = {
    endpointID: string;
    value: unknown;
};

export type StoredStateRuntimeSnapshot<TState> = {
    state: TState;
    parameters: Record<string, unknown>;
    runtimeEndpoints: Record<string, unknown>;
};

export type RuntimeEndpointDependency = {
    endpointID: string;
    required?: boolean;
    mapValue?: (value: unknown) => unknown;
};

export type StoredStateRuntimeMirrorOptions<TState> = {
    stateKey: string;
    /** Ordered read-only fallbacks used only when the primary key is absent. */
    fallbackStateKeys?: string[];
    /** Return null to reject an invalid document without changing the runtime snapshot. */
    deserializeStoredState: (value: unknown) => TState | null;
    buildRuntimeEvents: (
        snapshot: StoredStateRuntimeSnapshot<TState>,
        previousAppliedSnapshot: StoredStateRuntimeSnapshot<TState> | null,
    ) => RuntimeEvent[];
    parameterEndpointIDs?: string[];
    runtimeEndpointDependencies?: RuntimeEndpointDependency[];
    applyDefaultRuntimeStateWhenMissing?: boolean;
    sendRuntimeEvents?: (
        events: RuntimeEvent[],
        desiredSnapshot: StoredStateRuntimeSnapshot<TState>,
    ) => Promise<boolean>;
    onDeliveryFailure?: (events: RuntimeEvent[]) => void;
    sendTimeoutMilliseconds?: number;
};

export const STORED_STATE_RUNTIME_SEND_TIMEOUT_MS = 2_000;

function hasOwnValue(record: Record<string, unknown>, key: string) {
    return Object.prototype.hasOwnProperty.call(record, key);
}

// Kept local (not imported from ui/shared/effects/effect-utils) so this module
// stays dependency-free for the standalone patch_gui transpile in ui/build.mjs.
function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type FullStoredStateLookup = {
    found: boolean;
    value?: unknown;
};

/**
 * The canonical unwrap of one key from a CHOC `requestFullStoredState`
 * envelope: the nested `values` record wins over the top level, and `found`
 * distinguishes an absent key from a stored null/undefined value.
 *
 * Intentionally stricter than the mirror's pre-consolidation private helper:
 * an array-shaped envelope (or `values`) is rejected as not-found instead of
 * being probed for own keys. Real CHOC envelopes are always plain objects.
 */
export function getFullStoredStateValue(storedState: unknown, key: string): FullStoredStateLookup {
    if (!isPlainRecord(storedState)) {
        return { found: false };
    }

    const values = isPlainRecord(storedState.values) ? storedState.values : undefined;

    if (values && hasOwnValue(values, key)) {
        return {
            found: true,
            value: values[key],
        };
    }

    if (hasOwnValue(storedState, key)) {
        return {
            found: true,
            value: storedState[key],
        };
    }

    return { found: false };
}

function toStableToken(value: unknown) {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export class StoredStateRuntimeMirror<TState> {
    private readonly connection: PatchConnectionLike;
    private readonly options: StoredStateRuntimeMirrorOptions<TState>;
    private readonly parameterEndpointIDs: string[];
    private readonly runtimeEndpointDependencies: RuntimeEndpointDependency[];
    private readonly stateKeys: string[];
    private readonly parameterValues = new Map<string, unknown>();
    private readonly parameterListeners = new Map<string, (value: unknown) => void>();
    private readonly runtimeEndpointValues = new Map<string, unknown>();
    private readonly runtimeEndpointListeners = new Map<string, (value: unknown) => void>();
    private state: TState | null = null;
    private deliveryInProgress = false;
    private deliveryRefreshPending = false;
    private forceFullReplay = false;
    private hasState = false;
    private started = false;
    private lastAppliedToken: string | null = null;
    private lastAppliedRuntimeEndpointsToken: string | null = null;
    private lastAppliedSnapshot: StoredStateRuntimeSnapshot<TState> | null = null;
    private pendingStateKeyIndex: number | null = null;
    private activeStateKeyIndex: number | null = null;

    constructor(connection: PatchConnectionLike, options: StoredStateRuntimeMirrorOptions<TState>) {
        this.connection = connection;
        this.options = options;
        this.stateKeys = [...new Set([options.stateKey, ...(options.fallbackStateKeys ?? [])])];
        this.parameterEndpointIDs = [...new Set(options.parameterEndpointIDs ?? [])];
        this.runtimeEndpointDependencies = dedupeRuntimeEndpointDependencies(options.runtimeEndpointDependencies ?? []);
        this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
    }

    start() {
        if (this.started) {
            return;
        }

        this.started = true;
        this.pendingStateKeyIndex = null;
        this.activeStateKeyIndex = null;
        this.connection.addStoredStateValueListener?.(this.handleStoredStateValue);

        for (const endpointID of this.parameterEndpointIDs) {
            this.connection.addParameterListener?.(endpointID, this.getParameterListener(endpointID));
            this.connection.requestParameterValue?.(endpointID);
        }

        for (const dependency of this.runtimeEndpointDependencies) {
            this.connection.addEndpointListener?.(dependency.endpointID, this.getRuntimeEndpointListener(dependency));
        }

        this.requestStoredState();
    }

    stop() {
        if (!this.started) {
            return;
        }

        this.started = false;
        this.connection.removeStoredStateValueListener?.(this.handleStoredStateValue);

        for (const endpointID of this.parameterEndpointIDs) {
            this.connection.removeParameterListener?.(endpointID, this.getParameterListener(endpointID));
        }

        for (const dependency of this.runtimeEndpointDependencies) {
            this.connection.removeEndpointListener?.(dependency.endpointID, this.getRuntimeEndpointListener(dependency));
        }
    }

    /** Rebuild and resend the complete runtime image from the stored snapshot. */
    replayFullRuntimeState() {
        if (!this.started) {
            return;
        }

        this.lastAppliedToken = null;
        this.lastAppliedRuntimeEndpointsToken = null;
        this.lastAppliedSnapshot = null;
        this.forceFullReplay = true;
        this.applyRuntimeStateIfReady();
    }

    private requestStoredState() {
        if (typeof this.connection.requestFullStoredState === "function") {
            this.connection.requestFullStoredState((storedState) => {
                for (let keyIndex = 0; keyIndex < this.stateKeys.length; keyIndex += 1) {
                    const storedValue = getFullStoredStateValue(storedState, this.stateKeys[keyIndex]);
                    if (storedValue.found && storedValue.value != null) {
                        this.activeStateKeyIndex = keyIndex;
                        this.applyStoredValue(storedValue.value);
                        return;
                    }
                }

                if (this.options.applyDefaultRuntimeStateWhenMissing) {
                    this.activeStateKeyIndex = null;
                    this.applyStoredValue(undefined);
                }
            });
            return;
        }

        if (typeof this.connection.requestStoredStateValue === "function") {
            this.requestStateKeyAtIndex(0);
            return;
        }

        if (this.options.applyDefaultRuntimeStateWhenMissing) {
            this.applyStoredValue(undefined);
        }
    }

    private handleStoredStateValue(message: unknown) {
        if (!message || typeof message !== "object") {
            return;
        }

        const nextMessage = message as { key?: unknown; value?: unknown };
        if (typeof nextMessage.key !== "string") {
            return;
        }

        const keyIndex = this.stateKeys.indexOf(nextMessage.key);
        if (keyIndex < 0) {
            return;
        }

        const isPendingResponse = this.pendingStateKeyIndex === keyIndex;
        if (isPendingResponse) {
            this.pendingStateKeyIndex = null;
        }

        if (nextMessage.value == null && isPendingResponse && keyIndex + 1 < this.stateKeys.length) {
            this.activeStateKeyIndex = null;
            this.requestStateKeyAtIndex(keyIndex + 1);
            return;
        }

        if (nextMessage.value == null && !this.options.applyDefaultRuntimeStateWhenMissing) {
            return;
        }

        if (this.activeStateKeyIndex !== null && keyIndex > this.activeStateKeyIndex) {
            return;
        }

        this.activeStateKeyIndex = nextMessage.value == null ? null : keyIndex;
        this.applyStoredValue(nextMessage.value);
    }

    private requestStateKeyAtIndex(keyIndex: number) {
        if (keyIndex >= this.stateKeys.length) {
            if (this.options.applyDefaultRuntimeStateWhenMissing) {
                this.activeStateKeyIndex = null;
                this.applyStoredValue(undefined);
            }
            return;
        }

        this.pendingStateKeyIndex = keyIndex;
        this.connection.requestStoredStateValue?.(this.stateKeys[keyIndex]);
    }

    private getParameterListener(endpointID: string) {
        const existingListener = this.parameterListeners.get(endpointID);

        if (existingListener) {
            return existingListener;
        }

        const listener = (value: unknown) => {
            this.parameterValues.set(endpointID, value);
            this.applyRuntimeStateIfReady();
        };

        this.parameterListeners.set(endpointID, listener);
        return listener;
    }

    private getRuntimeEndpointListener(dependency: RuntimeEndpointDependency) {
        const existingListener = this.runtimeEndpointListeners.get(dependency.endpointID);

        if (existingListener) {
            return existingListener;
        }

        const listener = (value: unknown) => {
            const mappedValue = dependency.mapValue ? dependency.mapValue(value) : value;
            this.runtimeEndpointValues.set(dependency.endpointID, mappedValue);
            this.applyRuntimeStateIfReady();
        };

        this.runtimeEndpointListeners.set(dependency.endpointID, listener);
        return listener;
    }

    private applyStoredValue(value: unknown) {
        const state = this.options.deserializeStoredState(value);
        if (state === null) {
            return;
        }
        this.state = state;
        this.hasState = true;
        this.applyRuntimeStateIfReady();
    }

    private applyRuntimeStateIfReady() {
        if (!this.hasState) {
            return;
        }

        if (this.deliveryInProgress) {
            this.deliveryRefreshPending = true;
            return;
        }

        const parameters: Record<string, unknown> = {};
        for (const endpointID of this.parameterEndpointIDs) {
            if (!this.parameterValues.has(endpointID)) {
                return;
            }

            parameters[endpointID] = this.parameterValues.get(endpointID);
        }

        const runtimeEndpoints: Record<string, unknown> = {};
        for (const dependency of this.runtimeEndpointDependencies) {
            if (!this.runtimeEndpointValues.has(dependency.endpointID)) {
                if (dependency.required) {
                    return;
                }

                continue;
            }

            runtimeEndpoints[dependency.endpointID] = this.runtimeEndpointValues.get(dependency.endpointID);
        }

        const snapshot = {
            state: this.state as TState,
            parameters,
            runtimeEndpoints,
        };
        const runtimeEndpointsToken = toStableToken(runtimeEndpoints);
        const previousAppliedSnapshot = !this.forceFullReplay
            && runtimeEndpointsToken === this.lastAppliedRuntimeEndpointsToken
            ? this.lastAppliedSnapshot
            : null;
        const events = this.options.buildRuntimeEvents(snapshot, previousAppliedSnapshot);
        const nextAppliedToken = toStableToken({
            runtimeEndpoints,
            events,
        });

        if (nextAppliedToken === this.lastAppliedToken) {
            this.lastAppliedRuntimeEndpointsToken = runtimeEndpointsToken;
            this.lastAppliedSnapshot = snapshot;
            return;
        }

        if (events.length === 0) {
            this.lastAppliedToken = nextAppliedToken;
            this.lastAppliedRuntimeEndpointsToken = runtimeEndpointsToken;
            this.lastAppliedSnapshot = snapshot;
            this.forceFullReplay = false;
            return;
        }

        if (this.options.sendRuntimeEvents) {
            this.deliveryInProgress = true;
            this.deliveryRefreshPending = false;
            this.forceFullReplay = false;
            void this.options.sendRuntimeEvents(events, snapshot).then((delivered) => {
                this.deliveryInProgress = false;
                if (!this.started) {
                    return;
                }

                if (delivered) {
                    this.lastAppliedToken = nextAppliedToken;
                    this.lastAppliedRuntimeEndpointsToken = runtimeEndpointsToken;
                    this.lastAppliedSnapshot = snapshot;
                } else {
                    this.options.onDeliveryFailure?.(events);
                }

                const shouldRefresh = this.deliveryRefreshPending;
                this.deliveryRefreshPending = false;
                if (shouldRefresh) {
                    this.applyRuntimeStateIfReady();
                }
            }).catch(() => {
                this.deliveryInProgress = false;
                if (!this.started) {
                    return;
                }
                this.options.onDeliveryFailure?.(events);
                const shouldRefresh = this.deliveryRefreshPending;
                this.deliveryRefreshPending = false;
                if (shouldRefresh) {
                    this.applyRuntimeStateIfReady();
                }
            });
            return;
        }

        for (const event of events) {
            this.connection.sendEventOrValue?.(
                event.endpointID,
                event.value,
                undefined,
                this.options.sendTimeoutMilliseconds ?? STORED_STATE_RUNTIME_SEND_TIMEOUT_MS,
            );
        }

        this.lastAppliedToken = nextAppliedToken;
        this.lastAppliedRuntimeEndpointsToken = runtimeEndpointsToken;
        this.lastAppliedSnapshot = snapshot;
    }
}

function dedupeRuntimeEndpointDependencies(dependencies: RuntimeEndpointDependency[]) {
    const dependenciesByEndpointID = new Map<string, RuntimeEndpointDependency>();

    for (const dependency of dependencies) {
        if (!dependenciesByEndpointID.has(dependency.endpointID)) {
            dependenciesByEndpointID.set(dependency.endpointID, dependency);
        }
    }

    return [...dependenciesByEndpointID.values()];
}

export function createStoredStateRuntimeMirror<TState>(
    connection: PatchConnectionLike,
    options: StoredStateRuntimeMirrorOptions<TState>,
) {
    return new StoredStateRuntimeMirror(connection, options);
}
