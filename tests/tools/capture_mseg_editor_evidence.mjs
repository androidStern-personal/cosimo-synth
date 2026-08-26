import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
    MODULATION_STATE_KEY,
    createDefaultModulationState,
    openHarnessPage,
} from "../helpers/desktop_patch_view_browser_suite.mjs";

const evidenceDirectory = fileURLToPath(new URL(
    "../../docs/evidence/t33-t34-t36-mseg/",
    import.meta.url,
));

function createMorphEvidenceState() {
    const state = createDefaultModulationState();
    const shapeB = {
        ...state.msegSlots[0].shapeB,
        points: [
            { x: 0, y: 1, curvePower: 0 },
            { x: 0.38, y: 0.12, curvePower: 2.5 },
            { x: 1, y: 0.45, curvePower: -1.5 },
        ],
    };
    return {
        ...state,
        msegSlots: state.msegSlots.map((slot, slotIndex) => (
            slotIndex === 0 ? { ...slot, shapeB } : slot
        )),
    };
}

async function openEvidencePage(viewport) {
    const modulationState = createMorphEvidenceState();
    return openHarnessPage({
        beforeGoto: async (page) => {
            await page.setViewportSize(viewport);
            await page.addInitScript(({ stateKey, serializedState }) => {
                const initial = window.__COSIMO_DESKTOP_HARNESS_INITIAL__ ?? {};
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    ...initial,
                    storedState: {
                        ...initial.storedState,
                        [stateKey]: serializedState,
                    },
                };
            }, {
                stateKey: MODULATION_STATE_KEY,
                serializedState: JSON.stringify(modulationState),
            });
        },
    });
}

async function settleVisuals(page) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}

async function readEditorGeometry(page, rootRole, surfaceRole, controlsRole) {
    return page.evaluate(({ rootSelector, surfaceSelector, controlsSelector }) => {
        const root = document.querySelector(rootSelector);
        const surface = document.querySelector(surfaceSelector);
        const controls = document.querySelector(controlsSelector);
        if (!(root instanceof HTMLElement) || !(surface instanceof SVGElement) || !(controls instanceof HTMLElement)) {
            throw new Error("MSEG evidence geometry target is missing.");
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
        const rootStyle = getComputedStyle(root);
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            root: rect(root),
            surface: rect(surface),
            controls: rect(controls),
            timeAxis: surface.getAttribute("data-time-axis"),
            rootBorderTop: `${rootStyle.borderTopWidth} ${rootStyle.borderTopStyle} ${rootStyle.borderTopColor}`,
            rootBoxShadow: rootStyle.boxShadow,
        };
    }, {
        rootSelector: `[data-role="${rootRole}"]`,
        surfaceSelector: `svg[data-role="${surfaceRole}"]`,
        controlsSelector: `[data-role="${controlsRole}"]`,
    });
}

async function openDrawer(page, expandToHalf = false) {
    await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
    await page.waitForTimeout(240);
    await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
    await page.locator('[data-role="quick-source-sheet"]').waitFor();
    await page.waitForTimeout(240);
    await settleVisuals(page);
    if (expandToHalf) {
        const grip = page.locator('[data-role="quick-source-sheet-grip"]');
        const bounds = await grip.boundingBox();
        assert.ok(bounds);
        const start = {
            x: bounds.x + (bounds.width / 2),
            y: bounds.y + (bounds.height / 2),
        };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x, start.y - 56, { steps: 6 });
        await page.mouse.up();
        await page.locator('[data-role="quick-source-sheet"][data-detent="half"]').waitFor();
        await page.waitForTimeout(240);
        await settleVisuals(page);
    }
}

async function beginHorizontalControlDrag(page, selector, distance) {
    const control = page.locator(selector);
    await control.focus();
    await page.keyboard.press("Home");
    const bounds = await control.boundingBox();
    assert.ok(bounds);
    const start = {
        x: bounds.x + (bounds.width / 2),
        y: bounds.y + (bounds.height / 2),
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + distance, start.y, { steps: 8 });
    await page.waitForFunction((controlSelector) => (
        document.querySelector(controlSelector)?.getAttribute("data-dragging") === "base"
    ), selector);
}

async function captureDrawer(viewport, fileName, expandToHalf = false) {
    const page = await openEvidencePage(viewport);
    try {
        await openDrawer(page, expandToHalf);
        const geometry = await readEditorGeometry(
            page,
            "quick-source-sheet",
            "quick-sheet-mseg-surface",
            "quick-source-sheet-strip",
        );
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

async function captureFullEditor(viewport, fileName, openFromDrawer = false) {
    const page = await openEvidencePage(viewport);
    try {
        if (openFromDrawer) {
            await openDrawer(page);
            await page.locator('[data-role="quick-source-sheet-full-editor"]').click();
        } else {
            await page.locator('button[aria-label="Open MSEG editor"]').first().click();
        }
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
        await settleVisuals(page);
        const geometry = await readEditorGeometry(
            page,
            "mseg-editor-dialog",
            "mseg-editor-surface",
            "mseg-editor-controls",
        );
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

async function captureDrawerMorphHud(viewport, fileName) {
    const page = await openEvidencePage(viewport);
    try {
        await openDrawer(page);
        await beginHorizontalControlDrag(
            page,
            '[data-role="quick-source-sheet-cell-morph"]',
            48,
        );
        await page.locator(
            '[data-role="mobile-voice-hud-layer"] [data-role="mobile-voice-hud"].is-visible',
        ).waitFor();
        await page.screenshot({ path: `${evidenceDirectory}${fileName}`, type: "png" });
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
}

async function captureFullEditorFeedback(viewport, fileName, controlName) {
    const page = await openEvidencePage(viewport);
    try {
        if (viewport.width < 640) {
            await openDrawer(page);
            await page.locator('[data-role="quick-source-sheet-full-editor"]').click();
        } else {
            await page.locator('button[aria-label="Open MSEG editor"]').first().click();
        }
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
        await beginHorizontalControlDrag(
            page,
            `[data-role="mseg-editor-cell-${controlName}"]`,
            controlName === "rate" ? 42 : 150,
        );
        if (controlName === "rate") {
            await page.locator(
                '[data-role="mseg-editor-hud-layer"] [data-role="mobile-voice-hud"].is-visible',
            ).waitFor();
        } else {
            await page.locator(
                '[data-role="mseg-editor-surface"][data-morph-presentation="primary"]',
            ).waitFor();
        }
        await page.screenshot({ path: `${evidenceDirectory}${fileName}`, type: "png" });
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
}

test("capture real MSEG drawer and full-screen evidence", async () => {
    await mkdir(evidenceDirectory, { recursive: true });
    const captures = {
        "phone-393x852-drawer.png": await captureDrawer(
            { width: 393, height: 852 },
            "phone-393x852-drawer.png",
        ),
        "phone-393x852-full.png": await captureFullEditor(
            { width: 393, height: 852 },
            "phone-393x852-full.png",
            true,
        ),
        "plugin-compact-600x520-drawer.png": await captureDrawer(
            { width: 600, height: 520 },
            "plugin-compact-600x520-drawer.png",
            true,
        ),
        "plugin-900x600-full.png": await captureFullEditor(
            { width: 900, height: 600 },
            "plugin-900x600-full.png",
        ),
        "desktop-1280x900-full.png": await captureFullEditor(
            { width: 1280, height: 900 },
            "desktop-1280x900-full.png",
        ),
    };

    await captureDrawerMorphHud(
        { width: 393, height: 852 },
        "phone-393x852-drawer-morph-hud.png",
    );
    await captureFullEditorFeedback(
        { width: 393, height: 852 },
        "phone-393x852-full-rate-hud.png",
        "rate",
    );
        await captureFullEditorFeedback(
            { width: 900, height: 600 },
            "plugin-900x600-full-morph-live.png",
            "morph",
        );

    assert.equal(captures["phone-393x852-drawer.png"].controls.height <= 40, true);
    assert.equal(captures["phone-393x852-full.png"].timeAxis, "vertical");
    assert.equal(captures["plugin-900x600-full.png"].timeAxis, "horizontal");
    assert.equal(captures["desktop-1280x900-full.png"].rootBoxShadow, "none");
    await writeFile(
        `${evidenceDirectory}geometry.json`,
        `${JSON.stringify(captures, null, 2)}\n`,
        "utf8",
    );
});
