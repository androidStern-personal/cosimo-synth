import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workerSource = await readFile(
    new URL("../ui/worker/wavetable-worker.ts", import.meta.url),
    "utf8",
);

test("production worker defers v4 articulation images until RT-01 upgrades the DSP endpoint", () => {
    assert.doesNotMatch(workerSource, /import\s+\{\s*createArticulationWorkerService\s*\}/);
    assert.doesNotMatch(workerSource, /\bcreateArticulationWorkerService\s*,/);
    assert.match(workerSource, /RT-01 will compose the v4 articulation service/);
    assert.match(workerSource, /\bcreateModulationWorkerService\s*,/);
    assert.match(workerSource, /\bcreateRackStateWorkerService\s*,/);
    assert.match(workerSource, /createWavetableWorkerController\(connection, options\)/);
});
