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
const build = path.join(root, "build/browser_plugin_state_system");
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
