import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sampleCount = 2048;
const msegBodySamples = 2048;
const msegPaddedSamples = 2051;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtureRoot = path.join(repoRoot, "tests", "cmajor_filter", "fixtures");

function samplePositions() {
    return Array.from({ length: sampleCount }, (_, index) => index / sampleCount);
}

function removeDc(frame) {
    const mean = frame.reduce((sum, value) => sum + value, 0) / frame.length;
    return frame.map((value) => Math.fround(value - mean));
}

function sineFrame() {
    return removeDc(samplePositions().map((x) => Math.sin(2 * Math.PI * x)));
}

function sawFrame() {
    return removeDc(samplePositions().map((x) => (2 * x) - 1));
}

function squareFrame() {
    return removeDc(samplePositions().map((x) => (x < 0.5 ? 1 : -1)));
}

function brightFrame() {
    return removeDc(
        samplePositions().map((x) => (
            Math.sin(2 * Math.PI * x)
            + (0.55 * Math.sin(4 * Math.PI * x + 0.8))
            + (0.35 * Math.sin(6 * Math.PI * x - 0.3))
            + (0.2 * Math.sin(10 * Math.PI * x + 0.2))
            + (0.1 * Math.sin(18 * Math.PI * x - 0.5))
        )),
    );
}

function linearRampMsegBuffer() {
    const body = Array.from({ length: msegBodySamples }, (_, index) => Math.fround(index / (msegBodySamples - 1)));
    return [
        body[0],
        ...body,
        body[body.length - 1],
        body[body.length - 1],
    ];
}

function fastRiseMsegBuffer() {
    const body = Array.from({ length: msegBodySamples }, (_, index) => {
        const x = index / (msegBodySamples - 1);
        return Math.fround(Math.min(1, x * 6));
    });
    return [
        body[0],
        ...body,
        body[body.length - 1],
        body[body.length - 1],
    ];
}

function packMidi(statusByte, data1, data2) {
    return ((statusByte & 0xff) << 16) | ((data1 & 0x7f) << 8) | (data2 & 0x7f);
}

function noteOn(frameOffset, note, velocity = 100, channel = 0) {
    return {
        frameOffset,
        event: { message: packMidi(0x90 | channel, note, velocity) },
    };
}

function noteOff(frameOffset, note, velocity = 0, channel = 0) {
    return {
        frameOffset,
        event: { message: packMidi(0x80 | channel, note, velocity) },
    };
}

function valueEvent(frameOffset, value, framesToReachValue = 0) {
    return {
        frameOffset,
        value: Math.fround(value),
        framesToReachValue,
    };
}

async function writeJson(filePath, value) {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function wavetableLoadBegin(frameCount) {
    return [
        {
            frameOffset: 0,
            event: {
                dspSessionId: 1,
                generation: 1,
                tableIndex: 0,
                frameCount,
            },
        },
    ];
}

function wavetableMipFrames(frames) {
    return frames.map((frame, frameIndex) => ({
        frameOffset: frameIndex,
        event: {
            dspSessionId: 1,
            generation: 1,
            tableIndex: 0,
            mipIndex: 0,
            frameIndex,
            samples: frame,
        },
    }));
}

function msegPlaybackEvent(seconds) {
    return [
        {
            frameOffset: 0,
            event: {
                seconds: Math.fround(seconds),
                holdFinalValue: true,
                rateKind: 0,
                loopEnabled: false,
                loopStart: 0,
                loopEnd: 1,
                noteOffPolicy: 0,
                legatoRestarts: false,
            },
        },
    ];
}

function msegBufferEvent(buffer) {
    if (!Array.isArray(buffer) || buffer.length !== msegPaddedSamples) {
        throw new Error(`MSEG buffers must have exactly ${msegPaddedSamples} samples.`);
    }

    return [
        {
            frameOffset: 0,
            event: buffer,
        },
    ];
}

function modulationEnableEvent() {
    return [
        {
            frameOffset: 0,
            event: 1,
        },
    ];
}

function modulationMsegBufferEvent(slot, buffer) {
    if (!Array.isArray(buffer) || buffer.length !== msegPaddedSamples) {
        throw new Error(`MSEG buffers must have exactly ${msegPaddedSamples} samples.`);
    }

    return [
        {
            frameOffset: 0,
            event: {
                slot,
                buffer,
            },
        },
    ];
}

function modulationMsegPlaybackEvent(slot, playback) {
    return [
        {
            frameOffset: 0,
            event: {
                slot,
                ...playback[0].event,
            },
        },
    ];
}

function modulationFilterCutoffRouteEvent(amount) {
    return [
        {
            frameOffset: 0,
            event: {
                routeIndex: 0,
                enabled: true,
                sourceKind: 1,
                sourceSlot: 1,
                polarityKind: 0,
                targetKind: 3,
                amount: Math.fround(amount),
            },
        },
    ];
}

async function writeFixture(name, spec) {
    const dir = path.join(fixtureRoot, name);
    await mkdir(dir, { recursive: true });
    const filterMsegDepth = spec.filterMsegDepth ?? [valueEvent(0, 0)];

    await writeJson(path.join(dir, "wavetableLoadBegin.json"), wavetableLoadBegin(spec.frames.length));
    await writeJson(path.join(dir, "wavetableMipFrame.json"), wavetableMipFrames(spec.frames));
    await writeJson(path.join(dir, "midiIn.json"), spec.midiIn);
    await writeJson(path.join(dir, "wavetablePosition.json"), spec.wavetablePosition ?? [valueEvent(0, 0)]);
    await writeJson(path.join(dir, "mseg1Depth.json"), spec.mseg1Depth ?? [valueEvent(0, 0)]);
    await writeJson(path.join(dir, "filterMode.json"), spec.filterMode);
    await writeJson(path.join(dir, "filterCutoff.json"), spec.filterCutoff);
    await writeJson(path.join(dir, "filterQ.json"), spec.filterQ);
    await writeJson(path.join(dir, "filterMsegDepth.json"), filterMsegDepth);

    if (spec.mseg1Buffer) {
        await writeJson(path.join(dir, "mseg1Buffer.json"), spec.mseg1Buffer);
    }

    if (spec.mseg1Playback) {
        await writeJson(path.join(dir, "mseg1Playback.json"), spec.mseg1Playback);
    }

    const filterDepth = filterMsegDepth[0]?.value ?? 0;
    if (spec.mseg1Buffer && spec.mseg1Playback && filterDepth !== 0) {
        await writeJson(path.join(dir, "modulationEnable.json"), modulationEnableEvent());
        await writeJson(
            path.join(dir, "modulationMsegBuffer.json"),
            modulationMsegBufferEvent(1, spec.mseg1Buffer[0].event),
        );
        await writeJson(
            path.join(dir, "modulationMsegPlayback.json"),
            modulationMsegPlaybackEvent(1, spec.mseg1Playback),
        );
        await writeJson(path.join(dir, "modulationRoute.json"), modulationFilterCutoffRouteEvent(filterDepth));
    }
}

async function main() {
    const sine = sineFrame();
    const saw = sawFrame();
    const square = squareFrame();
    const bright = brightFrame();
    const rampMsegBuffer = linearRampMsegBuffer();
    const fastMsegBuffer = fastRiseMsegBuffer();

    await writeFixture("filter_off_identity", {
        frames: [bright],
        midiIn: [
            noteOn(128, 60),
            noteOff(3072, 60),
        ],
        filterMode: [valueEvent(0, 0)],
        filterCutoff: [valueEvent(0, 1000)],
        filterQ: [valueEvent(0, 0.707107)],
    });

    await writeFixture("lowpass_static", {
        frames: [bright],
        midiIn: [
            noteOn(128, 72),
            noteOff(3072, 72),
        ],
        filterMode: [valueEvent(0, 1)],
        filterCutoff: [valueEvent(0, 900)],
        filterQ: [valueEvent(0, 0.9)],
    });

    await writeFixture("highpass_static", {
        frames: [saw],
        midiIn: [
            noteOn(128, 52),
            noteOff(3072, 52),
        ],
        filterMode: [valueEvent(0, 2)],
        filterCutoff: [valueEvent(0, 1400)],
        filterQ: [valueEvent(0, 0.8)],
    });

    await writeFixture("bandpass_static", {
        frames: [bright],
        midiIn: [
            noteOn(128, 60),
            noteOff(3072, 60),
        ],
        filterMode: [valueEvent(0, 3)],
        filterCutoff: [valueEvent(0, 1200)],
        filterQ: [valueEvent(0, 3.5)],
    });

    await writeFixture("notch_static", {
        frames: [bright],
        midiIn: [
            noteOn(128, 60),
            noteOff(3072, 60),
        ],
        filterMode: [valueEvent(0, 4)],
        filterCutoff: [valueEvent(0, 1500)],
        filterQ: [valueEvent(0, 2.5)],
    });

    await writeFixture("peak_static", {
        frames: [bright],
        midiIn: [
            noteOn(128, 60),
            noteOff(3072, 60),
        ],
        filterMode: [valueEvent(0, 5)],
        filterCutoff: [valueEvent(0, 1100)],
        filterQ: [valueEvent(0, 5)],
    });

    await writeFixture("mseg_lowpass_pluck", {
        frames: [bright],
        midiIn: [
            noteOn(128, 64),
            noteOff(3584, 64),
        ],
        filterMode: [valueEvent(0, 1)],
        filterCutoff: [valueEvent(0, 260)],
        filterQ: [valueEvent(0, 1.1)],
        filterMsegDepth: [valueEvent(0, 4)],
        mseg1Buffer: msegBufferEvent(rampMsegBuffer),
        mseg1Playback: msegPlaybackEvent(0.08),
    });

    await writeFixture("resonance_extreme", {
        frames: [square],
        midiIn: [
            noteOn(128, 60),
            noteOff(3072, 60),
        ],
        filterMode: [valueEvent(0, 5)],
        filterCutoff: [valueEvent(0, 800)],
        filterQ: [valueEvent(0, 10)],
    });

    await writeFixture("two_voice_staggered_mseg", {
        frames: [bright],
        midiIn: [
            noteOn(128, 60),
            noteOn(640, 67),
            noteOff(3072, 60),
            noteOff(3584, 67),
        ],
        filterMode: [valueEvent(0, 1)],
        filterCutoff: [valueEvent(0, 320)],
        filterQ: [valueEvent(0, 1.2)],
        filterMsegDepth: [valueEvent(0, 4.5)],
        mseg1Buffer: msegBufferEvent(rampMsegBuffer),
        mseg1Playback: msegPlaybackEvent(0.12),
    });

    await writeFixture("fast_mseg_cutoff_motion_lowpass", {
        frames: [bright],
        midiIn: [
            noteOn(64, 72),
            noteOff(3072, 72),
        ],
        filterMode: [valueEvent(0, 1)],
        filterCutoff: [valueEvent(0, 350)],
        filterQ: [valueEvent(0, 2)],
        filterMsegDepth: [valueEvent(0, 5.5)],
        mseg1Buffer: msegBufferEvent(fastMsegBuffer),
        mseg1Playback: msegPlaybackEvent(0.03),
    });

    await writeFixture("fast_mseg_cutoff_motion_bandpass", {
        frames: [bright],
        midiIn: [
            noteOn(64, 69),
            noteOff(3072, 69),
        ],
        filterMode: [valueEvent(0, 3)],
        filterCutoff: [valueEvent(0, 500)],
        filterQ: [valueEvent(0, 5)],
        filterMsegDepth: [valueEvent(0, 4.5)],
        mseg1Buffer: msegBufferEvent(fastMsegBuffer),
        mseg1Playback: msegPlaybackEvent(0.025),
    });

    await writeFixture("fast_mseg_cutoff_motion_peak_high_q", {
        frames: [bright],
        midiIn: [
            noteOn(64, 69),
            noteOff(3072, 69),
        ],
        filterMode: [valueEvent(0, 5)],
        filterCutoff: [valueEvent(0, 650)],
        filterQ: [valueEvent(0, 8)],
        filterMsegDepth: [valueEvent(0, 4)],
        mseg1Buffer: msegBufferEvent(fastMsegBuffer),
        mseg1Playback: msegPlaybackEvent(0.025),
    });
}

await main();
