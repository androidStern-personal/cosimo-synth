const SAMPLE_RATE = 48_000;
const DURATION_SECONDS = 1.5;
const FRAME_COUNT = Math.round(SAMPLE_RATE * DURATION_SECONDS);
const TARGET_PEAK = 10 ** (-3 / 20);

function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
    };
}

function finish(left, right) {
    const fadeFrames = Math.round(SAMPLE_RATE * 0.005);
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
        const fadeIn = Math.min(1, frame / fadeFrames);
        const fadeOut = Math.min(1, (FRAME_COUNT - 1 - frame) / fadeFrames);
        const fade = Math.max(0, Math.min(fadeIn, fadeOut));
        left[frame] *= fade;
        right[frame] *= fade;
    }
    let peak = 0;
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
        peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
    }
    const scale = TARGET_PEAK / Math.max(peak, 1e-30);
    return [
        Float32Array.from(left, (sample) => sample * scale),
        Float32Array.from(right, (sample) => sample * scale),
    ];
}

function makeDrumBus() {
    const randomLeft = mulberry32(0x27d12f00);
    const randomRight = mulberry32(0x27d12f01);
    const left = new Float64Array(FRAME_COUNT);
    const right = new Float64Array(FRAME_COUNT);
    let previousLeftNoise = 0;
    let previousRightNoise = 0;
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
        const time = frame / SAMPLE_RATE;
        const kickAge = time % 0.375;
        const snareAge = (time + 0.375) % 0.75;
        const hatAge = time % 0.09375;
        const noiseLeft = randomLeft() * 2 - 1;
        const noiseRight = randomRight() * 2 - 1;
        const kickPhase = 2 * Math.PI * (47 * kickAge + 2.9 * (1 - Math.exp(-30 * kickAge)));
        const kick = Math.sin(kickPhase) * Math.exp(-18 * kickAge);
        const snareEnvelope = Math.exp(-24 * snareAge) * 0.48;
        const hatEnvelope = Math.exp(-105 * hatAge) * 0.14;
        left[frame] = kick + noiseLeft * snareEnvelope + (noiseLeft - previousLeftNoise) * hatEnvelope;
        right[frame] = kick * 0.985 + noiseRight * snareEnvelope + (noiseRight - previousRightNoise) * hatEnvelope;
        previousLeftNoise = noiseLeft;
        previousRightNoise = noiseRight;
    }
    return finish(left, right);
}

function makeBassSequence() {
    const left = new Float64Array(FRAME_COUNT);
    const right = new Float64Array(FRAME_COUNT);
    const notes = [55, 65.4063913251, 73.4161919794, 82.4068892282];
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
        const time = frame / SAMPLE_RATE;
        const noteAge = time % 0.375;
        const frequency = notes[Math.floor(time / 0.375) % notes.length];
        let value = 0;
        for (let harmonic = 1; harmonic <= 9; harmonic += 1) {
            value += Math.sin(2 * Math.PI * frequency * harmonic * time) / harmonic;
        }
        value *= 0.55 + 0.45 * Math.exp(-7 * noteAge);
        left[frame] = value;
        right[frame] = value;
    }
    return finish(left, right);
}

function makeBrightPoly() {
    const left = new Float64Array(FRAME_COUNT);
    const right = new Float64Array(FRAME_COUNT);
    const chords = [
        [220, 277.1826309769, 329.6275569129, 415.3046975799],
        [195.9977179909, 246.9416506281, 293.6647679174, 369.9944227116],
    ];
    const detune = 2 ** (4 / 1200);
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
        const time = frame / SAMPLE_RATE;
        const chord = chords[Math.floor(time / 0.75) % chords.length];
        let sampleLeft = 0;
        let sampleRight = 0;
        for (let voice = 0; voice < chord.length; voice += 1) {
            for (let harmonic = 1; harmonic <= 11; harmonic += 1) {
                const weight = 1 / harmonic;
                sampleLeft += Math.sin(2 * Math.PI * chord[voice] / detune * harmonic * time + voice * 0.31) * weight;
                sampleRight += Math.sin(2 * Math.PI * chord[voice] * detune * harmonic * time + voice * 0.37) * weight;
            }
        }
        left[frame] = sampleLeft;
        right[frame] = sampleRight;
    }
    return finish(left, right);
}

export const CORPUS_SPEC = Object.freeze({
    sampleRate: SAMPLE_RATE,
    durationSeconds: DURATION_SECONDS,
    frameCount: FRAME_COUNT,
    targetPeakDbfs: -3,
    generator: "cosimo.t27.retainedCorpus.v1",
});

export function generateCorpus() {
    return [
        {
            id: "drum-bus",
            description: "Stereo kick, snare, and high-hat transients with deterministic independent noise.",
            channels: makeDrumBus(),
        },
        {
            id: "bass-sequence",
            description: "Mono-compatible four-note bass sequence with nine harmonics and note transients.",
            channels: makeBassSequence(),
        },
        {
            id: "bright-poly",
            description: "Stereo-detuned two-chord bright polyphonic hold with eleven harmonics per voice.",
            channels: makeBrightPoly(),
        },
    ];
}
