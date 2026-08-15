import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workerSource = await readFile(
    new URL("../ui/worker/wavetable-worker.ts", import.meta.url),
    "utf8",
);

test("production worker has one owner for ordered modulation then articulation restore", () => {
    assert.match(workerSource, /\bcreateModulationArticulationWorkerService\s*,/);
    assert.doesNotMatch(workerSource, /\bcreateModulationWorkerService\s*,/);
    assert.doesNotMatch(workerSource, /\bcreateArticulationWorkerService\s*,/);
    assert.match(workerSource, /\bcreateRackStateWorkerService\s*,/);
    assert.match(workerSource, /createWavetableWorkerController\(connection, options\)/);
});
