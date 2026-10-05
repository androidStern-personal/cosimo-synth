import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { startStaticRepoServer } from "../kit/tests/helpers/static_web_server.mjs";
import { displayedValue, drag, hostStatusInputs, openStockControlsView } from "./helpers/stock_controls_view_harness.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(repoRoot, "fx/chorus_lab/ChorusLab.cmajorpatch"), "utf8"));
const statusInputs = await hostStatusInputs(path.join(repoRoot, "fx/chorus_lab/ChorusLab.cmajor"));
const sourceModule = "/fx/chorus_lab/view/source.ts";
const builtModule = "/build/fx/chorus_lab_runtime/view/app.js";

let server;
let browser;

before(async () => {
    const build = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "chorus"], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
    assert.equal(build.status, 0, `npm run fx:build -- chorus failed:\n${build.stdout}${build.stderr}`);
    server = await startStaticRepoServer({ bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

for (const modulePath of [sourceModule, builtModule]) {
    test(`Chorus Lab shows every parameter in its annotated group, under the preset header (${modulePath})`, async () => {
        const { page, errors } = await openStockControlsView(browser, server, { modulePath, manifest, statusInputs });
        try {
            assert.equal(await displayedValue(page, "chorusTone"), 0.5, "controls show the host's current value");
            const view = page.locator("#mount > *");
            assert.deepEqual(await view.locator("section.group h2").allTextContents(), ["Output", "Chorus", "Loop", "Bloom"]);
            const shown = await view.locator("stub-stock-control").evaluateAll(controls => controls.map(control => control.dataset.endpoint));
            assert.deepEqual(shown, statusInputs.map(input => input.endpointID));
            await page.getByRole("combobox", { name: "Preset" }).waitFor();
            await page.getByRole("group", { name: "Snapshots" }).waitFor();
            await page.getByRole("button", { name: "Undo", exact: true }).waitFor();
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
}

test("Chorus Lab recalls a factory preset as one Undo entry and leaves Chorus On alone", async () => {
    const { page, errors } = await openStockControlsView(browser, server, { modulePath: builtModule, manifest, statusInputs });
    try {
        await displayedValue(page, "chorusEnabled");
        await drag(page, "chorusEnabled", 1);
        await drag(page, "shimmer", 70);
        assert.equal(await displayedValue(page, "shimmer", 70), 70);

        await page.getByRole("combobox", { name: "Preset" }).selectOption("bloom-ring");
        assert.equal(await displayedValue(page, "chorusBloomMode", 2), 2);
        assert.equal(await displayedValue(page, "chorusRingFineSemitones", 0.07), 0.07);
        assert.equal(await displayedValue(page, "shimmer", 16), 16, "a preset sets every sound parameter, not only the chorus controls");
        assert.equal(await displayedValue(page, "chorusEnabled"), 1, "a preset does not switch the chorus off");

        await page.getByRole("button", { name: "Undo", exact: true }).click();
        assert.equal(await displayedValue(page, "chorusBloomMode", 0), 0);
        assert.equal(await displayedValue(page, "shimmer", 70), 70);
        assert.equal(await displayedValue(page, "chorusEnabled"), 1);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});
