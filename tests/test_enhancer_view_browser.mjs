import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { startStaticRepoServer } from "../kit/tests/helpers/static_web_server.mjs";
import { openStockControlsView } from "./helpers/stock_controls_view_harness.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(repoRoot, "fx/enhancer/Enhancer.cmajorpatch"), "utf8"));
const sourceModule = "/fx/enhancer/view/source.tsx";
const builtModule = "/build/fx/enhancer_runtime/view/app.js";

// EnhancerPlugin.cmajor's parameters as the host reports them. Its ranges and
// defaults are constants in cmajor/Enhancer.cmajor, so they are spelled out here.
const parameter = (endpointID, min, max, init, extra = {}) => ({ endpointID, purpose: "parameter", annotation: { min, max, init, ...extra } });
const choice = (endpointID, init) => parameter(endpointID, 0, 1, init, { discrete: true, step: 1 });
const statusInputs = [
    parameter("b1FreqHzIn", 20, 20_000, 130), parameter("b1QIn", 0.1, 10, 0.71), choice("b1ModeIn", 0),
    parameter("b1MidAmountIn", 0, 1, 0), parameter("b1SideAmountIn", 0, 1, 0), choice("b1CurveIn", 1),
    parameter("b2FreqHzIn", 20, 20_000, 9000), parameter("b2QIn", 0.1, 10, 0.71), choice("b2ModeIn", 0),
    parameter("b2MidAmountIn", 0, 1, 0), parameter("b2SideAmountIn", 0, 1, 0), choice("b2CurveIn", 0),
    choice("saturationModeIn", 0), parameter("deEmphasisIn", 0, 1, 1),
];

let server;
let browser;

before(async () => {
    const build = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "enhancer"], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
    assert.equal(build.status, 0, `npm run fx:build -- enhancer failed:\n${build.stdout}${build.stderr}`);
    server = await startStaticRepoServer({ bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

async function openEnhancer(modulePath = sourceModule) {
    const { page, errors } = await openStockControlsView(browser, server, { modulePath, manifest, statusInputs });
    await page.locator(".band").first().waitFor();
    return { page, errors };
}

/** The parameter values the view wrote to the host, oldest first. */
const writes = page => page.evaluate(() => window.__LAB__.hostMessages
    .filter(message => message.type === "value").map(({ endpointID, value }) => ({ endpointID, value })));

const automate = (page, values) => page.evaluate(values => {
    for (const [endpointID, value] of Object.entries(values)) window.__LAB__.automate(endpointID, value);
}, values);

/** Drag a slider to each position in turn, as one pointer gesture. */
async function dragSlider(page, endpointID, ...positions) {
    const slider = page.locator(`[data-endpoint-id='${endpointID}'] input`);
    await slider.dispatchEvent("pointerdown");
    for (const position of positions) await slider.fill(String(position));
    await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerup")));
}

test("each band independently switches between Stereo Amount and Mid/Side amounts", async () => {
    const { page, errors } = await openEnhancer();
    try {
        const band1 = page.locator("[data-band='1']");
        const band2 = page.locator("[data-band='2']");
        assert.equal(await band1.locator("[data-role='primary-label']").textContent(), "Amount");
        assert.equal(await band1.locator("[data-role='side-control']").isHidden(), true);
        assert.equal(await band2.locator("[data-role='side-control']").isHidden(), true);

        await band1.locator("[data-mode='mid-side']").click();
        assert.equal(await band1.locator("[data-role='primary-label']").textContent(), "Mid");
        await band1.locator("[data-role='side-control']").waitFor();
        assert.equal(await band2.locator("[data-role='primary-label']").textContent(), "Amount");
        assert.equal(await band2.locator("[data-role='side-control']").isHidden(), true);

        await dragSlider(page, "b1MidAmountIn", 0.72);
        await dragSlider(page, "b1SideAmountIn", 0.23);
        await page.waitForFunction(() => window.__LAB__.hostValue("b1SideAmountIn") === 0.23);
        assert.deepEqual((await writes(page)).slice(-3), [
            { endpointID: "b1ModeIn", value: 1 },
            { endpointID: "b1MidAmountIn", value: 0.72 },
            { endpointID: "b1SideAmountIn", value: 0.23 },
        ]);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("de-emphasis is a real global control from no subtraction to full subtraction", async () => {
    const { page } = await openEnhancer();
    try {
        const control = page.locator("[data-endpoint-id='deEmphasisIn']");
        assert.equal(await control.locator("output").textContent(), "100%");

        await dragSlider(page, "deEmphasisIn", 0);
        await page.waitForFunction(() => window.__LAB__.hostValue("deEmphasisIn") === 0);
        assert.equal(await control.locator("output").textContent(), "0%");

        await automate(page, { deEmphasisIn: 0.37 });
        await control.locator("output", { hasText: "37%" }).waitFor();

        await control.locator("input").dblclick();
        await page.waitForFunction(() => window.__LAB__.hostValue("deEmphasisIn") === 1);
        assert.deepEqual((await writes(page)).slice(-1), [{ endpointID: "deEmphasisIn", value: 1 }]);
    } finally {
        await page.close();
    }
});

test("the global saturation mode switches between measured Subtle and Medium laws", async () => {
    const { page } = await openEnhancer();
    try {
        const subtle = page.locator("[data-saturation-mode='subtle']");
        const medium = page.locator("[data-saturation-mode='medium']");
        assert.equal(await subtle.getAttribute("aria-pressed"), "true");
        assert.equal(await medium.getAttribute("aria-pressed"), "false");

        await medium.click();
        await page.locator("[data-saturation-mode='medium'][aria-pressed='true']").waitFor();
        assert.deepEqual((await writes(page)).slice(-1), [{ endpointID: "saturationModeIn", value: 1 }]);

        await automate(page, { saturationModeIn: 0 });
        await page.locator("[data-saturation-mode='subtle'][aria-pressed='true']").waitFor();
    } finally {
        await page.close();
    }
});

test("the response plot follows Frequency, Q, Amount, and independent Side drive", async () => {
    const { page } = await openEnhancer();
    try {
        const primaryPath = page.locator("[data-response-band='1'][data-response-role='primary']");
        const sidePath = page.locator("[data-response-band='1'][data-response-role='side']");
        const primaryHandle = page.locator("[data-response-band='1'][data-response-role='primary-handle']");
        const amountOutput = page.locator("[data-endpoint-id='b1MidAmountIn'] output");
        const pointsAboveSixDb = () => primaryPath.evaluate(path => [...(path.getAttribute("d") ?? "").matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
            .filter(match => Number(match[2]) < 78).length);

        const dryPath = await primaryPath.getAttribute("d");
        assert.equal(await amountOutput.textContent(), "+0.0 dB");
        assert.equal(await sidePath.isHidden(), true);

        await automate(page, { b1FreqHzIn: 1000, b1MidAmountIn: 1, b1QIn: 0.1 });
        await page.locator("[data-response-band='1'][data-response-role='primary'][aria-label*='Q 0.10']").waitFor();
        const widePath = await primaryPath.getAttribute("d");
        const wideCount = await pointsAboveSixDb();

        await automate(page, { b1QIn: 10 });
        await page.locator("[data-response-band='1'][data-response-role='primary'][aria-label*='Q 10.00']").waitFor();
        const narrowPath = await primaryPath.getAttribute("d");

        assert.notEqual(widePath, dryPath);
        assert.notEqual(narrowPath, widePath);
        assert.ok(wideCount > await pointsAboveSixDb());
        assert.equal(await amountOutput.textContent(), "+12.0 dB");
        assert.equal(await primaryHandle.getAttribute("cy"), "12.00");
        assert.match(await primaryPath.getAttribute("aria-label"), /1\.00 kHz, Q 10\.00, \+12\.0 dB/);

        await automate(page, { b1ModeIn: 1, b1SideAmountIn: 0.5 });
        await sidePath.waitFor();
        await page.locator("[data-response-band='1'][data-response-role='side'][aria-label*='+6.0 dB']").waitFor();
        assert.match(await sidePath.getAttribute("aria-label"), /Band 1 Side: 1\.00 kHz, Q 10\.00, \+6\.0 dB/);
    } finally {
        await page.close();
    }
});

test("the Frequency control spans Spectre's logarithmic 20 Hz to 20 kHz range", async () => {
    const { page } = await openEnhancer();
    try {
        await dragSlider(page, "b1FreqHzIn", 0, 1);
        await page.waitForFunction(() => window.__LAB__.hostValue("b1FreqHzIn") === 20_000);
        assert.deepEqual((await writes(page)).slice(-2), [
            { endpointID: "b1FreqHzIn", value: 20 },
            { endpointID: "b1FreqHzIn", value: 20_000 },
        ]);
    } finally {
        await page.close();
    }
});

test("a slider drag is one Undo entry and one host gesture", async () => {
    const { page } = await openEnhancer();
    try {
        await dragSlider(page, "b2QIn", 2, 3, 4);
        await page.waitForFunction(() => window.__LAB__.hostValue("b2QIn") === 4);
        const gestures = await page.evaluate(() => window.__LAB__.hostMessages.filter(message => message.type !== "value"));
        assert.deepEqual(gestures, [{ type: "begin", endpointID: "b2QIn" }, { type: "end", endpointID: "b2QIn" }]);

        await page.getByRole("button", { name: "Undo", exact: true }).click();
        await page.waitForFunction(() => window.__LAB__.hostValue("b2QIn") === 0.71);
        await page.locator("[data-endpoint-id='b2QIn'] output", { hasText: "0.71" }).waitFor();
        assert.equal(await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(), true, "the whole drag was one entry");
    } finally {
        await page.close();
    }
});

test("a snapshot slot recalls the whole sound as one Undo entry", async () => {
    const { page, errors } = await openEnhancer();
    try {
        const snapshots = page.getByRole("group", { name: "Snapshots" });
        await snapshots.getByRole("button", { name: /^Snapshot A/ }).click();
        await page.locator("[data-band='2'] [data-mode='mid-side']").click();
        await page.locator("[data-saturation-mode='medium']").click();
        await page.locator("[data-saturation-mode='medium'][aria-pressed='true']").waitFor();

        await snapshots.getByRole("button", { name: /^Snapshot B/ }).click();
        await page.locator("[data-band='1'] [data-curve='tube']").click();
        await page.locator("[data-band='1'] [data-curve='tube'][aria-pressed='true']").waitFor();

        await snapshots.getByRole("button", { name: /^Snapshot A/ }).click();
        await page.locator("[data-band='1'] [data-curve='solid'][aria-pressed='true']").waitFor();
        assert.equal(await page.locator("[data-band='2'] [data-mode='mid-side']").getAttribute("aria-pressed"), "true");
        assert.equal(await page.locator("[data-saturation-mode='medium']").getAttribute("aria-pressed"), "true");

        await page.getByRole("button", { name: "Undo", exact: true }).click();
        await page.locator("[data-band='1'] [data-curve='tube'][aria-pressed='true']").waitFor();
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("the compiled production view used by the VST renders the same controls under the preset header", async () => {
    const { page, errors } = await openEnhancer(builtModule);
    try {
        await page.getByRole("combobox", { name: "Preset" }).waitFor();
        await page.getByRole("group", { name: "Snapshots" }).waitFor();
        assert.equal(await page.locator("[data-endpoint-id='deEmphasisIn']").count(), 1);
        assert.equal(await page.locator(".response-panel").count(), 1);
        await page.locator("[data-saturation-mode='medium']").click();
        await page.locator("[data-band='2'] [data-mode='mid-side']").click();
        await page.locator("[data-band='2'] [data-role='side-control']").waitFor();
        assert.equal(await page.locator("[data-band='1'] [data-role='side-control']").isHidden(), true);
        assert.deepEqual((await writes(page)).slice(-2), [
            { endpointID: "saturationModeIn", value: 1 },
            { endpointID: "b2ModeIn", value: 1 },
        ]);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("host-restored modes and character values update the real control surface", async () => {
    const { page } = await openEnhancer();
    try {
        await automate(page, { b1ModeIn: 1, b2ModeIn: 0, b1CurveIn: 0, b2CurveIn: 1, saturationModeIn: 1 });
        await page.locator("[data-band='1'] [data-mode='mid-side'][aria-pressed='true']").waitFor();
        await page.locator("[data-band='2'] [data-mode='stereo'][aria-pressed='true']").waitFor();
        await page.locator("[data-band='1'] [data-curve='tube'][aria-pressed='true']").waitFor();
        await page.locator("[data-band='2'] [data-curve='solid'][aria-pressed='true']").waitFor();
        await page.locator("[data-saturation-mode='medium'][aria-pressed='true']").waitFor();
    } finally {
        await page.close();
    }
});
