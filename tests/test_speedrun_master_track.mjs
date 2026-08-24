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
    // Equal loudness with opposite signs: leveling gains stay exactly 1 while
    // the boundary stays sign-distinguishable for the splice assertions.
    const checkpoints = [
        checkpoint(1, sectionFrames, masterModule.SPEEDRUN_CROSSFADE_SAMPLES, 0.5, 0.5),
        checkpoint(2, sectionFrames, masterModule.SPEEDRUN_CROSSFADE_SAMPLES, -0.5, -0.5),
    ];
    const master = masterModule.assembleSpeedrunMasterTrack(timeline, checkpoints);

    assert.equal(master.frameCount, 180 * 1_600);
    assert.equal(master.samples.length, master.frameCount * 2);
    assert.equal(master.samples[0], 0);
    assert.ok(Math.abs(master.samples[sectionFrames * 2] - 0.5) < 1e-6);
    const boundaryFrame = sectionFrames * 2;
    assert.ok(Math.abs(master.samples[boundaryFrame * 2] - 0.5) < 1e-6);
    const crossfadeEnd = boundaryFrame + masterModule.SPEEDRUN_CROSSFADE_SAMPLES - 1;
    assert.ok(Math.abs(master.samples[crossfadeEnd * 2] - (-0.5)) < 1e-5);
    assert.equal(Math.abs(master.samples.at(-1)), 0);
    assert.equal(new TextDecoder().decode(master.wav.subarray(0, 4)), "RIFF");
    assert.equal(master.wav.byteLength, 44 + master.samples.length * 2);
});

test("leveling pulls sections toward the median loudness within bounds", async () => {
    const masterModule = await loadUIModule(repoRoot, "ui/speedrun/audio/master-track.ts");
    const sectionFrames = 60 * 1_600;
    const timeline = {
        fps: 30,
        sampleRate: 48_000,
        samplesPerFrame: 1_600,
        durationInFrames: 240,
        compressionLevel: 0,
        sections: [timedSection(0, 0), timedSection(1, 1), timedSection(2, 2), timedSection(3, 3)],
    };
    const crossfade = masterModule.SPEEDRUN_CROSSFADE_SAMPLES;
    const master = masterModule.assembleSpeedrunMasterTrack(timeline, [
        checkpoint(0, sectionFrames, crossfade, 0.05, 0.05),
        checkpoint(1, sectionFrames, crossfade, 0.2, 0.2),
        checkpoint(2, sectionFrames, crossfade, 0.4, 0.4),
        // Effectively silent: leveling must not amplify it into noise.
        checkpoint(3, sectionFrames, crossfade, 0.00005, 0.00005),
    ]);

    const midOf = (sectionIndex) => Math.abs(master.samples[((sectionIndex * sectionFrames) + Math.floor(sectionFrames / 2)) * 2]);
    // Median section RMS is 0.2: the quiet section boosts 4x (the cap), the
    // median stays, the loud section cuts to target, silence stays untouched.
    assert.ok(Math.abs(midOf(0) - 0.2) < 1e-6, String(midOf(0)));
    assert.ok(Math.abs(midOf(1) - 0.2) < 1e-6, String(midOf(1)));
    assert.ok(Math.abs(midOf(2) - 0.2) < 1e-6, String(midOf(2)));
    assert.ok(Math.abs(midOf(3) - 0.00005) < 1e-7, String(midOf(3)));

    let peak = 0;
    for (const sample of master.samples) peak = Math.max(peak, Math.abs(sample));
    assert.ok(peak <= 0.98 + 1e-6, String(peak));
});

test("peak safety rescales an over-hot master to the ceiling", async () => {
    const masterModule = await loadUIModule(repoRoot, "ui/speedrun/audio/master-track.ts");
    const sectionFrames = 60 * 1_600;
    const timeline = {
        fps: 30,
        sampleRate: 48_000,
        samplesPerFrame: 1_600,
        durationInFrames: 60,
        compressionLevel: 0,
        sections: [timedSection(0, 0)],
    };
    const master = masterModule.assembleSpeedrunMasterTrack(timeline, [
        checkpoint(0, sectionFrames, masterModule.SPEEDRUN_CROSSFADE_SAMPLES, 0.995, 0.995),
    ]);
    let peak = 0;
    for (const sample of master.samples) peak = Math.max(peak, Math.abs(sample));
    assert.ok(Math.abs(peak - 0.98) < 1e-6, String(peak));
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
