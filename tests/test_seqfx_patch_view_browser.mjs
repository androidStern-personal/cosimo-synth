import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { chromium } from "playwright";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const DEFAULT_DEV_SERVER_ORIGIN = "http://127.0.0.1:5175";
const testDevServerOriginOverride = process.env.SEQFX_TEST_DEV_SERVER_ORIGIN;

function resolveTestDevServerOrigin(value) {
    if (value === undefined) {
        return DEFAULT_DEV_SERVER_ORIGIN;
    }
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error("SEQFX_TEST_DEV_SERVER_ORIGIN must be a non-empty loopback HTTP origin.");
    }

    let parsed;
    try {
        parsed = new URL(value.trim());
    } catch {
        throw new Error("SEQFX_TEST_DEV_SERVER_ORIGIN must be a valid loopback HTTP origin.");
    }
    const loopbackHost = parsed.hostname === "127.0.0.1"
        || parsed.hostname === "localhost"
        || parsed.hostname === "[::1]";
    const originOnly = parsed.pathname === "/" && parsed.search === "" && parsed.hash === "";
    if (
        parsed.protocol !== "http:"
        || !loopbackHost
        || parsed.port === ""
        || parsed.username !== ""
        || parsed.password !== ""
        || !originOnly
    ) {
        throw new Error("SEQFX_TEST_DEV_SERVER_ORIGIN must be an explicit loopback HTTP origin with no path, query, or credentials.");
    }
    return parsed.origin;
}

const DEV_SERVER_ORIGIN = resolveTestDevServerOrigin(testDevServerOriginOverride);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEQFX_STEP_COUNT = 32;
const SEQFX_STATE_KEY = "seqfx.v7";
const SEQFX_SNAPSHOT_BANK_STATE_KEY = "cosimo.effectSnapshotBank.seqfx.v1";
const SEQFX_NORMAL_GAP_PX = 3;
const SEQFX_BEAT_GAP_PX = 9;
const SEQFX_MIN_CELL_SIZE_PX = 24;
const SEQFX_LEFT_FRAME_CLEARANCE_PX = 16;
const SEQFX_GRID_STEPS_PER_ROW = 16;
const SEQFX_EFFECT_TYPES = {
    filter: 1,
    crusher: 2,
    tapeStop: 3,
    stutter: 4,
    pitch: 5,
    comb: 6,
    ring: 7,
    reverse: 8,
    talkBox: 9,
    vibro: 10,
    flange: 11,
    dirty: 12,
};
const FILTER_PARAM_MODE = 0;
const FILTER_PARAM_CUTOFF = 1;
const FILTER_PARAM_RESONANCE = 3;
const CRUSHER_PARAM_BITS = 0;
const CRUSHER_PARAM_RATE_HZ = 1;
const CRUSHER_PARAM_DRIVE_DB = 2;
const CRUSHER_PARAM_CHARACTER = 3;
const CRUSHER_PARAM_ADC_QUALITY = 4;
const CRUSHER_PARAM_DAC_QUALITY = 5;
const CRUSHER_PARAM_DITHER = 6;
const TAPE_STOP_PARAM_CURVE = 1;
const TAPE_STOP_PARAM_RETURN = 2;
const STUTTER_PARAM_SLICES = 0;
const STUTTER_PARAM_SHAPE = 2;
const SEQFX_LANE_NAMES = ["Chain 1", "Chain 2", "Chain 3", "Chain 4"];
const SEQFX_DEFAULT_EFFECT_NAMES = ["Filter", "Crush", "Tape Stop", "Stutter"];

let serverProcess;
let browser;
const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const effectDefinitionsModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-effect-definitions.ts");

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
    return stateModule.parseStrictSeqFxStateV7(value);
}

function patternUploads(snapshot) {
    return snapshot.events.filter((entry) => entry.endpointID === "patternUpload");
}

function seqFxStateWrites(snapshot) {
    return snapshot.storedStateWrites.filter((entry) => entry.key === SEQFX_STATE_KEY);
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

async function dispatchSyntheticPointer(page, targetSelector, type, init) {
    return page.evaluate(({ nextTargetSelector, nextType, nextInit }) => {
        const target = nextTargetSelector === "window"
            ? window
            : document.querySelector(nextTargetSelector);
        if (!target) {
            throw new Error(`Synthetic pointer target not found: ${nextTargetSelector}`);
        }
        return target.dispatchEvent(new PointerEvent(nextType, {
            bubbles: true,
            cancelable: true,
            composed: true,
            ...nextInit,
        }));
    }, {
        nextInit: init,
        nextTargetSelector: targetSelector,
        nextType: type,
    });
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

async function editorCurvePlotPoint(page, graphRole, graphBox, normalizedX, normalizedYFromTop) {
    const plot = await page.locator(`[data-role="${graphRole}"] [data-role="editor-curve-plot-area"]`).evaluate((plotNode) => {
        const svg = plotNode.ownerSVGElement;
        const viewBox = svg?.viewBox.baseVal;

        return {
            height: Number(plotNode.getAttribute("height")),
            viewBoxHeight: viewBox?.height ?? 1,
            viewBoxWidth: viewBox?.width ?? 1,
            width: Number(plotNode.getAttribute("width")),
            x: Number(plotNode.getAttribute("x")),
            y: Number(plotNode.getAttribute("y")),
        };
    });
    const svgX = plot.x + (Math.min(1, Math.max(0, normalizedX)) * plot.width);
    const svgY = plot.y + (Math.min(1, Math.max(0, normalizedYFromTop)) * plot.height);

    return {
        x: graphBox.x + ((svgX / plot.viewBoxWidth) * graphBox.width),
        y: graphBox.y + ((svgY / plot.viewBoxHeight) * graphBox.height),
    };
}

async function stutterGraphPoint(page, graphBox, normalizedGate) {
    return editorCurvePlotPoint(page, "seqfx-stutter-graph", graphBox, normalizedGate, 0.5);
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
            const targetX = left + (width * phase);

            if (targetX <= points[0].x) {
                return points[0].y;
            }

            for (let index = 0; index + 1 < points.length; index += 1) {
                const from = points[index];
                const to = points[index + 1];

                if (targetX >= from.x && targetX <= to.x) {
                    const segmentWidth = to.x - from.x;
                    const segmentPhase = segmentWidth === 0 ? 0 : (targetX - from.x) / segmentWidth;
                    return from.y + ((to.y - from.y) * segmentPhase);
                }
            }

            return points[points.length - 1].y;
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

async function setPhysicalSliderValue(locator, value) {
    const mapping = await locator.evaluate((node, nextValue) => {
        const scale = node.getAttribute("data-scale");
        const min = Number(node.getAttribute("data-physical-min"));
        const max = Number(node.getAttribute("data-physical-max"));
        if (scale !== "log") {
            return nextValue;
        }
        return Math.log(nextValue / min) / Math.log(max / min);
    }, value);
    await setRangeInputValue(locator, mapping);
}

async function pressSliderKey(locator, key) {
    await locator.focus();
    await locator.press(key);
}

function crushRateSliderValue(rateHz) {
    return Math.log(rateHz / 200) / Math.log(48_000 / 200);
}

async function setCrushEditorValues(page, {
    bits,
    rateHz,
    driveDb,
    character,
    adcQuality,
    dacQuality,
    dither,
}) {
    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-bits"]'), bits);
    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-rate"]'), crushRateSliderValue(rateHz));
    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-drive-db"]'), driveDb);
    if (character !== undefined) {
        await page.locator(`[data-role="seqfx-crusher-character-option"][data-character="${character}"]`).click();
    }
    if (adcQuality !== undefined) {
        await setRangeInputValue(page.locator('[data-role="seqfx-crusher-adc-quality"]'), adcQuality);
    }
    if (dacQuality !== undefined) {
        await setRangeInputValue(page.locator('[data-role="seqfx-crusher-dac-quality"]'), dacQuality);
    }
    if (dither !== undefined) {
        await setRangeInputValue(page.locator('[data-role="seqfx-crusher-dither"]'), dither);
    }
}

async function assertSharedCurveContract(page, { graphRole, pathRole, fillRole = null, handleRole = null }) {
    await page.locator(`[data-role="${graphRole}"]`).waitFor();
    const contract = await page.locator(`[data-role="${graphRole}"]`).evaluate((graph, roles) => {
        const path = graph.querySelector(`[data-role="${roles.pathRole}"]`);
        const fill = roles.fillRole ? graph.querySelector(`[data-role="${roles.fillRole}"]`) : null;
        const handle = roles.handleRole ? graph.querySelector(`[data-role="${roles.handleRole}"]`) : null;

        return {
            handleClasses: handle ? Array.from(handle.classList) : [],
            surfaceClasses: Array.from(graph.classList),
            plotAreaCount: graph.querySelectorAll('[data-role="editor-curve-plot-area"]').length,
            pathClasses: path ? Array.from(path.classList) : [],
            fillClasses: fill ? Array.from(fill.classList) : [],
        };
    }, { pathRole, fillRole, handleRole });

    assert.ok(
        contract.surfaceClasses.includes("editor-curve-surface"),
        `${graphRole} should render through the shared editor curve surface`,
    );
    assert.equal(contract.plotAreaCount, 1, `${graphRole} should expose the shared plot-area rect`);
    assert.ok(
        contract.pathClasses.includes("editor-curve-path"),
        `${pathRole} should inherit the shared editor curve path class`,
    );
    if (fillRole) {
        assert.ok(
            contract.fillClasses.includes("editor-curve-fill"),
            `${fillRole} should inherit the shared editor curve fill class`,
        );
    }
    if (handleRole) {
        assert.ok(
            contract.handleClasses.includes("editor-curve-handle"),
            `${handleRole} should inherit the shared editor curve handle class`,
        );
    }
}

async function openSeqFxModView(page) {
    const modToggle = page.locator('[data-role="seqfx-mod-toggle"]');
    await modToggle.waitFor();
    await modToggle.click();
    await page.locator('[data-role="seqfx-mod-editor"]').waitFor();
    return modToggle;
}

async function openSeqFxAdvancedParameters(page) {
    const disclosure = page.locator('[data-role="seqfx-advanced-parameters"]');
    await disclosure.waitFor();
    if ((await disclosure.getAttribute("open")) === null) {
        await disclosure.locator("summary").click();
    }
    assert.notEqual(await disclosure.getAttribute("open"), null, "Advanced controls should disclose on request");
    return disclosure;
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
    await page.evaluate(async ({ devOrigin, useDefaultLoader }) => {
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
        const createView = useDefaultLoader
            ? loaderModule.default
            : loaderModule.createEffectPatchView({ devOrigin });
        const view = await createView(patchConnection);
        document.getElementById("root").appendChild(view);
        window.__SEQFX_LOADER_HARNESS__ = {
            patchConnection,
            getSnapshot: () => patchConnection.getSnapshot(),
        };
    }, {
        devOrigin: DEV_SERVER_ORIGIN,
        useDefaultLoader: testDevServerOriginOverride === undefined,
    });
}

test("seqfx_test_dev_server_origin_defaults_to_the_standalone_5175_contract", () => {
    assert.equal(resolveTestDevServerOrigin(undefined), DEFAULT_DEV_SERVER_ORIGIN);
});

test("seqfx_test_dev_server_origin_accepts_only_explicit_loopback_http_origins", () => {
    assert.equal(resolveTestDevServerOrigin(" http://127.0.0.1:43123/ "), "http://127.0.0.1:43123");
    assert.equal(resolveTestDevServerOrigin("http://localhost:43123"), "http://localhost:43123");
    assert.throws(() => resolveTestDevServerOrigin(""), /non-empty loopback HTTP origin/);
    assert.throws(() => resolveTestDevServerOrigin("https://127.0.0.1:43123"), /explicit loopback HTTP origin/);
    assert.throws(() => resolveTestDevServerOrigin("http://example.com:43123"), /explicit loopback HTTP origin/);
    assert.throws(() => resolveTestDevServerOrigin("http://127.0.0.1:43123/path"), /explicit loopback HTTP origin/);
    assert.throws(() => resolveTestDevServerOrigin("http://user:pass@127.0.0.1:43123"), /explicit loopback HTTP origin/);
});

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

test("seqfx_shared_effect_loader_imports_react_dev_module_and_keeps_automation_hermetic", async () => {
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
        webdriver: navigator.webdriver,
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
    assert.equal(snapshot.webdriver, true);
    assert.equal(snapshot.reactGrab, null, "automated browsers must not load React Grab's networked dev tooling");
    assert.equal(snapshot.viewTagName, "cosimo-seqfx-react-view");
    assert.equal(snapshot.styleText.includes("@font-face"), false);
    assert.equal(snapshot.styleText.includes('font-family: "Avenir Next", "Helvetica Neue", Arial, sans-serif'), true);
    assert.equal(snapshot.styleText.includes("Geist"), false);
    assert.equal(snapshot.uploads.length >= 1, true);
    assert.equal(snapshot.uploads.at(-1).value.patternIndex, 0);
    assert.deepEqual(pageErrors, []);

    await page.close();
});

test("seqfx_effect_graphs_render_through_shared_editor_curve_primitives", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await assertSharedCurveContract(page, {
        graphRole: "filter-range-editor-surface",
        handleRole: "filter-range-value-handle",
        pathRole: "filter-range-value-response",
    });

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await assertSharedCurveContract(page, {
        graphRole: "seqfx-crusher-graph",
        pathRole: "seqfx-crusher-wet-path",
        fillRole: "seqfx-crusher-wet-fill",
    });

    await page.getByRole("button", { name: "Chain 3 step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-tape-v2-editor"]').waitFor();
    await page.locator('[data-role="seqfx-tape-v2-curve"]').waitFor();

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    await assertSharedCurveContract(page, {
        graphRole: "seqfx-stutter-graph",
        handleRole: "seqfx-stutter-gate-handle",
        pathRole: "seqfx-stutter-env-path",
        fillRole: "seqfx-stutter-env-fill",
    });

    await page.close();
});

test("seqfx_bespoke_editors_disclose_trigger_latching_and_crush_shows_a_host_rate_Full_ceiling", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const expectTriggerContract = async (parameterId, parameterLabel) => {
        const contract = page.locator(`[data-role="seqfx-bespoke-trigger"][data-param="${parameterId}"]`);
        await contract.waitFor();
        assert.equal(await contract.isVisible(), true);
        assert.equal((await contract.textContent())?.replace(/\s+/g, " ").trim(), `${parameterLabel} Trigger`);
    };

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await expectTriggerContract("mode", "Mode");

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await expectTriggerContract("character", "Character");
    assert.equal(await page.locator('[data-role="seqfx-crusher-rate-value"]').textContent(), "Full");
    assert.equal(await page.locator('[data-role="seqfx-crusher-editor"]').getByText("48 kHz", { exact: true }).count(), 0);

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    await expectTriggerContract("slices", "Slices");

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
    await page.locator('[data-role="seqfx-tape-v2-editor"]').waitFor();

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
    await page.waitForFunction(() => (
        getComputedStyle(document.querySelector('[data-role="seqfx-effect-type-option"][data-effect-type="2"] [data-role="seqfx-effect-icon"]')).color
        === "rgb(238, 108, 77)"
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
        const selectedEffectIcon = selectedEffectButton?.querySelector('[data-role="seqfx-effect-icon"]');
        const hoveredEffectButton = document.querySelector('[data-role="seqfx-effect-type-option"][data-effect-type="2"]');
        const hoveredEffectIcon = hoveredEffectButton?.querySelector('[data-role="seqfx-effect-icon"]');
        const effectIconDetails = Array.from(document.querySelectorAll('[data-role="seqfx-effect-type-option"]')).map((button) => {
            const icon = button.querySelector('[data-role="seqfx-effect-icon"]');
            return {
                effectType: button.getAttribute("data-effect-type"),
                fontaudioIcon: icon?.getAttribute("data-fontaudio-icon") ?? "",
            };
        });

        return {
            drawControlCount: document.querySelectorAll('[data-role="seqfx-draw-effect"], .seqfx-draw-effect').length,
            effectIconDetails,
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
            laneLabelCount: document.querySelectorAll(".seqfx-lane-label").length,
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
    assert.equal(layout.selectedEffectIconColor, "rgb(244, 211, 94)");
    assert.equal(layout.selectedEffectIconFilter, "none");
    assert.equal(layout.hoveredEffectIconColor, "rgb(238, 108, 77)");
    assert.equal(layout.hoveredEffectIconFilter, "none");
    assert.deepEqual(
        layout.effectIconDetails,
        [
            { effectType: "1", fontaudioIcon: "fad-filter-lowpass" },
            { effectType: "2", fontaudioIcon: "fad-digital0" },
            { effectType: "3", fontaudioIcon: "fad-stop" },
            { effectType: "4", fontaudioIcon: "fad-repeat" },
            { effectType: "5", fontaudioIcon: "fad-arrows-vert" },
            { effectType: "6", fontaudioIcon: "fad-filter-notch" },
            { effectType: "7", fontaudioIcon: "fad-modsine" },
            { effectType: "8", fontaudioIcon: "fad-backward" },
            { effectType: "9", fontaudioIcon: "fad-microphone" },
            { effectType: "10", fontaudioIcon: "fad-modtri" },
            { effectType: "11", fontaudioIcon: "fad-phase" },
            { effectType: "12", fontaudioIcon: "fad-hardclipcurve" },
        ],
        "every effect tab should consume its canonical registry-backed Fontaudio identity",
    );
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
    assert.equal(layout.laneLabelCount, 0);
    assertClose(layout.gridPaddingLeft, SEQFX_LEFT_FRAME_CLEARANCE_PX, 0.1, "removed chain-label gutter should leave only frame clearance");
    assert.ok(layout.gridPaddingLeft < layout.gridPaddingRight, "sequence cells should expand into the removed left label gutter");
    assertClose(layout.laneTrack.left - layout.grid.left, layout.gridPaddingLeft, 1, "grid cells should start after the reserved frame padding");
    assertClose(layout.grid.right - layout.laneTrack.right, layout.gridPaddingRight, 1, "grid cells should end before the reserved frame padding");
    assert.ok(layout.rootScrollWidth <= layout.viewportWidth + 1, `page should not gain horizontal overflow, got ${layout.rootScrollWidth}px for ${layout.viewportWidth}px viewport`);
    assert.equal(layout.inspectorHeadingFontSize, "13px");
    assert.ok(layout.inspectorHeading.height <= 18, `expected compact inspector heading, got ${layout.inspectorHeading.height}px`);

    await page.close();
});

test("seqfx_global_surface_wires_host_controls_loop_transport_and_edit_history", async () => {
    const page = await browser.newPage({ viewport: { width: 1120, height: 680 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const enabled = page.locator('[data-role="seqfx-enabled"]');
    const mix = page.locator('[data-role="seqfx-global-mix"]');
    const clock = page.locator('[data-role="seqfx-clock-mode"]');
    const bpm = page.locator('[data-role="seqfx-manual-bpm"]');
    const rate = page.locator('[data-role="seqfx-rate"]');
    const swing = page.locator('[data-role="seqfx-swing"]');
    const loopStart = page.locator('[data-role="seqfx-loop-start"]');
    const loopEnd = page.locator('[data-role="seqfx-loop-end"]');
    const transport = page.locator('[data-role="seqfx-internal-transport"]');
    const reset = page.locator('[data-role="seqfx-reset"]');
    const undo = page.locator('[data-role="seqfx-undo"]');
    const redo = page.locator('[data-role="seqfx-redo"]');

    assert.equal(await enabled.isVisible(), true, "SeqFX On should be visible");
    assert.equal(await mix.isVisible(), true, "global mix should be visible");
    assert.equal(await clock.isVisible(), true, "clock mode should be visible");
    assert.equal(await rate.isVisible(), true, "rate should be visible");
    assert.equal(await swing.isVisible(), true, "swing should be visible");
    assert.equal(await loopStart.isVisible(), true, "compact loop Start should be visible");
    assert.equal(await loopEnd.isVisible(), true, "compact loop End should be visible");
    assert.equal(await page.locator('[data-role="seqfx-loop-ruler"]').count(), 0, "the redundant 32-cell loop ruler should be absent");
    assert.equal(await enabled.getAttribute("aria-checked"), "true");
    assert.equal(await bpm.isDisabled(), true, "host clock should make manual BPM unavailable");
    assert.equal(await transport.isDisabled(), true, "host clock should own transport in Host mode");
    assert.equal(await undo.isDisabled(), true);
    assert.equal(await redo.isDisabled(), true);

    const rateBounds = await rate.boundingBox();
    assert.ok(rateBounds, "sequence rate should have measurable browser geometry");
    assert.ok(
        rateBounds.width >= 54,
        `sequence rate should leave room for 1/16 plus the native select arrow, got ${rateBounds.width}px`,
    );

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await enabled.click();
    await mix.fill("0.37");
    await clock.selectOption("1");
    await bpm.fill("134");
    await rate.selectOption("2");
    await swing.fill("0.2");
    await loopStart.fill("5");
    await loopEnd.fill("13");
    await transport.click();
    await reset.click();

    assert.equal(await bpm.isEnabled(), true);
    assert.equal(await transport.isEnabled(), true);
    const snapshot = await getHarnessSnapshot(page);
    assert.deepEqual(snapshot.events.map(({ endpointID, value }) => ({ endpointID, value })), [
        { endpointID: "enabled", value: 0 },
        { endpointID: "globalMix", value: 0.37 },
        { endpointID: "clockMode", value: 1 },
        { endpointID: "manualBpm", value: 134 },
        { endpointID: "rate", value: 2 },
        { endpointID: "swing", value: 0.2 },
        { endpointID: "loopStart", value: 4 },
        { endpointID: "loopLength", value: 28 },
        { endpointID: "loopStart", value: 4 },
        { endpointID: "loopLength", value: 9 },
        { endpointID: "internalPlay", value: 1 },
        { endpointID: "internalReset", value: 1 },
    ]);
    assert.deepEqual(snapshot.gestureStarts, [
        "enabled",
        "clockMode",
        "manualBpm",
        "rate",
        "loopStart",
        "loopLength",
        "loopStart",
        "loopLength",
    ]);
    assert.deepEqual(
        [...snapshot.gestureEnds].sort(),
        [...snapshot.gestureStarts].sort(),
        "each combined global edit should close exactly one matching host gesture",
    );

    for (const [endpointID, slider] of [["globalMix", mix], ["swing", swing]]) {
        await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
        const box = await slider.boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + (box.width * 0.3), box.y + (box.height / 2));
        await page.mouse.down();
        await page.mouse.move(box.x + (box.width * 0.7), box.y + (box.height / 2), { steps: 3 });
        await page.mouse.up();
        await slider.evaluate((node) => node.blur());
        const gestureSnapshot = await getHarnessSnapshot(page);
        assert.deepEqual(gestureSnapshot.gestureStarts, [endpointID]);
        assert.deepEqual(gestureSnapshot.gestureEnds, [endpointID]);
    }

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await clock.selectOption("0");
    assert.equal(await transport.isDisabled(), true);
    assert.equal(await transport.getAttribute("aria-label"), "Play internal clock");
    await clock.selectOption("1");
    assert.equal(await transport.isEnabled(), true);
    assert.equal(await transport.getAttribute("aria-label"), "Play internal clock");
    assert.deepEqual((await getHarnessSnapshot(page)).events, [
        { endpointID: "internalPlay", value: 0 },
        { endpointID: "clockMode", value: 0 },
        { endpointID: "clockMode", value: 1 },
    ], "leaving Internal must stop DSP transport instead of hiding a latched run state");

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    assert.equal(await undo.isEnabled(), true);
    await undo.click();
    assert.equal(await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).getAttribute("aria-pressed"), "false");
    await page.locator('[data-role="seqfx-empty"]').waitFor();
    assert.equal(
        await page.locator('[data-role="seqfx-mix-row"]').count(),
        0,
        "undoing the selected block must not leave controls for an inactive cell",
    );
    assert.equal(await redo.isEnabled(), true);
    await redo.click();
    assert.equal(await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).getAttribute("aria-pressed"), "true");

    assert.equal(await loopStart.inputValue(), "5");
    assert.equal(await loopEnd.inputValue(), "13");

    await page.close();
});

test("seqfx_global_mix_and_swing_gestures_keep_the_initiating_pointer_owner", async () => {
    const page = await browser.newPage({ viewport: { width: 1120, height: 680 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const [endpointID, selector, ownerPointerId] of [
        ["globalMix", '[data-role="seqfx-global-mix"]', 41],
        ["swing", '[data-role="seqfx-swing"]', 51],
    ]) {
        await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
        await dispatchSyntheticPointer(page, selector, "pointerdown", {
            buttons: 1,
            pointerId: ownerPointerId,
            pointerType: "touch",
        });
        await dispatchSyntheticPointer(page, selector, "pointerdown", {
            buttons: 1,
            pointerId: 99,
            pointerType: "touch",
        });
        await dispatchSyntheticPointer(page, "window", "pointerup", {
            buttons: 0,
            pointerId: 99,
            pointerType: "touch",
        });
        await dispatchSyntheticPointer(page, "window", "pointercancel", {
            buttons: 0,
            pointerId: 99,
            pointerType: "touch",
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureStarts, [endpointID]);
        assert.deepEqual(snapshot.gestureEnds, [], "foreign pointer lifecycle must not close the owner gesture");

        await dispatchSyntheticPointer(page, selector, "lostpointercapture", {
            buttons: 0,
            pointerId: ownerPointerId,
            pointerType: "touch",
        });
        await dispatchSyntheticPointer(page, "window", "pointerup", {
            buttons: 0,
            pointerId: ownerPointerId,
            pointerType: "touch",
        });
        await dispatchSyntheticPointer(page, "window", "pointercancel", {
            buttons: 0,
            pointerId: ownerPointerId,
            pointerType: "touch",
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureEnds, [endpointID], "capture loss and owner release must close exactly once");
    }

    await page.close();
});

test("seqfx_global_pointer_gestures_close_once_on_blur_and_unmount", async () => {
    const page = await browser.newPage({ viewport: { width: 1120, height: 680 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const beginBothGestures = async () => {
        await dispatchSyntheticPointer(page, '[data-role="seqfx-global-mix"]', "pointerdown", {
            buttons: 1,
            pointerId: 61,
            pointerType: "touch",
        });
        await dispatchSyntheticPointer(page, '[data-role="seqfx-swing"]', "pointerdown", {
            buttons: 1,
            pointerId: 71,
            pointerType: "touch",
        });
    };

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await beginBothGestures();
    await page.evaluate(() => {
        window.dispatchEvent(new Event("blur"));
        window.dispatchEvent(new Event("blur"));
    });
    let snapshot = await getHarnessSnapshot(page);
    assert.deepEqual(snapshot.gestureStarts, ["globalMix", "swing"]);
    assert.deepEqual(snapshot.gestureEnds, ["globalMix", "swing"]);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await beginBothGestures();
    await page.evaluate(() => document.querySelector("cosimo-seqfx-react-view")?.remove());
    snapshot = await getHarnessSnapshot(page);
    assert.deepEqual(snapshot.gestureStarts, ["globalMix", "swing"]);
    assert.deepEqual(snapshot.gestureEnds, ["globalMix", "swing"]);

    await page.close();
});

test("seqfx_inspector_undo_gesture_rejects_foreign_pointer_acquisition", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    const mix = page.locator('[data-role="seqfx-mix"]');
    await mix.waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await dispatchSyntheticPointer(page, '[data-role="seqfx-mix"]', "pointerdown", {
        buttons: 1,
        pointerId: 81,
        pointerType: "touch",
    });
    await setRangeInputValue(mix, 0.44);
    await page.waitForFunction(() => (
        window.__SEQFX_HARNESS__?.getSnapshot().events
            .some((entry) => entry.endpointID === "patternUpload")
    ));
    assert.equal(seqFxStateWrites(await getHarnessSnapshot(page)).length, 0);

    await dispatchSyntheticPointer(page, '[data-role="seqfx-mix"]', "pointerdown", {
        buttons: 1,
        pointerId: 91,
        pointerType: "touch",
    });
    await dispatchSyntheticPointer(page, "window", "pointerup", {
        buttons: 0,
        pointerId: 91,
        pointerType: "touch",
    });
    await dispatchSyntheticPointer(page, "window", "pointercancel", {
        buttons: 0,
        pointerId: 91,
        pointerType: "touch",
    });
    assert.equal(
        seqFxStateWrites(await getHarnessSnapshot(page)).length,
        0,
        "foreign pointer down/up must not steal or commit the owner's Undo gesture",
    );

    await setRangeInputValue(mix, 0.31);
    await dispatchSyntheticPointer(page, "window", "pointerup", {
        buttons: 0,
        pointerId: 81,
        pointerType: "touch",
    });
    await page.waitForFunction((stateKey) => (
        window.__SEQFX_HARNESS__?.getSnapshot().storedStateWrites
            .filter((entry) => entry.key === stateKey).length === 1
    ), SEQFX_STATE_KEY);
    await dispatchSyntheticPointer(page, "window", "pointerup", {
        buttons: 0,
        pointerId: 81,
        pointerType: "touch",
    });
    await dispatchSyntheticPointer(page, "window", "pointercancel", {
        buttons: 0,
        pointerId: 81,
        pointerType: "touch",
    });

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(seqFxStateWrites(snapshot).length, 1, "owner release must commit the Undo gesture once");
    assertClose(
        parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]).patterns[0].lanes[0].steps[0].mix,
        0.31,
        0.001,
        "owner release persisted the final block mix",
    );

    await page.close();
});

test("seqfx_inspector_undo_gesture_closes_once_on_blur_and_unmount", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    const mix = page.locator('[data-role="seqfx-mix"]');
    await mix.waitFor();

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await dispatchSyntheticPointer(page, '[data-role="seqfx-mix"]', "pointerdown", {
        buttons: 1,
        pointerId: 82,
        pointerType: "touch",
    });
    await setRangeInputValue(mix, 0.55);
    await page.evaluate(() => {
        window.dispatchEvent(new Event("blur"));
        window.dispatchEvent(new Event("blur"));
    });
    await dispatchSyntheticPointer(page, "window", "pointerup", {
        buttons: 0,
        pointerId: 82,
        pointerType: "touch",
    });
    let snapshot = await getHarnessSnapshot(page);
    assert.equal(seqFxStateWrites(snapshot).length, 1, "blur must commit the live Undo gesture once");

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await dispatchSyntheticPointer(page, '[data-role="seqfx-mix"]', "pointerdown", {
        buttons: 1,
        pointerId: 83,
        pointerType: "touch",
    });
    await setRangeInputValue(mix, 0.66);
    await page.evaluate(() => document.querySelector("cosimo-seqfx-react-view")?.remove());
    snapshot = await getHarnessSnapshot(page);
    assert.equal(seqFxStateWrites(snapshot).length, 1, "unmount must commit the live Undo gesture once");

    await page.close();
});

test("seqfx compact loop Start and End replace the ruler without overflow", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const loopStart = page.locator('[data-role="seqfx-loop-start"]');
    const loopEnd = page.locator('[data-role="seqfx-loop-end"]');
    const supportedSizes = [
        { id: "minimum", width: 720, height: 520 },
        { id: "compact", width: 900, height: 600 },
        { id: "default", width: 1120, height: 680 },
        { id: "wide", width: 1440, height: 800 },
    ];

    assert.equal(await page.locator('[data-role="seqfx-loop-ruler"]').count(), 0, "the 32-cell ruler should be removed from the production surface");
    assert.equal(await page.locator('[data-role="seqfx-loop-step"]').count(), 0, "no redundant loop-step buttons should remain");
    assert.equal(await loopStart.getAttribute("type"), "range");
    assert.equal(await loopEnd.getAttribute("type"), "range");
    assert.deepEqual(
        [await loopStart.getAttribute("min"), await loopStart.getAttribute("max"), await loopEnd.getAttribute("min"), await loopEnd.getAttribute("max")],
        ["1", "32", "1", "32"],
        "Start and End should expose the full initial 1..32 domain",
    );

    for (const size of supportedSizes) {
        await page.setViewportSize({ width: size.width, height: size.height });
        const geometry = await page.locator(".seqfx-loop").evaluate((loop) => {
            const rectFor = (element) => {
                if (!element) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    height: bounds.height,
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    width: bounds.width,
                };
            };
            const meta = loop.querySelector(".seqfx-loop__meta");
            const start = loop.querySelector('[data-role="seqfx-loop-start-control"]');
            const end = loop.querySelector('[data-role="seqfx-loop-end-control"]');
            return {
                end: rectFor(end),
                loop: rectFor(loop),
                metaClientWidth: meta?.clientWidth ?? 0,
                metaScrollWidth: meta?.scrollWidth ?? 0,
                rootScrollWidth: document.documentElement.scrollWidth,
                start: rectFor(start),
                viewportWidth: window.innerWidth,
            };
        });

        assert.ok(geometry.start && geometry.end, `${size.id} should render both compact loop endpoints`);
        assertClose(geometry.start.top, geometry.end.top, 1, `${size.id} Start and End header alignment`);
        assert.ok(geometry.start.right <= geometry.end.left + 1, `${size.id} Start should precede End`);
        assert.ok(geometry.start.left >= geometry.loop.left - 1 && geometry.end.right <= geometry.loop.right + 1, `${size.id} loop controls should stay inside the header`);
        assert.ok(geometry.metaScrollWidth <= geometry.metaClientWidth + 1, `${size.id} compact loop header should not clip or scroll`);
        assert.ok(geometry.rootScrollWidth <= geometry.viewportWidth + 1, `${size.id} compact loop header should not create page overflow`);
    }

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const endBox = await loopEnd.boundingBox();
    assert.ok(endBox);
    await page.mouse.move(endBox.x + endBox.width - 2, endBox.y + (endBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(endBox.x + (endBox.width / 2), endBox.y + (endBox.height / 2), { steps: 6 });
    await page.mouse.up();
    await loopEnd.evaluate((input) => input.blur());

    const pointerEnd = Number(await loopEnd.inputValue());
    assert.ok(Number.isInteger(pointerEnd) && pointerEnd > 1 && pointerEnd < 32, `pointer End should land on a whole step, got ${pointerEnd}`);
    let snapshot = await getHarnessSnapshot(page);
    assert.equal(snapshot.parameters.loopStart, 0);
    assert.equal(snapshot.parameters.loopLength, pointerEnd);
    assert.deepEqual(snapshot.gestureStarts, ["loopStart", "loopLength"]);
    assert.deepEqual(snapshot.gestureEnds, snapshot.gestureStarts);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await loopStart.focus();
    await page.keyboard.press("End");
    await loopStart.evaluate((input) => input.blur());
    assert.equal(await loopStart.inputValue(), String(pointerEnd));
    assert.equal(await loopEnd.inputValue(), String(pointerEnd));
    await loopEnd.focus();
    await page.keyboard.press("Home");
    await loopEnd.evaluate((input) => input.blur());
    assert.equal(await loopEnd.inputValue(), String(pointerEnd), "End must not cross below Start");

    await loopStart.focus();
    await page.keyboard.press("Home");
    await loopStart.evaluate((input) => input.blur());
    await loopEnd.focus();
    await page.keyboard.press("End");
    await loopEnd.evaluate((input) => input.blur());
    assert.deepEqual([await loopStart.inputValue(), await loopEnd.inputValue()], ["1", "32"], "keyboard Home/End should retain the full loop domain");
    snapshot = await getHarnessSnapshot(page);
    assert.equal(snapshot.parameters.loopStart, 0);
    assert.equal(snapshot.parameters.loopLength, 32);
    assert.deepEqual(snapshot.gestureEnds, snapshot.gestureStarts, "pointer and keyboard endpoint edits should close paired host gestures");

    await page.locator('[data-role="seqfx-loop-start-value"]').click();
    assert.equal(await page.getByRole("textbox", { name: "Start exact value" }).count(), 1, "exact entry should appear only on request");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator('.seqfx-loop input[type="text"]').count(), 0, "exact entry should remain temporary");

    await page.close();
});

test("seqfx_internal_transport_parses_explicit_monitor_booleans_and_rejects_malformed_values", async () => {
    const page = await browser.newPage({ viewport: { width: 1120, height: 680 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const clock = page.locator('[data-role="seqfx-clock-mode"]');
    const transport = page.locator('[data-role="seqfx-internal-transport"]');
    const emitTransport = async (transportRunning, wrapped) => {
        await page.evaluate(({ nextTransportRunning, useEnvelope }) => {
            const event = {
                patternIndex: 0,
                stepIndex: 0,
                transportRunning: nextTransportRunning,
                stepProgress: 0,
                stepDurationMs: 125,
                auxCyclePhase: [0, 0, 0, 0],
                auxAmount: [0, 0, 0, 0],
                auxDurationMs: [0, 0, 0, 0],
            };
            window.__SEQFX_HARNESS__?.patchConnection.emitEndpoint(
                "monitorOut",
                useEnvelope ? { event } : event,
            );
        }, { nextTransportRunning: transportRunning, useEnvelope: wrapped });
    };

    await clock.selectOption("1");
    await transport.waitFor({ state: "visible" });
    assert.equal(await transport.isEnabled(), true);

    for (const [index, token] of [true, 1, "1", "true"].entries()) {
        await emitTransport(false, false);
        await page.getByRole("button", { name: "Play internal clock", exact: true }).waitFor();
        await emitTransport(token, index % 2 === 1);
        await page.getByRole("button", { name: "Stop internal clock", exact: true }).waitFor();
    }

    for (const [index, token] of [false, 0, "0", "false"].entries()) {
        await emitTransport(true, false);
        await page.getByRole("button", { name: "Stop internal clock", exact: true }).waitFor();
        await emitTransport(token, index % 2 === 1);
        await page.getByRole("button", { name: "Play internal clock", exact: true }).waitFor();
    }

    await emitTransport(true, false);
    await page.getByRole("button", { name: "Stop internal clock", exact: true }).waitFor();
    for (const malformed of [undefined, null, 2, "", "false ", "TRUE", {}, []]) {
        await emitTransport(malformed, true);
        await page.waitForTimeout(20);
        assert.equal(
            await transport.getAttribute("aria-label"),
            "Stop internal clock",
            `malformed transport token ${String(malformed)} must preserve the prior state`,
        );
    }

    await page.close();
});

test("seqfx_factory_content_is_discoverable_atomic_and_undoable_without_onboarding_persistence", async () => {
    const page = await browser.newPage({ viewport: { width: 1120, height: 680 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    assert.equal(await page.locator('[data-role="seqfx-first-use"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-first-use-dismiss"]').count(), 0);
    assert.equal(await page.getByText("First pattern?", { exact: true }).count(), 0);
    const openingLayout = await page.evaluate(() => {
        const globalControls = document.querySelector('[data-role="seqfx-global-controls"]');
        const workspace = document.querySelector(".seqfx-workspace");
        const globalBounds = globalControls.getBoundingClientRect();
        const workspaceBounds = workspace.getBoundingClientRect();
        const onboardingStorageKeys = [localStorage, sessionStorage].flatMap((storage) => (
            Array.from({ length: storage.length }, (_unused, index) => storage.key(index))
        )).filter((key) => key !== null && /(first.?use|onboard|welcome)/iu.test(key));
        return {
            expectedGap: parseFloat(getComputedStyle(globalControls).marginBottom),
            gap: workspaceBounds.top - globalBounds.bottom,
            onboardingStorageKeys,
        };
    });
    assertClose(openingLayout.gap, openingLayout.expectedGap, 0.1, "banner removal should not leave an extra layout gap");
    assert.deepEqual(openingLayout.onboardingStorageKeys, [], "opening SeqFX should not create onboarding storage state");

    await page.locator('[data-role="seqfx-pattern"][data-pattern="1"]').click();
    await page.locator('[data-role="seqfx-pattern"][data-pattern="0"]').click();
    assert.deepEqual(
        await page.evaluate(() => [localStorage, sessionStorage].flatMap((storage) => (
            Array.from({ length: storage.length }, (_unused, index) => storage.key(index))
        )).filter((key) => key !== null && /(first.?use|onboard|welcome)/iu.test(key))),
        [],
        "ordinary rerenders should not recreate onboarding persistence",
    );

    const factoryPattern = page.locator('[data-role="seqfx-factory-pattern"]');
    assert.equal(await factoryPattern.locator("option").count(), 13);
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await factoryPattern.selectOption("twelve-effect-tour");
    await page.getByRole("button", { name: "Chain 1 Filter block 1-2", exact: true }).waitFor();
    const loadedEffects = new Set(await page.locator('[data-role="seqfx-block"]').evaluateAll((nodes) => (
        nodes.map((node) => Number(node.getAttribute("data-effect")))
    )));
    assert.deepEqual([...loadedEffects].sort((left, right) => left - right), Array.from({ length: 12 }, (_unused, index) => index + 1));
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 1, "factory pattern should upload once after its atomic stored-state commit");

    await page.getByRole("button", { name: "Chain 1 Filter block 1-2", exact: true }).click();
    const effectPreset = page.locator('[data-role="seqfx-factory-effect-preset"]');
    assert.deepEqual(await effectPreset.locator("option").evaluateAll((nodes) => nodes.map((node) => node.textContent)), [
        "Custom",
        "Warm Low Pass",
        "Telephone Band",
        "Air Cut",
    ]);
    assert.equal(await effectPreset.inputValue(), "warm-low-pass");
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await effectPreset.selectOption("telephone-band");
    let snapshot = await getHarnessSnapshot(page);
    let storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    assert.equal(storedState.patterns[0].lanes[0].steps[0].mix, 0.82);
    assert.deepEqual(storedState.patterns[0].lanes[0].steps[0].params.slice(0, 5), [2, 1_350, 1_350, 2.4, 1]);
    assert.equal(patternUploads(snapshot).length, 1, "effect preset should upload once after one state commit");
    await page.locator('[data-role="seqfx-undo"]').click();
    assert.equal(await effectPreset.inputValue(), "warm-low-pass");

    const beforeVariation = parseSeqFxStoredState((await getHarnessSnapshot(page)).storedState[SEQFX_STATE_KEY]);
    const beforeGeometry = beforeVariation.patterns[0].lanes.map((lane) => (
        lane.steps.map((step) => step.trigger ? step.effectType : 0)
    ));
    await page.locator('[data-role="seqfx-vary-loop"]').click();
    snapshot = await getHarnessSnapshot(page);
    storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    assert.deepEqual(storedState.patterns[0].lanes.map((lane) => lane.steps.map((step) => step.trigger ? step.effectType : 0)), beforeGeometry);
    await page.locator('[data-role="seqfx-undo"]').click();
    storedState = parseSeqFxStoredState((await getHarnessSnapshot(page)).storedState[SEQFX_STATE_KEY]);
    const { revision: restoredRevision, ...restoredPattern } = storedState.patterns[0];
    const { revision: previousRevision, ...previousPattern } = beforeVariation.patterns[0];
    assert.ok(restoredRevision > previousRevision, "undo must keep the engine-facing pattern revision monotonic");
    assert.deepEqual(restoredPattern, previousPattern);

    await page.close();
});

test("seqfx_effect_tab_icons_resolve_registry_fontaudio_masks_in_their_cell_palette", async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 720 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();

    const expectedIcons = {
        1: { color: "rgb(244, 211, 94)", icon: "fad-filter-lowpass", name: "Filter" },
        2: { color: "rgb(238, 108, 77)", icon: "fad-digital0", name: "Crush" },
        3: { color: "rgb(152, 193, 217)", icon: "fad-stop", name: "Tape Stop" },
        4: { color: "rgb(181, 217, 156)", icon: "fad-repeat", name: "Stutter" },
        5: { color: "rgb(159, 169, 223)", icon: "fad-arrows-vert", name: "Pitch" },
        6: { color: "rgb(127, 168, 216)", icon: "fad-filter-notch", name: "Comb" },
        7: { color: "rgb(199, 166, 216)", icon: "fad-modsine", name: "Ring" },
        8: { color: "rgb(181, 143, 181)", icon: "fad-backward", name: "Reverse" },
        9: { color: "rgb(229, 164, 181)", icon: "fad-microphone", name: "Talk Box" },
        10: { color: "rgb(215, 163, 107)", icon: "fad-modtri", name: "Vibro" },
        11: { color: "rgb(120, 174, 184)", icon: "fad-phase", name: "Flange" },
        12: { color: "rgb(121, 185, 166)", icon: "fad-hardclipcurve", name: "Dirty" },
    };

    for (const [effectType, expected] of Object.entries(expectedIcons)) {
        const button = page.locator(`[data-role="seqfx-effect-type-option"][data-effect-type="${effectType}"]`);
        await button.click();
        await page.waitForFunction(
            ({ type, color }) => {
                const option = document.querySelector(`[data-role="seqfx-effect-type-option"][data-effect-type="${type}"]`);
                const icon = option?.querySelector('[data-role="seqfx-effect-icon"]');
                return option?.getAttribute("aria-pressed") === "true"
                    && icon
                    && getComputedStyle(icon).backgroundColor === color;
            },
            { type: effectType, color: expected.color },
        );
        const actual = await button.evaluate((option) => {
            const icon = option.querySelector('[data-role="seqfx-effect-icon"]');
            if (!icon) {
                return null;
            }

            const styles = getComputedStyle(icon);
            const maskImage = styles.maskImage === "none" ? styles.webkitMaskImage : styles.maskImage;
            const maskUrlMatch = /^url\(["']?(.*?)["']?\)$/u.exec(maskImage);
            const bounds = icon.getBoundingClientRect();
            return {
                ariaHidden: icon.getAttribute("aria-hidden"),
                backgroundColor: styles.backgroundColor,
                childElementCount: icon.childElementCount,
                color: styles.color,
                fontaudioIcon: icon.getAttribute("data-fontaudio-icon"),
                height: bounds.height,
                maskImage,
                maskRepeat: styles.maskRepeat,
                maskSize: styles.maskSize,
                maskUrl: maskUrlMatch?.[1] ?? "",
                pressed: option.getAttribute("aria-pressed"),
                tagName: icon.tagName,
                width: bounds.width,
            };
        });

        assert.ok(actual, `effect ${effectType} should expose a Fontaudio identity leaf`);
        assert.equal(actual.pressed, "true");
        assert.equal(await button.getAttribute("aria-label"), expected.name);
        assert.equal(actual.ariaHidden, "true", "the named button owns accessibility; its identity art stays decorative");
        assert.equal(actual.tagName, "SPAN");
        assert.equal(actual.childElementCount, 0, "the identity leaf should not embed hand-authored SVG paths");
        assert.equal(actual.fontaudioIcon, expected.icon);
        assert.equal(actual.color, expected.color);
        assert.equal(actual.backgroundColor, expected.color, "currentColor should paint the Fontaudio mask");
        assert.equal(actual.width, 24);
        assert.equal(actual.height, 24);
        assert.equal(actual.maskSize, "contain");
        assert.equal(actual.maskRepeat, "no-repeat");
        assert.match(actual.maskImage, /^url\(/u);
        assert.notEqual(actual.maskUrl, "");
        assert.equal(
            await page.evaluate(async (maskUrl) => (await fetch(maskUrl)).ok, actual.maskUrl),
            true,
            `effect ${effectType} should resolve a loadable vendored Fontaudio asset`,
        );
    }

    await page.close();
});

test("seqfx_named_effect_picker_and_unlabelled_rows_preserve_chain_accessibility_and_interaction", async () => {
    const page = await browser.newPage({ viewport: { width: 1120, height: 680 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    assert.equal(await page.locator(".seqfx-lane-label").count(), 0);
    assert.equal(await page.getByText(/^Chain [1-4]$/u).count(), 0);
    for (const bar of [0, 1]) {
        const laneRows = page.locator(`[data-role="seqfx-bar-section"][data-bar="${bar}"] .seqfx-lane-row`);
        assert.equal(await laneRows.count(), 4, `bar ${bar + 1} should retain four lane rows`);
        assert.deepEqual(
            await laneRows.locator('[data-role="seqfx-lane-track"]').evaluateAll((nodes) => (
                nodes.map((node) => Number(node.getAttribute("data-lane")))
            )),
            [0, 1, 2, 3],
            `bar ${bar + 1} should retain ordered chain identity`,
        );
    }
    const wideGridLayout = await page.evaluate(() => {
        const grid = document.querySelector(".seqfx-grid-shell");
        const track = document.querySelector(".seqfx-lane-track");
        const gridBounds = grid.getBoundingClientRect();
        const trackBounds = track.getBoundingClientRect();
        return {
            leftClearance: trackBounds.left - gridBounds.left,
            rightClearance: gridBounds.right - trackBounds.right,
        };
    });
    assertClose(wideGridLayout.leftClearance, SEQFX_LEFT_FRAME_CLEARANCE_PX, 1, "wide sequence grid should reclaim the chain-label gutter");
    assert.ok(wideGridLayout.leftClearance < wideGridLayout.rightClearance);

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    const effectOptions = page.locator('[data-role="seqfx-effect-type-option"]');
    assert.equal(await effectOptions.count(), 12);
    assert.deepEqual(
        await effectOptions.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label"))),
        ["Filter", "Crush", "Tape Stop", "Stutter", "Pitch", "Comb", "Ring", "Reverse", "Talk Box", "Vibro", "Flange", "Dirty"],
    );
    assert.equal(
        await effectOptions.first().locator('[data-role="seqfx-effect-icon"][data-fontaudio-icon="fad-filter-lowpass"]').count(),
        1,
        "named cards should retain registry-backed Fontaudio identities",
    );

    const effectTab = page.locator('[data-role="seqfx-effect-tab"]');
    const modTab = page.locator('[data-role="seqfx-mod-toggle"]');
    assert.equal(await effectTab.getAttribute("aria-selected"), "true");
    assert.equal(await modTab.getAttribute("aria-selected"), "false");
    await modTab.click();
    assert.equal(await effectTab.getAttribute("aria-selected"), "false");
    assert.equal(await modTab.getAttribute("aria-selected"), "true");
    assert.equal(await page.locator('[data-role="seqfx-mix-row"]').isVisible(), true, "Block Mix should stay fixed in Mod view");

    await effectTab.click();
    const selectionText = await page.locator(".seqfx-inspector-heading strong").textContent();
    assert.match(selectionText, /Chain 4/);
    assert.match(selectionText, /Stutter/);
    assert.match(selectionText, /step 1/);
    const mixBox = await page.locator('[data-role="seqfx-mix-row"]').boundingBox();
    const editorBox = await page.locator('[data-role="seqfx-stutter-editor"]').boundingBox();
    assert.ok(mixBox && editorBox);
    assert.ok(
        mixBox.y + mixBox.height <= editorBox.y + 1,
        `common Block Mix should precede the effect-specific editor, got mix bottom ${mixBox.y + mixBox.height} and editor top ${editorBox.y}`,
    );

    await resizeBlockToStep(page, 3, 1, 2);
    const blockLabel = page.locator('[data-role="seqfx-block-effect-label"][data-effect="4"]').first();
    assert.equal(await blockLabel.textContent(), "STUT");

    await page.close();
});

test("seqfx effect picker uses two rows of six without overflow and keeps keyboard selection", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();

    const settleLayout = () => page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));

    const picker = page.locator(".seqfx-effect-picker__options");
    const effectOptions = picker.locator('[data-role="seqfx-effect-type-option"]');
    const supportedSizes = [
        { id: "wide", width: 1280, height: 820 },
        { id: "side-by-side floor", width: 1060, height: 820 },
        { id: "narrow stack", width: 320, height: 640 },
    ];

    assert.equal(await effectOptions.count(), 12);
    assert.deepEqual(
        await effectOptions.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label"))),
        ["Filter", "Crush", "Tape Stop", "Stutter", "Pitch", "Comb", "Ring", "Reverse", "Talk Box", "Vibro", "Flange", "Dirty"],
        "the compact grid must preserve effect identity and order",
    );

    for (const size of supportedSizes) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await settleLayout();
        const geometry = await picker.evaluate((options) => {
            const surface = (node) => {
                const style = getComputedStyle(node);
                return {
                    backgroundColor: style.backgroundColor,
                    borderBottomStyle: style.borderBottomStyle,
                    borderBottomWidth: style.borderBottomWidth,
                    borderLeftStyle: style.borderLeftStyle,
                    borderLeftWidth: style.borderLeftWidth,
                    borderRadius: style.borderRadius,
                    borderRightStyle: style.borderRightStyle,
                    borderRightWidth: style.borderRightWidth,
                    borderTopStyle: style.borderTopStyle,
                    borderTopWidth: style.borderTopWidth,
                    boxShadow: style.boxShadow,
                };
            };
            const optionRect = options.getBoundingClientRect();
            const buttons = [...options.querySelectorAll('[data-role="seqfx-effect-type-option"]')];
            const buttonRects = buttons.map((button) => button.getBoundingClientRect());
            const selectedButton = options.querySelector('[data-role="seqfx-effect-type-option"].is-selected');
            const cell = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="0"]');
            const nextCell = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="1"]');
            const baseCell = document.querySelector(
                '.seqfx-cell:not(.has-frame-corner-tl):not(.has-frame-corner-tr):not(.has-frame-corner-bl):not(.has-frame-corner-br):not(.is-alt-bar):not(.is-covered):not(.is-selected):not(.is-playhead)',
            );
            const baseButton = options.querySelector('[data-role="seqfx-effect-type-option"]:not(.is-selected)');
            if (!selectedButton || !cell || !nextCell || !baseCell || !baseButton) {
                throw new Error("Missing picker/cell geometry contract nodes");
            }
            const selectedButtonRect = selectedButton.getBoundingClientRect();
            const cellRect = cell.getBoundingClientRect();
            const nextCellRect = nextCell.getBoundingClientRect();
            const rowCounts = new Map();
            for (const rect of buttonRects) {
                const rowTop = Math.round(rect.top * 10) / 10;
                rowCounts.set(rowTop, (rowCounts.get(rowTop) ?? 0) + 1);
            }
            return {
                allInside: buttonRects.every((rect) => rect.left >= optionRect.left - 1 && rect.right <= optionRect.right + 1),
                baseButtonSurface: surface(baseButton),
                baseCellSurface: surface(baseCell),
                buttonHeight: selectedButtonRect.height,
                buttonWidth: selectedButtonRect.width,
                cellHeight: cellRect.height,
                cellWidth: cellRect.width,
                clientWidth: options.clientWidth,
                hiddenOrClippedContent: buttons.flatMap((button) => {
                    const buttonRect = button.getBoundingClientRect();
                    const icon = button.querySelector('.seqfx-effect-icon')?.getBoundingClientRect();
                    const nameNode = button.querySelector('.seqfx-effect-picker__name');
                    const name = nameNode?.getBoundingClientRect();
                    const visible = icon !== undefined && name !== undefined && nameNode !== null
                        && icon.width > 0 && icon.height > 0
                        && icon.left >= buttonRect.left - 1 && icon.right <= buttonRect.right + 1
                        && name.width > 0 && name.height > 0
                        && name.left >= buttonRect.left - 1 && name.right <= buttonRect.right + 1
                        && nameNode.scrollWidth <= nameNode.clientWidth + 1;
                    return visible ? [] : [{
                        label: button.getAttribute('aria-label'),
                        nameClientWidth: nameNode?.clientWidth ?? 0,
                        nameScrollWidth: nameNode?.scrollWidth ?? 0,
                    }];
                }),
                normalGap: nextCellRect.left - cellRect.right,
                pickerClientWidth: options.parentElement.clientWidth,
                pickerScrollWidth: options.parentElement.scrollWidth,
                resolvedCellSize: Number.parseFloat(getComputedStyle(options).getPropertyValue('--seqfx-resolved-cell-size')),
                rootScrollWidth: document.documentElement.scrollWidth,
                rowCounts: [...rowCounts.values()],
                scrollWidth: options.scrollWidth,
                viewportWidth: window.innerWidth,
            };
        });

        assert.deepEqual(geometry.rowCounts, [6, 6], `${size.id} picker should render exactly two rows of six`);
        assert.equal(geometry.allInside, true, `${size.id} effect buttons should stay inside the picker`);
        assert.deepEqual(geometry.hiddenOrClippedContent, [], `${size.id} should preserve every option's visible icon and name`);
        assertClose(geometry.cellHeight, geometry.cellWidth, 0.75, `${size.id} sequencer cell should remain square`);
        assertClose(geometry.resolvedCellSize, geometry.cellWidth, 0.75, `${size.id} root cell-size authority`);
        assertClose(geometry.buttonHeight, geometry.cellHeight, 0.75, `${size.id} picker height should equal sequencer-cell height`);
        assertClose(
            geometry.buttonWidth,
            (2 * geometry.cellWidth) + geometry.normalGap,
            0.75,
            `${size.id} picker width should equal two cells plus the ordinary gap`,
        );
        assert.deepEqual(geometry.baseButtonSurface, geometry.baseCellSurface, `${size.id} picker and cell should share the base surface contract`);
        assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${size.id} picker should not clip or scroll horizontally`);
        assert.ok(geometry.rootScrollWidth <= geometry.viewportWidth + 1, `${size.id} picker should not create page overflow`);
        if (size.id === "narrow stack") {
            assert.ok(geometry.pickerScrollWidth > geometry.pickerClientWidth, "narrow picker should retain its owned horizontal scroll");
        } else {
            assert.ok(geometry.pickerScrollWidth <= geometry.pickerClientWidth + 1, `${size.id} picker should fit without scrolling`);
        }
    }

    await page.setViewportSize({ width: 1280, height: 820 });
    await settleLayout();
    await page.getByRole("button", { name: "Chain 1 step 2", exact: true }).click();
    const selectedCell = page.locator('[data-role="seqfx-cell"][data-lane="0"][data-step="1"]');
    const selectedEffect = picker.locator('[data-role="seqfx-effect-type-option"].is-selected');
    const selectedSurface = async (locator) => locator.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
            backgroundColor: style.backgroundColor,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
        };
    });
    assert.deepEqual(
        await selectedSurface(selectedEffect),
        await selectedSurface(selectedCell),
        "selected picker and cell states should share the authoritative surface",
    );

    const focusedSurface = async (previousLocator, locator) => {
        await previousLocator.focus();
        await previousLocator.press("Tab");
        assert.equal(await locator.evaluate((node) => node === document.activeElement), true, "Tab should reach the expected cell surface");
        return locator.evaluate((node) => {
            const style = getComputedStyle(node);
            return {
                boxShadow: style.boxShadow,
                outlineColor: style.outlineColor,
                outlineOffset: style.outlineOffset,
                outlineStyle: style.outlineStyle,
                outlineWidth: style.outlineWidth,
            };
        });
    };
    const focusedCellSurface = await focusedSurface(
        page.locator('[data-role="seqfx-cell"][data-lane="0"][data-step="1"]'),
        page.locator('[data-role="seqfx-cell"][data-lane="0"][data-step="2"]'),
    );
    const focusedButtonSurface = await focusedSurface(
        page.getByRole("button", { name: "Filter", exact: true }),
        page.getByRole("button", { name: "Crush", exact: true }),
    );
    assert.deepEqual(focusedButtonSurface, focusedCellSurface, "focused picker and cell states should share the authoritative surface");

    const baseCell = page.locator(
        '.seqfx-cell:not(.has-frame-corner-tl):not(.has-frame-corner-tr):not(.has-frame-corner-bl):not(.has-frame-corner-br):not(.is-alt-bar):not(.is-covered):not(.is-selected):not(.is-playhead)',
    ).first();
    const baseButton = picker.locator('[data-role="seqfx-effect-type-option"]:not(.is-selected)').first();
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(150);
    await baseCell.hover();
    await page.waitForTimeout(150);
    const hoveredCellSurface = await selectedSurface(baseCell);
    await baseButton.hover();
    await page.waitForTimeout(150);
    const hoveredButtonSurface = await selectedSurface(baseButton);
    assert.deepEqual(hoveredButtonSurface, hoveredCellSurface, "hovered picker and cell states should keep the same surface contract");

    await page.getByRole("button", { name: "Chain 4 Stutter block 1", exact: true }).click();
    const dirty = page.getByRole("button", { name: "Dirty", exact: true });
    await dirty.focus();
    await page.keyboard.press("Enter");
    assert.equal(await dirty.getAttribute("aria-pressed"), "true", "keyboard activation should select an effect");
    await page.getByRole("button", { name: "Chain 4 Dirty block 1", exact: true }).waitFor();

    const stutter = page.getByRole("button", { name: "Stutter", exact: true });
    await stutter.focus();
    await page.keyboard.press("Space");
    assert.equal(await stutter.getAttribute("aria-pressed"), "true", "Space should retain native button selection behavior");
    await page.getByRole("button", { name: "Chain 4 Stutter block 1", exact: true }).waitFor();

    await page.close();
});

test("seqfx_renders_tasteful_decorative_accents_in_title_inspector_and_empty_state", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    const decor = await page.evaluate(() => {
        const titleSigil = document.querySelector('[data-role="seqfx-title-sigil"]');
        const titleSigilStyle = titleSigil ? getComputedStyle(titleSigil) : null;
        const inspectorBullet = document.querySelector('[data-role="seqfx-inspector-bullet"]');
        const inspectorBulletStyle = inspectorBullet ? getComputedStyle(inspectorBullet) : null;
        const emptyIcon = document.querySelector('[data-role="seqfx-empty-icon"]');
        const empty = document.querySelector('[data-role="seqfx-empty"]');
        const emptyStyle = empty ? getComputedStyle(empty) : null;
        const heading = document.querySelector(".seqfx-inspector-heading strong");
        const headingContainer = document.querySelector(".seqfx-inspector-heading");
        const inspectorRule = document.querySelector('[data-role="seqfx-inspector-rule"]');
        const inspectorRuleStyle = inspectorRule ? getComputedStyle(inspectorRule) : null;
        const topbar = document.querySelector(".seqfx-topbar");
        return {
            titleSigilTag: titleSigil?.tagName?.toLowerCase() ?? null,
            titleSigilWidth: titleSigil ? Math.round(titleSigil.getBoundingClientRect().width) : 0,
            titleSigilHeight: titleSigil ? Math.round(titleSigil.getBoundingClientRect().height) : 0,
            titleSigilStrokes: titleSigil?.querySelectorAll("path").length ?? 0,
            titleSigilColor: titleSigilStyle?.color ?? "",
            inspectorBulletCssWidth: inspectorBulletStyle ? parseFloat(inspectorBulletStyle.width) : 0,
            inspectorBulletCssHeight: inspectorBulletStyle ? parseFloat(inspectorBulletStyle.height) : 0,
            inspectorBulletVisualWidth: inspectorBullet ? Math.round(inspectorBullet.getBoundingClientRect().width) : 0,
            inspectorBulletTransform: inspectorBulletStyle?.transform ?? "",
            inspectorHeadingHeight: heading ? heading.getBoundingClientRect().height : null,
            inspectorHeadingFontSize: heading ? getComputedStyle(heading).fontSize : null,
            inspectorRuleExists: Boolean(inspectorRule),
            inspectorRuleHeight: inspectorRule ? Math.round(inspectorRule.getBoundingClientRect().height) : null,
            inspectorRuleWidth: inspectorRule ? Math.round(inspectorRule.getBoundingClientRect().width) : 0,
            inspectorRuleBackground: inspectorRuleStyle?.backgroundImage ?? "",
            inspectorRuleStartsAfterStrong: inspectorRule && heading
                ? Math.round(inspectorRule.getBoundingClientRect().left) >= Math.round(heading.getBoundingClientRect().right)
                : false,
            inspectorRuleEndsAtHeading: inspectorRule && headingContainer
                ? Math.abs(inspectorRule.getBoundingClientRect().right - headingContainer.getBoundingClientRect().right) <= 1
                : false,
            emptyHasIcon: Boolean(emptyIcon),
            emptyIconTag: emptyIcon?.tagName?.toLowerCase() ?? null,
            emptyText: empty?.textContent?.trim() ?? "",
            emptyDisplay: emptyStyle?.display ?? "",
            topbarHeight: topbar ? topbar.getBoundingClientRect().height : null,
        };
    });

    assert.equal(decor.titleSigilTag, "svg", "title sigil should render as an svg");
    assert.ok(decor.titleSigilWidth >= 12 && decor.titleSigilWidth <= 24, `sigil width should be small, got ${decor.titleSigilWidth}px`);
    assert.equal(decor.titleSigilHeight, decor.titleSigilWidth, "sigil should be square");
    assert.equal(decor.titleSigilStrokes, 4, "step-sequencer sigil should have four bars");
    assert.match(decor.titleSigilColor, /^rgba?\(/, "sigil color should resolve to a real color");
    assert.equal(decor.inspectorBulletCssWidth, 6, "inspector bullet should be sized from a 6px square");
    assert.equal(decor.inspectorBulletCssHeight, 6, "inspector bullet should be sized from a 6px square");
    assert.ok(decor.inspectorBulletVisualWidth <= 9, `rotated inspector bullet should stay compact, got ${decor.inspectorBulletVisualWidth}px`);
    assert.match(decor.inspectorBulletTransform, /matrix/, "inspector bullet should be rotated");
    assert.equal(decor.inspectorHeadingFontSize, "13px", "inspector heading font size must remain compact");
    assert.ok(decor.inspectorHeadingHeight <= 18, `inspector heading should remain compact, got ${decor.inspectorHeadingHeight}px`);
    assert.equal(decor.inspectorRuleExists, true, "inspector heading should carry a trailing hairline rule");
    assert.equal(decor.inspectorRuleHeight, 1, `inspector hairline rule should be a single pixel tall, got ${decor.inspectorRuleHeight}px`);
    assert.ok(decor.inspectorRuleWidth >= 24, `inspector hairline rule should expand to fill the heading, got ${decor.inspectorRuleWidth}px`);
    assert.match(decor.inspectorRuleBackground, /linear-gradient/, "inspector hairline should use a fading gradient");
    assert.equal(decor.inspectorRuleStartsAfterStrong, true, "inspector hairline should sit after the heading text");
    assert.equal(decor.inspectorRuleEndsAtHeading, true, "inspector hairline should reach the heading container's right edge");
    assert.equal(decor.emptyHasIcon, true, "empty state should pair text with an icon");
    assert.equal(decor.emptyIconTag, "svg", "empty state icon should render as an svg");
    assert.equal(decor.emptyDisplay, "flex", "empty state should lay out icon and text on a row");
    assert.equal(decor.emptyText, "Choose a lane cell to edit its mix and effect settings.");
    assert.ok(decor.topbarHeight !== null && decor.topbarHeight <= 42, `topbar should remain compact, got ${decor.topbarHeight}px`);

    await page.close();
});

test("seqfx_renders_mix_row_glyph_and_delete_block_glyph_with_compact_layout", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 4 step 5", exact: true }).click();
    await page.locator('[data-role="seqfx-mix-row"]').waitFor();
    await page.locator('[data-role="seqfx-delete-block"]').waitFor();

    const decor = await page.evaluate(() => {
        const mixRow = document.querySelector('[data-role="seqfx-mix-row"]');
        const mixRowLabel = mixRow?.querySelector(".seqfx-mix-row__label");
        const mixGlyph = document.querySelector('[data-role="seqfx-mix-glyph"]');
        const mixGlyphStyle = mixGlyph ? getComputedStyle(mixGlyph) : null;
        const deleteButton = document.querySelector('[data-role="seqfx-delete-block"]');
        const deleteButtonStyle = deleteButton ? getComputedStyle(deleteButton) : null;
        const deleteGlyph = document.querySelector('[data-role="seqfx-delete-glyph"]');
        const deleteGlyphStyle = deleteGlyph ? getComputedStyle(deleteGlyph) : null;
        const mixRowHeight = mixRow?.getBoundingClientRect().height ?? null;
        const mixRowText = mixRowLabel?.textContent?.trim() ?? "";
        const deleteText = deleteButton?.textContent?.trim() ?? "";

        return {
            mixGlyphTag: mixGlyph?.tagName?.toLowerCase() ?? null,
            mixGlyphWidth: mixGlyph ? Math.round(mixGlyph.getBoundingClientRect().width) : 0,
            mixGlyphHeight: mixGlyph ? Math.round(mixGlyph.getBoundingClientRect().height) : 0,
            mixGlyphHasLine: Boolean(mixGlyph?.querySelector("line")),
            mixGlyphHasThumb: Boolean(mixGlyph?.querySelector("circle")),
            mixGlyphInsideLabel: Boolean(mixRowLabel?.contains(mixGlyph)),
            mixGlyphLabelDisplay: mixRowLabel ? getComputedStyle(mixRowLabel).display : "",
            mixGlyphSitsBeforeText: mixGlyph && mixRowLabel
                ? mixGlyph.getBoundingClientRect().right <= mixRowLabel.getBoundingClientRect().right
                : false,
            mixGlyphColor: mixGlyphStyle?.color ?? "",
            mixRowHeight,
            mixRowText,
            deleteGlyphTag: deleteGlyph?.tagName?.toLowerCase() ?? null,
            deleteGlyphWidth: deleteGlyph ? Math.round(deleteGlyph.getBoundingClientRect().width) : 0,
            deleteGlyphHeight: deleteGlyph ? Math.round(deleteGlyph.getBoundingClientRect().height) : 0,
            deleteGlyphPathCount: deleteGlyph?.querySelectorAll("path").length ?? 0,
            deleteGlyphInsideButton: Boolean(deleteButton?.contains(deleteGlyph)),
            deleteGlyphSitsBeforeText: deleteGlyph && deleteButton
                ? deleteGlyph.getBoundingClientRect().left < deleteButton.getBoundingClientRect().left + (deleteButton.getBoundingClientRect().width / 2)
                : false,
            deleteGlyphColor: deleteGlyphStyle?.color ?? "",
            deleteButtonDisplay: deleteButtonStyle?.display ?? "",
            deleteButtonHeight: deleteButton?.getBoundingClientRect().height ?? null,
            deleteText,
        };
    });

    assert.equal(decor.mixGlyphTag, "svg", "mix-row glyph should render as an svg");
    assert.ok(decor.mixGlyphWidth >= 10 && decor.mixGlyphWidth <= 16, `mix glyph width should stay compact, got ${decor.mixGlyphWidth}px`);
    assert.equal(decor.mixGlyphHeight, decor.mixGlyphWidth, "mix glyph should be square");
    assert.equal(decor.mixGlyphHasLine, true, "mix glyph should include a slider track line");
    assert.equal(decor.mixGlyphHasThumb, true, "mix glyph should include a slider thumb circle");
    assert.equal(decor.mixGlyphInsideLabel, true, "mix glyph should sit inside the label container");
    assert.ok(
        ["flex", "inline-flex"].includes(decor.mixGlyphLabelDisplay),
        `mix-row label should align icon and text with flex, got ${decor.mixGlyphLabelDisplay}`,
    );
    assert.equal(decor.mixGlyphSitsBeforeText, true, "mix glyph should sit alongside the label text");
    assert.match(decor.mixGlyphColor, /^rgba?\(/, "mix glyph color should resolve to a real color");
    assert.equal(decor.mixRowText, "Block mix", "mix-row label text should remain unchanged");
    assert.ok(decor.mixRowHeight !== null && decor.mixRowHeight <= 36, `mix row should stay compact, got ${decor.mixRowHeight}px`);

    assert.equal(decor.deleteGlyphTag, "svg", "delete glyph should render as an svg");
    assert.ok(decor.deleteGlyphWidth >= 10 && decor.deleteGlyphWidth <= 14, `delete glyph width should stay compact, got ${decor.deleteGlyphWidth}px`);
    assert.equal(decor.deleteGlyphHeight, decor.deleteGlyphWidth, "delete glyph should be square");
    assert.equal(decor.deleteGlyphPathCount, 1, "delete glyph should be a single combined path");
    assert.equal(decor.deleteGlyphInsideButton, true, "delete glyph should sit inside the delete button");
    assert.equal(decor.deleteGlyphSitsBeforeText, true, "delete glyph should sit before the label text");
    assert.match(decor.deleteGlyphColor, /^rgba?\(/, "delete glyph color should resolve to a real color");
    assert.equal(decor.deleteButtonDisplay, "flex", "delete button should align glyph and text via flex");
    assert.ok(decor.deleteButtonHeight !== null && decor.deleteButtonHeight <= 40, `delete button should stay compact, got ${decor.deleteButtonHeight}px`);
    assert.equal(decor.deleteText, "Delete Block", "delete button label should remain readable");

    await page.close();
});

test("seqfx responsive workspace contracts, stacks, reflows, and preserves state across resize", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 4 Stutter block 1", exact: true }).waitFor();

    const settleLayout = () => page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const measureWorkspace = () => page.evaluate(() => {
        const rectFor = (selector) => {
            const node = document.querySelector(selector);
            if (!node) throw new Error(`Missing responsive-layout node: ${selector}`);
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

        const root = document.querySelector('[data-role="seqfx-root"]');
        const shell = document.querySelector(".seqfx-grid-shell");
        const inspector = document.querySelector('[data-role="seqfx-inspector"]');
        const cell = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="0"]');
        const step2 = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="1"]').getBoundingClientRect();
        const step4 = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="3"]').getBoundingClientRect();
        const step5 = document.querySelector('[data-role="seqfx-cell"][data-lane="0"][data-step="4"]').getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        return {
            beatGap: step5.left - step4.right,
            cell: rectFor('[data-role="seqfx-cell"][data-lane="0"][data-step="0"]'),
            gridShell: rectFor(".seqfx-grid-shell"),
            inspector: rectFor('[data-role="seqfx-inspector"]'),
            root: rectFor('[data-role="seqfx-root"]'),
            rootClientHeight: root.clientHeight,
            rootClientWidth: root.clientWidth,
            rootOverflowY: getComputedStyle(root).overflowY,
            rootScrollHeight: root.scrollHeight,
            rootScrollWidth: root.scrollWidth,
            shellClientHeight: shell.clientHeight,
            shellClientWidth: shell.clientWidth,
            shellScrollHeight: shell.scrollHeight,
            shellScrollWidth: shell.scrollWidth,
            inspectorClientHeight: inspector.clientHeight,
            inspectorClientWidth: inspector.clientWidth,
            inspectorOverflowY: getComputedStyle(inspector).overflowY,
            inspectorScrollHeight: inspector.scrollHeight,
            inspectorScrollWidth: inspector.scrollWidth,
            normalGap: step2.left - cellRect.right,
            workspace: rectFor(".seqfx-workspace"),
            viewportWidth: window.innerWidth,
            cellAriaLabel: cell.getAttribute("aria-label"),
        };
    });

    const wide = await measureWorkspace();
    await page.setViewportSize({ width: 1061, height: 820 });
    await settleLayout();
    const justAbove = await measureWorkspace();
    assert.ok(justAbove.gridShell.width < wide.gridShell.width, "sequencer should contract as the host narrows");
    assert.ok(justAbove.inspector.width < wide.inspector.width, "inspector should contract as the host narrows");
    assert.ok(justAbove.gridShell.width >= 528, `sequencer should retain its 528px floor, got ${justAbove.gridShell.width}px`);
    assert.ok(justAbove.inspector.width >= 480, `inspector should retain its 480px floor, got ${justAbove.inspector.width}px`);
    assert.ok(justAbove.gridShell.right < justAbove.inspector.left, "1061px should remain side-by-side");

    await page.setViewportSize({ width: 1060, height: 820 });
    await settleLayout();
    const atBreakpoint = await measureWorkspace();
    assertClose(atBreakpoint.workspace.left, 18, 0.75, "workspace left margin at 1060px");
    assertClose(atBreakpoint.viewportWidth - atBreakpoint.workspace.right, 18, 0.75, "workspace right margin at 1060px");
    assertClose(atBreakpoint.gridShell.width, 528, 0.75, "sequencer width at 1060px");
    assertClose(atBreakpoint.inspector.width, 480, 0.75, "inspector width at 1060px");
    assertClose(atBreakpoint.inspector.left - atBreakpoint.gridShell.right, 16, 0.75, "workspace gap at 1060px");
    assert.ok(atBreakpoint.cell.width >= 24, `step target should stay at least 24px, got ${atBreakpoint.cell.width}px`);
    assertClose(atBreakpoint.normalGap, 3, 0.75, "ordinary rhythmic gap at the sequencer floor");
    assertClose(atBreakpoint.beatGap, 9, 0.75, "beat-boundary gap at the sequencer floor");
    const floorPickerLayout = await page.getByRole("button", { name: "Stutter", exact: true }).evaluate((button) => {
        const icon = button.querySelector(".seqfx-effect-icon").getBoundingClientRect();
        const name = button.querySelector(".seqfx-effect-picker__name").getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        return { height: rect.height, iconRight: icon.right, nameLeft: name.left, width: rect.width };
    });
    assertClose(floorPickerLayout.height, atBreakpoint.cell.height, 0.75, "picker height at the 480px inspector floor");
    assertClose(
        floorPickerLayout.width,
        (2 * atBreakpoint.cell.width) + atBreakpoint.normalGap,
        0.75,
        "picker width at the inspector floor",
    );
    assert.ok(floorPickerLayout.nameLeft > floorPickerLayout.iconRight, "1060px picker should keep icon and short label horizontal");

    await page.setViewportSize({ width: 1059, height: 820 });
    await settleLayout();
    const justBelow = await measureWorkspace();
    assertClose(justBelow.gridShell.width, justBelow.workspace.width, 0.75, "stacked sequencer should fill the workspace");
    assertClose(justBelow.inspector.width, justBelow.workspace.width, 0.75, "stacked inspector should fill the workspace");
    assert.ok(justBelow.inspector.top > justBelow.gridShell.bottom, "1059px should stack the inspector below the sequencer");
    assertClose(justBelow.inspector.top - justBelow.gridShell.bottom, 16, 0.75, "stacked panel gap");

    await page.setViewportSize({ width: 420, height: 640 });
    await settleLayout();
    const narrowStack = await measureWorkspace();
    const stackedPickerLayout = await page.getByRole("button", { name: "Stutter", exact: true }).evaluate((button) => {
        const icon = button.querySelector(".seqfx-effect-icon").getBoundingClientRect();
        const name = button.querySelector(".seqfx-effect-picker__name").getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        return { height: rect.height, iconRight: icon.right, nameLeft: name.left, width: rect.width };
    });
    assertClose(stackedPickerLayout.height, narrowStack.cell.height, 0.75, "stacked narrow picker height");
    assertClose(
        stackedPickerLayout.width,
        (2 * narrowStack.cell.width) + narrowStack.normalGap,
        0.75,
        "stacked narrow picker width",
    );
    assert.ok(stackedPickerLayout.nameLeft > stackedPickerLayout.iconRight, "420px picker should keep its icon and short label visible");

    await page.setViewportSize({ width: 320, height: 640 });
    await settleLayout();
    const filterButton = page.getByRole("button", { name: "Filter", exact: true });
    await filterButton.focus();
    await filterButton.press("Enter");
    await page.locator('[data-role="filter-range-editor"]').waitFor();
    await settleLayout();
    const graphBox = await page.locator('[data-role="editor-curve-plot-area"]').first().boundingBox();
    assert.ok(graphBox && graphBox.height >= 140, `graph plot should retain at least 140px, got ${graphBox?.height}px`);

    const crusherButton = page.getByRole("button", { name: "Crush", exact: true });
    await crusherButton.focus();
    await crusherButton.press("Space");
    await page.locator('[data-role="seqfx-crusher-editor"]').waitFor();
    await settleLayout();
    const crusherGraphBox = await page.locator('[data-role="seqfx-crusher-editor"] [data-role="editor-curve-plot-area"]').boundingBox();
    assert.ok(crusherGraphBox && crusherGraphBox.height >= 140, `Crusher plot should retain at least 140px, got ${crusherGraphBox?.height}px`);

    const stutterButton = page.getByRole("button", { name: "Stutter", exact: true });
    await stutterButton.focus();
    await stutterButton.press("Space");
    await page.locator('[data-role="seqfx-stutter-editor"]').waitFor();
    await settleLayout();
    const stutterGraphBox = await page.locator('[data-role="seqfx-stutter-editor"] [data-role="editor-curve-plot-area"]').boundingBox();
    assert.ok(stutterGraphBox && stutterGraphBox.height >= 140, `Stutter plot should retain at least 140px, got ${stutterGraphBox?.height}px`);

    const narrowEffectLayout = await page.evaluate(() => {
        const rect = (node) => {
            const box = node.getBoundingClientRect();
            return { bottom: box.bottom, height: box.height, left: box.left, right: box.right, top: box.top, width: box.width };
        };
        const options = document.querySelector(".seqfx-effect-picker__options");
        const buttons = [...options.querySelectorAll("button")];
        const heading = document.querySelector(".seqfx-inspector-heading");
        const headingSummary = document.querySelector(".seqfx-inspector-heading__summary");
        const preset = document.querySelector('[data-role="seqfx-factory-effect-preset"]');
        const rowCounts = new Map();
        for (const button of buttons) {
            const key = Math.round(button.getBoundingClientRect().top);
            rowCounts.set(key, (rowCounts.get(key) ?? 0) + 1);
        }
        return {
            buttonRects: buttons.map(rect),
            fullNameDisplays: [...document.querySelectorAll(".seqfx-effect-picker__name--full")].map((node) => getComputedStyle(node).display),
            heading: rect(heading),
            headingSummary: rect(headingSummary),
            options: rect(options),
            pickerClientHeight: options.parentElement.clientHeight,
            pickerClientWidth: options.parentElement.clientWidth,
            pickerScrollHeight: options.parentElement.scrollHeight,
            pickerScrollWidth: options.parentElement.scrollWidth,
            preset: rect(preset),
            rowCounts: [...rowCounts.values()],
            shortNames: [...document.querySelectorAll(".seqfx-effect-picker__name--short")].map((node) => ({
                display: getComputedStyle(node).display,
                text: node.textContent.trim(),
            })),
            sliderTrackWidths: [...document.querySelectorAll(".seqfx-inspector .editor-tick-slider__track")]
                .map((node) => node.getBoundingClientRect().width),
        };
    });
    const expectedShortNames = Array.from({ length: 12 }, (_unused, index) => (
        effectDefinitionsModule.SEQFX_EFFECT_TYPE_SHORT_NAMES[index + 1]
    ));
    assert.deepEqual(narrowEffectLayout.rowCounts, [6, 6], "picker should remain exactly 2x6");
    assert.ok(narrowEffectLayout.pickerScrollWidth > narrowEffectLayout.pickerClientWidth, "exceptionally narrow picker should own its horizontal overflow");
    assert.ok(narrowEffectLayout.pickerScrollHeight <= narrowEffectLayout.pickerClientHeight + 1, "picker should not become a nested vertical scroller");
    assert.deepEqual(narrowEffectLayout.shortNames.map(({ text }) => text), expectedShortNames);
    assert.ok(narrowEffectLayout.shortNames.every(({ display }) => display !== "none"), "short names should be visible below 520px inspector width");
    assert.ok(narrowEffectLayout.fullNameDisplays.every((display) => display === "none"), "full visible names should yield to unique short names");
    for (const button of narrowEffectLayout.buttonRects) {
        assert.ok(button.width > 0 && button.height > 0, `picker target should remain visible, got ${button.width}x${button.height}px`);
        assert.ok(button.left >= narrowEffectLayout.options.left - 1 && button.right <= narrowEffectLayout.options.right + 1, "picker target should stay inside its grid");
    }
    assert.ok(narrowEffectLayout.preset.left >= narrowEffectLayout.heading.left - 1, "bare preset select should stay inside the heading at narrow width");
    assert.ok(narrowEffectLayout.preset.right <= narrowEffectLayout.heading.right + 1, "bare preset select should not clip past the heading");
    assert.ok(narrowEffectLayout.preset.top >= narrowEffectLayout.headingSummary.bottom - 1, "narrow heading may wrap the preset below the complete summary without overlap");
    assert.ok(narrowEffectLayout.preset.bottom <= narrowEffectLayout.heading.bottom + 1, "wrapped preset select should remain owned by the heading");
    assert.ok(narrowEffectLayout.sliderTrackWidths.length > 0, "selected effect should expose manipulation tracks");
    assert.ok(narrowEffectLayout.sliderTrackWidths.every((width) => width >= 96), `slider tracks should retain 96px, got ${narrowEffectLayout.sliderTrackWidths}`);

    const modToggle = await openSeqFxModView(page);
    await toggleSeqFxModTarget(page, 0);
    await modToggle.focus();
    const modToggleHandle = await modToggle.elementHandle();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const stateBeforeResize = await getHarnessSnapshot(page);
    const narrow = await measureWorkspace();
    const narrowModLayout = await page.locator('[data-role="seqfx-mod-target-row"][data-param="0"]').evaluate((row) => {
        const rect = (selector) => {
            const box = row.querySelector(selector).getBoundingClientRect();
            return { bottom: box.bottom, left: box.left, right: box.right, top: box.top, width: box.width };
        };
        return {
            amount: rect(".seqfx-mod-target-row__amount-control"),
            destination: rect(".seqfx-mod-target-row__destination"),
            name: rect(".seqfx-mod-target-row__name"),
            rowClientWidth: row.clientWidth,
            rowScrollWidth: row.scrollWidth,
            toggle: rect(".seqfx-mod-target-row__toggle"),
            value: rect(".seqfx-mod-target-row__amount-value"),
        };
    });
    assert.ok(narrow.rootScrollHeight > narrow.rootClientHeight, "narrow stack should flow through the root vertical scroller");
    assert.equal(narrow.rootOverflowY, "auto");
    assert.equal(narrow.inspectorOverflowY, "visible");
    assert.ok(narrow.inspectorScrollHeight <= narrow.inspectorClientHeight + 1, "inspector should not own a nested vertical scroll");
    assert.ok(narrow.inspectorScrollWidth <= narrow.inspectorClientWidth + 1, "inspector should not clip horizontally");
    assert.ok(narrow.shellScrollWidth > narrow.shellClientWidth, "only the narrow grid shell should preserve the sequencer floor with horizontal scroll");
    assert.ok(narrow.shellScrollHeight <= narrow.shellClientHeight + 1, "grid shell should not become a nested vertical scroller");
    assert.ok(narrow.rootScrollWidth <= narrow.rootClientWidth + 1, "root should not gain horizontal overflow");
    assert.equal(narrow.cellAriaLabel, "Chain 1 step 1", "step identity should remain intact at the content floor");
    assert.ok(narrowModLayout.amount.top > narrowModLayout.toggle.bottom, "Mod amount should reflow below name/toggle/readout");
    assert.ok(narrowModLayout.destination.top >= narrowModLayout.amount.bottom, "Mod destination should reflow below its amount track");
    assert.ok(narrowModLayout.amount.width >= 96, `Mod amount track should retain 96px, got ${narrowModLayout.amount.width}px`);
    assert.ok(narrowModLayout.rowScrollWidth <= narrowModLayout.rowClientWidth + 1, "Mod target row should not clip or overlap");

    await page.setViewportSize({ width: 1061, height: 820 });
    await settleLayout();
    const restored = await measureWorkspace();
    const stateAfterResize = await getHarnessSnapshot(page);
    assert.ok(restored.gridShell.right < restored.inspector.left, "widening should restore side-by-side columns");
    assert.equal(await page.evaluate((node) => node === document.querySelector('[data-role="seqfx-mod-toggle"]'), modToggleHandle), true, "resize should not remount the inspector control");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-role")), "seqfx-mod-toggle", "focused control should survive resize");
    assert.equal(await modToggle.getAttribute("aria-selected"), "true", "Mod tab selection should survive resize");
    assert.equal(await stutterButton.getAttribute("aria-pressed"), "true", "effect selection should survive resize");
    assert.deepEqual(stateAfterResize.events, stateBeforeResize.events, "resize should not emit host events");
    assert.deepEqual(stateAfterResize.storedStateWrites, stateBeforeResize.storedStateWrites, "resize should not write saved state");
    assert.deepEqual(stateAfterResize.storedState, stateBeforeResize.storedState, "resize should preserve saved state");

    await page.close();
});

test("seqfx Tape Stop free-time rows keep labels triggers segmented tracks and values clear at representative widths", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Tape Stop", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Tape Stop block 1", exact: true }).waitFor();
    await page.locator('[data-control="seqfx-tape-timing"]').selectOption("1");
    await page.locator('[data-control="seqfx-tape-return"]').selectOption("1");
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const sizes = [
        { id: "representative wide", width: 1280, height: 820, stacked: false },
        { id: "side-by-side floor", width: 1060, height: 820, stacked: false },
        { id: "stacked", width: 420, height: 640, stacked: true },
        { id: "narrow", width: 320, height: 640, stacked: true },
    ];

    for (const size of sizes) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const geometry = await page.evaluate(() => {
            const box = (node) => {
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
            const rows = ["seqfx-tape-stop-time", "seqfx-tape-start-time"].map((controlRole) => {
                const input = document.querySelector(`[data-control="${controlRole}"]`);
                const row = input?.closest('[data-role="seqfx-param-row"]');
                const label = row?.querySelector(".editor-tick-slider__label");
                const trigger = row?.querySelector(".editor-tick-slider__annotation");
                const track = row?.querySelector(".editor-tick-slider__track");
                const value = row?.querySelector('[data-role="seqfx-param-value"]');
                if (!input || !row || !label || !trigger || !track || !value) {
                    throw new Error(`Missing complete Tape Stop row for ${controlRole}`);
                }
                return {
                    controlRole,
                    inputType: input.getAttribute("type"),
                    label: box(label),
                    labelText: label.textContent?.replace(/\s+/g, " ").trim() ?? "",
                    row: box(row),
                    rowClientWidth: row.clientWidth,
                    rowScrollWidth: row.scrollWidth,
                    track: box(track),
                    trigger: box(trigger),
                    value: box(value),
                    valueText: value.textContent?.trim() ?? "",
                };
            });
            const root = document.querySelector('[data-role="seqfx-root"]');
            const grid = document.querySelector(".seqfx-grid-shell");
            const inspector = document.querySelector('[data-role="seqfx-inspector"]');
            return {
                grid: box(grid),
                inspector: box(inspector),
                rootClientWidth: root.clientWidth,
                rootScrollWidth: root.scrollWidth,
                rows,
            };
        });

        if (size.stacked) {
            assert.ok(geometry.inspector.top > geometry.grid.bottom, `${size.id} workspace should stack the inspector below the grid`);
        } else {
            assert.ok(geometry.inspector.left > geometry.grid.right, `${size.id} workspace should keep the inspector beside the grid`);
        }
        assert.ok(geometry.rootScrollWidth <= geometry.rootClientWidth + 1, `${size.id} Tape Stop inspector should not create page overflow`);

        for (const row of geometry.rows) {
            const rectanglesOverlap = (first, second) => (
                first.left < second.right - 0.5
                && first.right > second.left + 0.5
                && first.top < second.bottom - 0.5
                && first.bottom > second.top + 0.5
            );
            assert.equal(row.inputType, "range", `${size.id} ${row.controlRole} should keep its segmented range input`);
            assert.match(row.labelText, /^(Start|Stop) Time\s*Trigger$/, `${size.id} ${row.controlRole} should keep its label and Trigger annotation`);
            assert.ok(row.valueText.length > 0, `${size.id} ${row.controlRole} should keep its visible value`);
            assert.ok(row.track.width > 0 && row.track.height > 0, `${size.id} ${row.controlRole} should keep a measurable segmented track`);
            assert.ok(row.trigger.width > 0 && row.trigger.height > 0, `${size.id} ${row.controlRole} should keep a visible Trigger chip`);
            assert.ok(row.rowScrollWidth <= row.rowClientWidth + 1, `${size.id} ${row.controlRole} should not overflow its row`);
            assert.ok(row.label.left >= row.row.left - 1 && row.label.right <= row.row.right + 1, `${size.id} ${row.controlRole} label should stay in its row`);
            assert.ok(row.track.left >= row.row.left - 1 && row.track.right <= row.row.right + 1, `${size.id} ${row.controlRole} track should stay in its row`);
            assert.ok(row.value.left >= row.row.left - 1 && row.value.right <= row.row.right + 1, `${size.id} ${row.controlRole} value should stay in its row`);
            assert.equal(rectanglesOverlap(row.label, row.track), false, `${size.id} ${row.controlRole} label must not overlap the segmented track`);
            assert.equal(rectanglesOverlap(row.value, row.track), false, `${size.id} ${row.controlRole} value must not overlap the segmented track`);
            assert.equal(rectanglesOverlap(row.label, row.value), false, `${size.id} ${row.controlRole} label must not overlap the value`);
        }
    }

    const resizeSnapshot = await getHarnessSnapshot(page);
    assert.deepEqual(resizeSnapshot.events, [], "Tape Stop resizing should not emit host writes");
    assert.deepEqual(resizeSnapshot.storedStateWrites, [], "Tape Stop resizing should not persist state");
    await page.close();
});

test("seqfx effect controls expose modulation affordances exactly for aux-eligible metadata", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();

    for (const effectType of effectDefinitionsModule.SEQFX_SELECTABLE_EFFECT_IDS) {
        const definition = effectDefinitionsModule.getSeqFxEffectDefinition(effectType);
        await page.locator(`[data-role="seqfx-effect-type-option"][data-effect-type="${effectType}"]`).click();
        await page.getByRole("button", { name: `Chain 1 ${definition.name} block 1`, exact: true }).waitFor();
        const advanced = page.locator('[data-role="seqfx-advanced-parameters"]');
        if (await advanced.count()) {
            await openSeqFxAdvancedParameters(page);
        }

        const renderedLabels = await page.locator([
            "button.editor-tick-slider__label--toggle",
            'button[data-role="seqfx-crusher-drive-db-mod-toggle"]',
            'button[data-role="seqfx-stutter-gate-mod-toggle"]',
            'button[data-role="seqfx-stutter-shape-mod-toggle"]',
            'button[data-role="seqfx-filter-param-mod-toggle"]',
        ].join(", ")).evaluateAll((buttons) => buttons.map((button) => (
            button.querySelector("span")?.textContent?.trim() ?? ""
        )).sort());
        const eligibleLabels = definition.parameters
            .filter((parameter) => parameter.auxEligible)
            .map((parameter) => parameter.label)
            .sort();
        assert.deepEqual(
            renderedLabels,
            eligibleLabels,
            `${definition.name} effect controls should mirror auxEligible metadata exactly`,
        );
    }

    await page.getByRole("button", { name: "Vibro", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Vibro block 1", exact: true }).waitFor();
    const rateToggle = page.locator('[data-role="seqfx-param-row"][data-param="0"] .editor-tick-slider__label--toggle');
    const depthToggle = page.locator('[data-role="seqfx-param-row"][data-param="1"] .editor-tick-slider__label--toggle');
    assert.equal(await rateToggle.getAttribute("aria-pressed"), "false");
    assert.equal(await depthToggle.getAttribute("aria-pressed"), "false");
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await rateToggle.click();
    await depthToggle.click();
    assert.equal(await rateToggle.getAttribute("aria-pressed"), "true");
    assert.equal(await depthToggle.getAttribute("aria-pressed"), "true");

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    const vibro = effectDefinitionsModule.getSeqFxEffectDefinition(SEQFX_EFFECT_TYPES.vibro);
    assert.deepEqual(upload.params[0][0].slice(0, vibro.parameters.length), vibro.parameters.map((parameter) => parameter.defaultValue));
    assert.equal(upload.auxEnabled[0][0][0], true);
    assert.equal(upload.auxEnabled[0][0][1], true);
    assertClose(upload.auxEnd[0][0][0], vibro.parameters[0].defaultValue, 0.000001, "Vibro Rate toggle should preserve its modulation destination");
    assertClose(upload.auxEnd[0][0][1], vibro.parameters[1].defaultValue, 0.000001, "Vibro Depth toggle should preserve its modulation destination");
    await page.close();
});

test("seqfx bare preset select belongs to the inspector heading and stays keyboard-usable across wrapping", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();

    const preset = page.locator('[data-role="seqfx-factory-effect-preset"]');
    const heading = page.locator(".seqfx-inspector-heading");
    assert.equal(await heading.locator('[data-role="seqfx-factory-effect-preset"]').count(), 1);
    assert.equal(await page.locator(".seqfx-factory-preset").count(), 0, "the old preset card owner should be absent");
    assert.equal(await page.getByText("Effect preset", { exact: true }).count(), 0, "the visible preset label should be absent");
    assert.equal(await page.locator('[data-role="seqfx-factory-effect-preset-description"]').count(), 0, "the preset description should be absent");

    const assertHeadingLayout = async (id) => {
        const layout = await heading.evaluate((node) => {
            const rect = (target) => {
                const bounds = target.getBoundingClientRect();
                return { bottom: bounds.bottom, left: bounds.left, right: bounds.right, top: bounds.top };
            };
            const summary = node.querySelector(".seqfx-inspector-heading__summary");
            const select = node.querySelector('[data-role="seqfx-factory-effect-preset"]');
            const inspector = node.closest('[data-role="seqfx-inspector"]');
            const root = document.querySelector('[data-role="seqfx-root"]');
            return {
                heading: rect(node),
                inspector: rect(inspector),
                preset: rect(select),
                rootClientWidth: root.clientWidth,
                rootScrollWidth: root.scrollWidth,
                summary: rect(summary),
            };
        });
        const verticallyOverlaps = layout.summary.top < layout.preset.bottom - 0.5
            && layout.summary.bottom > layout.preset.top + 0.5;
        const clearPlacement = verticallyOverlaps
            ? layout.preset.left >= layout.summary.right - 0.5
            : layout.preset.top >= layout.summary.bottom - 0.5;
        assert.equal(clearPlacement, true, `${id} preset should sit beside or cleanly below the complete summary`);
        assert.ok(layout.preset.left >= layout.heading.left - 1 && layout.preset.right <= layout.heading.right + 1, `${id} preset should stay inside the heading`);
        assert.ok(layout.heading.left >= layout.inspector.left - 1 && layout.heading.right <= layout.inspector.right + 1, `${id} heading should stay inside the inspector`);
        assert.ok(layout.rootScrollWidth <= layout.rootClientWidth + 1, `${id} header preset should not create page overflow`);
    };

    await assertHeadingLayout("wide");
    await preset.focus();
    assert.equal(await preset.evaluate((node) => document.activeElement === node), true, "preset select should take keyboard focus");
    const keyboardOwnership = await preset.evaluate((node) => {
        const event = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            code: "ArrowDown",
            key: "ArrowDown",
        });
        node.dispatchEvent(event);
        return {
            defaultPrevented: event.defaultPrevented,
            tagName: node.tagName,
        };
    });
    assert.deepEqual(keyboardOwnership, { defaultPrevented: false, tagName: "SELECT" }, "preset should keep native select keyboard ownership");
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const firstFilterPreset = effectDefinitionsModule.getSeqFxEffectDefinition(SEQFX_EFFECT_TYPES.filter).factoryPresets[0];
    await preset.selectOption(firstFilterPreset.id);
    const snapshotAfterKeyboard = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshotAfterKeyboard).at(-1).value;
    assert.equal(await preset.inputValue(), firstFilterPreset.id);
    assertClose(upload.mix[0][0], firstFilterPreset.mix, 0.000001, "keyboard preset choice should write its mix");
    assert.deepEqual(upload.params[0][0].slice(0, firstFilterPreset.params.length), [...firstFilterPreset.params]);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const stateBeforeResize = await getHarnessSnapshot(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await assertHeadingLayout("narrow");
    const stateAfterResize = await getHarnessSnapshot(page);
    assert.equal(await preset.inputValue(), firstFilterPreset.id, "selected preset should survive header wrapping");
    assert.deepEqual(stateAfterResize.events, stateBeforeResize.events, "header wrapping should not emit host writes");
    assert.deepEqual(stateAfterResize.storedStateWrites, stateBeforeResize.storedStateWrites, "header wrapping should not write saved state");
    assert.deepEqual(stateAfterResize.storedState, stateBeforeResize.storedState, "header wrapping should preserve saved state");
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
        const cornerGlyph = frameElement.querySelector('[data-role="seqfx-bar-frame-corner-glyph"]');
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
            accentCornerGlyphCount: frameElement.querySelectorAll('[data-role="seqfx-bar-frame-corner-glyph"].is-accent').length,
            cornerGlyphCount: frameElement.querySelectorAll('[data-role="seqfx-bar-frame-corner-glyph"]').length,
            cornerGlyphStroke: getComputedStyle(cornerGlyph).stroke,
            cornerGlyphPathSignatures: [...frameElement.querySelectorAll('[data-role="seqfx-bar-frame-corner-glyph"]')]
                .map((glyph) => [...glyph.querySelectorAll("path")].map((path) => path.getAttribute("d")).join("|")),
            firstCellBorderTopStyle: getComputedStyle(firstCell).borderTopStyle,
            firstCellBoxShadow: getComputedStyle(firstCell).boxShadow,
            flowGlyphCount: frameElement.querySelectorAll('[data-role="seqfx-bar-frame-flow-glyph"]').length,
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
            secondAccentCornerGlyphCount: secondFrameElement.querySelectorAll('[data-role="seqfx-bar-frame-corner-glyph"].is-accent').length,
            secondCornerGlyphCount: secondFrameElement.querySelectorAll('[data-role="seqfx-bar-frame-corner-glyph"]').length,
            secondFlowGlyphCount: secondFrameElement.querySelectorAll('[data-role="seqfx-bar-frame-flow-glyph"]').length,
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
    assert.equal(layout.cornerGlyphCount, 4);
    assert.equal(layout.flowGlyphCount, 0);
    assert.equal(layout.secondCornerGlyphCount, 4);
    assert.equal(layout.secondFlowGlyphCount, 0);
    assert.equal(layout.accentCornerGlyphCount, 1);
    assert.equal(layout.secondAccentCornerGlyphCount, 1);
    assert.equal(new Set(layout.cornerGlyphPathSignatures).size, 4);
    assert.match(layout.cornerGlyphStroke, /rgba\(28,\s*28,\s*28,/);
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

test("seqfx_inspector_top_edge_aligns_with_the_grid_plate_top_edge", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();

    for (const width of [1060, 1280]) {
        await page.setViewportSize({ width, height: 820 });
        await page.waitForFunction(() => {
            const frame = document.querySelector('[data-role="seqfx-bar-frame"][data-bar="0"]');
            const lanes = document.querySelector('[data-role="seqfx-bar-lanes"][data-bar="0"]');
            if (!frame || !lanes) return false;
            return Math.abs(frame.getBoundingClientRect().width - (lanes.getBoundingClientRect().width + 32)) < 1;
        });

        const layout = await page.evaluate(() => {
            const frame = document.querySelector('[data-role="seqfx-bar-frame"][data-bar="0"]');
            const outerPath = frame.querySelector('[data-role="seqfx-bar-frame-outer-body"]');
            const svg = frame.querySelector("svg");
            const inspector = document.querySelector('[data-role="seqfx-inspector"]');
            const frameRect = frame.getBoundingClientRect();
            const inspectorRect = inspector.getBoundingClientRect();
            const viewBoxHeight = Number(svg.getAttribute("viewBox").trim().split(/\s+/)[3]);
            const pathValues = [...outerPath.getAttribute("d").matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
            const outerTop = Math.min(...pathValues.filter((_value, index) => index % 2 === 1));
            const gridPlateTop = frameRect.top + ((outerTop / viewBoxHeight) * frameRect.height);

            return {
                gridPlateTop,
                inspectorTop: inspectorRect.top,
            };
        });

        assertClose(layout.inspectorTop, layout.gridPlateTop, 0.75, `inspector plate should align with grid plate at ${width}px`);
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
    await page.locator('[data-role="seqfx-inspector"]').getByText("Chain 1 · Filter · step 1").waitFor({ timeout: 400 });

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
    assert.match(sidebarFit.backgroundColor, /rgba\(/, "filter editor should use the translucent material island fill");
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
        inspectorLayout.mixTop < inspectorLayout.filterBottom,
        `SeqFX mix row should stay fixed before the active effect editor, got mix top ${inspectorLayout.mixTop} and filter bottom ${inspectorLayout.filterBottom}`,
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
    assert.equal(await page.locator('[data-role="seqfx-mod-target-destination"][data-param="0"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-amount-value"][data-param="1"]').textContent(), "-2.00 oct");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-destination"][data-param="1"]').textContent(), "500 Hz");

    await setSeqFxModTargetAmount(page, 1, -1);
    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[0][0][1], 2000, 0.001, "cutoff Mod amount edit should not rewrite the filter start cutoff");
    assertClose(upload.auxEnd[0][0][1], 1000, 0.001, "cutoff -1 oct amount should write a physical 1 kHz range end");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-amount-value"][data-param="1"]').textContent(), "-1.00 oct");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-destination"][data-param="1"]').textContent(), "1 kHz");
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
    assertClose(upload.auxEnd[0][0][3], 3.707, 0.000001, "resonance +3 amount should preserve the canonical 0.001 Q precision");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-amount-value"][data-param="3"]').textContent(), "Q +3.00");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-destination"][data-param="3"]').textContent(), "Q 3.707");

    await page.locator('[data-role="seqfx-mod-target-amount"][data-param="3"]').dblclick();
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][3], true);
    assertClose(upload.auxEnd[0][0][3], 0.707, 0.000001, "double-click should reset bipolar resonance amount to zero");
    assert.equal(await page.locator('[data-role="seqfx-mod-target-amount-value"][data-param="3"]').textContent(), "Q 0.00");
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

test("seqfx_crush_aux_controls_edit_source_targets_and_v7_storage", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crush block 1", exact: true }).waitFor();
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

    assert.ok(layout.inspector.width >= 480, `inspector should stay above its content floor, got ${layout.inspector.width}px`);
    assert.ok(layout.gridShell.width > layout.inspector.width, "the proportional side-by-side allocation should favor the sequencer");
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
    assert.ok(nearBreakpointLayout.inspector.width >= 420, `stacked inspector should stay wide, got ${nearBreakpointLayout.inspector.width}px`);
    assertClose(nearBreakpointLayout.inspector.width, nearBreakpointLayout.gridShell.width, 1, "stacked panels should fill the same workspace width");
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

    await page.setViewportSize({ width: 640, height: 820 });
    const stackedLayout = await measureLayout();
    assert.ok(stackedLayout.inspector.top > stackedLayout.gridShell.bottom, "workspace should stack below the reduced breakpoint");

    await page.close();
});

test("seqfx_aux_source_dot_uses_monitor_cycle_phase_and_amount", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crush block 1", exact: true }).waitFor();
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
    await page.getByRole("button", { name: "Chain 2 Crush block 1", exact: true }).click();
    await openSeqFxModView(page);
    await page.locator('[data-role="seqfx-aux-source"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 Crush block 3", exact: true }).click({ modifiers: ["Shift"] });
    await page.locator('[data-role="seqfx-crusher-editor"]').waitFor();
    assert.equal(await page.locator('[data-role="seqfx-mod-toggle"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-aux-source"]').count(), 0);

    await page.getByRole("button", { name: "Chain 2 Crush block 1", exact: true }).click();
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

test("seqfx_tape_stop_trigger_latched_controls_do_not_offer_live_aux_targets", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 3 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Chain 3 Tape Stop block 1", exact: true }).waitFor();
    await page.locator('[data-role="seqfx-tape-v2-editor"]').waitFor();
    assert.equal(await page.locator('[data-role="seqfx-aux-source"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-toggle"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-editor"]').count(), 0);

    const snapshot = await getHarnessSnapshot(page);
    const upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.auxEnabled[2][0], [false, false, false, false, false, false, false, false]);

    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const step = storedState.patterns[0].lanes[2].steps[0];
    assert.deepEqual(step.aux.targets.map((target) => target.enabled), [false, false, false, false, false, false, false, false]);

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
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="6"]').count(), 0);

    const bitTicks = page.locator('[data-role="seqfx-crusher-bits-slider"] [data-role="editor-tick-slider-tick"]');
    assert.equal(await bitTicks.count(), 15);
    const bitTickBox = await bitTicks.first().boundingBox();
    assert.ok(bitTickBox);
    assert.ok(bitTickBox.height >= 12, `crusher bit ticks should match editor strip thickness, got ${bitTickBox.height}`);

    const rateTicks = page.locator('[data-role="seqfx-crusher-rate-slider"] [data-role="editor-tick-slider-tick"]');
    assert.equal(await rateTicks.count(), 16);
    const narrowLayout = await page.locator('[data-role="seqfx-crusher-editor"]').evaluate((node) => {
        const bitsRow = node.querySelector('[data-role="seqfx-crusher-bits-slider"]');
        const bitsTrack = bitsRow?.querySelector(".editor-tick-slider__track");
        const bitsValue = bitsRow?.querySelector('[data-role="seqfx-crusher-bits-value"]');
        const rateRow = node.querySelector('[data-role="seqfx-crusher-rate-slider"]');
        const rateTrack = rateRow?.querySelector(".editor-tick-slider__track");
        const rateTicks = rateRow?.querySelectorAll('[data-role="editor-tick-slider-tick"]') ?? [];
        const firstRateTick = rateTicks[0];
        const lastRateTick = rateTicks[rateTicks.length - 1];

        return {
            bitsRowWidth: bitsRow?.getBoundingClientRect().width ?? 0,
            bitsTrackWidth: bitsTrack?.getBoundingClientRect().width ?? 0,
            bitsValueWidth: bitsValue?.getBoundingClientRect().width ?? 0,
            rateRowWidth: rateRow?.getBoundingClientRect().width ?? 0,
            rateTrackWidth: rateTrack?.getBoundingClientRect().width ?? 0,
            rateTickWidth: firstRateTick?.getBoundingClientRect().width ?? 0,
            rateActiveTickCount: Array.from(rateTicks).filter((tick) => tick.classList.contains("is-active")).length,
            rateActiveColor: firstRateTick ? getComputedStyle(firstRateTick).backgroundColor : "",
            rateInactiveColor: lastRateTick ? getComputedStyle(lastRateTick).backgroundColor : "",
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
        narrowLayout.rateTrackWidth > narrowLayout.rateRowWidth * 0.45,
        `crusher rate rail should keep most of the row, got ${narrowLayout.rateTrackWidth}px of ${narrowLayout.rateRowWidth}px`,
    );
    assert.ok(
        narrowLayout.rateTickWidth >= 4,
        `crusher rate ticks should remain visible in the narrow inspector, got ${narrowLayout.rateTickWidth}px`,
    );
    assert.equal(narrowLayout.rateActiveTickCount, 16, "the default 48 kHz rate should fill the logarithmic rate rail");

    assert.equal(
        await page.locator('[data-role="seqfx-crusher-bits-slider"] .editor-tick-slider__label--toggle').count(),
        1,
        "crusher bits should keep its inline modulation toggle in the effect editor",
    );
    assert.equal(
        await page.locator('[data-role="seqfx-crusher-rate-slider"] .editor-tick-slider__label--toggle').count(),
        1,
        "crusher rate should keep its inline modulation toggle in the effect editor",
    );
    assert.equal(
        await page.locator('[data-role="seqfx-crusher-drive-db-mod-toggle"]').count(),
        1,
        "crusher drive should keep its inline modulation toggle in the effect editor",
    );

    const beforePath = await page.locator('[data-role="seqfx-crusher-wet-path"]').getAttribute("d");
    assert.ok(beforePath && beforePath.length > 20, "crusher graph should render a non-empty wet waveform path");

    await setCrushEditorValues(page, {
        bits: 4,
        rateHz: 3_098,
        driveDb: 30,
        character: 2,
        adcQuality: 0.75,
        dacQuality: 0.5,
        dither: 0.25,
    });
    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.params[1][0].slice(0, 7), [4, 3_098, 30, 2, 0.75, 0.5, 0.25]);

    const afterParamPath = await page.locator('[data-role="seqfx-crusher-wet-path"]').getAttribute("d");
    assert.notEqual(afterParamPath, beforePath, "crusher graph should redraw after converter controls change");
    assert.equal(await page.locator('[data-role="seqfx-crusher-bits-value"]').textContent(), "4");
    assert.equal(await page.locator('[data-role="seqfx-crusher-rate-value"]').textContent(), "3.1 kHz");
    assert.equal(await page.locator('[data-role="seqfx-crusher-drive-db-value"]').textContent(), "30.0 dB");
    assert.equal(await page.locator('[data-role="seqfx-crusher-character-option"][aria-pressed="true"]').textContent(), "Smooth");
    assert.equal(await page.locator('[data-role="seqfx-crusher-adc-quality-value"]').textContent(), "75%");
    assert.equal(await page.locator('[data-role="seqfx-crusher-dac-quality-value"]').textContent(), "50%");
    assert.equal(await page.locator('[data-role="seqfx-crusher-dither-value"]').textContent(), "25%");

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
        layout.mixTop < layout.editorBottom,
        `SeqFX crusher mix row should stay fixed before the crusher editor, got mix top ${layout.mixTop} and editor bottom ${layout.editorBottom}`,
    );

    await page.locator('[data-role="seqfx-crusher-drive-db-mod-toggle"]').click();
    await pressSliderKey(page.getByRole("slider", { name: "Drive end", exact: true }), "End");
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[1][0][CRUSHER_PARAM_DRIVE_DB], true);
    assert.equal(upload.auxEnd[1][0][CRUSHER_PARAM_DRIVE_DB], 36);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-badge"]').textContent(), "1");

    await setRangeInputValue(page.locator('[data-role="seqfx-crusher-rate"]'), 0.25);
    await page.locator('[data-role="seqfx-crusher-rate-slider"] .editor-tick-slider__label--toggle').click();
    const rateEndSlider = page.getByRole("slider", { name: "Rate end", exact: true });
    await pressSliderKey(rateEndSlider, "End");
    await rateEndSlider.focus();
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.up("Shift");
    const rateModRange = await page.locator('[data-role="seqfx-crusher-rate-slider"]').evaluate((node) => {
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
    assert.equal(rateModRange.connectorCount, 0, "modulated tick sliders should not render a continuous yellow range bar");
    assert.equal(rateModRange.isModRangeClassCount, 0, "base rail should not choose range cells with rounded tick indexes");
    assert.equal(rateModRange.rangeRailCount, 1);
    assert.equal(rateModRange.rangeTickCount, rateModRange.baseTickCount);
    assert.equal(rateModRange.rangeTickColor, "rgb(242, 209, 107)");
    assert.match(rateModRange.clipPathStyle, /^inset\(/);
    assert.ok(
        Math.abs(rateModRange.clipLeftX - rateModRange.lowHandleX) <= 1,
        `yellow range clip should start at lower handle center, got ${rateModRange.clipLeftX} vs ${rateModRange.lowHandleX}`,
    );
    assert.ok(
        Math.abs(rateModRange.clipRightX - rateModRange.highHandleX) <= 1,
        `yellow range clip should end at upper handle center, got ${rateModRange.clipRightX} vs ${rateModRange.highHandleX}`,
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
    assert.equal(
        recallUpload.authoritative,
        true,
        "snapshot recall replaces the complete SeqFX document and must clear stale DSP history",
    );
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
    assert.match(
        await page.locator('[data-role="seqfx-stutter-source-note"]').textContent(),
        /previous loop playing until the new capture is ready/,
    );

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

    const graph = page.locator('[data-role="seqfx-stutter-graph"]');
    await graph.scrollIntoViewIfNeeded();
    const graphBox = await graph.boundingBox();
    assert.ok(graphBox);
    const fullGatePoint = await stutterGraphPoint(page, graphBox, 1);
    await page.mouse.click(fullGatePoint.x, fullGatePoint.y);
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[3][0][3], 1, 0.03, "gate graph click should open the cut fully before sampling the shape path");

    const morphTrack = page.locator('[data-role="seqfx-stutter-morph-track"]');
    await morphTrack.scrollIntoViewIfNeeded();
    const morphBox = await morphTrack.boundingBox();
    assert.ok(morphBox);
    await morphTrack.click({ position: { x: morphBox.width * 0.8, y: morphBox.height / 2 } });
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[3][0][2], 0.8, 0.03, "morph track click should write shape");

    await morphTrack.click({ position: { x: morphBox.width * 0.125, y: morphBox.height / 2 } });
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

    await graph.scrollIntoViewIfNeeded();
    const refreshedGraphBox = await graph.boundingBox();
    assert.ok(refreshedGraphBox);
    const quarterGatePoint = await stutterGraphPoint(page, refreshedGraphBox, 0.25);
    await page.mouse.click(quarterGatePoint.x, quarterGatePoint.y);
    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[3][0][3], 0.25, 0.03, "gate graph click should write gate");
    const narrowGateTriangleSamples = await readStutterEnvelopePathSamples(page, [0.125, 0.4]);
    assert.ok(narrowGateTriangleSamples, "expected the narrow stutter gate graph path to produce readable points");
    assert.ok(
        narrowGateTriangleSamples["0.13"] < narrowGateTriangleSamples["0.40"] - 40,
        `Triangle stutter shape should remain visible below a 50% gate, got peak y=${narrowGateTriangleSamples["0.13"]} and post-gate y=${narrowGateTriangleSamples["0.40"]}`,
    );

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
        stutterLayout.mixTop < stutterLayout.editorBottom,
        `SeqFX stutter mix row should stay fixed before the envelope editor, got mix top ${stutterLayout.mixTop} and editor bottom ${stutterLayout.editorBottom}`,
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

test("seqfx_stutter_graph_drag_uploads_live_pattern_before_persisting_final_state", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-stutter-editor"]').waitFor();
    await page.locator('[data-role="seqfx-stutter-graph"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const initialSnapshot = await getHarnessSnapshot(page);
    const initialStoredState = parseSeqFxStoredState(initialSnapshot.storedState[SEQFX_STATE_KEY]);
    assertClose(initialStoredState.patterns[0].lanes[3].steps[0].params[3], 0.68, 0.000001, "initial stored stutter gate");

    const graph = page.locator('[data-role="seqfx-stutter-graph"]');
    await graph.scrollIntoViewIfNeeded();
    const graphBox = await graph.boundingBox();
    const handleBox = await page.locator('[data-role="seqfx-stutter-gate-handle"]').boundingBox();
    assert.ok(graphBox);
    assert.ok(handleBox);
    const quarterGatePoint = await stutterGraphPoint(page, graphBox, 0.25);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(quarterGatePoint.x, quarterGatePoint.y, { steps: 8 });
    await page.waitForFunction(({ expectedStoredGate, expectedUploadGate, tolerance }) => {
        const snapshot = window.__SEQFX_HARNESS__?.getSnapshot();
        const upload = snapshot?.events.filter((entry) => entry.endpointID === "patternUpload").at(-1)?.value;
        const storedValue = snapshot?.storedState?.["seqfx.v7"];
        const storedState = typeof storedValue === "string" ? JSON.parse(storedValue) : null;
        const uploadGate = upload?.params?.[3]?.[0]?.[3];
        const storedGate = storedState?.patterns?.[0]?.chains?.[3]?.blocks?.[0]?.params?.[3] ?? 0.68;

        return Math.abs(uploadGate - expectedUploadGate) <= tolerance
            && Math.abs(storedGate - expectedStoredGate) <= 0.000001;
    }, {
        expectedStoredGate: 0.68,
        expectedUploadGate: 0.25,
        tolerance: 0.03,
    });

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[3][0][3], 0.25, 0.03, "live stutter gate upload while pointer is down");

    let storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    assertClose(storedState.patterns[0].lanes[3].steps[0].params[3], 0.68, 0.000001, "stored stutter gate should not change until pointerup");

    await page.mouse.up();
    await page.waitForFunction(({ expectedGate, tolerance }) => {
        const snapshot = window.__SEQFX_HARNESS__?.getSnapshot();
        const upload = snapshot?.events.filter((entry) => entry.endpointID === "patternUpload").at(-1)?.value;
        const storedValue = snapshot?.storedState?.["seqfx.v7"];
        const storedState = typeof storedValue === "string" ? JSON.parse(storedValue) : null;
        const uploadGate = upload?.params?.[3]?.[0]?.[3];
        const storedGate = storedState?.patterns?.[0]?.chains?.[3]?.blocks?.[0]?.params?.[3] ?? 0.68;

        return Math.abs(uploadGate - expectedGate) <= tolerance
            && Math.abs(storedGate - expectedGate) <= tolerance;
    }, {
        expectedGate: 0.25,
        tolerance: 0.03,
    });

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assertClose(upload.params[3][0][3], 0.25, 0.03, "final stutter gate upload after pointerup");
    storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    assertClose(storedState.patterns[0].lanes[3].steps[0].params[3], 0.25, 0.03, "stored stutter gate after pointerup");

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

    const graph = page.locator('[data-role="seqfx-stutter-graph"]');
    await graph.scrollIntoViewIfNeeded();
    const graphBox = await graph.boundingBox();
    assert.ok(graphBox);
    const gatePoint = await stutterGraphPoint(page, graphBox, 0.4);
    await page.mouse.click(gatePoint.x, gatePoint.y);

    const gateSnapshot = await getHarnessSnapshot(page);
    const gateUpload = patternUploads(gateSnapshot).at(-1).value;
    assert.deepEqual(
        [1, 2, 6, 7].map((step) => Number(gateUpload.params[3][step][3].toFixed(2))),
        [0.4, 0.4, 0.4, 0.4],
    );

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
    await page.locator('[data-role="seqfx-tape-v2-editor"]').waitFor();
    assert.equal(await page.locator('[data-control="seqfx-tape-stop-time"]').isDisabled(), false);

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

test("seqfx_resize_pointer_target_is_24px_without_swallowing_the_shortest_block", async () => {
    const page = await browser.newPage({ viewport: { width: 720, height: 520 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();

    const block = await page.getByRole("button", { name: "Chain 1 Filter block 1", exact: true }).boundingBox();
    const handle = page.locator('[data-role="seqfx-block-resize"][data-lane="0"][data-start="0"]');
    const handleBox = await handle.boundingBox();
    assert.ok(block);
    assert.ok(handleBox);
    assert.equal(await handle.getAttribute("data-pointer-target"), "true");
    assert.ok(handleBox.width >= 24, `resize pointer width must be at least 24px, got ${handleBox.width}`);
    assert.ok(handleBox.height >= 24, `resize pointer height must be at least 24px, got ${handleBox.height}`);

    const overlap = Math.max(
        0,
        Math.min(block.x + block.width, handleBox.x + handleBox.width) - Math.max(block.x, handleBox.x),
    );
    assert.ok(
        block.width - overlap >= 4,
        `resize pointer target swallowed the shortest block (${block.width}px block, ${overlap}px overlap)`,
    );

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

test("seqfx_tape_stop_v2_inspector_exposes_established_motor_controls_and_persists_them", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 3 step 1", exact: true }).click();
    await page.locator('[data-role="seqfx-tape-v2-editor"]').waitFor();

    const inspector = page.locator('[data-role="seqfx-inspector"]');
    await page.locator('[data-control="seqfx-tape-stop-time"]').waitFor();
    const controlLabels = await inspector.locator(".seqfx-tape-v2-control > span").allTextContents();
    for (const label of ["Stop Time", "Curve", "Return", "Character", "Timing"]) {
        assert.equal(controlLabels.some((entry) => entry.startsWith(label)), true, `missing ${label} control`);
    }
    assert.equal(await page.locator('[data-control="seqfx-tape-start-time"]').count(), 0);
    assert.equal(await page.locator('[data-control="seqfx-tape-stop-time"]').inputValue(), "8");
    assert.equal(await page.locator('[data-control="seqfx-tape-return"]').inputValue(), "0");
    assert.equal(await page.locator('[data-control="seqfx-tape-return"] option:checked').textContent(), "Crossfade to Live");
    await page.locator('[data-role="seqfx-tape-v2-live-handoff"]').waitFor();
    assert.match(
        await page.locator('[data-role="seqfx-tape-v2-trajectory"]').getAttribute("aria-label"),
        /crossfades directly to live input/u,
    );
    const initialPath = await page.locator('[data-role="seqfx-tape-v2-curve"]').getAttribute("d");

    await page.locator('[data-control="seqfx-tape-return"]').selectOption("1");
    await page.locator('[data-control="seqfx-tape-start-time"]').waitFor();
    await page.locator('[data-control="seqfx-tape-timing"]').selectOption("1");
    assert.equal(await page.locator('[data-control="seqfx-tape-stop-time"]').getAttribute("type"), "range");
    assert.equal(await page.locator('[data-control="seqfx-tape-start-time"]').getAttribute("type"), "range");
    await setPhysicalSliderValue(page.locator('[data-control="seqfx-tape-stop-time"]'), 1_200);
    await setPhysicalSliderValue(page.locator('[data-control="seqfx-tape-start-time"]'), 800);
    await setRangeInputValue(page.locator('[data-control="seqfx-tape-curve"]'), -0.5);
    await setRangeInputValue(page.locator('[data-control="seqfx-tape-character"]'), 0.72);

    const finalPath = await page.locator('[data-role="seqfx-tape-v2-curve"]').getAttribute("d");
    assert.notEqual(finalPath, initialPath);
    const layout = await page.locator('[data-role="seqfx-tape-v2-editor"]').evaluate((node) => ({
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        trajectoryLabel: node.querySelector('[data-role="seqfx-tape-v2-trajectory"]')?.getAttribute("aria-label"),
    }));
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, `Tape Stop editor overflowed by ${layout.scrollWidth - layout.clientWidth}px`);
    assert.equal(layout.trajectoryLabel, "Tape slows over 1200 ms, then restarts its motor over 800 ms and crossfades to live");

    const snapshot = await getHarnessSnapshot(page);
    const lastUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(lastUpload.params[2][0], [8, -0.5, 1, 1, 0.72, 1, 1200, 800]);

    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    assert.deepEqual(storedState.patterns[0].lanes[2].steps[0].params, [8, -0.5, 1, 1, 0.72, 1, 1200, 800]);

    await page.close();
});

test("seqfx_single_cell_blocks_keep_the_same_square_geometry_as_grid_cells", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    const blockBox = await page.getByRole("button", { name: "Chain 2 Crush block 1", exact: true }).boundingBox();
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
    assert.equal(await effectPicker.locator('[data-role="seqfx-effect-type-option"]').count(), 12);
    assert.equal(await effectPicker.locator('[data-role="seqfx-effect-type-option"] > [data-role="seqfx-effect-icon"]').count(), 12);
    assert.equal(await effectPicker.getByRole("button", { name: "Crush", exact: true }).getAttribute("aria-pressed"), "true");

    const tapeStopButton = effectPicker.getByRole("button", { name: "Tape Stop", exact: true });
    const surfaceChrome = (locator) => locator.evaluate((node) => {
        const styles = getComputedStyle(node);
        return {
            backgroundColor: styles.backgroundColor,
            borderRadius: styles.borderRadius,
            borderTopStyle: styles.borderTopStyle,
            boxShadow: styles.boxShadow,
        };
    });
    const baseCell = page.locator(
        '.seqfx-cell:not(.has-frame-corner-tl):not(.has-frame-corner-tr):not(.has-frame-corner-bl):not(.has-frame-corner-br):not(.is-alt-bar):not(.is-covered):not(.is-selected):not(.is-playhead)',
    ).first();
    assert.deepEqual(await surfaceChrome(tapeStopButton), await surfaceChrome(baseCell));
    await tapeStopButton.click();
    assert.equal(await tapeStopButton.getAttribute("aria-pressed"), "true");

    await page.getByRole("button", { name: "Chain 2 Tape Stop block 1", exact: true }).waitFor();
    const snapshot = await getHarnessSnapshot(page);
    const uploads = patternUploads(snapshot);
    assert.equal(uploads.length, 1);
    const upload = uploads.at(-1).value;
    assert.equal(upload.effectTypes[1][0], SEQFX_EFFECT_TYPES.tapeStop);
    assert.deepEqual(upload.params[1][0], [8, 0, 0, 1, 0, 0, 500, 125]);

    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedStep = storedState.patterns[0].lanes[1].steps[0];
    assert.equal(storedStep.active, true);
    assert.equal(storedStep.effectType, SEQFX_EFFECT_TYPES.tapeStop);
    assert.deepEqual(storedStep.params, [8, 0, 0, 1, 0, 0, 500, 125]);

    await page.close();
});

test("seqfx numeric inspectors use compact segmented rows while enumerated choices stay selectors", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();

    for (const effectName of ["Pitch", "Comb", "Ring", "Reverse", "Talk Box", "Vibro", "Flange", "Dirty"]) {
        const effect = effectDefinitionsModule.SEQFX_EFFECT_DEFINITIONS.find((candidate) => candidate.name === effectName);
        assert.ok(effect, `expected ${effectName} metadata`);

        await page.getByRole("button", { name: effectName, exact: true }).click();
        await page.getByRole("button", { name: `Chain 1 ${effectName} block 1`, exact: true }).waitFor();
        await openSeqFxAdvancedParameters(page);

        for (const [index, definition] of effect.parameters.entries()) {
            const control = page.locator(`[data-role="seqfx-param"][data-param="${index}"]`);
            await control.waitFor();

            if (definition.options) {
                assert.equal(await control.evaluate((element) => element.tagName), "SELECT", `${effectName} ${definition.label} should remain a selector`);
                continue;
            }

            assert.equal(await control.getAttribute("type"), "range", `${effectName} ${definition.label} should use a range input`);
            const row = page.locator(`[data-role="seqfx-param-row"][data-param="${index}"]`);
            assert.equal(await row.locator(".editor-tick-slider__track").count(), 1, `${effectName} ${definition.label} should use the shared segmented rail`);
            assert.equal(await row.locator('[data-role="seqfx-param-value"]').count(), 1, `${effectName} ${definition.label} should keep its formatted readout`);
            assert.equal(await row.locator("small").count(), 0, `${effectName} ${definition.label} should not keep an always-visible help sentence`);

            const geometry = await row.evaluate((element) => {
                const label = element.querySelector(".editor-tick-slider__label")?.getBoundingClientRect();
                const track = element.querySelector(".editor-tick-slider__track")?.getBoundingClientRect();
                const value = element.querySelector('[data-role="seqfx-param-value"]')?.getBoundingClientRect();
                return {
                    height: element.getBoundingClientRect().height,
                    labelCenter: label ? label.top + (label.height / 2) : null,
                    trackCenter: track ? track.top + (track.height / 2) : null,
                    valueCenter: value ? value.top + (value.height / 2) : null,
                };
            });
            assert.ok(geometry.height <= 40, `${effectName} ${definition.label} should stay compact`);
            assertClose(geometry.labelCenter, geometry.trackCenter, 3, `${effectName} ${definition.label} label/rail alignment`);
            assertClose(geometry.valueCenter, geometry.trackCenter, 3, `${effectName} ${definition.label} value/rail alignment`);
        }
    }

    assert.equal(await page.locator('input[type="number"][data-role="seqfx-param"]').count(), 0);
    await page.close();
});

test("seqfx segmented sliders preserve proportional continuous fill, whole discrete cells, log travel, and host-owned Space", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Ring", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Ring block 1", exact: true }).waitFor();

    const frequency = page.locator('[data-role="seqfx-param"][data-param="0"]');
    await setRangeInputValue(frequency, 0.5);
    const frequencyMin = Number(await frequency.getAttribute("data-physical-min"));
    const frequencyMax = Number(await frequency.getAttribute("data-physical-max"));
    assertClose(Number(await frequency.getAttribute("data-physical-value")), Math.sqrt(frequencyMin * frequencyMax), 0.02, "log midpoint should land at the geometric mean");

    const motion = page.locator('[data-role="seqfx-param"][data-param="2"]');
    await setPhysicalSliderValue(motion, 0.1);
    const continuousFills = await page.locator('[data-role="seqfx-param-row"][data-param="2"] [data-role="editor-tick-slider-tick"]').evaluateAll(
        (ticks) => ticks.map((tick) => Number(tick.getAttribute("data-fill"))),
    );
    assert.equal(continuousFills[0], 1);
    assertClose(continuousFills[1], 0.6, 0.001, "continuous value should partially fill its current cell");
    assert.equal(continuousFills[2], 0);
    const stipple = await page.locator('[data-role="seqfx-param-row"][data-param="2"] .editor-tick-slider__tick-fill').first().evaluate(
        (fill) => getComputedStyle(fill, "::after").backgroundImage,
    );
    assert.match(stipple, /radial-gradient/, "active fill should use the effects-grid stipple language");

    const spaceOwnership = await motion.evaluate((input) => {
        input.focus();
        const event = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            code: "Space",
            key: " ",
        });
        input.dispatchEvent(event);
        return {
            activeType: document.activeElement instanceof HTMLInputElement ? document.activeElement.type : null,
            defaultPrevented: event.defaultPrevented,
        };
    });
    assert.deepEqual(spaceOwnership, { activeType: "range", defaultPrevented: false });

    await page.getByRole("button", { name: "Pitch", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Pitch block 1", exact: true }).waitFor();
    const pitch = page.locator('[data-role="seqfx-param"][data-param="0"]');
    await setPhysicalSliderValue(pitch, 0);
    const discreteFills = await page.locator('[data-role="seqfx-param-row"][data-param="0"] [data-role="editor-tick-slider-tick"]').evaluateAll(
        (ticks) => ticks.map((tick) => Number(tick.getAttribute("data-fill"))),
    );
    assert.ok(discreteFills.every((fill) => fill === 0 || fill === 1), "discrete parameters should never partially fill a cell");

    await page.close();
});

test("seqfx global numeric controls use compact segmented ranges with host-owned Space", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    assert.equal(await page.locator('.seqfx-root input[type="number"]').count(), 0);

    const bpm = page.locator('[data-role="seqfx-manual-bpm"]');
    const loopStart = page.locator('[data-role="seqfx-loop-start"]');
    const loopEnd = page.locator('[data-role="seqfx-loop-end"]');
    for (const [label, control, rowRole] of [
        ["Manual BPM", bpm, "seqfx-manual-bpm-control"],
        ["Loop start", loopStart, "seqfx-loop-start-control"],
        ["Loop end", loopEnd, "seqfx-loop-end-control"],
    ]) {
        assert.equal(await control.getAttribute("type"), "range", `${label} should use a range input`);
        assert.equal(await page.locator(`[data-role="${rowRole}"] .editor-tick-slider__track`).count(), 1);
    }

    await page.locator('[data-role="seqfx-clock-mode"]').selectOption("1");
    const spaceOwnership = await bpm.evaluate((input) => {
        input.focus();
        const event = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            code: "Space",
            key: " ",
        });
        input.dispatchEvent(event);
        return {
            activeType: document.activeElement instanceof HTMLInputElement ? document.activeElement.type : null,
            defaultPrevented: event.defaultPrevented,
        };
    });
    assert.deepEqual(spaceOwnership, { activeType: "range", defaultPrevented: false });

    await bpm.evaluate((input) => input.blur());
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.locator('[data-role="seqfx-manual-bpm-value"]').click();
    const bpmEntry = page.getByRole("textbox", { name: "BPM exact value" });
    await bpmEntry.fill("134.5 bpm");
    await bpmEntry.press("Enter");
    await bpmEntry.waitFor({ state: "detached" });

    await page.locator('[data-role="seqfx-loop-start-value"]').click();
    const loopStartEntry = page.getByRole("textbox", { name: "Start exact value" });
    await loopStartEntry.fill("5");
    await loopStartEntry.press("Enter");
    await loopStartEntry.waitFor({ state: "detached" });

    await page.locator('[data-role="seqfx-loop-end-value"]').click();
    const loopEndEntry = page.getByRole("textbox", { name: "End exact value" });
    await loopEndEntry.fill("13");
    await loopEndEntry.press("Enter");
    await loopEndEntry.waitFor({ state: "detached" });

    const snapshot = await getHarnessSnapshot(page);
    assert.deepEqual(snapshot.events.map(({ endpointID, value }) => ({ endpointID, value })), [
        { endpointID: "manualBpm", value: 134.5 },
        { endpointID: "loopStart", value: 4 },
        { endpointID: "loopLength", value: 28 },
        { endpointID: "loopStart", value: 4 },
        { endpointID: "loopLength", value: 9 },
    ]);
    assert.deepEqual(snapshot.gestureStarts, [
        "manualBpm",
        "loopStart",
        "loopLength",
        "loopStart",
        "loopLength",
    ]);
    assert.deepEqual(snapshot.gestureEnds, snapshot.gestureStarts);
    assert.equal(await page.locator('.seqfx-global input[type="text"]').count(), 0, "exact editors should remain temporary");

    const discreteFills = await page.locator('[data-role="seqfx-loop-start-control"] [data-role="editor-tick-slider-tick"]').evaluateAll(
        (ticks) => ticks.map((tick) => Number(tick.getAttribute("data-fill"))),
    );
    assert.ok(discreteFills.every((fill) => fill === 0 || fill === 1), "loop boundaries should fill whole cells only");

    await page.close();
});

test("seqfx Tape Stop free durations use the shared log segmented slider without persistent help", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Tape Stop", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Tape Stop block 1", exact: true }).waitFor();
    await page.locator('[data-control="seqfx-tape-timing"]').selectOption("1");
    await page.locator('[data-control="seqfx-tape-return"]').selectOption("1");

    for (const [paramIndex, controlRole] of [[6, "seqfx-tape-stop-time"], [7, "seqfx-tape-start-time"]]) {
        const control = page.locator(`[data-control="${controlRole}"]`);
        await control.waitFor();
        assert.equal(await control.getAttribute("type"), "range");
        assert.equal(await control.getAttribute("data-scale"), "log");
        const row = page.locator(`[data-role="seqfx-param-row"][data-param="${paramIndex}"]`);
        assert.equal(await row.locator(".editor-tick-slider__track").count(), 1);
        assert.equal(await row.locator("small").count(), 0);
    }

    assert.equal(await page.locator('.seqfx-tape-v2 input[type="number"]').count(), 0);
    await page.close();
});

test("seqfx segmented readouts open temporary unit-aware exact entry and preserve physical values", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Ring", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Ring block 1", exact: true }).waitFor();
    assert.equal(await page.locator('.seqfx-inspector input:is([type="number"], [type="text"])').count(), 0);

    const frequencyReadout = page.locator('[data-role="seqfx-param-value"][data-param="0"]');
    await frequencyReadout.click();
    const frequencyEntry = page.getByRole("textbox", { name: "Frequency exact value" });
    await frequencyEntry.fill("2 khz");
    await frequencyEntry.press("Enter");
    await frequencyEntry.waitFor({ state: "detached" });
    assert.equal(await frequencyReadout.textContent(), "2 kHz");

    let snapshot = await getHarnessSnapshot(page);
    assertClose(patternUploads(snapshot).at(-1).value.params[0][0][0], 2_000, 0.001, "frequency exact entry should commit Hz to SeqFX state");

    await frequencyReadout.click();
    await frequencyEntry.fill("5 khz");
    await frequencyEntry.press("Escape");
    await frequencyEntry.waitFor({ state: "detached" });
    await frequencyReadout.click();
    await frequencyEntry.fill("3 khz");
    await page.getByRole("button", { name: "Ring", exact: true }).focus();
    await frequencyEntry.waitFor({ state: "detached" });
    assert.equal(await frequencyReadout.textContent(), "3 kHz", "blur after reopening an escaped editor should still commit");

    snapshot = await getHarnessSnapshot(page);
    assertClose(patternUploads(snapshot).at(-1).value.params[0][0][0], 3_000, 0.001, "reopened exact entry should commit its physical value on blur");

    await page.getByRole("button", { name: "Tape Stop", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Tape Stop block 1", exact: true }).waitFor();
    await page.locator('[data-control="seqfx-tape-timing"]').selectOption("1");
    const stopReadout = page.locator('[data-role="seqfx-param-row"][data-param="6"] [data-role="seqfx-param-value"]');
    await stopReadout.click();
    const stopEntry = page.getByRole("textbox", { name: "Stop Time exact value" });
    await stopEntry.fill("2 s");
    await stopEntry.press("Enter");
    await stopEntry.waitFor({ state: "detached" });
    assert.equal(await stopReadout.textContent(), "2 s");

    snapshot = await getHarnessSnapshot(page);
    assertClose(patternUploads(snapshot).at(-1).value.params[0][0][6], 2_000, 0.001, "Tape Stop exact entry should store milliseconds");
    assert.equal(await page.locator('.seqfx-inspector input:is([type="number"], [type="text"])').count(), 0);

    await page.close();
});

test("seqfx_ring_inspector_sequences_every_public_control_and_hides_waveform_from_live_modulation", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    const ringButton = page.getByRole("button", { name: "Ring", exact: true });
    await ringButton.click();
    await page.getByRole("button", { name: "Chain 1 Ring block 1", exact: true }).waitFor();

    const param = (index) => page.locator(`[data-role="seqfx-param"][data-param="${index}"]`);
    assert.equal(await param(0).getAttribute("data-physical-value"), "180");
    assert.equal(await param(1).locator("option").count(), 4);
    assert.equal(await param(1).inputValue(), "0");
    assert.equal(await page.locator('[data-role="seqfx-param-value"][data-param="0"]').textContent(), "180 Hz");
    assert.equal(await page.locator('[data-role="seqfx-mix-value"]').textContent(), "100%");
    const advanced = page.locator('[data-role="seqfx-advanced-parameters"]');
    assert.equal(await advanced.getAttribute("open"), null, "secondary Ring controls should start disclosed only by their summary");
    assert.equal(await param(6).isVisible(), false);
    await openSeqFxAdvancedParameters(page);
    assert.equal(await param(6).inputValue(), "0");
    assert.equal(await page.locator('[data-role="seqfx-param-value"][data-param="4"]').textContent(), "8%");

    await setPhysicalSliderValue(param(0), 440);
    await param(1).selectOption("2");
    await setPhysicalSliderValue(param(2), 0.4);
    await setPhysicalSliderValue(param(3), 3);
    await setPhysicalSliderValue(param(4), 1);
    await setPhysicalSliderValue(param(5), 0.25);
    await setPhysicalSliderValue(param(6), -0.3);

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.effectTypes[0][0], SEQFX_EFFECT_TYPES.ring);
    assert.deepEqual(upload.params[0][0], [440, 2, 0.4, 3, 1, 0.25, -0.3, 0]);

    await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"]').count(), 6);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="1"]').count(), 0);
    await toggleSeqFxModTarget(page, 0);
    await setSeqFxModTargetAmount(page, 0, 1);

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][0], true);
    assertClose(upload.auxEnd[0][0][0], 880, 0.01, "Ring frequency +1 octave should persist as 880 Hz");
    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedRing = storedState.patterns[0].lanes[0].steps[0];
    assert.equal(storedRing.effectType, SEQFX_EFFECT_TYPES.ring);
    assert.deepEqual(storedRing.params, [440, 2, 0.4, 3, 1, 0.25, -0.3, 0]);
    assert.equal(storedRing.aux.targets[0].enabled, true);
    assertClose(storedRing.aux.targets[0].end, 880, 0.01, "Ring aux target should survive sparse v7 persistence");

    const glyph = page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="0"] [data-role="seqfx-block-glyph"]');
    assert.equal(await glyph.getAttribute("data-effect"), "ring");
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-line"]').getAttribute("d"));

    await page.close();
});

test("seqfx_reverse_sequences_a_zero_latency_lookback_with_only_boundary_and_decay modulation", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Reverse", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Reverse block 1", exact: true }).waitFor();

    const param = (index) => page.locator(`[data-role="seqfx-param"][data-param="${index}"]`);
    assert.deepEqual(
        await param(0).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["1/32", "1/16", "1/8", "1/4", "1 Cell"],
    );
    assert.deepEqual(
        await param(2).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["Sync", "Free"],
    );
    assert.match(await page.locator('[data-role="seqfx-reverse-source-note"]').textContent(), /already heard before the block/);
    await openSeqFxAdvancedParameters(page);

    await param(0).selectOption("3");
    await setPhysicalSliderValue(param(1), 0.12);
    await param(2).selectOption("1");
    await setPhysicalSliderValue(param(3), 480);
    await setPhysicalSliderValue(param(4), 0.7);

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.effectTypes[0][0], SEQFX_EFFECT_TYPES.reverse);
    assert.deepEqual(upload.params[0][0], [3, 0.12, 1, 480, 0.7, 0, 0, 0]);

    await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"]').count(), 2);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="0"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="1"]').count(), 1);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="2"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="3"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="4"]').count(), 1);
    await toggleSeqFxModTarget(page, 1);
    await setSeqFxModTargetAmount(page, 1, 5);

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][1], true);
    assertClose(upload.auxEnd[0][0][1], 0.17, 0.001, "Reverse Crossfade +5 points should persist as 17%");
    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedReverse = storedState.patterns[0].lanes[0].steps[0];
    assert.equal(storedReverse.effectType, SEQFX_EFFECT_TYPES.reverse);
    assert.deepEqual(storedReverse.params, [3, 0.12, 1, 480, 0.7, 0, 0, 0]);
    assert.equal(storedReverse.aux.targets[1].enabled, true);
    assertClose(storedReverse.aux.targets[1].end, 0.17, 0.001, "Reverse aux target should survive sparse v7 persistence");

    const glyph = page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="0"] [data-role="seqfx-block-glyph"]');
    assert.equal(await glyph.getAttribute("data-effect"), "reverse");
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-line"]').getAttribute("d"));
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-secondary-line"]').getAttribute("d"));

    await page.close();
});

test("seqfx_comb_sequences_the_selected_vector_dispersive_contract_and_latches_polarity", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Comb", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Comb block 1", exact: true }).waitFor();

    const param = (index) => page.locator(`[data-role="seqfx-param"][data-param="${index}"]`);
    assert.deepEqual(
        await param(2).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["Positive", "Negative"],
    );
    await openSeqFxAdvancedParameters(page);

    await setPhysicalSliderValue(param(0), 440);
    await setPhysicalSliderValue(param(1), 2.5);
    await param(2).selectOption("1");
    await setPhysicalSliderValue(param(3), 0.7);
    await setPhysicalSliderValue(param(4), 6_000);
    await setPhysicalSliderValue(param(5), 0.4);
    await setPhysicalSliderValue(param(6), 0.3);
    await setPhysicalSliderValue(param(7), 0.8);

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.effectTypes[0][0], SEQFX_EFFECT_TYPES.comb);
    assert.deepEqual(upload.params[0][0], [440, 2.5, 1, 0.7, 6000, 0.4, 0.3, 0.8]);

    await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"]').count(), 7);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="2"]').count(), 0);
    await toggleSeqFxModTarget(page, 0);
    await setSeqFxModTargetAmount(page, 0, 1);

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][0], true);
    assertClose(upload.auxEnd[0][0][0], 880, 0.01, "Comb Tune +1 octave should persist as 880 Hz");
    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedComb = storedState.patterns[0].lanes[0].steps[0];
    assert.equal(storedComb.effectType, SEQFX_EFFECT_TYPES.comb);
    assert.deepEqual(storedComb.params, [440, 2.5, 1, 0.7, 6000, 0.4, 0.3, 0.8]);
    assert.equal(storedComb.aux.targets[0].enabled, true);
    assertClose(storedComb.aux.targets[0].end, 880, 0.01, "Comb aux target should survive sparse v7 persistence");

    const glyph = page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="0"] [data-role="seqfx-block-glyph"]');
    assert.equal(await glyph.getAttribute("data-effect"), "comb");
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-line"]').getAttribute("d"));

    await page.close();
});

test("seqfx_vibro_sequences_wet_only_doppler_controls with explicit sync and free timing", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Vibro", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Vibro block 1", exact: true }).waitFor();

    const param = (index) => page.locator(`[data-role="seqfx-param"][data-param="${index}"]`);
    assert.deepEqual(
        await param(2).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["Sine", "Triangle"],
    );
    assert.deepEqual(
        await param(4).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["Sync", "Free"],
    );
    assert.deepEqual(
        await param(5).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar"],
    );
    await openSeqFxAdvancedParameters(page);

    await setPhysicalSliderValue(param(0), 6);
    await setPhysicalSliderValue(param(1), 60);
    await param(2).selectOption("1");
    await setPhysicalSliderValue(param(3), 150);
    await param(4).selectOption("1");
    await param(5).selectOption("4");

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.effectTypes[0][0], SEQFX_EFFECT_TYPES.vibro);
    assert.deepEqual(upload.params[0][0], [6, 60, 1, 150, 1, 4, 0, 0]);

    await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"]').count(), 3);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="2"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="4"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="5"]').count(), 0);
    await toggleSeqFxModTarget(page, 1);
    await setSeqFxModTargetAmount(page, 1, 20);

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][1], true);
    assertClose(upload.auxEnd[0][0][1], 80, 0.01, "Vibro Depth +20 cents should persist as 80 cents");
    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedVibro = storedState.patterns[0].lanes[0].steps[0];
    assert.equal(storedVibro.effectType, SEQFX_EFFECT_TYPES.vibro);
    assert.deepEqual(storedVibro.params, [6, 60, 1, 150, 1, 4, 0, 0]);
    assert.equal(storedVibro.aux.targets[1].enabled, true);
    assertClose(storedVibro.aux.targets[1].end, 80, 0.01, "Vibro aux target should survive sparse v7 persistence");

    const glyph = page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="0"] [data-role="seqfx-block-glyph"]');
    assert.equal(await glyph.getAttribute("data-effect"), "vibro");
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-line"]').getAttribute("d"));
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-secondary-line"]').getAttribute("d"));

    await page.close();
});

test("seqfx_flange_sequences_the_short_delay_feedback_contract and latches timing choices", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Flange", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Flange block 1", exact: true }).waitFor();

    const param = (index) => page.locator(`[data-role="seqfx-param"][data-param="${index}"]`);
    assert.deepEqual(
        await param(5).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["Normal", "Inverse"],
    );
    assert.deepEqual(
        await param(6).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["Sync", "Free"],
    );
    assert.deepEqual(
        await param(7).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["1/16", "1/8", "1/4", "1/2", "1 Bar", "2 Bars", "4 Bars"],
    );
    await openSeqFxAdvancedParameters(page);

    await setPhysicalSliderValue(param(0), 2);
    await setPhysicalSliderValue(param(1), 6);
    await setPhysicalSliderValue(param(2), 3);
    await setPhysicalSliderValue(param(3), 0.75);
    await setPhysicalSliderValue(param(4), 150);
    await param(5).selectOption("1");
    await param(6).selectOption("0");
    await param(7).selectOption("2");

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.effectTypes[0][0], SEQFX_EFFECT_TYPES.flange);
    assert.deepEqual(upload.params[0][0], [2, 6, 3, 0.75, 150, 1, 0, 2]);

    await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"]').count(), 5);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="5"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="6"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="7"]').count(), 0);
    await toggleSeqFxModTarget(page, 3);
    await setSeqFxModTargetAmount(page, 3, 15);

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][3], true);
    assertClose(upload.auxEnd[0][0][3], 0.9, 0.001, "Flange Feedback +15 points should persist as 90%");
    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedFlange = storedState.patterns[0].lanes[0].steps[0];
    assert.equal(storedFlange.effectType, SEQFX_EFFECT_TYPES.flange);
    assert.deepEqual(storedFlange.params, [2, 6, 3, 0.75, 150, 1, 0, 2]);
    assert.equal(storedFlange.aux.targets[3].enabled, true);
    assertClose(storedFlange.aux.targets[3].end, 0.9, 0.001, "Flange aux target should survive sparse v7 persistence");

    const glyph = page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="0"] [data-role="seqfx-block-glyph"]');
    assert.equal(await glyph.getAttribute("data-effect"), "flange");
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-line"]').getAttribute("d"));
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-secondary-line"]').getAttribute("d"));

    await page.close();
});

test("seqfx_pitch_sequences_the_complementary_grain_contract_and_sparse_modulation", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Pitch", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Pitch block 1", exact: true }).waitFor();

    const param = (index) => page.locator(`[data-role="seqfx-param"][data-param="${index}"]`);
    await openSeqFxAdvancedParameters(page);
    await setPhysicalSliderValue(param(0), 12);
    await setPhysicalSliderValue(param(1), 25);
    await setPhysicalSliderValue(param(2), 64);
    await setPhysicalSliderValue(param(3), 0.4);
    await setPhysicalSliderValue(param(4), 0.8);

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.effectTypes[0][0], SEQFX_EFFECT_TYPES.pitch);
    assert.deepEqual(upload.params[0][0], [12, 25, 64, 0.4, 0.8, 0, 0, 0]);

    await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"]').count(), 4);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="2"]').count(), 0);
    await toggleSeqFxModTarget(page, 0);
    await setSeqFxModTargetAmount(page, 0, 7);

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][0], true);
    assertClose(upload.auxEnd[0][0][0], 19, 0.01, "Pitch +7 semitones should persist as 19 semitones");
    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedPitch = storedState.patterns[0].lanes[0].steps[0];
    assert.equal(storedPitch.effectType, SEQFX_EFFECT_TYPES.pitch);
    assert.deepEqual(storedPitch.params, [12, 25, 64, 0.4, 0.8, 0, 0, 0]);
    assert.equal(storedPitch.aux.targets[0].enabled, true);
    assertClose(storedPitch.aux.targets[0].end, 19, 0.01, "Pitch aux target should survive sparse v7 persistence");

    const glyph = page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="0"] [data-role="seqfx-block-glyph"]');
    assert.equal(await glyph.getAttribute("data-effect"), "pitch");
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-line"]').getAttribute("d"));
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-secondary-line"]').getAttribute("d"));

    await page.close();
});

test("seqfx_talk_box_sequences_documented_vowels_and_exposes_only_continuous_controls_to_modulation", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Talk Box", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Talk Box block 1", exact: true }).waitFor();

    const param = (index) => page.locator(`[data-role="seqfx-param"][data-param="${index}"]`);
    assert.deepEqual(
        await param(0).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["A", "E", "I", "O", "U"],
    );
    assert.equal(await param(1).inputValue(), "3");
    await openSeqFxAdvancedParameters(page);

    await param(0).selectOption("1");
    await param(1).selectOption("4");
    await setPhysicalSliderValue(param(2), 0.5);
    await setPhysicalSliderValue(param(3), 12);
    await setPhysicalSliderValue(param(4), 0.4);
    await setPhysicalSliderValue(param(5), 0.2);
    await setPhysicalSliderValue(param(6), 6);

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.effectTypes[0][0], SEQFX_EFFECT_TYPES.talkBox);
    assert.deepEqual(upload.params[0][0], [1, 4, 0.5, 12, 0.4, 0.2, 6, 0]);

    await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"]').count(), 5);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="0"]').count(), 0);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="1"]').count(), 0);
    await toggleSeqFxModTarget(page, 2);
    await setSeqFxModTargetAmount(page, 2, 25);

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][2], true);
    assertClose(upload.auxEnd[0][0][2], 0.75, 0.001, "Talk Box Morph +25 points should persist as 75%");
    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedTalkBox = storedState.patterns[0].lanes[0].steps[0];
    assert.equal(storedTalkBox.effectType, SEQFX_EFFECT_TYPES.talkBox);
    assert.deepEqual(storedTalkBox.params, [1, 4, 0.5, 12, 0.4, 0.2, 6, 0]);
    assert.equal(storedTalkBox.aux.targets[2].enabled, true);
    assertClose(storedTalkBox.aux.targets[2].end, 0.75, 0.001, "Talk Box aux target should survive sparse v7 persistence");

    const glyph = page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="0"] [data-role="seqfx-block-glyph"]');
    assert.equal(await glyph.getAttribute("data-effect"), "talk-box");
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-ink"]').getAttribute("d"));

    await page.close();
});

test("seqfx_dirty_sequences_oversampled_distortion_controls_and_excludes_character_from_modulation", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Dirty", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 Dirty block 1", exact: true }).waitFor();

    const param = (index) => page.locator(`[data-role="seqfx-param"][data-param="${index}"]`);
    assert.deepEqual(
        await param(1).locator("option").evaluateAll((options) => options.map((option) => option.textContent)),
        ["Soft", "Hard", "Fold", "Bias"],
    );
    await openSeqFxAdvancedParameters(page);

    await setPhysicalSliderValue(param(0), 24);
    await param(1).selectOption("2");
    await setPhysicalSliderValue(param(2), 0.35);
    await setPhysicalSliderValue(param(3), 0.8);
    await setPhysicalSliderValue(param(4), 5_000);
    await setPhysicalSliderValue(param(5), -3);

    let snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.effectTypes[0][0], SEQFX_EFFECT_TYPES.dirty);
    assert.deepEqual(upload.params[0][0], [24, 2, 0.35, 0.8, 5000, -3, 0, 0]);

    await openSeqFxModView(page);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"]').count(), 5);
    assert.equal(await page.locator('[data-role="seqfx-mod-target-row"][data-param="1"]').count(), 0);
    await toggleSeqFxModTarget(page, 0);
    await setSeqFxModTargetAmount(page, 0, 6);

    snapshot = await getHarnessSnapshot(page);
    upload = patternUploads(snapshot).at(-1).value;
    assert.equal(upload.auxEnabled[0][0][0], true);
    assertClose(upload.auxEnd[0][0][0], 30, 0.01, "Dirty Drive +6 dB should persist as 30 dB");
    const storedState = parseSeqFxStoredState(snapshot.storedState[SEQFX_STATE_KEY]);
    const storedDirty = storedState.patterns[0].lanes[0].steps[0];
    assert.equal(storedDirty.effectType, SEQFX_EFFECT_TYPES.dirty);
    assert.deepEqual(storedDirty.params, [24, 2, 0.35, 0.8, 5000, -3, 0, 0]);
    assert.equal(storedDirty.aux.targets[0].enabled, true);
    assertClose(storedDirty.aux.targets[0].end, 30, 0.01, "Dirty aux target should survive sparse v7 persistence");

    const glyph = page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="0"] [data-role="seqfx-block-glyph"]');
    assert.equal(await glyph.getAttribute("data-effect"), "dirty");
    assert.ok(await glyph.locator('[data-role="seqfx-block-glyph-line"]').getAttribute("d"));

    await page.close();
});

test("seqfx_blocks_use_a_single_clean_surface_with_hidden_resize_chrome", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    const blockControl = page.getByRole("button", { name: "Chain 2 Crush block 1", exact: true });
    const block = page.locator('[data-role="seqfx-block"][data-lane="1"][data-start="0"]');
    const fill = block.locator(".seqfx-block-fill");
    const resizeHandle = page.locator('[data-role="seqfx-block-resize"][data-lane="1"][data-start="0"]');
    await blockControl.waitFor();
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
    assert.equal(initialStyles.fillBackground, "rgb(238, 108, 77)");
    assert.notEqual(initialStyles.fillBoxShadow, "none");
    assert.equal(initialStyles.fillBoxShadow.includes("0px 0px 0px 1px"), false, "block fill should not use an inset 1px border");
    assert.deepEqual(initialStyles.fillInset, { top: "1px", right: "1px", bottom: "1px", left: "1px" });
    assert.equal(initialStyles.resizeCursor, "col-resize");
    assert.equal(initialStyles.resizeGripOpacity, "0");

    const blockBox = await blockControl.boundingBox();
    const fillBox = await fill.boundingBox();
    assert.ok(blockBox);
    assert.ok(fillBox);
    assertClose(fillBox.width, blockBox.width - 2, 1, "block fill should be the only near-full visible surface");
    assertClose(fillBox.height, blockBox.height - 2, 1, "block fill should leave only a 1px inset");

    await blockControl.hover();
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

test("seqfx_blocks_render_risograph_glyphs_from_effect_parameters", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.evaluate(async ({ stateKey, params }) => {
        const module = await import(`/fx/seqfx/view/seqfx-state.ts?risograph-block-test=${Date.now()}`);
        let state = module.createDefaultSeqFxState();
        const createBlock = (lane, startStep, length, effectType) => {
            state = module.applySeqFxBlockCreate(state, { patternIndex: 0, lane, startStep, length, effectType });
        };
        const setParam = (lane, startStep, paramIndex, value) => {
            state = module.applySeqFxBlockParamEdit(state, { patternIndex: 0, lane, startStep, paramIndex, value });
        };

        createBlock(0, 0, 1, module.SEQFX_EFFECT_TYPES.filter);
        setParam(0, 0, params.filterMode, 0);
        setParam(0, 0, params.filterCutoff, 2_400);
        setParam(0, 0, params.filterResonance, 0.62);

        createBlock(0, 2, 2, module.SEQFX_EFFECT_TYPES.filter);
        setParam(0, 2, params.filterMode, 2);
        setParam(0, 2, params.filterCutoff, 620);
        setParam(0, 2, params.filterResonance, 0.91);

        createBlock(1, 0, 3, module.SEQFX_EFFECT_TYPES.crusher);
        setParam(1, 0, params.crusherBits, 6);
        setParam(1, 0, params.crusherRateHz, 6_000);
        setParam(1, 0, params.crusherDriveDb, 9);

        createBlock(2, 0, 4, module.SEQFX_EFFECT_TYPES.tapeStop);
        setParam(2, 0, params.tapeCurve, 0.65);
        setParam(2, 0, params.tapeReturn, 1);

        createBlock(3, 0, 5, module.SEQFX_EFFECT_TYPES.stutter);
        setParam(3, 0, params.stutterSlices, 16);
        setParam(3, 0, params.stutterShape, 0.5);

        window.__SEQFX_HARNESS__?.patchConnection.sendStoredStateValue(stateKey, module.serializeSeqFxState(state));
    }, {
        stateKey: SEQFX_STATE_KEY,
        params: {
            filterMode: FILTER_PARAM_MODE,
            filterCutoff: FILTER_PARAM_CUTOFF,
            filterResonance: FILTER_PARAM_RESONANCE,
            crusherBits: CRUSHER_PARAM_BITS,
            crusherRateHz: CRUSHER_PARAM_RATE_HZ,
            crusherDriveDb: CRUSHER_PARAM_DRIVE_DB,
            tapeCurve: TAPE_STOP_PARAM_CURVE,
            tapeReturn: TAPE_STOP_PARAM_RETURN,
            stutterSlices: STUTTER_PARAM_SLICES,
            stutterShape: STUTTER_PARAM_SHAPE,
        },
    });

    await page.locator('[data-role="seqfx-block-glyph"]').first().waitFor();

    const glyphs = await page.evaluate(() => {
        const read = (selector) => {
            const block = document.querySelector(selector);
            const fill = block?.querySelector(".seqfx-block-fill");
            const glyph = block?.querySelector('[data-role="seqfx-block-glyph"]');
            const labels = [...(block?.querySelectorAll('[data-role="seqfx-block-glyph-label"]') ?? [])].map((node) => node.textContent?.trim());
            const readouts = [...(block?.querySelectorAll('[data-role="seqfx-block-glyph-readout"]') ?? [])].map((node) => node.textContent?.trim());

            return {
                blockBackground: fill ? getComputedStyle(fill).backgroundColor : "",
                effect: glyph?.getAttribute("data-effect"),
                filterMarker: glyph?.querySelector('[data-role="seqfx-block-glyph-marker"]')?.getAttribute("d"),
                inkPath: glyph?.querySelector('[data-role="seqfx-block-glyph-ink"]')?.getAttribute("d"),
                labels,
                readouts,
                rectCount: glyph?.querySelectorAll('[data-role="seqfx-block-glyph-rect"]').length ?? 0,
                size: glyph?.getAttribute("data-size"),
                viewBox: glyph?.getAttribute("viewBox"),
            };
        };

        return {
            singleFilter: read('[data-role="seqfx-block"][data-lane="0"][data-start="0"]'),
            midFilter: read('[data-role="seqfx-block"][data-lane="0"][data-start="2"]'),
            crusher: read('[data-role="seqfx-block"][data-lane="1"][data-start="0"]'),
            tape: read('[data-role="seqfx-block"][data-lane="2"][data-start="0"]'),
            stutter: read('[data-role="seqfx-block"][data-lane="3"][data-start="0"]'),
        };
    });

    assert.equal(glyphs.singleFilter.effect, "filter");
    assert.equal(glyphs.singleFilter.size, "single");
    assert.equal(glyphs.singleFilter.viewBox, "0 0 28 28");
    assert.deepEqual(glyphs.singleFilter.labels, [], "single-cell blocks should stay silhouette-only");
    assert.match(glyphs.singleFilter.inkPath, /Q/, "filter glyph should use smooth continuous curves, not stepped blocks");
    assert.match(glyphs.singleFilter.filterMarker, /^M\d+(\.\d+)? 0 V28$/);

    assert.equal(glyphs.midFilter.effect, "filter");
    assert.equal(glyphs.midFilter.size, "medium");
    assert.equal(glyphs.midFilter.viewBox, "0 0 59 28");
    assert.deepEqual(glyphs.midFilter.labels, ["BP"], "medium filter blocks should keep the tiny prototype-style mode label");
    assert.match(glyphs.midFilter.inkPath, /Q/, "bandpass filter glyph should be a smooth bell shape");

    assert.equal(glyphs.crusher.effect, "crusher");
    assert.equal(glyphs.crusher.viewBox, "0 0 90 28");
    assert.deepEqual(glyphs.crusher.labels, ["6 BIT"]);
    assert.match(glyphs.crusher.inkPath, /^M0 28 L0 \d+(\.\d+)? L/, "crusher glyph should use the prototype's stepped filled silhouette");
    assert.match(glyphs.crusher.blockBackground, /^rgb\(238, 108, 77\)$/);

    assert.equal(glyphs.tape.effect, "tape");
    assert.equal(glyphs.tape.size, "wide");
    assert.deepEqual(glyphs.tape.labels, ["SPIN"]);
    assert.match(glyphs.tape.inkPath, /Q/, "curved tape modes should draw a curved filled envelope");
    assert.match(glyphs.tape.blockBackground, /^rgb\(152, 193, 217\)$/);

    assert.equal(glyphs.stutter.effect, "stutter");
    assert.equal(glyphs.stutter.rectCount, 16, "stutter glyph bar count should follow the slice count");
    assert.deepEqual(glyphs.stutter.readouts, ["x16 BELL"]);
    assert.match(glyphs.stutter.blockBackground, /^rgb\(181, 217, 156\)$/);

    await page.close();
});

test("seqfx_inspector_uses_a_beveled_material_plate_with_raised_control_islands", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
    await page.locator(".seqfx-crusher-editor__panel").waitFor();

    const styles = await page.evaluate(() => {
        const styleFor = (selector, pseudo = null) => {
            const node = document.querySelector(selector);
            const computed = getComputedStyle(node, pseudo);

            return {
                backgroundColor: computed.backgroundColor,
                borderTopStyle: computed.borderTopStyle,
                borderTopWidth: computed.borderTopWidth,
                boxShadow: computed.boxShadow,
                clipPath: computed.clipPath,
                filter: computed.filter,
                position: computed.position,
                zIndex: computed.zIndex,
            };
        };

        return {
            deleteButton: styleFor('[data-role="seqfx-delete-block"]'),
            heading: styleFor(".seqfx-inspector-heading"),
            inspector: styleFor('[data-role="seqfx-inspector"]'),
            inspectorPlate: styleFor('[data-role="seqfx-inspector"]', "::before"),
            mixRow: styleFor('[data-role="seqfx-mix-row"]'),
            panel: styleFor(".seqfx-crusher-editor__panel"),
            tickSlider: styleFor(".editor-tick-slider"),
        };
    });

    assert.equal(styles.inspector.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(styles.inspector.borderTopWidth, "0px");
    assert.equal(styles.inspector.position, "relative");
    assert.match(styles.inspectorPlate.clipPath, /^polygon\(/);
    assert.notEqual(styles.inspectorPlate.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.notEqual(styles.inspectorPlate.filter, "none");
    assert.equal(styles.heading.position, "relative");
    assert.equal(styles.heading.zIndex, "1");

    for (const [name, style] of Object.entries({
        deleteButton: styles.deleteButton,
        mixRow: styles.mixRow,
        panel: styles.panel,
        tickSlider: styles.tickSlider,
    })) {
        assert.equal(style.borderTopWidth, "0px", `${name} should not draw a rectangular border`);
        assert.equal(style.borderTopStyle, "none", `${name} should not draw a rectangular border`);
        assert.match(style.backgroundColor, /rgba\(/, `${name} should use a material fill`);
        assert.notEqual(style.boxShadow, "none", `${name} should read as a raised island`);
    }

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

test("seqfx_block_move_copy_and_resize_ignore_non_owner_pointer_move_up_and_cancel", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.getByRole("button", { name: "Chain 1 step 2", exact: true }).click();
    await resizeBlockToStep(page, 0, 2, 3);

    const center = (box) => ({
        clientX: box.x + (box.width / 2),
        clientY: box.y + (box.height / 2),
    });
    const blockBodyPoint = (box) => ({
        clientX: box.x + 2,
        clientY: box.y + (box.height / 2),
    });
    const dispatchForeignSequence = async (targetPoint, pointerId) => {
        await dispatchSyntheticPointer(page, "window", "pointermove", {
            ...targetPoint,
            buttons: 1,
            pointerId,
            pointerType: "touch",
        });
        await dispatchSyntheticPointer(page, "window", "pointerup", {
            ...targetPoint,
            buttons: 0,
            pointerId,
            pointerType: "touch",
        });
        await dispatchSyntheticPointer(page, "window", "pointercancel", {
            ...targetPoint,
            buttons: 0,
            pointerId,
            pointerType: "touch",
        });
    };

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    let sourceSelector = '[data-role="seqfx-block"][data-lane="0"][data-start="1"]';
    let sourceBox = await page.locator(sourceSelector).boundingBox();
    let targetBox = await boundingBoxForCell(page, 0, 4);
    assert.ok(sourceBox);
    await page.mouse.move(blockBodyPoint(sourceBox).clientX, blockBodyPoint(sourceBox).clientY);
    await page.mouse.down();
    assert.equal(await page.locator('[data-role="seqfx-root"]').evaluate((node) => node.classList.contains("is-dragging")), true);
    await dispatchForeignSequence(center(targetBox), 202);
    assert.equal(await page.locator('[data-role="seqfx-root"]').evaluate((node) => node.classList.contains("is-dragging")), true);
    assert.equal(await page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="4"]').count(), 0);
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);

    await page.mouse.move(center(targetBox).clientX, center(targetBox).clientY, { steps: 8 });
    await page.waitForTimeout(100);
    assert.equal(
        await page.locator('[data-role="seqfx-block"][data-lane="0"][data-start="4"]').count(),
        1,
        `owner move did not create its preview: ${JSON.stringify(await page.locator('[data-role="seqfx-root"]').evaluate((node) => ({
            className: node.className,
            invalidDrops: node.querySelectorAll('[data-role="seqfx-invalid-drop"]').length,
            previews: [...node.querySelectorAll('[data-role="seqfx-block"]')].map((block) => ({
                lane: block.getAttribute("data-lane"),
                start: block.getAttribute("data-start"),
            })),
        })))}`,
    );
    await dispatchSyntheticPointer(page, "window", "pointercancel", {
        ...center(targetBox),
        buttons: 0,
        pointerId: 202,
        pointerType: "touch",
    });
    assert.equal(await page.locator('[data-role="seqfx-block"][data-start="4"]').count(), 1);
    await page.mouse.up();
    await page.getByRole("button", { name: "Chain 1 Filter block 5-6", exact: true }).waitFor();
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 1);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    sourceSelector = '[data-role="seqfx-block"][data-lane="0"][data-start="4"]';
    sourceBox = await page.locator(sourceSelector).boundingBox();
    targetBox = await boundingBoxForCell(page, 3, 7);
    assert.ok(sourceBox);
    await page.keyboard.down("Alt");
    await page.mouse.move(blockBodyPoint(sourceBox).clientX, blockBodyPoint(sourceBox).clientY);
    await page.mouse.down();
    await dispatchForeignSequence(center(targetBox), 404);
    assert.equal(await page.locator('[data-role="seqfx-block"][data-preview="true"][data-lane="3"][data-start="7"]').count(), 0);
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    await page.mouse.move(center(targetBox).clientX, center(targetBox).clientY, { steps: 8 });
    await page.locator('[data-role="seqfx-block"][data-preview="true"][data-lane="3"][data-start="7"]').waitFor();
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await page.getByRole("button", { name: "Chain 4 Filter block 8-9", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 1 Filter block 5-6", exact: true }).waitFor();
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 1);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const resizeSelector = '[data-role="seqfx-block-resize"][data-lane="3"][data-start="7"]';
    sourceBox = await page.locator(resizeSelector).boundingBox();
    targetBox = await boundingBoxForCell(page, 3, 9);
    assert.ok(sourceBox);
    await page.mouse.move(center(sourceBox).clientX, center(sourceBox).clientY);
    await page.mouse.down();
    await dispatchForeignSequence(center(targetBox), 606);
    assert.equal(await page.getByRole("button", { name: "Chain 4 Filter block 8-10", exact: true }).count(), 0);
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0);
    await page.mouse.move(center(targetBox).clientX, center(targetBox).clientY, { steps: 8 });
    await page.getByRole("button", { name: "Chain 4 Filter block 8-10", exact: true }).waitFor();
    await dispatchSyntheticPointer(page, "window", "pointercancel", {
        ...center(targetBox),
        buttons: 0,
        pointerId: 606,
        pointerType: "touch",
    });
    await page.mouse.up();
    await page.getByRole("button", { name: "Chain 4 Filter block 8-10", exact: true }).waitFor();
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 1);

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
    const block = page.getByRole("button", { name: "Chain 2 Crush block 1", exact: true });
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
    await page.getByRole("button", { name: "Chain 2 Crush block 1", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 2 Crush block 2", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 2 Crush block 3", exact: true }).waitFor();
    await assert.rejects(
        page.getByRole("button", { name: "Chain 2 Crush block 4", exact: true }).waitFor({ timeout: 300 }),
    );
    await assert.rejects(
        page.getByRole("button", { name: "Chain 2 Crush block 5", exact: true }).waitFor({ timeout: 300 }),
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
    await page.getByRole("button", { name: "Chain 2 Crush block 2", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crush block 5", exact: true }).click({ modifiers: ["Shift"] });
    await page.waitForFunction(() => (
        Array.from(document.querySelectorAll('[data-role="seqfx-block"].is-selected[data-lane="1"]'))
            .map((node) => Number(node.getAttribute("data-start")))
            .join(",") === "1,4"
    ));
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const anchorBlock = page.getByRole("button", { name: "Chain 2 Crush block 2", exact: true });
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
    await page.getByRole("button", { name: "Chain 4 Crush block 9", exact: true }).waitFor();
    await page.getByRole("button", { name: "Chain 4 Crush block 12", exact: true }).waitFor();

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

    await page.getByRole("button", { name: "Chain 2 Crush block 2", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crush block 7", exact: true }).click({ modifiers: ["Shift"] });

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
        page.getByRole("button", { name: "Chain 2 Crush block 2", exact: true }).waitFor({ timeout: 300 }),
    );
    await page.getByRole("button", { name: "Chain 2 Crush block 11", exact: true }).waitFor();

    await page.close();
});

test("seqfx_cmd_c_and_cmd_v_copy_cell_values_to_single_or_group_selection", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    for (const step of [2, 5, 8]) {
        await page.getByRole("button", { name: `Chain 2 step ${step}`, exact: true }).click();
    }

    await page.getByRole("button", { name: "Chain 2 Crush block 2", exact: true }).click();
    await setRangeInputValue(page.locator('[data-role="seqfx-mix"]'), 0.42);
    await setCrushEditorValues(page, { bits: 5, rateHz: 3_098, driveDb: 12 });

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.getByRole("button", { name: "Chain 2 Crush block 2", exact: true }).click();
    await pressMetaShortcut(page, "KeyC");

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Ring", exact: true }).click();
    await page.locator('[data-role="seqfx-param"][data-param="1"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.locator('[data-role="seqfx-param"][data-param="1"]').focus();
    await pressMetaShortcut(page, "KeyV");
    let snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 0);

    await page.getByRole("button", { name: "Chain 2 Crush block 5", exact: true }).click();
    await pressMetaShortcut(page, "KeyV");

    snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.params[1][4].slice(0, 3), [5, 3_098, 12]);
    assert.equal(upload.mix[1][4], 0.42);
    assert.deepEqual(upload.params[1][7].slice(0, 3), [8, 48_000, 0]);
    assert.equal(upload.mix[1][7], 1);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.getByRole("button", { name: "Chain 2 Crush block 5", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crush block 8", exact: true }).click({ modifiers: ["Shift"] });
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
        [[5, 3_098, 12], [5, 3_098, 12]],
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

    await page.getByRole("button", { name: "Chain 2 Crush block 2", exact: true }).click();
    await setRangeInputValue(page.locator('[data-role="seqfx-mix"]'), 0.37);
    await setCrushEditorValues(page, { bits: 6, rateHz: 12_195, driveDb: 15 });

    const copyResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-block"][data-lane="1"][data-start="1"]',
        "copy",
    );
    assert.deepEqual(copyResult, { defaultPrevented: true, dispatchResult: false });

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.getByRole("button", { name: "Ring", exact: true }).click();
    await page.locator('[data-role="seqfx-param"][data-param="1"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const ignoredPasteResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-param"][data-param="1"]',
        "paste",
    );
    assert.deepEqual(ignoredPasteResult, { defaultPrevented: false, dispatchResult: true });
    let snapshot = await getHarnessSnapshot(page);
    assert.equal(patternUploads(snapshot).length, 0);

    await page.getByRole("button", { name: "Chain 2 Crush block 5", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    const pasteResult = await dispatchClipboardEvent(
        page,
        '[data-role="seqfx-block"][data-lane="1"][data-start="4"]',
        "paste",
    );
    assert.deepEqual(pasteResult, { defaultPrevented: true, dispatchResult: false });

    snapshot = await getHarnessSnapshot(page);
    let upload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(upload.params[1][4].slice(0, 3), [6, 12_195, 15]);
    assert.equal(upload.mix[1][4], 0.37);
    assert.deepEqual(upload.params[1][7].slice(0, 3), [8, 48_000, 0]);
    assert.equal(upload.mix[1][7], 1);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.getByRole("button", { name: "Chain 2 Crush block 5", exact: true }).click();
    await page.getByRole("button", { name: "Chain 2 Crush block 8", exact: true }).click({ modifiers: ["Shift"] });
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
        [[6, 12_195, 15], [6, 12_195, 15]],
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
    await page.locator('[data-role="seqfx-inspector"]').getByText("Chain 1 · Filter · step 9").waitFor();

    await page.close();
});

test("seqfx_block_duration_is_a_focusable_bounded_keyboard_slider", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 9", exact: true }).click();
    await page.getByRole("button", { name: "Chain 1 step 5", exact: true }).click();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const duration = page.getByRole("slider", {
        name: "Chain 1 Filter block at step 5 duration",
        exact: true,
    });
    await page.getByRole("button", { name: "Chain 1 Filter block 5", exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await duration.getAttribute("aria-orientation"), "horizontal");
    assert.equal(await duration.getAttribute("aria-valuemin"), "1");
    assert.equal(await duration.getAttribute("aria-valuemax"), "4");
    assert.equal(await duration.getAttribute("aria-valuenow"), "1");
    assert.equal(await duration.getAttribute("aria-valuetext"), "1 step");
    assert.equal(await duration.getAttribute("tabindex"), "0");
    assert.equal(await duration.evaluate((node) => document.activeElement === node), true);

    await page.keyboard.press("End");
    await page.getByRole("button", { name: "Chain 1 Filter block 5-8", exact: true }).waitFor();
    assert.equal(await duration.getAttribute("aria-valuenow"), "4");
    assert.equal(await duration.getAttribute("aria-valuetext"), "4 steps");

    let uploads = patternUploads(await getHarnessSnapshot(page));
    assert.equal(uploads.length, 1);
    assert.deepEqual(uploads[0].value.activeSteps[0].slice(4, 9), [true, true, true, true, true]);
    assert.deepEqual(uploads[0].value.triggerSteps[0].slice(4, 9), [true, false, false, false, true]);

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.keyboard.press("ArrowRight");
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0, "maximum duration is a no-op");

    await page.keyboard.press("ArrowLeft");
    await page.getByRole("button", { name: "Chain 1 Filter block 5-7", exact: true }).waitFor();
    assert.equal(await duration.getAttribute("aria-valuenow"), "3");

    await page.keyboard.press("Home");
    await page.getByRole("button", { name: "Chain 1 Filter block 5", exact: true }).waitFor();
    assert.equal(await duration.getAttribute("aria-valuenow"), "1");

    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());
    await page.keyboard.press("ArrowLeft");
    assert.equal(patternUploads(await getHarnessSnapshot(page)).length, 0, "minimum duration is a no-op");

    await page.close();
});

test("seqfx_block_duration_keeps_keyboard_focus_across_bar_boundaries", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await loadSeqFxHarness(page);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Chain 1 step 16", exact: true }).click();
    const block = page.getByRole("button", { name: "Chain 1 Filter block 16", exact: true });
    const duration = page.getByRole("slider", {
        name: "Chain 1 Filter block at step 16 duration",
        exact: true,
    });

    await block.focus();
    await page.keyboard.press("Tab");
    assert.equal(await duration.evaluate((node) => document.activeElement === node), true);

    await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: "Chain 1 Filter block 16-17", exact: true }).waitFor();
    assert.equal(await duration.getAttribute("aria-valuenow"), "2");
    assert.equal(
        await duration.evaluate((node) => document.activeElement === node),
        true,
        "crossing into the second bar must not replace the focused duration control",
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
        await page.getByRole("button", { name: "Chain 1 Filter block 16-17", exact: true })
            .evaluate((node) => document.activeElement === node),
        true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
        await duration.evaluate((node) => document.activeElement === node),
        true,
        "the duration slider must remain the block button's next tab stop after crossing a bar",
    );

    await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: "Chain 1 Filter block 16-18", exact: true }).waitFor();
    assert.equal(await duration.getAttribute("aria-valuenow"), "3");
    assert.equal(await duration.evaluate((node) => document.activeElement === node), true);

    await page.close();
});
