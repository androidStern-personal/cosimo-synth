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
