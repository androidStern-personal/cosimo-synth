import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import {
    MODULATION_STATE_KEY,
    createDefaultModulationState,
    serializeModulationState,
} from "../../patch_gui/modulation.js";

import {
    expandGlobalModRail,
    openHarnessPage,
} from "../helpers/desktop_patch_view_browser_suite.mjs";
import {
    closeIOSHarnessPage,
    openIOSSourceHarnessPage,
    startIOSSourceHarnessServer,
    waitForIOSSourceHarnessReady,
} from "../helpers/ios_harness_browser.mjs";

const evidenceDirectory = fileURLToPath(new URL(
    "../../docs/evidence/t48-t49-adsr-editor/",
    import.meta.url,
));

const IOS_MSEG_IDENTITY_SHAPES = {
    shapeA: {
        format: "cosimo.mseg.shape",
        version: 1,
        name: "Identity A",
        globalSmooth: false,
        points: [
            { x: 0, y: 0, curvePower: 0 },
            { x: 0.45, y: 0.8, curvePower: 0 },
            { x: 1, y: 1, curvePower: 0 },
        ],
    },
    shapeB: {
        format: "cosimo.mseg.shape",
        version: 1,
        name: "Identity B",
        globalSmooth: false,
        points: [
            { x: 0, y: 1, curvePower: 0 },
            { x: 0.55, y: 0.2, curvePower: 0 },
            { x: 1, y: 0.65, curvePower: 0 },
        ],
    },
};

async function settleVisuals(page) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}

async function openEvidencePage(viewport) {
    return openHarnessPage({
        beforeGoto: (page) => page.setViewportSize(viewport),
    });
}

async function openEnvelopeDrawer(page) {
    await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
    await page.waitForTimeout(240);
    await expandGlobalModRail(page);
    await page.locator('[data-role="rack-mod-source-env-1"]').click();
    const drawer = page.locator('[data-role="quick-source-sheet"][data-source-kind="env"]');
    await drawer.waitFor();
    await page.waitForTimeout(240);
    await settleVisuals(page);
    return drawer;
}

async function readEvidenceGeometry(page, rootSelector, surfaceSelector) {
    return page.evaluate(({ rootQuery, surfaceQuery }) => {
        const root = document.querySelector(rootQuery);
        const surface = document.querySelector(surfaceQuery);
        if (!(root instanceof HTMLElement) || !(surface instanceof SVGSVGElement)) {
            throw new Error("ADSR evidence surface is missing.");
        }
        const rect = (element) => {
            const bounds = element.getBoundingClientRect();
            return {
                x: Number(bounds.x.toFixed(2)),
                y: Number(bounds.y.toFixed(2)),
                width: Number(bounds.width.toFixed(2)),
                height: Number(bounds.height.toFixed(2)),
            };
        };
        const handles = [
            "adsr-attack-handle",
            "adsr-decay-sustain-handle",
            "adsr-release-handle",
        ].map((role) => {
            const handle = surface.querySelector(`[data-role="${role}"]`);
            if (!(handle instanceof SVGCircleElement)) {
                throw new Error(`Missing ${role}.`);
            }
            return {
                role,
                ...rect(handle),
                radius: handle.r.baseVal.value,
                stroke: getComputedStyle(handle).stroke,
                strokeWidth: Number.parseFloat(getComputedStyle(handle).strokeWidth),
            };
        });
        const hitTargets = [
            "adsr-attack-handle-hit-target",
            "adsr-decay-sustain-handle-hit-target",
            "adsr-release-handle-hit-target",
        ].map((role) => {
            const target = surface.querySelector(`[data-role="${role}"]`);
            if (!(target instanceof SVGCircleElement)) {
                throw new Error(`Missing ${role}.`);
            }
            return { role, radius: target.r.baseVal.value };
        });
        const curve = surface.querySelector('[data-role="adsr-curve"]');
        if (!(curve instanceof SVGPathElement)) {
            throw new Error("Missing ADSR curve.");
        }
        const curveBounds = curve.getBBox();
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            root: rect(root),
            surface: rect(surface),
            viewBox: {
                width: Number(surface.viewBox.baseVal.width.toFixed(2)),
                height: Number(surface.viewBox.baseVal.height.toFixed(2)),
            },
            handles,
            hitTargets,
            curve: {
                x: Number(curveBounds.x.toFixed(2)),
                y: Number(curveBounds.y.toFixed(2)),
                width: Number(curveBounds.width.toFixed(2)),
                height: Number(curveBounds.height.toFixed(2)),
                stroke: getComputedStyle(curve).stroke,
            },
        };
    }, { rootQuery: rootSelector, surfaceQuery: surfaceSelector });
}

function assertCircularHandles(geometry, label) {
    for (const handle of geometry.handles) {
        assert.equal(
            Math.abs(handle.width - handle.height) <= 0.1,
            true,
            `${label}: ${handle.role} is ${handle.width}x${handle.height}.`,
        );
    }
    assert.equal(
        geometry.hitTargets.every(({ radius }) => radius * 2 >= 44),
        true,
        `${label}: invisible hit targets remain at least 44px.`,
    );
}

async function resizeDrawer(page, drawer, targetDelta, release) {
    const grip = drawer.locator('[data-role="quick-source-sheet-grip"]');
    const bounds = await grip.boundingBox();
    assert.ok(bounds);
    const start = {
        x: bounds.x + (bounds.width * 0.5),
        y: bounds.y + (bounds.height * 0.5),
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y - targetDelta, { steps: 8 });
    await settleVisuals(page);
    if (release) {
        await page.mouse.up();
        await page.waitForTimeout(240);
        await settleVisuals(page);
    }
}

async function captureDrawer(viewport, fileName, mode = "compact") {
    const page = await openEvidencePage(viewport);
    try {
        const drawer = await openEnvelopeDrawer(page);
        if (mode === "live") {
            await resizeDrawer(page, drawer, 92, false);
        } else if (mode === "expanded") {
            const drawerBounds = await drawer.boundingBox();
            assert.ok(drawerBounds);
            await resizeDrawer(page, drawer, (viewport.height * 0.5) - drawerBounds.height, true);
        }
        const geometry = await readEvidenceGeometry(
            page,
            '[data-role="quick-source-sheet"]',
            '[data-role="quick-source-sheet"] [data-role="adsr-editor-surface"]',
        );
        assertCircularHandles(geometry, fileName);
        await page.screenshot({
            path: `${evidenceDirectory}${fileName}`,
            type: "png",
            animations: "disabled",
        });
        return geometry;
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
}

async function captureFullEditor(viewport, fileName) {
    const page = await openEvidencePage(viewport);
    try {
        const drawer = await openEnvelopeDrawer(page);
        await drawer.locator('[data-role="quick-source-sheet-full-editor"]').click();
        const surface = page.locator('[data-role="adsr-editor-surface"]:visible');
        await surface.waitFor();
        await settleVisuals(page);
        const geometry = await readEvidenceGeometry(
            page,
            '[data-role="mobile-workspace-panel-mod"]',
            '[data-role="adsr-editor-surface"]',
        );
        assertCircularHandles(geometry, fileName);
        await page.screenshot({
            path: `${evidenceDirectory}${fileName}`,
            type: "png",
            animations: "disabled",
        });
        return geometry;
    } finally {
        await page.close();
    }
}

async function captureDesktopEditor(viewport, fileName) {
    const page = await openEvidencePage(viewport);
    try {
        await page.getByRole("button", { name: "Select envelope 1" }).click();
        const surface = page.locator('[data-role="adsr-editor-surface"]:visible');
        await surface.waitFor();
        await settleVisuals(page);
        const geometry = await readEvidenceGeometry(
            page,
            '[data-role="mseg-card"][data-source-kind="env"]',
            '[data-role="adsr-editor-surface"]',
        );
        assertCircularHandles(geometry, fileName);
        await page.screenshot({
            path: `${evidenceDirectory}${fileName}`,
            type: "png",
            animations: "disabled",
        });
        return geometry;
    } finally {
        await page.close();
    }
}

async function captureDesktopMsegColors(viewport, fileName) {
    const page = await openEvidencePage(viewport);
    try {
        await page.getByRole("button", { name: "Select MSEG 1" }).click();
        await page.locator('button[aria-label="Open MSEG editor"]').first().click();
        const surface = page.locator('[data-role="mseg-editor-surface"]');
        await surface.waitFor();
        await page.locator('[data-role="mseg-shape-b"]').click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mseg-editor-surface"]')?.getAttribute("data-edit-shape") === "b"
        ));
        const surfaceBounds = await surface.boundingBox();
        assert.ok(surfaceBounds);
        await page.mouse.click(
            surfaceBounds.x + (surfaceBounds.width * 0.58),
            surfaceBounds.y + (surfaceBounds.height * 0.24),
        );
        const morphKnob = page.locator('[data-role="mseg-editor-cell-morph"]');
        const morphBounds = await morphKnob.boundingBox();
        assert.ok(morphBounds);
        const morphStart = {
            x: morphBounds.x + (morphBounds.width * 0.5),
            y: morphBounds.y + (morphBounds.height * 0.5),
        };
        await page.mouse.move(morphStart.x, morphStart.y);
        await page.mouse.down();
        await page.mouse.move(morphStart.x + 56, morphStart.y, { steps: 8 });
        await page.mouse.up();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mseg-editor-surface"]')?.getAttribute("data-morph-presentation") === "edit-shape"
        ));
        await page.locator('[data-role="mobile-voice-hud"].is-visible').waitFor({ state: "detached" });
        await settleVisuals(page);
        const colors = await surface.evaluate((element) => {
            const readCurve = (role) => {
                const path = element.querySelector(`[data-role="${role}"]`);
                if (!(path instanceof SVGPathElement)) {
                    throw new Error(`Missing ${role}.`);
                }
                return {
                    identity: path.getAttribute("data-shape-identity"),
                    stroke: getComputedStyle(path).stroke,
                };
            };
            const points = element.querySelector('[data-role="mseg-edit-points"] circle');
            if (!(points instanceof SVGCircleElement)) {
                throw new Error("Missing MSEG edit points.");
            }
            const byIdentity = Object.fromEntries([
                readCurve("mseg-base-curve"),
                readCurve("mseg-reference-curve"),
            ].map(({ identity, stroke }) => [identity, stroke]));
            return {
                editShape: element.getAttribute("data-edit-shape"),
                presentation: element.getAttribute("data-morph-presentation"),
                shapeA: byIdentity.a,
                shapeB: byIdentity.b,
                realized: readCurve("mseg-effective-curve").stroke,
                editPoints: getComputedStyle(points).fill,
            };
        });
        await page.screenshot({
            path: `${evidenceDirectory}${fileName}`,
            type: "png",
            animations: "disabled",
        });
        return colors;
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
}

async function dispatchWindowPointer(page, eventType, init) {
    await page.evaluate(({ type, pointerInit }) => {
        window.dispatchEvent(new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            isPrimary: true,
            ...pointerInit,
        }));
    }, { type: eventType, pointerInit: init });
}

async function captureValueBubble(viewport, fileName, targetRole, field, moves) {
    const page = await openEvidencePage(viewport);
    const pointerId = field === "sustain" ? 612 : 611;
    try {
        const drawer = await openEnvelopeDrawer(page);
        const target = drawer.locator(`[data-role="${targetRole}"]`);
        const bounds = await target.boundingBox();
        assert.ok(bounds);
        const start = {
            x: targetRole === "adsr-sustain-segment-hit-target"
                ? bounds.x + (bounds.width * 0.72)
                : bounds.x + (bounds.width * 0.5),
            y: bounds.y + (bounds.height * 0.5),
        };
        await target.dispatchEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            isPrimary: true,
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        for (const move of moves) {
            await dispatchWindowPointer(page, "pointermove", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 1,
                clientX: start.x + move.x,
                clientY: start.y + move.y,
            });
        }
        const bubble = page.locator(`[data-role="adsr-value-bubble"][data-field="${field}"]`);
        await bubble.waitFor();
        await settleVisuals(page);
        const [bubbleBounds, text, bubbleStyle] = await Promise.all([
            bubble.boundingBox(),
            bubble.textContent(),
            bubble.evaluate((element) => {
                const style = getComputedStyle(element);
                return {
                    backgroundColor: style.backgroundColor,
                    borderColor: style.borderColor,
                    color: style.color,
                };
            }),
        ]);
        assert.ok(bubbleBounds);
        assert.equal(bubbleBounds.x >= 0, true);
        assert.equal(bubbleBounds.x + bubbleBounds.width <= viewport.width, true);
        await page.screenshot({
            path: `${evidenceDirectory}${fileName}`,
            type: "png",
            animations: "disabled",
        });
        return {
            field,
            text: text.trim(),
            style: bubbleStyle,
            bubble: {
                x: Number(bubbleBounds.x.toFixed(2)),
                y: Number(bubbleBounds.y.toFixed(2)),
                width: Number(bubbleBounds.width.toFixed(2)),
                height: Number(bubbleBounds.height.toFixed(2)),
            },
        };
    } finally {
        await dispatchWindowPointer(page, "pointerup", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: 0,
            clientY: 0,
        }).catch(() => {});
        await page.close();
    }
}

async function captureIOSMsegIdentityEvidence() {
    const sourceServer = await startIOSSourceHarnessServer();
    const modulationState = createDefaultModulationState();
    modulationState.msegSlots[0].shapeA = structuredClone(IOS_MSEG_IDENTITY_SHAPES.shapeA);
    modulationState.msegSlots[0].shapeB = structuredClone(IOS_MSEG_IDENTITY_SHAPES.shapeB);
    let sourceBrowser = null;
    let page = null;

    try {
        sourceBrowser = await chromium.launch({ headless: true });
        page = await openIOSSourceHarnessPage(sourceBrowser, sourceServer.baseUrl, {
            viewportSize: { width: 390, height: 844 },
            storedState: {
                [MODULATION_STATE_KEY]: serializeModulationState(modulationState),
            },
        });
        await waitForIOSSourceHarnessReady(page);
        const morphValue = 0.37;
        await page.locator("cosimo-synth-view")
            .locator(".ios-main-view [data-role='mseg-morph-slider']")
            .evaluate((element, nextValue) => {
                if (!(element instanceof HTMLInputElement)) {
                    throw new Error("Source-composed iPhone MSEG Morph control is missing.");
                }
                const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
                if (valueSetter === undefined) {
                    throw new Error("Source-composed iPhone MSEG Morph value setter is missing.");
                }
                valueSetter.call(element, String(nextValue));
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
            }, morphValue);
        await page.waitForFunction((expectedMorphValue) => {
            const morphControl = document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelector(".ios-main-view [data-role='mseg-morph-slider']");
            return morphControl instanceof HTMLInputElement
                && Math.abs(morphControl.valueAsNumber - expectedMorphValue) < 0.0001;
        }, morphValue);
        const preview = page.locator("cosimo-synth-view").locator("[data-role='mseg-preview-surface']");
        await preview.scrollIntoViewIfNeeded();
        await settleVisuals(page);
        const previewColors = await page.evaluate(() => {
            const surface = document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelector("[data-role='mseg-preview-surface']");
            const readCurve = (role) => {
                const curve = surface?.querySelector(`[data-role="${role}"]`);
                if (!(curve instanceof SVGPathElement)) {
                    throw new Error(`Missing ${role}.`);
                }
                return {
                    path: curve.getAttribute("d"),
                    stroke: getComputedStyle(curve).stroke,
                };
            };
            return {
                editShape: surface?.getAttribute("data-edit-shape") ?? null,
                shapeA: readCurve("mseg-preview-shape-a-curve"),
                shapeB: readCurve("mseg-preview-shape-b-curve"),
                realized: readCurve("mseg-preview-effective-curve"),
            };
        });
        assert.equal(previewColors.shapeA.stroke, "rgb(204, 89, 210)");
        assert.equal(previewColors.shapeB.stroke, "rgba(225, 231, 240, 0.48)");
        assert.equal(previewColors.realized.stroke, "rgb(125, 247, 255)");
        assert.notEqual(previewColors.realized.path, previewColors.shapeA.path);
        assert.notEqual(previewColors.realized.path, previewColors.shapeB.path);
        await page.screenshot({
            path: `${evidenceDirectory}iphone-390x844-mseg-preview-morph.png`,
            type: "png",
            animations: "disabled",
        });
        await page.locator("cosimo-synth-view").locator(".mseg-preview-button").click();
        await page.waitForFunction(() => (
            document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelector("[data-role='mseg-modal-layer']")
                ?.getAttribute("data-open") === "true"
        ));

        const captureShape = async (shape, fileName, expectedHighlightStroke) => {
            await page.locator("cosimo-synth-view")
                .locator(`[data-role="mseg-modal"] [aria-label="Edit MSEG shape ${shape.toUpperCase()}"]`)
                .click();
            await page.waitForFunction((expectedShape) => (
                document.querySelector("cosimo-synth-view")?.shadowRoot
                    ?.querySelector("[data-role='mseg-modal-viewport']")
                    ?.getAttribute("data-edit-shape") === expectedShape
            ), shape);
            const segmentPoint = await page.evaluate(() => {
                const path = document.querySelector("cosimo-synth-view")?.shadowRoot
                    ?.querySelector("[data-role='mseg-base-curve']");
                if (!(path instanceof SVGPathElement)) {
                    throw new Error("Source-composed iPhone MSEG curve is missing.");
                }
                const matrix = path.getScreenCTM();
                if (matrix === null) {
                    throw new Error("Source-composed iPhone MSEG transform is missing.");
                }
                const localPoint = path.getPointAtLength(path.getTotalLength() * 0.25);
                const screenPoint = new DOMPoint(localPoint.x, localPoint.y).matrixTransform(matrix);
                return { x: screenPoint.x, y: screenPoint.y };
            });
            await page.mouse.move(1, 1);
            await page.mouse.move(segmentPoint.x, segmentPoint.y);
            await page.waitForFunction(() => Boolean(
                document.querySelector("cosimo-synth-view")?.shadowRoot
                    ?.querySelector("[data-role='mseg-highlight-segment']"),
            ));
            await settleVisuals(page);
            const colors = await page.evaluate(() => {
                const surface = document.querySelector("cosimo-synth-view")?.shadowRoot
                    ?.querySelector("[data-role='mseg-modal-viewport']");
                const readStroke = (role) => {
                    const curve = surface?.querySelector(`[data-role="${role}"]`);
                    if (!(curve instanceof SVGPathElement)) {
                        throw new Error(`Missing ${role}.`);
                    }
                    return {
                        identity: curve.getAttribute("data-shape-identity"),
                        stroke: getComputedStyle(curve).stroke,
                    };
                };
                const identityStrokes = Object.fromEntries([
                    readStroke("mseg-base-curve"),
                    readStroke("mseg-reference-curve"),
                ].map(({ identity, stroke }) => [identity, stroke]));
                const realized = surface?.querySelector("[data-role='mseg-effective-curve']");
                if (!(realized instanceof SVGPathElement)) {
                    throw new Error("Missing source-composed iPhone realized MSEG curve.");
                }
                return {
                    editShape: surface?.getAttribute("data-edit-shape") ?? null,
                    emphasizedSegment: readStroke("mseg-highlight-segment").stroke,
                    realized: getComputedStyle(realized).stroke,
                    shapeA: identityStrokes.a,
                    shapeB: identityStrokes.b,
                };
            });
            assert.deepEqual(colors, {
                editShape: shape,
                emphasizedSegment: expectedHighlightStroke,
                realized: "rgb(125, 247, 255)",
                shapeA: "rgb(204, 89, 210)",
                shapeB: "rgba(225, 231, 240, 0.48)",
            });
            await page.screenshot({
                path: `${evidenceDirectory}${fileName}`,
                type: "png",
                animations: "disabled",
            });
            return colors;
        };

        return {
            source: "ui/ios/patch-view-entry.tsx",
            viewport: { width: 390, height: 844 },
            morphValue,
            "iphone-390x844-mseg-preview-morph.png": {
                editShape: previewColors.editShape,
                realized: previewColors.realized.stroke,
                shapeA: previewColors.shapeA.stroke,
                shapeB: previewColors.shapeB.stroke,
            },
            "iphone-390x844-mseg-a-emphasized.png": await captureShape(
                "a",
                "iphone-390x844-mseg-a-emphasized.png",
                "rgb(204, 89, 210)",
            ),
            "iphone-390x844-mseg-b-emphasized.png": await captureShape(
                "b",
                "iphone-390x844-mseg-b-emphasized.png",
                "rgba(225, 231, 240, 0.48)",
            ),
        };
    } finally {
        if (page) {
            await closeIOSHarnessPage(page);
        }
        await sourceBrowser?.close();
        await sourceServer.stop();
    }
}

test("capture real responsive ADSR editor and local-value-bubble evidence", async () => {
    await mkdir(evidenceDirectory, { recursive: true });
    const captures = {
        "phone-393x852-compact.png": await captureDrawer(
            { width: 393, height: 852 },
            "phone-393x852-compact.png",
        ),
        "phone-393x852-live-resize.png": await captureDrawer(
            { width: 393, height: 852 },
            "phone-393x852-live-resize.png",
            "live",
        ),
        "phone-393x852-expanded.png": await captureDrawer(
            { width: 393, height: 852 },
            "phone-393x852-expanded.png",
            "expanded",
        ),
        "phone-393x852-full.png": await captureFullEditor(
            { width: 393, height: 852 },
            "phone-393x852-full.png",
        ),
        "desktop-1280x900.png": await captureDesktopEditor(
            { width: 1280, height: 900 },
            "desktop-1280x900.png",
        ),
        "desktop-1280x900-mseg-colors.png": await captureDesktopMsegColors(
            { width: 1280, height: 900 },
            "desktop-1280x900-mseg-colors.png",
        ),
        "phone-393x852-decay-bubble.png": await captureValueBubble(
            { width: 393, height: 852 },
            "phone-393x852-decay-bubble.png",
            "adsr-decay-sustain-handle-hit-target",
            "decaySeconds",
            [{ x: 14, y: 1 }, { x: 62, y: 2 }],
        ),
        "phone-393x852-sustain-bubble.png": await captureValueBubble(
            { width: 393, height: 852 },
            "phone-393x852-sustain-bubble.png",
            "adsr-sustain-segment-hit-target",
            "sustain",
            [{ x: 0, y: -42 }],
        ),
    };

    assert.equal(captures["phone-393x852-expanded.png"].surface.height
        > captures["phone-393x852-compact.png"].surface.height, true);
    assert.equal(captures["phone-393x852-full.png"].curve.height
        <= captures["phone-393x852-full.png"].curve.width * 0.63, true);
    assert.equal(captures["desktop-1280x900-mseg-colors.png"].editShape, "b");
    assert.equal(captures["desktop-1280x900-mseg-colors.png"].presentation, "edit-shape");
    assert.equal(captures["desktop-1280x900-mseg-colors.png"].shapeA, "rgb(204, 89, 210)");
    assert.equal(captures["desktop-1280x900-mseg-colors.png"].shapeB, "rgba(225, 231, 240, 0.48)");
    assert.equal(captures["desktop-1280x900-mseg-colors.png"].editPoints, "rgba(225, 231, 240, 0.82)");
    assert.equal(
        captures["desktop-1280x900-mseg-colors.png"].realized,
        captures["desktop-1280x900.png"].curve.stroke,
    );
    assert.match(captures["phone-393x852-decay-bubble.png"].text, /(?:ms|s)$/);
    assert.match(captures["phone-393x852-sustain-bubble.png"].text, /%$/);
    for (const capture of [
        captures["phone-393x852-decay-bubble.png"],
        captures["phone-393x852-sustain-bubble.png"],
    ]) {
        assert.equal(capture.style.color, "rgb(125, 247, 255)");
        assert.equal(capture.style.borderColor, "rgb(125, 247, 255)");
        assert.notEqual(capture.style.backgroundColor, "rgba(0, 0, 0, 0)");
    }

    await writeFile(
        `${evidenceDirectory}geometry.json`,
        `${JSON.stringify(captures, null, 2)}\n`,
        "utf8",
    );
});

test("capture source-composed iPhone MSEG identity evidence", async () => {
    await mkdir(evidenceDirectory, { recursive: true });
    const captures = await captureIOSMsegIdentityEvidence();
    await writeFile(
        `${evidenceDirectory}iphone-mseg-identity.json`,
        `${JSON.stringify(captures, null, 2)}\n`,
        "utf8",
    );
});
