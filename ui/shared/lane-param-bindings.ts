import { createSynthDocumentClient } from "./synth-document-client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { usePatchConnection, type PatchConnectionLike } from "./cmajor-react";
import {
    reportUserGestureEnd,
    reportUserGestureStart,
    reportUserParameterEdit,
} from "./user-edit-bus";
import {
    EFFECT_ID_TO_LANE_TYPE,
    LANE_STATE_KEY,
} from "./lane-state";
import {
    createDefaultLaneStateV2,
    LANE_SPLIT_DEFAULT_XOVER_HIGH_HZ,
    LANE_SPLIT_DEFAULT_XOVER_LOW_HZ,
    LANE_SPLIT_XOVER_MAX_HZ,
    LANE_SPLIT_XOVER_MIN_HZ,
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
import {
    effectOutputTrimHostEndpointID,
    effectOutputTrimLaneEndpointID,
} from "./effect-output-trim";
import { EffectOutputTrimHostMirror } from "./effect-output-trim-host-mirror";

/** One projection per view connection; the framework owns accepted state and history. */
type LaneStateStore = {
    state: LaneStateV2;
    readonly connection: PatchConnectionLike;
    readonly listeners: Set<() => void>;
    serialized: string;
    readonly client: ReturnType<typeof createSynthDocumentClient<LaneStateV2>>;
    outputTrimHostMirror: EffectOutputTrimHostMirror | null;
    close(): void;
};
const stores = new WeakMap<object, LaneStateStore>();

function acceptLaneState(store: LaneStateStore, state: LaneStateV2) {
    const next = store.outputTrimHostMirror?.synchronizeLaneState(state) ?? state;
    const serialized = serializeLaneStateV2(next);
    if (serialized === store.serialized) return;
    reconcileLaneSoloAudition(store.connection, store.state, next);
    store.state = next; store.serialized = serialized;
    for (const listener of [...store.listeners]) listener();
}

function editLaneState(store: LaneStateStore, next: LaneStateV2 | null) {
    if (!next) return;
    void store.client.set(next).catch(error => console.error("Rack edit failed", error));
}

function getLaneStateStore(connection: PatchConnectionLike): LaneStateStore {
    const existing = stores.get(connection);
    if (existing) return existing;
    const initial = createDefaultLaneStateV2();
    const client = createSynthDocumentClient<LaneStateV2>(connection, LANE_STATE_KEY);
    const created: LaneStateStore = { state: initial, serialized: serializeLaneStateV2(initial), connection,
        listeners: new Set(), client, outputTrimHostMirror: null, close() {},
    };
    stores.set(connection, created);
    const read = () => { const value = client.read(); if (value) acceptLaneState(created, value); };
    const unsubscribe = client.subscribe(read);
    created.outputTrimHostMirror = new EffectOutputTrimHostMirror(connection, () => {
        // Automation is observed over the accepted source, never dispatched as
        // a user rack edit or a raw stored write that could reset history.
        read();
    });
    created.close = () => { unsubscribe(); client.stop(); created.outputTrimHostMirror?.dispose(); stores.delete(connection); };
    read();
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
export function useLaneStateDoc() {
    const patchConnection = usePatchConnection();
    const store = getLaneStateStore(patchConnection);
    const laneState = useSyncExternalStore(useCallback(listener => {
        store.listeners.add(listener);
        return () => {
            store.listeners.delete(listener);
            queueMicrotask(() => { if (store.listeners.size === 0 && stores.get(patchConnection) === store) store.close(); });
        };
    }, [patchConnection, store]), () => store.state);
    const commit = useCallback((next: LaneStateV2) => {
        const parameters: Record<string, number> = {};
        // A replacement may intentionally reset a resident instance's trim.
        // Publish that user edit through its parameter owner as well as the rack.
        for (const device of listLaneDeviceInstancesV2(next)) {
            const parsed = parseLaneInstanceId(device.instanceId);
            if (!parsed) continue;
            const endpoint = effectOutputTrimLaneEndpointID(parsed.deviceType);
            const value = next.devices[device.instanceId]?.params[endpoint];
            const previous = store.state.devices[device.instanceId]?.params[endpoint];
            if (typeof value === "number" && value !== previous) {
                parameters[effectOutputTrimHostEndpointID(parsed.deviceType, parsed.instanceNumber)] = value;
            }
        }
        void store.client.setWithParameters(next, parameters).catch(error => console.error("Rack edit failed", error));
    }, [store]);
    const setParamValue = useCallback((deviceId: string, endpoint: string, value: number) => {
        const parsed = parseLaneInstanceId(deviceId);
        if (!parsed || getLaneSlotParamIndex(parsed.deviceType, endpoint) === null) throw new Error(`Unknown lane parameter: ${deviceId}.${endpoint}`);
        const next = setLaneDeviceParam(store.state, deviceId, endpoint, value);
        if (endpoint === effectOutputTrimLaneEndpointID(parsed.deviceType)) {
            // The accompanying host binding owns this edit and its history.
            if (next) acceptLaneState(store, next);
            return;
        }
        store.client.begin();
        editLaneState(store, next);
    }, [store]);
    const setKeyTrackEnabled = useCallback((device: string, endpoint: string, enabled: boolean) =>
        editLaneState(store, transitionLaneKeyTrackEnabled(store.state, device, endpoint, enabled)), [store]);
    const setSplitCrossover = useCallback((group: string, which: "low" | "high", hz: number) => {
        store.client.begin(); editLaneState(store, setLaneSplitCrossoverHz(store.state, group, which, hz));
    }, [store]);
    const setSplitKeyTrackEnabled = useCallback((group: string, which: "low" | "high", enabled: boolean) =>
        editLaneState(store, transitionLaneSplitKeyTrackEnabled(store.state, group, which, enabled)), [store]);
    const setSplitKeyTrackOffset = useCallback((group: string, which: "low" | "high", offset: number) => {
        store.client.begin(); editLaneState(store, transitionLaneSplitKeyTrackOffset(store.state, group, which, offset));
    }, [store]);
    const setOutputMix = useCallback((mix: number) => { store.client.begin(); editLaneState(store, setLaneOutputMix(store.state, mix)); }, [store]);
    const setOutputBypassed = useCallback((bypassed: boolean) => editLaneState(store, setLaneOutputBypassed(store.state, bypassed)), [store]);
    const beginGesture = useCallback(() => store.client.begin(), [store]);
    const persist = useCallback(() => { void store.client.end(); }, [store]);
    return useMemo(() => ({ laneState, commit, setParamValue, setKeyTrackEnabled, setSplitCrossover,
        setSplitKeyTrackEnabled, setSplitKeyTrackOffset, setOutputMix, setOutputBypassed, beginGesture, persist }),
        [laneState, commit, setParamValue, setKeyTrackEnabled, setSplitCrossover, setSplitKeyTrackEnabled,
            setSplitKeyTrackOffset, setOutputMix, setOutputBypassed, beginGesture, persist]);
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
    const { laneState, setParamValue, persist, beginGesture: beginLaneGesture } = useLaneStateDoc();
    const boundDeviceId = deviceId ?? `${EFFECT_ID_TO_LANE_TYPE[descriptor.effectId]}#1`;
    const parsedDeviceId = parseLaneInstanceId(boundDeviceId);
    const isOutputTrim = parsedDeviceId !== null
        && descriptor.endpointID === effectOutputTrimLaneEndpointID(parsedDeviceId.deviceType);
    const hostEndpointID = parsedDeviceId === null || !isOutputTrim
        ? descriptor.endpointID
        : effectOutputTrimHostEndpointID(
            parsedDeviceId.deviceType,
            parsedDeviceId.instanceNumber,
        );

    const clampValue = useCallback((value: number) => {
        const numeric = Number.isFinite(value) ? value : descriptor.initial;
        const clamped = Math.min(descriptor.max, Math.max(descriptor.min, numeric));
        return descriptor.choices !== undefined ? Math.round(clamped) : clamped;
    }, [descriptor.choices, descriptor.initial, descriptor.max, descriptor.min]);
    const coerceValue = useCallback((rawValue: unknown) => {
        const numeric = Number(rawValue);
        return clampValue(Number.isFinite(numeric) ? numeric : descriptor.initial);
    }, [clampValue, descriptor.initial]);

    // Hooks stay unconditional: ordinary Effects Lane parameters keep their
    // record-only path, while T78 Output Trim activates the matching
    // type+instance host endpoint as the audio/automation authority.
    const hostBinding = usePatchParameterBinding<number>({
        endpointID: hostEndpointID,
        initialValue: descriptor.initial,
        coerce: coerceValue,
        active: isOutputTrim,
    });

    const laneValue = clampValue(
        laneState.devices[boundDeviceId]?.params[descriptor.endpointID] ?? descriptor.initial);
    const value = isOutputTrim && hostBinding.isReady ? hostBinding.value : laneValue;
    const valueRef = { current: value };
    valueRef.current = value;

    // Every write through this binding is a direct user edit (T12 seam A),
    // and gestures ride the connection's gesture channel under the logical
    // parameter id so drag lifecycle stays observable end to end.
    const setValue = useCallback((nextValue: number) => {
        const coerced = clampValue(nextValue);
        const changed = !Object.is(coerced, valueRef.current);
        if (isOutputTrim) {
            hostBinding.setValue(coerced);
        }
        setParamValue(boundDeviceId, descriptor.endpointID, coerced);
        reportUserParameterEdit({ endpointID: descriptor.endpointID, changed });
    }, [
        boundDeviceId,
        clampValue,
        descriptor.endpointID,
        hostBinding.setValue,
        isOutputTrim,
        setParamValue,
    ]);

    const beginGesture = useCallback(() => {
        if (isOutputTrim) {
            hostBinding.beginGesture();
        } else {
            beginLaneGesture();
        }
        reportUserGestureStart();
    }, [descriptor.endpointID, hostBinding.beginGesture, isOutputTrim, patchConnection, beginLaneGesture]);

    const endGesture = useCallback(() => {
        if (isOutputTrim) {
            hostBinding.endGesture();
        } else {
            // The rack field closes in persist() below.
        }
        reportUserGestureEnd();
        persist();
    }, [descriptor.endpointID, hostBinding.endGesture, isOutputTrim, patchConnection, persist]);

    const commitValue = useCallback((nextValue: number) => {
        beginGesture();
        setValue(nextValue);
        endGesture();
    }, [beginGesture, endGesture, setValue]);

    return useMemo(() => ({
        endpointID: descriptor.endpointID,
        value,
        isReady: isOutputTrim ? hostBinding.isReady : true,
        hostBaseline: isOutputTrim ? hostBinding.hostBaseline : undefined,
        initialValue: descriptor.initial,
        setValue,
        commitValue,
        beginGesture,
        endGesture,
    }), [
        descriptor.endpointID,
        descriptor.initial,
        value,
        isOutputTrim,
        hostBinding.hostBaseline,
        hostBinding.isReady,
        setValue,
        commitValue,
        beginGesture,
        endGesture,
    ]);
}

/** Live base binding for one Frequency Split marker field. This is a real
    lane-document address, not a synthesized rack descriptor or host endpoint. */
export function useLaneSplitCrossoverBinding(
    groupId: string,
    which: "low" | "high",
): PatchControlBinding<number> {
    const patchConnection = usePatchConnection();
    const { laneState, setSplitCrossover, persist, beginGesture: beginLaneGesture } = useLaneStateDoc();
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
        beginLaneGesture();
        reportUserGestureStart();
    }, [endpointID, patchConnection, beginLaneGesture]);
    const endGesture = useCallback(() => {
        // The rack field closes in persist() below.
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
    const { laneState, setParamValue, setKeyTrackEnabled, persist, beginGesture: beginLaneGesture } = useLaneStateDoc();
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
        beginLaneGesture();
        reportUserGestureStart();
    }, [descriptor.endpointID, patchConnection, beginLaneGesture]);
    const endGesture = useCallback(() => {
        // The rack field closes in persist() below.
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
        beginLaneGesture();
        reportUserGestureStart();
        setKeyTrackEnabled(boundDeviceId, descriptor.endpointID, nextEnabled);
        reportUserParameterEdit({ endpointID: descriptor.endpointID, changed: enabled !== nextEnabled });
        // The toggle is one complete field gesture.
        reportUserGestureEnd();
        persist();
    }, [
        boundDeviceId,
        descriptor.endpointID,
        eligible,
        enabled,
        beginLaneGesture,
        persist,
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
        persist, beginGesture: beginLaneGesture,
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
        beginLaneGesture();
        reportUserGestureStart();
    }, [endpointID, patchConnection, beginLaneGesture]);
    const endGesture = useCallback(() => {
        // The rack field closes in persist() below.
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
        beginLaneGesture();
        reportUserGestureStart();
        setSplitKeyTrackEnabled(groupId, which, nextEnabled);
        reportUserParameterEdit({ endpointID, changed: enabled !== nextEnabled });
        // The toggle is one complete field gesture.
        reportUserGestureEnd();
        persist();
    }, [beginLaneGesture, eligible, enabled, endpointID, groupId, persist, setSplitKeyTrackEnabled, which]);

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
