import { useCallback, useMemo, useSyncExternalStore } from "react";

import { usePatchConnection, type PatchConnectionLike } from "./cmajor-react";
import {
    reportUserGestureEnd,
    reportUserGestureStart,
    reportUserParameterEdit,
} from "./user-edit-bus";
import {
    LANE_STATE_KEY,
    commitLaneState,
    createDefaultLaneState,
    deserializeLaneState,
    listLaneDeviceInstances,
    sendLaneParamValue,
    serializeLaneState,
    type LaneState,
} from "./lane-state";
import {
    buildPatchModulationTargetOptions,
    type ModulationTargetOption,
} from "./modulation";
import { usePatchParameterBinding, type PatchControlBinding } from "./patch-controls";
import {
    getRackParameterDescriptor,
    type RackParameterDescriptor,
} from "./rack-parameter-descriptors";

/**
 * One shared lane-document store per patch connection.
 *
 * Since the B3 parameter cut, effect parameters have no host endpoints: the
 * lane.v1 document owns every value durably, and live edits ride the
 * laneSlotParamValue field event. Every binding surface (the desktop rack
 * workspace, the iOS view) reads and writes THIS store, so the document
 * cannot fork between surfaces sharing a connection.
 *
 * Write discipline: setValue is the low-latency audible path (optimistic
 * store update + one field event, no document write); endGesture persists
 * the document once. The worker-side stored-state mirror replays the full
 * record set on each document write, which the engine treats as redundant.
 */
type LaneStateStore = {
    state: LaneState;
    readonly listeners: Set<() => void>;
    deliverySerial: number;
    /** The serialized form of `state`, for identity-stable dedupe. */
    serialized: string;
};

const stores = new WeakMap<object, LaneStateStore>();

function readLaneStateFromFullStoredState(fullState: Record<string, unknown>) {
    const values = fullState.values && typeof fullState.values === "object"
        ? fullState.values as Record<string, unknown>
        : {};
    return Object.hasOwn(values, LANE_STATE_KEY) ? values[LANE_STATE_KEY] : fullState[LANE_STATE_KEY];
}

function acceptLaneState(store: LaneStateStore, nextState: LaneState) {
    // Identity-stable: an update that decodes to the document we already hold
    // must not mint a new state object — dozens of bindings subscribe here,
    // and object churn on echoed stored-state traffic re-renders them all.
    const serialized = serializeLaneState(nextState);
    if (serialized === store.serialized) {
        return;
    }
    store.state = nextState;
    store.serialized = serialized;
    for (const listener of [...store.listeners]) {
        listener();
    }
}

function getLaneStateStore(connection: PatchConnectionLike): LaneStateStore {
    const key = connection as unknown as object;
    const existing = stores.get(key);
    if (existing !== undefined) {
        return existing;
    }
    const initialState = createDefaultLaneState();
    const created: LaneStateStore = {
        state: initialState,
        listeners: new Set(),
        deliverySerial: 0,
        serialized: serializeLaneState(initialState),
    };
    stores.set(key, created);

    // ONE hydration per connection, attached imperatively at store creation:
    // per-hook hydration would fan out a full-stored-state request for every
    // mounted binding. The listener lives as long as the connection.
    connection.addStoredStateValueListener?.((message: unknown) => {
        if (typeof message !== "object" || message === null || Array.isArray(message)) {
            return;
        }
        if (Reflect.get(message, "key") === LANE_STATE_KEY) {
            acceptLaneState(created, deserializeLaneState(Reflect.get(message, "value")));
        }
    });
    connection.requestFullStoredState?.((fullState) => {
        acceptLaneState(created, deserializeLaneState(readLaneStateFromFullStoredState(fullState)));
    });

    return created;
}

/**
 * Subscribe to the connection's shared lane document. All surfaces sharing
 * the connection observe the same state object; hydration and stored-state
 * updates fan out through the one store.
 */
export function useLaneStateDoc(): {
    readonly laneState: LaneState;
    readonly commit: (nextState: LaneState) => void;
    readonly setParamValue: (effectId: LaneState["order"][number], endpointID: string, value: number) => void;
    readonly persist: () => void;
} {
    const patchConnection = usePatchConnection();
    const store = getLaneStateStore(patchConnection);

    const laneState = useSyncExternalStore(
        useCallback((onChange) => {
            store.listeners.add(onChange);
            return () => store.listeners.delete(onChange);
        }, [store]),
        () => store.state,
    );

    const commit = useCallback((nextState: LaneState) => {
        acceptLaneState(store, nextState);
        commitLaneState(patchConnection, nextState);
        patchConnection.sendStoredStateValue?.(LANE_STATE_KEY, serializeLaneState(nextState));
    }, [patchConnection, store]);

    const setParamValue = useCallback((effectId: LaneState["order"][number], endpointID: string, value: number) => {
        acceptLaneState(store, {
            ...store.state,
            params: {
                ...store.state.params,
                [effectId]: { ...store.state.params[effectId], [endpointID]: value },
            },
        });
        store.deliverySerial += 1;
        sendLaneParamValue(patchConnection, effectId, endpointID, value, store.deliverySerial);
    }, [patchConnection, store]);

    const persist = useCallback(() => {
        patchConnection.sendStoredStateValue?.(LANE_STATE_KEY, serializeLaneState(store.state));
    }, [patchConnection, store]);

    return useMemo(() => ({ laneState, commit, setParamValue, persist }),
        [laneState, commit, setParamValue, persist]);
}

/**
 * The patch's modulation target picker domain: the static voice core plus one
 * entry per live lane device parameter (instance-labeled). Identity-keyed on
 * the DEVICE LIST, not the document — parameter-value traffic through the
 * lane store must not re-render every mounted picker.
 */
export function usePatchModulationTargetOptions(): ReadonlyArray<ModulationTargetOption> {
    const { laneState } = useLaneStateDoc();
    const devices = listLaneDeviceInstances(laneState);
    const deviceSignature = devices.map((device) => device.instanceId).join("\n");
    // An unchanged signature is an unchanged device list, so the captured
    // `devices` from the first matching render stays correct.
    return useMemo(
        () => buildPatchModulationTargetOptions(devices),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [deviceSignature],
    );
}

/**
 * The lane replacement for a host parameter binding: the same
 * PatchControlBinding surface every knob and slider already speaks, backed
 * by the lane document and the field-upload hot path.
 */
export function useLaneParameterBinding(descriptor: RackParameterDescriptor): PatchControlBinding<number> {
    const patchConnection = usePatchConnection();
    const { laneState, setParamValue, persist } = useLaneStateDoc();

    const clampValue = useCallback((value: number) => {
        const numeric = Number.isFinite(value) ? value : descriptor.initial;
        const clamped = Math.min(descriptor.max, Math.max(descriptor.min, numeric));
        return descriptor.choices !== undefined ? Math.round(clamped) : clamped;
    }, [descriptor.choices, descriptor.initial, descriptor.max, descriptor.min]);

    const value = clampValue(laneState.params[descriptor.effectId][descriptor.endpointID] ?? descriptor.initial);
    const valueRef = { current: value };
    valueRef.current = value;

    // Every write through this binding is a direct user edit (T12 seam A),
    // and gestures ride the connection's gesture channel under the logical
    // parameter id so drag lifecycle stays observable end to end.
    const setValue = useCallback((nextValue: number) => {
        const coerced = clampValue(nextValue);
        const changed = !Object.is(coerced, valueRef.current);
        setParamValue(descriptor.effectId, descriptor.endpointID, coerced);
        reportUserParameterEdit({ endpointID: descriptor.endpointID, changed });
    }, [clampValue, descriptor.effectId, descriptor.endpointID, setParamValue]);

    const beginGesture = useCallback(() => {
        patchConnection.sendParameterGestureStart?.(descriptor.endpointID);
        reportUserGestureStart();
    }, [descriptor.endpointID, patchConnection]);

    const endGesture = useCallback(() => {
        patchConnection.sendParameterGestureEnd?.(descriptor.endpointID);
        reportUserGestureEnd();
        persist();
    }, [descriptor.endpointID, patchConnection, persist]);

    const commitValue = useCallback((nextValue: number) => {
        beginGesture();
        setValue(nextValue);
        endGesture();
    }, [beginGesture, endGesture, setValue]);

    return useMemo(() => ({
        endpointID: descriptor.endpointID,
        value,
        initialValue: descriptor.initial,
        setValue,
        commitValue,
        beginGesture,
        endGesture,
    }), [descriptor.endpointID, descriptor.initial, value, setValue, commitValue, beginGesture, endGesture]);
}

const FALLBACK_LANE_DESCRIPTOR: RackParameterDescriptor | null = getRackParameterDescriptor("delayMix");

/**
 * Base-value binding for a resolved endpoint that may be EITHER a live host
 * parameter (voice-domain targets) or a lane parameter (effect targets, which
 * lost their host endpoints in the parameter cut). Both underlying hooks run
 * unconditionally so the hook order is stable; only the matching one is live.
 */
export function useLaneOrHostParameterBinding({
    endpointID,
    initialValue,
    coerce,
    active = true,
}: {
    endpointID: string;
    initialValue: number;
    coerce: (rawValue: unknown) => number;
    active?: boolean;
}): PatchControlBinding<number> {
    const laneDescriptor = getRackParameterDescriptor(endpointID);
    if (FALLBACK_LANE_DESCRIPTOR === null) {
        throw new Error("The lane parameter catalog is missing its fallback descriptor");
    }
    const laneBinding = useLaneParameterBinding(laneDescriptor ?? FALLBACK_LANE_DESCRIPTOR);
    const hostBinding = usePatchParameterBinding<number>({
        endpointID,
        initialValue,
        coerce,
        active: active && laneDescriptor === null,
    });
    return laneDescriptor === null ? hostBinding : laneBinding;
}

