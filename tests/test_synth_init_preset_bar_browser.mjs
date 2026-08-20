import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

async function openModulePage() {
    const page = await browser.newPage();
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), { waitUntil: "load" });
    return page;
}

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("compact synth preset bars expose one Init command without adding an Init preset", async () => {
    const page = await openModulePage();

    try {
        const result = await page.evaluate(async () => {
            const { createPresetBar } = await import("/ui/shared/effects/preset-bar.ts");
            const mountPoint = document.getElementById("mount");

            if (!(mountPoint instanceof HTMLElement)) {
                throw new Error("Module test mount point is missing.");
            }

            const createState = (supportsInit) => ({
                effectID: supportsInit ? "cosimo-synth" : "chorus",
                ready: true,
                filter: { query: "", source: "all" },
                presets: [],
                visiblePresets: [],
                factoryPresets: [],
                userPresets: [],
                activePreset: null,
                activePresetID: null,
                activeLabel: supportsInit ? "INIT" : "",
                dirty: false,
                currentValues: {},
                missingCurrentValueEndpointIDs: [],
                currentContract: null,
                lastError: null,
                supportsInit,
                pendingSoundReplacement: null,
            });
            const createController = (supportsInit) => ({
                getState: () => createState(supportsInit),
                subscribe: () => () => {},
                getMutations: () => ({
                    clearLastError() {},
                    setFilter() {},
                }),
            });
            const inspectBar = (supportsInit) => {
                const presetBar = createPresetBar();
                presetBar.setAttribute("compact-synth", "");
                presetBar.controller = createController(supportsInit);
                mountPoint.append(presetBar);

                const shadow = presetBar.shadowRoot;
                if (!shadow) {
                    throw new Error("Preset bar shadow root is missing.");
                }

                return {
                    initRows: Array.from(shadow.querySelectorAll('[data-action="init"]')).map((row) => row.textContent?.trim()),
                    presetKeys: Array.from(shadow.querySelectorAll("[data-preset-key]")).map((item) => item.getAttribute("data-preset-key")),
                };
            };

            return {
                synth: inspectBar(true),
                standalone: inspectBar(false),
            };
        });

        assert.deepEqual(result.synth, {
            initRows: ["Init"],
            presetKeys: [],
        });
        assert.deepEqual(result.standalone, {
            initRows: [],
            presetKeys: [],
        });
    } finally {
        await page.close();
    }
});

test("the Init guard dialog exposes exactly three actions and reuses Save As", async () => {
    const page = await openModulePage();

    try {
        const result = await page.evaluate(async () => {
            const { createPresetBar } = await import("/ui/shared/effects/preset-bar.ts");
            const mountPoint = document.getElementById("mount");
            if (!(mountPoint instanceof HTMLElement)) {
                throw new Error("Module test mount point is missing.");
            }

            const calls = [];
            const state = {
                effectID: "cosimo-synth",
                ready: true,
                filter: { query: "", source: "all" },
                presets: [],
                visiblePresets: [],
                factoryPresets: [],
                userPresets: [],
                activePreset: null,
                activePresetID: null,
                activeLabel: "INIT",
                dirty: true,
                currentValues: {},
                missingCurrentValueEndpointIDs: [],
                currentContract: null,
                lastError: null,
                supportsInit: true,
                pendingSoundReplacement: null,
            };
            const confirmRequired = {
                ok: false,
                actionRequired: "confirm-sound-replacement",
                message: "Unsaved changes.",
            };
            const controller = {
                getState: () => state,
                subscribe: () => () => {},
                getMutations: () => ({
                    clearLastError() {},
                    setFilter() {},
                    initSound() {
                        calls.push("init");
                        return confirmRequired;
                    },
                    cancelSoundReplacement() {
                        calls.push("cancel");
                        return { ok: true, value: undefined, message: "Cancelled." };
                    },
                    discardAndContinueSoundReplacement() {
                        calls.push("discard");
                        return { ok: true, value: {}, message: "Initialized." };
                    },
                    saveAndContinueSoundReplacement() {
                        calls.push("save");
                        return {
                            ok: false,
                            actionRequired: "save-as-for-sound-replacement",
                            message: "Save As required.",
                        };
                    },
                    saveCurrentAsNewPresetAndContinueSoundReplacement(label) {
                        calls.push(`save-as:${label}`);
                        return { ok: true, value: {}, message: "Saved and initialized." };
                    },
                }),
                getSynthMutations() {
                    return this.getMutations();
                },
            };
            const presetBar = createPresetBar();
            presetBar.setAttribute("compact-synth", "");
            presetBar.controller = controller;
            mountPoint.append(presetBar);
            const shadow = presetBar.shadowRoot;
            if (!shadow) {
                throw new Error("Preset bar shadow root is missing.");
            }

            const clickInit = () => {
                const init = shadow.querySelector('[data-action="init"]');
                if (!(init instanceof HTMLButtonElement)) {
                    throw new Error("Init row is missing.");
                }
                init.click();
            };
            const dialogActionLabels = () => Array.from(
                shadow.querySelectorAll('.dialog-overlay.open .dialog:not([hidden]) .dialog-actions button'),
            ).map((button) => button.textContent?.trim());

            clickInit();
            const firstLabels = dialogActionLabels();
            const cancel = shadow.querySelector('[data-action="sound-replacement-cancel"]');
            if (!(cancel instanceof HTMLButtonElement)) {
                throw new Error("Cancel action is missing.");
            }
            cancel.click();

            clickInit();
            const discard = shadow.querySelector('[data-action="sound-replacement-discard"]');
            if (!(discard instanceof HTMLButtonElement)) {
                throw new Error("Discard and Init action is missing.");
            }
            discard.click();

            clickInit();
            const save = shadow.querySelector('[data-action="sound-replacement-save"]');
            if (!(save instanceof HTMLButtonElement)) {
                throw new Error("Save and Init action is missing.");
            }
            save.click();
            const saveAsCancel = shadow.querySelector('[data-action="dialog-cancel"]');
            if (!(saveAsCancel instanceof HTMLButtonElement)) {
                throw new Error("Save As cancel action is missing.");
            }
            saveAsCancel.click();

            clickInit();
            save.click();
            const saveAsTitle = shadow.querySelector('[data-el="dialog-title"]')?.textContent?.trim();
            const input = shadow.querySelector('[data-el="dialog-input"]');
            const confirm = shadow.querySelector('[data-action="dialog-confirm"]');
            if (!(input instanceof HTMLInputElement) || !(confirm instanceof HTMLButtonElement)) {
                throw new Error("Save As form is missing.");
            }
            input.value = "Saved Before Init";
            confirm.click();

            return {
                calls,
                firstLabels,
                saveAsTitle,
                overlayOpenAfterSuccess: shadow.querySelector('[data-el="dialog-overlay"]')?.classList.contains("open"),
            };
        });

        assert.deepEqual(result.firstLabels, ["Cancel", "Discard and Init", "Save and Init"]);
        assert.deepEqual(result.calls, [
            "init",
            "cancel",
            "init",
            "discard",
            "init",
            "save",
            "cancel",
            "init",
            "save",
            "save-as:Saved Before Init",
        ]);
        assert.equal(result.saveAsTitle, "Save Preset");
        assert.equal(result.overlayOpenAfterSuccess, false);
    } finally {
        await page.close();
    }
});

test("Save on a dirty unnamed INIT sound uses the existing Save As flow", async () => {
    const page = await openModulePage();

    try {
        const result = await page.evaluate(async () => {
            const { createPresetBar } = await import("/ui/shared/effects/preset-bar.ts");
            const mountPoint = document.getElementById("mount");
            if (!(mountPoint instanceof HTMLElement)) throw new Error("Module test mount point is missing.");
            const calls = [];
            const state = {
                effectID: "cosimo-synth",
                ready: true,
                filter: { query: "", source: "all" },
                presets: [], visiblePresets: [], factoryPresets: [], userPresets: [],
                activePreset: null, activePresetID: null, activeLabel: "INIT", dirty: true,
                currentValues: {}, missingCurrentValueEndpointIDs: [], currentContract: null,
                lastError: null, supportsInit: true, pendingSoundReplacement: null,
            };
            const presetBar = createPresetBar();
            presetBar.setAttribute("compact-synth", "");
            presetBar.controller = {
                getState: () => state,
                subscribe: () => () => {},
                getMutations: () => ({
                    clearLastError() {},
                    setFilter() {},
                    saveCurrentAsNewPreset(label) {
                        calls.push(label);
                        return { ok: true, value: {}, message: "Saved." };
                    },
                }),
            };
            mountPoint.append(presetBar);
            const shadow = presetBar.shadowRoot;
            if (!shadow) throw new Error("Preset bar shadow root is missing.");
            const save = shadow.querySelector('[data-el="menu-save"]');
            if (!(save instanceof HTMLButtonElement)) throw new Error("Save row is missing.");
            const saveWasEnabled = !save.disabled;
            save.click();
            const title = shadow.querySelector('[data-el="dialog-title"]')?.textContent?.trim();
            const input = shadow.querySelector('[data-el="dialog-input"]');
            const confirm = shadow.querySelector('[data-action="dialog-confirm"]');
            if (!(input instanceof HTMLInputElement) || !(confirm instanceof HTMLButtonElement)) {
                throw new Error("Save As controls are missing.");
            }
            input.value = "Initialized Sound";
            confirm.click();

            return { calls, saveWasEnabled, title };
        });

        assert.equal(result.saveWasEnabled, true);
        assert.equal(result.title, "Save Preset");
        assert.deepEqual(result.calls, ["Initialized Sound"]);
    } finally {
        await page.close();
    }
});

test("Previous, Next, browser selection, and paste share the dirty guard while clean and standalone loads proceed", async () => {
    const page = await openModulePage();

    try {
        const result = await page.evaluate(async () => {
            const { createPresetBar } = await import("/ui/shared/effects/preset-bar.ts");
            const mountPoint = document.getElementById("mount");
            if (!(mountPoint instanceof HTMLElement)) throw new Error("Module test mount point is missing.");

            const runScenario = async (supportsInit, dirty) => {
                const calls = [];
                const presets = ["one", "two"].map((presetID, index) => ({
                    presetKey: `user:${presetID}`,
                    presetID,
                    label: presetID.toUpperCase(),
                    effectID: supportsInit ? "cosimo-synth" : "chorus",
                    source: "user",
                    preset: {},
                    isActive: index === 0,
                    dirty: index === 0 && dirty,
                    canApply: true,
                    canRename: true,
                    canOverwrite: true,
                    canDelete: true,
                    canExport: true,
                }));
                const state = {
                    effectID: supportsInit ? "cosimo-synth" : "chorus",
                    ready: true,
                    filter: { query: "", source: "all" },
                    presets,
                    visiblePresets: presets,
                    factoryPresets: [], userPresets: presets,
                    activePreset: { presetID: "one", label: "ONE", dirty },
                    activePresetID: "one", activeLabel: "ONE", dirty,
                    currentValues: {}, missingCurrentValueEndpointIDs: [], currentContract: null,
                    lastError: null, supportsInit, pendingSoundReplacement: null,
                };
                const replacementResult = dirty && supportsInit
                    ? { ok: false, actionRequired: "confirm-sound-replacement", message: "Unsaved." }
                    : { ok: true, value: {}, message: "Applied." };
                const presetBar = createPresetBar();
                if (supportsInit) presetBar.setAttribute("compact-synth", "");
                presetBar.controller = {
                    getState: () => state,
                    subscribe: () => () => {},
                    getMutations: () => ({
                        clearLastError() {},
                        setFilter() {},
                        applyPreset(key) {
                            calls.push(`apply:${key}`);
                            return replacementResult;
                        },
                        async pastePresetFromClipboard() {
                            calls.push("paste");
                            return replacementResult;
                        },
                        cancelSoundReplacement() {
                            calls.push("cancel");
                            return { ok: true, value: undefined, message: "Cancelled." };
                        },
                    }),
                    getSynthMutations() {
                        return supportsInit ? this.getMutations() : null;
                    },
                };
                mountPoint.append(presetBar);
                const shadow = presetBar.shadowRoot;
                if (!shadow) throw new Error("Preset bar shadow root is missing.");
                const guarded = [];
                const runAction = async (action) => {
                    const button = shadow.querySelector(`[data-action="${action}"]`);
                    if (!(button instanceof HTMLElement)) throw new Error(`${action} is missing.`);
                    button.click();
                    await Promise.resolve();
                    const overlay = shadow.querySelector('[data-el="dialog-overlay"]');
                    const opened = overlay?.classList.contains("open") === true;
                    guarded.push(opened);
                    if (opened) {
                        const cancel = shadow.querySelector('[data-action="sound-replacement-cancel"]');
                        if (!(cancel instanceof HTMLButtonElement)) throw new Error("Cancel is missing.");
                        cancel.click();
                    }
                };

                await runAction("prev");
                await runAction("next");
                const name = shadow.querySelector('[data-action="toggle-flyout"]');
                if (!(name instanceof HTMLElement)) throw new Error("Preset browser trigger is missing.");
                name.click();
                const item = shadow.querySelector('[data-preset-key="user:two"]');
                if (!(item instanceof HTMLElement)) throw new Error("Browser preset is missing.");
                item.click();
                await Promise.resolve();
                const browserOpened = shadow.querySelector('[data-el="dialog-overlay"]')?.classList.contains("open") === true;
                guarded.push(browserOpened);
                if (browserOpened) {
                    const cancel = shadow.querySelector('[data-action="sound-replacement-cancel"]');
                    if (!(cancel instanceof HTMLButtonElement)) throw new Error("Cancel is missing.");
                    cancel.click();
                }
                await runAction("paste");
                presetBar.remove();
                return { calls, guarded };
            };

            return {
                dirtySynth: await runScenario(true, true),
                cleanSynth: await runScenario(true, false),
                standalone: await runScenario(false, true),
            };
        });

        assert.deepEqual(result.dirtySynth.guarded, [true, true, true, true]);
        assert.deepEqual(result.cleanSynth.guarded, [false, false, false, false]);
        assert.deepEqual(result.standalone.guarded, [false, false, false, false]);
        assert.deepEqual(result.dirtySynth.calls, [
            "apply:user:two", "cancel",
            "apply:user:two", "cancel",
            "apply:user:two", "cancel",
            "paste", "cancel",
        ]);
    } finally {
        await page.close();
    }
});
