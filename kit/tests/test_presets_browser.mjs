import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { startStaticWebServer } from "./helpers/static_web_server.mjs";

let browser;
let server;
before(async () => {
    server = await startStaticWebServer(path.resolve(import.meta.dirname, "../.."), { bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.stop(); });

const scope = `plugin-${createHash("sha256").update("com.example.presets").digest("hex")}`;

/** Mount the harness; `files` installs a user-file store and `initial` names the starting factory preset. */
async function open(files, initial) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(new URL("kit/tests/helpers/module_test_shell.html", server.baseUrl).href);
    await page.evaluate(async ([files, initial]) => {
        if (files) {
            const store = new Map(Object.entries(files));
            window.userFiles = store;
            window.chocUserFiles = {
                async list(scope) { return [...store.keys()].filter(key => key.startsWith(`${scope}/`)).map(key => key.slice(scope.length + 1)); },
                async read(scope, name) { return store.get(`${scope}/${name}`); },
                async write(scope, name, text) { store.set(`${scope}/${name}`, text); },
                async delete(scope, name) { store.delete(`${scope}/${name}`); },
            };
        }
        const { mount } = await import("/kit/tests/helpers/presets_react.tsx");
        window.harness = await mount(document.getElementById("mount"), initial);
    }, [files, initial]);
    await page.waitForFunction(() => window.harness.view().status === "ready");
    const run = (group, action, ...args) => page.evaluate(([group, action, args]) => window.harness.run(group, action, ...args), [group, action, args]);
    const view = () => page.evaluate(() => window.harness.view());
    const close = async () => {
        await page.evaluate(() => window.harness.dispose());
        await page.close();
        assert.deepEqual(errors, [], "no uncaught browser or React errors");
    };
    return { page, run, view, close };
}

test("recalling a preset is exactly one Undo entry that restores the sound and the active preset", async () => {
    const { run, view, close } = await open();
    try {
        assert.deepEqual(await run("presets", "recall", "hot"), { kind: "done" });
        assert.deepEqual(await view().then(({ gain, mode, active, dirty, canUndo }) => ({ gain, mode, active, dirty, canUndo })),
            { gain: 6, mode: "warm", active: { id: "hot", name: "Hot" }, dirty: false, canUndo: true });
        await run("history", "undo");
        assert.deepEqual(await view().then(({ gain, mode, active, canUndo }) => ({ gain, mode, active, canUndo })),
            { gain: 0, mode: "clean", active: null, canUndo: false });
        assert.deepEqual((await run("presets", "recall", "missing")), { kind: "failed", message: "That preset no longer exists." });
        assert.equal((await view()).error, "That preset no longer exists.");
    } finally { await close(); }
});

test("a fresh project starts on the initial preset, unmodified, and Revert returns to it", async () => {
    const { page, run, view, close } = await open(undefined, "init");
    try {
        assert.deepEqual(await view().then(({ active, dirty, canUndo }) => ({ active, dirty, canUndo })),
            { active: { id: "init", name: "Init" }, dirty: false, canUndo: false });
        assert.equal(await page.getByRole("combobox", { name: "Preset" }).inputValue(), "init");
        assert.equal(await page.getByText("No preset").count(), 0);
        await run("gain", "setValue", 4);
        assert.equal((await view()).dirty, true);
        await page.getByText("Modified").waitFor();
        assert.deepEqual(await run("presets", "revert"), { kind: "done" });
        assert.deepEqual(await view().then(({ gain, active, dirty }) => ({ gain, active, dirty })),
            { gain: 0, active: { id: "init", name: "Init" }, dirty: false });
    } finally { await close(); }
});

test("without an initial preset a fresh project has none active", async () => {
    const { page, view, close } = await open();
    try {
        assert.deepEqual(await view().then(({ active, dirty }) => ({ active, dirty })), { active: null, dirty: false });
        assert.equal(await page.getByRole("combobox", { name: "Preset" }).inputValue(), "");
    } finally { await close(); }
});

test("saving and managing presets never creates an Undo entry", async () => {
    const { run, view, close } = await open();
    try {
        await run("gain", "setValue", 3);
        assert.deepEqual(await run("presets", "save", "  Mine "), { kind: "done" });
        let state = await view();
        assert.deepEqual([state.user, state.active?.name, state.dirty], [["Mine"], "Mine", false]);
        const mine = state.active.id;
        await run("presets", "duplicate", "hot");
        await run("presets", "rename", mine, "Ours");
        assert.deepEqual((await view()).user, ["Ours", "Hot copy"]);
        assert.deepEqual(await run("presets", "rename", "hot", "Mine"),
            { kind: "failed", message: "Only your own presets can be renamed. Duplicate a factory preset first." });
        assert.deepEqual(await run("presets", "save", " "), { kind: "failed", message: "Enter a preset name." });

        // The only Undo entry is the gain edit made before saving.
        await run("history", "undo");
        state = await view();
        assert.deepEqual([state.gain, state.canUndo, state.user, state.active?.name, state.dirty], [0, false, ["Ours", "Hot copy"], "Ours", true]);
        await run("presets", "update");
        assert.equal((await view()).dirty, false, "Save writes the current sound into the active user preset");
        await run("presets", "remove", mine);
        state = await view();
        assert.deepEqual([state.user, state.active, state.canUndo], [["Hot copy"], null, false]);
    } finally { await close(); }
});

test("the dirty flag follows edits and Revert restores the preset as an Undo entry", async () => {
    const { run, view, close } = await open();
    try {
        await run("presets", "recall", "quiet");
        assert.equal((await view()).dirty, false);
        await run("gain", "setValue", -6);
        assert.equal((await view()).dirty, true);
        await run("presets", "revert");
        assert.deepEqual(await view().then(({ gain, dirty }) => ({ gain, dirty })), { gain: -12, dirty: false });
        await run("history", "undo");
        assert.deepEqual(await view().then(({ gain, dirty }) => ({ gain, dirty })), { gain: -6, dirty: true });
    } finally { await close(); }
});

test("preset files round-trip into the user library without loading the sound", async () => {
    const { page, run, view, close } = await open();
    try {
        const exported = await page.evaluate(() => window.harness.exportJson("hot"));
        assert.equal(exported.kind, "done");
        assert.deepEqual(JSON.parse(exported.text), { kind: "builder-kit.preset", version: 1, plugin: "com.example.presets", name: "Hot", values: { gain: 6, mode: "warm" } });
        assert.deepEqual(await run("presets", "importJson", exported.text), { kind: "done" });
        const state = await view();
        assert.deepEqual([state.user, state.active, state.gain, state.canUndo], [["Hot"], null, 0, false]);
        assert.match((await run("presets", "importJson", exported.text.replace("com.example.presets", "com.example.other"))).message,
            /This preset is for the plugin "com.example.other"/);
    } finally { await close(); }
});

test("loading a preset file replaces the sound as one Undo entry and leaves no preset active", async () => {
    const { page, run, view, close } = await open();
    try {
        await run("presets", "recall", "quiet");
        const { text } = await page.evaluate(() => window.harness.exportJson("hot"));
        assert.deepEqual(await run("presets", "loadJson", text), { kind: "done" });
        let state = await view();
        assert.deepEqual([state.gain, state.mode, state.active, state.dirty, state.user], [6, "warm", null, false, []],
            "the file's sound is loaded, no preset is active, and the library is unchanged");
        await run("history", "undo");
        state = await view();
        assert.deepEqual([state.gain, state.mode, state.active], [-12, "clean", { id: "quiet", name: "Quiet" }],
            "one Undo restores the previous sound and active preset together");
        await run("history", "redo");
        assert.deepEqual(await view().then(({ gain, mode, active }) => ({ gain, mode, active })), { gain: 6, mode: "warm", active: null });

        const other = text.replace("com.example.presets", "com.example.other");
        assert.deepEqual(await run("presets", "loadJson", other),
            { kind: "failed", message: 'This preset is for the plugin "com.example.other", not "com.example.presets".' });
        const notSound = JSON.stringify({ ...JSON.parse(text), values: { gain: 1, activeSnapshot: "A" } });
        assert.deepEqual(await run("presets", "loadJson", notSound),
            { kind: "failed", message: 'The preset sets "activeSnapshot", which this plugin does not keep in presets.' });
        assert.deepEqual(await view().then(({ gain, mode, active }) => ({ gain, mode, active })), { gain: 6, mode: "warm", active: null },
            "a refused file changes nothing");
    } finally { await close(); }
});

test("PresetBar's pasted JSON loads as the sound on Enter, or joins the library", async () => {
    const { page, view, close } = await open();
    try {
        const { text } = await page.evaluate(() => window.harness.exportJson("hot"));
        const paste = async () => {
            await page.getByRole("button", { name: "More", exact: true }).click();
            await page.getByRole("button", { name: "Paste JSON", exact: true }).click();
            await page.getByRole("textbox", { name: "Preset JSON" }).fill(text);
        };
        await paste();
        for (const name of ["Load", "Add to library", "Cancel"]) await page.getByRole("button", { name, exact: true }).waitFor();
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => window.harness.view().gain === 6);
        assert.deepEqual(await view().then(({ mode, active, user }) => ({ mode, active, user })), { mode: "warm", active: null, user: [] });

        await paste();
        await page.getByRole("button", { name: "Add to library", exact: true }).click();
        await page.waitForFunction(() => window.harness.view().user.length === 1);
        assert.deepEqual((await view()).user, ["Hot"]);
    } finally { await close(); }
});

test("snapshots keep the leaving slot's tweaks, capture into empty slots, and undo a select", async () => {
    const { run, view, close } = await open();
    try {
        await run("gain", "setValue", 2);
        await run("snapshots", "select", "A");
        let state = await view();
        assert.deepEqual([state.activeSlot, state.gain, state.slotContents.A], ["A", 2, { values: { gain: 2, mode: "clean" } }],
            "an empty slot captures the current sound without changing it");
        await run("gain", "setValue", 5);
        await run("snapshots", "select", "B");
        state = await view();
        assert.deepEqual([state.activeSlot, state.gain, state.slotContents.A, state.slotContents.B],
            ["B", 5, { values: { gain: 5, mode: "clean" } }, { values: { gain: 5, mode: "clean" } }], "A kept the tweak made while it was selected");
        await run("gain", "setValue", 7);
        await run("snapshots", "select", "A");
        state = await view();
        assert.deepEqual([state.activeSlot, state.gain, state.slotContents.B], ["A", 5, { values: { gain: 7, mode: "clean" } }]);

        await run("history", "undo");
        state = await view();
        assert.deepEqual([state.activeSlot, state.gain], ["B", 7], "Undo restores the previous slot and its sound");
        assert.deepEqual(state.slotContents.B, { values: { gain: 7, mode: "clean" } }, "slot contents are not undone");

        await run("snapshots", "clear", "B");
        state = await view();
        assert.deepEqual([state.activeSlot, state.slotContents.B, state.slots.map(({ filled }) => filled)], [null, null, [true, false, false]]);
    } finally { await close(); }
});

test("the user library loads from and saves to the user's files, and an unreadable file is left alone", async () => {
    const saved = { version: 1, presets: [{ id: "user-1", name: "From disk", values: { gain: 1, mode: "warm" } }] };
    let session = await open({ [`${scope}/presetLibrary.json`]: JSON.stringify(saved) });
    try {
        await session.page.waitForFunction(() => window.harness.view().user.length === 1);
        assert.deepEqual((await session.view()).user, ["From disk"]);
        await session.run("presets", "save", "Second");
        await session.page.waitForFunction(key => JSON.parse(window.userFiles.get(key)).presets.length === 2, `${scope}/presetLibrary.json`);
    } finally { await session.close(); }

    session = await open({ [`${scope}/presetLibrary.json`]: "{ not json" });
    try {
        await session.page.waitForFunction(() => window.harness.defects().length === 1);
        assert.match((await session.page.evaluate(() => window.harness.defects()))[0], /Could not load "presetLibrary" from the user's files/);
        assert.equal(await session.page.evaluate(key => window.userFiles.get(key), `${scope}/presetLibrary.json`), "{ not json");
    } finally {
        await session.page.evaluate(() => window.harness.dispose());
        await session.page.close();
    }
});

test("PresetBar and SnapshotBar are labelled, keyboard-operable controls", async () => {
    const { page, view, close } = await open();
    try {
        const preset = page.getByRole("combobox", { name: "Preset" });
        await preset.focus();
        await preset.selectOption("hot");
        await page.waitForFunction(() => window.harness.view().gain === 6);
        await page.getByRole("button", { name: "Snapshot A, empty" }).focus();
        await page.keyboard.press("Enter");
        await page.getByRole("button", { name: "Snapshot A", exact: true, pressed: true }).waitFor();
        await page.getByRole("button", { name: "More", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "More", exact: true }).getAttribute("aria-expanded"), "true");
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("button", { name: "More", exact: true }).getAttribute("aria-expanded"), "false");
        await page.getByRole("button", { name: "Save as new", exact: true }).click();
        await page.getByRole("textbox", { name: "Preset name" }).fill("Typed");
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => window.harness.view().active?.name === "Typed");
        assert.equal((await view()).user.length, 1);
    } finally { await close(); }
});
