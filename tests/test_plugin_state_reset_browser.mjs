import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { before, after } from "node:test";
import { chromium } from "playwright";
import { build as bundle } from "esbuild";
import { buildPluginStateFixture } from "./helpers/build_plugin_state_fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
const build = path.join(root, "build/browser_plugin_state_system/reset");
const fixture = path.join(root, "tests/browser/fixtures/plugin_state_system");
const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
let browser, page, server;
const errors = [];

before(async () => {
    assert.ok(source, "Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the isolated Cmajor fork");
    const manifestPath = await buildPluginStateFixture(build);
    const runtime = path.dirname(manifestPath);
    const staging = path.resolve(runtime, "../../..");
    const viewSource = path.join(staging, "fx/state_lab/browser-view.tsx");
    await fs.copyFile(path.join(fixture, "view.tsx"), viewSource);
    await bundle({ entryPoints: [viewSource], outfile: path.join(build, "view.js"), bundle: true, format: "esm",
        platform: "browser", jsx: "automatic", target: "es2022", logLevel: "silent" });
    const generated = path.join(build, "generated.js");
    const codegen = spawnSync(path.join(root, "build/browser_plugin_state_generator/cosimo_cmajor_external_codegen"), [
        manifestPath, generated, "PluginStateSystem", "--target", "javascript", "--max-frames-per-block", "128",
    ], { encoding: "utf8", timeout: 60_000 });
    if (codegen.error) throw codegen.error;
    assert.equal(codegen.status, 0, codegen.stderr);
    await fs.appendFile(generated, "\nexport default PluginStateSystem;\n");
    server = createServer(async (request, response) => {
        try {
            const pathname = new URL(request.url, "http://127.0.0.1").pathname;
            assert.ok(!pathname.includes(".."));
            const target = pathname === "/" ? path.join(fixture, "index.html")
                : pathname === "/manifest.json" ? manifestPath
                : ["/view.js", "/generated.js"].includes(pathname) ? path.join(build, pathname.slice(1))
                : pathname.startsWith("/runtime/") ? path.join(runtime, pathname.slice(9))
                : pathname.startsWith("/cmaj_api/") ? path.join(source, "javascript/cmaj_api", pathname.slice(10)) : undefined;
            assert.ok(target);
            response.writeHead(200, { "content-type": target.endsWith(".html") ? "text/html" : "text/javascript" });
            response.end(await fs.readFile(target));
        } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
    page = await browser.newPage();
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.click("#start");
    await page.waitForFunction(() => window.fixture || window.fixtureError, null, { timeout: 10_000 });
    assert.equal(await page.evaluate(() => window.fixtureError), null);
});

after(async () => {
    const cleanup = [];
    try { await page?.evaluate(() => window.fixture?.dispose()); } catch (error) { cleanup.push(error); }
    try { await browser?.close(); } catch (error) { cleanup.push(error); }
    if (server) await new Promise(resolve => server.close(resolve));
    if (cleanup.length) throw new AggregateError(cleanup, "Production browser fixture cleanup failed");
});

async function expectValues(gain, points) {
    await page.waitForFunction(({ gain, points }) => {
        const snapshot = window.fixture.agent.getSnapshot();
        if (snapshot.kind !== "ready") return false;
        const fields = snapshot.state.fields;
        return fields.gain.value === gain && JSON.stringify(fields.curve.value.points) === JSON.stringify(points)
            && fields.curve.application?.kind === "sent" && fields.curve.application?.proof === "native-publication-processed";
    }, { gain, points }, { timeout: 5_000 });
    await page.waitForFunction(({ gain, points }) => {
        const shadow = document.querySelector("#mount").firstElementChild?.shadowRoot;
        const gainText = shadow?.querySelector('[data-testid="gain"]')?.textContent;
        const curveText = shadow?.querySelector('[data-testid="curve"]')?.textContent;
        return gainText && curveText && JSON.parse(gainText).value === gain
            && JSON.stringify(JSON.parse(curveText).value) === JSON.stringify({ points })
            && !JSON.parse(gainText).pending && !JSON.parse(curveText).pending;
    }, { gain, points }, { timeout: 5_000 });
    assert.equal(JSON.parse(await page.getByTestId("gain").textContent()).value, gain);
    assert.deepEqual(JSON.parse(await page.getByTestId("curve").textContent()).value, { points });
    const native = await page.evaluate(() => new Promise(resolve => window.fixture.connection.requestFullStoredState(resolve)));
    assert.equal(native.parameters.find(parameter => parameter.name === "gain").value, gain);
    assert.deepEqual(native.values.curve, { points });
    const output = await page.evaluate(() => window.fixture.readOutput());
    const expected = gain * 1.1 + points.reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(output.min - expected) < 0.001 && Math.abs(output.max - expected) < 0.001, JSON.stringify({ output, expected }));
    assert.deepEqual(await page.evaluate(() => window.fixture.defects), []);
    assert.deepEqual(errors, []);
}

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
