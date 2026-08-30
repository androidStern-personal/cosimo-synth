#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "http://127.0.0.1:5175";
const outputDirectory = path.resolve(repoRoot, process.argv[2] ?? "build/seqfx_visual_proof");

const effects = [
    [1, "Filter", "filter"],
    [2, "Crush", "crush"],
    [3, "Tape Stop", "tape-stop"],
    [4, "Stutter", "stutter"],
    [5, "Pitch", "pitch"],
    [6, "Comb", "comb"],
    [7, "Ring", "ring"],
    [8, "Reverse", "reverse"],
    [9, "Talk Box", "talk-box"],
    [10, "Vibro", "vibro"],
    [11, "Flange", "flange"],
    [12, "Dirty", "dirty"],
];

const proofSizes = [
    { id: "default", width: 1120, height: 680, allEffects: true },
    { id: "compact", width: 900, height: 600, allEffects: true },
    { id: "minimum", width: 720, height: 520, allEffects: false },
    { id: "wide", width: 1440, height: 800, allEffects: false },
];

const zoomLevels = [0.8, 1, 1.25, 1.5, 2];

const focusSelectors = [
    ["SeqFX On", '[data-role="seqfx-enabled"]'],
    ["Loop ruler", '.seqfx-loop__ruler button'],
    ["Grid cell", '[data-role="seqfx-cell"][data-lane="0"][data-step="0"]'],
    ["Effect picker", '[data-role="seqfx-effect-type-option"][data-effect-type="3"]'],
    ["Effect tab", '[data-role="seqfx-effect-tab"]'],
    ["Block Mix", '[data-role="seqfx-mix"]'],
];

const zoomReachabilitySelectors = [
    ["SeqFX On", '[data-role="seqfx-enabled"]'],
    ["Clock", '[data-role="seqfx-clock-mode"]'],
    ["Loop pattern", '[data-role="seqfx-factory-pattern"]'],
    ["Loop ruler", '.seqfx-loop__ruler button'],
    ["Grid cell", '[data-role="seqfx-cell"][data-lane="0"][data-step="0"]'],
    ["Effect picker", '[data-role="seqfx-effect-type-option"][data-effect-type="3"]'],
    ["Effect tab", '[data-role="seqfx-effect-tab"]'],
    ["Block Mix", '[data-role="seqfx-mix"]'],
];

async function serverStatus() {
    try {
        const response = await fetch(`${origin}/__fx-dev-status`);
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    }
}

function isThisRepoServer(status) {
    const seqfxPlugin = status?.plugins?.find?.((plugin) => plugin.name === "seqfx");
    return status?.kind === "fx-vite-dev-server"
        && path.resolve(status.repoRoot) === repoRoot
        && seqfxPlugin?.sourceModule === "/fx/seqfx/view/source.tsx";
}

async function waitForServer() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 20_000) {
        const status = await serverStatus();
        if (isThisRepoServer(status)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("SeqFX visual proof server did not become ready on port 5175.");
}

async function loadHarness(page) {
    await page.goto(`${origin}/__fx-dev-status`);
    await page.setContent(`
        <!doctype html>
        <html>
            <head>
                <title>SeqFX Visual Proof</title>
                <style>html, body, #root { width: 100%; height: 100%; margin: 0; }</style>
            </head>
            <body>
                <div id="root"></div>
                <script type="module">
                    import RefreshRuntime from "/@react-refresh";
                    RefreshRuntime.injectIntoGlobalHook(window);
                    window.$RefreshReg$ = () => {};
                    window.$RefreshSig$ = () => (type) => type;
                    window.__vite_plugin_react_preamble_installed__ = true;
                </script>
                <script type="module" src="/fx/seqfx/view/harness-main.ts"></script>
            </body>
        </html>
    `);
    await page.locator('[data-role="seqfx-root"]').waitFor();
}

async function recordScreenshot(page, fileName, manifest) {
    const filePath = path.join(outputDirectory, fileName);
    await page.screenshot({ path: filePath, animations: "disabled" });
    const bytes = await readFile(filePath);
    manifest.push({
        file: fileName,
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
    });
}

async function measureSurface(page, sizeId, effectName) {
    return page.evaluate(({ currentSizeId, currentEffectName }) => {
        const root = document.querySelector('[data-role="seqfx-root"]');
        const workspace = document.querySelector(".seqfx-workspace");
        const grid = document.querySelector(".seqfx-grid-shell");
        const inspector = document.querySelector('[data-role="seqfx-inspector"]');
        const picker = document.querySelector('[data-role="seqfx-effect-type"]');
        const tabs = document.querySelector(".seqfx-inspector-tabs");
        const preset = document.querySelector('[data-role="seqfx-factory-effect-preset"]')?.closest("label");
        const mix = document.querySelector('[data-role="seqfx-mix-row"]');
        const laneLabel = document.querySelector(".seqfx-lane-label");
        const bounds = (node) => {
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return { bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, top: rect.top, width: rect.width };
        };
        const inspectorBounds = bounds(inspector);
        const ownedNodes = [picker, tabs, preset, mix].filter(Boolean);
        const ownedOverflow = ownedNodes.flatMap((node) => {
            const rect = bounds(node);
            if (!rect || !inspectorBounds) return [];
            return rect.left < inspectorBounds.left - 1 || rect.right > inspectorBounds.right + 1
                ? [{ className: node.className, left: rect.left, right: rect.right }]
                : [];
        });
        const clippedNames = [...document.querySelectorAll(".seqfx-effect-picker__name")]
            .filter((node) => node.scrollWidth > node.clientWidth + 1)
            .map((node) => node.textContent?.trim());
        const undersizedControls = [...document.querySelectorAll("button, select, input")]
            .filter((node) => {
                const style = getComputedStyle(node);
                const rect = node.getBoundingClientRect();
                return style.display !== "none"
                    && style.visibility !== "hidden"
                    && !node.disabled
                    && rect.width > 0
                    && rect.height > 0
                    && (rect.width < 24 || rect.height < 24);
            })
            .map((node) => ({
                ariaLabel: node.getAttribute("aria-label"),
                dataRole: node.getAttribute("data-role"),
                height: node.getBoundingClientRect().height,
                tag: node.tagName,
                width: node.getBoundingClientRect().width,
            }));

        const parseColor = (value) => {
            const match = value.match(/rgba?\(([^)]+)\)/i);
            if (!match) return null;
            const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
            if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
            return [parts[0], parts[1], parts[2], parts[3] ?? 1];
        };
        const composite = (foreground, background) => {
            const alpha = foreground[3] + (background[3] * (1 - foreground[3]));
            if (alpha <= 0) return [0, 0, 0, 0];
            return [
                ((foreground[0] * foreground[3]) + (background[0] * background[3] * (1 - foreground[3]))) / alpha,
                ((foreground[1] * foreground[3]) + (background[1] * background[3] * (1 - foreground[3]))) / alpha,
                ((foreground[2] * foreground[3]) + (background[2] * background[3] * (1 - foreground[3]))) / alpha,
                alpha,
            ];
        };
        const effectiveBackground = (node) => {
            const lineage = [];
            for (let current = node; current instanceof Element; current = current.parentElement) lineage.unshift(current);
            return lineage.reduce((background, current) => {
                const color = parseColor(getComputedStyle(current).backgroundColor);
                return color ? composite(color, background) : background;
            }, [255, 255, 255, 1]);
        };
        const luminance = (color) => {
            const channels = color.slice(0, 3).map((channel) => {
                const value = channel / 255;
                return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            });
            return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
        };
        const ratio = (left, right) => {
            const leftLuminance = luminance(left);
            const rightLuminance = luminance(right);
            return (Math.max(leftLuminance, rightLuminance) + 0.05) / (Math.min(leftLuminance, rightLuminance) + 0.05);
        };
        const directText = (node) => [...node.childNodes]
            .filter((child) => child.nodeType === Node.TEXT_NODE)
            .map((child) => child.textContent ?? "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        const contrastCandidates = [...root.querySelectorAll("*")].filter((node) => {
            if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) return false;
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            const hasText = directText(node).length > 0 || node instanceof HTMLSelectElement;
            return hasText
                && style.display !== "none"
                && style.visibility !== "hidden"
                && Number(style.opacity) >= 0.8
                && !(node instanceof HTMLButtonElement && node.disabled)
                && !(node instanceof HTMLSelectElement && node.disabled)
                && rect.width > 0
                && rect.height > 0;
        });
        const contrastSamples = contrastCandidates.map((node) => {
            const style = getComputedStyle(node);
            const background = effectiveBackground(node);
            const rawForeground = parseColor(style.color) ?? [0, 0, 0, 1];
            const foreground = composite(rawForeground, background);
            const fontSize = Number.parseFloat(style.fontSize);
            const fontWeight = Number.parseFloat(style.fontWeight) || (style.fontWeight === "bold" ? 700 : 400);
            const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
            const contrastRatio = ratio(foreground, background);
            return {
                className: typeof node.className === "string" ? node.className : node.getAttribute("class"),
                contrastRatio,
                dataRole: node.getAttribute("data-role"),
                fontSize,
                fontWeight,
                requiredRatio: largeText ? 3 : 4.5,
                tag: node.tagName,
                text: directText(node) || (node instanceof HTMLSelectElement ? node.selectedOptions[0]?.textContent?.trim() : ""),
            };
        });
        const lowContrastText = contrastSamples.filter((sample) => sample.contrastRatio + 0.01 < sample.requiredRatio);
        const motionFailures = [...root.querySelectorAll("*")].flatMap((node) => {
            const style = getComputedStyle(node);
            const durations = `${style.transitionDuration},${style.animationDuration}`
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
                .map((value) => value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000)
                .filter(Number.isFinite);
            return durations.some((duration) => duration > 0.1)
                ? [{ className: node.className, durations }]
                : [];
        });

        return {
            effect: currentEffectName,
            size: currentSizeId,
            viewport: { height: window.innerHeight, width: window.innerWidth },
            documentOverflow: {
                horizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
                vertical: document.documentElement.scrollHeight > window.innerHeight + 1,
            },
            rootOverflow: {
                horizontal: root.scrollWidth > root.clientWidth + 1,
                vertical: root.scrollHeight > root.clientHeight + 1,
            },
            inspectorOverflow: {
                horizontal: inspector.scrollWidth > inspector.clientWidth + 1,
                ownsVerticalScroll: getComputedStyle(inspector).overflowY === "auto",
                vertical: inspector.scrollHeight > inspector.clientHeight + 1,
            },
            bounds: {
                grid: bounds(grid),
                inspector: inspectorBounds,
                laneLabel: bounds(laneLabel),
                workspace: bounds(workspace),
            },
            laneLabelDisplay: getComputedStyle(laneLabel).display,
            clippedNames,
            contrastSampleCount: contrastSamples.length,
            lowContrastText,
            motionFailures,
            ownedOverflow,
            undersizedControls,
        };
    }, { currentSizeId: sizeId, currentEffectName: effectName });
}

function assertMeasurement(measurement) {
    const failures = [];
    if (measurement.documentOverflow.horizontal || measurement.documentOverflow.vertical) failures.push("document overflow");
    if (measurement.rootOverflow.horizontal || measurement.rootOverflow.vertical) failures.push("root overflow");
    if (measurement.inspectorOverflow.horizontal) failures.push("inspector horizontal overflow");
    if (!measurement.inspectorOverflow.ownsVerticalScroll) failures.push("inspector does not own vertical scroll");
    if (measurement.laneLabelDisplay !== "flex") failures.push("chain labels hidden");
    if (measurement.clippedNames.length > 0) failures.push(`clipped effect names: ${measurement.clippedNames.join(", ")}`);
    if (measurement.lowContrastText.length > 0) failures.push(`${measurement.lowContrastText.length} normal-text contrast failures`);
    if (measurement.motionFailures.length > 0) failures.push(`${measurement.motionFailures.length} reduced-motion failures`);
    if (measurement.ownedOverflow.length > 0) failures.push("inspector child outside owned bounds");
    if (measurement.undersizedControls.length > 0) failures.push(`${measurement.undersizedControls.length} interactive controls below 24px`);
    return failures;
}

async function auditFocus(page) {
    const results = [];
    for (const [label, selector] of focusSelectors) {
        const locator = page.locator(selector).first();
        await page.evaluate(() => {
            document.activeElement?.blur?.();
            document.body.tabIndex = -1;
            document.body.focus();
        });
        let reachedByKeyboard = false;
        for (let index = 0; index < 256; index += 1) {
            await page.keyboard.press("Tab");
            reachedByKeyboard = await locator.evaluate((node) => document.activeElement === node);
            if (reachedByKeyboard) break;
        }
        results.push(await locator.evaluate((node, currentLabel) => {
            const style = getComputedStyle(node);
            return {
                active: document.activeElement === node,
                boxShadow: style.boxShadow,
                label: currentLabel,
                outlineColor: style.outlineColor,
                outlineOffset: style.outlineOffset,
                outlineStyle: style.outlineStyle,
                outlineWidth: Number.parseFloat(style.outlineWidth),
                reachedByKeyboard: document.activeElement === node,
            };
        }, label));
    }
    return results;
}

async function auditZoom(browser, zoom) {
    const baseWidth = 1120;
    const baseHeight = 680;
    const width = Math.round(baseWidth / zoom);
    const height = Math.round(baseHeight / zoom);
    const page = await browser.newPage({ viewport: { width, height } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    try {
        await loadHarness(page);
        await page.locator('[data-role="seqfx-first-use-dismiss"]').click();
        await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
        const controls = [];
        for (const [label, selector] of zoomReachabilitySelectors) {
            const locator = page.locator(selector).first();
            await locator.scrollIntoViewIfNeeded();
            await locator.focus();
            controls.push(await locator.evaluate((node, currentLabel) => {
                const rect = node.getBoundingClientRect();
                return {
                    active: document.activeElement === node,
                    height: rect.height,
                    intersectsViewport: rect.bottom > 0
                        && rect.right > 0
                        && rect.top < window.innerHeight
                        && rect.left < window.innerWidth,
                    label: currentLabel,
                    width: rect.width,
                };
            }, label));
        }
        return {
            controls,
            documentHorizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
            effectiveCssViewport: { height, width },
            zoom,
        };
    } finally {
        await page.close();
    }
}

await mkdir(outputDirectory, { recursive: true });

let serverProcess = null;
const initialStatus = await serverStatus();
if (initialStatus && !isThisRepoServer(initialStatus)) {
    throw new Error(`Port 5175 is owned by another workspace (${initialStatus.repoRoot ?? "unknown"}); visual proof will not interrupt it.`);
}
if (!isThisRepoServer(initialStatus)) {
    serverProcess = spawn("npm", ["run", "fx:dev"], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
}

let browser;
try {
    await waitForServer();
    browser = await chromium.launch();
    const screenshotManifest = [];
    const measurements = [];

    for (const size of proofSizes) {
        const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await loadHarness(page);
        await recordScreenshot(page, `${size.id}-empty.png`, screenshotManifest);
        measurements.push(await measureSurface(page, size.id, "Empty"));
        await page.locator('[data-role="seqfx-first-use-dismiss"]').click();

        if (size.allEffects) {
            await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
            for (const [effectType, effectName, fileStem] of effects) {
                await page.locator(`[data-role="seqfx-effect-type-option"][data-effect-type="${effectType}"]`).click();
                await page.getByRole("button", { name: `Chain 1 ${effectName} block 1`, exact: true }).waitFor();
                await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => { node.scrollTop = 0; });
                measurements.push(await measureSurface(page, size.id, effectName));
                await recordScreenshot(page, `${size.id}-${fileStem}.png`, screenshotManifest);
            }
        } else {
            await page.locator('[data-role="seqfx-factory-pattern"]').selectOption("twelve-effect-tour");
            await page.getByRole("button", { name: "Chain 1 Filter block 1-2", exact: true }).click();
            measurements.push(await measureSurface(page, size.id, "Twelve-effect Tour"));
            await recordScreenshot(page, `${size.id}-twelve-effect-tour.png`, screenshotManifest);
        }

        await page.close();
    }

    const focusPage = await browser.newPage({ viewport: { width: 1120, height: 680 } });
    await focusPage.emulateMedia({ reducedMotion: "reduce" });
    await loadHarness(focusPage);
    await focusPage.locator('[data-role="seqfx-first-use-dismiss"]').click();
    await focusPage.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    const focus = await auditFocus(focusPage);
    await focusPage.close();

    const zoom = [];
    for (const zoomLevel of zoomLevels) {
        zoom.push(await auditZoom(browser, zoomLevel));
    }

    const failures = measurements.flatMap((measurement) => (
        assertMeasurement(measurement).map((failure) => `${measurement.size}/${measurement.effect}: ${failure}`)
    ));
    failures.push(...focus.flatMap((entry) => (
        !entry.active || entry.outlineStyle === "none" || entry.outlineWidth < 1
            ? [`focus/${entry.label}: missing visible focus outline`]
            : []
    )));
    failures.push(...zoom.flatMap((entry) => {
        const controlFailures = entry.controls.filter((control) => !control.active || !control.intersectsViewport || control.width <= 0 || control.height <= 0);
        const horizontalFailure = entry.documentHorizontalOverflow ? [`zoom/${entry.zoom}: document horizontal overflow`] : [];
        return [
            ...horizontalFailure,
            ...controlFailures.map((control) => `zoom/${entry.zoom}/${control.label}: core control unreachable`),
        ];
    }));
    const report = {
        generatedAt: new Date().toISOString(),
        repoRoot,
        screenshots: screenshotManifest,
        measurements,
        focus,
        zoom,
        failures,
    };
    await writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (failures.length > 0) {
        throw new Error(`SeqFX visual proof found ${failures.length} failures:\n${failures.join("\n")}`);
    }
    process.stdout.write(`SeqFX visual proof passed: ${screenshotManifest.length} screenshots, ${measurements.length} measured states.\n`);
} finally {
    await browser?.close();
    serverProcess?.kill("SIGTERM");
}
