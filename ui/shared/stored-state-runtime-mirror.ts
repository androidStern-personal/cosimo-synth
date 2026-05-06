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
    deserializeStoredState: (value: unknown) => TState;
    buildRuntimeEvents: (snapshot: StoredStateRuntimeSnapshot<TState>) => RuntimeEvent[];
    parameterEndpointIDs?: string[];
    runtimeEndpointDependencies?: RuntimeEndpointDependency[];
    applyDefaultRuntimeStateWhenMissing?: boolean;
};

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
    private readonly parameterValues = new Map<string, unknown>();
    private readonly parameterListeners = new Map<string, (value: unknown) => void>();
    private readonly runtimeEndpointValues = new Map<string, unknown>();
    private readonly runtimeEndpointListeners = new Map<string, (value: unknown) => void>();
    private state: TState | null = null;
    private hasState = false;
    private started = false;
    private lastAppliedToken: string | null = null;

    constructor(connection: PatchConnectionLike, options: StoredStateRuntimeMirrorOptions<TState>) {
        this.connection = connection;
        this.options = options;
        this.parameterEndpointIDs = [...new Set(options.parameterEndpointIDs ?? [])];
        this.runtimeEndpointDependencies = dedupeRuntimeEndpointDependencies(options.runtimeEndpointDependencies ?? []);
        this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
    }

    start() {
        if (this.started) {
            return;
        }

        this.started = true;
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

    private requestStoredState() {
        if (typeof this.connection.requestFullStoredState === "function") {
            this.connection.requestFullStoredState((storedState) => {
                const storedValue = getFullStoredStateValue(storedState, this.options.stateKey);

                if (storedValue.found) {
                    this.applyStoredValue(storedValue.value);
                    return;
                }

                this.handleMissingStoredState();
            });
            return;
        }

        if (typeof this.connection.requestStoredStateValue === "function") {
            this.connection.requestStoredStateValue(this.options.stateKey);
            return;
        }

        this.handleMissingStoredState();
    }

    private handleMissingStoredState() {
        if (typeof this.connection.requestStoredStateValue === "function") {
            this.connection.requestStoredStateValue(this.options.stateKey);
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
        if (nextMessage.key !== this.options.stateKey) {
            return;
        }

        if (nextMessage.value === undefined && !this.options.applyDefaultRuntimeStateWhenMissing) {
            return;
        }

        this.applyStoredValue(nextMessage.value);
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
        this.state = this.options.deserializeStoredState(value);
        this.hasState = true;
        this.applyRuntimeStateIfReady();
    }

    private applyRuntimeStateIfReady() {
        if (!this.hasState) {
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
        const events = this.options.buildRuntimeEvents(snapshot);
        const nextAppliedToken = toStableToken({
            runtimeEndpoints,
            events,
        });

        if (nextAppliedToken === this.lastAppliedToken) {
            return;
        }

        for (const event of events) {
            this.connection.sendEventOrValue?.(event.endpointID, event.value);
        }

        this.lastAppliedToken = nextAppliedToken;
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
