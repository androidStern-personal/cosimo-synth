import type { NotePerformance } from "../audio/checkpoint-renderer";

function code(status: number, note: number, velocity: number) {
    return (status << 16) | (note << 8) | velocity;
}

/** A short cycling performance that exposes attack, sustain, filter, and FX tails. */
export const DEFAULT_SPEEDRUN_PERFORMANCE: NotePerformance = Object.freeze({
    durationSec: 2.4,
    events: Object.freeze([
        { atSec: 0, code: code(0x90, 48, 102) },
        { atSec: 0.42, code: code(0x80, 48, 0) },
        { atSec: 0.48, code: code(0x90, 55, 96) },
        { atSec: 0.9, code: code(0x80, 55, 0) },
        { atSec: 0.96, code: code(0x90, 60, 110) },
        { atSec: 1.44, code: code(0x80, 60, 0) },
        { atSec: 1.52, code: code(0x90, 67, 94) },
        { atSec: 2.08, code: code(0x80, 67, 0) },
        { atSec: 2.399, code: code(0xb0, 123, 0) },
    ]),
});
