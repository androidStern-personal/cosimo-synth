import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test, { after, before } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { deflateSync } from "node:zlib";

import { chromium, webkit } from "playwright";

import { startDesktopHarnessServer, waitForHarnessReady } from "./helpers/desktop_harness_browser.mjs";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const factoryCatalog = JSON.parse(fs.readFileSync(
    path.join(repoRoot, "assets/factory-bank-catalog.json"),
    "utf8",
));
const productionSynthSource = fs.readFileSync(
    path.join(repoRoot, "cmajor/WavetableSynth.cmajor"),
    "utf8",
);
const productionGraphStart = productionSynthSource.indexOf("graph WavetableSynth");
const productionRackStart = productionSynthSource.indexOf("    input rack.laneTopology;", productionGraphStart);
if (productionGraphStart < 0 || productionRackStart < 0) {
    throw new Error("Production synth parameter block is missing.");
}
const productionParameterPattern = /^\s*input (?:(?:value\s+[^\s]+\s+([A-Za-z_][A-Za-z0-9_]*)\s+\[\[([^\]]*)\]\])|(?:rack\.([A-Za-z_][A-Za-z0-9_]*)))\s*;/gmu;
const productionPublicParameterIDs = Array.from(
    productionSynthSource.slice(productionGraphStart, productionRackStart).matchAll(productionParameterPattern),
    ([, directID, annotationText = "", rackID]) => ({ endpointID: directID ?? rackID, annotationText }),
).filter(({ endpointID, annotationText }) => (
    endpointID !== "hostSlot0Guard"
    && !/(?:^|,)\s*hidden:\s*true(?:\s*,|$)/u.test(annotationText)
)).map(({ endpointID }) => endpointID).sort();
// Bounce owns the source mode, so a preset (and so a link) never carries it.
const presetParameterIDs = productionPublicParameterIDs.filter((endpointID) => endpointID !== "sourceMode");
// COSIMO_WEB_BROWSER=chromium|webkit runs one engine, as in the web proof-of-concept suite.
const engines = [
    { key: "chromium", label: "Chromium", launcher: chromium },
    { key: "webkit", label: "Safari/WebKit", launcher: webkit },
].filter(({ key }) => !process.env.COSIMO_WEB_BROWSER || process.env.COSIMO_WEB_BROWSER === key);
const browsers = new Map();
let server;

before(async () => {
    server = await startDesktopHarnessServer();
    const launched = await Promise.all(engines.map(async ({ key, launcher }) => [
        key,
        await launcher.launch({ headless: true }),
    ]));
    for (const [key, browser] of launched) browsers.set(key, browser);
});

after(async () => {
    await Promise.all([...browsers.values()].map((browser) => browser.close()));
    await server?.stop();
});

async function createContext(engineKey, viewport, { catalogTableCount = factoryCatalog.tables.length } = {}) {
    const browser = browsers.get(engineKey);
    if (!browser) throw new Error(`${engineKey} did not launch.`);
    const context = await browser.newContext({ viewport });
    await context.route("**/assets/factory-bank-catalog.json", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ tables: factoryCatalog.tables.slice(0, catalogTableCount) }),
        });
    });
    if (engineKey === "chromium") {
        await context.grantPermissions(
            ["clipboard-read", "clipboard-write"],
            { origin: new URL(server.baseUrl).origin },
        );
    }
    return context;
}

async function openHarnessPage(context, url = server.baseUrl) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    await waitForHarnessReady(page);
    await presetBar(page).locator('[data-action="toggle-sound-actions"]').waitFor({ timeout: 90_000 });
    return page;
}

function presetBar(page) {
    return page.locator('[data-role="synth-preset-bar"]');
}

async function openSoundActions(page) {
    const toggle = presetBar(page).locator('[data-action="toggle-sound-actions"]');
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
}

/** Start sharing from the Sound actions menu; resolves once the dialog or a refusal shows. */
async function requestShare(page) {
    await openSoundActions(page);
    const share = presetBar(page).locator('[data-action="share"]');
    await page.waitForFunction(() => {
        const button = document.querySelector('[data-role="sound-actions"] [data-action="share"]');
        return button instanceof HTMLButtonElement && !button.disabled;
    }, undefined, { timeout: 90_000 });
    await share.click();
}

async function openShareDialog(page) {
    await requestShare(page);
    const dialog = presetBar(page).locator('[data-role="share-dialog"]');
    const refusal = presetBar(page).getByRole("alert");
    await Promise.race([
        dialog.waitFor({ state: "visible" }),
        refusal.waitFor({ state: "visible" }),
    ]);
    if (await refusal.isVisible()) {
        throw new Error(`Share dialog did not open: ${await refusal.innerText()}`);
    }
    const link = await dialog.getByLabel("Sound link").inputValue();
    assert.match(link, /#p=3\.[A-Za-z0-9_-]+$/u);
    return {
        link,
        message: await dialog.locator("p").innerText(),
    };
}

async function readClipboard(page, engineKey) {
    if (engineKey === "chromium") return page.evaluate(() => navigator.clipboard.readText());
    return execFileSync("pbpaste", { encoding: "utf8" });
}

async function verifyExactClipboardCopy(page, engineKey, expectedLink) {
    if (engineKey === "webkit") {
        execFileSync("pbcopy", { input: "" });
    }
    await presetBar(page).locator('[data-role="share-dialog"]').getByRole("button", { name: "Copy link" }).click();
    let clipboardText = "";
    for (let attempt = 0; attempt < 30; attempt += 1) {
        clipboardText = await readClipboard(page, engineKey);
        if (clipboardText === expectedLink) return;
        await delay(100);
    }
    assert.equal(clipboardText, expectedLink, `${engineKey} copied the complete link`);
}

/** The current sound as the preset file Copy JSON writes (the same file a link carries). */
async function captureCurrentSound(page, engineKey) {
    const compact = await presetBar(page).getAttribute("data-compact") !== null;
    if (compact) await openSoundActions(page);
    const presets = presetBar(page).locator(".bk-preset-bar");
    const copied = presets.getByRole("status").filter({ hasText: "Copied" });
    await copied.waitFor({ state: "detached", timeout: 5_000 });
    await presets.getByRole("button", { name: "More", exact: true }).click();
    await presets.getByRole("button", { name: "Copy JSON", exact: true }).click();
    await copied.waitFor();
    if (compact) await presetBar(page).locator('[data-action="toggle-sound-actions"]').click();
    return JSON.parse(await readClipboard(page, engineKey));
}

/** Compare sounds, not the names they travel under. */
function normalizedSoundDocument(presetFile) {
    return presetFile.values;
}

function parseDocument(value) {
    return typeof value === "string" ? JSON.parse(value) : value;
}

const SOUND_DOCUMENT_KEYS = ["articulations.v4", "lane.v1", "modulation.v6"];

function assertMaximalDocument(presetFile, facts) {
    assert.equal(presetFile.kind, "builder-kit.preset");
    assert.equal(presetFile.plugin, "dev.cosimo.wavetable-synth");
    const parameterIDs = Object.keys(presetFile.values).filter((key) => !SOUND_DOCUMENT_KEYS.includes(key)).sort();
    assert.equal(parameterIDs.length, facts.parameterCount - 1, "every public parameter except the source mode");
    assert.deepEqual(parameterIDs, presetParameterIDs, "maximal capture includes every current production preset parameter");
    for (const key of SOUND_DOCUMENT_KEYS) assert.equal(key in presetFile.values, true, `the sound carries ${key}`);
    const modulation = parseDocument(presetFile.values["modulation.v6"]);
    const articulations = parseDocument(presetFile.values["articulations.v4"]);
    const lane = parseDocument(presetFile.values["lane.v1"]);
    assert.equal(modulation.routes.length, facts.modulationRouteCount);
    assert.equal(
        modulation.msegSlots.reduce((sum, slot) => (
            sum + slot.shapeA.points.length + slot.shapeB.points.length
        ), 0),
        facts.msegPointCount,
    );
    for (const slot of modulation.msegSlots) {
        assert.equal(slot.shapeA.points.length, 16);
        assert.equal(slot.shapeB.points.length, 16);
        assert.equal(slot.playback.format, "cosimo.mseg.playback");
        assert.deepEqual(slot.playback.loop, { startX: 0.125, endX: 0.875 });
        assert.equal(typeof slot.playback.noteOffPolicy, "string");
        assert.equal(typeof slot.playback.legatoRestarts, "boolean");
        assert.equal(typeof slot.playback.holdFinalValue, "boolean");
    }
    assert.equal(modulation.envelopeSlots.every(({ name }) => name.startsWith("T46 Envelope")), true);
    assert.equal(modulation.macroNames.every((name) => name.startsWith("T46 Macro")), true);
    assert.equal(articulations.slots.length, facts.articulationSlotCount);
    for (const slot of articulations.slots) {
        assert.equal(Object.keys(slot.overrides).length, facts.articulationOverrideCountPerSlot);
        assert.equal(Object.keys(slot.routeAmounts).length, facts.articulableRouteCount);
    }
    assert.equal(Object.keys(lane.devices).length, facts.laneDeviceCount);
    assert.deepEqual(lane.output, { mix: 0.73, bypassed: false });
    assert.equal(lane.chain.some((node) => node.kind === "parallel"), true);
    assert.equal(lane.chain.some((node) => node.kind === "split"), true);
}

async function installMaximalSound(page) {
    const facts = await page.evaluate(async () => {
        const harness = window.__COSIMO_DESKTOP_HARNESS__;
        if (!harness) throw new Error("Desktop harness is unavailable.");
        const fixtureModule = await import("/tests/fixtures/sound-share-maximal.ts");
        const inputs = harness.patchConnection.status?.details?.inputs;
        if (!Array.isArray(inputs)) throw new Error("Desktop harness parameter contract is unavailable.");
        const fixture = fixtureModule.createMaximalSoundFixture(inputs);
        window.__T46_MAXIMAL_SOUND__ = fixture;
        for (const [endpointID, value] of Object.entries(fixture.parameters)) {
            harness.setParameterValue(endpointID, value);
        }
        harness.setStoredStateValue("modulation.v6", fixture.storedState["modulation.v6"]);
        return fixture.facts;
    });

    // The articulation runtime accepts only the route frontier already
    // acknowledged by modulation, matching production ordering.
    await page.waitForTimeout(300);
    await page.evaluate(() => {
        const harness = window.__COSIMO_DESKTOP_HARNESS__;
        const fixture = window.__T46_MAXIMAL_SOUND__;
        if (!harness || !fixture) throw new Error("Maximal sound fixture was not staged.");
        harness.setStoredStateValue("articulations.v4", fixture.storedState["articulations.v4"]);
        harness.setStoredStateValue("lane.v1", fixture.storedState["lane.v1"]);
        harness.setStoredStateValue("bounce.v1", null);
        delete window.__T46_MAXIMAL_SOUND__;
    });
    await page.waitForTimeout(750);
    return facts;
}

function renderedSoundProjection(rendered) {
    return {
        errorText: rendered.errorText,
        hasCanvas: rendered.hasCanvas,
        stageLabel: rendered.stageLabel,
        stageDebug: rendered.stageDebug,
        filterGraphState: rendered.filterGraphState,
        distortionGraphState: rendered.distortionGraphState,
        msegPreviewState: rendered.msegPreviewState,
    };
}

async function getRenderedSoundProjection(page) {
    return page.evaluate(() => {
        const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
        return {
            errorText: rendered.errorText,
            hasCanvas: rendered.hasCanvas,
            stageLabel: rendered.stageLabel,
            stageDebug: rendered.stageDebug,
            filterGraphState: rendered.filterGraphState,
            distortionGraphState: rendered.distortionGraphState,
            msegPreviewState: rendered.msegPreviewState,
        };
    });
}

async function waitForSharedLoadDialog(page) {
    const dialog = presetBar(page).locator('[data-role="shared-load-dialog"]');
    await dialog.waitFor({ state: "visible" });
    assert.equal((await dialog.locator("h3").textContent())?.trim(), "Load shared sound?");
}

async function confirmSharedLoad(page) {
    await presetBar(page).locator('[data-role="shared-load-dialog"]').getByRole("button", { name: "Load" }).click();
    await page.waitForFunction(() => window.location.hash === "", undefined, { timeout: 30_000 });
    await page.waitForTimeout(900);
}

async function waitForRefusal(page, expected) {
    const refusal = presetBar(page).getByRole("alert").filter({ hasText: expected });
    await refusal.waitFor({ state: "visible", timeout: 10_000 });
}

async function runMaximalCopyOpenFlow(engineKey, label) {
    const desktopSourceContext = await createContext(engineKey, { width: 1280, height: 900 });
    let desktopLink;
    let desktopDocument;
    try {
        const sourcePage = await openHarnessPage(desktopSourceContext);
        const facts = await installMaximalSound(sourcePage);
        const sourceCurrent = await captureCurrentSound(sourcePage, engineKey);
        const shared = await openShareDialog(sourcePage);
        desktopLink = shared.link;
        assert.match(shared.message, /Some apps may shorten it/u);
        assert.ok(desktopLink.length > 8_000);
        assert.ok(desktopLink.length <= 128_000);
        await verifyExactClipboardCopy(sourcePage, engineKey, desktopLink);

        const { decodeSoundShareFragment, SOUND_SHARE_DECOMPRESSED_MAX_BYTES } = await loadUIModule(repoRoot, "ui/shared/sound-share-link.ts");
        const decoded = await decodeSoundShareFragment(new URL(desktopLink).hash);
        assert.equal(decoded.ok, true, decoded.ok ? undefined : decoded.error.message);
        desktopDocument = JSON.parse(decoded.value);
        assert.deepEqual(
            normalizedSoundDocument(desktopDocument),
            normalizedSoundDocument(sourceCurrent),
            "normal capture and link capture cover the same complete sound",
        );
        assertMaximalDocument(desktopDocument, facts);
        // A link carries each document in its saved form; the articulation bank is a JSON
        // string, so its quotes are escaped. The maximal sound measures about 3.12 MB.
        const rawBytes = Buffer.byteLength(decoded.value);
        assert.ok(rawBytes < SOUND_SHARE_DECOMPRESSED_MAX_BYTES, `${rawBytes} bytes fit the link's decompressed limit`);

        let firstTargetRendered;
        const desktopTargetContext = await createContext(engineKey, { width: 1280, height: 900 });
        try {
            const targetPage = await openHarnessPage(desktopTargetContext, desktopLink);
            await waitForSharedLoadDialog(targetPage);
            await confirmSharedLoad(targetPage);
            const targetCurrent = await captureCurrentSound(targetPage, engineKey);
            assert.deepEqual(
                normalizedSoundDocument(targetCurrent),
                normalizedSoundDocument(sourceCurrent),
                "a clean desktop session restores the exact normalized maximal sound",
            );
            firstTargetRendered = await getRenderedSoundProjection(targetPage);
            assert.equal(firstTargetRendered.errorText, null);
            assert.equal(firstTargetRendered.hasCanvas, true);
            assert.equal(firstTargetRendered.stageLabel, "XLNT-Xello");
            assert.equal(firstTargetRendered.stageDebug.position, sourceCurrent.values.oscAWavetablePosition);
            assert.equal(firstTargetRendered.filterGraphState.base.mode, sourceCurrent.values.filterMode);
            assert.equal(firstTargetRendered.filterGraphState.base.cutoffHz, sourceCurrent.values.filterCutoff);
            assert.equal(firstTargetRendered.filterGraphState.base.q, sourceCurrent.values.filterQ);
            assert.ok(firstTargetRendered.msegPreviewState?.shapeACurvePath);
            assert.ok(firstTargetRendered.msegPreviewState?.shapeBCurvePath);
            assert.equal(new URL(targetPage.url()).hash, "");
        } finally {
            await desktopTargetContext.close();
        }

        const secondTargetContext = await createContext(engineKey, { width: 1280, height: 900 });
        try {
            const secondTargetPage = await openHarnessPage(secondTargetContext, desktopLink);
            await waitForSharedLoadDialog(secondTargetPage);
            await confirmSharedLoad(secondTargetPage);
            assert.deepEqual(
                normalizedSoundDocument(await captureCurrentSound(secondTargetPage, engineKey)),
                normalizedSoundDocument(sourceCurrent),
                "a second clean desktop session restores the exact normalized maximal sound",
            );
            assert.deepEqual(
                renderedSoundProjection(await getRenderedSoundProjection(secondTargetPage)),
                renderedSoundProjection(firstTargetRendered),
                "two clean desktop sessions render the restored sound equivalently",
            );
        } finally {
            await secondTargetContext.close();
        }
        console.log(`T46 ${label} desktop maximal: ${rawBytes} raw bytes, ${desktopLink.length} URL characters`);
    } finally {
        await desktopSourceContext.close();
    }

    const phoneSourceContext = await createContext(engineKey, { width: 393, height: 852 });
    try {
        const phoneSourcePage = await openHarnessPage(phoneSourceContext);
        const facts = await installMaximalSound(phoneSourcePage);
        const phoneCurrent = await captureCurrentSound(phoneSourcePage, engineKey);
        assert.deepEqual(
            normalizedSoundDocument(phoneCurrent),
            normalizedSoundDocument(desktopDocument),
            "desktop and phone sessions capture the same maximal sound",
        );
        assertMaximalDocument(phoneCurrent, facts);
        const shared = await openShareDialog(phoneSourcePage);
        assert.ok(shared.link.length > 8_000 && shared.link.length <= 128_000);
        await verifyExactClipboardCopy(phoneSourcePage, engineKey, shared.link);

        const phoneTargetContext = await createContext(engineKey, { width: 393, height: 852 });
        try {
            const phoneTargetPage = await openHarnessPage(phoneTargetContext, shared.link);
            await waitForSharedLoadDialog(phoneTargetPage);
            await confirmSharedLoad(phoneTargetPage);
            assert.deepEqual(
                normalizedSoundDocument(await captureCurrentSound(phoneTargetPage, engineKey)),
                normalizedSoundDocument(phoneCurrent),
                "a clean phone session restores the exact normalized maximal sound",
            );
            assert.equal(new URL(phoneTargetPage.url()).hash, "");
        } finally {
            await phoneTargetContext.close();
        }
        console.log(`T46 ${label} phone maximal: ${shared.link.length} URL characters`);
    } finally {
        await phoneSourceContext.close();
    }
}

async function runRefusalAndCancellationFlow(engineKey) {
    const guardedContext = await createContext(engineKey, { width: 1280, height: 900 });
    await guardedContext.addInitScript(() => {
        window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
            parameterValues: { oscAWavetablePosition: 0.66, filterMix: 0.22 },
        };
    });
    let validLink;
    let baseline;
    try {
        const baselinePage = await openHarnessPage(guardedContext);
        baseline = await captureCurrentSound(baselinePage, engineKey);
        validLink = (await openShareDialog(baselinePage)).link;
        await baselinePage.close();

        const validHash = new URL(validLink).hash;
        const overCapText = JSON.stringify({
            kind: "builder-kit.preset",
            version: 1,
            plugin: "dev.cosimo.wavetable-synth",
            name: "x".repeat(3_250_000),
            values: {},
        });
        assert.ok(Buffer.byteLength(overCapText) > 3_250_000);
        const overCapHash = `#p=3.${deflateSync(Buffer.from(overCapText)).toString("base64url")}`;
        assert.ok(overCapHash.length < 128_000);
        const cases = [
            { label: "malformed", hash: "#p=3.not_base64!", error: /not valid base64url/iu },
            { label: "truncated", hash: validHash.slice(0, Math.ceil(validHash.length / 2)), error: /decompress|incomplete|invalid|truncated|not valid/iu },
            { label: "retired version", hash: "#p=2.AAAA", error: /version .* not supported/iu },
            { label: "oversized", hash: `#p=3.${"A".repeat(128_001)}`, error: /exceeds 128,000 characters/iu },
            { label: "decompressed over-cap", hash: overCapHash, error: /expands beyond 3,250,000 bytes/iu },
        ];
        for (const invalidCase of cases) {
            const page = await openHarnessPage(guardedContext, `${server.baseUrl}${invalidCase.hash}`);
            try {
                await waitForRefusal(page, invalidCase.error);
            } catch (error) {
                const shown = await presetBar(page).getByRole("alert").allInnerTexts();
                throw new Error(`${invalidCase.label} refusal was not presented; observed: ${shown.join(" | ")}`, {
                    cause: error,
                });
            }
            assert.deepEqual(
                normalizedSoundDocument(await captureCurrentSound(page, engineKey)),
                normalizedSoundDocument(baseline),
                `invalid fragment ${invalidCase.hash.slice(0, 14)} is non-destructive`,
            );
            assert.equal(new URL(page.url()).hash, invalidCase.hash);
            assert.equal(await presetBar(page).locator('[data-role="shared-load-dialog"]').isVisible(), false);
            await page.close();
        }

        const cancelPage = await openHarnessPage(guardedContext, validLink);
        await waitForSharedLoadDialog(cancelPage);
        const beforeCancel = await captureCurrentSound(cancelPage, engineKey);
        await presetBar(cancelPage).locator('[data-role="shared-load-dialog"]').getByRole("button", { name: "Cancel" }).click();
        await presetBar(cancelPage).locator('[data-role="shared-load-dialog"]').waitFor({ state: "detached" });
        assert.deepEqual(
            normalizedSoundDocument(await captureCurrentSound(cancelPage, engineKey)),
            normalizedSoundDocument(beforeCancel),
        );
        assert.deepEqual(normalizedSoundDocument(beforeCancel), normalizedSoundDocument(baseline));
        assert.equal(new URL(cancelPage.url()).hash, new URL(validLink).hash);
    } finally {
        await guardedContext.close();
    }

    let unavailableLink;
    const sourceContext = await createContext(engineKey, { width: 1280, height: 900 });
    try {
        const sourcePage = await openHarnessPage(sourceContext);
        await sourcePage.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAWavetableSelect", 81);
        });
        await sourcePage.waitForTimeout(150);
        unavailableLink = (await openShareDialog(sourcePage)).link;
    } finally {
        await sourceContext.close();
    }

    const unavailableTargetContext = await createContext(
        engineKey,
        { width: 1280, height: 900 },
        { catalogTableCount: 36 },
    );
    try {
        const targetPage = await openHarnessPage(unavailableTargetContext, unavailableLink);
        await waitForSharedLoadDialog(targetPage);
        const beforeLoad = await captureCurrentSound(targetPage, engineKey);
        await presetBar(targetPage).locator('[data-role="shared-load-dialog"]').getByRole("button", { name: "Load" }).click();
        await waitForRefusal(targetPage, /unavailable wavetable for Oscillator A/iu);
        assert.deepEqual(
            normalizedSoundDocument(await captureCurrentSound(targetPage, engineKey)),
            normalizedSoundDocument(beforeLoad),
        );
        assert.equal(new URL(targetPage.url()).hash, new URL(unavailableLink).hash);

        const capturePage = await openHarnessPage(unavailableTargetContext);
        await capturePage.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscCWavetableSelect", 81);
        });
        await capturePage.waitForTimeout(100);
        const beforeCapture = await captureCurrentSound(capturePage, engineKey);
        await requestShare(capturePage);
        await waitForRefusal(capturePage, /unavailable wavetable for Oscillator C/iu);
        assert.deepEqual(
            normalizedSoundDocument(await captureCurrentSound(capturePage, engineKey)),
            normalizedSoundDocument(beforeCapture),
        );
        assert.equal(await presetBar(capturePage).locator('[data-role="share-dialog"]').count(), 0);
    } finally {
        await unavailableTargetContext.close();
    }

    const bounceContext = await createContext(engineKey, { width: 1280, height: 900 });
    try {
        const bouncePage = await openHarnessPage(bounceContext);
        await bouncePage.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("sourceMode", 1);
        });
        await bouncePage.waitForTimeout(100);
        const beforeBounceShare = await captureCurrentSound(bouncePage, engineKey);
        await requestShare(bouncePage);
        await waitForRefusal(bouncePage, /Bounced sounds can't be shared by link yet/u);
        assert.deepEqual(
            normalizedSoundDocument(await captureCurrentSound(bouncePage, engineKey)),
            normalizedSoundDocument(beforeBounceShare),
        );
        assert.equal(await presetBar(bouncePage).locator('[data-role="share-dialog"]').count(), 0);
    } finally {
        await bounceContext.close();
    }
}

for (const { key, label } of engines) {
    test(`${label}: maximal supported sound copies and restores exactly on desktop and phone`, {
        concurrency: false,
        timeout: 240_000,
    }, async () => {
        await runMaximalCopyOpenFlow(key, label);
    });

    test(`${label}: invalid, cancelled, unavailable-wavetable, and Bounce links are non-destructive`, {
        concurrency: false,
        timeout: 180_000,
    }, async () => {
        await runRefusalAndCancellationFlow(key);
    });
}
