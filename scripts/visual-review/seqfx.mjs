const selectedEffectType = "3";

async function installConnection(page, manifest) {
    await page.evaluate((runtimeManifest) => {
        class SeqFxBrowserReviewConnection {
            constructor() {
                this.manifest = {
                    ...runtimeManifest,
                    view: { ...runtimeManifest.view, devModule: "" },
                };
                this.utilities = { ParameterControls: {} };
                this.statusListeners = new Set();
                this.storedStateListeners = new Set();
                this.parameterListeners = new Map();
                this.endpointListeners = new Map();
                this.parameterValues = new Map();
                this.storedState = new Map();
            }

            getResourceAddress(resourcePath) {
                const relativePath = String(resourcePath).replace(/^\.?\/+/, "");
                return new URL(`/runtime/${relativePath}`, window.location.origin).toString();
            }

            addStatusListener(listener) { this.statusListeners.add(listener); }
            removeStatusListener(listener) { this.statusListeners.delete(listener); }
            requestStatusUpdate() {
                queueMicrotask(() => {
                    for (const listener of this.statusListeners)
                        listener({ details: { inputs: [] } });
                });
            }

            addStoredStateValueListener(listener) { this.storedStateListeners.add(listener); }
            removeStoredStateValueListener(listener) { this.storedStateListeners.delete(listener); }
            requestFullStoredState(callback) { queueMicrotask(() => callback({})); }
            requestStoredStateValue(key) {
                queueMicrotask(() => {
                    for (const listener of this.storedStateListeners)
                        listener({ key, value: this.storedState.get(key) });
                });
            }
            sendStoredStateValue(key, value) {
                this.storedState.set(key, value);
                for (const listener of this.storedStateListeners)
                    listener({ key, value });
            }

            addParameterListener(endpointID, listener) {
                const listeners = this.parameterListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                this.parameterListeners.set(endpointID, listeners);
            }
            removeParameterListener(endpointID, listener) {
                this.parameterListeners.get(endpointID)?.delete(listener);
            }
            requestParameterValue() {}
            sendEventOrValue(endpointID, value) {
                this.parameterValues.set(endpointID, value);
                for (const listener of this.parameterListeners.get(endpointID) ?? [])
                    listener(value);
            }

            sendParameterGestureStart() {}
            sendParameterGestureEnd() {}
            sendMIDIInputEvent() {}
            addEndpointListener(endpointID, listener) {
                const listeners = this.endpointListeners.get(endpointID) ?? new Set();
                listeners.add(listener);
                this.endpointListeners.set(endpointID, listeners);
            }
            removeEndpointListener(endpointID, listener) {
                this.endpointListeners.get(endpointID)?.delete(listener);
            }
        }

        window.__PLUGIN_VISUAL_REVIEW_CONNECTION__ = new SeqFxBrowserReviewConnection();
    }, manifest);
}

async function prepare(page) {
    await page.locator('[data-role="seqfx-root"]').waitFor();
    const dismiss = page.locator('[data-role="seqfx-first-use-dismiss"]');
    if (await dismiss.isVisible())
        await dismiss.click();

    await page.getByRole("button", { name: "Chain 1 step 1", exact: true }).click();
    await page.locator(
        `[data-role="seqfx-effect-type-option"][data-effect-type="${selectedEffectType}"]`,
    ).click();
    await page.getByRole("button", { name: "Chain 1 Tape Stop block 1", exact: true }).waitFor();
    await page.locator('[data-role="seqfx-inspector"]').waitFor();
}

async function prepareViewport(page, size) {
    if (size.name === "narrow") {
        await page.locator('[data-role="seqfx-inspector"]').evaluate((inspector) => {
            inspector.scrollIntoView({ block: "start", inline: "nearest" });
        });
    }
}

async function assertRepresentative(page, size) {
    const required = [
        ['[data-role="seqfx-inspector"]', "inspector"],
        ['[data-role="seqfx-effect-type"]', "effect picker"],
        [`[data-role="seqfx-effect-type-option"][data-effect-type="${selectedEffectType}"][aria-pressed="true"]`, "selected Tape Stop effect"],
    ];

    for (const [selector, label] of required) {
        const locator = page.locator(selector);
        if (!await locator.isVisible())
            throw new Error(`SeqFX ${label} is not visible at ${size.width}x${size.height}.`);
        const bounds = await locator.boundingBox();
        if (!bounds || bounds.y >= size.height || bounds.y + bounds.height <= 0) {
            throw new Error(`SeqFX ${label} is outside the ${size.width}x${size.height} capture.`);
        }
    }
}

export default {
    assertRepresentative,
    installConnection,
    prepare,
    prepareViewport,
};
