import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { startStaticRepoServer } from "../kit/tests/helpers/static_web_server.mjs";
import { displayedValue, drag, hostStatusInputs, openStockControlsView } from "./helpers/stock_controls_view_harness.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(repoRoot, "fx/spectral_chord_resonator/SpectralChordResonator.cmajorpatch"), "utf8"));
const statusInputs = await hostStatusInputs(path.join(repoRoot, "fx/spectral_chord_resonator/SpectralChordResonator.cmajor"));
const sourceModule = "/fx/spectral_chord_resonator/view/source.tsx";
const builtModule = "/build/fx/spectral_chord_resonator_runtime/view/app.js";
const PLUGIN_SIZE = { width: 980, height: 740 };

let server;
let browser;

before(async () => {
    const build = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "spectral"], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
    assert.equal(build.status, 0, `npm run fx:build -- spectral failed:\n${build.stdout}${build.stderr}`);
    server = await startStaticRepoServer({ bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

/**
 * Open the view in a host slot of `host` size. Like Cmajor, the host sizes
 * the view element inline to the manifest's 980x740. Stub controls take the
 * footprint of Cmajor's labelled knob.
 */
async function openSpectral({ modulePath = builtModule, host = PLUGIN_SIZE, values } = {}) {
    const opened = await openStockControlsView(browser, server, { modulePath, manifest, statusInputs, values });
    const { page } = opened;
    await page.setViewportSize(host);
    await page.evaluate(({ host, plugin }) => {
        const mount = document.querySelector("#mount");
        Object.assign(mount.style, { width: `${host.width}px`, height: `${host.height}px`, overflow: "hidden" });
        const view = mount.firstElementChild;
        Object.assign(view.style, { display: "block", width: `${plugin.width}px`, height: `${plugin.height}px` });
        const knobFootprint = document.createElement("style");
        knobFootprint.textContent = "stub-stock-control { height: 7rem; }";
        view.shadowRoot.append(knobFootprint);
    }, { host, plugin: PLUGIN_SIZE });
    await page.locator("#mount > *").locator(".partial-plot canvas").waitFor();
    await page.locator("#mount > *").locator("section.group").first().waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return opened;
}

const view = page => page.locator("#mount > *");
const readout = (page, name) => view(page).locator(".metric").filter({ has: page.locator(`dt:text-is("${name}")`) }).locator("dd");
const shapeName = page => view(page).locator(".shape-name");
const undo = page => page.getByRole("button", { name: "Undo", exact: true });
/** Wait until a locator's whole text is `text`. */
const untilText = (locator, text) => locator.filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`) }).waitFor();

/** Layout metrics for the plugin regions, rounded to whole pixels. */
function measure(page) {
    return page.evaluate(() => {
        const element = document.querySelector("#mount > *");
        const root = element.shadowRoot;
        const box = (target) => {
            const rect = target.getBoundingClientRect();
            return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height),
                clientHeight: Math.round(target.clientHeight), scrollHeight: Math.round(target.scrollHeight), overflowY: getComputedStyle(target).overflowY };
        };
        const canvas = root.querySelector(".partial-plot canvas");
        const bottomRow = canvas.getContext("2d").getImageData(0, Math.max(0, canvas.height - 5), canvas.width, 1).data;
        let goldPixelsAtBottom = 0;
        for (let index = 0; index < bottomRow.length; index += 4)
            if (bottomRow[index] > 190 && bottomRow[index + 1] > 130 && bottomRow[index + 1] < 210 && bottomRow[index + 2] < 130) goldPixelsAtBottom += 1;
        return {
            documentScrollWidth: document.documentElement.scrollWidth,
            documentScrollHeight: document.documentElement.scrollHeight,
            host: box(document.querySelector("#mount")),
            view: box(element),
            frame: box(root.querySelector(".frame")),
            partialEditor: box(root.querySelector(".partial-editor")),
            partialPlot: box(root.querySelector(".partial-plot")),
            canvas: { ...box(canvas), backingHeight: canvas.height, goldPixelsAtBottom },
            readouts: box(root.querySelector(".partial-readouts")),
            sidebar: box(root.querySelector(".frame-groups")),
        };
    });
}

for (const modulePath of [sourceModule, builtModule]) {
    test(`Spectral shows the kit header, the partial editor and every visible parameter in its group (${modulePath})`, async () => {
        const { page, errors } = await openSpectral({ modulePath });
        try {
            await page.getByRole("combobox", { name: "Preset" }).waitFor();
            await page.getByRole("group", { name: "Snapshots" }).waitFor();
            await undo(page).waitFor();
            assert.deepEqual(await view(page).locator("section.group h2").allTextContents(), ["Feedback", "Output", "Mask", "Voices", "Algorithm"]);
            const shown = await view(page).locator("stub-stock-control").evaluateAll(controls => controls.map(control => control.dataset.endpoint));
            assert.deepEqual(shown, statusInputs.filter(input => !input.annotation.hidden).map(input => input.endpointID), "the slot-zero guard stays hidden");
            assert.equal(await displayedValue(page, "magFeedbackIn"), 0.92, "controls show the host's current value");
            assert.equal(await shapeName(page).textContent(), "Saw 1/h");
            assert.equal(await view(page).locator(".pill").textContent(), "32 partials");
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
}

test("the partial editor fits the 980x740 plugin without scrolling and draws bars down to the zero line", async () => {
    const { page, errors } = await openSpectral();
    try {
        const metrics = await measure(page);
        const detail = JSON.stringify(metrics);
        assert.ok(metrics.documentScrollHeight <= PLUGIN_SIZE.height, `no vertical document scroll: ${detail}`);
        assert.ok(metrics.documentScrollWidth <= PLUGIN_SIZE.width, `no horizontal document scroll: ${detail}`);
        assert.equal(metrics.view.height, PLUGIN_SIZE.height);
        assert.ok(metrics.frame.bottom <= metrics.host.bottom, `the frame fits the host slot: ${detail}`);
        assert.ok(metrics.canvas.bottom <= PLUGIN_SIZE.height, `the canvas fits the plugin: ${detail}`);
        assert.ok(metrics.partialEditor.scrollHeight <= metrics.partialEditor.clientHeight + 1, `the partial editor has no inner scroll: ${detail}`);
        assert.equal(metrics.partialEditor.overflowY, "hidden");
        assert.ok(metrics.partialPlot.scrollHeight <= metrics.partialPlot.clientHeight + 1, `the plot fits its canvas: ${detail}`);
        assert.ok(metrics.readouts.bottom <= PLUGIN_SIZE.height, `the readouts fit the plugin: ${detail}`);
        assert.ok(metrics.canvas.height >= 220, `the canvas stays usable: ${detail}`);
        assert.ok(metrics.canvas.goldPixelsAtBottom > 6, `bars reach the zero line: ${detail}`);
        assert.equal(await readout(page, "Selected").textContent(), "H1 1.000");
        assert.equal(await readout(page, "Active").textContent(), "32 / 32");
        assert.equal(await readout(page, "Centroid").textContent(), "7.88");
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("in a host slot shorter than Cmajor's fixed inline height, the view follows the slot and the control column scrolls", async () => {
    const host = { width: 980, height: 600 };
    const { page, errors } = await openSpectral({ host });
    try {
        const metrics = await measure(page);
        const detail = JSON.stringify(metrics);
        assert.equal(metrics.view.height, host.height, `the view uses the slot's height, not the inline 740px: ${detail}`);
        assert.ok(metrics.frame.bottom <= metrics.host.bottom, `the frame is not clipped: ${detail}`);
        assert.ok(metrics.canvas.bottom <= metrics.host.bottom, `the canvas is not clipped: ${detail}`);
        assert.ok(metrics.partialEditor.scrollHeight <= metrics.partialEditor.clientHeight + 1, `the partial editor has no inner scroll: ${detail}`);
        assert.ok(metrics.partialPlot.scrollHeight <= metrics.partialPlot.clientHeight + 1, `the plot fits its canvas: ${detail}`);
        assert.ok(metrics.readouts.bottom <= metrics.host.bottom, `the readouts are not clipped: ${detail}`);
        assert.ok(metrics.canvas.height >= 300, `the canvas stays usable: ${detail}`);
        assert.ok(metrics.sidebar.bottom <= metrics.host.bottom, `the control column fits the slot: ${detail}`);
        assert.equal(metrics.sidebar.overflowY, "auto");
        assert.ok(metrics.sidebar.scrollHeight > metrics.sidebar.clientHeight, `the controls overflow into their own scroll area: ${detail}`);

        const voicesVisible = await page.evaluate(async () => {
            const root = document.querySelector("#mount > *").shadowRoot;
            const sidebar = root.querySelector(".frame-groups");
            const voices = [...root.querySelectorAll(".group")].find(group => group.querySelector("h2")?.textContent === "Voices");
            sidebar.scrollTop = sidebar.scrollHeight;
            await new Promise(resolve => requestAnimationFrame(resolve));
            const column = sidebar.getBoundingClientRect();
            const group = voices.getBoundingClientRect();
            return group.bottom <= column.bottom + 1 && group.top >= column.top - 1;
        });
        assert.equal(voicesVisible, true, "the Voices controls are reachable by scrolling the control column");
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("the canvas backing store follows the host when it shrinks", async () => {
    const { page, errors } = await openSpectral();
    try {
        const before = await measure(page);
        await page.evaluate(() => { document.querySelector("#mount").style.height = "520px"; });
        await page.waitForFunction(previousHeight => {
            const canvas = document.querySelector("#mount > *").shadowRoot.querySelector(".partial-plot canvas");
            const height = Math.round(canvas.getBoundingClientRect().height);
            return height < previousHeight && canvas.height === Math.max(1, Math.floor(height * (window.devicePixelRatio || 1)));
        }, before.canvas.height);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("opening the editor writes nothing to the host, whatever values it finds", async () => {
    const { page, errors } = await openSpectral({ values: { depthIn: 0.82, magFeedbackIn: 0.94, voiceReleaseSecondsIn: 7 } });
    try {
        assert.equal(await displayedValue(page, "depthIn", 0.82), 0.82);
        assert.equal(await displayedValue(page, "magFeedbackIn", 0.94), 0.94);
        await page.waitForTimeout(300);
        assert.deepEqual(await page.evaluate(() => window.__LAB__.hostMessages), []);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

/** Drag across the canvas from one harmonic to another at a fraction of the plot's height. */
async function paint(page, fromHarmonic, toHarmonic, heightFraction) {
    const canvas = view(page).locator(".partial-plot canvas");
    const box = await canvas.boundingBox();
    const plotWidth = box.width - 28;
    const plotTop = box.y + 24;
    const plotHeight = box.height - 26;
    const xOf = harmonic => box.x + 14 + plotWidth * ((harmonic - 0.5) / 32);
    const y = plotTop + plotHeight * (1 - heightFraction);
    await page.mouse.move(xOf(fromHarmonic), y);
    await page.mouse.down();
    for (let harmonic = fromHarmonic + 1; harmonic <= toHarmonic; harmonic += 1) await page.mouse.move(xOf(harmonic), y);
    await page.mouse.up();
}

test("painting partials is one Undo entry and Undo restores the shape", async () => {
    const { page, errors } = await openSpectral();
    try {
        await paint(page, 2, 6, 0.75);
        await untilText(shapeName(page), "Custom");
        const selected = await readout(page, "Selected").textContent();
        assert.match(selected, /^H6 0\.7\d\d$/);
        assert.notEqual(await readout(page, "Centroid").textContent(), "7.88");
        assert.equal(await page.evaluate(() => window.__LAB__.hostMessages.length), 0, "partial edits go to the DSP event, never a host parameter");

        await undo(page).click();
        await untilText(shapeName(page), "Saw 1/h");
        assert.equal(await readout(page, "Centroid").textContent(), "7.88");
        assert.equal(await undo(page).isDisabled(), true, "the whole drag was a single Undo entry");
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("templates, counts and transforms are each one Undo entry", async () => {
    const { page, errors } = await openSpectral();
    try {
        const templates = page.getByRole("group", { name: "Templates" });
        await templates.getByRole("button", { name: "Square odd" }).click();
        await page.getByRole("group", { name: "Active partials" }).getByRole("button", { name: "16", exact: true }).click();
        await page.getByRole("group", { name: "Transforms" }).getByRole("button", { name: "Clear" }).click();
        await untilText(readout(page, "Active"), "0 / 16");

        await undo(page).click();
        await untilText(readout(page, "Active"), "8 / 16");
        assert.equal(await view(page).locator(".pill").textContent(), "16 partials", "Undo took back only the Clear");
        await undo(page).click();
        await untilText(view(page).locator(".pill"), "32 partials");
        assert.equal(await shapeName(page).textContent(), "Square odd");
        assert.equal(await templates.getByRole("button", { name: "Square odd" }).getAttribute("aria-pressed"), "true");
        await undo(page).click();
        await untilText(shapeName(page), "Saw 1/h");
        assert.equal(await undo(page).isDisabled(), true);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("a preset holds the partial shape with the parameters, and Revert restores both as one Undo entry", async () => {
    const { page, errors } = await openSpectral();
    try {
        await page.getByRole("group", { name: "Templates" }).getByRole("button", { name: "Organ" }).click();
        await drag(page, "depthIn", 0.6);
        await page.getByRole("button", { name: "Save as new" }).click();
        await page.getByLabel("Preset name").fill("Organ Depth");
        await page.getByRole("group", { name: "Presets" }).getByRole("button", { name: "Save", exact: true }).click();
        await page.getByRole("combobox", { name: "Preset" }).locator("option", { hasText: "Organ Depth" }).waitFor({ state: "attached" });

        await page.getByRole("group", { name: "Templates" }).getByRole("button", { name: "Air" }).click();
        await drag(page, "depthIn", 0.1);
        assert.equal(await displayedValue(page, "depthIn", 0.1), 0.1);
        await page.getByRole("button", { name: "Revert" }).click();
        await untilText(shapeName(page), "Organ");
        assert.equal(await displayedValue(page, "depthIn", 0.6), 0.6);

        await undo(page).click();
        await untilText(shapeName(page), "Air");
        assert.equal(await displayedValue(page, "depthIn", 0.1), 0.1, "one Undo takes back the whole recall");
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("snapshot slots keep the partial shape they were left with", async () => {
    const { page, errors } = await openSpectral();
    try {
        const slot = name => page.getByRole("group", { name: "Snapshots" }).getByRole("button", { name: new RegExp(`^Snapshot ${name}\\b`) });
        const showsShape = name => untilText(shapeName(page), name);
        await slot("A").click();
        await slot("A").and(page.locator("[aria-pressed='true']")).waitFor();
        await page.getByRole("group", { name: "Templates" }).getByRole("button", { name: "Triangle odd" }).click();
        await showsShape("Triangle odd");
        await slot("B").click();
        await page.getByRole("group", { name: "Templates" }).getByRole("button", { name: "Pluck" }).click();
        await showsShape("Pluck");
        await slot("A").click();
        await showsShape("Triangle odd");
        await slot("B").click();
        await showsShape("Pluck");
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});
