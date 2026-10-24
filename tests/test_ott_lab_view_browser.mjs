import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { startStaticRepoServer } from "../kit/tests/helpers/static_web_server.mjs";
import { displayedValue, drag, hostStatusInputs, openStockControlsView } from "./helpers/stock_controls_view_harness.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(repoRoot, "fx/ott_lab/OttLab.cmajorpatch"), "utf8"));
const statusInputs = await hostStatusInputs(path.join(repoRoot, "fx/ott_lab/OttLab.cmajor"));
const sourceModule = "/fx/ott_lab/view/source.ts";
const builtModule = "/build/fx/ott_lab_runtime/view/app.js";

let server;
let browser;

before(async () => {
    const build = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "ott"], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
    assert.equal(build.status, 0, `npm run fx:build -- ott failed:\n${build.stdout}${build.stderr}`);
    server = await startStaticRepoServer({ bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

async function openOttLab(modulePath = builtModule, values = { ottMix: 87 }) {
    const lab = await openStockControlsView(browser, server, { modulePath, manifest, statusInputs, values });
    await displayedValue(lab.page, "ottMix");
    return lab;
}

const hostMessagesFor = (page, endpointID) => page.evaluate(endpointID => window.__LAB__.hostMessages
    .filter(message => message.endpointID === endpointID).map(({ type, value }) => value === undefined ? type : `${type} ${value}`), endpointID);

for (const modulePath of [sourceModule, builtModule]) {
    test(`OTT Lab shows every visible parameter in its annotated group, under the preset header (${modulePath})`, async () => {
        const { page, errors } = await openOttLab(modulePath);
        try {
            const view = page.locator("#mount > *");
            assert.deepEqual(await view.locator("section.group h2").allTextContents(),
                ["Output", "Envelope", "Character", "Crossovers", "Low", "Mid", "High"]);
            const shown = await view.locator("stub-stock-control").evaluateAll(controls => controls.map(control => control.dataset.endpoint));
            assert.deepEqual(shown, statusInputs.filter(input => !input.annotation.hidden).map(input => input.endpointID));
            assert.equal(shown.includes("hostSlot0Guard"), false, "the hidden host guard has no control");
            assert.equal(await displayedValue(page, "ottMix"), 87, "controls show the host's current value");
            await page.getByRole("combobox", { name: "Preset" }).waitFor();
            await page.getByRole("group", { name: "Snapshots" }).waitFor();
            await page.getByRole("button", { name: "Undo", exact: true }).waitFor();
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
}

test("a knob drag is one host gesture and one Undo entry", async () => {
    const { page, errors } = await openOttLab();
    try {
        await page.evaluate(() => window.__LAB__.hostMessages.splice(0));
        await drag(page, "ottMix", 60, 50, 40);
        assert.equal(await displayedValue(page, "ottMix", 40), 40);
        await page.waitForFunction(() => window.__LAB__.hostMessages.some(message => message.type === "end"));
        const messages = await hostMessagesFor(page, "ottMix");
        assert.equal(messages[0], "begin");
        assert.equal(messages.at(-1), "end");
        assert.equal(messages.at(-2), "value 40");

        const undo = page.getByRole("button", { name: "Undo", exact: true });
        await undo.click();
        assert.equal(await displayedValue(page, "ottMix", 87), 87, "Undo restores the value before the whole drag");
        assert.equal(await page.evaluate(() => window.__LAB__.hostValue("ottMix")), 87);
        assert.equal(await undo.isDisabled(), true, "the drag was a single entry");
        await page.getByRole("button", { name: "Redo", exact: true }).click();
        assert.equal(await displayedValue(page, "ottMix", 40), 40);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("recalling a factory preset sets the whole sound as one Undo entry and leaves Bypass alone", async () => {
    const { page, errors } = await openOttLab(builtModule, { ottMix: 87, lowAboveDb: -20 });
    try {
        await drag(page, "bypass", 1);
        assert.equal(await displayedValue(page, "bypass", 1), 1);

        await page.getByRole("combobox", { name: "Preset" }).selectOption("envelope-tamed");
        assert.equal(await displayedValue(page, "ottMix", 86), 86);
        assert.equal(await displayedValue(page, "ottEnvelopeMatch", 38), 38);
        assert.equal(await displayedValue(page, "lowAboveDb", -33.75), -33.75, "a preset sets every sound parameter, not only the ones it changes");
        assert.equal(await displayedValue(page, "bypass"), 1, "a preset is not an on/off switch");

        await page.getByRole("button", { name: "Undo", exact: true }).click();
        assert.equal(await displayedValue(page, "ottMix", 87), 87);
        assert.equal(await displayedValue(page, "lowAboveDb", -20), -20);
        assert.equal(await displayedValue(page, "bypass"), 1, "Undo of the recall does not undo the earlier Bypass change");
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("snapshot slots keep the sound they were left with", async () => {
    const { page, errors } = await openOttLab();
    try {
        const slot = name => page.getByRole("group", { name: "Snapshots" }).getByRole("button", { name: new RegExp(`^Snapshot ${name}\\b`) });
        await slot("A").click();
        await page.waitForFunction(() => window.__LAB__ && document.querySelector("#mount > *").shadowRoot
            .querySelector(".bk-snapshot-slot[aria-pressed='true']")?.textContent === "A");
        await drag(page, "ottAmount", 40);
        await slot("B").click();
        await drag(page, "ottAmount", 10);
        assert.equal(await displayedValue(page, "ottAmount", 10), 10);
        await slot("A").click();
        assert.equal(await displayedValue(page, "ottAmount", 40), 40, "slot A kept the tweak made while it was selected");
        await slot("B").click();
        assert.equal(await displayedValue(page, "ottAmount", 10), 10);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("host automation moves the control without adding an Undo entry", async () => {
    const { page, errors } = await openOttLab();
    try {
        await page.evaluate(() => window.__LAB__.automate("ottTimePercent", 333));
        assert.equal(await displayedValue(page, "ottTimePercent", 333), 333);
        assert.equal(await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(), true);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test("closing and reopening the view keeps the values and Undo, without leaking listeners", async () => {
    const { page, errors } = await openOttLab();
    try {
        await drag(page, "kneeWidthDb", 12);
        assert.equal(await displayedValue(page, "kneeWidthDb", 12), 12);
        const listenersBefore = await page.evaluate(() => window.__LAB__.listenerCount("kneeWidthDb"));

        await page.evaluate(() => window.__LAB__.close());
        await page.evaluate(() => window.__LAB__.reopen());
        assert.equal(await displayedValue(page, "kneeWidthDb", 12), 12);
        assert.equal(await page.evaluate(() => window.__LAB__.listenerCount("kneeWidthDb")), listenersBefore);

        await page.getByRole("button", { name: "Undo", exact: true }).click();
        assert.equal(await displayedValue(page, "kneeWidthDb", 6), 6);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});
