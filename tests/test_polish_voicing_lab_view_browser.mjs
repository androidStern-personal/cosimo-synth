import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { startStaticRepoServer } from "./helpers/desktop_harness_browser.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
let server;
let browser;

function parseParameters(source) {
    const parameters = [];
    const pattern = /^\s*input\s+value\s+(bool|float32)\s+([A-Za-z_][A-Za-z0-9_]*)\s+\[\[(.*?)\]\];/gm;
    let match;

    while ((match = pattern.exec(source)) !== null) {
        const [, type, endpointID, annotationText] = match;
        const readString = key => annotationText.match(new RegExp(`\\b${key}\\s*:\\s*"([^"]*)"`))?.[1];
        const readNumber = key => {
            const raw = annotationText.match(new RegExp(`\\b${key}\\s*:\\s*([^,\\]]+)`))?.[1]?.trim();
            if (raw === "true") return true;
            if (raw === "false") return false;
            return raw === undefined ? undefined : Number(raw.replace(/f$/, ""));
        };
        parameters.push({
            endpointID,
            purpose: "parameter",
            annotation: {
                name: readString("name") ?? endpointID,
                group: readString("group") ?? "Other",
                unit: readString("unit"),
                text: readString("text"),
                min: readNumber("min"),
                max: readNumber("max"),
                init: readNumber("init"),
                hidden: /\bhidden\s*:\s*true\b/.test(annotationText),
                boolean: type === "bool" || /\bboolean\b/.test(annotationText),
                discrete: /\bdiscrete\s*:\s*true\b/.test(annotationText),
            },
        });
    }

    return parameters;
}

async function openLab(viewport = { width: 1240, height: 900 }) {
    const source = await fs.readFile(path.join(repoRoot, "fx/polish_lab/PolishVoicingLab.cmajor"), "utf8");
    const parameters = parseParameters(source);
    const page = await browser.newPage({ viewport });
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString());
    await page.evaluate(async (inputs) => {
        const ParameterControls = await import("/cmaj_api/cmaj-parameter-controls.js");
        const values = new Map(inputs.map(parameter => [parameter.endpointID, parameter.annotation.init]));
        const parameterListeners = new Map();
        const endpointListeners = new Map();
        const statusListeners = new Set();
        const sent = [];
        const gestureStarts = [];
        const gestureEnds = [];
        const emitParameter = (endpointID, value) => {
            values.set(endpointID, value);
            for (const listener of parameterListeners.get(endpointID) ?? []) listener(value);
        };
        const patchConnection = {
            utilities: { ParameterControls },
            addStatusListener(listener) { statusListeners.add(listener); },
            removeStatusListener(listener) { statusListeners.delete(listener); },
            requestStatusUpdate() {
                queueMicrotask(() => {
                    for (const listener of statusListeners) listener({ details: { inputs } });
                });
            },
            addParameterListener(endpointID, listener) {
                const listeners = parameterListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                parameterListeners.set(endpointID, listeners);
            },
            removeParameterListener(endpointID, listener) { parameterListeners.get(endpointID)?.delete(listener); },
            requestParameterValue(endpointID) {
                queueMicrotask(() => {
                    for (const listener of parameterListeners.get(endpointID) ?? []) listener(values.get(endpointID));
                });
            },
            sendEventOrValue(endpointID, value) {
                sent.push({ endpointID, value });
                emitParameter(endpointID, value);
            },
            sendParameterGestureStart(endpointID) { gestureStarts.push(endpointID); },
            sendParameterGestureEnd(endpointID) { gestureEnds.push(endpointID); },
            addEndpointListener(endpointID, listener) {
                const listeners = endpointListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                endpointListeners.set(endpointID, listeners);
            },
            removeEndpointListener(endpointID, listener) { endpointListeners.get(endpointID)?.delete(listener); },
        };
        window.__POLISH_LAB_SETUP__ = {
            patchConnection,
            values,
            sent,
            gestureStarts,
            gestureEnds,
            endpointListeners,
            emitParameter,
        };
    }, parameters);
    await page.evaluate(async () => {
        window.__POLISH_LAB_FACTORY__ = (await import("/build/fx/polish_lab_runtime/view/app.js")).default;
    });
    await page.evaluate(() => {
        const factory = window.__POLISH_LAB_FACTORY__;
        const setup = window.__POLISH_LAB_SETUP__;
        const view = factory(setup.patchConnection);
        document.getElementById("mount").replaceChildren(view);
        window.__POLISH_LAB_TEST__ = {
            emitParameter: setup.emitParameter,
            emitMeter(frame) {
                for (const listener of setup.endpointListeners.get("meterOut") ?? []) listener(frame);
            },
            disconnect() { view.remove(); },
            snapshot() {
                const root = view.shadowRoot;
                const controls = Array.from(root.querySelectorAll("cmaj-labelled-control-holder"));
                const graph = root.querySelector('[data-transfer-graph="shaper"]');
                const dashedElements = Array.from(root.querySelectorAll("[data-transfer-graph] *")).filter(element => {
                    const dash = getComputedStyle(element).strokeDasharray;
                    return dash !== "none" && dash !== "0px" && dash !== "";
                });
                return {
                    controlIDs: controls.map(control => control.endpointInfo.endpointID),
                    controlHelp: controls.map(control => ({
                        endpointID: control.endpointInfo.endpointID,
                        help: control.dataset.controlHelp,
                        ariaDescription: control.getAttribute("aria-description"),
                    })),
                    text: root.textContent,
                    compressorGraph: Boolean(root.querySelector('[data-transfer-graph="compressor"]')),
                    compressorCurvePath: root.querySelector("[data-compressor-curve]")?.getAttribute("d"),
                    compressorHandles: Object.fromEntries(
                        Array.from(root.querySelectorAll('[data-transfer-graph="compressor"] [data-graph-handle]'))
                            .map(handle => [handle.dataset.graphHandle, handle.getAttribute("transform")]),
                    ),
                    compressorHandleLabels: Object.fromEntries(
                        Array.from(root.querySelectorAll('[data-transfer-graph="compressor"] [data-graph-handle]'))
                            .map(handle => [handle.dataset.graphHandle, handle.textContent.trim()]),
                    ),
                    compressorReadout: {
                        visible: root.querySelector("[data-compressor-readout]")?.dataset.visible,
                        text: root.querySelector("[data-compressor-readout-text]")?.textContent.trim(),
                    },
                    compressorOperatingActive: root.querySelector("[data-compressor-operating-point]")?.dataset.active,
                    compressorOperatingPoint: {
                        x: Number(root.querySelector("[data-compressor-operating-point]")?.getAttribute("cx")),
                        y: Number(root.querySelector("[data-compressor-operating-point]")?.getAttribute("cy")),
                    },
                    gainReductionSamples: Number(root.querySelector("[data-gain-reduction-trace]")?.dataset.sampleCount),
                    shaperGraph: Boolean(graph),
                    shaperAxis: graph ? {
                        inputMinimum: Number(graph.dataset.inputMin),
                        inputMaximum: Number(graph.dataset.inputMax),
                        outputMinimum: Number(graph.dataset.outputMin),
                        outputMaximum: Number(graph.dataset.outputMax),
                    } : null,
                    unityLineCount: graph?.querySelectorAll("[data-unity-line]").length ?? 0,
                    dashedElementCount: dashedElements.length,
                    axisLabels: Array.from(root.querySelectorAll("[data-shaper-axis-label]"))
                        .map(label => label.textContent.trim()),
                    shapePointCount: root.querySelectorAll("[data-shape-point-handle]").length,
                    shapePoints: Array.from(root.querySelectorAll("[data-shape-point-handle]")).map(handle => ({
                        side: handle.dataset.shapeSide,
                        index: Number(handle.dataset.shapeIndex),
                        transform: handle.getAttribute("transform"),
                        input: Number(handle.dataset.shapeInput),
                        output: Number(handle.dataset.shapeOutput),
                    })),
                    morphEndpoints: Array.from(root.querySelectorAll("[data-morph-endpoint]")).map(handle => ({
                        endpoint: handle.dataset.morphEndpoint,
                        side: handle.dataset.shapeSide,
                        index: Number(handle.dataset.shapeIndex),
                        input: Number(handle.dataset.morphInput ?? handle.dataset.shapeInput),
                        output: Number(handle.dataset.morphOutput ?? handle.dataset.shapeOutput),
                    })),
                    morphOwner: root.querySelector("[data-morph-owner]")?.textContent.trim(),
                    shaperCurvePath: root.querySelector("[data-shaper-curve]")?.getAttribute("d"),
                    shaperOperatingActive: root.querySelector("[data-shaper-operating-point]")?.dataset.active,
                    shaperOperatingPoint: {
                        x: Number(root.querySelector("[data-shaper-operating-point]")?.getAttribute("cx")),
                        y: Number(root.querySelector("[data-shaper-operating-point]")?.getAttribute("cy")),
                    },
                    shaperReadout: {
                        visible: root.querySelector("[data-shaper-readout]")?.dataset.visible,
                        text: root.querySelector("[data-shaper-readout-text]")?.textContent.trim(),
                    },
                    shapeSegmentCount: root.querySelectorAll("[data-shape-segment-handle]").length,
                    selection: root.querySelector("[data-shape-selection]")?.textContent.trim(),
                    inspector: {
                        label: root.querySelector("[data-shape-inspector-label]")?.textContent.trim(),
                        fields: Object.fromEntries(Array.from(root.querySelectorAll("[data-shape-exact-field]"))
                            .filter(field => !field.closest("[data-shape-exact-wrap]")?.hidden)
                            .map(field => [field.dataset.shapeExactField, Number(field.value)])),
                    },
                    tooltip: {
                        visible: root.querySelector("[data-tooltip]")?.dataset.visible,
                        text: root.querySelector("[data-tooltip]")?.textContent.trim(),
                    },
                    addPointPresent: Boolean(root.querySelector("[data-shape-add]")),
                    deletePointPresent: Boolean(root.querySelector("[data-shape-delete]")),
                    deletePointDisabled: root.querySelector("[data-shape-delete]")?.disabled,
                    driveHandleCount: root.querySelectorAll('[data-graph-handle="drive"]').length,
                    parameterValues: Object.fromEntries(setup.values),
                    sent: setup.sent.map(message => ({ ...message })),
                    gestureStarts: [...setup.gestureStarts],
                    gestureEnds: [...setup.gestureEnds],
                };
            },
        };
    });
    await page.waitForFunction(() => window.__POLISH_LAB_TEST__?.snapshot().controlIDs.length > 0);
    return page;
}

before(async () => {
    server = await startStaticRepoServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("the compiled lab is a minimal compressor and bipolar waveshaper editor", async () => {
    const page = await openLab();
    try {
        const view = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.deepEqual(view.controlIDs, [
            "thresholdDb", "ratio", "kneeDb", "attackMs", "releaseMs", "makeupDb", "morph",
        ]);
        assert.equal(view.compressorGraph, true);
        assert.deepEqual(view.compressorHandleLabels, {
            threshold: "T", ratio: "R", knee: "K", makeup: "M",
        });
        assert.equal(view.shaperGraph, true);
        assert.deepEqual(view.shaperAxis, {
            inputMinimum: -1.5,
            inputMaximum: 1.5,
            outputMinimum: -1.5,
            outputMaximum: 1.5,
        });
        assert.equal(view.unityLineCount, 1, "the UI must show one solid unity line total");
        assert.equal(view.dashedElementCount, 0, "no decoded, reference, drive, macro, or guide dashes remain");
        assert.deepEqual(new Set(view.axisLabels), new Set(["−1", "0", "+1"]));
        assert.deepEqual(
            Object.fromEntries(["−1", "0", "+1"].map(label => [label, view.axisLabels.filter(value => value === label).length])),
            { "−1": 2, "0": 2, "+1": 2 },
            "unity landmarks must be visible on both input and output axes",
        );
        assert.equal(view.shapePointCount, 2, "the starting curve has one ceiling per side and no mystery points");
        assert.equal(view.driveHandleCount, 0);
        assert.equal(view.controlHelp.length, 7);
        assert.ok(view.controlHelp.every(control => control.help && control.ariaDescription === control.help));
        assert.doesNotMatch(
            view.text,
            /Macro Wiring|Tone|Decoded|Reference|Amount Curve|Input Range|Drive|Clip Mix|Knot|Tension/i,
        );

        if (process.env.POLISH_LAB_SCREENSHOT)
            await page.screenshot({ path: process.env.POLISH_LAB_SCREENSHOT, fullPage: true });
        const ratioControl = page.locator("cmaj-labelled-control-holder").filter({ hasText: "Ratio" });
        await ratioControl.hover();
        const hovered = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(hovered.tooltip.visible, "true");
        assert.match(hovered.tooltip.text, /above Threshold.*reduced/i);
        await page.mouse.move(20, 20);
        assert.equal(
            (await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot())).tooltip.visible,
            "false",
        );
        await page.locator("[data-shape-add]").hover();
        const graphHelp = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(graphHelp.tooltip.visible, "true");
        assert.match(graphHelp.tooltip.text, /Insert a point/i);
    } finally {
        await page.close();
    }
});

test("selected points and segments support exact numeric entry without exposing extra knobs", async () => {
    const page = await openLab();
    try {
        await page.locator(
            '[data-shape-point-handle][data-shape-side="positive"][data-shape-index="1"]',
        ).click();
        let state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.match(state.inspector.label, /Positive point 1/i);
        assert.deepEqual(state.inspector.fields, { input: 1, output: 1 });

        const input = page.locator('[data-shape-exact-field="input"]');
        const output = page.locator('[data-shape-exact-field="output"]');
        await input.fill("0.812345");
        await input.press("Enter");
        await output.fill("1.123456");
        await output.press("Enter");
        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(state.parameterValues.curveP1X, 0.812345);
        assert.equal(state.parameterValues.curveP1Y, 1.123456);

        const segment = page.locator(
            '[data-shape-segment-handle][data-shape-side="positive"][data-shape-index="1"]',
        );
        await segment.scrollIntoViewIfNeeded();
        const segmentBox = await segment.boundingBox();
        await page.mouse.click(
            segmentBox.x + segmentBox.width / 2,
            segmentBox.y + segmentBox.height / 2,
        );
        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.match(state.inspector.label, /Positive segment 1/i);
        assert.deepEqual(Object.keys(state.inspector.fields), ["bend"]);
        const bend = page.locator('[data-shape-exact-field="bend"]');
        await bend.fill("0.375");
        await bend.press("Enter");
        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(state.parameterValues.curveB1, 0.375);
        assert.deepEqual(state.gestureStarts.slice(-1), ["curveB1"]);
        assert.deepEqual(state.gestureEnds.slice(-1), ["curveB1"]);
    } finally {
        await page.close();
    }
});

test("positive and negative ceiling drags independently update the DSP-facing curve", async () => {
    const page = await openLab();
    try {
        const graph = page.locator('[data-transfer-graph="shaper"]');
        const positive = page.locator('[data-shape-point-handle][data-shape-side="positive"][data-shape-index="1"]');
        const negative = page.locator('[data-shape-point-handle][data-shape-side="negative"][data-shape-index="1"]');
        assert.equal(await positive.count(), 1);
        assert.equal(await negative.count(), 1);

        const initial = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const positiveBox = await positive.boundingBox();
        assert.ok(positiveBox.width >= 44 && positiveBox.height >= 44);
        const positiveTarget = await graph.evaluate((element, target) => {
            const point = element.createSVGPoint();
            point.x = Number(element.dataset.plotLeft)
                + ((target.x - Number(element.dataset.inputMin))
                    / (Number(element.dataset.inputMax) - Number(element.dataset.inputMin)))
                * (Number(element.dataset.plotRight) - Number(element.dataset.plotLeft));
            point.y = Number(element.dataset.plotBottom)
                - ((target.y - Number(element.dataset.outputMin))
                    / (Number(element.dataset.outputMax) - Number(element.dataset.outputMin)))
                * (Number(element.dataset.plotBottom) - Number(element.dataset.plotTop));
            const screen = point.matrixTransform(element.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, { x: 0.72, y: 1.12 });
        await page.mouse.move(positiveBox.x + positiveBox.width / 2, positiveBox.y + positiveBox.height / 2);
        await page.mouse.down();
        assert.equal(
            (await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot())).sent.length,
            initial.sent.length,
            "acquiring a point must not jump either coordinate",
        );
        await page.mouse.move(positiveTarget.x, positiveTarget.y, { steps: 4 });
        const duringPositive = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(duringPositive.shaperReadout.visible, "true");
        assert.match(duringPositive.shaperReadout.text, /Positive point.*in 0\.720.*out 1\.120/i);
        await page.mouse.up();

        const afterPositive = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(Math.abs(afterPositive.parameterValues.curveP1X - 0.72) < 0.002);
        assert.ok(Math.abs(afterPositive.parameterValues.curveP1Y - 1.12) < 0.002);
        assert.equal(afterPositive.parameterValues.curveN1X, 1);
        assert.equal(afterPositive.parameterValues.curveN1Y, -1);
        assert.notEqual(afterPositive.shaperCurvePath, initial.shaperCurvePath);

        await negative.scrollIntoViewIfNeeded();
        const negativeBox = await negative.boundingBox();
        assert.ok(negativeBox.width >= 44 && negativeBox.height >= 44);
        const negativeHit = await negative.evaluate(handle => {
            const bounds = handle.getBoundingClientRect();
            const hit = handle.getRootNode()
                .elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
            return {
                tag: hit?.tagName,
                className: hit?.getAttribute?.("class"),
                side: hit?.closest?.("[data-shape-point-handle]")?.dataset.shapeSide,
            };
        });
        assert.equal(
            negativeHit.side,
            "negative",
            `the visible negative point must own its touch target: ${JSON.stringify(negativeHit)}`,
        );
        const negativeTarget = await graph.evaluate((element, target) => {
            const point = element.createSVGPoint();
            point.x = Number(element.dataset.plotLeft)
                + ((target.x - Number(element.dataset.inputMin))
                    / (Number(element.dataset.inputMax) - Number(element.dataset.inputMin)))
                * (Number(element.dataset.plotRight) - Number(element.dataset.plotLeft));
            point.y = Number(element.dataset.plotBottom)
                - ((target.y - Number(element.dataset.outputMin))
                    / (Number(element.dataset.outputMax) - Number(element.dataset.outputMin)))
                * (Number(element.dataset.plotBottom) - Number(element.dataset.plotTop));
            const screen = point.matrixTransform(element.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, { x: -0.86, y: -0.64 });
        await page.mouse.move(negativeBox.x + negativeBox.width / 2, negativeBox.y + negativeBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(negativeTarget.x, negativeTarget.y, { steps: 4 });
        await page.mouse.up();

        const afterNegative = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(
            Math.abs(afterNegative.parameterValues.curveN1X - 0.86) < 0.002,
            `negative input was ${afterNegative.parameterValues.curveN1X}; starts ${JSON.stringify(afterNegative.gestureStarts)}; ends ${JSON.stringify(afterNegative.gestureEnds)}; writes ${JSON.stringify(afterNegative.sent.slice(-6))}`,
        );
        assert.ok(Math.abs(afterNegative.parameterValues.curveN1Y - (-0.64)) < 0.002);
        assert.ok(Math.abs(afterNegative.parameterValues.curveP1X - 0.72) < 0.002);
        assert.ok(Math.abs(afterNegative.parameterValues.curveP1Y - 1.12) < 0.002);
        assert.deepEqual(afterNegative.gestureStarts.slice(-4), ["curveP1X", "curveP1Y", "curveN1X", "curveN1Y"]);
        assert.deepEqual(afterNegative.gestureEnds.slice(-4), ["curveP1X", "curveP1Y", "curveN1X", "curveN1Y"]);
    } finally {
        await page.close();
    }
});

test("live telemetry cannot block the curve control underneath it", async () => {
    const page = await openLab();
    try {
        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitMeter({
            compressorInputDb: -6,
            compressorOutputDb: -6,
            gainReductionDb: 0,
            clipInput: 1,
            clipOutput: 1,
        }));
        const handle = page.locator(
            '[data-shape-point-handle][data-shape-side="positive"][data-shape-index="1"]',
        );
        await handle.scrollIntoViewIfNeeded();
        const box = await handle.boundingBox();
        const hit = await handle.evaluate(element => {
            const bounds = element.getBoundingClientRect();
            const top = element.getRootNode().elementFromPoint(
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
            );
            return {
                className: top?.getAttribute?.("class"),
                side: top?.closest?.("[data-shape-point-handle]")?.dataset.shapeSide,
                index: top?.closest?.("[data-shape-point-handle]")?.dataset.shapeIndex,
            };
        });
        assert.deepEqual(
            { side: hit.side, index: hit.index },
            { side: "positive", index: "1" },
            `telemetry must not own hit-testing: ${JSON.stringify(hit)}`,
        );

        const before = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 + 30, { steps: 4 });
        await page.mouse.up();
        const after = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.notEqual(after.parameterValues.curveP1X, before.parameterValues.curveP1X);
        assert.notEqual(after.parameterValues.curveP1Y, before.parameterValues.curveP1Y);
        assert.deepEqual(after.gestureStarts.slice(-2), ["curveP1X", "curveP1Y"]);
        assert.deepEqual(after.gestureEnds.slice(-2), ["curveP1X", "curveP1Y"]);
    } finally {
        await page.close();
    }
});

test("segments bend directly and points can be added and removed without extra knobs", async () => {
    const page = await openLab();
    try {
        const segment = page.locator(
            '[data-shape-segment-handle][data-shape-side="positive"][data-shape-index="1"]',
        );
        assert.equal(await segment.count(), 1);
        assert.equal(
            Number.parseFloat(await segment.evaluate(element => getComputedStyle(element).strokeWidth)),
            44,
            "the curve itself needs a touch-sized bend target",
        );
        await segment.scrollIntoViewIfNeeded();
        const segmentBox = await segment.boundingBox();
        const initial = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        await page.mouse.move(segmentBox.x + segmentBox.width / 2, segmentBox.y + segmentBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(
            segmentBox.x + segmentBox.width / 2,
            segmentBox.y + segmentBox.height / 2 - 64,
            { steps: 4 },
        );
        await page.mouse.up();
        const bent = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(bent.parameterValues.curveB1 > 0.35);
        assert.notEqual(bent.shaperCurvePath, initial.shaperCurvePath);
        assert.match(bent.selection, /Positive segment 1/i);
        assert.equal(bent.addPointPresent, true);
        assert.equal(bent.deletePointPresent, true);

        await page.locator("[data-shape-add]").click();
        let edited = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(edited.parameterValues.curvePointCount, 2);
        assert.equal(edited.shapePointCount, 3);
        assert.equal(edited.shaperCurvePath, bent.shaperCurvePath, "adding a point must preserve the current sound");
        assert.match(edited.selection, /Positive point 1/i);
        assert.equal(edited.deletePointDisabled, false);

        await page.locator("[data-shape-delete]").click();
        edited = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(edited.parameterValues.curvePointCount, 1);
        assert.equal(edited.shapePointCount, 2);
        assert.ok(Math.abs(edited.parameterValues.curveP1X - 1) < 1e-6);
        assert.ok(Math.abs(edited.parameterValues.curveP1Y - 1) < 1e-6);
    } finally {
        await page.close();
    }
});

test("descending and flat segments bend in the visible drag direction", async () => {
    for (const scenario of [
        { name: "descending", leftY: 0.8, rightY: 0.2 },
        { name: "flat", leftY: 0.4, rightY: 0.4 },
    ]) {
        const page = await openLab();
        try {
            await page.evaluate(values => {
                const emit = window.__POLISH_LAB_TEST__.emitParameter;
                emit("curvePointCount", 2);
                emit("curveP1X", 0.5);
                emit("curveP1Y", values.leftY);
                emit("curveB1", 0);
                emit("curveP2X", 1);
                emit("curveP2Y", values.rightY);
                emit("curveB2", 0);
            }, scenario);
            const graph = page.locator('[data-transfer-graph="shaper"]');
            const segment = page.locator(
                '[data-shape-segment-handle][data-shape-side="positive"][data-shape-index="2"]',
            );
            await segment.scrollIntoViewIfNeeded();
            const midpointOutput = () => segment.evaluate(element => {
                const commands = element.getAttribute("d").match(/[ML][^ML]+/g);
                const command = commands[Math.floor(commands.length / 2)].slice(1).split(",").map(Number);
                const svg = element.closest("svg");
                const minimum = Number(svg.dataset.outputMin);
                const maximum = Number(svg.dataset.outputMax);
                return minimum
                    + ((Number(svg.dataset.plotBottom) - command[1])
                        / (Number(svg.dataset.plotBottom) - Number(svg.dataset.plotTop)))
                    * (maximum - minimum);
            });
            const before = await midpointOutput();
            const start = await graph.evaluate((element, value) => {
                const point = element.createSVGPoint();
                point.x = Number(element.dataset.plotLeft)
                    + ((value.input - Number(element.dataset.inputMin))
                        / (Number(element.dataset.inputMax) - Number(element.dataset.inputMin)))
                    * (Number(element.dataset.plotRight) - Number(element.dataset.plotLeft));
                point.y = Number(element.dataset.plotBottom)
                    - ((value.output - Number(element.dataset.outputMin))
                        / (Number(element.dataset.outputMax) - Number(element.dataset.outputMin)))
                    * (Number(element.dataset.plotBottom) - Number(element.dataset.plotTop));
                const screen = point.matrixTransform(element.getScreenCTM());
                return { x: screen.x, y: screen.y };
            }, { input: 0.75, output: (scenario.leftY + scenario.rightY) * 0.5 });
            await page.mouse.move(start.x, start.y);
            await page.mouse.down();
            await page.mouse.move(start.x, start.y - 48, { steps: 4 });
            await page.mouse.up();

            const state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            const after = await midpointOutput();
            assert.ok(state.parameterValues.curveB2 > 0, `${scenario.name}: upward drag stores positive bend`);
            assert.ok(
                after > before + 0.2,
                `${scenario.name}: upward drag moved midpoint from ${before} to ${after}`,
            );
        } finally {
            await page.close();
        }
    }
});

test("Morph linearly moves only its assigned point between visible A and B positions", async () => {
    const page = await openLab();
    try {
        let state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.deepEqual(state.morphEndpoints.map(point => point.endpoint).sort(), ["A", "B"]);
        assert.match(state.morphOwner, /Positive point 1/i);
        const negativeAtZero = state.shapePoints.find(point => point.side === "negative");
        const positiveAtZero = state.shapePoints.find(point => point.side === "positive");
        assert.ok(Math.abs(positiveAtZero.input - 1) < 1e-9);
        assert.ok(Math.abs(positiveAtZero.output - 1) < 1e-9);

        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("morph", 50));
        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        let current = state.shapePoints.find(point => point.side === "positive");
        assert.ok(Math.abs(current.input - 0.86) < 1e-9);
        assert.ok(Math.abs(current.output - 1.025) < 1e-9);
        assert.deepEqual(
            state.shapePoints.find(point => point.side === "negative"),
            negativeAtZero,
            "Morph must not move the unassigned side",
        );

        const bHandle = page.locator('[data-morph-endpoint="B"]');
        assert.equal(await bHandle.count(), 1);
        await bHandle.scrollIntoViewIfNeeded();
        const bBox = await bHandle.boundingBox();
        assert.ok(bBox.width >= 44 && bBox.height >= 44);
        const graph = page.locator('[data-transfer-graph="shaper"]');
        const target = await graph.evaluate((element, value) => {
            const point = element.createSVGPoint();
            point.x = Number(element.dataset.plotLeft)
                + ((value.x - Number(element.dataset.inputMin))
                    / (Number(element.dataset.inputMax) - Number(element.dataset.inputMin)))
                * (Number(element.dataset.plotRight) - Number(element.dataset.plotLeft));
            point.y = Number(element.dataset.plotBottom)
                - ((value.y - Number(element.dataset.outputMin))
                    / (Number(element.dataset.outputMax) - Number(element.dataset.outputMin)))
                * (Number(element.dataset.plotBottom) - Number(element.dataset.plotTop));
            const screen = point.matrixTransform(element.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, { x: 0.6, y: 1.2 });
        const writesBefore = state.sent.length;
        await page.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
        await page.mouse.down();
        assert.equal(
            (await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot())).sent.length,
            writesBefore,
            "acquiring B must not jump its coordinates",
        );
        await page.mouse.move(target.x, target.y, { steps: 4 });
        await page.mouse.up();

        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(Math.abs(state.parameterValues.morphTargetX - 0.6) < 0.002);
        assert.ok(Math.abs(state.parameterValues.morphTargetY - 1.2) < 0.002);
        current = state.shapePoints.find(point => point.side === "positive");
        assert.ok(Math.abs(current.input - 0.8) < 0.002);
        assert.ok(Math.abs(current.output - 1.1) < 0.002);
        assert.deepEqual(state.shapePoints.find(point => point.side === "negative"), negativeAtZero);
        const morphWrites = state.sent.slice(writesBefore);
        assert.ok(morphWrites.some(message => message.endpointID === "morphTargetX"));
        assert.ok(morphWrites.some(message => message.endpointID === "morphTargetY"));
        assert.equal(
            morphWrites.some(message => /amount|macro|ratio|makeup|curveN/i.test(message.endpointID)),
            false,
        );

        assert.match(state.inspector.label, /Morph B/i);
        assert.ok(Math.abs(state.inspector.fields.input - 0.6) < 0.002);
        assert.ok(Math.abs(state.inspector.fields.output - 1.2) < 0.002);
        await page.locator('[data-shape-exact-field="input"]').fill("0.58");
        await page.locator('[data-shape-exact-field="input"]').press("Enter");
        await page.locator('[data-shape-exact-field="output"]').fill("1.21");
        await page.locator('[data-shape-exact-field="output"]').press("Enter");
        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(state.parameterValues.morphTargetX, 0.58);
        assert.equal(state.parameterValues.morphTargetY, 1.21);
        assert.deepEqual(
            state.morphEndpoints.map(point => ({ endpoint: point.endpoint, input: point.input, output: point.output })),
            [
                { endpoint: "A", input: 1, output: 1 },
                { endpoint: "B", input: 0.58, output: 1.21 },
            ],
        );
    } finally {
        await page.close();
    }
});

test("Reset and all-slot host-state replay reconstruct both graphs exactly", async () => {
    const page = await openLab();
    try {
        const editedValues = {
            bypass: true,
            thresholdDb: -11.25,
            ratio: 7.5,
            kneeDb: 9,
            attackMs: 3.5,
            releaseMs: 240,
            makeupDb: 1.75,
            curvePointCount: 7,
            curveP1X: 0.42,
            curveP1Y: 0.61,
            curveB1: 0.35,
            curveP2X: 0.58,
            curveP2Y: 0.2,
            curveB2: -0.2,
            curveP3X: 0.74,
            curveP3Y: 0.95,
            curveB3: 0.5,
            curveP4X: 0.91,
            curveP4Y: -0.15,
            curveB4: -0.45,
            curveP5X: 1.08,
            curveP5Y: 1.18,
            curveB5: 0.1,
            curveP6X: 1.26,
            curveP6Y: 0.3,
            curveB6: -0.7,
            curveP7X: 1.44,
            curveP7Y: 1.31,
            curveB7: 0.25,
            curveNPointCount: 7,
            curveN1X: 0.37,
            curveN1Y: -0.52,
            curveNB1: -0.4,
            curveN2X: 0.55,
            curveN2Y: 0.3,
            curveNB2: 0.45,
            curveN3X: 0.73,
            curveN3Y: -0.8,
            curveNB3: -0.2,
            curveN4X: 0.9,
            curveN4Y: 0.15,
            curveNB4: 0.3,
            curveN5X: 1.07,
            curveN5Y: -1.24,
            curveNB5: -0.5,
            curveN6X: 1.25,
            curveN6Y: -0.2,
            curveNB6: 0.1,
            curveN7X: 1.43,
            curveN7Y: -1.4,
            curveNB7: 0.6,
            morph: 63,
            morphSide: -1,
            morphPoint: 2,
            morphTargetX: 0.74,
            morphTargetY: -0.96,
        };
        await page.evaluate(values => {
            for (const [endpointID, value] of Object.entries(values))
                window.__POLISH_LAB_TEST__.emitParameter(endpointID, value);
        }, editedValues);
        const saved = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());

        await page.locator("[data-reset]").click();
        const reset = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(reset.parameterValues.bypass, false);
        assert.equal(reset.parameterValues.thresholdDb, 0);
        assert.equal(reset.parameterValues.ratio, 4);
        assert.equal(reset.parameterValues.kneeDb, 6);
        assert.equal(reset.parameterValues.curvePointCount, 1);
        assert.equal(reset.parameterValues.curveNPointCount, 1);
        assert.equal(reset.parameterValues.curveP1X, 1);
        assert.equal(reset.parameterValues.curveP1Y, 1);
        assert.equal(reset.parameterValues.curveN1X, 1);
        assert.equal(reset.parameterValues.curveN1Y, -1);
        assert.equal(reset.parameterValues.curveP2X, 1.08, "inactive slots reset too");
        assert.equal(reset.parameterValues.curveN7Y, -1, "every hidden host slot resets deterministically");
        assert.equal(reset.parameterValues.morph, 0);
        assert.equal(reset.shapePointCount, 2);

        await page.evaluate(values => {
            for (const [endpointID, value] of Object.entries(values))
                window.__POLISH_LAB_TEST__.emitParameter(endpointID, value);
        }, editedValues);
        const restored = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(restored.compressorCurvePath, saved.compressorCurvePath);
        assert.equal(restored.shaperCurvePath, saved.shaperCurvePath);
        assert.deepEqual(restored.compressorHandles, saved.compressorHandles);
        assert.deepEqual(restored.shapePoints, saved.shapePoints);
        assert.deepEqual(restored.morphEndpoints, saved.morphEndpoints);
    } finally {
        await page.close();
    }
});

test("cancelled point gestures restore exact raw non-monotonic host coordinates", async () => {
    for (const cancellation of ["Escape", "pointercancel", "disconnect"]) {
        const page = await openLab();
        try {
            await page.evaluate(() => {
                const emit = window.__POLISH_LAB_TEST__.emitParameter;
                emit("curvePointCount", 2);
                emit("curveP1X", 1.4);
                emit("curveP1Y", 0.25);
                emit("curveP2X", 0.2);
                emit("curveP2Y", 0.9);
            });
            const handle = page.locator(
                '[data-shape-point-handle][data-shape-side="positive"][data-shape-index="2"]',
            );
            await handle.scrollIntoViewIfNeeded();
            const box = await handle.boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2 + 36, box.y + box.height / 2 - 52, { steps: 3 });
            let changed = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.notEqual(changed.parameterValues.curveP2X, 0.2, `${cancellation}: gesture must change X first`);
            assert.notEqual(changed.parameterValues.curveP2Y, 0.9, `${cancellation}: gesture must change Y first`);

            if (cancellation === "Escape") {
                await page.keyboard.press("Escape");
            } else if (cancellation === "pointercancel") {
                await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointercancel", {
                    bubbles: true,
                    pointerId: 1,
                    pointerType: "mouse",
                })));
            } else {
                await page.evaluate(() => window.__POLISH_LAB_TEST__.disconnect());
            }
            await page.mouse.up();
            const restored = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.equal(restored.parameterValues.curveP1X, 1.4, `${cancellation}: neighbor stays raw`);
            assert.equal(restored.parameterValues.curveP2X, 0.2, `${cancellation}: raw X restores exactly`);
            assert.equal(restored.parameterValues.curveP2Y, 0.9, `${cancellation}: raw Y restores exactly`);
            assert.deepEqual(restored.gestureEnds.slice(-2), ["curveP2X", "curveP2Y"]);
        } finally {
            await page.close();
        }
    }
});

test("only the owning pointer can commit or cancel a graph gesture", async () => {
    for (const unrelatedType of ["pointerup", "pointercancel"]) {
        const page = await openLab();
        try {
            const handle = page.locator(
                '[data-shape-point-handle][data-shape-side="positive"][data-shape-index="1"]',
            );
            await handle.scrollIntoViewIfNeeded();
            const box = await handle.boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2 - 28, box.y + box.height / 2 + 24, { steps: 3 });
            const owned = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.equal(owned.shaperReadout.visible, "true");
            assert.notEqual(owned.parameterValues.curveP1X, 1);
            assert.notEqual(owned.parameterValues.curveP1Y, 1);

            await page.evaluate(type => document.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                pointerId: 2,
                pointerType: "touch",
            })), unrelatedType);
            const afterUnrelated = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.equal(
                afterUnrelated.shaperReadout.visible,
                "true",
                `${unrelatedType}: pointer 2 must not end pointer 1's gesture`,
            );
            assert.equal(afterUnrelated.gestureEnds.length, owned.gestureEnds.length);
            assert.equal(afterUnrelated.parameterValues.curveP1X, owned.parameterValues.curveP1X);
            assert.equal(afterUnrelated.parameterValues.curveP1Y, owned.parameterValues.curveP1Y);

            await page.mouse.move(box.x + box.width / 2 - 44, box.y + box.height / 2 + 38, { steps: 2 });
            const continued = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.notEqual(continued.parameterValues.curveP1X, afterUnrelated.parameterValues.curveP1X);
            assert.notEqual(continued.parameterValues.curveP1Y, afterUnrelated.parameterValues.curveP1Y);
            await page.mouse.up();
            const finished = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.equal(finished.shaperReadout.visible, "false");
            assert.deepEqual(finished.gestureEnds.slice(-2), ["curveP1X", "curveP1Y"]);
        } finally {
            await page.mouse.up().catch(() => {});
            await page.close();
        }
    }
});

test("Ratio and the other compressor graph controls always edit the visible DSP curve directly", async () => {
    const page = await openLab();
    try {
        const initial = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        await page.evaluate(() => {
            window.__POLISH_LAB_TEST__.emitParameter("amount", 100);
            window.__POLISH_LAB_TEST__.emitParameter("macroRatioTarget", 1000);
            window.__POLISH_LAB_TEST__.emitParameter("macroMakeupDb", 12);
            window.__POLISH_LAB_TEST__.emitParameter("ratio", 20);
        });
        let state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.notEqual(state.compressorCurvePath, initial.compressorCurvePath);

        await page.evaluate(() => {
            window.__POLISH_LAB_TEST__.emitParameter("ratio", 20);
            window.__POLISH_LAB_TEST__.emitParameter("makeupDb", 0);
            window.__POLISH_LAB_TEST__.emitParameter("thresholdDb", 0);
            window.__POLISH_LAB_TEST__.emitParameter("kneeDb", 0);
        });
        const ratioKnob = page.locator("cmaj-labelled-control-holder")
            .filter({ hasText: "Ratio" })
            .locator("cmaj-knob-control");
        const knobBox = await ratioKnob.boundingBox();
        const beforeKnob = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        await page.mouse.move(knobBox.x + knobBox.width / 2, knobBox.y + knobBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(knobBox.x + knobBox.width / 2, knobBox.y + knobBox.height / 2 - 20, { steps: 5 });
        await page.mouse.up();
        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.notEqual(state.parameterValues.ratio, beforeKnob.parameterValues.ratio);
        assert.notEqual(state.compressorCurvePath, beforeKnob.compressorCurvePath);
        assert.ok(state.sent.slice(beforeKnob.sent.length).every(write => write.endpointID === "ratio"));
        assert.equal(state.gestureStarts.at(-1), "ratio");
        assert.equal(state.gestureEnds.at(-1), "ratio");
        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("ratio", 20));

        const ratioHandle = page.locator('[data-transfer-graph="compressor"] [data-graph-handle="ratio"]');
        assert.equal(await ratioHandle.count(), 1);
        await ratioHandle.scrollIntoViewIfNeeded();
        const ratioBox = await ratioHandle.boundingBox();
        assert.ok(
            ratioBox.width >= 44 && ratioBox.height >= 44,
            `Ratio touch target was ${JSON.stringify(ratioBox)}`,
        );
        const graph = page.locator('[data-transfer-graph="compressor"]');
        const target = await graph.evaluate((element, outputDb) => {
            const point = element.createSVGPoint();
            point.x = Number(element.dataset.plotRight);
            point.y = Number(element.dataset.plotBottom)
                - ((outputDb - Number(element.dataset.outputMin))
                    / (Number(element.dataset.outputMax) - Number(element.dataset.outputMin)))
                * (Number(element.dataset.plotBottom) - Number(element.dataset.plotTop));
            const screen = point.matrixTransform(element.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, 3);
        const beforeDrag = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        await page.mouse.move(ratioBox.x + ratioBox.width / 2, ratioBox.y + ratioBox.height / 2);
        await page.mouse.down();
        assert.equal(
            (await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot())).sent.length,
            beforeDrag.sent.length,
            "acquiring Ratio must not jump the value",
        );
        await page.mouse.move(ratioBox.x + ratioBox.width / 2, target.y, { steps: 5 });
        const duringRatio = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(duringRatio.compressorReadout.visible, "true");
        assert.match(duringRatio.compressorReadout.text, /Ratio\s+4\.00:1/);
        await page.mouse.up();
        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(Math.abs(state.parameterValues.ratio - 4) < 0.02);
        const ratioWrites = state.sent.slice(beforeDrag.sent.length);
        assert.ok(ratioWrites.some(message => message.endpointID === "ratio"));
        assert.equal(ratioWrites.some(message => message.endpointID === "macroRatioTarget"), false);

        const thresholdBefore = state.compressorHandles.threshold;
        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("thresholdDb", -12));
        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.notEqual(state.compressorHandles.threshold, thresholdBefore);

        for (const gesture of [
            { handle: "threshold", endpointID: "thresholdDb", dx: 38, dy: 0 },
            { handle: "knee", endpointID: "kneeDb", dx: 38, dy: 0 },
            { handle: "makeup", endpointID: "makeupDb", dx: 0, dy: -38 },
        ]) {
            const control = page.locator(
                `[data-transfer-graph="compressor"] [data-graph-handle="${gesture.handle}"]`,
            );
            const box = await control.boundingBox();
            const before = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            assert.equal(
                (await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot())).sent.length,
                before.sent.length,
                `${gesture.handle} pickup must not jump`,
            );
            await page.mouse.move(
                box.x + box.width / 2 + gesture.dx,
                box.y + box.height / 2 + gesture.dy,
                { steps: 4 },
            );
            await page.mouse.up();
            const after = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.notEqual(after.parameterValues[gesture.endpointID], before.parameterValues[gesture.endpointID]);
            assert.ok(after.sent.slice(before.sent.length).every(write => write.endpointID === gesture.endpointID));
            assert.equal(after.gestureStarts.at(-1), gesture.endpointID);
            assert.equal(after.gestureEnds.at(-1), gesture.endpointID);
        }

        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitMeter({
            compressorInputDb: -3,
            compressorOutputDb: -7,
            gainReductionDb: 4,
            clipInput: 0.5,
            clipOutput: 0.4,
        }));
        state = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(state.compressorOperatingActive, "true");
        assert.equal(state.gainReductionSamples, 1);
        assert.equal(state.shaperOperatingActive, "true");
        assert.ok(Math.abs(state.compressorOperatingPoint.x - 573) < 0.01);
        assert.ok(Math.abs(state.compressorOperatingPoint.y - 95.2667) < 0.01);
        assert.ok(Math.abs(state.shaperOperatingPoint.x - 518.6667) < 0.01);
        assert.ok(Math.abs(state.shaperOperatingPoint.y - 158.8) < 0.01);
    } finally {
        await page.close();
    }
});
