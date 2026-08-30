// Offline DSP benchmark for the generated Cosimo engine. Renders the
// canonical scenario set (tests/tools/engine-render-scenarios.mjs) through
// the offline performer and reports wall-clock DSP cost as a percentage of
// realtime — the number that must sit comfortably under 100% (with headroom)
// on the slowest supported device.
//
//   node scripts/bench_engine_offline.mjs [--engine <path>] [--reps N] [--scenario name]
//
// The default engine is the current web build's offline module. Each
// scenario runs `reps` times on a fresh performer and reports the fastest
// rep (the steady-state JIT-warm cost; installs/setup are excluded).

import path from "node:path";
import process from "node:process";

import {
    createInstalledPerformer,
    loadOfflineEngineClass,
    peakAbsolute,
    renderScore,
    DRIVER_SAMPLE_RATE,
} from "../tests/tools/offline-engine-driver.mjs";
import { buildRenderScenarios } from "../tests/tools/engine-render-scenarios.mjs";

function argumentValue(flag, fallback) {
    const index = process.argv.indexOf(flag);
    return index >= 0 && process.argv[index + 1] !== undefined
        ? process.argv[index + 1]
        : fallback;
}

const enginePath = path.resolve(argumentValue(
    "--engine",
    path.join(import.meta.dirname, "..", "build", "web", "cmaj_Cosimo_Synth.offline.js"),
));
const reps = Math.max(1, Number(argumentValue("--reps", "3")));
const scenarioFilter = argumentValue("--scenario", null);

const EngineClass = await loadOfflineEngineClass(enginePath);
const scenarios = (await buildRenderScenarios())
    .filter((scenario) => scenarioFilter === null || scenario.name === scenarioFilter);
if (scenarios.length === 0) {
    throw new Error(`No scenario named ${scenarioFilter}`);
}

console.log(`engine: ${enginePath}`);
console.log(`sample rate ${DRIVER_SAMPLE_RATE}, reps ${reps}\n`);
console.log("scenario".padEnd(28) + "dsp-load".padStart(9) + "ms/render".padStart(11) + "peak".padStart(9));

for (const scenario of scenarios) {
    let bestMilliseconds = Infinity;
    let peak = 0;
    for (let rep = 0; rep < reps; rep += 1) {
        const performer = await createInstalledPerformer({ EngineClass, ...scenario.spec });
        const rendered = renderScore(performer, scenario.score, scenario.totalFrames);
        bestMilliseconds = Math.min(bestMilliseconds, rendered.elapsedMilliseconds);
        peak = Math.max(peak, peakAbsolute(rendered.samples));
    }
    if (scenario.expectSound && peak <= 1e-6) {
        throw new Error(`${scenario.name} rendered silence — the scenario install is broken.`);
    }
    const audioMilliseconds = (scenario.totalFrames / DRIVER_SAMPLE_RATE) * 1000;
    const load = (bestMilliseconds / audioMilliseconds) * 100;
    console.log(
        scenario.name.padEnd(28)
        + `${load.toFixed(1)}%`.padStart(9)
        + bestMilliseconds.toFixed(1).padStart(11)
        + peak.toFixed(3).padStart(9),
    );
}
