import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = file => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const [workerSource, pluginStateSource, modulationDeliverySource] = await Promise.all([
    source("ui/worker/wavetable-worker.ts"),
    source("ui/shared/synth-plugin-state.ts"),
    source("ui/worker/synth-modulation-binding.ts"),
]);

test("production worker has one owner for ordered modulation then articulation restore", () => {
    // The worker runs exactly two services: wavetable preparation and the shared plugin state.
    assert.match(workerSource, new RegExp(String.raw`return startPatchWorkerServices\(connection, \[\s*`
        + String.raw`\(\) => createWavetableWorkerController\(connection, \{ \.\.\.options, delivery: "shared" \}\),\s*`
        + String.raw`\(\) => createCmajorPluginStateService\(synthPluginState, connection, \{\s*onDefect: [^\n]+\s*\}\),\s*\]\);`));
    for (const retiredService of [
        "createModulationArticulationWorkerService",
        "createModulationWorkerService",
        "createArticulationWorkerService",
        "createRackStateWorkerService",
    ]) {
        assert.doesNotMatch(workerSource, new RegExp(String.raw`\b${retiredService}\b`));
    }

    // The plugin state restores the rack and modulation through their declared deliveries.
    assert.match(pluginStateSource, /\[MODULATION_STATE_KEY\]: preparedState\(\{[^\n]*engine: synthModulationDelivery \}\)/);
    assert.match(pluginStateSource, /\[LANE_STATE_KEY\]: preparedState\(\{[\s\S]*?engine: synthRackDelivery,\s*\}\)/);

    // Modulation delivery reads the articulation bank and hands both lanes to one
    // coordinator, which publishes articulation only after modulation is acknowledged.
    assert.match(modulationDeliverySource, /storedKeys: \[ARTICULATIONS_V4_STATE_KEY\]/);
    assert.equal(modulationDeliverySource.match(/new ModulationArticulationWorkerService\(connection, \{/g)?.length, 1);
});
