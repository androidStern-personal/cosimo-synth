import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";
import {
    deserializeMsegPlayback,
    deserializeMsegShape,
    MSEG_EDITOR_HORIZONTAL_PADDING_PX,
    MSEG_EDITOR_VERTICAL_PADDING_PX,
    MSEG_POINT_RADIUS_PX,
    renderMsegShape,
    toMsegPlaybackConfigEvent,
} from "../patch_gui/mseg.js";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

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

test("useMsegState attaches once, requests boot state, uploads the boot payload, and detaches on unmount", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installMsegStateHookHarness");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.requestFullStoredStateCount === 1 && snapshot?.sentEvents?.length >= 3;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.addStoredStateValueListenerCount, 1);
        assert.equal(snapshot.requestFullStoredStateCount, 1);
        assert.equal(snapshot.storedStateListenerCount, 1);
        assert.equal(snapshot.lastRender.depth, 0.42);
        assert.deepEqual(
            snapshot.sentEvents,
            [
                {
                    endpointID: "mseg1Buffer",
                    value: Array.from(renderMsegShape(deserializeMsegShape(snapshot.bootState["mseg1.shape"]))),
                },
                {
                    endpointID: "mseg1Playback",
                    value: toMsegPlaybackConfigEvent(deserializeMsegPlayback(snapshot.bootState["mseg1.playback"])),
                },
                {
                    endpointID: "mseg1Depth",
                    value: 0.42,
                },
            ],
        );
        assert.deepEqual(
            snapshot.sentEvents.map(({ endpointID }) => endpointID),
            ["mseg1Buffer", "mseg1Playback", "mseg1Depth"],
        );

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

test("useSynthKeyboardRouting centralizes arrow-target ownership and text-entry gating", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSynthKeyboardRoutingHookHarness");

        await invokeHarness(page, "focus", "#wavetable-target");
        await invokeHarness(page, "pressKey", "ArrowRight");
        await invokeHarness(page, "focus", "#play-mode-target");
        await invokeHarness(page, "pressKey", "ArrowLeft");
        await invokeHarness(page, "focus", "#mseg-depth-target");
        await invokeHarness(page, "pressKey", "ArrowRight");
        await invokeHarness(page, "focus", "#mseg-rate-target");
        await invokeHarness(page, "pressKey", "ArrowLeft");

        await invokeHarness(page, "mouseDown", "#glide-target");
        await invokeHarness(page, "focus", "#glide-target");
        await invokeHarness(page, "pressKey", "ArrowRight");
        await invokeHarness(page, "pressKey", "ArrowLeft");
        await invokeHarness(page, "pressKey", "a");
        await invokeHarness(page, "blur", "#glide-target");
        await invokeHarness(page, "pressKey", "a");
        await invokeHarness(page, "pressKey", "a", false);

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.stepLog, {
            wavetable: [1],
            playMode: [-1],
            msegDepth: [1],
            msegRate: [-1],
            glide: [1, -1],
        });
        assert.equal(snapshot.keyboardLog.allNotesOffCount, 1);
        assert.deepEqual(snapshot.keyboardLog.handledKeys, [
            { key: "a", isDown: true },
            { key: "a", isDown: false },
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
