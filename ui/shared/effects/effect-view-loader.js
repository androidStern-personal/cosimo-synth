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

function createProductionLoadError({ productionModuleUrl, devOrigin, devModulePath, cause }) {
    const devHint = devModulePath
        ? `The effects dev server at ${normalizeOrigin(devOrigin)}${EFFECT_DEV_STATUS_PATH} was not reachable or was not serving ${normalizeModulePath(devModulePath)}. Start the shared effects Vite dev server from this repo, or build a production runtime that contains ${DEFAULT_EFFECT_PRODUCTION_MODULE}.`
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

function createDevLoadError({ devModuleUrl, cause }) {
    const error = new Error(
        [
            `Could not load the effect UI from the shared effects dev server at ${devModuleUrl}.`,
            "Stop the stale effects dev server, restart it from this repo, or build and install a production runtime.",
            cause?.message ? `Original error: ${cause.message}` : "",
        ].filter(Boolean).join(" "),
    );

    error.cause = cause;
    return error;
}

function formatLoadError(error) {
    if (error && typeof error === "object") {
        const maybeError = error;
        const message = maybeError.stack || maybeError.message || String(maybeError);
        const cause = maybeError.cause ? formatLoadError(maybeError.cause) : "";
        return [message, cause ? `\nCause:\n${cause}` : ""].filter(Boolean).join("\n");
    }

    return String(error);
}

function createLoadErrorView(error) {
    console.error(error);

    const element = document.createElement("pre");
    element.dataset.role = "effect-load-error";
    element.setAttribute("role", "alert");
    element.textContent = formatLoadError(error);
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

export function createEffectPatchView(options = {}) {
    return async function createPatchView(patchConnection) {
        const devOrigin = normalizeOrigin(options.devOrigin);
        const devStatusTimeoutMs = normalizeTimeoutMs(options.devStatusTimeoutMs);
        const devModulePath = getDevModulePath(patchConnection, options);
        const productionModuleUrl = resolveProductionModuleUrl(
            options.productionModule ?? DEFAULT_EFFECT_PRODUCTION_MODULE,
        );

        if (devModulePath && await canLoadEffectDevServer(devOrigin, devStatusTimeoutMs, devModulePath)) {
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

        try {
            return await loadViewFromModule(
                productionModuleUrl,
                patchConnection,
                `Production module ${productionModuleUrl}`,
            );
        } catch (error) {
            return createLoadErrorView(createProductionLoadError({
                productionModuleUrl,
                devOrigin,
                devModulePath,
                cause: error,
            }));
        }
    };
}

export default createEffectPatchView();
