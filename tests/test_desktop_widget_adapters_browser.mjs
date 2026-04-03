import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

async function openModulePage() {
    const page = await browser.newPage();
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), { waitUntil: "load" });
    await page.evaluate(() => {
        const mountPoint = document.getElementById("mount");
        if (mountPoint instanceof HTMLElement) {
            mountPoint.style.width = "520px";
            mountPoint.style.height = "240px";
            mountPoint.style.padding = "24px";
        }
    });
    return page;
}

async function installHarness(page, exportName) {
    await page.evaluate(async (nextExportName) => {
        const helpers = await import("/tests/helpers/desktop_patch_modules_browser.tsx");
        const mountPoint = document.getElementById("mount");

        if (!(mountPoint instanceof HTMLElement)) {
            throw new Error("Module test mount point is missing.");
        }

        const install = helpers[nextExportName];

        if (typeof install !== "function") {
            throw new Error(`Unknown desktop module harness export: ${nextExportName}`);
        }

        await install(mountPoint);
    }, exportName);
}

async function invokeHarness(page, methodName, ...args) {
    return page.evaluate(([nextMethodName, nextArgs]) => {
        const harness = window.__COSIMO_DESKTOP_MODULE_HARNESS__;
        const method = harness?.[nextMethodName];

        if (typeof method !== "function") {
            throw new Error(`Desktop module harness method ${nextMethodName} is missing.`);
        }

        return method(...nextArgs);
    }, [methodName, args]);
}

async function getHarnessSnapshot(page) {
    return page.evaluate(() => {
        const harness = window.__COSIMO_DESKTOP_MODULE_HARNESS__;
        const getSnapshot = harness?.getSnapshot;

        if (typeof getSnapshot !== "function") {
            throw new Error("Desktop module harness snapshot reader is missing.");
        }

        return getSnapshot();
    });
}

async function settleBrowser(page, frameCount = 3) {
    await page.evaluate(async (nextFrameCount) => {
        for (let frameIndex = 0; frameIndex < nextFrameCount; frameIndex += 1) {
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        }
    }, frameCount);
}

function assertAlmostEqual(actual, expected, epsilon = 1e-6) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be within ${epsilon} of ${expected}.`);
}

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("ensureKeyboardElement defines the desktop keyboard custom element exactly once", async () => {
    const page = await openModulePage();

    try {
        const inspection = await page.evaluate(async () => {
            const helpers = await import("/tests/helpers/desktop_patch_modules_browser.tsx");
            return helpers.inspectEnsureKeyboardElement();
        });

        assert.equal(inspection.firstTagName, "cosimo-react-desktop-keyboard");
        assert.equal(inspection.secondTagName, "cosimo-react-desktop-keyboard");
        assert.deepEqual(inspection.defineCalls, ["cosimo-react-desktop-keyboard"]);
        assert.equal(inspection.isDefined, true);
    } finally {
        await page.close();
    }
});

test("KeyboardDock updates root note and note count without rebuilding the keyboard, then detaches on unmount", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installKeyboardDockHarness");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.tagName === "cosimo-react-desktop-keyboard";
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.keyboardIdentity !== null, true);
        assert.deepEqual(snapshot.lifetimeAttachCalls, [{ endpointID: "midiIn" }]);
        assert.equal(snapshot.lifetimeDetachCount, 0);
        assert.equal(snapshot.rootNoteAttribute, "36");
        assert.equal(snapshot.noteCountAttribute, "25");
        const initialKeyboardIdentity = snapshot.keyboardIdentity;

        await invokeHarness(page, "setRootNote", 48);
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().rootNoteAttribute === "48");
        await settleBrowser(page);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.keyboardIdentity, initialKeyboardIdentity);
        assert.deepEqual(snapshot.lifetimeAttachCalls, [{ endpointID: "midiIn" }]);
        assert.equal(snapshot.lifetimeDetachCount, 0);
        assert.equal(snapshot.rootNoteAttribute, "48");

        await invokeHarness(page, "setNoteCount", 37);
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().noteCountAttribute === "37");
        await settleBrowser(page);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.keyboardIdentity, initialKeyboardIdentity);
        assert.deepEqual(snapshot.lifetimeAttachCalls, [{ endpointID: "midiIn" }]);
        assert.equal(snapshot.lifetimeDetachCount, 0);
        assert.equal(snapshot.noteCountAttribute, "37");

        await invokeHarness(page, "unmount");
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.lifetimeDetachCount, 1);
    } finally {
        await page.close();
    }
});

test("KeyboardDock recomputes key widths on resize without rebuilding the keyboard", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installKeyboardDockHarness");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return typeof snapshot?.naturalWidth === "number" && snapshot.naturalWidth > 0;
        });

        const initialSnapshot = await getHarnessSnapshot(page);
        const initialKeyboardIdentity = initialSnapshot.keyboardIdentity;
        await invokeHarness(page, "setHostWidth", 720);
        await page.waitForFunction((previousWidth) => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return typeof snapshot?.naturalWidth === "number" && snapshot.naturalWidth > previousWidth;
        }, initialSnapshot.naturalWidth);
        await settleBrowser(page);

        const resizedSnapshot = await getHarnessSnapshot(page);
        assert.equal(resizedSnapshot.keyboardIdentity, initialKeyboardIdentity);
        assert.deepEqual(resizedSnapshot.lifetimeAttachCalls, [{ endpointID: "midiIn" }]);
        assert.equal(resizedSnapshot.lifetimeDetachCount, 0);
        assert.ok(resizedSnapshot.naturalWidth > initialSnapshot.naturalWidth);
        assert.ok(resizedSnapshot.accidentalWidth > initialSnapshot.accidentalWidth);
    } finally {
        await page.close();
    }
});

test("NexusNumberField keeps one widget instance and uses passiveUpdate for external value changes when unfocused", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installNexusNumberFieldHarness");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().createdCount === 1);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.createdCount, 1);
        assert.deepEqual(snapshot.options, {
            size: [118, 42],
            value: 0.25,
            min: 0,
            max: 2,
            step: 0.001,
        });
        assert.equal(snapshot.decimalPlaces, 3);
        assert.equal(snapshot.ariaLabel, "Glide Time");
        assert.equal(snapshot.inputStyles.borderRadius, "16px");
        assert.equal(snapshot.hostStyles.cursor, "ns-resize");

        await invokeHarness(page, "setBindingValue", 0.75);
        await page.waitForFunction(() => {
            const nextSnapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return Array.isArray(nextSnapshot?.passiveUpdates) && nextSnapshot.passiveUpdates.includes(0.75);
        });
        await settleBrowser(page);

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.createdCount, 1);
        assert.equal(snapshot.destroyCount, 0);
        assert.deepEqual(snapshot.passiveUpdates, [0.75]);
        assert.equal(snapshot.renderCount, 1);
    } finally {
        await page.close();
    }
});

test("NexusNumberField clamps widget changes, keeps focus-owned updates local, and ends text entry on blur before unmount", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installNexusNumberFieldHarness");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().createdCount === 1);

        await invokeHarness(page, "emitChange", 3.5);
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return Array.isArray(snapshot?.passiveUpdates) && snapshot.passiveUpdates.includes(2);
        });
        await settleBrowser(page);
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.setValueCalls, [2]);
        const passiveUpdatesAfterClamp = [...snapshot.passiveUpdates];
        const renderCountAfterClamp = snapshot.renderCount;

        await invokeHarness(page, "focusInput");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().activeElementTagName === "input");
        await invokeHarness(page, "setBindingValue", 1.25);
        await settleBrowser(page);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.passiveUpdates, passiveUpdatesAfterClamp);
        assert.equal(snapshot.renderCount, renderCountAfterClamp);
        assert.deepEqual(snapshot.activationLog, ["activate", "begin"]);

        await invokeHarness(page, "blurInput");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().activeElementTagName !== "input");
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.activationLog, ["activate", "begin", "end"]);

        await invokeHarness(page, "unmount");
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.destroyCount, 1);
        assert.deepEqual(snapshot.activationLog, ["activate", "begin", "end"]);
    } finally {
        await page.close();
    }
});
