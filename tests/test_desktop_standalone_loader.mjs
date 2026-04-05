import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
const loaderModuleUrl = pathToFileURL(
    path.join(repoRoot, "ui", "desktop", "standalone-loader.js"),
).href;

async function importLoaderModule() {
    return await import(`${loaderModuleUrl}?cacheBust=${Date.now()}-${Math.random()}`);
}

test("desktop standalone loader rewrites only Vite open-in-editor requests to the desktop dev server", async () => {
    const { createOpenInEditorDevServerFetchBridge } = await importLoaderModule();
    const seenInputs = [];
    const bridgedFetch = createOpenInEditorDevServerFetchBridge(
        async (input) => {
            seenInputs.push(input);
            return { ok: true };
        },
        "http://127.0.0.1:5174",
    );

    await bridgedFetch("/__open-in-editor?file=ui%2Fdesktop%2FApp.tsx&line=12");
    await bridgedFetch("/api/runtime-state");
    await bridgedFetch(new Request("http://standalone.invalid/__open-in-editor?file=ui%2Fdesktop%2FApp.tsx&line=9"));

    assert.equal(
        seenInputs[0],
        "http://127.0.0.1:5174/__open-in-editor?file=ui%2Fdesktop%2FApp.tsx&line=12",
    );
    assert.equal(seenInputs[1], "/api/runtime-state");
    assert.ok(seenInputs[2] instanceof Request);
    assert.equal(
        seenInputs[2].url,
        "http://127.0.0.1:5174/__open-in-editor?file=ui%2Fdesktop%2FApp.tsx&line=9",
    );
});

test("desktop standalone loader defaults to the compiled bundle unless the host injects a source mode", async () => {
    const { getDesktopUISourceMode } = await importLoaderModule();

    assert.equal(getDesktopUISourceMode({}), "compiled");
    assert.equal(
        getDesktopUISourceMode({ __COSIMO_DESKTOP_UI_SOURCE_MODE__: "dev-server" }),
        "dev-server",
    );
    assert.equal(
        getDesktopUISourceMode({ __COSIMO_DESKTOP_UI_SOURCE_MODE__: "  compiled  " }),
        "compiled",
    );
});

test("desktop standalone loader imports only the Vite dev-server module in dev-server mode", async () => {
    const { loadDesktopPatchViewModule } = await importLoaderModule();
    const seenSpecifiers = [];
    let installOrigin = null;
    const devModule = { default: () => "dev" };
    const resolvedModule = await loadDesktopPatchViewModule({
        mode: "dev-server",
        devServerModuleUrl: "http://127.0.0.1:5174/patch_gui/desktop/index.js",
        importModule: async (specifier) => {
            seenSpecifiers.push(specifier);

            if (specifier === "http://127.0.0.1:5174/patch_gui/desktop/index.js") {
                return devModule;
            }

            throw new Error(`Unexpected module specifier: ${specifier}`);
        },
        onDevServerModuleLoaded({ devServerOrigin }) {
            installOrigin = devServerOrigin;
        },
    });

    assert.equal(resolvedModule, devModule);
    assert.deepEqual(seenSpecifiers, ["http://127.0.0.1:5174/patch_gui/desktop/index.js"]);
    assert.equal(installOrigin, "http://127.0.0.1:5174");
});

test("desktop standalone loader imports only the compiled bundle in compiled mode", async () => {
    const { loadDesktopPatchViewModule } = await importLoaderModule();
    const seenSpecifiers = [];
    const compiledModule = { default: () => "compiled" };
    const resolvedModule = await loadDesktopPatchViewModule({
        mode: "compiled",
        compiledModuleUrl: "file:///compiled/app.js",
        importModule: async (specifier) => {
            seenSpecifiers.push(specifier);

            if (specifier === "file:///compiled/app.js") {
                return compiledModule;
            }

            throw new Error(`Unexpected module specifier: ${specifier}`);
        },
    });

    assert.equal(resolvedModule, compiledModule);
    assert.deepEqual(seenSpecifiers, ["file:///compiled/app.js"]);
});

test("desktop standalone loader rejects unknown build-time UI source modes", async () => {
    const { loadDesktopPatchViewModule } = await importLoaderModule();

    await assert.rejects(
        loadDesktopPatchViewModule({
            mode: "sideways",
            importModule: async () => ({ default: () => "never" }),
        }),
        /Unsupported desktop UI source mode: sideways/,
    );
});
