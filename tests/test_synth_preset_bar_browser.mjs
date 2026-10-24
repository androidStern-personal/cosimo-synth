import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";

import { startStaticWebServer } from "../kit/tests/helpers/static_web_server.mjs";
import { cmajorWebApiDirectory } from "./helpers/cmajor_source.mjs";

const root = path.resolve(import.meta.dirname, "..");
let browser;
let server;

before(async () => {
    server = await startStaticWebServer(root, {
        bundleTypeScript: true,
        mounts: { "/cmaj_api": () => cmajorWebApiDirectory() },
    });
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.stop(); });

async function open({ compact = false, hash = "" } = {}) {
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html?width=900&height=420${hash}`);
    await page.evaluate(async (compactRow) => {
        const { mount } = await import("/tests/helpers/synth_preset_bar_fixture.tsx");
        window.fixture = await mount(document.getElementById("mount"), { compact: compactRow });
    }, compact);
    return {
        page,
        // The development connection reports float32-rounded host values.
        parameter: (endpointID) => page.evaluate((id) => Math.round(window.fixture.parameter(id) * 1e4) / 1e4, endpointID),
        calls: () => page.evaluate(() => window.fixture.calls()),
        waitForParameter: (endpointID, value) => page.waitForFunction(
            ({ id, expected }) => Math.abs(window.fixture.parameter(id) - expected) < 1e-4, { id: endpointID, expected: value }),
        async close() {
            try { await page.evaluate(() => window.fixture.dispose()); }
            finally { await page.close(); }
            assert.deepEqual(errors, [], "no uncaught browser errors");
        },
    };
}

const bar = (page) => page.locator('[data-role="synth-preset-bar"]');
const presetSelect = (page) => bar(page).getByLabel("Preset", { exact: true });
const openSoundActions = (page) => bar(page).locator('[data-action="toggle-sound-actions"]').click();
const modified = (page) => bar(page).locator(':is(.bk-preset-bar-dirty, [data-role="preset-modified"])');

test("a fresh synth shows Init, unmodified; recalling Init is one Undo entry", async () => {
    const view = await open();
    const { page } = view;
    try {
        await page.waitForFunction(() => document.querySelector('[data-role="synth-preset-bar"] select[aria-label="Preset"]')?.disabled === false);
        assert.equal(await presetSelect(page).inputValue(), "init", "a fresh synth starts on Init");
        assert.equal(await bar(page).getByText("No preset").count(), 0);
        assert.equal(await modified(page).count(), 0, "the starting sound is exactly Init");
        await page.getByRole("button", { name: "Cutoff 2400" }).click();
        await view.waitForParameter("filterCutoff", 2400);
        await presetSelect(page).selectOption({ label: "Init" });
        await view.waitForParameter("filterCutoff", 1000);
        assert.equal(await presetSelect(page).inputValue(), "init");
        assert.equal(await modified(page).count(), 0, "the sound is exactly Init");
        let calls = await view.calls();
        assert.equal(calls.replaced.length, 1, "the recall replaced the sound once");
        assert.equal(calls.replaced[0].filterCutoff, 1000);

        await page.getByRole("button", { name: "Undo" }).click();
        await view.waitForParameter("filterCutoff", 2400);
        assert.equal(await presetSelect(page).inputValue(), "init", "Undo also restores the active preset");
        await modified(page).waitFor();
        calls = await view.calls();
        assert.equal(calls.replaced.length, 2, "Undo of a recall replaces the sound again");
        await page.getByRole("button", { name: "Redo" }).click();
        await view.waitForParameter("filterCutoff", 1000);
        await modified(page).waitFor({ state: "detached" });
        assert.equal((await view.calls()).replaced.length, 3, "Redo of a recall replaces the sound again");
        await page.getByRole("button", { name: "Undo" }).click();
        await view.waitForParameter("filterCutoff", 2400);
        assert.equal((await view.calls()).replaced.length, 4);
        await page.getByRole("button", { name: "Undo" }).click();
        await view.waitForParameter("filterCutoff", 1000);
        assert.equal(await page.getByRole("button", { name: "Undo" }).isDisabled(), true, "the recall was a single entry");
        assert.equal((await view.calls()).replaced.length, 4, "undoing a knob edit does not replace the sound");
    } finally {
        await view.close();
    }
});

test("Save as new keeps the sound, marks later edits as modified, and Revert restores it", async () => {
    const view = await open();
    const { page } = view;
    try {
        await page.getByRole("button", { name: "Cutoff 2400" }).click();
        await view.waitForParameter("filterCutoff", 2400);
        await bar(page).getByRole("button", { name: "Save as new", exact: true }).click();
        await bar(page).getByLabel("Preset name", { exact: true }).fill("Bright");
        await bar(page).getByRole("button", { name: "Save", exact: true }).click();
        await presetSelect(page).waitFor();
        await page.waitForFunction(() => document.querySelector('select[aria-label="Preset"] option:checked')?.textContent === "Bright");
        assert.equal((await view.calls()).replaced.length, 0, "saving leaves the sound as it was");

        await page.getByRole("button", { name: "Cutoff 600" }).click();
        await view.waitForParameter("filterCutoff", 600);
        await modified(page).waitFor();
        assert.equal((await view.calls()).replaced.length, 0, "a knob edit does not replace the sound");
        await bar(page).getByRole("button", { name: "Revert", exact: true }).click();
        await view.waitForParameter("filterCutoff", 2400);
        await modified(page).waitFor({ state: "detached" });
        let calls = await view.calls();
        assert.equal(calls.replaced.length, 1, "Revert replaced the sound once");
        assert.equal(calls.replaced[0].filterCutoff, 2400);

        await page.getByRole("button", { name: "Undo" }).click();
        await view.waitForParameter("filterCutoff", 600);
        calls = await view.calls();
        assert.equal(calls.replaced.length, 2, "Undo of Revert replaces the sound again");
        assert.equal(calls.replaced[1].filterCutoff, 600);
        await page.getByRole("button", { name: "Redo" }).click();
        await view.waitForParameter("filterCutoff", 2400);
        assert.equal((await view.calls()).replaced.length, 3, "Redo of Revert replaces the sound again");

        await presetSelect(page).selectOption({ label: "Init" });
        await view.waitForParameter("filterCutoff", 1000);
        await presetSelect(page).selectOption({ label: "Bright" });
        await view.waitForParameter("filterCutoff", 2400);
        assert.equal((await view.calls()).replaced.length, 5, "each preset recall replaced the sound");
    } finally {
        await view.close();
    }
});

test("snapshot slots switch between sounds, each switch one Undo entry", async () => {
    const view = await open();
    const { page } = view;
    try {
        const slot = (id) => bar(page).getByRole("button", { name: new RegExp(`^Snapshot ${id}(, empty)?$`) });
        await slot("A").click();
        await page.waitForFunction(() => document.querySelector('[aria-label="Snapshot A"]')?.getAttribute("aria-pressed") === "true");
        await page.getByRole("button", { name: "Cutoff 2400" }).click();
        await view.waitForParameter("filterCutoff", 2400);
        await slot("B").click();
        await page.waitForFunction(() => document.querySelector('[aria-label="Snapshot B"]')?.getAttribute("aria-pressed") === "true");
        assert.equal(await view.parameter("filterCutoff"), 2400, "an empty slot captures the current sound");
        assert.equal((await view.calls()).replaced.length, 0, "capturing into an empty slot keeps the sound");

        await page.getByRole("button", { name: "Cutoff 600" }).click();
        await view.waitForParameter("filterCutoff", 600);
        await slot("A").click();
        await view.waitForParameter("filterCutoff", 2400);
        await slot("B").click();
        await view.waitForParameter("filterCutoff", 600);
        let calls = await view.calls();
        assert.deepEqual(calls.replaced.map(parameters => parameters.filterCutoff), [2400, 600], "each snapshot switch replaced the sound");
        await page.getByRole("button", { name: "Undo" }).click();
        await view.waitForParameter("filterCutoff", 2400);
        await page.getByRole("button", { name: "Redo" }).click();
        await view.waitForParameter("filterCutoff", 600);
        calls = await view.calls();
        assert.deepEqual(calls.replaced.map(parameters => parameters.filterCutoff), [2400, 600, 2400, 600],
            "Undo and Redo of a snapshot switch replace the sound again");
    } finally {
        await view.close();
    }
});

test("a sound link carries the current sound and loads it as one Undo entry", async () => {
    const source = await open();
    let link;
    try {
        await source.page.getByRole("button", { name: "Cutoff 2400" }).click();
        await source.waitForParameter("filterCutoff", 2400);
        await openSoundActions(source.page);
        await bar(source.page).locator('[data-action="share"]').click();
        const dialog = bar(source.page).locator('[data-role="share-dialog"]');
        await dialog.waitFor();
        link = await dialog.getByLabel("Sound link").inputValue();
        assert.match(new URL(link).hash, /^#p=3\.[A-Za-z0-9_-]+$/);
    } finally {
        await source.close();
    }

    const target = await open({ hash: new URL(link).hash });
    const { page } = target;
    try {
        const dialog = bar(page).locator('[data-role="shared-load-dialog"]');
        await dialog.waitFor();
        assert.match(await dialog.textContent(), /Load “Init” from this link\?/, "the link carries the active preset's name");
        assert.equal(await target.parameter("filterCutoff"), 1000, "nothing changes before Load");
        await dialog.getByRole("button", { name: "Load" }).click();
        await target.waitForParameter("filterCutoff", 2400);
        await bar(page).getByRole("status").filter({ hasText: "Loaded “Init”" }).waitFor();
        assert.equal(await page.evaluate(() => window.location.hash), "", "the link is consumed");
        assert.equal((await target.calls()).replaced.length, 1);
        await page.getByRole("button", { name: "Undo" }).click();
        await target.waitForParameter("filterCutoff", 1000);
        assert.equal((await target.calls()).replaced.length, 2, "Undo of a link load replaces the sound again");
        await page.getByRole("button", { name: "Redo" }).click();
        await target.waitForParameter("filterCutoff", 2400);
        assert.equal((await target.calls()).replaced.length, 3, "Redo of a link load replaces the sound again");
    } finally {
        await target.close();
    }
});

test("a malformed or old-version link is refused without changing the sound", async () => {
    for (const [hash, message] of [
        ["#p=3.!!!", /not valid base64url/],
        ["#p=2.eJyrVg", /version "2" is not supported/],
    ]) {
        const view = await open({ hash });
        try {
            await bar(view.page).getByRole("alert").filter({ hasText: message }).waitFor();
            assert.equal(await bar(view.page).locator('[data-role="shared-load-dialog"]').count(), 0);
            assert.equal(await view.parameter("filterCutoff"), 1000);
        } finally {
            await view.close();
        }
    }
});

test("Bounce video receives the current sound as a speedrun patch; the other actions call through", async () => {
    const view = await open();
    const { page } = view;
    try {
        await page.getByRole("button", { name: "Cutoff 2400" }).click();
        await view.waitForParameter("filterCutoff", 2400);
        for (const action of ["bounce-video", "bounce-audio", "perf-tuning"]) {
            await openSoundActions(page);
            await bar(page).locator(`[data-action="${action}"]`).click();
        }
        const calls = await view.calls();
        assert.equal(calls.bounceAudio, 1);
        assert.equal(calls.developerSettings, 1);
        assert.equal(calls.videoPatches.length, 1);
        const [patch] = calls.videoPatches;
        assert.equal(patch.label, "Init", "the patch carries the active preset's name");
        assert.equal(patch.parameters.filterCutoff, 2400);
        assert.equal(patch.parameters.sourceMode, 0, "the source mode travels with the patch so speedrun can refuse bounced sounds");
        assert.deepEqual(Object.keys(patch.storedState).sort(), ["articulations.v4", "lane.v1", "modulation.v6"]);
    } finally {
        await view.close();
    }
});

// The row's geometry needs the app's Tailwind styles; the 320px desktop harness test measures it.
test("the phone row shows the preset name and keeps the preset bar in the Sound actions menu", async () => {
    const view = await open({ compact: true });
    const { page } = view;
    try {
        // The name reads "No preset" until the presets load; a fresh synth then shows Init, unmodified.
        await page.waitForFunction(() => document.querySelector('[data-role="preset-name"]')?.textContent === "Init");
        assert.equal(await presetSelect(page).count(), 0, "the preset selector lives in the menu");

        await page.getByRole("button", { name: "Cutoff 2400" }).click();
        await page.waitForFunction(() => document.querySelector('[data-role="preset-name"]')?.textContent === "Init ●");
        await openSoundActions(page);
        await bar(page).getByRole("button", { name: "Revert", exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-role="preset-name"]')?.textContent === "Init");
        await bar(page).locator('[data-action="shell-back"]').click();
        assert.equal((await view.calls()).back, 1);
    } finally {
        await view.close();
    }
});
