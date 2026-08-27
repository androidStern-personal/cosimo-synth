import { useCallback, useMemo, useSyncExternalStore } from "react";

import { usePatchConnection, type PatchConnectionLike } from "./cmajor-react";
import {
    reportUserGestureEnd,
    reportUserGestureStart,
    reportUserParameterEdit,
} from "./user-edit-bus";
import {
    EFFECT_ID_TO_LANE_TYPE,
    LANE_OUTPUT_CONTROL_ENDPOINT_ID,
    LANE_SLOT_PARAM_VALUE_ENDPOINT_ID,
    LANE_STATE_KEY,
} from "./lane-state";
import {
    commitLaneStateV2,
    createDefaultLaneStateV2,
    deserializeLaneStateV2,
    LANE_SPLIT_DEFAULT_XOVER_HIGH_HZ,
    LANE_SPLIT_DEFAULT_XOVER_LOW_HZ,
    LANE_SPLIT_XOVER_MAX_HZ,
    LANE_SPLIT_XOVER_MIN_HZ,
    laneSplitMarkerSlotId,
    listLaneDeviceInstancesV2,
    parseLaneInstanceId,
    serializeLaneStateV2,
    setLaneDeviceParam,
    setLaneKeyTrackEnabled as transitionLaneKeyTrackEnabled,
    setLaneOutputBypassed,
    setLaneOutputMix,
    setLaneSplitCrossoverHz,
    setLaneSplitKeyTrackEnabled as transitionLaneSplitKeyTrackEnabled,
    setLaneSplitKeyTrackOffset as transitionLaneSplitKeyTrackOffset,
    type LaneSplitGroupV2,
    type LaneStateV2,
} from "./lane-state-v2";
import {
    LANE_SPLIT_PARAM_XOVER_HIGH_HZ,
    LANE_SPLIT_PARAM_XOVER_HIGH_KEY_TRACK_ENABLED,
    LANE_SPLIT_PARAM_XOVER_HIGH_KEY_TRACK_OFFSET_SEMITONES,
    LANE_SPLIT_PARAM_XOVER_LOW_HZ,
    LANE_SPLIT_PARAM_XOVER_LOW_KEY_TRACK_ENABLED,
    LANE_SPLIT_PARAM_XOVER_LOW_KEY_TRACK_OFFSET_SEMITONES,
} from "./lane-state";
import {
    getLaneSlotId,
    getLaneSlotParamIndex,
    laneDeviceParamEndpoints,
} from "./lane-slot-params";
import type { EffectModuleId } from "./target-descriptor";
import {
    buildPatchModulationTargetOptions,
    type ModulationTargetOption,
} from "./modulation";
import { usePatchParameterBinding, type PatchControlBinding } from "./patch-controls";
import {
    getRackParameterDescriptor,
    type RackParameterDescriptor,
} from "./rack-parameter-descriptors";
import { isOscillatorModulationTargetKind } from "./modulation-targets";
import { getLaneKeyTrackEndpoints, getKeyTrackDefinition, requireKeyTrackRange } from "./key-track";
import {
    readLaneSoloAudition,
    reconcileLaneSoloAudition,
    subscribeLaneSoloAudition,
    toggleLaneSoloAudition,
} from "./lane-solo-audition";
import type { LaneSoloState } from "./lane-solo-state";

/**
 * One shared lane-document store per patch connection.
 *
 * Since the B3 parameter cut, effect parameters have no host endpoints: the
 * lane.v1 stored-state document owns every value durably. Live device edits
 * ride the laneSlotParamValue field event; whole-lane output edits ride the
 * laneOutputControl event. Every binding surface (the desktop rack workspace,
 * the iOS view) reads and writes THIS store, so the document cannot fork
 * between surfaces sharing a connection.
 *
 * Write discipline: setValue is the low-latency audible path (optimistic
 * store update + one field event, no document write); endGesture persists
 * the document once. The worker-side stored-state mirror replays the full
 * record set on each document write, which the engine treats as redundant.
 */
type LaneStateStore = {
    state: LaneStateV2;
    readonly connection: PatchConnectionLike;
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

function acceptLaneState(store: LaneStateStore, nextState: LaneStateV2) {
    // Identity-stable: an update that decodes to the document we already hold
    // must not mint a new state object — dozens of bindings subscribe here,
    // and object churn on echoed stored-state traffic re-renders them all.
    const serialized = serializeLaneStateV2(nextState);
    if (serialized === store.serialized) {
        return;
    }
    reconcileLaneSoloAudition(store.connection, store.state, nextState);
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
    const initialState = createDefaultLaneStateV2();
    const created: LaneStateStore = {
        state: initialState,
        connection,
        listeners: new Set(),
        deliverySerial: 0,
        serialized: serializeLaneStateV2(initialState),
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
            acceptLaneState(created, deserializeLaneStateV2(Reflect.get(message, "value")));
        }
    });
    connection.requestFullStoredState?.((fullState) => {
        acceptLaneState(created, deserializeLaneStateV2(readLaneStateFromFullStoredState(fullState)));
    });

    return created;
}

/** Subscribe a rack surface to instance-lifetime Solo without placing it in the lane document. */
export function useLaneSoloAudition(laneState: LaneStateV2): {
    readonly soloState: LaneSoloState;
    readonly toggleSolo: (groupId: string, branchIndex: number) => boolean;
} {
    const patchConnection = usePatchConnection();
    const soloState = useSyncExternalStore(
        useCallback(
            (onChange) => subscribeLaneSoloAudition(patchConnection, laneState, onChange),
            [laneState, patchConnection],
        ),
        () => readLaneSoloAudition(patchConnection),
    );
    const toggleSolo = useCallback((groupId: string, branchIndex: number) => (
        toggleLaneSoloAudition(patchConnection, laneState, groupId, branchIndex) !== null
    ), [laneState, patchConnection]);

    return useMemo(() => ({ soloState, toggleSolo }), [soloState, toggleSolo]);
}

/**
 * Subscribe to the connection's shared lane document. All surfaces sharing
 * the connection observe the same state object; hydration and stored-state
 * updates fan out through the one store.
 */
export function useLaneStateDoc(): {
    readonly laneState: LaneStateV2;
    readonly commit: (nextState: LaneStateV2) => void;
    readonly setParamValue: (deviceId: string, endpointID: string, value: number) => void;
    readonly setKeyTrackEnabled: (
        deviceId: string,
        ordinaryEndpointID: string,
        enabled: boolean,
    ) => void;
    /** Low-latency whole-lane output edits; persistence remains gesture-scoped. */
    readonly setOutputMix: (mix: number) => void;
    readonly setOutputBypassed: (bypassed: boolean) => void;
    /** The split editor's hot path: optimistic doc update + the acked
        marker-record field upload. */
    readonly setSplitCrossover: (groupId: string, which: "low" | "high", hz: number) => void;
    readonly setSplitKeyTrackEnabled: (
        groupId: string,
        which: "low" | "high",
        enabled: boolean,
    ) => void;
    readonly setSplitKeyTrackOffset: (
        groupId: string,
        which: "low" | "high",
        offsetSemitones: number,
    ) => void;
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

    const commit = useCallback((nextState: LaneStateV2) => {
        acceptLaneState(store, nextState);
        commitLaneStateV2(patchConnection, nextState);
        patchConnection.sendStoredStateValue?.(LANE_STATE_KEY, serializeLaneStateV2(nextState));
    }, [patchConnection, store]);

    const setParamValue = useCallback((deviceId: string, endpointID: string, value: number) => {
        const parsedId = parseLaneInstanceId(deviceId);
        const paramIndex = parsedId === null
            ? null
            : getLaneSlotParamIndex(parsedId.deviceType, endpointID);
        if (parsedId === null || paramIndex === null) {
            throw new Error(`Unknown lane parameter: ${deviceId}.${endpointID}`);
        }
        const previousParams = store.state.devices[deviceId]?.params;
        const nextState = setLaneDeviceParam(store.state, deviceId, endpointID, value) ?? store.state;
        const nextParams = nextState.devices[deviceId]?.params;
        acceptLaneState(store, nextState);
        const sendField = (nextEndpointID: string, nextValue: number) => {
            const nextParamIndex = getLaneSlotParamIndex(parsedId.deviceType, nextEndpointID);
            if (nextParamIndex === null) return;
            store.deliverySerial += 1;
            patchConnection.sendEventOrValue?.(LANE_SLOT_PARAM_VALUE_ENDPOINT_ID, {
                slotId: getLaneSlotId(parsedId.deviceType, parsedId.instanceNumber - 1),
                paramIndex: nextParamIndex,
                deliverySerial: store.deliverySerial,
                value: nextValue,
            });
        };
        // A state transition may atomically change dependent fields. Publish
        // those first so the edited field can never expose a stale,
        // contradictory runtime mode (Delay Sync versus Key Track).
        if (previousParams !== undefined && nextParams !== undefined) {
            for (const dependentEndpointID of laneDeviceParamEndpoints(parsedId.deviceType)) {
                if (dependentEndpointID !== endpointID
                        && !Object.is(
                            previousParams[dependentEndpointID],
                            nextParams[dependentEndpointID],
                        )) {
                    sendField(dependentEndpointID, nextParams[dependentEndpointID]);
                }
            }
        }
        sendField(endpointID, nextParams?.[endpointID] ?? value);
    }, [patchConnection, store]);

    const setKeyTrackEnabled = useCallback((
        deviceId: string,
        ordinaryEndpointID: string,
        enabled: boolean,
    ) => {
        const parsedId = parseLaneInstanceId(deviceId);
        const endpoints = getLaneKeyTrackEndpoints(ordinaryEndpointID);
        const next = transitionLaneKeyTrackEnabled(
            store.state, deviceId, ordinaryEndpointID, enabled);
        if (parsedId === null || endpoints === null || next === null) {
            return;
        }
        acceptLaneState(store, next);
        const sendField = (endpointID: string, value: number) => {
            const paramIndex = getLaneSlotParamIndex(parsedId.deviceType, endpointID);
            if (paramIndex === null) return;
            store.deliverySerial += 1;
            patchConnection.sendEventOrValue?.(LANE_SLOT_PARAM_VALUE_ENDPOINT_ID, {
                slotId: getLaneSlotId(parsedId.deviceType, parsedId.instanceNumber - 1),
                paramIndex,
                deliverySerial: store.deliverySerial,
                value,
            });
        };
        if (!enabled) {
            sendField(endpoints.enabledEndpointID, 0);
        } else {
            // Publish every dependency before the primary enable bit. Each
            // lane-field event may reach DSP on a different frame, so Delay
            // must already be Free and every control already centred before
            // Key Track can become active.
            if (ordinaryEndpointID === "delayTime") {
                sendField("delayTimeMode", 0);
            }
            sendField(endpoints.offsetEndpointID, 0);
            sendField(endpoints.enabledEndpointID, 1);
        }
        patchConnection.sendStoredStateValue?.(LANE_STATE_KEY, serializeLaneStateV2(next));
    }, [patchConnection, store]);

    const setSplitCrossover = useCallback((groupId: string, which: "low" | "high", hz: number) => {
        const slotId = laneSplitMarkerSlotId(groupId);
        const next = setLaneSplitCrossoverHz(store.state, groupId, which, hz);
        if (slotId === null || next === null) {
            return;
        }
        acceptLaneState(store, next);
        store.deliverySerial += 1;
        patchConnection.sendEventOrValue?.(LANE_SLOT_PARAM_VALUE_ENDPOINT_ID, {
            slotId,
            paramIndex: which === "low" ? LANE_SPLIT_PARAM_XOVER_LOW_HZ : LANE_SPLIT_PARAM_XOVER_HIGH_HZ,
            deliverySerial: store.deliverySerial,
            value: hz,
        });
    }, [patchConnection, store]);

    const sendSplitField = useCallback((groupId: string, paramIndex: number, value: number) => {
        const slotId = laneSplitMarkerSlotId(groupId);
        if (slotId === null) return;
        store.deliverySerial += 1;
        patchConnection.sendEventOrValue?.(LANE_SLOT_PARAM_VALUE_ENDPOINT_ID, {
            slotId,
            paramIndex,
            deliverySerial: store.deliverySerial,
            value,
        });
    }, [patchConnection, store]);

    const setSplitKeyTrackEnabled = useCallback((
        groupId: string,
        which: "low" | "high",
        enabled: boolean,
    ) => {
        const next = transitionLaneSplitKeyTrackEnabled(store.state, groupId, which, enabled);
        if (next === null) return;
        acceptLaneState(store, next);
        const enabledParamIndex = which === "low"
            ? LANE_SPLIT_PARAM_XOVER_LOW_KEY_TRACK_ENABLED
            : LANE_SPLIT_PARAM_XOVER_HIGH_KEY_TRACK_ENABLED;
        const offsetParamIndex = which === "low"
            ? LANE_SPLIT_PARAM_XOVER_LOW_KEY_TRACK_OFFSET_SEMITONES
            : LANE_SPLIT_PARAM_XOVER_HIGH_KEY_TRACK_OFFSET_SEMITONES;
        if (!enabled) {
            sendSplitField(groupId, enabledParamIndex, 0);
        } else {
            // Each marker-field event may reach DSP on a different frame.
            // Centre the dependency before publishing the primary enable bit.
            sendSplitField(groupId, offsetParamIndex, 0);
            sendSplitField(groupId, enabledParamIndex, 1);
        }
        patchConnection.sendStoredStateValue?.(LANE_STATE_KEY, serializeLaneStateV2(next));
    }, [patchConnection, sendSplitField, store]);

    const setSplitKeyTrackOffset = useCallback((
        groupId: string,
        which: "low" | "high",
        offsetSemitones: number,
    ) => {
        const next = transitionLaneSplitKeyTrackOffset(
            store.state, groupId, which, offsetSemitones);
        if (next === null) return;
        acceptLaneState(store, next);
        const group = next.chain.find((node) => node.kind === "split" && node.groupId === groupId);
        if (group === undefined || group.kind !== "split") return;
        const value = which === "low"
            ? group.xoverLowKeyTrackOffsetSemitones
            : group.xoverHighKeyTrackOffsetSemitones;
        sendSplitField(groupId, which === "low"
            ? LANE_SPLIT_PARAM_XOVER_LOW_KEY_TRACK_OFFSET_SEMITONES
            : LANE_SPLIT_PARAM_XOVER_HIGH_KEY_TRACK_OFFSET_SEMITONES, value);
    }, [sendSplitField, store]);

    const setOutputMix = useCallback((mix: number) => {
        const next = setLaneOutputMix(store.state, mix);
        if (next === null) {
            return;
        }
        acceptLaneState(store, next);
        patchConnection.sendEventOrValue?.(LANE_OUTPUT_CONTROL_ENDPOINT_ID, next.output);
    }, [patchConnection, store]);

    const setOutputBypassed = useCallback((bypassed: boolean) => {
        const next = setLaneOutputBypassed(store.state, bypassed);
        if (next === null) {
            return;
        }
        acceptLaneState(store, next);
        patchConnection.sendEventOrValue?.(LANE_OUTPUT_CONTROL_ENDPOINT_ID, next.output);
    }, [patchConnection, store]);

    const persist = useCallback(() => {
        patchConnection.sendStoredStateValue?.(LANE_STATE_KEY, serializeLaneStateV2(store.state));
    }, [patchConnection, store]);

    return useMemo(() => ({
        laneState,
        commit,
        setParamValue,
        setKeyTrackEnabled,
        setOutputMix,
        setOutputBypassed,
        setSplitCrossover,
        setSplitKeyTrackEnabled,
        setSplitKeyTrackOffset,
        persist,
    }), [
        laneState,
        commit,
        setParamValue,
        setKeyTrackEnabled,
        setOutputMix,
        setOutputBypassed,
        setSplitCrossover,
        setSplitKeyTrackEnabled,
        setSplitKeyTrackOffset,
        persist,
    ]);
}

/**
 * The patch's modulation target picker domain: the static voice core plus one
 * entry per live lane device parameter (instance-labeled). Identity-keyed on
 * the DEVICE LIST, not the document — parameter-value traffic through the
 * lane store must not re-render every mounted picker.
 */
export function usePatchModulationTargetOptions({
    includeOscillatorTargets = true,
}: {
    includeOscillatorTargets?: boolean;
} = {}): ReadonlyArray<ModulationTargetOption> {
    const { laneState } = useLaneStateDoc();
    const devices = [
        ...listLaneDeviceInstancesV2(laneState),
        ...laneState.chain.flatMap((node) => node.kind === "split" ? [{
            instanceId: node.groupId.replace(/^split#/, "frequencySplit#"),
            deviceType: "frequencySplit" as const,
        }] : []),
    ];
    const deviceSignature = devices.map((device) => device.instanceId).join("\n");
    // An unchanged signature is an unchanged device list, so the captured
    // `devices` from the first matching render stays correct.
    return useMemo(
        () => buildPatchModulationTargetOptions(devices).filter((option) => (
            includeOscillatorTargets || !isOscillatorModulationTargetKind(option.value)
        )),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [deviceSignature, includeOscillatorTargets],
    );
}

/**
 * The lane replacement for a host parameter binding: the same
 * PatchControlBinding surface every knob and slider already speaks, backed
 * by the lane document and the field-upload hot path.
 */
export function useLaneParameterBinding(
    descriptor: RackParameterDescriptor,
    deviceId?: string,
): PatchControlBinding<number> {
    const patchConnection = usePatchConnection();
    const { laneState, setParamValue, persist } = useLaneStateDoc();
    const boundDeviceId = deviceId ?? `${EFFECT_ID_TO_LANE_TYPE[descriptor.effectId]}#1`;

    const clampValue = useCallback((value: number) => {
        const numeric = Number.isFinite(value) ? value : descriptor.initial;
        const clamped = Math.min(descriptor.max, Math.max(descriptor.min, numeric));
        return descriptor.choices !== undefined ? Math.round(clamped) : clamped;
    }, [descriptor.choices, descriptor.initial, descriptor.max, descriptor.min]);

    const value = clampValue(
        laneState.devices[boundDeviceId]?.params[descriptor.endpointID] ?? descriptor.initial);
    const valueRef = { current: value };
    valueRef.current = value;

    // Every write through this binding is a direct user edit (T12 seam A),
    // and gestures ride the connection's gesture channel under the logical
    // parameter id so drag lifecycle stays observable end to end.
    const setValue = useCallback((nextValue: number) => {
        const coerced = clampValue(nextValue);
        const changed = !Object.is(coerced, valueRef.current);
        setParamValue(boundDeviceId, descriptor.endpointID, coerced);
        reportUserParameterEdit({ endpointID: descriptor.endpointID, changed });
    }, [boundDeviceId, clampValue, descriptor.endpointID, setParamValue]);

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
        isReady: true,
        initialValue: descriptor.initial,
        setValue,
        commitValue,
        beginGesture,
        endGesture,
    }), [descriptor.endpointID, descriptor.initial, value, setValue, commitValue, beginGesture, endGesture]);
}

/** Live base binding for one Frequency Split marker field. This is a real
    lane-document address, not a synthesized rack descriptor or host endpoint. */
export function useLaneSplitCrossoverBinding(
    groupId: string,
    which: "low" | "high",
): PatchControlBinding<number> {
    const patchConnection = usePatchConnection();
    const { laneState, setSplitCrossover, persist } = useLaneStateDoc();
    const endpointID = which === "low" ? "xoverLowHz" : "xoverHighHz";
    const initialValue = which === "low"
        ? LANE_SPLIT_DEFAULT_XOVER_LOW_HZ
        : LANE_SPLIT_DEFAULT_XOVER_HIGH_HZ;
    const group = laneState.chain.find((node): node is LaneSplitGroupV2 => (
        node.kind === "split" && node.groupId === groupId
    ));
    const rawValue = group === undefined
        ? initialValue
        : which === "low" ? group.xoverLowHz : group.xoverHighHz;
    const value = Math.min(LANE_SPLIT_XOVER_MAX_HZ, Math.max(LANE_SPLIT_XOVER_MIN_HZ, rawValue));

    const setValue = useCallback((nextValue: number) => {
        const numeric = Number.isFinite(nextValue) ? nextValue : initialValue;
        const clamped = Math.min(
            LANE_SPLIT_XOVER_MAX_HZ,
            Math.max(LANE_SPLIT_XOVER_MIN_HZ, numeric),
        );
        setSplitCrossover(groupId, which, clamped);
        reportUserParameterEdit({ endpointID, changed: !Object.is(clamped, value) });
    }, [endpointID, groupId, initialValue, setSplitCrossover, value, which]);
    const beginGesture = useCallback(() => {
        patchConnection.sendParameterGestureStart?.(endpointID);
        reportUserGestureStart();
    }, [endpointID, patchConnection]);
    const endGesture = useCallback(() => {
        patchConnection.sendParameterGestureEnd?.(endpointID);
        reportUserGestureEnd();
        persist();
    }, [endpointID, patchConnection, persist]);
    const commitValue = useCallback((nextValue: number) => {
        beginGesture();
        setValue(nextValue);
        endGesture();
    }, [beginGesture, endGesture, setValue]);

    return useMemo(() => ({
        endpointID,
        value,
        isReady: group !== undefined,
        initialValue,
        setValue,
        commitValue,
        beginGesture,
        endGesture,
    }), [beginGesture, commitValue, endpointID, endGesture, group, initialValue, setValue, value]);
}

export type LaneKeyTrackControlBinding = {
    readonly eligible: boolean;
    readonly enabled: boolean;
    readonly binding: PatchControlBinding<number>;
    readonly ordinaryBinding: PatchControlBinding<number>;
    readonly setEnabled: (enabled: boolean) => void;
};

/**
 * One Effects Lane Key Track control. The public binding keeps the ordinary
 * endpoint identity so modulation routes remain attached while its value and
 * writes switch between ordinary units and the hidden semitone offset.
 */
export function useLaneKeyTrackControlBinding(
    descriptor: RackParameterDescriptor,
    deviceId?: string,
): LaneKeyTrackControlBinding {
    const patchConnection = usePatchConnection();
    const ordinaryBinding = useLaneParameterBinding(descriptor, deviceId);
    const { laneState, setParamValue, setKeyTrackEnabled, persist } = useLaneStateDoc();
    const boundDeviceId = deviceId ?? `${EFFECT_ID_TO_LANE_TYPE[descriptor.effectId]}#1`;
    const definition = getKeyTrackDefinition(`lane.${descriptor.endpointID}`);
    const endpoints = getLaneKeyTrackEndpoints(descriptor.endpointID);
    const eligible = definition !== null && endpoints !== null;
    const resolvedEndpoints = endpoints ?? {
        enabledEndpointID: descriptor.endpointID,
        offsetEndpointID: descriptor.endpointID,
    };
    const range = requireKeyTrackRange(definition?.family ?? "filter-frequency");
    const params = laneState.devices[boundDeviceId]?.params;
    const enabled = eligible
        && Number(params?.[resolvedEndpoints.enabledEndpointID] ?? 0) >= 0.5;
    const offsetValue = Math.min(
        range.knobMax,
        Math.max(range.knobMin, Number(params?.[resolvedEndpoints.offsetEndpointID]) || 0),
    );

    const setValue = useCallback((nextValue: number) => {
        const numeric = Number.isFinite(nextValue) ? nextValue : 0;
        const clamped = Math.min(range.knobMax, Math.max(range.knobMin, numeric));
        if (!eligible) return;
        setParamValue(boundDeviceId, resolvedEndpoints.offsetEndpointID, clamped);
        reportUserParameterEdit({
            endpointID: descriptor.endpointID,
            changed: !Object.is(clamped, offsetValue),
        });
    }, [
        boundDeviceId,
        descriptor.endpointID,
        eligible,
        resolvedEndpoints.offsetEndpointID,
        offsetValue,
        range.knobMax,
        range.knobMin,
        setParamValue,
    ]);
    const beginGesture = useCallback(() => {
        patchConnection.sendParameterGestureStart?.(descriptor.endpointID);
        reportUserGestureStart();
    }, [descriptor.endpointID, patchConnection]);
    const endGesture = useCallback(() => {
        patchConnection.sendParameterGestureEnd?.(descriptor.endpointID);
        reportUserGestureEnd();
        persist();
    }, [descriptor.endpointID, patchConnection, persist]);
    const commitValue = useCallback((value: number) => {
        beginGesture();
        setValue(value);
        endGesture();
    }, [beginGesture, endGesture, setValue]);
    const setEnabled = useCallback((nextEnabled: boolean) => {
        if (!eligible) return;
        patchConnection.sendParameterGestureStart?.(descriptor.endpointID);
        reportUserGestureStart();
        setKeyTrackEnabled(boundDeviceId, descriptor.endpointID, nextEnabled);
        reportUserParameterEdit({ endpointID: descriptor.endpointID, changed: enabled !== nextEnabled });
        patchConnection.sendParameterGestureEnd?.(descriptor.endpointID);
        reportUserGestureEnd();
    }, [
        boundDeviceId,
        descriptor.endpointID,
        eligible,
        enabled,
        patchConnection,
        setKeyTrackEnabled,
    ]);

    const binding = useMemo<PatchControlBinding<number>>(() => enabled ? ({
        endpointID: descriptor.endpointID,
        value: offsetValue,
        isReady: true,
        initialValue: 0,
        setValue,
        commitValue,
        beginGesture,
        endGesture,
    }) : ordinaryBinding, [
        beginGesture,
        commitValue,
        descriptor.endpointID,
        enabled,
        endGesture,
        offsetValue,
        ordinaryBinding,
        setValue,
    ]);

    return useMemo(() => ({ eligible, enabled, binding, ordinaryBinding, setEnabled }), [
        binding,
        eligible,
        enabled,
        ordinaryBinding,
        setEnabled,
    ]);
}

/** Key Track presentation of one Frequency Split marker field. It shares the
    same PatchControlBinding interface as device-backed controls while keeping
    marker state and writes inside the lane-document module. */
export function useLaneSplitKeyTrackControlBinding(
    groupId: string,
    which: "low" | "high",
): LaneKeyTrackControlBinding {
    const patchConnection = usePatchConnection();
    const ordinaryBinding = useLaneSplitCrossoverBinding(groupId, which);
    const {
        laneState,
        setSplitKeyTrackEnabled,
        setSplitKeyTrackOffset,
        persist,
    } = useLaneStateDoc();
    const endpointID = which === "low" ? "xoverLowHz" : "xoverHighHz";
    const definition = getKeyTrackDefinition(
        which === "low" ? "lane.frequencySplitLowHz" : "lane.frequencySplitHighHz",
    );
    const range = requireKeyTrackRange(definition?.family ?? "crossover-frequency");
    const group = laneState.chain.find((node): node is LaneSplitGroupV2 => (
        node.kind === "split" && node.groupId === groupId
    ));
    const eligible = definition !== null;
    const enabled = eligible && (which === "low"
        ? group?.xoverLowKeyTrackEnabled === true
        : group?.xoverHighKeyTrackEnabled === true);
    const rawOffset = which === "low"
        ? group?.xoverLowKeyTrackOffsetSemitones
        : group?.xoverHighKeyTrackOffsetSemitones;
    const offsetValue = Math.min(
        range.knobMax,
        Math.max(range.knobMin, Number(rawOffset) || 0),
    );

    const setValue = useCallback((nextValue: number) => {
        const numeric = Number.isFinite(nextValue) ? nextValue : 0;
        const clamped = Math.min(range.knobMax, Math.max(range.knobMin, numeric));
        if (!eligible) return;
        setSplitKeyTrackOffset(groupId, which, clamped);
        reportUserParameterEdit({
            endpointID,
            changed: !Object.is(clamped, offsetValue),
        });
    }, [eligible, endpointID, groupId, offsetValue, range.knobMax, range.knobMin, setSplitKeyTrackOffset, which]);
    const beginGesture = useCallback(() => {
        patchConnection.sendParameterGestureStart?.(endpointID);
        reportUserGestureStart();
    }, [endpointID, patchConnection]);
    const endGesture = useCallback(() => {
        patchConnection.sendParameterGestureEnd?.(endpointID);
        reportUserGestureEnd();
        persist();
    }, [endpointID, patchConnection, persist]);
    const commitValue = useCallback((value: number) => {
        beginGesture();
        setValue(value);
        endGesture();
    }, [beginGesture, endGesture, setValue]);
    const setEnabled = useCallback((nextEnabled: boolean) => {
        if (!eligible) return;
        patchConnection.sendParameterGestureStart?.(endpointID);
        reportUserGestureStart();
        setSplitKeyTrackEnabled(groupId, which, nextEnabled);
        reportUserParameterEdit({ endpointID, changed: enabled !== nextEnabled });
        patchConnection.sendParameterGestureEnd?.(endpointID);
        reportUserGestureEnd();
    }, [eligible, enabled, endpointID, groupId, patchConnection, setSplitKeyTrackEnabled, which]);

    const binding = useMemo<PatchControlBinding<number>>(() => enabled ? ({
        endpointID,
        value: offsetValue,
        isReady: group !== undefined,
        initialValue: 0,
        setValue,
        commitValue,
        beginGesture,
        endGesture,
    }) : ordinaryBinding, [
        beginGesture,
        commitValue,
        enabled,
        endpointID,
        endGesture,
        group,
        offsetValue,
        ordinaryBinding,
        setValue,
    ]);

    return useMemo(() => ({ eligible, enabled, binding, ordinaryBinding, setEnabled }), [
        binding,
        eligible,
        enabled,
        ordinaryBinding,
        setEnabled,
    ]);
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
    deviceId,
    laneSplit,
}: {
    endpointID: string;
    initialValue: number;
    coerce: (rawValue: unknown) => number;
    active?: boolean;
    /** The lane instance to edit (e.g. "delay#2"); the type's #1 without it. */
    deviceId?: string;
    /** A Frequency Split marker field, which has no rack descriptor or host endpoint. */
    laneSplit?: { readonly groupId: string; readonly which: "low" | "high" };
}): PatchControlBinding<number> {
    const laneDescriptor = getRackParameterDescriptor(endpointID);
    if (FALLBACK_LANE_DESCRIPTOR === null) {
        throw new Error("The lane parameter catalog is missing its fallback descriptor");
    }
    const laneBinding = useLaneParameterBinding(
        laneDescriptor ?? FALLBACK_LANE_DESCRIPTOR,
        laneDescriptor === null ? undefined : deviceId,
    );
    const splitBinding = useLaneSplitCrossoverBinding(
        laneSplit?.groupId ?? "split#1",
        laneSplit?.which ?? "low",
    );
    const hostBinding = usePatchParameterBinding<number>({
        endpointID,
        initialValue,
        coerce,
        active: active && laneDescriptor === null && laneSplit === undefined,
    });
    return laneSplit !== undefined
        ? splitBinding
        : laneDescriptor === null ? hostBinding : laneBinding;
}
