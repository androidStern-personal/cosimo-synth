import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function timedSection(index, checkpointIndex) {
    const startFrame = index * 60;
    const endFrame = startFrame + 60;
    return {
        section: { id: `section-${index}`, kind: "source", label: `Section ${index}`, captions: [], uncappedCaptions: [], ops: [], opCaptionLines: [] },
        startFrame,
        endFrame,
        startSample: startFrame * 1_600,
        endSample: endFrame * 1_600,
        captionEvents: [],
        opSpans: [],
        checkpointIndex,
    };
}

function checkpoint(checkpointIndex, sectionFrames, crossfadeFrames, body, tail) {
    const samples = new Float32Array((sectionFrames + crossfadeFrames) * 2);
    samples.fill(body, 0, sectionFrames * 2);
    samples.fill(tail, sectionFrames * 2);
    return {
        rootIndex: checkpointIndex,
        rootNote: checkpointIndex,
        checkpointIndex,
        frameCount: sectionFrames + crossfadeFrames,
        samples,
        metrics: {
            renderedFrameCount: sectionFrames + crossfadeFrames,
            installFrameCount: 0,
            elapsedMilliseconds: 0,
            realtimeMultiplier: null,
        },
    };
}

test("master track keeps integer authority, equal-power boundaries, and a final fade", async () => {
    const masterModule = await loadUIModule(repoRoot, "ui/speedrun/audio/master-track.ts");
    const sectionFrames = 60 * 1_600;
    const timeline = {
        fps: 30,
        sampleRate: 48_000,
        samplesPerFrame: 1_600,
        durationInFrames: 180,
        compressionLevel: 0,
        sections: [timedSection(0, -1), timedSection(1, 1), timedSection(2, 2)],
    };
    const checkpoints = [
        checkpoint(1, sectionFrames, masterModule.SPEEDRUN_CROSSFADE_SAMPLES, 0.2, 0.4),
        checkpoint(2, sectionFrames, masterModule.SPEEDRUN_CROSSFADE_SAMPLES, 0.8, 0.6),
    ];
    const master = masterModule.assembleSpeedrunMasterTrack(timeline, checkpoints);

    assert.equal(master.frameCount, 180 * 1_600);
    assert.equal(master.samples.length, master.frameCount * 2);
    assert.equal(master.samples[0], 0);
    assert.ok(Math.abs(master.samples[sectionFrames * 2] - 0.2) < 1e-6);
    const boundaryFrame = sectionFrames * 2;
    assert.ok(Math.abs(master.samples[boundaryFrame * 2] - 0.4) < 1e-6);
    const crossfadeEnd = boundaryFrame + masterModule.SPEEDRUN_CROSSFADE_SAMPLES - 1;
    assert.ok(Math.abs(master.samples[crossfadeEnd * 2] - 0.8) < 1e-5);
    assert.equal(master.samples.at(-1), 0);
    assert.equal(new TextDecoder().decode(master.wav.subarray(0, 4)), "RIFF");
    assert.equal(master.wav.byteLength, 44 + master.samples.length * 2);
    assert.equal(
        await masterModule.digestSpeedrunPCM(master.samples),
        await masterModule.digestSpeedrunPCM(master.samples.slice()),
    );
});

test("master track rejects a missing or short checkpoint instead of emitting partial audio", async () => {
    const masterModule = await loadUIModule(repoRoot, "ui/speedrun/audio/master-track.ts");
    const timeline = {
        fps: 30,
        sampleRate: 48_000,
        samplesPerFrame: 1_600,
        durationInFrames: 60,
        compressionLevel: 0,
        sections: [timedSection(0, 0)],
    };
    assert.throws(
        () => masterModule.assembleSpeedrunMasterTrack(timeline, []),
        /missing checkpoint 0/,
    );
});
