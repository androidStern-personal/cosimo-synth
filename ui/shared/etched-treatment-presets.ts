/**
 * Frozen etched-treatment calibrations — the shipped parameter sets for the
 * ink-on-paper module graphics (docs: transient/DEPTHSTACK_LAB.html;
 * pass: ui/shared/etched-ink.ts).
 *
 * WAVETABLE accepted provisionally by Andrew 2026-07-19 pending side-by-side
 * consistency review with the filter and distortion treatments. Fine-tuning
 * per graphic is expected; wholesale divergence is not.
 */

import { type EtchedInkParams } from "./etched-ink";
import { type WavetableEnergyParams } from "./wavetable-energy-field";

/** One graphic's complete treatment: pass params + its energy calibration. */
export type EtchedTreatment<EnergyParams> = {
    readonly etch: EtchedInkParams;
    readonly energy: EnergyParams;
};

/**
 * The provisional wavetable treatment: WASH (continuous ink linework —
 * grain is inert for wash), near-zero surface tone, and a quiet wide scan
 * line (glow present but barely carving: strength 0.05).
 */
export const WAVETABLE_ETCHED_TREATMENT: EtchedTreatment<WavetableEnergyParams> = {
    etch: {
        grainPx: 1,
        energyGain: 1,
        energyFloor: 0.02,
        inkDensity: 11,
        exposure: 0.6,
        contrast: 0.6,
        dither: "wash",
        hatchSpacingPx: 7,
        hatchAngleRad: (45 * Math.PI) / 180,
        ink: [23, 23, 23],
        backgroundKey: null,
    },
    energy: {
        bandEnergy: 0.03,
        meshEnergy: 1.35,
        contourEnergy: 0.5,
        heroWidthPx: 2.5,
        heroGlowPx: 9,
        heroGlowStrength: 0.05,
        heroEnergy: 0.95,
    },
};
