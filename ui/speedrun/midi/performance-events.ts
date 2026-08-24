/**
 * The one authority for where performance MIDI lands, in samples. The audio
 * checkpoint renderer sends these events to the engine and the scripted video
 * derives its keyboard frames from the same function, so what lights up on
 * screen is what the audio render heard.
 */

export type NotePerformanceEvent = {
    readonly atSec: number;
    readonly code: number;
};

export type NotePerformance = {
    readonly events: ReadonlyArray<NotePerformanceEvent>;
    readonly durationSec: number;
};

export type PerformanceSampleEvent = {
    readonly sample: number;
    readonly code: number;
};

export function buildPerformanceSampleEvents(
    performance: NotePerformance,
    sampleCount: number,
    sampleRate: number,
): ReadonlyArray<PerformanceSampleEvent> {
    if (!Number.isFinite(performance.durationSec) || performance.durationSec <= 0) {
        throw new Error("Speedrun performance duration must be positive and finite.");
    }
    const cycleSamples = Math.max(1, Math.round(performance.durationSec * sampleRate));
    const normalized = performance.events.map((event) => ({
        sample: Math.max(0, Math.min(cycleSamples - 1, Math.round(event.atSec * sampleRate))),
        code: Math.trunc(event.code),
    })).sort((left, right) => left.sample - right.sample || left.code - right.code);
    const events: PerformanceSampleEvent[] = [];
    for (let cycleStart = 0; cycleStart < sampleCount; cycleStart += cycleSamples) {
        for (const event of normalized) {
            const sample = cycleStart + event.sample;
            if (sample < sampleCount) events.push({ sample, code: event.code });
        }
    }
    return events;
}
