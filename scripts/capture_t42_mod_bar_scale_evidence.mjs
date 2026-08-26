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
const evidenceRoot = path.join(repoRoot, "docs", "evidence", "t42-mod-bar-scale");
const viewports = [
    { width: 320, height: 568 },
    { width: 393, height: 852 },
    { width: 430, height: 932 },
];

function scenarioName({ width, height }, edge, expanded) {
    return `after-${width}x${height}-${edge}-${expanded ? "expanded" : "collapsed"}`;
}

async function readGeometry(page) {
    return await page.evaluate(() => {
        const rectOf = (selector) => {
            const bounds = document.querySelector(selector)?.getBoundingClientRect();
            return bounds ? {
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
                width: bounds.width,
                height: bounds.height,
            } : null;
        };
        const rail = document.querySelector('[data-role="mobile-global-mod-rail"]');
        const drawer = document.querySelector('[data-role="mobile-global-mod-rail-drawer"]');
        const sourceButtons = Array.from(
            drawer?.querySelectorAll(".rack-mod-page:not([aria-hidden=true]) .rack-mod-source") ?? [],
        );
        const visibleChips = Array.from(document.querySelectorAll(".mobile-voice-chip"))
            .filter((chip) => {
                const bounds = chip.getBoundingClientRect();
                const style = getComputedStyle(chip);
                return bounds.width > 0
                    && bounds.height > 0
                    && style.display !== "none"
                    && style.visibility !== "hidden";
            })
            .map((chip) => {
                const bounds = chip.getBoundingClientRect();
                return {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                };
            });
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            edge: rail?.getAttribute("data-edge") ?? null,
            expanded: rail?.getAttribute("data-expanded") === "true",
            drawerDirection: rail?.getAttribute("data-drawer-direction") ?? null,
            rail: rectOf('[data-role="mobile-global-mod-rail"]'),
            tab: rectOf('[data-role="mobile-global-mod-rail-tab"]'),
            selectedTap: rectOf('[data-role="mobile-global-mod-rail-selected"]'),
            selectedArt: rectOf('[data-role="mobile-global-mod-rail-selected"] .rack-mod-art'),
            routeBadge: rectOf('[data-role="mobile-global-mod-rail-route-count"]'),
            noteTap: rectOf('[data-role="mobile-global-mod-rail-note"]'),
            noteIcon: rectOf('[data-role="mobile-global-mod-rail-note"] svg'),
            handle: rectOf(".mobile-global-mod-rail-handle"),
            drawer: rectOf('[data-role="mobile-global-mod-rail-drawer"]'),
            drawerScrollHeight: drawer instanceof HTMLElement ? drawer.scrollHeight : null,
            paddleTap: rectOf(".mobile-global-mod-rail-drawer .rack-mod-paddle"),
            sourceTaps: sourceButtons.map((button) => {
                const bounds = button.getBoundingClientRect();
                return {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    height: bounds.height,
                };
            }),
            keyboardToggle: rectOf('[data-role="mobile-global-mod-rail-keyboard-toggle"]'),
            autoToggle: rectOf('[data-role="mobile-global-mod-rail-auto-toggle"]'),
            voiceToggle: rectOf('[data-role="mobile-global-mod-rail-voice-toggle"]'),
            preset: rectOf('[data-role="synth-preset-bar-host"]'),
            tabs: rectOf('[data-role="mobile-workspace-tabs"]'),
            keyboard: rectOf('[data-role="sticky-keyboard"]'),
            visibleVoiceChips: visibleChips,
            documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        };
    });
}

function rectsIntersect(a, b) {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function validateGeometry(measurement) {
    const { edge, rail, preset, tabs, keyboard, viewport, visibleVoiceChips } = measurement;
    if (!rail || !preset || !tabs || !measurement.documentFits) {
        throw new Error(`${measurement.name}: composed shell geometry is incomplete or overflows horizontally.`);
    }
    if (rail.top < preset.bottom + 8.5) {
        throw new Error(`${measurement.name}: rail crosses the scaled preset-bar keep-out.`);
    }
    const lowerChromeTop = Math.min(tabs.top, keyboard?.top ?? Number.POSITIVE_INFINITY);
    if (rail.bottom > lowerChromeTop - 8.5) {
        throw new Error(`${measurement.name}: rail crosses the scaled lower-chrome keep-out.`);
    }
    if ((edge === "right" && Math.abs(rail.right - viewport.width) > 0.5)
        || (edge === "left" && Math.abs(rail.left) > 0.5)) {
        throw new Error(`${measurement.name}: rail is not flush with its declared ${edge} edge.`);
    }
    if (visibleVoiceChips.some((chip) => rectsIntersect(rail, chip))) {
        throw new Error(`${measurement.name}: rail overlaps a visible Voice chip.`);
    }
}

await fs.mkdir(evidenceRoot, { recursive: true });
const server = await startDesktopHarnessServer();
const browser = await chromium.launch({ headless: true });
const measurements = [];

try {
    for (const viewport of viewports) {
        // Start from the real default dock, then use the production grip drag
        // to carry that exact safe Y position across to the other edge.
        const context = await browser.newContext({
            viewport,
            reducedMotion: "reduce",
        });
        const page = await context.newPage();
        await page.goto(server.baseUrl, { waitUntil: "commit" });
        await waitForHarnessReady(page);
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const grip = page.locator('[data-role="mobile-global-mod-rail-grip"]');
        await rail.waitFor();
        await page.waitForTimeout(240);

        for (const edge of ["right", "left"]) {
            if (edge === "left") {
                await grip.click();
                await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="false"]').waitFor();
                const gripBounds = await grip.boundingBox();
                if (!gripBounds) {
                    throw new Error(`Could not measure the ${viewport.width}x${viewport.height} rail grip.`);
                }
                const startX = gripBounds.x + (gripBounds.width / 2);
                const startY = gripBounds.y + (gripBounds.height / 2);
                await page.mouse.move(startX, startY);
                await page.mouse.down();
                await page.mouse.move(18, startY, { steps: 10 });
                await page.mouse.up();
                await page.locator('[data-role="mobile-global-mod-rail"][data-edge="left"]').waitFor();
                await page.waitForTimeout(260);
            }

            for (const expanded of [false, true]) {
                if (expanded) {
                    await grip.click();
                    await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="true"]').waitFor();
                    await page.waitForTimeout(160);
                }
                const name = scenarioName(viewport, edge, expanded);
                await page.screenshot({
                    path: path.join(evidenceRoot, `${name}.png`),
                    animations: "disabled",
                });
                const measurement = { name, ...await readGeometry(page) };
                validateGeometry(measurement);
                measurements.push(measurement);
            }
        }
        await context.close();
    }
} finally {
    await browser.close();
    await server.stop();
}

await fs.writeFile(
    path.join(evidenceRoot, "after-geometry.json"),
    `${JSON.stringify(measurements, null, 2)}\n`,
);

console.log(`Wrote ${measurements.length} real-interface captures and measurements to ${evidenceRoot}`);
