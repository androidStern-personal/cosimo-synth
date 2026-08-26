#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import {
    startDesktopHarnessServer,
    waitForHarnessReady,
} from "../tests/helpers/desktop_harness_browser.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceRoot = path.join(repoRoot, "docs", "evidence", "t54-wavetable-right-edge-controls");
const positionKey = "cosimo.mobile-global-mod-rail.position.v1";

const scenarios = [
    {
        name: "phone393RightTop",
        filename: "phone-393x852.png",
        viewport: { width: 393, height: 852 },
        requestedDock: { version: 2, edge: "right", normalizedY: 0 },
        expanded: false,
        containerSelector: '[data-role="mobile-voice-graph"]',
        roles: {
            topLeft: "mobile-voice-wavetable-overlay",
            topRight: "mobile-voice-warp-mode",
            bottomLeft: "mobile-voice-chip-unisonVoices",
            bottomRight: "mobile-voice-chip-semitone",
        },
    },
    {
        name: "phone320LeftMiddle",
        filename: "phone-320x568-left-middle-request.png",
        viewport: { width: 320, height: 568 },
        requestedDock: { version: 2, edge: "left", normalizedY: 0.5 },
        expanded: false,
        containerSelector: '[data-role="mobile-voice-graph"]',
        roles: {
            topLeft: "mobile-voice-wavetable-overlay",
            topRight: "mobile-voice-warp-mode",
            bottomLeft: "mobile-voice-chip-unisonVoices",
            bottomRight: "mobile-voice-chip-semitone",
        },
    },
    {
        name: "phone393RightMiddleExpanded",
        filename: "phone-393x852-right-middle-expanded.png",
        viewport: { width: 393, height: 852 },
        requestedDock: { version: 2, edge: "right", normalizedY: 0.5 },
        expanded: true,
        containerSelector: '[data-role="mobile-voice-graph"]',
        roles: {
            topLeft: "mobile-voice-wavetable-overlay",
            topRight: "mobile-voice-warp-mode",
            bottomLeft: "mobile-voice-chip-unisonVoices",
            bottomRight: "mobile-voice-chip-semitone",
        },
    },
    {
        name: "plugin",
        filename: "plugin-1120x680.png",
        viewport: { width: 1120, height: 680 },
        requestedDock: null,
        expanded: false,
        containerSelector: '[data-role="wavetable-card"]',
        roles: {
            topLeft: "wavetable-select-chip",
            topRight: "wavetable-frame-chip",
            bottomLeft: "warp-control-cluster",
            bottomRight: "wavetable-pan-field",
        },
    },
    {
        name: "desktop",
        filename: "desktop-1440x900.png",
        viewport: { width: 1440, height: 900 },
        requestedDock: null,
        expanded: false,
        containerSelector: '[data-role="wavetable-card"]',
        roles: {
            topLeft: "wavetable-select-chip",
            topRight: "wavetable-frame-chip",
            bottomLeft: "warp-control-cluster",
            bottomRight: "wavetable-pan-field",
        },
    },
];

function rectsIntersect(left, right) {
    return !(
        left.right <= right.left
        || left.left >= right.right
        || left.bottom <= right.top
        || left.top >= right.bottom
    );
}

function validateMeasurement(measurement, scenario) {
    for (const [row, leftKey, rightKey] of [
        ["top", "topLeft", "topRight"],
        ["bottom", "bottomLeft", "bottomRight"],
    ]) {
        const leftInset = measurement[leftKey].left - measurement.container.left;
        const rightInset = measurement.container.right - measurement[rightKey].right;
        if (Math.abs(leftInset - rightInset) > 0.5) {
            throw new Error(`${scenario.name}: ${row} insets are not mirrored (${leftInset} vs ${rightInset}).`);
        }
        measurement.insets[leftKey] = leftInset;
        measurement.insets[rightKey] = rightInset;
    }

    if (scenario.requestedDock === null) {
        return;
    }
    if (JSON.stringify(measurement.requestedDock) !== JSON.stringify(scenario.requestedDock)) {
        throw new Error(`${scenario.name}: layout rewrote requested dock intent.`);
    }
    if (!measurement.rail || measurement.visibleVoiceControls.some(({ bounds }) => (
        rectsIntersect(measurement.rail, bounds)
    ))) {
        throw new Error(`${scenario.name}: rail intersects a visible Voice control.`);
    }
    if (scenario.viewport.height >= 852 && measurement.visibleVoicePaddles.some(({ bounds }) => (
        rectsIntersect(measurement.rail, bounds)
    ))) {
        throw new Error(`${scenario.name}: rail intersects a visible Voice page paddle.`);
    }
}

await fs.mkdir(evidenceRoot, { recursive: true });
const server = await startDesktopHarnessServer();
const browser = await chromium.launch({ headless: true });
const measurements = {};

try {
    for (const scenario of scenarios) {
        const context = await browser.newContext({
            viewport: scenario.viewport,
            reducedMotion: "reduce",
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.addInitScript(({ key, dock }) => {
            if (dock === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(dock));
            }
        }, { key: positionKey, dock: scenario.requestedDock });
        await page.goto(server.baseUrl, { waitUntil: "commit" });
        await waitForHarnessReady(page);
        await page.locator(scenario.containerSelector).waitFor();
        await page.waitForTimeout(240);

        if (scenario.expanded) {
            await page.locator('[data-role="mobile-global-mod-rail-grip"]').click({ position: { x: 28, y: 12 } });
            await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="true"]').waitFor();
            await page.waitForTimeout(220);
        }

        const measurement = await page.locator(scenario.containerSelector).evaluate(
            (container, { requestedRoles, key }) => {
                const rectOf = (element) => {
                    const bounds = element.getBoundingClientRect();
                    return {
                        left: bounds.left,
                        right: bounds.right,
                        top: bounds.top,
                        bottom: bounds.bottom,
                        width: bounds.width,
                        height: bounds.height,
                    };
                };
                const controls = Object.fromEntries(Object.entries(requestedRoles).map(([corner, role]) => {
                    const element = container.querySelector(`[data-role="${role}"]`);
                    if (!(element instanceof Element)) {
                        throw new Error(`Missing wavetable control ${role}.`);
                    }
                    return [corner, rectOf(element)];
                }));
                const rail = document.querySelector('[data-role="mobile-global-mod-rail"]');
                const visibleVoiceControls = Array.from(document.querySelectorAll(".mobile-voice-chip"))
                    .filter((element) => {
                        const bounds = element.getBoundingClientRect();
                        const style = getComputedStyle(element);
                        return bounds.width > 0
                            && bounds.height > 0
                            && style.display !== "none"
                            && style.visibility !== "hidden";
                    })
                    .map((element) => ({
                        role: element.getAttribute("data-role") ?? element.getAttribute("data-corner") ?? "voice-chip",
                        bounds: rectOf(element),
                    }));
                const visibleVoicePaddles = Array.from(document.querySelectorAll(".mobile-voice-paddle"))
                    .filter((element) => {
                        const bounds = element.getBoundingClientRect();
                        const style = getComputedStyle(element);
                        return bounds.width > 0
                            && bounds.height > 0
                            && style.display !== "none"
                            && style.visibility !== "hidden";
                    })
                    .map((element) => ({
                        role: element.getAttribute("data-role") ?? "voice-paddle",
                        bounds: rectOf(element),
                    }));
                return {
                    viewport: { width: window.innerWidth, height: window.innerHeight },
                    container: rectOf(container),
                    ...controls,
                    insets: {},
                    requestedDock: JSON.parse(localStorage.getItem(key) ?? "null"),
                    rail: rail instanceof Element ? rectOf(rail) : null,
                    railEdge: rail?.getAttribute("data-edge") ?? null,
                    railExpanded: rail?.getAttribute("data-expanded") === "true",
                    visibleVoiceControls,
                    visibleVoicePaddles,
                };
            },
            { requestedRoles: scenario.roles, key: positionKey },
        );
        validateMeasurement(measurement, scenario);
        measurements[scenario.name] = measurement;

        await page.screenshot({
            path: path.join(evidenceRoot, scenario.filename),
            type: "png",
            animations: "disabled",
        });
        await context.close();
    }
} finally {
    await browser.close();
    await server.stop();
}

await fs.writeFile(
    path.join(evidenceRoot, "geometry.json"),
    `${JSON.stringify(measurements, null, 2)}\n`,
);

console.log(`Wrote ${scenarios.length} reviewed T54 captures to ${evidenceRoot}`);
