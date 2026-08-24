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
    if (extension === ".css") return "text/css; charset=utf-8";
    if (extension === ".json") return "application/json; charset=utf-8";
    if (extension === ".woff2") return "font/woff2";
    if (extension === ".svg") return "image/svg+xml";
    return "application/octet-stream";
}

async function serve(request, response) {
    try {
        const requestUrl = new URL(request.url ?? "/", baseUrl);
        let relative = decodeURIComponent(requestUrl.pathname.slice(1));
        if (relative.length === 0 || relative.endsWith("/")) relative += "index.html";
        const filePath = path.resolve(webRoot, relative);
        if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${path.sep}`)) {
            response.writeHead(403).end("Forbidden");
            return;
        }
        const bytes = await fs.readFile(filePath);
        response.writeHead(200, { "cache-control": "no-store", "content-type": contentType(filePath) });
        response.end(bytes);
    } catch (error) {
        response.writeHead(error?.code === "ENOENT" ? 404 : 500).end(String(error));
    }
}

before(async () => {
    server = createServer((request, response) => void serve(request, response));
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
});

function probe(report, name) {
    const result = report.probes.find((candidate) => candidate.name === name);
    assert.ok(result, `Missing ${name} probe: ${JSON.stringify(report)}`);
    return result;
}

function interactionFrames(targetProbe, kind) {
    return targetProbe.inspections.filter(({ interaction }) => interaction.activeOpKind === kind);
}

test("M2 drives real DesktopPatchView gesture transients inside the capture stage", {
    timeout: 900_000,
}, async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.goto(`${baseUrl}scripted-test/scripted-browser-harness.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => (
        typeof window.__COSIMO_SCRIPTED_SESSION_HARNESS__?.renderGestures === "function"
    ));
    const report = await page.evaluate(() => (
        window.__COSIMO_SCRIPTED_SESSION_HARNESS__.renderGestures()
    ));

    assert.ok(report.durationInFrames > 300, JSON.stringify(report));
    assert.equal(report.probes.length, 4);
    for (const rendered of report.probes) {
        assert.ok(rendered.blobBytes > 3_000, JSON.stringify(rendered));
        assert.match(rendered.iframeRafMode, /^(visibility-hidden|opacity-fallback)$/u);
        assert.ok(rendered.inspections.length > 5, JSON.stringify(rendered));
        for (const inspection of rendered.inspections) {
            assert.deepEqual(inspection.viewport, { width: 393, height: 852 });
            assert.equal(inspection.scaffoldHitTestable, true);
        }
    }

    const sources = probe(report, "sources");
    const mseg = interactionFrames(sources, "configureMseg");
    assert.ok(mseg.some(({ interaction }) => (
        interaction.pointerActive
        && interaction.pointerTargetRole === "mod-source-mseg-surface"
        && interaction.selectedMsegPointCount >= 1
    )), JSON.stringify(mseg));

    const envelopeTargets = new Set(interactionFrames(sources, "setEnvelope")
        .filter(({ interaction }) => interaction.pointerActive)
        .map(({ interaction }) => interaction.pointerTargetRole));
    assert.ok(envelopeTargets.has("adsr-attack-handle-hit-target"), JSON.stringify([...envelopeTargets]));
    assert.ok(envelopeTargets.has("adsr-decay-sustain-handle-hit-target"), JSON.stringify([...envelopeTargets]));
    assert.ok(envelopeTargets.has("adsr-release-handle-hit-target"), JSON.stringify([...envelopeTargets]));

    const macro = interactionFrames(sources, "setMacro");
    assert.ok(macro.some(({ interaction }) => (
        interaction.pointerActive && interaction.pointerTargetRole === "macro-source-value-2"
    )), JSON.stringify(macro));

    const voice = probe(report, "voice");
    const wavetable = interactionFrames(voice, "selectWavetable");
    assert.ok(wavetable.some(({ interaction }) => (
        interaction.wavetableText?.startsWith("Loading Basic_Cjw")
    )), JSON.stringify(wavetable));

    const parameterDrag = interactionFrames(voice, "setParam").find(({ interaction }) => (
        interaction.activeOpSurface === "mobile-voice-cell-A-WavetablePosition"
        && interaction.pointerActive
        && interaction.pointerTargetRole === "mobile-voice-cell-framePosition"
        && interaction.dragging.some(({ role, mode }) => (
            role === "mobile-voice-cell-framePosition" && mode === "base"
        ))
        && interaction.hud?.visible === true
    ));
    assert.ok(parameterDrag, JSON.stringify(interactionFrames(voice, "setParam")));
    assert.match(parameterDrag.interaction.hud.baseText, /\d+%/u);

    const filterMap = interactionFrames(probe(report, "filter-map"), "mapRoute");
    assert.ok(filterMap.some(({ interaction }) => interaction.ghost.present), JSON.stringify(filterMap));
    assert.ok(filterMap.some(({ interaction }) => (
        interaction.ghost.targetCaptured
        && interaction.hoverTargetRole === "filter-graph-drop-surface"
    )), JSON.stringify(filterMap));

    const fx = probe(report, "fx-map");
    const toggles = interactionFrames(fx, "toggleEffect");
    assert.ok(toggles.some(({ interaction }) => (
        interaction.activeEffect?.deviceId === "delay#2" && interaction.activeEffect.enabled
    )), JSON.stringify(toggles));

    const laneDrags = interactionFrames(fx, "setLaneParam");
    assert.ok(laneDrags.some(({ interaction }) => (
        interaction.pointerActive
        && interaction.dragging.some(({ role, mode }) => role.startsWith("rack-parameter-") && mode === "base")
        && interaction.hud?.visible === true
    )), JSON.stringify(laneDrags));

    const fxMap = interactionFrames(fx, "mapRoute");
    assert.ok(fxMap.some(({ interaction }) => interaction.ghost.present), JSON.stringify(fxMap));
    assert.ok(fxMap.some(({ interaction }) => (
        interaction.ghost.targetCaptured
        && interaction.hoverTargetRole === "rack-parameter-surface-delayMix"
    )), JSON.stringify(fxMap));
    assert.ok(fxMap.some(({ interaction }) => (
        interaction.confirmedTargetRole === "rack-parameter-surface-delayMix"
    )), JSON.stringify(fxMap));

    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({ videoBounceM2Gestures: {
        durationInFrames: report.durationInFrames,
        probes: report.probes.map(({ name, startFrame, endFrame, blobBytes, inspections }) => ({
            name,
            startFrame,
            endFrame,
            blobBytes,
            inspectedFrames: inspections.length,
        })),
    } })}`);
    await page.close();
});
