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

            const buttons = ["save", "save-as", "revert", "copy", "paste"].map((action) => {
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

            return {
                buttons,
                // The synth-only surface (share links, bounce, compact shell,
                // Polish meter) lives in the synth's registered extension, not
                // in the generic bar.
                synthSurface: [
                    '[data-action="share"]',
                    "[data-synth-bounce]",
                    '[data-el="shell-menu"]',
                    '[data-el="polish-meter"]',
                    '[data-el="share-dialog"]',
                    '[data-el="shared-load-dialog"]',
                ].filter((selector) => shadow.querySelector(selector) !== null),
            };
        });

        assert.deepEqual(details.synthSurface, []);
        assert.deepEqual(details.buttons, [
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
        ]);
    } finally {
        await page.close();
    }
});

test("the synth preset bar extension keeps the full action row including the share link", async () => {
    const page = await openModulePage();

    try {
        const details = await page.evaluate(async () => {
            const { createSynthPresetBar } = await import("/ui/shared/effects/synth-preset-bar.ts");
            const mountPoint = document.getElementById("mount");

            if (!(mountPoint instanceof HTMLElement)) {
                throw new Error("Module test mount point is missing.");
            }

            const presetBar = createSynthPresetBar();
            mountPoint.append(presetBar);

            const shadow = presetBar.shadowRoot;
            if (!shadow) {
                throw new Error("Preset bar shadow root is missing.");
            }

            const actionGroup = shadow.querySelector(".action-group");
            if (!actionGroup) {
                throw new Error("Preset action group is missing.");
            }

            const share = actionGroup.querySelector('button[data-action="share"]');
            if (!(share instanceof HTMLButtonElement)) {
                throw new Error("Share action button is missing.");
            }
            const svg = share.querySelector("svg");

            return {
                actionOrder: Array.from(actionGroup.querySelectorAll("button[data-action]"))
                    .map((button) => button.dataset.action),
                share: {
                    ariaLabel: share.getAttribute("aria-label"),
                    title: share.getAttribute("title"),
                    visibleText: share.textContent?.trim() ?? "",
                    svgClass: svg?.getAttribute("class") ?? null,
                    svgHidden: svg?.getAttribute("aria-hidden") ?? null,
                    width: getComputedStyle(share).width,
                    disabled: share.disabled,
                },
            };
        });

        assert.deepEqual(details.actionOrder, ["save", "save-as", "revert", "copy", "paste", "share"]);
        assert.deepEqual(details.share, {
            ariaLabel: "Share sound link",
            title: "Share sound link",
            visibleText: "",
            svgClass: "lucide lucide-link-2",
            svgHidden: "true",
            width: "32px",
            disabled: true,
        });
    } finally {
        await page.close();
    }
});

test("preset bar registrations fail loudly when a tag is already taken by a different class", async () => {
    const page = await openModulePage();

    try {
        const result = await page.evaluate(async () => {
            const { createPresetBar, definePresetBarElement } = await import("/ui/shared/effects/preset-bar.ts");
            const { createSynthPresetBar, defineSynthPresetBarElement } = await import("/ui/shared/effects/synth-preset-bar.ts");
            const thrownMessage = (callback) => {
                try {
                    callback();
                    return null;
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            };

            // A foreign element already owning the tag must be rejected by
            // both registration paths.
            customElements.define("test-foreign-bar", class extends HTMLElement {});

            // The latent first-wins incident: the generic bar claiming the tag
            // first must make the synth registration loud, not silently hand
            // back a bar without the synth surface.
            definePresetBarElement("test-generic-first-bar");

            // Re-registering the same class under the same tag stays a no-op.
            const genericRedefineMessage = thrownMessage(() => definePresetBarElement("test-generic-first-bar"));
            createSynthPresetBar("test-synth-bar");
            const synthRedefineMessage = thrownMessage(() => defineSynthPresetBarElement("test-synth-bar"));

            return {
                genericOverForeignMessage: thrownMessage(() => definePresetBarElement("test-foreign-bar")),
                synthOverForeignMessage: thrownMessage(() => defineSynthPresetBarElement("test-foreign-bar")),
                synthOverGenericMessage: thrownMessage(() => defineSynthPresetBarElement("test-generic-first-bar")),
                genericRedefineMessage,
                synthRedefineMessage,
                genericTagName: createPresetBar("test-generic-first-bar").tagName,
            };
        });

        assert.match(result.genericOverForeignMessage ?? "", /"test-foreign-bar" is already registered to a non-PresetBar element/);
        assert.match(result.synthOverForeignMessage ?? "", /"test-foreign-bar" is already registered to a non-SynthPresetBar element/);
        assert.match(result.synthOverGenericMessage ?? "", /"test-generic-first-bar" is already registered to a non-SynthPresetBar element/);
        assert.equal(result.genericRedefineMessage, null);
        assert.equal(result.synthRedefineMessage, null);
        assert.equal(result.genericTagName, "TEST-GENERIC-FIRST-BAR");
    } finally {
        await page.close();
    }
});

test("effect header re-registration with different bar names fails loudly", async () => {
    const page = await openModulePage();

    try {
        const result = await page.evaluate(async () => {
            const { createEffectHeader, defineEffectHeaderElement } = await import("/ui/shared/effects/effect-header.ts");
            const thrownMessage = (callback) => {
                try {
                    callback();
                    return null;
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            };

            customElements.define("test-foreign-header", class extends HTMLElement {});
            defineEffectHeaderElement({
                elementName: "test-header",
                presetBarElementName: "test-header-preset-bar",
                snapshotBarElementName: "test-header-snapshot-bar",
            });

            return {
                foreignMessage: thrownMessage(() => defineEffectHeaderElement({ elementName: "test-foreign-header" })),
                sameOptionsMessage: thrownMessage(() => defineEffectHeaderElement({
                    elementName: "test-header",
                    presetBarElementName: "test-header-preset-bar",
                    snapshotBarElementName: "test-header-snapshot-bar",
                })),
                differentBarMessage: thrownMessage(() => defineEffectHeaderElement({
                    elementName: "test-header",
                    presetBarElementName: "test-other-preset-bar",
                })),
                headerTagName: createEffectHeader({
                    elementName: "test-header",
                    presetBarElementName: "test-header-preset-bar",
                    snapshotBarElementName: "test-header-snapshot-bar",
                }).tagName,
            };
        });

        assert.match(result.foreignMessage ?? "", /"test-foreign-header" is already registered to a non-EffectHeader element/);
        assert.equal(result.sameOptionsMessage, null);
        assert.match(result.differentBarMessage ?? "", /"test-header" is already registered with preset bar "test-header-preset-bar" and snapshot bar "test-header-snapshot-bar"/);
        assert.equal(result.headerTagName, "TEST-HEADER");
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
