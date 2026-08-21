/**
 * The Voice filter's three base parameters (T04/T05 card), in the rack
 * descriptor shape so every consumer (the filter knobs, the T14 mappings
 * table's base resolver, exact entry) shares ONE authority.
 */

import type { RackParameterDescriptor } from "./rack-parameter-descriptors";

export const VOICE_FILTER_KNOB_DESCRIPTORS: Readonly<Record<"cutoff" | "resonance" | "mix", RackParameterDescriptor>> = {
    cutoff: {
        id: "voiceFilterCutoff",
        effectId: "filter",
        endpointID: "filterCutoff",
        label: "Cutoff",
        shortLabel: "Cut",
        min: 20,
        max: 20000,
        initial: 1000,
        step: 1,
        scale: "log",
        unit: "Hz",
        quick: false,
        modulationTargetIndex: null,
        modulationApplication: "octaves",
    },
    resonance: {
        id: "voiceFilterResonance",
        effectId: "filter",
        endpointID: "filterQ",
        label: "Resonance",
        shortLabel: "Res",
        min: 0.1,
        max: 20,
        initial: 0.707107,
        step: 0.01,
        scale: "log",
        unit: "",
        quick: false,
        modulationTargetIndex: null,
        modulationApplication: "linear",
        // The knobs' settled resonance rule: a base resting by a domain edge
        // makes linear amount-domain drags cram the audible travel into a
        // few pixels — amount drags walk the modulated value instead.
        modulationDragStyle: "effective-value",
    },
    mix: {
        id: "voiceFilterMix",
        effectId: "filter",
        endpointID: "filterMix",
        label: "Mix",
        shortLabel: "Mix",
        min: 0,
        max: 1,
        initial: 1,
        step: 0.01,
        scale: "linear",
        unit: "%",
        quick: false,
        modulationTargetIndex: null,
        modulationApplication: "linear",
    },
};
