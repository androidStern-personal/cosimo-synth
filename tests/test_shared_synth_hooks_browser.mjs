import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";
import {
    MSEG_EDITOR_HORIZONTAL_PADDING_PX,
    MSEG_EDITOR_VERTICAL_PADDING_PX,
    MSEG_POINT_RADIUS_PX,
} from "../patch_gui/mseg.js";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

const NOTE_A_36_ON = 9_446_500;
const NOTE_A_36_OFF = 8_397_824;

function buildShortMidi(status, noteNumber, velocity = 0) {
    return ((status & 0xff) << 16) | ((noteNumber & 0x7f) << 8) | (velocity & 0x7f);
}

function decodeMidiInputEvents(events) {
    return events.map(({ value }) => ({
        status: value >>> 16,
        note: (value >>> 8) & 0x7f,
        velocity: value & 0x7f,
    }));
}

async function openModulePage() {
    const page = await browser.newPage();
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), { waitUntil: "load" });
    await page.evaluate(() => {
        const mountPoint = document.getElementById("mount");
        if (mountPoint instanceof HTMLElement) {
            mountPoint.style.width = "640px";
            mountPoint.style.height = "320px";
            mountPoint.style.padding = "24px";
        }
    });
    return page;
}

async function installHarness(page, exportName, ...args) {
    await page.evaluate(async ([nextExportName, nextArgs]) => {
        const helpers = await import("/tests/helpers/desktop_patch_modules_browser.tsx");
        const mountPoint = document.getElementById("mount");

        if (!(mountPoint instanceof HTMLElement)) {
            throw new Error("Module test mount point is missing.");
        }

        const install = helpers[nextExportName];

        if (typeof install !== "function") {
            throw new Error(`Unknown desktop module harness export: ${nextExportName}`);
        }

        await install(mountPoint, ...nextArgs);
    }, [exportName, args]);
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

async function installAutoPreviewHarness(page) {
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1_000);
    await installHarness(page, "installAutoPreviewSynthHookHarness");
    await page.waitForFunction(() => (
        window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().ready === true
    ));
}

async function getSurfaceRect(page) {
    return page.evaluate(() => {
        const surface = document.querySelector('[data-role="mseg-surface"]');
        if (!(surface instanceof SVGSVGElement)) {
            throw new Error("MSEG surface is missing.");
        }

        const rect = surface.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        };
    });
}

function getIndependentVerticalSurfacePoint(rect, x, y) {
    const insetX = MSEG_POINT_RADIUS_PX + MSEG_EDITOR_HORIZONTAL_PADDING_PX;
    const insetY = MSEG_POINT_RADIUS_PX + MSEG_EDITOR_VERTICAL_PADDING_PX;
    const plotWidth = rect.width - (insetX * 2);
    const plotHeight = rect.height - (insetY * 2);

    return {
        x: rect.left + insetX + (y * plotWidth),
        y: rect.top + insetY + (x * plotHeight),
    };
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

test("desktop keyboard treats a cancelled touch as note release", async () => {
    const page = await openModulePage();

    try {
        const snapshot = await page.evaluate(async () => {
            const helpers = await import("/tests/helpers/desktop_patch_modules_browser.tsx");
            return helpers.inspectDesktopKeyboardTouchCancellation();
        });

        assert.deepEqual(snapshot.touchEndEventTypes, ["touchcancel"]);
    } finally {
        await page.close();
    }
});

test("usePatchEndpoint detaches high-rate streams while their visualizer is inactive", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installPatchEndpointActivityHarness");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().renderLog.length >= 1);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.listenerCount, 0);

        await invokeHarness(page, "emitFrame", { sequence: 1 });
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.lastRender, null);

        await invokeHarness(page, "setActive", true);
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().listenerCount === 1);
        await invokeHarness(page, "emitFrame", { sequence: 2 });
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().lastRender?.sequence === 2);

        await invokeHarness(page, "setActive", false);
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().listenerCount === 0);
        snapshot = await getHarnessSnapshot(page);
        const renderCountBeforeInactiveFrame = snapshot.renderLog.length;
        assert.equal(snapshot.lastRender, null);
        await invokeHarness(page, "emitFrame", { sequence: 3 });
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.renderLog.length, renderCountBeforeInactiveFrame);
        assert.equal(snapshot.lastRender, null);
    } finally {
        await page.close();
    }
});

test("visual endpoint delivery presents the latest frame without rendering repeated state", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installPatchVisualEndpointHarness");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().listenerCount === 1);

        const initial = await getHarnessSnapshot(page);
        await invokeHarness(page, "emitFrames", [
            { sequence: 1, values: [0.1, 0.2] },
            { sequence: 2, values: [0.2, 0.3] },
            { sequence: 3, values: [0.3, 0.4] },
        ]);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.lastRender, { sequence: 3, values: [0.3, 0.4] });
        assert.ok(
            snapshot.renderLog.length - initial.renderLog.length <= 1,
            `One visual burst must present at most one committed frame: ${JSON.stringify({ initial, snapshot })}`,
        );

        const repeatedFrame = { sequence: 3, values: [0.3, 0.4] };
        const beforeRepeated = snapshot.renderCount;
        await invokeHarness(page, "emitFrames", Array.from({ length: 24 }, () => repeatedFrame), true);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.renderCount, beforeRepeated);
        assert.deepEqual(snapshot.lastRender, repeatedFrame);

        const pendingBurstPayloadReads = await invokeHarness(page, "emitMeasuredPendingBurst", 64, 2_048);
        assert.ok(
            pendingBurstPayloadReads <= 2,
            `A queued visual frame must replace pending payloads without rescanning them: ${pendingBurstPayloadReads}`,
        );
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.lastRender.sequence, 900);
        assert.equal(snapshot.lastRender.values.at(-1), 63);
    } finally {
        await page.close();
    }
});

test("shared analyzer activity reference-counts observers and disables only after the final release", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installAnalyzerActivityHarness");
        assert.equal(await invokeHarness(page, "acquireNonAnalyzer"), true);
        assert.deepEqual((await getHarnessSnapshot(page)).sentMessages, []);

        await invokeHarness(page, "acquireFirst");
        await invokeHarness(page, "acquireSecond");
        assert.deepEqual((await getHarnessSnapshot(page)).sentMessages, [
            { endpointID: "filterSpectrumActivity", value: 1 },
        ]);

        await invokeHarness(page, "releaseFirst");
        await invokeHarness(page, "releaseFirst");
        assert.deepEqual((await getHarnessSnapshot(page)).sentMessages, [
            { endpointID: "filterSpectrumActivity", value: 1 },
        ]);

        await invokeHarness(page, "releaseSecond");
        await invokeHarness(page, "releaseSecond");
        assert.deepEqual((await getHarnessSnapshot(page)).sentMessages, [
            { endpointID: "filterSpectrumActivity", value: 1 },
            { endpointID: "filterSpectrumActivity", value: 0 },
        ]);
    } finally {
        await page.close();
    }
});

test("Polish telemetry folds every union event before one RAF presentation in either arrival order", async () => {
    const page = await openModulePage();
    const meterA = {
        peakDbfs: -1.5,
        loudnessDbfs: -13.2,
        compressorGainReductionDb: -3.4,
    };
    const meterB = {
        peakDbfs: -4.25,
        loudnessDbfs: -17.5,
        compressorGainReductionDb: -1.75,
    };
    const spectrumA = {
        sampleRateHz: 4_096,
        magnitudes: Array.from({ length: 2_048 }, (_, index) => index === 200 ? 1 : 0),
    };
    const spectrumB = {
        sampleRateHz: 4_096,
        magnitudes: Array.from({ length: 2_048 }, (_, index) => index === 1_000 ? 0.75 : 0),
    };

    try {
        await installHarness(page, "installPolishTelemetryFoldHarness");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().listenerCount === 1
        ));

        await invokeHarness(page, "emitBurst", [meterA, spectrumA]);
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.lastRender.meter, meterA);
        assert.equal(snapshot.lastRender.spectrum.magnitudesDbfs.indexOf(0), 80);

        await invokeHarness(page, "emitBurst", [spectrumB, meterB]);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.lastRender.meter, meterB);
        assert.notEqual(snapshot.lastRender.spectrum, null);
        assert.equal(snapshot.lastRender.spectrum.timestampMs, 3);
    } finally {
        await page.close();
    }
});

test("route amount binding presents the canonical bridge value before the full modulation document rerenders", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installModulationRouteAmountBindingHarness");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.bindingValue === 0 && snapshot?.parentAmount === 0;
        });
        await page.clock.install();

        const accepted = await invokeHarness(page, "setAmount", 0.75);
        assert.equal(accepted, true);
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().bindingValue === 0.75
        ));

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.bindingValue, 0.75);
        assert.equal(snapshot.parentAmount, 0, "The broad modulation document should remain deferred during amount edits.");
        assert.deepEqual(snapshot.sentStoredAmounts, [0.75]);

        await page.clock.runFor(49);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.parentAmount, 0);

        await page.clock.runFor(1);
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().parentAmount === 0.75
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.bindingValue, 0.75);
        assert.equal(snapshot.parentAmount, 0.75);
        assert.deepEqual(snapshot.bindingRenderLog, [0, 0.75]);

        await invokeHarness(page, "emitCanonicalAmount", -0.25);
        await page.waitForFunction(() => {
            const nextSnapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return nextSnapshot?.bindingValue === -0.25 && nextSnapshot?.parentAmount === -0.25;
        });
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.bindingValue, -0.25, "An authoritative replacement must supersede the edited amount.");
        assert.equal(snapshot.parentAmount, -0.25);
        assert.deepEqual(snapshot.sentStoredAmounts, [0.75], "An external replacement must not be persisted back as a new edit.");
    } finally {
        await page.close();
    }
});

test("usePatchParameterBinding resets stale display state when the active endpoint changes", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installPatchParameterRebindingHarness");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().requestedParameters.length === 1);
        await invokeHarness(page, "emitParameter", "parameterA", 0.8);
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().lastRender?.value === 0.8);

        await invokeHarness(page, "selectEndpoint", "parameterB");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().requestedParameters.length === 2);

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.requestedParameters, ["parameterA", "parameterB"]);
        assert.deepEqual(snapshot.listenerCounts, { parameterA: 0, parameterB: 1 });
        assert.deepEqual(snapshot.lastRender, { endpointID: "parameterB", value: 0.25 });
    } finally {
        await page.close();
    }
});

test("host readiness blocks ambiguous parameter writes and stale stored-state hydration", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installPatchParameterHostBaselineHarness");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().first.requests.length === 1
        ));
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.hostBaseline, { _tag: "pending" });
        assert.equal(snapshot.controlDisabled, true);

        await invokeHarness(page, "beginGesture");
        await invokeHarness(page, "writeValue", 0.2);
        await invokeHarness(page, "writeValue", 0.3);
        await invokeHarness(page, "endGesture");
        await invokeHarness(page, "commitValue", 0.4);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.1, "rapid pre-baseline writes cannot change presentation");
        assert.deepEqual(snapshot.first.writes, [], "rapid pre-baseline writes cannot reach the host");
        assert.deepEqual(snapshot.first.gestures, [], "a pre-baseline gesture cannot reach the host");

        await invokeHarness(page, "emitResponse", "first", "parameterA", 0.2);
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().hostBaseline?.value === 0.2
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.2);
        assert.equal(snapshot.controlDisabled, false);
        assert.deepEqual(snapshot.hostBaseline, { _tag: "host-confirmed", value: 0.2 });

        await invokeHarness(page, "beginGesture");
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.first.gestures, ["start:parameterA"]);
        assert.deepEqual(snapshot.userGestureCounts, { starts: 1, ends: 0 });

        await invokeHarness(page, "writeValue", 0.3);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.3);
        assert.deepEqual(snapshot.hostBaseline, { _tag: "host-confirmed", value: 0.2 });
        assert.deepEqual(snapshot.first.writes, [{ endpointID: "parameterA", value: 0.3 }]);

        await invokeHarness(page, "selectEndpoint", "parameterB");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().first.requests.length === 2
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.1);
        assert.deepEqual(snapshot.hostBaseline, { _tag: "pending" });
        assert.equal(snapshot.controlDisabled, true);
        assert.deepEqual(snapshot.first.listenerCounts, { parameterA: 0, parameterB: 1 });
        assert.deepEqual(snapshot.first.gestures, ["start:parameterA", "end:parameterA"]);
        assert.deepEqual(snapshot.userGestureCounts, { starts: 1, ends: 1 });
        await invokeHarness(page, "endGesture");
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.first.gestures, ["start:parameterA", "end:parameterA"], "pointer-up after rebinding cannot double-end the old gesture");

        await invokeHarness(page, "writeValue", 0.8);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.1, "an exact-value echo cannot exist when the pre-baseline write is blocked");
        assert.deepEqual(snapshot.first.writes, [{ endpointID: "parameterA", value: 0.3 }]);
        await invokeHarness(page, "emitResponse", "first", "parameterB", 0.8);
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().hostBaseline?.value === 0.8
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.8, "an authoritative value equal to the attempted edit must still enable the endpoint");
        assert.equal(snapshot.controlDisabled, false);

        await invokeHarness(page, "beginGesture");
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.first.gestures.at(-1), "start:parameterB");
        await invokeHarness(page, "endStaleGesture");
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.first.gestures.slice(-1),
            ["start:parameterB"],
            "a delayed pointer-up owned by parameter A cannot close parameter B's gesture",
        );
        assert.deepEqual(snapshot.userGestureCounts, { starts: 2, ends: 1 });
        await invokeHarness(page, "endGesture");
        await invokeHarness(page, "beginGesture");

        await invokeHarness(page, "selectConnection", "second");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().second.requests.length === 1
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.1, "a new connection starts from its own presentation default");
        assert.deepEqual(snapshot.hostBaseline, { _tag: "pending" });
        assert.equal(snapshot.controlDisabled, true);
        assert.deepEqual(snapshot.first.listenerCounts, { parameterA: 0, parameterB: 0 });
        assert.deepEqual(snapshot.second.listenerCounts, { parameterB: 1 });
        assert.deepEqual(snapshot.first.gestures.slice(-2), ["start:parameterB", "end:parameterB"]);
        assert.deepEqual(snapshot.userGestureCounts, { starts: 3, ends: 3 });

        await invokeHarness(page, "writeValue", 0.8);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.1);
        assert.deepEqual(snapshot.hostBaseline, { _tag: "pending" });
        assert.deepEqual(snapshot.second.writes, []);

        await invokeHarness(page, "emitResponse", "first", "parameterB", 0.6);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.hostBaseline, { _tag: "pending" }, "a detached connection response must be ignored");

        await invokeHarness(page, "emitResponse", "second", "parameterB", 0.25);
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().hostBaseline?.value === 0.25
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.25);
        assert.deepEqual(snapshot.hostBaseline, { _tag: "host-confirmed", value: 0.25 });
        assert.equal(snapshot.controlDisabled, false);

        await invokeHarness(page, "writeValue", 0.8);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, 0.8);
        assert.deepEqual(snapshot.second.writes, [{ endpointID: "parameterB", value: 0.8 }]);
        await invokeHarness(page, "emitResponse", "second", "parameterB", Math.fround(0.8));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value, Math.fround(0.8), "float32 host echoes work normally after readiness");
        assert.deepEqual(snapshot.hostBaseline, { _tag: "host-confirmed", value: 0.25 });

        await invokeHarness(page, "beginGesture");
        await invokeHarness(page, "endGesture");
        await invokeHarness(page, "endGesture");
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.second.gestures, ["start:parameterB", "end:parameterB"]);
        assert.deepEqual(snapshot.userGestureCounts, { starts: 4, ends: 4 });

        await invokeHarness(page, "selectConnection", "fallback");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().hostBaseline?._tag === "host-confirmed"
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.hostBaseline,
            { _tag: "host-confirmed", value: 0.1 },
            "a bare adapter must explicitly declare its initial value authoritative",
        );
        assert.equal(snapshot.controlDisabled, false);
        await invokeHarness(page, "writeValue", 0.4);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.fallback.writes, [{ endpointID: "parameterB", value: 0.4 }]);

        await invokeHarness(page, "selectConnection", "untrusted");
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.hostBaseline, { _tag: "pending" });
        assert.equal(snapshot.controlDisabled, true);
        await invokeHarness(page, "writeValue", 0.9);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.untrusted.writes,
            [],
            "an adapter with no response protocol and no explicit fallback cannot certify readiness",
        );
    } finally {
        await page.close();
    }

    const unmountPage = await openModulePage();
    try {
        await installHarness(unmountPage, "installPatchParameterHostBaselineHarness");
        await unmountPage.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().first.requests.length === 1
        ));
        await invokeHarness(unmountPage, "emitResponse", "first", "parameterA", 0.2);
        await invokeHarness(unmountPage, "beginGesture");
        await invokeHarness(unmountPage, "unmount");
        const unmountSnapshot = await getHarnessSnapshot(unmountPage);
        assert.deepEqual(unmountSnapshot.first.gestures, ["start:parameterA", "end:parameterA"]);
        assert.deepEqual(unmountSnapshot.userGestureCounts, { starts: 1, ends: 1 });
    } finally {
        await unmountPage.close();
    }

    const hydrationPage = await openModulePage();
    try {
        await installHarness(hydrationPage, "installArticulationReconnectHydrationHarness");
        await hydrationPage.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().pendingRequests.first > 0
        ));
        let hydrationSnapshot = await getHarnessSnapshot(hydrationPage);
        assert.equal(hydrationSnapshot.hasHydrated, false);
        assert.equal(hydrationSnapshot.canCapture, false);
        assert.equal(hydrationSnapshot.captureDisabled, true);

        await invokeHarness(hydrationPage, "selectConnection", "second");
        await hydrationPage.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().pendingRequests.second > 0
        ));
        await invokeHarness(hydrationPage, "releaseFullStoredState", "first");
        hydrationSnapshot = await getHarnessSnapshot(hydrationPage);
        assert.equal(hydrationSnapshot.hasHydrated, false, "the disconnected callback cannot hydrate the active editor");
        assert.equal(hydrationSnapshot.canCapture, false);
        assert.equal(hydrationSnapshot.captureDisabled, true);
        assert.equal(hydrationSnapshot.slotCount, 0, "the disconnected callback cannot replace the visible bank");

        await invokeHarness(hydrationPage, "releaseFullStoredState", "second");
        await hydrationPage.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.hasHydrated === true && snapshot?.slotCount === 2;
        });
        hydrationSnapshot = await getHarnessSnapshot(hydrationPage);
        assert.equal(hydrationSnapshot.canCapture, true);
        assert.equal(hydrationSnapshot.captureDisabled, false);
        assert.equal(hydrationSnapshot.slotCount, 2, "only the active connection may hydrate the visible bank");
    } finally {
        await hydrationPage.close();
    }
});

test("discarded articulation undo is owned by one exact patch connection", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installArticulationReconnectHydrationHarness");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().pendingRequests.first > 0
        ));
        await invokeHarness(page, "releaseFullStoredState", "first");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.hasHydrated === true && snapshot?.slotCount === 2;
        });

        await invokeHarness(page, "createDiscardedEdit");
        let snapshot = await getHarnessSnapshot(page);
        assert.ok(snapshot.discardedEdit, JSON.stringify({
            selectedSlotId: snapshot.selectedSlotId,
            selectedIsDirty: snapshot.selectedIsDirty,
            slots: snapshot.slotNames,
            sentMessages: snapshot.connectionSnapshots.first.sentMessages,
        }));
        assert.equal(snapshot.undoButtonCount, 1);
        assert.equal(snapshot.undoDisabled, false);

        await invokeHarness(page, "selectConnection", "second");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().pendingRequests.second > 0
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.hasHydrated, false);
        assert.equal(snapshot.captureDisabled, true);
        assert.equal(snapshot.discardedEdit, null, "discard ownership cannot survive an exact connection change");
        assert.equal(snapshot.undoButtonCount, 0, "the loading connection must not present a stale Undo action");

        const secondStoredStateBefore = structuredClone(snapshot.connectionSnapshots.second.storedState);
        await invokeHarness(page, "clearConnectionLog", "second");
        await invokeHarness(page, "invokeUndoDiscard");
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.hasHydrated, false, "a stale Undo cannot self-mark a loading connection hydrated");
        assert.deepEqual(snapshot.connectionSnapshots.second.sentMessages, [], "a stale Undo cannot write old sound values into the new connection");
        assert.deepEqual(
            snapshot.connectionSnapshots.second.storedState,
            secondStoredStateBefore,
            "a stale Undo cannot persist the old articulation bank into the new connection",
        );

        await invokeHarness(page, "releaseFullStoredState", "second");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().hasHydrated === true
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.captureDisabled, false);
        assert.equal(snapshot.undoButtonCount, 0);
    } finally {
        await page.close();
    }
});

test("request-by-key articulation hydration accepts empty and valid replies and rejects stale reconnects", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installArticulationKeyHydrationHarness");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().pendingRequests.undefined === 1
        ));
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.hasHydrated, false);
        assert.equal(snapshot.captureDisabled, true);

        await invokeHarness(page, "releaseArticulationState", "undefined");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().hasHydrated === true
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.slotCount, 0, "an explicit undefined initial value hydrates the default empty bank");
        assert.equal(snapshot.captureDisabled, false);

        await invokeHarness(page, "selectConnection", "malformed");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().pendingRequests.malformed === 1
        ));
        assert.equal((await getHarnessSnapshot(page)).hasHydrated, false);
        await invokeHarness(page, "releaseArticulationState", "malformed");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().hasHydrated === true
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.slotCount, 0, "a malformed initial value completes hydration with the default empty bank");

        await invokeHarness(page, "selectConnection", "valid");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().pendingRequests.valid === 1
        ));
        await invokeHarness(page, "releaseArticulationState", "valid");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().slotCount === 1
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.hasHydrated, true);
        assert.equal(snapshot.captureDisabled, false);

        await invokeHarness(page, "selectConnection", "reconnectOld");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().pendingRequests.reconnectOld === 1
        ));
        await invokeHarness(page, "selectConnection", "reconnectNew");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().pendingRequests.reconnectNew === 1
        ));
        await invokeHarness(page, "releaseArticulationState", "reconnectOld");
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.hasHydrated, false, "the old key response cannot hydrate a newly selected connection");
        assert.equal(snapshot.captureDisabled, true);
        await invokeHarness(page, "releaseArticulationState", "reconnectNew");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().slotCount === 2
                && window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().hasHydrated === true
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.captureDisabled, false);
    } finally {
        await page.close();
    }
});

test("precision drag yields to clamped host echoes and endpoint changes without repeating unchanged values", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installPrecisionOptimisticEchoHarness");
        const input = page.locator('[data-role="optimistic-precision-control"] input');
        const bounds = await input.boundingBox();
        assert.ok(bounds);
        const pointer = {
            pointerId: 91,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientY: bounds.y + (bounds.height / 2),
        };
        await input.dispatchEvent("pointerdown", {
            ...pointer,
            clientX: bounds.x + (bounds.width / 2),
        });
        await input.dispatchEvent("pointermove", {
            ...pointer,
            clientX: bounds.x + (bounds.width * 0.75),
        });
        await input.dispatchEvent("pointermove", {
            ...pointer,
            clientX: bounds.x + (bounds.width * 0.75),
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.sentValues.length, 1, JSON.stringify(snapshot));
        assert.notEqual(snapshot.displayedValue, "5 ct");
        await input.dispatchEvent("pointerup", { ...pointer, buttons: 0 });

        const secondPointer = { ...pointer, pointerId: 92 };
        await input.dispatchEvent("pointerdown", {
            ...secondPointer,
            clientX: bounds.x + (bounds.width / 2),
        });
        await input.dispatchEvent("pointermove", {
            ...secondPointer,
            clientX: bounds.x + (bounds.width * 0.75),
        });
        await input.dispatchEvent("pointerup", { ...secondPointer, buttons: 0 });
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.sentValues.length, 2, JSON.stringify(snapshot));
        assert.ok(snapshot.sentValues[1] > snapshot.sentValues[0], JSON.stringify(snapshot));

        await invokeHarness(page, "emitAuthoritativeValue", "parameterA", 0.2);
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().displayedValue === "10 ct"
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.displayedValue, "10 ct");

        await invokeHarness(page, "emitAuthoritativeValue", "parameterB", 0.6);
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().displayedValue === "30 ct"
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.displayedValue, "30 ct");

        assert.deepEqual((await getHarnessSnapshot(page)).gestures, [
            "begin:parameterA",
            "end:parameterA",
            "begin:parameterA",
            "end:parameterA",
        ]);
    } finally {
        await page.close();
    }
});

test("useFactoryBankCatalog loads the catalog and exposes the resolved table metadata", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installFactoryBankCatalogHookHarness");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().requests.length === 1);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.requests, [{
            clientID: "alpha",
            path: "assets/factory-bank-catalog.json",
        }]);
        assert.deepEqual(snapshot.lastRender, {
            catalog: null,
            error: null,
        });

        await invokeHarness(page, "resolveNext", "alpha", {
            tables: [{
                tableId: "acid",
                name: "BS2 - Acid",
                frameCount: 128,
                sourceWav: "assets/factory_sources/imported/BS2 - Acid.wav",
            }],
        });
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.lastRender?.catalog?.tables?.[0]?.tableId === "acid";
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.lastRender, {
            catalog: {
                tables: [{
                    tableId: "acid",
                    name: "BS2 - Acid",
                    frameCount: 128,
                    sourceWav: "assets/factory_sources/imported/BS2 - Acid.wav",
                }],
            },
            error: null,
        });
    } finally {
        await page.close();
    }
});

test("useFactoryBankCatalog surfaces loader errors and ignores stale earlier clients after the provider changes", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installFactoryBankCatalogHookHarness");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().requests.length === 1);

        await invokeHarness(page, "rejectNext", "alpha", "catalog fail");
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.lastRender?.error?.includes?.("catalog fail");
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.lastRender.catalog, null);
        assert.match(snapshot.lastRender.error, /catalog fail/);

        await page.close();
    } finally {
        // page closed intentionally below after the first failure case.
    }

    const stalePage = await openModulePage();

    try {
        await installHarness(stalePage, "installFactoryBankCatalogHookHarness");
        await stalePage.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().requests.length === 1);

        await invokeHarness(stalePage, "switchClient", "beta");
        await stalePage.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().requests.length === 2);

        await invokeHarness(stalePage, "resolveNext", "alpha", {
            tables: [{
                tableId: "stale-alpha",
                name: "Stale Alpha",
                frameCount: 1,
                sourceWav: "assets/factory_sources/stale-alpha.wav",
            }],
        });

        let snapshot = await getHarnessSnapshot(stalePage);
        assert.deepEqual(snapshot.lastRender, {
            catalog: null,
            error: null,
        });

        await invokeHarness(stalePage, "resolveNext", "beta", {
            tables: [{
                tableId: "fresh-beta",
                name: "Fresh Beta",
                frameCount: 1,
                sourceWav: "assets/factory_sources/fresh-beta.wav",
            }],
        });
        await stalePage.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.lastRender?.catalog?.tables?.[0]?.tableId === "fresh-beta";
        });

        snapshot = await getHarnessSnapshot(stalePage);
        assert.equal(snapshot.lastRender.catalog.tables[0].tableId, "fresh-beta");
        assert.equal(snapshot.lastRender.error, null);
    } finally {
        await stalePage.close();
    }
});

test("useFactoryBankCatalog does not render stale results after unmount", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installFactoryBankCatalogHookHarness");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().renderLog.length === 1);

        const beforeUnmountSnapshot = await getHarnessSnapshot(page);
        await invokeHarness(page, "unmount");
        await invokeHarness(page, "resolveNext", "alpha", {
            tables: [{
                tableId: "late-catalog",
                name: "Late Catalog",
                frameCount: 1,
                sourceWav: "assets/factory_sources/late.wav",
            }],
        });

        const afterUnmountSnapshot = await getHarnessSnapshot(page);
        assert.equal(afterUnmountSnapshot.renderLog.length, beforeUnmountSnapshot.renderLog.length);
        assert.deepEqual(afterUnmountSnapshot.lastRender, beforeUnmountSnapshot.lastRender);
    } finally {
        await page.close();
    }
});

test("useFactoryTableFrames follows the requested table index, ignores stale audio responses, and surfaces load failures", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installFactoryTableFramesHookHarness");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.requests?.some?.(({ kind, path }) => kind === "audio" && path === "assets/factory_sources/table-a.wav");
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.requests[0].kind, "json");
        assert.deepEqual(snapshot.requests.slice(0, 2), [
            { kind: "json", path: "assets/factory-bank-catalog.json" },
            { kind: "audio", path: "assets/factory_sources/table-a.wav" },
        ]);

        await invokeHarness(page, "setTableIndex", 1);
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.requests?.filter?.(({ kind }) => kind === "audio")?.length === 2;
        });

        await invokeHarness(page, "resolveAudio", "assets/factory_sources/table-a.wav", 1.0);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.lastRender, {
            frameCount: null,
            firstSample: null,
            error: null,
        });

        await invokeHarness(page, "resolveAudio", "assets/factory_sources/table-b.wav", 2.0);
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.lastRender?.frameCount === 1;
        });
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.lastRender.frameCount, 1);
        assertAlmostEqual(snapshot.lastRender.firstSample, 1.9990234375, 1e-9);
        assert.equal(snapshot.lastRender.error, null);
    } finally {
        await page.close();
    }

    const rejectPage = await openModulePage();

    try {
        await installHarness(rejectPage, "installFactoryTableFramesHookHarness");
        await rejectPage.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.pendingPaths?.includes?.("assets/factory_sources/table-a.wav");
        });

        await invokeHarness(rejectPage, "rejectAudio", "assets/factory_sources/table-a.wav", "audio fail");
        await rejectPage.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.lastRender?.error?.includes?.("audio fail");
        });

        const snapshot = await getHarnessSnapshot(rejectPage);
        assert.equal(snapshot.lastRender.frameCount, null);
        assert.match(snapshot.lastRender.error, /audio fail/);
    } finally {
        await rejectPage.close();
    }
});

test("useObservedDisplayPosition falls back to the parameter value and ignores out-of-order generations", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installObservedDisplayPositionHookHarness");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().renderLog.length === 1);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.renderLog, [0.18]);

        await invokeHarness(page, "setParameterPosition", 0.33);
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().lastPosition === 0.33);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.renderLog, [0.18, 0.33]);

        await invokeHarness(page, "emitObservedPosition", {
            voiceGeneration: 2,
            position: 0.76,
        });
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().lastPosition === 0.76);

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.lastPosition, 0.76);

        await invokeHarness(page, "emitObservedPosition", {
            voiceGeneration: 1,
            position: 0.12,
        });
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.lastPosition, 0.76);
    } finally {
        await page.close();
    }
});

test("useMsegState attaches once, requests boot state for UI only, and detaches on unmount", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installMsegStateHookHarness");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.requestFullStoredStateCount === 1 && snapshot?.lastRender?.shape?.points?.length === 2;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.addStoredStateValueListenerCount, 1);
        assert.equal(snapshot.requestFullStoredStateCount, 1);
        assert.equal(snapshot.storedStateListenerCount, 1);
        assert.equal(snapshot.lastRender.shape.points.length, 2);
        assert.equal(snapshot.lastRender.playback.rate.seconds, 1);
        assert.deepEqual(snapshot.sentEvents, []);

        await invokeHarness(page, "unmount");
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.removeStoredStateValueListenerCount, 1);
        assert.equal(snapshot.storedStateListenerCount, 0);
    } finally {
        await page.close();
    }
});

test("useStagePositionDrag preserves the swipe threshold and begin-set-end gesture ordering", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installStagePositionDragHookHarness");

        await invokeHarness(page, "dispatchPointer", "#stage", "pointerdown", {
            pointerId: 1,
            button: 0,
            clientX: 32,
            clientY: 160,
        });
        await invokeHarness(page, "dispatchPointer", "#stage", "pointermove", {
            pointerId: 1,
            button: 0,
            clientX: 32,
            clientY: 159,
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureLog, ["begin"]);
        assert.deepEqual(snapshot.setValues, []);

        await invokeHarness(page, "dispatchPointer", "#stage", "pointermove", {
            pointerId: 1,
            button: 0,
            clientX: 32,
            clientY: 60,
        });
        await invokeHarness(page, "dispatchPointer", "#stage", "pointerup", {
            pointerId: 1,
            button: 0,
            clientX: 32,
            clientY: 60,
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureLog, ["begin", "end"]);
        assert.equal(snapshot.setValues.length, 1);
        assertAlmostEqual(snapshot.setValues[0], 0.9, 1e-9);
    } finally {
        await page.close();
    }
});

test("useStagePositionDrag closes the host gesture when the window blurs", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installStagePositionDragHookHarness");
        await invokeHarness(page, "dispatchPointer", "#stage", "pointerdown", {
            pointerId: 31,
            button: 0,
            clientX: 32,
            clientY: 160,
        });

        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForTimeout(20);
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureLog, ["begin", "end"]);

        await invokeHarness(page, "dispatchPointer", "#stage", "pointerup", {
            pointerId: 31,
            button: 0,
            clientX: 32,
            clientY: 60,
        });
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureLog, ["begin", "end"]);
        assert.deepEqual(snapshot.setValues, []);
    } finally {
        await page.close();
    }
});

test("useStagePositionDrag keeps tracking touch outside the stage when pointer capture is unavailable", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installStagePositionDragHookHarness");
        const captureRejects = await page.evaluate(() => {
            const stage = document.querySelector("#stage");
            if (!(stage instanceof HTMLElement)) {
                throw new Error("Missing stage.");
            }
            stage.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
            try {
                stage.setPointerCapture(32);
                return false;
            } catch {
                return true;
            }
        });
        assert.equal(captureRejects, true);
        await invokeHarness(page, "dispatchPointer", "#stage", "pointerdown", {
            pointerId: 32,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: 32,
            clientY: 160,
        });
        await page.evaluate(() => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                pointerId: 32,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: 32,
                clientY: 60,
                bubbles: true,
            }));
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureLog, ["begin"]);
        assert.equal(snapshot.setValues.length, 1);
        assertAlmostEqual(snapshot.setValues[0], 0.9, 1e-9);

        await page.evaluate(() => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId: 32,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: 32,
                clientY: 60,
                bubbles: true,
            }));
        });
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureLog, ["begin", "end"]);
    } finally {
        await page.close();
    }
});

test("useStagePositionDrag ignores pointer starts on select, button, and input controls", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installStagePositionDragHookHarness");

        let pointerId = 2;
        for (const selector of ["#stage-button", "#stage-select", "#stage-input"]) {
            await invokeHarness(page, "dispatchPointer", selector, "pointerdown", {
                pointerId,
                button: 0,
                clientX: 24,
                clientY: 24,
            });
            pointerId += 1;
        }

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureLog, []);
        assert.deepEqual(snapshot.setValues, []);
    } finally {
        await page.close();
    }
});

test("useSynthKeyboardRouting keeps arrow ownership, blocks note entry during text edits, and shifts octaves on z and x", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSynthKeyboardRoutingHookHarness");

        await invokeHarness(page, "focus", "#wavetable-target");
        await invokeHarness(page, "pressKey", "ArrowRight");
        await invokeHarness(page, "focus", "#play-mode-target");
        await invokeHarness(page, "pressKey", "ArrowLeft");
        await invokeHarness(page, "focus", "#mseg-rate-target");
        await invokeHarness(page, "pressKey", "ArrowLeft");

        await invokeHarness(page, "mouseDown", "#glide-target");
        await invokeHarness(page, "focus", "#glide-target");
        await invokeHarness(page, "pressKey", "ArrowRight");
        await invokeHarness(page, "pressKey", "ArrowLeft");
        await invokeHarness(page, "pressKey", "a");
        await invokeHarness(page, "pressKey", "z");

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.rootNote, 36);

        await invokeHarness(page, "blur", "#glide-target");
        await invokeHarness(page, "pressKey", "z");
        await invokeHarness(page, "pressKey", "z", false);

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.rootNote, 24);

        await invokeHarness(page, "pressKey", "x");
        await invokeHarness(page, "pressKey", "x", false);
        await invokeHarness(page, "pressKey", "a");
        await invokeHarness(page, "pressKey", "a", false);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.stepLog, {
            wavetable: [1],
            playMode: [-1],
            msegRate: [-1],
            glide: [1, -1],
        });
        assert.equal(snapshot.rootNote, 36);
        assert.equal(snapshot.keyboardLog.allNotesOffCount, 3);
        assert.deepEqual(snapshot.keyboardLog.handledKeys, []);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: NOTE_A_36_ON },
            { endpointID: "midiIn", value: NOTE_A_36_OFF },
        ]);
        assert.deepEqual(snapshot.keyboardLog.externalMidi, [
            NOTE_A_36_ON,
            NOTE_A_36_OFF,
        ]);
        assert.deepEqual(snapshot.keyEventLog.slice(-4).map(({ key, isDown, defaultPrevented }) => ({ key, isDown, defaultPrevented })), [
            { key: "x", isDown: true, defaultPrevented: true },
            { key: "x", isDown: false, defaultPrevented: true },
            { key: "a", isDown: true, defaultPrevented: true },
            { key: "a", isDown: false, defaultPrevented: true },
        ]);

        await invokeHarness(page, "pressKey", "z");
        await invokeHarness(page, "pressKey", "z");
        await invokeHarness(page, "pressKey", "z");

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.rootNote, 12);
        assert.equal(snapshot.keyboardLog.allNotesOffCount, 5);
    } finally {
        await page.close();
    }
});

test("useSynthKeyboardRouting leaves musical typing unclaimed in hosted mode", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSynthKeyboardRoutingHookHarness", { keyboardInputMode: "hosted" });

        await invokeHarness(page, "pressKey", "a");
        await invokeHarness(page, "pressKey", "a", false);
        await invokeHarness(page, "pressKey", "z");
        await invokeHarness(page, "pressKey", "z", false);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.rootNote, 36);
        assert.deepEqual(snapshot.midiInputEvents, []);
        assert.deepEqual(snapshot.keyboardLog.handledKeys, []);
        assert.deepEqual(snapshot.keyEventLog.map(({ key, isDown, defaultPrevented }) => ({ key, isDown, defaultPrevented })), [
            { key: "a", isDown: true, defaultPrevented: false },
            { key: "a", isDown: false, defaultPrevented: false },
            { key: "z", isDown: true, defaultPrevented: false },
            { key: "z", isDown: false, defaultPrevented: false },
        ]);
    } finally {
        await page.close();
    }
});

test("useSynthKeyboardRouting plays standalone notes from the native CHOC keyboard relay", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSynthKeyboardRoutingHookHarness");

        await invokeHarness(page, "postRelayedKey", "a");
        await invokeHarness(page, "postRelayedKey", "a", false);

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.keyEventLog, []);
        assert.deepEqual(snapshot.keyboardLog.handledKeys, []);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: NOTE_A_36_ON },
            { endpointID: "midiIn", value: NOTE_A_36_OFF },
        ]);
        assert.deepEqual(snapshot.keyboardLog.externalMidi, [
            NOTE_A_36_ON,
            NOTE_A_36_OFF,
        ]);
    } finally {
        await page.close();
    }
});

test("useSynthKeyboardRouting ignores malformed native CHOC keyboard relay messages", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSynthKeyboardRoutingHookHarness");

        await invokeHarness(page, "postWindowMessage", {
            source: "cosimo-standalone-keyboard",
            eventType: "keydown",
            code: "KeyA",
        });
        await invokeHarness(page, "postWindowMessage", {
            source: "cosimo-standalone-keyboard",
            eventType: "keydown",
            code: "KeyA",
            repeat: false,
            shiftKey: false,
            ctrlKey: true,
            altKey: false,
            metaKey: false,
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, []);
        assert.deepEqual(snapshot.keyboardLog.externalMidi, []);
        assert.deepEqual(snapshot.keyboardLog.handledKeys, []);
    } finally {
        await page.close();
    }
});

test("Auto-preview stays completely silent throughout an intentional held note", async () => {
    const page = await openModulePage();

    try {
        await installAutoPreviewHarness(page);
        await invokeHarness(page, "sendIntentionalNote", 0x90, 64, 100);
        await invokeHarness(page, "beginParameterGesture");
        await invokeHarness(page, "setParameterValue", 1_200);
        await page.clock.runFor(100);
        await invokeHarness(page, "setParameterValue", 1_300);
        await invokeHarness(page, "endParameterGesture");
        await invokeHarness(page, "sendIntentionalNote", 0x80, 64, 0);
        await page.clock.runFor(1_000);

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 64, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 64, 0) },
        ]);
    } finally {
        await page.close();
    }
});

test("an intentional note press immediately releases only the sounding Auto-preview group", async () => {
    const page = await openModulePage();

    try {
        await installAutoPreviewHarness(page);
        await invokeHarness(page, "configureLoopSync");
        await invokeHarness(page, "beginParameterGesture");
        await invokeHarness(page, "setParameterValue", 1_200);
        await page.clock.runFor(100);
        await invokeHarness(page, "setParameterValue", 1_300);
        await page.clock.runFor(150);
        await invokeHarness(page, "sendIntentionalNote", 0x90, 67, 100);
        await page.clock.runFor(1_000);
        await invokeHarness(page, "sendIntentionalNote", 0x80, 67, 0);
        await invokeHarness(page, "endParameterGesture");

        const snapshot = await getHarnessSnapshot(page);
        const decodedEvents = decodeMidiInputEvents(snapshot.midiInputEvents);
        assert.deepEqual(decodedEvents, [
            { status: 0x90, note: 60, velocity: 100 },
            { status: 0x80, note: 60, velocity: 0 },
            { status: 0x90, note: 67, velocity: 100 },
            { status: 0x80, note: 67, velocity: 0 },
        ]);
        for (const note of [60, 67]) {
            assert.equal(
                decodedEvents.filter((event) => event.status === 0x90 && event.note === note).length,
                decodedEvents.filter((event) => event.status === 0x80 && event.note === note).length,
            );
        }
    } finally {
        await page.close();
    }
});

test("Auto-preview strikes every pitch from the newest rolled chord and releases them together", async () => {
    const page = await openModulePage();

    try {
        await installAutoPreviewHarness(page);
        await invokeHarness(page, "sendIntentionalNote", 0x90, 60, 100);
        await invokeHarness(page, "sendIntentionalNote", 0x90, 64, 100);
        await invokeHarness(page, "sendIntentionalNote", 0x80, 60, 0);
        await invokeHarness(page, "sendIntentionalNote", 0x90, 67, 100);
        await invokeHarness(page, "sendIntentionalNote", 0x80, 64, 0);
        await invokeHarness(page, "sendIntentionalNote", 0x80, 67, 0);
        await invokeHarness(page, "clearDebugLog");

        await invokeHarness(page, "beginParameterGesture");
        await invokeHarness(page, "setParameterValue", 1_200);
        await invokeHarness(page, "endParameterGesture");
        await page.clock.runFor(1_000);

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(decodeMidiInputEvents(snapshot.midiInputEvents), [
            { status: 0x90, note: 60, velocity: 100 },
            { status: 0x90, note: 64, velocity: 100 },
            { status: 0x90, note: 67, velocity: 100 },
            { status: 0x80, note: 60, velocity: 0 },
            { status: 0x80, note: 64, velocity: 0 },
            { status: 0x80, note: 67, velocity: 0 },
        ]);
    } finally {
        await page.close();
    }
});

test("a gesture spanning note release previews only after a later changed edit", async () => {
    const page = await openModulePage();

    try {
        await installAutoPreviewHarness(page);
        await invokeHarness(page, "sendIntentionalNote", 0x90, 64, 100);
        await invokeHarness(page, "beginParameterGesture");
        await invokeHarness(page, "setParameterValue", 1_200);
        await invokeHarness(page, "sendIntentionalNote", 0x80, 64, 0);
        await page.clock.runFor(1_000);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 64, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 64, 0) },
        ]);

        await invokeHarness(page, "clearDebugLog");
        await invokeHarness(page, "setParameterValue", 1_300);
        await invokeHarness(page, "endParameterGesture");
        await page.clock.runFor(1_000);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(decodeMidiInputEvents(snapshot.midiInputEvents), [
            { status: 0x90, note: 64, velocity: 100 },
            { status: 0x80, note: 64, velocity: 0 },
        ]);
    } finally {
        await page.close();
    }
});

test("the Note-key replay suppresses edits without replacing chord memory", async () => {
    const page = await openModulePage();

    try {
        await installAutoPreviewHarness(page);
        await invokeHarness(page, "sendIntentionalNote", 0x90, 60, 100);
        await invokeHarness(page, "sendIntentionalNote", 0x90, 64, 100);
        await invokeHarness(page, "sendIntentionalNote", 0x80, 60, 0);
        await invokeHarness(page, "sendIntentionalNote", 0x80, 64, 0);
        await invokeHarness(page, "clearDebugLog");

        await invokeHarness(page, "startNoteKeyAudition");
        await invokeHarness(page, "beginParameterGesture");
        await invokeHarness(page, "setParameterValue", 1_200);
        await invokeHarness(page, "endParameterGesture");
        await invokeHarness(page, "stopNoteKeyAudition");
        await page.clock.runFor(1_000);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(decodeMidiInputEvents(snapshot.midiInputEvents), [
            { status: 0x90, note: 64, velocity: 100 },
            { status: 0x80, note: 64, velocity: 0 },
        ]);

        await invokeHarness(page, "clearDebugLog");
        await invokeHarness(page, "beginParameterGesture");
        await invokeHarness(page, "setParameterValue", 1_300);
        await invokeHarness(page, "endParameterGesture");
        await page.clock.runFor(1_000);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(decodeMidiInputEvents(snapshot.midiInputEvents), [
            { status: 0x90, note: 60, velocity: 100 },
            { status: 0x90, note: 64, velocity: 100 },
            { status: 0x80, note: 60, velocity: 0 },
            { status: 0x80, note: 64, velocity: 0 },
        ]);
    } finally {
        await page.close();
    }
});

test("useMsegEditorInteractions adds points and closes on Escape", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(page, "openEditor");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().isOpen === true);

        const addCoordinates = await invokeHarness(page, "getNormalizedCoordinates", 0.72, 0.22);
        await invokeHarness(page, "dispatchPointer", "pointerdown", {
            pointerId: 11,
            button: 0,
            clientX: addCoordinates.x,
            clientY: addCoordinates.y,
        });
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.pointCount === 4;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.pointCount, 4);
        assert.equal(snapshot.actionLog.at(-1).type, "add");

        await invokeHarness(page, "pressEscape");
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.isOpen, false);
    } finally {
        await page.close();
    }
});

test("useMsegEditorInteractions deletes an interior point on click-release, moves it on drag, and protects endpoints", async () => {
    const deletePage = await openModulePage();

    try {
        await installHarness(deletePage, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(deletePage, "openEditor");

        const middlePoint = await invokeHarness(deletePage, "getPointCoordinates", 1);
        await invokeHarness(deletePage, "dispatchPointer", "pointerdown", {
            pointerId: 21,
            button: 0,
            clientX: middlePoint.x,
            clientY: middlePoint.y,
        });
        await invokeHarness(deletePage, "dispatchPointer", "pointerup", {
            pointerId: 21,
            button: 0,
            clientX: middlePoint.x,
            clientY: middlePoint.y,
        });

        let snapshot = await getHarnessSnapshot(deletePage);
        assert.equal(snapshot.pointCount, 2);
        assert.equal(snapshot.actionLog.at(-1).type, "delete");
    } finally {
        await deletePage.close();
    }

    const movePage = await openModulePage();

    try {
        await installHarness(movePage, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(movePage, "openEditor");

        const middlePoint = await invokeHarness(movePage, "getPointCoordinates", 1);
        const movedPoint = await invokeHarness(movePage, "getNormalizedCoordinates", 0.64, 0.58);
        await invokeHarness(movePage, "dispatchPointer", "pointerdown", {
            pointerId: 22,
            button: 0,
            clientX: middlePoint.x,
            clientY: middlePoint.y,
        });
        await invokeHarness(movePage, "dispatchPointer", "pointermove", {
            pointerId: 22,
            button: 0,
            clientX: movedPoint.x,
            clientY: movedPoint.y,
        });
        await invokeHarness(movePage, "dispatchPointer", "pointerup", {
            pointerId: 22,
            button: 0,
            clientX: movedPoint.x,
            clientY: movedPoint.y,
        });

        let snapshot = await getHarnessSnapshot(movePage);
        assert.equal(snapshot.pointCount, 3);
        assert.equal(snapshot.actionLog.at(-1).type, "move");
        assertAlmostEqual(snapshot.points[1].x, 0.64, 1e-6);
        assertAlmostEqual(snapshot.points[1].y, 0.58, 1e-6);

        const firstPoint = await invokeHarness(movePage, "getPointCoordinates", 0);
        await invokeHarness(movePage, "dispatchPointer", "pointerdown", {
            pointerId: 23,
            button: 0,
            clientX: firstPoint.x,
            clientY: firstPoint.y,
        });
        await invokeHarness(movePage, "dispatchPointer", "pointerup", {
            pointerId: 23,
            button: 0,
            clientX: firstPoint.x,
            clientY: firstPoint.y,
        });

        snapshot = await getHarnessSnapshot(movePage);
        assert.equal(snapshot.pointCount, 3);
        assert.equal(snapshot.actionLog.filter(({ type }) => type === "delete").length, 0);
    } finally {
        await movePage.close();
    }
});

test("useMsegEditorInteractions keeps editing when platform pointer capture is unavailable", async () => {
    const page = await openModulePage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    try {
        await installHarness(page, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(page, "openEditor");
        await invokeHarness(page, "setPointerCaptureFailure", true);

        const middlePoint = await invokeHarness(page, "getPointCoordinates", 1);
        const movedPoint = await invokeHarness(page, "getNormalizedCoordinates", 0.62, 0.54);
        await invokeHarness(page, "dispatchPointer", "pointerdown", {
            pointerId: 24,
            button: 0,
            clientX: middlePoint.x,
            clientY: middlePoint.y,
        });
        await invokeHarness(page, "dispatchPointer", "pointermove", {
            pointerId: 24,
            button: 0,
            clientX: movedPoint.x,
            clientY: movedPoint.y,
        });
        await invokeHarness(page, "dispatchPointer", "pointerup", {
            pointerId: 24,
            button: 0,
            clientX: movedPoint.x,
            clientY: movedPoint.y,
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.actionLog.at(-1).type, "move");
        assertAlmostEqual(snapshot.points[1].x, 0.62, 1e-6);
        assertAlmostEqual(snapshot.points[1].y, 0.54, 1e-6);
        assert.deepEqual(pageErrors, []);
    } finally {
        await page.close();
    }
});

test("useMsegEditorInteractions bends a segment immediately on desktop drag and arms touch hold mode with one haptic bump", async () => {
    const desktopPage = await openModulePage();

    try {
        await installHarness(desktopPage, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(desktopPage, "openEditor");

        const segmentStart = await invokeHarness(desktopPage, "getNormalizedCoordinates", 0.25, 0.175);
        await invokeHarness(desktopPage, "dispatchPointer", "pointerdown", {
            pointerId: 41,
            button: 0,
            clientX: segmentStart.x,
            clientY: segmentStart.y,
            pointerType: "mouse",
        });
        await invokeHarness(desktopPage, "dispatchPointer", "pointermove", {
            pointerId: 41,
            button: 0,
            clientX: segmentStart.x,
            clientY: segmentStart.y + 28,
            pointerType: "mouse",
        });
        await invokeHarness(desktopPage, "dispatchPointer", "pointerup", {
            pointerId: 41,
            button: 0,
            clientX: segmentStart.x,
            clientY: segmentStart.y + 28,
            pointerType: "mouse",
        });

        let snapshot = await getHarnessSnapshot(desktopPage);
        assert.equal(snapshot.pointCount, 3);
        assert.equal(snapshot.actionLog.at(-1).type, "curve");
        assert.ok(Math.abs(snapshot.points[0].curvePower) > 0.1);
        assert.deepEqual(snapshot.hapticLog, []);
    } finally {
        await desktopPage.close();
    }

    const touchPage = await openModulePage();

    try {
        await installHarness(touchPage, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(touchPage, "setCurveEditMode", "hold-or-drag");
        await invokeHarness(touchPage, "setCurveEditHoldDelayMs", 40);
        await invokeHarness(touchPage, "openEditor");

        const segmentStart = await invokeHarness(touchPage, "getNormalizedCoordinates", 0.25, 0.175);
        await invokeHarness(touchPage, "dispatchPointer", "pointerdown", {
            pointerId: 42,
            button: 0,
            clientX: segmentStart.x,
            clientY: segmentStart.y,
            pointerType: "touch",
        });
        await touchPage.waitForTimeout(60);
        await invokeHarness(touchPage, "dispatchPointer", "pointermove", {
            pointerId: 42,
            button: 0,
            clientX: segmentStart.x,
            clientY: segmentStart.y + 26,
            pointerType: "touch",
        });
        await invokeHarness(touchPage, "dispatchPointer", "pointerup", {
            pointerId: 42,
            button: 0,
            clientX: segmentStart.x,
            clientY: segmentStart.y + 26,
            pointerType: "touch",
        });

        const snapshot = await getHarnessSnapshot(touchPage);
        assert.equal(snapshot.pointCount, 3);
        assert.equal(snapshot.actionLog.at(-1).type, "curve");
        assert.ok(Math.abs(snapshot.points[0].curvePower) > 0.1);
        assert.deepEqual(snapshot.hapticLog, ["light"]);
    } finally {
        await touchPage.close();
    }
});

test("useMsegEditorInteractions does not add a point when a pending touch is cancelled", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(page, "setCurveEditMode", "hold-or-drag");
        await invokeHarness(page, "setCurveEditHoldDelayMs", 1_000);
        await invokeHarness(page, "openEditor");

        const segmentStart = await invokeHarness(page, "getNormalizedCoordinates", 0.25, 0.175);
        await invokeHarness(page, "dispatchPointer", "pointerdown", {
            pointerId: 43,
            button: 0,
            clientX: segmentStart.x,
            clientY: segmentStart.y,
            pointerType: "touch",
        });
        await invokeHarness(page, "dispatchPointer", "pointercancel", {
            pointerId: 43,
            button: 0,
            clientX: segmentStart.x,
            clientY: segmentStart.y,
            pointerType: "touch",
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.pointCount, 3);
        assert.deepEqual(snapshot.actionLog, []);
        assert.equal(snapshot.activeSegmentIndex, -1);
    } finally {
        await page.close();
    }
});

test("useMsegEditorInteractions maps add and move gestures through the vertical iPhone editor orientation", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(page, "setOrientation", "vertical");
        await invokeHarness(page, "openEditor");
        const surfaceRect = await getSurfaceRect(page);

        const addCoordinates = getIndependentVerticalSurfacePoint(surfaceRect, 0.72, 0.22);
        await invokeHarness(page, "dispatchPointer", "pointerdown", {
            pointerId: 31,
            button: 0,
            clientX: addCoordinates.x,
            clientY: addCoordinates.y,
        });

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.pointCount === 4;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.orientation, "vertical");
        assert.equal(snapshot.actionLog.at(-1).type, "add");
        assertAlmostEqual(snapshot.points[2].x, 0.72, 1e-6);
        assertAlmostEqual(snapshot.points[2].y, 0.22, 1e-6);

        const movedCoordinates = getIndependentVerticalSurfacePoint(surfaceRect, 0.6, 0.64);
        const movedPoint = getIndependentVerticalSurfacePoint(surfaceRect, snapshot.points[2].x, snapshot.points[2].y);
        await invokeHarness(page, "dispatchPointer", "pointerdown", {
            pointerId: 32,
            button: 0,
            clientX: movedPoint.x,
            clientY: movedPoint.y,
        });
        await invokeHarness(page, "dispatchPointer", "pointermove", {
            pointerId: 32,
            button: 0,
            clientX: movedCoordinates.x,
            clientY: movedCoordinates.y,
        });
        await invokeHarness(page, "dispatchPointer", "pointerup", {
            pointerId: 32,
            button: 0,
            clientX: movedCoordinates.x,
            clientY: movedCoordinates.y,
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.actionLog.at(-1).type, "move");
        assertAlmostEqual(snapshot.points[2].x, 0.6, 1e-6);
        assertAlmostEqual(snapshot.points[2].y, 0.64, 1e-6);
    } finally {
        await page.close();
    }
});

test("useMsegEditorInteractions only highlights a hovered segment when the pointer is on the line and not on a point", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(page, "openEditor");

        const segmentPoint = await invokeHarness(page, "getNormalizedCoordinates", 0.25, 0.175);
        await invokeHarness(page, "dispatchPointer", "pointermove", {
            pointerId: 41,
            clientX: segmentPoint.x,
            clientY: segmentPoint.y,
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.hoveredSegmentIndex, 0);
        assert.equal(snapshot.highlightedSegmentIndex, 0);
        assert.deepEqual(snapshot.pointStates, ["highlighted", "highlighted", "muted"]);

        const point = await invokeHarness(page, "getPointCoordinates", 1);
        await invokeHarness(page, "dispatchPointer", "pointermove", {
            pointerId: 41,
            clientX: point.x,
            clientY: point.y,
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.hoveredSegmentIndex, -1);
        assert.equal(snapshot.highlightedSegmentIndex, -1);
        assert.deepEqual(snapshot.pointStates, ["selected", "default", "default"]);
    } finally {
        await page.close();
    }
});

test("useMsegEditorInteractions drags an upward-rising segment upward to a more upward visual bend without adding or moving points", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(page, "openEditor");

        const beforeDrag = await getHarnessSnapshot(page);
        const segmentPoint = await invokeHarness(page, "getNormalizedCoordinates", 0.25, 0.175);
        await invokeHarness(page, "dispatchPointer", "pointerdown", {
            pointerId: 42,
            button: 0,
            clientX: segmentPoint.x,
            clientY: segmentPoint.y,
        });
        await invokeHarness(page, "dispatchPointer", "pointermove", {
            pointerId: 42,
            button: 0,
            clientX: segmentPoint.x,
            clientY: segmentPoint.y - 36,
        });
        await invokeHarness(page, "dispatchPointer", "pointerup", {
            pointerId: 42,
            button: 0,
            clientX: segmentPoint.x,
            clientY: segmentPoint.y - 36,
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.pointCount, beforeDrag.pointCount);
        assert.equal(snapshot.points[0].x, beforeDrag.points[0].x);
        assert.equal(snapshot.points[0].y, beforeDrag.points[0].y);
        assert.equal(snapshot.points[1].x, beforeDrag.points[1].x);
        assert.equal(snapshot.points[1].y, beforeDrag.points[1].y);
        assert.ok(snapshot.points[0].curvePower < beforeDrag.points[0].curvePower);
        assert.equal(snapshot.actionLog.length, 1);
        assert.equal(snapshot.actionLog[0].type, "curve");
        assert.ok(snapshot.actionLog[0].curvePower < 0);
        assert.equal(snapshot.activeSegmentIndex, -1);
    } finally {
        await page.close();
    }
});

test("useMsegEditorInteractions drags a downward-falling segment upward to a more upward visual bend without adding or moving points", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installMsegEditorInteractionsHookHarness");
        await invokeHarness(page, "openEditor");
        await invokeHarness(page, "setShapePoint", 2, 1, 0);

        const beforeDrag = await getHarnessSnapshot(page);
        const segmentPoint = await invokeHarness(page, "getNormalizedCoordinates", 0.75, 0.175);
        await invokeHarness(page, "dispatchPointer", "pointerdown", {
            pointerId: 43,
            button: 0,
            clientX: segmentPoint.x,
            clientY: segmentPoint.y,
        });
        await invokeHarness(page, "dispatchPointer", "pointermove", {
            pointerId: 43,
            button: 0,
            clientX: segmentPoint.x,
            clientY: segmentPoint.y - 36,
        });
        await invokeHarness(page, "dispatchPointer", "pointerup", {
            pointerId: 43,
            button: 0,
            clientX: segmentPoint.x,
            clientY: segmentPoint.y - 36,
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.pointCount, beforeDrag.pointCount);
        assert.equal(snapshot.points[1].x, beforeDrag.points[1].x);
        assert.equal(snapshot.points[1].y, beforeDrag.points[1].y);
        assert.ok(snapshot.points[1].curvePower > beforeDrag.points[1].curvePower);
        assert.equal(snapshot.actionLog.length, 1);
        assert.equal(snapshot.actionLog[0].type, "curve");
        assert.ok(snapshot.actionLog[0].curvePower > 0);
        assert.equal(snapshot.activeSegmentIndex, -1);
    } finally {
        await page.close();
    }
});
