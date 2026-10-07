import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import { captureBounceBank } from "../bounce/capture.mjs";
import { createBounceCaptureSnapshot } from "../bounce/capture-plan.mjs";
import { comparePeakNormalizedRms } from "./helpers/bounce_quality.mjs";
import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import { hostParameters, loadOfflineEngine, offlineEngineModuleURL } from "./helpers/bounce_offline_engine.mjs";

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

test("a recursive capture installs generation 1 in every fresh worker and reproduces its held sound", async () => {
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

    // The held sound must survive recursion. After note-off the live Amp
    // Release scales the baked release again, because the live envelope owns
    // Bounce loudness, so each generation's tail is quieter than its source's.
    const holdFrames = Math.round(holdSeconds * sampleRate);
    for (let index = 0; index < roots.length; index += 1) {
        const held = comparePeakNormalizedRms(
            rootFloat(generationOne.bank, index, 0, holdFrames),
            rootFloat(generationTwo.bank, index, 0, holdFrames),
            sampleRate,
        );
        assert.ok(held.passes,
            `root ${roots[index]} held A/B: mean ${held.meanDeltaDb.toFixed(3)} dB, max ${held.maxDeltaDb.toFixed(3)} dB`);
        const tailFrames = Math.min(
            generationOne.bank.roots[index].frameCount,
            generationTwo.bank.roots[index].frameCount,
        ) - holdFrames;
        const tailOne = stereoRms(rootFloat(generationOne.bank, index, holdFrames, tailFrames));
        const tailTwo = stereoRms(rootFloat(generationTwo.bank, index, holdFrames, tailFrames));
        assert.ok(tailTwo > 0 && tailTwo < tailOne,
            `root ${roots[index]} recursive tail RMS ${tailTwo} must sit below its source's ${tailOne}`);
    }

    const wasmPages = [generationOne, generationTwo].flatMap((result) => (
        result.metrics.map((entry) => entry.wasmMemoryPages)
    ));
    assert.equal(wasmPages.every(Number.isInteger), true);
    assert.equal(new Set(wasmPages).size, 1, "fresh recursive workers must use fixed wasm pages");
});
