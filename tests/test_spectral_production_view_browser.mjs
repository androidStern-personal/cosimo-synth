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

function spectralEndpoint(endpointID, name, group, annotation = {}) {
    return {
        endpointID,
        purpose: "parameter",
        annotation: {
            name,
            group,
            min: 0,
            max: 1,
            init: 0.5,
            ...annotation,
        },
    };
}

function patchConnectionSource(options = {}) {
    const config = {
        missingParameterValues: [],
        parameterValues: {},
        ...options,
    };

    return `
        const spectralTestConfig = ${JSON.stringify(config)};

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
                this.sentEvents = [];
                this.requestedParameterValues = [];
                this.endpoints = [
                    ${JSON.stringify(spectralEndpoint("magFeedbackIn", "Magnitude Feedback", "Feedback", { min: 0, max: 0.999, init: 0.92 }))},
                    ${JSON.stringify(spectralEndpoint("phaseFeedbackIn", "Phase Feedback", "Feedback", { min: 0, max: 1, init: 1 }))},
                    ${JSON.stringify(spectralEndpoint("dampingIn", "Damping", "Feedback", { min: 0.95, max: 1, init: 0.995 }))},
                    ${JSON.stringify(spectralEndpoint("magCeilingIn", "Magnitude Ceiling", "Feedback", { min: 1, max: 1000, init: 1000 }))},
                    ${JSON.stringify(spectralEndpoint("depthIn", "Depth", "Output", { min: 0, max: 1, init: 0 }))},
                    ${JSON.stringify(spectralEndpoint("lowCutHzIn", "Low Cut", "Output", { min: 20, max: 500, init: 60 }))},
                    ${JSON.stringify(spectralEndpoint("maskWidthCentsIn", "Mask Width", "Mask", { min: 5, max: 200, init: 40 }))},
                    ${JSON.stringify(spectralEndpoint("maskFloorIn", "Mask Floor", "Mask", { min: 0, max: 1, init: 0.08 }))},
                    ${JSON.stringify(spectralEndpoint("voiceModeIn", "Voice Mode", "Voices", { min: 0, max: 1, init: 0 }))},
                    ${JSON.stringify(spectralEndpoint("polyphonyIn", "Polyphony", "Voices", { min: 1, max: 16, init: 8 }))},
                    ${JSON.stringify(spectralEndpoint("voiceReleaseSecondsIn", "Voice Release", "Voices", { min: 0.01, max: 3, init: 0.35 }))},
                    ${JSON.stringify(spectralEndpoint("spectralModeIn", "Mode", "Algorithm", { min: 0, max: 1, init: 0, discrete: true, step: 1, text: "Resonator|Imprint" }))},
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
                this.requestedParameterValues.push(endpointID);

                if (spectralTestConfig.missingParameterValues.includes(endpointID))
                    return;

                const endpoint = this.endpoints.find((candidate) => candidate.endpointID === endpointID);
                const value = Object.prototype.hasOwnProperty.call(spectralTestConfig.parameterValues, endpointID)
                    ? spectralTestConfig.parameterValues[endpointID]
                    : endpoint?.annotation?.init;

                queueMicrotask(() => {
                    for (const listener of this.parameterListeners.get(endpointID) ?? [])
                        listener(value);
                });
            }

            sendEventOrValue(endpointID, value) {
                this.sentEvents.push({ endpointID, value });
            }

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

        window.__createSpectralProductionPatchConnection = () => {
            const connection = new SpectralProductionViewPatchConnection();
            window.__spectralPatchConnection = connection;
            return connection;
        };
    `;
}

async function openSpectralProductionView({
    viewport = DEFAULT_VIEWPORT,
    hostSize = DEFAULT_VIEWPORT,
    applyCmajorInlineSize = true,
    patchConnectionOptions = {},
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
    await page.addScriptTag({ content: patchConnectionSource(patchConnectionOptions) });
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
            const partialEditor = root.querySelector(".partial-editor");
            const partialPlot = root.querySelector(".partial-plot");
            const frame = root.querySelector(".frame");
            const readouts = root.querySelector(".partial-readouts");
            const error = root.querySelector('[data-role="effect-load-error"]');
            const bottomRow = canvas.getContext("2d").getImageData(
                0,
                Math.max(0, canvas.height - 5),
                canvas.width,
                1,
            ).data;
            let goldPixelsAtBottom = 0;
            for (let index = 0; index < bottomRow.length; index += 4) {
                const red = bottomRow[index];
                const green = bottomRow[index + 1];
                const blue = bottomRow[index + 2];
                if (red > 190 && green > 130 && green < 210 && blue < 130)
                    goldPixelsAtBottom += 1;
            }

            return {
                documentScrollHeight: document.documentElement.scrollHeight,
                documentScrollWidth: document.documentElement.scrollWidth,
                host: roundedRect(host.getBoundingClientRect(), ["top", "bottom", "width", "height"]),
                view: roundedRect(view.getBoundingClientRect(), ["top", "bottom", "width", "height"]),
                frame: roundedRect(frame.getBoundingClientRect(), ["top", "bottom", "height"]),
                partialEditor: {
                    ...roundedRect(partialEditor.getBoundingClientRect(), ["top", "bottom", "height"]),
                    clientHeight: Math.round(partialEditor.clientHeight),
                    scrollHeight: Math.round(partialEditor.scrollHeight),
                    overflowY: getComputedStyle(partialEditor).overflowY,
                },
                partialPlot: {
                    ...roundedRect(partialPlot.getBoundingClientRect(), ["top", "bottom", "height"]),
                    clientHeight: Math.round(partialPlot.clientHeight),
                    scrollHeight: Math.round(partialPlot.scrollHeight),
                    overflowY: getComputedStyle(partialPlot).overflowY,
                },
                canvas: roundedRect(canvas.getBoundingClientRect(), ["top", "bottom", "height"]),
                canvasBacking: {
                    width: canvas.width,
                    height: canvas.height,
                    goldPixelsAtBottom,
                },
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
            metrics.partialEditor.scrollHeight <= metrics.partialEditor.clientHeight + 1,
            `partial editor must fit its own contents without an internal scrollbar: ${JSON.stringify(metrics)}`,
        );
        assert.equal(metrics.partialEditor.overflowY, "hidden");
        assert.ok(
            metrics.partialPlot.scrollHeight <= metrics.partialPlot.clientHeight + 1,
            `partial plot must fit the visible canvas without table scrolling: ${JSON.stringify(metrics)}`,
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
        assert.ok(
            metrics.canvasBacking.goldPixelsAtBottom > 6,
            `partial bars must reach the bottom zero baseline of the visible canvas: ${JSON.stringify(metrics)}`,
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
            const partialEditor = root.querySelector(".partial-editor");
            const partialPlot = root.querySelector(".partial-plot");
            const frame = root.querySelector(".frame");
            const readouts = root.querySelector(".partial-readouts");
            const sidebar = root.querySelector(".frame-groups");
            const voicesGroup = Array.from(root.querySelectorAll(".group"))
                .find((group) => group.querySelector("h2")?.textContent === "Voices");
            const error = root.querySelector('[data-role="effect-load-error"]');

            return {
                documentScrollHeight: document.documentElement.scrollHeight,
                host: roundedRect(host.getBoundingClientRect(), ["top", "bottom", "height"]),
                view: roundedRect(view.getBoundingClientRect(), ["top", "bottom", "height"]),
                viewDisplay: getComputedStyle(view).display,
                frame: roundedRect(frame.getBoundingClientRect(), ["top", "bottom", "height"]),
                frameOverflowY: getComputedStyle(frame).overflowY,
                partialEditor: {
                    ...roundedRect(partialEditor.getBoundingClientRect(), ["top", "bottom", "height"]),
                    clientHeight: Math.round(partialEditor.clientHeight),
                    scrollHeight: Math.round(partialEditor.scrollHeight),
                    overflowY: getComputedStyle(partialEditor).overflowY,
                },
                partialPlot: {
                    ...roundedRect(partialPlot.getBoundingClientRect(), ["top", "bottom", "height"]),
                    clientHeight: Math.round(partialPlot.clientHeight),
                    scrollHeight: Math.round(partialPlot.scrollHeight),
                    overflowY: getComputedStyle(partialPlot).overflowY,
                },
                canvas: roundedRect(canvas.getBoundingClientRect(), ["top", "bottom", "height"]),
                readouts: roundedRect(readouts.getBoundingClientRect(), ["top", "bottom", "height"]),
                sidebar: {
                    ...roundedRect(sidebar.getBoundingClientRect(), ["top", "bottom", "height"]),
                    clientHeight: Math.round(sidebar.clientHeight),
                    scrollHeight: Math.round(sidebar.scrollHeight),
                    overflowY: getComputedStyle(sidebar).overflowY,
                },
                voicesBeforeScroll: voicesGroup
                    ? roundedRect(voicesGroup.getBoundingClientRect(), ["top", "bottom", "height"])
                    : null,
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
            metrics.partialEditor.scrollHeight <= metrics.partialEditor.clientHeight + 1,
            `partial editor must not create its own scroll area: ${JSON.stringify(metrics)}`,
        );
        assert.equal(metrics.partialEditor.overflowY, "hidden");
        assert.ok(
            metrics.partialPlot.scrollHeight <= metrics.partialPlot.clientHeight + 1,
            `partial plot must fit its canvas instead of scrolling internally: ${JSON.stringify(metrics)}`,
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
            `right-side scroll container should fit inside the host slot: ${JSON.stringify(metrics)}`,
        );
        assert.equal(metrics.sidebar.overflowY, "auto");
        assert.ok(
            metrics.sidebar.scrollHeight > metrics.sidebar.clientHeight,
            `right-side controls should overflow inside their own reachable scroll container: ${JSON.stringify(metrics)}`,
        );
        assert.ok(
            metrics.canvas.height >= 300,
            `partial editor should keep a usable drawing surface in the constrained host: ${JSON.stringify(metrics)}`,
        );

        const voicesAfterScroll = await page.evaluate(async () => {
            const view = document.querySelector("cosimo-spectral-chord-resonator-view");
            const root = view?.shadowRoot;
            const sidebar = root.querySelector(".frame-groups");
            const voicesGroup = Array.from(root.querySelectorAll(".group"))
                .find((group) => group.querySelector("h2")?.textContent === "Voices");
            const roundedRect = (rect, keys) => (
                Object.fromEntries(keys.map((key) => [key, Math.round(rect[key])]))
            );

            sidebar.scrollTop = sidebar.scrollHeight;
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const sidebarRect = sidebar.getBoundingClientRect();
            const voicesRect = voicesGroup.getBoundingClientRect();

            return {
                sidebar: roundedRect(sidebarRect, ["top", "bottom", "height"]),
                voices: roundedRect(voicesRect, ["top", "bottom", "height"]),
                voicesVisible: voicesRect.bottom <= sidebarRect.bottom + 1
                    && voicesRect.top >= sidebarRect.top - 1,
            };
        });

        assert.equal(
            voicesAfterScroll.voicesVisible,
            true,
            `Voices controls must be reachable by scrolling the right control column: ${JSON.stringify({ metrics, voicesAfterScroll })}`,
        );
    } finally {
        await page.close();
    }
});

test("spectral partial canvas resizes its backing store when the host height changes", async () => {
    const page = await openSpectralProductionView();

    try {
        const before = await page.evaluate(() => {
            const host = document.querySelector('[data-role="spectral-host-slot"]');
            const view = document.querySelector("cosimo-spectral-chord-resonator-view");
            const root = view?.shadowRoot;
            const canvas = root.querySelector("[data-partial-canvas]");
            const roundedRect = (rect, keys) => (
                Object.fromEntries(keys.map((key) => [key, Math.round(rect[key])]))
            );

            return {
                host: roundedRect(host.getBoundingClientRect(), ["height"]),
                canvas: roundedRect(canvas.getBoundingClientRect(), ["height"]),
                backingHeight: canvas.height,
            };
        });

        await page.evaluate(() => {
            const host = document.querySelector('[data-role="spectral-host-slot"]');
            host.style.height = "520px";
        });

        await page.waitForFunction((previousCanvasHeight) => {
            const host = document.querySelector('[data-role="spectral-host-slot"]');
            const view = document.querySelector("cosimo-spectral-chord-resonator-view");
            const canvas = view?.shadowRoot?.querySelector("[data-partial-canvas]");

            if (!host || !canvas)
                return false;

            const canvasHeight = Math.round(canvas.getBoundingClientRect().height);
            const devicePixelRatio = window.devicePixelRatio || 1;
            const expectedBackingHeight = Math.max(1, Math.floor(canvasHeight * devicePixelRatio));

            return Math.round(host.getBoundingClientRect().height) === 520
                && canvasHeight < previousCanvasHeight
                && canvas.height === expectedBackingHeight;
        }, before.canvas.height);

        const after = await page.evaluate(() => {
            const host = document.querySelector('[data-role="spectral-host-slot"]');
            const view = document.querySelector("cosimo-spectral-chord-resonator-view");
            const root = view?.shadowRoot;
            const canvas = root.querySelector("[data-partial-canvas]");
            const roundedRect = (rect, keys) => (
                Object.fromEntries(keys.map((key) => [key, Math.round(rect[key])]))
            );

            return {
                host: roundedRect(host.getBoundingClientRect(), ["height"]),
                canvas: roundedRect(canvas.getBoundingClientRect(), ["height"]),
                backingHeight: canvas.height,
                devicePixelRatio: window.devicePixelRatio || 1,
            };
        });
        const metrics = { before, after };

        assert.equal(metrics.after.host.height, 520);
        assert.ok(
            metrics.after.canvas.height < metrics.before.canvas.height,
            `canvas CSS height should shrink when the plugin host shrinks: ${JSON.stringify(metrics)}`,
        );
        assert.equal(
            metrics.after.backingHeight,
            Math.max(1, Math.floor(metrics.after.canvas.height * metrics.after.devicePixelRatio)),
            `canvas backing height should track the visible plot height after resize: ${JSON.stringify(metrics)}`,
        );
    } finally {
        await page.close();
    }
});

test("spectral production view does not reset depth when one startup parameter value is missing", async () => {
    const page = await openSpectralProductionView({
        patchConnectionOptions: {
            missingParameterValues: ["voiceReleaseSecondsIn"],
            parameterValues: {
                depthIn: 0.82,
                magFeedbackIn: 0.94,
            },
        },
    });

    try {
        await page.waitForFunction(() => {
            const connection = window.__spectralPatchConnection;
            const expectedEndpointIDs = connection.endpoints.map((endpoint) => endpoint.endpointID);
            return expectedEndpointIDs.every((endpointID) => (
                connection.requestedParameterValues.includes(endpointID)
            ));
        });
        await page.waitForTimeout(275);
        const probe = await page.evaluate(() => ({
            requestedParameterValues: window.__spectralPatchConnection.requestedParameterValues,
            sentEvents: window.__spectralPatchConnection.sentEvents,
        }));

        assert.ok(
            probe.requestedParameterValues.includes("voiceReleaseSecondsIn"),
            `startup probe must request the missing parameter before the no-reseed assertion: ${JSON.stringify(probe)}`,
        );
        assert.ok(
            probe.requestedParameterValues.includes("depthIn"),
            `startup probe must request existing parameters before the no-reseed assertion: ${JSON.stringify(probe)}`,
        );

        assert.deepEqual(
            probe.sentEvents,
            [],
            `missing a startup parameter value must not reseed every parameter to its manifest init: ${JSON.stringify(probe)}`,
        );
    } finally {
        await page.close();
    }
});
