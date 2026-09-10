import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
const build = path.join(root, "build/browser_plugin_state");
const fixture = path.join(root, "tests/browser/fixtures/plugin_state_channel");
let browser, page, server;
const errors = [];

before(async () => {
    assert.ok(source, "Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the isolated Cmajor worktree");
    await fs.mkdir(build, { recursive: true });
    const generated = path.join(build, "generated.js");
    const result = spawnSync(path.join(root, "build/browser_plugin_state_generator/cosimo_cmajor_external_codegen"), [
        path.join(root, "tests/native/fixtures/plugin_state_channel/PluginStateChannel.cmajorpatch"), generated,
        "PluginStateChannel", "--target", "javascript", "--max-frames-per-block", "128",
    ], { encoding: "utf8", timeout: 60_000 });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    await fs.appendFile(generated, "\nexport default PluginStateChannel;\n");
    const sparseGenerated = path.join(build, "sparse.js");
    const sparseResult = spawnSync(path.join(root, "build/browser_plugin_state_generator/cosimo_cmajor_external_codegen"), [
        path.join(fixture, "Sparse.cmajorpatch"), sparseGenerated, "Sparse", "--target", "javascript", "--max-frames-per-block", "128",
    ], { encoding: "utf8", timeout: 60_000 });
    if (sparseResult.error) throw sparseResult.error;
    assert.equal(sparseResult.status, 0, sparseResult.stderr);
    await fs.appendFile(sparseGenerated, "\nexport default Sparse;\n");
    server = createServer(async (request, response) => {
        try {
            const pathname = new URL(request.url, "http://127.0.0.1").pathname;
            let target;
            if (pathname.startsWith("/cmaj_api/")) {
                const relative = pathname.slice("/cmaj_api/".length);
                assert.ok(!relative.includes(".."));
                target = path.join(source, "javascript/cmaj_api", relative);
            } else {
                target = pathname === "/" ? path.join(fixture, "index.html")
                    : pathname === "/generated.js" ? generated
                    : pathname === "/sparse.js" ? sparseGenerated
                    : pathname === "/worker.js" ? path.join(fixture, "worker.js") : undefined;
            }
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
    try {
        await page?.evaluate(async () => {
            try { if (!window.fixture?.disposed) await window.fixture?.connection.dispose?.(); }
            finally { await window.fixture?.context.close(); }
        });
    } catch (error) { cleanup.push(error); }
    try { await browser?.close(); } catch (error) { cleanup.push(error); }
    if (server) await new Promise(resolve => server.close(resolve));
    if (cleanup.length) throw new AggregateError(cleanup, "Browser fixture cleanup failed");
});

test("actual imported worker opens live state through the real AudioWorklet", { timeout: 15_000 }, async () => {
    await page.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "opened"), null, { timeout: 5_000 });
    const opened = await page.evaluate(() => window.fixture.worker.messages.find(body => body.kind === "opened"));
    assert.equal(opened.request, 1);
    assert.equal(typeof opened.scope.owner, "string");
    assert.ok(opened.scope.owner.length > 0);
    assert.equal(opened.scope.document, 0);
    assert.deepEqual(opened.native.parameters, [{ endpoint: "gain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 }]);
    assert.deepEqual(opened.native.values.curve, { points: [0, 1] });
    assert.deepEqual(errors, []);
});


test("ordinary real browser connections attach separately and cannot forge worker identity", { timeout: 15_000 }, async () => {
    const result = await page.evaluate(async () => {
        const { connection, worker } = window.fixture;
        const a = connection;
        const b = connection.createViewConnection();
        const first = [], second = [];
        a.addEventListener("kit_state", body => first.push(body));
        b.addEventListener("kit_state", body => second.push(body));
        const forged = a.sendMessageToServer({ type: "kit_state", message: {
            kind: "open", request: 10, parameters: ["gain"], storedKeys: ["curve"], eventEndpoints: ["curveBuffer"], role: "worker"
        }});
        a.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 11 }});
        b.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 12 }});
        window.fixture.clients = { a, b, first, second };
        return { forged, first, second, worker: worker.messages };
    });
    assert.equal(result.forged, false);
    await page.waitForFunction(() => window.fixture.clients.first.some(body => body.kind === "attached")
        && window.fixture.clients.second.some(body => body.kind === "attached"), null, { timeout: 5_000 });
    const attached = await page.evaluate(() => [window.fixture.clients.first, window.fixture.clients.second]
        .map(messages => messages.find(body => body.kind === "attached")));
    assert.equal(attached[0].request, 11);
    assert.equal(attached[1].request, 12);
    assert.ok(Number.isSafeInteger(attached[0].client) && attached[0].client > 0);
    assert.ok(Number.isSafeInteger(attached[1].client) && attached[1].client > 0);
    assert.notEqual(attached[0].client, attached[1].client);
    assert.deepEqual(attached[0].state, { gain: 2.5, curve: { points: [0, 1] } });
    assert.deepEqual(attached[1].state, attached[0].state);
    assert.deepEqual(errors, []);
});


test("browser channel stamps concrete sender and sequences opaque commands and receipts", async () => {
    const result = await page.evaluate(() => {
        const { a, b, first, second } = window.fixture.clients;
        const scope = first.find(body => body.kind === "attached").scope;
        const firstID = first.find(body => body.kind === "attached").client;
        const secondID = second.find(body => body.kind === "attached").client;
        a.sendMessageToServer({ type: "kit_state", message: { kind: "command", scope, sequence: 1, client: secondID,
            command: { kind: "edit", value: "forged" } }});
        const send = (view, sequence) => view.sendMessageToServer({ type: "kit_state", message: {
            kind: "command", scope, sequence, client: view === a ? firstID : secondID, command: { kind: "edit", value: "opaque" }
        }});
        send(a, 1); send(b, 1); send(a, 1); send(a, 2);
        return { first, second, commands: window.fixture.worker.messages.filter(body => body.kind === "command") };
    });
    assert.equal(result.commands.length, 3);
    const a = result.first.find(body => body.kind === "attached").client;
    const b = result.second.find(body => body.kind === "attached").client;
    assert.deepEqual(result.commands.map(body => [body.address.client, body.address.sequence]), [[a, 1], [b, 1], [a, 2]]);
    assert.deepEqual(result.commands[0].command, { kind: "edit", value: "opaque" });
    const firstReceipts = result.first.filter(body => body.kind === "receipt");
    assert.deepEqual(firstReceipts.map(body => body.result.reason), ["closed-client", "busy", "sequence", "busy"]);
    assert.deepEqual(result.second.filter(body => body.kind === "receipt").map(body => body.result.reason), ["busy"]);
    assert.deepEqual(errors, []);
});


test("worker publication crosses the real worklet barrier into stored state and DSP output", { timeout: 15_000 }, async () => {
    const forged = await page.evaluate(() => {
        const { a, first } = window.fixture.clients;
        const scope = first.find(body => body.kind === "attached").scope;
        const operations = [{ kind: "gesture-start", endpoint: "gain" }, { kind: "parameter", endpoint: "gain", value: 3.5 },
            { kind: "gesture-end", endpoint: "gain" }, { kind: "stored", key: "curve", value: { points: [0, 0.5, 1] } },
            { kind: "event", endpoint: "curveBuffer", value: 0.75 }];
        const rejected = a.sendMessageToServer({ type: "kit_state", message: { kind: "publish", scope, request: 21, operations, role: "worker" }});
        a.sendMessageToServer({ type: "kit_state", message: { kind: "command", scope, client: first.find(body => body.kind === "attached").client, sequence: 3,
            command: { kind: "probe-publish", request: 21, operations } }});
        return rejected;
    });
    assert.equal(forged, false);
    await page.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "published" && body.request === 21), null, { timeout: 5_000 });
    const result = await page.evaluate(async () => ({
        published: window.fixture.worker.messages.find(body => body.kind === "published" && body.request === 21),
        state: window.fixture.connection.cachedState.curve,
        output: await window.fixture.readOutput(),
    }));
    assert.deepEqual(result.published.result, { kind: "observed" });
    assert.deepEqual(result.state, { points: [0, 0.5, 1] });
    assert.ok(Math.abs(result.output.min - 4.25) < 0.001 && Math.abs(result.output.max - 4.25) < 0.001, JSON.stringify(result.output));
    assert.deepEqual(errors, []);
});

test("same browser connection reattach replaces binding identity after its old routed prefix", async () => {
    const result = await page.evaluate(() => {
        const { a, first } = window.fixture.clients;
        const old = first.find(body => body.kind === "attached");
        const command = (client, sequence, kind) => a.sendMessageToServer({ type: "kit_state", message: {
            kind: "command", scope: old.scope, client, sequence, command: { kind, key: "gain", gesture: 1, value: 3.5 }
        }});
        command(old.client, 4, "begin");
        command(old.client, 5, "edit");
        a.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 31 }});
        const attached = first.find(body => body.kind === "attached" && body.request === 31);
        if (attached) {
            command(old.client, 6, "edit");
            command(attached.client, 1, "edit");
        }
        return { old, attached, first, messages: window.fixture.worker.messages };
    });
    assert.ok(result.attached);
    assert.notEqual(result.attached.client, result.old.client, "same raw connection reused the old client incarnation");
    const detach = result.messages.findIndex(body => body.kind === "detach" && body.client === result.old.client);
    const attach = result.messages.findIndex(body => body.kind === "attached-client" && body.request === 31);
    assert.ok(detach >= 0 && detach < attach);
    assert.equal(result.messages[detach].routedThrough, 5);
    assert.ok(result.first.some(body => body.kind === "receipt" && body.address.client === result.old.client
        && body.address.sequence === 6 && body.result.reason === "closed-client"));
    const commands = result.messages.filter(body => body.kind === "command");
    assert.deepEqual(commands.slice(-3).map(body => [body.address.client, body.address.sequence]),
        [[result.old.client, 4], [result.old.client, 5], [result.attached.client, 1]]);
    assert.deepEqual(errors, []);
});

test("browser publication validates the whole list and finite JSON before native mutation", { timeout: 15_000 }, async () => {
    for (const [sequence, request, malformed] of [[2, 41, "endpoint"], [3, 42, "nonfinite"]]) {
        await page.evaluate(({ sequence, request, malformed }) => {
            const { a, first } = window.fixture.clients;
            const attached = first.find(body => body.kind === "attached" && body.request === 31);
            const operations = malformed === "endpoint"
                ? [{ kind: "stored", key: "curve", value: { points: [99] } }, { kind: "event", endpoint: "missing", value: 1 }]
                : [{ kind: "stored", key: "curve", value: { points: [0] } }];
            a.sendMessageToServer({ type: "kit_state", message: { kind: "command", scope: attached.scope, client: attached.client, sequence,
                command: { kind: "probe-publish", request, operations, nativeNonFinite: malformed === "nonfinite" } }});
        }, { sequence, request, malformed });
        await page.waitForFunction(request => window.fixture.worker.messages.some(body => body.kind === "published" && body.request === request), request, { timeout: 5_000 });
        const result = await page.evaluate(request => ({
            result: window.fixture.worker.messages.find(body => body.kind === "published" && body.request === request).result,
            curve: window.fixture.connection.cachedState.curve,
        }), request);
        assert.deepEqual(result.result, { kind: "failed", reason: "invalid-publication" });
        assert.deepEqual(result.curve, { points: [0, 0.5, 1] });
    }
    assert.deepEqual(errors, []);
});


test("actual full-state restore fences queued effects and pairs current worklet parameters with complex state", { timeout: 15_000 }, async () => {
    const immediate = await page.evaluate(async () => {
        const { connection } = window.fixture;
        const { a, first } = window.fixture.clients;
        const old = first.find(body => body.kind === "attached" && body.request === 31);
        const send = (sequence, command) => a.sendMessageToServer({ type: "kit_state", message: {
            kind: "command", scope: old.scope, client: old.client, sequence, command
        }});
        send(4, { kind: "probe-late-after-replace", request: 52, operations: [
            { kind: "stored", key: "curve", value: { points: [99] } },
            { kind: "parameter", endpoint: "gain", value: 9 }, { kind: "event", endpoint: "curveBuffer", value: 20 },
        ] });
        send(5, { kind: "probe-publish", request: 53, operations: [
            { kind: "parameter", endpoint: "gain", value: 9 }, { kind: "event", endpoint: "curveBuffer", value: 20 },
        ] });
        // The real publication starts its first port handoff in a microtask;
        // no port response can run until this JavaScript turn has completed.
        await Promise.resolve();
        connection.sendEventOrValue("gain", 5.5);
        let reset, previousComplex;
        const onReset = body => {
            if (body.kind !== "reset") return;
            reset = body;
            previousComplex = structuredClone(connection.cachedState.curve);
            a.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 51 } });
        };
        a.addEventListener("kit_state", onReset);
        connection.sendFullStoredState({ parameters: [{ name: "gain", value: -2 }], values: { curve: { points: [1, 0] } } });
        a.removeEventListener("kit_state", onReset);
        return { reset, previousComplex, oldScope: old.scope };
    });
    assert.equal(immediate.reset?.scope.document, immediate.oldScope.document + 1, "host restore must revoke old document synchronously");
    assert.deepEqual(immediate.previousComplex, { points: [0, 0.5, 1] }, "reset must precede complex native mutation");
    await page.waitForFunction(() => {
        const messages = window.fixture.worker.messages;
        return [52, 53].every(request => messages.some(body => body.kind === "published" && body.request === request))
            && messages.some(body => body.kind === "replaced")
            && messages.some(body => body.kind === "parameter" && body.scope.document === 1)
            && window.fixture.clients.first.some(body => body.kind === "attached" && body.request === 51);
    }, null, { timeout: 5_000 });
    const result = await page.evaluate(async () => ({
        messages: window.fixture.worker.messages,
        attached: window.fixture.clients.first.find(body => body.kind === "attached" && body.request === 51),
        curve: window.fixture.connection.cachedState.curve,
        output: await window.fixture.readOutput(),
    }));
    for (const request of [52, 53])
        assert.deepEqual(result.messages.find(body => body.kind === "published" && body.request === request).result,
            { kind: "failed", reason: "stale-scope" });
    const replaced = result.messages.find(body => body.kind === "replaced");
    assert.equal(replaced.native.parameters[0].value, -2);
    assert.deepEqual(replaced.native.values.curve, { points: [1, 0] });
    assert.deepEqual(result.curve, { points: [1, 0] });
    assert.equal(result.attached.state.gain, -2);
    for (const body of result.messages.filter(body => body.kind === "parameter" && body.scope.document === 1))
        assert.equal(body.value, -2, "old queued parameter payload must not become new document truth");
    assert.ok(Math.abs(result.output.min + 1.25) < 0.001 && Math.abs(result.output.max + 1.25) < 0.001, JSON.stringify(result.output));
    assert.deepEqual(errors, []);
});


test("opaque updates reach live views and disposed view detaches exactly once after its routed prefix", { timeout: 15_000 }, async () => {
    const result = await page.evaluate(() => {
        const { a, b, first, second } = window.fixture.clients;
        const attached = first.find(body => body.kind === "attached" && body.request === 51);
        const bClient = second.find(body => body.kind === "attached").client;
        b.sendMessageToServer({ type: "kit_state", message: { kind: "command", scope: attached.scope, client: bClient, sequence: 1, command: { kind: "edit" } }});
        const update = sequence => a.sendMessageToServer({ type: "kit_state", message: { kind: "command", scope: attached.scope,
            client: attached.client, sequence, command: { kind: "probe-update", revision: sequence, state: { gain: 6, curve: { points: [0.2, 0.8] } } } }});
        update(1);
        b.dispose();
        b.dispose();
        const afterDispose = b.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 61 } });
        update(2);
        return { first, second, afterDispose, bClient, worker: window.fixture.worker.messages,
            curve: window.fixture.connection.cachedState.curve };
    });
    assert.deepEqual(result.first.filter(body => body.kind === "update").map(body => body.revision), [1, 2]);
    assert.deepEqual(result.second.filter(body => body.kind === "update").map(body => body.revision), [1]);
    assert.deepEqual(result.first.find(body => body.kind === "update").state, { gain: 6, curve: { points: [0.2, 0.8] } });
    const detaches = result.worker.filter(body => body.kind === "detach" && body.client === result.bClient);
    assert.equal(detaches.length, 1);
    assert.equal(detaches[0].routedThrough, 1);
    assert.equal(result.afterDispose, false);
    assert.deepEqual(result.curve, { points: [1, 0] }, "opaque service state is not a native mutation");
    assert.deepEqual(errors, []);
});


test("worker readiness reaches an ordinary view whose initial attach preceded owner open", async () => {
    const result = await page.evaluate(() => ({
        messages: window.fixture.startupMessages,
        opened: window.fixture.worker.messages.find(body => body.kind === "opened"),
    }));
    const ready = result.messages.filter(body => body.kind === "owner-changed");
    assert.equal(ready.length, 1);
    assert.deepEqual(ready[0].scope, result.opened.scope);
    assert.deepEqual(errors, []);
});


test("only the actual worker can close its owner and terminal closure fences pending native effects", { timeout: 15_000 }, async () => {
    const immediate = await page.evaluate(async () => {
        const { a, first } = window.fixture.clients;
        const attached = first.find(body => body.kind === "attached" && body.request === 51);
        const forged = a.sendMessageToServer({ type: "kit_state", message: { kind: "close", reason: "service-closed", role: "worker" } });
        const send = (sequence, command) => a.sendMessageToServer({ type: "kit_state", message: {
            kind: "command", scope: attached.scope, client: attached.client, sequence, command
        }});
        send(3, { kind: "probe-publish", request: 80, operations: [
            { kind: "parameter", endpoint: "gain", value: -2 }, { kind: "event", endpoint: "curveBuffer", value: 20 },
        ] });
        await Promise.resolve();
        send(4, { kind: "probe-close" });
        send(5, { kind: "edit" });
        a.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 83 } });
        return { forged, first, attached };
    });
    assert.equal(immediate.forged, false);
    assert.equal(immediate.first.filter(body => body.kind === "closed" && body.reason === "service-closed").length, 1);
    await page.waitForFunction(() => [80, 81].every(request => window.fixture.worker.messages.some(body => body.kind === "published" && body.request === request)), null, { timeout: 5_000 });
    const result = await page.evaluate(async () => ({ messages: window.fixture.worker.messages,
        first: window.fixture.clients.first, output: await window.fixture.readOutput() }));
    for (const request of [80, 81])
        assert.equal(result.messages.find(body => body.kind === "published" && body.request === request).result.kind, "failed");
    assert.equal(result.messages.find(body => body.kind === "open-failed" && body.request === 82).reason, "closed");
    assert.equal(result.first.find(body => body.kind === "attach-failed" && body.request === 83).reason, "closed");
    assert.equal(result.first.find(body => body.kind === "receipt" && body.address.sequence === 5
        && body.address.client === immediate.attached.client && body.address.document === immediate.attached.scope.document).result.reason, "closed");
    assert.ok(Math.abs(result.output.min + 1.25) < 0.001 && Math.abs(result.output.max + 1.25) < 0.001, JSON.stringify(result.output));
    assert.deepEqual(errors, []);
});


test("disposing the actual browser host awaits its worker and finishes owned cleanup when stop rejects", { timeout: 15_000 }, async () => {
    const result = await page.evaluate(async () => {
        const { connection, worker } = window.fixture;
        worker.holdStop();
        let settled = false;
        const first = connection.dispose();
        const second = connection.dispose();
        const outcome = first.then(() => { settled = true; return "resolved"; }, error => { settled = true; return String(error); });
        await Promise.resolve();
        const pendingBeforeRelease = !settled;
        const duringStop = connection.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 91 } });
        worker.finishStop();
        const error = await outcome;
        window.fixture.disposed = true;
        const lateLegacy = connection.sendMessageToServer({ type: "send_value", id: "gain", value: 9 });
        return { same: first === second, pendingBeforeRelease, error, duringStop, lateLegacy, stopped: worker.stopped,
            closedCount: window.fixture.clients.first.filter(body => body.kind === "closed").length };
    });
    assert.equal(result.same, true);
    assert.equal(result.pendingBeforeRelease, true);
    assert.match(result.error, /probe stop failed/);
    assert.equal(result.duringStop, false);
    assert.equal(result.lateLegacy, false);
    assert.equal(result.stopped, 1);
    assert.equal(result.closedCount, 1, "disposing a terminal owner must not notify twice");
    assert.deepEqual(errors, []);
});


test("host replacement during asynchronous worker opening cannot pair old scalars with new complex state", { timeout: 15_000 }, async () => {
    const openingPage = await browser.newPage();
    const openingErrors = [];
    openingPage.on("pageerror", error => openingErrors.push(String(error)));
    try {
        await openingPage.goto(`http://127.0.0.1:${server.address().port}/?restoreDuringOpen=1`);
        await openingPage.click("#start");
        await openingPage.waitForFunction(() => window.fixture?.worker.messages.some(body => body.kind === "opened"), null, { timeout: 5_000 });
        const result = await openingPage.evaluate(async () => ({
            opened: window.fixture.worker.messages.find(body => body.kind === "opened"),
            output: await window.fixture.readOutput(),
        }));
        assert.equal(result.opened.scope.document, 1);
        assert.equal(result.opened.native.parameters[0].value, -3);
        assert.deepEqual(result.opened.native.values.curve, { points: [0.1, 0.9] });
        assert.ok(Math.abs(result.output.min + 3) < 0.001 && Math.abs(result.output.max + 3) < 0.001);
        assert.deepEqual(openingErrors, []);
    } finally {
        await openingPage.evaluate(async () => { try { await window.fixture?.connection.dispose(); } finally { await window.fixture?.context.close(); } });
        await openingPage.close();
    }
});


test("private worker facade preserves actual legacy parameter and stored-state reads", { timeout: 15_000 }, async () => {
    const legacyPage = await browser.newPage();
    const legacyErrors = [];
    legacyPage.on("pageerror", error => legacyErrors.push(String(error)));
    try {
        await legacyPage.goto(`http://127.0.0.1:${server.address().port}/`);
        await legacyPage.click("#start");
        await legacyPage.waitForFunction(() => window.fixture?.worker.messages.some(body => body.kind === "opened"), null, { timeout: 5_000 });
        await legacyPage.evaluate(() => {
            const { connection } = window.fixture;
            const received = [];
            connection.addEventListener("kit_state", body => received.push(body));
            window.legacyReadMessages = received;
            connection.sendEventOrValue("gain", 3);
            connection.sendStoredStateValue("curve", { points: [0.3, 0.7] });
        });
        await legacyPage.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "replaced"));
        await legacyPage.evaluate(() => {
            const { connection } = window.fixture;
            connection.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 101 } });
            const attached = window.legacyReadMessages.find(body => body.kind === "attached");
            connection.sendMessageToServer({ type: "kit_state", message: { kind: "command", scope: attached.scope,
                client: attached.client, sequence: 1, command: { kind: "probe-legacy" } }});
        });
        await legacyPage.waitForFunction(() => window.fixture.worker.legacy.full.length > 0, null, { timeout: 5_000 });
        const result = await legacyPage.evaluate(() => window.fixture.worker.legacy);
        assert.ok(result.parameters.includes(3));
        assert.deepEqual(result.stored.at(-1), { key: "curve", value: { points: [0.3, 0.7] } });
        assert.deepEqual(result.full.at(-1), { parameters: [{ name: "gain", value: 3 }], values: { curve: { points: [0.3, 0.7] } } });
        assert.deepEqual(legacyErrors, []);
    } finally {
        await legacyPage.evaluate(async () => { try { await window.fixture?.connection.dispose(); } finally { await window.fixture?.context.close(); } });
        await legacyPage.close();
    }
});


test("real parameters with omitted init and step use finite native defaults and apply that initial value to DSP", { timeout: 15_000 }, async () => {
    const sparsePage = await browser.newPage();
    const sparseErrors = [];
    sparsePage.on("pageerror", error => sparseErrors.push(String(error)));
    try {
        await sparsePage.goto(`http://127.0.0.1:${server.address().port}/?sparse=1`);
        await sparsePage.click("#start");
        await sparsePage.waitForFunction(() => window.fixture?.worker.messages.some(body => body.kind === "opened"), null, { timeout: 5_000 });
        const result = await sparsePage.evaluate(async () => ({
            opened: window.fixture.worker.messages.find(body => body.kind === "opened"), output: await window.fixture.readOutput(),
        }));
        assert.deepEqual(result.opened.native.parameters, [{ endpoint: "gain", value: -2, min: -2, max: 2, step: 0, defaultValue: -2 }]);
        assert.ok(Math.abs(result.output.min + 2) < 0.001 && Math.abs(result.output.max + 2) < 0.001);
        const bounds = await sparsePage.evaluate(() => {
            const { connection } = window.fixture;
            const messages = [];
            connection.addEventListener("kit_state", body => messages.push(body));
            connection.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 111 } });
            const attached = messages.find(body => body.kind === "attached");
            const command = value => connection.sendMessageToServer({ type: "kit_state", message: {
                kind: "command", scope: attached.scope, client: attached.client, sequence: 1, command: { kind: "edit", value },
            }});
            let deep = 0;
            for (let i = 0; i < 65; ++i) deep = { child: deep };
            const tooDeep = command(deep);
            const tooLarge = command("x".repeat(16 * 1024 * 1024));
            const valid = command(0.5);
            return { tooDeep, tooLarge, valid, messages };
        });
        assert.equal(bounds.tooDeep, false);
        assert.equal(bounds.tooLarge, false);
        assert.equal(bounds.valid, true);
        assert.equal(bounds.messages.find(body => body.kind === "receipt").result.reason, "busy", "invalid input must not consume sequence 1");
        const closed = await sparsePage.evaluate(async () => {
            await window.fixture.connection.dispose();
            return { messages: window.fixture.worker.messages, stopped: window.fixture.worker.stopped };
        });
        assert.deepEqual(closed.messages.filter(body => body.kind === "closed"), [{ kind: "closed", reason: "owner-removed" }]);
        assert.equal(closed.stopped, 1);
        assert.deepEqual(sparseErrors, []);
    } finally {
        await sparsePage.evaluate(async () => { try { await window.fixture?.connection.dispose(); } finally { await window.fixture?.context.close(); } });
        await sparsePage.close();
    }
});


test("disposal during actual asynchronous worker startup waits for the newly owned host and stops it once", { timeout: 15_000 }, async () => {
    const startingPage = await browser.newPage();
    const startingErrors = [];
    startingPage.on("pageerror", error => startingErrors.push(String(error)));
    try {
        await startingPage.goto(`http://127.0.0.1:${server.address().port}/?holdWorkerStart=1`);
        await startingPage.click("#start");
        await startingPage.waitForFunction(() => window.startingFixture?.worker.finishStart, null, { timeout: 5_000 });
        const result = await startingPage.evaluate(async () => {
            const { connection, worker } = window.startingFixture;
            let settled = false;
            const stopping = connection.dispose().then(() => { settled = true; });
            await Promise.resolve();
            await new Promise(requestAnimationFrame);
            const waited = !settled;
            worker.finishStart();
            await stopping;
            return { waited, stopped: worker.stopped };
        });
        assert.equal(result.waited, true);
        assert.equal(result.stopped, 1);
        assert.deepEqual(startingErrors, []);
    } finally {
        await startingPage.evaluate(async () => { await window.startingFixture?.connection.dispose(); await window.startingFixture?.context.close(); });
        await startingPage.close();
    }
});

test("scoped client detach removes only its surviving browser view registration and rejects stale incarnation cleanup", { timeout: 15_000 }, async () => {
    const detachPage = await browser.newPage();
    const detachErrors = [];
    detachPage.on("pageerror", error => detachErrors.push(String(error)));
    try {
        await detachPage.goto(`http://127.0.0.1:${server.address().port}/`);
        await detachPage.click("#start");
        await detachPage.waitForFunction(() => window.fixture?.worker.messages.some(body => body.kind === "opened"), null, { timeout: 5_000 });
        const result = await detachPage.evaluate(() => {
            const { connection: a, worker } = window.fixture;
            const b = a.createViewConnection();
            const first = [], second = [];
            a.addEventListener("kit_state", body => first.push(body));
            b.addEventListener("kit_state", body => second.push(body));
            const send = (source, message) => source.sendMessageToServer({ type: "kit_state", message });
            send(a, { kind: "attach", request: 131 });
            send(b, { kind: "attach", request: 132 });
            const old = first.find(body => body.kind === "attached");
            for (const sequence of [1, 2])
                send(a, { kind: "command", scope: old.scope, client: old.client, sequence, command: { kind: sequence === 1 ? "begin" : "edit" } });
            const detach = { kind: "detach", scope: old.scope, client: old.client };
            const forged = send(b, detach);
            const other = second.find(body => body.kind === "attached");
            send(b, { kind: "command", scope: other.scope, client: other.client, sequence: 1, command: { kind: "undo" } });
            const wrongScope = send(a, { ...detach, scope: { ...old.scope, document: old.scope.document + 1 } });
            const handled = send(a, detach);
            const repeated = send(a, detach);
            const lateCommand = send(a, { kind: "command", scope: old.scope, client: old.client, sequence: 3, command: { kind: "undo" } });
            send(a, { kind: "attach", request: 133 });
            const current = first.find(body => body.kind === "attached" && body.request === 133);
            const stale = send(a, detach);
            send(a, { kind: "command", scope: current.scope, client: current.client, sequence: 1, command: { kind: "undo" } });
            b.dispose();
            return { old, current, other, forged, wrongScope, handled, repeated, lateCommand, stale, messages: worker.messages };
        });
        assert.equal(result.forged, false);
        assert.equal(result.wrongScope, false);
        assert.equal(result.handled, true);
        assert.equal(result.repeated, false);
        assert.equal(result.lateCommand, false);
        assert.equal(result.stale, false);
        assert.notEqual(result.current.client, result.old.client);
        const detaches = result.messages.filter(body => body.kind === "detach" && body.client === result.old.client);
        assert.deepEqual(detaches, [{ kind: "detach", scope: result.old.scope, client: result.old.client, routedThrough: 2 }]);
        const commands = result.messages.filter(body => body.kind === "command");
        assert.deepEqual(commands.map(body => [body.address.client, body.address.sequence]),
            [[result.old.client, 1], [result.old.client, 2], [result.other.client, 1], [result.current.client, 1]]);
        assert.deepEqual(detachErrors, []);
    } finally {
        await detachPage.evaluate(async () => { try { await window.fixture?.connection.dispose(); } finally { await window.fixture?.context.close(); } });
        await detachPage.close();
    }
});

test("raw owned stored replacements fence actual worklet effects while preserving synchronous successive writes", { timeout: 15_000 }, async () => {
    const rawPage = await browser.newPage();
    const rawErrors = [];
    rawPage.on("pageerror", error => rawErrors.push(String(error)));
    try {
        await rawPage.goto(`http://127.0.0.1:${server.address().port}/?twoStoredKeys=1`);
        await rawPage.click("#start");
        await rawPage.waitForFunction(() => window.fixture?.worker.messages.some(body => body.kind === "opened"));
        await rawPage.evaluate(() => {
            const { connection } = window.fixture;
            window.rawMessages = [];
            connection.addEventListener("kit_state", body => window.rawMessages.push(body));
            connection.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 201 } });
            connection.sendEventOrValue("gain", 5.5);
        });
        await rawPage.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "parameter" && body.value === 5.5));
        const immediate = await rawPage.evaluate(async () => {
            const { connection } = window.fixture;
            const attached = window.rawMessages.find(body => body.kind === "attached");
            connection.sendStoredStateValue("unowned", "ordinary");
            connection.sendStoredStateValue("curve", connection.cachedState.curve);
            const exclusions = window.rawMessages.filter(body => body.kind === "reset").length;
            connection.sendMessageToServer({ type: "kit_state", message: {
                kind: "command", scope: attached.scope, client: attached.client, sequence: 1,
                command: { kind: "probe-late-after-replace", request: 202, operations: [
                    { kind: "stored", key: "curve", value: { points: [99] } },
                    { kind: "parameter", endpoint: "gain", value: 9 },
                    { kind: "event", endpoint: "curveBuffer", value: 20 },
                ] },
            }});
            connection.sendMessageToServer({ type: "kit_state", message: {
                kind: "command", scope: attached.scope, client: attached.client, sequence: 2,
                command: { kind: "probe-publish", request: 205, operations: [
                    { kind: "parameter", endpoint: "gain", value: 6 },
                    { kind: "event", endpoint: "curveBuffer", value: 20 },
                ] },
            }});
            // The first actual worklet handoff precedes the fence. It may
            // apply; the remaining event must not cross the raw replacement.
            await Promise.resolve();
            connection.sendStoredStateValue("curve", { points: [0.2, 0.8] });
            return { exclusions, oldScope: attached.scope, reset: window.rawMessages.find(body => body.kind === "reset"),
                curve: structuredClone(connection.cachedState.curve) };
        });
        assert.equal(immediate.exclusions, 0);
        assert.equal(immediate.reset?.scope.document, immediate.oldScope.document + 1,
            "raw owned stored write must revoke the old document synchronously");
        assert.deepEqual(immediate.curve, { points: [0.2, 0.8] }, "raw setter must retain synchronous cache visibility");
        await rawPage.waitForFunction(() => [202, 205].every(request => window.fixture.worker.messages.some(body => body.kind === "published" && body.request === request)));
        const replaced = await rawPage.evaluate(async () => ({
            replacement: window.fixture.worker.messages.find(body => body.kind === "replaced"),
            result: window.fixture.worker.messages.find(body => body.kind === "published" && body.request === 202).result,
            queuedResult: window.fixture.worker.messages.find(body => body.kind === "published" && body.request === 205).result,
            output: await window.fixture.readOutput(),
        }));
        assert.equal(replaced.replacement.changedStoredKey, "curve");
        assert.equal(replaced.replacement.native.parameters[0].value, 6, "raw replacement must preserve the first actual accepted handoff");
        assert.deepEqual(replaced.replacement.native.values.curve, { points: [0.2, 0.8] });
        assert.deepEqual(replaced.result, { kind: "failed", reason: "stale-scope" });
        assert.deepEqual(replaced.queuedResult, { kind: "failed", reason: "stale-scope" });
        assert.ok(Math.abs(replaced.output.min - 6) < 0.001 && Math.abs(replaced.output.max - 6) < 0.001);

        await rawPage.evaluate(() => {
            const { connection } = window.fixture;
            connection.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 206 } });
            const attached = window.rawMessages.find(body => body.kind === "attached" && body.request === 206);
            connection.sendMessageToServer({ type: "kit_state", message: {
                kind: "command", scope: attached.scope, client: attached.client, sequence: 1,
                command: { kind: "probe-publish", request: 206, operations: [
                    { kind: "event", endpoint: "curveBuffer", value: 0.25 },
                ] },
            }});
        });
        await rawPage.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "published" && body.request === 206));
        const currentPublication = await rawPage.evaluate(async () => ({
            publication: window.fixture.worker.messages.find(body => body.kind === "published" && body.request === 206),
            output: await window.fixture.readOutput(),
        }));
        assert.deepEqual(currentPublication.publication.result, { kind: "observed" });
        assert.equal(currentPublication.publication.scope.document, 1);
        assert.ok(Math.abs(currentPublication.output.min - 6.25) < 0.001 && Math.abs(currentPublication.output.max - 6.25) < 0.001,
            "actual worklet must accept the current document after its raw-write barrier");

        const successive = await rawPage.evaluate(() => {
            const { connection } = window.fixture;
            connection.sendStoredStateValue("curve", { points: [0.3, 0.7] });
            connection.sendStoredStateValue("shape", { points: [0.4, 0.6] });
            return { cache: structuredClone(connection.cachedState), resets: window.rawMessages.filter(body => body.kind === "reset") };
        });
        assert.deepEqual(successive.cache.curve, { points: [0.3, 0.7] });
        assert.deepEqual(successive.cache.shape, { points: [0.4, 0.6] });
        assert.deepEqual(successive.resets.map(body => body.scope.document), [1, 2, 3]);
        await rawPage.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "replaced" && body.scope.document === 3));
        const afterSuccessive = await rawPage.evaluate(() => ({
            replacement: window.fixture.worker.messages.find(body => body.kind === "replaced" && body.scope.document === 3),
            cache: window.fixture.connection.cachedState,
        }));
        assert.equal(afterSuccessive.replacement.changedStoredKey, "shape");
        assert.equal(afterSuccessive.replacement.native.parameters[0].value, 6);
        assert.deepEqual(afterSuccessive.replacement.native.values.curve, { points: [0.3, 0.7] });
        assert.deepEqual(afterSuccessive.replacement.native.values.shape, { points: [0.4, 0.6] });
        assert.deepEqual(afterSuccessive.cache, successive.cache, "superseded native completion must not drop an earlier different-key write");

        await rawPage.evaluate(() => {
            const { connection } = window.fixture;
            connection.sendFullStoredState({ parameters: [{ name: "gain", value: 4 }], values: {
                curve: { points: [1, 0] }, shape: { points: [0, 1] },
            } });
        });
        await rawPage.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "replaced" && body.scope.document === 4));
        const full = await rawPage.evaluate(() => ({
            resetCount: window.rawMessages.filter(body => body.kind === "reset").length,
            replacement: window.fixture.worker.messages.find(body => body.kind === "replaced" && body.scope.document === 4),
        }));
        assert.equal(full.resetCount, 4, "full restore must not repeat its barrier for each owned key");
        assert.equal(Object.hasOwn(full.replacement, "changedStoredKey"), false);

        await rawPage.evaluate(() => {
            const { connection } = window.fixture;
            connection.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 203 } });
            const attached = window.rawMessages.find(body => body.kind === "attached" && body.request === 203);
            let wrote = false;
            connection.addStoredStateValueListener(body => {
                if (!wrote && body.key === "curve") {
                    wrote = true;
                    connection.sendStoredStateValue("shape", { points: [0.6, 0.4] });
                }
            });
            connection.sendMessageToServer({ type: "kit_state", message: {
                kind: "command", scope: attached.scope, client: attached.client, sequence: 1,
                command: { kind: "probe-publish", request: 204, operations: [
                    { kind: "stored", key: "curve", value: { points: [0.5, 0.5] } },
                    { kind: "stored", key: "shape", value: { points: [99] } },
                    { kind: "parameter", endpoint: "gain", value: 9 },
                    { kind: "event", endpoint: "curveBuffer", value: 20 },
                ] },
            }});
        });
        await rawPage.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "published" && body.request === 204));
        const reentrant = await rawPage.evaluate(async () => ({
            result: window.fixture.worker.messages.find(body => body.kind === "published" && body.request === 204).result,
            cache: window.fixture.connection.cachedState,
            resetCount: window.rawMessages.filter(body => body.kind === "reset").length,
            output: await window.fixture.readOutput(),
        }));
        assert.deepEqual(reentrant.result, { kind: "failed", reason: "stale-scope" });
        assert.equal(reentrant.resetCount, 5, "reentrant raw write must not borrow owner-publication suppression");
        assert.deepEqual(reentrant.cache.shape, { points: [0.6, 0.4] });
        assert.ok(Math.abs(reentrant.output.min - 4.25) < 0.001 && Math.abs(reentrant.output.max - 4.25) < 0.001);
        assert.deepEqual(rawErrors, []);
    } finally {
        await rawPage.evaluate(async () => { try { await window.fixture?.connection.dispose(); } finally { await window.fixture?.context.close(); } });
        await rawPage.close();
    }
});

test("declared browser host effect without a consumer reports unsupported without closing editable state", { timeout: 15_000 }, async () => {
    const hostPage = await browser.newPage();
    const hostErrors = [];
    hostPage.on("pageerror", error => hostErrors.push(String(error)));
    try {
        await hostPage.goto(`http://127.0.0.1:${server.address().port}/?hostEffects=1`);
        await hostPage.click("#start");
        await hostPage.waitForFunction(() => window.fixture || window.fixtureError);
        assert.equal(await hostPage.evaluate(() => window.fixtureError), null);
        await hostPage.evaluate(() => {
            const { connection } = window.fixture;
            window.hostMessages = [];
            connection.addEventListener("kit_state", body => window.hostMessages.push(body));
            connection.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 301 } });
            const attached = window.hostMessages.find(body => body.kind === "attached" && body.request === 301);
            connection.sendMessageToServer({ type: "kit_state", message: {
                kind: "command", scope: attached.scope, client: attached.client, sequence: 1,
                command: { kind: "probe-publish", request: 301, operations: [
                    { kind: "host-effect", name: "trigger-config", value: { slot: 7 } },
                ] },
            }});
        });
        await hostPage.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "published" && body.request === 301));
        const result = await hostPage.evaluate(() => ({
            publication: window.fixture.worker.messages.find(body => body.kind === "published" && body.request === 301),
            closed: window.hostMessages.filter(body => body.kind === "closed"),
        }));
        assert.deepEqual(result.publication.result, { kind: "failed", reason: "unsupported-host-effect" });
        assert.deepEqual(result.closed, []);
        assert.deepEqual(hostErrors, []);
    } finally {
        await hostPage.evaluate(async () => { try { await window.fixture?.connection.dispose(); } finally { await window.fixture?.context.close(); } });
        await hostPage.close();
    }
});

test("actual browser host effects are synchronous, declared, and fenced after queued worklet delivery", { timeout: 15_000 }, async () => {
    const hostPage = await browser.newPage();
    const hostErrors = [];
    hostPage.on("pageerror", error => hostErrors.push(String(error)));
    try {
        await hostPage.goto(`http://127.0.0.1:${server.address().port}/?hostEffects=1`);
        await hostPage.evaluate(() => {
            window.hostCalls = [];
            window.fixtureHostEffect = (name, value) => {
                window.hostCalls.push({ name, value: structuredClone(value) });
                if (value.mode === "reject") return false;
                if (value.mode === "throw") throw new Error("host callback defect");
                if (value.mode === "promise") return Promise.reject(new Error("asynchronous handler is invalid"));
                if (value.mode === "restore") window.fixture.connection.sendStoredStateValue("curve", { points: [0.4, 0.6] });
                return true;
            };
        });
        await hostPage.click("#start");
        await hostPage.waitForFunction(() => window.fixture || window.fixtureError);
        assert.equal(await hostPage.evaluate(() => window.fixtureError), null);
        await hostPage.evaluate(() => {
            const { connection } = window.fixture;
            window.hostMessages = [];
            connection.addEventListener("kit_state", body => {
                window.hostMessages.push(body);
                if (body.kind === "attached") { window.hostAttachment = body; window.hostSequence = 0; }
                if (body.kind === "reset") window.hostAttachment = undefined;
            });
            window.attachHost = request => connection.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request } });
            window.sendHost = (request, operations) => {
                const attached = window.hostAttachment;
                if (!attached) throw new Error("host probe is not attached");
                connection.sendMessageToServer({ type: "kit_state", message: {
                    kind: "command", scope: attached.scope, client: attached.client, sequence: ++window.hostSequence,
                    command: { kind: "probe-publish", request, operations },
                }});
            };
            window.attachHost(401);
            window.sendHost(401, [
                { kind: "event", endpoint: "curveBuffer", value: 0.5 },
                { kind: "host-effect", name: "trigger-config", value: { slot: 7 } },
            ]);
        });
        const publication = async request => {
            await hostPage.waitForFunction(request => window.fixture.worker.messages.some(body => body.kind === "published" && body.request === request), request);
            return hostPage.evaluate(request => window.fixture.worker.messages.find(body => body.kind === "published" && body.request === request), request);
        };
        assert.deepEqual((await publication(401)).result, { kind: "observed" });
        assert.deepEqual(await hostPage.evaluate(() => window.hostCalls), [{ name: "trigger-config", value: { slot: 7 } }]);

        await hostPage.evaluate(() => window.sendHost(402, [
            { kind: "host-effect", name: "trigger-config", value: { slot: 8 } },
            { kind: "host-effect", name: "undeclared", value: null },
        ]));
        assert.deepEqual((await publication(402)).result, { kind: "failed", reason: "invalid-publication" });
        assert.equal(await hostPage.evaluate(() => window.hostCalls.length), 1, "whole-publication declaration validation must precede callback invocation");
        for (const [request, mode, reason] of [[403, "reject", "host-effect-rejected"], [404, "throw", "host-effect-failed"], [405, "promise", "host-effect-rejected"]]) {
            await hostPage.evaluate(({ request, mode }) => window.sendHost(request, [
                { kind: "host-effect", name: "trigger-config", value: { mode } },
                { kind: "event", endpoint: "curveBuffer", value: 20 },
            ]), { request, mode });
            assert.deepEqual((await publication(request)).result, { kind: "failed", reason });
        }
        const afterFailures = await hostPage.evaluate(async () => ({ output: await window.fixture.readOutput(), closed: window.hostMessages.filter(body => body.kind === "closed") }));
        assert.ok(Math.abs(afterFailures.output.min - 3) < 0.001 && Math.abs(afterFailures.output.max - 3) < 0.001,
            "failed host callback must fence the remaining DSP operation");
        assert.deepEqual(afterFailures.closed, []);

        await hostPage.evaluate(async () => {
            window.sendHost(406, [
                { kind: "event", endpoint: "curveBuffer", value: 1 },
                { kind: "host-effect", name: "trigger-config", value: { slot: 99 } },
            ]);
            // The first operation reaches the actual worklet port before the
            // native completion. Only its still-unsent callback is revoked.
            await Promise.resolve();
            window.fixture.connection.sendStoredStateValue("curve", { points: [0.2, 0.8] });
        });
        assert.deepEqual((await publication(406)).result, { kind: "failed", reason: "stale-scope" });
        await hostPage.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "replaced" && body.scope.document === 1));
        const afterRaw = await hostPage.evaluate(async () => ({ calls: window.hostCalls, output: await window.fixture.readOutput() }));
        assert.equal(afterRaw.calls.length, 4, "callback queued behind a worklet completion crossed the document barrier");
        assert.ok(Math.abs(afterRaw.output.min - 3.5) < 0.001 && Math.abs(afterRaw.output.max - 3.5) < 0.001,
            "first DSP operation must really cross the port before the raw barrier");

        await hostPage.evaluate(() => {
            window.attachHost(407);
            window.sendHost(407, [
                { kind: "event", endpoint: "curveBuffer", value: 0.25 },
                { kind: "host-effect", name: "trigger-config", value: { slot: 8 } },
            ]);
        });
        assert.deepEqual((await publication(407)).result, { kind: "observed" });
        const current = await hostPage.evaluate(async () => ({ calls: window.hostCalls, output: await window.fixture.readOutput() }));
        assert.equal(current.calls.length, 5);
        assert.deepEqual(current.calls[4], { name: "trigger-config", value: { slot: 8 } });
        assert.ok(Math.abs(current.output.min - 2.75) < 0.001 && Math.abs(current.output.max - 2.75) < 0.001);

        await hostPage.evaluate(() => window.sendHost(408, [
            { kind: "host-effect", name: "trigger-config", value: { mode: "restore" } },
            { kind: "host-effect", name: "trigger-config", value: { slot: 99 } },
            { kind: "event", endpoint: "curveBuffer", value: 20 },
        ]));
        assert.deepEqual((await publication(408)).result, { kind: "failed", reason: "stale-scope" });
        await hostPage.waitForFunction(() => window.fixture.worker.messages.some(body => body.kind === "replaced" && body.scope.document === 2));
        assert.equal(await hostPage.evaluate(() => window.hostCalls.length), 6, "reentrant host callback failed to fence its remainder");
        await hostPage.evaluate(() => {
            window.attachHost(409);
            window.sendHost(409, [
                { kind: "host-effect", name: "trigger-config", value: { slot: 9 } },
                { kind: "event", endpoint: "curveBuffer", value: 0.5 },
            ]);
        });
        assert.deepEqual((await publication(409)).result, { kind: "observed" });
        const final = await hostPage.evaluate(async () => ({ calls: window.hostCalls, output: await window.fixture.readOutput() }));
        assert.equal(final.calls.length, 7);
        assert.deepEqual(final.calls[6], { name: "trigger-config", value: { slot: 9 } });
        assert.ok(Math.abs(final.output.min - 3) < 0.001 && Math.abs(final.output.max - 3) < 0.001);
        assert.deepEqual(hostErrors, []);
    } finally {
        await hostPage.evaluate(async () => { try { await window.fixture?.connection.dispose(); } finally { await window.fixture?.context.close(); } });
        await hostPage.close();
    }
});
