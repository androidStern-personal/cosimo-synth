import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";
import { startStaticWebServer } from "./helpers/static_web_server.mjs";

let browser, server;
before(async () => {
    server = await startStaticWebServer(path.resolve(import.meta.dirname, "../.."), { bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.stop(); });

async function open(dependencies = []) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(new URL("kit/tests/helpers/module_test_shell.html", server.baseUrl).href);
    await page.evaluate(async dependencies => {
        const { mount } = await import("/kit/tests/helpers/plugin_state_public_react.tsx");
        window.fixture = await mount(document.getElementById("mount"), dependencies);
    }, dependencies);
    await page.getByTestId("public-control").waitFor();
    return { page, async close() {
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
        await page.evaluate(() => window.fixture.dispose());
        await page.close();
        assert.deepEqual(errors, []);
    } };
}
const control = page => page.evaluate(() => {
    const { state, error, retry } = window.fixture.current().control;
    return { state, error, canRetry: retry !== null };
});
const waitStatus = (page, status) => page.waitForFunction(status => window.fixture.current().control.state.status === status, status);

test("one status covers preparation and saving, and errors remain visible during concurrent work", async () => {
    const { page, close } = await open();
    try {
        assert.deepEqual(await control(page), { state: { status: "updating", value: 2 }, error: null, canRetry: false });
        await page.evaluate(() => window.fixture.current().control.setValue(4));
        await page.evaluate(() => window.fixture.status({ kind: "preparing" }));
        await page.evaluate(() => window.fixture.settleSaves({ kind: "failed", reason: "Disk is full" }));
        await page.waitForFunction(() => window.fixture.current().control.error !== null);
        assert.deepEqual(await control(page), { state: { status: "updating", value: 4 }, error: { message: "Disk is full" }, canRetry: true });
        await page.evaluate(() => window.fixture.status({ kind: "failed", error: { kind: "resource", message: "Source is unavailable" } }));
        await waitStatus(page, "idle");
        const before = await page.evaluate(() => window.fixture.accepted());
        assert.equal((await page.evaluate(() => window.fixture.current().control.retry())).kind, "accepted");
        await waitStatus(page, "updating");
        assert.deepEqual((await control(page)).error, { message: "Source is unavailable" });
        await page.evaluate(() => window.fixture.settleSaves());
        await waitStatus(page, "idle");
        assert.equal((await page.evaluate(() => window.fixture.current().control.retry())).kind, "accepted");
        await waitStatus(page, "updating");
        await page.evaluate(() => window.fixture.status({ kind: "acknowledged", engineSession: "private", operation: "private" }));
        await waitStatus(page, "idle");
        assert.deepEqual(await control(page), { state: { status: "idle", value: 4 }, error: null, canRetry: false });
        const after = await page.evaluate(() => window.fixture.accepted());
        assert.equal(after.fields.gain.version, before.fields.gain.version);
        assert.deepEqual(after.history, before.history, "retry changes neither values nor Undo entries");
        assert.equal((await page.evaluate(() => window.fixture.current().control.setValue(5))).kind, "accepted");
    } finally { await close(); }
});

test("new drafts hide an older value's failure; rejection restores the accepted value and its failure", async () => {
    const { page, close } = await open();
    try {
        await page.evaluate(() => window.fixture.status({ kind: "failed", error: { kind: "resource", message: "Old value failed" } }));
        await page.waitForFunction(() => window.fixture.current().control.error !== null);
        await page.evaluate(async () => {
            window.oldRetry = window.fixture.current().control.retry;
            await window.fixture.current().control.beginGesture();
            window.fixture.holdCommands();
            window.pendingEdit = window.fixture.current().control.setValue(6);
        });
        await page.waitForFunction(() => window.fixture.current().control.state.value === 6);
        assert.deepEqual(await control(page), { state: { status: "updating", value: 6 }, error: null, canRetry: false });
        assert.deepEqual(await page.evaluate(() => window.oldRetry()), { kind: "rejected", reason: "stale-version" }, "a retained retry cannot restart work for the superseded displayed value");
        // End the owning gesture via its ordinary command, then let a competing
        // edit invalidate the captured version before the delayed edit arrives.
        await page.evaluate(() => window.fixture.releaseCommands());
        assert.equal((await page.evaluate(() => window.pendingEdit)).kind, "accepted");
        await page.evaluate(() => window.fixture.current().control.endGesture());
        await page.evaluate(() => window.fixture.status({ kind: "failed", error: { kind: "resource", message: "Accepted value failed" } }));
        await page.waitForFunction(() => window.fixture.current().control.error !== null);
        await page.evaluate(async () => {
            window.fixture.holdCommands();
            window.pendingEdit = window.fixture.current().control.setValue(8);
            await window.fixture.competingEdit(7);
            await window.fixture.status({ kind: "failed", error: { kind: "resource", message: "Replacement failed" } });
        });
        await page.waitForFunction(() => window.fixture.current().control.state.value === 8);
        assert.equal((await control(page)).error, null);
        await page.evaluate(() => window.fixture.releaseCommands());
        assert.deepEqual(await page.evaluate(() => window.pendingEdit), { kind: "rejected", reason: "stale-version" });
        await page.waitForFunction(() => window.fixture.current().control.state.value === 7);
        assert.deepEqual((await control(page)).error, { message: "Replacement failed" });
        assert.equal((await control(page)).canRetry, true);
    } finally { await close(); }
});

test("a retry awaiting acceptance reports work without suppressing its current error", async () => {
    const { page, close } = await open();
    try {
        await page.evaluate(() => window.fixture.status({ kind: "failed", error: { kind: "resource", message: "Retry this value" } }));
        await waitStatus(page, "idle");
        await page.evaluate(() => {
            window.fixture.holdCommands();
            window.pendingRetry = window.fixture.current().control.retry();
        });
        await waitStatus(page, "updating");
        assert.deepEqual((await control(page)).error, { message: "Retry this value" });
        await page.evaluate(() => window.fixture.releaseCommands());
        assert.equal((await page.evaluate(() => window.pendingRetry)).kind, "accepted");
        await page.waitForFunction(() => window.fixture.current().control.error === null);
        assert.equal((await control(page)).state.status, "updating", "preparation continues after the retry is accepted");
    } finally { await close(); }
});

test("an accepted draft's current failure is visible even while its receipt is held", async () => {
    const { page, close } = await open();
    try {
        await page.evaluate(() => { window.fixture.holdReceipts(); window.pendingEdit = window.fixture.current().control.setValue(4); });
        await page.waitForFunction(() => window.fixture.accepted().fields.gain.value === 4);
        await page.evaluate(() => window.fixture.settleSaves({ kind: "failed", reason: "Current save failed" }));
        await page.waitForFunction(() => window.fixture.current().control.error !== null);
        assert.deepEqual(await control(page), { state: { status: "updating", value: 4 }, error: { message: "Current save failed" }, canRetry: true });
        await page.evaluate(() => window.fixture.releaseReceipts());
        assert.equal((await page.evaluate(() => window.pendingEdit)).kind, "accepted");
    } finally { await close(); }
});

test("unconfirmed completion stops progress, and an unavailable prerequisite does not spin forever", async () => {
    const ordinary = await open();
    try {
        await ordinary.page.evaluate(() => window.fixture.status({ kind: "unconfirmed" }));
        await waitStatus(ordinary.page, "idle");
        assert.deepEqual(await control(ordinary.page), { state: { status: "idle", value: 2 }, error: null, canRetry: false });
    } finally { await ordinary.close(); }
    const blocked = await open(["input"]);
    try {
        await waitStatus(blocked.page, "idle");
        const current = await control(blocked.page);
        assert.equal(current.state.value, 2);
        assert.match(current.error.message, /required.*unavailable/i);
        assert.equal(current.canRetry, false);
        assert.equal((await blocked.page.evaluate(() => window.fixture.current().control.setValue(4))).kind, "accepted", "a blocked engine dependency does not disable valid editing");
        await blocked.page.evaluate(() => window.fixture.settleSaves());
        await waitStatus(blocked.page, "idle");
    } finally { await blocked.close(); }
});
