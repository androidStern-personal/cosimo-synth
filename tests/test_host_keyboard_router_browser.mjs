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
    server = await startStaticRepoServer();
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
    await page.evaluate(async (connectionClassSource) => {
        // eslint-disable-next-line no-new-func
        const defineConnection = new Function(`${connectionClassSource}; return HostKeyboardSeqFxPatchConnection;`);
        const Connection = defineConnection();
        const module = await import("/build/fx/seqfx_runtime/view/app.js");
        const view = await module.default(new Connection());
        document.querySelector("#mount").replaceChildren(view);
    }, patchConnectionSource());
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
    await page.evaluate(async () => {
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
        const module = await import("/build/fx/enhancer_lite_runtime/view/app.js");
        document.querySelector("#mount").replaceChildren(await module.default(patchConnection));
    });
    await page.locator("cosimo-enhancer-lite-view").waitFor();
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
        const frequency = page.locator('[data-readout-control="frequency"]');
        await t.test("non-text slider role forwards Space down and matching up", async () => {
            assertForwardedPair(await pressAndRead(page, frequency), " ", "spacebar-transport");
        });

        const saveAs = page.locator('cosimo-effect-header [data-action="save-as"]');
        await saveAs.click();
        const presetName = page.locator('cosimo-effect-header [data-el="dialog-input"]');
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
                document.querySelector("cosimo-seqfx-react-view")?.shadowRoot?.activeElement === null
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

        const saveAs = page.locator('cosimo-effect-header [data-action="save-as"]');
        await saveAs.click();
        const presetName = page.locator('cosimo-effect-header [data-el="dialog-input"]');
        await presetName.waitFor();
        await t.test("genuine nested-shadow text entry keeps typed Space inside the plugin", async () => {
            const shadowDepth = await presetName.evaluate((element) => {
                let depth = 0;
                let current = element;
                while (current) {
                    const root = current.getRootNode();
                    if (!(root instanceof ShadowRoot)) break;
                    depth += 1;
                    current = root.host;
                }
                return depth;
            });
            assert.equal(shadowDepth >= 2, true);
            await presetName.fill("My");
            await presetName.evaluate((input) => input.setSelectionRange(input.value.length, input.value.length));
            assertDiscardedPair(await pressFocusedAndRead(page), " ", "text-entry-active");
            assert.equal(await presetName.inputValue(), "My ");
        });
    } finally {
        await page.close();
    }
});
