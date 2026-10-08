/**
 * The remembered intentional pitch: the most recent note the user
 * deliberately played on the on-screen or a connected MIDI keyboard. The Note
 * key and Auto-preview play this pitch when nothing is held. Before any
 * intentional note has been played, it is middle C.
 * DAW/transport playback must never feed this memory — that gating happens at
 * the call sites, which only forward user-originated note-ons.
 */

export const INITIAL_INTENTIONAL_PITCH = 60;

export type IntentionalPitchMemory = {
    /** Record an intentional note-on. Out-of-domain values are ignored. */
    noteOn(midiNote: number): void;
    current(): number;
};

export function createIntentionalPitchMemory(): IntentionalPitchMemory {
    let pitch = INITIAL_INTENTIONAL_PITCH;

    return {
        noteOn(midiNote: number) {
            if (Number.isInteger(midiNote) && midiNote >= 0 && midiNote <= 127) {
                pitch = midiNote;
            }
        },
        current() {
            return pitch;
        },
    };
}
