/**
 * The single authored placement manifest for the ADR-024 mobile Voice
 * focused oscillator editor.
 *
 * This file owns page membership, order, labels, formatter kinds,
 * interaction kinds, and MOD-target references for the 22 oscillator
 * controls. It deliberately owns NO endpoint ranges, defaults, or steps:
 * those facts stay with the generated/shared binding sources (ADR-021).
 *
 * Prototype-settled placement deltas over the original spec table:
 * - the quick strip is dissolved: Semitone is the bottom-right and Voices
 *   the bottom-left overlay on the wavetable graph;
 * - Solo is a per-tab "S" badge on each A/B/C tab;
 * - Mute remains the second tap on the active tab.
 */

import {
    OSCILLATOR_BINDING_CONTRACTS,
    type OscillatorControlID,
} from "./oscillator-binding";
import type { OscillatorModulationParameterKind } from "./modulation-targets";

export type MobileVoicePageName = "Shape" | "Tune" | "Unison" | "Phase" | "Modes";

export type MobileVoiceFormatKind =
    | "percent"
    | "decibels"
    | "octave"
    | "semitone"
    | "cents"
    | "detuneCents"
    | "pan"
    | "voices";

export type MobileVoiceInteractionKind =
    /** Two-axis readout cell: horizontal edits base, vertical edits the selected route. */
    | "readout"
    /** Discrete choice cell: tap cycles or opens choices; never a two-axis controller. */
    | "choice"
    /** Direct toggle outside the toolbar (tab badge / active-tab second tap). */
    | "toggle"
    /** The explicit wavetable picker overlay. */
    | "picker";

export type MobileVoicePlacement =
    | "page"
    | "graph-overlay-top-left"
    | "graph-overlay-top-right"
    | "graph-overlay-bottom-left"
    | "graph-overlay-bottom-right"
    | "graph-axis-horizontal"
    | "graph-axis-vertical"
    | "tab-badge"
    | "tab-active-second-tap";

export type MobileVoiceControlSpec = {
    readonly controlID: OscillatorControlID;
    readonly shortLabel: string;
    readonly fullLabel: string;
    readonly format: MobileVoiceFormatKind | null;
    readonly interaction: MobileVoiceInteractionKind;
    readonly detented: boolean;
    /**
     * The oscillator-local MOD parameter kind this control's vertical axis
     * edits, or null when the control has no modulation destination.
     * Octave, Semitone, and Fine all reference the aggregate
     * `pitchSemitones` target and must present it as Tune (ADR-024).
     */
    readonly modulationParameterKind: OscillatorModulationParameterKind | null;
    readonly placements: ReadonlyArray<MobileVoicePlacement>;
};

const SPEC = (spec: MobileVoiceControlSpec): MobileVoiceControlSpec => Object.freeze({
    ...spec,
    placements: Object.freeze([...spec.placements]),
});

/** All 22 controls of the focused oscillator, each exactly once. */
export const MOBILE_VOICE_PARAMETER_MANIFEST: ReadonlyArray<MobileVoiceControlSpec> = Object.freeze([
    SPEC({
        controlID: "wavetableSelect",
        shortLabel: "WT",
        fullLabel: "Wavetable",
        format: null,
        interaction: "picker",
        detented: false,
        modulationParameterKind: null,
        placements: ["graph-overlay-top-left"],
    }),
    SPEC({
        controlID: "framePosition",
        shortLabel: "Idx",
        fullLabel: "Index",
        format: "percent",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "wavetablePosition",
        placements: ["graph-axis-vertical", "page"],
    }),
    SPEC({
        controlID: "warpMode",
        shortLabel: "Warp",
        fullLabel: "Warp Mode",
        format: null,
        interaction: "choice",
        detented: false,
        modulationParameterKind: null,
        placements: ["graph-overlay-top-right"],
    }),
    SPEC({
        controlID: "warpAmount",
        shortLabel: "Warp",
        fullLabel: "Warp",
        format: "percent",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "warpAmount",
        placements: ["graph-axis-horizontal", "page"],
    }),
    SPEC({
        controlID: "pan",
        shortLabel: "Pan",
        fullLabel: "Pan",
        format: "pan",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "pan",
        placements: ["page"],
    }),
    SPEC({
        controlID: "octave",
        shortLabel: "Oct",
        fullLabel: "Octave",
        format: "octave",
        interaction: "readout",
        detented: true,
        modulationParameterKind: "pitchSemitones",
        placements: ["page"],
    }),
    SPEC({
        controlID: "semitone",
        shortLabel: "Semi",
        fullLabel: "Semitone",
        format: "semitone",
        interaction: "readout",
        detented: true,
        modulationParameterKind: "pitchSemitones",
        placements: ["graph-overlay-bottom-right", "page"],
    }),
    SPEC({
        controlID: "fineCents",
        shortLabel: "Fine",
        fullLabel: "Fine",
        format: "cents",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "pitchSemitones",
        placements: ["page"],
    }),
    SPEC({
        controlID: "volumeDb",
        shortLabel: "Lvl",
        fullLabel: "Level",
        format: "decibels",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "ampGainDb",
        placements: ["page"],
    }),
    SPEC({
        controlID: "mute",
        shortLabel: "Mute",
        fullLabel: "Mute",
        format: null,
        interaction: "toggle",
        detented: false,
        modulationParameterKind: null,
        placements: ["tab-active-second-tap"],
    }),
    SPEC({
        controlID: "solo",
        shortLabel: "S",
        fullLabel: "Solo",
        format: null,
        interaction: "toggle",
        detented: false,
        modulationParameterKind: null,
        placements: ["tab-badge"],
    }),
    SPEC({
        controlID: "unisonVoices",
        shortLabel: "Voices",
        fullLabel: "Unison Voices",
        format: "voices",
        interaction: "readout",
        detented: true,
        modulationParameterKind: null,
        placements: ["graph-overlay-bottom-left"],
    }),
    SPEC({
        controlID: "unisonDetune",
        shortLabel: "Det",
        fullLabel: "Detune",
        format: "detuneCents",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "unisonDetune",
        placements: ["page"],
    }),
    SPEC({
        controlID: "unisonBlend",
        shortLabel: "Blend",
        fullLabel: "Blend",
        format: "percent",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "unisonBlend",
        placements: ["page"],
    }),
    SPEC({
        controlID: "unisonWidth",
        shortLabel: "Width",
        fullLabel: "Width",
        format: "percent",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "unisonWidth",
        placements: ["page"],
    }),
    SPEC({
        controlID: "phase",
        shortLabel: "Phase",
        fullLabel: "Phase",
        format: "percent",
        interaction: "readout",
        detented: false,
        modulationParameterKind: null,
        placements: ["page"],
    }),
    SPEC({
        controlID: "phaseRandom",
        shortLabel: "Random",
        fullLabel: "Random Phase",
        format: "percent",
        interaction: "readout",
        detented: false,
        modulationParameterKind: null,
        placements: ["page"],
    }),
    SPEC({
        controlID: "retrigger",
        shortLabel: "Mode",
        fullLabel: "Phase Mode",
        format: null,
        interaction: "choice",
        detented: false,
        modulationParameterKind: null,
        placements: ["page"],
    }),
    SPEC({
        controlID: "unisonDetuneMode",
        shortLabel: "Detune",
        fullLabel: "Detune Mode",
        format: null,
        interaction: "choice",
        detented: false,
        modulationParameterKind: null,
        placements: ["page"],
    }),
    SPEC({
        controlID: "unisonStackMode",
        shortLabel: "Stack",
        fullLabel: "Stack",
        format: null,
        interaction: "choice",
        detented: false,
        modulationParameterKind: null,
        placements: ["page"],
    }),
    SPEC({
        controlID: "unisonWavetablePositionSpread",
        shortLabel: "WT",
        fullLabel: "WT Spread",
        format: "percent",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "unisonWavetablePositionSpread",
        placements: ["page"],
    }),
    SPEC({
        controlID: "unisonWarpSpread",
        shortLabel: "Warp",
        fullLabel: "Warp Spread",
        format: "percent",
        interaction: "readout",
        detented: false,
        modulationParameterKind: "unisonWarpSpread",
        placements: ["page"],
    }),
]);

export type MobileVoicePage = {
    readonly name: MobileVoicePageName;
    readonly cells: ReadonlyArray<OscillatorControlID>;
};

/** The five cyclic toolbar pages in paddle order. */
export const MOBILE_VOICE_PAGES: ReadonlyArray<MobileVoicePage> = Object.freeze([
    Object.freeze({ name: "Shape" as const, cells: Object.freeze(["framePosition", "warpAmount", "volumeDb", "unisonDetune"] as const) }),
    Object.freeze({ name: "Tune" as const, cells: Object.freeze(["octave", "semitone", "fineCents", "pan"] as const) }),
    Object.freeze({ name: "Unison" as const, cells: Object.freeze(["unisonBlend", "unisonWidth", "unisonWavetablePositionSpread", "unisonWarpSpread"] as const) }),
    Object.freeze({ name: "Phase" as const, cells: Object.freeze(["phase", "phaseRandom", "retrigger"] as const) }),
    Object.freeze({ name: "Modes" as const, cells: Object.freeze(["unisonDetuneMode", "unisonStackMode"] as const) }),
]);

/** Resolve one control's manifest entry; unknown IDs are a programming error. */
export function getMobileVoiceControlSpec(controlID: OscillatorControlID): MobileVoiceControlSpec {
    const spec = MOBILE_VOICE_PARAMETER_MANIFEST.find((candidate) => candidate.controlID === controlID);
    if (spec === undefined) {
        throw new Error(`Unknown mobile Voice control: ${controlID}`);
    }
    return spec;
}

function assertManifestCoverage(): void {
    const contract = OSCILLATOR_BINDING_CONTRACTS[0];
    const contractIDs = contract.controls.map((control) => control.controlID);
    const manifestIDs = MOBILE_VOICE_PARAMETER_MANIFEST.map((spec) => spec.controlID);

    if (new Set(manifestIDs).size !== manifestIDs.length) {
        throw new Error("Mobile Voice manifest must list each control exactly once");
    }
    if (contractIDs.length !== manifestIDs.length
        || contractIDs.some((controlID) => !manifestIDs.includes(controlID))) {
        throw new Error("Mobile Voice manifest must cover exactly the oscillator binding contract");
    }

    const pageCells = MOBILE_VOICE_PAGES.flatMap((page) => page.cells);
    if (new Set(pageCells).size !== pageCells.length) {
        throw new Error("A control may appear on at most one toolbar page");
    }
    for (const controlID of pageCells) {
        const spec = getMobileVoiceControlSpec(controlID);
        if (!spec.placements.includes("page")) {
            throw new Error(`Page cell ${controlID} must declare the page placement`);
        }
        if (spec.interaction !== "readout" && spec.interaction !== "choice") {
            throw new Error(`Page cell ${controlID} must be a readout or choice cell`);
        }
    }
    for (const spec of MOBILE_VOICE_PARAMETER_MANIFEST) {
        if (spec.placements.includes("page") !== pageCells.includes(spec.controlID)) {
            throw new Error(`Control ${spec.controlID} page placement must match page membership`);
        }
    }

    const aggregateTuneIDs = MOBILE_VOICE_PARAMETER_MANIFEST
        .filter((spec) => spec.modulationParameterKind === "pitchSemitones")
        .map((spec) => spec.controlID)
        .sort();
    if (aggregateTuneIDs.join(",") !== "fineCents,octave,semitone") {
        throw new Error("Exactly Octave, Semitone, and Fine must share the aggregate Tune target");
    }

    const contractTargetKinds = new Set(
        contract.modulationTargets.map((target) => target.parameterKind),
    );
    for (const spec of MOBILE_VOICE_PARAMETER_MANIFEST) {
        if (spec.modulationParameterKind !== null
            && !contractTargetKinds.has(spec.modulationParameterKind)) {
            throw new Error(`Control ${spec.controlID} references an unknown MOD target`);
        }
    }
}

assertManifestCoverage();
