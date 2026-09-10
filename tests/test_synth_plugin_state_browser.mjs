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

test("one-shot Voice edits across three fields share ordered Undo and Redo instead of separate control histories", async () => {
    const { page, close } = await open();
    try {
        await releaseBoot(page);
        for (const [button, key, value] of [["Tune five", "globalTune", 5], ["Play two", "playMode", 2], ["Glide half", "glideTime", 0.5]]) {
            await page.getByText(button, { exact: true }).click();
            assert.equal((await binding(page, key)).value, value);
        }
        assert.deepEqual(await page.evaluate(() => window.fixture.publications().flatMap(message => message.operations)), [
            { kind: "gesture-start", endpoint: "globalTune" }, { kind: "parameter", endpoint: "globalTune", value: 5 }, { kind: "gesture-end", endpoint: "globalTune" },
            { kind: "gesture-start", endpoint: "playMode" }, { kind: "parameter", endpoint: "playMode", value: 2 }, { kind: "gesture-end", endpoint: "playMode" },
            { kind: "gesture-start", endpoint: "glideTime" }, { kind: "parameter", endpoint: "glideTime", value: 0.5 }, { kind: "gesture-end", endpoint: "glideTime" },
        ]);
        for (const [key, value] of [["glideTime", 0.15], ["playMode", 1], ["globalTune", -7.5]]) {
            await page.getByText("Undo", { exact: true }).click();
            await page.waitForFunction(({ key, value }) => window.fixture.parameter(key) === value, { key, value });
            assert.equal((await binding(page, key)).value, value);
        }
        assert.equal(await page.getByText("Undo", { exact: true }).isEnabled(), false);
        for (const [key, value] of [["globalTune", 5], ["playMode", 2], ["glideTime", 0.5]]) {
            await page.getByText("Redo", { exact: true }).click();
            await page.waitForFunction(({ key, value }) => window.fixture.parameter(key) === value, { key, value });
            assert.equal((await binding(page, key)).value, value);
        }
        assert.equal(await page.getByText("Redo", { exact: true }).isEnabled(), false);
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
    } finally { await close(); }
});

test("Voice edit-bus notifications balance duplicate gesture boundaries and preserve synchronous programmatic suppression", async () => {
    const { page, close } = await open();
    try {
        await releaseBoot(page);
        await page.getByText("Begin tune", { exact: true }).click();
        await page.getByText("Begin tune", { exact: true }).click();
        await page.getByText("Drag seven", { exact: true }).click();
        await page.getByText("Drag seven", { exact: true }).click();
        await page.getByText("End tune", { exact: true }).click();
        await page.getByText("End tune", { exact: true }).click();
        const expected = [
            { kind: "begin" }, { kind: "edit", endpointID: "globalTune", changed: true },
            { kind: "edit", endpointID: "globalTune", changed: false }, { kind: "end" },
        ];
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), expected);
        assert.deepEqual(await page.evaluate(() => window.fixture.publications().flatMap(message => message.operations)), [
            { kind: "gesture-start", endpoint: "globalTune" },
            { kind: "parameter", endpoint: "globalTune", value: 7 },
            { kind: "gesture-end", endpoint: "globalTune" },
        ], "the repeated value does not create another canonical publication");
        await page.getByText("Programmatic glide", { exact: true }).click();
        await page.waitForFunction(() => window.fixture.parameter("glideTime") === 0.5);
        assert.equal((await binding(page, "glideTime")).value, 0.5);
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), expected, "accepted programmatic callbacks remain outside the direct user-edit bus");
        await page.getByText("Undo", { exact: true }).click();
        await page.waitForFunction(() => window.fixture.parameter("glideTime") === 0.15);
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), expected, "Undo does not masquerade as another direct edit");
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
    } finally { await close(); }
});

test("host automation during a Voice gesture has no echo or history, and the next user Undo restores that host value", async () => {
    const { page, close } = await open();
    try {
        await releaseBoot(page);
        await page.getByText("Begin tune", { exact: true }).click();
        await page.evaluate(() => window.fixture.automate("globalTune", 3));
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="globalTune"]').textContent).value === 3);
        assert.deepEqual((await binding(page, "globalTune")).hostBaseline, { _tag: "host-confirmed", value: -7.5 }, "the existing first-host readiness baseline remains stable");
        assert.deepEqual(await page.evaluate(() => window.fixture.publications().flatMap(message => message.operations)), [
            { kind: "gesture-start", endpoint: "globalTune" },
        ]);
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), [{ kind: "begin" }]);
        await page.getByText("End tune", { exact: true }).click();
        assert.deepEqual(JSON.parse(await page.getByTestId("history").textContent()), { canUndo: false, canRedo: false });
        await page.getByText("Tune five", { exact: true }).click();
        assert.equal((await binding(page, "globalTune")).value, 5);
        await page.getByText("Undo", { exact: true }).click();
        await page.waitForFunction(() => window.fixture.parameter("globalTune") === 3);
        assert.equal((await binding(page, "globalTune")).value, 3, "Undo uses current authoritative history, not the frozen readiness baseline");
        assert.equal(await page.getByText("Undo", { exact: true }).isEnabled(), false);
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
    } finally { await close(); }
});

test("unmounting the Voice provider seals its drag while the native view survives, before a fresh React mount restores shared Undo", async () => {
    const { page, close } = await open();
    try {
        await releaseBoot(page);
        await page.evaluate(() => window.fixture.openObserver());
        await page.getByText("Begin tune", { exact: true }).click();
        await page.getByText("Drag seven", { exact: true }).click();
        const before = await page.evaluate(() => window.fixture.observerState());
        assert.equal(before.kind, "ready");
        assert.equal(before.state.fields.globalTune.value, 7);
        assert.ok(before.state.fields.globalTune.gesture);
        assert.equal(before.state.history.canUndo, false);
        await page.evaluate(() => window.fixture.unmountView());
        await page.waitForFunction(() => window.fixture.observerState().state.history.canUndo);
        const after = await page.evaluate(() => window.fixture.observerState());
        assert.deepEqual(after.state.scope, before.state.scope);
        assert.equal(after.state.fields.globalTune.gesture, undefined);
        assert.equal(after.state.fields.globalTune.value, 7);
        assert.deepEqual(await page.evaluate(() => window.fixture.publications().flatMap(message => message.operations)), [
            { kind: "gesture-start", endpoint: "globalTune" },
            { kind: "parameter", endpoint: "globalTune", value: 7 },
            { kind: "gesture-end", endpoint: "globalTune" },
        ]);
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), [
            { kind: "begin" }, { kind: "edit", endpointID: "globalTune", changed: true }, { kind: "end" },
        ]);
        await page.evaluate(() => window.fixture.remountView());
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="globalTune"]')?.textContent ?? "null")?.isReady);
        assert.equal((await binding(page, "globalTune")).value, 7);
        assert.equal(await page.getByText("Undo", { exact: true }).isEnabled(), true);
        await page.getByText("Undo", { exact: true }).click();
        await page.waitForFunction(() => window.fixture.parameter("globalTune") === -7.5);
        assert.equal((await binding(page, "globalTune")).value, -7.5);
        assert.equal(await page.getByText("Undo", { exact: true }).isEnabled(), false);
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
    } finally { await close(); }
});

test("a Voice edit rejected by another client's lock rolls back its draft without reporting an accepted user change", async () => {
    const { page, close } = await open();
    try {
        await releaseBoot(page);
        const begin = await page.evaluate(async () => {
            window.fixture.openObserver();
            return window.fixture.observerCommand({ kind: "begin", key: "globalTune", gesture: 21 });
        });
        assert.equal(begin.kind, "accepted");
        await page.getByText("Drag seven", { exact: true }).click();
        await page.waitForFunction(() => window.fixture.messages().some(message => {
            const result = (message.kind === "receipt" ? message : message.receipt)?.result;
            return result?.kind === "rejected" && result.reason === "busy";
        }));
        assert.equal((await binding(page, "globalTune")).value, -7.5);
        assert.equal(await page.evaluate(() => window.fixture.parameter("globalTune")), -7.5);
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), [], "a rejected draft must not trigger auto-preview as an accepted parameter change");
        assert.deepEqual(await page.evaluate(() => window.fixture.publications().flatMap(message => message.operations)), [
            { kind: "gesture-start", endpoint: "globalTune" },
        ]);
        const end = await page.evaluate(() => window.fixture.observerCommand({ kind: "end", key: "globalTune", gesture: 21 }));
        assert.equal(end.kind, "accepted");
        await page.getByText("Drag five", { exact: true }).click();
        await page.waitForFunction(() => window.fixture.parameter("globalTune") === 5);
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), [{ kind: "edit", endpointID: "globalTune", changed: true }]);
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
    } finally { await close(); }
});

test("accepted edit receipts distinguish host-step no-ops from actual changes through the real client parser", async () => {
    const { page, close } = await open();
    try {
        await releaseBoot(page);
        const unchanged = await page.evaluate(async () => {
            window.fixture.openObserver();
            return window.fixture.observerCommand({ kind: "edit", key: "playMode", value: 1.4 });
        });
        assert.equal(unchanged.kind, "accepted");
        assert.equal(unchanged.changed, false, "native step1 rounds1.4 to the current1; requested inequality is not canonical change");
        assert.equal(unchanged.version, 0);
        assert.equal(await page.evaluate(() => window.fixture.parameter("playMode")), 1);
        assert.deepEqual(await page.evaluate(() => window.fixture.publications()), []);
        const changed = await page.evaluate(() => window.fixture.observerCommand({ kind: "edit", key: "playMode", value: 2 }));
        assert.equal(changed.kind, "accepted");
        assert.equal(changed.changed, true);
        assert.equal(changed.version, 1);
        await page.waitForFunction(() => window.fixture.parameter("playMode") === 2);
        assert.equal((await binding(page, "playMode")).value, 2);
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
    } finally { await close(); }
});

test("deferred accepted replies retain programmatic suppression and report a complete direct gesture in submission order", async () => {
    const { page, close } = await open();
    try {
        await releaseBoot(page);
        await page.evaluate(() => window.fixture.holdReplies());
        await page.getByText("Programmatic glide", { exact: true }).click();
        await page.waitForFunction(() => window.fixture.parameter("glideTime") === 0.5 && window.fixture.queuedReplies() > 0);
        assert.equal((await binding(page, "glideTime")).value, 0.5, "the actual client still presents its local draft before acceptance arrives");
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), []);
        await page.evaluate(() => window.fixture.releaseReplies());
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), [], "acceptance arrives after the synchronous programmatic block has ended");

        await page.evaluate(() => window.fixture.holdReplies());
        const beforeReplies = await page.evaluate(() => window.fixture.messages().length);
        await page.getByText("Complete tune", { exact: true }).click();
        await page.waitForFunction(() => window.fixture.parameter("globalTune") === 7 && window.fixture.queuedReplies() > 0);
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), [], "unacknowledged commands do not emit accepted-edit notifications");
        await page.evaluate(() => window.fixture.releaseReplies(true));
        await page.waitForFunction(() => window.fixture.edits().length === 3);
        const sequences = await page.evaluate(before => window.fixture.messages().slice(before)
            .map(message => (message.kind === "receipt" ? message : message.receipt)?.address.sequence)
            .filter(sequence => sequence !== undefined), beforeReplies);
        assert.deepEqual(sequences, [6, 5, 4], "actual service receipts are delivered end/edit/begin at the controlled external transport");
        assert.deepEqual(await page.evaluate(() => window.fixture.edits()), [
            { kind: "begin" }, { kind: "edit", endpointID: "globalTune", changed: true }, { kind: "end" },
        ]);
        assert.equal((await binding(page, "globalTune")).value, 7);
        assert.equal(await page.getByText("Undo", { exact: true }).isEnabled(), true);
        assert.deepEqual(await page.evaluate(() => window.fixture.defects()), []);
    } finally { await page.evaluate(() => window.fixture.releaseReplies()); await close(); }
});
