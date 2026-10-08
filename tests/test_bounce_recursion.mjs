import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import { captureBounceBank } from "../bounce/capture.mjs";
import { createBounceCaptureSnapshot } from "../bounce/capture-plan.mjs";
import { comparePeakNormalizedRms } from "./helpers/bounce_quality.mjs";
import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import {
    hostParameters,
    loadOfflineEngine,
    offlineEngineModuleURL,
} from "./helpers/bounce_offline_engine.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sampleRate = 48_000;
const roots = Object.freeze([48, 60, 72]);
const holdSeconds = 0.2;
const nodeWorkerURL = new URL("../bounce/node-render-worker.mjs", import.meta.url);

function nodeWorkerFactory(url) {
    return new Worker(url, { type: "module" });
}

/** One cycle of a sine with a quiet third harmonic. */
function sourceFrame() {
    return Float32Array.from({ length: 2_048 }, (_, index) => {
        const phase = index / 2_048;
        return (Math.sin(2 * Math.PI * phase) + (0.12 * Math.sin(6 * Math.PI * phase))) / 1.12;
    });
}

function rootFloat(bank, index, firstFrame, frameCount) {
    const first = (bank.roots[index].frameOffset + firstFrame) * 2;
    return Float32Array.from(bank.pcm.subarray(first, first + (frameCount * 2)), (value) => value / 32_768);
}

function stereoRms(samples) {
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
}

/** How many dB a root's level falls from 10 ms to 50 ms after its note-off, in 5 ms windows. */
function releaseDropDb(bank, index, noteOffFrame) {
    const windowFrames = Math.round(0.005 * sampleRate);
    const level = (seconds) => stereoRms(rootFloat(
        bank, index, noteOffFrame + Math.round(seconds * sampleRate), windowFrames,
    ));
    return 20 * Math.log10(level(0.01) / level(0.05));
}

test("a recursive capture installs generation 1 in every fresh worker and reproduces it from the first frame to the end of its tail", async () => {
    const [CmajorClass, { bounceCaptureRecipeInternals }] = await Promise.all([
        loadOfflineEngine(),
        loadUIModule(repoRoot, "ui/shared/bounce-capture-recipe.ts"),
    ]);
    const capture = (snapshot) => captureBounceBank({
        snapshot,
        planOptions: { roots, holdSeconds, tailCapSeconds: 0.45 },
        workerURL: nodeWorkerURL,
        engineModuleURL: offlineEngineModuleURL,
        workerFactory: nodeWorkerFactory,
        concurrency: 1,
    });
    const parameters = hostParameters(CmajorClass, {
        oscAWavetableSelect: 0,
        oscAVolumeDb: -20,
        filterMode: 0,
    });
    const generationOne = await capture(createBounceCaptureSnapshot({
        sampleRate,
        tempoBpm: 123,
        settleFrames: 256,
        parameters,
        wavetableSources: [{ input: 0, generation: 1, tableIndex: 0, frames: [sourceFrame()] }],
    }));
    // A bounced sound keeps every parameter and plays its bank as Source Mode Bounce.
    const generationTwo = await capture(createBounceCaptureSnapshot({
        sampleRate,
        tempoBpm: 123,
        settleFrames: 256,
        sourceGeneration: 1,
        sourceBankDigest: generationOne.digest,
        parameters: { ...parameters, sourceMode: 1 },
        setupEvents: bounceCaptureRecipeInternals.recursiveBankSetupEvents(generationOne.bank, 1),
    }));

    assert.deepEqual(generationOne.plan.roots, roots);
    assert.deepEqual(generationTwo.plan.roots, roots);
    assert.equal(generationTwo.plan.snapshot.sourceGeneration, 1);
    assert.equal(generationTwo.plan.snapshot.sourceBankDigest, generationOne.digest);
    assert.match(generationTwo.digest, /^[0-9a-f]{64}$/);

    // A recording starts where its sound starts and plays without a live
    // envelope, so generation 2 is generation 1 again: same onset, same held
    // level, same release.
    const holdFrames = Math.round(holdSeconds * sampleRate);
    for (let index = 0; index < roots.length; index += 1) {
        const frameCount = Math.min(generationOne.bank.roots[index].frameCount, generationTwo.bank.roots[index].frameCount);
        const comparison = comparePeakNormalizedRms(
            rootFloat(generationOne.bank, index, 0, frameCount),
            rootFloat(generationTwo.bank, index, 0, frameCount),
            sampleRate,
        );
        assert.ok(comparison.passes,
            `root ${roots[index]} A/B: mean ${comparison.meanDeltaDb.toFixed(3)} dB, max ${comparison.maxDeltaDb.toFixed(3)} dB`);
        const sourceDrop = releaseDropDb(generationOne.bank, index, holdFrames);
        const recursiveDrop = releaseDropDb(generationTwo.bank, index, holdFrames);
        assert.ok(Math.abs(recursiveDrop - sourceDrop) < 0.1,
            `root ${roots[index]} release falls ${recursiveDrop.toFixed(2)} dB recursively against ${sourceDrop.toFixed(2)} dB in its source`);
    }

    const wasmPages = [generationOne, generationTwo].flatMap((result) => (
        result.metrics.map((entry) => entry.wasmMemoryPages)
    ));
    assert.equal(wasmPages.every(Number.isInteger), true);
    assert.equal(new Set(wasmPages).size, 1, "fresh recursive workers must use fixed wasm pages");
});
