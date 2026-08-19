import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const CONFIG = {
    minRetriggerIntervalMs: 250,
    movementStoppedMs: 150,
    releaseNoteCapMs: 600,
};

async function makeScheduler() {
    const { createAutoPreviewScheduler } = await loadUIModule(repoRoot, "ui/shared/auto-preview-scheduler.ts");
    return createAutoPreviewScheduler(CONFIG);
}

test("the first actual change retriggers immediately and holds", async () => {
    const scheduler = await makeScheduler();

    assert.deepEqual(scheduler.parameterChanged(1000), [
        { kind: "retrigger", at: 1000, capMs: null },
    ]);
    // Nothing is pending: no deadline is armed for the rate window alone.
    assert.equal(scheduler.nextDeadline(), null);
    assert.deepEqual(scheduler.tick(2000), []);
});

test("changes inside the rate window coalesce into one retrigger when the window opens", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    assert.deepEqual(scheduler.parameterChanged(60), []);
    assert.deepEqual(scheduler.parameterChanged(120), []);
    assert.equal(scheduler.nextDeadline(), 250);

    assert.deepEqual(scheduler.tick(250), [
        { kind: "retrigger", at: 250, capMs: null },
    ]);
    assert.equal(scheduler.nextDeadline(), null);
});

test("continuous movement cannot exceed the rate cap", async () => {
    const scheduler = await makeScheduler();
    const commands = [];

    for (let now = 0; now <= 1000; now += 20) {
        commands.push(...scheduler.parameterChanged(now));
        const deadline = scheduler.nextDeadline();
        if (deadline !== null && deadline <= now) {
            commands.push(...scheduler.tick(now));
        }
    }
    const retriggers = commands.filter((command) => command.kind === "retrigger");

    // 0, 250, 500, 750, 1000 — four retriggers per second after the leading one.
    assert.deepEqual(retriggers.map((command) => command.at), [0, 250, 500, 750, 1000]);
});

test("the final changed value is always heard within 250ms of its change", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    scheduler.parameterChanged(240);
    const deadline = scheduler.nextDeadline();
    assert.equal(deadline, 250);

    const commands = scheduler.tick(deadline);
    assert.deepEqual(commands, [{ kind: "retrigger", at: 250, capMs: null }]);
    assert.ok(250 - 240 <= 250);
});

test("a change arriving with the window already open fires immediately", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    assert.deepEqual(scheduler.parameterChanged(400), [
        { kind: "retrigger", at: 400, capMs: null },
    ]);
});

test("holding still after the last retrigger emits nothing until movement resumes", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    scheduler.parameterChanged(100);
    scheduler.tick(250);

    // Long stillness: no deadlines, no commands.
    assert.equal(scheduler.nextDeadline(), null);
    assert.deepEqual(scheduler.tick(5000), []);

    // Movement resumes: the same bounded cadence restarts.
    assert.deepEqual(scheduler.parameterChanged(5100), [
        { kind: "retrigger", at: 5100, capMs: null },
    ]);
});

test("gesture end with nothing pending releases the preview", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    assert.deepEqual(scheduler.gestureEnded(80), [
        { kind: "endPreview", at: 80 },
    ]);
    assert.equal(scheduler.nextDeadline(), null);
});

test("gesture end with a pending value preserves one trailing capped retrigger", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    scheduler.parameterChanged(120);
    assert.deepEqual(scheduler.gestureEnded(150), []);

    // The trailing retrigger still fires when the window opens, as a
    // self-releasing capped note; no endPreview follows it.
    assert.equal(scheduler.nextDeadline(), 250);
    assert.deepEqual(scheduler.tick(250), [
        { kind: "retrigger", at: 250, capMs: 600 },
    ]);
    assert.equal(scheduler.nextDeadline(), null);
    assert.deepEqual(scheduler.tick(1000), []);
});

test("a retrigger that fires before the gesture ends keeps holding, then release ends it", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    scheduler.parameterChanged(120);
    scheduler.tick(250);
    assert.deepEqual(scheduler.gestureEnded(400), [
        { kind: "endPreview", at: 400 },
    ]);
});

test("cancellation stops the preview immediately and schedules no trailing note", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    scheduler.parameterChanged(120);
    assert.deepEqual(scheduler.cancelled(140), [
        { kind: "endPreview", at: 140 },
    ]);
    assert.equal(scheduler.nextDeadline(), null);
    assert.deepEqual(scheduler.tick(250), []);
    // The scheduler is reusable after cancellation.
    assert.deepEqual(scheduler.parameterChanged(1000), [
        { kind: "retrigger", at: 1000, capMs: null },
    ]);
});

test("cancellation after gesture end suppresses the preserved trailing note", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    scheduler.parameterChanged(120);
    scheduler.gestureEnded(150);
    assert.deepEqual(scheduler.cancelled(180), [
        { kind: "endPreview", at: 180 },
    ]);
    assert.deepEqual(scheduler.tick(250), []);
});

test("a fresh gesture after a completed one starts with a leading retrigger again", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    scheduler.gestureEnded(50);
    assert.deepEqual(scheduler.parameterChanged(2000), [
        { kind: "retrigger", at: 2000, capMs: null },
    ]);
});

test("a new gesture inside the previous preview's rate window defers its first retrigger", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    assert.deepEqual(scheduler.gestureEnded(50), [{ kind: "endPreview", at: 50 }]);

    // "The first actual change triggers immediately unless a prior preview is
    // still inside the rate-limit window" — this one is, so it must wait.
    assert.deepEqual(scheduler.parameterChanged(100), []);
    assert.equal(scheduler.nextDeadline(), 250);
    assert.deepEqual(scheduler.tick(250), [
        { kind: "retrigger", at: 250, capMs: null },
    ]);
});

test("a trailing capped note also arms the rate window for the next gesture", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    scheduler.parameterChanged(100);
    scheduler.gestureEnded(120);
    assert.deepEqual(scheduler.tick(250), [
        { kind: "retrigger", at: 250, capMs: 600 },
    ]);

    assert.deepEqual(scheduler.parameterChanged(300), []);
    assert.equal(scheduler.nextDeadline(), 500);
    assert.deepEqual(scheduler.tick(500), [
        { kind: "retrigger", at: 500, capMs: null },
    ]);
});

test("lifecycle events without an active preview emit nothing", async () => {
    const scheduler = await makeScheduler();

    assert.deepEqual(scheduler.gestureEnded(50), []);
    assert.deepEqual(scheduler.cancelled(60), []);

    // After a capped trailing note has self-released, a later cancel has
    // nothing to end either.
    scheduler.parameterChanged(1000);
    scheduler.parameterChanged(1100);
    scheduler.gestureEnded(1120);
    scheduler.tick(1250);
    assert.deepEqual(scheduler.cancelled(2000), []);
});

test("ticks before the armed deadline emit nothing and keep the deadline", async () => {
    const scheduler = await makeScheduler();

    scheduler.parameterChanged(0);
    scheduler.parameterChanged(60);
    assert.deepEqual(scheduler.tick(200), []);
    assert.equal(scheduler.nextDeadline(), 250);
});
