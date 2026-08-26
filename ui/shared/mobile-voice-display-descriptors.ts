import type { OscillatorControlID } from "./oscillator-binding";
import {
    OSCILLATOR_VOLUME_MAX_DB,
    OSCILLATOR_VOLUME_MIN_DB,
} from "./oscillator-defaults";

/** A Voice control with a numeric or discrete display domain. */
export type MobileVoiceBindableControlID = Exclude<OscillatorControlID, "wavetableSelect">;

/** Authoritative display range and step for one mobile Voice control. */
export type MobileVoiceDisplayDescriptor = {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly choices?: ReadonlyArray<string>;
};

export const WARP_MODE_LABELS: ReadonlyArray<string> = ["Off", "Bend +/-", "PWM", "Asym +/-", "Mirror"];
const PHASE_MODE_LABELS: ReadonlyArray<string> = ["Free", "Reset"];
const DETUNE_MODE_LABELS: ReadonlyArray<string> = ["Linear", "Super", "Exp", "Inv", "Random"];
const STACK_MODE_LABELS: ReadonlyArray<string> = ["Off", "12", "12+7", "Center-12", "Center-24"];

/**
 * Display domains shared by the mobile Voice editor and exact-value entry.
 * Writes still pass through each live binding's own coercion.
 */
export const MOBILE_VOICE_DISPLAY_DESCRIPTORS: Readonly<
    Record<MobileVoiceBindableControlID, MobileVoiceDisplayDescriptor>
> = Object.freeze({
    framePosition: { min: 0, max: 1, step: 0.001 },
    warpAmount: { min: 0, max: 1, step: 0.001 },
    warpMode: { min: 0, max: 4, step: 1, choices: WARP_MODE_LABELS },
    pan: { min: -1, max: 1, step: 0.01 },
    octave: { min: -4, max: 4, step: 1 },
    semitone: { min: -12, max: 12, step: 1 },
    fineCents: { min: -100, max: 100, step: 1 },
    volumeDb: { min: OSCILLATOR_VOLUME_MIN_DB, max: OSCILLATOR_VOLUME_MAX_DB, step: 0.1 },
    mute: { min: 0, max: 1, step: 1 },
    solo: { min: 0, max: 1, step: 1 },
    unisonVoices: { min: 1, max: 8, step: 1 },
    unisonDetune: { min: 0, max: 1, step: 0.001 },
    unisonBlend: { min: 0, max: 1, step: 0.001 },
    unisonWidth: { min: 0, max: 1, step: 0.001 },
    phase: { min: 0, max: 1, step: 0.001 },
    phaseRandom: { min: 0, max: 1, step: 0.001 },
    retrigger: { min: 0, max: 1, step: 1, choices: PHASE_MODE_LABELS },
    unisonDetuneMode: { min: 0, max: 4, step: 1, choices: DETUNE_MODE_LABELS },
    unisonStackMode: { min: 0, max: 4, step: 1, choices: STACK_MODE_LABELS },
    unisonWavetablePositionSpread: { min: 0, max: 1, step: 0.001 },
    unisonWarpSpread: { min: 0, max: 1, step: 0.001 },
});
