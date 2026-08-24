import assert from "node:assert/strict";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { startDesktopHarnessServer, waitForHarnessReady } from "./helpers/desktop_harness_browser.mjs";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
let server;
let browser;

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

async function openHarnessPage(context, url = server.baseUrl) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    await waitForHarnessReady(page);
    await page.waitForFunction(() => {
        const button = document.querySelector("cosimo-preset-bar")?.shadowRoot
            ?.querySelector('[data-action="share"]');
        return button instanceof HTMLButtonElement && !button.disabled;
    });
    return page;
}

async function clickPresetBarAction(page, action) {
    await page.evaluate((nextAction) => {
        const button = document.querySelector("cosimo-preset-bar")?.shadowRoot
            ?.querySelector(`[data-action="${nextAction}"]`);
        if (!(button instanceof HTMLButtonElement)) {
            throw new Error(`Preset bar action ${nextAction} is missing.`);
        }
        button.click();
    }, action);
}

function selectSoundDocument(snapshot, envelope) {
    const storedValue = (key) => {
        const value = snapshot.storedState[key];
        return key === "articulations.v4" && typeof value === "string"
            ? JSON.parse(value)
            : value;
    };
    return {
        parameters: Object.fromEntries(
            Object.keys(envelope.preset.parameters).map((key) => [key, snapshot.parameterValues[key]]),
        ),
        storedState: Object.fromEntries(
            Object.keys(envelope.preset.storedState).map((key) => [key, storedValue(key)]),
        ),
        supplementalStoredState: {
            "lane.v1": snapshot.storedState["lane.v1"],
        },
    };
}

test("configure → share → fresh browser context → confirm reproduces the complete sound and strips the fragment", async () => {
    const origin = new URL(server.baseUrl).origin;
    const sourceContext = await browser.newContext();
    await sourceContext.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    const sourcePage = await openHarnessPage(sourceContext);

    try {
        await sourcePage.evaluate(async () => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            if (!harness) throw new Error("Desktop harness is unavailable.");
            const [modulation, articulations, lane] = await Promise.all([
                import("/ui/shared/modulation.ts"),
                import("/ui/shared/articulation-image.ts"),
                import("/ui/shared/lane-state-v2.ts"),
            ]);
            const modulationState = modulation.createDefaultModulationState();
            modulationState.macroNames[0] = "SHARED MOTION";
            const articulationState = articulations.createEmptyArticulationsState();
            articulationState.activeTriggerMode = "vel";
            const laneState = lane.createDefaultLaneStateV2();
            laneState.devices["reverb#1"].params.reverbSize = 0.82;
            laneState.chain = [...laneState.chain].reverse();

            harness.setParameterValue("oscAWavetableSelect", 127);
            harness.setParameterValue("oscAFramePosition", 0.43);
            harness.setParameterValue("filterMix", 0.31);
            harness.setStoredStateValue("modulation.v6", modulation.serializeModulationState(modulationState));
            harness.setStoredStateValue(
                "articulations.v4",
                JSON.stringify(articulations.serializeArticulationsV4(articulationState)),
            );
            harness.setStoredStateValue("lane.v1", lane.serializeLaneStateV2(laneState));
            harness.setStoredStateValue("bounce.v1", null);
        });
        await sourcePage.waitForTimeout(50);
        await clickPresetBarAction(sourcePage, "share");
        await sourcePage.waitForFunction(() => {
            const shadow = document.querySelector("cosimo-preset-bar")?.shadowRoot;
            const dialog = shadow?.querySelector('[data-el="share-dialog"]');
            const input = shadow?.querySelector('[data-el="share-link"]');
            return dialog instanceof HTMLElement
                && !dialog.hidden
                && input instanceof HTMLInputElement
                && input.value.includes("#p=1.");
        });
        const sharedURL = await sourcePage.evaluate(() => {
            const input = document.querySelector("cosimo-preset-bar")?.shadowRoot
                ?.querySelector('[data-el="share-link"]');
            if (!(input instanceof HTMLInputElement)) throw new Error("Share link field is missing.");
            return input.value;
        });
        assert.match(sharedURL, /#p=1\.[A-Za-z0-9_-]+$/);
        await sourcePage.waitForFunction(async (expectedURL) => {
            try {
                return await navigator.clipboard.readText() === expectedURL;
            } catch {
                return false;
            }
        }, sharedURL);

        const { decodeSoundShareFragment } = await loadUIModule(repoRoot, "ui/shared/sound-share-link.ts");
        const decoded = await decodeSoundShareFragment(new URL(sharedURL).hash);
        assert.equal(decoded.ok, true, decoded.ok ? undefined : decoded.error.message);
        const envelope = decoded.value;
        const sourceSnapshot = await sourcePage.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot());
        assert.deepEqual(selectSoundDocument(sourceSnapshot, envelope), {
            parameters: envelope.preset.parameters,
            storedState: envelope.preset.storedState,
            supplementalStoredState: envelope.supplementalStoredState,
        });

        const targetContext = await browser.newContext();
        try {
            const targetPage = await openHarnessPage(targetContext, sharedURL);
            await targetPage.waitForFunction(() => {
                const shadow = document.querySelector("cosimo-preset-bar")?.shadowRoot;
                const dialog = shadow?.querySelector('[data-el="shared-load-dialog"]');
                return dialog instanceof HTMLElement
                    && !dialog.hidden
                    && dialog.querySelector("h3")?.textContent === "Load shared sound?";
            });
            await clickPresetBarAction(targetPage, "shared-load-confirm");
            await targetPage.waitForFunction(() => window.location.hash === "");
            await targetPage.waitForTimeout(50);
            const targetSnapshot = await targetPage.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot());
            assert.deepEqual(
                selectSoundDocument(targetSnapshot, envelope),
                selectSoundDocument(sourceSnapshot, envelope),
            );
            assert.equal(new URL(targetPage.url()).hash, "");
            await targetPage.close();
        } finally {
            await targetContext.close();
        }
    } finally {
        await sourcePage.close();
        await sourceContext.close();
    }
});

test("desktop and phone preset-bar layouts both expose the share action", async () => {
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const phoneContext = await browser.newContext({ viewport: { width: 393, height: 852 } });
    try {
        const desktopPage = await openHarnessPage(desktopContext);
        const desktop = await desktopPage.evaluate(() => {
            const button = document.querySelector("cosimo-preset-bar")?.shadowRoot
                ?.querySelector('[data-el="btn-share"]');
            return button instanceof HTMLButtonElement
                ? { disabled: button.disabled, display: getComputedStyle(button).display }
                : null;
        });
        assert.deepEqual(desktop, { disabled: false, display: "flex" });

        const phonePage = await openHarnessPage(phoneContext);
        await clickPresetBarAction(phonePage, "toggle-shell-menu");
        const phone = await phonePage.evaluate(() => {
            const presetBar = document.querySelector("cosimo-preset-bar");
            const row = presetBar?.shadowRoot?.querySelector('[data-el="menu-share"]');
            return {
                compact: presetBar?.hasAttribute("compact-synth") ?? false,
                row: row instanceof HTMLButtonElement
                    ? { disabled: row.disabled, text: row.textContent?.trim(), display: getComputedStyle(row).display }
                    : null,
            };
        });
        assert.equal(phone.compact, true);
        assert.deepEqual(phone.row, { disabled: false, text: "Share sound link", display: "flex" });
        await desktopPage.close();
        await phonePage.close();
    } finally {
        await desktopContext.close();
        await phoneContext.close();
    }
});
