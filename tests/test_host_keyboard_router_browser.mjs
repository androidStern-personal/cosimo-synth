import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { buildPlugin } from "../kit/fx/build-effect.mjs";
import { startStaticRepoServer } from "../kit/tests/helpers/static_web_server.mjs";
import { readChocHostKeyboardRouter } from "./helpers/choc_host_keyboard_router.mjs";

const chocSourceRoot = process.env.COSIMO_CHOC_SOURCE_ROOT;
const shouldRun = typeof chocSourceRoot === "string" && chocSourceRoot.length > 0;

let browser;
let router;
let server;

before(async () => {
    if (!shouldRun) {
        return;
    }

    ({ router } = await readChocHostKeyboardRouter(chocSourceRoot));
    await buildPlugin("enhancer-lite");
    await buildPlugin("seqfx");
    server = await startStaticRepoServer({ bundleTypeScript: true });
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

function patchConnectionSource() {
    return `
        class HostKeyboardSeqFxPatchConnection {
            constructor() {
                this.manifest = { view: { src: "view/index.js", width: 1120, height: 680 } };
                this.storedState = {};
                this.parameters = {
                    enabled: 1,
                    globalMix: 1,
                    patternSelect: 0,
                    clockMode: 0,
                    manualBpm: 120,
                    rate: 1,
                    swing: 0,
                    loopStart: 0,
                    loopLength: 32,
                };
                this.status = { details: { inputs: [] } };
                this.statusListeners = new Set();
                this.storedStateListeners = new Set();
                this.parameterListeners = new Map();
                this.endpointListeners = new Map();
            }

            addStatusListener(listener) { this.statusListeners.add(listener); }
            removeStatusListener(listener) { this.statusListeners.delete(listener); }
            requestStatusUpdate() {
                for (const listener of this.statusListeners) listener(this.status);
            }

            addStoredStateValueListener(listener) { this.storedStateListeners.add(listener); }
            removeStoredStateValueListener(listener) { this.storedStateListeners.delete(listener); }
            requestFullStoredState(callback) {
                callback({ parameters: { ...this.parameters }, values: { ...this.storedState } });
            }
            requestStoredStateValue(key) {
                for (const listener of this.storedStateListeners) {
                    listener({ key, value: this.storedState[key] });
                }
            }
            sendStoredStateValue(key, value) {
                this.storedState[key] = value;
                for (const listener of this.storedStateListeners) listener({ key, value });
            }

            addParameterListener(endpointID, listener) {
                const listeners = this.parameterListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                this.parameterListeners.set(endpointID, listeners);
            }
            removeParameterListener(endpointID, listener) {
                this.parameterListeners.get(endpointID)?.delete(listener);
            }
            requestParameterValue(endpointID) {
                for (const listener of this.parameterListeners.get(endpointID) ?? []) {
                    listener(this.parameters[endpointID] ?? 0);
                }
            }
            sendEventOrValue(endpointID, value) {
                this.parameters[endpointID] = value;
                for (const listener of this.parameterListeners.get(endpointID) ?? []) listener(value);
            }

            addEndpointListener(endpointID, listener) {
                const listeners = this.endpointListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                this.endpointListeners.set(endpointID, listeners);
            }
            removeEndpointListener(endpointID, listener) {
                this.endpointListeners.get(endpointID)?.delete(listener);
            }
        }
    `;
}

/**
 * The kit's browser state owner stands in for the plugin worker. Each parameter
 * is [endpoint, value, min, max, step]; the mock connection stores what it writes.
 */
async function withStateOwner(patchConnection, parameters) {
    const { createBrowserPreviewState } = await import("/kit/ui/preview/state.ts");
    const values = new Map(parameters.map(([endpoint, value]) => [endpoint, value]));
    const stored = new Map();
    const stateHost = createBrowserPreviewState({
        snapshot: () => ({
            values: Object.fromEntries(stored),
            parameters: parameters.map(([endpoint, defaultValue, min, max, step]) => ({
                endpoint, value: values.get(endpoint), min, max, step, defaultValue,
            })),
        }),
        parameter(endpoint, value) {
            values.set(endpoint, value);
            patchConnection.sendEventOrValue(endpoint, value);
        },
        stored: (key, value) => stored.set(key, value),
        gesture() {},
    });
    return Object.assign(patchConnection, stateHost.host);
}

async function addRouterInitScript(page) {
    await page.addInitScript({
        content: `
            window.__CHOC_HOST_KEYBOARD_MESSAGES__ = [];
            Object.defineProperty(window, "webkit", {
                configurable: true,
                value: {
                    messageHandlers: {
                        chocHostKeyboard: {
                            postMessage(message) {
                                window.__CHOC_HOST_KEYBOARD_MESSAGES__.push(JSON.parse(message));
                            },
                        },
                    },
                },
            });
            ${router}
        `,
    });
}

async function openPackagedSeqFx() {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await addRouterInitScript(page);
    await page.goto(new URL("kit/tests/helpers/module_test_shell.html", server.baseUrl).toString());
    await page.evaluate(async ({ connectionClassSource, stateOwnerSource }) => {
        // eslint-disable-next-line no-new-func
        const defineConnection = new Function(`${connectionClassSource}; return HostKeyboardSeqFxPatchConnection;`);
        const Connection = defineConnection();
        // eslint-disable-next-line no-new-func
        const withStateOwner = new Function(`return (${stateOwnerSource})`)();
        const connection = await withStateOwner(new Connection(), [
            ["enabled", 1, 0, 1, 1], ["globalMix", 1, 0, 1, 0], ["patternSelect", 0, 0, 11, 1],
            ["clockMode", 0, 0, 2, 1], ["manualBpm", 120, 20, 300, 0], ["rate", 1, 0, 2, 1],
            ["swing", 0, 0, 0.45, 0], ["loopStart", 0, 0, 31, 1], ["loopLength", 32, 1, 32, 1],
        ]);
        const module = await import("/build/fx/seqfx_runtime/view/app.js");
        const view = await module.default(connection);
        document.querySelector("#mount").replaceChildren(view);
    }, { connectionClassSource: patchConnectionSource(), stateOwnerSource: withStateOwner.toString() });
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.waitForFunction(() => (
        window.__CHOC_HOST_KEYBOARD_MESSAGES__?.some(({ action }) => action === "installed")
    ));
    return page;
}

async function openPackagedEnhancerLite() {
    const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
    await addRouterInitScript(page);
    await page.goto(new URL("kit/tests/helpers/module_test_shell.html", server.baseUrl).toString());
    await page.evaluate(async ({ stateOwnerSource }) => {
        const parameterValues = new Map(Object.entries({
            freqHzIn: 130,
            qIn: 0.71,
            modeIn: 0,
            midAmountIn: 0,
            sideAmountIn: 0,
            curveIn: 1,
            saturationModeIn: 0,
            shapeIn: 1,
            analyzerEnabledIn: 0,
        }));
        const parameterListeners = new Map();
        const endpointListeners = new Map();
        const statusListeners = new Set();
        const storedStateListeners = new Set();
        const storedState = new Map();
        const patchConnection = {
            manifest: { name: "Cosimo Enhancer Lite" },
            addParameterListener(endpointID, listener) {
                const listeners = parameterListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                parameterListeners.set(endpointID, listeners);
            },
            removeParameterListener(endpointID, listener) {
                parameterListeners.get(endpointID)?.delete(listener);
            },
            requestParameterValue(endpointID) {
                for (const listener of parameterListeners.get(endpointID) ?? []) {
                    listener(parameterValues.get(endpointID));
                }
            },
            sendEventOrValue(endpointID, value) {
                parameterValues.set(endpointID, value);
                for (const listener of parameterListeners.get(endpointID) ?? []) listener(value);
            },
            addEndpointListener(endpointID, listener) {
                const listeners = endpointListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                endpointListeners.set(endpointID, listeners);
            },
            removeEndpointListener(endpointID, listener) {
                endpointListeners.get(endpointID)?.delete(listener);
            },
            addStatusListener(listener) { statusListeners.add(listener); },
            removeStatusListener(listener) { statusListeners.delete(listener); },
            requestStatusUpdate() {
                for (const listener of statusListeners) {
                    listener({ details: { inputs: [] } });
                }
            },
            addStoredStateValueListener(listener) { storedStateListeners.add(listener); },
            removeStoredStateValueListener(listener) { storedStateListeners.delete(listener); },
            requestFullStoredState(callback) { callback(Object.fromEntries(storedState)); },
            requestStoredStateValue(key) {
                for (const listener of storedStateListeners) listener({ key, value: storedState.get(key) });
            },
            sendStoredStateValue(key, value) {
                storedState.set(key, value);
                for (const listener of storedStateListeners) listener({ key, value });
            },
        };
        // eslint-disable-next-line no-new-func
        const withStateOwner = new Function(`return (${stateOwnerSource})`)();
        await withStateOwner(patchConnection, [
            ["freqHzIn", 130, 20, 20000, 0], ["qIn", 0.71, 0.1, 10, 0], ["modeIn", 0, 0, 1, 1],
            ["midAmountIn", 0, 0, 1, 0], ["sideAmountIn", 0, 0, 1, 0], ["curveIn", 1, 0, 1, 1],
            ["saturationModeIn", 0, 0, 1, 1], ["shapeIn", 1, 0, 2, 1], ["analyzerEnabledIn", 0, 0, 1, 1],
        ]);
        const module = await import("/build/fx/enhancer_lite_runtime/view/app.js");
        document.querySelector("#mount").replaceChildren(await module.default(patchConnection));
    }, { stateOwnerSource: withStateOwner.toString() });
    await page.getByRole("slider", { name: "Frequency", exact: true }).waitFor();
    await page.waitForFunction(() => (
        window.__CHOC_HOST_KEYBOARD_MESSAGES__?.some(({ action }) => action === "installed")
    ));
    return page;
}

async function clearRouterMessages(page) {
    await page.evaluate(() => window.__CHOC_HOST_KEYBOARD_MESSAGES__.splice(0));
}

async function readRouterMessages(page, expectedKeyboardMessageCount = 2) {
    await page.waitForFunction((expectedCount) => (
        window.__CHOC_HOST_KEYBOARD_MESSAGES__.filter(({ action }) => (
            action === "forwardBufferedEventToHost" || action === "discardBufferedEvent"
        )).length >= expectedCount
    ), expectedKeyboardMessageCount);
    return page.evaluate(() => structuredClone(window.__CHOC_HOST_KEYBOARD_MESSAGES__));
}

async function pressAndRead(page, locator, key = "Space") {
    await locator.focus();
    await clearRouterMessages(page);
    await locator.press(key);
    return readRouterMessages(page);
}

async function pressFocusedAndRead(page, key = "Space") {
    await clearRouterMessages(page);
    await page.keyboard.press(key);
    return readRouterMessages(page);
}

const presetBar = (page) => page.getByRole("group", { name: "Presets", exact: true });

function keyboardMessages(messages) {
    return messages.filter(({ action }) => (
        action === "forwardBufferedEventToHost" || action === "discardBufferedEvent"
    ));
}

function assertForwardedPair(messages, key, keydownReason) {
    assert.deepEqual(
        keyboardMessages(messages).map(({ action, eventType, key: payloadKey, repeat, reason }) => ({
            action,
            eventType,
            key: payloadKey,
            repeat,
            reason,
        })),
        [
            {
                action: "forwardBufferedEventToHost",
                eventType: "keydown",
                key,
                repeat: false,
                reason: keydownReason,
            },
            {
                action: "forwardBufferedEventToHost",
                eventType: "keyup",
                key,
                repeat: false,
                reason: "matching-forwarded-keyup",
            },
        ],
    );
}

function assertDiscardedPair(messages, key, reason) {
    assert.deepEqual(
        keyboardMessages(messages).map(({ action, eventType, key: payloadKey, reason: payloadReason }) => ({
            action,
            eventType,
            key: payloadKey,
            reason: payloadReason,
        })),
        [
            { action: "discardBufferedEvent", eventType: "keydown", key, reason },
            { action: "discardBufferedEvent", eventType: "keyup", key, reason },
        ],
    );
}

test("the exact CHOC router reaches the native seam from the packaged Enhancer Lite target", {
    skip: shouldRun ? false : "Set COSIMO_CHOC_SOURCE_ROOT to the exact CHOC checkout under qualification.",
}, async (t) => {
    const page = await openPackagedEnhancerLite();

    try {
        const frequency = page.getByRole("slider", { name: "Frequency", exact: true });
        await t.test("non-text slider role forwards Space down and matching up", async () => {
            assertForwardedPair(await pressAndRead(page, frequency), " ", "spacebar-transport");
        });

        await page.getByRole("button", { name: "Save as new", exact: true }).click();
        const presetName = page.getByRole("textbox", { name: "Preset name" });
        await presetName.waitFor();
        await t.test("real preset-name text entry discards Space inside the plugin", async () => {
            await page.waitForTimeout(50);
            await presetName.fill("Customer");
            await presetName.evaluate((input) => input.setSelectionRange(input.value.length, input.value.length));
            assertDiscardedPair(await pressFocusedAndRead(page), " ", "text-entry-active");
            assert.equal(await presetName.inputValue(), "Customer ");
        });
    } finally {
        await page.close();
    }
});

test("the exact CHOC router reaches the native forward/discard seam from packaged SeqFX controls", {
    skip: shouldRun ? false : "Set COSIMO_CHOC_SOURCE_ROOT to the exact CHOC checkout under qualification.",
}, async (t) => {
    const page = await openPackagedSeqFx();

    try {
        const reset = page.locator('[data-role="seqfx-reset"]');

        await t.test("non-text button forwards Space down and matching up", async () => {
            await reset.evaluate((element) => {
                window.__SEQFX_RESET_SPACE_CLICK_COUNT__ = 0;
                element.addEventListener("click", () => {
                    window.__SEQFX_RESET_SPACE_CLICK_COUNT__ += 1;
                }, { once: true });
            });
            assertForwardedPair(await pressAndRead(page, reset), " ", "spacebar-transport");
            assert.equal(await page.evaluate(() => window.__SEQFX_RESET_SPACE_CLICK_COUNT__), 0);
        });

        const range = page.locator('input[type="range"][data-role="seqfx-global-mix"]');
        await range.waitFor();
        await t.test("range control forwards Space down and matching up", async () => {
            assertForwardedPair(await pressAndRead(page, range), " ", "spacebar-transport");
        });

        await t.test("an active range drag still forwards the original Space pair", async () => {
            const bounds = await range.boundingBox();
            assert.ok(bounds);
            await range.focus();
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.down();
            try {
                await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height / 2);
                await clearRouterMessages(page);
                await page.keyboard.press("Space");
                assertForwardedPair(await readRouterMessages(page), " ", "spacebar-transport");
            } finally {
                await page.mouse.up();
            }
        });

        await t.test("repeated Space keydowns retain repeat and one matching keyup", async () => {
            await range.focus();
            await clearRouterMessages(page);
            await page.keyboard.down("Space");
            await page.keyboard.down("Space");
            await page.keyboard.up("Space");
            const messages = keyboardMessages(await readRouterMessages(page, 3));
            assert.deepEqual(
                messages.map(({ action, eventType, repeat, reason }) => ({ action, eventType, repeat, reason })),
                [
                    { action: "forwardBufferedEventToHost", eventType: "keydown", repeat: false, reason: "spacebar-transport" },
                    { action: "forwardBufferedEventToHost", eventType: "keydown", repeat: true, reason: "spacebar-transport" },
                    { action: "forwardBufferedEventToHost", eventType: "keyup", repeat: false, reason: "matching-forwarded-keyup" },
                ],
            );
        });

        const loopStart = page.locator('[data-role="seqfx-loop-start"]');
        await loopStart.waitFor();
        await t.test("unclaimed Space from the real loop-start number field forwards without editing or blurring", async () => {
            await loopStart.focus();
            const valueBefore = await loopStart.inputValue();
            assertForwardedPair(await pressFocusedAndRead(page), " ", "spacebar-transport");
            assert.equal(await loopStart.inputValue(), valueBefore);
            assert.equal(await loopStart.evaluate((element) => element.getRootNode().activeElement === element), true);
        });

        await t.test("repeated Space keydowns from the number field retain repeat and one matching keyup", async () => {
            await loopStart.focus();
            const valueBefore = await loopStart.inputValue();
            await clearRouterMessages(page);
            await page.keyboard.down("Space");
            await page.keyboard.down("Space");
            await page.keyboard.up("Space");
            const messages = keyboardMessages(await readRouterMessages(page, 3));
            assert.deepEqual(
                messages.map(({ action, eventType, repeat, reason }) => ({ action, eventType, repeat, reason })),
                [
                    { action: "forwardBufferedEventToHost", eventType: "keydown", repeat: false, reason: "spacebar-transport" },
                    { action: "forwardBufferedEventToHost", eventType: "keydown", repeat: true, reason: "spacebar-transport" },
                    { action: "forwardBufferedEventToHost", eventType: "keyup", repeat: false, reason: "matching-forwarded-keyup" },
                ],
            );
            assert.equal(await loopStart.inputValue(), valueBefore);
            assert.equal(await loopStart.evaluate((element) => element.getRootNode().activeElement === element), true);
        });

        await t.test("matching Space keyup forwards after focus moves away from the number field", async () => {
            await loopStart.focus();
            const valueBefore = await loopStart.inputValue();
            await clearRouterMessages(page);
            await page.keyboard.down("Space");
            await reset.focus();
            assert.equal(await reset.evaluate((element) => element.getRootNode().activeElement === element), true);
            await page.keyboard.up("Space");
            assertForwardedPair(await readRouterMessages(page), " ", "spacebar-transport");
            assert.equal(await loopStart.inputValue(), valueBefore);
        });

        await t.test("a nested keyboard dispatch cannot consume the outer event finalizer", async () => {
            await loopStart.focus();
            await clearRouterMessages(page);
            await loopStart.evaluate((element) => {
                element.addEventListener("keydown", (event) => {
                    if (event.key !== " ") return;
                    for (const type of ["keydown", "keyup"]) {
                        element.dispatchEvent(new KeyboardEvent(type, {
                            bubbles: true,
                            cancelable: true,
                            code: "KeyX",
                            composed: true,
                            key: "x",
                        }));
                    }
                }, { once: true });
            });
            await page.keyboard.press("Space");
            const messages = keyboardMessages(await readRouterMessages(page, 4));
            assert.deepEqual(
                messages.map(({ action, eventType, key, reason }) => ({ action, eventType, key, reason })),
                [
                    { action: "discardBufferedEvent", eventType: "keydown", key: "x", reason: "text-entry-active" },
                    { action: "discardBufferedEvent", eventType: "keyup", key: "x", reason: "text-entry-active" },
                    { action: "forwardBufferedEventToHost", eventType: "keydown", key: " ", reason: "spacebar-transport" },
                    { action: "forwardBufferedEventToHost", eventType: "keyup", key: " ", reason: "matching-forwarded-keyup" },
                ],
            );
        });

        await t.test("numeric editing keys remain inside the focused number field", async () => {
            await loopStart.focus();
            const valueBefore = await loopStart.inputValue();
            assertDiscardedPair(await pressFocusedAndRead(page, "ArrowUp"), "ArrowUp", "text-entry-active");
            assert.notEqual(await loopStart.inputValue(), valueBefore);
            assert.equal(await loopStart.evaluate((element) => element.getRootNode().activeElement === element), true);
        });

        await t.test("a modifier chord does not take the numeric Space exception", async () => {
            await loopStart.focus();
            await clearRouterMessages(page);
            await page.keyboard.down("Control");
            await page.keyboard.press("Space");
            await page.keyboard.up("Control");
            const spaceMessages = keyboardMessages(await readRouterMessages(page, 4))
                .filter(({ key }) => key === " ");
            assertDiscardedPair(spaceMessages, " ", "text-entry-active");
        });

        await t.test("composing Space does not take the numeric exception", async () => {
            await loopStart.focus();
            await clearRouterMessages(page);
            await loopStart.evaluate((element) => {
                for (const type of ["keydown", "keyup"]) {
                    element.dispatchEvent(new KeyboardEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        code: "Space",
                        composed: true,
                        isComposing: true,
                        key: " ",
                    }));
                }
            });
            assertDiscardedPair(await readRouterMessages(page), " ", "text-entry-active");
        });

        await t.test("a number field can still claim Space with preventDefault", async () => {
            await loopStart.focus();
            await loopStart.evaluate((element) => {
                element.__claimSpaceCount = 0;
                element.__claimSpace = (event) => {
                    if (event.key === " ") event.preventDefault();
                    element.__claimSpaceCount += 1;
                };
                element.addEventListener("keydown", element.__claimSpace);
                element.addEventListener("keyup", element.__claimSpace);
            });
            const messages = await pressFocusedAndRead(page);
            assert.equal(await loopStart.evaluate((element) => element.__claimSpaceCount), 2);
            await loopStart.evaluate((element) => {
                element.removeEventListener("keydown", element.__claimSpace);
                element.removeEventListener("keyup", element.__claimSpace);
                delete element.__claimSpace;
                delete element.__claimSpaceCount;
            });
            assertDiscardedPair(messages, " ", "plugin-prevented-default");
        });

        await t.test("stopped propagation fails closed in the next task", async () => {
            await loopStart.focus();
            await loopStart.evaluate((element) => {
                element.__stopSpace = (event) => {
                    if (event.key === " ") event.stopPropagation();
                };
                element.addEventListener("keydown", element.__stopSpace);
                element.addEventListener("keyup", element.__stopSpace);
            });
            const messages = await pressFocusedAndRead(page);
            await loopStart.evaluate((element) => {
                element.removeEventListener("keydown", element.__stopSpace);
                element.removeEventListener("keyup", element.__stopSpace);
                delete element.__stopSpace;
            });
            assertDiscardedPair(messages, " ", "event-did-not-reach-window-bubble");
            await page.waitForTimeout(20);
            assert.equal(keyboardMessages(await page.evaluate(() => (
                structuredClone(window.__CHOC_HOST_KEYBOARD_MESSAGES__)
            ))).length, 2);
        });

        const clockMode = page.locator('[data-role="seqfx-clock-mode"]');
        await t.test("a focused select menu keeps Space inside the plugin", async () => {
            assertDiscardedPair(await pressAndRead(page, clockMode), " ", "text-entry-active");
        });

        await t.test("pointer-used select menu releases focus before the next Space pair", async () => {
            await clockMode.focus();
            await clockMode.dispatchEvent("pointerdown");
            await clockMode.selectOption("0");
            await page.waitForFunction(() => (
                document.querySelector("builder-kit-state-view")?.shadowRoot?.activeElement === null
            ));
            await clearRouterMessages(page);
            await page.keyboard.press("Space");
            assertForwardedPair(await readRouterMessages(page), " ", "spacebar-transport");
        });

        await t.test("an actual plugin-owned shortcut is discarded after preventDefault", async () => {
            const step = page.getByRole("button", { name: "Chain 1 step 1", exact: true });
            await step.click();
            await page.locator('[data-role="seqfx-cell"][data-lane="0"][data-step="0"].is-selected').waitFor();
            await step.focus();
            const shortcutMessages = keyboardMessages(await pressFocusedAndRead(page, "Meta+c"))
                .filter(({ key }) => key.toLowerCase() === "c");
            assert.deepEqual(
                shortcutMessages.map(({ action, eventType, reason }) => ({
                    action,
                    eventType,
                    reason,
                })),
                [
                    { action: "discardBufferedEvent", eventType: "keydown", reason: "plugin-prevented-default" },
                    { action: "discardBufferedEvent", eventType: "keyup", reason: "plugin-modifier-shortcut" },
                ],
            );
        });

        await t.test("a stopped musical-typing keyup still releases a forwarded key after focus moves to text", async () => {
            await range.focus();
            await clearRouterMessages(page);
            await page.keyboard.down("a");
            const keydownMessages = keyboardMessages(await readRouterMessages(page, 1));
            assert.deepEqual(
                keydownMessages.map(({ action, eventType, key, reason }) => ({ action, eventType, key, reason })),
                [{
                    action: "forwardBufferedEventToHost",
                    eventType: "keydown",
                    key: "a",
                    reason: "ableton-musical-typing-key",
                }],
            );

            const saveAs = presetBar(page).getByRole("button", { name: "Save as new", exact: true });
            await saveAs.click();
            const input = presetBar(page).getByRole("textbox", { name: "Preset name", exact: true });
            await input.waitFor();
            await input.focus();
            await input.evaluate((element) => {
                element.addEventListener("keyup", (event) => {
                    if (event.key === "a") event.stopPropagation();
                }, { once: true });
            });
            await clearRouterMessages(page);
            await page.keyboard.up("a");
            try {
                const keyupMessages = keyboardMessages(await readRouterMessages(page, 1));
                assert.deepEqual(
                    keyupMessages.map(({ action, eventType, key, reason }) => ({ action, eventType, key, reason })),
                    [{
                        action: "forwardBufferedEventToHost",
                        eventType: "keyup",
                        key: "a",
                        reason: "matching-forwarded-keyup",
                    }],
                );
                await page.waitForTimeout(20);
                assert.equal(keyboardMessages(await page.evaluate(() => (
                    structuredClone(window.__CHOC_HOST_KEYBOARD_MESSAGES__)
                ))).length, 1);
            } finally {
                await presetBar(page).getByRole("button", { name: "Cancel", exact: true }).click();
            }
        });

        await t.test("a stopped numeric Space keyup still releases its forwarded key after focus moves to text", async () => {
            await loopStart.focus();
            await clearRouterMessages(page);
            await page.keyboard.down("Space");
            const keydownMessages = keyboardMessages(await readRouterMessages(page, 1));
            assert.deepEqual(
                keydownMessages.map(({ action, eventType, key, reason }) => ({ action, eventType, key, reason })),
                [{
                    action: "forwardBufferedEventToHost",
                    eventType: "keydown",
                    key: " ",
                    reason: "spacebar-transport",
                }],
            );

            const saveAs = presetBar(page).getByRole("button", { name: "Save as new", exact: true });
            await saveAs.click();
            const input = presetBar(page).getByRole("textbox", { name: "Preset name", exact: true });
            await input.waitFor();
            await input.focus();
            await input.evaluate((element) => {
                element.addEventListener("keyup", (event) => {
                    if (event.key === " ") event.stopPropagation();
                }, { once: true });
            });
            await clearRouterMessages(page);
            await page.keyboard.up("Space");
            try {
                const keyupMessages = keyboardMessages(await readRouterMessages(page, 1));
                assert.deepEqual(
                    keyupMessages.map(({ action, eventType, key, reason }) => ({ action, eventType, key, reason })),
                    [{
                        action: "forwardBufferedEventToHost",
                        eventType: "keyup",
                        key: " ",
                        reason: "matching-forwarded-keyup",
                    }],
                );
                await page.waitForTimeout(20);
                assert.equal(keyboardMessages(await page.evaluate(() => (
                    structuredClone(window.__CHOC_HOST_KEYBOARD_MESSAGES__)
                ))).length, 1);
            } finally {
                await presetBar(page).getByRole("button", { name: "Cancel", exact: true }).click();
            }
        });

        const shadowDepth = (locator) => locator.evaluate((element) => {
            let depth = 0;
            for (let root = element.getRootNode(); root instanceof ShadowRoot; root = root.host.getRootNode()) depth += 1;
            return depth;
        });

        const saveAs = presetBar(page).getByRole("button", { name: "Save as new", exact: true });
        await saveAs.click();
        const presetName = presetBar(page).getByRole("textbox", { name: "Preset name", exact: true });
        await presetName.waitFor();
        await t.test("preset-name text entry inside the plugin's shadow root keeps typed Space inside the plugin", async () => {
            assert.equal(await shadowDepth(presetName), 1);
            await presetName.fill("My");
            await presetName.evaluate((input) => input.setSelectionRange(input.value.length, input.value.length));
            assertDiscardedPair(await pressFocusedAndRead(page), " ", "text-entry-active");
            assert.equal(await presetName.inputValue(), "My ");
        });

        await t.test("text entry two shadow roots deep keeps typed Space inside the plugin", async () => {
            // The plugin view owns one shadow root; an embedded web component inside it adds a second.
            await page.evaluate(() => {
                const viewRoot = document.querySelector("builder-kit-state-view").shadowRoot;
                const nested = document.createElement("div");
                nested.attachShadow({ mode: "open" }).innerHTML = '<input aria-label="Nested name">';
                viewRoot.append(nested);
            });
            const nestedName = page.getByRole("textbox", { name: "Nested name", exact: true });
            assert.equal(await shadowDepth(nestedName), 2);
            await nestedName.fill("My");
            await nestedName.focus();
            assertDiscardedPair(await pressFocusedAndRead(page), " ", "text-entry-active");
            assert.equal(await nestedName.inputValue(), "My ");
        });
    } finally {
        await page.close();
    }
});
