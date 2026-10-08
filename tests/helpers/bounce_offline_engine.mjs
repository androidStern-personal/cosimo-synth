import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** The synth's offline engine, built by `npm run web:build`. */
export const offlineEngineModuleURL = pathToFileURL(
    path.join(repoRoot, "build/web/cmaj_Cosimo_Synth.offline.js"),
).href;

/**
 * Every voice reaches the synth's output through the fixed Polish bus, which
 * delays it by this many frames. The DSP declares the value as the patch's
 * latency and pins it with a static assertion, which this reads.
 */
export const outputLatencyFrames = Number(/static_assert \(polishLatencyFrames == (\d+),/.exec(
    await readFile(path.join(repoRoot, "cmajor/Polish.cmajor"), "utf8"),
)?.[1]);
assert.ok(Number.isInteger(outputLatencyFrames), "cmajor/Polish.cmajor must pin polishLatencyFrames");

export async function loadOfflineEngine() {
    return (await import(offlineEngineModuleURL)).default;
}

/**
 * Every host parameter at the value a Cmajor host sets when it loads the
 * patch, its init annotation, with the overrides applied. A generated
 * performer starts every value at zero, so a performer or capture snapshot
 * without these values is not the synth a host plays.
 */
export function hostParameters(CmajorClass, overrides = {}) {
    const values = Object.fromEntries(CmajorClass.prototype.getInputEndpoints()
        .filter(({ purpose }) => purpose === "parameter")
        .map(({ endpointID, annotation }) => [endpointID, annotation.init ?? annotation.min]));
    for (const [endpointID, value] of Object.entries(overrides)) {
        assert.ok(Object.hasOwn(values, endpointID), `Unknown host parameter ${endpointID}`);
        values[endpointID] = value;
    }
    return values;
}

/**
 * A fresh offline performer loaded the way a host loads the synth. It is
 * disposed when the test ends, releasing its shared engine memory.
 */
export async function createHostedPerformer(t, CmajorClass, sessionID, sampleRate, overrides = {}) {
    const runtime = await CmajorClass.createOfflinePerformer(sessionID, sampleRate);
    t.after(() => runtime.dispose());
    for (const [endpointID, value] of Object.entries(hostParameters(CmajorClass, overrides))) {
        runtime.performer[`setInputValue_${endpointID}`](value, 0);
    }
    return runtime;
}
