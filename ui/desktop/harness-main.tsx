import "./styles.css";
import { loadHarnessManifest, MockPatchConnection } from "../shared/patch-connection-mock";
import { createDesktopPatchView } from "./patch-view-entry";

declare global {
    interface Window {
        __COSIMO_DESKTOP_HARNESS__?: {
            patchConnection: MockPatchConnection;
            getSnapshot: () => ReturnType<MockPatchConnection["getDebugSnapshot"]>;
            getRenderedState: () => {
                errorText: string | null;
                hasCanvas: boolean;
                keyboardDebug: unknown | null;
                keyboardNoteCount: string | null;
                keyboardRootNote: string | null;
                stageLabel: string | null;
                stageDebug: unknown | null;
                filterGraphState: unknown | null;
            };
            clearDebugLog: () => void;
            setRuntimeState: (nextState: Parameters<MockPatchConnection["setRuntimeState"]>[0]) => void;
            setParameterValue: (
                endpointID: string,
                value: unknown,
                emitEndpoint?: boolean,
            ) => void;
            emitEffectiveWavetablePosition: (position: number, voiceGeneration?: number) => void;
            emitEffectiveWarpState: (nextState: Parameters<MockPatchConnection["emitEffectiveWarpState"]>[0]) => void;
            emitEffectiveFilterState: (nextState: Parameters<MockPatchConnection["emitEffectiveFilterState"]>[0]) => void;
            setStoredStateValue: (key: string, value: unknown) => void;
        };
    }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
    throw new Error("Harness root element is missing.");
}

const harnessRoot = rootElement;

function getDesktopViewHost() {
    return harnessRoot.querySelector("cosimo-desktop-react-view");
}

function getDesktopShadowRoot() {
    return getDesktopViewHost()?.shadowRoot ?? null;
}

function readHarnessFatalErrorText() {
    return harnessRoot.querySelector(":scope > pre")?.textContent ?? null;
}

function readKeyboardDebug() {
    const keyboard = getDesktopShadowRoot()?.querySelector(".keyboard") as {
        debug?: unknown;
        resetDebug?: () => void;
    } | null;
    return keyboard?.debug ?? null;
}

function readKeyboardAttribute(name: "note-count" | "root-note") {
    const keyboard = getDesktopShadowRoot()?.querySelector(".keyboard");
    return keyboard?.getAttribute(name) ?? null;
}

function clearKeyboardDebug() {
    const keyboard = getDesktopShadowRoot()?.querySelector(".keyboard") as {
        resetDebug?: () => void;
    } | null;
    keyboard?.resetDebug?.();
}

function readFilterGraphState() {
    const rawDebug = getDesktopShadowRoot()?.querySelector('[data-role="filter-graph-debug"]')?.textContent ?? null;

    if (!rawDebug) {
        return null;
    }

    try {
        return JSON.parse(rawDebug);
    } catch {
        return null;
    }
}

function readWavetableStageDebugState() {
    const rawDebug = getDesktopShadowRoot()?.querySelector('[data-role="wavetable-stage-debug"]')?.textContent ?? null;

    if (!rawDebug) {
        return null;
    }

    try {
        return JSON.parse(rawDebug);
    } catch {
        return null;
    }
}

function renderFatalError(error: unknown) {
    const message = error instanceof Error
        ? error.stack || error.message
        : String(error);
    harnessRoot.innerHTML = `
        <pre style="
            margin: 0;
            min-height: 100vh;
            padding: 24px;
            background: #02040b;
            color: #ffd9d9;
            white-space: pre-wrap;
            word-break: break-word;
            font: 13px/1.45 Menlo, Monaco, monospace;
        ">${message.replace(/[&<>]/g, (character) => (
            character === "&" ? "&amp;" : character === "<" ? "&lt;" : "&gt;"
        ))}</pre>
    `;
}

window.addEventListener("error", (event) => {
    renderFatalError(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
    renderFatalError(event.reason);
});

try {
    document.body.dataset.bootStage = "booting";
    harnessRoot.textContent = "Booting desktop harness…";
    const manifest = await loadHarnessManifest();
    document.body.dataset.bootStage = "manifest-loaded";
    const patchConnection = new MockPatchConnection(manifest);
    window.__COSIMO_DESKTOP_HARNESS__ = {
        patchConnection,
        getSnapshot: () => patchConnection.getDebugSnapshot(),
        getRenderedState: () => {
            const shadowRoot = getDesktopShadowRoot();
            return {
                errorText: readHarnessFatalErrorText(),
                hasCanvas: Boolean(shadowRoot?.querySelector(".cosimo-stage canvas")),
                keyboardDebug: readKeyboardDebug(),
                keyboardNoteCount: readKeyboardAttribute("note-count"),
                keyboardRootNote: readKeyboardAttribute("root-note"),
                stageLabel: shadowRoot?.querySelector(".cosimo-stage .truncate")?.textContent?.trim() ?? null,
                stageDebug: readWavetableStageDebugState(),
                filterGraphState: readFilterGraphState(),
            };
        },
        clearDebugLog: () => {
            patchConnection.clearDebugLog();
            clearKeyboardDebug();
        },
        setRuntimeState: (nextState) => patchConnection.setRuntimeState(nextState),
        setParameterValue: (endpointID, value, emitEndpoint = false) => {
            patchConnection.setParameterValue(endpointID, value, emitEndpoint);
        },
        emitEffectiveWavetablePosition: (position, voiceGeneration = 1) => {
            patchConnection.emitEffectiveWavetablePosition(position, voiceGeneration);
        },
        emitEffectiveWarpState: (nextState) => {
            patchConnection.emitEffectiveWarpState(nextState);
        },
        emitEffectiveFilterState: (nextState) => {
            patchConnection.emitEffectiveFilterState(nextState);
        },
        setStoredStateValue: (key, value) => patchConnection.setStoredStateValue(key, value),
    };
    document.body.dataset.bootStage = "rendering";
    const patchView = createDesktopPatchView(patchConnection);
    patchView.style.width = "100%";
    patchView.style.height = "100%";
    harnessRoot.replaceChildren(patchView);
    document.body.dataset.bootStage = "render-called";
} catch (error) {
    renderFatalError(error);
}
