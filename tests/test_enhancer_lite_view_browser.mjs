import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import path from "node:path";

import { chromium } from "playwright";

import { startStaticRepoServer } from "../kit/tests/helpers/static_web_server.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const initialValues = {
    freqHzIn: 130,
    qIn: 0.71,
    modeIn: 0,
    midAmountIn: 0,
    sideAmountIn: 0,
    curveIn: 1,
    saturationModeIn: 0,
    shapeIn: 1,
};

// The same sound in state field keys, as a saved preset records it.
const initialPresetValues = {
    frequency: 130, q: 0.71, routing: 0, amount: 0, sideAmount: 0, character: 1, intensity: 0, shape: 1,
};

let server;
let browser;

before(async () => {
    // Build first so the compiled-view tests exercise the current source, not a
    // stale build/fx runtime. The server bundles /fx TypeScript views on the fly.
    const build = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "enhancer-lite"], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
    assert.equal(build.status, 0, `npm run fx:build -- enhancer-lite failed:\n${build.stdout}${build.stderr}`);
    server = await startStaticRepoServer({ bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

// The parameter surface a Cmajor host reports in its status: the eight sound
// endpoints plus the hidden analyzer enable, mirroring EnhancerLitePlugin.cmajor.
const hostStatusInputs = [
    { endpointID: "freqHzIn", purpose: "parameter", annotation: { name: "Frequency", group: "Band", min: 20, max: 20000, init: 130, unit: "Hz" } },
    { endpointID: "qIn", purpose: "parameter", annotation: { name: "Q", group: "Band", min: 0.1, max: 10, init: 0.71 } },
    { endpointID: "modeIn", purpose: "parameter", annotation: { name: "Routing", group: "Band", min: 0, max: 1, init: 0, discrete: true, step: 1, text: "Stereo|Mid/Side" } },
    { endpointID: "midAmountIn", purpose: "parameter", annotation: { name: "Amount / Mid", group: "Band", min: 0, max: 1, init: 0 } },
    { endpointID: "sideAmountIn", purpose: "parameter", annotation: { name: "Side", group: "Band", min: 0, max: 1, init: 0 } },
    { endpointID: "curveIn", purpose: "parameter", annotation: { name: "Character", group: "Band", min: 0, max: 1, init: 1, discrete: true, step: 1, text: "Tube|Solid" } },
    { endpointID: "saturationModeIn", purpose: "parameter", annotation: { name: "Intensity", group: "Band", min: 0, max: 1, init: 0, discrete: true, step: 1, text: "Subtle|Medium" } },
    { endpointID: "shapeIn", purpose: "parameter", annotation: { name: "Shape", group: "Band", min: 0, max: 2, init: 1, discrete: true, step: 1, text: "Low|Bell|High" } },
    { endpointID: "analyzerEnabledIn", purpose: "parameter", annotation: { name: "Analyzer Enable", hidden: true } },
];

const sourceView = "/fx/enhancer_lite/view/source.tsx";
const compiledView = "/build/fx/enhancer_lite_runtime/view/app.js";

/** A readout or graph handle, by its accessible name. */
function slider(page, name) {
    return page.getByRole("slider", { name, exact: true });
}

/** One button of a segmented switch such as Shape or Route. */
function choice(page, group, name) {
    return page.getByRole("group", { name: group, exact: true }).getByRole("button", { name, exact: true });
}

/** The editor surface under the header; tests resize it to model smaller plugin windows. */
function surface(page) {
    return page.getByRole("main");
}

function responseGraph(page) {
    return page.getByRole("group", { name: "Response graph", exact: true });
}

const writesTo = (page, endpointID) => page.evaluate((id) => window.__ENHANCER_LITE_TEST__.sent
    .filter(({ endpointID }) => endpointID === id).map(({ value }) => value), endpointID);

/**
 * Mount the view against a mock patch connection whose parameter writes and
 * stored state go through the kit's browser-preview state owner. Pass
 * `userFileFixture` to install a `window.chocUserFiles` store with those files.
 */
async function openEnhancerLite(modulePath = sourceView, { manifest, userFileFixture } = {}) {
    const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
    await page.goto(new URL("kit/tests/helpers/module_test_shell.html", server.baseUrl).toString());
    await page.evaluate(async ({ values, sourceModulePath, statusInputs, manifest, userFileFixture }) => {
        if (userFileFixture) {
            const files = new Map(Object.entries(userFileFixture));
            const calls = [];
            window.__PRESET_FILES_TEST__ = { files, calls };
            window.chocUserFiles = {
                async list(scope) {
                    calls.push({ operation: "list", scope });
                    return [...files.keys()].filter((key) => key.startsWith(`${scope}/`)).map((key) => key.slice(scope.length + 1));
                },
                async read(scope, fileName) {
                    calls.push({ operation: "read", scope });
                    return files.get(`${scope}/${fileName}`);
                },
                async write(scope, fileName, contents) {
                    calls.push({ operation: "write", scope });
                    files.set(`${scope}/${fileName}`, contents);
                },
                async delete(scope, fileName) {
                    calls.push({ operation: "delete", scope });
                    files.delete(`${scope}/${fileName}`);
                },
            };
        }
        const parameterValues = new Map(Object.entries(values));
        const listeners = new Map();
        const endpointListeners = new Map();
        const storedState = new Map();
        const sent = [];
        const automationMessages = [];
        const storedWrites = [];
        let stateHost;
        let publishingParameter = false;

        const emit = (endpointID, value) => {
            parameterValues.set(endpointID, value);
            if (!publishingParameter) stateHost?.observe(endpointID, Number(value));
            for (const listener of listeners.get(endpointID) ?? [])
                listener(value);
        };
        const emitEndpoint = (endpointID, value) => {
            for (const listener of endpointListeners.get(endpointID) ?? [])
                listener(value);
        };

        const patchConnection = {
            manifest,
            addParameterListener(endpointID, listener) {
                const endpointListeners = listeners.get(endpointID) ?? new Set();
                endpointListeners.add(listener);
                listeners.set(endpointID, endpointListeners);
            },
            removeParameterListener(endpointID, listener) {
                listeners.get(endpointID)?.delete(listener);
            },
            requestParameterValue(endpointID) {
                queueMicrotask(() => emit(endpointID, parameterValues.get(endpointID)));
            },
            addEndpointListener(endpointID, listener) {
                const listenersForEndpoint = endpointListeners.get(endpointID) ?? new Set();
                listenersForEndpoint.add(listener);
                endpointListeners.set(endpointID, listenersForEndpoint);
            },
            removeEndpointListener(endpointID, listener) {
                endpointListeners.get(endpointID)?.delete(listener);
            },
            sendEventOrValue(endpointID, value) {
                sent.push({ endpointID, value });
                if (Object.hasOwn(values, endpointID))
                    automationMessages.push({ type: "value", endpointID, value });
                emit(endpointID, value);
            },
            sendParameterGestureStart(endpointID) {
                automationMessages.push({ type: "begin", endpointID });
            },
            sendParameterGestureEnd(endpointID) {
                automationMessages.push({ type: "end", endpointID });
            },
        };

        const { createBrowserPreviewState } = await import("/kit/ui/preview/state.ts");
        stateHost = createBrowserPreviewState({
            snapshot: () => ({ values: Object.fromEntries(storedState), parameters: statusInputs.map(input => ({
                endpoint: input.endpointID, value: Number(parameterValues.get(input.endpointID) ?? 0),
                min: input.annotation.min ?? 0, max: input.annotation.max ?? 1, step: input.annotation.step ?? 0,
                defaultValue: input.annotation.init ?? 0,
            })) }),
            parameter(endpoint, value) {
                publishingParameter = true;
                try { patchConnection.sendEventOrValue(endpoint, value); }
                finally { publishingParameter = false; }
            },
            stored(key, value) { storedState.set(key, value); storedWrites.push({ key, value }); },
            gesture(endpoint, kind) {
                if (kind === "gesture-start") patchConnection.sendParameterGestureStart(endpoint);
                else patchConnection.sendParameterGestureEnd(endpoint);
            },
        });
        Object.assign(patchConnection, stateHost.host);
        const module = await import(sourceModulePath);
        document.querySelector("#mount").replaceChildren(module.default(patchConnection));
        window.__ENHANCER_LITE_TEST__ = {
            emit,
            emitEndpoint,
            sent,
            automationMessages,
            storedWrites,
            clearSent: () => sent.splice(0),
            clearAutomation: () => automationMessages.splice(0),
            endpointListenerCount: (endpointID) => endpointListeners.get(endpointID)?.size ?? 0,
            disconnect: () => document.querySelector("#mount").replaceChildren(),
            reopen: () => document.querySelector("#mount").replaceChildren(module.default(patchConnection)),
            openSecond: () => document.querySelector("#mount").append(module.default(patchConnection)),
        };
    }, { values: initialValues, sourceModulePath: modulePath, statusInputs: hostStatusInputs, manifest, userFileFixture });
    await slider(page, "Frequency").waitFor();
    return page;
}

test("the generated state worker carries no React", async () => {
    // state.ts imports presets() and snapshots(); the hooks live in separate modules so the worker stays free of React.
    const worker = await readFile(path.join(repoRoot, "build/fx/enhancer_lite_runtime/worker.js"), "utf8");
    assert.doesNotMatch(worker, /react[._]production|Symbol\.for\("react\.|__SECRET_INTERNALS|__CLIENT_INTERNALS|useSyncExternalStore/u,
        "a module that state.ts reaches imports React or a React hook module");
});

for (const sourceModule of [sourceView, compiledView]) {
test(`scalar controls share Undo/Redo and retain their history when the GUI reopens (${sourceModule})`, async () => {
    const page = await openEnhancerLite(sourceModule);
    try {
        const amount = slider(page, "Amount");
        const frequency = slider(page, "Frequency");
        const originalFrequency = await frequency.getAttribute("aria-valuenow");
        await amount.focus(); await page.keyboard.press("ArrowUp");
        const editedAmount = await amount.getAttribute("aria-valuenow");
        assert.ok(Number(editedAmount) > 0);
        await frequency.focus(); await page.keyboard.press("ArrowRight");
        assert.ok(Number(await frequency.getAttribute("aria-valuenow")) > Number(originalFrequency));
        const undo = page.getByRole("button", { name: "Undo", exact: true });
        await undo.click({ timeout: 2000 });
        assert.equal(await frequency.getAttribute("aria-valuenow"), originalFrequency);
        assert.equal(await amount.getAttribute("aria-valuenow"), editedAmount);
        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.reopen());
        await slider(page, "Amount").waitFor();
        await undo.click();
        assert.equal(await amount.getAttribute("aria-valuenow"), "0");
        await page.getByRole("button", { name: "Redo", exact: true }).click();
        assert.equal(await amount.getAttribute("aria-valuenow"), editedAmount);
    } finally { await page.close(); }
});

}

test("the header controls fit the existing 820 by 560 plugin frame", async () => {
    const page = await openEnhancerLite();
    try {
        await page.setViewportSize({ width: 820, height: 560 });
        await page.evaluate(() => { document.getElementById("mount").style.cssText = "width:820px;height:560px;padding:0"; });
        // A changed sound shows the widest header: the Modified indicator next to every button.
        await page.getByRole("combobox", { name: "Preset" }).selectOption("air-lift");
        await choice(page, "Shape", "Low").click();
        await page.getByText("Modified").waitFor();
        for (const control of await page.getByRole("banner").locator("button, select").all()) {
            const bounds = await control.boundingBox();
            assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 820 && bounds.y + bounds.height <= 40,
                `${await control.textContent()} sits inside the 820 by 40 header: ${JSON.stringify(bounds)}`);
        }
        const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
        assert.deepEqual(size, { width: 820, height: 560 }, "the native frame needs no scrolling for the header");
    } finally { await page.close(); }
});

test("consecutive arrow presses each step from the value the previous one wrote", async () => {
    const page = await openEnhancerLite();
    try {
        const amount = slider(page, "Amount");
        await amount.press("ArrowUp");
        await amount.press("ArrowUp");
        assert.equal(await amount.getAttribute("aria-valuenow"), "0.24", "both relative keyboard increments reach the canonical projection");
        assert.deepEqual(await writesTo(page, "midAmountIn"), [0.01, 0.02]);
    } finally { await page.close(); }
});

test("a same-turn captured drag returning to its origin adds no Undo entry", async () => {
    const page = await openEnhancerLite();
    try {
        const amount = slider(page, "Amount");
        const { originX, originY, pointerID } = await beginCapturedDrag(page, amount);
        await amount.evaluate((element, origin) => {
            for (const clientY of [origin.y - 50, origin.y]) element.dispatchEvent(new PointerEvent("pointermove", {
                pointerId: origin.pointerID, clientX: origin.x, clientY, bubbles: true, buttons: 1,
            }));
        }, { x: originX, y: originY, pointerID });
        await page.mouse.up();
        assert.equal(await amount.getAttribute("aria-valuenow"), "0");
        assert.equal(await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(), true);
        const writes = await writesTo(page, "midAmountIn");
        assert.equal(writes.length, 2);
        assert.ok(writes[0] > 0);
        assert.equal(writes[1], 0, "an absolute return to zero is written, not dropped as a no-op against the last render");
    } finally { await page.close(); }
});

test("a competing GUI edit restores the owner projection while another GUI holds the gesture", async () => {
    const page = await openEnhancerLite();
    try {
        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.openSecond());
        const controls = slider(page, "Amount");
        await controls.nth(1).waitFor();
        const first = controls.nth(0), second = controls.nth(1);
        const bounds = await first.boundingBox();
        assert.ok(bounds);
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 - 30);
        const ownedValue = await first.getAttribute("aria-valuenow");
        assert.ok(Number(ownedValue) > 0);
        const writesBefore = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.length);
        await second.evaluate(element => element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true })));
        assert.equal(await second.getAttribute("aria-valuenow"), ownedValue, "a rejected optimistic edit restores the accepted owner projection");
        assert.equal(await first.getAttribute("aria-valuenow"), ownedValue);
        assert.equal(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.length), writesBefore, "a competing GUI cannot write through the owner's gesture");
        await page.mouse.up();
    } finally { await page.close(); }
});

async function drag(page, locator, deltaX, deltaY, modifiers = []) {
    const bounds = await locator.boundingBox();
    assert.ok(bounds, "drag target must have browser geometry");
    const originX = bounds.x + bounds.width / 2;
    const originY = bounds.y + bounds.height / 2;

    for (const modifier of modifiers)
        await page.keyboard.down(modifier);
    await page.mouse.move(originX, originY);
    await page.mouse.down();
    await page.mouse.move(originX + deltaX, originY + deltaY, { steps: 5 });
    await page.mouse.up();
    for (const modifier of [...modifiers].reverse())
        await page.keyboard.up(modifier);
}

async function measurePrimaryHandleDrag(page, shape, shapeIn) {
    const handle = slider(page, "Band handle");
    await page.evaluate((selectedShapeIn) => {
        window.__ENHANCER_LITE_TEST__.emit("shapeIn", selectedShapeIn);
        window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
        window.__ENHANCER_LITE_TEST__.emit("qIn", 0.7);
        window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0);
    }, shapeIn);
    const zeroCy = Number(await handle.getAttribute("cy"));
    await page.evaluate(() => window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 1));
    const fullCy = Number(await handle.getAttribute("cy"));
    await page.evaluate(() => {
        window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.25);
        window.__ENHANCER_LITE_TEST__.clearSent();
    });
    const beforeCy = Number(await handle.getAttribute("cy"));
    const pointerDeltaY = -40;
    await drag(page, handle, 0, pointerDeltaY);
    const afterCy = Number(await handle.getAttribute("cy"));
    const amountEvents = await writesTo(page, "midAmountIn");
    assert.ok(amountEvents.length > 0, `${shape} emitted no Amount gesture`);
    const amount = amountEvents.at(-1);
    const expectedAmount = 0.25 - pointerDeltaY / 240;
    const expectedCy = zeroCy - expectedAmount * (zeroCy - fullCy);

    assert.equal(zeroCy, 244, `${shape} zero-Amount geometry drifted`);
    assert.equal(fullCy, 18, `${shape} full-Amount geometry drifted`);
    assert.ok(Math.abs(amount - expectedAmount) < 1e-6, `${shape}: ${amount} vs ${expectedAmount}`);
    assert.ok(Math.abs(afterCy - expectedCy) <= 0.02, `${shape}: ${afterCy} vs ${expectedCy}`);
    assert.ok(beforeCy - afterCy > 30, `${shape} handle detached from a 40 px pointer drag`);

    return { shape, zeroCy, fullCy, beforeCy, afterCy, amount };
}

async function beginCapturedDrag(page, locator) {
    const bounds = await locator.boundingBox();
    assert.ok(bounds, "drag target must have browser geometry");
    const originX = bounds.x + bounds.width / 2;
    const originY = bounds.y + bounds.height / 2;
    await page.mouse.move(originX, originY);
    await page.mouse.down();
    const pointerID = await locator.evaluate((element) => {
        for (let candidate = 1; candidate <= 32; candidate += 1) {
            if (element.hasPointerCapture(candidate))
                return candidate;
        }
        return undefined;
    });
    assert.equal(typeof pointerID, "number");
    assert.equal(await locator.getAttribute("data-dragging"), "");
    return { originX, originY, pointerID };
}

async function frequencyRatioAfterDrag(page, locator, originFrequencyHz, horizontalPixels) {
    await page.evaluate((frequencyHz) => {
        window.__ENHANCER_LITE_TEST__.emit("freqHzIn", frequencyHz);
        window.__ENHANCER_LITE_TEST__.clearSent();
    }, originFrequencyHz);
    await drag(page, locator, horizontalPixels, 0);
    const finalFrequencyHz = (await writesTo(page, "freqHzIn")).at(-1);
    assert.equal(typeof finalFrequencyHz, "number");
    return finalFrequencyHz / originFrequencyHz;
}

async function amountAfterDrag(page, locator, originAmount, verticalPixels) {
    await page.evaluate((amount) => {
        window.__ENHANCER_LITE_TEST__.emit("midAmountIn", amount);
        window.__ENHANCER_LITE_TEST__.clearSent();
    }, originAmount);
    await drag(page, locator, 0, verticalPixels);
    const finalAmount = (await writesTo(page, "midAmountIn")).at(-1);
    assert.equal(typeof finalAmount, "number");
    return finalAmount;
}

async function qAfterDrag(page, locator, originQ, verticalPixels, modifiers = []) {
    await page.evaluate((q) => {
        window.__ENHANCER_LITE_TEST__.emit("qIn", q);
        window.__ENHANCER_LITE_TEST__.clearSent();
    }, originQ);
    await drag(page, locator, 0, verticalPixels, modifiers);
    const finalQ = (await writesTo(page, "qIn")).at(-1);
    assert.equal(typeof finalQ, "number");
    return finalQ;
}

test("the Frequency readout drags one octave per 80 horizontal pixels", async () => {
    const page = await openEnhancerLite();

    try {
        const frequencyReadout = slider(page, "Frequency");
        assert.equal(await frequencyReadout.count(), 1);
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });

        await drag(page, frequencyReadout, 80, 0);
        const frequencyEvents = await writesTo(page, "freqHzIn");
        assert.ok(frequencyEvents.length > 1, JSON.stringify(frequencyEvents));
        assert.ok(Math.abs(frequencyEvents.at(-1) - 2000) < 1e-6);
        assert.equal(await frequencyReadout.getAttribute("data-dragging"), null);
        assert.equal(
            await frequencyReadout.evaluate((element) => element.getRootNode().activeElement === element),
            true,
        );
    } finally {
        await page.close();
    }
});

test("the Frequency readout keeps its fixed logarithmic law at every value and editor width", async () => {
    const expectedRatio = Math.sqrt(2);

    for (const { viewportWidth, editorWidth } of [
        { viewportWidth: 1000, editorWidth: 820 },
        { viewportWidth: 620, editorWidth: 560 },
    ]) {
        const page = await openEnhancerLite();
        try {
            await page.setViewportSize({ width: viewportWidth, height: 620 });
            await surface(page).evaluate((element, width) => { element.style.width = `${width}px`; }, editorWidth);
            const frequencyReadout = slider(page, "Frequency");
            const lowRatio = await frequencyRatioAfterDrag(page, frequencyReadout, 100, 40);
            const highRatio = await frequencyRatioAfterDrag(page, frequencyReadout, 8000, 40);

            assert.ok(Math.abs(lowRatio - expectedRatio) < 1e-6, String(lowRatio));
            assert.ok(Math.abs(highRatio - expectedRatio) < 1e-6, String(highRatio));
        } finally {
            await page.close();
        }
    }
});

test("the Amount readout gains half scale over 120 upward pixels", async () => {
    const page = await openEnhancerLite();

    try {
        const amountReadout = slider(page, "Amount");
        assert.equal(await amountReadout.count(), 1);
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.25);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });

        await drag(page, amountReadout, 0, -120);
        const amountEvents = await writesTo(page, "midAmountIn");
        assert.ok(amountEvents.length > 1, JSON.stringify(amountEvents));
        assert.ok(Math.abs(amountEvents.at(-1) - 0.75) < 1e-6);
    } finally {
        await page.close();
    }
});

test("the Q readout doubles Q over 40 upward pixels", async () => {
    const page = await openEnhancerLite();

    try {
        const qReadout = slider(page, "Q");
        assert.equal(await qReadout.count(), 1);
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });

        await drag(page, qReadout, 0, -40);
        const qEvents = await writesTo(page, "qIn");
        assert.ok(qEvents.length > 1, JSON.stringify(qEvents));
        assert.ok(Math.abs(qEvents.at(-1) - 1) < 1e-6);
    } finally {
        await page.close();
    }
});

test("Amount uses the same fixed vertical law in the readout and bell at every editor size", async () => {
    for (const { viewportWidth, viewportHeight, editorWidth, plotHeight } of [
        { viewportWidth: 1000, viewportHeight: 620, editorWidth: 820, plotHeight: 272 },
        { viewportWidth: 620, viewportHeight: 520, editorWidth: 560, plotHeight: 180 },
    ]) {
        const page = await openEnhancerLite();
        try {
            await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
            await surface(page).evaluate((element, width) => { element.style.width = `${width}px`; }, editorWidth);
            await responseGraph(page).evaluate((plot, height) => { plot.style.height = `${height}px`; }, plotHeight);
            const readoutAmount = await amountAfterDrag(page, slider(page, "Amount"), 0.25, -60);
            const bellAmount = await amountAfterDrag(page, slider(page, "Band handle"), 0.25, -60);

            assert.ok(Math.abs(readoutAmount - 0.5) < 1e-6, String(readoutAmount));
            assert.ok(Math.abs(bellAmount - 0.5) < 1e-6, String(bellAmount));
        } finally {
            await page.close();
        }
    }
});

test("Q uses the same fixed logarithmic law in the readout and Shift-drag bell", async () => {
    for (const { viewportWidth, viewportHeight, editorWidth, plotHeight } of [
        { viewportWidth: 1000, viewportHeight: 620, editorWidth: 820, plotHeight: 272 },
        { viewportWidth: 620, viewportHeight: 520, editorWidth: 560, plotHeight: 180 },
    ]) {
        const page = await openEnhancerLite();
        try {
            await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
            await surface(page).evaluate((element, width) => { element.style.width = `${width}px`; }, editorWidth);
            await responseGraph(page).evaluate((plot, height) => { plot.style.height = `${height}px`; }, plotHeight);
            const readoutQ = await qAfterDrag(page, slider(page, "Q"), 0.5, -40);
            const bellQ = await qAfterDrag(page, slider(page, "Band handle"), 0.5, -40, ["Shift"]);

            assert.ok(Math.abs(readoutQ - 1) < 1e-6, String(readoutQ));
            assert.ok(Math.abs(bellQ - 1) < 1e-6, String(bellQ));
        } finally {
            await page.close();
        }
    }
});

test("readout drag direction and endpoint clamps stay truthful", async () => {
    const page = await openEnhancerLite();

    try {
        const frequencyReadout = slider(page, "Frequency");
        const amountReadout = slider(page, "Amount");
        const qReadout = slider(page, "Q");

        assert.ok(Math.abs(
            await frequencyRatioAfterDrag(page, frequencyReadout, 30, -800) * 30 - 20,
        ) < 1e-6);
        assert.ok(Math.abs(
            await frequencyRatioAfterDrag(page, frequencyReadout, 15_000, 800) * 15_000 - 20_000,
        ) < 1e-6);
        assert.ok(Math.abs(await amountAfterDrag(page, amountReadout, 0.5, -24) - 0.6) < 1e-6);
        assert.ok(Math.abs(await amountAfterDrag(page, amountReadout, 0.5, 24) - 0.4) < 1e-6);
        assert.equal(await amountAfterDrag(page, amountReadout, 0.5, -720), 1);
        assert.equal(await amountAfterDrag(page, amountReadout, 0.5, 720), 0);
        assert.ok(Math.abs(await qAfterDrag(page, qReadout, 0.5, -40) - 1) < 1e-6);
        assert.ok(Math.abs(await qAfterDrag(page, qReadout, 0.5, 40) - 0.25) < 1e-6);
        assert.equal(await qAfterDrag(page, qReadout, 0.2, -400), 10);
        assert.equal(await qAfterDrag(page, qReadout, 5, 400), 0.1);
    } finally {
        await page.close();
    }
});

test("every shape shares frequency, amount, and Shift-drag Q with no slider fallback", async () => {
    const page = await openEnhancerLite();

    try {
        assert.equal(await surface(page).locator("input").count(), 0);
        const primaryHandle = slider(page, "Band handle");

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await drag(page, primaryHandle, 120, -82);
        const primaryGesture = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        const frequencyEvents = primaryGesture.filter(({ endpointID }) => endpointID === "freqHzIn");
        const amountEvents = primaryGesture.filter(({ endpointID }) => endpointID === "midAmountIn");
        assert.ok(frequencyEvents.length > 0, JSON.stringify(primaryGesture));
        assert.ok(amountEvents.length > 0, JSON.stringify(primaryGesture));
        assert.ok(frequencyEvents.at(-1).value > 130);
        assert.ok(amountEvents.at(-1).value > 0);
        assert.equal(primaryGesture.some(({ endpointID }) => endpointID === "qIn"), false);

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await drag(page, primaryHandle, 80, -65, ["Shift"]);
        const qGesture = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(qGesture.length > 0);
        assert.equal(qGesture.every(({ endpointID }) => endpointID === "qIn"), true);
        assert.ok(qGesture.at(-1).value > 0.71);
    } finally {
        await page.close();
    }
});

test("one graph drag over frequency, amount and Q is one gesture that one Undo restores", async () => {
    const page = await openEnhancerLite();
    try {
        const handle = slider(page, "Band handle");
        const readouts = ["Frequency", "Amount", "Q"];
        const before = {};
        for (const name of readouts) before[name] = await slider(page, name).getAttribute("aria-valuenow");
        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearAutomation());
        const bounds = await handle.boundingBox();
        assert.ok(bounds, "drag target must have browser geometry");
        const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 90, y - 60, { steps: 4 });
        await page.keyboard.down("Shift");
        await page.mouse.move(x + 90, y - 100, { steps: 4 });
        await page.mouse.up();
        await page.keyboard.up("Shift");
        for (const name of readouts)
            assert.notEqual(await slider(page, name).getAttribute("aria-valuenow"), before[name], `${name} moved during the drag`);
        const brackets = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages.filter(message => message.type !== "value"));
        assert.deepEqual(brackets, [
            { type: "begin", endpointID: "freqHzIn" }, { type: "begin", endpointID: "midAmountIn" }, { type: "begin", endpointID: "qIn" },
            { type: "end", endpointID: "freqHzIn" }, { type: "end", endpointID: "midAmountIn" }, { type: "end", endpointID: "qIn" },
        ], "the host sees one bracket per endpoint around the whole drag");

        const undo = page.getByRole("button", { name: "Undo", exact: true });
        await undo.click({ timeout: 2000 });
        for (const name of readouts)
            assert.equal(await slider(page, name).getAttribute("aria-valuenow"), before[name], `one Undo restores ${name}`);
        assert.equal(await undo.isDisabled(), true, "the drag made exactly one Undo entry");
    } finally {
        await page.close();
    }
});

test("Bell, Low, and High Amount handles follow real pointer travel in source and compiled UI", async () => {
    const results = [];
    for (const modulePath of [sourceView, compiledView]) {
        const page = await openEnhancerLite(modulePath);
        try {
            results.push({
                modulePath,
                shapes: [
                    await measurePrimaryHandleDrag(page, "bell", 1),
                    await measurePrimaryHandleDrag(page, "low", 0),
                    await measurePrimaryHandleDrag(page, "high", 2),
                ],
            });
        } finally {
            await page.close();
        }
    }

    assert.deepEqual(results[1].shapes, results[0].shapes);
});

test("losing pointer capture closes the bell gesture before later movement", async () => {
    const page = await openEnhancerLite();

    try {
        const primaryHandle = slider(page, "Band handle");
        const { originX, originY, pointerID } = await beginCapturedDrag(page, primaryHandle);
        await primaryHandle.evaluate((element, capturedPointerID) => {
            element.releasePointerCapture(capturedPointerID);
            element.dispatchEvent(new PointerEvent("lostpointercapture", {
                bubbles: true,
                isPrimary: true,
                pointerId: capturedPointerID,
            }));
        }, pointerID);
        assert.equal(await primaryHandle.getAttribute("data-dragging"), null);

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await page.mouse.move(originX + 25, originY - 25);
        await page.mouse.up();
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent), []);
    } finally {
        await page.close();
    }
});

test("readout pointer cancellation and capture loss close without stale writes", async () => {
    for (const terminalEvent of ["pointercancel", "lostpointercapture"]) {
        const page = await openEnhancerLite();
        try {
            const qReadout = slider(page, "Q");
            const { originX, originY, pointerID } = await beginCapturedDrag(page, qReadout);
            await qReadout.evaluate((element, detail) => {
                if (detail.terminalEvent === "lostpointercapture")
                    element.releasePointerCapture(detail.pointerID);
                element.dispatchEvent(new PointerEvent(detail.terminalEvent, {
                    bubbles: true,
                    isPrimary: true,
                    pointerId: detail.pointerID,
                }));
            }, { pointerID, terminalEvent });
            assert.equal(await qReadout.getAttribute("data-dragging"), null);

            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
            await page.mouse.move(originX, originY - 30);
            await page.mouse.up();
            assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent), []);
        } finally {
            await page.close();
        }
    }
});

test("disconnect closes an active readout gesture and releases capture", async () => {
    const page = await openEnhancerLite();

    try {
        const frequencyReadout = slider(page, "Frequency");
        const { originX, originY, pointerID } = await beginCapturedDrag(page, frequencyReadout);
        await page.mouse.move(originX + 20, originY, { steps: 2 });
        const captured = await frequencyReadout.evaluate((readout, capturedPointerID) => {
            document.querySelector("#mount").replaceChildren();
            return readout.hasPointerCapture(capturedPointerID);
        }, pointerID);
        await page.mouse.up();
        assert.equal(captured, false);
        const automation = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages);
        assert.deepEqual(automation.at(-1), { type: "end", endpointID: "freqHzIn" }, "the drag's host gesture closed");
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.at(-1)), {
            endpointID: "analyzerEnabledIn",
            value: 0,
        });
    } finally {
        await page.close();
    }
});

test("readouts ignore ineligible starts while selection stays suppressed and buttons work", async () => {
    const page = await openEnhancerLite();

    try {
        const amountReadout = slider(page, "Amount");
        const bounds = await amountReadout.boundingBox();
        assert.ok(bounds);
        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down({ button: "right" });
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 60);
        await page.mouse.up({ button: "right" });
        await amountReadout.dispatchEvent("pointerdown", {
            button: 0,
            bubbles: true,
            isPrimary: false,
            pointerId: 77,
            pointerType: "touch",
        });
        assert.equal(await amountReadout.getAttribute("data-dragging"), null);
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent), []);
        assert.equal(await amountReadout.evaluate((element) => getComputedStyle(element).userSelect), "none");

        await choice(page, "Character", "Tube").click();
        await choice(page, "Route", "M/S").click();
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.slice(-2)), [
            { endpointID: "curveIn", value: 0 },
            { endpointID: "modeIn", value: 1 },
        ]);
    } finally {
        await page.close();
    }
});

test("M/S exposes an independent draggable Side amount while sharing frequency and Q", async () => {
    const page = await openEnhancerLite();

    try {
        const sideHandle = slider(page, "Side band handle");
        assert.equal(await sideHandle.isHidden(), true);
        assert.match(await slider(page, "Amount").textContent(), /AMOUNT/);

        await choice(page, "Route", "M/S").click();
        assert.equal(await sideHandle.isVisible(), true);
        assert.match(await slider(page, "Mid Amount").textContent(), /MID/);

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await drag(page, sideHandle, 0, -72);
        const sent = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(sent.some(({ endpointID, value }) => endpointID === "sideAmountIn" && value > 0));
        assert.equal(sent.some(({ endpointID }) => endpointID === "midAmountIn"), false);
    } finally {
        await page.close();
    }
});

test("Mid and Side Amount readouts drag their own production endpoints independently", async () => {
    const page = await openEnhancerLite();

    try {
        const sideReadout = slider(page, "Side Amount");
        assert.equal(await sideReadout.isHidden(), true);
        await choice(page, "Route", "M/S").click();
        assert.equal(await sideReadout.isVisible(), true);
        const midReadout = slider(page, "Mid Amount");
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.2);
            window.__ENHANCER_LITE_TEST__.emit("sideAmountIn", 0.7);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });

        await drag(page, midReadout, 0, -24);
        const midEvents = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(midEvents.some(({ endpointID, value }) => (
            endpointID === "midAmountIn" && Math.abs(value - 0.3) < 1e-6
        )), JSON.stringify(midEvents));
        assert.equal(midEvents.some(({ endpointID }) => endpointID === "sideAmountIn"), false);

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await drag(page, sideReadout, 0, 24);
        const sideEvents = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(sideEvents.some(({ endpointID, value }) => (
            endpointID === "sideAmountIn" && Math.abs(value - 0.6) < 1e-6
        )), JSON.stringify(sideEvents));
        assert.equal(sideEvents.some(({ endpointID }) => endpointID === "midAmountIn"), false);
    } finally {
        await page.close();
    }
});

test("readouts expose truthful slider semantics and the bell's keyboard steps", async () => {
    const page = await openEnhancerLite();

    try {
        const frequencyReadout = slider(page, "Frequency");
        const amountReadout = slider(page, "Amount");
        const qReadout = slider(page, "Q");
        assert.deepEqual(await frequencyReadout.evaluate((element) => ({
            orientation: element.getAttribute("aria-orientation"),
            minimum: element.getAttribute("aria-valuemin"),
            maximum: element.getAttribute("aria-valuemax"),
        })), {
            orientation: "horizontal",
            minimum: "20",
            maximum: "20000",
        });

        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await frequencyReadout.focus();
        assert.equal(
            await frequencyReadout.evaluate((element) => element.getRootNode().activeElement === element),
            true,
        );
        await frequencyReadout.press("ArrowRight");
        let sent = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(Math.abs(sent.at(-1).value - 1000 * Math.pow(2, 1 / 12)) < 1e-6);
        assert.equal(sent.at(-1).endpointID, "freqHzIn");

        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await amountReadout.press("ArrowUp");
        sent = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.deepEqual(sent.at(-1), { endpointID: "midAmountIn", value: 0.51 });

        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await qReadout.press("ArrowUp");
        sent = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.equal(sent.at(-1).endpointID, "qIn");
        assert.ok(Math.abs(sent.at(-1).value - 0.5 * Math.pow(2, 1 / 6)) < 1e-6);
        assert.equal(await qReadout.getAttribute("aria-valuetext"), sent.at(-1).value.toFixed(2));

        await choice(page, "Route", "M/S").click();
        const sideReadout = slider(page, "Side Amount");
        assert.equal(await slider(page, "Mid Amount").count(), 1, "the primary amount is named Mid in M/S");
        assert.equal(await sideReadout.getAttribute("tabindex"), "0");
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("sideAmountIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await sideReadout.press("ArrowDown");
        assert.deepEqual(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.at(-1)),
            { endpointID: "sideAmountIn", value: 0.49 },
        );
        assert.equal(await sideReadout.getAttribute("aria-valuenow"), String(0.49 * 12));
        assert.equal(await sideReadout.getAttribute("aria-valuetext"), "+5.9 dB");
    } finally {
        await page.close();
    }
});

test("Enter or a double-click on a readout types an exact value as one Undo entry", async () => {
    const page = await openEnhancerLite();
    try {
        const frequency = slider(page, "Frequency");
        const undo = page.getByRole("button", { name: "Undo", exact: true });
        await frequency.press("Enter");
        const field = page.getByRole("textbox", { name: "Frequency value" });
        assert.equal(await field.inputValue(), "130 Hz", "the field opens on the shown value");
        await field.fill("2.5k");
        await field.press("Enter");
        await frequency.filter({ hasText: "2.50 kHz" }).waitFor();
        assert.deepEqual(await writesTo(page, "freqHzIn"), [2500]);
        assert.equal(await frequency.evaluate((element) => element.getRootNode().activeElement === element), true, "Enter returns focus to the readout");

        await frequency.press("Enter");
        await field.fill("loud");
        await field.press("Enter");
        assert.equal(await page.getByRole("alert").textContent(), "Type a frequency such as 440 or 2.5k.");
        await field.press("Escape");
        assert.equal(await field.count(), 0);
        assert.deepEqual(await writesTo(page, "freqHzIn"), [2500], "a rejected or cancelled entry writes nothing");

        // Amount is typed in the dB it shows; an absolute value back to zero is written.
        const amount = slider(page, "Amount");
        await amount.press("ArrowUp");
        await amount.dblclick();
        const amountField = page.getByRole("textbox", { name: "Amount value" });
        await amountField.fill("0 dB");
        await amountField.press("Enter");
        assert.equal(await amount.getAttribute("aria-valuenow"), "0");
        assert.deepEqual(await writesTo(page, "midAmountIn"), [0.01, 0]);

        await undo.click();
        assert.equal(await amount.getAttribute("aria-valuenow"), "0.12", "the typed value is one Undo entry");
        await undo.click();
        await undo.click();
        assert.equal(await frequency.getAttribute("aria-valuenow"), "130");
        assert.equal(await undo.isDisabled(), true);
    } finally {
        await page.close();
    }
});

test("the plotted bell narrows as Q rises and tracks the actual 12 dB amount law", async () => {
    const page = await openEnhancerLite();

    try {
        const primaryPath = page.locator("[data-response='mid']");
        assert.deepEqual(
            await page.locator("[data-gain-db]").evaluateAll((rows) => (
                rows.map((row) => Number(row.getAttribute("data-gain-db")))
            )),
            [12, 9, 6, 3, 0],
        );
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 1);
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.1);
        });
        const widePath = await primaryPath.getAttribute("d");
        const widePointsAboveSixDb = [...widePath.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
            .filter((match) => Number(match[2]) < 131).length;

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.emit("qIn", 10));
        const narrowPath = await primaryPath.getAttribute("d");
        const narrowPointsAboveSixDb = [...narrowPath.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
            .filter((match) => Number(match[2]) < 131).length;

        assert.notEqual(narrowPath, widePath);
        assert.ok(widePointsAboveSixDb > narrowPointsAboveSixDb);
        assert.equal(await slider(page, "Amount").getAttribute("aria-valuetext"), "+12.0 dB");
        assert.equal(await slider(page, "Band handle").getAttribute("cy"), "18.00");
    } finally {
        await page.close();
    }
});

test("Low and High draw measured shelf responses with a directly manipulated Amount handle", async () => {
    const page = await openEnhancerLite();

    try {
        const primaryPath = page.locator("[data-response='mid']");
        const guide = page.locator("[data-guide='mid']");
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 1);
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.7);
        });
        const bellPath = await primaryPath.getAttribute("d");
        assert.equal(await page.locator("[data-shelf-overflow='high']").isHidden(), true);
        assert.equal(await guide.count(), 0, "the bell's handle sits on its curve and needs no guide");

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await choice(page, "Shape", "Low").click();
        const lowPath = await primaryPath.getAttribute("d");
        assert.notEqual(lowPath, bellPath);
        assert.equal(await choice(page, "Shape", "Low").getAttribute("aria-pressed"), "true");
        assert.equal(await page.locator("[data-shelf-overflow='high']").isVisible(), true);
        assert.equal(await page.locator("[data-shelf-overflow='low']").isVisible(), true);
        assert.equal(await guide.count(), 1, "a shelf draws the guide from the handle to its curve");
        assert.match(await guide.getAttribute("d"), /^M [\d.]+ 18\.00 V [\d.]+$/);
        assert.equal(await slider(page, "Band handle").getAttribute("cy"), "18.00");

        await choice(page, "Shape", "High").click();
        const highPath = await primaryPath.getAttribute("d");
        assert.notEqual(highPath, lowPath);
        assert.equal(await choice(page, "Shape", "High").getAttribute("aria-pressed"), "true");
        assert.deepEqual(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent),
            [
                { endpointID: "shapeIn", value: 0 },
                { endpointID: "shapeIn", value: 2 },
            ],
        );

        const points = (pathValue) => [...pathValue.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
            .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
        const lowPoints = points(lowPath);
        const highPoints = points(highPath);
        assert.ok(lowPoints[0].y < lowPoints.at(-1).y, JSON.stringify(lowPoints.slice(0, 1)));
        assert.ok(highPoints[0].y > highPoints.at(-1).y, JSON.stringify(highPoints.slice(-1)));

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.emit("qIn", 10));
        const resonantHighPath = await primaryPath.getAttribute("d");
        assert.notEqual(resonantHighPath, highPath);
        const resonantY = points(resonantHighPath).map(({ y }) => y);
        assert.ok(Math.min(...resonantY) <= 21);
        assert.ok(Math.max(...resonantY) >= 241);
    } finally {
        await page.close();
    }
});

test("input and output spectra share the bell's frequency grid and aligned dB rows", async () => {
    const page = await openEnhancerLite();

    try {
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 1);
            const inputMagnitudes = new Array(2048).fill(0);
            const outputMagnitudes = new Array(2048).fill(0);
            const bin = Math.round(1000 * 4096 / 48_000);
            inputMagnitudes[bin] = 0.25;
            outputMagnitudes[bin] = 0.5;
            window.__ENHANCER_LITE_TEST__.emitEndpoint("inputSpectrum", {
                sampleRateHz: 48_000,
                magnitudes: inputMagnitudes,
            });
            window.__ENHANCER_LITE_TEST__.emitEndpoint("outputSpectrum", {
                event: {
                    sampleRateHz: 48_000,
                    magnitudes: outputMagnitudes,
                },
            });
        });

        await page.locator("[data-spectrum-peak='input']").filter({ hasText: "-12.0 dB" }).waitFor();
        await page.locator("[data-spectrum-peak='output']").filter({ hasText: "-6.0 dB" }).waitFor();
        const inputPath = await page.locator("[data-spectrum-role='input']").getAttribute("d");
        const outputPath = await page.locator("[data-spectrum-role='output']").getAttribute("d");
        assert.ok(inputPath.length > 1000);
        assert.ok(outputPath.length > 1000);
        assert.notEqual(inputPath, outputPath);

        const parsePoints = (pathValue) => [...pathValue.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
            .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
        const inputPeak = parsePoints(inputPath).reduce((peak, point) => (
            point.y < peak.y ? point : peak
        ));
        const outputPeak = parsePoints(outputPath).reduce((peak, point) => (
            point.y < peak.y ? point : peak
        ));
        const handleX = Number(await slider(page, "Band handle").getAttribute("cx"));
        const oneKhzTickX = Number(await page.locator("[data-frequency-hz='1000']").getAttribute("x"));
        assert.equal(handleX, oneKhzTickX);
        assert.ok(Math.abs(inputPeak.x - handleX) <= 5, `${inputPeak.x} vs ${handleX}`);
        assert.ok(Math.abs(outputPeak.x - handleX) <= 5, `${outputPeak.x} vs ${handleX}`);
        assert.ok(outputPeak.y < inputPeak.y);

        const gainRowY = await page.locator("[data-gain-db='6']").getAttribute("y");
        const levelRowY = await page.locator("[data-level-dbfs='-36']").getAttribute("y");
        assert.equal(gainRowY, levelRowY);
        if (process.env.ENHANCER_LITE_SCREENSHOT_PATH) {
            await choice(page, "Route", "M/S").click();
            await page.evaluate(() => {
                window.__ENHANCER_LITE_TEST__.emit("sideAmountIn", 0.55);
                window.scrollTo(0, 0);
            });
            await page.waitForTimeout(100);
            await page.screenshot({
                path: process.env.ENHANCER_LITE_SCREENSHOT_PATH,
                fullPage: true,
            });
        }
    } finally {
        await page.close();
    }
});

test("a plotted frequency handle writes the exact shared-axis tick under the pointer", async () => {
    for (const editorWidth of [393, 620, 820]) {
        const page = await openEnhancerLite();
        try {
            await page.setViewportSize({ width: Math.max(500, editorWidth + 40), height: 620 });
            await surface(page).evaluate((element, width) => { element.style.width = `${width}px`; }, editorWidth);
            await page.evaluate(() => {
                window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 200);
                window.__ENHANCER_LITE_TEST__.clearSent();
            });

            // 1 kHz is labelled at every width.
            const handle = slider(page, "Band handle");
            const targetTick = page.locator("[data-frequency-hz='1000']");
            const [plotBounds, handleBounds, targetTickX] = await Promise.all([
                responseGraph(page).boundingBox(),
                handle.boundingBox(),
                targetTick.getAttribute("x").then(Number),
            ]);
            assert.ok(plotBounds && handleBounds);
            const targetClientX = plotBounds.x + targetTickX / 760 * plotBounds.width;
            const handleClientY = handleBounds.y + handleBounds.height / 2;
            await page.mouse.move(handleBounds.x + handleBounds.width / 2, handleClientY);
            await page.mouse.down();
            await page.mouse.move(targetClientX, handleClientY, { steps: 5 });
            await page.mouse.up();

            const frequencyEvents = await writesTo(page, "freqHzIn");
            assert.ok(frequencyEvents.length > 0, `${editorWidth}px emitted no frequency write`);
            assert.ok(
                Math.abs(frequencyEvents.at(-1) - 1_000) < 0.125,
                `${editorWidth}px wrote ${frequencyEvents.at(-1)} Hz at the 1 kHz tick`,
            );
            assert.equal(await handle.getAttribute("cx"), await targetTick.getAttribute("x"));
        } finally {
            await page.close();
        }
    }
});

test("the shared axis reduces label density responsively without moving retained ticks", async () => {
    const page = await openEnhancerLite();
    try {
        let oneKhzX;
        for (const { editorWidth, expectedLabels } of [
            { editorWidth: 393, expectedLabels: 5 },
            { editorWidth: 620, expectedLabels: 7 },
            { editorWidth: 820, expectedLabels: 10 },
        ]) {
            await page.setViewportSize({ width: Math.max(500, editorWidth + 40), height: 620 });
            await surface(page).evaluate((element, width) => { element.style.width = `${width}px`; }, editorWidth);
            const ticks = page.locator("[data-frequency-hz]");
            await page.waitForFunction((count) => (
                document.querySelector("builder-kit-state-view").shadowRoot.querySelectorAll("[data-frequency-hz]").length === count
            ), expectedLabels);

            assert.equal(await ticks.count(), expectedLabels);
            const labels = await ticks.allTextContents();
            assert.equal(labels.some((label) => label.endsWith(" Hz")), true);
            assert.equal(labels.some((label) => label.endsWith(" kHz")), true);
            const nextOneKhzX = Number(await page.locator("[data-frequency-hz='1000']").getAttribute("x"));
            oneKhzX ??= nextOneKhzX;
            assert.equal(nextOneKhzX, oneKhzX);
        }
    } finally {
        await page.close();
    }
});

test("the editor enables live analysis only while its view is connected", async () => {
    const page = await openEnhancerLite();

    try {
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent[0]), {
            endpointID: "analyzerEnabledIn",
            value: 1,
        });
        assert.equal(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.endpointListenerCount("inputSpectrum")),
            1,
        );
        assert.equal(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.endpointListenerCount("outputSpectrum")),
            1,
        );

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.disconnect());
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.at(-1)), {
            endpointID: "analyzerEnabledIn",
            value: 0,
        });
        assert.equal(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.endpointListenerCount("inputSpectrum")),
            0,
        );
        assert.equal(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.endpointListenerCount("outputSpectrum")),
            0,
        );
    } finally {
        await page.close();
    }
});

test("the source and compiled views name the product in plain text and load no images", async () => {
    const { name } = JSON.parse(await readFile(path.join(repoRoot, "fx/enhancer_lite/EnhancerLite.cmajorpatch"), "utf8"));
    for (const modulePath of [sourceView, compiledView]) {
        const page = await openEnhancerLite(modulePath);
        try {
            assert.equal(await page.getByRole("heading", { level: 1 }).textContent(), name);
            assert.equal(await page.locator("img").count(), 0);
        } finally {
            await page.close();
        }
    }
});

test("the surface shows both spectra, one response handle and the four draggable readouts", async () => {
    const page = await openEnhancerLite();
    try {
        assert.equal(await page.locator("[data-spectrum-role='input']").count(), 1);
        assert.equal(await page.locator("[data-spectrum-role='output']").count(), 1);
        assert.equal(await slider(page, "Band handle").count(), 1);
        await choice(page, "Route", "M/S").click();
        const readouts = [];
        for (const name of ["Frequency", "Mid Amount", "Side Amount", "Q"]) {
            const readout = slider(page, name);
            readouts.push([name, await readout.getAttribute("aria-orientation"), (await readout.textContent()).at(0)]);
        }
        assert.deepEqual(readouts, [
            ["Frequency", "horizontal", "↔"], ["Mid Amount", "vertical", "↕"], ["Side Amount", "vertical", "↕"], ["Q", "vertical", "↕"],
        ]);
    } finally {
        await page.close();
    }
});

test("host-restored shape, character, and intensity select the truthful segment", async () => {
    const page = await openEnhancerLite();

    try {
        assert.equal(await choice(page, "Character", "Solid").getAttribute("aria-pressed"), "true");
        assert.equal(await choice(page, "Intensity", "Subtle").getAttribute("aria-pressed"), "true");
        assert.equal(await choice(page, "Shape", "Bell").getAttribute("aria-pressed"), "true");
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("curveIn", 0);
            window.__ENHANCER_LITE_TEST__.emit("saturationModeIn", 1);
            window.__ENHANCER_LITE_TEST__.emit("shapeIn", 2);
        });
        assert.equal(await choice(page, "Character", "Tube").getAttribute("aria-pressed"), "true");
        assert.equal(await choice(page, "Character", "Solid").getAttribute("aria-pressed"), "false");
        assert.equal(await choice(page, "Intensity", "Medium").getAttribute("aria-pressed"), "true");
        assert.equal(await choice(page, "Intensity", "Subtle").getAttribute("aria-pressed"), "false");
        assert.equal(await choice(page, "Shape", "High").getAttribute("aria-pressed"), "true");
        assert.equal(await choice(page, "Shape", "Bell").getAttribute("aria-pressed"), "false");
    } finally {
        await page.close();
    }
});

test("the compiled VST view preserves the same gesture surface and eight sound controls", async () => {
    const page = await openEnhancerLite(compiledView);

    try {
        assert.equal(await responseGraph(page).count(), 1);
        assert.equal(await surface(page).locator("input").count(), 0);
        assert.deepEqual(await surface(page).evaluate((main) => {
            const root = main.getRootNode();
            return {
                frequencyCursor: getComputedStyle(root.querySelector("[role=slider][aria-label=Frequency]")).cursor,
                qCursor: getComputedStyle(root.querySelector("[role=slider][aria-label=Q]")).cursor,
            };
        }), {
            frequencyCursor: "ew-resize",
            qCursor: "ns-resize",
        });
        await choice(page, "Shape", "Low").click();
        await choice(page, "Intensity", "Medium").click();
        await choice(page, "Route", "M/S").click();
        assert.equal(await slider(page, "Side band handle").isVisible(), true);
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.slice(-3)), [
            { endpointID: "shapeIn", value: 0 },
            { endpointID: "saturationModeIn", value: 1 },
            { endpointID: "modeIn", value: 1 },
        ]);

        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.2);
            window.__ENHANCER_LITE_TEST__.emit("sideAmountIn", 0.7);
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await drag(page, slider(page, "Frequency"), 80, 0);
        await drag(page, slider(page, "Mid Amount"), 0, -24);
        await drag(page, slider(page, "Side Amount"), 0, 24);
        await drag(page, slider(page, "Q"), 0, -40);
        const finalValues = Object.fromEntries(
            (await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent))
                .map(({ endpointID, value }) => [endpointID, value]),
        );
        assert.ok(Math.abs(finalValues.freqHzIn - 2000) < 1e-6);
        assert.ok(Math.abs(finalValues.midAmountIn - 0.3) < 1e-6);
        assert.ok(Math.abs(finalValues.sideAmountIn - 0.6) < 1e-6);
        assert.ok(Math.abs(finalValues.qIn - 1) < 1e-6);
    } finally {
        await page.close();
    }
});

test("the header puts presets, snapshots and Undo above the Lite surface in source and compiled views", async () => {
    for (const modulePath of [sourceView, compiledView]) {
        const page = await openEnhancerLite(modulePath);
        try {
            const layout = await page.getByRole("banner").evaluate((header) => {
                const panel = header.getRootNode().querySelector("main");
                const headerBounds = header.getBoundingClientRect();
                const panelBounds = panel.getBoundingClientRect();
                return { headerHeight: headerBounds.height, panelBelowHeader: panelBounds.top >= headerBounds.bottom, total: panelBounds.bottom - headerBounds.top };
            });
            assert.equal(layout.headerHeight, 40, modulePath);
            assert.equal(layout.panelBelowHeader, true, modulePath);
            assert.equal(layout.total, 560, `${modulePath}: header and panel fill the 560 pixel frame`);
            const preset = page.getByRole("combobox", { name: "Preset" });
            assert.equal(await preset.inputValue(), "");
            assert.deepEqual(await preset.locator("optgroup[label='Factory'] option").allTextContents(),
                ["Sub Weight", "Vocal Presence", "Air Lift", "Wide Shimmer"]);
            assert.equal(await page.getByRole("group", { name: "Snapshots" }).getByRole("button", { name: /^Snapshot [A-G], empty$/ }).count(), 7);
            assert.equal(await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(), true);

            // The surface underneath shows the Stereo readouts, switches the
            // analyzer on first and writes nothing else at mount.
            for (const name of ["Frequency", "Amount", "Q"])
                assert.equal(await slider(page, name).isVisible(), true, `${name} readout`);
            assert.equal(await slider(page, "Side Amount").isHidden(), true);
            assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent), [
                { endpointID: "analyzerEnabledIn", value: 1 },
            ]);
        } finally {
            await page.close();
        }
    }
});

test("a factory preset recalls the complete Lite sound as one Undo entry", async () => {
    const page = await openEnhancerLite();
    try {
        const preset = page.getByRole("combobox", { name: "Preset" });
        const frequency = slider(page, "Frequency");
        const shapeSelected = (name) => page.getByRole("group", { name: "Shape" }).getByRole("button", { name, exact: true, pressed: true });
        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await preset.selectOption("vocal-presence");
        await frequency.filter({ hasText: "3.20 kHz" }).waitFor();

        const sent = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.deepEqual(Object.fromEntries(sent.map(({ endpointID, value }) => [endpointID, value])),
            { freqHzIn: 3200, qIn: 1.1, midAmountIn: 0.3 }, "only the values that differ are written");
        assert.equal(await slider(page, "Q").getAttribute("aria-valuetext"), "1.10");
        assert.equal(await slider(page, "Amount").getAttribute("aria-valuetext"), "+3.6 dB");
        assert.equal(await preset.inputValue(), "vocal-presence");
        assert.equal(await page.getByText("Modified").count(), 0);
        const stored = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.storedWrites.map(({ key }) => key));
        assert.deepEqual(stored, ["activePreset"], "the active preset is project state; the factory list is not stored");

        // Editing the surface marks the preset modified; Revert restores it.
        await choice(page, "Shape", "High").click();
        await page.getByText("Modified").waitFor();
        await page.getByRole("button", { name: "Revert", exact: true }).click();
        await shapeSelected("Bell").waitFor();
        await page.getByText("Modified").waitFor({ state: "detached" });

        // Undo walks back the revert, the shape edit, then the whole recall.
        const undo = page.getByRole("button", { name: "Undo", exact: true });
        await undo.click();
        await shapeSelected("High").waitFor();
        await undo.click();
        await shapeSelected("Bell").waitFor();
        await undo.click();
        await frequency.filter({ hasText: "130 Hz" }).waitFor();
        assert.equal(await preset.inputValue(), "", "Undo also restores the previous active preset");
        assert.equal(await undo.isDisabled(), true);
    } finally {
        await page.close();
    }
});

test("user presets live in the user's files for this plugin identity only", async () => {
    const original = JSON.parse(await readFile(path.join(repoRoot, "fx/enhancer_lite/EnhancerLite.cmajorpatch"), "utf8"));
    const manifest = { ...original, ID: "com.example.enhance" };
    let files = {};
    let page = await openEnhancerLite(sourceView, { manifest, userFileFixture: files });
    try {
        await choice(page, "Shape", "High").click();
        await page.getByRole("button", { name: "Save as new", exact: true }).click();
        const name = page.getByRole("textbox", { name: "Preset name" });
        await name.fill("Bright");
        await name.press("Enter");
        const libraryPath = await (await page.waitForFunction(() => [...window.__PRESET_FILES_TEST__.files.keys()]
            .find((key) => key.endsWith("/presetLibrary.json")))).jsonValue();
        files = await page.evaluate(() => Object.fromEntries(window.__PRESET_FILES_TEST__.files));
        const library = JSON.parse(files[libraryPath]);
        assert.equal(library.version, 1);
        assert.deepEqual(library.presets.map(({ name }) => name), ["Bright"]);
        assert.deepEqual(library.presets[0].values, { ...initialPresetValues, shape: 2 });
        assert.equal(await page.getByRole("combobox", { name: "Preset" }).locator("option:checked").textContent(), "Bright");
        assert.equal(await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(), false, "Undo still holds the shape edit");
        await page.getByRole("button", { name: "Undo", exact: true }).click();
        assert.deepEqual((await page.evaluate(() => window.__PRESET_FILES_TEST__.calls)).filter(({ operation }) => operation === "delete"), []);
        assert.equal(JSON.parse(await page.evaluate((key) => window.__PRESET_FILES_TEST__.files.get(key), libraryPath)).presets.length, 1,
            "saving a preset is not undone");
    } finally { await page.close(); }

    page = await openEnhancerLite(sourceView, { manifest, userFileFixture: files });
    try {
        const user = page.getByRole("combobox", { name: "Preset" }).locator("optgroup[label='User'] option");
        await user.first().waitFor({ state: "attached" });
        assert.deepEqual(await user.allTextContents(), ["Bright"], "another project opens with the same user presets");
    } finally { await page.close(); }

    page = await openEnhancerLite(sourceView, { manifest: { ...manifest, ID: "com.example.other" }, userFileFixture: files });
    try {
        await page.waitForFunction(() => window.__PRESET_FILES_TEST__.calls.some(({ operation }) => operation === "list"));
        assert.equal(await page.getByRole("combobox", { name: "Preset" }).locator("optgroup[label='User']").count(), 0,
            "a plugin with another manifest ID keeps its own presets");
    } finally { await page.close(); }
});

test("A-G snapshots keep each slot's tweaks and select as one Undo entry", async () => {
    const page = await openEnhancerLite();
    try {
        const snapshots = page.getByRole("group", { name: "Snapshots" });
        const slot = (id) => snapshots.getByRole("button", { name: new RegExp(`^Snapshot ${id}(, empty)?$`) });
        const frequency = slider(page, "Frequency");
        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000));
        await frequency.filter({ hasText: "1.00 kHz" }).waitFor();

        // An empty slot captures the current sound.
        await slot("A").click();
        await snapshots.getByRole("button", { name: "Snapshot A", exact: true, pressed: true }).waitFor();
        await slot("B").click();
        await snapshots.getByRole("button", { name: "Snapshot B", exact: true, pressed: true }).waitFor();

        // Tweaks made while B is selected stay with B when A is selected.
        await choice(page, "Shape", "High").click();
        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 5000));
        await frequency.filter({ hasText: "5.00 kHz" }).waitFor();
        await slot("A").click();
        await frequency.filter({ hasText: "1.00 kHz" }).waitFor();
        assert.equal(await choice(page, "Shape", "Bell").getAttribute("aria-pressed"), "true");
        await slot("B").click();
        await frequency.filter({ hasText: "5.00 kHz" }).waitFor();
        assert.equal(await choice(page, "Shape", "High").getAttribute("aria-pressed"), "true");

        // Undo restores the previous slot's sound and selection.
        await page.getByRole("button", { name: "Undo", exact: true }).click();
        await frequency.filter({ hasText: "1.00 kHz" }).waitFor();
        await snapshots.getByRole("button", { name: "Snapshot A", exact: true, pressed: true }).waitFor();

        await page.getByRole("button", { name: "Clear snapshot A" }).click();
        await slot("A").and(page.getByRole("button", { name: "Snapshot A, empty", pressed: false })).waitFor();
        const stored = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.storedWrites.map(({ key }) => key));
        assert.deepEqual([...new Set(stored)].sort(), ["activeSnapshot", "snapshotSlots"]);
    } finally {
        await page.close();
    }
});

for (const modulePath of [sourceView, compiledView]) {
    test(`all eight controls send balanced host automation gestures: ${modulePath}`, async () => {
        const page = await openEnhancerLite(modulePath);
        try {
            for (const [group, name] of [["Route", "M/S"], ["Character", "Tube"], ["Intensity", "Medium"], ["Shape", "High"]])
                await choice(page, group, name).click();
            await choice(page, "Shape", "Bell").click();
            for (const [name, key] of [["Frequency", "ArrowRight"], ["Q", "ArrowUp"], ["Mid Amount", "ArrowUp"], ["Side Amount", "ArrowUp"]])
                await slider(page, name).press(key);
            const messages = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages);
            assert.deepEqual([...new Set(messages.map(({ endpointID }) => endpointID))].sort(), Object.keys(initialValues).sort());
            for (let i = 0; i < messages.length; i += 3) {
                const [begin, value, end] = messages.slice(i, i + 3);
                assert.deepEqual(begin, { type: "begin", endpointID: value.endpointID });
                assert.equal(value.type, "value");
                assert.deepEqual(end, { type: "end", endpointID: value.endpointID });
            }
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearAutomation());
            await choice(page, "Shape", "Bell").click();
            assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages), [], "an unchanged selection writes no automation");
        } finally {
            await page.close();
        }
    });

    test(`a multi-parameter drag keeps host gestures open through modifier changes: ${modulePath}`, async () => {
        const page = await openEnhancerLite(modulePath);
        try {
            const handle = slider(page, "Band handle");
            const bounds = await handle.boundingBox();
            assert.ok(bounds);
            const x = bounds.x + bounds.width / 2;
            const y = bounds.y + bounds.height / 2;
            await page.mouse.move(x, y);
            await page.mouse.down();
            assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages), [], "pointer down alone changes no sound");
            await page.mouse.move(x + 25, y - 15, { steps: 4 });
            await page.keyboard.down("Shift");
            await page.mouse.move(x + 25, y - 30, { steps: 4 });
            await page.keyboard.up("Shift");
            const pending = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages);
            assert.equal(pending.filter(({ type }) => type === "end").length, 0);
            assert.deepEqual(pending.filter(({ type }) => type === "begin").map(({ endpointID }) => endpointID).sort(), ["freqHzIn", "midAmountIn", "qIn"]);
            assert.ok(pending.filter(({ type }) => type === "value").length > 3);
            await page.mouse.up();
            const messages = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages);
            for (const endpointID of ["freqHzIn", "midAmountIn", "qIn"]) {
                const endpointMessages = messages.filter((message) => message.endpointID === endpointID);
                assert.equal(endpointMessages[0].type, "begin");
                assert.equal(endpointMessages.at(-1).type, "end");
                assert.equal(endpointMessages.filter(({ type }) => type === "end").length, 1);
            }
        } finally {
            await page.close();
        }
    });

    test(`host playback updates all controls without feedback and survives editor reopen: ${modulePath}`, async () => {
        const page = await openEnhancerLite(modulePath);
        try {
            const playback = { freqHzIn: 440, qIn: 2.5, modeIn: 1, midAmountIn: 0.6, sideAmountIn: 0.35, curveIn: 0, saturationModeIn: 1, shapeIn: 2 };
            await page.evaluate((values) => {
                window.__ENHANCER_LITE_TEST__.clearSent();
                for (const [endpointID, value] of Object.entries(values))
                    window.__ENHANCER_LITE_TEST__.emit(endpointID, value);
            }, playback);
            for (const reopen of [false, true]) {
                if (reopen) await page.evaluate(() => window.__ENHANCER_LITE_TEST__.reopen());
                await slider(page, "Side Amount").waitFor();
                for (const [group, name] of [["Route", "M/S"], ["Character", "Tube"], ["Intensity", "Medium"], ["Shape", "High"]])
                    assert.equal(await choice(page, group, name).getAttribute("aria-pressed"), "true");
                assert.equal(await slider(page, "Frequency").getAttribute("aria-valuenow"), "440");
                assert.equal(await slider(page, "Q").getAttribute("aria-valuenow"), "2.5");
                assert.ok(Math.abs(Number(await slider(page, "Mid Amount").getAttribute("aria-valuenow")) - 7.2) < 1e-9);
                assert.ok(Math.abs(Number(await slider(page, "Side Amount").getAttribute("aria-valuenow")) - 4.2) < 1e-9);
            }
            assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages), []);
            assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.filter(({ endpointID }) => endpointID !== "analyzerEnabledIn")), []);
        } finally {
            await page.close();
        }
    });
}

// Browsers bubble pointercancel and lostpointercapture, so the stand-ins here do too.
for (const termination of ["pointercancel", "lostpointercapture", "disconnect"]) {
    test(`readout automation closes exactly once on ${termination}`, async () => {
        const page = await openEnhancerLite();
        try {
            const readout = slider(page, "Frequency");
            const bounds = await readout.boundingBox();
            assert.ok(bounds);
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.down();
            await page.mouse.move(bounds.x + bounds.width / 2 + 20, bounds.y + bounds.height / 2, { steps: 3 });
            const pending = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages);
            assert.equal(pending.filter(({ type }) => type === "begin").length, 1);
            assert.equal(pending.filter(({ type }) => type === "end").length, 0);
            if (termination === "disconnect") {
                await page.evaluate(() => window.__ENHANCER_LITE_TEST__.disconnect());
            } else {
                await readout.evaluate((element, type) => element.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true })), termination);
            }
            const closed = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages);
            assert.deepEqual(closed.at(-1), { type: "end", endpointID: "freqHzIn" }, `${termination} itself closes the gesture`);
            await page.mouse.up();
            const completed = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages);
            assert.equal(completed.filter(({ type }) => type === "end").length, 1);
            assert.ok(completed.every(({ endpointID }) => endpointID === "freqHzIn"));
        } finally {
            await page.close();
        }
    });
}

for (const modulePath of [sourceView, compiledView]) {
    for (const [surfaceName, name] of [["readout", "Frequency"], ["graph", "Band handle"]]) {
        for (const termination of ["pointerup", "pointercancel"]) {
            test(`keyboard edits share the ${surfaceName} drag gesture until ${termination}: ${modulePath}`, async () => {
                const page = await openEnhancerLite(modulePath);
                try {
                    const target = slider(page, name);
                    const { originX, originY, pointerID } = await beginCapturedDrag(page, target);
                    const frequencyMessages = () => page.evaluate(() => window.__ENHANCER_LITE_TEST__.automationMessages.filter(({ endpointID }) => endpointID === "freqHzIn"));
                    const assertTouchOpen = (messages) => {
                        assert.deepEqual(messages[0], { type: "begin", endpointID: "freqHzIn" });
                        assert.ok(messages.length > 1);
                        assert.ok(messages.slice(1).every(({ type }) => type === "value"), "one host touch must stay open without nested begins or early ends");
                    };

                    await page.mouse.move(originX + 20, originY, { steps: 2 });
                    const beforeKey = await frequencyMessages();
                    assertTouchOpen(beforeKey);
                    // A second keydown while held is how the browser delivers repeat.
                    await page.keyboard.down("ArrowRight");
                    await page.keyboard.down("ArrowRight");
                    const afterKey = await frequencyMessages();
                    assertTouchOpen(afterKey);
                    assert.equal(afterKey.length, beforeKey.length + 2, "both keyboard edits still reach the host");
                    assert.ok(afterKey.at(-1).value > beforeKey.at(-1).value);
                    assert.equal(await target.getAttribute("data-dragging"), "");

                    await page.mouse.move(originX + 35, originY, { steps: 2 });
                    const continued = await frequencyMessages();
                    assertTouchOpen(continued);
                    assert.ok(continued.length > afterKey.length, "pointer motion continues to write under the original touch");
                    if (termination === "pointercancel")
                        await target.evaluate((element, id) => element.dispatchEvent(new PointerEvent("pointercancel", { pointerId: id, bubbles: true })), pointerID);
                    await page.mouse.up();
                    await page.keyboard.up("ArrowRight");
                    const complete = await frequencyMessages();
                    assert.deepEqual(complete.slice(0, -1), continued);
                    assert.deepEqual(complete.at(-1), { type: "end", endpointID: "freqHzIn" });
                    assert.equal(await target.getAttribute("data-dragging"), null);

                    await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearAutomation());
                    await page.keyboard.press("ArrowRight");
                    assert.deepEqual((await frequencyMessages()).map(({ type }) => type), ["begin", "value", "end"], "the next standalone key owns a fresh gesture");
                } finally {
                    await page.keyboard.up("ArrowRight");
                    await page.mouse.up();
                    await page.close();
                }
            });
        }
    }
}
