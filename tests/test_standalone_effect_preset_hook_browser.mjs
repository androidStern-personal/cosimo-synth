import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

async function openModulePage() {
    const page = await browser.newPage();
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), { waitUntil: "load" });
    return page;
}

async function installHarness(page) {
    await page.evaluate(async () => {
        const helpers = await import("/tests/helpers/desktop_patch_modules_browser.tsx");
        const mountPoint = document.getElementById("mount");

        if (!(mountPoint instanceof HTMLElement)) {
            throw new Error("Module test mount point is missing.");
        }

        await helpers.installStandaloneEffectPresetHookHarness(mountPoint);
    });
}

async function invokeHarness(page, methodName, ...args) {
    return page.evaluate(([nextMethodName, nextArgs]) => {
        const harness = window.__COSIMO_DESKTOP_MODULE_HARNESS__;
        const method = harness?.[nextMethodName];

        if (typeof method !== "function") {
            throw new Error(`Standalone effect preset hook harness method ${nextMethodName} is missing.`);
        }

        return method(...nextArgs);
    }, [methodName, args]);
}

async function getHarnessSnapshot(page) {
    return page.evaluate(() => {
        const harness = window.__COSIMO_DESKTOP_MODULE_HARNESS__;
        const getSnapshot = harness?.getSnapshot;

        if (typeof getSnapshot !== "function") {
            throw new Error("Standalone effect preset hook harness snapshot reader is missing.");
        }

        return getSnapshot();
    });
}

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("useStandaloneEffectPresets attaches the controller, applies the initial filter, exposes stable mutations, and detaches cleanly", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page);
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.latest?.ready === true
                && snapshot.latest.visibleLabels.length === 1
                && snapshot.latest.visibleLabels[0] === "Envelope Tamed"
                && snapshot.latest.missingCurrentValueEndpointIDs.length === 0;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.latest.filter, {
            query: "env",
            source: "all",
        });
        assert.deepEqual(snapshot.latest.presetKeys, [
            "factory:ott.default-smash",
            "factory:ott.envelope-tamed",
        ]);
        assert.deepEqual(snapshot.latest.visibleLabels, ["Envelope Tamed"]);
        assert.equal(snapshot.latest.mutationsStable, true);
        assert.deepEqual(snapshot.latest.currentValues, {
            envelopeBoostClampDb: 6,
            ottAmount: 22,
            ottBandDrive: 0,
            ottEnvelopeMatch: 0,
            ottMix: 11,
            ottTimePercent: 100,
        });
        assert.deepEqual(snapshot.requestedParameters, [
            "envelopeBoostClampDb",
            "ottAmount",
            "ottBandDrive",
            "ottEnvelopeMatch",
            "ottMix",
            "ottTimePercent",
        ]);
        assert.deepEqual(snapshot.listenerCounts, {
            storedState: 1,
            parameters: {
                envelopeBoostClampDb: 1,
                ottAmount: 1,
                ottBandDrive: 1,
                ottEnvelopeMatch: 1,
                ottMix: 1,
                ottTimePercent: 1,
            },
        });
        assert.deepEqual(snapshot.latest.mutationKeys, [
            "applyPreset",
            "clearLastError",
            "copyPresetToClipboard",
            "deletePreset",
            "duplicatePresetAsUserPreset",
            "exportPresetText",
            "importPresetText",
            "overwriteUserPreset",
            "pastePresetFromClipboard",
            "reapplyActivePreset",
            "refreshCurrentValues",
            "renamePreset",
            "saveCurrentAsNewPreset",
            "setFilter",
        ]);

        const applyResult = await invokeHarness(page, "applyEnvelopeTamed");
        assert.equal(applyResult.ok, true, applyResult.message);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.latest?.activePreset?.presetID === "ott.envelope-tamed";
        });
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.events, [
            { endpointID: "envelopeBoostClampDb", value: 6 },
            { endpointID: "ottAmount", value: 92 },
            { endpointID: "ottBandDrive", value: 12 },
            { endpointID: "ottEnvelopeMatch", value: 38 },
            { endpointID: "ottMix", value: 86 },
            { endpointID: "ottTimePercent", value: 100 },
        ]);
        assert.deepEqual(JSON.parse(snapshot.storedWrites.at(-1).value).activePresetByEffect.ott, {
            presetID: "ott.envelope-tamed",
            label: "Envelope Tamed",
            dirty: false,
        });
        assert.deepEqual(snapshot.latest.activePreset, {
            presetID: "ott.envelope-tamed",
            label: "Envelope Tamed",
            dirty: false,
        });

        await invokeHarness(page, "unmount");
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.listenerCounts, {
            storedState: 0,
            parameters: {
                envelopeBoostClampDb: 0,
                ottAmount: 0,
                ottBandDrive: 0,
                ottEnvelopeMatch: 0,
                ottMix: 0,
                ottTimePercent: 0,
            },
        });
    } finally {
        await page.close();
    }
});

test("useStandaloneEffectPresets forwards stored-state adapters and migrations to the controller", async () => {
    const page = await openModulePage();

    try {
        await page.evaluate(async () => {
            const helpers = await import("/tests/helpers/desktop_patch_modules_browser.tsx");
            const mountPoint = document.getElementById("mount");

            if (!(mountPoint instanceof HTMLElement)) {
                throw new Error("Module test mount point is missing.");
            }

            await helpers.installStandaloneEffectPresetHookOptionsHarness(mountPoint);
        });
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.latest?.ready === true
                && snapshot.latest.presets.length === 1
                && snapshot.latest.presets[0].presetKey === "factory:hook.old-mix"
                && snapshot.latest.presets[0].canApply === true;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.latest.currentContractStoredStateKeys, ["hook.matrix.v1"]);
        assert.deepEqual(snapshot.latest.presets[0].parameters, { amount: 0.75 });
        assert.deepEqual(snapshot.latest.presets[0].storedState, {
            "hook.matrix.v1": { pattern: "ok" },
        });
        assert.equal(snapshot.latest.presets[0].contractHash, snapshot.latest.currentContractHash);
        assert.equal(snapshot.migrationCallCount > 0, true);

        const applyResult = await invokeHarness(page, "applyMigratedFactory");
        assert.equal(applyResult.ok, true, applyResult.message);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.adapterApplies?.length === 1;
        });
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.events, [
            { endpointID: "amount", value: 0.75 },
        ]);
        assert.deepEqual(snapshot.adapterApplies, [
            { pattern: "ok" },
        ]);
        assert.deepEqual(JSON.parse(snapshot.storedWrites.at(-1).value).activePresetByEffect["hook-stateful"], {
            presetID: "hook.old-mix",
            label: "Old Mix",
            dirty: false,
        });

        await invokeHarness(page, "unmount");
    } finally {
        await page.close();
    }
});
