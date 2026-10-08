import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import path from "node:path";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import { createServer } from "vite";
import { chromium } from "playwright";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "../..");
let server, browser, base;
before(async () => {
    server = await createServer({ configFile: path.join(root, "kit/examples/vite.config.mjs"), server: { port: 0 }, logLevel: "error" });
    await server.listen();
    base = `http://127.0.0.1:${server.httpServer.address().port}/sliders/`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
async function withPage(run) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try { await page.goto(base); await page.locator("#default input[type=range]").waitFor(); await run(page); assert.deepEqual(errors, []); }
    finally { await page.close(); }
}
async function drag(page, element, from, to, release = true) {
    await element.scrollIntoViewIfNeeded();
    const box = await element.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width * from, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * to, box.y + box.height / 2, { steps: 5 });
    if (release) await page.mouse.up();
}
const readout = section => section.locator("[data-slot=slider-value]").textContent();
test("default slider ships usable styling, pointer input, the shared keyboard policy and external root props", () => withPage(async page => {
    const section = page.locator("#default"), slider = section.getByRole("slider", { name: "Gain" });
    await drag(page, slider, .62, .8);
    assert.ok(Number(await slider.inputValue()) > .7);
    await slider.press("Home"); assert.equal(await readout(section), "0%");
    await slider.press("ArrowRight"); assert.equal(await readout(section), "1%");
    await slider.press("PageUp"); assert.equal(await readout(section), "11%");
    await slider.press("Shift+ArrowLeft"); assert.equal(Number(await slider.inputValue()).toFixed(3), "0.109");
    await slider.press("End"); assert.equal(await readout(section), "100%");
    assert.equal(await section.locator("[data-slot=slider-cell]").count(), 16);
    assert.equal(await section.locator("[data-slot=slider]").evaluate(node => getComputedStyle(node).display), "grid");
    assert.equal(await page.locator("style[data-builder-kit-styles=slider]").count(), 1);
}));
test("logarithmic keys move along the travel and discrete cells remain whole", () => withPage(async page => {
    const section = page.locator("#frequency"), cutoff = section.getByRole("slider", { name: "Cutoff" });
    await cutoff.press("Home"); assert.equal(await readout(section), "20 Hz");
    await cutoff.press("ArrowRight"); assert.equal(Number(await cutoff.inputValue()).toFixed(2), "0.01");
    await cutoff.press("End"); assert.equal(await readout(section), "20.0 kHz");
    const steps = page.locator("#steps").getByRole("slider", { name: "Voices" });
    await steps.press("ArrowRight"); assert.equal(await steps.getAttribute("aria-valuetext"), "4");
    await steps.press("Shift+ArrowRight"); assert.equal(await steps.getAttribute("aria-valuetext"), "5");
    const fills = await page.locator("#steps [data-slot=slider-cell]").evaluateAll(nodes => nodes.map(node => node.dataset.fill));
    assert.deepEqual(fills, ["1", "1", "1", "1", "1", "0", "0", "0"]);
}));
test("exact entry accepts units, reports invalid input and preserves the value on Escape", () => withPage(async page => {
    const section = page.locator("#entry");
    await section.getByRole("button", { name: "Edit Frequency exact value" }).click();
    const input = section.getByRole("textbox", { name: "Frequency exact value" });
    await input.fill("2.5 kHz"); await input.press("Enter");
    assert.equal(await section.getByRole("slider").getAttribute("aria-valuetext"), "2.50 kHz");
    await section.getByRole("button", { name: "Edit Frequency exact value" }).click();
    await input.fill("bananas"); await input.press("Enter"); assert.ok(await section.getByRole("alert").isVisible());
    await input.fill("9 kHz"); await input.press("Escape");
    assert.equal(await section.getByRole("slider").getAttribute("aria-valuetext"), "2.50 kHz");
}));
test("modulation drags and repeated keys each close one gesture; disabling blocks edits", () => withPage(async page => {
    const section = page.locator("#states");
    const surface = section.locator("[data-slot=slider-drag-surface]");
    await drag(page, surface, .25, .4);
    assert.equal(await section.locator("[data-role=slider-events]").textContent(), "start · end");
    const end = section.getByRole("slider", { name: "Controlled end" });
    await end.focus(); await page.keyboard.down("ArrowRight"); await page.keyboard.down("ArrowRight"); await page.keyboard.up("ArrowRight");
    assert.equal(await section.locator("[data-role=slider-events]").textContent(), "start · end · start · end");
    const old = await end.getAttribute("aria-valuenow");
    await section.getByRole("checkbox", { name: "Disabled", exact: true }).check();
    await end.press("ArrowRight"); assert.equal(await end.getAttribute("aria-valuenow"), old);
}));
test("disabling and unmounting during a captured drag settle its gesture", () => withPage(async page => {
    const section = page.locator("#states");
    await drag(page, section.locator("[data-slot=slider-drag-surface]"), .25, .4, false);
    // Activates the real UI while the primary pointer remains held elsewhere.
    await section.getByRole("checkbox", { name: "Disabled", exact: true }).evaluate(node => node.click());
    await page.mouse.up();
    assert.equal(await section.locator("[data-role=slider-events]").textContent(), "start · cancel");
    await section.getByRole("checkbox", { name: "Disabled", exact: true }).uncheck();
    await drag(page, section.locator("[data-slot=slider-drag-surface]"), .4, .5, false);
    await section.getByRole("button", { name: "Unmount", exact: true }).evaluate(node => node.click());
    await page.mouse.up();
    assert.equal(await section.locator("[data-role=slider-events]").textContent(), "start · cancel · start · cancel");
}));
test("copied examples bundle through the public entry and style sheets are removed after the last slider unmounts", () => withPage(async page => {
    const copied = new Map();
    for (const id of ["default", "range", "frequency", "entry", "steps", "styles", "states"]) {
        const section = page.locator(`#${id}`);
        await section.getByRole("tab", { name: "Code", exact: true }).click();
        copied.set(`${id}.tsx`, await section.locator(`[data-source-file="${id}.tsx"] code`).textContent());
    }
    assert.equal(await page.locator("style[data-builder-kit-styles=slider]").count(), 0);
    const folder = await mkdtemp(path.join(os.tmpdir(), "kit-slider-copied-"));
    try {
        await writeFile(path.join(folder, "examples.css"), await readFile(path.join(root, "kit/examples/sliders/examples.css")));
        for (const [name, text] of copied) {
            const kit = JSON.stringify(path.join(root, "kit/index"));
            await writeFile(path.join(folder, name), text.replace('"../../index"', kit));
            await build({ entryPoints: [path.join(folder, name)], bundle: true, write: false, format: "esm", nodePaths: [path.join(root, "node_modules")], loader: { ".css": "text" }, plugins: [{ name: "inline-css", setup(build) { build.onResolve({ filter: /\.css\?inline$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.replace(/\?inline$/, "")) })); } }], logLevel: "silent" });
        }
    } finally { await rm(folder, { recursive: true, force: true }); }
}));
