import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";
import { startStaticWebServer } from "./helpers/static_web_server.mjs";

let browser;
let server;
const browserErrors = new WeakMap();
before(async () => {
    server = await startStaticWebServer(path.resolve(import.meta.dirname, "../.."), { bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.stop(); });
const scope = { owner: "host-instance", document: 0 };
const snapshot = (value, revision, version, history = { canUndo: false, canRedo: false }) => ({
    scope, revision, history,
    fields: { gain: { readiness: { kind: "ready" }, value, version,
        persistence: { kind: "host-managed" }, application: { kind: "unconfirmed" },
        metadata: { min: 0, max: 10, step: 1, defaultValue: 1 } } },
});
async function open() {
    const page = await browser.newPage();
    const errors = [];
    browserErrors.set(page, errors);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html`);
    await page.evaluate(async () => {
        window.harness = await import("/kit/tests/helpers/plugin_state_react.tsx");
        window.unmount = window.harness.mount(document.getElementById("mount"));
    });
    return page;
}
const deliver = (page, event) => page.evaluate(event => window.harness.deliver(event), event);
const messages = page => page.evaluate(() => window.harness.messages());
async function close(page) {
    await page.close();
    assert.deepEqual(browserErrors.get(page), [], "no uncaught browser or React errors");
}

test("public hook results hide transport identities while opaque history references retain guarded eligibility", async () => {
    const page = await browser.newPage();
    const errors = [];
    browserErrors.set(page, errors);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html`);
    await page.evaluate(async () => {
        const { mount } = await import("/kit/tests/helpers/plugin_state_public_react.tsx");
        window.publicState = await mount(document.getElementById("mount"));
    });
    const state = () => page.getByTestId("public-control").evaluate(element => JSON.parse(element.textContent));
    try {
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="public-control"]').textContent).kind === "ready");
        await page.evaluate(() => window.publicState.status({ kind: "acknowledged", engineSession: "private-engine", operation: "private-operation" }));
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="public-control"]').textContent).application?.kind === "acknowledged");
        assert.deepEqual((await state()).application, { kind: "acknowledged" });
        for (const application of [{ kind: "sent", proof: "native-publication-processed" }, { kind: "unconfirmed" }]) {
            await page.evaluate(application => window.publicState.status(application), application);
            await page.waitForFunction(kind => JSON.parse(document.querySelector('[data-testid="public-control"]').textContent).application?.kind === kind, application.kind);
            assert.deepEqual((await state()).application, application);
        }
        const edited = await page.evaluate(async () => {
            const result = await window.publicState.current().control.setValue(4);
            window.rememberedHistory = result.historyEntry;
            return { result, tokenKeys: Reflect.ownKeys(result.historyEntry).map(String), frozen: Object.isFrozen(result.historyEntry) };
        });
        assert.deepEqual(edited.result, { kind: "accepted", changed: true, historyEntry: {} });
        assert.deepEqual(edited.tokenKeys, []);
        assert.equal(edited.frozen, true);
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="public-control"]').textContent).value === 4);
        assert.equal(await page.evaluate(() => window.publicState.current().history.canUndo), true);
        assert.deepEqual(await page.evaluate(() => window.publicState.current().history.undo(window.rememberedHistory)), { kind: "accepted" });
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="public-control"]').textContent).value === 2);
        assert.equal(await page.evaluate(() => window.publicState.current().history.canRedo), true);
        assert.deepEqual(await page.evaluate(() => window.publicState.current().history.redo(window.rememberedHistory)), { kind: "accepted" });
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="public-control"]').textContent).value === 4);
        await page.evaluate(() => window.publicState.current().control.setValue(7));
        assert.deepEqual(await page.evaluate(() => window.publicState.current().history.undo(window.rememberedHistory)), { kind: "rejected", reason: "stale-history" });
        assert.deepEqual(await page.evaluate(() => window.publicState.current().history.undo({})), { kind: "rejected", reason: "stale-history" });
        assert.deepEqual(await page.evaluate(() => window.publicState.defects()), []);
    } finally { await page.evaluate(() => window.publicState.dispose()); await close(page); }
});

test("opaque entry eligibility follows the actual shared history head, gestures and document reset", async () => {
    const page = await browser.newPage();
    const errors = [];
    browserErrors.set(page, errors);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html`);
    await page.evaluate(async () => {
        const { mount } = await import("/kit/tests/helpers/plugin_state_public_react.tsx");
        window.publicState = await mount(document.getElementById("mount"));
    });
    const waitValue = value => page.waitForFunction(value => JSON.parse(document.querySelector('[data-testid="public-control"]').textContent).value === value, value);
    const canUndo = () => page.evaluate(() => window.publicState.current().history.canUndoEntry?.(window.rememberedHistory));
    try {
        await waitValue(2);
        await page.evaluate(async () => { window.rememberedHistory = (await window.publicState.current().control.setValue(4)).historyEntry; });
        await waitValue(4);
        assert.equal(await page.evaluate(() => window.publicState.current().history.canUndo), true);
        assert.equal(await canUndo(), true, "a retained opaque reference to the real head must enable the editor button");
        await page.evaluate(async () => {
            const { mount } = await import("/kit/tests/helpers/plugin_state_public_react.tsx");
            const element = document.createElement("div");
            document.body.append(element);
            window.foreignState = await mount(element);
        });
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="public-control"]').length === 2);
        const foreignEligible = await page.evaluate(async () => {
            const foreign = (await window.foreignState.current().control.setValue(4)).historyEntry;
            return {
                own: window.foreignState.current().history.canUndoEntry(foreign),
                foreign: window.publicState.current().history.canUndoEntry(foreign),
            };
        });
        assert.deepEqual(foreignEligible, { own: true, foreign: false }, "a genuine token from another binding cannot be borrowed even with matching native entry numbers");
        await page.evaluate(() => window.publicState.current().control.setValue(7));
        await waitValue(7);
        assert.equal(await canUndo(), false, "a later edit blocks the remembered editor entry");
        await page.evaluate(() => window.publicState.current().history.undo());
        await waitValue(4);
        assert.equal(await canUndo(), true, "global Undo exposes the remembered entry again");
        await page.evaluate(() => window.publicState.current().control.beginGesture());
        assert.equal(await canUndo(), false);
        await page.evaluate(() => window.publicState.current().control.endGesture());
        assert.equal(await canUndo(), true);
        assert.deepEqual(await page.evaluate(() => window.publicState.current().history.undo(window.rememberedHistory)), { kind: "accepted" });
        await waitValue(2);
        assert.equal(await canUndo(), false);
        assert.equal(await page.evaluate(() => window.publicState.current().history.canRedoEntry(window.rememberedHistory)), true);
        assert.equal(await page.evaluate(() => window.publicState.current().history.canUndoEntry({})), false);
        assert.equal(await page.evaluate(() => window.publicState.current().history.canRedoEntry({})), false);
        await page.evaluate(() => window.publicState.reset());
        await waitValue(9);
        assert.equal(await canUndo(), false);
        assert.equal(await page.evaluate(() => window.publicState.current().history.canRedoEntry(window.rememberedHistory)), false);
        assert.deepEqual(await page.evaluate(() => window.publicState.current().history.redo(window.rememberedHistory)), { kind: "rejected", reason: "stale-history" });
        assert.deepEqual(await page.evaluate(() => window.publicState.defects()), []);
    } finally { await page.evaluate(async () => { await window.foreignState?.dispose(); await window.publicState.dispose(); }); await close(page); }
});

test("public React setValue recovers invalid stored input and reset settles a held recovery without replay", async () => {
    const page = await browser.newPage();
    const errors = [];
    browserErrors.set(page, errors);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html`);
    await page.evaluate(async () => {
        const { mount } = await import("/kit/tests/helpers/plugin_state_recovery_react.tsx");
        window.recovery = await mount(document.getElementById("mount"));
    });
    const control = () => page.getByTestId("recovery-state").evaluate(element => JSON.parse(element.textContent));
    try {
        assert.deepEqual(await control(), { kind: "failed", reason: "invalid-state" });
        assert.deepEqual(await page.evaluate(() => window.recovery.publications()), []);
        await page.getByText("Recover curve", { exact: true }).click();
        assert.deepEqual((await page.evaluate(() => window.recovery.held())).map(message => message.command), [
            { kind: "recover", key: "curve", value: [0, 0.4, 1], expectedVersion: 0 },
        ]);
        assert.deepEqual(await control(), { kind: "failed", reason: "invalid-state" }, "a draft does not claim valid accepted state");
        assert.deepEqual(await page.evaluate(() => window.recovery.clientSnapshot().state.fields.curve.value), [0, 0.4, 1]);
        assert.equal(await page.evaluate(() => Object.hasOwn(window.recovery.snapshot().fields.curve, "value")), false);
        await page.evaluate(() => window.recovery.release());
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="recovery-state"]').textContent).kind === "ready");
        assert.deepEqual((await control()).value, [0, 0.4, 1]);
        assert.deepEqual(JSON.parse(await page.getByTestId("recovery-history").textContent()), { canUndo: false, canRedo: false });
        const result = JSON.parse(await page.getByTestId("recovery-result").textContent());
        assert.equal(result.kind, "accepted");
        assert.equal(result.changed, true);
        assert.equal(result.historyEntry, undefined);
        await page.getByText("Edit curve", { exact: true }).click();
        assert.equal((await page.evaluate(() => window.recovery.held()))[0].command.kind, "edit");
        await page.evaluate(() => window.recovery.release());
        await page.getByText("Undo curve", { exact: true }).click();
        await page.evaluate(() => window.recovery.release());
        assert.deepEqual((await control()).value, [0, 0.4, 1], "ordinary edits after baseline creation participate in shared history");

        await page.evaluate(() => window.recovery.resetInvalid());
        await page.getByText("Recover curve", { exact: true }).click();
        assert.equal((await page.evaluate(() => window.recovery.held())).length, 1);
        const before = await page.evaluate(() => window.recovery.publications().length);
        await page.evaluate(() => window.recovery.resetInvalid());
        const interrupted = JSON.parse(await page.getByTestId("recovery-result").textContent());
        assert.deepEqual(interrupted, { kind: "interrupted", reason: "reset", acceptance: "unknown" });
        assert.equal(await page.evaluate(() => Object.hasOwn(window.recovery.clientSnapshot().state.fields.curve, "value")), false);
        assert.deepEqual(await page.evaluate(() => window.recovery.clientSnapshot().pendingFields), []);
        await page.evaluate(() => window.recovery.release());
        assert.equal(await page.evaluate(() => window.recovery.publications().length), before);
        assert.equal(await page.evaluate(() => Object.hasOwn(window.recovery.snapshot().fields.curve, "value")), false);
        assert.deepEqual(await page.evaluate(() => window.recovery.held()), []);
        assert.deepEqual(await page.evaluate(() => window.recovery.defects()), []);
    } finally { await page.evaluate(() => window.recovery.dispose()); await close(page); }
});

test("public React guarded Undo and Redo preserve a competing client's newer entry", async () => {
    const page = await browser.newPage();
    const errors = [];
    browserErrors.set(page, errors);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html`);
    await page.evaluate(async () => {
        const { mount } = await import("/kit/tests/helpers/plugin_state_history_react.tsx");
        window.guardedHistory = await mount(document.getElementById("mount"));
    });
    const gain = () => page.getByTestId("guarded-gain").evaluate(element => JSON.parse(element.textContent).value);
    try {
        await page.getByText("Edit four", { exact: true }).click();
        assert.equal(await gain(), 4);
        await page.getByText("Remember Undo", { exact: true }).click();
        const newer = await page.evaluate(() => window.guardedHistory.otherEdit(7));
        assert.equal(newer.kind, "accepted");
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="guarded-gain"]').textContent).value === 7);
        const publications = await page.evaluate(() => window.guardedHistory.publicationCount());
        await page.getByText("Guarded Undo", { exact: true }).click();
        assert.deepEqual(JSON.parse(await page.getByTestId("guarded-result").textContent()), { kind: "rejected", reason: "stale-history" });
        assert.equal(await gain(), 7);
        assert.equal(await page.evaluate(() => window.guardedHistory.snapshot().fields.gain.value), 7);
        assert.equal(await page.evaluate(() => window.guardedHistory.publicationCount()), publications);
        await page.getByText("Remember Undo", { exact: true }).click();
        await page.getByText("Guarded Undo", { exact: true }).click();
        assert.equal(await gain(), 4);
        await page.getByText("Remember Redo", { exact: true }).click();
        await page.getByText("Guarded Redo", { exact: true }).click();
        assert.equal(await gain(), 7);
        assert.deepEqual(await page.evaluate(() => window.guardedHistory.snapshot().history.undoEntry), newer.historyEntry);
        assert.deepEqual(await page.evaluate(() => window.guardedHistory.defects()), []);
    } finally { await page.evaluate(() => window.guardedHistory.dispose()); await close(page); }
});

test("React reads the real client's Jotai projection: host hydration, immediate drafts, and late receipts preserve newer input", async () => {
    const page = await open();
    try {
        assert.deepEqual(JSON.parse(await page.getByTestId("gain").textContent()), { kind: "connecting" });
        await deliver(page, { kind: "attached", request: 1, scope, client: 2, revision: 0, state: snapshot(2, 0, 0) });
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="gain"]').textContent).value === 2);
        await page.getByText("Set four", { exact: true }).click();
        await page.getByText("Set seven", { exact: true }).click();
        let state = JSON.parse(await page.getByTestId("gain").textContent());
        assert.equal(state.value, 7);
        assert.equal(state.pending, true);
        assert.deepEqual((await messages(page)).sent.slice(1).map(message => message.command), [
            { kind: "edit", key: "gain", value: 4 }, { kind: "edit", key: "gain", value: 7 },
        ]);
        await deliver(page, { kind: "update", scope, revision: 1, state: snapshot(4, 1, 1),
            receipt: { address: { ...scope, client: 2, sequence: 1 }, result: { kind: "accepted", revision: 1, version: 1 } } });
        state = JSON.parse(await page.getByTestId("gain").textContent());
        assert.equal(state.value, 7, "the rendered control must not jump back to an older reply");
        assert.equal(state.pending, true);
        await deliver(page, { kind: "update", scope, revision: 2, state: snapshot(7, 2, 2, { canUndo: true, canRedo: false }),
            receipt: { address: { ...scope, client: 2, sequence: 2 }, result: { kind: "accepted", revision: 2, version: 2 } } });
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="gain"]').textContent).pending === false);
        assert.equal(await page.getByText("Undo", { exact: true }).isEnabled(), true);
        await page.getByText("Undo", { exact: true }).click();
        assert.deepEqual((await messages(page)).sent.at(-1).command, { kind: "undo" });
        assert.deepEqual((await messages(page)).defects, []);
    } finally { await close(page); }
});

test("removing a control ends its own drag once, while document replacement discards the old drag without sending it into the new document", async () => {
    const page = await open();
    try {
        await deliver(page, { kind: "attached", request: 1, scope, client: 2, revision: 0, state: snapshot(2, 0, 0) });
        await page.getByText("Begin", { exact: true }).click();
        await page.getByText("Set four", { exact: true }).click();
        await page.getByText("Set seven", { exact: true }).click();
        await page.getByText("Toggle control", { exact: true }).click();
        let commands = (await messages(page)).sent.filter(message => message.kind === "command");
        assert.deepEqual(commands.map(message => message.command), [
            { kind: "begin", key: "gain", gesture: 1 },
            { kind: "edit", key: "gain", value: 4, gesture: 1 },
            { kind: "edit", key: "gain", value: 7, gesture: 1 },
            { kind: "end", key: "gain", gesture: 1 },
        ]);
        await page.getByText("Toggle control", { exact: true }).click();
        await page.getByText("Begin", { exact: true }).click();
        const nextScope = { ...scope, document: 1 };
        await deliver(page, { kind: "reset", scope: nextScope });
        await deliver(page, { kind: "attached", request: 2, scope: nextScope, client: 2, revision: 0,
            state: { ...snapshot(3, 0, 0), scope: nextScope } });
        await page.getByText("End", { exact: true }).click();
        commands = (await messages(page)).sent.filter(message => message.kind === "command");
        assert.equal(commands.length, 5, "end from the old document is discarded");
        await page.getByText("Begin", { exact: true }).click();
        await page.getByText("Set four", { exact: true }).click();
        await page.evaluate(() => window.unmount());
        commands = (await messages(page)).sent.filter(message => message.kind === "command");
        assert.deepEqual(commands.slice(-3), [
            { kind: "command", scope: nextScope, client: 2, sequence: 1, command: { kind: "begin", key: "gain", gesture: 3 } },
            { kind: "command", scope: nextScope, client: 2, sequence: 2, command: { kind: "edit", key: "gain", value: 4, gesture: 3 } },
            { kind: "command", scope: nextScope, client: 2, sequence: 3, command: { kind: "end", key: "gain", gesture: 3 } },
        ]);
        assert.deepEqual((await messages(page)).defects, []);
    } finally { await close(page); }
});

test("a rejected drag does not send an end on unmount, and a failed field never displays its retained value as editable", async () => {
    const page = await open();
    try {
        await deliver(page, { kind: "attached", request: 1, scope, client: 2, revision: 0, state: snapshot(2, 0, 0) });
        await page.getByText("Begin", { exact: true }).click();
        await deliver(page, { kind: "receipt", address: { ...scope, client: 2, sequence: 1 }, result: { kind: "rejected", reason: "busy" } });
        await page.getByText("Toggle control", { exact: true }).click();
        assert.equal((await messages(page)).sent.filter(message => message.kind === "command").length, 1);
        await page.getByText("Toggle control", { exact: true }).click();
        const failed = snapshot(2, 1, 0);
        failed.fields.gain.readiness = { kind: "failed", reason: "service-closed" };
        await deliver(page, { kind: "update", scope, revision: 1, state: failed });
        assert.deepEqual(JSON.parse(await page.getByTestId("gain").textContent()), { kind: "failed", reason: "service-closed" });
        await page.getByText("Set seven", { exact: true }).click();
        assert.equal((await messages(page)).sent.filter(message => message.kind === "command").length, 1);
        assert.deepEqual((await messages(page)).defects, []);
    } finally { await close(page); }
});

test("the public view factory owns mounting, drag cleanup, fresh attachment on reconnect and current factory options", async () => {
    const page = await open();
    try {
        await page.evaluate(async () => {
            window.unmount();
            window.viewHarness = await import("/kit/tests/helpers/plugin_state_view.tsx");
            window.viewHarness.create();
        });
        const viewMessages = () => page.evaluate(() => window.viewHarness.messages());
        const viewDeliver = body => page.evaluate(body => window.viewHarness.deliver(body), body);
        assert.deepEqual(await viewMessages(), { sent: [], listeners: 0, trace: [] }, "a detached element owns no client");
        await page.evaluate(() => window.viewHarness.append());
        assert.deepEqual((await viewMessages()).sent, [{ type: "kit_state", message: { kind: "attach", request: 1 } }]);
        await viewDeliver({ kind: "attached", request: 1, scope, client: 2, revision: 0, state: snapshot(2, 0, 0) });
        assert.equal(JSON.parse(await page.getByTestId("wrapped").textContent()).correctConnection, true);
        assert.equal(await page.getByText("Wrapped four", { exact: true }).evaluate(element => getComputedStyle(element).color), "rgb(12, 34, 56)");
        await page.getByText("Wrapped begin", { exact: true }).click();
        await page.getByText("Wrapped four", { exact: true }).click();
        await page.evaluate(() => window.viewHarness.remove());
        let traffic = await viewMessages();
        assert.equal(traffic.listeners, 0);
        assert.deepEqual(traffic.trace, ["subscribe", "send:attach", "send:begin", "send:edit", "send:end", "send:detach", "unsubscribe"]);
        assert.deepEqual(traffic.sent.slice(1, -1).map(message => message.message.command), [
            { kind: "begin", key: "gain", gesture: 1 },
            { kind: "edit", key: "gain", value: 4, gesture: 1 },
            { kind: "end", key: "gain", gesture: 1 },
        ]);
        assert.deepEqual(traffic.sent.at(-1).message, { kind: "detach", scope, client: 2 });
        await page.evaluate(() => window.viewHarness.append());
        assert.deepEqual((await viewMessages()).sent.at(-1).message, { kind: "attach", request: 2 });
        await viewDeliver({ kind: "attached", request: 1, scope, client: 2, revision: 0, state: snapshot(2, 0, 0) });
        assert.equal(JSON.parse(await page.getByTestId("wrapped").textContent()).kind, "connecting");
        await viewDeliver({ kind: "attached", request: 2, scope, client: 3, revision: 4, state: snapshot(5, 4, 1) });
        assert.equal(JSON.parse(await page.getByTestId("wrapped").textContent()).value, 5);
        await page.getByText("Wrapped seven", { exact: true }).click();
        assert.deepEqual((await viewMessages()).sent.at(-1).message, {
            kind: "command", scope, client: 3, sequence: 1, command: { kind: "edit", key: "gain", value: 7 },
        });
        await page.evaluate(() => { window.viewHarness.remove(); window.viewHarness.createSecond(); window.viewHarness.append(); });
        await page.getByText("Second configured view", { exact: true }).waitFor({ state: "visible" });
        assert.equal(await page.getByText("Second configured view", { exact: true }).count(), 1);
        assert.deepEqual((await viewMessages()).sent.at(-1).message, { kind: "attach", request: 3 });
        await page.evaluate(() => window.viewHarness.remove());
        assert.equal((await viewMessages()).listeners, 0);
    } finally { await close(page); }
});

test("an authoritative arrival between React render and subscription updates both the field and history without another message", async () => {
    const page = await browser.newPage();
    const errors = [];
    browserErrors.set(page, errors);
    page.on("pageerror", error => errors.push(error.message));
    try {
        await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html`);
        await page.evaluate(async event => {
            window.harness = await import("/kit/tests/helpers/plugin_state_react.tsx");
            window.unmount = window.harness.mountWithLayoutDelivery(document.getElementById("mount"), event);
        }, { kind: "attached", request: 1, scope, client: 2, revision: 4, state: snapshot(8, 4, 2, { canUndo: true, canRedo: false }) });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        assert.equal(JSON.parse(await page.getByTestId("gain").textContent()).value, 8);
        assert.equal(await page.getByText("Undo", { exact: true }).isEnabled(), true);
        assert.equal(await page.getByText("Redo", { exact: true }).isEnabled(), false);
        assert.deepEqual((await messages(page)).sent, [{ kind: "attach", request: 1 }], "no second message or edit wakes the view");
        assert.deepEqual((await messages(page)).defects, []);
    } finally { await close(page); }
});
