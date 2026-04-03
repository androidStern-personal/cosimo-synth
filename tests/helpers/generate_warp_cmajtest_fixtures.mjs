import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sampleCount = 2048;
const msegBodySamples = 2048;
const msegPaddedSamples = 2051;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtureRoot = path.join(repoRoot, "tests", "cmajor_warp", "fixtures");

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

function triangleFrame() {
    return removeDc(samplePositions().map((x) => {
        if (x < 0.25) {
            return 4 * x;
        }

        if (x < 0.75) {
            return 2 - (4 * x);
        }

        return (4 * x) - 4;
    }));
}

function brightFrame() {
    return removeDc(
        samplePositions().map((x) => (
            Math.sin(2 * Math.PI * x)
            + (0.5 * Math.sin(4 * Math.PI * x + 0.8))
            + (0.25 * Math.sin(6 * Math.PI * x - 0.3))
            + (0.125 * Math.sin(10 * Math.PI * x + 0.2))
        ))
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

function msegPlaybackEvent({
    seconds,
    holdFinalValue = true,
    rateKind = 0,
    loopEnabled = false,
    loopStart = 0,
    loopEnd = 1,
    noteOffPolicy = 0,
    legatoRestarts = false,
}) {
    return [
        {
            frameOffset: 0,
            event: {
                seconds: Math.fround(seconds),
                holdFinalValue,
                rateKind,
                loopEnabled,
                loopStart: Math.fround(loopStart),
                loopEnd: Math.fround(loopEnd),
                noteOffPolicy,
                legatoRestarts,
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

async function writeFixture(name, spec) {
    const dir = path.join(fixtureRoot, name);
    await mkdir(dir, { recursive: true });

    await writeJson(path.join(dir, "wavetableLoadBegin.json"), wavetableLoadBegin(spec.frames.length));
    await writeJson(path.join(dir, "wavetableMipFrame.json"), wavetableMipFrames(spec.frames));

    if (spec.midiIn) {
        await writeJson(path.join(dir, "midiIn.json"), spec.midiIn);
    }

    if (spec.wavetablePosition) {
        await writeJson(path.join(dir, "wavetablePosition.json"), spec.wavetablePosition);
    }

    if (spec.playMode) {
        await writeJson(path.join(dir, "playMode.json"), spec.playMode);
    }

    if (spec.glideTime) {
        await writeJson(path.join(dir, "glideTime.json"), spec.glideTime);
    }

    if (spec.mseg1Depth) {
        await writeJson(path.join(dir, "mseg1Depth.json"), spec.mseg1Depth);
    }

    if (spec.warpMode) {
        await writeJson(path.join(dir, "warpMode.json"), spec.warpMode);
    }

    if (spec.warpAmount) {
        await writeJson(path.join(dir, "warpAmount.json"), spec.warpAmount);
    }

    if (spec.warpMsegDepth) {
        await writeJson(path.join(dir, "warpMsegDepth.json"), spec.warpMsegDepth);
    }

    if (spec.mseg1Buffer) {
        await writeJson(path.join(dir, "mseg1Buffer.json"), spec.mseg1Buffer);
    }

    if (spec.mseg1Playback) {
        await writeJson(path.join(dir, "mseg1Playback.json"), spec.mseg1Playback);
    }
}

async function main() {
    const sine = sineFrame();
    const saw = sawFrame();
    const square = squareFrame();
    const triangle = triangleFrame();
    const bright = brightFrame();
    const rampMsegBuffer = linearRampMsegBuffer();

    await writeFixture("identity_sine", {
        frames: [sine],
        midiIn: [
            noteOn(128, 60),
            noteOff(3072, 60),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
    });

    await writeFixture("scan_baseline", {
        frames: [sine, square],
        midiIn: [
            noteOn(128, 60),
            noteOff(3072, 60),
        ],
        wavetablePosition: [
            valueEvent(0, 0),
            valueEvent(512, 1, 2048),
        ],
        mseg1Depth: [valueEvent(0, 0)],
    });

    await writeFixture("poly_two_notes", {
        frames: [saw],
        midiIn: [
            noteOn(128, 60),
            noteOn(129, 67),
            noteOff(3072, 60),
            noteOff(3073, 67),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
    });

    await writeFixture("mono_legato_glide", {
        frames: [sine],
        midiIn: [
            noteOn(128, 60),
            noteOn(1024, 67),
            noteOff(3072, 67),
            noteOff(3073, 60),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        playMode: [valueEvent(0, 2)],
        glideTime: [valueEvent(0, 0.125)],
        mseg1Depth: [valueEvent(0, 0)],
    });

    await writeFixture("neutral_equals_off_bend", {
        frames: [sine],
        midiIn: [
            noteOn(128, 60),
            noteOff(3072, 60),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
        warpMode: [valueEvent(0, 1)],
        warpAmount: [valueEvent(0, 0.5)],
    });

    await writeFixture("neutral_equals_off_pwm", {
        frames: [sine],
        midiIn: [
            noteOn(128, 60),
            noteOff(3072, 60),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
        warpMode: [valueEvent(0, 2)],
        warpAmount: [valueEvent(0, 0)],
    });

    await writeFixture("bend_harmonic", {
        frames: [bright],
        midiIn: [
            noteOn(128, 96),
            noteOff(4096, 96),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
        warpMode: [valueEvent(0, 1)],
        warpAmount: [valueEvent(0, 1.0)],
    });

    await writeFixture("pwm_edge", {
        frames: [square],
        midiIn: [
            noteOn(128, 90),
            noteOff(3072, 90),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
        warpMode: [valueEvent(0, 2)],
        warpAmount: [valueEvent(0, 0.8)],
    });

    await writeFixture("asym_triangle", {
        frames: [triangle],
        midiIn: [
            noteOn(128, 72),
            noteOff(3072, 72),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
        warpMode: [valueEvent(0, 3)],
        warpAmount: [valueEvent(0, 0.8)],
    });

    await writeFixture("mirror_triangle", {
        frames: [triangle],
        midiIn: [
            noteOn(128, 72),
            noteOff(3072, 72),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
        warpMode: [valueEvent(0, 4)],
        warpAmount: [valueEvent(0, 0.8)],
    });

    await writeFixture("scan_plus_warp", {
        frames: [sine, saw, square],
        midiIn: [
            noteOn(128, 72),
            noteOff(3072, 72),
        ],
        wavetablePosition: [
            valueEvent(0, 0),
            valueEvent(512, 1, 2048),
        ],
        mseg1Depth: [valueEvent(0, 0)],
        warpMode: [valueEvent(0, 1)],
        warpAmount: [valueEvent(0, 0.85)],
    });

    await writeFixture("amount_automation", {
        frames: [saw],
        midiIn: [
            noteOn(128, 72),
            noteOff(3072, 72),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
        warpMode: [valueEvent(0, 1)],
        warpAmount: [
            valueEvent(0, 0.5),
            valueEvent(1024, 1, 1024),
        ],
    });

    await writeFixture("poly_warp_mseg_staggered", {
        frames: [bright],
        midiIn: [
            noteOn(128, 60, 100, 0),
            noteOn(640, 67, 100, 1),
            noteOff(2304, 60, 0, 0),
            noteOff(2816, 67, 0, 1),
        ],
        wavetablePosition: [valueEvent(0, 0)],
        mseg1Depth: [valueEvent(0, 0)],
        warpMode: [valueEvent(0, 1)],
        warpAmount: [valueEvent(0, 0.5)],
        warpMsegDepth: [valueEvent(0, 0.5)],
        mseg1Buffer: msegBufferEvent(rampMsegBuffer),
        mseg1Playback: msegPlaybackEvent({
            seconds: 0.04,
            holdFinalValue: true,
            loopEnabled: false,
            noteOffPolicy: 0,
        }),
    });
}

main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
});
