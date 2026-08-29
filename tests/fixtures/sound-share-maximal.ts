import {
    ARTICULATION_MAX_SLOTS,
    ARTICULATION_VOICE_PARAMETER_IDS,
    parseArticulationsV4,
    serializeArticulationsV4,
    type ArticulationVoiceParameterId,
} from "../../ui/shared/articulation-image";
import {
    LANE_DEVICE_TYPE_ORDER,
    addLaneDevice,
    createDefaultLaneStateV2,
    parseLaneInstanceId,
    parseLaneStateV2,
    serializeLaneStateV2,
    type LaneStateV2,
} from "../../ui/shared/lane-state-v2";
import { LANE_TYPE_TO_EFFECT_ID } from "../../ui/shared/lane-state";
import { getModulationArticulationCellIndex } from "../../ui/shared/modulation-runtime-program";
import {
    createDefaultModulationState,
    parseModulationState,
    serializeModulationState,
    type ModulationRoute,
    type ModulationState,
} from "../../ui/shared/modulation";
import {
    MODULATION_SOURCE_IDENTITIES,
    MODULATION_TARGET_IDENTITIES,
} from "../../ui/shared/modulation-targets";
import { getRackEffectDescriptor } from "../../ui/shared/rack-parameter-descriptors";

type ParameterInput = {
    readonly endpointID?: unknown;
    readonly purpose?: unknown;
    readonly annotation?: unknown;
};

export type MaximalSoundFixture = {
    readonly label: string;
    readonly parameters: Readonly<Record<string, number>>;
    readonly modulation: ModulationState;
    readonly articulations: ReturnType<typeof parseRequiredArticulations>;
    readonly lane: LaneStateV2;
    readonly storedState: Readonly<Record<string, unknown>>;
    readonly facts: {
        readonly parameterCount: number;
        readonly modulationRouteCount: number;
        readonly articulableRouteCount: number;
        readonly articulationSlotCount: number;
        readonly articulationOverrideCountPerSlot: number;
        readonly laneDeviceCount: number;
        readonly msegPointCount: number;
    };
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parameterValue(endpointID: string, annotation: Record<string, unknown>, parameterIndex: number) {
    const initial = Number(annotation.init);
    const minimum = Number(annotation.min);
    const maximum = Number(annotation.max);
    if (![initial, minimum, maximum].every(Number.isFinite)) {
        throw new Error(`Maximal sound parameter ${endpointID} has no finite min/init/max contract.`);
    }

    if (endpointID === "sourceMode") return 0;
    if (/(?:Mute|Solo)$/u.test(endpointID)) return 0;
    if (endpointID === "playMode") return 0;

    const wavetableSelections: Readonly<Record<string, number>> = {
        oscAWavetableSelect: 238,
        oscBWavetableSelect: 127,
        oscCWavetableSelect: 35,
    };
    if (Object.hasOwn(wavetableSelections, endpointID)) return wavetableSelections[endpointID];

    const audibleValues: Readonly<Record<string, number>> = {
        ampAttack: 0.02,
        ampDecay: 0.18,
        ampSustain: 0.82,
        ampRelease: 0.35,
        ampGainDb: -3,
        filterMode: 1,
        filterCutoff: 4_200,
        filterQ: 0.83,
        filterMix: 0.74,
        globalTune: 7,
        oscAVolumeDb: -12,
        oscBVolumeDb: -15,
        oscCVolumeDb: -18,
    };
    if (Object.hasOwn(audibleValues, endpointID)) return audibleValues[endpointID];

    const step = Number(annotation.step);
    const discrete = annotation.discrete === true || (Number.isFinite(step) && step >= 1);
    const fraction = ((parameterIndex % 7) + 1) / 8;
    const candidate = minimum + ((maximum - minimum) * fraction);
    if (!discrete) return candidate;
    const snapped = Number.isFinite(step) && step > 0
        ? minimum + (Math.round((candidate - minimum) / step) * step)
        : Math.round(candidate);
    return Math.min(maximum, Math.max(minimum, snapped));
}

function createMaximalParameters(inputs: ReadonlyArray<ParameterInput>) {
    const parameters: Record<string, number> = {};
    inputs.forEach((input, parameterIndex) => {
        if (input.purpose !== "parameter" || typeof input.endpointID !== "string") return;
        if (!isRecord(input.annotation) || input.annotation.hidden === true) return;
        parameters[input.endpointID] = parameterValue(input.endpointID, input.annotation, parameterIndex);
    });
    if (Object.keys(parameters).length === 0) {
        throw new Error("Maximal sound fixture received no public parameter contract.");
    }
    return parameters;
}

function createShape(slotIndex: number, shapeIndex: 0 | 1) {
    return {
        format: "cosimo.mseg.shape" as const,
        version: 1 as const,
        name: `T46 MSEG ${slotIndex + 1}${shapeIndex === 0 ? "A" : "B"}`,
        globalSmooth: shapeIndex === 1,
        points: Array.from({ length: 16 }, (_, pointIndex) => ({
            x: pointIndex / 15,
            y: ((pointIndex * 7) + (slotIndex * 3) + (shapeIndex * 5)) % 16 / 15,
            curvePower: ((pointIndex + slotIndex + shapeIndex) % 9) - 4,
        })),
    };
}

function createMaximalModulation(): ModulationState {
    const defaults = createDefaultModulationState();
    const routes: ModulationRoute[] = MODULATION_SOURCE_IDENTITIES.flatMap((source, sourceIndex) => (
        MODULATION_TARGET_IDENTITIES.map((target, targetIndex): ModulationRoute => ({
            id: `t46-${source.id}-${targetIndex}`,
            enabled: true,
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            polarity: (sourceIndex + targetIndex) % 2 === 0 ? "unipolar" : "bipolar",
            targetKind: target.kind,
            amount: (targetIndex % 3 === 0 ? -1 : 1) * 0.25,
            reducer: (sourceIndex + targetIndex) % 2 === 0 ? "max" : "mean",
        }))
    ));
    const candidate: ModulationState = {
        ...defaults,
        msegSlots: defaults.msegSlots.map((slot, slotIndex) => ({
            ...slot,
            shapeA: createShape(slotIndex, 0),
            shapeB: createShape(slotIndex, 1),
            playback: {
                format: "cosimo.mseg.playback",
                version: 1,
                loop: { startX: 0.125, endX: 0.875 },
                noteOffPolicy: (["finish_loop", "immediate", "ignore"] as const)[slotIndex],
                legatoRestarts: slotIndex % 2 === 0,
                holdFinalValue: slotIndex % 2 === 1,
            },
        })),
        envelopeSlots: defaults.envelopeSlots.map((_, slotIndex) => ({
            name: `T46 Envelope ${slotIndex + 1}`,
        })),
        macroNames: defaults.macroNames.map((_, slotIndex) => `T46 Macro ${slotIndex + 1}`),
        routes,
    };
    const parsed = parseModulationState(candidate);
    if (parsed._tag === "err") throw parsed.error;
    return parsed.value;
}

function articulationOverrideValue(parameterID: ArticulationVoiceParameterId) {
    if (parameterID.endsWith(".framePosition")) return 0.61;
    if (parameterID.endsWith(".pan")) return 0.17;
    if (parameterID.endsWith(".octave") || parameterID.endsWith(".semitone")) return 0;
    if (parameterID.endsWith(".fineCents")) return 3;
    if (parameterID.endsWith(".phase")) return 0.13;
    if (parameterID.endsWith(".phaseRandom")) return 0.21;
    if (parameterID.endsWith(".retrigger")) return 1;
    if (parameterID.endsWith(".volumeDb")) return -12;
    if (parameterID.endsWith(".mute") || parameterID.endsWith(".solo")) return 0;
    if (parameterID.endsWith(".warpMode")) return 1;
    if (parameterID.endsWith(".warpAmount")) return 0.27;
    if (parameterID.endsWith(".unisonVoices")) return 2;
    if (parameterID.endsWith(".unisonDetune")) return 0.08;
    if (parameterID.endsWith(".unisonBlend")) return 0.52;
    if (parameterID.endsWith(".unisonWidth")) return 0.71;
    if (parameterID.endsWith(".unisonDetuneMode") || parameterID.endsWith(".unisonStackMode")) return 0;
    if (parameterID.endsWith(".unisonWavetablePositionSpread") || parameterID.endsWith(".unisonWarpSpread")) return 0.11;
    if (parameterID === "filterMode") return 1;
    if (parameterID === "filterCutoffHz") return 5_000;
    if (parameterID === "filterQ") return 0.83;
    if (parameterID.startsWith("msegMorph")) return 0.43;
    if (parameterID.endsWith("attackSeconds")) return 0.02;
    if (parameterID.endsWith("decaySeconds")) return 0.17;
    if (parameterID.endsWith("sustain")) return 0.79;
    if (parameterID.endsWith("releaseSeconds")) return 0.31;
    if (parameterID === "filterKeyTrackOffsetSemitones") return 7;
    throw new Error(`Maximal sound fixture has no articulation value for ${parameterID}.`);
}

function parseRequiredArticulations(
    modulation: ModulationState,
) {
    const articulableRouteIDs = modulation.routes.flatMap((route) => (
        getModulationArticulationCellIndex(route) === null ? [] : [route.id]
    ));
    const routeAmounts = Object.fromEntries(articulableRouteIDs.map((routeID, routeIndex) => [
        routeID,
        routeIndex % 2 === 0 ? 0.25 : -0.25,
    ]));
    const overrides = Object.fromEntries(ARTICULATION_VOICE_PARAMETER_IDS.map((parameterID) => [
        parameterID,
        articulationOverrideValue(parameterID),
    ]));
    const candidate = {
        format: "cosimo.articulations" as const,
        version: 4 as const,
        selectedSlotId: `t46-articulation-${ARTICULATION_MAX_SLOTS - 1}`,
        activeTriggerMode: "key" as const,
        slots: Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, slotIndex) => ({
            id: `t46-articulation-${slotIndex}`,
            runtimeSlot: slotIndex,
            name: `T46 Articulation ${slotIndex + 1}`,
            color: `#${((slotIndex * 2_654_435_761) & 0xff_ffff).toString(16).padStart(6, "0")}`,
            key: slotIndex,
            velRange: { min: slotIndex, max: slotIndex },
            chainRange: { min: slotIndex, max: slotIndex },
            overrides,
            routeAmounts,
        })),
    };
    const parsed = parseArticulationsV4(candidate, new Set(articulableRouteIDs));
    if (parsed._tag === "err") throw parsed.error;
    return parsed.value;
}

function laneParameterValue(
    descriptor: ReturnType<typeof getRackEffectDescriptor>["parameters"][number],
    parameterIndex: number,
) {
    const alternateChoice = descriptor.choices?.find((choice) => choice.value !== descriptor.initial);
    if (alternateChoice !== undefined) return alternateChoice.value;
    const fraction = ((parameterIndex % 5) + 2) / 7;
    return descriptor.min + ((descriptor.max - descriptor.min) * fraction);
}

function createMaximalLane(): LaneStateV2 {
    let lane = createDefaultLaneStateV2();
    for (const deviceType of LANE_DEVICE_TYPE_ORDER) {
        if (Object.keys(lane.devices).some((deviceID) => deviceID.startsWith(`${deviceType}#`))) continue;
        const added = addLaneDevice(lane, deviceType, { kind: "trunk", index: lane.chain.length });
        if (added === null) throw new Error(`Could not add maximal Effects Lane device ${deviceType}.`);
        lane = added;
    }

    const devices = Object.fromEntries(Object.entries(lane.devices).map(([deviceID]) => {
        const parsedID = parseLaneInstanceId(deviceID);
        if (parsedID === null) throw new Error(`Maximal Effects Lane device id ${deviceID} is invalid.`);
        const effectID = LANE_TYPE_TO_EFFECT_ID.get(parsedID.deviceType);
        if (effectID === undefined) throw new Error(`Maximal Effects Lane type ${parsedID.deviceType} has no effect.`);
        const descriptors = getRackEffectDescriptor(effectID).parameters;
        return [deviceID, {
            params: Object.fromEntries(descriptors.map((descriptor, parameterIndex) => [
                descriptor.endpointID,
                laneParameterValue(descriptor, parameterIndex),
            ])),
        }];
    }));
    const candidate: LaneStateV2 = {
        format: "cosimo.lane",
        version: 2,
        output: { mix: 0.73, bypassed: false },
        devices,
        chain: [
            { kind: "device", deviceId: "globalFilter#1", enabled: false },
            { kind: "device", deviceId: "distortion#1", enabled: true },
            {
                kind: "parallel",
                groupId: "parallel#1",
                enabled: true,
                branches: [
                    [{ kind: "device", deviceId: "ott#1", enabled: true }],
                    [{ kind: "device", deviceId: "chorus#1", enabled: false }],
                ],
            },
            {
                kind: "split",
                groupId: "split#1",
                enabled: true,
                xoverLowHz: 640,
                xoverHighHz: 4_800,
                xoverLowKeyTrackEnabled: true,
                xoverLowKeyTrackOffsetSemitones: -12,
                xoverHighKeyTrackEnabled: true,
                xoverHighKeyTrackOffsetSemitones: 7,
                branches: [
                    [{ kind: "device", deviceId: "flanger#1", enabled: true }],
                    [{ kind: "device", deviceId: "phaser#1", enabled: false }],
                    [{ kind: "device", deviceId: "delay#1", enabled: true }],
                ],
            },
            { kind: "device", deviceId: "reverb#1", enabled: true },
        ],
    };
    const parsed = parseLaneStateV2(candidate);
    if (parsed._tag === "err") throw new Error(parsed.message);
    return parsed.value;
}

/**
 * Deliberately fill every current saved-sound domain at its strict boundary:
 * all public parameters, both shapes/playback for all MSEGs, every legal MOD
 * pair, all 128 articulation slots with every override and articulable route,
 * and every Effects Lane device in serial, parallel, and split topology.
 */
export function createMaximalSoundFixture(inputs: ReadonlyArray<ParameterInput>): MaximalSoundFixture {
    const parameters = createMaximalParameters(inputs);
    const modulation = createMaximalModulation();
    const articulations = parseRequiredArticulations(modulation);
    const lane = createMaximalLane();
    const articulableRouteCount = Object.keys(articulations.slots[0]?.routeAmounts ?? {}).length;
    return {
        label: "T46 Maximum Current Sound",
        parameters,
        modulation,
        articulations,
        lane,
        storedState: {
            "modulation.v6": serializeModulationState(modulation),
            "articulations.v4": JSON.stringify(serializeArticulationsV4(articulations)),
            "bounce.v1": null,
            "lane.v1": serializeLaneStateV2(lane),
        },
        facts: {
            parameterCount: Object.keys(parameters).length,
            modulationRouteCount: modulation.routes.length,
            articulableRouteCount,
            articulationSlotCount: articulations.slots.length,
            articulationOverrideCountPerSlot: Object.keys(articulations.slots[0]?.overrides ?? {}).length,
            laneDeviceCount: Object.keys(lane.devices).length,
            msegPointCount: modulation.msegSlots.reduce((sum, slot) => (
                sum + slot.shapeA.points.length + slot.shapeB.points.length
            ), 0),
        },
    };
}
