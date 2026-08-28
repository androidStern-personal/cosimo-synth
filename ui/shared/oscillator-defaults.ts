import type { OscillatorID } from "./modulation-targets";

/** Current catalog identity for the authored Core Shapes Init table. */
export const OSCILLATOR_DEFAULT_WAVETABLE_ID = "core-shapes";

/** Current catalog index of the Core Shapes table. */
export const OSCILLATOR_DEFAULT_WAVETABLE_INDEX = 238;

/** Lowest valid factory wavetable selector index. */
export const OSCILLATOR_WAVETABLE_MIN_INDEX = 0;

/** Highest valid factory wavetable selector index. */
export const OSCILLATOR_WAVETABLE_MAX_INDEX = 238;

/** The host/DSP range for every oscillator's base level control. */
export const OSCILLATOR_VOLUME_MIN_DB = -48;
export const OSCILLATOR_VOLUME_MAX_DB = 6;

/** A newly enabled oscillator starts at unity gain before the fixed synth trim. */
export const OSCILLATOR_DEFAULT_VOLUME_DB = 0;

/** The same default expressed in the UI's linear normalized control domain. */
export const OSCILLATOR_DEFAULT_VOLUME_NORMALIZED = (
    OSCILLATOR_DEFAULT_VOLUME_DB - OSCILLATOR_VOLUME_MIN_DB
) / (OSCILLATOR_VOLUME_MAX_DB - OSCILLATOR_VOLUME_MIN_DB);

/** Init/new-sound mute values: A is audible; B and C are deliberately off. */
export const OSCILLATOR_DEFAULT_MUTE_BY_ID: Readonly<Record<OscillatorID, 0 | 1>> = Object.freeze({
    A: 0,
    B: 1,
    C: 1,
});

/** Resolve the canonical Init/new-sound mute value for one oscillator. */
export function getOscillatorDefaultMute(oscillatorID: OscillatorID): 0 | 1 {
    return OSCILLATOR_DEFAULT_MUTE_BY_ID[oscillatorID];
}
