import path from "node:path";

import { build } from "esbuild";

import { repoRoot } from "../../kit/fx/build-effect.mjs";

const selectedEffectType = "3";

// Host values the review starts from: [min, max, step, value].
const parameterRanges = {
    enabled: [0, 1, 1, 1], globalMix: [0, 1, 0, 1], patternSelect: [0, 11, 1, 0], clockMode: [0, 2, 1, 0], manualBpm: [20, 300, 0, 120],
    rate: [0, 2, 1, 1], swing: [0, 0.45, 0, 0], loopStart: [0, 31, 1, 0], loopLength: [1, 32, 1, 32],
};

async function installConnection(page, manifest) {
    // The kit's browser state owner stands in for the plugin worker, so the
    // packaged view runs its real state session against page-local values.
    const previewState = await build({
        entryPoints: [path.join(repoRoot, "kit/ui/preview/state.ts")],
        bundle: true,
        format: "iife",
        globalName: "BuilderKitPreviewState",
        write: false,
        define: { "process.env.NODE_ENV": '"production"' },
    });
    await page.addScriptTag({ content: previewState.outputFiles[0].text });
    await page.evaluate(({ runtimeManifest, ranges }) => {
        const parameterValues = new Map(Object.entries(ranges).map(([endpoint, [, , , value]]) => [endpoint, value]));
        const storedState = new Map();
        const parameterListeners = new Map();
        const endpointListeners = new Map();
        const statusListeners = new Set();
        const storedStateListeners = new Set();
        const writeParameter = (endpointID, value) => {
            parameterValues.set(endpointID, value);
            for (const listener of parameterListeners.get(endpointID) ?? []) listener(value);
        };
        const state = window.BuilderKitPreviewState.createBrowserPreviewState({
            snapshot: () => ({
                values: Object.fromEntries(storedState),
                parameters: Object.entries(ranges).map(([endpoint, [min, max, step, defaultValue]]) => ({
                    endpoint, value: parameterValues.get(endpoint), min, max, step, defaultValue,
                })),
            }),
            parameter: writeParameter,
            stored(key, value) {
                storedState.set(key, value);
                for (const listener of storedStateListeners) listener({ key, value });
            },
            // A silent review page has no host automation recorder.
            gesture() {},
        });
        const subscribe = (listeners, key, listener) => {
            const subscribers = listeners.get(key) ?? new Set();
            subscribers.add(listener);
            listeners.set(key, subscribers);
        };
        window.__PLUGIN_VISUAL_REVIEW_CONNECTION__ = {
            ...state.host,
            manifest: { ...runtimeManifest, view: { ...runtimeManifest.view, devModule: "" } },
            utilities: { ParameterControls: {} },
            getResourceAddress(resourcePath) {
                const relativePath = String(resourcePath).replace(/^\.?\/+/, "");
                return new URL(`/runtime/${relativePath}`, window.location.origin).toString();
            },
            addStatusListener(listener) { statusListeners.add(listener); },
            removeStatusListener(listener) { statusListeners.delete(listener); },
            requestStatusUpdate() {
                queueMicrotask(() => {
                    for (const listener of statusListeners) listener({ details: { inputs: [] } });
                });
            },
            addStoredStateValueListener(listener) { storedStateListeners.add(listener); },
            removeStoredStateValueListener(listener) { storedStateListeners.delete(listener); },
            requestFullStoredState(callback) { queueMicrotask(() => callback({ values: Object.fromEntries(storedState) })); },
            requestStoredStateValue(key) {
                queueMicrotask(() => {
                    for (const listener of storedStateListeners) listener({ key, value: storedState.get(key) });
                });
            },
            addParameterListener(endpointID, listener) { subscribe(parameterListeners, endpointID, listener); },
            removeParameterListener(endpointID, listener) { parameterListeners.get(endpointID)?.delete(listener); },
            requestParameterValue(endpointID) {
                queueMicrotask(() => {
                    for (const listener of parameterListeners.get(endpointID) ?? []) listener(parameterValues.get(endpointID));
                });
            },
            sendEventOrValue(endpointID, value) {
                writeParameter(endpointID, value);
                if (parameterValues.has(endpointID)) state.observe(endpointID, Number(value));
            },
            sendParameterGestureStart() {},
            sendParameterGestureEnd() {},
            sendMIDIInputEvent() {},
            addEndpointListener(endpointID, listener) { subscribe(endpointListeners, endpointID, listener); },
            removeEndpointListener(endpointID, listener) { endpointListeners.get(endpointID)?.delete(listener); },
        };
    }, { runtimeManifest: manifest, ranges: parameterRanges });
}

async function prepare(page) {
    const root = page.locator('[data-role="seqfx-root"]');
    const runtimeFailure = page.locator("cosimo-seqfx-react-view pre");
    await page.locator('[data-role="seqfx-root"], cosimo-seqfx-react-view pre').waitFor();
    if (await runtimeFailure.isVisible()) {
        const message = (await runtimeFailure.textContent())?.trim() || "Unknown production render failure.";
        throw new Error(`SeqFX packaged view error: ${message}`);
    }
    await root.waitFor();
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
