import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function section(index, checkpointIndex) {
    return {
        section: { id: `section-${index}`, kind: "source", title: `Section ${index}`, captions: [], allCaptions: [], ops: [], opCaptionLines: [] },
        startFrame: index * 3,
        endFrame: (index + 1) * 3,
        startSample: index * 4_800,
        endSample: (index + 1) * 4_800,
        captionEvents: [],
        opSpans: [],
        checkpointIndex,
    };
}

test("checkpoint telemetry splices at the same section frame authority as audio", async () => {
    const { assembleSpeedrunTelemetryTrack } = await loadUIModule(
        repoRoot,
        "ui/speedrun/audio/telemetry.ts",
    );
    const timeline = {
        fps: 30,
        sampleRate: 48_000,
        samplesPerFrame: 1_600,
        durationInFrames: 9,
        compressionLevel: 0,
        sections: [section(0, -1), section(1, 1), section(2, 2)],
    };
    const checkpoints = [
        {
            checkpointIndex: 1,
            telemetry: {
                frameCount: 4,
                frames: [
                    { frame: 0, events: { effectiveWavetablePosition: { position: 0.1 } } },
                    { frame: 2, events: { effectiveFilterState: { cutoffHz: 400 } } },
                    // Crossfade tail is deliberately not copied into the section.
                    { frame: 3, events: { effectiveFilterState: { cutoffHz: 999 } } },
                ],
            },
        },
        {
            checkpointIndex: 2,
            telemetry: {
                frameCount: 4,
                frames: [
                    { frame: 0, events: { effectiveWavetablePosition: { position: 0.8 } } },
                    { frame: 1, events: { effectiveMsegState: { positions: [0.4, 0, 0] } } },
                ],
            },
        },
    ];

    assert.deepEqual(assembleSpeedrunTelemetryTrack(timeline, checkpoints), {
        fps: 30,
        durationInFrames: 9,
        frames: [
            { frame: 3, events: { effectiveWavetablePosition: { position: 0.1 } } },
            { frame: 5, events: { effectiveFilterState: { cutoffHz: 400 } } },
            { frame: 6, events: { effectiveWavetablePosition: { position: 0.8 } } },
            { frame: 7, events: { effectiveMsegState: { positions: [0.4, 0, 0] } } },
        ],
    });
});

test("checkpoint telemetry rejects a missing audible checkpoint", async () => {
    const { assembleSpeedrunTelemetryTrack } = await loadUIModule(
        repoRoot,
        "ui/speedrun/audio/telemetry.ts",
    );
    const timeline = {
        fps: 30,
        sampleRate: 48_000,
        samplesPerFrame: 1_600,
        durationInFrames: 3,
        compressionLevel: 0,
        sections: [section(0, 0)],
    };
    assert.throws(
        () => assembleSpeedrunTelemetryTrack(timeline, []),
        /missing checkpoint 0/,
    );
});
