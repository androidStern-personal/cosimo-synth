import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "build", "web");
let browser;
let server;
let baseUrl;

function contentType(filePath) {
    const extension = path.extname(filePath);
    if (extension === ".html") return "text/html; charset=utf-8";
    if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
    if (extension === ".json") return "application/json; charset=utf-8";
    if (extension === ".svg") return "image/svg+xml";
    if (extension === ".png") return "image/png";
    if (extension === ".ttf") return "font/ttf";
    return "application/octet-stream";
}

async function serve(request, response) {
    try {
        const requestUrl = new URL(request.url ?? "/", baseUrl);
        const relative = decodeURIComponent(
            requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1),
        );
        const filePath = path.resolve(webRoot, relative);
        if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${path.sep}`)) {
            response.writeHead(403).end("Forbidden");
            return;
        }
        const bytes = await fs.readFile(filePath);
        response.writeHead(200, {
            "cache-control": "no-store",
            "content-type": contentType(filePath),
        });
        response.end(bytes);
    } catch (error) {
        response.writeHead(error?.code === "ENOENT" ? 404 : 500).end(String(error));
    }
}

before(async () => {
    server = createServer(serve);
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}/`;
    browser = await chromium.launch({
        headless: true,
        ignoreDefaultArgs: ["--mute-audio"],
    });
});

after(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
});

async function createTestPage() {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
        const nativeWorker = globalThis.Worker;
        globalThis.Worker = new Proxy(nativeWorker, {
            construct(target, argumentsList, newTarget) {
                if (String(argumentsList[0]).includes("bounce-render-worker")) {
                    const count = Number(sessionStorage.getItem("cosimo.bounce.worker-count") ?? 0) + 1;
                    sessionStorage.setItem("cosimo.bounce.worker-count", String(count));
                }
                return Reflect.construct(target, argumentsList, newTarget);
            },
        });
    });
    await page.goto(`${baseUrl}?test`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
        () => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready",
        null,
        { timeout: 120_000 },
    );
    return { context, page };
}

async function persistAudibleBounce(page) {
    return page.evaluate(async () => {
        const [{ buildBounceBank, encodeBounceBank }, { createBrowserBounceBankStore }, digestModule, documentModule] = await Promise.all([
            import("./bounce/bank-format.mjs"),
            import("./bounce/browser-bank-store.mjs"),
            import("./bounce/digest.mjs"),
            import("./bounce/document.mjs"),
        ]);
        const frameCount = 240_000;
        const samples = new Int16Array(frameCount * 2);
        for (let frame = 0; frame < frameCount; frame += 1) {
            const sample = Math.round(Math.sin((frame * Math.PI * 2 * 220) / 48_000) * 1_500);
            samples[frame * 2] = sample;
            samples[(frame * 2) + 1] = sample;
        }
        const bank = buildBounceBank({
            sampleRate: 48_000,
            roots: [{ note: 60, samples }],
        });
        const bytes = encodeBounceBank(bank);
        const digest = await digestModule.digestBounceBank(bytes);
        const persistence = await createBrowserBounceBankStore().put(digest, bytes);
        const bounce = documentModule.parseBounceDocument({
            format: "cosimo.bounce",
            version: 1,
            digest,
            bankByteLength: bytes.byteLength,
            roots: [60],
            segments: [{
                rootNote: 60,
                frameOffset: 0,
                frameCount,
                noteOffFrameOffset: 120_000,
            }],
            capture: {
                sampleRate: 48_000,
                tempoBpm: 120,
                velocity: 100,
                holdFrames: 120_000,
                tailCapFrames: 120_000,
            },
            generation: 1,
            revertRef: {
                bankDigest: null,
                patchDocument: documentModule.createBouncePatchDocument({
                    parameters: { filterMode: 0, sourceMode: 0 },
                    storedState: { [documentModule.BOUNCE_STATE_KEY]: null },
                }),
            },
        });
        localStorage.setItem("cosimo.web.patch-state.v2", JSON.stringify({
            format: "cosimo.browserPatchState",
            version: 5,
            sound: {
                parameters: { ampRelease: 0.2, filterMode: 0, sourceMode: 1 },
                storedState: {
                    [documentModule.BOUNCE_STATE_KEY]: documentModule.serializeBounceDocument(bounce),
                },
            },
            auxiliary: {},
        }));
        return { digest, persistence };
    });
}

test("OPFS bounce survives reload, installs into the live sampler, and plays without re-render", async () => {
    const { context, page } = await createTestPage();
    try {
        const persisted = await persistAudibleBounce(page);
        assert.equal(persisted.persistence.backend, "opfs");

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(
            () => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready",
            null,
            { timeout: 120_000 },
        );
        assert.equal(
            (await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot())).bounceRestore.status,
            "pending-audio-start",
        );
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            return snapshot?.phase === "running" && snapshot?.bounceRestore.status === "ready";
        }, null, { timeout: 120_000 });
        const restored = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        assert.equal(restored.bounceRestore.digest, persisted.digest);
        assert.equal(restored.parameterValues.sourceMode, 1);

        await page.evaluate(() => {
            globalThis.__COSIMO_WEB_POC__.resetAudioMetrics();
            globalThis.__COSIMO_WEB_POC__.noteOn(60, 100);
        });
        await page.waitForFunction(
            () => globalThis.__COSIMO_WEB_POC__.getSnapshot().audioPeak > 0.001,
            null,
            { timeout: 20_000 },
        );
        const audible = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        assert.ok(audible.audioPeak > 0.001, `Expected sampled audio, measured peak ${audible.audioPeak}`);
        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.noteOff(60));
        assert.equal(
            await page.evaluate(() => Number(sessionStorage.getItem("cosimo.bounce.worker-count") ?? 0)),
            0,
        );
    } finally {
        await context.close();
    }
});

test("missing bank reload exposes a visible typed error and preserves durable sampled intent", async () => {
    const { context, page } = await createTestPage();
    try {
        await page.evaluate(async () => {
            const documentModule = await import("./bounce/document.mjs");
            const bounce = documentModule.parseBounceDocument({
                format: "cosimo.bounce",
                version: 1,
                digest: "0".repeat(64),
                bankByteLength: 1_024,
                roots: [60],
                segments: [{ rootNote: 60, frameOffset: 0, frameCount: 64, noteOffFrameOffset: 32 }],
                capture: {
                    sampleRate: 48_000,
                    tempoBpm: 120,
                    velocity: 100,
                    holdFrames: 32,
                    tailCapFrames: 32,
                },
                generation: 1,
                revertRef: {
                    bankDigest: null,
                    patchDocument: documentModule.createBouncePatchDocument({
                        parameters: { filterMode: 0, sourceMode: 0 },
                        storedState: { [documentModule.BOUNCE_STATE_KEY]: null },
                    }),
                },
            });
            localStorage.setItem("cosimo.web.patch-state.v2", JSON.stringify({
                format: "cosimo.browserPatchState",
                version: 5,
                sound: {
                    parameters: { filterMode: 0, sourceMode: 1 },
                    storedState: {
                        [documentModule.BOUNCE_STATE_KEY]: documentModule.serializeBounceDocument(bounce),
                    },
                },
                auxiliary: {},
            }));
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(
            () => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready",
            null,
            { timeout: 120_000 },
        );
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            return snapshot?.phase === "running" && snapshot?.bounceRestore.status === "error";
        }, null, { timeout: 120_000 });

        const snapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        assert.equal(snapshot.bounceRestore.error.code, "missing-bank");
        assert.equal(snapshot.parameterValues.sourceMode, 0);
        await assert.doesNotReject(page.locator("#cosimo-error").waitFor({ state: "visible" }));
        assert.match(await page.locator("#cosimo-error").innerText(), /oscillator fallback is active/i);
        const durableSourceMode = await page.evaluate(() => (
            JSON.parse(localStorage.getItem("cosimo.web.patch-state.v2")).sound.parameters.sourceMode
        ));
        assert.equal(durableSourceMode, 1);
        assert.equal(
            await page.evaluate(() => Number(sessionStorage.getItem("cosimo.bounce.worker-count") ?? 0)),
            0,
        );
    } finally {
        await context.close();
    }
});
