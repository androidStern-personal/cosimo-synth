import assert from "node:assert/strict";
import path from "node:path";
import test, { before, after } from "node:test";
import { startPluginStateBrowserFixture } from "./helpers/plugin_state_browser_fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
let page, expectValues, close;
before(async () => {
    ({ page, expectValues, close } = await startPluginStateBrowserFixture(path.join(root, "build", "browser_plugin_state_system")));
});
after(() => close?.());

test("actual generated stateSource worker and public React view hydrate host values and publish prepared DSP data", { timeout: 15_000 }, async () => {
    await expectValues(2.5, [0, 0.25, 1]);
    const state = JSON.parse(await page.getByTestId("gain").textContent());
    assert.equal(state.metadata.defaultValue, 1);
    assert.deepEqual(JSON.parse(await page.getByTestId("history").textContent()), { canUndo: false, canRedo: false });
});


async function agentCommand(command) {
    return page.evaluate(command => window.fixture.agent.dispatch(command), command);
}
async function fieldVersion(key) {
    return page.evaluate(key => window.fixture.agent.getSnapshot().state.fields[key].version, key);
}
async function accepted(command) {
    const result = await agentCommand(command);
    assert.equal(result.kind, "accepted", JSON.stringify(result));
    return result;
}

test("actual GUI gesture and framework agent client enforce field contention and share one Undo history", { timeout: 15_000 }, async () => {
    await page.getByText("Begin curve", { exact: true }).click();
    await page.waitForFunction(() => window.fixture.outcomes.length === 1);
    assert.equal(await page.evaluate(() => window.fixture.outcomes[0].kind), "accepted");
    const busy = await agentCommand({ kind: "edit", key: "curve", value: { points: [9, 9] }, expectedVersion: await fieldVersion("curve") });
    assert.deepEqual(busy, { kind: "rejected", reason: "busy" });
    await accepted({ kind: "edit", key: "gain", value: 3.5, expectedVersion: await fieldVersion("gain") });
    await expectValues(3.5, [0, 0.25, 1]);
    assert.deepEqual(await agentCommand({ kind: "undo" }), { kind: "rejected", reason: "busy" });
    await page.getByText("Curve four", { exact: true }).click();
    await expectValues(3.5, [0, 0.4, 1]);
    await page.getByText("Curve eight", { exact: true }).click();
    await expectValues(3.5, [0, 0.8, 1]);
    await page.getByText("End curve", { exact: true }).click();
    await page.waitForFunction(() => window.fixture.outcomes.length === 4);
    assert.ok((await page.evaluate(() => window.fixture.outcomes)).every(result => result.kind === "accepted"));
    await accepted({ kind: "undo" });
    await expectValues(3.5, [0, 0.25, 1]);
    await accepted({ kind: "undo" });
    await expectValues(2.5, [0, 0.25, 1]);
    assert.equal(JSON.parse(await page.getByTestId("history").textContent()).canUndo, false, "two curve edits must form one shared history entry");
});

test("actual host parameter automation bypasses an active GUI gesture and invalidates stale agent edits without history", { timeout: 15_000 }, async () => {
    await page.getByText("Begin gain", { exact: true }).click();
    await page.waitForFunction(() => window.fixture.outcomes.length === 5);
    assert.equal(await page.evaluate(() => window.fixture.outcomes[4].kind), "accepted");
    assert.ok(await page.evaluate(() => window.fixture.agent.getSnapshot().state.fields.gain.gesture));
    const previous = await fieldVersion("gain");
    await page.evaluate(() => window.fixture.connection.sendEventOrValue("gain", -3.5));
    await expectValues(-3.5, [0, 0.25, 1]);
    await page.getByText("End gain", { exact: true }).click();
    await page.waitForFunction(() => window.fixture.outcomes.length === 6);
    const stale = await agentCommand({ kind: "edit", key: "gain", value: 9, expectedVersion: previous });
    assert.deepEqual(stale, { kind: "rejected", reason: "stale-version" });
    assert.equal(JSON.parse(await page.getByTestId("history").textContent()).canUndo, false);
    await page.getByText("Gain five", { exact: true }).click();
    await expectValues(5.5, [0, 0.25, 1]);
    await page.getByText("Undo", { exact: true }).click();
    await expectValues(-3.5, [0, 0.25, 1]);
    assert.equal(JSON.parse(await page.getByTestId("history").textContent()).canUndo, false);
});


test("closing every actual GUI seals its accepted drag while the same production worker and shared Undo survive", { timeout: 15_000 }, async () => {
    const oldScope = await page.evaluate(() => window.fixture.agent.getSnapshot().state.scope);
    await page.getByText("Begin curve", { exact: true }).click();
    await page.getByText("Curve four", { exact: true }).click();
    await expectValues(-3.5, [0, 0.4, 1]);
    await page.evaluate(() => { window.fixture.closeViews(); window.fixture.openViews(); });
    await expectValues(-3.5, [0, 0.4, 1]);
    const state = await page.evaluate(() => window.fixture.agent.getSnapshot().state);
    assert.deepEqual(state.scope, oldScope);
    assert.equal(state.fields.curve.gesture, undefined);
    await page.getByText("Undo", { exact: true }).click();
    await expectValues(-3.5, [0, 0.25, 1]);
    assert.equal(JSON.parse(await page.getByTestId("history").textContent()).canUndo, false);
});

test("actual full host restore fences an acknowledged old edit's pending effects and hydrates both live clients before new document commands", { timeout: 15_000 }, async () => {
    await page.getByText("Begin curve", { exact: true }).click();
    await page.getByText("Curve four", { exact: true }).click();
    await expectValues(-3.5, [0, 0.4, 1]);
    const result = await page.evaluate(async () => {
        const { connection, agent } = window.fixture;
        const old = agent.getSnapshot().state;
        const traceStart = window.fixture.agentMessages.length;
        const pending = agent.dispatch({ kind: "edit", key: "gain", value: 9, expectedVersion: old.fields.gain.version });
        connection.sendEventOrValue("gain", 8.5);
        connection.sendFullStoredState({ parameters: [{ name: "gain", value: -2 }], values: { curve: { points: [1, 0.25, 0] } } });
        return { oldScope: old.scope, outcome: await pending, trace: window.fixture.agentMessages.slice(traceStart) };
    });
    // The browser owner runs in this realm and acknowledged the edit before
    // synchronous reset. Its native effect is still queued, so known acceptance
    // remains accepted while the replacement invalidates pending old effects.
    assert.equal(result.outcome.kind, "accepted");
    const acceptedAt = result.trace.findIndex(body => (body.kind === "receipt" ? body : body.receipt)?.result.kind === "accepted");
    const resetAt = result.trace.findIndex(body => body.kind === "reset");
    assert.ok(acceptedAt >= 0 && resetAt > acceptedAt, "the real channel receipt must establish acceptance before reset");
    await expectValues(-2, [1, 0.25, 0]);
    const state = await page.evaluate(() => window.fixture.agent.getSnapshot().state);
    assert.deepEqual(state.scope, { owner: result.oldScope.owner, document: result.oldScope.document + 1 });
    assert.deepEqual(state.history, { canUndo: false, canRedo: false });
    assert.equal(state.fields.curve.gesture, undefined);
    await page.getByText("End curve", { exact: true }).click();
    await page.getByText("Gain five", { exact: true }).click();
    await expectValues(5.5, [1, 0.25, 0]);
    await accepted({ kind: "undo" });
    await expectValues(-2, [1, 0.25, 0]);
});

test("client stop seals its accepted gesture while its native view survives, before any reattachment", { timeout: 15_000 }, async () => {
    const previous = await page.evaluate(() => ({ scope: window.fixture.agent.getSnapshot().state.scope, client: window.fixture.agent.getSnapshot().client }));
    await accepted({ kind: "begin", key: "curve", gesture: 17 });
    await accepted({ kind: "edit", key: "curve", gesture: 17, value: { points: [1, 0.7, 0] } });
    await expectValues(-2, [1, 0.7, 0]);
    assert.equal(JSON.parse(await page.getByTestId("history").textContent()).canUndo, false);
    await page.evaluate(() => window.fixture.stopAgent());
    // The other real GUI must observe the released lock BEFORE reattachment.
    // Reattaching would itself seal the previous client and hide a broken stop.
    await page.waitForFunction(() => JSON.parse(document.querySelector("#mount").firstElementChild.shadowRoot
        .querySelector('[data-testid="history"]').textContent).canUndo === true);
    assert.equal(await page.evaluate(() => window.fixture.agent.getSnapshot().kind), "closed");
    await page.getByText("Undo", { exact: true }).click();
    await page.waitForFunction(() => JSON.parse(document.querySelector("#mount").firstElementChild.shadowRoot
        .querySelector('[data-testid="curve"]').textContent).value.points[1] === 0.25);
    await page.evaluate(() => window.fixture.reattachAgent());
    await expectValues(-2, [1, 0.25, 0]);
    const current = await page.evaluate(() => ({ scope: window.fixture.agent.getSnapshot().state.scope, client: window.fixture.agent.getSnapshot().client }));
    assert.deepEqual(current.scope, previous.scope);
    assert.notEqual(current.client, previous.client);
});

test("public GUI burst stays monotonic through actual worklet reports, then automation, reopen and Undo still work", { timeout: 15000 }, async () => {
    await page.evaluate(() => window.fixture.connection.sendFullStoredState({ parameters: [{ name: "gain", value: 2.5 }], values: { curve: { points: [0, 0.25, 1] } } }));
    await expectValues(2.5, [0, 0.25, 1]);
    await page.evaluate(() => {
        window.gainTrace = [2.5];
        window.removeGainTrace = window.fixture.agent.subscribe(snapshot => {
            if (snapshot.kind === "ready") window.gainTrace.push(snapshot.state.fields.gain.value);
        });
        window.outcomeStart = window.fixture.outcomes.length;
    });
    await page.getByText("Rapid gain drag", { exact: true }).click();
    await page.waitForFunction(() => window.fixture.outcomes.length === window.outcomeStart + 20);
    await expectValues(11.5, [0, 0.25, 1]);
    const result = await page.evaluate(() => {
        window.removeGainTrace();
        return { values: window.gainTrace, outcomes: window.fixture.outcomes.slice(window.outcomeStart) };
    });
    assert.ok(result.outcomes.every(outcome => outcome.kind === "accepted"), JSON.stringify(result.outcomes));
    assert.deepEqual(result.values.filter((value, index) => index && value < result.values[index - 1]), [], "own worklet reports never rewind the accepted drag");
    await page.evaluate(() => window.fixture.connection.sendEventOrValue("gain", 4.5));
    await expectValues(4.5, [0, 0.25, 1]);
    await page.evaluate(() => { window.fixture.closeViews(); window.fixture.openViews(); });
    await expectValues(4.5, [0, 0.25, 1]);
    await accepted({ kind: "undo" });
    await expectValues(2.5, [0, 0.25, 1]);
    await accepted({ kind: "redo" });
    await expectValues(11.5, [0, 0.25, 1]);
});
