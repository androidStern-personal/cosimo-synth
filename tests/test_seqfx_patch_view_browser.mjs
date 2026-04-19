import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { chromium } from "playwright";

const DEV_SERVER_ORIGIN = "http://127.0.0.1:5175";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEQFX_STEP_COUNT = 32;
const SEQFX_STATE_KEY = "seqfx.v1";
const SEQFX_SNAPSHOT_BANK_STATE_KEY = "cosimo.effectSnapshotBank.seqfx.v1";
const SEQFX_NORMAL_GAP_PX = 5;
const SEQFX_BEAT_GAP_PX = 9;
const SEQFX_MIN_CELL_SIZE_PX = 22;
const SEQFX_LANE_NAMES = ["Filter", "Crusher", "Tape Stop", "Stutter"];
const TAPE_GRAPH_VIEWBOX_WIDTH = 260;
const TAPE_GRAPH_VIEWBOX_HEIGHT = 150;
const TAPE_GRAPH_LEFT = 28;
const TAPE_GRAPH_TOP = 12;
const TAPE_GRAPH_PLOT_WIDTH = 222;
const TAPE_GRAPH_PLOT_HEIGHT = 114;

let serverProcess;
let browser;

async function waitForServer() {
    const startedAt = Date.now();
    let lastError = null;

    while (Date.now() - startedAt < 20_000) {
        try {
            const response = await fetch(`${DEV_SERVER_ORIGIN}/__fx-dev-status`);
            const status = response.ok ? await response.json() : undefined;
            const seqfxPlugin = status?.plugins?.find?.((plugin) => plugin.name === "seqfx");

            if (
                status?.kind === "fx-vite-dev-server"
                && path.resolve(status.repoRoot) === repoRoot
                && seqfxPlugin?.sourceModule === "/fx/seqfx/view/source.tsx"
            ) {
                return;
            }
        } catch (error) {
            lastError = error;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`SeqFX Vite dev server did not start: ${lastError?.message ?? "timeout"}`);
}

async function getHarnessSnapshot(page) {
    return page.evaluate(() => window.__SEQFX_HARNESS__?.getSnapshot());
}

function parseSeqFxStoredState(value) {
    assert.equal(typeof value, "string", "SeqFX stored state should be serialized JSON");
    return JSON.parse(value);
}

function patternUploads(snapshot) {
    return snapshot.events.filter((entry) => entry.endpointID === "patternUpload");
}

function snapshotSlotLocator(page, slotID) {
    return page.locator("cosimo-effect-header").evaluateHandle((header, nextSlotID) => (
        header.shadowRoot
            ?.querySelector("cosimo-snapshot-bar")
            ?.shadowRoot
            ?.querySelector(`.snapshot-slot[data-slot="${nextSlotID}"]`)
    ), slotID);
}

async function clickSnapshotSlot(page, slotID) {
    const handle = await snapshotSlotLocator(page, slotID);
    const element = handle.asElement();
    assert.ok(element, `expected snapshot slot ${slotID} to exist`);
    await element.click();
}

function gapAfterStep(step, cellsPerBeat) {
    if (step >= SEQFX_STEP_COUNT - 1) {
        return 0;
    }

    return (step + 1) % cellsPerBeat === 0 ? SEQFX_BEAT_GAP_PX : SEQFX_NORMAL_GAP_PX;
}

function expectedGridGeometry(trackWidth, cellsPerBeat) {
    const totalGapWidth = Array.from({ length: SEQFX_STEP_COUNT - 1 }, (_unused, step) => (
        gapAfterStep(step, cellsPerBeat)
    )).reduce((sum, gap) => sum + gap, 0);
    const cellSize = Math.max(
        SEQFX_MIN_CELL_SIZE_PX,
        Number(((trackWidth - totalGapWidth) / SEQFX_STEP_COUNT).toFixed(4)),
    );
    const lefts = [];
    let cursor = 0;

    for (let step = 0; step < SEQFX_STEP_COUNT; step += 1) {
        lefts.push(cursor);
        cursor += cellSize + gapAfterStep(step, cellsPerBeat);
    }

    return {
        cellSize,
        lefts,
        trackWidth: (cellSize * SEQFX_STEP_COUNT) + totalGapWidth,
    };
}

async function boundingBoxForCell(page, lane, step) {
    const box = await page.locator(`[data-role="seqfx-cell"][data-lane="${lane}"][data-step="${step}"]`).boundingBox();
    assert.ok(box, `expected lane ${lane} step ${step} to have a bounding box`);
    return box;
}

async function resizeBlockToStep(page, lane, startStep, endStep) {
    const laneName = SEQFX_LANE_NAMES[lane];
    const resizeHandle = page.locator(`[data-role="seqfx-block-resize"][data-lane="${lane}"][data-start="${startStep - 1}"]`);
    await resizeHandle.waitFor();
    const handleBox = await resizeHandle.boundingBox();
    const endCellBox = await page.getByRole("button", { name: `${laneName} step ${endStep}`, exact: true }).boundingBox();
    assert.ok(handleBox);
    assert.ok(endCellBox);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(endCellBox.x + endCellBox.width - 2, endCellBox.y + endCellBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("button", { name: `${laneName} block ${startStep}-${endStep}`, exact: true }).waitFor();
}

function assertClose(actual, expected, tolerance, message) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${message}: expected ${actual} to be within ${tolerance} of ${expected}`,
    );
}

function tapeGraphPoint(graphBox, normalizedTime, normalizedSpeed) {
    const svgX = TAPE_GRAPH_LEFT + (Math.min(1, Math.max(0, normalizedTime)) * TAPE_GRAPH_PLOT_WIDTH);
    const svgY = TAPE_GRAPH_TOP + ((1 - Math.min(1, Math.max(0, normalizedSpeed))) * TAPE_GRAPH_PLOT_HEIGHT);

    return {
        x: graphBox.x + ((svgX / TAPE_GRAPH_VIEWBOX_WIDTH) * graphBox.width),
        y: graphBox.y + ((svgY / TAPE_GRAPH_VIEWBOX_HEIGHT) * graphBox.height),
    };
}

async function dragLocatorTo(page, locator, point) {
    const box = await locator.boundingBox();
    assert.ok(box, "expected draggable locator to have a bounding box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.mouse.up();
}

function geometricCenterHz(startHz, endHz) {
    return Math.sqrt(Math.max(20, startHz) * Math.max(20, endHz));
}

function cutoffRangeOctaves(startHz, endHz) {
    return Math.abs(Math.log2(Math.max(20, endHz) / Math.max(20, startHz)));
}

async function pressMetaShortcut(page, key) {
    await page.keyboard.down("Meta");
    await page.keyboard.press(key);
    await page.keyboard.up("Meta");
}

async function dispatchClipboardEvent(page, selector, type) {
    return page.evaluate(({ targetSelector, eventType }) => {
        const target = document.querySelector(targetSelector);
        if (!target) {
            throw new Error(`Missing clipboard event target: ${targetSelector}`);
        }

        const event = new ClipboardEvent(eventType, {
            bubbles: true,
            cancelable: true,
            composed: true,
            clipboardData: new DataTransfer(),
        });
        const dispatchResult = target.dispatchEvent(event);
        return {
            defaultPrevented: event.defaultPrevented,
            dispatchResult,
        };
    }, { targetSelector: selector, eventType: type });
}

async function setRangeInputValue(locator, value) {
    await locator.evaluate((node, nextValue) => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(node, String(nextValue));
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
}

async function waitForGridGeometry(page, cellsPerBeat, step, message) {
    const deadline = Date.now() + 2_000;
    let last;

    while (Date.now() < deadline) {
        const trackBox = await page.locator('.seqfx-lane-track').first().boundingBox();
        assert.ok(trackBox);
        const expected = expectedGridGeometry(trackBox.width, cellsPerBeat);
        const cellBox = await boundingBoxForCell(page, 0, step);
        const actualLeft = cellBox.x - trackBox.x;
        last = { actualLeft, cellBox, expected, trackBox };

        if (
            Math.abs(actualLeft - expected.lefts[step]) <= 1
            && Math.abs(cellBox.width - expected.cellSize) <= 1
            && Math.abs(cellBox.height - expected.cellSize) <= 1
        ) {
            return last;
        }

        await page.waitForTimeout(50);
    }

    assertClose(last.actualLeft, last.expected.lefts[step], 1, message);
    assertClose(last.cellBox.width, last.expected.cellSize, 1, `${message} width`);
    assertClose(last.cellBox.height, last.expected.cellSize, 1, `${message} height`);
    return last;
}

function parsePng(buffer) {
    const signature = buffer.subarray(0, 8);
    assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10]);

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatChunks = [];

    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        offset += 12 + length;

        if (type === "IHDR") {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === "IDAT") {
            idatChunks.push(data);
        } else if (type === "IEND") {
            break;
        }
    }

    assert.equal(bitDepth, 8);
    assert.equal(colorType === 6 || colorType === 2, true);

    const inflated = inflateSync(Buffer.concat(idatChunks));
    const bytesPerPixel = colorType === 6 ? 4 : 3;
    const stride = width * bytesPerPixel;
    const pixels = Buffer.alloc(width * height * 4);
    let sourceOffset = 0;

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[sourceOffset];
        sourceOffset += 1;
        const rowStart = y * stride;
        const previousRowStart = (y - 1) * stride;
        const targetRowStart = y * width * 4;
        const previousTargetRowStart = (y - 1) * width * 4;

        for (let x = 0; x < stride; x += 1) {
            const raw = inflated[sourceOffset + x];
            const targetX = Math.floor(x / bytesPerPixel) * 4 + (x % bytesPerPixel);
            const left = x >= bytesPerPixel ? pixels[targetRowStart + targetX - 4] : 0;
            const up = y > 0 ? pixels[previousTargetRowStart + targetX] : 0;
            const upLeft = y > 0 && x >= bytesPerPixel ? pixels[previousTargetRowStart + targetX - 4] : 0;
            let value;

            if (filter === 0) {
                value = raw;
            } else if (filter === 1) {
                value = raw + left;
            } else if (filter === 2) {
                value = raw + up;
            } else if (filter === 3) {
                value = raw + Math.floor((left + up) / 2);
            } else if (filter === 4) {
                const p = left + up - upLeft;
                const pa = Math.abs(p - left);
                const pb = Math.abs(p - up);
                const pc = Math.abs(p - upLeft);
                const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
                value = raw + predictor;
            } else {
                throw new Error(`Unsupported PNG filter ${filter}`);
            }

            pixels[targetRowStart + targetX] = value & 255;

            if (bytesPerPixel === 3 && x % bytesPerPixel === 2) {
                pixels[targetRowStart + targetX + 1] = 255;
            }
        }

        sourceOffset += stride;
    }

    return { width, height, pixels };
}

function pixelAt(png, x, y) {
    const clampedX = Math.min(png.width - 1, Math.max(0, Math.round(x)));
    const clampedY = Math.min(png.height - 1, Math.max(0, Math.round(y)));
    const offset = ((clampedY * png.width) + clampedX) * 4;
    return [
        png.pixels[offset],
        png.pixels[offset + 1],
        png.pixels[offset + 2],
        png.pixels[offset + 3],
    ];
}

function colorDistance(left, right) {
    return Math.abs(left[0] - right[0])
        + Math.abs(left[1] - right[1])
        + Math.abs(left[2] - right[2]);
}

async function canUseExistingServer() {
    try {
        const response = await fetch(`${DEV_SERVER_ORIGIN}/__fx-dev-status`);
        if (!response.ok) {
            return false;
        }

        const status = await response.json();
        const seqfxPlugin = status?.plugins?.find?.((plugin) => plugin.name === "seqfx");
        return status?.kind === "fx-vite-dev-server"
            && path.resolve(status.repoRoot) === repoRoot
            && seqfxPlugin?.sourceModule === "/fx/seqfx/view/source.tsx";
    } catch {
        return false;
    }
}

async function openSameOriginBlankPage(page) {
    await page.goto(`${DEV_SERVER_ORIGIN}/__fx-dev-status`);
    await page.setContent('<!doctype html><html><head><title>SeqFX Test</title></head><body></body></html>');
}

async function loadSeqFxHarness(page) {
    await openSameOriginBlankPage(page);
    await page.setContent(`
        <!doctype html>
        <html>
            <head>
                <title>SeqFX Harness</title>
                <style>
                    html,
                    body,
                    #root {
                        width: 100%;
                        height: 100%;
                        margin: 0;
                    }
                </style>
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
}

async function createLoaderHarness(page) {
    await openSameOriginBlankPage(page);
    await page.evaluate(async () => {
        document.body.innerHTML = '<div id="root" style="width:1120px;height:680px"></div>';

        class SeqFxLoaderHarnessPatchConnection {
            constructor() {
                this.manifest = {
                    view: {
                        devModule: "/fx/seqfx/view/source.tsx",
                    },
                };
                this.storedState = {};
                this.events = [];
                this.parameters = {
                    patternSelect: 0,
                    rate: 1,
                };
                this.status = {
                    details: {
                        inputs: [],
                    },
                };
                this.statusListeners = new Set();
                this.storedStateListeners = new Set();
                this.parameterListeners = new Map();
                this.endpointListeners = new Map();
            }

            addStatusListener(listener) {
                this.statusListeners.add(listener);
            }

            removeStatusListener(listener) {
                this.statusListeners.delete(listener);
            }

            requestStatusUpdate() {
                for (const listener of this.statusListeners) {
                    listener(this.status);
                }
            }

            addStoredStateValueListener(listener) {
                this.storedStateListeners.add(listener);
            }

            removeStoredStateValueListener(listener) {
                this.storedStateListeners.delete(listener);
            }

            requestFullStoredState(callback) {
                callback({ ...this.storedState });
            }

            requestStoredStateValue(key) {
                for (const listener of this.storedStateListeners) {
                    listener({ key, value: this.storedState[key] });
                }
            }

            sendStoredStateValue(key, value) {
                this.storedState[key] = value;
                for (const listener of this.storedStateListeners) {
                    listener({ key, value });
                }
            }

            addParameterListener(endpointID, listener) {
                const listeners = this.parameterListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                this.parameterListeners.set(endpointID, listeners);
            }

            removeParameterListener(endpointID, listener) {
                this.parameterListeners.get(endpointID)?.delete(listener);
            }

            requestParameterValue(endpointID) {
                for (const listener of this.parameterListeners.get(endpointID) ?? []) {
                    listener(this.parameters[endpointID] ?? 0);
                }
            }

            sendEventOrValue(endpointID, value) {
                this.events.push({ endpointID, value });
                this.parameters[endpointID] = value;
                for (const listener of this.parameterListeners.get(endpointID) ?? []) {
                    listener(value);
                }
            }

            addEndpointListener(endpointID, listener) {
                const listeners = this.endpointListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                this.endpointListeners.set(endpointID, listeners);
            }

            removeEndpointListener(endpointID, listener) {
                this.endpointListeners.get(endpointID)?.delete(listener);
            }

            getSnapshot() {
                return {
                    events: [...this.events],
                    storedState: { ...this.storedState },
                    parameters: { ...this.parameters },
                };
            }
        }

        const patchConnection = new SeqFxLoaderHarnessPatchConnection();
        const loaderModule = await import(`/fx/seqfx/view/index.js?seqfx-loader-test=${Date.now()}`);
        const view = await loaderModule.default(patchConnection);
        document.getElementById("root").appendChild(view);
        window.__SEQFX_LOADER_HARNESS__ = {
            patchConnection,
            getSnapshot: () => patchConnection.getSnapshot(),
        };
    });
}

before(async () => {
    if (!await canUseExistingServer()) {
        serverProcess = spawn("npm", ["run", "fx:dev"], {
            cwd: new URL("..", import.meta.url).pathname,
            stdio: ["ignore", "pipe", "pipe"],
        });
    }

    await waitForServer();
    browser = await chromium.launch();
});

test("seqfx_shared_effect_loader_imports_react_dev_module_from_manifest", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    const pageErrors = [];
    page.on("pageerror", (error) => {
        pageErrors.push(error.message);
    });

    await createLoaderHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const snapshot = await page.evaluate(() => ({
        customElementDefined: Boolean(window.customElements.get("cosimo-seqfx-react-view")),
        refreshPreambleInstalled: Boolean(window.__vite_plugin_react_preamble_installed__),
        reactGrab: (() => {
            const reactGrab = window.__REACT_GRAB__;

            return reactGrab && typeof reactGrab === "object"
                ? {
                    hasRegisterPlugin: typeof reactGrab.registerPlugin === "function",
                    hasGetPlugins: typeof reactGrab.getPlugins === "function",
                    plugins: typeof reactGrab.getPlugins === "function" ? reactGrab.getPlugins() : null,
                }
                : null;
        })(),
        viewTagName: document.querySelector("cosimo-seqfx-react-view")?.tagName.toLowerCase(),
        styleText: document.getElementById("cosimo-seqfx-react-view-styles")?.textContent ?? "",
        uploads: window.__SEQFX_LOADER_HARNESS__?.getSnapshot().events
            .filter((entry) => entry.endpointID === "patternUpload"),
    }));

    assert.equal(snapshot.customElementDefined, true);
    assert.equal(snapshot.refreshPreambleInstalled, true);
    assert.equal(snapshot.reactGrab?.hasRegisterPlugin, true);
    assert.equal(snapshot.reactGrab?.hasGetPlugins, true);
    assert.equal(Array.isArray(snapshot.reactGrab?.plugins), true);
    assert.equal(snapshot.reactGrab.plugins.includes("mcp"), true);
    assert.equal(snapshot.viewTagName, "cosimo-seqfx-react-view");
    assert.equal(snapshot.styleText.includes("@font-face"), false);
    assert.equal(snapshot.styleText.includes('font-family: "Avenir Next", "Helvetica Neue", Arial, sans-serif'), true);
    assert.equal(snapshot.styleText.includes("Geist"), false);
    assert.equal(snapshot.uploads.length >= 1, true);
    assert.equal(snapshot.uploads.at(-1).value.patternIndex, 0);
    assert.deepEqual(pageErrors, []);

    await page.close();
});

test("seqfx_vite_dev_server_serves_a_stable_browser_harness_page", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    const response = await page.goto(`${DEV_SERVER_ORIGIN}/fx/seqfx/view/harness.html`);

    assert.equal(response?.status(), 200);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => document.fonts?.ready);
    const renderedFont = await page.locator('[data-role="seqfx-root"]').evaluate((node) => getComputedStyle(node).fontFamily);
    const measuredText = await page.evaluate(() => {
        const samples = [
            { label: "title", text: "SeqFX", size: 32, weight: 700, letterSpacing: 0, lineHeight: 32 },
            { label: "inspectorTitle", text: "Select a cell", size: 18, weight: 700, letterSpacing: 0, lineHeight: null },
            { label: "filterReadout", text: "1.00 kHz", size: 17, weight: 800, letterSpacing: 0, lineHeight: null },
        ];

        return samples.map((sample) => {
            const node = document.createElement("span");
            node.textContent = sample.text;
            Object.assign(node.style, {
                position: "absolute",
                left: "-10000px",
                top: "-10000px",
                whiteSpace: "pre",
                fontFamily: '"Avenir Next", "Helvetica Neue", Arial, sans-serif',
                fontSize: `${sample.size}px`,
                fontWeight: String(sample.weight),
                letterSpacing: `${sample.letterSpacing}px`,
                lineHeight: sample.lineHeight ? `${sample.lineHeight}px` : "normal",
            });
            document.body.appendChild(node);
            const rect = node.getBoundingClientRect();
            node.remove();
            return {
                label: sample.label,
                width: rect.width,
                height: rect.height,
            };
        });
    });

    assert.equal(renderedFont, '"Avenir Next", "Helvetica Neue", Arial, sans-serif');
    assertClose(measuredText.find((entry) => entry.label === "title").width, 99.9375, 0.2, "Avenir Next title width");
    assertClose(measuredText.find((entry) => entry.label === "title").height, 32, 0.2, "Avenir Next title height");
    assertClose(measuredText.find((entry) => entry.label === "inspectorTitle").width, 102.9063, 0.2, "Avenir Next inspector title width");
    assertClose(measuredText.find((entry) => entry.label === "filterReadout").width, 80.5781, 0.2, "Avenir Next filter readout width");
    await page.getByRole("button", { name: "Tape Stop step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-tape-graph"]').waitFor();

    await page.close();
});

test("seqfx_rate_one_grid_uses_beat_gutters_and_per_cell_bar_fill", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const trackBox = await page.locator('.seqfx-lane-track').first().boundingBox();
    assert.ok(trackBox);
    const expected = expectedGridGeometry(trackBox.width, 4);

    for (const step of [0, 1, 3, 4, 16, 31]) {
        const box = await boundingBoxForCell(page, 0, step);
        assertClose(box.x - trackBox.x, expected.lefts[step], 1, `step ${step + 1} x position`);
        assertClose(box.width, expected.cellSize, 1, `step ${step + 1} width`);
        assertClose(box.height, expected.cellSize, 1, `step ${step + 1} height`);
    }

    const step2 = await boundingBoxForCell(page, 0, 1);
    const step3 = await boundingBoxForCell(page, 0, 2);
    const step4 = await boundingBoxForCell(page, 0, 3);
    const step5 = await boundingBoxForCell(page, 0, 4);
    assertClose(step3.x - (step2.x + step2.width), SEQFX_NORMAL_GAP_PX, 1, "ordinary within-beat gutter");
    assertClose(step5.x - (step4.x + step4.width), SEQFX_BEAT_GAP_PX, 1, "beat-boundary gutter");

    assert.equal(await page.locator('[data-role="seqfx-cell"][data-lane="0"][data-step="15"]').evaluate((node) => node.classList.contains("is-alt-bar")), false);
    assert.equal(await page.locator('[data-role="seqfx-cell"][data-lane="0"][data-step="16"]').evaluate((node) => node.classList.contains("is-alt-bar")), true);

    const pseudoDecorations = await page.evaluate(() => (
        Array.from(document.querySelectorAll(".seqfx-lane-track, .seqfx-step-track")).map((node) => ({
            before: getComputedStyle(node, "::before").content,
            after: getComputedStyle(node, "::after").content,
        }))
    ));
    assert.equal(
        pseudoDecorations.every((entry) => (
            (entry.before === "none" || entry.before === "\"\"")
            && (entry.after === "none" || entry.after === "\"\"")
        )),
        true,
    );

    const screenshot = parsePng(await page.screenshot({ type: "png" }));
    const sampleY = trackBox.y + (expected.cellSize / 2);
    const evenCell = pixelAt(screenshot, trackBox.x + expected.lefts[0] + (expected.cellSize / 2), sampleY);
    const oddCell = pixelAt(screenshot, trackBox.x + expected.lefts[16] + (expected.cellSize / 2), sampleY);
    const barBoundaryGutter = pixelAt(
        screenshot,
        trackBox.x + expected.lefts[15] + expected.cellSize + (SEQFX_BEAT_GAP_PX / 2),
        sampleY,
    );

    assert.ok(colorDistance(evenCell, oddCell) >= 4, "alternate-bar cell fill should differ from ordinary cell fill");
    assert.ok(colorDistance(barBoundaryGutter, oddCell) > colorDistance(evenCell, oddCell), "bar-boundary gutter should not use alternate-bar fill");

    await page.close();
});

test("seqfx_rate_parameter_reflows_grid_without_window_resize", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.evaluate(() => window.__SEQFX_HARNESS__?.emitParameter("rate", 0));
    await page.waitForFunction(() => document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="8"]')?.classList.contains("is-alt-bar"));
    await waitForGridGeometry(page, 2, 2, "rate 0 reflowed third cell");

    let trackBox = await page.locator('.seqfx-lane-track').first().boundingBox();
    assert.ok(trackBox);
    let expected = expectedGridGeometry(trackBox.width, 2);
    let step2 = await boundingBoxForCell(page, 0, 1);
    let step3 = await boundingBoxForCell(page, 0, 2);
    assertClose(step3.x - (step2.x + step2.width), SEQFX_BEAT_GAP_PX, 1, "rate 0 beat gutter after two cells");
    assertClose(step3.x - trackBox.x, expected.lefts[2], 1, "rate 0 reflowed third cell");

    await page.evaluate(() => window.__SEQFX_HARNESS__?.emitParameter("rate", 2));
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-cell"].is-alt-bar')).length === 0
    ));
    await waitForGridGeometry(page, 8, 8, "rate 2 reflowed ninth cell");

    trackBox = await page.locator('.seqfx-lane-track').first().boundingBox();
    assert.ok(trackBox);
    expected = expectedGridGeometry(trackBox.width, 8);
    const step8 = await boundingBoxForCell(page, 0, 7);
    const step9 = await boundingBoxForCell(page, 0, 8);
    assertClose(step9.x - (step8.x + step8.width), SEQFX_BEAT_GAP_PX, 1, "rate 2 beat gutter after eight cells");
    assertClose(step9.x - trackBox.x, expected.lefts[8], 1, "rate 2 reflowed ninth cell");

    await page.close();
});

test("seqfx_rate_change_cancels_an_active_drag_instead_of_remapping_the_pointer", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Filter step 1", exact: true }).click();
    const block = page.getByRole("button", { name: "Filter block 1", exact: true });
    await block.waitFor();
    const blockBox = await block.boundingBox();
    const targetBox = await page.getByRole("button", { name: "Filter step 8", exact: true }).boundingBox();
    assert.ok(blockBox);
    assert.ok(targetBox);

    await page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);
    await page.mouse.down();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.emitParameter("rate", 0));
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    const lastUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(lastUpload.activeSteps[0].slice(0, 8), [true, false, false, false, false, false, false, false]);
    await page.getByRole("button", { name: "Filter block 1", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Filter block 8", exact: true }).waitFor({ timeout: 300 }),
    );

    await page.close();
});

after(async () => {
    await browser?.close();

    if (serverProcess) {
        serverProcess.kill("SIGTERM");
    }
});

test("seqfx_grid_cell_and_inspector_edits_send_complete_pattern_uploads", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Filter step 1", exact: true }).click();
    await assert.rejects(
        page.locator('[data-role="seqfx-inspector"]').getByText("Select a cell").waitFor({ timeout: 400 }),
    );
    await assert.doesNotReject(
        page.locator('[data-role="seqfx-inspector"]').getByText("Filter step 1").waitFor({ timeout: 400 }),
    );

    const filterEditor = page.locator('[data-role="filter-range-editor"]');
    await filterEditor.waitFor();
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="1"]').count(), 0);
    assert.equal(await filterEditor.locator('[data-role="filter-range-readout"]').count(), 0);
    assert.equal(await filterEditor.locator(".filter-range-editor__chip").count(), 4);
    assert.equal(await filterEditor.locator('[data-role="filter-range-chip-start"]').count(), 1);
    assert.equal(await filterEditor.locator('[data-role="filter-range-chip-end"]').count(), 1);
    assert.equal(await filterEditor.locator('[data-role="filter-range-chip-span"]').getAttribute("data-direction"), "down");

    const sidebarFit = await filterEditor.evaluate((node) => {
        const inspector = node.closest('[data-role="seqfx-inspector"]');
        const style = getComputedStyle(node);

        return {
            backgroundColor: style.backgroundColor,
            editorWidth: node.getBoundingClientRect().width,
            editorScrollWidth: node.scrollWidth,
            inspectorWidth: inspector?.getBoundingClientRect().width ?? 0,
        };
    });
    assert.equal(sidebarFit.backgroundColor, "rgb(228, 222, 211)");
    assert.ok(
        sidebarFit.editorWidth <= sidebarFit.inspectorWidth,
        `filter editor width ${sidebarFit.editorWidth} should fit inspector width ${sidebarFit.inspectorWidth}`,
    );
    assert.ok(
        sidebarFit.editorScrollWidth <= Math.ceil(sidebarFit.editorWidth) + 1,
        `filter editor scroll width ${sidebarFit.editorScrollWidth} should not overflow rendered width ${sidebarFit.editorWidth}`,
    );

    await page.locator('[data-role="filter-range-mode-cycle-button"]').click();

    let snapshot = await getHarnessSnapshot(page);
    let uploads = patternUploads(snapshot);
    assert.ok(uploads.length >= 2);
    assert.equal(uploads.at(-1).value.activeSteps[0][0], true);
    assert.equal(uploads.at(-1).value.params[0][0][0], 1);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.locator('[data-role="filter-range-start-hit-target"]').focus();
    await page.keyboard.press("End");

    snapshot = await getHarnessSnapshot(page);
    uploads = patternUploads(snapshot);
    const uploadedStepParams = uploads.at(-1).value.params[0][0];
    assert.equal(uploads.at(-1).value.activeSteps[0][0], true);
    assertClose(uploadedStepParams[1], 20000, 0.001, "start handle edit should update the start cutoff");
    assertClose(uploadedStepParams[2], 500, 0.001, "start handle edit should not rewrite the end cutoff");
    assert.ok(
        uploadedStepParams[1] > uploadedStepParams[2],
        `filter range direction should remain start-to-end, got ${uploadedStepParams[1]} -> ${uploadedStepParams[2]}`,
    );

    await page.close();
});

test("seqfx_shared_snapshot_header_captures_updates_and_recalls_grid_state", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.locator("cosimo-effect-header").waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await clickSnapshotSlot(page, "A");
    await page.getByRole("button", { name: "Filter step 1", exact: true }).click();
    await page.getByRole("button", { name: "Filter block 1", exact: true }).waitFor();

    let snapshot = await getHarnessSnapshot(page);
    let bank = snapshot.storedState[SEQFX_SNAPSHOT_BANK_STATE_KEY];
    assert.equal(bank.activeSlotID, "A");
    assert.equal(
        parseSeqFxStoredState(bank.slots.A.storedState[SEQFX_STATE_KEY]).patterns[0].lanes[0].steps[0].active,
        true,
    );

    await clickSnapshotSlot(page, "B");
    await page.getByRole("button", { name: "Filter block 1", exact: true }).dblclick();
    await page.getByRole("button", { name: "Filter step 5", exact: true }).click();
    await page.getByRole("button", { name: "Filter block 5", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Filter block 1", exact: true }).waitFor({ timeout: 300 }),
    );

    snapshot = await getHarnessSnapshot(page);
    bank = snapshot.storedState[SEQFX_SNAPSHOT_BANK_STATE_KEY];
    const slotBState = parseSeqFxStoredState(bank.slots.B.storedState[SEQFX_STATE_KEY]);
    assert.equal(bank.activeSlotID, "B");
    assert.equal(slotBState.patterns[0].lanes[0].steps[0].active, false);
    assert.equal(slotBState.patterns[0].lanes[0].steps[4].active, true);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await clickSnapshotSlot(page, "A");
    await page.getByRole("button", { name: "Filter block 1", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Filter block 5", exact: true }).waitFor({ timeout: 300 }),
    );

    snapshot = await getHarnessSnapshot(page);
    const recallUpload = patternUploads(snapshot).at(-1).value;
    assert.equal(recallUpload.authoritative, true);
    assert.equal(recallUpload.activeSteps[0][0], true);
    assert.equal(recallUpload.activeSteps[0][4], false);
    assert.equal(snapshot.storedState[SEQFX_SNAPSHOT_BANK_STATE_KEY].activeSlotID, "A");

    await page.close();
});

test("seqfx_shift_selection_disables_trigger_latched_stutter_slices_edit", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Stutter step 3", exact: true }).click();
    await page.getByRole("button", { name: "Stutter step 4", exact: true }).click({ modifiers: ["Shift"] });

    await page.locator('[data-role="seqfx-inspector"]').getByText("Stutter steps 3-4").waitFor();
    await page.locator('[data-role="seqfx-inspector"]').getByText("Slices").waitFor();
    await assert.doesNotReject(
        page.locator('[data-role="seqfx-param"][data-param="0"]').waitFor({ state: "attached" }),
    );
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="0"]').isDisabled(), true);

    await page.close();
});

test("seqfx_pattern_buttons_send_pattern_select_and_authoritative_upload", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.locator('[data-role="seqfx-pattern"][data-pattern="4"]').click();

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(snapshot.events.some((entry) => entry.endpointID === "patternSelect" && entry.value === 4), true);
    assert.equal(patternUploads(snapshot).at(-1).value.patternIndex, 4);
    assert.equal(patternUploads(snapshot).at(-1).value.authoritative, true);

    await page.close();
});

test("seqfx_right_edge_drag_resizes_a_block_without_retriggering_continuation_steps", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const first = page.getByRole("button", { name: "Tape Stop step 1", exact: true });
    const fifth = page.getByRole("button", { name: "Tape Stop step 5", exact: true });
    await first.click();

    const resizeHandle = page.locator('[data-role="seqfx-block-resize"][data-lane="2"][data-start="0"]');
    await resizeHandle.waitFor();
    const handleBox = await resizeHandle.boundingBox();
    const fifthBox = await fifth.boundingBox();

    assert.ok(handleBox);
    assert.ok(fifthBox);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(fifthBox.x + fifthBox.width - 2, fifthBox.y + fifthBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    const lastUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(lastUpload.activeSteps[2].slice(0, 5), [true, true, true, true, true]);
    assert.deepEqual(lastUpload.triggerSteps[2].slice(0, 5), [true, false, false, false, false]);
    await page.locator('[data-role="seqfx-tape-graph"]').waitFor();
    assert.equal(await page.locator('[data-role="seqfx-tape-stop-point"]').isDisabled(), false);

    const resizedBlockBox = await page.getByRole("button", { name: "Tape Stop block 1-5", exact: true }).boundingBox();
    const firstCellBox = await first.boundingBox();
    const trackBox = await page.locator('[data-role="seqfx-cell"][data-lane="2"][data-step="0"]').locator("xpath=..").boundingBox();
    assert.ok(resizedBlockBox);
    assert.ok(firstCellBox);
    assert.ok(trackBox);
    const expected = expectedGridGeometry(trackBox.width, 4);
    assert.ok(
        Math.abs(resizedBlockBox.height - firstCellBox.height) <= 1,
        `expected resized block height ${resizedBlockBox.height} to match cell height ${firstCellBox.height}`,
    );
    assert.ok(
        Math.abs(resizedBlockBox.width - ((expected.cellSize * 5) + (SEQFX_NORMAL_GAP_PX * 3) + SEQFX_BEAT_GAP_PX)) <= 1,
        `expected resized block width ${resizedBlockBox.width} to span 5 cells across a beat gutter`,
    );

    await page.locator('[data-role="seqfx-delete-block"]').click();
    const deleteUpload = patternUploads(await getHarnessSnapshot(page)).at(-1).value;
    assert.deepEqual(deleteUpload.activeSteps[2].slice(0, 5), [false, false, false, false, false]);

    await page.close();
});

test("seqfx_tape_stop_inspector_renders_graph_handles_and_writes_curve_parameters", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Tape Stop step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-tape-graph"]').waitFor();

    const inspector = page.locator('[data-role="seqfx-inspector"]');
    await inspector.getByText("Mode").waitFor();
    assert.equal(await inspector.locator(".seqfx-tape-control").filter({ hasText: /^Start Length/ }).count(), 1);
    assert.equal(await inspector.locator(".seqfx-tape-control").filter({ hasText: /^Start Curve/ }).count(), 1);
    assert.equal(await inspector.locator(".seqfx-tape-control").filter({ hasText: /^Catchup Length/ }).count(), 1);
    assert.equal(await inspector.locator(".seqfx-tape-control").filter({ hasText: /^Catchup Curve/ }).count(), 1);
    await page.locator('[data-role="seqfx-tape-start-length-handle"]').waitFor();
    await page.locator('[data-role="seqfx-tape-start-curve-handle"]').waitFor();
    await page.locator('[data-role="seqfx-tape-catchup-length-handle"]').waitFor();
    assert.equal(await inspector.getByText("Stop Point").count(), 0);
    assert.equal(await inspector.getByText("Catch-up").count(), 0);
    assert.equal(await inspector.getByText("Duration", { exact: true }).count(), 0);
    assert.equal(await inspector.getByText("End", { exact: true }).count(), 0);

    const initialGraphBox = await page.locator('[data-role="seqfx-tape-graph"]').boundingBox();
    assert.ok(initialGraphBox);
    await dragLocatorTo(
        page,
        page.locator('[data-role="seqfx-tape-start-length-handle"]'),
        tapeGraphPoint(initialGraphBox, 0.5, 0.02),
    );
    await page.locator('[data-role="seqfx-tape-catchup-curve-handle"]').waitFor();

    await dragLocatorTo(
        page,
        page.locator('[data-role="seqfx-tape-catchup-length-handle"]'),
        tapeGraphPoint(initialGraphBox, 0.65, 0.02),
    );
    await dragLocatorTo(
        page,
        page.locator('[data-role="seqfx-tape-start-curve-handle"]'),
        tapeGraphPoint(initialGraphBox, 0.25, 0.25),
    );
    await dragLocatorTo(
        page,
        page.locator('[data-role="seqfx-tape-catchup-curve-handle"]'),
        tapeGraphPoint(initialGraphBox, 0.825, 0.25),
    );
    await page.locator('[data-role="seqfx-tape-mode"]').selectOption("1");

    const snapshot = await getHarnessSnapshot(page);
    const lastUpload = patternUploads(snapshot).at(-1).value;
    assertClose(lastUpload.params[2][0][0], 0.5, 0.03, "start length handle should write a 50% first segment");
    assertClose(lastUpload.params[2][0][1], 2, 0.25, "start curve handle should bend the first segment");
    assertClose(lastUpload.params[2][0][2], 2, 0.25, "catchup curve handle should bend the return segment");
    assertClose(lastUpload.params[2][0][3], 35, 2, "catchup length handle should write the reserved end percentage");
    assert.equal(lastUpload.params[2][0][4], 1);

    await page.close();
});

test("seqfx_single_cell_blocks_keep_the_same_square_geometry_as_grid_cells", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Crusher step 1", exact: true }).click();
    const blockBox = await page.getByRole("button", { name: "Crusher block 1", exact: true }).boundingBox();
    const cellBox = await page.getByRole("button", { name: "Crusher step 2", exact: true }).boundingBox();
    assert.ok(blockBox);
    assert.ok(cellBox);

    assert.ok(
        Math.abs(blockBox.width - cellBox.width) <= 1,
        `expected block width ${blockBox.width} to match cell width ${cellBox.width}`,
    );
    assert.ok(
        Math.abs(blockBox.height - cellBox.height) <= 1,
        `expected block height ${blockBox.height} to match cell height ${cellBox.height}`,
    );

    await page.close();
});

test("seqfx_blocks_use_a_single_clean_surface_with_hidden_resize_chrome", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Crusher step 1", exact: true }).click();
    const block = page.getByRole("button", { name: "Crusher block 1", exact: true });
    const fill = block.locator(".seqfx-block-fill");
    const resizeHandle = page.locator('[data-role="seqfx-block-resize"][data-lane="1"][data-start="0"]');
    await block.waitFor();
    await page.mouse.move(10, 10);
    await page.waitForFunction(() => (
        getComputedStyle(
            document.querySelector('[data-role="seqfx-block-resize"][data-lane="1"][data-start="0"]'),
            "::after",
        ).opacity === "0"
    ));

    const initialStyles = await block.evaluate((node) => {
        const fillNode = node.querySelector(".seqfx-block-fill");
        const resizeNode = node.querySelector(".seqfx-block-resize");
        return {
            blockBackground: getComputedStyle(node).backgroundColor,
            blockBorderWidth: getComputedStyle(node).borderTopWidth,
            blockCursor: getComputedStyle(node).cursor,
            fillInset: {
                top: getComputedStyle(fillNode).top,
                right: getComputedStyle(fillNode).right,
                bottom: getComputedStyle(fillNode).bottom,
                left: getComputedStyle(fillNode).left,
            },
            resizeCursor: getComputedStyle(resizeNode).cursor,
            resizeGripOpacity: getComputedStyle(resizeNode, "::after").opacity,
        };
    });

    assert.equal(initialStyles.blockBackground, "rgba(0, 0, 0, 0)");
    assert.equal(initialStyles.blockBorderWidth, "0px");
    assert.equal(initialStyles.blockCursor, "grab");
    assert.deepEqual(initialStyles.fillInset, { top: "1px", right: "1px", bottom: "1px", left: "1px" });
    assert.equal(initialStyles.resizeCursor, "col-resize");
    assert.equal(initialStyles.resizeGripOpacity, "0");

    const blockBox = await block.boundingBox();
    const fillBox = await fill.boundingBox();
    assert.ok(blockBox);
    assert.ok(fillBox);
    assertClose(fillBox.width, blockBox.width - 2, 1, "block fill should be the only near-full visible surface");
    assertClose(fillBox.height, blockBox.height - 2, 1, "block fill should leave only a 1px inset");

    await block.hover();
    await page.waitForFunction(() => (
        Number(getComputedStyle(
            document.querySelector('[data-role="seqfx-block-resize"][data-lane="1"][data-start="0"]'),
            "::after",
        ).opacity) > 0.9
    ));

    const handleBox = await resizeHandle.boundingBox();
    assert.ok(handleBox);
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    assert.equal(await block.evaluate((node) => getComputedStyle(node).cursor), "col-resize");

    await page.close();
});

test("seqfx_double_click_deletes_the_clicked_block", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Stutter step 5", exact: true }).click();
    await page.getByRole("button", { name: "Stutter block 5", exact: true }).dblclick();

    const snapshot = await getHarnessSnapshot(page);
    const deleteUpload = patternUploads(snapshot).at(-1).value;
    assert.equal(deleteUpload.activeSteps[3][4], false);
    assert.equal(deleteUpload.triggerSteps[3][4], false);
    await page.locator('[data-role="seqfx-inspector"]').getByText("Select a cell").waitFor();

    await page.close();
});

test("seqfx_dragging_block_body_moves_the_block_without_resizing_it", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Filter step 2", exact: true }).click();
    const resizeHandle = page.locator('[data-role="seqfx-block-resize"][data-lane="0"][data-start="1"]');
    await resizeHandle.waitFor();
    const handleBox = await resizeHandle.boundingBox();
    const thirdCellBox = await page.getByRole("button", { name: "Filter step 4", exact: true }).boundingBox();
    assert.ok(handleBox);
    assert.ok(thirdCellBox);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(thirdCellBox.x + thirdCellBox.width - 2, thirdCellBox.y + thirdCellBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const movedBlock = page.getByRole("button", { name: "Filter block 2-4", exact: true });
    await movedBlock.waitFor();
    const movedBlockBox = await movedBlock.boundingBox();
    const targetCellBox = await page.getByRole("button", { name: "Filter step 7", exact: true }).boundingBox();
    assert.ok(movedBlockBox);
    assert.ok(targetCellBox);

    await page.mouse.move(movedBlockBox.x + movedBlockBox.width * 0.15, movedBlockBox.y + movedBlockBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetCellBox.x + targetCellBox.width * 0.15, targetCellBox.y + targetCellBox.height / 2, { steps: 10 });
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    const moveUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(moveUpload.activeSteps[0].slice(1, 4), [false, false, false]);
    assert.deepEqual(moveUpload.activeSteps[0].slice(6, 9), [true, true, true]);
    assert.deepEqual(moveUpload.triggerSteps[0].slice(6, 9), [true, false, false]);
    await page.getByRole("button", { name: "Filter block 7-9", exact: true }).waitFor();

    await page.close();
});

test("seqfx_option_drag_previews_copy_paint_and_commits_once_on_release", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Crusher step 1", exact: true }).click();
    const block = page.getByRole("button", { name: "Crusher block 1", exact: true });
    await block.waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const blockBox = await block.boundingBox();
    const thirdCellBox = await page.getByRole("button", { name: "Crusher step 3", exact: true }).boundingBox();
    const fifthCellBox = await page.getByRole("button", { name: "Crusher step 5", exact: true }).boundingBox();
    assert.ok(blockBox);
    assert.ok(thirdCellBox);
    assert.ok(fifthCellBox);

    await page.keyboard.down("Alt");
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" })));
    await page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(fifthCellBox.x + fifthCellBox.width / 2, fifthCellBox.y + fifthCellBox.height / 2, { steps: 12 });

    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"][data-preview="true"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,2,3,4"
    ));
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);

    await page.mouse.move(thirdCellBox.x + thirdCellBox.width / 2, thirdCellBox.y + thirdCellBox.height / 2, { steps: 8 });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"][data-preview="true"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,2"
    ));
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);

    await page.mouse.up();
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" })));
    await page.keyboard.up("Alt");

    const snapshot = await getHarnessSnapshot(page);
    const uploads = patternUploads(snapshot);
    assert.equal(uploads.length, 1);
    const copyUpload = uploads.at(-1).value;
    assert.deepEqual(copyUpload.activeSteps[1].slice(0, 5), [true, true, true, false, false]);
    assert.deepEqual(copyUpload.triggerSteps[1].slice(0, 5), [true, true, true, false, false]);
    assert.equal(await page.locator('[data-role="seqfx-block"][data-preview="true"]').count(), 0);
    await page.getByRole("button", { name: "Crusher block 1", exact: true }).waitFor();
    await page.getByRole("button", { name: "Crusher block 2", exact: true }).waitFor();
    await page.getByRole("button", { name: "Crusher block 3", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Crusher block 4", exact: true }).waitFor({ timeout: 300 }),
    );
    await assert.rejects(
        page.getByRole("button", { name: "Crusher block 5", exact: true }).waitFor({ timeout: 300 }),
    );

    await page.close();
});

test("seqfx_shift_click_selects_active_blocks_and_edits_or_deletes_the_group", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 4, 7, 11]) {
        await page.getByRole("button", { name: `Crusher step ${step}`, exact: true }).click();
    }
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Crusher block 2", exact: true }).click();
    await page.getByRole("button", { name: "Crusher block 7", exact: true }).click({ modifiers: ["Shift"] });

    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="1"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,3,6"
    ));

    const bitsInput = page.locator('[data-role="seqfx-param"][data-param="0"]');
    await bitsInput.fill("5");
    await bitsInput.dispatchEvent("change");

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(
        [1, 3, 6, 10].map((step) => upload.params[1][step][0]),
        [5, 5, 5, 8],
    );

    await page.locator('[data-role="seqfx-delete-block"]').click();

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.activeSteps[1].slice(0, 12), [
        false, false, false, false, false, false, false, false, false, false, true, false,
    ]);
    await assert.rejects(
        page.getByRole("button", { name: "Crusher block 2", exact: true }).waitFor({ timeout: 300 }),
    );
    await page.getByRole("button", { name: "Crusher block 11", exact: true }).waitFor();

    await page.close();
});

test("seqfx_cmd_c_and_cmd_v_copy_cell_values_to_single_or_group_selection", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 5, 8]) {
        await page.getByRole("button", { name: `Crusher step ${step}`, exact: true }).click();
    }

    await page.getByRole("button", { name: "Crusher block 2", exact: true }).click();
    await setRangeInputValue(page.locator('[data-role="seqfx-mix"]'), 0.42);
    await page.locator('[data-role="seqfx-param"][data-param="0"]').fill("5");
    await page.locator('[data-role="seqfx-param"][data-param="0"]').dispatchEvent("change");
    await page.locator('[data-role="seqfx-param"][data-param="1"]').fill("7");
    await page.locator('[data-role="seqfx-param"][data-param="1"]').dispatchEvent("change");
    await page.locator('[data-role="seqfx-param"][data-param="2"]').fill("12");
    await page.locator('[data-role="seqfx-param"][data-param="2"]').dispatchEvent("change");

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.getByRole("button", { name: "Crusher block 2", exact: true }).click();
    await pressMetaShortcut(page, "KeyC");

    await page.getByRole("button", { name: "Crusher block 5", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.locator('[data-role="seqfx-param"][data-param="0"]').focus();
    await pressMetaShortcut(page, "KeyV");
    let snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 0);

    await page.getByRole("button", { name: "Crusher block 5", exact: true }).click();
    await pressMetaShortcut(page, "KeyV");

    snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.params[1][4].slice(0, 3), [5, 7, 12]);
    assert.equal(upload.mix[1][4], 0.42);
    assert.deepEqual(upload.params[1][7].slice(0, 3), [8, 1, 0]);
    assert.equal(upload.mix[1][7], 1);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.getByRole("button", { name: "Crusher block 5", exact: true }).click();
    await page.getByRole("button", { name: "Crusher block 8", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="1"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "4,7"
    ));
    await pressMetaShortcut(page, "KeyV");

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(
        [4, 7].map((step) => upload.params[1][step].slice(0, 3)),
        [[5, 7, 12], [5, 7, 12]],
    );
    assert.deepEqual(
        [4, 7].map((step) => upload.mix[1][step]),
        [0.42, 0.42],
    );

    await page.close();
});

test("seqfx_clipboard_events_copy_and_paste_cell_values_when_keydown_is_missing", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 5, 8]) {
        await page.getByRole("button", { name: `Crusher step ${step}`, exact: true }).click();
    }

    await page.getByRole("button", { name: "Crusher block 2", exact: true }).click();
    await setRangeInputValue(page.locator('[data-role="seqfx-mix"]'), 0.37);
    await page.locator('[data-role="seqfx-param"][data-param="0"]').fill("6");
    await page.locator('[data-role="seqfx-param"][data-param="0"]').dispatchEvent("change");
    await page.locator('[data-role="seqfx-param"][data-param="1"]').fill("9");
    await page.locator('[data-role="seqfx-param"][data-param="1"]').dispatchEvent("change");
    await page.locator('[data-role="seqfx-param"][data-param="2"]').fill("15");
    await page.locator('[data-role="seqfx-param"][data-param="2"]').dispatchEvent("change");

    const copyResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-block"][data-lane="1"][data-start="1"]',
        "copy",
    );
    assert.deepEqual(copyResult, { defaultPrevented: true, dispatchResult: false });

    await page.getByRole("button", { name: "Crusher block 5", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const ignoredPasteResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-param"][data-param="0"]',
        "paste",
    );
    assert.deepEqual(ignoredPasteResult, { defaultPrevented: false, dispatchResult: true });
    let snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 0);

    const pasteResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-block"][data-lane="1"][data-start="4"]',
        "paste",
    );
    assert.deepEqual(pasteResult, { defaultPrevented: true, dispatchResult: false });

    snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.params[1][4].slice(0, 3), [6, 9, 15]);
    assert.equal(upload.mix[1][4], 0.37);
    assert.deepEqual(upload.params[1][7].slice(0, 3), [8, 1, 0]);
    assert.equal(upload.mix[1][7], 1);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.getByRole("button", { name: "Crusher block 5", exact: true }).click();
    await page.getByRole("button", { name: "Crusher block 8", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="1"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "4,7"
    ));
    const groupPasteResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-block"][data-lane="1"][data-start="7"]',
        "paste",
    );
    assert.deepEqual(groupPasteResult, { defaultPrevented: true, dispatchResult: false });

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(
        [4, 7].map((step) => upload.params[1][step].slice(0, 3)),
        [[6, 9, 15], [6, 9, 15]],
    );
    assert.deepEqual(
        [4, 7].map((step) => upload.mix[1][step]),
        [0.37, 0.37],
    );

    await page.close();
});

test("seqfx_selected_active_blocks_drag_as_a_group", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 4, 7, 11]) {
        await page.getByRole("button", { name: `Filter step ${step}`, exact: true }).click();
    }
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Filter block 2", exact: true }).click();
    await page.getByRole("button", { name: "Filter block 7", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="0"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,3,6"
    ));

    const anchorBlock = page.getByRole("button", { name: "Filter block 4", exact: true });
    const anchorBox = await anchorBlock.boundingBox();
    const targetBox = await page.getByRole("button", { name: "Filter step 6", exact: true }).boundingBox();
    assert.ok(anchorBox);
    assert.ok(targetBox);

    await page.mouse.move(anchorBox.x + anchorBox.width / 2, anchorBox.y + anchorBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.activeSteps[0].slice(0, 13), [
        false, false, false, true, false, true, false, false, true, false, true, false, false,
    ]);
    await page.getByRole("button", { name: "Filter block 4", exact: true }).waitFor();
    await page.getByRole("button", { name: "Filter block 6", exact: true }).waitFor();
    await page.getByRole("button", { name: "Filter block 9", exact: true }).waitFor();
    await page.getByRole("button", { name: "Filter block 11", exact: true }).waitFor();

    await page.close();
});

test("seqfx_double_clicking_a_selected_block_deletes_the_selected_group", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 5, 9]) {
        await page.getByRole("button", { name: `Stutter step ${step}`, exact: true }).click();
    }
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Stutter block 2", exact: true }).click();
    await page.getByRole("button", { name: "Stutter block 5", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="3"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,4"
    ));

    await page.getByRole("button", { name: "Stutter block 2", exact: true }).dblclick();

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.activeSteps[3].slice(0, 10), [
        false, false, false, false, false, false, false, false, true, false,
    ]);
    await assert.rejects(
        page.getByRole("button", { name: "Stutter block 2", exact: true }).waitFor({ timeout: 300 }),
    );
    await assert.rejects(
        page.getByRole("button", { name: "Stutter block 5", exact: true }).waitFor({ timeout: 300 }),
    );
    await page.getByRole("button", { name: "Stutter block 9", exact: true }).waitFor();

    await page.close();
});

test("seqfx_selected_multi_step_blocks_edit_and_drag_as_whole_blocks", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Filter step 2", exact: true }).click();
    await resizeBlockToStep(page, 0, 2, 4);
    await page.getByRole("button", { name: "Filter step 8", exact: true }).click();
    await resizeBlockToStep(page, 0, 8, 9);
    await page.getByRole("button", { name: "Filter step 22", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Filter block 2-4", exact: true }).click();
    await page.getByRole("button", { name: "Filter block 8-9", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="0"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,7"
    ));

    const filterEditor = page.locator('[data-role="filter-range-editor"]');
    await filterEditor.waitFor();
    const beforeStart = 2000;
    const beforeEnd = 500;
    const beforeRangeOctaves = cutoffRangeOctaves(beforeStart, beforeEnd);

    await page.locator('[data-role="filter-range-value-hit-target"]').focus();
    await page.keyboard.press("ArrowRight");

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    const editedStart = upload.params[0][1][1];
    const editedEnd = upload.params[0][1][2];
    assert.ok(
        editedStart > editedEnd,
        `center handle edit should preserve downward filter sweep direction, got ${editedStart} -> ${editedEnd}`,
    );
    assert.ok(
        geometricCenterHz(editedStart, editedEnd) > geometricCenterHz(beforeStart, beforeEnd),
        "center handle edit should move the selected filter range upward",
    );
    assertClose(
        cutoffRangeOctaves(editedStart, editedEnd),
        beforeRangeOctaves,
        0.02,
        "center handle edit should preserve the selected filter range width",
    );
    assert.deepEqual(
        [1, 2, 3, 7, 8].map((step) => upload.params[0][step][1]),
        [editedStart, editedStart, editedStart, editedStart, editedStart],
    );
    assert.equal(upload.params[0][21][1], 2000);

    const anchorBox = await page.getByRole("button", { name: "Filter block 2-4", exact: true }).boundingBox();
    const targetBox = await page.getByRole("button", { name: "Filter step 11", exact: true }).boundingBox();
    assert.ok(anchorBox);
    assert.ok(targetBox);

    await page.mouse.move(anchorBox.x + anchorBox.width * 0.15, anchorBox.y + anchorBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width * 0.15, targetBox.y + targetBox.height / 2, { steps: 12 });
    await page.mouse.up();

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.activeSteps[0].slice(1, 4), [false, false, false]);
    assert.deepEqual(upload.activeSteps[0].slice(7, 9), [false, false]);
    assert.deepEqual(upload.activeSteps[0].slice(10, 13), [true, true, true]);
    assert.deepEqual(upload.triggerSteps[0].slice(10, 13), [true, false, false]);
    assert.deepEqual(upload.activeSteps[0].slice(16, 18), [true, true]);
    assert.deepEqual(upload.triggerSteps[0].slice(16, 18), [true, false]);
    assert.deepEqual(
        [10, 11, 12, 16, 17].map((step) => upload.params[0][step][1]),
        [editedStart, editedStart, editedStart, editedStart, editedStart],
    );
    assert.equal(upload.activeSteps[0][21], true);
    assert.equal(upload.params[0][21][1], 2000);
    await page.getByRole("button", { name: "Filter block 11-13", exact: true }).waitFor();
    await page.getByRole("button", { name: "Filter block 17-18", exact: true }).waitFor();
    await page.getByRole("button", { name: "Filter block 22", exact: true }).waitFor();

    await page.close();
});

test("seqfx_keyboard_activation_creates_and_selects_grid_blocks", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const filterStep = page.getByRole("button", { name: "Filter step 5", exact: true });
    await filterStep.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Filter block 5", exact: true }).waitFor();

    let snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).at(-1).value.activeSteps[0][4], true);

    await page.getByRole("button", { name: "Filter step 9", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Filter block 9", exact: true }).waitFor();

    snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).at(-1).value.activeSteps[0][8], true);
    await page.locator('[data-role="seqfx-inspector"]').getByText("Filter step 9").waitFor();

    await page.close();
});
