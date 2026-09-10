import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import path from "node:path";
import { chromium } from "playwright";
import { startStaticWebServer } from "./helpers/static_web_server.mjs";
import { stageCmajorWebRuntime } from "../ui/vite.shared.mjs";

const root = path.resolve(import.meta.dirname, "..");
let browser;
let server;
before(async () => {
    server = await startStaticWebServer(root, {
        bundleTypeScript: true,
        mounts: { "/cmaj_api": () => process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE
            ? path.join(process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE, "javascript/cmaj_api")
            : stageCmajorWebRuntime(root, { buildDirectory: path.join(root, "build/cmajor_web_runtime-synth-state-tests"), instanceId: String(process.pid) }) },
    });
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.stop(); });

async function open() {
    const page = await browser.newPage();
    page.setDefaultTimeout(5_000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html`);
    await page.evaluate(async () => {
        const { PluginStateChannel } = await import("/cmaj_api/cmaj-plugin-state-channel.js");
        const { mount } = await import("/tests/browser/fixtures/synth_plugin_state/view.tsx");
        window.fixture = await mount(document.getElementById("mount"), PluginStateChannel);
    });
    return { page, async close() {
        try { await page.evaluate(() => window.fixture.dispose()); }
        finally { await page.close(); }
        assert.deepEqual(errors, [], "no uncaught browser or React defects");
    } };
}

const binding = (page, key) => page.getByTestId(key).evaluate(element => JSON.parse(element.textContent));
async function releaseBoot(page) {
    await page.evaluate(() => window.fixture.releaseBoot());
    await page.waitForFunction(() => window.fixture.messages().some(message => message.kind === "attached"));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
}

test("the Cosimo Voice adapter waits for authoritative host values and uses native defaults for reset", async () => {
    const { page, close } = await open();
    try {
        const before = await binding(page, "globalTune");
        assert.equal(before.isReady, false);
        assert.deepEqual(before.hostBaseline, { _tag: "pending" });
        await page.getByText("Tune five", { exact: true }).click();
        assert.deepEqual(await page.evaluate(() => window.fixture.publications()), [], "unready controls must not publish fallback values");
        await releaseBoot(page);
        for (const [key, value] of Object.entries({ playMode: 1, glideTime: 0.15, globalTune: -7.5 })) {
            const state = await binding(page, key);
            assert.equal(state.value, value);
            assert.equal(state.isReady, true);
            assert.equal(state.initialValue, 0, "reset uses native metadata, not the fixture's disabled presentation fallback");
            assert.deepEqual(state.hostBaseline, { _tag: "host-confirmed", value });
        }
        assert.deepEqual(JSON.parse(await page.getByTestId("history").textContent()), { canUndo: false, canRedo: false });
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
    } finally { await close(); }
});

test("a Voice drag publishes one gesture bracket and two values, and shared Undo restores the host baseline once", async () => {
    const { page, close } = await open();
    try {
        await releaseBoot(page);
        assert.equal((await binding(page, "globalTune")).isReady, true, JSON.stringify(await page.evaluate(() => window.fixture.messages())));
        assert.equal((await binding(page, "globalTune")).value, -7.5);
        await page.getByText("Begin tune", { exact: true }).click();
        await page.getByText("Drag five", { exact: true }).click();
        assert.equal((await binding(page, "globalTune")).value, 5, "the actual adapter presents the edited value immediately");
        await page.getByText("Drag seven", { exact: true }).click();
        assert.equal((await binding(page, "globalTune")).value, 7);
        await page.getByText("End tune", { exact: true }).click();
        await page.getByText("End tune", { exact: true }).click();
        assert.deepEqual(await page.evaluate(() => window.fixture.publications().flatMap(message => message.operations)), [
            { kind: "gesture-start", endpoint: "globalTune" },
            { kind: "parameter", endpoint: "globalTune", value: 5 },
            { kind: "parameter", endpoint: "globalTune", value: 7 },
            { kind: "gesture-end", endpoint: "globalTune" },
        ]);
        await page.waitForFunction(() => window.fixture.parameter("globalTune") === 7);
        assert.equal(await page.getByText("Undo", { exact: true }).isEnabled(), true);
        await page.getByText("Undo", { exact: true }).click();
        await page.waitForFunction(() => window.fixture.parameter("globalTune") === -7.5);
        assert.equal((await binding(page, "globalTune")).value, -7.5);
        assert.equal(await page.getByText("Undo", { exact: true }).isEnabled(), false, "two live edits form exactly one history entry");
        assert.equal(await page.getByText("Redo", { exact: true }).isEnabled(), true);
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
    } finally { await close(); }
});
