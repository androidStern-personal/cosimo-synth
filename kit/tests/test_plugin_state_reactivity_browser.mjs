import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { startStaticWebServer } from "./helpers/static_web_server.mjs";

let browser, server, fixture;
before(async () => {
    const root = path.resolve(import.meta.dirname, "../..");
    server = await startStaticWebServer(root);
    const bundled = await build({ bundle: true, write: false, format: "esm", platform: "browser", jsx: "automatic",
        define: { "process.env.NODE_ENV": '"test"' }, stdin: { resolveDir: root, loader: "tsx", contents: `
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { definePluginState, parameter } from "./kit/ui/plugin-state-definition";
import { createPluginStateClient } from "./kit/ui/plugin-state-client";
import { PluginStateProvider, usePluginState, usePluginHistory } from "./kit/ui/plugin-state-react";
const definition = definePluginState({ gain: parameter("gain"), other: parameter("other") });
const listeners = new Set(), sent = [], renders = { gain: 0, other: 0, history: 0 }, controls = {}, defects = [];
const client = createPluginStateClient(definition, { channel: {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    send(message) { sent.push(structuredClone(message)); },
}, onDefect(error) { defects.push(String(error)); } });
function Control({ name }) {
    const control = usePluginState(definition[name]);
    controls[name] = control; renders[name]++;
    return <output data-testid={name}>{JSON.stringify({ state: control.state, error: control.error, retry: !!control.retry })}</output>;
}
function History() { const history = usePluginHistory(); renders.history++; return <output data-testid="history">{JSON.stringify({ canUndo: history.canUndo, canRedo: history.canRedo })}</output>; }
const root = createRoot(document.getElementById("mount"));
flushSync(() => root.render(<PluginStateProvider definition={definition} client={client}><Control name="gain"/><Control name="other"/><History/></PluginStateProvider>));
window.fixture = {
    renders, controls, sent, defects,
    deliver(event) { flushSync(() => { for (const listener of listeners) listener(structuredClone(event)); }); },
    dispatch(command) { let result; flushSync(() => { result = client.dispatch(command); }); return result; },
    dispose() { root.unmount(); client.stop(); },
};
` } });
    fixture = bundled.outputFiles[0].text;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.stop(); });
const scope = { owner: "field-subscriptions", document: 0 };
const field = (value, version = 0) => ({ readiness: { kind: "ready" }, value, version,
    persistence: { kind: "host-managed" }, application: { kind: "unconfirmed" },
    metadata: { min: 0, max: 10, step: 1, defaultValue: 1 } });
const state = (gain, other, revision) => ({ scope, revision, fields: { gain, other }, history: { canUndo: false, canRedo: false } });
const deliver = (page, event) => page.evaluate(event => window.fixture.deliver(event), event);
const update = (page, snapshot, receipt) => deliver(page, { kind: "update", scope: snapshot.scope, revision: snapshot.revision, state: snapshot, ...(receipt ? { receipt } : {}) });
async function open() {
    const page = await browser.newPage();
    await page.route("**/reactivity-fixture.js", route => route.fulfill({ contentType: "text/javascript", body: fixture }));
    await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html`);
    await page.evaluate(() => import("/reactivity-fixture.js"));
    await deliver(page, { kind: "attached", request: 1, client: 1, scope, revision: 1, state: state(field(2), field(0), 1) });
    return page;
}

test("unrelated accepted changes do not render an untouched field, but ABA versions and metadata still refresh it", async () => {
    const page = await open();
    try {
        const before = await page.evaluate(() => ({ ...window.fixture.renders }));
        for (let revision = 2; revision <= 12; revision++) await update(page, state(field(2), field(revision % 10, revision), revision));
        const after = await page.evaluate(() => ({ ...window.fixture.renders }));
        assert.equal(after.gain, before.gain, "eleven unrelated updates must not render the gain consumer");
        assert.ok(after.other > before.other, "the edited field still renders");
        assert.equal(after.history, before.history, "unchanged history must not render its consumer or synth ancestor");
        await page.evaluate(() => { window.oldEdit = window.fixture.controls.gain.setValue; });
        await update(page, state(field(2, 2), field(2, 12), 13));
        assert.ok((await page.evaluate(() => window.fixture.renders.gain)) > after.gain, "equal values with a newer accepted version refresh edit closures");
        await page.evaluate(() => { void window.oldEdit(3); void window.fixture.controls.gain.setValue(4); });
        const commands = await page.evaluate(() => window.fixture.sent.filter(message => message.kind === "command"));
        assert.deepEqual(commands.map(message => message.command.expectedVersion), [0, 2], "captured and fresh closures retain distinct ABA guards");
        const changedMetadata = field(2, 2); changedMetadata.metadata.max = 20;
        await update(page, state(changedMetadata, field(2, 12), 14));
        assert.equal(await page.evaluate(() => window.fixture.controls.gain.state.metadata.max), 20);
        assert.deepEqual(await page.evaluate(() => window.fixture.defects), []);
    } finally { await page.evaluate(() => window.fixture.dispose()); await page.close(); }
});

test("field selection retains pending receipts, failure retry guards, and same-value document replacement", async () => {
    const page = await open();
    try {
        await page.evaluate(() => { void window.fixture.dispatch({ kind: "edit", key: "gain", value: 2, expectedVersion: 0 }); });
        assert.equal(await page.evaluate(() => window.fixture.controls.gain.state.pending), true);
        const command = await page.evaluate(() => window.fixture.sent.at(-1));
        await deliver(page, { kind: "receipt", address: { ...scope, client: 1, sequence: command.sequence }, result: { kind: "accepted", revision: 1, changed: false } });
        assert.equal(await page.evaluate(() => window.fixture.controls.gain.state.pending), false, "receipt-only settlement updates the consumer without a state revision");
        const failed = { ...field(2), persistence: { kind: "failed", reason: "write failed" }, persistenceRequest: 5 };
        await update(page, state(failed, field(0), 2));
        assert.deepEqual(await page.evaluate(() => window.fixture.controls.gain.error), { kind: "persistence", message: "write failed" });
        await page.evaluate(() => { window.oldRetry = window.fixture.controls.gain.retry; window.oldEdit = window.fixture.controls.gain.setValue; });
        await update(page, state({ ...failed, persistenceRequest: 6 }, field(0), 3));
        await page.evaluate(() => { void window.fixture.controls.gain.retry(); });
        assert.equal((await page.evaluate(() => window.fixture.sent.at(-1))).command.expectedPersistenceRequest, 6);
        const nextScope = { ...scope, document: 1 };
        await deliver(page, { kind: "reset", scope: nextScope });
        await deliver(page, { kind: "attached", request: 2, client: 2, scope: nextScope, revision: 4,
            state: { ...state(field(2), field(0), 4), scope: nextScope } });
        assert.deepEqual(await page.evaluate(() => window.oldEdit(3)), { kind: "rejected", reason: "stale-scope" });
        assert.deepEqual(await page.evaluate(() => window.oldRetry()), { kind: "rejected", reason: "stale-scope" });
        assert.equal(await page.evaluate(() => window.fixture.controls.gain.retry), null);
        assert.deepEqual(await page.evaluate(() => window.fixture.defects), []);
    } finally { await page.evaluate(() => window.fixture.dispose()); await page.close(); }
});
