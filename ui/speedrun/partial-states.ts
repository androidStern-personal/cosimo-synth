import type { ArticulationsState } from "../shared/articulation-image";
import {
    deserializeLaneStateV2,
    serializeLaneStateV2,
    setLaneDeviceEnabled,
    setLaneDeviceParam,
    type LaneStateV2,
} from "../shared/lane-state-v2";
import {
    deserializeModulationState,
    serializeModulationState,
    type ModulationState,
} from "../shared/modulation";
import { OSCILLATOR_IDS, type OscillatorID } from "../shared/modulation-targets";
import type { DefaultsSnapshot } from "./patch-io";
import type { SpeedrunRecipe, SpeedrunSection, UIOp } from "./recipe";

export type CumulativePatchState = {
    readonly parameters: Readonly<Record<string, number>>;
    readonly modulation: ModulationState;
    readonly lane: LaneStateV2;
    readonly articulations: ArticulationsState;
};

export function cloneLane(lane: LaneStateV2): LaneStateV2 {
    const cloned = deserializeLaneStateV2(serializeLaneStateV2(lane));
    if (cloned === null) {
        throw new Error("A typed current lane failed its own serialization contract.");
    }
    return cloned;
}

export function cloneModulation(modulation: ModulationState): ModulationState {
    return deserializeModulationState(serializeModulationState(modulation));
}

export function cloneArticulations(articulations: ArticulationsState): ArticulationsState {
    return structuredClone(articulations);
}

function cloneState(state: CumulativePatchState): CumulativePatchState {
    return {
        parameters: { ...state.parameters },
        modulation: cloneModulation(state.modulation),
        lane: cloneLane(state.lane),
        articulations: cloneArticulations(state.articulations),
    };
}

function writeParameter(
    state: CumulativePatchState,
    endpointID: string,
    value: number,
): CumulativePatchState {
    return { ...state, parameters: { ...state.parameters, [endpointID]: value } };
}

export function applySpeedrunOp(state: CumulativePatchState, op: UIOp): CumulativePatchState {
    switch (op.kind) {
        case "installLaneBaseline":
            return { ...state, lane: cloneLane(op.lane) };
        case "installModulationBaseline":
            return { ...state, modulation: cloneModulation(op.modulation) };
        case "navigate":
            return state;
        case "setParam":
            return writeParameter(state, op.endpointID, op.to);
        case "selectWavetable":
            return writeParameter(state, `osc${op.osc}WavetableSelect`, op.tableIndex);
        case "toggleEffect": {
            const lane = setLaneDeviceEnabled(state.lane, op.deviceId, op.enabled);
            if (lane === null) throw new Error(`Recipe references missing lane device ${op.deviceId}.`);
            return { ...state, lane };
        }
        case "setLaneParam": {
            const lane = setLaneDeviceParam(state.lane, op.deviceId, op.endpointID, op.to);
            if (lane === null) {
                throw new Error(`Recipe references missing lane parameter ${op.deviceId}.${op.endpointID}.`);
            }
            return { ...state, lane };
        }
        case "mapRoute":
            return {
                ...state,
                modulation: {
                    ...state.modulation,
                    routes: [
                        ...state.modulation.routes.filter((route) => route.id !== op.route.id),
                        { ...op.route },
                    ],
                },
            };
        case "configureMseg": {
            const msegSlots = [...state.modulation.msegSlots];
            msegSlots[op.slot - 1] = JSON.parse(JSON.stringify(op.state));
            return {
                ...state,
                parameters: {
                    ...state.parameters,
                    [`mseg${op.slot}Rate`]: op.rate,
                    [`mseg${op.slot}Morph`]: op.morph,
                },
                modulation: { ...state.modulation, msegSlots },
            };
        }
        case "setEnvelope": {
            const envelopeSlots = [...state.modulation.envelopeSlots];
            envelopeSlots[op.slot - 1] = { name: op.name };
            return {
                ...state,
                parameters: {
                    ...state.parameters,
                    [`env${op.slot}Attack`]: op.attack,
                    [`env${op.slot}Decay`]: op.decay,
                    [`env${op.slot}Sustain`]: op.sustain,
                    [`env${op.slot}Release`]: op.release,
                },
                modulation: { ...state.modulation, envelopeSlots },
            };
        }
        case "setMacro": {
            const macroNames = [...state.modulation.macroNames];
            macroNames[op.slot - 1] = op.name;
            return {
                ...state,
                parameters: { ...state.parameters, [`macro${op.slot}`]: op.value },
                modulation: { ...state.modulation, macroNames },
            };
        }
    }
}

function initialState(defaults: DefaultsSnapshot, recipe: SpeedrunRecipe): CumulativePatchState {
    return {
        parameters: { ...defaults.parameters },
        modulation: cloneModulation(defaults.modulation),
        lane: cloneLane(defaults.lane),
        articulations: cloneArticulations(recipe.articulations),
    };
}

function applyOps(state: CumulativePatchState, ops: ReadonlyArray<UIOp>): CumulativePatchState {
    return ops.reduce(applySpeedrunOp, state);
}

export function applyRecipe(defaults: DefaultsSnapshot, recipe: SpeedrunRecipe): CumulativePatchState {
    const withPrelude = applyOps(initialState(defaults, recipe), recipe.prelude);
    return recipe.sections.reduce((state, section) => applyOps(state, section.ops), withPrelude);
}

function oscillatorSectionIndexes(sections: ReadonlyArray<SpeedrunSection>): ReadonlyMap<OscillatorID, number> {
    const indexes = new Map<OscillatorID, number>();
    sections.forEach((section, index) => {
        const match = /^oscillator-([ABC])$/.exec(section.id);
        if (section.kind === "oscillator" && match !== null) indexes.set(match[1] as OscillatorID, index);
    });
    return indexes;
}

function neutralizePendingOscillators(
    state: CumulativePatchState,
    completedSectionIndex: number,
    oscillatorIndexes: ReadonlyMap<OscillatorID, number>,
): CumulativePatchState {
    const parameters = { ...state.parameters };
    for (const oscillatorID of OSCILLATOR_IDS) {
        const sectionIndex = oscillatorIndexes.get(oscillatorID);
        if (sectionIndex === undefined || sectionIndex > completedSectionIndex) {
            parameters[`osc${oscillatorID}Mute`] = 1;
        }
    }
    return { ...state, parameters };
}

/** One cumulative, renderable state after each visible section completes. */
export function buildCumulativeStates(
    defaults: DefaultsSnapshot,
    recipe: SpeedrunRecipe,
): CumulativePatchState[] {
    let state = applyOps(initialState(defaults, recipe), recipe.prelude);
    const oscillatorIndexes = oscillatorSectionIndexes(recipe.sections);
    return recipe.sections.map((section, sectionIndex) => {
        state = applyOps(state, section.ops);
        return cloneState(neutralizePendingOscillators(state, sectionIndex, oscillatorIndexes));
    });
}
