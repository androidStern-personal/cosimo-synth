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
const SEQFX_STATE_KEY = "seqfx.v6";
const SEQFX_SNAPSHOT_BANK_STATE_KEY = "cosimo.effectSnapshotBank.seqfx.v1";
const SEQFX_NORMAL_GAP_PX = 3;
const SEQFX_BEAT_GAP_PX = 9;
const SEQFX_MIN_CELL_SIZE_PX = 12;
const SEQFX_GRID_STEPS_PER_ROW = 16;
const SEQFX_EFFECT_TYPES = {
    filter: 1,
    crusher: 2,
    tapeStop: 3,
    stutter: 4,
};
const CRUSHER_PARAM_DRIVE_DB = 2;
const STUTTER_PARAM_SLICES = 0;
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
    const stepInRow = step % SEQFX_GRID_STEPS_PER_ROW;
    if (stepInRow >= SEQFX_GRID_STEPS_PER_ROW - 1) {
        return 0;
    }

    return (stepInRow + 1) % cellsPerBeat === 0 ? SEQFX_BEAT_GAP_PX : SEQFX_NORMAL_GAP_PX;
}

function expectedGridGeometry(trackWidth, cellsPerBeat) {
    const totalGapWidth = Array.from({ length: SEQFX_GRID_STEPS_PER_ROW - 1 }, (_unused, step) => (
        gapAfterStep(step, cellsPerBeat)
    )).reduce((sum, gap) => sum + gap, 0);
    const cellSize = Math.max(
        SEQFX_MIN_CELL_SIZE_PX,
        Number(((trackWidth - totalGapWidth) / SEQFX_GRID_STEPS_PER_ROW).toFixed(4)),
    );
    const lefts = [];
    let cursor = 0;

    for (let step = 0; step < SEQFX_GRID_STEPS_PER_ROW; step += 1) {
        lefts.push(cursor);
        cursor += cellSize + gapAfterStep(step, cellsPerBeat);
    }

    return {
        cellSize,
        lefts: Array.from({ length: SEQFX_STEP_COUNT }, (_unused, step) => lefts[step % SEQFX_GRID_STEPS_PER_ROW]),
        trackWidth: (cellSize * SEQFX_GRID_STEPS_PER_ROW) + totalGapWidth,
    };
}

function pathPointsFromD(pathData) {
    const values = [...pathData.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    const points = [];

    for (let index = 0; index < values.length; index += 2) {
        points.push({ x: values[index], y: values[index + 1] });
    }

    return points;
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

async function pressSliderKey(locator, key) {
    await locator.focus();
    await locator.press(key);
}

async function setCrusherEditorValues(page, { bits, holdFrames, driveDb }) {
    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-bits"]'), bits);
    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-hold-frames"]'), holdFrames);
    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-drive-db"]'), driveDb);
}

async function openSeqFxModView(page) {
    const modToggle = page.locator('[data-role="seqfx-mod-toggle"]');
    await modToggle.waitFor();
    await modToggle.click();
    await page.locator('[data-role="seqfx-mod-editor"]').waitFor();
    return modToggle;
}

async function toggleSeqFxModTarget(page, paramIndex) {
    await page.locator(`[data-role="seqfx-mod-target-toggle"][data-param="${paramIndex}"]`).click();
}

async function setSeqFxModTargetAmount(page, paramIndex, amount) {
    await page.locator(`[data-role="seqfx-mod-target-amount"][data-param="${paramIndex}"]`).evaluate((node, nextAmount) => {
        const minAmount = Number(node.getAttribute("data-amount-min"));
        const maxAmount = Number(node.getAttribute("data-amount-max"));
        const normalized = nextAmount >= 0
            ? (maxAmount > 0 ? nextAmount / maxAmount : 0)
            : (minAmount < 0 ? nextAmount / Math.abs(minAmount) : 0);
        const clamped = Math.min(1, Math.max(-1, normalized));
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(node, String(clamped));
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
    }, amount);
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
    const hoveredEffectOption = page.locator('[data-role="seqfx-effect-type-option"][data-effect-type="2"]');
    await hoveredEffectOption.hover({ force: true });
    await page.waitForFunction(() => (
        document.querySelector('[data-role="seqfx-effect-type-option"][data-effect-type="2"]')?.matches(":hover") ?? false
    ));

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
        const presetRow = document.querySelector(".seqfx-preset-row");
        const gridShellStyle = getComputedStyle(document.querySelector(".seqfx-grid-shell"));
        const inspectorStyle = getComputedStyle(document.querySelector('[data-role="seqfx-inspector"]'));
        const effectHeader = presetRow?.querySelector("cosimo-effect-header");
        const snapshotBar = effectHeader?.shadowRoot?.querySelector("cosimo-snapshot-bar");
        const snapshotLabel = snapshotBar?.shadowRoot?.querySelector(".snapshot-label");
        const selectedEffectButton = document.querySelector(".seqfx-effect-picker__options button.is-selected");
        const selectedEffectIcon = selectedEffectButton?.querySelector("svg");
        const hoveredEffectButton = document.querySelector('[data-role="seqfx-effect-type-option"][data-effect-type="2"]');
        const hoveredEffectIcon = hoveredEffectButton?.querySelector("svg");

        return {
            drawControlCount: document.querySelectorAll('[data-role="seqfx-draw-effect"], .seqfx-draw-effect').length,
            grid: rectFor(".seqfx-grid-shell"),
            gridBackgroundColor: gridShellStyle.backgroundColor,
            gridBorderTopStyle: gridShellStyle.borderTopStyle,
            gridPaddingLeft: parseFloat(gridShellStyle.paddingLeft),
            gridPaddingRight: parseFloat(gridShellStyle.paddingRight),
            hoveredEffectIconColor: hoveredEffectIcon ? getComputedStyle(hoveredEffectIcon).color : "",
            hoveredEffectIconFilter: hoveredEffectIcon ? getComputedStyle(hoveredEffectIcon).filter : "",
            inspectorHeading: rectFor(".seqfx-inspector-heading strong"),
            inspectorHeadingFontSize: inspectorHeading ? getComputedStyle(inspectorHeading).fontSize : null,
            inspectorBorderTopStyle: inspectorStyle.borderTopStyle,
            laneLabelDisplay: getComputedStyle(document.querySelector(".seqfx-lane-label")).display,
            laneTrack: rectFor(".seqfx-lane-track"),
            lastPatternRight: patternRects.at(-1)?.right ?? null,
            patternButtonCount: patternTops.length,
            patternRowCount: new Set(patternTops).size,
            patterns: rectFor(".seqfx-patterns"),
            presetRowBackgroundColor: getComputedStyle(presetRow).backgroundColor,
            presetRow: rectFor(".seqfx-preset-row"),
            rootBackgroundColor: getComputedStyle(document.querySelector('[data-role="seqfx-root"]')).backgroundColor,
            rootPadding: getComputedStyle(document.querySelector('[data-role="seqfx-root"]')).padding,
            rootScrollWidth: document.documentElement.scrollWidth,
            selectedEffectIconColor: selectedEffectIcon ? getComputedStyle(selectedEffectIcon).color : "",
            selectedEffectIconFilter: selectedEffectIcon ? getComputedStyle(selectedEffectIcon).filter : "",
            snapshotCameraIconCount: snapshotLabel?.querySelectorAll(".snapshot-camera-icon").length ?? 0,
            snapshotLabelText: snapshotLabel?.textContent?.trim() ?? null,
            title: rectFor(".seqfx-title"),
            topbarText: topbar?.textContent ?? "",
            topbar: rectFor(".seqfx-topbar"),
            transportControlCount: document.querySelectorAll('.seqfx-transport, [aria-label="Internal clock"]').length,
            viewportWidth: window.innerWidth,
        };
    });

    assert.equal(layout.drawControlCount, 0);
    assert.equal(layout.transportControlCount, 0);
    assert.equal(layout.rootBackgroundColor, "rgb(228, 222, 211)");
    assert.equal(layout.presetRowBackgroundColor, "rgb(16, 25, 35)");
    assert.equal(layout.rootPadding, "0px");
    assert.equal(layout.gridBackgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(layout.gridBorderTopStyle, "none");
    assert.equal(layout.inspectorBorderTopStyle, "none");
    assert.equal(layout.selectedEffectIconColor, "rgb(242, 209, 107)");
    assert.match(layout.selectedEffectIconFilter, /drop-shadow/);
    assert.equal(layout.hoveredEffectIconColor, "rgb(0, 180, 216)");
    assert.match(layout.hoveredEffectIconFilter, /drop-shadow/);
    assert.ok(layout.presetRow.top <= 0.5, `preset row should touch the top edge, got ${layout.presetRow.top}px`);
    assert.ok(layout.presetRow.left <= 0.5, `preset row should touch the left edge, got ${layout.presetRow.left}px`);
    assert.ok(layout.presetRow.right >= layout.viewportWidth - 0.5, `preset row should touch the right edge, got ${layout.presetRow.right}px`);
    assert.equal(layout.snapshotLabelText, "");
    assert.equal(layout.snapshotCameraIconCount, 1);
    assert.equal(layout.topbarText.includes("Cosimo"), false);
    assert.equal(layout.patternButtonCount, 12);
    assert.equal(layout.patternRowCount, 1);
    assert.ok(layout.topbar.height <= 42, `expected compact topbar, got ${layout.topbar.height}px`);
    assert.ok(layout.patterns.left >= layout.title.right, "pattern buttons should sit to the right of the title");
    assert.ok(layout.lastPatternRight <= layout.patterns.right + 1, "all pattern buttons should be visible at 567px");
    assert.equal(layout.laneLabelDisplay, "none");
    assertClose(layout.laneTrack.left - layout.grid.left, layout.gridPaddingLeft, 1, "grid cells should start after the reserved frame padding");
    assertClose(layout.grid.right - layout.laneTrack.right, layout.gridPaddingRight, 1, "grid cells should end before the reserved frame padding");
    assert.ok(layout.rootScrollWidth <= layout.viewportWidth + 1, `page should not gain horizontal overflow, got ${layout.rootScrollWidth}px for ${layout.viewportWidth}px viewport`);
    assert.equal(layout.inspectorHeadingFontSize, "13px");
    assert.ok(layout.inspectorHeading.height <= 18, `expected compact inspector heading, got ${layout.inspectorHeading.height}px`);

    await page.close();
});

test("seqfx_grid_resizes_with_css_after_viewport_round_trip", async () => {
    const page = await browser.newPage({ viewport: { width: 567, height: 776 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const measureGrid = () => page.evaluate(() => {
        const cell = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="0"]');
        const laneTrack = document.querySelector(".seqfx-lane-track");
        const stepTrack = document.querySelector(".seqfx-step-track");
        const shell = document.querySelector(".seqfx-grid-shell");
        const cellRect = cell.getBoundingClientRect();
        const laneRect = laneTrack.getBoundingClientRect();

        return {
            cellWidth: cellRect.width,
            laneTrackDisplay: getComputedStyle(laneTrack).display,
            laneTrackInlineStyle: laneTrack.getAttribute("style") ?? "",
            laneTrackWidth: laneRect.width,
            shellClientWidth: shell.clientWidth,
            shellScrollWidth: shell.scrollWidth,
            stepTrackDisplay: getComputedStyle(stepTrack).display,
            stepTrackInlineStyle: stepTrack.getAttribute("style") ?? "",
        };
    });

    const initial = await measureGrid();
    await page.setViewportSize({ width: 840, height: 776 });
    await page.waitForFunction((initialCellWidth) => {
        const cell = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="0"]');
        return cell && cell.getBoundingClientRect().width > initialCellWidth + 4;
    }, initial.cellWidth);
    const grown = await measureGrid();

    await page.setViewportSize({ width: 567, height: 776 });
    await page.waitForFunction((initialCellWidth) => {
        const cell = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="0"]');
        return cell && Math.abs(cell.getBoundingClientRect().width - initialCellWidth) <= 1;
    }, initial.cellWidth);
    const shrunk = await measureGrid();

    assert.equal(initial.laneTrackDisplay, "grid");
    assert.equal(initial.stepTrackDisplay, "grid");
    assert.equal(initial.laneTrackInlineStyle.includes("min-width"), false);
    assert.equal(initial.stepTrackInlineStyle.includes("min-width"), false);
    assert.ok(grown.cellWidth > initial.cellWidth + 4, "grid cells should grow with the viewport");
    assertClose(shrunk.cellWidth, initial.cellWidth, 1, "grid cells should shrink back after viewport round trip");
    assertClose(shrunk.laneTrackWidth, initial.laneTrackWidth, 1, "track width should shrink back after viewport round trip");
    assert.ok(shrunk.shellScrollWidth <= shrunk.shellClientWidth + 1, "grid should not keep stale expanded scroll width");

    await page.close();
});

test("seqfx_rate_one_grid_uses_beat_gutters_and_per_cell_bar_fill", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const trackBox = await page.locator('.seqfx-lane-track').first().boundingBox();
    assert.ok(trackBox);
    const expected = expectedGridGeometry(trackBox.width, 4);

    for (const step of [0, 1, 3, 4, 15, 16, 17, 19, 20, 31]) {
        const box = await boundingBoxForCell(page, 0, step);
        assertClose(box.x - trackBox.x, expected.lefts[step], 1, `step ${step + 1} x position`);
        assertClose(box.width, expected.cellSize, 1, `step ${step + 1} width`);
        assertClose(box.height, expected.cellSize, 1, `step ${step + 1} height`);
    }

    const step1 = await boundingBoxForCell(page, 0, 0);
    const step2 = await boundingBoxForCell(page, 0, 1);
    const step3 = await boundingBoxForCell(page, 0, 2);
    const step4 = await boundingBoxForCell(page, 0, 3);
    const step5 = await boundingBoxForCell(page, 0, 4);
    const step16 = await boundingBoxForCell(page, 0, 15);
    const step17 = await boundingBoxForCell(page, 0, 16);
    const step20 = await boundingBoxForCell(page, 0, 19);
    const step21 = await boundingBoxForCell(page, 0, 20);
    const step32 = await boundingBoxForCell(page, 0, 31);
    assertClose(step3.x - (step2.x + step2.width), SEQFX_NORMAL_GAP_PX, 1, "ordinary within-beat gutter");
    assertClose(step5.x - (step4.x + step4.width), SEQFX_BEAT_GAP_PX, 1, "beat-boundary gutter");
    assertClose(step21.x - (step20.x + step20.width), SEQFX_BEAT_GAP_PX, 1, "second-row beat-boundary gutter");
    assertClose(step17.x, step1.x, 1, "step 17 should start the second row at the same x as step 1");
    assertClose(step32.x, step16.x, 1, "step 32 should end the second row at the same x as step 16");
    assert.ok(step17.y > step1.y + step1.height, "steps 17-32 should render on a second row");

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
    const alternateBarSample = await boundingBoxForCell(page, 1, 16);
    const evenCell = pixelAt(screenshot, trackBox.x + expected.lefts[0] + (expected.cellSize / 2), sampleY);
    const oddCell = pixelAt(screenshot, alternateBarSample.x + (alternateBarSample.width / 2), alternateBarSample.y + (alternateBarSample.height / 2));
    const rowOneBeatGutter = pixelAt(
        screenshot,
        trackBox.x + expected.lefts[3] + expected.cellSize + (SEQFX_BEAT_GAP_PX / 2),
        sampleY,
    );

    assert.ok(colorDistance(evenCell, oddCell) >= 4, "alternate-bar cell fill should differ from ordinary cell fill");
    assert.ok(colorDistance(rowOneBeatGutter, evenCell) >= 2, "beat-boundary gutter should not use ordinary cell fill");

    await page.close();
});

test("seqfx_bar_frames_sit_behind_both_bars_with_arrow_only_on_first_bar", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.waitForFunction(() => {
        const frame = document.querySelector('[data-role="seqfx-bar-frame"][data-bar="0"]');
        const lanes = document.querySelector('[data-role="seqfx-bar-lanes"][data-bar="0"]');
        if (!frame || !lanes) return false;
        return Math.abs(frame.getBoundingClientRect().width - (lanes.getBoundingClientRect().width + 32)) < 1;
    });
    await page.waitForFunction(() => {
        const frame = document.querySelector('[data-role="seqfx-bar-frame"][data-bar="1"]');
        const lanes = document.querySelector('[data-role="seqfx-bar-lanes"][data-bar="1"]');
        if (!frame || !lanes) return false;
        return Math.abs(frame.getBoundingClientRect().width - (lanes.getBoundingClientRect().width + 32)) < 1;
    });

    const frame = page.locator('[data-role="seqfx-bar-frame"]');
    assert.equal(await frame.count(), 2, "bar frames should render for both visible bars");

    const layout = await page.evaluate(() => {
        const frameElement = document.querySelector('[data-role="seqfx-bar-frame"][data-bar="0"]');
        const secondFrameElement = document.querySelector('[data-role="seqfx-bar-frame"][data-bar="1"]');
        const barOne = document.querySelector('[data-role="seqfx-bar-section"][data-bar="0"]');
        const barTwo = document.querySelector('[data-role="seqfx-bar-section"][data-bar="1"]');
        const gridShell = document.querySelector(".seqfx-grid-shell");
        const barLanes = document.querySelector('[data-role="seqfx-bar-lanes"][data-bar="0"]');
        const secondBarLanes = document.querySelector('[data-role="seqfx-bar-lanes"][data-bar="1"]');
        const firstCell = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="0"]');
        const stepHeader = document.querySelector('[data-role="seqfx-bar-section"][data-bar="0"] .seqfx-step-header');
        const laneRow = document.querySelector('[data-role="seqfx-bar-section"][data-bar="0"] .seqfx-lane-row');
        const svg = frameElement.querySelector(".seqfx-bar-frame__svg");
        const inner = document.querySelector('[data-role="seqfx-bar-frame-inner"]');
        const outer = document.querySelector(".seqfx-bar-frame__outer");
        const arrow = document.querySelector('[data-role="seqfx-bar-frame-outer-arrow"]');
        const plate = document.querySelector('[data-role="seqfx-bar-frame-plate"]');
        const plateFilter = document.querySelector("#seqfx-bar-frame-plate-material-0");
        const secondInner = secondFrameElement.querySelector('[data-role="seqfx-bar-frame-inner"]');
        const secondOuter = secondFrameElement.querySelector('[data-role="seqfx-bar-frame-outer-body"]');
        const secondPlate = secondFrameElement.querySelector('[data-role="seqfx-bar-frame-plate"]');
        const secondPlateFilter = document.querySelector("#seqfx-bar-frame-plate-material-1");
        const rectFor = (node) => {
            const rect = node.getBoundingClientRect();
            return {
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width,
            };
        };

        const svgChildren = [...svg.children];
        const innerBox = inner.getBBox();
        const secondInnerBox = secondInner.getBBox();

        return {
            barOne: rectFor(barOne),
            barTwo: rectFor(barTwo),
            barTwoHasArrow: Boolean(barTwo.querySelector('[data-role="seqfx-bar-frame-outer-arrow"]')),
            barTwoHasFrame: Boolean(secondFrameElement),
            barTwoHasInnerFrame: Boolean(secondInner),
            cellStack: rectFor(barLanes),
            firstCellBorderTopStyle: getComputedStyle(firstCell).borderTopStyle,
            firstCellBoxShadow: getComputedStyle(firstCell).boxShadow,
            frame: rectFor(frameElement),
            frameHasArrow: frameElement.getAttribute("data-has-arrow") ?? "",
            framePointerEvents: getComputedStyle(frameElement).pointerEvents,
            frameTagName: frameElement.tagName,
            frameZIndex: Number(getComputedStyle(frameElement).zIndex),
            gridShell: rectFor(gridShell),
            gridShellPaddingBottom: parseFloat(getComputedStyle(gridShell).paddingBottom),
            innerPath: rectFor(inner),
            innerPathData: inner.getAttribute("d") ?? "",
            innerPathTagName: inner.tagName,
            innerStroke: getComputedStyle(inner).stroke,
            innerStrokeWidth: getComputedStyle(inner).strokeWidth,
            laneRowZIndex: Number(getComputedStyle(laneRow).zIndex),
            outerArrowPath: arrow.getAttribute("d") ?? "",
            outerPath: outer.getAttribute("d") ?? "",
            outerStroke: getComputedStyle(outer).stroke,
            outerStrokeWidth: getComputedStyle(outer).strokeWidth,
            plate: rectFor(plate),
            plateFillRule: plate.getAttribute("fill-rule") ?? plate.getAttribute("fillRule") ?? "",
            plateFilterAttribute: plate.getAttribute("filter") ?? "",
            plateFill: getComputedStyle(plate).fill,
            platePath: plate.getAttribute("d") ?? "",
            plateFilterExists: Boolean(plateFilter),
            plateFilterUnits: plateFilter.getAttribute("filterUnits") ?? "",
            plateLayersSitBehindGeometryPaths: svgChildren.indexOf(plate) < svgChildren.indexOf(outer),
            plateCoversTopBand: plate.isPointInFill(new DOMPoint(innerBox.x + (innerBox.width * 0.5), innerBox.y - 4)),
            plateDoesNotCoverCellHole: plate.isPointInFill(new DOMPoint(innerBox.x + (innerBox.width * 0.5), innerBox.y + (innerBox.height * 0.5))),
            secondCellStack: rectFor(secondBarLanes),
            secondFrame: rectFor(secondFrameElement),
            secondFrameHasArrow: secondFrameElement.getAttribute("data-has-arrow") ?? "",
            secondInnerPath: rectFor(secondInner),
            secondOuterPath: secondOuter.getAttribute("d") ?? "",
            secondPlateFilterAttribute: secondPlate.getAttribute("filter") ?? "",
            secondPlateFilterExists: Boolean(secondPlateFilter),
            secondPlatePath: secondPlate.getAttribute("d") ?? "",
            secondPlateCoversTopBand: secondPlate.isPointInFill(new DOMPoint(secondInnerBox.x + (secondInnerBox.width * 0.5), secondInnerBox.y - 4)),
            secondPlateDoesNotCoverCellHole: secondPlate.isPointInFill(new DOMPoint(secondInnerBox.x + (secondInnerBox.width * 0.5), secondInnerBox.y + (secondInnerBox.height * 0.5))),
            svg: rectFor(svg),
            svgDisplay: getComputedStyle(svg).display,
            stepHeaderZIndex: Number(getComputedStyle(stepHeader).zIndex),
        };
    });

    assert.equal(layout.barTwoHasFrame, true);
    assert.equal(layout.barTwoHasInnerFrame, true);
    assert.equal(layout.frameHasArrow, "true");
    assert.equal(layout.secondFrameHasArrow, "false");
    assert.equal(layout.barTwoHasArrow, false);
    assert.equal(layout.firstCellBorderTopStyle, "none");
    assert.notEqual(layout.firstCellBoxShadow, "none");
    assert.equal(layout.frameTagName, "DIV");
    assert.equal(layout.innerPathTagName, "path");
    assert.equal(layout.framePointerEvents, "none");
    assert.equal(layout.svgDisplay, "block");
    assertClose(layout.svg.width, layout.frame.width, 1, "inner SVG should fill the positioned frame wrapper");
    assertClose(layout.svg.height, layout.frame.height, 1, "inner SVG should fill the positioned frame wrapper");
    assert.ok(layout.frameZIndex < layout.stepHeaderZIndex, "frame should sit behind step numbers");
    assert.ok(layout.frameZIndex < layout.laneRowZIndex, "frame should sit behind cells and blocks");
    assert.ok(layout.frame.left < layout.barOne.left, "frame should extend left of the first bar cells");
    assert.ok(layout.frame.right > layout.barOne.right, "frame should extend right of the first bar cells");
    assert.ok(layout.frame.top < layout.barOne.top, "frame should extend above the first bar to make room for step numbers");
    assert.ok(layout.frame.bottom > layout.barOne.bottom, "frame arrow should protrude below the first bar into the bar gap");
    assert.ok(layout.innerPath.left < layout.cellStack.left, "inner outline should derive from the cell stack plus horizontal padding");
    assert.ok(layout.innerPath.right > layout.cellStack.right, "inner outline should derive from the cell stack plus horizontal padding");
    assert.ok(layout.innerPath.top < layout.cellStack.top, "inner outline should derive from the cell stack plus top padding");
    assert.ok(layout.innerPath.bottom > layout.cellStack.bottom, "inner outline should derive from the cell stack plus bottom padding");
    assert.equal(layout.outerStroke, "none");
    assert.equal(layout.innerStroke, "none");
    assert.equal(layout.outerStrokeWidth, "0px");
    assert.equal(layout.innerStrokeWidth, "0px");
    assert.match(layout.outerPath, /^M /);
    assert.match(layout.outerArrowPath, /^M /);
    assert.match(layout.platePath, /^M /);
    assert.ok(layout.platePath.includes(" Z M "), "plate should combine the outer silhouette with an inner hole");
    assert.equal(layout.plateFillRule, "evenodd");
    assert.notEqual(layout.plateFill, "none");
    assert.equal(layout.plateFilterAttribute, "url(#seqfx-bar-frame-plate-material-0)");
    assert.equal(layout.plateFilterExists, true);
    assert.equal(layout.plateFilterUnits, "userSpaceOnUse");
    assert.equal(layout.plateLayersSitBehindGeometryPaths, true);
    assert.equal(layout.plateCoversTopBand, true);
    assert.equal(layout.plateDoesNotCoverCellHole, false);
    assert.equal(layout.secondPlateFilterAttribute, "url(#seqfx-bar-frame-plate-material-1)");
    assert.equal(layout.secondPlateFilterExists, true);
    assert.match(layout.secondPlatePath, /^M /);
    assert.ok(layout.secondPlatePath.includes(" Z M "), "second plate should combine the outer silhouette with an inner hole");
    assert.ok(layout.secondOuterPath.endsWith("Z"), "second bar outer path should close instead of leaving room for an arrow");
    assert.equal(layout.secondPlateCoversTopBand, true);
    assert.equal(layout.secondPlateDoesNotCoverCellHole, false);
    assert.ok(layout.secondFrame.left < layout.barTwo.left, "second frame should extend left of the second bar cells");
    assert.ok(layout.secondFrame.right > layout.barTwo.right, "second frame should extend right of the second bar cells");
    assert.ok(layout.gridShell.bottom - layout.secondFrame.bottom >= 20, "grid shell should leave room for the second bar material shadow");
    assert.ok(layout.gridShellPaddingBottom >= 24, "grid shell bottom padding should protect the second bar material shadow from clipping");
    assert.ok(layout.secondInnerPath.left < layout.secondCellStack.left, "second inner outline should derive from the second cell stack plus horizontal padding");
    assert.ok(layout.secondInnerPath.right > layout.secondCellStack.right, "second inner outline should derive from the second cell stack plus horizontal padding");
    assert.ok(layout.secondInnerPath.top < layout.secondCellStack.top, "second inner outline should derive from the second cell stack plus top padding");
    assert.ok(layout.secondInnerPath.bottom > layout.secondCellStack.bottom, "second inner outline should derive from the second cell stack plus bottom padding");
    {
        const points = pathPointsFromD(layout.outerArrowPath);
        const shaftWidth = points[6].x - points[0].x;
        const headBaseWidth = points[4].x - points[2].x;
        const headHeight = points[3].y - points[2].y;

        assert.ok(shaftWidth <= 10, `expected a narrow arrow shaft, got ${shaftWidth}px`);
        assert.ok(headBaseWidth <= 30, `expected a narrow arrow head, got ${headBaseWidth}px`);
        assertClose(headHeight / headBaseWidth, Math.sqrt(3) / 2, 0.05, "arrow head should be close to equilateral");
    }
    {
        const outerPoints = pathPointsFromD(layout.outerPath);
        const innerPoints = pathPointsFromD(layout.innerPathData);
        const innerLeft = innerPoints[6].x;
        const innerRight = innerPoints[2].x;
        const innerBottom = innerPoints[5].y;
        const outerLeft = outerPoints[6].x;
        const outerRight = outerPoints[2].x;
        const outerBottom = outerPoints[1].y;
        const bottomGap = outerBottom - innerBottom;
        const leftGap = innerLeft - outerLeft;
        const rightGap = outerRight - innerRight;
        const leftInnerBevelDistance = innerPoints[5].x - innerLeft;
        const leftOuterBevelDistance = outerPoints[8].x - outerLeft;
        const rightInnerBevelDistance = innerRight - innerPoints[4].x;
        const rightOuterBevelDistance = outerRight - outerPoints[1].x;
        const expectedOuterBevelExpansion = bottomGap * (2 - Math.sqrt(2));
        const leftInnerDiagonal = innerPoints[5].y - innerPoints[5].x;
        const leftOuterDiagonal = outerPoints[8].y - outerPoints[8].x;
        const rightInnerDiagonal = innerPoints[4].y + innerPoints[4].x;
        const rightOuterDiagonal = outerPoints[1].y + outerPoints[1].x;

        assertClose(leftGap, bottomGap, 0.01, "left wall centerline gap should match bottom gap");
        assertClose(rightGap, bottomGap, 0.01, "right wall centerline gap should match bottom gap");
        assertClose(leftOuterBevelDistance - leftInnerBevelDistance, expectedOuterBevelExpansion, 0.01, "lower-left outer bevel should be the true offset of the inner bevel");
        assertClose(rightOuterBevelDistance - rightInnerBevelDistance, expectedOuterBevelExpansion, 0.01, "lower-right outer bevel should be the true offset of the inner bevel");
        assertClose((leftOuterDiagonal - leftInnerDiagonal) / Math.SQRT2, bottomGap, 0.01, "lower-left bevel diagonal gap should match bottom gap");
        assertClose((rightOuterDiagonal - rightInnerDiagonal) / Math.SQRT2, bottomGap, 0.01, "lower-right bevel diagonal gap should match bottom gap");
    }

    await page.close();
});

test("seqfx_bar_one_inner_outline_tracks_cell_stack_without_intersections", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.waitForFunction(() => {
        const frame = document.querySelector('[data-role="seqfx-bar-frame"]');
        const lanes = document.querySelector('[data-role="seqfx-bar-lanes"][data-bar="0"]');
        if (!frame || !lanes) return false;
        return Math.abs(frame.getBoundingClientRect().width - (lanes.getBoundingClientRect().width + 32)) < 1;
    });

    const viewportWidths = [567, 640, 768, 900, 1024, 1229, 1280];
    for (const width of viewportWidths) {
        await page.setViewportSize({ width, height: 820 });
        await page.waitForFunction(() => {
            const frame = document.querySelector('[data-role="seqfx-bar-frame"]');
            const lanes = document.querySelector('[data-role="seqfx-bar-lanes"][data-bar="0"]');
            if (!frame || !lanes) return false;
            return Math.abs(frame.getBoundingClientRect().width - (lanes.getBoundingClientRect().width + 32)) < 1;
        });
        await page.waitForFunction(() => {
            const inner = document.querySelector('[data-role="seqfx-bar-frame-inner"]');
            const cells = [...document.querySelectorAll('[data-role="seqfx-bar-section"][data-bar="0"] [data-role="seqfx-cell"]')];
            if (!inner || cells.length === 0) return false;
            const innerRect = inner.getBoundingClientRect();
            const cellRects = cells.map((cell) => cell.getBoundingClientRect());
            return innerRect.top <= Math.min(...cellRects.map((rect) => rect.top)) - 1
                && innerRect.bottom >= Math.max(...cellRects.map((rect) => rect.bottom)) + 1
                && innerRect.left <= Math.min(...cellRects.map((rect) => rect.left)) - 1
                && innerRect.right >= Math.max(...cellRects.map((rect) => rect.right)) + 1;
        });
        const layout = await page.evaluate(() => {
            const rectFor = (selector) => {
                const element = document.querySelector(selector);
                const rect = element.getBoundingClientRect();
                return {
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                };
            };
            const rectsFor = (selector) => [...document.querySelectorAll(selector)].map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                };
            });
            const cellRects = rectsFor('[data-role="seqfx-bar-section"][data-bar="0"] [data-role="seqfx-cell"]');
            const numberRects = rectsFor('[data-role="seqfx-bar-section"][data-bar="0"] .seqfx-step-number');

            return {
                bottomCellBottom: Math.max(...cellRects.map((rect) => rect.bottom)),
                firstCellLeft: Math.min(...cellRects.map((rect) => rect.left)),
                firstCellTop: Math.min(...cellRects.map((rect) => rect.top)),
                gridShell: rectFor(".seqfx-grid-shell"),
                innerPath: rectFor(".seqfx-bar-frame__inner"),
                lastCellRight: Math.max(...cellRects.map((rect) => rect.right)),
                numberBottom: Math.max(...numberRects.map((rect) => rect.bottom)),
                outerBodyPath: rectFor('[data-role="seqfx-bar-frame-outer-body"]'),
                viewportWidth: window.innerWidth,
            };
        });

        assert.ok(
            layout.innerPath.top >= layout.numberBottom + 1,
            `inner outline should not intersect step numbers at ${layout.viewportWidth}px`,
        );
        assert.ok(
            layout.innerPath.top <= layout.firstCellTop - 1,
            `inner outline should sit above the first cell row at ${layout.viewportWidth}px`,
        );
        assert.ok(
            layout.innerPath.bottom >= layout.bottomCellBottom + 1,
            `inner outline should sit below the bottom cell row at ${layout.viewportWidth}px`,
        );
        assert.ok(
            layout.innerPath.left <= layout.firstCellLeft - 1,
            `inner outline should sit left of the first cell column at ${layout.viewportWidth}px`,
        );
        assert.ok(
            layout.innerPath.right >= layout.lastCellRight + 1,
            `inner outline should sit right of the last cell column at ${layout.viewportWidth}px`,
        );
        assertClose(layout.firstCellLeft - layout.innerPath.left, 8, 1, `left cell-to-inner gap at ${layout.viewportWidth}px`);
        assertClose(layout.innerPath.right - layout.lastCellRight, 8, 1, `right cell-to-inner gap at ${layout.viewportWidth}px`);
        assertClose(layout.firstCellTop - layout.innerPath.top, 8, 1, `top cell-to-inner gap at ${layout.viewportWidth}px`);
        assertClose(layout.innerPath.bottom - layout.bottomCellBottom, 8, 1, `bottom cell-to-inner gap at ${layout.viewportWidth}px`);
        assert.ok(
            layout.outerBodyPath.top <= layout.numberBottom - 1,
            `outer outline should wrap the step-number band at ${layout.viewportWidth}px`,
        );
        assert.ok(
            layout.outerBodyPath.top >= layout.gridShell.top + 1,
            `outer outline should not be clipped by the grid shell top edge at ${layout.viewportWidth}px`,
        );
        assertClose(layout.innerPath.left - layout.outerBodyPath.left, 8, 1, `left outer-to-inner gap at ${layout.viewportWidth}px`);
        assertClose(layout.outerBodyPath.right - layout.innerPath.right, 8, 1, `right outer-to-inner gap at ${layout.viewportWidth}px`);
        assertClose(layout.outerBodyPath.bottom - layout.innerPath.bottom, 8, 1, `bottom outer-to-inner gap at ${layout.viewportWidth}px`);
    }

    await page.close();
});

test("seqfx_bar_one_frame_reserves_corner_clearance_at_plugin_width", async () => {
    const page = await browser.newPage({ viewport: { width: 768, height: 1192 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.waitForFunction(() => {
        const frame = document.querySelector('[data-role="seqfx-bar-frame"]');
        const lanes = document.querySelector('[data-role="seqfx-bar-lanes"][data-bar="0"]');
        if (!frame || !lanes) return false;
        return Math.abs(frame.getBoundingClientRect().width - (lanes.getBoundingClientRect().width + 32)) < 1;
    });

    const layout = await page.evaluate(() => {
        const rectFor = (selector) => {
            const element = document.querySelector(selector);
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                right: rect.right,
            };
        };
        const gridShell = document.querySelector(".seqfx-grid-shell");
        const frame = document.querySelector('[data-role="seqfx-bar-frame"]');
        const frameStyle = getComputedStyle(frame);

        return {
            firstCell: rectFor('[data-role="seqfx-cell"][data-lane="0"][data-step="0"]'),
            frame: rectFor('[data-role="seqfx-bar-frame"]'),
            framePadding: parseFloat(getComputedStyle(gridShell).getPropertyValue("--seqfx-bar-frame-x")),
            framePointerEvents: frameStyle.pointerEvents,
            lastCell: rectFor('[data-role="seqfx-cell"][data-lane="0"][data-step="15"]'),
            rootScrollWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
        };
    });

    assert.ok(layout.framePadding >= 30, `frame side padding must fit the beveled corners at plugin width, got ${layout.framePadding}px`);
    assert.ok(layout.firstCell.left - layout.frame.left >= 14, `left frame bevel clearance is too small: ${layout.firstCell.left - layout.frame.left}px`);
    assert.ok(layout.frame.right - layout.lastCell.right >= 14, `right frame bevel clearance is too small: ${layout.frame.right - layout.lastCell.right}px`);
    assert.equal(layout.framePointerEvents, "none");
    assert.ok(layout.rootScrollWidth <= layout.viewportWidth + 1, `page should not gain horizontal overflow, got ${layout.rootScrollWidth}px for ${layout.viewportWidth}px viewport`);

    await page.close();
});

test("seqfx_bar_corner_cells_and_blocks_use_matching_beveled_shapes", async () => {
    const page = await browser.newPage({ viewport: { width: 768, height: 1192 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const cornerExpectations = [
        { className: "has-frame-corner-tl", lane: 0, step: 0 },
        { className: "has-frame-corner-tr", lane: 0, step: 15 },
        { className: "has-frame-corner-bl", lane: 3, step: 0 },
        { className: "has-frame-corner-br", lane: 3, step: 15 },
        { className: "has-frame-corner-tl", lane: 0, step: 16 },
        { className: "has-frame-corner-tr", lane: 0, step: 31 },
        { className: "has-frame-corner-bl", lane: 3, step: 16 },
        { className: "has-frame-corner-br", lane: 3, step: 31 },
    ];

    const cornerCellStyles = await page.evaluate((expectations) => (
        expectations.map(({ className, lane, step }) => {
            const cell = document.querySelector(`[data-role="seqfx-cell"][data-lane="${lane}"][data-step="${step}"]`);
            const styles = getComputedStyle(cell);

            return {
                className,
                classPresent: cell.classList.contains(className),
                clipPath: styles.clipPath,
            };
        })
    ), cornerExpectations);

    for (const style of cornerCellStyles) {
        assert.equal(style.classPresent, true, `corner cell should include ${style.className}`);
        assert.match(style.clipPath, /^polygon\(/, `corner cell should be visibly clipped for ${style.className}`);
    }

    const nonCornerCellStyles = await page.evaluate(() => {
        const cell = document.querySelector('[data-role="seqfx-cell"][data-lane="1"][data-step="1"]');
        return {
            className: cell.className,
            clipPath: getComputedStyle(cell).clipPath,
        };
    });
    assert.equal(nonCornerCellStyles.className.includes("has-frame-corner"), false);
    assert.equal(nonCornerCellStyles.clipPath, "none");

    for (const { lane, step } of cornerExpectations) {
        await page.getByRole("button", { name: `${SEQFX_LANE_NAMES[lane]} step ${step + 1}`, exact: true }).click();
    }

    const cornerBlockStyles = await page.evaluate((expectations) => (
        expectations.map(({ className, lane, step }) => {
            const block = document.querySelector(`[data-role="seqfx-block"][data-lane="${lane}"][data-start="${step}"]`);
            const fill = block?.querySelector(".seqfx-block-fill");

            return {
                className,
                classPresent: block?.classList.contains(className) ?? false,
                fillClipPath: fill ? getComputedStyle(fill).clipPath : "",
            };
        })
    ), cornerExpectations);

    for (const style of cornerBlockStyles) {
        assert.equal(style.classPresent, true, `corner block should include ${style.className}`);
        assert.match(style.fillClipPath, /^polygon\(/, `corner block fill should be visibly clipped for ${style.className}`);
    }

    await page.close();
});

test("seqfx_bar_one_full_width_edge_blocks_combine_corner_bevels", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await resizeBlockToStep(page, 0, 1, 16);

    const topBlockStyles = await page.evaluate(() => {
        const block = document.querySelector('[data-role="seqfx-block"][data-lane="0"][data-start="0"]');
        const fill = block?.querySelector(".seqfx-block-fill");

        return {
            blockClassName: block?.className ?? "",
            fillClipPath: fill ? getComputedStyle(fill).clipPath : "",
        };
    });

    assert.match(topBlockStyles.blockClassName, /has-frame-corner-tl/);
    assert.match(topBlockStyles.blockClassName, /has-frame-corner-tr/);
    assert.match(topBlockStyles.fillClipPath, /^polygon\(/);

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    await resizeBlockToStep(page, 3, 1, 16);

    const bottomBlockStyles = await page.evaluate(() => {
        const block = document.querySelector('[data-role="seqfx-block"][data-lane="3"][data-start="0"]');
        const fill = block?.querySelector(".seqfx-block-fill");

        return {
            blockClassName: block?.className ?? "",
            fillClipPath: fill ? getComputedStyle(fill).clipPath : "",
        };
    });

    assert.match(bottomBlockStyles.blockClassName, /has-frame-corner-bl/);
    assert.match(bottomBlockStyles.blockClassName, /has-frame-corner-br/);
    assert.match(bottomBlockStyles.fillClipPath, /^polygon\(/);

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
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="4"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-toggle"]').count(), 1);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-badge"]').textContent(), "1");
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
            borderTopStyle: style.borderTopStyle,
            editorWidth: node.getBoundingClientRect().width,
            editorScrollWidth: node.scrollWidth,
            inspectorWidth: inspector?.getBoundingClientRect().width ?? 0,
        };
    });
    assert.equal(sidebarFit.backgroundColor, "rgb(228, 222, 211)");
    assert.equal(sidebarFit.borderTopStyle, "none");
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
    assert.equal(uploads.at(-1).value.auxEnabled[0][0][1], true);
    assertClose(uploads.at(-1).value.auxEnd[0][0][1], 500, 0.001, "filter range end handle should be the cutoff aux target");
    assert.ok(
        uploadedStepParams[1] > uploadedStepParams[2],
        `filter range direction should remain start-to-end, got ${uploadedStepParams[1]} -> ${uploadedStepParams[2]}`,
    );

    const modToggle = await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-toggle"][data-param="1"]').count(), 1);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-toggle"][data-param="2"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-toggle"][data-param="4"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-toggle"][data-param="1"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-badge"]').textContent(), "1");

    await toggleSeqFxModTarget(page, 1);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-badge"]').textContent(), "0");
    await modToggle.click();

    snapshot = await getHarnessSnapshot(page);
    uploads = patternUploads(snapshot);
    assert.equal(uploads.at(-1).value.auxEnabled[0][0][1], false);

    await page.close();
});

test("seqfx_filter_mod_panel_edits_signed_amounts_without_hiding_inline_ranges", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Filter block 1", exact: true }).waitFor();

    const filterEditor = page.locator('[data-role="filter-range-editor"]');
    await filterEditor.waitFor();
    assert.equal(await filterEditor.locator('[data-role="filter-range-chip-start"]').textContent(), "2.00k");
    assert.equal(await filterEditor.locator('[data-role="filter-range-chip-end"]').textContent(), "500");

    const modToggle = await openSeqFxModView(page);
    const cutoffAmount = page.locator('[data-role="seqfx-mod-target-amount"][data-param="1"]');
    await cutoffAmount.waitFor();
    assert.equal(await page.locator('[data-role="seqfx-mod-target-amount"][data-param="0"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-destination"][data-param="0"]').count(), 1);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-amount-value"][data-param="1"]').textContent(), "-2.00 oct");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-destination"][data-param="1"]').textContent(), "500");

    await setSeqFxModTargetAmount(page, 1, -1);
    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[0][0][1], 2000, 0.001, "cutoff Mod amount edit should not rewrite the filter start cutoff");
    assertClose(upload.auxEnd[0][0][1], 1000, 0.001, "cutoff -1 oct amount should write a physical 1 kHz range end");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-amount-value"][data-param="1"]').textContent(), "-1.00 oct");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-destination"][data-param="1"]').textContent(), "1.00k");
    const cutoffFill = await cutoffAmount.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
            start: Number.parseFloat(style.getPropertyValue("--mod-amount-fill-start")),
            end: Number.parseFloat(style.getPropertyValue("--mod-amount-fill-end")),
        };
    });
    assert.ok(cutoffFill.start < 50, `negative cutoff amount should fill left from center, got start ${cutoffFill.start}`);
    assert.equal(cutoffFill.end, 50);

    await modToggle.click();
    await filterEditor.waitFor();
    assert.equal(await filterEditor.locator('[data-role="filter-range-chip-start"]').textContent(), "2.00k");
    assert.equal(await filterEditor.locator('[data-role="filter-range-chip-end"]').textContent(), "1.00k");

    await openSeqFxModView(page);
    await toggleSeqFxModTarget(page, 3);
    await setSeqFxModTargetAmount(page, 3, 3);
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[0][0][3], 0.707, 0.000001, "resonance Mod amount edit should not rewrite base Q");
    assertClose(upload.auxEnd[0][0][3], 3.71, 0.000001, "resonance +3 amount should write base Q plus amount rounded to the public Q step");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-amount-value"][data-param="3"]').textContent(), "+3.00");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-destination"][data-param="3"]').textContent(), "3.71");

    await page.locator('[data-role="seqfx-mod-target-amount"][data-param="3"]').dblclick();
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][3], true);
    assertClose(upload.auxEnd[0][0][3], 0.707, 0.000001, "double-click should reset bipolar resonance amount to zero");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-amount-value"][data-param="3"]').textContent(), "0.00");
    const resonanceFill = await page.locator('[data-role="seqfx-mod-target-amount"][data-param="3"]').evaluate((node) => {
        const style = getComputedStyle(node);
        return {
            start: Number.parseFloat(style.getPropertyValue("--mod-amount-fill-start")),
            end: Number.parseFloat(style.getPropertyValue("--mod-amount-fill-end")),
        };
    });
    assert.equal(resonanceFill.start, 50);
    assert.equal(resonanceFill.end, 50);

    await page.close();
});

test("seqfx_crusher_aux_controls_edit_source_targets_and_v6_storage", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true }).waitFor();
    await page.locator('[data-role="seqfx-crusher-editor"]').waitFor();
    assert.equal(
        await page.locator(".seqfx-crusher-editor__panel").evaluate((node) => getComputedStyle(node).borderTopStyle),
        "none",
    );
    assert.equal(await page.locator('[data-role="seqfx-aux-source"]').count(), 0);

    const modToggle = await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-crusher-editor"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-badge"]').textContent(), "0");
    const thumbnailPathBefore = await page.locator('[data-role="seqfx-mod-thumbnail-path"]').getAttribute("d");
    await setRangeInputValue(page.locator('[data-role="seqfx-aux-source-shape"]'), -0.5);
    await setRangeInputValue(page.locator('[data-role="seqfx-aux-source-curve"]'), 0.65);
    await page.locator('[data-role="seqfx-aux-rate-mode"][data-mode="tempo"]').click();
    await setRangeInputValue(page.locator('[data-role="seqfx-aux-rate-value"]'), 3);
    await page.locator('[data-role="seqfx-aux-tempo-triplet"]').check();
    await page.locator('[data-role="seqfx-aux-rate-mode"][data-mode="slice"]').click();
    await setRangeInputValue(page.locator('[data-role="seqfx-aux-rate-value"]'), 12);
    await page.locator('[data-role="seqfx-aux-rate-mode"][data-mode="tempo"]').click();
    assert.equal(await page.locator('[data-role="seqfx-aux-rate-value"]').inputValue(), "3");
    assert.equal(await page.locator('[data-role="seqfx-aux-tempo-triplet"]').isChecked(), true);
    const thumbnailPathAfter = await page.locator('[data-role="seqfx-mod-thumbnail-path"]').getAttribute("d");
    assert.notEqual(thumbnailPathAfter, thumbnailPathBefore, "Mod thumbnail path should follow the selected aux source shape");
    await toggleSeqFxModTarget(page, 0);
    await setSeqFxModTargetAmount(page, 0, 4);
    await toggleSeqFxModTarget(page, 2);
    await setSeqFxModTargetAmount(page, 2, 6);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-badge"]').textContent(), "2");
    assert.equal(await modToggle.getAttribute("aria-label"), "Edit modulation, shape -0.50, curve 0.65, 2 targets");

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxShape[1][0], -0.5);
    assert.equal(upload.auxSourceCurve[1][0], 0.65);
    assert.equal(upload.auxRateMode[1][0], 0);
    assert.equal(upload.auxTempoMultiplier[1][0], 3);
    assert.equal(upload.auxTempoTriplet[1][0], true);
    assert.equal(upload.auxSliceCount[1][0], 12);
    assert.equal(upload.params[1][0][0], 8);
    assert.equal(upload.params[1][0][2], 0);
    assert.equal(upload.auxEnabled[1][0][0], true);
    assert.equal(upload.auxEnabled[1][0][2], true);
    assert.equal(upload.auxEnd[1][0][0], 12);
    assert.equal(upload.auxEnd[1][0][2], 6);

    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const step = storedState.patterns[0].lanes[1].steps[0];
    assert.deepEqual(step.aux.source, {
        shape: -0.5,
        sourceCurve: 0.65,
        rateMode: "tempo",
        tempoMultiplier: 3,
        tempoTriplet: true,
        sliceCount: 12,
    });
    assert.equal(step.params[0], 8);
    assert.equal(step.params[2], 0);
    assert.deepEqual(step.aux.targets[0], { enabled: true, end: 12 });
    assert.deepEqual(step.aux.targets[2], { enabled: true, end: 6 });

    await modToggle.click();
    await page.locator('[data-role="seqfx-crusher-editor"]').waitFor();
    assert.equal(await page.locator('[data-role="seqfx-aux-source"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-badge"]').textContent(), "2");

    await page.close();
});

test("seqfx_mod_panel_uses_responsive_inspector_width_without_overflowing", async () => {
    const page = await browser.newPage({ viewport: { width: 1168, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 4 Stutter block 1", exact: true }).waitFor();
    await openSeqFxModView(page);
    await setRangeInputValue(page.locator('[data-role="seqfx-aux-source-shape"]'), -1);
    await setRangeInputValue(page.locator('[data-role="seqfx-aux-source-curve"]'), -0.52);
    await toggleSeqFxModTarget(page, 3);

    const measureLayout = () => page.evaluate(() => {
        const rectFor = (selector) => {
            const element = document.querySelector(selector);
            if (!element) {
                return null;
            }

            const rect = element.getBoundingClientRect();
            return {
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width,
            };
        };
        const gridShell = rectFor(".seqfx-grid-shell");
        const inspector = rectFor(".seqfx-inspector");
        const effectPicker = rectFor(".seqfx-effect-picker");
        const modToggle = rectFor('[data-role="seqfx-mod-toggle"]');
        const auxSource = rectFor('[data-role="seqfx-aux-source"]');
        const auxPreview = rectFor(".aux-source__preview");
        const modTargets = rectFor('[data-role="seqfx-mod-targets"]');
        const modToggleStyle = getComputedStyle(document.querySelector('[data-role="seqfx-mod-toggle"]'));
        const modToggleBadgeStyle = getComputedStyle(document.querySelector('[data-role="seqfx-mod-target-badge"]'));
        const auxSourceStyle = getComputedStyle(document.querySelector('[data-role="seqfx-aux-source"]'));
        const modTargetsStyle = getComputedStyle(document.querySelector('[data-role="seqfx-mod-targets"]'));

        return {
            auxPreview,
            auxSource,
            auxSourceBorderTopStyle: auxSourceStyle.borderTopStyle,
            effectPicker,
            gridShell,
            inspector,
            modTargets,
            modTargetsBorderTopStyle: modTargetsStyle.borderTopStyle,
            modToggle,
            modToggleBackgroundColor: modToggleStyle.backgroundColor,
            modToggleBadgeBackgroundColor: modToggleBadgeStyle.backgroundColor,
            modToggleBadgeColor: modToggleBadgeStyle.color,
            modToggleColor: modToggleStyle.color,
            rootScrollWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
        };
    });

    const layout = await measureLayout();

    assert.ok(layout.inspector.width >= 520, `50/50 inspector should be materially wider than the old 300px column, got ${layout.inspector.width}px`);
    assertClose(layout.inspector.width, layout.gridShell.width, 1, "grid and inspector should split the workspace evenly above the breakpoint");
    assert.ok(layout.modToggle.left >= layout.effectPicker.left, "mod button should stay inside the effect header");
    assert.ok(layout.modToggle.right <= layout.effectPicker.right + 1, `mod button overflowed effect header: ${layout.modToggle.right} > ${layout.effectPicker.right}`);
    assert.equal(layout.modToggleBackgroundColor, "rgb(139, 191, 154)");
    assert.equal(layout.modToggleColor, "rgb(28, 28, 28)");
    assert.equal(layout.modToggleBadgeBackgroundColor, "rgb(242, 209, 107)");
    assert.equal(layout.modToggleBadgeColor, "rgb(28, 28, 28)");
    assert.ok(layout.auxSource.left >= layout.inspector.left, "aux source should stay inside the inspector");
    assert.ok(layout.auxSource.right <= layout.inspector.right + 1, `aux source overflowed inspector: ${layout.auxSource.right} > ${layout.inspector.right}`);
    assert.equal(layout.auxSourceBorderTopStyle, "none");
    assert.ok(layout.modTargets.right <= layout.inspector.right + 1, `mod targets overflowed inspector: ${layout.modTargets.right} > ${layout.inspector.right}`);
    assert.equal(layout.modTargetsBorderTopStyle, "none");
    assert.ok(layout.auxPreview.height >= 42, `aux preview should be tall enough to read the curve, got ${layout.auxPreview.height}px`);
    assert.ok(layout.auxPreview.width / layout.auxPreview.height <= 12, `aux preview should not collapse into a thin strip, got ratio ${layout.auxPreview.width / layout.auxPreview.height}`);
    assert.ok(layout.rootScrollWidth <= layout.viewportWidth + 1, `page should not gain horizontal overflow, got ${layout.rootScrollWidth}px for ${layout.viewportWidth}px viewport`);

    await page.setViewportSize({ width: 900, height: 820 });
    const nearBreakpointLayout = await measureLayout();
    assert.ok(nearBreakpointLayout.inspector.width >= 420, `near-breakpoint 50/50 inspector should stay wide, got ${nearBreakpointLayout.inspector.width}px`);
    assertClose(nearBreakpointLayout.inspector.width, nearBreakpointLayout.gridShell.width, 1, "near-breakpoint grid and inspector should still split evenly");
    assert.ok(
        nearBreakpointLayout.auxSource.right <= nearBreakpointLayout.inspector.right + 1,
        `near-breakpoint aux source overflowed inspector: ${nearBreakpointLayout.auxSource.right} > ${nearBreakpointLayout.inspector.right}`,
    );
    assert.ok(
        nearBreakpointLayout.modTargets.right <= nearBreakpointLayout.inspector.right + 1,
        `near-breakpoint mod targets overflowed inspector: ${nearBreakpointLayout.modTargets.right} > ${nearBreakpointLayout.inspector.right}`,
    );
    assert.ok(
        nearBreakpointLayout.rootScrollWidth <= nearBreakpointLayout.viewportWidth + 1,
        `near-breakpoint page should not gain horizontal overflow, got ${nearBreakpointLayout.rootScrollWidth}px for ${nearBreakpointLayout.viewportWidth}px viewport`,
    );

    await page.setViewportSize({ width: 840, height: 820 });
    const stackedLayout = await measureLayout();
    assert.ok(stackedLayout.inspector.top > stackedLayout.gridShell.bottom, "workspace should stack below the reduced breakpoint");

    await page.close();
});

test("seqfx_aux_source_dot_uses_monitor_cycle_phase_and_amount", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true }).waitFor();
    await openSeqFxModView(page);
    const phaseReadout = page.locator('[data-role="seqfx-aux-source-phase-readout"]');
    await phaseReadout.waitFor();

    await page.evaluate(() => {
        window.__SEQFX_HARNESS__?.patchConnection.emitEndpoint("monitorOut", {
            event: {
                patternIndex: 0,
                stepIndex: 0,
                transportRunning: true,
                stepProgress: 0.5,
                stepDurationMs: 125,
                auxCyclePhase: [0, 0.5, 0, 0],
                auxAmount: [0, 0.25, 0, 0],
                auxDurationMs: [0, 250, 0, 0],
            },
        });
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
        if ((await phaseReadout.textContent()) === "0.50 / 0.25") {
            break;
        }
        await page.waitForTimeout(25);
    }
    assert.equal(await phaseReadout.textContent(), "0.50 / 0.25");
    const phaseDotCx = await page.locator('[data-role="seqfx-aux-source-preview-dot"]').getAttribute("cx");
    const phaseDotCy = await page.locator('[data-role="seqfx-aux-source-preview-dot"]').getAttribute("cy");
    assertClose(Number(phaseDotCx), 100, 2, "Aux source dot should move to half cycle phase");
    assertClose(Number(phaseDotCy), 35, 2, "Aux source dot should use monitor amount for y position");
    const thumbnailDotCx = await page.locator('[data-role="seqfx-mod-thumbnail-dot"]').getAttribute("cx");
    const thumbnailDotCy = await page.locator('[data-role="seqfx-mod-thumbnail-dot"]').getAttribute("cy");
    assertClose(Number(thumbnailDotCx), 100, 2, "Mod thumbnail phase dot should move to half cycle phase");
    assertClose(Number(thumbnailDotCy), 15.5, 2, "Mod thumbnail dot should use monitor amount for y position");

    await page.close();
});

test("seqfx_mod_view_resets_when_selection_cannot_edit_one_aux_block", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 step 3", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true }).click();
    await openSeqFxModView(page);
    await page.locator('[data-role="seqfx-aux-source"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 Crusher block 3", exact: true }).click({ modifiers: ["Shift"] });
    await page.locator('[data-role="seqfx-crusher-editor"]').waitFor();
    assert.equal(await page.locator('[data-role="seqfx-mod-toggle"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-aux-source"]').count(), 0);

    await page.getByRole("button", { name: "Chain 2 Crusher block 1", exact: true }).click();
    await page.locator('[data-role="seqfx-crusher-editor"]').waitFor();
    assert.equal(
        await page.locator('[data-role="seqfx-aux-source"]').count(),
        0,
        "returning to an aux-editable block should reopen the compact effect view, not stale Mod view",
    );

    await page.close();
});

test("seqfx_stutter_aux_controls_edit_gate_slices_shape_and_speed_targets", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 4 Stutter block 1", exact: true }).waitFor();
    await page.locator('[data-role="seqfx-stutter-editor"]').waitFor();
    assert.equal(
        await page.locator(".seqfx-stutter-editor__panel").evaluate((node) => getComputedStyle(node).borderTopStyle),
        "none",
    );
    assert.equal(await page.locator('[data-role="seqfx-aux-source"]').count(), 0);
    await openSeqFxModView(page);

    await toggleSeqFxModTarget(page, 3);
    await toggleSeqFxModTarget(page, 0);
    await toggleSeqFxModTarget(page, 2);
    await toggleSeqFxModTarget(page, 1);
    await setSeqFxModTargetAmount(page, 3, -68);
    await setSeqFxModTargetAmount(page, 0, 24);
    await setSeqFxModTargetAmount(page, 2, -0.4375);
    await setSeqFxModTargetAmount(page, 1, 1);

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.auxEnabled[3][0].slice(0, 4), [true, true, true, true]);
    assert.equal(upload.auxEnd[3][0][0], 32);
    assert.equal(upload.auxEnd[3][0][1], 2);
    assert.equal(upload.auxEnd[3][0][2], 0);
    assert.equal(upload.auxEnd[3][0][3], 0);
    assertClose(upload.params[3][0][3], 0.68, 0.000001, "stutter gate aux edit should not rewrite the base gate");

    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const step = storedState.patterns[0].lanes[3].steps[0];
    assert.deepEqual(step.aux.source, {
        shape: 0,
        sourceCurve: 0,
        rateMode: "slice",
        tempoMultiplier: 4,
        tempoTriplet: false,
        sliceCount: 1,
    });
    assert.deepEqual(step.aux.targets.slice(0, 4).map((target) => target.enabled), [true, true, true, true]);
    assert.deepEqual(step.aux.targets.slice(0, 4).map((target) => target.end), [32, 2, 0, 0]);
    assertClose(step.params[3], 0.68, 0.000001, "persisted stutter gate should remain the base gate");

    await page.close();
});

test("seqfx_tape_stop_aux_controls_edit_all_tape_targets_including_mode", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 3 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 3 Tape Stop block 1", exact: true }).waitFor();
    await page.locator('[data-role="seqfx-tape-graph"]').waitFor();
    assert.equal(await page.locator('[data-role="seqfx-aux-source"]').count(), 0);
    await openSeqFxModView(page);

    for (const paramIndex of [0, 1, 2, 3, 4]) {
        await toggleSeqFxModTarget(page, paramIndex);
    }

    await setSeqFxModTargetAmount(page, 0, 25);
    await setSeqFxModTargetAmount(page, 1, 1.5);
    await setSeqFxModTargetAmount(page, 2, 2);
    await setSeqFxModTargetAmount(page, 3, 50);
    await page.locator('[data-role="seqfx-mod-target-destination"][data-param="4"]').selectOption("1");

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
    assert.deepEqual(step.aux.source, {
        shape: 0,
        sourceCurve: 0,
        rateMode: "slice",
        tempoMultiplier: 4,
        tempoTriplet: false,
        sliceCount: 1,
    });
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

    assert.equal(
        await page.locator('[data-role="seqfx-crusher-bits-slider"] .editor-tick-slider__label--toggle').count(),
        1,
        "crusher bits should keep its inline modulation toggle in the effect editor",
    );
    assert.equal(
        await page.locator('[data-role="seqfx-crusher-hold-frames-slider"] .editor-tick-slider__label--toggle').count(),
        1,
        "crusher hold should keep its inline modulation toggle in the effect editor",
    );
    assert.equal(
        await page.locator('[data-role="seqfx-crusher-drive-db-mod-toggle"]').count(),
        1,
        "crusher drive should keep its inline modulation toggle in the effect editor",
    );

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

    await page.locator('[data-role="seqfx-crusher-drive-db-mod-toggle"]').click();
    await pressSliderKey(page.getByRole("slider", { name: "Drive end", exact: true }), "End");
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[1][0][CRUSHER_PARAM_DRIVE_DB], true);
    assert.equal(upload.auxEnd[1][0][CRUSHER_PARAM_DRIVE_DB], 36);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-badge"]').textContent(), "1");

    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-hold-frames"]'), 8);
    await page.locator('[data-role="seqfx-crusher-hold-frames-slider"] .editor-tick-slider__label--toggle').click();
    const holdEndSlider = page.getByRole("slider", { name: "Hold end", exact: true });
    await pressSliderKey(holdEndSlider, "End");
    await holdEndSlider.focus();
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.up("Shift");
    const holdModRange = await page.locator('[data-role="seqfx-crusher-hold-frames-slider"]').evaluate((node) => {
        const baseTicks = Array.from(node.querySelectorAll('[data-role="editor-tick-slider-tick"]'));
        const rangeRail = node.querySelector('[data-role="editor-tick-slider-mod-range-rail"]');
        const rangeTicks = Array.from(rangeRail?.querySelectorAll(".editor-tick-slider__tick") ?? []);
        const trackBounds = node.querySelector(".editor-tick-slider__track")?.getBoundingClientRect();
        const startThumbBounds = node.querySelector(".editor-tick-slider__mod-thumb--start")?.getBoundingClientRect();
        const endThumbBounds = node.querySelector(".editor-tick-slider__mod-thumb--end")?.getBoundingClientRect();
        const handleCenters = [startThumbBounds, endThumbBounds].filter(Boolean).map((rect) => ((rect.left + rect.right) / 2));
        const rangeStart = Number(rangeRail?.getAttribute("data-range-start"));
        const rangeEnd = Number(rangeRail?.getAttribute("data-range-end"));
        const clipLeftX = trackBounds ? trackBounds.left + ((trackBounds.width * rangeStart) / 100) : Number.NaN;
        const clipRightX = trackBounds ? trackBounds.left + ((trackBounds.width * rangeEnd) / 100) : Number.NaN;

        return {
            baseTickCount: baseTicks.length,
            clipLeftX,
            clipPathStyle: rangeRail instanceof HTMLElement ? rangeRail.style.clipPath : "",
            clipRightX,
            connectorCount: node.querySelectorAll(".editor-tick-slider__mod-range").length,
            highHandleX: Math.max(...handleCenters),
            isModRangeClassCount: baseTicks.filter((tick) => tick.classList.contains("is-mod-range")).length,
            lowHandleX: Math.min(...handleCenters),
            rangeEnd,
            rangeRailCount: node.querySelectorAll('[data-role="editor-tick-slider-mod-range-rail"]').length,
            rangeStart,
            rangeTickColor: rangeTicks[0] ? getComputedStyle(rangeTicks[0]).backgroundColor : "",
            rangeTickCount: rangeTicks.length,
        };
    });
    assert.equal(holdModRange.connectorCount, 0, "modulated tick sliders should not render a continuous yellow range bar");
    assert.equal(holdModRange.isModRangeClassCount, 0, "base rail should not choose range cells with rounded tick indexes");
    assert.equal(holdModRange.rangeRailCount, 1);
    assert.equal(holdModRange.rangeTickCount, holdModRange.baseTickCount);
    assert.equal(holdModRange.rangeTickColor, "rgb(242, 209, 107)");
    assert.match(holdModRange.clipPathStyle, /^inset\(/);
    assert.ok(
        Math.abs(holdModRange.clipLeftX - holdModRange.lowHandleX) <= 1,
        `yellow range clip should start at lower handle center, got ${holdModRange.clipLeftX} vs ${holdModRange.lowHandleX}`,
    );
    assert.ok(
        Math.abs(holdModRange.clipRightX - holdModRange.highHandleX) <= 1,
        `yellow range clip should end at upper handle center, got ${holdModRange.clipRightX} vs ${holdModRange.highHandleX}`,
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
    assert.equal(
        await page.locator('[data-role="seqfx-stutter-slices-slider"] .editor-tick-slider__label--toggle').count(),
        1,
        "stutter slices should keep its inline modulation toggle in the effect editor",
    );
    assert.equal(
        await page.locator('[data-role="seqfx-stutter-speed-slider"] .editor-tick-slider__label--toggle').count(),
        1,
        "stutter speed should keep its inline modulation toggle in the effect editor",
    );
    assert.equal(
        await page.locator('[data-role="seqfx-stutter-shape-mod-toggle"]').count(),
        1,
        "stutter shape should keep its inline modulation toggle in the effect editor",
    );
    assert.equal(
        await page.locator('[data-role="seqfx-stutter-gate-mod-toggle"]').count(),
        1,
        "stutter gate should keep its inline modulation toggle in the effect editor",
    );

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

    await page.locator('[data-role="seqfx-stutter-slices-slider"] .editor-tick-slider__label--toggle').click();
    await pressSliderKey(page.getByRole("slider", { name: "Slices end", exact: true }), "End");
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[3][0][STUTTER_PARAM_SLICES], true);
    assert.equal(upload.auxEnd[3][0][STUTTER_PARAM_SLICES], 32);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-badge"]').textContent(), "1");

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

test("seqfx_cross_row_blocks_render_as_one_logical_block_split_across_bar_rows", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 3 step 15", exact: true }).click();
    await resizeBlockToStep(page, 2, 15, 18);

    const segmentSelector = '.seqfx-block[data-lane="2"][data-start="14"]';
    await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 2, segmentSelector);
    const segments = page.locator(segmentSelector);
    assert.equal(await segments.count(), 2);
    const firstSegment = await segments.nth(0).boundingBox();
    const secondSegment = await segments.nth(1).boundingBox();
    const step15 = await boundingBoxForCell(page, 2, 14);
    const step17 = await boundingBoxForCell(page, 2, 16);
    const resizeHandle = await page.locator('[data-role="seqfx-block-resize"][data-lane="2"][data-start="14"]').boundingBox();

    assert.ok(firstSegment);
    assert.ok(secondSegment);
    assert.ok(resizeHandle);
    assertClose(firstSegment.y, step15.y, 1, "first block segment should stay on the first bar row");
    assertClose(secondSegment.y, step17.y, 1, "second block segment should continue on the second bar row");
    assertClose(resizeHandle.y, secondSegment.y, 1, "resize handle should stay on the final visual segment");

    const snapshot = await getHarnessSnapshot(page);
    const lastUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(lastUpload.activeSteps[2].slice(14, 18), [true, true, true, true]);
    assert.deepEqual(lastUpload.triggerSteps[2].slice(14, 18), [true, false, false, false]);

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
    assert.equal(await effectPicker.locator('[data-role="seqfx-effect-type-option"]').count(), 4);
    assert.equal(await effectPicker.locator('[data-role="seqfx-effect-type-option"] > svg').count(), 4);
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
            fillBackground: getComputedStyle(fillNode).backgroundColor,
            fillBorderWidth: getComputedStyle(fillNode).borderTopWidth,
            fillBoxShadow: getComputedStyle(fillNode).boxShadow,
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
    assert.equal(initialStyles.fillBorderWidth, "0px");
    assert.match(initialStyles.fillBackground, /rgba\(/);
    assert.ok(Number(initialStyles.fillBackground.match(/,\s*([0-9.]+)\)$/)?.[1] ?? 1) < 1, "block fill should be translucent over the material plate");
    assert.notEqual(initialStyles.fillBoxShadow, "none");
    assert.equal(initialStyles.fillBoxShadow.includes("0px 0px 0px 1px"), false, "block fill should not use an inset 1px border");
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
    await openSeqFxModView(page);
    await page.locator('[data-role="seqfx-mod-target-destination"][data-param="0"]').waitFor();
    await toggleSeqFxModTarget(page, 0);
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.locator('[data-role="seqfx-mod-target-destination"][data-param="0"]').focus();
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
    await openSeqFxModView(page);
    await page.locator('[data-role="seqfx-mod-target-destination"][data-param="0"]').waitFor();
    await toggleSeqFxModTarget(page, 0);
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const ignoredPasteResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-mod-target-destination"][data-param="0"]',
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
    const editedEnd = upload.auxEnd[0][1][1];
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
    assert.deepEqual(
        [1, 2, 3, 7, 8].map((step) => upload.auxEnabled[0][step][1]),
        [true, true, true, true, true],
    );
    assert.deepEqual(
        [1, 2, 3, 7, 8].map((step) => upload.auxEnd[0][step][1]),
        [editedEnd, editedEnd, editedEnd, editedEnd, editedEnd],
    );
    assert.equal(upload.params[0][21][1], 2000);
    assert.equal(upload.auxEnd[0][21][1], 500);
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
    assert.deepEqual(
        [10, 11, 12, 16, 17].map((step) => upload.auxEnd[0][step][1]),
        [editedEnd, editedEnd, editedEnd, editedEnd, editedEnd],
    );
    assert.equal(upload.activeSteps[0][21], true);
    assert.equal(upload.params[0][21][1], 2000);
    assert.equal(upload.auxEnd[0][21][1], 500);
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
