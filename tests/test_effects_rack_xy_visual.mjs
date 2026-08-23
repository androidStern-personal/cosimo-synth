import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { chromium } from "playwright";

import {
    clearHarnessDebugLog,
    getHarnessSnapshot,
    startDesktopHarnessServer,
    waitForHarnessReady,
} from "./helpers/desktop_harness_browser.mjs";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const rackCatalogPromise = loadUIModule(repoRoot, "ui/shared/rack-parameter-descriptors.ts");
const targetCatalogPromise = loadUIModule(repoRoot, "ui/shared/target-descriptor.ts");

const XY_EFFECTS = [
    { effectId: "ott", xEndpointID: "ottAmount", yEndpointID: "ottTimePercent", xScale: "linear", yScale: "log" },
    { effectId: "chorus", xEndpointID: "chorusTone", yEndpointID: "chorusFeedback", xScale: "linear", yScale: "linear" },
    { effectId: "flanger", xEndpointID: "flangerRate", yEndpointID: "flangerDepth", xScale: "log", yScale: "linear" },
    { effectId: "phaser", xEndpointID: "phaserFrequency", yEndpointID: "phaserDepth", xScale: "log", yScale: "linear" },
    { effectId: "delay", xEndpointID: "delayTime", yEndpointID: "delayFeedback", xScale: "log", yScale: "linear" },
    { effectId: "reverb", xEndpointID: "reverbSize", yEndpointID: "reverbDecay", xScale: "linear", yScale: "linear" },
];

function expectedValueFromNormalized(descriptor, normalized) {
    return descriptor.scale === "log"
        ? descriptor.min * (descriptor.max / descriptor.min) ** normalized
        : descriptor.min + ((descriptor.max - descriptor.min) * normalized);
}

function assertApproximatelyEqual(actual, expected, context) {
    const tolerance = Math.max(1e-8, Math.abs(expected) * 1e-6);
    assert.ok(
        Math.abs(Number(actual) - expected) <= tolerance,
        `${context}: expected ${expected}, received ${actual}`,
    );
}

test("the fallback X/Y table names continuous modulatable endpoints with descriptor-defined normalization", async () => {
    const rackCatalog = await rackCatalogPromise;
    const targetCatalog = await targetCatalogPromise;

    for (const expected of XY_EFFECTS) {
        const effect = rackCatalog.getRackEffectDescriptor(expected.effectId);
        assert.equal(effect.xEndpointID, expected.xEndpointID, `${expected.effectId} X endpoint`);
        assert.equal(effect.yEndpointID, expected.yEndpointID, `${expected.effectId} Y endpoint`);

        for (const [axis, endpointID, scale] of [
            ["X", expected.xEndpointID, expected.xScale],
            ["Y", expected.yEndpointID, expected.yScale],
        ]) {
            const parameter = rackCatalog.getRackParameterDescriptor(endpointID);
            assert.ok(parameter, `${expected.effectId} ${axis} parameter exists`);
            assert.equal(parameter.effectId, expected.effectId, `${expected.effectId} ${axis} ownership`);
            assert.equal(parameter.choices, undefined, `${expected.effectId} ${axis} is continuous`);
            assert.notEqual(parameter.modulationTargetIndex, null, `${expected.effectId} ${axis} is modulatable`);
            assert.equal(parameter.scale, scale, `${expected.effectId} ${axis} scale`);

            const target = targetCatalog.allTargetDescriptors().find(
                (candidate) => candidate.targetId === `${expected.effectId}.${endpointID}`,
            );
            assert.ok(target, `${expected.effectId} ${axis} target exists`);
            assert.equal(target.binding._tag, "endpoint", `${expected.effectId} ${axis} host binding`);
            assert.equal(target.binding.endpointId, endpointID, `${expected.effectId} ${axis} host endpoint`);
            assert.equal(
                target.modulationTargetKind,
                `rack.${endpointID}`,
                `${expected.effectId} ${axis} modulation endpoint`,
            );

            for (const normalized of [0, 0.25, 0.5, 0.75, 1]) {
                const engineValue = expectedValueFromNormalized(parameter, normalized);
                assertApproximatelyEqual(
                    target.binding.toEngine(normalized),
                    engineValue,
                    `${expected.effectId} ${axis} ${scale} denormalization at ${normalized}`,
                );
                assertApproximatelyEqual(
                    target.binding.fromEngine(engineValue),
                    normalized,
                    `${expected.effectId} ${axis} ${scale} normalization at ${normalized}`,
                );
            }
        }
    }
});

let server;
let browser;

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("pointer and keyboard X/Y gestures reach each tabled pair through the host binding", async () => {
    const rackCatalog = await rackCatalogPromise;
    const page = await browser.newPage();

    try {
        await page.goto(server.baseUrl, { waitUntil: "commit" });
        await waitForHarnessReady(page);

        for (const expected of XY_EFFECTS) {
            await page.locator(`[data-role="rack-quick-${expected.effectId}"]`).click();
            const visual = page.locator(
                `[data-role="rack-xy-visual"][data-effect-id="${expected.effectId}"]`,
            );
            await visual.waitFor();
            assert.equal(await visual.getAttribute("data-x-endpoint-id"), expected.xEndpointID);
            assert.equal(await visual.getAttribute("data-y-endpoint-id"), expected.yEndpointID);

            const xDescriptor = rackCatalog.getRackParameterDescriptor(expected.xEndpointID);
            const yDescriptor = rackCatalog.getRackParameterDescriptor(expected.yEndpointID);
            assert.ok(xDescriptor);
            assert.ok(yDescriptor);

            await clearHarnessDebugLog(page);
            await visual.scrollIntoViewIfNeeded();
            const bounds = await visual.boundingBox();
            assert.ok(bounds, `${expected.effectId} visual has bounds`);
            await page.mouse.click(
                bounds.x + (bounds.width * 0.75),
                bounds.y + (bounds.height * 0.25),
            );

            let snapshot = await getHarnessSnapshot(page);
            assert.deepEqual(snapshot.gestureStarts, [expected.xEndpointID, expected.yEndpointID]);
            assert.deepEqual(snapshot.gestureEnds, [expected.xEndpointID, expected.yEndpointID]);
            assert.deepEqual(
                snapshot.sentMessages.map(({ endpointID }) => endpointID),
                ["laneSlotParamValue", "laneSlotParamValue"],
            );
            assertApproximatelyEqual(
                snapshot.laneParams[expected.xEndpointID],
                expectedValueFromNormalized(xDescriptor, 0.75),
                `${expected.effectId} pointer X`,
            );
            assertApproximatelyEqual(
                snapshot.laneParams[expected.yEndpointID],
                expectedValueFromNormalized(yDescriptor, 0.75),
                `${expected.effectId} pointer Y`,
            );
            assertApproximatelyEqual(
                await visual.getAttribute("data-x-normalized"),
                0.75,
                `${expected.effectId} rendered X`,
            );
            assertApproximatelyEqual(
                await visual.getAttribute("data-y-normalized"),
                0.75,
                `${expected.effectId} rendered Y`,
            );

            await clearHarnessDebugLog(page);
            await visual.focus();
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("ArrowUp");
            snapshot = await getHarnessSnapshot(page);
            assert.deepEqual(snapshot.gestureStarts, [expected.xEndpointID, expected.yEndpointID]);
            assert.deepEqual(snapshot.gestureEnds, [expected.xEndpointID, expected.yEndpointID]);
            assert.deepEqual(
                snapshot.sentMessages.map(({ endpointID }) => endpointID),
                ["laneSlotParamValue", "laneSlotParamValue"],
            );
        }
    } finally {
        await page.close();
    }
});
