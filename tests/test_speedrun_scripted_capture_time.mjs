import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const captureTimeModule = loadUIModule(
    repoRoot,
    "ui/speedrun/scripted/capture-time.ts",
);

test("scripted capture time fires UI timeouts and animation frames only at media time", async () => {
    const { ScriptedCaptureTimeController } = await captureTimeModule;
    const controller = new ScriptedCaptureTimeController();
    const events = [];

    const cancelled = controller.setTimeout(() => events.push("cancelled"), 50);
    controller.clearTimeout(cancelled);
    controller.setTimeout(() => events.push("first"), 100);
    controller.setTimeout(() => events.push("second"), 100);
    controller.requestAnimationFrame((timestamp) => {
        events.push(`raf:${timestamp}`);
        controller.requestAnimationFrame((nextTimestamp) => events.push(`next-raf:${nextTimestamp}`));
    });

    controller.setMediaTime(2, 30);
    controller.flushDueTimeouts();
    controller.flushAnimationFrames();
    assert.deepEqual(events, [`raf:${2_000 / 30}`]);

    controller.setMediaTime(3, 30);
    controller.flushDueTimeouts();
    controller.flushAnimationFrames();
    assert.deepEqual(events, [
        `raf:${2_000 / 30}`,
        "first",
        "second",
        "next-raf:100",
    ]);
});
