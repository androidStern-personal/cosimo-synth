import "./styles.css";
import { loadHarnessManifest, MockPatchConnection } from "../shared/patch-connection-mock";
import { createDesktopPatchView } from "./patch-view-entry";

declare global {
    interface Window {
        __COSIMO_DESKTOP_HARNESS_INITIAL__?: {
            parameterValues?: Record<string, unknown>;
            storedState?: Record<string, unknown>;
        };
        __COSIMO_DESKTOP_HARNESS__?: {
            patchConnection: MockPatchConnection;
            getSnapshot: () => ReturnType<MockPatchConnection["getDebugSnapshot"]>;
            getRenderedState: () => {
                errorText: string | null;
                hasCanvas: boolean;
                keyboardDebug: unknown | null;
                keyboardNoteCount: string | null;
                keyboardRootNote: string | null;
                msegPreviewState: {
                    width: number;
                    height: number;
                    playhead: { x1: number; y1: number; x2: number; y2: number } | null;
                    progressClip: { x: number; y: number; width: number; height: number } | null;
                    morphCurvePath: string | null;
                } | null;
                stageLabel: string | null;
                stageDebug: unknown | null;
                filterGraphState: unknown | null;
                distortionGraphState: unknown | null;
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
            emitEffectiveMsegState: (nextState: Parameters<MockPatchConnection["emitEffectiveMsegState"]>[0]) => void;
            emitFilterSpectrum: (nextState: Parameters<MockPatchConnection["emitFilterSpectrum"]>[0]) => void;
            emitDistortionHistory: (nextState: Parameters<MockPatchConnection["emitDistortionHistory"]>[0]) => void;
            emitDistortionScope: (nextState: Parameters<MockPatchConnection["emitDistortionScope"]>[0]) => void;
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

function getDesktopViewRoot() {
    const host = getDesktopViewHost();

    if (!host) {
        return null;
    }

    return host.shadowRoot ?? host;
}

function readHarnessFatalErrorText() {
    return harnessRoot.querySelector(":scope > pre")?.textContent ?? null;
}

function readKeyboardDebug() {
    const keyboard = getDesktopViewRoot()?.querySelector(".keyboard") as {
        debug?: unknown;
        resetDebug?: () => void;
    } | null;
    return keyboard?.debug ?? null;
}

function readKeyboardAttribute(name: "note-count" | "root-note") {
    const keyboard = getDesktopViewRoot()?.querySelector(".keyboard");
    return keyboard?.getAttribute(name) ?? null;
}

function clearKeyboardDebug() {
    const keyboard = getDesktopViewRoot()?.querySelector(".keyboard") as {
        resetDebug?: () => void;
    } | null;
    keyboard?.resetDebug?.();
}

function readFilterGraphState() {
    const rawDebug = getDesktopViewRoot()?.querySelector('[data-role="filter-graph-debug"]')?.textContent ?? null;

    if (!rawDebug) {
        return null;
    }

    try {
        return JSON.parse(rawDebug);
    } catch {
        return null;
    }
}

function readDistortionGraphState() {
    const rawDebug = getDesktopViewRoot()?.querySelector('[data-role="distortion-graph-debug"]')?.textContent ?? null;

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
    const rawDebug = getDesktopViewRoot()?.querySelector('[data-role="wavetable-stage-debug"]')?.textContent ?? null;

    if (!rawDebug) {
        return null;
    }

    try {
        return JSON.parse(rawDebug);
    } catch {
        return null;
    }
}

function readMsegPreviewState() {
    const svg = getDesktopViewRoot()?.querySelector('[data-role="mseg-preview-surface"]');

    if (!(svg instanceof SVGSVGElement)) {
        return null;
    }

    const playhead = svg.querySelector('[data-role="mseg-preview-playhead"]');
    const progressClip = svg.querySelector('[data-role="mseg-preview-progress-clip"]');
    const morphCurve = svg.querySelector('[data-role="mseg-preview-morph-curve"]');
    const [, , width, height] = (svg.getAttribute("viewBox") ?? "0 0 0 0")
        .split(/\s+/)
        .map((value) => Number(value) || 0);

    return {
        width,
        height,
        playhead: playhead instanceof SVGLineElement
            ? {
                x1: Number(playhead.getAttribute("x1")) || 0,
                y1: Number(playhead.getAttribute("y1")) || 0,
                x2: Number(playhead.getAttribute("x2")) || 0,
                y2: Number(playhead.getAttribute("y2")) || 0,
            }
            : null,
        progressClip: progressClip instanceof SVGRectElement
            ? {
                x: Number(progressClip.getAttribute("x")) || 0,
                y: Number(progressClip.getAttribute("y")) || 0,
                width: Number(progressClip.getAttribute("width")) || 0,
                height: Number(progressClip.getAttribute("height")) || 0,
            }
            : null,
        morphCurvePath: morphCurve instanceof SVGPathElement
            ? morphCurve.getAttribute("d") || null
            : null,
    };
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
    const initialHarnessState = window.__COSIMO_DESKTOP_HARNESS_INITIAL__;
    if (initialHarnessState?.parameterValues && typeof initialHarnessState.parameterValues === "object") {
        for (const [endpointID, value] of Object.entries(initialHarnessState.parameterValues)) {
            patchConnection.setParameterValue(endpointID, value);
        }
    }
    if (initialHarnessState?.storedState && typeof initialHarnessState.storedState === "object") {
        for (const [key, value] of Object.entries(initialHarnessState.storedState)) {
            patchConnection.setStoredStateValue(key, value);
        }
    }
    window.__COSIMO_DESKTOP_HARNESS__ = {
        patchConnection,
        getSnapshot: () => patchConnection.getDebugSnapshot(),
        getRenderedState: () => {
            const viewRoot = getDesktopViewRoot();
            return {
                errorText: readHarnessFatalErrorText(),
                hasCanvas: Boolean(viewRoot?.querySelector(".cosimo-stage canvas")),
                keyboardDebug: readKeyboardDebug(),
                keyboardNoteCount: readKeyboardAttribute("note-count"),
                keyboardRootNote: readKeyboardAttribute("root-note"),
                msegPreviewState: readMsegPreviewState(),
                stageLabel: viewRoot?.querySelector('[data-role="wavetable-stage-title"]')?.textContent?.trim() ?? null,
                stageDebug: readWavetableStageDebugState(),
                filterGraphState: readFilterGraphState(),
                distortionGraphState: readDistortionGraphState(),
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
        emitEffectiveMsegState: (nextState) => {
            patchConnection.emitEffectiveMsegState(nextState);
        },
        emitFilterSpectrum: (nextState) => {
            patchConnection.emitFilterSpectrum(nextState);
        },
        emitDistortionHistory: (nextState) => {
            patchConnection.emitDistortionHistory(nextState);
        },
        emitDistortionScope: (nextState) => {
            patchConnection.emitDistortionScope(nextState);
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
