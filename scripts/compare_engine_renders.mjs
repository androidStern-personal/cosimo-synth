// Bit-identity comparison between two generated offline engine modules.
// Renders every canonical scenario (tests/tools/engine-render-scenarios.mjs)
// through both engines with identical deterministic installs and scores, and
// requires EXACT Float32 equality (Object.is per sample) on the full stereo
// output. This is the acceptance gate for engine performance work: an
// optimization that changes even one sample fails here.
//
//   node scripts/compare_engine_renders.mjs <engineA.js> <engineB.js>
//
// Pass the same path twice to self-check determinism of a single build.

import path from "node:path";
import process from "node:process";

import {
    createInstalledPerformer,
    firstSampleDifference,
    loadOfflineEngineClass,
    peakAbsolute,
    renderScore,
} from "../tests/tools/offline-engine-driver.mjs";
import { buildRenderScenarios } from "../tests/tools/engine-render-scenarios.mjs";

const [engineAPath, engineBPath] = process.argv.slice(2);
if (!engineAPath || !engineBPath) {
    console.error("usage: node scripts/compare_engine_renders.mjs <engineA.js> <engineB.js>");
    process.exit(2);
}

const [EngineA, EngineB] = await Promise.all([
    loadOfflineEngineClass(path.resolve(engineAPath)),
    loadOfflineEngineClass(path.resolve(engineBPath)),
]);

const scenarios = await buildRenderScenarios();
let failed = false;

for (const scenario of scenarios) {
    const performerA = await createInstalledPerformer({ EngineClass: EngineA, ...scenario.spec });
    const renderedA = renderScore(performerA, scenario.score, scenario.totalFrames);
    const performerB = await createInstalledPerformer({ EngineClass: EngineB, ...scenario.spec });
    const renderedB = renderScore(performerB, scenario.score, scenario.totalFrames);

    const difference = firstSampleDifference(renderedA.samples, renderedB.samples);
    const peak = peakAbsolute(renderedA.samples);
    if (scenario.expectSound && peak <= 1e-6) {
        console.error(`✗ ${scenario.name}: rendered silence — scenario install is broken.`);
        failed = true;
        continue;
    }
    if (difference === null) {
        console.log(`✓ ${scenario.name}: bit-identical (${renderedA.samples.length} samples, peak ${peak.toFixed(3)})`);
    } else {
        failed = true;
        console.error(`✗ ${scenario.name}: first difference at frame ${difference.frame}`
            + ` (${difference.channel}): ${difference.left} vs ${difference.right}`
            + (difference.reason ? ` [${difference.reason}]` : ""));
    }
}

process.exit(failed ? 1 : 0);
