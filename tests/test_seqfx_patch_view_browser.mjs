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
const SEQFX_STATE_KEY = "seqfx.v4";
const SEQFX_SNAPSHOT_BANK_STATE_KEY = "cosimo.effectSnapshotBank.seqfx.v1";
const SEQFX_NORMAL_GAP_PX = 3;
const SEQFX_BEAT_GAP_PX = 5;
const SEQFX_MIN_CELL_SIZE_PX = 12;
const SEQFX_EFFECT_TYPES = {
    filter: 1,
    crusher: 2,
    tapeStop: 3,
    stutter: 4,
};
const SEQFX_LANE_NAMES = ["Chain 1", "Chain 2", "Chain 3", "Chain 4"];
const SEQFX_DEFAULT_EFFECT_NAMES = ["Filter", "Crusher", "Tape Stop", "Stutter"];
const TAPE_GRAPH_VIEWBOX_WIDTH = 260;
const TAPE_GRAPH_VIEWBOX_HEIGHT = 150;
const TAPE_GRAPH_LEFT = 28;
const TAPE_GRAPH_TOP = 12;
const TAPE_GRAPH_PLOT_WIDTH = 222;
const TAPE_GRAPH_PLOT_HEIGHT = 114;
const STUTTER_GRAPH_VIEWBOX_WIDTH = 480;
const STUTTER_GRAPH_VIEWBOX_HEIGHT = 220;
const STUTTER_GRAPH_LEFT = 24;
const STUTTER_GRAPH_PLOT_WIDTH = 432;

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

function blockRoleName(lane, startStep, endStep = startStep) {
    const laneName = SEQFX_LANE_NAMES[lane];
    const effectName = SEQFX_DEFAULT_EFFECT_NAMES[lane];
    return startStep === endStep
        ? `${laneName} ${effectName} block ${startStep}`
        : `${laneName} ${effectName} block ${startStep}-${endStep}`;
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
    await page.getByRole("button", { name: blockRoleName(lane, startStep, endStep), exact: true }).waitFor();
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

function stutterGraphPoint(graphBox, normalizedGate) {
    const svgX = STUTTER_GRAPH_LEFT + (Math.min(1, Math.max(0, normalizedGate)) * STUTTER_GRAPH_PLOT_WIDTH);

    return {
        x: graphBox.x + ((svgX / STUTTER_GRAPH_VIEWBOX_WIDTH) * graphBox.width),
        y: graphBox.y + ((110 / STUTTER_GRAPH_VIEWBOX_HEIGHT) * graphBox.height),
    };
}

async function readStutterEnvelopePathSamples(page, phases) {
    return page.locator('[data-role="seqfx-stutter-editor"]').evaluate((node, targetPhases) => {
        const path = node.querySelector('[data-role="seqfx-stutter-env-path"]');
        const d = path?.getAttribute("d") ?? "";
        const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        const points = [];

        for (let index = 0; index + 1 < numbers.length; index += 2) {
            points.push({ x: numbers[index], y: numbers[index + 1] });
        }

        if (points.length < 2) {
            return null;
        }

        const left = points[0].x;
        const right = points[points.length - 1].x;
        const width = Math.max(1, right - left);

        const sampleAtPhase = (phase) => {
            let nearestPoint = points[0];
            let nearestDistance = Number.POSITIVE_INFINITY;

            for (const point of points) {
                const pointPhase = (point.x - left) / width;
                const distance = Math.abs(pointPhase - phase);

                if (distance < nearestDistance) {
                    nearestPoint = point;
                    nearestDistance = distance;
                }
            }

            return nearestPoint.y;
        };

        return Object.fromEntries(targetPhases.map((phase) => [phase.toFixed(2), sampleAtPhase(phase)]));
    }, phases);
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

async function setCrusherEditorValues(page, { bits, holdFrames, driveDb }) {
    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-bits"]'), bits);
    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-hold-frames"]'), holdFrames);
    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-drive-db"]'), driveDb);
}

async function keyboardSetSliderTo(locator, key) {
    await locator.focus();
    await locator.press(key);
}

async function dragHorizontalControlTo(page, locator, startRatio, endRatio) {
    const box = await locator.boundingBox();
    assert.ok(box, "expected horizontal control to have a bounding box");
    const y = box.y + (box.height / 2);
    await page.mouse.move(box.x + (box.width * startRatio), y);
    await page.mouse.down();
    await page.mouse.move(box.x + (box.width * endRatio), y, { steps: 8 });
    await page.mouse.up();
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
                callback({
                    parameters: { ...this.parameters },
                    values: { ...this.storedState },
                });
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
        const workerModule = await import(`/fx/seqfx/worker/seqfx-worker-service.ts?seqfx-loader-worker-test=${Date.now()}`);
        const workerService = workerModule.createSeqFxWorkerService(patchConnection);
        workerService.start();
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
    await page.getByRole("button", { name: "Chain 3 step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-tape-graph"]').waitFor();

    await page.close();
});

test("seqfx_topbar_keeps_patterns_on_one_row_without_duplicate_draw_or_transport_controls", async () => {
    const page = await browser.newPage({ viewport: { width: 567, height: 776 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();

    const layout = await page.evaluate(() => {
        const rectFor = (selector) => {
            const element = document.querySelector(selector);
            if (!element) {
                return null;
            }

            const rect = element.getBoundingClientRect();
            return {
                height: rect.height,
                left: rect.left,
                top: rect.top,
                right: rect.right,
            };
        };
        const topbar = document.querySelector(".seqfx-topbar");
        const patternTops = Array.from(document.querySelectorAll('[data-role="seqfx-pattern"]'))
            .map((button) => Math.round(button.getBoundingClientRect().top));
        const patternRects = Array.from(document.querySelectorAll('[data-role="seqfx-pattern"]'))
            .map((button) => button.getBoundingClientRect());
        const inspectorHeading = document.querySelector(".seqfx-inspector-heading strong");

        return {
            drawControlCount: document.querySelectorAll('[data-role="seqfx-draw-effect"], .seqfx-draw-effect').length,
            grid: rectFor(".seqfx-grid-shell"),
            inspectorHeading: rectFor(".seqfx-inspector-heading strong"),
            inspectorHeadingFontSize: inspectorHeading ? getComputedStyle(inspectorHeading).fontSize : null,
            laneLabelDisplay: getComputedStyle(document.querySelector(".seqfx-lane-label")).display,
            laneTrack: rectFor(".seqfx-lane-track"),
            lastPatternRight: patternRects.at(-1)?.right ?? null,
            patternButtonCount: patternTops.length,
            patternRowCount: new Set(patternTops).size,
            patterns: rectFor(".seqfx-patterns"),
            title: rectFor(".seqfx-title"),
            topbarText: topbar?.textContent ?? "",
            topbar: rectFor(".seqfx-topbar"),
            transportControlCount: document.querySelectorAll('.seqfx-transport, [aria-label="Internal clock"]').length,
        };
    });

    assert.equal(layout.drawControlCount, 0);
    assert.equal(layout.transportControlCount, 0);
    assert.equal(layout.topbarText.includes("Cosimo"), false);
    assert.equal(layout.patternButtonCount, 12);
    assert.equal(layout.patternRowCount, 1);
    assert.ok(layout.topbar.height <= 42, `expected compact topbar, got ${layout.topbar.height}px`);
    assert.ok(layout.patterns.left >= layout.title.right, "pattern buttons should sit to the right of the title");
    assert.ok(layout.lastPatternRight <= layout.patterns.right + 1, "all pattern buttons should be visible at 567px");
    assert.equal(layout.laneLabelDisplay, "none");
    assert.ok(layout.laneTrack.left - layout.grid.left <= 12, "grid cells should start near the shell's left edge");
    assert.equal(layout.inspectorHeadingFontSize, "13px");
    assert.ok(layout.inspectorHeading.height <= 18, `expected compact inspector heading, got ${layout.inspectorHeading.height}px`);

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

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    const block = page.getByRole("button", { name: "Chain 1 Filter block 1", exact: true });
    await block.waitFor();
    const blockBox = await block.boundingBox();
    const targetBox = await page.getByRole("button", { name: "Chain 1 step 8", exact: true }).boundingBox();
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
    await page.getByRole("button", { name: "Chain 1 Filter block 1", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Chain 1 Filter block 8", exact: true }).waitFor({ timeout: 300 }),
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

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await assert.rejects(
        page.locator('[data-role="seqfx-inspector"]').getByText("Select a cell").waitFor({ timeout: 400 }),
    );
    await page.locator('[data-role="seqfx-inspector"]').getByText("Chain 1 step 1").waitFor({ timeout: 400 });

    const filterEditor = page.locator('[data-role="filter-range-editor"]');
    await filterEditor.waitFor();
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="1"]').count(), 0);
    assert.equal(await filterEditor.locator('[data-role="filter-range-readout"]').count(), 0);
    assert.equal(
        await filterEditor.locator(
            '[data-role="filter-range-chip-center"], [data-role="filter-range-chip-start"], [data-role="filter-range-chip-end"], [data-role="filter-range-chip-span"]',
        ).count(),
        4,
    );
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
    const filterLabelGap = await filterEditor.evaluate((node) => {
        const labels = Array.from(node.querySelectorAll('[data-role="filter-range-frequency-label"]'));
        const handles = Array.from(node.querySelectorAll(
            '[data-role="filter-range-start-hit-target"], [data-role="filter-range-end-hit-target"]',
        ));
        const minLabelTop = Math.min(...labels.map((label) => label.getBoundingClientRect().top));
        const maxHandleBottom = Math.max(...handles.map((handle) => handle.getBoundingClientRect().bottom));

        return minLabelTop - maxHandleBottom;
    });
    assert.ok(
        filterLabelGap > 0,
        `filter frequency labels should stay below range handle hit targets, got ${filterLabelGap}px gap`,
    );
    const inspectorLayout = await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => {
        const filterBounds = node.querySelector('[data-role="filter-range-editor"]')?.getBoundingClientRect();
        const mixBounds = node.querySelector('[data-role="seqfx-mix-row"]')?.getBoundingClientRect();
        const exactMixLabelCount = Array.from(node.querySelectorAll("span"))
            .filter((span) => span.textContent?.trim() === "Mix").length;

        return {
            exactMixLabelCount,
            filterBottom: filterBounds?.bottom ?? 0,
            mixTop: mixBounds?.top ?? 0,
        };
    });
    assert.equal(inspectorLayout.exactMixLabelCount, 0);
    assert.ok(
        inspectorLayout.mixTop >= inspectorLayout.filterBottom,
        `SeqFX mix row should sit below the active effect editor, got mix top ${inspectorLayout.mixTop} and filter bottom ${inspectorLayout.filterBottom}`,
    );

    await page.locator('[data-role="filter-range-mode-cycle-button"]').click();

    let snapshot = await getHarnessSnapshot(page);
    let uploads = patternUploads(snapshot);
    assert.equal(uploads.length, 2);
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

test("seqfx_crusher_aux_controls_edit_curve_targets_and_v4_storage", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true }).waitFor();
    await page.locator('[data-role="seqfx-aux-curve"]').waitFor();

    await page.locator('[data-role="seqfx-aux-curve-shape"][data-shape="exp"]').click();
    await page.locator('[data-role="seqfx-crusher-bits-slider"] .editor-tick-slider__label--toggle').click();
    await keyboardSetSliderTo(page.getByRole("slider", { name: "Bits end", exact: true }), "End");
    await dragHorizontalControlTo(page, page.locator('[data-role="seqfx-crusher-bits"]'), 0.33, 0);
    await dragHorizontalControlTo(page, page.locator('[data-role="seqfx-crusher-bits"]'), 0.96, 0.67);
    await page.locator('[data-role="seqfx-crusher-drive-db-mod-toggle"]').click();
    await keyboardSetSliderTo(page.getByRole("slider", { name: "Drive start", exact: true }), "End");
    await keyboardSetSliderTo(page.getByRole("slider", { name: "Drive end", exact: true }), "Home");

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxCurve[1][0], 2);
    assert.equal(upload.params[1][0][0], 4);
    assert.equal(upload.params[1][0][2], 36);
    assert.equal(upload.auxEnabled[1][0][0], true);
    assert.equal(upload.auxEnabled[1][0][2], true);
    assert.equal(upload.auxEnd[1][0][0], 12);
    assert.equal(upload.auxEnd[1][0][2], 0);

    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const step = storedState.patterns[0].lanes[1].steps[0];
    assert.equal(step.aux.curve, "exp");
    assert.equal(step.params[0], 4);
    assert.equal(step.params[2], 36);
    assert.deepEqual(step.aux.targets[0], { enabled: true, end: 12 });
    assert.deepEqual(step.aux.targets[2], { enabled: true, end: 0 });

    await page.close();
});

test("seqfx_aux_curve_phase_dot_follows_monitor_phase", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true }).waitFor();
    const phaseInput = page.locator('[data-role="seqfx-aux-phase"]');
    await phaseInput.waitFor();

    await page.evaluate(() => {
        window.__SEQFX_HARNESS__?.patchConnection.emitEndpoint("monitorOut", {
            event: {
                patternIndex: 0,
                stepIndex: 0,
                transportRunning: true,
                stepProgress: 0.5,
                stepDurationMs: 125,
                auxPhase: [0, 0.5, 0, 0],
                auxDurationMs: [0, 250, 0, 0],
            },
        });
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (Math.abs(Number(await phaseInput.inputValue()) - 0.5) <= 0.01) {
            break;
        }
        await page.waitForTimeout(25);
    }
    assertClose(Number(await phaseInput.inputValue()), 0.5, 0.01, "Aux curve phase input should follow monitor phase");
    const phaseDotCx = await page.locator('[data-role="seqfx-aux-curve"] .aux-pv-dot').getAttribute("cx");
    assertClose(Number(phaseDotCx), 100, 2, "Aux curve phase dot should move to half phase");

    await page.close();
});

test("seqfx_stutter_aux_controls_edit_gate_slices_shape_and_speed_targets", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 4 Stutter block 1", exact: true }).waitFor();
    await page.locator('[data-role="seqfx-aux-curve"]').waitFor();

    await page.locator('[data-role="seqfx-stutter-gate-mod-toggle"]').click();
    await page.locator('[data-role="seqfx-stutter-slices-slider"] .editor-tick-slider__label--toggle').click();
    await page.locator('[data-role="seqfx-stutter-shape-mod-toggle"]').click();
    await page.locator('[data-role="seqfx-stutter-speed-slider"] .editor-tick-slider__label--toggle').click();
    await keyboardSetSliderTo(page.getByRole("slider", { name: "Gate position", exact: true }), "Home");
    await keyboardSetSliderTo(page.getByRole("slider", { name: "Gate end", exact: true }), "Home");
    await keyboardSetSliderTo(page.getByRole("slider", { name: "Slices end", exact: true }), "End");
    await keyboardSetSliderTo(page.getByRole("slider", { name: "Shape end", exact: true }), "Home");
    await keyboardSetSliderTo(page.getByRole("slider", { name: "Speed end", exact: true }), "End");

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.auxEnabled[3][0].slice(0, 4), [true, true, true, true]);
    assert.equal(upload.auxEnd[3][0][0], 32);
    assert.equal(upload.auxEnd[3][0][1], 2);
    assert.equal(upload.auxEnd[3][0][2], 0);
    assert.equal(upload.auxEnd[3][0][3], 0);
    assert.equal(upload.params[3][0][3], 0);

    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const step = storedState.patterns[0].lanes[3].steps[0];
    assert.equal(step.aux.curve, "linear");
    assert.deepEqual(step.aux.targets.slice(0, 4).map((target) => target.enabled), [true, true, true, true]);
    assert.deepEqual(step.aux.targets.slice(0, 4).map((target) => target.end), [32, 2, 0, 0]);
    assert.equal(step.params[3], 0);

    await page.close();
});

test("seqfx_tape_stop_aux_controls_edit_all_tape_targets_including_mode", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 3 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 3 Tape Stop block 1", exact: true }).waitFor();
    await page.locator('[data-role="seqfx-aux-curve"]').waitFor();

    for (const dataRole of [
        "seqfx-tape-stop-point",
        "seqfx-tape-curve",
        "seqfx-tape-catchup-curve",
        "seqfx-tape-catchup",
        "seqfx-tape-mode",
    ]) {
        await page.locator(`[data-role="${dataRole}-mod-toggle"]`).click();
    }

    await setRangeInputValue(page.locator('[data-role="seqfx-tape-stop-point-end"]'), 125);
    await setRangeInputValue(page.locator('[data-role="seqfx-tape-curve-end"]'), 2.5);
    await setRangeInputValue(page.locator('[data-role="seqfx-tape-catchup-curve-end"]'), 3);
    await setRangeInputValue(page.locator('[data-role="seqfx-tape-catchup-end"]'), 75);
    await page.locator('[data-role="seqfx-tape-mode-end"]').selectOption("1");

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.auxEnabled[2][0].slice(0, 5), [true, true, true, true, true]);
    assertClose(upload.auxEnd[2][0][0], 1.25, 0.000001, "tape start length aux end");
    assert.equal(upload.auxEnd[2][0][1], 2.5);
    assert.equal(upload.auxEnd[2][0][2], 3);
    assert.equal(upload.auxEnd[2][0][3], 75);
    assert.equal(upload.auxEnd[2][0][4], 1);

    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const step = storedState.patterns[0].lanes[2].steps[0];
    assert.equal(step.aux.curve, "linear");
    assert.deepEqual(step.aux.targets.slice(0, 5).map((target) => target.enabled), [true, true, true, true, true]);
    assertClose(step.aux.targets[0].end, 1.25, 0.000001, "persisted tape start length aux end");
    assert.deepEqual(step.aux.targets.slice(1, 5).map((target) => target.end), [2.5, 3, 75, 1]);

    await page.close();
});

test("seqfx_crusher_inspector_renders_waveform_editor_and_writes_params", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-crusher-editor"]').waitFor();
    await page.locator('[data-role="seqfx-crusher-graph"]').waitFor();

    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="0"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="1"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="2"]').count(), 0);

    const bitTicks = page.locator('[data-role="seqfx-crusher-bits-slider"] [data-role="editor-tick-slider-tick"]');
    assert.equal(await bitTicks.count(), 13);
    const bitTickBox = await bitTicks.first().boundingBox();
    assert.ok(bitTickBox);
    assert.ok(bitTickBox.height >= 12, `crusher bit ticks should match editor strip thickness, got ${bitTickBox.height}`);

    const holdTicks = page.locator('[data-role="seqfx-crusher-hold-frames-slider"] [data-role="editor-tick-slider-tick"]');
    assert.equal(await holdTicks.count(), 16);
    const narrowLayout = await page.locator('[data-role="seqfx-crusher-editor"]').evaluate((node) => {
        const bitsRow = node.querySelector('[data-role="seqfx-crusher-bits-slider"]');
        const bitsTrack = bitsRow?.querySelector(".editor-tick-slider__track");
        const bitsValue = bitsRow?.querySelector('[data-role="seqfx-crusher-bits-value"]');
        const holdRow = node.querySelector('[data-role="seqfx-crusher-hold-frames-slider"]');
        const holdTrack = holdRow?.querySelector(".editor-tick-slider__track");
        const holdTicks = holdRow?.querySelectorAll('[data-role="editor-tick-slider-tick"]') ?? [];
        const firstHoldTick = holdTicks[0];
        const lastHoldTick = holdTicks[holdTicks.length - 1];

        return {
            bitsRowWidth: bitsRow?.getBoundingClientRect().width ?? 0,
            bitsTrackWidth: bitsTrack?.getBoundingClientRect().width ?? 0,
            bitsValueWidth: bitsValue?.getBoundingClientRect().width ?? 0,
            holdRowWidth: holdRow?.getBoundingClientRect().width ?? 0,
            holdTrackWidth: holdTrack?.getBoundingClientRect().width ?? 0,
            holdTickWidth: firstHoldTick?.getBoundingClientRect().width ?? 0,
            holdActiveColor: firstHoldTick ? getComputedStyle(firstHoldTick).backgroundColor : "",
            holdInactiveColor: lastHoldTick ? getComputedStyle(lastHoldTick).backgroundColor : "",
        };
    });
    assert.ok(
        narrowLayout.bitsTrackWidth > narrowLayout.bitsRowWidth * 0.45,
        `crusher bits rail should keep most of the row, got ${narrowLayout.bitsTrackWidth}px of ${narrowLayout.bitsRowWidth}px`,
    );
    assert.ok(
        narrowLayout.bitsValueWidth < narrowLayout.bitsRowWidth * 0.25,
        `crusher bits readout should stay compact, got ${narrowLayout.bitsValueWidth}px of ${narrowLayout.bitsRowWidth}px`,
    );
    assert.ok(
        narrowLayout.holdTrackWidth > narrowLayout.holdRowWidth * 0.45,
        `crusher hold rail should keep most of the row, got ${narrowLayout.holdTrackWidth}px of ${narrowLayout.holdRowWidth}px`,
    );
    assert.ok(
        narrowLayout.holdTickWidth >= 4,
        `crusher hold ticks should remain visible in the narrow inspector, got ${narrowLayout.holdTickWidth}px`,
    );
    assert.notEqual(
        narrowLayout.holdActiveColor,
        narrowLayout.holdInactiveColor,
        "crusher hold row should visibly distinguish active ticks from inactive ticks",
    );

    const driveLayoutBefore = await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => {
        const driveRow = node.querySelector(".seqfx-crusher-editor__drive");
        const mixRow = node.querySelector('[data-role="seqfx-mix-row"]');

        return {
            driveHeight: driveRow?.getBoundingClientRect().height ?? 0,
            mixTop: mixRow?.getBoundingClientRect().top ?? 0,
        };
    });
    await page.locator('[data-role="seqfx-crusher-drive-db-mod-toggle"]').click();
    const driveLayoutModulated = await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => {
        const driveRow = node.querySelector(".seqfx-crusher-editor__drive");
        const mixRow = node.querySelector('[data-role="seqfx-mix-row"]');

        return {
            driveHeight: driveRow?.getBoundingClientRect().height ?? 0,
            mixTop: mixRow?.getBoundingClientRect().top ?? 0,
        };
    });
    await page.locator('[data-role="seqfx-crusher-drive-db-mod-toggle"]').click();
    const driveLayoutReset = await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => {
        const driveRow = node.querySelector(".seqfx-crusher-editor__drive");
        const mixRow = node.querySelector('[data-role="seqfx-mix-row"]');

        return {
            driveHeight: driveRow?.getBoundingClientRect().height ?? 0,
            mixTop: mixRow?.getBoundingClientRect().top ?? 0,
        };
    });
    assertClose(driveLayoutModulated.mixTop, driveLayoutBefore.mixTop, 1, "crusher drive modulation should not push the mix row");
    assertClose(driveLayoutModulated.driveHeight, driveLayoutBefore.driveHeight, 1, "crusher drive row height should stay stable when modulation turns on");
    assertClose(driveLayoutReset.mixTop, driveLayoutBefore.mixTop, 1, "crusher drive modulation should not leave the mix row shifted after turning back off");
    assertClose(driveLayoutReset.driveHeight, driveLayoutBefore.driveHeight, 1, "crusher drive row height should return to its original size");

    const beforePath = await page.locator('[data-role="seqfx-crusher-wet-path"]').getAttribute("d");
    assert.ok(beforePath && beforePath.length > 20, "crusher graph should render a non-empty wet waveform path");

    await setCrusherEditorValues(page, { bits: 4, holdFrames: 32, driveDb: 30 });
    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.params[1][0].slice(0, 3), [4, 32, 30]);

    const afterParamPath = await page.locator('[data-role="seqfx-crusher-wet-path"]').getAttribute("d");
    assert.notEqual(afterParamPath, beforePath, "crusher graph should redraw after bits/hold/drive changes");
    assert.equal(await page.locator('[data-role="seqfx-crusher-bits-value"]').textContent(), "4");
    assert.equal(await page.locator('[data-role="seqfx-crusher-hold-frames-value"]').textContent(), "32");
    assert.equal(await page.locator('[data-role="seqfx-crusher-drive-db-value"]').textContent(), "30.0 dB");

    await setRangeInputValue(page.locator('[data-role="seqfx-mix"]'), 0.25);
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.mix[1][0], 0.25, 0.001, "crusher mix row should still write block mix");
    const afterMixPath = await page.locator('[data-role="seqfx-crusher-wet-path"]').getAttribute("d");
    assert.notEqual(afterMixPath, afterParamPath, "crusher graph should redraw when shared mix changes");

    const layout = await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => {
        const editorBounds = node.querySelector('[data-role="seqfx-crusher-editor"]')?.getBoundingClientRect();
        const mixBounds = node.querySelector('[data-role="seqfx-mix-row"]')?.getBoundingClientRect();

        return {
            editorBottom: editorBounds?.bottom ?? 0,
            mixTop: mixBounds?.top ?? 0,
        };
    });
    assert.ok(
        layout.mixTop >= layout.editorBottom,
        `SeqFX crusher mix row should sit below the crusher editor, got mix top ${layout.mixTop} and editor bottom ${layout.editorBottom}`,
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
    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Filter block 1", exact: true }).waitFor();

    let snapshot = await getHarnessSnapshot(page);
    let bank = snapshot.storedState[SEQFX_SNAPSHOT_BANK_STATE_KEY];
    assert.equal(bank.activeSlotID, "A");
    assert.equal(
        parseSeqFxStoredState(bank.slots.A.storedState[SEQFX_STATE_KEY]).patterns[0].lanes[0].steps[0].active,
        true,
    );

    await clickSnapshotSlot(page, "B");
    await page.getByRole("button", { name: "Chain 1 Filter block 1", exact: true }).dblclick();
    await page.getByRole("button", { name: "Chain 1 step 5", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Filter block 5", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Chain 1 Filter block 1", exact: true }).waitFor({ timeout: 300 }),
    );

    snapshot = await getHarnessSnapshot(page);
    bank = snapshot.storedState[SEQFX_SNAPSHOT_BANK_STATE_KEY];
    const slotBState = parseSeqFxStoredState(bank.slots.B.storedState[SEQFX_STATE_KEY]);
    assert.equal(bank.activeSlotID, "B");
    assert.equal(slotBState.patterns[0].lanes[0].steps[0].active, false);
    assert.equal(slotBState.patterns[0].lanes[0].steps[4].active, true);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await clickSnapshotSlot(page, "A");
    await page.getByRole("button", { name: "Chain 1 Filter block 1", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Chain 1 Filter block 5", exact: true }).waitFor({ timeout: 300 }),
    );

    snapshot = await getHarnessSnapshot(page);
    const recallUpload = patternUploads(snapshot).at(-1).value;
    assert.equal(recallUpload.authoritative, false);
    assert.equal(recallUpload.activeSteps[0][0], true);
    assert.equal(recallUpload.activeSteps[0][4], false);
    assert.equal(snapshot.storedState[SEQFX_SNAPSHOT_BANK_STATE_KEY].activeSlotID, "A");

    await page.close();
});

test("seqfx_stutter_inspector_renders_interactive_envelope_editor_and_writes_block_params", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-stutter-editor"]').waitFor();
    await page.locator('[data-role="seqfx-stutter-graph"]').waitFor();

    assert.deepEqual(
        await page.locator('[data-role="seqfx-stutter-shape-stop"]').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? "")),
        ["Gate", "Triangle", "Bell", "Down", "Up"],
    );
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="0"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-stutter-slices-slider"] [data-role="editor-tick-slider-tick"]').count(), 31);
    assert.equal(await page.locator('[data-role="seqfx-stutter-speed-slider"] [data-role="editor-tick-slider-tick"]').count(), 16);
    assert.equal(await page.locator('[data-role="seqfx-stutter-shape-slider"]').count(), 0);
    await page.locator('[data-role="seqfx-stutter-shape-mod-toggle"]').waitFor();

    const tickBox = await page.locator('[data-role="seqfx-stutter-slices-slider"] [data-role="editor-tick-slider-tick"]').first().boundingBox();
    assert.ok(tickBox);
    assert.ok(tickBox.height >= 12, `stutter slices ticks should be thick enough to read, got ${tickBox.height}`);

    await setRangeInputValue(page.locator('[data-role="seqfx-stutter-slices"]'), 9);
    await setRangeInputValue(page.locator('[data-role="seqfx-stutter-speed"]'), 1.05);

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.params[3][0][0], 9);
    assertClose(upload.params[3][0][1], 1.05, 0.001, "speed tick slider should write speed");
    assert.equal(await page.locator('[data-role="seqfx-stutter-slices-value"]').textContent(), "9");
    assert.equal(await page.locator('[data-role="seqfx-stutter-speed-value"]').textContent(), "1.05x");

    const graphBox = await page.locator('[data-role="seqfx-stutter-graph"]').boundingBox();
    assert.ok(graphBox);
    await page.mouse.click(stutterGraphPoint(graphBox, 1).x, stutterGraphPoint(graphBox, 1).y);
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[3][0][3], 1, 0.03, "gate graph click should open the cut fully before sampling the shape path");

    const morphBox = await page.locator('[data-role="seqfx-stutter-morph-track"]').boundingBox();
    assert.ok(morphBox);
    await page.mouse.click(morphBox.x + morphBox.width * 0.8, morphBox.y + morphBox.height / 2);
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[3][0][2], 0.8, 0.03, "morph track click should write shape");

    await page.mouse.click(morphBox.x + morphBox.width * 0.125, morphBox.y + morphBox.height / 2);
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[3][0][2], 0.125, 0.03, "morph track should land in the midpoint of the Gate -> Triangle segment");
    const trapezoidSamples = await readStutterEnvelopePathSamples(page, [0.1, 0.3, 0.7, 0.8]);
    assert.ok(trapezoidSamples, "expected the stutter graph path to produce readable points");
    assertClose(trapezoidSamples["0.30"], trapezoidSamples["0.70"], 2, "Gate -> Triangle midpoint should keep a flat plateau");
    assert.ok(
        trapezoidSamples["0.10"] > trapezoidSamples["0.30"] + 15,
        `Gate -> Triangle midpoint should slope up from the left wall, got y=${trapezoidSamples["0.10"]} at 0.10 and y=${trapezoidSamples["0.30"]} at 0.30`,
    );
    assert.ok(
        trapezoidSamples["0.80"] > trapezoidSamples["0.70"] + 10,
        `Gate -> Triangle midpoint should slope down along the right wall, got y=${trapezoidSamples["0.80"]} at 0.80 and y=${trapezoidSamples["0.70"]} at 0.70`,
    );

    await page.locator('[data-role="seqfx-stutter-shape-stop"][data-stop="1"]').click();
    const triangleSamples = await readStutterEnvelopePathSamples(page, [0.3]);
    assert.ok(triangleSamples, "expected the triangle stutter graph path to produce readable points");
    assert.ok(
        triangleSamples["0.30"] > trapezoidSamples["0.30"] + 15,
        `Triangle should collapse the trapezoid plateau, got y=${triangleSamples["0.30"]} at 0.30 vs trapezoid y=${trapezoidSamples["0.30"]}`,
    );

    await page.mouse.click(stutterGraphPoint(graphBox, 0.25).x, stutterGraphPoint(graphBox, 0.25).y);
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[3][0][3], 0.25, 0.03, "gate graph click should write gate");

    await page.locator('[data-role="seqfx-stutter-shape-stop"][data-stop="4"]').click();
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.params[3][0][2], 1);

    await page.locator('[data-role="seqfx-stutter-morph-track"]').focus();
    await page.keyboard.press("Home");
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.params[3][0][2], 0);
    const stutterLayout = await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => {
        const editorBounds = node.querySelector('[data-role="seqfx-stutter-editor"]')?.getBoundingClientRect();
        const mixBounds = node.querySelector('[data-role="seqfx-mix-row"]')?.getBoundingClientRect();

        return {
            editorBottom: editorBounds?.bottom ?? 0,
            mixTop: mixBounds?.top ?? 0,
        };
    });
    assert.ok(
        stutterLayout.mixTop >= stutterLayout.editorBottom,
        `SeqFX stutter mix row should sit below the envelope editor, got mix top ${stutterLayout.mixTop} and editor bottom ${stutterLayout.editorBottom}`,
    );
    await setRangeInputValue(page.locator('[data-role="seqfx-mix"]'), 0.64);
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.mix[3][0], 0.64, 0.001, "shared mix row should write stutter block mix");

    await page.close();
});

test("seqfx_stutter_editor_applies_shape_and_gate_to_selected_block_group", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 4 step 2", exact: true }).click();
    await resizeBlockToStep(page, 3, 2, 3);
    await page.getByRole("button", { name: "Chain 4 step 7", exact: true }).click();
    await resizeBlockToStep(page, 3, 7, 8);
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 4 Stutter block 2-3", exact: true }).click();
    await page.getByRole("button", { name: "Chain 4 Stutter block 7-8", exact: true }).click({ modifiers: ["Shift"] });
    await page.locator('[data-role="seqfx-stutter-editor"]').waitFor();

    const graphBox = await page.locator('[data-role="seqfx-stutter-graph"]').boundingBox();
    assert.ok(graphBox);
    await page.mouse.click(stutterGraphPoint(graphBox, 0.4).x, stutterGraphPoint(graphBox, 0.4).y);
    await page.locator('[data-role="seqfx-stutter-shape-stop"][data-stop="2"]').click();

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(
        [1, 2, 6, 7].map((step) => upload.params[3][step][2]),
        [0.5, 0.5, 0.5, 0.5],
    );
    assert.deepEqual(
        [1, 2, 6, 7].map((step) => Number(upload.params[3][step][3].toFixed(2))),
        [0.4, 0.4, 0.4, 0.4],
    );

    await page.close();
});

test("seqfx_pattern_buttons_send_pattern_select_and_worker_upload", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.locator('[data-role="seqfx-pattern"][data-pattern="4"]').click();

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(snapshot.events.some((entry) => entry.endpointID === "patternSelect" && entry.value === 4), true);
    assert.equal(patternUploads(snapshot).at(-1).value.patternIndex, 4);
    assert.equal(patternUploads(snapshot).at(-1).value.authoritative, false);

    await page.close();
});

test("seqfx_right_edge_drag_resizes_a_block_without_retriggering_continuation_steps", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const first = page.getByRole("button", { name: "Chain 3 step 1", exact: true });
    const fifth = page.getByRole("button", { name: "Chain 3 step 5", exact: true });
    await first.click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const resizeHandle = page.locator('[data-role="seqfx-block-resize"][data-lane="2"][data-start="0"]');
    await resizeHandle.waitFor();
    const handleBox = await resizeHandle.boundingBox();
    const fifthBox = await fifth.boundingBox();

    assert.ok(handleBox);
    assert.ok(fifthBox);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(fifthBox.x + fifthBox.width - 2, fifthBox.y + fifthBox.height / 2, { steps: 8 });
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 1);
    const lastUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(lastUpload.activeSteps[2].slice(0, 5), [true, true, true, true, true]);
    assert.deepEqual(lastUpload.triggerSteps[2].slice(0, 5), [true, false, false, false, false]);
    await page.locator('[data-role="seqfx-tape-graph"]').waitFor();
    assert.equal(await page.locator('[data-role="seqfx-tape-stop-point"]').isDisabled(), false);

    const resizedBlockBox = await page.getByRole("button", { name: "Chain 3 Tape Stop block 1-5", exact: true }).boundingBox();
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

    await page.getByRole("button", { name: "Chain 3 step 1", exact: true }).click();
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

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    const blockBox = await page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true }).boundingBox();
    const cellBox = await page.getByRole("button", { name: "Chain 2 step 2", exact: true }).boundingBox();
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

test("seqfx_inspector_effect_selector_persists_selected_effect_type_and_uploads_pattern", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const effectPicker = page.locator('[data-role="seqfx-effect-type"]');
    assert.equal(await effectPicker.evaluate((element) => element.tagName), "DIV");
    assert.equal(await effectPicker.locator("select").count(), 0);
    assert.equal(await effectPicker.getByRole("button").count(), 4);
    assert.equal(await effectPicker.locator("button > svg").count(), 4);
    assert.equal(await effectPicker.getByRole("button", { name: "Crusher", exact: true }).getAttribute("aria-pressed"), "true");

    const tapeStopButton = effectPicker.getByRole("button", { name: "Tape Stop", exact: true });
    const buttonChrome = await tapeStopButton.evaluate((button) => {
        const styles = getComputedStyle(button);
        return {
            backgroundColor: styles.backgroundColor,
            borderTopStyle: styles.borderTopStyle,
        };
    });
    assert.deepEqual(buttonChrome, { backgroundColor: "rgba(0, 0, 0, 0)", borderTopStyle: "none" });
    await tapeStopButton.click();
    assert.equal(await tapeStopButton.getAttribute("aria-pressed"), "true");

    await page.getByRole("button", { name: "Chain 2 Tape Stop block 1", exact: true }).waitFor();
    const snapshot = await getHarnessSnapshot(page);
    const uploads = patternUploads(snapshot);
    assert.equal(uploads.length, 1);
    const upload = uploads.at(-1).value;
    assert.equal(upload.effectTypes[1][0], SEQFX_EFFECT_TYPES.tapeStop);
    assert.deepEqual(upload.params[1][0].slice(0, 5), [1, 1, 1, 25, 0]);

    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedStep = storedState.patterns[0].lanes[1].steps[0];
    assert.equal(storedStep.active, true);
    assert.equal(storedStep.effectType, SEQFX_EFFECT_TYPES.tapeStop);
    assert.deepEqual(storedStep.params.slice(0, 5), [1, 1, 1, 25, 0]);

    await page.close();
});

test("seqfx_blocks_use_a_single_clean_surface_with_hidden_resize_chrome", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    const block = page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true });
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

    await page.getByRole("button", { name: "Chain 4 step 5", exact: true }).click();
    await page.getByRole("button", { name: "Chain 4 Stutter block 5", exact: true }).dblclick();

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

    await page.getByRole("button", { name: "Chain 1 step 2", exact: true }).click();
    const resizeHandle = page.locator('[data-role="seqfx-block-resize"][data-lane="0"][data-start="1"]');
    await resizeHandle.waitFor();
    const handleBox = await resizeHandle.boundingBox();
    const thirdCellBox = await page.getByRole("button", { name: "Chain 1 step 4", exact: true }).boundingBox();
    assert.ok(handleBox);
    assert.ok(thirdCellBox);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(thirdCellBox.x + thirdCellBox.width - 2, thirdCellBox.y + thirdCellBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const movedBlock = page.getByRole("button", { name: "Chain 1 Filter block 2-4", exact: true });
    await movedBlock.waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const movedBlockBox = await movedBlock.boundingBox();
    const targetCellBox = await page.getByRole("button", { name: "Chain 1 step 7", exact: true }).boundingBox();
    assert.ok(movedBlockBox);
    assert.ok(targetCellBox);

    await page.mouse.move(movedBlockBox.x + movedBlockBox.width * 0.15, movedBlockBox.y + movedBlockBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetCellBox.x + targetCellBox.width * 0.15, targetCellBox.y + targetCellBox.height / 2, { steps: 10 });
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 1);
    const moveUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(moveUpload.activeSteps[0].slice(1, 4), [false, false, false]);
    assert.deepEqual(moveUpload.activeSteps[0].slice(6, 9), [true, true, true]);
    assert.deepEqual(moveUpload.triggerSteps[0].slice(6, 9), [true, false, false]);
    await page.getByRole("button", { name: "Chain 1 Filter block 7-9", exact: true }).waitFor();

    await page.close();
});

test("seqfx_dragging_block_body_between_chains_moves_once_on_release", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 2", exact: true }).click();
    await resizeBlockToStep(page, 0, 2, 3);
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const sourceBlock = page.getByRole("button", { name: "Chain 1 Filter block 2-3", exact: true });
    const sourceBox = await sourceBlock.boundingBox();
    const targetBox = await page.getByRole("button", { name: "Chain 3 step 8", exact: true }).boundingBox();
    assert.ok(sourceBox);
    assert.ok(targetBox);

    await page.mouse.move(sourceBox.x + sourceBox.width * 0.15, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width * 0.15, targetBox.y + targetBox.height / 2, { steps: 12 });
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 1);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.activeSteps[0].slice(1, 3), [false, false]);
    assert.deepEqual(upload.activeSteps[2].slice(7, 9), [true, true]);
    assert.deepEqual(upload.triggerSteps[2].slice(7, 9), [true, false]);
    assert.deepEqual(upload.effectTypes[2].slice(7, 9), [
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.filter,
    ]);
    await page.getByRole("button", { name: "Chain 3 Filter block 8-9", exact: true }).waitFor();

    await page.close();
});

test("seqfx_cross_chain_move_release_on_occupied_target_rejects_without_committing_stale_preview", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 2", exact: true }).click();
    await page.getByRole("button", { name: "Chain 3 step 2", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const sourceBlock = page.getByRole("button", { name: "Chain 1 Filter block 2", exact: true });
    const sourceBox = await sourceBlock.boundingBox();
    const validTargetBox = await page.getByRole("button", { name: "Chain 3 step 8", exact: true }).boundingBox();
    const occupiedTargetBox = await page.getByRole("button", { name: "Chain 3 step 2", exact: true }).boundingBox();
    assert.ok(sourceBox);
    assert.ok(validTargetBox);
    assert.ok(occupiedTargetBox);

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(validTargetBox.x + validTargetBox.width / 2, validTargetBox.y + validTargetBox.height / 2, { steps: 8 });
    await page.getByRole("button", { name: "Chain 3 Filter block 8", exact: true }).waitFor();
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);

    await page.mouse.move(occupiedTargetBox.x + occupiedTargetBox.width / 2, occupiedTargetBox.y + occupiedTargetBox.height / 2, { steps: 8 });
    await page.locator('[data-role="seqfx-invalid-drop"][data-lane="2"][data-start="1"]').waitFor();
    await page.mouse.up();

    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    assert.equal(await page.locator('[data-role="seqfx-invalid-drop"]').count(), 0);
    await page.getByRole("button", { name: "Chain 1 Filter block 2", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 3 Tape Stop block 2", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Chain 3 Filter block 8", exact: true }).waitFor({ timeout: 300 }),
    );

    await page.close();
});

test("seqfx_option_drag_previews_copy_paint_and_commits_once_on_release", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    const block = page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true });
    await block.waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const blockBox = await block.boundingBox();
    const thirdCellBox = await page.getByRole("button", { name: "Chain 2 step 3", exact: true }).boundingBox();
    const fifthCellBox = await page.getByRole("button", { name: "Chain 2 step 5", exact: true }).boundingBox();
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
    await page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 2 Crusher block 2", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 2 Crusher block 3", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Chain 2 Crusher block 4", exact: true }).waitFor({ timeout: 300 }),
    );
    await assert.rejects(
        page.getByRole("button", { name: "Chain 2 Crusher block 5", exact: true }).waitFor({ timeout: 300 }),
    );

    await page.close();
});

test("seqfx_option_dragging_one_block_between_chains_copies_without_removing_source", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 4", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const sourceBlock = page.getByRole("button", { name: "Chain 1 Filter block 4", exact: true });
    const sourceBox = await sourceBlock.boundingBox();
    const targetBox = await page.getByRole("button", { name: "Chain 4 step 10", exact: true }).boundingBox();
    assert.ok(sourceBox);
    assert.ok(targetBox);

    await page.keyboard.down("Alt");
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" })));
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });

    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"][data-preview="true"][data-lane="3"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "9"
    ));
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);

    await page.mouse.up();
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" })));
    await page.keyboard.up("Alt");

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 1);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.activeSteps[0][3], true);
    assert.equal(upload.activeSteps[3][9], true);
    assert.equal(upload.effectTypes[3][9], SEQFX_EFFECT_TYPES.filter);
    await page.getByRole("button", { name: "Chain 1 Filter block 4", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 4 Filter block 10", exact: true }).waitFor();

    await page.close();
});

test("seqfx_option_dragging_selected_blocks_between_chains_copies_the_group", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 5]) {
        await page.getByRole("button", { name: `Chain 2 step ${step}`, exact: true }).click();
    }
    await page.getByRole("button", { name: "Chain 2 Crusher block 2", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crusher block 5", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="1"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,4"
    ));
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const anchorBlock = page.getByRole("button", { name: "Chain 2 Crusher block 2", exact: true });
    const anchorBox = await anchorBlock.boundingBox();
    const targetBox = await page.getByRole("button", { name: "Chain 4 step 9", exact: true }).boundingBox();
    assert.ok(anchorBox);
    assert.ok(targetBox);

    await page.keyboard.down("Alt");
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" })));
    await page.mouse.move(anchorBox.x + anchorBox.width * 0.15, anchorBox.y + anchorBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width * 0.15, targetBox.y + targetBox.height / 2, { steps: 12 });

    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"][data-preview="true"][data-lane="3"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "8,11"
    ));
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);

    await page.mouse.up();
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" })));
    await page.keyboard.up("Alt");

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 1);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual([upload.activeSteps[1][1], upload.activeSteps[1][4]], [true, true]);
    assert.deepEqual([upload.activeSteps[3][8], upload.activeSteps[3][11]], [true, true]);
    assert.deepEqual([upload.effectTypes[3][8], upload.effectTypes[3][11]], [
        SEQFX_EFFECT_TYPES.crusher,
        SEQFX_EFFECT_TYPES.crusher,
    ]);
    await page.getByRole("button", { name: "Chain 4 Crusher block 9", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 4 Crusher block 12", exact: true }).waitFor();

    await page.close();
});

test("seqfx_selected_active_blocks_drag_between_chains_as_a_group", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 5, 9]) {
        await page.getByRole("button", { name: `Chain 1 step ${step}`, exact: true }).click();
    }
    await page.getByRole("button", { name: "Chain 1 Filter block 2", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Filter block 5", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="0"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,4"
    ));
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const anchorBlock = page.getByRole("button", { name: "Chain 1 Filter block 2", exact: true });
    const anchorBox = await anchorBlock.boundingBox();
    const targetBox = await page.getByRole("button", { name: "Chain 3 step 9", exact: true }).boundingBox();
    assert.ok(anchorBox);
    assert.ok(targetBox);

    await page.mouse.move(anchorBox.x + anchorBox.width / 2, anchorBox.y + anchorBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 1);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual([upload.activeSteps[0][1], upload.activeSteps[0][4], upload.activeSteps[0][8]], [false, false, true]);
    assert.deepEqual([upload.activeSteps[2][8], upload.activeSteps[2][11]], [true, true]);
    assert.deepEqual([upload.effectTypes[2][8], upload.effectTypes[2][11]], [
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.filter,
    ]);
    await page.getByRole("button", { name: "Chain 3 Filter block 9", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 3 Filter block 12", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 1 Filter block 9", exact: true }).waitFor();

    await page.close();
});

test("seqfx_cross_chain_copy_drop_on_occupied_target_shows_reject_feedback_and_does_not_commit", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 2", exact: true }).click();
    await page.getByRole("button", { name: "Chain 3 step 2", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const sourceBlock = page.getByRole("button", { name: "Chain 1 Filter block 2", exact: true });
    const sourceBox = await sourceBlock.boundingBox();
    const occupiedTargetBox = await page.getByRole("button", { name: "Chain 3 step 2", exact: true }).boundingBox();
    assert.ok(sourceBox);
    assert.ok(occupiedTargetBox);

    await page.keyboard.down("Alt");
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" })));
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(occupiedTargetBox.x + occupiedTargetBox.width / 2, occupiedTargetBox.y + occupiedTargetBox.height / 2, { steps: 8 });

    await page.locator('[data-role="seqfx-invalid-drop"][data-lane="2"][data-start="1"]').waitFor();
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);

    await page.mouse.up();
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" })));
    await page.keyboard.up("Alt");

    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    assert.equal(await page.locator('[data-role="seqfx-invalid-drop"]').count(), 0);
    await page.getByRole("button", { name: "Chain 1 Filter block 2", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 3 Tape Stop block 2", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Chain 3 Filter block 2", exact: true }).waitFor({ timeout: 300 }),
    );

    await page.close();
});

test("seqfx_shift_click_selects_active_blocks_and_edits_or_deletes_the_group", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 4, 7, 11]) {
        await page.getByRole("button", { name: `Chain 2 step ${step}`, exact: true }).click();
    }
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 2 Crusher block 2", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crusher block 7", exact: true }).click({ modifiers: ["Shift"] });

    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="1"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,3,6"
    ));

    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-bits"]'), 5);

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
        page.getByRole("button", { name: "Chain 2 Crusher block 2", exact: true }).waitFor({ timeout: 300 }),
    );
    await page.getByRole("button", { name: "Chain 2 Crusher block 11", exact: true }).waitFor();

    await page.close();
});

test("seqfx_cmd_c_and_cmd_v_copy_cell_values_to_single_or_group_selection", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 5, 8]) {
        await page.getByRole("button", { name: `Chain 2 step ${step}`, exact: true }).click();
    }

    await page.getByRole("button", { name: "Chain 2 Crusher block 2", exact: true }).click();
    await setRangeInputValue(page.locator('[data-role="seqfx-mix"]'), 0.42);
    await setCrusherEditorValues(page, { bits: 5, holdFrames: 7, driveDb: 12 });

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.getByRole("button", { name: "Chain 2 Crusher block 2", exact: true }).click();
    await pressMetaShortcut(page, "KeyC");

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-param"][data-param="4"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.locator('[data-role="seqfx-param"][data-param="4"]').focus();
    await pressMetaShortcut(page, "KeyV");
    let snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 0);

    await page.getByRole("button", { name: "Chain 2 Crusher block 5", exact: true }).click();
    await pressMetaShortcut(page, "KeyV");

    snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.params[1][4].slice(0, 3), [5, 7, 12]);
    assert.equal(upload.mix[1][4], 0.42);
    assert.deepEqual(upload.params[1][7].slice(0, 3), [8, 1, 0]);
    assert.equal(upload.mix[1][7], 1);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.getByRole("button", { name: "Chain 2 Crusher block 5", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crusher block 8", exact: true }).click({ modifiers: ["Shift"] });
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
        await page.getByRole("button", { name: `Chain 2 step ${step}`, exact: true }).click();
    }

    await page.getByRole("button", { name: "Chain 2 Crusher block 2", exact: true }).click();
    await setRangeInputValue(page.locator('[data-role="seqfx-mix"]'), 0.37);
    await setCrusherEditorValues(page, { bits: 6, holdFrames: 9, driveDb: 15 });

    const copyResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-block"][data-lane="1"][data-start="1"]',
        "copy",
    );
    assert.deepEqual(copyResult, { defaultPrevented: true, dispatchResult: false });

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-param"][data-param="4"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const ignoredPasteResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-param"][data-param="4"]',
        "paste",
    );
    assert.deepEqual(ignoredPasteResult, { defaultPrevented: false, dispatchResult: true });
    let snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 0);

    await page.getByRole("button", { name: "Chain 2 Crusher block 5", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
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
    await page.getByRole("button", { name: "Chain 2 Crusher block 5", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crusher block 8", exact: true }).click({ modifiers: ["Shift"] });
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
        await page.getByRole("button", { name: `Chain 1 step ${step}`, exact: true }).click();
    }
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 Filter block 2", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Filter block 7", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="0"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,3,6"
    ));

    const anchorBlock = page.getByRole("button", { name: "Chain 1 Filter block 4", exact: true });
    const anchorBox = await anchorBlock.boundingBox();
    const targetBox = await page.getByRole("button", { name: "Chain 1 step 6", exact: true }).boundingBox();
    assert.ok(anchorBox);
    assert.ok(targetBox);

    await page.mouse.move(anchorBox.x + anchorBox.width / 2, anchorBox.y + anchorBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 1);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.activeSteps[0].slice(0, 13), [
        false, false, false, true, false, true, false, false, true, false, true, false, false,
    ]);
    await page.getByRole("button", { name: "Chain 1 Filter block 4", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 1 Filter block 6", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 1 Filter block 9", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 1 Filter block 11", exact: true }).waitFor();

    await page.close();
});

test("seqfx_double_clicking_a_selected_block_deletes_the_selected_group", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 5, 9]) {
        await page.getByRole("button", { name: `Chain 4 step ${step}`, exact: true }).click();
    }
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 4 Stutter block 2", exact: true }).click();
    await page.getByRole("button", { name: "Chain 4 Stutter block 5", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="3"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,4"
    ));

    await page.getByRole("button", { name: "Chain 4 Stutter block 2", exact: true }).dblclick();

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.activeSteps[3].slice(0, 10), [
        false, false, false, false, false, false, false, false, true, false,
    ]);
    await assert.rejects(
        page.getByRole("button", { name: "Chain 4 Stutter block 2", exact: true }).waitFor({ timeout: 300 }),
    );
    await assert.rejects(
        page.getByRole("button", { name: "Chain 4 Stutter block 5", exact: true }).waitFor({ timeout: 300 }),
    );
    await page.getByRole("button", { name: "Chain 4 Stutter block 9", exact: true }).waitFor();

    await page.close();
});

test("seqfx_selected_multi_step_blocks_edit_and_drag_as_whole_blocks", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 2", exact: true }).click();
    await resizeBlockToStep(page, 0, 2, 4);
    await page.getByRole("button", { name: "Chain 1 step 8", exact: true }).click();
    await resizeBlockToStep(page, 0, 8, 9);
    await page.getByRole("button", { name: "Chain 1 step 22", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 Filter block 2-4", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Filter block 8-9", exact: true }).click({ modifiers: ["Shift"] });
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
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const anchorBox = await page.getByRole("button", { name: "Chain 1 Filter block 2-4", exact: true }).boundingBox();
    const targetBox = await page.getByRole("button", { name: "Chain 1 step 11", exact: true }).boundingBox();
    assert.ok(anchorBox);
    assert.ok(targetBox);

    await page.mouse.move(anchorBox.x + anchorBox.width * 0.15, anchorBox.y + anchorBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width * 0.15, targetBox.y + targetBox.height / 2, { steps: 12 });
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    await page.mouse.up();

    snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 1);
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
    await page.getByRole("button", { name: "Chain 1 Filter block 11-13", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 1 Filter block 17-18", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 1 Filter block 22", exact: true }).waitFor();

    await page.close();
});

test("seqfx_keyboard_activation_creates_and_selects_grid_blocks", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const filterStep = page.getByRole("button", { name: "Chain 1 step 5", exact: true });
    await filterStep.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Chain 1 Filter block 5", exact: true }).waitFor();

    let snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).at(-1).value.activeSteps[0][4], true);

    await page.getByRole("button", { name: "Chain 1 step 9", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Chain 1 Filter block 9", exact: true }).waitFor();

    snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).at(-1).value.activeSteps[0][8], true);
    await page.locator('[data-role="seqfx-inspector"]').getByText("Chain 1 step 9").waitFor();

    await page.close();
});
