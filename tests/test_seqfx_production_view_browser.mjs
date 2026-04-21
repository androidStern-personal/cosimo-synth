import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";

import { chromium } from "playwright";

import { buildPlugin, repoRoot } from "../fx/build-effect.mjs";

const RUNTIME_LOADER_PATH = "build/fx/seqfx_runtime/view/index.js";
const RUNTIME_APP_PATH = "build/fx/seqfx_runtime/view/app.js";
const VIEWPORT = {
    width: 1120,
    height: 680,
};
const STUTTER_GRAPH_VIEWBOX_WIDTH = 480;
const STUTTER_GRAPH_VIEWBOX_HEIGHT = 220;
const STUTTER_GRAPH_LEFT = 24;
const STUTTER_GRAPH_PLOT_WIDTH = 432;

let browser;
let staticServer;
let staticServerOrigin;
let runtimeBuilt = false;

function contentTypeForPath(filePath) {
    if (filePath.endsWith(".js")) {
        return "text/javascript";
    }

    if (filePath.endsWith(".json")) {
        return "application/json";
    }

    if (filePath.endsWith(".html")) {
        return "text/html";
    }

    return "application/octet-stream";
}

async function startStaticServer() {
    const server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url ?? "/", "http://127.0.0.1");

            if (url.pathname === "/") {
                response.writeHead(200, { "Content-Type": "text/html" });
                response.end("<!doctype html><html><body></body></html>");
                return;
            }

            const requestedPath = decodeURIComponent(url.pathname);
            const absolutePath = requestedPath.startsWith("/view/")
                ? path.resolve(repoRoot, "build/fx/seqfx_runtime", `.${requestedPath}`)
                : path.resolve(repoRoot, `.${requestedPath}`);

            if (absolutePath !== repoRoot && !absolutePath.startsWith(`${repoRoot}${path.sep}`)) {
                response.writeHead(403);
                response.end("Forbidden");
                return;
            }

            const fileStat = await stat(absolutePath);

            if (!fileStat.isFile()) {
                response.writeHead(404);
                response.end("Not found");
                return;
            }

            response.writeHead(200, {
                "Content-Type": contentTypeForPath(absolutePath),
            });
            response.end(await readFile(absolutePath));
        } catch {
            response.writeHead(404);
            response.end("Not found");
        }
    });

    await new Promise((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert.ok(address && typeof address === "object");

    return {
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        }),
    };
}

async function startHangingDevStatusServer() {
    const openSockets = new Set();
    const server = createServer((request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");

        if (url.pathname === "/__fx-dev-status") {
            return;
        }

        response.writeHead(404);
        response.end("Not found");
    });

    server.on("connection", (socket) => {
        openSockets.add(socket);
        socket.on("close", () => openSockets.delete(socket));
    });

    await new Promise((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert.ok(address && typeof address === "object");

    return {
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolve, reject) => {
            for (const socket of openSockets) {
                socket.destroy();
            }

            server.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        }),
    };
}

async function ensureSeqFxProductionRuntime() {
    if (runtimeBuilt) {
        return;
    }

    await buildPlugin("seqfx");

    await stat(path.join(repoRoot, RUNTIME_LOADER_PATH));
    await stat(path.join(repoRoot, RUNTIME_APP_PATH));
    runtimeBuilt = true;
}

async function readStutterEnvelopePathSamples(page, phases) {
    return page.locator('[data-role="seqfx-stutter-editor"]').evaluate((node, targetPhases) => {
        const path = node.querySelector('[data-role="seqfx-stutter-env-path"]');
        const d = path?.getAttribute("d") ?? "";
        const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        const points = [];

        for (let index = 0; index + 1 < numbers.length; index += 2) {
            points.push({ x: numbers[index], y: numbers[index + 1] });
        }

        if (points.length < 2) {
            return null;
        }

        const left = points[0].x;
        const right = points[points.length - 1].x;
        const width = Math.max(1, right - left);

        const sampleAtPhase = (phase) => {
            let nearestPoint = points[0];
            let nearestDistance = Number.POSITIVE_INFINITY;

            for (const point of points) {
                const pointPhase = (point.x - left) / width;
                const distance = Math.abs(pointPhase - phase);

                if (distance < nearestDistance) {
                    nearestPoint = point;
                    nearestDistance = distance;
                }
            }

            return nearestPoint.y;
        };

        return Object.fromEntries(targetPhases.map((phase) => [phase.toFixed(2), sampleAtPhase(phase)]));
    }, phases);
}

function stutterGraphPoint(graphBox, normalizedGate) {
    const svgX = STUTTER_GRAPH_LEFT + (Math.min(1, Math.max(0, normalizedGate)) * STUTTER_GRAPH_PLOT_WIDTH);

    return {
        x: graphBox.x + ((svgX / STUTTER_GRAPH_VIEWBOX_WIDTH) * graphBox.width),
        y: graphBox.y + ((110 / STUTTER_GRAPH_VIEWBOX_HEIGHT) * graphBox.height),
    };
}

function patchConnectionSource() {
    return `
        class SeqFxProductionSmokePatchConnection {
            constructor() {
                this.manifest = {
                    view: {
                        src: "view/index.js",
                        devModule: "/fx/seqfx/view/source.tsx",
                        width: 1120,
                        height: 680,
                    },
                };
                this.storedState = {};
                this.events = [];
                this.parameters = {
                    patternSelect: 0,
                    rate: 1,
                };
                this.status = {
                    details: {
                        inputs: [],
                    },
                };
                this.statusListeners = new Set();
                this.storedStateListeners = new Set();
                this.parameterListeners = new Map();
                this.endpointListeners = new Map();
            }

            getResourceAddress(path) {
                return path.startsWith("/") ? path : "/" + path;
            }

            addStatusListener(listener) {
                this.statusListeners.add(listener);
            }

            removeStatusListener(listener) {
                this.statusListeners.delete(listener);
            }

            requestStatusUpdate() {
                for (const listener of this.statusListeners) {
                    listener(this.status);
                }
            }

            addStoredStateValueListener(listener) {
                this.storedStateListeners.add(listener);
            }

            removeStoredStateValueListener(listener) {
                this.storedStateListeners.delete(listener);
            }

            requestFullStoredState(callback) {
                callback({
                    parameters: { ...this.parameters },
                    values: { ...this.storedState },
                });
            }

            requestStoredStateValue(key) {
                for (const listener of this.storedStateListeners) {
                    listener({ key, value: this.storedState[key] });
                }
            }

            sendStoredStateValue(key, value) {
                this.storedState[key] = value;
                for (const listener of this.storedStateListeners) {
                    listener({ key, value });
                }
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
                this.events.push({ endpointID, value });
                this.parameters[endpointID] = value;

                for (const listener of this.parameterListeners.get(endpointID) ?? []) {
                    listener(value);
                }
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

async function mountProductionView(page, {
    disableAbortController = false,
    hangDevStatusFetch = false,
    breakPackagedModuleUrlConstructor = false,
    timeoutMs = 2_000,
} = {}) {
    await page.goto(staticServerOrigin);
    await page.setViewportSize(VIEWPORT);
    await page.setContent(`
        <!doctype html>
        <html>
            <head>
                <title>SeqFX Production View Smoke</title>
                <style>
                    html,
                    body,
                    #root {
                        width: 100%;
                        height: 100%;
                        margin: 0;
                        background: #000;
                    }
                </style>
            </head>
            <body>
                <div id="root"></div>
            </body>
        </html>
    `);

    return await page.evaluate(async ({
        patchConnectionClassSource,
        disableAbortController: shouldDisableAbortController,
        hangDevStatusFetch: shouldHangDevStatusFetch,
        breakPackagedModuleUrlConstructor: shouldBreakPackagedModuleUrlConstructor,
        timeoutMs: hostTimeoutMs,
    }) => {
        // eslint-disable-next-line no-new-func
        const definePatchConnection = new Function(`${patchConnectionClassSource}; return SeqFxProductionSmokePatchConnection;`);
        const PatchConnection = definePatchConnection();
        const patchConnection = new PatchConnection();
        const root = document.getElementById("root");

        if (shouldDisableAbortController) {
            window.AbortController = undefined;
        }

        if (shouldHangDevStatusFetch) {
            const originalFetch = window.fetch.bind(window);
            window.fetch = (input, init) => (
                String(input).includes("/__fx-dev-status")
                    ? new Promise(() => {})
                    : originalFetch(input, init)
            );
        }

        if (shouldBreakPackagedModuleUrlConstructor) {
            const OriginalURL = window.URL;
            function BrokenPackagedModuleURL(url, base) {
                if (url === "./app.js") {
                    throw new Error("test URL constructor failure for packaged app module");
                }

                return new OriginalURL(url, base);
            }
            Object.setPrototypeOf(BrokenPackagedModuleURL, OriginalURL);
            BrokenPackagedModuleURL.prototype = OriginalURL.prototype;
            window.URL = BrokenPackagedModuleURL;
        }

        async function createPatchView(connection, preferredType) {
            let view = connection.manifest.view;

            if (view && preferredType === "generic" && view.src) {
                view = undefined;
            }

            const viewModuleUrl = view?.src
                ? connection.getResourceAddress(view.src)
                : "./cmaj-generic-patch-view.js";
            const viewModule = await import(viewModuleUrl);
            const patchView = await viewModule?.default(connection);

            if (patchView) {
                patchView.style.display = "block";
                patchView.style.width = view?.width > 10 ? `${view.width}px` : "";
                patchView.style.height = view?.height > 10 ? `${view.height}px` : "";
            }

            return patchView;
        }

        class PatchViewHolder extends HTMLElement {
            constructor(view) {
                super();
                this.view = view;
                this.style = "display:block;position:relative;width:100%;height:100%;overflow:visible;transform-origin:0% 0%;";
            }

            connectedCallback() {
                this.appendChild(this.view);
                if (typeof ResizeObserver === "function") {
                    this.resizeObserver = new ResizeObserver(() => {});
                    this.resizeObserver.observe(this.parentElement);
                }
            }

            disconnectedCallback() {
                this.resizeObserver?.disconnect?.();
                this.resizeObserver = undefined;
                this.innerHTML = "";
            }
        }

        async function createPatchViewHolder(connection, preferredType) {
            const view = await createPatchView(connection, preferredType);

            if (!view) {
                return undefined;
            }

            const tagName = "cmaj-patch-view-holder";
            if (!window.customElements.get(tagName)) {
                window.customElements.define(tagName, PatchViewHolder);
            }

            return new (window.customElements.get(tagName))(view);
        }

        root.innerHTML = "";
        return await Promise.race([
            createPatchViewHolder(patchConnection).then((view) => {
                if (!view) {
                    return { timedOut: false, noView: true };
                }

                root.appendChild(view);
                return { timedOut: false };
            }).catch((error) => ({
                timedOut: false,
                error: error?.stack || error?.message || String(error),
            })),
            new Promise((resolve) => {
                setTimeout(() => resolve({ timedOut: true }), hostTimeoutMs);
            }),
        ]);
    }, {
        patchConnectionClassSource: patchConnectionSource(),
        disableAbortController,
        hangDevStatusFetch,
        breakPackagedModuleUrlConstructor,
        timeoutMs,
    });
}

function parsePng(buffer) {
    const signature = buffer.subarray(0, 8);
    assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10]);

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatChunks = [];

    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        offset += 12 + length;

        if (type === "IHDR") {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === "IDAT") {
            idatChunks.push(data);
        } else if (type === "IEND") {
            break;
        }
    }

    assert.equal(bitDepth, 8);
    assert.ok(colorType === 6 || colorType === 2, `unsupported PNG color type ${colorType}`);

    const inflated = inflateSync(Buffer.concat(idatChunks));
    const bytesPerPixel = colorType === 6 ? 4 : 3;
    const stride = width * bytesPerPixel;
    const pixels = Buffer.alloc(width * height * 4);
    let sourceOffset = 0;

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[sourceOffset];
        sourceOffset += 1;
        const targetRowStart = y * width * 4;
        const previousTargetRowStart = (y - 1) * width * 4;

        for (let x = 0; x < stride; x += 1) {
            const raw = inflated[sourceOffset + x];
            const targetX = Math.floor(x / bytesPerPixel) * 4 + (x % bytesPerPixel);
            const left = x >= bytesPerPixel ? pixels[targetRowStart + targetX - 4] : 0;
            const up = y > 0 ? pixels[previousTargetRowStart + targetX] : 0;
            const upLeft = y > 0 && x >= bytesPerPixel ? pixels[previousTargetRowStart + targetX - 4] : 0;
            let value;

            if (filter === 0) {
                value = raw;
            } else if (filter === 1) {
                value = raw + left;
            } else if (filter === 2) {
                value = raw + up;
            } else if (filter === 3) {
                value = raw + Math.floor((left + up) / 2);
            } else if (filter === 4) {
                const p = left + up - upLeft;
                const pa = Math.abs(p - left);
                const pb = Math.abs(p - up);
                const pc = Math.abs(p - upLeft);
                const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
                value = raw + predictor;
            } else {
                throw new Error(`Unsupported PNG filter ${filter}`);
            }

            pixels[targetRowStart + targetX] = value & 255;

            if (bytesPerPixel === 3 && x % bytesPerPixel === 2) {
                pixels[targetRowStart + targetX + 1] = 255;
            }
        }

        sourceOffset += stride;
    }

    return { width, height, pixels };
}

function countVisiblePixels(png) {
    let visiblePixels = 0;

    for (let offset = 0; offset < png.pixels.length; offset += 4) {
        const red = png.pixels[offset];
        const green = png.pixels[offset + 1];
        const blue = png.pixels[offset + 2];
        const alpha = png.pixels[offset + 3];

        if (alpha > 0 && red + green + blue > 45) {
            visiblePixels += 1;
        }
    }

    return visiblePixels;
}

before(async () => {
    await ensureSeqFxProductionRuntime();
    staticServer = await startStaticServer();
    staticServerOrigin = staticServer.origin;
    browser = await chromium.launch();
});

after(async () => {
    await browser?.close();
    await staticServer?.close();
});

test("SeqFX Cmajor host-flow mounts a visible UI instead of a black viewport", async () => {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    try {
        const result = await mountProductionView(page);
        assert.equal(result.timedOut, false, "expected Cmajor host-flow view creation to finish");
        assert.equal(result.error, undefined, `expected Cmajor host-flow view creation not to throw: ${result.error}`);
        assert.equal(result.noView, undefined, "expected Cmajor host-flow view creation to return a view");
        await page.waitForFunction(() => {
            const host = document.querySelector("cosimo-seqfx-react-view");
            return Boolean(
                host?.shadowRoot?.querySelector('[data-role="seqfx-root"]')
                    ?? document.querySelector('[data-role="seqfx-root"]'),
            );
        });

        const rootInfo = await page.evaluate(() => {
            const host = document.querySelector("cosimo-seqfx-react-view");
            const shadowRoot = host?.shadowRoot?.querySelector('[data-role="seqfx-root"]');
            const lightDomRoot = document.querySelector('[data-role="seqfx-root"]');
            const root = shadowRoot ?? lightDomRoot;
            return {
                hostTagName: host?.tagName.toLowerCase(),
                renderedInShadowRoot: Boolean(shadowRoot),
                renderedInLightDom: Boolean(lightDomRoot),
                text: root?.textContent,
            };
        });
        assert.equal(rootInfo.hostTagName, "cosimo-seqfx-react-view");
        assert.equal(rootInfo.renderedInShadowRoot || rootInfo.renderedInLightDom, true);
        assert.match(rootInfo.text ?? "", /CosimoSeqFX/);

        const screenshot = await page.screenshot();
        const visiblePixelCount = countVisiblePixels(parsePng(screenshot));
        const totalPixels = VIEWPORT.width * VIEWPORT.height;
        assert.ok(
            visiblePixelCount / totalPixels > 0.05,
            `expected production UI screenshot to contain visible pixels, got ${visiblePixelCount} of ${totalPixels}`,
        );

        assert.deepEqual(pageErrors.map((error) => error.message), []);
    } finally {
        await page.close();
    }
});

test("SeqFX production shadow-root host exposes the shared editor token palette", async () => {
    const page = await browser.newPage();

    try {
        const result = await mountProductionView(page);
        assert.equal(result.timedOut, false, "expected Cmajor host-flow view creation to finish");
        assert.equal(result.error, undefined, `expected Cmajor host-flow view creation not to throw: ${result.error}`);
        assert.equal(result.noView, undefined, "expected Cmajor host-flow view creation to return a view");

        const editorTokens = await page.evaluate(() => {
            const host = document.querySelector("cosimo-seqfx-react-view");
            const styles = host ? getComputedStyle(host) : null;

            return {
                surfaceBg: styles?.getPropertyValue("--editor-surface-bg").trim() ?? null,
                surfaceInk: styles?.getPropertyValue("--editor-surface-ink").trim() ?? null,
                accentStart: styles?.getPropertyValue("--editor-accent-start").trim() ?? null,
                accentEnd: styles?.getPropertyValue("--editor-accent-end").trim() ?? null,
                accentRange: styles?.getPropertyValue("--editor-accent-range").trim() ?? null,
            };
        });

        assert.deepEqual(editorTokens, {
            surfaceBg: "#e4ded3",
            surfaceInk: "#1c1c1c",
            accentStart: "#00b4d8",
            accentEnd: "#e8604c",
            accentRange: "#f2d16b",
        });
    } finally {
        await page.close();
    }
});

test("SeqFX packaged shadow-root flow renders the selected crusher and stutter inspectors", async () => {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    try {
        const result = await mountProductionView(page);
        assert.equal(result.timedOut, false, "expected Cmajor host-flow view creation to finish");
        assert.equal(result.error, undefined, `expected Cmajor host-flow view creation not to throw: ${result.error}`);
        assert.equal(result.noView, undefined, "expected Cmajor host-flow view creation to return a view");

        await page.getByRole("button", { name: "Chain 2 step 1", exact: true }).click();
        await page.locator('[data-role="seqfx-crusher-editor"]').waitFor();

        const crusherLayout = await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => {
            const editor = node.querySelector('[data-role="seqfx-crusher-editor"]');
            const panel = editor?.querySelector(".seqfx-crusher-editor__panel");
            const bitsRow = editor?.querySelector('[data-role="seqfx-crusher-bits-slider"]');
            const bitsTrack = bitsRow?.querySelector(".editor-tick-slider__track");
            const bitsValue = bitsRow?.querySelector('[data-role="seqfx-crusher-bits-value"]');
            const holdRow = editor?.querySelector('[data-role="seqfx-crusher-hold-frames-slider"]');
            const holdTrack = holdRow?.querySelector(".editor-tick-slider__track");
            const holdTicks = holdRow?.querySelectorAll('[data-role="editor-tick-slider-tick"]') ?? [];
            const firstHoldTick = holdTicks[0];
            const lastHoldTick = holdTicks[holdTicks.length - 1];
            const driveRow = node.querySelector(".seqfx-crusher-editor__drive");
            const mixRow = node.querySelector('[data-role="seqfx-mix-row"]');
            const panelStyle = panel ? getComputedStyle(panel) : null;

            return {
                backgroundColor: panelStyle?.backgroundColor ?? "",
                color: panelStyle?.color ?? "",
                bitsRowWidth: bitsRow?.getBoundingClientRect().width ?? 0,
                bitsTrackWidth: bitsTrack?.getBoundingClientRect().width ?? 0,
                bitsValueWidth: bitsValue?.getBoundingClientRect().width ?? 0,
                holdRowWidth: holdRow?.getBoundingClientRect().width ?? 0,
                holdTrackWidth: holdTrack?.getBoundingClientRect().width ?? 0,
                holdTickWidth: firstHoldTick?.getBoundingClientRect().width ?? 0,
                holdActiveColor: firstHoldTick ? getComputedStyle(firstHoldTick).backgroundColor : "",
                holdInactiveColor: lastHoldTick ? getComputedStyle(lastHoldTick).backgroundColor : "",
                driveHeight: driveRow?.getBoundingClientRect().height ?? 0,
                mixGap: mixRow && driveRow
                    ? mixRow.getBoundingClientRect().top - driveRow.getBoundingClientRect().bottom
                    : 0,
            };
        });

        assert.equal(crusherLayout.backgroundColor, "rgb(228, 222, 211)");
        assert.equal(crusherLayout.color, "rgb(28, 28, 28)");
        assert.ok(
            crusherLayout.bitsTrackWidth > crusherLayout.bitsRowWidth * 0.45,
            `crusher bits rail should keep most of the row, got ${crusherLayout.bitsTrackWidth}px of ${crusherLayout.bitsRowWidth}px`,
        );
        assert.ok(
            crusherLayout.bitsValueWidth < crusherLayout.bitsRowWidth * 0.25,
            `crusher bits readout should stay compact, got ${crusherLayout.bitsValueWidth}px of ${crusherLayout.bitsRowWidth}px`,
        );
        assert.ok(
            crusherLayout.holdTrackWidth > crusherLayout.holdRowWidth * 0.45,
            `crusher hold rail should keep most of the row, got ${crusherLayout.holdTrackWidth}px of ${crusherLayout.holdRowWidth}px`,
        );
        assert.ok(
            crusherLayout.holdTickWidth >= 4,
            `crusher hold ticks should remain visible in the production inspector, got ${crusherLayout.holdTickWidth}px`,
        );
        assert.notEqual(
            crusherLayout.holdActiveColor,
            crusherLayout.holdInactiveColor,
            "crusher hold row should visibly distinguish active ticks from inactive ticks",
        );

        await page.locator('[data-role="seqfx-crusher-drive-db-mod-toggle"]').click();
        const crusherDriveAfterToggle = await page.locator('[data-role="seqfx-inspector"]').evaluate((node) => {
            const driveRow = node.querySelector(".seqfx-crusher-editor__drive");
            const mixRow = node.querySelector('[data-role="seqfx-mix-row"]');

            return {
                driveHeight: driveRow?.getBoundingClientRect().height ?? 0,
                mixGap: mixRow && driveRow
                    ? mixRow.getBoundingClientRect().top - driveRow.getBoundingClientRect().bottom
                    : 0,
            };
        });

        assert.ok(
            Math.abs(crusherDriveAfterToggle.driveHeight - crusherLayout.driveHeight) <= 1,
            `crusher drive row height should stay stable in production, got ${crusherDriveAfterToggle.driveHeight}px after toggle vs ${crusherLayout.driveHeight}px before`,
        );
        assert.ok(
            Math.abs(crusherDriveAfterToggle.mixGap - crusherLayout.mixGap) <= 1,
            `crusher drive modulation should not change the gap above the mix row in production, got ${crusherDriveAfterToggle.mixGap}px after toggle vs ${crusherLayout.mixGap}px before`,
        );

        await page.getByRole("button", { name: "Chain 4 step 1", exact: true }).click();
        await page.locator('[data-role="seqfx-stutter-editor"]').waitFor();
        assert.deepEqual(
            await page.locator('[data-role="seqfx-stutter-shape-stop"]').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? "")),
            ["Gate", "Triangle", "Bell", "Down", "Up"],
        );
        assert.equal(await page.locator('[data-role="seqfx-stutter-shape-slider"]').count(), 0);
        await page.locator('[data-role="seqfx-stutter-shape-mod-toggle"]').waitFor();
        const graphBox = await page.locator('[data-role="seqfx-stutter-graph"]').boundingBox();
        assert.ok(graphBox);
        await page.mouse.click(stutterGraphPoint(graphBox, 1).x, stutterGraphPoint(graphBox, 1).y);
        const morphBox = await page.locator('[data-role="seqfx-stutter-morph-track"]').boundingBox();
        assert.ok(morphBox);
        await page.mouse.click(morphBox.x + morphBox.width * 0.125, morphBox.y + morphBox.height / 2);
        const trapezoidSamples = await readStutterEnvelopePathSamples(page, [0.1, 0.3, 0.7, 0.8]);
        assert.ok(trapezoidSamples, "expected the packaged stutter graph path to produce readable points");
        assert.ok(
            Math.abs(trapezoidSamples["0.30"] - trapezoidSamples["0.70"]) <= 2,
            `packaged Gate -> Triangle midpoint should keep a flat plateau, got y=${trapezoidSamples["0.30"]} at 0.30 and y=${trapezoidSamples["0.70"]} at 0.70`,
        );
        assert.ok(
            trapezoidSamples["0.10"] > trapezoidSamples["0.30"] + 15,
            `packaged Gate -> Triangle midpoint should slope up from the left wall, got y=${trapezoidSamples["0.10"]} at 0.10 and y=${trapezoidSamples["0.30"]} at 0.30`,
        );
        assert.ok(
            trapezoidSamples["0.80"] > trapezoidSamples["0.70"] + 10,
            `packaged Gate -> Triangle midpoint should slope down along the right wall, got y=${trapezoidSamples["0.80"]} at 0.80 and y=${trapezoidSamples["0.70"]} at 0.70`,
        );

        await page.locator('[data-role="seqfx-stutter-shape-stop"][data-stop="1"]').click();
        const triangleSamples = await readStutterEnvelopePathSamples(page, [0.3]);
        assert.ok(triangleSamples, "expected the packaged triangle graph path to produce readable points");
        assert.ok(
            triangleSamples["0.30"] > trapezoidSamples["0.30"] + 15,
            `packaged triangle should collapse the trapezoid plateau, got y=${triangleSamples["0.30"]} at 0.30 vs trapezoid y=${trapezoidSamples["0.30"]}`,
        );

        const stutterEditorStyle = await page.locator('[data-role="seqfx-stutter-editor"]').evaluate((node) => {
            const panel = node.querySelector(".seqfx-stutter-editor__panel");
            const styles = panel ? getComputedStyle(panel) : null;
            return {
                backgroundColor: styles?.backgroundColor ?? "",
                color: styles?.color ?? "",
            };
        });
        assert.equal(stutterEditorStyle.backgroundColor, "rgb(228, 222, 211)");
        assert.equal(stutterEditorStyle.color, "rgb(28, 28, 28)");

        assert.deepEqual(pageErrors.map((error) => error.message), []);
    } finally {
        await page.close();
    }
});

test("SeqFX Cmajor host-flow falls back to packaged UI when dev probe fetch cannot abort", async () => {
    const page = await browser.newPage();

    try {
        const result = await mountProductionView(page, {
            disableAbortController: true,
            hangDevStatusFetch: true,
            timeoutMs: 1_500,
        });

        assert.equal(result.timedOut, false, "expected Cmajor host-flow view creation to finish without AbortController");
        assert.equal(result.error, undefined, `expected Cmajor host-flow view creation not to throw: ${result.error}`);
        assert.equal(result.noView, undefined, "expected Cmajor host-flow view creation to return a view");
        await page.waitForFunction(() => (
            Boolean(
                document.querySelector("cosimo-seqfx-react-view")
                    ?.shadowRoot
                    ?.querySelector('[data-role="seqfx-root"]'),
            )
        ));
    } finally {
        await page.close();
    }
});

test("SeqFX Cmajor host-flow imports the packaged UI without constructing an absolute module URL", async () => {
    const page = await browser.newPage();

    try {
        const result = await mountProductionView(page, {
            breakPackagedModuleUrlConstructor: true,
            timeoutMs: 1_500,
        });

        assert.equal(result.timedOut, false, "expected Cmajor host-flow view creation to finish without URL construction");
        assert.equal(result.error, undefined, `expected Cmajor host-flow view creation not to throw: ${result.error}`);
        assert.equal(result.noView, undefined, "expected Cmajor host-flow view creation to return a view");
        await page.waitForFunction(() => (
            Boolean(
                document.querySelector("cosimo-seqfx-react-view")
                    ?.shadowRoot
                    ?.querySelector('[data-role="seqfx-root"]'),
            )
        ));
    } finally {
        await page.close();
    }
});

test("SeqFX production loader returns a visible error view if the packaged UI module fails", async () => {
    const page = await browser.newPage();

    try {
        await page.goto(staticServerOrigin);
        const errorText = await page.evaluate(async ({ loaderPath, patchConnectionClassSource }) => {
            // eslint-disable-next-line no-new-func
            const definePatchConnection = new Function(`${patchConnectionClassSource}; return SeqFxProductionSmokePatchConnection;`);
            const PatchConnection = definePatchConnection();
            const module = await import(`/${loaderPath}`);
            const createPatchView = module.createEffectPatchView({
                source: "",
                productionModule: "./missing-packaged-app.js",
            });
            const view = await createPatchView(new PatchConnection());
            document.body.appendChild(view);
            return view.textContent;
        }, {
            loaderPath: RUNTIME_LOADER_PATH,
            patchConnectionClassSource: patchConnectionSource(),
        });

        assert.match(errorText ?? "", /Could not load the production effect UI module/);
        assert.match(errorText ?? "", /missing-packaged-app\.js/);
    } finally {
        await page.close();
    }
});

test("SeqFX production loader falls back when the dev-server status probe hangs", async () => {
    const hangingServer = await startHangingDevStatusServer();
    const page = await browser.newPage();

    try {
        await page.goto(staticServerOrigin);
        await page.setViewportSize(VIEWPORT);
        await page.setContent(`
            <!doctype html>
            <html>
                <head>
                    <title>SeqFX Hanging Dev Probe Smoke</title>
                    <style>
                        html,
                        body,
                        #root {
                            width: 100%;
                            height: 100%;
                            margin: 0;
                            background: #000;
                        }
                    </style>
                </head>
                <body>
                    <div id="root"></div>
                </body>
            </html>
        `);

        const result = await page.evaluate(async ({
            loaderPath,
            patchConnectionClassSource,
            hangingDevOrigin,
        }) => {
            // eslint-disable-next-line no-new-func
            const definePatchConnection = new Function(`${patchConnectionClassSource}; return SeqFxProductionSmokePatchConnection;`);
            const PatchConnection = definePatchConnection();
            const module = await import(`/${loaderPath}`);
            const createPatchView = module.createEffectPatchView({
                devOrigin: hangingDevOrigin,
                devStatusTimeoutMs: 100,
                source: "/fx/seqfx/view/source.tsx",
            });
            const root = document.getElementById("root");

            return await Promise.race([
                createPatchView(new PatchConnection()).then((view) => {
                    root.appendChild(view);
                    return {
                        timedOut: false,
                    };
                }).catch((error) => ({
                    timedOut: false,
                    error: error?.message ?? String(error),
                })),
                new Promise((resolve) => {
                    setTimeout(() => resolve({ timedOut: true }), 1_500);
                }),
            ]);
        }, {
            loaderPath: RUNTIME_LOADER_PATH,
            patchConnectionClassSource: patchConnectionSource(),
            hangingDevOrigin: hangingServer.origin,
        });

        assert.equal(result.timedOut, false, `expected loader to return a view instead of hanging, got ${JSON.stringify(result)}`);
        assert.equal(result.error, undefined, `expected loader to fall back to production, got ${result.error}`);
        await page.waitForFunction(() => (
            Boolean(
                document.querySelector("cosimo-seqfx-react-view")
                    ?.shadowRoot
                    ?.querySelector('[data-role="seqfx-root"]'),
            )
        ));
        const rootText = await page.evaluate(() => (
            document.querySelector("cosimo-seqfx-react-view")
                ?.shadowRoot
                ?.querySelector('[data-role="seqfx-root"]')
                ?.textContent
        ));
        assert.match(rootText ?? "", /CosimoSeqFX/);
    } finally {
        await page.close();
        await hangingServer.close();
    }
});
