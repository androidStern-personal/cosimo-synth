import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startStaticRepoServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

async function openModulePage() {
    const page = await browser.newPage();
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), { waitUntil: "load" });
    return page;
}

before(async () => {
    // Bundles /ui/shared/effects/preset-bar.ts on the fly; no dev server.
    server = await startStaticRepoServer({ bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("preset bar action buttons are compact icon buttons with accessible labels", async () => {
    const page = await openModulePage();

    try {
        const details = await page.evaluate(async () => {
            const { createPresetBar } = await import("/ui/shared/effects/preset-bar.ts");
            const mountPoint = document.getElementById("mount");

            if (!(mountPoint instanceof HTMLElement)) {
                throw new Error("Module test mount point is missing.");
            }

            const presetBar = createPresetBar();
            mountPoint.append(presetBar);

            const shadow = presetBar.shadowRoot;
            if (!shadow) {
                throw new Error("Preset bar shadow root is missing.");
            }

            return ["save", "save-as", "revert", "copy", "paste", "share"].map((action) => {
                const button = shadow.querySelector(`button[data-action="${action}"]`);

                if (!(button instanceof HTMLButtonElement)) {
                    throw new Error(`Preset action button ${action} is missing.`);
                }

                const svg = button.querySelector("svg");

                return {
                    action,
                    ariaLabel: button.getAttribute("aria-label"),
                    title: button.getAttribute("title"),
                    visibleText: button.textContent?.trim() ?? "",
                    svgClass: svg?.getAttribute("class") ?? null,
                    svgHidden: svg?.getAttribute("aria-hidden") ?? null,
                    width: getComputedStyle(button).width,
                };
            });
        });

        assert.deepEqual(details, [
            {
                action: "save",
                ariaLabel: "Save preset",
                title: "Save preset",
                visibleText: "",
                svgClass: "lucide lucide-save",
                svgHidden: "true",
                width: "32px",
            },
            {
                action: "save-as",
                ariaLabel: "Save as new preset",
                title: "Save as new preset",
                visibleText: "",
                svgClass: "lucide lucide-file-plus-2",
                svgHidden: "true",
                width: "32px",
            },
            {
                action: "revert",
                ariaLabel: "Revert preset",
                title: "Revert preset",
                visibleText: "",
                svgClass: "lucide lucide-undo-2",
                svgHidden: "true",
                width: "32px",
            },
            {
                action: "copy",
                ariaLabel: "Copy preset JSON",
                title: "Copy preset JSON",
                visibleText: "",
                svgClass: "lucide lucide-copy",
                svgHidden: "true",
                width: "32px",
            },
            {
                action: "paste",
                ariaLabel: "Paste preset JSON",
                title: "Paste preset JSON",
                visibleText: "",
                svgClass: "lucide lucide-clipboard-paste",
                svgHidden: "true",
                width: "32px",
            },
            {
                action: "share",
                ariaLabel: "Share sound link",
                title: "Share sound link",
                visibleText: "",
                svgClass: "lucide lucide-link-2",
                svgHidden: "true",
                width: "32px",
            },
        ]);
    } finally {
        await page.close();
    }
});

test("preset bar shows no passive success and one controller error toast per failed action", async () => {
    const page = await openModulePage();

    try {
        const result = await page.evaluate(async () => {
            const { createPresetBar } = await import("/ui/shared/effects/preset-bar.ts");
            const mountPoint = document.getElementById("mount");

            if (!(mountPoint instanceof HTMLElement)) {
                throw new Error("Module test mount point is missing.");
            }

            const presetItem = {
                presetKey: "factory:quiet-success",
                presetID: "quiet-success",
                label: "Quiet Success",
                effectID: "test",
                source: "factory",
                preset: {},
                isActive: false,
                dirty: false,
                canApply: true,
                canRename: false,
                canOverwrite: false,
                canDelete: false,
                canExport: true,
            };
            let state = {
                effectID: "test",
                ready: true,
                filter: { query: "", source: "all" },
                presets: [presetItem],
                visiblePresets: [presetItem],
                factoryPresets: [presetItem],
                userPresets: [],
                activePreset: null,
                activePresetID: null,
                activeLabel: "",
                dirty: false,
                currentValues: {},
                missingCurrentValueEndpointIDs: [],
                currentContract: null,
                lastError: null,
            };
            let stateListener = () => {};
            let nextApplyResult = {
                ok: true,
                value: {},
                message: "Preset applied.",
            };
            const appliedPresetKeys = [];
            const controller = {
                getState: () => state,
                subscribe(listener) {
                    stateListener = listener;
                    return () => { stateListener = () => {}; };
                },
                getMutations: () => ({
                    applyPreset(presetKey) {
                        appliedPresetKeys.push(presetKey);
                        if (!nextApplyResult.ok && "error" in nextApplyResult) {
                            state = { ...state, lastError: nextApplyResult.message };
                            stateListener(state);
                        }
                        return nextApplyResult;
                    },
                    clearLastError() {
                        state = { ...state, lastError: null };
                        stateListener(state);
                    },
                    setFilter() {},
                }),
            };

            const presetBar = createPresetBar();
            presetBar.controller = controller;
            mountPoint.append(presetBar);

            const shadow = presetBar.shadowRoot;
            if (!shadow) {
                throw new Error("Preset bar shadow root is missing.");
            }

            const openAndApply = () => {
                const nameRegion = shadow.querySelector('[data-action="toggle-flyout"]');

                if (!(nameRegion instanceof HTMLElement)) {
                    throw new Error("Preset flyout trigger is missing.");
                }

                nameRegion.click();
                const item = shadow.querySelector('[data-preset-key="factory:quiet-success"]');

                if (!(item instanceof HTMLElement)) {
                    throw new Error("Preset flyout item is missing.");
                }

                item.click();
            };

            openAndApply();
            const successToastCount = shadow.querySelectorAll(".cpb-toast").length;

            nextApplyResult = {
                ok: false,
                error: new Error("Apply failed."),
                message: "Apply failed.",
            };
            openAndApply();
            openAndApply();

            return {
                appliedPresetKeys,
                successToastCount,
                errorToastTexts: Array.from(shadow.querySelectorAll(".cpb-toast"))
                    .map((toast) => toast.textContent ?? ""),
            };
        });

        assert.deepEqual(result.appliedPresetKeys, [
            "factory:quiet-success",
            "factory:quiet-success",
            "factory:quiet-success",
        ]);
        assert.equal(result.successToastCount, 0);
        assert.deepEqual(result.errorToastTexts, ["Apply failed.", "Apply failed."]);
    } finally {
        await page.close();
    }
});
