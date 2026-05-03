import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { buildPlugin } from "../fx/build-effect.mjs";
import { startStaticRepoServer } from "./helpers/desktop_harness_browser.mjs";

const DEFAULT_VIEWPORT = {
    width: 980,
    height: 740,
};

const CONSTRAINED_HOST = {
    width: 980,
    height: 600,
};

let browser;
let server;
let runtimeBuilt = false;

async function ensureSpectralProductionRuntime() {
    if (runtimeBuilt)
        return;

    await buildPlugin("spectral");
    runtimeBuilt = true;
}

function spectralEndpoint(endpointID, name, group) {
    return {
        endpointID,
        purpose: "parameter",
        annotation: {
            name,
            group,
            min: 0,
            max: 1,
            init: 0.5,
        },
    };
}

function patchConnectionSource() {
    return `
        class SpectralProductionViewPatchConnection {
            constructor() {
                this.manifest = {
                    view: {
                        src: "view/index.js",
                        devModule: "/fx/spectral_chord_resonator/view/source.js",
                        width: 980,
                        height: 740,
                    },
                };
                this.statusListeners = new Set();
                this.parameterListeners = new Map();
                this.storedStateListeners = new Set();
                this.endpoints = [
                    ${JSON.stringify(spectralEndpoint("magFeedbackIn", "Magnitude Feedback", "Feedback"))},
                    ${JSON.stringify(spectralEndpoint("phaseFeedbackIn", "Phase Feedback", "Feedback"))},
                    ${JSON.stringify(spectralEndpoint("dampingIn", "Damping", "Feedback"))},
                    ${JSON.stringify(spectralEndpoint("magCeilingIn", "Magnitude Ceiling", "Feedback"))},
                    ${JSON.stringify(spectralEndpoint("depthIn", "Depth", "Output"))},
                    ${JSON.stringify(spectralEndpoint("lowCutHzIn", "Low Cut", "Output"))},
                    ${JSON.stringify(spectralEndpoint("maskWidthCentsIn", "Mask Width", "Mask"))},
                    ${JSON.stringify(spectralEndpoint("maskFloorIn", "Mask Floor", "Mask"))},
                ];
                this.utilities = {
                    ParameterControls: {
                        getAllCSS() {
                            return [
                                ".labelled-control{display:block;color:inherit}",
                                ".labelled-control-centered-control{display:grid;place-items:center;border-radius:999px;border:2px solid rgba(244,239,230,.78)}",
                                ".labelled-control-label-container{text-align:center}",
                            ].join("");
                        },
                        createLabelledControl(_connection, endpointInfo) {
                            const wrapper = document.createElement("div");
                            const knob = document.createElement("div");
                            const label = document.createElement("div");
                            wrapper.className = "labelled-control";
                            knob.className = "labelled-control-centered-control";
                            label.className = "labelled-control-label-container";
                            label.textContent = endpointInfo.annotation?.name ?? endpointInfo.endpointID;
                            wrapper.childControl = knob;
                            wrapper.append(knob, label);
                            return wrapper;
                        },
                    },
                };
            }

            addStatusListener(listener) {
                this.statusListeners.add(listener);
            }

            removeStatusListener(listener) {
                this.statusListeners.delete(listener);
            }

            requestStatusUpdate() {
                queueMicrotask(() => {
                    for (const listener of this.statusListeners)
                        listener({ details: { inputs: this.endpoints } });
                });
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
                queueMicrotask(() => {
                    for (const listener of this.parameterListeners.get(endpointID) ?? [])
                        listener(0.5);
                });
            }

            sendEventOrValue() {}

            addStoredStateValueListener(listener) {
                this.storedStateListeners.add(listener);
            }

            removeStoredStateValueListener(listener) {
                this.storedStateListeners.delete(listener);
            }

            requestFullStoredState(callback) {
                queueMicrotask(() => callback({}));
            }

            requestStoredStateValue(key) {
                queueMicrotask(() => {
                    for (const listener of this.storedStateListeners)
                        listener(key, null);
                });
            }

            sendStoredStateValue() {}
        }

        window.__createSpectralProductionPatchConnection = () => new SpectralProductionViewPatchConnection();
    `;
}

async function openSpectralProductionView({
    viewport = DEFAULT_VIEWPORT,
    hostSize = DEFAULT_VIEWPORT,
    applyCmajorInlineSize = true,
} = {}) {
    await ensureSpectralProductionRuntime();

    const page = await browser.newPage({
        viewport,
        deviceScaleFactor: 1,
    });

    await page.goto(server.baseUrl, { waitUntil: "load" });
    await page.evaluate((nextHostSize) => {
        document.body.replaceChildren();
        document.documentElement.style.margin = "0";
        document.documentElement.style.width = "100%";
        document.documentElement.style.height = "100%";
        document.body.style.margin = "0";
        document.body.style.width = "100%";
        document.body.style.height = "100%";
        document.body.style.overflow = "hidden";
        const host = document.createElement("main");
        host.dataset.role = "spectral-host-slot";
        host.style.width = `${nextHostSize.width}px`;
        host.style.height = `${nextHostSize.height}px`;
        host.style.overflow = "hidden";
        document.body.appendChild(host);
    }, hostSize);
    await page.addScriptTag({ content: patchConnectionSource() });
    await page.evaluate(async ({ shouldApplyCmajorInlineSize }) => {
        const module = await import("/build/fx/spectral_chord_resonator_runtime/view/app.js");
        const view = await module.default(window.__createSpectralProductionPatchConnection());
        const host = document.querySelector('[data-role="spectral-host-slot"]');

        if (shouldApplyCmajorInlineSize) {
            view.style.display = "block";
            view.style.width = "980px";
            view.style.height = "740px";
        }

        host.appendChild(view);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, {
        shouldApplyCmajorInlineSize: applyCmajorInlineSize,
    });

    return page;
}

before(async () => {
    server = await startStaticRepoServer();
    browser = await chromium.launch();
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("spectral production view keeps the partial editor inside the requested 980x740 plugin viewport", async () => {
    const page = await openSpectralProductionView();

    try {
        const metrics = await page.evaluate(() => {
            const view = document.querySelector("cosimo-spectral-chord-resonator-view");
            const root = view?.shadowRoot;
            const host = document.querySelector('[data-role="spectral-host-slot"]');
            const roundedRect = (rect, keys) => (
                Object.fromEntries(keys.map((key) => [key, Math.round(rect[key])]))
            );

            if (!view || !root || !host)
                throw new Error("Spectral production view did not mount.");

            const canvas = root.querySelector("[data-partial-canvas]");
            const frame = root.querySelector(".frame");
            const readouts = root.querySelector(".partial-readouts");
            const error = root.querySelector('[data-role="effect-load-error"]');

            return {
                documentScrollHeight: document.documentElement.scrollHeight,
                documentScrollWidth: document.documentElement.scrollWidth,
                host: roundedRect(host.getBoundingClientRect(), ["top", "bottom", "width", "height"]),
                view: roundedRect(view.getBoundingClientRect(), ["top", "bottom", "width", "height"]),
                frame: roundedRect(frame.getBoundingClientRect(), ["top", "bottom", "height"]),
                canvas: roundedRect(canvas.getBoundingClientRect(), ["top", "bottom", "height"]),
                readouts: roundedRect(readouts.getBoundingClientRect(), ["top", "bottom", "height"]),
                selectedReadout: root.querySelector("[data-selected-readout]")?.textContent ?? "",
                activeReadout: root.querySelector("[data-active-readout]")?.textContent ?? "",
                centroidReadout: root.querySelector("[data-centroid-readout]")?.textContent ?? "",
                loadError: error?.textContent ?? null,
            };
        });

        assert.equal(metrics.loadError, null);
        assert.ok(
            metrics.documentScrollHeight <= DEFAULT_VIEWPORT.height,
            `spectral view should not create vertical document scroll: ${JSON.stringify(metrics)}`,
        );
        assert.ok(
            metrics.documentScrollWidth <= DEFAULT_VIEWPORT.width,
            `spectral view should not create horizontal document scroll: ${JSON.stringify(metrics)}`,
        );
        assert.equal(metrics.view.height, DEFAULT_VIEWPORT.height);
        assert.ok(
            metrics.frame.bottom <= metrics.host.bottom,
            `plugin frame should fit inside the host slot: ${JSON.stringify(metrics)}`,
        );
        assert.ok(
            metrics.canvas.bottom <= DEFAULT_VIEWPORT.height,
            `partial editor canvas should fit inside the plugin viewport: ${JSON.stringify(metrics)}`,
        );
        assert.ok(
            metrics.readouts.bottom <= DEFAULT_VIEWPORT.height,
            `partial editor readouts should fit inside the plugin viewport: ${JSON.stringify(metrics)}`,
        );
        assert.equal(metrics.selectedReadout, "H1 1.000");
        assert.equal(metrics.activeReadout, "32 / 32");
        assert.equal(metrics.centroidReadout, "7.88");
        assert.ok(
            metrics.canvas.height >= 220,
            `partial editor canvas should remain usable after fitting: ${JSON.stringify(metrics)}`,
        );
    } finally {
        await page.close();
    }
});

test("spectral production view ignores Cmajor fixed inline height when the host slot is shorter", async () => {
    const page = await openSpectralProductionView({
        viewport: {
            width: CONSTRAINED_HOST.width,
            height: CONSTRAINED_HOST.height,
        },
        hostSize: CONSTRAINED_HOST,
        applyCmajorInlineSize: true,
    });

    try {
        const metrics = await page.evaluate(() => {
            const host = document.querySelector('[data-role="spectral-host-slot"]');
            const view = document.querySelector("cosimo-spectral-chord-resonator-view");
            const root = view?.shadowRoot;
            const roundedRect = (rect, keys) => (
                Object.fromEntries(keys.map((key) => [key, Math.round(rect[key])]))
            );

            if (!host || !view || !root)
                throw new Error("Spectral production view did not mount in the constrained host.");

            const canvas = root.querySelector("[data-partial-canvas]");
            const frame = root.querySelector(".frame");
            const readouts = root.querySelector(".partial-readouts");
            const sidebar = root.querySelector(".frame-groups");
            const error = root.querySelector('[data-role="effect-load-error"]');

            return {
                documentScrollHeight: document.documentElement.scrollHeight,
                host: roundedRect(host.getBoundingClientRect(), ["top", "bottom", "height"]),
                view: roundedRect(view.getBoundingClientRect(), ["top", "bottom", "height"]),
                viewDisplay: getComputedStyle(view).display,
                frame: roundedRect(frame.getBoundingClientRect(), ["top", "bottom", "height"]),
                canvas: roundedRect(canvas.getBoundingClientRect(), ["top", "bottom", "height"]),
                readouts: roundedRect(readouts.getBoundingClientRect(), ["top", "bottom", "height"]),
                sidebar: roundedRect(sidebar.getBoundingClientRect(), ["top", "bottom", "height"]),
                selectedReadout: root.querySelector("[data-selected-readout]")?.textContent ?? "",
                activeReadout: root.querySelector("[data-active-readout]")?.textContent ?? "",
                centroidReadout: root.querySelector("[data-centroid-readout]")?.textContent ?? "",
                loadError: error?.textContent ?? null,
            };
        });

        assert.equal(metrics.loadError, null);
        assert.equal(
            metrics.view.height,
            CONSTRAINED_HOST.height,
            `view should use the real host height instead of Cmajor's fixed inline height: ${JSON.stringify(metrics)}`,
        );
        assert.equal(
            metrics.viewDisplay,
            "grid",
            `view should override Cmajor's inline display:block so the header/editor rows can shrink: ${JSON.stringify(metrics)}`,
        );
        assert.ok(
            metrics.frame.bottom <= metrics.host.bottom,
            `plugin frame should not be clipped by the host slot: ${JSON.stringify(metrics)}`,
        );
        assert.ok(
            metrics.canvas.bottom <= metrics.host.bottom,
            `partial editor canvas should not be clipped by the host slot: ${JSON.stringify(metrics)}`,
        );
        assert.ok(
            metrics.readouts.bottom <= metrics.host.bottom,
            `partial editor readouts should not be clipped by the host slot: ${JSON.stringify(metrics)}`,
        );
        assert.equal(metrics.selectedReadout, "H1 1.000");
        assert.equal(metrics.activeReadout, "32 / 32");
        assert.equal(metrics.centroidReadout, "7.88");
        assert.ok(
            metrics.sidebar.bottom <= metrics.host.bottom,
            `right-side controls should fit inside the host slot: ${JSON.stringify(metrics)}`,
        );
        assert.ok(
            metrics.canvas.height >= 300,
            `partial editor should keep a usable drawing surface in the constrained host: ${JSON.stringify(metrics)}`,
        );
    } finally {
        await page.close();
    }
});
