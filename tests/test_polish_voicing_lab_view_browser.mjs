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

before(async () => {
    server = await startStaticRepoServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("the compiled VST3 view exposes all controls, live curve/meter feedback, compare, and decoded reset", async () => {
    const source = await fs.readFile(path.join(repoRoot, "fx/polish_lab/PolishVoicingLab.cmajor"), "utf8");
    const endpoints = parseParameters(source);
    const page = await browser.newPage({ viewport: { width: 1240, height: 900 } });

    try {
        await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString());
        await page.evaluate(async (parameters) => {
            const ParameterControls = await import(
                "/cmaj_api/cmaj-parameter-controls.js"
            );
            const parameterValues = new Map(parameters.map(parameter => [parameter.endpointID, parameter.annotation.init]));
            const parameterListeners = new Map();
            const endpointListeners = new Map();
            const statusListeners = new Set();
            const sent = [];
            const gestureStarts = [];
            const gestureEnds = [];

            const emitParameter = (endpointID, value) => {
                parameterValues.set(endpointID, value);
                for (const listener of parameterListeners.get(endpointID) ?? []) listener(value);
            };
            const patchConnection = {
                utilities: { ParameterControls },
                addStatusListener(listener) { statusListeners.add(listener); },
                removeStatusListener(listener) { statusListeners.delete(listener); },
                requestStatusUpdate() {
                    queueMicrotask(() => {
                        const status = { details: { inputs: parameters } };
                        for (const listener of statusListeners) listener(status);
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
                        for (const listener of parameterListeners.get(endpointID) ?? [])
                            listener(parameterValues.get(endpointID));
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
                emitParameter,
                endpointListeners,
                parameterValues,
                sent,
                gestureStarts,
                gestureEnds,
            };
        }, endpoints);
        await page.evaluate(async () => {
            window.__POLISH_LAB_FACTORY__ = (await import("/build/fx/polish_lab_runtime/view/app.js")).default;
        });
        await page.evaluate(() => {
            const {
                patchConnection,
                emitParameter,
                endpointListeners,
                parameterValues,
                sent,
                gestureStarts,
                gestureEnds,
            } = window.__POLISH_LAB_SETUP__;
            const view = window.__POLISH_LAB_FACTORY__(patchConnection);
            let lastGraphPointerID;
            let lastGraphPointerTarget;
            view.shadowRoot.querySelector('[data-transfer-graph="clipper"]')
                .addEventListener("pointerdown", event => {
                    lastGraphPointerID = event.pointerId;
                    lastGraphPointerTarget = {
                        tag: event.target?.tagName,
                        graphHandle: event.target?.closest?.("[data-graph-handle]")?.dataset.graphHandle,
                        segmentHandle: event.target?.closest?.("[data-segment-handle]")?.dataset.segmentHandle,
                    };
                }, { capture: true });
            window.__POLISH_LAB_TEST__ = {
                emitParameter,
                emitMeter(frame) {
                    for (const listener of endpointListeners.get("meterOut") ?? []) listener(frame);
                },
                snapshot() {
                    const root = view.shadowRoot;
                    const controls = Array.from(root.querySelectorAll("cmaj-labelled-control-holder"));
                    const getControl = endpointID => controls.find(control => control.endpointInfo?.endpointID === endpointID);
                    const tooltip = root.querySelector("[data-control-tooltip]");
                    const tooltipRect = tooltip?.getBoundingClientRect();
                    const attackHolder = getControl("attackMs");
                    const attackControl = attackHolder?.childControl;
                    const attackTrack = attackControl?.querySelector(".knob-track-value");
                    const attackDial = attackControl?.querySelector(".knob-dial");
                    const attackTick = attackControl?.querySelector(".knob-dial-tick");
                    const attackRect = attackControl?.getBoundingClientRect();
                    const bypassControl = getControl("bypass")?.childControl;
                    const bypassOutline = bypassControl?.querySelector(".switch-outline");
                    const detectorControl = getControl("detectorMode")?.childControl;
                    const detectorIcon = detectorControl?.querySelector(".select-icon");
                    return {
                        groupCount: root.querySelectorAll(".group").length,
                        controlIDs: controls.map(control => control.endpointInfo.endpointID),
                        controlHelp: controls.map(control => ({
                            endpointID: control.endpointInfo.endpointID,
                            help: control.dataset.controlHelp,
                            source: control.dataset.controlHelpSource,
                            ariaDescription: control.getAttribute("aria-description"),
                        })),
                        tooltip: tooltip ? {
                            visible: tooltip.dataset.visible === "true",
                            text: tooltip.textContent,
                            ariaHidden: tooltip.getAttribute("aria-hidden"),
                            left: tooltipRect.left,
                            top: tooltipRect.top,
                            right: tooltipRect.right,
                            bottom: tooltipRect.bottom,
                            viewportWidth: window.innerWidth,
                            viewportHeight: window.innerHeight,
                        } : null,
                        attackKnob: {
                            tagName: attackControl?.tagName.toLowerCase(),
                            width: attackRect?.width ?? 0,
                            height: attackRect?.height ?? 0,
                            trackStroke: attackTrack ? getComputedStyle(attackTrack).stroke : "missing",
                            dialBorderStyle: attackDial ? getComputedStyle(attackDial).borderTopStyle : "missing",
                            dialBorderWidth: attackDial ? getComputedStyle(attackDial).borderTopWidth : "0px",
                            dialBackground: attackDial ? getComputedStyle(attackDial).backgroundColor : "missing",
                            tickBackground: attackTick ? getComputedStyle(attackTick).backgroundColor : "missing",
                        },
                        bypassSwitch: {
                            tagName: bypassControl?.tagName.toLowerCase(),
                            outlineBorderStyle: bypassOutline ? getComputedStyle(bypassOutline).borderTopStyle : "missing",
                            outlineBorderWidth: bypassOutline ? getComputedStyle(bypassOutline).borderTopWidth : "0px",
                        },
                        detectorOptions: {
                            tagName: detectorControl?.tagName.toLowerCase(),
                            borderStyle: detectorControl ? getComputedStyle(detectorControl).borderTopStyle : "missing",
                            borderWidth: detectorControl ? getComputedStyle(detectorControl).borderTopWidth : "0px",
                            iconBackground: detectorIcon ? getComputedStyle(detectorIcon).backgroundColor : "missing",
                        },
                        compressorCurvePath: root.querySelector("[data-compressor-curve]").getAttribute("d"),
                        clipperCurvePath: root.querySelector("[data-clipper-curve]").getAttribute("d"),
                        decodedClipperCurvePath: root.querySelector("[data-decoded-clipper-curve]")?.getAttribute("d"),
                        clipperSummary: root.querySelector("[data-clipper-graph-summary]").textContent,
                        clipperGraphAxis: (() => {
                            const graph = root.querySelector('[data-transfer-graph="clipper"]');
                            return {
                                inputMinimum: Number(graph?.dataset.inputMin),
                                inputMaximum: Number(graph?.dataset.inputMax),
                                outputMinimum: Number(graph?.dataset.outputMin),
                                outputMaximum: Number(graph?.dataset.outputMax),
                            };
                        })(),
                        tensionGraphHandleCount: root.querySelectorAll('[data-graph-handle^="tension"]').length,
                        curveReferenceDetails: (() => {
                            const details = root.querySelector("[data-curve-reference-details]");
                            return details ? {
                                present: true,
                                open: details.open,
                                controlIDs: Array.from(details.querySelectorAll("cmaj-labelled-control-holder"))
                                    .map(control => control.endpointInfo.endpointID),
                            } : { present: false, open: false, controlIDs: [] };
                        })(),
                        primaryClipperControlIDs: Array.from(
                            root.querySelectorAll(".group-clipper > .controls > cmaj-labelled-control-holder"),
                        ).map(control => control.endpointInfo.endpointID),
                        curveEditor: {
                            mode: root.querySelector("[data-curve-editor-mode]")?.textContent,
                            selected: root.querySelector("[data-curve-selection]")?.textContent,
                            startPresent: Boolean(root.querySelector("[data-curve-start-editor]")),
                            startButton: root.querySelector("[data-curve-start-editor]")?.textContent,
                            addDisabled: root.querySelector("[data-curve-add]")?.disabled,
                            removeDisabled: root.querySelector("[data-curve-remove]")?.disabled,
                            amountDisabled: root.querySelector("[data-curve-link-amount]")?.disabled,
                            pointCount: root.querySelectorAll("[data-editor-point]").length,
                            bendCount: root.querySelectorAll("[data-editor-bend]").length,
                            amountTargetCount: root.querySelectorAll('[data-graph-handle="amountTarget"]').length,
                            exactInput: root.querySelector("[data-curve-exact-x]")?.value,
                            exactOutput: root.querySelector("[data-curve-exact-y]")?.value,
                            exactBend: root.querySelector("[data-curve-exact-bend]")?.value,
                            amountTargetInput: root.querySelector("[data-curve-amount-x]")?.value,
                            amountTargetOutput: root.querySelector("[data-curve-amount-y]")?.value,
                        },
                        graphHandles: Object.fromEntries(Array.from(root.querySelectorAll("[data-graph-control]")).map(handle => [
                            handle.dataset.graphControl,
                            handle.getAttribute("transform"),
                        ])),
                        meterDelta: root.querySelector("[data-meter-delta]").textContent,
                        meterGr: root.querySelector("[data-meter-gr]").textContent,
                        meterClip: root.querySelector("[data-meter-clip]").textContent,
                        effectiveInput: root.querySelector("[data-effective-input]").textContent,
                        parameterValues: Object.fromEntries(parameterValues),
                        sent: sent.map(message => ({ ...message })),
                        gestureStarts: [...gestureStarts],
                        gestureEnds: [...gestureEnds],
                        lastGraphPointerTarget,
                        text: root.textContent,
                    };
                },
                click(selector) { view.shadowRoot.querySelector(selector).click(); },
                cancelActivePointer() {
                    window.dispatchEvent(new PointerEvent("pointercancel", {
                        bubbles: true,
                        pointerId: lastGraphPointerID,
                    }));
                },
                disconnect() { view.remove(); },
            };
            document.getElementById("mount").replaceChildren(view);
        });

        await page.waitForFunction(() => window.__POLISH_LAB_TEST__?.snapshot().controlIDs.length >= 35);
        const initial = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(initial.groupCount, 6);
        assert.equal(initial.controlIDs.includes("hostSlot0Guard"), false);
        assert.ok(initial.controlIDs.includes("attackMs"));
        assert.ok(initial.controlIDs.includes("curveP3T"));
        assert.equal(initial.controlHelp.length, initial.controlIDs.length);
        assert.ok(initial.controlHelp.every(control => control.source === "specific"));
        assert.ok(initial.controlHelp.every(control => control.help?.length > 20));
        assert.ok(initial.controlHelp.every(control => control.ariaDescription === control.help));
        assert.match(
            initial.controlHelp.find(control => control.endpointID === "macroCurve").help,
            /Amount \^ Amount Curve.*1 is linear.*above 1.*below 1/i,
        );
        assert.equal(initial.attackKnob.tagName, "cmaj-knob-control");
        assert.ok(initial.attackKnob.width >= 70);
        assert.ok(initial.attackKnob.height >= 70);
        assert.notEqual(initial.attackKnob.trackStroke, "none");
        assert.equal(initial.attackKnob.dialBorderStyle, "solid");
        assert.ok(Number.parseFloat(initial.attackKnob.dialBorderWidth) > 0);
        assert.notEqual(initial.attackKnob.tickBackground, "rgba(0, 0, 0, 0)");
        assert.equal(initial.bypassSwitch.tagName, "cmaj-switch-control");
        assert.equal(initial.bypassSwitch.outlineBorderStyle, "solid");
        assert.ok(Number.parseFloat(initial.bypassSwitch.outlineBorderWidth) > 0);
        assert.equal(initial.detectorOptions.tagName, "cmaj-options-control");
        assert.equal(initial.detectorOptions.borderStyle, "solid");
        assert.ok(Number.parseFloat(initial.detectorOptions.borderWidth) > 0);
        assert.notEqual(initial.detectorOptions.iconBackground, "rgba(0, 0, 0, 0)");
        assert.match(initial.clipperSummary, /-0\.02 dB drive · 100\.0% mix/);
        assert.match(initial.effectiveInput, /-0\.3 dB/);
        assert.doesNotMatch(initial.text, /Sausage|Fattener|Dada Life/i);
        assert.ok(
            initial.decodedClipperCurvePath?.startsWith("M"),
            "the decoded transfer must remain visible as a reference overlay",
        );
        assert.deepEqual(initial.clipperGraphAxis, {
            inputMinimum: 0,
            inputMaximum: 1.5,
            outputMinimum: 0,
            outputMaximum: 1.5,
        }, "the editor must devote its full area to positive magnitude; DSP mirrors the negative side");
        assert.equal(initial.tensionGraphHandleCount, 0, "raw tension markers must not masquerade as free curve controls");
        assert.deepEqual(initial.primaryClipperControlIDs, ["clipDriveDb", "clipMix"]);
        assert.equal(initial.controlIDs.includes("curveEditorEnabled"), false, "editor state must not leak as generic knobs");
        assert.deepEqual(initial.curveEditor, {
            mode: "Decoded curve",
            selected: "Select a point",
            startPresent: true,
            startButton: "Start point editor",
            addDisabled: true,
            removeDisabled: true,
            amountDisabled: true,
            pointCount: 0,
            bendCount: 0,
            amountTargetCount: 0,
            exactInput: "",
            exactOutput: "",
            exactBend: "",
            amountTargetInput: "",
            amountTargetOutput: "",
        });
        assert.equal(initial.curveReferenceDetails.present, true);
        assert.equal(initial.curveReferenceDetails.open, false, "raw coefficients must start outside sound-design flow");
        assert.deepEqual(initial.curveReferenceDetails.controlIDs, [
            "curveP1X", "curveP1Y", "curveP1T",
            "curveP2X", "curveP2Y", "curveP2T",
            "curveP3X", "curveP3Y", "curveP3T",
        ]);

        const compressorGraph = page.locator('[data-transfer-graph="compressor"]');
        const thresholdHandle = page.locator('[data-graph-handle="threshold"]');
        const compressorOperatingPoint = page.locator("[data-compressor-operating-point]");
        const gainReductionTrace = page.locator("[data-gain-reduction-trace]");
        const clipperOperatingPoint = page.locator("[data-clipper-operating-point]");
        assert.equal(await compressorGraph.count(), 1, "the compressor graph must be present");
        assert.equal(await compressorOperatingPoint.count(), 1, "compressor graph needs a live operating point");
        assert.equal(await gainReductionTrace.count(), 1, "attack and release need a gain-reduction history trace");
        assert.equal(await clipperOperatingPoint.count(), 1, "clipper graph needs a live operating point");
        assert.equal(await compressorOperatingPoint.getAttribute("data-active"), "false");
        assert.equal(await gainReductionTrace.getAttribute("data-sample-count"), "0");
        assert.equal(await clipperOperatingPoint.getAttribute("data-active"), "false");
        assert.equal(await thresholdHandle.count(), 1, "threshold must be directly draggable");
        await thresholdHandle.scrollIntoViewIfNeeded();
        const thresholdBox = await thresholdHandle.boundingBox();
        assert.ok(
            thresholdBox.width >= 44 && thresholdBox.height >= 44,
            `threshold needs a touch-sized target: ${JSON.stringify(thresholdBox)}`,
        );
        const hitHandle = await thresholdHandle.evaluate(handle => {
            const bounds = handle.getBoundingClientRect();
            return handle.getRootNode()
                .elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
                ?.closest?.("[data-graph-handle]")
                ?.getAttribute("data-graph-handle");
        });
        assert.equal(hitHandle, "threshold", "the visible touch target must own pointer hit-testing");

        const sentBeforeAcquire = initial.sent.length;
        await page.mouse.move(thresholdBox.x + thresholdBox.width / 2, thresholdBox.y + thresholdBox.height / 2);
        await page.mouse.down();
        let graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(graphAction.sent.length, sentBeforeAcquire, "acquiring a handle must not jump the value");
        assert.equal(graphAction.gestureStarts.at(-1), "thresholdDb", "acquiring must open the real host gesture");

        const thresholdTarget = await compressorGraph.evaluate((graph, targetDb) => {
            const point = graph.createSVGPoint();
            const minimum = Number(graph.dataset.inputMin);
            const maximum = Number(graph.dataset.inputMax);
            const plotLeft = Number(graph.dataset.plotLeft);
            const plotRight = Number(graph.dataset.plotRight);
            point.x = plotLeft + ((targetDb - minimum) / (maximum - minimum)) * (plotRight - plotLeft);
            point.y = Number(graph.dataset.plotBottom);
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, -12);
        await page.mouse.move(thresholdTarget.x, thresholdBox.y + thresholdBox.height / 2, { steps: 4 });
        await page.mouse.up();

        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const thresholdWrite = graphAction.sent.filter(message => message.endpointID === "thresholdDb").at(-1);
        assert.ok(Math.abs(thresholdWrite.value - (-12)) < 0.001, "graph drag must write exact DSP-facing dB");
        assert.equal(graphAction.gestureStarts.at(-1), "thresholdDb");
        assert.equal(graphAction.gestureEnds.at(-1), "thresholdDb");

        const cancelThresholdBox = await thresholdHandle.boundingBox();
        const cancelThresholdTarget = await compressorGraph.evaluate((graph, targetDb) => {
            const point = graph.createSVGPoint();
            const minimum = Number(graph.dataset.inputMin);
            const maximum = Number(graph.dataset.inputMax);
            point.x = Number(graph.dataset.plotLeft)
                + ((targetDb - minimum) / (maximum - minimum))
                * (Number(graph.dataset.plotRight) - Number(graph.dataset.plotLeft));
            point.y = Number(graph.dataset.plotBottom);
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, -24);
        await page.mouse.move(
            cancelThresholdBox.x + cancelThresholdBox.width / 2,
            cancelThresholdBox.y + cancelThresholdBox.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
            cancelThresholdTarget.x,
            cancelThresholdBox.y + cancelThresholdBox.height / 2,
            { steps: 4 },
        );
        await page.keyboard.press("Escape");
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(
            Math.abs(graphAction.sent.filter(message => message.endpointID === "thresholdDb").at(-1).value - (-12)) < 0.001,
            "cancel must restore the exact gesture-start value",
        );
        assert.equal(graphAction.gestureEnds.at(-1), "thresholdDb", "cancel must close host ownership exactly once");

        await page.evaluate(() => {
            window.__POLISH_LAB_TEST__.emitParameter("thresholdDb", 0);
            window.__POLISH_LAB_TEST__.emitParameter("amount", 0);
            window.__POLISH_LAB_TEST__.emitParameter("ratio", 11.4155251);
            window.__POLISH_LAB_TEST__.emitParameter("makeupDb", -0.04);
        });
        const ratioHandle = page.locator('[data-graph-handle="ratio"]');
        assert.equal(await ratioHandle.count(), 1, "ratio must be directly draggable on the transfer curve");
        const ratioBox = await ratioHandle.boundingBox();
        assert.ok(ratioBox.width >= 44 && ratioBox.height >= 44, "ratio needs a touch-sized target");
        const ratioTarget = await compressorGraph.evaluate((graph, outputDb) => {
            const point = graph.createSVGPoint();
            const minimum = Number(graph.dataset.outputMin);
            const maximum = Number(graph.dataset.outputMax);
            const plotTop = Number(graph.dataset.plotTop);
            const plotBottom = Number(graph.dataset.plotBottom);
            point.x = Number(graph.dataset.plotRight);
            point.y = plotBottom - ((outputDb - minimum) / (maximum - minimum)) * (plotBottom - plotTop);
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, -0.04 + 12 / 20);
        const sendsBeforeRatio = graphAction.sent.length;
        await page.mouse.move(ratioBox.x + ratioBox.width / 2, ratioBox.y + ratioBox.height / 2);
        await page.mouse.down();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(graphAction.sent.length, sendsBeforeRatio, "acquiring ratio must not jump the value");
        await page.mouse.move(ratioBox.x + ratioBox.width / 2, ratioTarget.y, { steps: 4 });
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const ratioWrite = graphAction.sent.filter(message => message.endpointID === "ratio").at(-1);
        assert.ok(Math.abs(ratioWrite.value - 20) < 0.01, "ratio drag must write the exact DSP-facing ratio");
        assert.equal(graphAction.gestureStarts.at(-1), "ratio");
        assert.equal(graphAction.gestureEnds.at(-1), "ratio");

        const thresholdGeometryBeforeKnob = await thresholdHandle.getAttribute("transform");
        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("thresholdDb", -6));
        assert.notEqual(
            await thresholdHandle.getAttribute("transform"),
            thresholdGeometryBeforeKnob,
            "a host/knob parameter update must move graph geometry immediately",
        );
        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("thresholdDb", 0));

        await page.evaluate(() => {
            window.__POLISH_LAB_TEST__.emitParameter("amount", 100);
            window.__POLISH_LAB_TEST__.emitParameter("macroRatioTarget", 1000);
            window.__POLISH_LAB_TEST__.emitParameter("macroMakeupDb", 4.12);
        });
        const targetOwnedRatioBox = await ratioHandle.boundingBox();
        const targetOwnedRatioPoint = await compressorGraph.evaluate((graph, outputDb) => {
            const point = graph.createSVGPoint();
            const minimum = Number(graph.dataset.outputMin);
            const maximum = Number(graph.dataset.outputMax);
            point.x = Number(graph.dataset.plotRight);
            point.y = Number(graph.dataset.plotBottom)
                - ((outputDb - minimum) / (maximum - minimum))
                * (Number(graph.dataset.plotBottom) - Number(graph.dataset.plotTop));
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, 4.08 + 12 / 4);
        const writesBeforeTargetRatio = graphAction.sent.length;
        await page.mouse.move(
            targetOwnedRatioBox.x + targetOwnedRatioBox.width / 2,
            targetOwnedRatioBox.y + targetOwnedRatioBox.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
            targetOwnedRatioBox.x + targetOwnedRatioBox.width / 2,
            targetOwnedRatioPoint.y,
            { steps: 5 },
        );
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const targetRatioWrites = graphAction.sent.slice(writesBeforeTargetRatio);
        assert.ok(Math.abs(targetRatioWrites.filter(message => message.endpointID === "macroRatioTarget").at(-1).value - 4) < 0.01);
        assert.equal(targetRatioWrites.some(message => message.endpointID === "ratio"), false);
        assert.equal(graphAction.gestureStarts.at(-1), "macroRatioTarget");
        assert.equal(graphAction.gestureEnds.at(-1), "macroRatioTarget");
        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("amount", 0));

        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("kneeDb", 0));
        const kneeHandle = page.locator('[data-graph-handle="knee"]');
        assert.equal(await kneeHandle.count(), 1, "knee width must be directly draggable on the curve");
        const kneeBox = await kneeHandle.boundingBox();
        assert.ok(kneeBox.width >= 44 && kneeBox.height >= 44, "knee needs a touch-sized target");
        const kneeTarget = await compressorGraph.evaluate((graph, inputDb) => {
            const point = graph.createSVGPoint();
            const minimum = Number(graph.dataset.inputMin);
            const maximum = Number(graph.dataset.inputMax);
            const plotLeft = Number(graph.dataset.plotLeft);
            const plotRight = Number(graph.dataset.plotRight);
            point.x = plotLeft + ((inputDb - minimum) / (maximum - minimum)) * (plotRight - plotLeft);
            point.y = Number(graph.dataset.plotBottom);
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, 6);
        await page.mouse.move(kneeBox.x + kneeBox.width / 2, kneeBox.y + kneeBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(kneeTarget.x, kneeBox.y + kneeBox.height / 2, { steps: 4 });
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const kneeWrite = graphAction.sent.filter(message => message.endpointID === "kneeDb").at(-1);
        assert.ok(Math.abs(kneeWrite.value - 12) < 0.001, "knee drag must write the exact DSP-facing width");
        assert.equal(graphAction.gestureStarts.at(-1), "kneeDb");
        assert.equal(graphAction.gestureEnds.at(-1), "kneeDb");

        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("makeupDb", -0.04));
        const makeupHandle = page.locator('[data-graph-handle="makeup"]');
        assert.equal(await makeupHandle.count(), 1, "makeup must be directly draggable on the curve");
        const makeupBox = await makeupHandle.boundingBox();
        assert.ok(makeupBox.width >= 44 && makeupBox.height >= 44, "makeup needs a touch-sized target");
        const makeupTarget = await compressorGraph.evaluate((graph, outputDb) => {
            const point = graph.createSVGPoint();
            const minimum = Number(graph.dataset.outputMin);
            const maximum = Number(graph.dataset.outputMax);
            const plotTop = Number(graph.dataset.plotTop);
            const plotBottom = Number(graph.dataset.plotBottom);
            point.x = Number(graph.dataset.plotLeft);
            point.y = plotBottom - ((outputDb - minimum) / (maximum - minimum)) * (plotBottom - plotTop);
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, -33);
        await page.mouse.move(makeupBox.x + makeupBox.width / 2, makeupBox.y + makeupBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(makeupBox.x + makeupBox.width / 2, makeupTarget.y, { steps: 4 });
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const makeupWrite = graphAction.sent.filter(message => message.endpointID === "makeupDb").at(-1);
        assert.ok(Math.abs(makeupWrite.value - 3) < 0.001, "makeup drag must write exact DSP-facing dB");
        assert.equal(graphAction.gestureStarts.at(-1), "makeupDb");
        assert.equal(graphAction.gestureEnds.at(-1), "makeupDb");

        const clipperGraph = page.locator('[data-transfer-graph="clipper"]');
        const driveHandle = page.locator('[data-graph-handle="drive"]');
        assert.equal(await clipperGraph.count(), 1, "the exact clipper transfer graph must be present");
        const decodedCeilingSegment = page.locator('[data-curve-segment="3"]');
        await decodedCeilingSegment.scrollIntoViewIfNeeded();
        const decodedCeilingSegmentPoint = await decodedCeilingSegment.evaluate(segment => {
            const point = segment.getPointAtLength(segment.getTotalLength() * 0.5);
            const screen = point.matrixTransform(segment.getScreenCTM());
            return { x: screen.x, y: screen.y };
        });
        const ceilingSegmentWritesBeforeAcquire = graphAction.sent.length;
        await page.mouse.move(decodedCeilingSegmentPoint.x, decodedCeilingSegmentPoint.y);
        await page.mouse.down();
        const acquiredDecodedCeilingSegment = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(
            acquiredDecodedCeilingSegment.sent.length,
            ceilingSegmentWritesBeforeAcquire,
            "acquiring the decoded ceiling transition must not jump a value",
        );
        assert.equal(
            acquiredDecodedCeilingSegment.gestureStarts.at(-1),
            "curveP3T",
            `the short decoded ceiling transition must own its bend gesture even between overlapping point targets: ${JSON.stringify(acquiredDecodedCeilingSegment.lastGraphPointerTarget)}`,
        );
        await page.mouse.up();
        const releasedDecodedCeilingSegment = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(releasedDecodedCeilingSegment.gestureEnds.at(-1), "curveP3T");
        assert.equal(await driveHandle.count(), 1, "Drive must be directly draggable on the clipper curve");
        await driveHandle.scrollIntoViewIfNeeded();
        const driveBox = await driveHandle.boundingBox();
        assert.ok(driveBox.width >= 44 && driveBox.height >= 44, "Drive needs a touch-sized target");
        const targetDriveInput = 0.799438202 / (10 ** (6 / 20));
        const driveTarget = await clipperGraph.evaluate((graph, input) => {
            const point = graph.createSVGPoint();
            const minimum = Number(graph.dataset.inputMin);
            const maximum = Number(graph.dataset.inputMax);
            const plotLeft = Number(graph.dataset.plotLeft);
            const plotRight = Number(graph.dataset.plotRight);
            point.x = plotLeft + ((input - minimum) / (maximum - minimum)) * (plotRight - plotLeft);
            point.y = Number(graph.dataset.plotBottom);
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, targetDriveInput);
        await page.mouse.move(driveBox.x + driveBox.width / 2, driveBox.y + driveBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(driveTarget.x, driveBox.y + driveBox.height / 2, { steps: 5 });
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const driveWrite = graphAction.sent.filter(message => message.endpointID === "clipDriveDb").at(-1);
        assert.ok(Math.abs(driveWrite.value - 6) < 0.001, "Drive drag must write exact DSP-facing dB");
        assert.equal(graphAction.gestureStarts.at(-1), "clipDriveDb");
        assert.equal(graphAction.gestureEnds.at(-1), "clipDriveDb");

        const knot1Handle = page.locator('[data-graph-handle="knot1"]');
        assert.equal(await knot1Handle.count(), 1, "Point 1 must have one directly manipulable two-dimensional handle");
        const knot1Box = await knot1Handle.boundingBox();
        assert.ok(knot1Box.width >= 44 && knot1Box.height >= 44, "Knot 1 needs a touch-sized target");
        const knot1Target = await clipperGraph.evaluate((graph, target) => {
            const driveGain = 10 ** (target.driveDb / 20);
            const input = target.drivenInput / driveGain;
            const point = graph.createSVGPoint();
            const inputMinimum = Number(graph.dataset.inputMin);
            const inputMaximum = Number(graph.dataset.inputMax);
            const outputMinimum = Number(graph.dataset.outputMin);
            const outputMaximum = Number(graph.dataset.outputMax);
            point.x = Number(graph.dataset.plotLeft)
                + ((input - inputMinimum) / (inputMaximum - inputMinimum))
                * (Number(graph.dataset.plotRight) - Number(graph.dataset.plotLeft));
            point.y = Number(graph.dataset.plotBottom)
                - ((target.output - outputMinimum) / (outputMaximum - outputMinimum))
                * (Number(graph.dataset.plotBottom) - Number(graph.dataset.plotTop));
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, { drivenInput: 0.6, output: 0.5, driveDb: 6 });
        const knotWritesBeforeDrag = graphAction.sent.length;
        await page.mouse.move(knot1Box.x + knot1Box.width / 2, knot1Box.y + knot1Box.height / 2);
        await page.mouse.down();
        const acquiredKnot = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(acquiredKnot.sent.length, knotWritesBeforeDrag, "point acquisition must not jump either coordinate");
        await page.mouse.move(knot1Target.x, knot1Target.y, { steps: 5 });
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const knotWrites = graphAction.sent.slice(knotWritesBeforeDrag);
        assert.ok(Math.abs(knotWrites.filter(message => message.endpointID === "curveP1X").at(-1).value - 0.6) < 0.001);
        assert.ok(Math.abs(knotWrites.filter(message => message.endpointID === "curveP1Y").at(-1).value - 0.5) < 0.001);
        assert.deepEqual(graphAction.gestureStarts.slice(-2), ["curveP1X", "curveP1Y"]);
        assert.deepEqual(graphAction.gestureEnds.slice(-2), ["curveP1X", "curveP1Y"]);

        const knotCurveBeforeCancel = graphAction.clipperCurvePath;
        const cancelKnotBox = await knot1Handle.boundingBox();
        await page.mouse.move(
            cancelKnotBox.x + cancelKnotBox.width / 2,
            cancelKnotBox.y + cancelKnotBox.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
            cancelKnotBox.x + cancelKnotBox.width / 2 + 32,
            cancelKnotBox.y + cancelKnotBox.height / 2 + 24,
            { steps: 4 },
        );
        await page.keyboard.press("Escape");
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(Math.abs(graphAction.sent.filter(message => message.endpointID === "curveP1X").at(-1).value - 0.6) < 0.001);
        assert.ok(Math.abs(graphAction.sent.filter(message => message.endpointID === "curveP1Y").at(-1).value - 0.5) < 0.001);
        assert.deepEqual(graphAction.gestureEnds.slice(-2), ["curveP1X", "curveP1Y"]);
        assert.equal(graphAction.clipperCurvePath, knotCurveBeforeCancel, "cancel must restore both coordinates and geometry");

        const knot2Handle = page.locator('[data-graph-handle="knot2"]');
        const knot3Handle = page.locator('[data-graph-handle="knot3"]');
        for (const [label, handle] of [
            ["Knot 2", knot2Handle],
            ["Ceiling", knot3Handle],
        ]) {
            assert.equal(await handle.count(), 1, `${label} must be directly draggable`);
            const box = await handle.boundingBox();
            assert.ok(box.width >= 44 && box.height >= 44, `${label} needs a touch-sized target`);
        }

        let knot2Box = await knot2Handle.boundingBox();
        const knot2InputTarget = await clipperGraph.evaluate((graph, drivenInput) => {
            const input = drivenInput / (10 ** (6 / 20));
            const point = graph.createSVGPoint();
            const minimum = Number(graph.dataset.inputMin);
            const maximum = Number(graph.dataset.inputMax);
            point.x = Number(graph.dataset.plotLeft)
                + ((input - minimum) / (maximum - minimum))
                * (Number(graph.dataset.plotRight) - Number(graph.dataset.plotLeft));
            point.y = Number(graph.dataset.plotBottom);
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, 0.8);
        await page.mouse.move(knot2Box.x + knot2Box.width / 2, knot2Box.y + knot2Box.height / 2);
        await page.mouse.down();
        await page.mouse.move(knot2InputTarget.x, knot2Box.y + knot2Box.height / 2, { steps: 5 });
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const knot2InputWrite = graphAction.sent.filter(message => message.endpointID === "curveP2X").at(-1);
        assert.ok(knot2InputWrite, JSON.stringify({
            recentSent: graphAction.sent.slice(-6),
            recentGestureStarts: graphAction.gestureStarts.slice(-6),
            recentGestureEnds: graphAction.gestureEnds.slice(-6),
        }));
        assert.ok(Math.abs(knot2InputWrite.value - 0.8) < 0.001);

        const knot3Box = await knot3Handle.boundingBox();
        const knot3OutputTarget = await clipperGraph.evaluate((graph, output) => {
            const point = graph.createSVGPoint();
            const minimum = Number(graph.dataset.outputMin);
            const maximum = Number(graph.dataset.outputMax);
            point.x = Number(graph.dataset.plotLeft);
            point.y = Number(graph.dataset.plotBottom)
                - ((output - minimum) / (maximum - minimum))
                * (Number(graph.dataset.plotBottom) - Number(graph.dataset.plotTop));
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, 1.2);
        await page.mouse.move(knot3Box.x + knot3Box.width / 2, knot3Box.y + knot3Box.height / 2);
        await page.mouse.down();
        await page.mouse.move(knot3Box.x + knot3Box.width / 2, knot3OutputTarget.y, { steps: 5 });
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(Math.abs(graphAction.sent.filter(message => message.endpointID === "curveP3Y").at(-1).value - 1.2) < 0.001);

        const segmentHandles = [1, 2, 3].map(index => page.locator(`[data-curve-segment="${index}"]`));
        for (const [index, segment] of segmentHandles.entries()) {
            assert.equal(await segment.count(), 1, `curve segment ${index + 1} must itself own bending gestures`);
            assert.equal(
                await segment.evaluate(element => getComputedStyle(element).pointerEvents),
                "stroke",
                `curve segment ${index + 1} must own only its visible touch-width path`,
            );
        }
        const segment2 = segmentHandles[1];
        const segment2Start = await segment2.evaluate(segment => {
            const point = segment.getPointAtLength(segment.getTotalLength() * 0.5);
            const screen = point.matrixTransform(segment.getScreenCTM());
            return { svgX: point.x, svgY: point.y, screenX: screen.x, screenY: screen.y };
        });
        const segmentWritesBefore = graphAction.sent.length;
        const segmentReferenceBefore = graphAction.decodedClipperCurvePath;
        const segmentCurveBefore = graphAction.clipperCurvePath;
        await page.mouse.move(segment2Start.screenX, segment2Start.screenY);
        await page.mouse.down();
        const acquiredSegment = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(acquiredSegment.sent.length, segmentWritesBefore, "grabbing the curve must not jump its shape");
        const segment2Target = await clipperGraph.evaluate((graph, target) => {
            const point = graph.createSVGPoint();
            point.x = target.svgX;
            point.y = target.svgY - target.tensionDelta
                * (Number(graph.dataset.plotBottom) - Number(graph.dataset.plotTop)) / 2;
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, { ...segment2Start, tensionDelta: 0.5 });
        await page.mouse.move(segment2Target.x, segment2Target.y, { steps: 5 });
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(
            Math.abs(graphAction.sent.filter(message => message.endpointID === "curveP2T").at(-1).value - 0.5) < 0.001,
            "dragging the visible segment must write its exact DSP-facing curvature value",
        );
        assert.equal(graphAction.gestureStarts.at(-1), "curveP2T");
        assert.equal(graphAction.gestureEnds.at(-1), "curveP2T");
        assert.notEqual(graphAction.clipperCurvePath, segmentCurveBefore);
        assert.equal(graphAction.decodedClipperCurvePath, segmentReferenceBefore, "design edits must never move the decoded reference");

        const curvedSegmentBeforeCancel = graphAction.clipperCurvePath;
        const segmentCancelStart = await segment2.evaluate(segment => {
            const point = segment.getPointAtLength(segment.getTotalLength() * 0.5);
            const screen = point.matrixTransform(segment.getScreenCTM());
            return { x: screen.x, y: screen.y };
        });
        await page.mouse.move(segmentCancelStart.x, segmentCancelStart.y);
        await page.mouse.down();
        await page.mouse.move(segmentCancelStart.x, segmentCancelStart.y + 36, { steps: 4 });
        await page.keyboard.press("Escape");
        await page.mouse.up();
        graphAction = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(Math.abs(graphAction.sent.filter(message => message.endpointID === "curveP2T").at(-1).value - 0.5) < 0.001);
        assert.equal(graphAction.gestureEnds.at(-1), "curveP2T");
        assert.equal(graphAction.clipperCurvePath, curvedSegmentBeforeCancel, "cancel must restore the grabbed segment exactly");

        await page.evaluate(() => window.__POLISH_LAB_TEST__.click("[data-reset]"));
        await page.evaluate(() => window.__POLISH_LAB_TEST__.click("[data-curve-start-editor]"));
        await page.waitForFunction(() => window.__POLISH_LAB_TEST__.snapshot().parameterValues.curveEditorEnabled === true);
        let editorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(editorState.curveEditor.mode, "Point editor");
        assert.equal(editorState.curveEditor.selected, "Point 1");
        assert.equal(editorState.curveEditor.pointCount, 3);
        assert.equal(editorState.curveEditor.bendCount, 3);
        assert.equal(editorState.curveEditor.addDisabled, false);
        assert.equal(editorState.curveEditor.removeDisabled, false);
        assert.equal(editorState.curveEditor.amountDisabled, false);
        assert.equal(editorState.parameterValues.curveEditorInitialized, true);
        assert.equal(editorState.parameterValues.curvePointCount, 3);
        assert.deepEqual(
            [1, 2, 3].map(index => editorState.parameterValues[`curveB${index}`]),
            [0, 0, 0],
            "entering the editor must explicitly replace decoded interpolation with straight segments",
        );
        assert.ok(Math.abs(Number(editorState.curveEditor.exactInput) - 0.799438202) < 1e-6);
        assert.ok(Math.abs(Number(editorState.curveEditor.exactOutput) - 0.717642209) < 1e-6);
        assert.equal(Number(editorState.curveEditor.exactBend), 0);

        const editorPoint2 = page.locator('[data-editor-point="2"]');
        assert.equal(await editorPoint2.count(), 1);
        let editorPoint2Box = await editorPoint2.boundingBox();
        assert.ok(editorPoint2Box.width >= 44 && editorPoint2Box.height >= 44);
        await page.mouse.click(
            editorPoint2Box.x + editorPoint2Box.width / 2,
            editorPoint2Box.y + editorPoint2Box.height / 2,
        );
        await page.locator("[data-curve-remove]").click();
        editorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(editorState.parameterValues.curvePointCount, 2);
        assert.equal(editorState.curveEditor.pointCount, 2);
        assert.equal(editorState.curveEditor.bendCount, 2);

        await page.locator("[data-curve-add]").click();
        const addPointTarget = await clipperGraph.evaluate((graph, input) => {
            const point = graph.createSVGPoint();
            point.x = Number(graph.dataset.plotLeft)
                + input / Number(graph.dataset.inputMax)
                * (Number(graph.dataset.plotRight) - Number(graph.dataset.plotLeft));
            point.y = (Number(graph.dataset.plotTop) + Number(graph.dataset.plotBottom)) * 0.5;
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, 0.85);
        await page.mouse.click(addPointTarget.x, addPointTarget.y);
        editorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(editorState.parameterValues.curvePointCount, 3);
        assert.equal(editorState.curveEditor.pointCount, 3);
        assert.equal(editorState.curveEditor.selected, "Point 2");
        assert.ok(
            Math.abs(editorState.parameterValues.curveP2X - 0.85 * (10 ** (-0.0192 / 20))) < 0.001,
            "the added point must store the driven input represented by the graph position",
        );
        const editorBend2StartValue = editorState.parameterValues.curveB2;

        const editorBend2 = page.locator('[data-graph-handle="bend2"]');
        assert.equal(await editorBend2.count(), 1, "each editable segment needs one visible bend handle");
        const editorBend2Box = await editorBend2.boundingBox();
        assert.ok(
            editorBend2Box.width >= 44 && editorBend2Box.height >= 44,
            `bend handle needs a touch-sized target: ${JSON.stringify(editorBend2Box)}`,
        );
        const bendTarget = await clipperGraph.evaluate((graph, start) => {
            const point = graph.createSVGPoint();
            point.x = start.svgX;
            point.y = start.svgY - 0.25 * (Number(graph.dataset.plotBottom) - Number(graph.dataset.plotTop));
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, await editorBend2.evaluate(handle => {
            const transform = handle.transform.baseVal.consolidate().matrix;
            return { svgX: transform.e, svgY: transform.f };
        }));
        await page.mouse.move(
            editorBend2Box.x + editorBend2Box.width / 2,
            editorBend2Box.y + editorBend2Box.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(bendTarget.x, bendTarget.y, { steps: 5 });
        await page.mouse.up();
        editorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.ok(
            Math.abs(editorState.parameterValues.curveB2 - Math.min(1, editorBend2StartValue + 0.5)) < 0.001,
        );
        assert.equal(editorState.gestureStarts.at(-1), "curveB2");
        assert.equal(editorState.gestureEnds.at(-1), "curveB2");

        const editorPoint1 = page.locator('[data-editor-point="1"]');
        const editorPoint1Box = await editorPoint1.boundingBox();
        await page.mouse.click(
            editorPoint1Box.x + editorPoint1Box.width / 2,
            editorPoint1Box.y + editorPoint1Box.height / 2,
        );
        await page.locator("[data-curve-link-amount]").click();
        editorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(editorState.parameterValues.curveAmountPoint, 1);
        assert.equal(editorState.curveEditor.amountTargetCount, 1);
        assert.ok(Math.abs(editorState.parameterValues.curveAmountTargetX - editorState.parameterValues.curveP1X) < 1e-9);
        assert.ok(Math.abs(editorState.parameterValues.curveAmountTargetY - editorState.parameterValues.curveP1Y) < 1e-9);

        const amountTargetHandle = page.locator('[data-graph-handle="amountTarget"]');
        const amountTargetBox = await amountTargetHandle.boundingBox();
        assert.ok(amountTargetBox.width >= 44 && amountTargetBox.height >= 44);
        const editorPoint2SelectBox = await page.locator('[data-editor-point="2"]').boundingBox();
        await page.mouse.click(
            editorPoint2SelectBox.x + editorPoint2SelectBox.width / 2,
            editorPoint2SelectBox.y + editorPoint2SelectBox.height / 2,
        );
        assert.equal(
            (await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot())).curveEditor.selected,
            "Point 2",
        );
        const amountTarget = await clipperGraph.evaluate((graph, target) => {
            const point = graph.createSVGPoint();
            point.x = Number(graph.dataset.plotLeft)
                + target.x / Number(graph.dataset.inputMax)
                * (Number(graph.dataset.plotRight) - Number(graph.dataset.plotLeft));
            point.y = Number(graph.dataset.plotBottom)
                - target.y / Number(graph.dataset.outputMax)
                * (Number(graph.dataset.plotBottom) - Number(graph.dataset.plotTop));
            const screen = point.matrixTransform(graph.getScreenCTM());
            return { x: screen.x, y: screen.y };
        }, { x: 0.65, y: 0.74 });
        const curveBeforeAmountTargetEdit = editorState.clipperCurvePath;
        await page.mouse.move(
            amountTargetBox.x + amountTargetBox.width / 2,
            amountTargetBox.y + amountTargetBox.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(amountTarget.x, amountTarget.y, { steps: 5 });
        await page.mouse.up();
        editorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(editorState.curveEditor.selected, "Point 1", "the Amount target must select its owning point");
        assert.ok(
            Math.abs(editorState.parameterValues.curveAmountTargetX - 0.65 * (10 ** (-0.0192 / 20))) < 0.001,
            `unexpected Amount target input ${editorState.parameterValues.curveAmountTargetX}`,
        );
        assert.ok(
            Math.abs(editorState.parameterValues.curveAmountTargetY - 0.74) < 0.001,
            `unexpected Amount target output ${editorState.parameterValues.curveAmountTargetY}`,
        );
        assert.equal(
            editorState.clipperCurvePath,
            curveBeforeAmountTargetEdit,
            "editing the 100% target at Amount 0 must not move the currently heard curve",
        );

        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("amount", 100));
        const fullAmountEditorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.notEqual(fullAmountEditorState.clipperCurvePath, curveBeforeAmountTargetEdit);
        assert.equal(fullAmountEditorState.graphHandles.amountCurrent, fullAmountEditorState.graphHandles.amountTarget);

        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("amount", 0));
        await page.locator("[data-curve-exact-x]").fill("0.58");
        await page.locator("[data-curve-exact-x]").press("Enter");
        await page.locator("[data-curve-exact-bend]").fill("0.25");
        await page.locator("[data-curve-exact-bend]").press("Enter");
        editorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(editorState.parameterValues.curveP1X, 0.58);
        assert.equal(editorState.parameterValues.curveB1, 0.25);
        const resumableEditorPath = editorState.clipperCurvePath;
        await page.locator("[data-curve-start-editor]").click();
        editorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(editorState.curveEditor.mode, "Decoded curve");
        assert.equal(editorState.curveEditor.startButton, "Resume point editor");
        await page.locator("[data-curve-start-editor]").click();
        editorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(editorState.clipperCurvePath, resumableEditorPath, "resuming must preserve the editor shape");
        assert.equal(editorState.parameterValues.curveB1, 0.25);
        assert.equal(editorState.parameterValues.curveAmountPoint, 1);
        if (process.env.POLISH_LAB_EDITOR_SCREENSHOT)
            await page.screenshot({ path: process.env.POLISH_LAB_EDITOR_SCREENSHOT, fullPage: true });

        await page.locator('[data-endpoint-id="macroCurve"]').hover();
        await page.waitForFunction(() => window.__POLISH_LAB_TEST__.snapshot().tooltip?.visible);
        const tooltipVisible = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.match(tooltipVisible.tooltip.text, /Amount \^ Amount Curve/);
        assert.equal(tooltipVisible.tooltip.ariaHidden, "false");
        assert.ok(tooltipVisible.tooltip.left >= 0);
        assert.ok(tooltipVisible.tooltip.top >= 0);
        assert.ok(tooltipVisible.tooltip.right <= tooltipVisible.tooltip.viewportWidth);
        assert.ok(tooltipVisible.tooltip.bottom <= tooltipVisible.tooltip.viewportHeight);

        await page.locator("[data-reset]").hover();
        await page.waitForFunction(() => !window.__POLISH_LAB_TEST__.snapshot().tooltip?.visible);

        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitParameter("curveP1X", 0.4));
        const changed = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.notEqual(changed.clipperCurvePath, initial.clipperCurvePath);

        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitMeter({
            inputPeakDb: -2,
            outputPeakDb: -1,
            inputRmsDb: -18,
            outputRmsDb: -17.5,
            gainReductionDb: 3.25,
            clipActivityPercent: 12.5,
            compressorInputDb: -6,
            compressorOutputDb: -8,
            clipInput: 0.5,
            clipOutput: 0.9,
        }));
        const metered = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(metered.meterDelta, "+0.5 dB");
        assert.equal(metered.meterGr, "-3.3 dB");
        assert.equal(metered.meterClip, "12.5%");
        const operatingTelemetry = await compressorOperatingPoint.evaluate(point => ({
            active: point.dataset.active,
            inputDb: Number(point.dataset.inputDb),
            outputDb: Number(point.dataset.outputDb),
            cx: Number(point.getAttribute("cx")),
            cy: Number(point.getAttribute("cy")),
        }));
        assert.deepEqual(
            { active: operatingTelemetry.active, inputDb: operatingTelemetry.inputDb, outputDb: operatingTelemetry.outputDb },
            { active: "true", inputDb: -6, outputDb: -8 },
        );
        assert.ok(Math.abs(operatingTelemetry.cx - 522.8) < 0.01, "telemetry input must map to the graph X scale");
        assert.ok(Math.abs(operatingTelemetry.cy - 131.333333) < 0.01, "telemetry output must map to the graph Y scale");
        assert.equal(await gainReductionTrace.getAttribute("data-sample-count"), "1");
        assert.match(await gainReductionTrace.getAttribute("d"), /^M/);
        const clipperTelemetry = await clipperOperatingPoint.evaluate(point => ({
            active: point.dataset.active,
            clipped: point.dataset.clipped,
            input: Number(point.dataset.input),
            output: Number(point.dataset.output),
            cx: Number(point.getAttribute("cx")),
            cy: Number(point.getAttribute("cy")),
        }));
        assert.deepEqual(
            {
                active: clipperTelemetry.active,
                clipped: clipperTelemetry.clipped,
                input: clipperTelemetry.input,
                output: clipperTelemetry.output,
            },
            { active: "true", clipped: "true", input: 0.5, output: 0.9 },
        );
        assert.ok(Math.abs(clipperTelemetry.cx - 279.333333) < 0.01);
        assert.ok(Math.abs(clipperTelemetry.cy - 152.8) < 0.01);

        await page.evaluate(() => window.__POLISH_LAB_TEST__.emitMeter({
            gainReductionDb: 3.25,
            clipInput: -0.5,
            clipOutput: -0.9,
        }));
        const negativeTelemetry = await clipperOperatingPoint.evaluate(point => ({
            input: Number(point.dataset.input),
            output: Number(point.dataset.output),
            cx: Number(point.getAttribute("cx")),
            cy: Number(point.getAttribute("cy")),
        }));
        assert.deepEqual(
            { input: negativeTelemetry.input, output: negativeTelemetry.output },
            { input: -0.5, output: -0.9 },
            "telemetry must retain the real signed sample",
        );
        assert.ok(Math.abs(negativeTelemetry.cx - clipperTelemetry.cx) < 0.001);
        assert.ok(Math.abs(negativeTelemetry.cy - clipperTelemetry.cy) < 0.001);
        assert.equal(await gainReductionTrace.getAttribute("data-sample-count"), "2");

        await page.evaluate(() => window.__POLISH_LAB_TEST__.click("[data-compare]"));
        let actioned = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.deepEqual(actioned.sent.at(-1), { endpointID: "bypass", value: true });

        await page.evaluate(() => window.__POLISH_LAB_TEST__.click("[data-reset]"));
        actioned = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        const resetByID = new Map(actioned.sent.map(message => [message.endpointID, message.value]));
        assert.equal(resetByID.get("attackMs"), 0.205116218);
        assert.equal(resetByID.get("releaseMs"), 26.7916832);
        assert.equal(resetByID.get("curveP3T"), -0.72);
        assert.equal(resetByID.get("bypass"), false);
        assert.equal(actioned.compressorCurvePath, initial.compressorCurvePath);
        assert.equal(actioned.clipperCurvePath, initial.clipperCurvePath);
        assert.equal(actioned.decodedClipperCurvePath, initial.decodedClipperCurvePath);
        assert.deepEqual(actioned.graphHandles, initial.graphHandles, "decoded reset must reproduce every graph handle");

        const restorableGraphState = {
            thresholdDb: -9,
            kneeDb: 7,
            ratio: 6,
            makeupDb: 2,
            amount: 0,
            clipDriveDb: 5,
            clipMix: 82,
            curveP1X: 0.31,
            curveP1Y: 0.5,
            curveP1T: -0.3,
            curveP2X: 0.84,
            curveP2Y: 0.9,
            curveP2T: 0.4,
            curveP3X: 1.02,
            curveP3Y: 1.05,
            curveP3T: -0.1,
        };
        await page.evaluate(state => {
            for (const [endpointID, value] of Object.entries(state))
                window.__POLISH_LAB_TEST__.emitParameter(endpointID, value);
        }, restorableGraphState);
        const savedGraphState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.notEqual(savedGraphState.compressorCurvePath, initial.compressorCurvePath);
        assert.notEqual(savedGraphState.clipperCurvePath, initial.clipperCurvePath);
        assert.equal(savedGraphState.decodedClipperCurvePath, initial.decodedClipperCurvePath);

        await page.evaluate(() => window.__POLISH_LAB_TEST__.click("[data-reset]"));
        await page.evaluate(state => {
            for (const [endpointID, value] of Object.entries(state))
                window.__POLISH_LAB_TEST__.emitParameter(endpointID, value);
        }, restorableGraphState);
        const restoredGraphState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(restoredGraphState.compressorCurvePath, savedGraphState.compressorCurvePath);
        assert.equal(restoredGraphState.clipperCurvePath, savedGraphState.clipperCurvePath);
        assert.equal(restoredGraphState.decodedClipperCurvePath, savedGraphState.decodedClipperCurvePath);
        assert.deepEqual(restoredGraphState.graphHandles, savedGraphState.graphHandles);

        const restorableEditorState = {
            thresholdDb: -9,
            kneeDb: 7,
            ratio: 6,
            makeupDb: 2,
            clipDriveDb: 5,
            clipMix: 82,
            amount: 73,
            macroCurve: 1.4,
            curveEditorEnabled: true,
            curveEditorInitialized: true,
            curvePointCount: 4,
            curveP1X: 0.28,
            curveP1Y: 0.42,
            curveP2X: 0.61,
            curveP2Y: 0.7,
            curveP3X: 0.93,
            curveP3Y: 0.91,
            curveP4X: 1.18,
            curveP4Y: 0.96,
            curveB1: 0,
            curveB2: 0.3,
            curveB3: -0.2,
            curveB4: 0.85,
            curveAmountPoint: 2,
            curveAmountTargetX: 0.49,
            curveAmountTargetY: 0.78,
        };
        await page.evaluate(state => {
            for (const [endpointID, value] of Object.entries(state))
                window.__POLISH_LAB_TEST__.emitParameter(endpointID, value);
        }, restorableEditorState);
        const savedEditorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(savedEditorState.curveEditor.mode, "Point editor");
        assert.equal(savedEditorState.curveEditor.pointCount, 4);
        assert.equal(savedEditorState.curveEditor.bendCount, 4);
        assert.equal(savedEditorState.curveEditor.amountTargetCount, 1);

        await page.evaluate(() => window.__POLISH_LAB_TEST__.click("[data-reset]"));
        await page.evaluate(state => {
            for (const [endpointID, value] of Object.entries(state))
                window.__POLISH_LAB_TEST__.emitParameter(endpointID, value);
        }, restorableEditorState);
        const restoredEditorState = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
        assert.equal(restoredEditorState.clipperCurvePath, savedEditorState.clipperCurvePath);
        assert.deepEqual(restoredEditorState.graphHandles, savedEditorState.graphHandles);
        for (const [endpointID, value] of Object.entries(restorableEditorState))
            assert.equal(restoredEditorState.parameterValues[endpointID], value, `${endpointID} must restore exactly`);

        await page.evaluate(() => window.__POLISH_LAB_TEST__.click("[data-reset]"));
        if (process.env.POLISH_LAB_SCREENSHOT)
            await page.screenshot({ path: process.env.POLISH_LAB_SCREENSHOT, fullPage: true });

        const rawNonMonotonicState = {
            clipDriveDb: 0,
            clipMix: 100,
            curveP1X: 1.4,
            curveP1Y: 1.2,
            curveP2X: 0.2,
            curveP2Y: 0.25,
            curveP3X: 1.49,
            curveP3Y: 1.45,
        };
        const installRawNonMonotonicState = async () => {
            await page.evaluate(state => {
                for (const [endpointID, value] of Object.entries(state))
                    window.__POLISH_LAB_TEST__.emitParameter(endpointID, value);
            }, rawNonMonotonicState);
        };
        const beginChangedPoint2Gesture = async () => {
            const box = await knot2Handle.boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            const acquired = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.deepEqual(acquired.gestureStarts.slice(-2), ["curveP2X", "curveP2Y"]);
            await page.mouse.move(
                box.x + box.width / 2 + 20,
                box.y + box.height / 2 - 20,
                { steps: 4 },
            );
            const changedGesture = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.notEqual(changedGesture.parameterValues.curveP2X, rawNonMonotonicState.curveP2X);
            assert.notEqual(changedGesture.parameterValues.curveP2Y, rawNonMonotonicState.curveP2Y);
        };
        const assertRawPoint2Restored = async cancellationChannel => {
            const cancelled = await page.evaluate(() => window.__POLISH_LAB_TEST__.snapshot());
            assert.equal(
                cancelled.parameterValues.curveP2X,
                rawNonMonotonicState.curveP2X,
                `${cancellationChannel} must restore raw non-monotonic Point 2 input`,
            );
            assert.equal(
                cancelled.parameterValues.curveP2Y,
                rawNonMonotonicState.curveP2Y,
                `${cancellationChannel} must restore raw non-monotonic Point 2 output`,
            );
            assert.deepEqual(cancelled.gestureEnds.slice(-2), ["curveP2X", "curveP2Y"]);
        };

        await installRawNonMonotonicState();
        await beginChangedPoint2Gesture();
        await page.keyboard.press("Escape");
        await page.mouse.up();
        await assertRawPoint2Restored("Escape");

        await installRawNonMonotonicState();
        await beginChangedPoint2Gesture();
        await page.evaluate(() => window.__POLISH_LAB_TEST__.cancelActivePointer());
        await page.mouse.up();
        await assertRawPoint2Restored("pointercancel");

        await installRawNonMonotonicState();
        await beginChangedPoint2Gesture();
        await page.evaluate(() => window.__POLISH_LAB_TEST__.disconnect());
        await page.mouse.up();
        await assertRawPoint2Restored("disconnect teardown");
    } finally {
        await page.close();
    }
});
