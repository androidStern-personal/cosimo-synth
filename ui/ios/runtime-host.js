import { createIOSResourceClient } from "./resource-client.js";

function normaliseURL(url) {
    if (typeof url !== "string") {
        return "";
    }

    const trimmed = url.trim();

    if (trimmed.length === 0) {
        return "";
    }

    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function toResourcePath(path) {
    const pathText = typeof path === "string" ? path : String(path ?? "");
    return pathText.startsWith("/") ? pathText.slice(1) : pathText;
}

function getBootConfig() {
    if (globalThis.__COSIMO_PATCH_BOOT) {
        return globalThis.__COSIMO_PATCH_BOOT;
    }

    throw new Error("Cosimo patch boot config was not initialised before the host runtime loaded.");
}

function getRuntimeState() {
    const boot = getBootConfig();
    const devServerURL = normaliseURL(boot.devServerURL);
    const bundleResourceBaseURL = normaliseURL(boot.bundleResourceBaseURL);
    const usingDevServer = devServerURL.length > 0 && window.location.href.startsWith(devServerURL);
    const resourceBaseURL = usingDevServer ? devServerURL : bundleResourceBaseURL;

    return {
        boot,
        devServerURL,
        bundleResourceBaseURL,
        resourceBaseURL,
        bootSource: usingDevServer ? "devServer" : "bundle",
    };
}

async function importRuntimeModules(runtimeState) {
    try {
        const patchConnectionModule = await import(new URL("cmaj_api/cmaj-patch-connection.js", runtimeState.resourceBaseURL).toString());
        const patchViewModule = await import(new URL("cmaj_api/cmaj-patch-view.js", runtimeState.resourceBaseURL).toString());

        return {
            PatchConnection: patchConnectionModule.PatchConnection,
            createPatchViewHolder: patchViewModule.createPatchViewHolder,
        };
    } catch (error) {
        if (
            runtimeState.bootSource === "devServer" &&
            typeof globalThis.cmaj_requestBundledFallback === "function" &&
            runtimeState.boot.bundlePageURL
        ) {
            globalThis.cmaj_requestBundledFallback();
            await new Promise(() => {});
        }

        throw error;
    }
}

function createEmbeddedPatchConnectionClass(PatchConnectionClass, runtimeState) {
    return class EmbeddedPatchConnection extends PatchConnectionClass {
        constructor() {
            super();
            this.manifest = JSON.parse(JSON.stringify(runtimeState.boot.manifest ?? {}));

            if (runtimeState.boot.preferredView) {
                this.manifest.view = runtimeState.boot.preferredView;
            }

            this.prefersResourceReadBridge = true;
            globalThis.cmaj_deliverMessageFromServer = (message) => this.deliverMessageFromServer(message);
        }

        getResourceAddress(path) {
            return new URL(toResourcePath(path), runtimeState.resourceBaseURL).toString();
        }

        async readResource(path) {
            return globalThis._internalReadResource(path);
        }

        async readResourceAsAudioData(path, annotation) {
            return globalThis._internalReadResourceAsAudioData(path, annotation);
        }

        sendMessageToServer(message) {
            globalThis.cmaj_sendMessageToServer(message);
        }
    };
}

const runtimeState = getRuntimeState();
const container = document.getElementById("cmaj-view-container");
const state = {
    runtimeState,
    isViewActive: false,
    statusText: "",
    hasReadyNotification: false,
    catalogSnapshot: null,
    runtimeSnapshot: {
        hasRuntimeStateEvent: false,
        hasEffectiveWavetablePositionEvent: false,
        latestRuntimeState: null,
        latestEffectiveWavetablePosition: null,
    },
};

globalThis.setStatusMessage = (message) => {
    const messageText = typeof message === "string" ? message : String(message ?? "");
    state.statusText = messageText;

    const isErrorLike =
        /(^|\\b)(error|failed|could not)\\b/i.test(messageText) ||
        /no view available/i.test(messageText);

    if (!isErrorLike) {
        return;
    }

    state.isViewActive = false;
    container.innerHTML = `<pre id="cmaj-error-text">${messageText}</pre>`;
};

globalThis.__cosimoInspectHostPage = () => ({
    bootSource: state.runtimeState.bootSource,
    currentURL: window.location.href,
    bundlePageURL: state.runtimeState.boot.bundlePageURL ?? "",
    bundleResourceBaseURL: state.runtimeState.bundleResourceBaseURL,
    devServerURL: state.runtimeState.devServerURL,
    devServerProbe: globalThis.__COSIMO_DEV_SERVER_PROBE ?? null,
    resourceBaseURL: state.runtimeState.resourceBaseURL,
    documentTitle: document.title,
    htmlMarker: globalThis.__COSIMO_DEV_HTML_MARKER ?? "",
    jsMarker: globalThis.__COSIMO_DEV_JS_MARKER ?? "",
    statusText: state.statusText,
    viewActive: state.isViewActive,
    containerText: container?.innerText ?? "",
});

globalThis.__cosimoInspectRuntimeState = () => ({
    hasRuntimeStateEvent: state.runtimeSnapshot.hasRuntimeStateEvent,
    hasEffectiveWavetablePositionEvent: state.runtimeSnapshot.hasEffectiveWavetablePositionEvent,
    latestRuntimeState: state.runtimeSnapshot.latestRuntimeState,
    latestEffectiveWavetablePosition: state.runtimeSnapshot.latestEffectiveWavetablePosition,
});

globalThis.__cosimoLatestCatalogSnapshot = null;

function cloneInspectableValue(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return {
            inspectError: "Could not clone runtime value",
            valueType: typeof value,
        };
    }
}

async function refreshCatalogSnapshot(patchConnection) {
    const resourceClient = patchConnection?.resourceClient ?? createIOSResourceClient(patchConnection);
    state.catalogSnapshot = { pending: true };
    globalThis.__cosimoLatestCatalogSnapshot = state.catalogSnapshot;

    try {
        const catalog = await resourceClient.readJSON("assets/factory-bank-catalog.json");
        const tables = Array.isArray(catalog?.tables) ? catalog.tables : [];
        const firstTable = tables[0] ?? {};
        let firstTableAudioSampleRate = null;
        let firstTableAudioFrameCount = null;
        let firstTableAudioError = "";

        if (
            typeof firstTable.sourceWav === "string" &&
            firstTable.sourceWav.length > 0
        ) {
            try {
                const audioFile = await resourceClient.readAudio(firstTable.sourceWav);
                firstTableAudioSampleRate = Number(audioFile?.sampleRate) || 0;
                firstTableAudioFrameCount = audioFile?.samples?.length ?? 0;
            } catch (error) {
                firstTableAudioError = error?.stack || error?.message || String(error);
            }
        }

        state.catalogSnapshot = {
            pending: false,
            tableCount: tables.length,
            firstTableName: typeof firstTable.name === "string" ? firstTable.name : "",
            firstTableSourceWav: typeof firstTable.sourceWav === "string" ? firstTable.sourceWav : "",
            firstTableAudioSampleRate,
            firstTableAudioFrameCount,
            firstTableAudioError,
        };
    } catch (error) {
        state.catalogSnapshot = {
            pending: false,
            error: error?.stack || error?.message || String(error),
        };
    }

    globalThis.__cosimoLatestCatalogSnapshot = state.catalogSnapshot;
}

async function initialisePatch() {
    if (typeof globalThis.cmaj_notifyHostPageReady === "function" && !state.hasReadyNotification) {
        state.hasReadyNotification = true;
        globalThis.cmaj_notifyHostPageReady();
    }

    const runtimeModules = await importRuntimeModules(state.runtimeState);
    const EmbeddedPatchConnection = createEmbeddedPatchConnectionClass(runtimeModules.PatchConnection, state.runtimeState);
    const patchConnection = new EmbeddedPatchConnection();
    patchConnection.resourceClient = createIOSResourceClient(patchConnection);
    globalThis.__cosimoPatchConnection = patchConnection;

    if (typeof patchConnection.addEndpointListener === "function") {
        try {
            patchConnection.addEndpointListener("runtimeState", (value) => {
                state.runtimeSnapshot.hasRuntimeStateEvent = true;
                state.runtimeSnapshot.latestRuntimeState = cloneInspectableValue(value);
            });
        } catch (error) {
            state.runtimeSnapshot.latestRuntimeState = {
                inspectError: error?.stack || error?.message || String(error),
            };
        }

        try {
            patchConnection.addEndpointListener("effectiveWavetablePosition", (value) => {
                state.runtimeSnapshot.hasEffectiveWavetablePositionEvent = true;
                state.runtimeSnapshot.latestEffectiveWavetablePosition = cloneInspectableValue(value);
            });
        } catch (error) {
            state.runtimeSnapshot.latestEffectiveWavetablePosition = {
                inspectError: error?.stack || error?.message || String(error),
            };
        }
    }

    void refreshCatalogSnapshot(patchConnection);

    const createViewIfNeeded = async () => {
        if (state.isViewActive) {
            return;
        }

        container.innerHTML = "";
        const view = await runtimeModules.createPatchViewHolder(patchConnection);

        if (!view) {
            globalThis.setStatusMessage("Could not create a patch view.");
            return;
        }

        state.isViewActive = true;
        container.appendChild(view);
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            void createViewIfNeeded();
        }, { once: true });
        return;
    }

    await createViewIfNeeded();
}

void initialisePatch();
