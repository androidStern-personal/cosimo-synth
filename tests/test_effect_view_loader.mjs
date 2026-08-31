import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
    canLoadEffectDevServer,
    createEffectPatchView,
    EFFECT_DEV_STATUS_PATH,
} from "../ui/shared/effects/effect-view-loader.js";

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalConsoleError = console.error;
const originalHTMLElement = globalThis.HTMLElement;
const originalDocument = globalThis.document;

afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    console.error = originalConsoleError;
    globalThis.HTMLElement = originalHTMLElement;
    globalThis.document = originalDocument;
});

class FakeHTMLElement {
    constructor(tagName = "") {
        this.tagName = tagName;
        this.dataset = {};
        this.style = {};
        this.attributes = new Map();
        this.textContent = "";
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }
}

function installFakeDom() {
    globalThis.HTMLElement = FakeHTMLElement;
    globalThis.document = {
        createElement: (tagName) => new FakeHTMLElement(tagName),
    };
}

function installFetchSpy(handler) {
    const calls = [];

    globalThis.fetch = (url, options) => {
        calls.push({ url: String(url), options });
        return handler(url, options);
    };

    return calls;
}

function installSetTimeoutSpy() {
    const calls = [];

    globalThis.setTimeout = (...args) => {
        calls.push(args);
        return originalSetTimeout(...args);
    };

    return calls;
}

function installConsoleErrorSpy() {
    const calls = [];

    console.error = (...args) => {
        calls.push(args);
    };

    return calls;
}

function installStatusResponse(status) {
    return installFetchSpy(async (url) => {
        assert.equal(String(url), `http://effect-dev.test${EFFECT_DEV_STATUS_PATH}`);

        return {
            ok: true,
            async json() {
                return status;
            },
        };
    });
}

function productionAppModuleUrl(tag) {
    const source = [
        "export default (patchConnection) => {",
        "    const element = globalThis.document.createElement(\"div\");",
        `    element.dataset.fixture = ${JSON.stringify(tag)};`,
        "    element.patchConnection = patchConnection;",
        "    return element;",
        "};",
    ].join("\n");

    return `data:text/javascript,${encodeURIComponent(source)}`;
}

test("effect dev loader accepts a server that serves the requested module", async () => {
    installStatusResponse({
        kind: "fx-vite-dev-server",
        plugins: [
            {
                name: "spectral_chord_resonator",
                sourceModule: "/fx/spectral_chord_resonator/view/source.js",
            },
        ],
    });

    assert.equal(
        await canLoadEffectDevServer(
            "http://effect-dev.test/",
            25,
            "/fx/spectral_chord_resonator/view/source.js",
        ),
        true,
    );
});

test("effect dev loader rejects a stale server from another worktree", async () => {
    installStatusResponse({
        kind: "fx-vite-dev-server",
        plugins: [
            {
                name: "ott_lab",
                sourceModule: "/fx/ott_lab/view/source.js",
            },
        ],
    });

    assert.equal(
        await canLoadEffectDevServer(
            "http://effect-dev.test/",
            25,
            "/fx/spectral_chord_resonator/view/source.js",
        ),
        false,
    );
});

test("effect dev loader rejects malformed status even when port is reachable", async () => {
    installStatusResponse({
        kind: "not-the-fx-dev-server",
        plugins: [
            {
                name: "spectral_chord_resonator",
                sourceModule: "/fx/spectral_chord_resonator/view/source.js",
            },
        ],
    });

    assert.equal(
        await canLoadEffectDevServer(
            "http://effect-dev.test/",
            25,
            "/fx/spectral_chord_resonator/view/source.js",
        ),
        false,
    );
});

test("production path without view.devModule loads the packaged module with zero requests and zero timers", async () => {
    installFakeDom();
    const fetchCalls = installFetchSpy(() => {
        throw new Error("The production path must never touch the network.");
    });
    const timerCalls = installSetTimeoutSpy();
    const createPatchView = createEffectPatchView({
        productionModule: productionAppModuleUrl("prod-no-dev-module"),
    });
    const patchConnection = {
        manifest: {
            view: {
                src: "view/index.js",
            },
        },
    };

    const view = await createPatchView(patchConnection);

    assert.equal(view.dataset.fixture, "prod-no-dev-module");
    assert.equal(view.patchConnection, patchConnection);
    assert.deepEqual(fetchCalls, []);
    assert.deepEqual(timerCalls, []);
});

test("production path tolerates a manifest with no view object at all", async () => {
    installFakeDom();
    const fetchCalls = installFetchSpy(() => {
        throw new Error("The production path must never touch the network.");
    });
    const timerCalls = installSetTimeoutSpy();
    const createPatchView = createEffectPatchView({
        productionModule: productionAppModuleUrl("prod-no-manifest"),
    });

    const view = await createPatchView({});

    assert.equal(view.dataset.fixture, "prod-no-manifest");
    assert.deepEqual(fetchCalls, []);
    assert.deepEqual(timerCalls, []);
});

test("an empty source option opts out of dev loading even when the manifest names a devModule", async () => {
    installFakeDom();
    const fetchCalls = installFetchSpy(() => {
        throw new Error("An explicit empty source must never probe the dev server.");
    });
    const timerCalls = installSetTimeoutSpy();
    const createPatchView = createEffectPatchView({
        source: "",
        productionModule: productionAppModuleUrl("prod-opt-out"),
    });

    const view = await createPatchView({
        manifest: {
            view: {
                src: "view/index.js",
                devModule: "fx/demo/view/source.js",
            },
        },
    });

    assert.equal(view.dataset.fixture, "prod-opt-out");
    assert.deepEqual(fetchCalls, []);
    assert.deepEqual(timerCalls, []);
});

test("production path defaults to ./app.js and never probes the dev server, even when the import fails", async () => {
    installFakeDom();
    installConsoleErrorSpy();
    const fetchCalls = installFetchSpy(() => {
        throw new Error("The production path must never touch the network.");
    });
    const createPatchView = createEffectPatchView();

    const view = await createPatchView({
        manifest: {
            view: {
                src: "view/index.js",
            },
        },
    });

    assert.equal(view.dataset.role, "effect-load-error");
    assert.match(view.textContent, /Could not load the production effect UI module at \.\/app\.js\./);
    assert.deepEqual(fetchCalls, []);
});

test("dev path falls back to the packaged module when the probe cannot reach a server", async () => {
    installFakeDom();
    const fetchCalls = installFetchSpy(() => Promise.reject(new TypeError("fetch failed")));
    const createPatchView = createEffectPatchView({
        devOrigin: "http://effect-dev.test",
        devStatusTimeoutMs: 25,
        productionModule: productionAppModuleUrl("prod-after-failed-probe"),
    });

    const view = await createPatchView({
        manifest: {
            view: {
                src: "view/index.js",
                devModule: "fx/demo/view/source.js",
            },
        },
    });

    assert.equal(view.dataset.fixture, "prod-after-failed-probe");
    assert.deepEqual(
        fetchCalls.map((call) => call.url),
        [`http://effect-dev.test${EFFECT_DEV_STATUS_PATH}`],
    );
});

test("dev path falls back to the packaged module when the probe hangs past its timeout", async () => {
    installFakeDom();
    const fetchCalls = installFetchSpy(() => new Promise(() => {}));
    const createPatchView = createEffectPatchView({
        devOrigin: "http://effect-dev.test",
        devStatusTimeoutMs: 25,
        productionModule: productionAppModuleUrl("prod-after-hanging-probe"),
    });

    const view = await createPatchView({
        manifest: {
            view: {
                src: "view/index.js",
                devModule: "fx/demo/view/source.js",
            },
        },
    });

    assert.equal(view.dataset.fixture, "prod-after-hanging-probe");
    assert.equal(fetchCalls.length, 1);
});

test("dev path falls back to the packaged module when a stale worktree server answers the probe", async () => {
    installFakeDom();
    const fetchCalls = installStatusResponse({
        kind: "fx-vite-dev-server",
        plugins: [
            {
                name: "ott_lab",
                sourceModule: "/fx/ott_lab/view/source.js",
            },
        ],
    });
    const createPatchView = createEffectPatchView({
        devOrigin: "http://effect-dev.test",
        devStatusTimeoutMs: 25,
        productionModule: productionAppModuleUrl("prod-after-stale-server"),
    });

    const view = await createPatchView({
        manifest: {
            view: {
                src: "view/index.js",
                devModule: "fx/demo/view/source.js",
            },
        },
    });

    assert.equal(view.dataset.fixture, "prod-after-stale-server");
    assert.equal(fetchCalls.length, 1);
});

test("production error view renders the message without a stack trace and logs details to the console", async () => {
    installFakeDom();
    const consoleErrors = installConsoleErrorSpy();
    installFetchSpy(() => {
        throw new Error("The production path must never touch the network.");
    });
    const createPatchView = createEffectPatchView({
        source: "",
        productionModule: "./missing-packaged-app.js",
    });

    const view = await createPatchView({});

    assert.equal(view.tagName, "pre");
    assert.equal(view.dataset.role, "effect-load-error");
    assert.equal(view.getAttribute("role"), "alert");
    assert.match(view.textContent, /^Could not load the production effect UI module at \.\/missing-packaged-app\.js\./);
    assert.equal(view.textContent.includes("\n"), false, "the error view must show a message, not a stack trace");
    assert.doesNotMatch(view.textContent, / at file:| at http:| {4}at /);
    assert.doesNotMatch(view.textContent, /from this repo|dev server|worktree/i);

    assert.ok(consoleErrors.length >= 2, "the console must receive the error and its cause");
    assert.match(consoleErrors[0][0].message, /Could not load the production effect UI module/);
    assert.equal(consoleErrors[1][0], "Caused by:");
    assert.match(String(consoleErrors[1][1]?.message ?? consoleErrors[1][1]), /missing-packaged-app\.js/);
});

test("dev error view renders a neutral message when the dev server accepts the probe but the load fails", async () => {
    installFakeDom();
    const consoleErrors = installConsoleErrorSpy();
    installStatusResponse({
        kind: "fx-vite-dev-server",
        plugins: [
            {
                name: "demo",
                sourceModule: "/fx/demo/view/source.js",
            },
        ],
    });
    const createPatchView = createEffectPatchView({
        devOrigin: "http://effect-dev.test",
        devStatusTimeoutMs: 25,
    });

    // Node cannot import http: modules, so the vite client import fails and the
    // loader must surface the dev error view rather than throwing.
    const view = await createPatchView({
        manifest: {
            view: {
                src: "view/index.js",
                devModule: "fx/demo/view/source.js",
            },
        },
    });

    assert.equal(view.dataset.role, "effect-load-error");
    assert.equal(view.getAttribute("role"), "alert");
    assert.match(view.textContent, /^Could not load the effect UI from the dev server at http:\/\/effect-dev\.test\/fx\/demo\/view\/source\.js\./);
    assert.equal(view.textContent.includes("\n"), false, "the error view must show a message, not a stack trace");
    assert.doesNotMatch(view.textContent, /from this repo|Stop the stale|restart/i);

    assert.ok(consoleErrors.length >= 2, "the console must receive the error and its cause");
    assert.match(consoleErrors[0][0].message, /Could not load the effect UI from the dev server/);
    assert.equal(consoleErrors[1][0], "Caused by:");
});
