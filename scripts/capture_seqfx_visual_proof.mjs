#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { buildPlugin } from "../fx/build-effect.mjs";
import {
    captureSeqFxProofProvenance,
    compareSeqFxProofProvenance,
} from "./seqfx-proof-provenance.mjs";
import {
    createSeqFxVisualProofContract,
    SEQFX_DENSE_GRID_TARGET_ROLES,
    SEQFX_INTERACTIVE_TARGET_SELECTOR,
    SEQFX_STANDARD_MINIMUM_TARGET_SIZE_PX,
    SEQFX_VISUAL_EFFECTS,
    SEQFX_VISUAL_PROOF_SIZES,
    seqFxMinimumInteractiveTargetSize,
    validateSeqFxInspectorDepthCoverage,
    validateSeqFxVisualProofCoverage,
} from "./seqfx-visual-proof-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commandArguments = process.argv.slice(2);
const requireClean = commandArguments.includes("--require-clean");
const outputArgument = commandArguments.find((argument) => !argument.startsWith("--"));
const outputDirectory = path.resolve(repoRoot, outputArgument ?? "build/seqfx_visual_proof");
let origin = "";

const zoomLevels = [0.8, 1, 1.25, 1.5, 2];

const focusSelectors = [
    ["SeqFX On", '[data-role="seqfx-enabled"]', "first"],
    ["Loop ruler", '.seqfx-loop__ruler button', "first"],
    ["Grid cell", '[data-role="seqfx-cell"][data-lane="0"][data-step="0"]', "first"],
    ["Effect picker", '[data-role="seqfx-effect-type-option"][data-effect-type="3"]', "first"],
    ["Effect tab", '[data-role="seqfx-effect-tab"]', "first"],
    ["Block Mix", '[data-role="seqfx-mix"]', "first"],
    ["Lower inspector control", '[data-role="seqfx-inspector"] :is(button, select, input):not(:disabled)', "last"],
];

const zoomReachabilitySelectors = [
    ["SeqFX On", '[data-role="seqfx-enabled"]', "first"],
    ["Clock", '[data-role="seqfx-clock-mode"]', "first"],
    ["Loop pattern", '[data-role="seqfx-factory-pattern"]', "first"],
    ["Loop ruler", '.seqfx-loop__ruler button', "first"],
    ["Grid cell", '[data-role="seqfx-cell"][data-lane="0"][data-step="0"]', "first"],
    ["Effect picker", '[data-role="seqfx-effect-type-option"][data-effect-type="3"]', "first"],
    ["Effect tab", '[data-role="seqfx-effect-tab"]', "first"],
    ["Block Mix", '[data-role="seqfx-mix"]', "first"],
    ["Lower inspector control", '[data-role="seqfx-inspector"] :is(button, select, input):not(:disabled)', "last"],
];

function contentTypeForPath(filePath) {
    if (filePath.endsWith(".js")) return "text/javascript";
    if (filePath.endsWith(".json") || filePath.endsWith(".map")) return "application/json";
    if (filePath.endsWith(".css")) return "text/css";
    if (filePath.endsWith(".html")) return "text/html";
    return "application/octet-stream";
}

async function startStaticServer() {
    const server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url ?? "/", "http://127.0.0.1");
            if (url.pathname === "/") {
                response.writeHead(200, { "Content-Type": "text/html" });
                response.end("<!doctype html><html><body></body></html>");
                return;
            }
            const requestedPath = decodeURIComponent(url.pathname);
            const absolutePath = path.resolve(repoRoot, `.${requestedPath}`);
            if (absolutePath !== repoRoot && !absolutePath.startsWith(`${repoRoot}${path.sep}`)) {
                response.writeHead(403);
                response.end("Forbidden");
                return;
            }
            if (!(await stat(absolutePath)).isFile()) {
                response.writeHead(404);
                response.end("Not found");
                return;
            }
            response.writeHead(200, { "Content-Type": contentTypeForPath(absolutePath) });
            response.end(await readFile(absolutePath));
        } catch {
            response.writeHead(404);
            response.end("Not found");
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address !== "object") throw new Error("SeqFX proof server did not bind a port.");
    return {
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        }),
    };
}

function pickLocator(page, selector, position = "first") {
    const matches = page.locator(selector);
    return position === "last" ? matches.last() : matches.first();
}

async function revealAdvancedInspectorControls(page) {
    return await page.locator('[data-role="seqfx-inspector"] details').evaluateAll((details) => {
        for (const disclosure of details) disclosure.open = true;
        return details.length;
    });
}

async function loadPackagedView(page) {
    await page.goto(origin);
    await page.setContent(`
        <!doctype html>
        <html>
            <head>
                <title>SeqFX Visual Proof</title>
                <style>html, body, #root { width: 100%; height: 100%; margin: 0; }</style>
            </head>
            <body>
                <div id="root"></div>
            </body>
        </html>
    `);
    const mounted = await page.evaluate(async () => {
        class SeqFxVisualProofPatchConnection {
            constructor() {
                this.manifest = {
                    view: {
                        src: "build/fx/seqfx_runtime/view/index.js",
                        devModule: "",
                        width: 1120,
                        height: 680,
                    },
                };
                this.storedState = {};
                this.events = [];
                this.parameters = {
                    enabled: 1,
                    globalMix: 1,
                    patternSelect: 0,
                    clockMode: 0,
                    manualBpm: 120,
                    rate: 1,
                    swing: 0,
                    loopStart: 0,
                    loopLength: 32,
                };
                this.status = { details: { inputs: [] } };
                this.statusListeners = new Set();
                this.storedStateListeners = new Set();
                this.parameterListeners = new Map();
                this.endpointListeners = new Map();
                this.gestureStarts = [];
                this.gestureEnds = [];
            }

            getResourceAddress(resourcePath) {
                return resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}`;
            }

            addStatusListener(listener) { this.statusListeners.add(listener); }
            removeStatusListener(listener) { this.statusListeners.delete(listener); }
            requestStatusUpdate() { for (const listener of this.statusListeners) listener(this.status); }
            addStoredStateValueListener(listener) { this.storedStateListeners.add(listener); }
            removeStoredStateValueListener(listener) { this.storedStateListeners.delete(listener); }
            requestFullStoredState(callback) {
                callback({ parameters: { ...this.parameters }, values: { ...this.storedState } });
            }
            requestStoredStateValue(key) {
                for (const listener of this.storedStateListeners) listener({ key, value: this.storedState[key] });
            }
            sendStoredStateValue(key, value) {
                this.storedState[key] = value;
                for (const listener of this.storedStateListeners) listener({ key, value });
            }
            addParameterListener(endpointID, listener) {
                const listeners = this.parameterListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                this.parameterListeners.set(endpointID, listeners);
            }
            removeParameterListener(endpointID, listener) { this.parameterListeners.get(endpointID)?.delete(listener); }
            requestParameterValue(endpointID) {
                for (const listener of this.parameterListeners.get(endpointID) ?? []) {
                    listener(this.parameters[endpointID] ?? 0);
                }
            }
            sendEventOrValue(endpointID, value) {
                this.events.push({ endpointID, value });
                this.parameters[endpointID] = value;
                for (const listener of this.parameterListeners.get(endpointID) ?? []) listener(value);
            }
            sendParameterGestureStart(endpointID) { this.gestureStarts.push(endpointID); }
            sendParameterGestureEnd(endpointID) { this.gestureEnds.push(endpointID); }
            addEndpointListener(endpointID, listener) {
                const listeners = this.endpointListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                this.endpointListeners.set(endpointID, listeners);
            }
            removeEndpointListener(endpointID, listener) { this.endpointListeners.get(endpointID)?.delete(listener); }
        }

        const patchConnection = new SeqFxVisualProofPatchConnection();
        const module = await import("/build/fx/seqfx_runtime/view/index.js");
        const view = await module.default(patchConnection);
        document.getElementById("root").appendChild(view);
        window.__SEQFX_VISUAL_PROOF__ = { patchConnection };
        return { hostTagName: view.tagName.toLowerCase() };
    });
    if (mounted.hostTagName !== "cosimo-seqfx-react-view") {
        throw new Error(`Packaged SeqFX factory returned ${mounted.hostTagName}.`);
    }
    await page.waitForFunction(() => {
        const host = document.querySelector("cosimo-seqfx-react-view");
        return Boolean(host?.shadowRoot?.querySelector('[data-role="seqfx-root"]'));
    });
    const renderedInShadowRoot = await page.evaluate(() => {
        const host = document.querySelector("cosimo-seqfx-react-view");
        return Boolean(host?.shadowRoot?.querySelector('[data-role="seqfx-root"]'));
    });
    if (!renderedInShadowRoot) throw new Error("Packaged SeqFX visual proof did not render inside its shadow root.");
    await page.locator('[data-role="seqfx-root"]').waitFor();
}

async function recordScreenshot(page, fileName, manifest, metadata = {}) {
    const filePath = path.join(outputDirectory, fileName);
    await page.screenshot({ path: filePath, animations: "disabled" });
    const bytes = await readFile(filePath);
    manifest.push({
        ...metadata,
        file: fileName,
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
    });
}

async function createContactSheet(browser, screenshotManifest) {
    const relativeOutputDirectory = path.relative(repoRoot, outputDirectory).replaceAll(path.sep, "/");
    if (relativeOutputDirectory === ".." || relativeOutputDirectory.startsWith("../")) {
        throw new Error("SeqFX contact-sheet output must remain inside the repository proof directory.");
    }
    const entries = screenshotManifest.map((entry) => ({
        ...entry,
        source: `${origin}/${relativeOutputDirectory}/${encodeURIComponent(entry.file)}`,
    }));
    const page = await browser.newPage({ viewport: { width: 1880, height: 1000 } });
    try {
        await page.setContent(`
            <!doctype html>
            <html>
                <head>
                    <meta charset="utf-8" />
                    <style>
                        * { box-sizing: border-box; }
                        html, body { margin: 0; min-width: 100%; background: #171816; color: #f5f0e6; }
                        body { padding: 28px; font: 600 15px/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
                        h1 { margin: 0 0 20px; font-size: 24px; letter-spacing: 0.04em; }
                        main { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
                        figure { margin: 0; padding: 10px; border: 1px solid #45483f; background: #242620; }
                        img { display: block; width: 100%; aspect-ratio: 1120 / 680; object-fit: contain; background: #090a09; }
                        figcaption { margin-top: 8px; overflow-wrap: anywhere; }
                    </style>
                </head>
                <body>
                    <h1>SeqFX supported-size visual qualification</h1>
                    <main>
                        ${entries.map((entry) => `
                            <figure>
                                <img alt="" src="${entry.source}" />
                                <figcaption>${entry.file}</figcaption>
                            </figure>
                        `).join("")}
                    </main>
                </body>
            </html>
        `, { waitUntil: "load" });
        await page.evaluate(async () => {
            for (const image of document.images) {
                await image.decode();
            }
        });
        const file = "contact-sheet.png";
        const filePath = path.join(outputDirectory, file);
        await page.screenshot({ animations: "disabled", fullPage: true, path: filePath });
        const bytes = await readFile(filePath);
        return {
            bytes: bytes.byteLength,
            file,
            sha256: createHash("sha256").update(bytes).digest("hex"),
        };
    } finally {
        await page.close();
    }
}

async function measureSurface(page, sizeId, effectId, effectName, inspectorView) {
    return page.evaluate(({
        currentSizeId,
        currentEffectId,
        currentEffectName,
        currentInspectorView,
        interactiveTargetSelector,
        minimumTargetSizesByRole,
        standardMinimumTargetSize,
    }) => {
        const host = document.querySelector("cosimo-seqfx-react-view");
        const scope = host?.shadowRoot ?? document;
        const root = scope.querySelector('[data-role="seqfx-root"]');
        const workspace = scope.querySelector(".seqfx-workspace");
        const grid = scope.querySelector(".seqfx-grid-shell");
        const inspector = scope.querySelector('[data-role="seqfx-inspector"]');
        const picker = scope.querySelector('[data-role="seqfx-effect-type"]');
        const tabs = scope.querySelector(".seqfx-inspector-tabs");
        const preset = scope.querySelector('[data-role="seqfx-factory-effect-preset"]')?.closest("label");
        const mix = scope.querySelector('[data-role="seqfx-mix-row"]');
        const laneLabel = scope.querySelector(".seqfx-lane-label");
        if (!root || !workspace || !grid || !inspector || !laneLabel) {
            throw new Error("SeqFX packaged shadow-root surface was incomplete during measurement.");
        }
        const bounds = (node) => {
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return { bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, top: rect.top, width: rect.width };
        };
        const inspectorBounds = bounds(inspector);
        const ownedNodes = [
            picker,
            tabs,
            preset,
            mix,
            ...inspector.querySelectorAll("button, select, input, output, label, section, [data-role]"),
        ].filter(Boolean);
        const ownedOverflow = ownedNodes.flatMap((node) => {
            if (!(node instanceof HTMLElement)) return [];
            const rect = bounds(node);
            if (!rect || !inspectorBounds || rect.width <= 0 || rect.height <= 0) return [];
            if (rect.bottom <= inspectorBounds.top + 1 || rect.top >= inspectorBounds.bottom - 1) return [];
            return rect.left < inspectorBounds.left - 1 || rect.right > inspectorBounds.right + 1
                ? [{
                    className: typeof node.className === "string" ? node.className : node.getAttribute("class"),
                    dataRole: node.getAttribute("data-role"),
                    left: rect.left,
                    right: rect.right,
                }]
                : [];
        });
        const clippedNames = [...scope.querySelectorAll(".seqfx-effect-picker__name")]
            .filter((node) => node.scrollWidth > node.clientWidth + 1)
            .map((node) => node.textContent?.trim());
        const undersizedControls = [...root.querySelectorAll(interactiveTargetSelector)]
            .filter((node) => {
                const style = getComputedStyle(node);
                const rect = node.getBoundingClientRect();
                const minimumTargetSize = minimumTargetSizesByRole[node.getAttribute("data-role")]
                    ?? standardMinimumTargetSize;
                return style.display !== "none"
                    && style.visibility !== "hidden"
                    && !node.disabled
                    && rect.width > 0
                    && rect.height > 0
                    && (rect.width < minimumTargetSize || rect.height < minimumTargetSize);
            })
            .map((node) => {
                const dataRole = node.getAttribute("data-role");
                return {
                    ariaLabel: node.getAttribute("aria-label"),
                    dataRole,
                    height: node.getBoundingClientRect().height,
                    minimumTargetSize: minimumTargetSizesByRole[dataRole] ?? standardMinimumTargetSize,
                    tag: node.tagName,
                    width: node.getBoundingClientRect().width,
                };
            });

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
        const proseClassPattern = /(help|hint|note|description|disabled|source|explanation|guide|empty-state)/i;
        const undersizedFunctionalText = contrastSamples.flatMap((sample) => {
            const className = sample.className ?? "";
            const isProse = sample.tag === "P"
                || sample.tag === "SMALL"
                || proseClassPattern.test(className)
                || proseClassPattern.test(sample.dataRole ?? "");
            const requiredFontSize = isProse ? 11 : 10;
            return sample.fontSize + 0.01 < requiredFontSize
                ? [{ ...sample, kind: isProse ? "prose/help" : "label/readout", requiredFontSize }]
                : [];
        });
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
        const interactiveControls = [...inspector.querySelectorAll(interactiveTargetSelector)]
            .filter((node) => {
                const style = getComputedStyle(node);
                const rect = node.getBoundingClientRect();
                return style.display !== "none"
                    && style.visibility !== "hidden"
                    && !node.disabled
                    && rect.width > 0
                    && rect.height > 0;
            })
            .map((node, index) => {
                const rect = bounds(node);
                const intersectsInspectorViewport = Boolean(inspectorBounds && rect
                    && rect.bottom > inspectorBounds.top + 1
                    && rect.top < inspectorBounds.bottom - 1);
                return {
                    ariaLabel: node.getAttribute("aria-label"),
                    dataParam: node.getAttribute("data-param"),
                    dataRole: node.getAttribute("data-role"),
                    index,
                    intersectsInspectorViewport,
                    tag: node.tagName,
                    text: node instanceof HTMLButtonElement ? node.textContent?.replace(/\s+/g, " ").trim() : null,
                    top: rect?.top,
                    bottom: rect?.bottom,
                };
            });
        const advancedDisclosures = [...inspector.querySelectorAll("details")].map((node) => ({
            open: node.open,
            summary: node.querySelector("summary")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        }));
        const maximumInspectorScroll = Math.max(0, inspector.scrollHeight - inspector.clientHeight);

        return {
            effect: currentEffectName,
            effectName: currentEffectName,
            effectId: currentEffectId,
            inspectorView: currentInspectorView,
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
                maximumScroll: maximumInspectorScroll,
                ownsVerticalScroll: getComputedStyle(inspector).overflowY === "auto",
                scrollTop: inspector.scrollTop,
                vertical: inspector.scrollHeight > inspector.clientHeight + 1,
            },
            advancedDisclosures,
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
            interactiveControls,
            undersizedControls,
            undersizedFunctionalText,
        };
    }, {
        currentEffectId: effectId,
        currentEffectName: effectName,
        currentInspectorView: inspectorView,
        currentSizeId: sizeId,
        interactiveTargetSelector: SEQFX_INTERACTIVE_TARGET_SELECTOR,
        minimumTargetSizesByRole: Object.fromEntries(
            SEQFX_DENSE_GRID_TARGET_ROLES.map((dataRole) => [
                dataRole,
                seqFxMinimumInteractiveTargetSize(dataRole),
            ]),
        ),
        standardMinimumTargetSize: SEQFX_STANDARD_MINIMUM_TARGET_SIZE_PX,
    });
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
    if (measurement.undersizedControls.length > 0) failures.push(`${measurement.undersizedControls.length} interactive controls below their required target size`);
    if (measurement.undersizedFunctionalText.length > 0) failures.push(`${measurement.undersizedFunctionalText.length} functional text items below type floor`);
    if (measurement.advancedDisclosures.some((disclosure) => !disclosure.open)) failures.push("advanced inspector disclosure remained closed");
    if (measurement.inspectorView === "lower"
        && measurement.inspectorOverflow.maximumScroll > 1
        && measurement.inspectorOverflow.scrollTop < measurement.inspectorOverflow.maximumScroll - 1) {
        failures.push("lower capture did not reach the end of the inspector");
    }
    return failures;
}

async function auditInspectorDepth(page, sizeId, effectId, effectName) {
    const advancedDisclosureCount = await revealAdvancedInspectorControls(page);
    return await page.locator('[data-role="seqfx-inspector"]').evaluate(async (inspector, context) => {
        const controls = [...inspector.querySelectorAll(context.interactiveTargetSelector)].filter((node) => {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.display !== "none"
                && style.visibility !== "hidden"
                && !node.disabled
                && rect.width > 0
                && rect.height > 0;
        });
        const ownedNodes = [...inspector.querySelectorAll("button, select, input, output, label, section, [data-role]")]
            .filter((node) => node instanceof HTMLElement);
        const maximumScroll = Math.max(0, inspector.scrollHeight - inspector.clientHeight);
        const stride = Math.max(1, inspector.clientHeight - 48);
        const positions = [];
        for (let position = 0; position < maximumScroll; position += stride) positions.push(position);
        positions.push(maximumScroll);
        const uniquePositions = [...new Set(positions.map((position) => Math.round(position)))];
        const seen = new Set();
        const horizontalOverflow = new Map();
        const observations = [];

        for (const position of uniquePositions) {
            inspector.scrollTop = position;
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
            const viewport = inspector.getBoundingClientRect();
            const visible = [];
            controls.forEach((control, index) => {
                const rect = control.getBoundingClientRect();
                if (rect.bottom > viewport.top + 1 && rect.top < viewport.bottom - 1) {
                    seen.add(index);
                    visible.push(index);
                }
            });
            ownedNodes.forEach((node, index) => {
                const rect = node.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;
                if (rect.bottom <= viewport.top + 1 || rect.top >= viewport.bottom - 1) return;
                if (rect.left < viewport.left - 1 || rect.right > viewport.right + 1) {
                    horizontalOverflow.set(index, {
                        className: typeof node.className === "string" ? node.className : node.getAttribute("class"),
                        dataRole: node.getAttribute("data-role"),
                        index,
                        left: rect.left,
                        right: rect.right,
                    });
                }
            });
            observations.push({
                horizontalOverflow: [...horizontalOverflow.keys()],
                requestedScrollTop: position,
                scrollTop: inspector.scrollTop,
                visible,
            });
        }

        inspector.scrollTop = maximumScroll;
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        return {
            advancedDisclosureCount: context.advancedDisclosureCount,
            controlCount: controls.length,
            controls: controls.map((control, index) => ({
                ariaLabel: control.getAttribute("aria-label"),
                dataParam: control.getAttribute("data-param"),
                dataRole: control.getAttribute("data-role"),
                index,
                tag: control.tagName,
                text: control instanceof HTMLButtonElement ? control.textContent?.replace(/\s+/g, " ").trim() : null,
            })),
            effect: context.effectName,
            effectId: context.effectId,
            finalScrollTop: inspector.scrollTop,
            horizontalOverflow: [...horizontalOverflow.values()],
            maximumScroll,
            missingControlIndexes: controls.map((_, index) => index).filter((index) => !seen.has(index)),
            observations,
            size: context.sizeId,
        };
    }, {
        advancedDisclosureCount,
        effectId,
        effectName,
        interactiveTargetSelector: SEQFX_INTERACTIVE_TARGET_SELECTOR,
        sizeId,
    });
}

function assertInspectorDepth(depth) {
    const failures = [];
    if (depth.missingControlIndexes.length > 0) {
        failures.push(`inspector traversal never exposed controls ${depth.missingControlIndexes.join(", ")}`);
    }
    if (depth.maximumScroll > 1 && depth.finalScrollTop < depth.maximumScroll - 1) {
        failures.push("inspector traversal did not finish at the lower edge");
    }
    if (depth.horizontalOverflow.length > 0) failures.push("inspector child outside owned bounds during depth traversal");
    return failures;
}

async function auditFocus(page) {
    const results = [];
    await revealAdvancedInspectorControls(page);
    for (const [label, selector, position] of focusSelectors) {
        const locator = pickLocator(page, selector, position);
        await page.evaluate(() => {
            const host = document.querySelector("cosimo-seqfx-react-view");
            host?.shadowRoot?.activeElement?.blur?.();
            document.activeElement?.blur?.();
            document.body.tabIndex = -1;
            document.body.focus();
        });
        let reachedByKeyboard = false;
        for (let index = 0; index < 256; index += 1) {
            await page.keyboard.press("Tab");
            reachedByKeyboard = await locator.evaluate((node) => node.getRootNode().activeElement === node);
            if (reachedByKeyboard) break;
        }
        results.push(await locator.evaluate((node, currentLabel) => {
            const style = getComputedStyle(node);
            return {
                active: node.getRootNode().activeElement === node,
                boxShadow: style.boxShadow,
                label: currentLabel,
                outlineColor: style.outlineColor,
                outlineOffset: style.outlineOffset,
                outlineStyle: style.outlineStyle,
                outlineWidth: Number.parseFloat(style.outlineWidth),
                reachedByKeyboard: node.getRootNode().activeElement === node,
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
        await loadPackagedView(page);
        await page.locator('[data-role="seqfx-first-use-dismiss"]').click();
        await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
        await revealAdvancedInspectorControls(page);
        const controls = [];
        for (const [label, selector, position] of zoomReachabilitySelectors) {
            const locator = pickLocator(page, selector, position);
            await locator.scrollIntoViewIfNeeded();
            await locator.focus();
            controls.push(await locator.evaluate((node, currentLabel) => {
                const rect = node.getBoundingClientRect();
                return {
                    active: node.getRootNode().activeElement === node,
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

let staticServer = null;
let browser = null;
let report = null;
let proofError = null;
let closeVerified = false;
try {
    await buildPlugin("seqfx");
    const provenanceBefore = await captureSeqFxProofProvenance(repoRoot, { requireClean });
    staticServer = await startStaticServer();
    origin = staticServer.origin;
    browser = await chromium.launch();
    const screenshotManifest = [];
    const measurements = [];
    const inspectorDepth = [];
    const proofContract = createSeqFxVisualProofContract();

    for (const size of SEQFX_VISUAL_PROOF_SIZES) {
        const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await loadPackagedView(page);
        const emptyState = {
            effectId: 0,
            effectName: "Empty",
            inspectorView: "empty",
            kind: "contract",
            size: size.id,
        };
        measurements.push(await measureSurface(page, size.id, 0, "Empty", "empty"));
        await recordScreenshot(page, `${size.id}-empty.png`, screenshotManifest, emptyState);
        await page.locator('[data-role="seqfx-first-use-dismiss"]').click();

        await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
        for (const effect of SEQFX_VISUAL_EFFECTS) {
            await page.locator(`[data-role="seqfx-effect-type-option"][data-effect-type="${effect.id}"]`).click();
            await page.getByRole("button", { name: `Chain 1 ${effect.name} block 1`, exact: true }).waitFor();
            await revealAdvancedInspectorControls(page);
            await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => { node.scrollTop = 0; });
            measurements.push(await measureSurface(page, size.id, effect.id, effect.name, "top"));
            await recordScreenshot(page, `${size.id}-${effect.fileStem}.png`, screenshotManifest, {
                effectId: effect.id,
                effectName: effect.name,
                inspectorView: "top",
                kind: "contract",
                size: size.id,
            });

            const depth = await auditInspectorDepth(page, size.id, effect.id, effect.name);
            inspectorDepth.push(depth);
            const interiorObservations = depth.observations.filter((observation) => (
                observation.requestedScrollTop > 0
                && observation.requestedScrollTop < depth.maximumScroll
            ));
            for (const [index, observation] of interiorObservations.entries()) {
                await page.locator('[data-role="seqfx-inspector"]').evaluate((node, scrollTop) => {
                    node.scrollTop = scrollTop;
                }, observation.requestedScrollTop);
                await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
                await recordScreenshot(
                    page,
                    `${size.id}-${effect.fileStem}-stride-${index + 1}.png`,
                    screenshotManifest,
                    {
                        effectId: effect.id,
                        effectName: effect.name,
                        inspectorView: `stride-${index + 1}`,
                        kind: "inspector-stride",
                        size: size.id,
                    },
                );
            }
            await page.locator('[data-role="seqfx-inspector"]').evaluate((node, maximumScroll) => {
                node.scrollTop = maximumScroll;
            }, depth.maximumScroll);
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
            measurements.push(await measureSurface(page, size.id, effect.id, effect.name, "lower"));
            await recordScreenshot(page, `${size.id}-${effect.fileStem}-lower.png`, screenshotManifest, {
                effectId: effect.id,
                effectName: effect.name,
                inspectorView: "lower",
                kind: "contract",
                size: size.id,
            });
        }

        await page.close();
    }

    const focusPage = await browser.newPage({ viewport: { width: 1120, height: 680 } });
    await focusPage.emulateMedia({ reducedMotion: "reduce" });
    await loadPackagedView(focusPage);
    await focusPage.locator('[data-role="seqfx-first-use-dismiss"]').click();
    await focusPage.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    const focus = await auditFocus(focusPage);
    await focusPage.close();

    const zoom = [];
    for (const zoomLevel of zoomLevels) {
        zoom.push(await auditZoom(browser, zoomLevel));
    }

    const contractScreenshots = screenshotManifest.filter((entry) => entry.kind === "contract");
    const contactSheet = await createContactSheet(browser, contractScreenshots);
    const provenanceAfter = await captureSeqFxProofProvenance(repoRoot, { requireClean });

    const failures = measurements.flatMap((measurement) => (
        assertMeasurement(measurement).map((failure) => `${measurement.size}/${measurement.effect}/${measurement.inspectorView}: ${failure}`)
    ));
    failures.push(...inspectorDepth.flatMap((depth) => (
        assertInspectorDepth(depth).map((failure) => `${depth.size}/${depth.effect}/depth: ${failure}`)
    )));
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
    failures.push(...validateSeqFxVisualProofCoverage(measurements).map((failure) => `measurement contract: ${failure}`));
    failures.push(...validateSeqFxVisualProofCoverage(contractScreenshots).map((failure) => `screenshot contract: ${failure}`));
    failures.push(...validateSeqFxInspectorDepthCoverage(inspectorDepth).map((failure) => `depth contract: ${failure}`));
    failures.push(...compareSeqFxProofProvenance(provenanceBefore, provenanceAfter).map((failure) => `provenance: ${failure}`));
    report = {
        contactSheet,
        contract: {
            expectedInspectorTraversals: SEQFX_VISUAL_EFFECTS.length * SEQFX_VISUAL_PROOF_SIZES.length,
            expectedStates: proofContract.length,
        },
        productionView: {
            bundle: "build/fx/seqfx_runtime/view/index.js",
            customElement: "cosimo-seqfx-react-view",
            renderRoot: "open-shadow-root",
            server: "ephemeral-static",
        },
        generatedAt: new Date().toISOString(),
        screenshots: screenshotManifest,
        measurements,
        inspectorDepth,
        focus,
        zoom,
        provenance: {
            before: provenanceBefore,
            after: provenanceAfter,
        },
        failures,
    };
    if (failures.length > 0) {
        proofError = new Error(`SeqFX visual proof found ${failures.length} failures:\n${failures.join("\n")}`);
    }
} catch (error) {
    proofError = error;
} finally {
    try {
        await browser?.close();
    } catch (error) {
        proofError ??= error;
    }
    if (staticServer) {
        try {
            await staticServer.close();
            closeVerified = true;
        } catch (error) {
            proofError ??= error;
        }
    }
}

if (report) {
    report.serverLifecycle = {
        closeVerified,
        fixedPortUsed: false,
        ownedByProof: Boolean(staticServer),
    };
    const serializedReport = `${JSON.stringify(report, null, 2)}\n`;
    if (serializedReport.includes(repoRoot)) {
        throw new Error("SeqFX visual proof manifest leaked the absolute repository root.");
    }
    await writeFile(path.join(outputDirectory, "manifest.json"), serializedReport);
}

if (proofError) throw proofError;

process.stdout.write(
    `SeqFX visual proof passed: ${report.screenshots.length} screenshots, ${report.measurements.length} measured states, ${report.inspectorDepth.length} full-depth inspector traversals.\n`,
);
