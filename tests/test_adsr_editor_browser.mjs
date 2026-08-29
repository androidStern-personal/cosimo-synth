import assert from "node:assert/strict";
import test from "node:test";

import {
    clearHarnessDebugLog,
    dragEnvelopeHandleBy,
    expandGlobalModRail,
    getHarnessSnapshot,
    openHarnessPage,
    waitForHarnessSnapshot,
} from "./helpers/desktop_patch_view_browser_suite.mjs";

const VISIBLE_HANDLE_ROLES = [
    "adsr-attack-handle",
    "adsr-decay-sustain-handle",
    "adsr-release-handle",
];

const CIRCLE_HIT_TARGET_ROLES = [
    "adsr-attack-handle-hit-target",
    "adsr-decay-sustain-handle-hit-target",
    "adsr-release-handle-hit-target",
];

async function settleLayout(page) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
    await settleLayout(page);
    return drawer;
}

async function readAdsrGeometry(surface) {
    return surface.evaluate((element, { visibleRoles, hitRoles }) => {
        if (!(element instanceof SVGSVGElement)) {
            throw new Error("Expected the ADSR SVG surface.");
        }
        const surfaceRect = element.getBoundingClientRect();
        const viewBox = element.viewBox.baseVal;
        const rectOf = (target) => {
            const bounds = target.getBoundingClientRect();
            return {
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
                width: bounds.width,
                height: bounds.height,
            };
        };
        const circleMetrics = (role) => {
            const circle = element.querySelector(`[data-role="${role}"]`);
            if (!(circle instanceof SVGCircleElement)) {
                throw new Error(`Missing ADSR circle ${role}.`);
            }
            return {
                role,
                cx: circle.cx.baseVal.value,
                cy: circle.cy.baseVal.value,
                radius: circle.r.baseVal.value,
                rect: rectOf(circle),
                stroke: getComputedStyle(circle).stroke,
                strokeWidth: Number.parseFloat(getComputedStyle(circle).strokeWidth),
            };
        };
        const curve = element.querySelector('[data-role="adsr-curve"]');
        const sustainTarget = element.querySelector('[data-role="adsr-sustain-segment-hit-target"]');
        if (!(curve instanceof SVGPathElement) || !(sustainTarget instanceof SVGLineElement)) {
            throw new Error("Missing the ADSR curve or sustain target.");
        }
        const curveBox = curve.getBBox();
        return {
            surface: rectOf(element),
            viewBox: {
                x: viewBox.x,
                y: viewBox.y,
                width: viewBox.width,
                height: viewBox.height,
            },
            visibleHandles: visibleRoles.map(circleMetrics),
            hitTargets: hitRoles.map(circleMetrics),
            sustainTarget: {
                x1: sustainTarget.x1.baseVal.value,
                x2: sustainTarget.x2.baseVal.value,
                y: sustainTarget.y1.baseVal.value,
                strokeWidth: Number.parseFloat(getComputedStyle(sustainTarget).strokeWidth),
            },
            curve: {
                x: curveBox.x,
                y: curveBox.y,
                width: curveBox.width,
                height: curveBox.height,
                stroke: getComputedStyle(curve).stroke,
            },
            viewport: { width: window.innerWidth, height: window.innerHeight },
            surfaceMatchesViewBox: Math.abs(surfaceRect.width - viewBox.width) <= 0.75
                && Math.abs(surfaceRect.height - viewBox.height) <= 0.75,
        };
    }, { visibleRoles: VISIBLE_HANDLE_ROLES, hitRoles: CIRCLE_HIT_TARGET_ROLES });
}

function assertResponsiveAdsrGeometry(metrics, label) {
    assert.equal(metrics.surfaceMatchesViewBox, true, `${label}: SVG coordinates must match rendered CSS pixels.`);
    for (const handle of metrics.visibleHandles) {
        assert.equal(
            Math.abs(handle.rect.width - handle.rect.height) <= 0.1,
            true,
            `${label}: ${handle.role} must remain circular, got ${handle.rect.width}x${handle.rect.height}.`,
        );
        assert.equal(handle.rect.width >= 18.5 && handle.rect.width <= 20, true);
        assert.equal(handle.strokeWidth >= 2.4 && handle.strokeWidth <= 2.6, true);
    }
    const visibleDiameter = metrics.visibleHandles[0].rect.width;
    for (const handle of metrics.visibleHandles.slice(1)) {
        assert.equal(Math.abs(handle.rect.width - visibleDiameter) <= 0.1, true);
    }
    for (const target of metrics.hitTargets) {
        assert.equal(target.radius * 2 >= 44, true, `${label}: ${target.role} keeps a large touch target.`);
        assert.equal(target.cx - target.radius >= metrics.viewBox.x - 0.01, true);
        assert.equal(target.cx + target.radius <= metrics.viewBox.width + 0.01, true);
        assert.equal(target.cy - target.radius >= metrics.viewBox.y - 0.01, true);
        assert.equal(target.cy + target.radius <= metrics.viewBox.height + 0.01, true);
    }
    assert.equal(metrics.curve.x >= metrics.viewBox.x - 0.01, true);
    assert.equal(metrics.curve.y >= metrics.viewBox.y - 0.01, true);
    assert.equal(metrics.curve.x + metrics.curve.width <= metrics.viewBox.width + 0.01, true);
    assert.equal(metrics.curve.y + metrics.curve.height <= metrics.viewBox.height + 0.01, true);
    const sustainHalfTarget = metrics.sustainTarget.strokeWidth * 0.5;
    assert.equal(metrics.sustainTarget.x1 >= metrics.viewBox.x, true);
    assert.equal(metrics.sustainTarget.x2 <= metrics.viewBox.width, true);
    assert.equal(metrics.sustainTarget.y - sustainHalfTarget >= metrics.viewBox.y - 0.01, true);
    assert.equal(metrics.sustainTarget.y + sustainHalfTarget <= metrics.viewBox.height + 0.01, true);
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

async function beginPointer(target, pointerId, pointerType, point) {
    await target.dispatchEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        isPrimary: true,
        pointerId,
        pointerType,
        button: 0,
        buttons: 1,
        clientX: point.x,
        clientY: point.y,
    });
}

async function centerOf(locator) {
    const bounds = await locator.boundingBox();
    assert.ok(bounds);
    return {
        x: bounds.x + (bounds.width * 0.5),
        y: bounds.y + (bounds.height * 0.5),
    };
}

async function readBubble(page) {
    const bubble = page.locator('[data-role="adsr-value-bubble"]');
    await bubble.waitFor();
    const bounds = await bubble.boundingBox();
    assert.ok(bounds);
    return {
        field: await bubble.getAttribute("data-field"),
        text: (await bubble.textContent()).trim(),
        bounds,
    };
}

test("ADSR geometry stays bounded and circular through compact, expanded, full, desktop, and live resize layouts", async () => {
    const phonePage = await openHarnessPage({
        beforeGoto: (page) => page.setViewportSize({ width: 393, height: 852 }),
    });
    try {
        const drawer = await openEnvelopeDrawer(phonePage);
        const surface = drawer.locator('[data-role="adsr-editor-surface"]');
        const compactMetrics = await readAdsrGeometry(surface);
        assertResponsiveAdsrGeometry(compactMetrics, "compact drawer");

        const grip = drawer.locator('[data-role="quick-source-sheet-grip"]');
        const [gripBounds, drawerBounds] = await Promise.all([grip.boundingBox(), drawer.boundingBox()]);
        assert.ok(gripBounds && drawerBounds);
        const start = {
            x: gripBounds.x + (gripBounds.width * 0.5),
            y: gripBounds.y + (gripBounds.height * 0.5),
        };
        await phonePage.mouse.move(start.x, start.y);
        await phonePage.mouse.down();
        for (const delta of [42, 88, 138]) {
            await phonePage.mouse.move(start.x, start.y - delta, { steps: 3 });
            await settleLayout(phonePage);
            assertResponsiveAdsrGeometry(
                await readAdsrGeometry(surface),
                `live drawer resize ${delta}px`,
            );
        }
        await phonePage.mouse.up();
        await drawer.waitFor();
        await settleLayout(phonePage);
        const expandedMetrics = await readAdsrGeometry(surface);
        assertResponsiveAdsrGeometry(expandedMetrics, "expanded drawer");
        assert.equal(expandedMetrics.surface.height > compactMetrics.surface.height + 80, true);

        await drawer.locator('[data-role="quick-source-sheet-full-editor"]').click();
        const fullSurface = phonePage.locator('[data-role="adsr-editor-surface"]:visible');
        await fullSurface.waitFor();
        await settleLayout(phonePage);
        const fullMetrics = await readAdsrGeometry(fullSurface);
        assertResponsiveAdsrGeometry(fullMetrics, "phone full editor");
        assert.equal(
            fullMetrics.curve.height <= fullMetrics.curve.width * 0.63,
            true,
            "The full-height editor must cap the drawing band rather than stretching the envelope vertically.",
        );
    } finally {
        await phonePage.mouse.up().catch(() => {});
        await phonePage.close();
    }

    const desktopPage = await openHarnessPage({
        beforeGoto: (page) => page.setViewportSize({ width: 1280, height: 900 }),
    });
    try {
        await desktopPage.getByRole("button", { name: "Select envelope 1" }).click();
        const surface = desktopPage.locator('[data-role="adsr-editor-surface"]:visible');
        await surface.waitFor();
        await settleLayout(desktopPage);
        const desktopMetrics = await readAdsrGeometry(surface);
        assertResponsiveAdsrGeometry(desktopMetrics, "desktop editor");
        assert.equal(desktopMetrics.curve.stroke, "rgb(125, 247, 255)");

        await desktopPage.getByRole("button", { name: "Select MSEG 1" }).click();
        await desktopPage.locator('button[aria-label="Open MSEG editor"]').first().click();
        const msegSurface = desktopPage.locator('[data-role="mseg-editor-surface"]');
        await msegSurface.waitFor();

        const readMsegColors = () => msegSurface.evaluate((element) => {
            const base = element.querySelector('[data-role="mseg-base-curve"]');
            const reference = element.querySelector('[data-role="mseg-reference-curve"]');
            const realized = element.querySelector('[data-role="mseg-effective-curve"]');
            const points = element.querySelector('[data-role="mseg-edit-points"]');
            const firstPoint = points?.querySelector("circle");
            if (!(base instanceof SVGPathElement)
                    || !(reference instanceof SVGPathElement)
                    || !(realized instanceof SVGPathElement)
                    || !(points instanceof SVGGElement)
                    || !(firstPoint instanceof SVGCircleElement)) {
                throw new Error("Expected the complete MSEG A/B/realized stack.");
            }
            const byIdentity = Object.fromEntries([base, reference].map((path) => [
                path.getAttribute("data-shape-identity"),
                getComputedStyle(path).stroke,
            ]));
            return {
                editShape: element.getAttribute("data-edit-shape"),
                pointShape: points.getAttribute("data-shape-identity"),
                pointColor: getComputedStyle(firstPoint).fill,
                shapeA: byIdentity.a,
                shapeB: byIdentity.b,
                realized: getComputedStyle(realized).stroke,
            };
        });

        let msegColors = await readMsegColors();
        const shapeAColor = msegColors.shapeA;
        const shapeBColor = msegColors.shapeB;
        assert.equal(msegColors.editShape, "a");
        assert.equal(msegColors.pointShape, "a");
        assert.equal(msegColors.pointColor, "rgb(204, 89, 210)");
        assert.equal(msegColors.realized, desktopMetrics.curve.stroke, "ADSR and realized MSEG share cyan.");
        assert.equal(msegColors.shapeA, "rgb(204, 89, 210)");
        assert.equal(msegColors.shapeB, "rgba(225, 231, 240, 0.48)");

        await desktopPage.locator('[data-role="mseg-shape-b"]').click();
        await desktopPage.waitForFunction(() => (
            document.querySelector('[data-role="mseg-editor-surface"]')?.getAttribute("data-edit-shape") === "b"
        ));
        msegColors = await readMsegColors();
        assert.equal(msegColors.editShape, "b");
        assert.equal(msegColors.pointShape, "b");
        assert.equal(msegColors.pointColor, "rgba(225, 231, 240, 0.82)");
        assert.equal(msegColors.realized, desktopMetrics.curve.stroke);
        assert.equal(msegColors.shapeA, shapeAColor, "Selecting B must keep A purple.");
        assert.equal(msegColors.shapeB, shapeBColor, "Selecting B must keep B gray.");

        await desktopPage.locator('[data-role="mseg-editor-done"]').click();
        const preview = desktopPage.locator('[data-role="mseg-preview-surface"]:visible');
        await preview.waitFor();
        const previewColors = await preview.evaluate((element) => ({
            editShape: element.getAttribute("data-edit-shape"),
            shapeA: getComputedStyle(element.querySelector('[data-role="mseg-preview-shape-a-curve"]')).stroke,
            shapeB: getComputedStyle(element.querySelector('[data-role="mseg-preview-shape-b-curve"]')).stroke,
            realized: getComputedStyle(element.querySelector('[data-role="mseg-preview-effective-curve"]')).stroke,
        }));
        assert.deepEqual(previewColors, {
            editShape: "b",
            shapeA: "rgb(204, 89, 210)",
            shapeB: "rgba(225, 231, 240, 0.48)",
            realized: "rgb(125, 247, 255)",
        });
    } finally {
        await desktopPage.close();
    }
});

test("touch breakpoint intent locks one value, sustain segment drags away from the breakpoint, and the local bubble stays usable", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    try {
        const drawer = await openEnvelopeDrawer(page);
        const breakpoint = drawer.locator('[data-role="adsr-decay-sustain-handle-hit-target"]');
        let start = await centerOf(breakpoint);
        let before = (await getHarnessSnapshot(page)).parameterValues;

        await beginPointer(breakpoint, 481, "touch", start);
        await dispatchWindowPointer(page, "pointermove", {
            pointerId: 481, pointerType: "touch", button: 0, buttons: 1,
            clientX: start.x + 14, clientY: start.y + 1,
        });
        await dispatchWindowPointer(page, "pointermove", {
            pointerId: 481, pointerType: "touch", button: 0, buttons: 1,
            clientX: start.x + 64, clientY: start.y + 50,
        });
        let snapshot = await waitForHarnessSnapshot(page, "horizontal ADSR intent", (candidate) => (
            Math.abs(Number(candidate.parameterValues.env1Decay) - Number(before.env1Decay)) > 0.01
        ));
        assert.equal(Number(snapshot.parameterValues.env1Sustain), Number(before.env1Sustain));
        let bubble = await readBubble(page);
        assert.equal(bubble.field, "decaySeconds");
        assert.match(bubble.text, /(?:ms|s)$/);
        assert.equal(bubble.bounds.y + bubble.bounds.height < start.y + 50, true);
        assert.equal(await page.locator('[data-role="mobile-voice-hud"].is-visible').count(), 0);
        await dispatchWindowPointer(page, "pointermove", {
            pointerId: 481, pointerType: "touch", button: 0, buttons: 1,
            clientX: start.x + 92, clientY: start.y - 72,
        });
        await settleLayout(page);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(Number(snapshot.parameterValues.env1Sustain), Number(before.env1Sustain));
        await dispatchWindowPointer(page, "pointerup", {
            pointerId: 481, pointerType: "touch", button: 0, buttons: 0,
            clientX: start.x + 92, clientY: start.y - 72,
        });
        await page.locator('[data-role="adsr-value-bubble"]').waitFor({ state: "detached" });

        start = await centerOf(breakpoint);
        before = (await getHarnessSnapshot(page)).parameterValues;
        await beginPointer(breakpoint, 482, "touch", start);
        await dispatchWindowPointer(page, "pointermove", {
            pointerId: 482, pointerType: "touch", button: 0, buttons: 1,
            clientX: start.x + 1, clientY: start.y - 14,
        });
        await dispatchWindowPointer(page, "pointermove", {
            pointerId: 482, pointerType: "touch", button: 0, buttons: 1,
            clientX: start.x + 92, clientY: start.y - 64,
        });
        snapshot = await waitForHarnessSnapshot(page, "vertical ADSR intent", (candidate) => (
            Math.abs(Number(candidate.parameterValues.env1Sustain) - Number(before.env1Sustain)) > 0.03
        ));
        assert.equal(Number(snapshot.parameterValues.env1Decay), Number(before.env1Decay));
        bubble = await readBubble(page);
        assert.equal(bubble.field, "sustain");
        assert.match(bubble.text, /%$/);
        await dispatchWindowPointer(page, "pointerup", {
            pointerId: 482, pointerType: "touch", button: 0, buttons: 0,
            clientX: start.x + 92, clientY: start.y - 64,
        });

        const sustainTarget = drawer.locator('[data-role="adsr-sustain-segment-hit-target"]');
        const [sustainBounds, breakpointBounds] = await Promise.all([
            sustainTarget.boundingBox(),
            breakpoint.boundingBox(),
        ]);
        assert.ok(sustainBounds && breakpointBounds);
        start = {
            x: sustainBounds.x + (sustainBounds.width * 0.72),
            y: sustainBounds.y + (sustainBounds.height * 0.5),
        };
        assert.equal(start.x > breakpointBounds.x + breakpointBounds.width + 16, true);
        before = (await getHarnessSnapshot(page)).parameterValues;
        await beginPointer(sustainTarget, 483, "touch", start);
        await dispatchWindowPointer(page, "pointermove", {
            pointerId: 483, pointerType: "touch", button: 0, buttons: 1,
            clientX: -24, clientY: start.y + 28,
        });
        snapshot = await waitForHarnessSnapshot(page, "sustain segment vertical drag", (candidate) => (
            Math.abs(Number(candidate.parameterValues.env1Sustain) - Number(before.env1Sustain)) > 0.02
        ));
        assert.equal(Number(snapshot.parameterValues.env1Attack), Number(before.env1Attack));
        assert.equal(Number(snapshot.parameterValues.env1Decay), Number(before.env1Decay));
        assert.equal(Number(snapshot.parameterValues.env1Release), Number(before.env1Release));
        bubble = await readBubble(page);
        assert.equal(bubble.field, "sustain");
        assert.equal(bubble.bounds.x >= 0, true);
        await dispatchWindowPointer(page, "pointermove", {
            pointerId: 483, pointerType: "touch", button: 0, buttons: 1,
            clientX: 417, clientY: start.y - 32,
        });
        bubble = await readBubble(page);
        assert.equal(bubble.bounds.x + bubble.bounds.width <= 393, true);
        assert.equal(bubble.bounds.y + bubble.bounds.height < start.y - 32, true);
        await dispatchWindowPointer(page, "pointerup", {
            pointerId: 483, pointerType: "touch", button: 0, buttons: 0,
            clientX: 417, clientY: start.y - 32,
        });
        await page.locator('[data-role="adsr-value-bubble"]').waitFor({ state: "detached" });
    } finally {
        await page.close();
    }
});

test("ADSR cancellation clears the bubble without a write and mouse plus pen editing recover normally", async () => {
    const page = await openHarnessPage();
    try {
        await page.getByRole("button", { name: "Select envelope 2" }).click();
        const attack = page.locator('[data-role="adsr-attack-handle-hit-target"]');
        const attackStart = await centerOf(attack);
        await clearHarnessDebugLog(page);
        await beginPointer(attack, 491, "touch", attackStart);
        await page.locator('[data-role="adsr-value-bubble"]').waitFor();
        await dispatchWindowPointer(page, "pointercancel", {
            pointerId: 491, pointerType: "touch", button: 0, buttons: 0,
            clientX: attackStart.x, clientY: attackStart.y,
        });
        await page.locator('[data-role="adsr-value-bubble"]').waitFor({ state: "detached" });
        assert.equal(await page.locator('[data-role="adsr-editor-surface"]').getAttribute("data-active-handle"), null);
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "env2Attack"), false);

        const attackBeforeMouse = Number(snapshot.parameterValues.env2Attack);
        await dragEnvelopeHandleBy(page, "adsr-attack-handle-hit-target", 72, 0);
        snapshot = await waitForHarnessSnapshot(page, "mouse ADSR recovery", (candidate) => (
            Math.abs(Number(candidate.parameterValues.env2Attack) - attackBeforeMouse) > 0.001
        ));

        const release = page.locator('[data-role="adsr-release-handle-hit-target"]');
        const releaseStart = await centerOf(release);
        const releaseBeforePen = Number(snapshot.parameterValues.env2Release);
        await beginPointer(release, 492, "pen", releaseStart);
        await dispatchWindowPointer(page, "pointermove", {
            pointerId: 492, pointerType: "pen", button: 0, buttons: 1,
            clientX: releaseStart.x + 54, clientY: releaseStart.y + 12,
        });
        await dispatchWindowPointer(page, "pointerup", {
            pointerId: 492, pointerType: "pen", button: 0, buttons: 0,
            clientX: releaseStart.x + 54, clientY: releaseStart.y + 12,
        });
        snapshot = await waitForHarnessSnapshot(page, "pen ADSR recovery", (candidate) => (
            Math.abs(Number(candidate.parameterValues.env2Release) - releaseBeforePen) > 0.001
        ));
        assert.equal(Number(snapshot.parameterValues.env2Attack) > 0, true);
        assert.equal(await page.locator('[data-role="adsr-value-bubble"]').count(), 0);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});
