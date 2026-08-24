import assert from "node:assert/strict";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { routeHermeticPage } from "./helpers/hermetic_page.mjs";
import { startStaticWebServer } from "./helpers/static_web_server.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "build", "web");
let browser;
let server;

before(async () => {
    server = await startStaticWebServer(webRoot);
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

function probe(report, name) {
    const result = report.probes.find((candidate) => candidate.name === name);
    assert.ok(result, `Missing ${name} probe: ${JSON.stringify(report)}`);
    return result;
}

function interactionFrames(targetProbe, kind) {
    return targetProbe.inspections.filter(({ interaction }) => interaction.activeOpKind === kind);
}

function pixelProbeAt(targetProbe, frame) {
    return targetProbe.pixelProbes.find((candidate) => candidate.frame === frame) ?? null;
}

function rectInsidePhone(inspection, name) {
    const rect = inspection.rects[name];
    const phone = inspection.rects.phone;
    assert.ok(rect && phone, `${name} or phone rect missing at frame ${inspection.frame}`);
    assert.ok(
        rect.left >= phone.left - 1
        && rect.top >= phone.top - 1
        && rect.left + rect.width <= phone.left + phone.width + 1
        && rect.top + rect.height <= phone.top + phone.height + 1,
        `${name} rect ${JSON.stringify(rect)} escapes the phone ${JSON.stringify(phone)} at frame ${inspection.frame}`,
    );
}

test("M2 drives real DesktopPatchView gesture transients that PAINT inside the phone", {
    timeout: 900_000,
}, async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await routeHermeticPage(page, server.baseUrl);
    await page.goto(`${server.baseUrl}scripted-test/scripted-browser-harness.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => (
        typeof window.__COSIMO_SCRIPTED_SESSION_HARNESS__?.renderGestures === "function"
    ));
    const report = await page.evaluate(() => (
        window.__COSIMO_SCRIPTED_SESSION_HARNESS__.renderGestures()
    ));

    assert.ok(report.durationInFrames > 300, JSON.stringify({ durationInFrames: report.durationInFrames }));
    assert.equal(report.probes.length, 4);
    for (const rendered of report.probes) {
        assert.ok(rendered.blobBytes > 3_000, `blobBytes ${rendered.blobBytes}`);
        assert.match(rendered.iframeRafMode, /^(visibility-hidden|opacity-fallback)$/u);
        assert.ok(rendered.inspections.length > 5, JSON.stringify(rendered.name));
        for (const inspection of rendered.inspections) {
            assert.deepEqual(inspection.viewport, { width: 393, height: 852 });
            assert.equal(inspection.scaffoldHitTestable, true);
        }
        // Every scripted op in the rendered window drove a real control.
        const finalInspection = rendered.inspections.at(-1);
        assert.deepEqual(
            finalInspection.interaction.missedOps.filter(({ startFrame }) => (
                startFrame >= rendered.startFrame && startFrame <= rendered.endFrame
            )),
            [],
            `${rendered.name} missed scripted ops`,
        );
        // The mod rail paints on every frame of the shipped composition.
        for (const framePixels of rendered.pixelProbes) {
            const rail = framePixels.regions.rail;
            assert.ok(
                rail && rail.lumaRange > 24,
                `${rendered.name} frame ${framePixels.frame}: rail paints flat (${JSON.stringify(rail)})`,
            );
        }
    }

    const sources = probe(report, "sources");
    const mseg = interactionFrames(sources, "configureMseg");
    assert.ok(mseg.some(({ interaction }) => (
        interaction.pointerActive
        && interaction.pointerTargetRole === "mod-source-mseg-surface"
        && interaction.selectedMsegPointCount >= 1
    )), JSON.stringify(mseg.map(({ interaction }) => interaction)));

    // Real product DOM: the envelope editor's own active-handle output
    // attribute, not the director's pointer bookkeeping.
    const envelopeHandles = new Set(interactionFrames(sources, "setEnvelope")
        .map(({ adsrActiveHandle }) => adsrActiveHandle)
        .filter((handle) => handle !== null));
    assert.ok(envelopeHandles.has("attack"), JSON.stringify([...envelopeHandles]));
    assert.ok(envelopeHandles.has("decay-sustain"), JSON.stringify([...envelopeHandles]));
    assert.ok(envelopeHandles.has("release"), JSON.stringify([...envelopeHandles]));

    // Real product DOM: the live macro input's value approaches the recipe
    // target by the end of its span.
    const macroKey = `macro-source-value-${report.expectations.macro.slot}`;
    const macroValues = interactionFrames(sources, "setMacro")
        .map(({ macroValues: values }) => values[macroKey])
        .filter((value) => Number.isFinite(value));
    assert.ok(macroValues.length > 0, "macro input never inspected");
    const macroTarget = report.expectations.macro.value;
    assert.ok(
        Math.abs(macroValues.at(-1) - macroTarget) <= Math.max(0.1, Math.abs(macroTarget) * 0.2),
        `macro ended at ${macroValues.at(-1)}, target ${macroTarget}`,
    );

    const voice = probe(report, "voice");
    const wavetable = interactionFrames(voice, "selectWavetable");
    assert.ok(wavetable.some(({ interaction }) => (
        interaction.wavetableText?.startsWith("Loading Basic_Cjw")
    )), JSON.stringify(wavetable.map(({ interaction }) => interaction.wavetableText)));

    const parameterDrag = interactionFrames(voice, "setParam").find(({ interaction }) => (
        interaction.activeOpSurface === "mobile-voice-cell-A-WavetablePosition"
        && interaction.pointerActive
        && interaction.pointerTargetRole === "mobile-voice-cell-framePosition"
        && interaction.dragging.some(({ role, mode }) => (
            role === "mobile-voice-cell-framePosition" && mode === "base"
        ))
        && interaction.hud?.visible === true
    ));
    assert.ok(parameterDrag, JSON.stringify(interactionFrames(voice, "setParam")
        .map(({ interaction }) => interaction)));
    assert.match(parameterDrag.interaction.hud.baseText, /\d+%/u);
    // The HUD is painted pixels inside the phone, not just a visible class.
    rectInsidePhone(parameterDrag, "hud");
    const hudPixels = pixelProbeAt(voice, parameterDrag.frame)?.regions.hud;
    assert.ok(
        hudPixels && hudPixels.lumaRange > 40,
        `HUD paints flat at frame ${parameterDrag.frame}: ${JSON.stringify(hudPixels)}`,
    );

    // Snap correction: the first frame after the drag span shows the exact
    // recipe target on the real readout.
    const snapInspection = voice.inspections.find(({ frame }) => (
        frame >= report.expectations.voiceParam.snapFrame
    ));
    assert.ok(snapInspection, "snap frame was not rendered");
    const expectedPercent = `${Math.round(report.expectations.voiceParam.to * 100)}%`;
    assert.ok(
        snapInspection.framePositionText?.includes(expectedPercent),
        `readout "${snapInspection.framePositionText}" missing snapped ${expectedPercent}`,
    );

    for (const [probeName, hoverRole] of [
        ["filter-map", "filter-graph-drop-surface"],
        ["fx-map", "rack-parameter-surface-delayMix"],
    ]) {
        const mapProbe = probe(report, probeName);
        const mapFrames = interactionFrames(mapProbe, "mapRoute");
        const ghostFrame = mapFrames.find(({ interaction }) => interaction.ghost.present);
        assert.ok(ghostFrame, `${probeName}: ghost never present`);
        // The ghost must live INSIDE the phone (the off-canvas regression) and
        // must be painted saturated source-color pixels.
        rectInsidePhone(ghostFrame, "ghost");
        const ghostPixels = pixelProbeAt(mapProbe, ghostFrame.frame)?.regions.ghost;
        assert.ok(
            ghostPixels && ghostPixels.maxSaturation > 40,
            `${probeName}: ghost paints flat at frame ${ghostFrame.frame}: ${JSON.stringify(ghostPixels)}`,
        );
        assert.ok(mapFrames.some(({ interaction }) => (
            interaction.ghost.targetCaptured && interaction.hoverTargetRole === hoverRole
        )), `${probeName}: capture highlight never reached ${hoverRole}`);
    }

    const fx = probe(report, "fx-map");
    const toggles = interactionFrames(fx, "toggleEffect");
    assert.ok(toggles.some(({ interaction }) => (
        interaction.activeEffect?.deviceId === "delay#2" && interaction.activeEffect.enabled
    )), JSON.stringify(toggles.map(({ interaction }) => interaction.activeEffect)));

    const laneDrags = interactionFrames(fx, "setLaneParam");
    assert.ok(laneDrags.some(({ interaction }) => (
        interaction.pointerActive
        && interaction.dragging.some(({ role, mode }) => role.startsWith("rack-parameter-") && mode === "base")
        && interaction.hud?.visible === true
    )), JSON.stringify(laneDrags.map(({ interaction }) => interaction.dragging)));

    const fxMap = interactionFrames(fx, "mapRoute");
    assert.ok(fxMap.some(({ interaction }) => (
        interaction.confirmedTargetRole === "rack-parameter-surface-delayMix"
    )), JSON.stringify(fxMap.map(({ interaction }) => interaction.confirmedTargetRole)));

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
