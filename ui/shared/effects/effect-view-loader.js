export const DEFAULT_EFFECT_DEV_ORIGIN = "http://127.0.0.1:5175";
export const DEFAULT_EFFECT_PRODUCTION_MODULE = "./app.js";
export const DEFAULT_EFFECT_DEV_STATUS_TIMEOUT_MS = 500;
export const EFFECT_DEV_STATUS_PATH = "/__fx-dev-status";
export const EFFECT_DEV_STATUS_KIND = "fx-vite-dev-server";
export const EFFECT_DEV_TOOLS_MODULE_PATH = "/ui/shared/effects/effect-dev-tools.js";

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
    return modulePath || DEFAULT_EFFECT_PRODUCTION_MODULE;
}

function normalizeTimeoutMs(timeoutMs) {
    return Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : DEFAULT_EFFECT_DEV_STATUS_TIMEOUT_MS;
}

// The timeout guards only this status probe. Module imports on both the dev and
// production paths run without one, so slow-but-working loads are never cut off.
async function readDevServerStatus(origin, timeoutMs = DEFAULT_EFFECT_DEV_STATUS_TIMEOUT_MS) {
    const controller = typeof AbortController === "function" ? new AbortController() : undefined;
    let timeoutID;

    try {
        const requestOptions = {
            cache: "no-store",
        };

        if (controller) {
            requestOptions.signal = controller.signal;
        }

        const statusRequest = Promise.resolve()
            .then(async () => {
                const response = await fetch(`${normalizeOrigin(origin)}${EFFECT_DEV_STATUS_PATH}`, requestOptions);

                if (!response.ok) {
                    return undefined;
                }

                return await response.json();
            })
            .catch(() => undefined);

        const timeout = new Promise((resolve) => {
            timeoutID = setTimeout(() => {
                controller?.abort();
                resolve(undefined);
            }, normalizeTimeoutMs(timeoutMs));
        });

        return await Promise.race([statusRequest, timeout]);
    } catch {
        return undefined;
    } finally {
        if (timeoutID) {
            clearTimeout(timeoutID);
        }
    }
}

function modulePathsMatch(left, right) {
    return normalizeModulePath(left) === normalizeModulePath(right);
}

// Rejects a reachable-but-stale dev server (typically one started from another
// worktree): it must identify itself as the fx dev server and be serving the
// exact module this plugin wants, or the loader falls back to the packaged UI.
function isExpectedDevServer(status, devModulePath = "") {
    if (status?.kind !== EFFECT_DEV_STATUS_KIND) {
        return false;
    }

    const expectedDevModulePath = normalizeModulePath(devModulePath);

    if (!expectedDevModulePath) {
        return true;
    }

    if (!Array.isArray(status.plugins)) {
        return false;
    }

    return status.plugins.some((plugin) => modulePathsMatch(plugin?.sourceModule, expectedDevModulePath));
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
    const view = await createView(patchConnection);

    if (!(view instanceof HTMLElement)) {
        throw new Error(`${label} returned ${Object.prototype.toString.call(view)} instead of an HTMLElement.`);
    }

    return view;
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

async function loadEffectDevTools(origin) {
    try {
        await import(/* @vite-ignore */ `${normalizeOrigin(origin)}${EFFECT_DEV_TOOLS_MODULE_PATH}`);
    } catch (error) {
        console.warn("Could not load effect dev tools.", error);
    }
}

function createLoadError(message, cause) {
    const error = new Error(message);
    error.cause = cause;
    return error;
}

function createProductionLoadError({ productionModuleUrl, cause }) {
    return createLoadError(
        `Could not load the production effect UI module at ${productionModuleUrl}. The effect UI is missing or damaged; reinstalling the plugin should restore it.`,
        cause,
    );
}

function createDevLoadError({ devModuleUrl, cause }) {
    return createLoadError(
        `Could not load the effect UI from the dev server at ${devModuleUrl}.`,
        cause,
    );
}

// End users only ever see error.message. The stack and the underlying cause
// chain go to the console for developers.
function createLoadErrorView(error) {
    console.error(error);

    for (let cause = error?.cause, depth = 0; cause !== undefined && depth < 8; cause = cause?.cause, depth += 1) {
        console.error("Caused by:", cause);
    }

    const element = document.createElement("pre");
    element.dataset.role = "effect-load-error";
    element.setAttribute("role", "alert");
    element.textContent = error?.message || String(error);
    element.style.cssText = [
        "display:block",
        "box-sizing:border-box",
        "width:100%",
        "height:100%",
        "margin:0",
        "padding:16px",
        "overflow:auto",
        "background:#151816",
        "color:#ffd7df",
        "font:12px/1.45 Menlo, Monaco, monospace",
        "white-space:pre-wrap",
    ].join(";");
    return element;
}

export async function canLoadEffectDevServer(
    origin = DEFAULT_EFFECT_DEV_ORIGIN,
    timeoutMs = DEFAULT_EFFECT_DEV_STATUS_TIMEOUT_MS,
    devModulePath = "",
) {
    return isExpectedDevServer(await readDevServerStatus(origin, timeoutMs), devModulePath);
}

async function loadDevView(devOrigin, devModulePath, patchConnection) {
    const devModuleUrl = resolveDevModuleUrl(devOrigin, devModulePath);

    try {
        await loadViteClient(devOrigin);
        await loadReactRefreshPreamble(devOrigin);
        await loadEffectDevTools(devOrigin);
        return await loadViewFromModule(devModuleUrl, patchConnection, `Dev module ${devModuleUrl}`);
    } catch (error) {
        return createLoadErrorView(createDevLoadError({
            devModuleUrl,
            cause: error,
        }));
    }
}

async function loadProductionView(productionModuleUrl, patchConnection) {
    try {
        return await loadViewFromModule(
            productionModuleUrl,
            patchConnection,
            `Production module ${productionModuleUrl}`,
        );
    } catch (error) {
        return createLoadErrorView(createProductionLoadError({
            productionModuleUrl,
            cause: error,
        }));
    }
}

export function createEffectPatchView(options = {}) {
    return async function createPatchView(patchConnection) {
        const devModulePath = getDevModulePath(patchConnection, options);
        const productionModuleUrl = resolveProductionModuleUrl(
            options.productionModule ?? DEFAULT_EFFECT_PRODUCTION_MODULE,
        );

        // Dev-server loading is an explicit opt-in: without a devModule (either
        // from options.source or the patch manifest) this loads the packaged
        // production module immediately — no probe, no timer, no network.
        if (devModulePath) {
            const devOrigin = normalizeOrigin(options.devOrigin);
            const devStatusTimeoutMs = normalizeTimeoutMs(options.devStatusTimeoutMs);

            if (await canLoadEffectDevServer(devOrigin, devStatusTimeoutMs, devModulePath)) {
                return await loadDevView(devOrigin, devModulePath, patchConnection);
            }
        }

        return await loadProductionView(productionModuleUrl, patchConnection);
    };
}

export default createEffectPatchView();
