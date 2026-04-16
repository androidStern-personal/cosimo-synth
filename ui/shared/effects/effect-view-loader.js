export const DEFAULT_EFFECT_DEV_ORIGIN = "http://127.0.0.1:5175";
export const DEFAULT_EFFECT_PRODUCTION_MODULE = "./app.js";
export const EFFECT_DEV_STATUS_PATH = "/__fx-dev-status";
export const EFFECT_DEV_STATUS_KIND = "fx-vite-dev-server";

function normalizeOrigin(origin) {
    const value = typeof origin === "string" ? origin.trim() : "";
    return (value || DEFAULT_EFFECT_DEV_ORIGIN).replace(/\/+$/, "");
}

function normalizeModulePath(path) {
    const value = typeof path === "string" ? path.trim() : "";

    if (!value) {
        return "";
    }

    return value.startsWith("/") ? value : `/${value}`;
}

function getManifestView(patchConnection) {
    const view = patchConnection?.manifest?.view;
    return view && typeof view === "object" ? view : {};
}

function getDevModulePath(patchConnection, options) {
    return normalizeModulePath(options.source ?? getManifestView(patchConnection).devModule);
}

function resolveDevModuleUrl(origin, modulePath) {
    return `${normalizeOrigin(origin)}${normalizeModulePath(modulePath)}`;
}

function resolveProductionModuleUrl(modulePath) {
    return new URL(modulePath || DEFAULT_EFFECT_PRODUCTION_MODULE, import.meta.url).href;
}

async function readDevServerStatus(origin) {
    try {
        const response = await fetch(`${normalizeOrigin(origin)}${EFFECT_DEV_STATUS_PATH}`, {
            cache: "no-store",
        });

        if (!response.ok) {
            return undefined;
        }

        return await response.json();
    } catch {
        return undefined;
    }
}

function isExpectedDevServer(status) {
    return status?.kind === EFFECT_DEV_STATUS_KIND;
}

function getViewFactory(module, label) {
    const factory = module?.default ?? module?.createPatchView;

    if (typeof factory !== "function") {
        throw new Error(`${label} did not export a default patch view factory.`);
    }

    return factory;
}

async function loadViewFromModule(moduleUrl, patchConnection, label) {
    const module = await import(/* @vite-ignore */ moduleUrl);
    const createView = getViewFactory(module, label);
    return await createView(patchConnection);
}

async function loadViteClient(origin) {
    await import(/* @vite-ignore */ `${normalizeOrigin(origin)}/@vite/client`);
}

async function loadReactRefreshPreamble(origin) {
    const targetWindow = globalThis.window;

    if (!targetWindow || targetWindow.__vite_plugin_react_preamble_installed__) {
        return;
    }

    try {
        const refreshRuntime = await import(/* @vite-ignore */ `${normalizeOrigin(origin)}/@react-refresh`);
        refreshRuntime.injectIntoGlobalHook(targetWindow);
        targetWindow.$RefreshReg$ = () => {};
        targetWindow.$RefreshSig$ = () => (type) => type;
        targetWindow.__vite_plugin_react_preamble_installed__ = true;
    } catch {
        // Not every effect UI needs React. If the dev server does not expose the
        // refresh runtime, vanilla modules can still load normally.
    }
}

function createProductionLoadError({ productionModuleUrl, devOrigin, devModulePath, cause }) {
    const devHint = devModulePath
        ? `The effects dev server was not reachable at ${normalizeOrigin(devOrigin)}${EFFECT_DEV_STATUS_PATH}. Start the shared effects Vite dev server, or build a production runtime that contains ${DEFAULT_EFFECT_PRODUCTION_MODULE}.`
        : "The patch manifest is missing view.devModule, and the production UI module could not be loaded.";

    const error = new Error(
        [
            `Could not load the production effect UI module at ${productionModuleUrl}.`,
            devHint,
            cause?.message ? `Original error: ${cause.message}` : "",
        ].filter(Boolean).join(" "),
    );

    error.cause = cause;
    return error;
}

export async function canLoadEffectDevServer(origin = DEFAULT_EFFECT_DEV_ORIGIN) {
    return isExpectedDevServer(await readDevServerStatus(origin));
}

export function createEffectPatchView(options = {}) {
    return async function createPatchView(patchConnection) {
        const devOrigin = normalizeOrigin(options.devOrigin);
        const devModulePath = getDevModulePath(patchConnection, options);
        const productionModuleUrl = resolveProductionModuleUrl(
            options.productionModule ?? DEFAULT_EFFECT_PRODUCTION_MODULE,
        );

        if (devModulePath && await canLoadEffectDevServer(devOrigin)) {
            const devModuleUrl = resolveDevModuleUrl(devOrigin, devModulePath);
            await loadViteClient(devOrigin);
            await loadReactRefreshPreamble(devOrigin);
            return await loadViewFromModule(devModuleUrl, patchConnection, `Dev module ${devModuleUrl}`);
        }

        try {
            return await loadViewFromModule(
                productionModuleUrl,
                patchConnection,
                `Production module ${productionModuleUrl}`,
            );
        } catch (error) {
            throw createProductionLoadError({
                productionModuleUrl,
                devOrigin,
                devModulePath,
                cause: error,
            });
        }
    };
}

export default createEffectPatchView();
