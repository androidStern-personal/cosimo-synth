import assert from "node:assert/strict";
import path from "node:path";
import test, { before, after } from "node:test";
import { startPluginStateBrowserFixture } from "./helpers/plugin_state_browser_fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
let page, expectValues, close;
before(async () => {
    ({ page, expectValues, close } = await startPluginStateBrowserFixture(path.join(root, "build", "browser_plugin_state_system/reset")));
});
after(() => close?.());

test("actual worklet reset preserves editable storage and reapplies its generated-worker preparation in a fresh document", { timeout: 15000 }, async () => {
    await expectValues(2.5, [0, 0.25, 1]);
    const before = await page.evaluate(async () => {
        const { agent } = window.fixture;
        const edit = async (key, value) => agent.dispatch({ kind: "edit", key, value,
            expectedVersion: agent.getSnapshot().state.fields[key].version });
        const gain = await edit("gain", 5.5);
        const curve = await edit("curve", { points: [2, 3] });
        return { gain, curve, snapshot: agent.getSnapshot() };
    });
    assert.equal(before.gain.kind, "accepted");
    assert.equal(before.curve.kind, "accepted");
    assert.equal(before.snapshot.state.history.canUndo, true);
    await expectValues(5.5, [2, 3]);
    const reset = await page.evaluate(() => {
        window.fixture.connection.resetToInitialState();
        return window.fixture.agentMessages.filter(message => message.kind === "reset").at(-1);
    });
    assert.deepEqual(reset?.scope, { owner: before.snapshot.state.scope.owner, document: before.snapshot.state.scope.document + 1 });
    await expectValues(2.5, [2, 3]);
    const after = await page.evaluate(() => window.fixture.agent.getSnapshot());
    assert.deepEqual(after.state.scope, reset.scope);
    assert.equal(after.state.history.canUndo, false);
    assert.equal(after.state.history.canRedo, false);
});

// Hold only the external MessagePort handoff. The imported production worker
// accepts/persists the edit and creates the actual scoped effect; the real
// processor, rather than a supplied ACK, decides whether its late arrival is valid.
test("a real old-document worklet effect arriving after reset is rejected before the new preparation applies", { timeout: 15000 }, async () => {
    const edit = async (key, value) => page.evaluate(async ({ key, value }) => {
        const { agent } = window.fixture;
        return agent.dispatch({ kind: "edit", key, value, expectedVersion: agent.getSnapshot().state.fields[key].version });
    }, { key, value });
    assert.equal((await edit("gain", 5.5)).kind, "accepted");
    await expectValues(5.5, [2, 3]);
    await page.evaluate(() => {
        const port = window.fixture.connection.audioNode.port;
        const post = port.postMessage.bind(port);
        const replies = [];
        const receive = event => { if (event.data.type === "kit_state_host") replies.push(structuredClone(event.data)); };
        port.addEventListener("message", receive);
        const held = { packet: null, replies, release: () => {
            port.postMessage = post;
            post(held.packet);
        }, cleanup: () => { port.postMessage = post; port.removeEventListener("message", receive); } };
        port.postMessage = packet => {
            if (held.packet === null && packet.type === "kit_state_host"
                && packet.message.kind === "effect" && packet.message.operation.endpoint === "curveValue") {
                held.packet = structuredClone(packet);
                return;
            }
            post(packet);
        };
        window.heldResetEffect = held;
    });
    try {
        assert.equal((await edit("curve", { points: [7, 8] })).kind, "accepted");
        await page.waitForFunction(() => window.heldResetEffect.packet !== null
            && JSON.stringify(window.fixture.connection.cachedState.curve) === JSON.stringify({ points: [7, 8] }));
        const held = await page.evaluate(() => window.heldResetEffect.packet);
        assert.equal(held.message.operation.value, 15.55);
        const scope = await page.evaluate(() => {
            window.fixture.connection.resetToInitialState();
            return window.fixture.agentMessages.filter(message => message.kind === "reset").at(-1).scope;
        });
        assert.equal(scope.document, held.message.scope.document + 1);
        await page.waitForFunction(scope => {
            const snapshot = window.fixture.agent.getSnapshot();
            return snapshot.kind === "ready" && snapshot.state.scope.document === scope.document
                && snapshot.state.fields.gain.value === 2.5;
        }, scope);
        const wiped = await page.evaluate(() => window.fixture.readOutput());
        assert.ok(Math.abs(wiped.min - 2.5) < 0.001 && Math.abs(wiped.max - 2.5) < 0.001, JSON.stringify(wiped));
        await page.evaluate(() => window.heldResetEffect.release());
        await page.waitForFunction(request => window.heldResetEffect.replies.some(reply => reply.request === request), held.request);
        const reply = await page.evaluate(request => window.heldResetEffect.replies.find(reply => reply.request === request), held.request);
        assert.deepEqual(reply.result, { error: "stale-scope" });
        await expectValues(2.5, [7, 8]);
        assert.equal(await page.evaluate(() => window.fixture.agent.getSnapshot().state.history.canUndo), false);
    } finally { await page.evaluate(() => window.heldResetEffect.cleanup()); }
});
