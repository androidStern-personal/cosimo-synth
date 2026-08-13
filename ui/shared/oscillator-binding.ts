import {
    type ArticulationVoiceParameterId,
    type OscillatorArticulationParameterId,
} from "./articulation-image";
import {
    OSCILLATOR_IDS,
    OSCILLATOR_MODULATION_PARAMETER_KINDS,
    getVoiceModulationTargetIndex,
    type OscillatorID,
    type OscillatorModulationParameterKind,
    type OscillatorModulationTargetKind,
} from "./modulation-targets";

/** The three stable oscillator slots shared by DSP, state, and presentation. */
export type OscillatorRuntimeIndex = 0 | 1 | 2;

/** A table selector or one articulation-addressable oscillator control. */
export type OscillatorControlID = "wavetableSelect" | OscillatorArticulationParameterId;

type OscillatorControlEndpointSuffix =
    | "WavetableSelect"
    | "WavetablePosition"
    | "Pan"
    | "Octave"
    | "Semitone"
    | "FineCents"
    | "Phase"
    | "PhaseRandom"
    | "Retrigger"
    | "VolumeDb"
    | "Mute"
    | "Solo"
    | "WarpMode"
    | "WarpAmount"
    | "UnisonVoices"
    | "UnisonDetune"
    | "UnisonBlend"
    | "UnisonWidth"
    | "UnisonDetuneMode"
    | "UnisonStackMode"
    | "UnisonPositionSpread"
    | "UnisonWarpSpread";

/** One endpoint in the accepted indexed A/B/C product interface. */
export type OscillatorControlEndpointID =
    `osc${OscillatorID}${OscillatorControlEndpointSuffix}`;

/** The exact future host address for one oscillator control. */
export type OscillatorControlAddress = {
    readonly controlID: OscillatorControlID;
    readonly endpointID: OscillatorControlEndpointID;
    readonly oscillatorIndex: OscillatorRuntimeIndex;
    readonly articulationParameterID: ArticulationVoiceParameterId | null;
};

/** The UI parameter name corresponding to one oscillator-local MOD destination. */
export type OscillatorModulationUITargetParameterID =
    | Exclude<OscillatorModulationParameterKind, "wavetablePosition" | "ampGainDb">
    | "framePosition"
    | "volumeDb";

/** One oscillator-qualified UI target corresponding to a MOD v4 destination. */
export type OscillatorModulationUITargetID =
    `osc${OscillatorID}.${OscillatorModulationUITargetParameterID}`;

/** One oscillator-qualified MOD v4 destination and its packed runtime address. */
export type OscillatorModulationAddress = {
    readonly parameterKind: OscillatorModulationParameterKind;
    readonly targetKind: OscillatorModulationTargetKind;
    readonly uiTargetID: OscillatorModulationUITargetID;
    readonly runtimeTargetIndex: number;
    readonly oscillatorIndex: OscillatorRuntimeIndex;
};

/** How the indexed runtime-state stream identifies one oscillator's table. */
export type OscillatorTableStatusAddress = {
    readonly endpointID: "runtimeState";
    readonly oscillatorIndex: OscillatorRuntimeIndex;
};

/**
 * Shared domain contract for one oscillator. Endpoint IDs are reserved by the
 * accepted A/B/C graph, but this module does not claim that graph is connected
 * to today's legacy A-only patch root.
 */
export type OscillatorBindingContract = {
    readonly id: OscillatorID;
    readonly oscillatorIndex: OscillatorRuntimeIndex;
    readonly tableStatus: OscillatorTableStatusAddress;
    readonly controls: ReadonlyArray<OscillatorControlAddress>;
    readonly modulationTargets: ReadonlyArray<OscillatorModulationAddress>;
    readonly articulationParameterIDs: ReadonlyArray<ArticulationVoiceParameterId>;
};

/** A single endpoint write resolved from the locally selected oscillator. */
export type OscillatorControlWrite<TValue> = {
    readonly oscillatorID: OscillatorID;
    readonly oscillatorIndex: OscillatorRuntimeIndex;
    readonly controlID: OscillatorControlID;
    readonly endpointID: OscillatorControlEndpointID;
    readonly value: TValue;
};

/** Shared selection semantics; each platform remains free to render its own tabs. */
export type OscillatorSelectionViewModel = {
    readonly options: ReadonlyArray<OscillatorBindingContract>;
    readonly selectedOscillatorID: OscillatorID;
    readonly selectedOscillator: OscillatorBindingContract;
    readonly selectOscillator: (oscillatorID: OscillatorID) => void;
    readonly projectControlWrite: <TValue>(
        controlID: OscillatorControlID,
        value: TValue,
    ) => OscillatorControlWrite<TValue>;
};

type OscillatorControlDefinition = {
    readonly controlID: OscillatorControlID;
    readonly endpointSuffix: OscillatorControlEndpointSuffix;
    readonly articulationParameterID: OscillatorArticulationParameterId | null;
};

const OSCILLATOR_CONTROL_DEFINITIONS = [
    {
        controlID: "wavetableSelect",
        endpointSuffix: "WavetableSelect",
        articulationParameterID: null,
    },
    {
        controlID: "framePosition",
        endpointSuffix: "WavetablePosition",
        articulationParameterID: "framePosition",
    },
    { controlID: "pan", endpointSuffix: "Pan", articulationParameterID: "pan" },
    { controlID: "octave", endpointSuffix: "Octave", articulationParameterID: "octave" },
    { controlID: "semitone", endpointSuffix: "Semitone", articulationParameterID: "semitone" },
    { controlID: "fineCents", endpointSuffix: "FineCents", articulationParameterID: "fineCents" },
    { controlID: "phase", endpointSuffix: "Phase", articulationParameterID: "phase" },
    {
        controlID: "phaseRandom",
        endpointSuffix: "PhaseRandom",
        articulationParameterID: "phaseRandom",
    },
    { controlID: "retrigger", endpointSuffix: "Retrigger", articulationParameterID: "retrigger" },
    { controlID: "volumeDb", endpointSuffix: "VolumeDb", articulationParameterID: "volumeDb" },
    { controlID: "mute", endpointSuffix: "Mute", articulationParameterID: "mute" },
    { controlID: "solo", endpointSuffix: "Solo", articulationParameterID: "solo" },
    { controlID: "warpMode", endpointSuffix: "WarpMode", articulationParameterID: "warpMode" },
    { controlID: "warpAmount", endpointSuffix: "WarpAmount", articulationParameterID: "warpAmount" },
    {
        controlID: "unisonVoices",
        endpointSuffix: "UnisonVoices",
        articulationParameterID: "unisonVoices",
    },
    {
        controlID: "unisonDetune",
        endpointSuffix: "UnisonDetune",
        articulationParameterID: "unisonDetune",
    },
    {
        controlID: "unisonBlend",
        endpointSuffix: "UnisonBlend",
        articulationParameterID: "unisonBlend",
    },
    {
        controlID: "unisonWidth",
        endpointSuffix: "UnisonWidth",
        articulationParameterID: "unisonWidth",
    },
    {
        controlID: "unisonDetuneMode",
        endpointSuffix: "UnisonDetuneMode",
        articulationParameterID: "unisonDetuneMode",
    },
    {
        controlID: "unisonStackMode",
        endpointSuffix: "UnisonStackMode",
        articulationParameterID: "unisonStackMode",
    },
    {
        controlID: "unisonWavetablePositionSpread",
        endpointSuffix: "UnisonPositionSpread",
        articulationParameterID: "unisonWavetablePositionSpread",
    },
    {
        controlID: "unisonWarpSpread",
        endpointSuffix: "UnisonWarpSpread",
        articulationParameterID: "unisonWarpSpread",
    },
] as const satisfies ReadonlyArray<OscillatorControlDefinition>;

const OSCILLATOR_RUNTIME_IDENTITIES = [
    { id: "A", oscillatorIndex: 0 },
    { id: "B", oscillatorIndex: 1 },
    { id: "C", oscillatorIndex: 2 },
] as const satisfies ReadonlyArray<{
    readonly id: OscillatorID;
    readonly oscillatorIndex: OscillatorRuntimeIndex;
}>;

function uiTargetIDSuffix(
    parameterKind: OscillatorModulationParameterKind,
): OscillatorModulationUITargetParameterID {
    switch (parameterKind) {
        case "wavetablePosition": return "framePosition";
        case "ampGainDb": return "volumeDb";
        case "warpAmount":
        case "pitchSemitones":
        case "pan":
        case "unisonDetune":
        case "unisonBlend":
        case "unisonWidth":
        case "unisonWavetablePositionSpread":
        case "unisonWarpSpread":
            return parameterKind;
    }
}

function createControlAddress(
    oscillatorID: OscillatorID,
    oscillatorIndex: OscillatorRuntimeIndex,
    definition: OscillatorControlDefinition,
): OscillatorControlAddress {
    const articulationParameterID = definition.articulationParameterID === null
        ? null
        : `osc${oscillatorID}.${definition.articulationParameterID}` as const;

    return Object.freeze({
        controlID: definition.controlID,
        // SAFETY: both interpolated pieces come from closed unions above, so
        // their concatenation is exactly one OscillatorControlEndpointID.
        endpointID: `osc${oscillatorID}${definition.endpointSuffix}` as OscillatorControlEndpointID,
        oscillatorIndex,
        articulationParameterID,
    });
}

function createModulationAddress(
    oscillatorID: OscillatorID,
    oscillatorIndex: OscillatorRuntimeIndex,
    parameterKind: OscillatorModulationParameterKind,
): OscillatorModulationAddress {
    const targetKind = `osc${oscillatorID}.${parameterKind}` as const;
    return Object.freeze({
        parameterKind,
        targetKind,
        // SAFETY: the oscillator and target suffix are both closed canonical
        // unions, so the interpolated ID belongs to the UI target domain.
        uiTargetID: `osc${oscillatorID}.${uiTargetIDSuffix(parameterKind)}` as OscillatorModulationUITargetID,
        runtimeTargetIndex: getVoiceModulationTargetIndex(targetKind),
        oscillatorIndex,
    });
}

function createBindingContract(
    id: OscillatorID,
    oscillatorIndex: OscillatorRuntimeIndex,
): OscillatorBindingContract {
    const controls = Object.freeze(OSCILLATOR_CONTROL_DEFINITIONS.map(
        (definition) => createControlAddress(id, oscillatorIndex, definition),
    ));
    const modulationTargets = Object.freeze(OSCILLATOR_MODULATION_PARAMETER_KINDS.map(
        (parameterKind) => createModulationAddress(id, oscillatorIndex, parameterKind),
    ));
    const articulationParameterIDs = Object.freeze(controls.flatMap(
        (control) => control.articulationParameterID === null ? [] : [control.articulationParameterID],
    ));

    return Object.freeze({
        id,
        oscillatorIndex,
        tableStatus: Object.freeze({ endpointID: "runtimeState" as const, oscillatorIndex }),
        controls,
        modulationTargets,
        articulationParameterIDs,
    });
}

/** The canonical A/B/C contracts in frozen runtime order. */
export const OSCILLATOR_BINDING_CONTRACTS: ReadonlyArray<OscillatorBindingContract> = Object.freeze(
    OSCILLATOR_RUNTIME_IDENTITIES.map(({ id, oscillatorIndex }) => createBindingContract(id, oscillatorIndex)),
);

/** The presentation-only initial tab; it is deliberately not stored with patch values. */
export const DEFAULT_SELECTED_OSCILLATOR_ID: OscillatorID = "A";

function assertBindingContracts(): void {
    if (OSCILLATOR_BINDING_CONTRACTS.length !== OSCILLATOR_IDS.length
        || OSCILLATOR_BINDING_CONTRACTS.some((contract, index) => (
            contract.id !== OSCILLATOR_IDS[index] || contract.oscillatorIndex !== index
        ))) {
        throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
    }

    const endpointIDs = OSCILLATOR_BINDING_CONTRACTS.flatMap(
        (contract) => contract.controls.map((control) => control.endpointID),
    );
    if (new Set(endpointIDs).size !== endpointIDs.length) {
        throw new Error("Oscillator control endpoint IDs must be unique");
    }
}

assertBindingContracts();

/** Resolve one oscillator's complete shared contract without accepting aliases. */
export function getOscillatorBindingContract(oscillatorID: OscillatorID): OscillatorBindingContract {
    const contract = OSCILLATOR_BINDING_CONTRACTS.find((candidate) => candidate.id === oscillatorID);
    if (contract === undefined) throw new Error(`Unknown oscillator identity: ${oscillatorID}`);
    return contract;
}

/** Resolve one control address inside an oscillator contract. */
export function getOscillatorControlAddress(
    oscillatorID: OscillatorID,
    controlID: OscillatorControlID,
): OscillatorControlAddress {
    const control = getOscillatorBindingContract(oscillatorID).controls.find(
        (candidate) => candidate.controlID === controlID,
    );
    if (control === undefined) throw new Error(`Unknown oscillator control: ${oscillatorID}.${controlID}`);
    return control;
}

/**
 * Project a user edit through the selected oscillator contract. This is the
 * single write-routing seam for later desktop/iPhone host adapters.
 */
export function projectSelectedOscillatorWrite<TValue>(
    selectedOscillatorID: OscillatorID,
    controlID: OscillatorControlID,
    value: TValue,
): OscillatorControlWrite<TValue> {
    const address = getOscillatorControlAddress(selectedOscillatorID, controlID);
    return Object.freeze({
        oscillatorID: selectedOscillatorID,
        oscillatorIndex: address.oscillatorIndex,
        controlID,
        endpointID: address.endpointID,
        value,
    });
}
