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
const engines = [
    { key: "chromium", label: "Chromium", launcher: chromium },
    { key: "webkit", label: "Safari/WebKit", launcher: webkit },
];
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
    await context.addInitScript(() => {
        window.__T46_SOUND_SHARE_TOASTS__ = [];
        const appendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function captureSoundShareToast(node) {
            if (node instanceof HTMLElement && node.matches(".cpb-toast")) {
                window.__T46_SOUND_SHARE_TOASTS__.push(node.textContent ?? "");
            }
            return appendChild.call(this, node);
        };
    });
    return context;
}

async function openHarnessPage(context, url = server.baseUrl) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    await waitForHarnessReady(page);
    await page.waitForFunction(() => {
        const button = document.querySelector("cosimo-preset-bar")?.shadowRoot
            ?.querySelector('[data-el="btn-share"]');
        return button instanceof HTMLButtonElement && !button.disabled;
    }, undefined, { timeout: 90_000 });
    return page;
}

function presetBar(page) {
    return page.locator("cosimo-preset-bar");
}

async function clickPresetBarElement(page, elementID) {
    const element = presetBar(page).locator(`[data-el="${elementID}"]`);
    await element.waitFor({ state: "visible" });
    await element.click();
}

async function clickPresetBarAction(page, action) {
    const element = presetBar(page).locator(`[data-action="${action}"]`);
    await element.waitFor({ state: "visible" });
    await element.click();
}

async function openShareDialog(page, layout = "desktop") {
    if (layout === "phone") {
        await clickPresetBarElement(page, "shell-more");
        await clickPresetBarElement(page, "menu-share");
    } else {
        await clickPresetBarElement(page, "btn-share");
    }
    const dialog = presetBar(page).locator('[data-el="share-dialog"]');
    const errorToast = presetBar(page).locator(".cpb-toast.error").last();
    await Promise.race([
        dialog.waitFor({ state: "visible" }),
        errorToast.waitFor({ state: "visible" }),
    ]);
    if (await errorToast.isVisible()) {
        throw new Error(`Share dialog did not open: ${await errorToast.innerText()}`);
    }
    const link = await presetBar(page).locator('[data-el="share-link"]').inputValue();
    assert.match(link, /#p=2\.[A-Za-z0-9_-]+$/u);
    return {
        link,
        message: await presetBar(page).locator('[data-el="share-message"]').innerText(),
    };
}

async function verifyExactClipboardCopy(page, engineKey, expectedLink) {
    if (engineKey === "webkit") {
        execFileSync("pbcopy", { input: "" });
    }
    await clickPresetBarAction(page, "share-copy");
    if (engineKey === "chromium") {
        await page.waitForFunction(async (expected) => {
            try {
                return await navigator.clipboard.readText() === expected;
            } catch {
                return false;
            }
        }, expectedLink, { timeout: 15_000 });
        return;
    }
    let clipboardText = "";
    for (let attempt = 0; attempt < 30; attempt += 1) {
        clipboardText = execFileSync("pbpaste", { encoding: "utf8" });
        if (clipboardText === expectedLink) return;
        await delay(100);
    }
    assert.equal(clipboardText, expectedLink, "WebKit copied the complete link to the macOS clipboard");
}

async function captureCurrentSound(page) {
    return page.evaluate(() => {
        const presetBarElement = document.querySelector("cosimo-preset-bar");
        const mutations = presetBarElement?._synthMutations;
        const captured = mutations?.captureCurrentSound();
        if (!captured?.ok) {
            throw new Error(captured?.message ?? "Current sound capture is unavailable.");
        }
        return captured.value;
    });
}

function normalizedSoundDocument(envelope) {
    const { presetID: _captureIdentity, ...preset } = envelope.preset;
    return {
        ...envelope,
        preset,
    };
}

function parseDocument(value) {
    return typeof value === "string" ? JSON.parse(value) : value;
}

function assertMaximalDocument(envelope, facts) {
    assert.equal(Object.keys(envelope.preset.parameters).length, facts.parameterCount);
    assert.deepEqual(
        Object.keys(envelope.preset.parameters).sort(),
        productionPublicParameterIDs,
        "maximal capture includes every current production public parameter",
    );
    assert.deepEqual(
        Object.keys(envelope.preset.storedState).sort(),
        envelope.preset.contract.storedState.map(({ key }) => key).sort(),
    );
    assert.deepEqual(Object.keys(envelope.supplementalStoredState), ["lane.v1"]);
    const modulation = parseDocument(envelope.preset.storedState["modulation.v6"]);
    const articulations = parseDocument(envelope.preset.storedState["articulations.v4"]);
    const lane = parseDocument(envelope.supplementalStoredState["lane.v1"]);
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
    const dialog = presetBar(page).locator('[data-el="shared-load-dialog"]');
    await dialog.waitFor({ state: "visible" });
    assert.equal((await dialog.locator("h3").textContent())?.trim(), "Load shared sound?");
}

async function confirmSharedLoad(page) {
    await clickPresetBarAction(page, "shared-load-confirm");
    await page.waitForFunction(() => window.location.hash === "", undefined, { timeout: 30_000 });
    await page.waitForTimeout(900);
}

async function waitForErrorToast(page, expected) {
    await page.waitForFunction(({ source, flags }) => {
        const pattern = new RegExp(source, flags);
        return window.__T46_SOUND_SHARE_TOASTS__?.some((message) => pattern.test(message));
    }, { source: expected.source, flags: expected.flags }, { timeout: 10_000 });
    const messages = await page.evaluate(() => window.__T46_SOUND_SHARE_TOASTS__ ?? []);
    assert.equal(messages.some((message) => expected.test(message)), true, messages.join(" | "));
}

async function runMaximalCopyOpenFlow(engineKey, label) {
    const desktopSourceContext = await createContext(engineKey, { width: 1280, height: 900 });
    let desktopLink;
    let desktopDocument;
    try {
        const sourcePage = await openHarnessPage(desktopSourceContext);
        const facts = await installMaximalSound(sourcePage);
        const sourceCurrent = await captureCurrentSound(sourcePage);
        const shared = await openShareDialog(sourcePage, "desktop");
        desktopLink = shared.link;
        assert.match(shared.message, /Some apps may shorten it/u);
        assert.ok(desktopLink.length > 8_000);
        assert.ok(desktopLink.length <= 128_000);
        await verifyExactClipboardCopy(sourcePage, engineKey, desktopLink);

        const { decodeSoundShareFragment } = await loadUIModule(repoRoot, "ui/shared/sound-share-link.ts");
        const decoded = await decodeSoundShareFragment(new URL(desktopLink).hash);
        assert.equal(decoded.ok, true, decoded.ok ? undefined : decoded.error.message);
        desktopDocument = decoded.value;
        assert.deepEqual(
            normalizedSoundDocument(desktopDocument),
            normalizedSoundDocument(sourceCurrent),
            "normal capture and link capture cover the same complete sound",
        );
        assertMaximalDocument(desktopDocument, facts);
        const rawBytes = Buffer.byteLength(JSON.stringify(desktopDocument));
        assert.ok(rawBytes < 3_000_000);

        let firstTargetRendered;
        const desktopTargetContext = await createContext(engineKey, { width: 1280, height: 900 });
        try {
            const targetPage = await openHarnessPage(desktopTargetContext, desktopLink);
            await waitForSharedLoadDialog(targetPage);
            await confirmSharedLoad(targetPage);
            const targetCurrent = await captureCurrentSound(targetPage);
            assert.deepEqual(
                normalizedSoundDocument(targetCurrent),
                normalizedSoundDocument(sourceCurrent),
                "a clean desktop session restores the exact normalized maximal sound",
            );
            firstTargetRendered = await getRenderedSoundProjection(targetPage);
            assert.equal(firstTargetRendered.errorText, null);
            assert.equal(firstTargetRendered.hasCanvas, true);
            assert.equal(firstTargetRendered.stageLabel, "XLNT-Xello");
            assert.equal(firstTargetRendered.stageDebug.position, sourceCurrent.preset.parameters.oscAWavetablePosition);
            assert.equal(firstTargetRendered.filterGraphState.base.mode, sourceCurrent.preset.parameters.filterMode);
            assert.equal(firstTargetRendered.filterGraphState.base.cutoffHz, sourceCurrent.preset.parameters.filterCutoff);
            assert.equal(firstTargetRendered.filterGraphState.base.q, sourceCurrent.preset.parameters.filterQ);
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
                normalizedSoundDocument(await captureCurrentSound(secondTargetPage)),
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
        const phoneCurrent = await captureCurrentSound(phoneSourcePage);
        assert.deepEqual(
            normalizedSoundDocument(phoneCurrent),
            normalizedSoundDocument(desktopDocument),
            "desktop and phone sessions capture the same maximal sound",
        );
        assertMaximalDocument(phoneCurrent, facts);
        const shared = await openShareDialog(phoneSourcePage, "phone");
        assert.ok(shared.link.length > 8_000 && shared.link.length <= 128_000);
        await verifyExactClipboardCopy(phoneSourcePage, engineKey, shared.link);

        const phoneTargetContext = await createContext(engineKey, { width: 393, height: 852 });
        try {
            const phoneTargetPage = await openHarnessPage(phoneTargetContext, shared.link);
            await waitForSharedLoadDialog(phoneTargetPage);
            await confirmSharedLoad(phoneTargetPage);
            assert.deepEqual(
                normalizedSoundDocument(await captureCurrentSound(phoneTargetPage)),
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
        baseline = await captureCurrentSound(baselinePage);
        validLink = (await openShareDialog(baselinePage)).link;
        await baselinePage.close();

        const validHash = new URL(validLink).hash;
        const overCapText = JSON.stringify({
            format: "cosimo.soundShare",
            version: 2,
            preset: { padding: "x".repeat(3_250_000) },
            supplementalStoredState: {},
        });
        assert.ok(Buffer.byteLength(overCapText) > 3_250_000);
        const overCapHash = `#p=2.${deflateSync(Buffer.from(overCapText)).toString("base64url")}`;
        assert.ok(overCapHash.length < 128_000);
        const cases = [
            { label: "malformed", hash: "#p=2.not_base64!", error: /not valid base64url/iu },
            { label: "truncated", hash: validHash.slice(0, Math.ceil(validHash.length / 2)), error: /decompress|incomplete|invalid|truncated/iu },
            { label: "unsupported", hash: "#p=3.AAAA", error: /version .* not supported/iu },
            { label: "oversized", hash: `#p=2.${"A".repeat(128_001)}`, error: /exceeds 128,000 characters/iu },
            { label: "decompressed over-cap", hash: overCapHash, error: /expands beyond 3,250,000 bytes/iu },
        ];
        for (const invalidCase of cases) {
            const page = await openHarnessPage(guardedContext, `${server.baseUrl}${invalidCase.hash}`);
            try {
                await waitForErrorToast(page, invalidCase.error);
            } catch (error) {
                const messages = await page.evaluate(() => window.__T46_SOUND_SHARE_TOASTS__ ?? []);
                throw new Error(`${invalidCase.label} refusal was not presented; observed: ${messages.join(" | ")}`, {
                    cause: error,
                });
            }
            assert.deepEqual(
                normalizedSoundDocument(await captureCurrentSound(page)),
                normalizedSoundDocument(baseline),
                `invalid fragment ${invalidCase.hash.slice(0, 14)} is non-destructive`,
            );
            assert.equal(new URL(page.url()).hash, invalidCase.hash);
            assert.equal(await presetBar(page).locator('[data-el="shared-load-dialog"]').isVisible(), false);
            await page.close();
        }

        const cancelPage = await openHarnessPage(guardedContext, validLink);
        await waitForSharedLoadDialog(cancelPage);
        const beforeCancel = await captureCurrentSound(cancelPage);
        await clickPresetBarAction(cancelPage, "shared-load-cancel");
        await presetBar(cancelPage).locator('[data-el="shared-load-dialog"]').waitFor({ state: "hidden" });
        assert.deepEqual(
            normalizedSoundDocument(await captureCurrentSound(cancelPage)),
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
        const beforeLoad = await captureCurrentSound(targetPage);
        await clickPresetBarAction(targetPage, "shared-load-confirm");
        await waitForErrorToast(targetPage, /unavailable wavetable for Oscillator A/iu);
        assert.deepEqual(
            normalizedSoundDocument(await captureCurrentSound(targetPage)),
            normalizedSoundDocument(beforeLoad),
        );
        assert.equal(new URL(targetPage.url()).hash, new URL(unavailableLink).hash);

        const capturePage = await openHarnessPage(unavailableTargetContext);
        await capturePage.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscCWavetableSelect", 81);
        });
        await capturePage.waitForTimeout(100);
        const beforeCapture = await captureCurrentSound(capturePage);
        await clickPresetBarElement(capturePage, "btn-share");
        await waitForErrorToast(capturePage, /unavailable wavetable for Oscillator C/iu);
        assert.deepEqual(
            normalizedSoundDocument(await captureCurrentSound(capturePage)),
            normalizedSoundDocument(beforeCapture),
        );
        assert.equal(await presetBar(capturePage).locator('[data-el="share-dialog"]').isVisible(), false);
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
        const beforeBounceShare = await captureCurrentSound(bouncePage);
        await clickPresetBarElement(bouncePage, "btn-share");
        await waitForErrorToast(bouncePage, /Bounced sounds can't be shared by link yet/u);
        assert.deepEqual(
            normalizedSoundDocument(await captureCurrentSound(bouncePage)),
            normalizedSoundDocument(beforeBounceShare),
        );
        assert.equal(await presetBar(bouncePage).locator('[data-el="share-dialog"]').isVisible(), false);
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
