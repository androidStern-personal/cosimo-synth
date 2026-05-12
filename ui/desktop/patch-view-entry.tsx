import { Component, createElement, type ErrorInfo } from "react";
import { createRoot, type Root } from "react-dom/client";

import cssText from "./styles.css?inline";
import { DesktopPatchView } from "./DesktopPatchView";
import { DesktopCurveLabStandaloneView } from "./desktop-curve-lab";
import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    createDesktopResourceClient,
    type ResourceClient,
} from "../shared/resource-client";
import type { SynthKeyboardInputMode } from "../shared/synth-input-router";
import {
    acquireModulationRuntimeBridge,
    releaseModulationRuntimeBridge,
} from "../shared/modulation";

if (import.meta.env.DEV) {
    void import("react-grab");
    void import("@react-grab/mcp/client");
}

type ErrorBoundaryState = {
    errorMessage: string | null;
};

function formatErrorMessage(error: unknown) {
    if (error && typeof error === "object") {
        const maybeError = error as { stack?: string; message?: string };
        return maybeError.stack || maybeError.message || String(error);
    }

    return String(error);
}

class DesktopPatchErrorBoundary extends Component<
    { children: ReturnType<typeof createElement> },
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = {
        errorMessage: null,
    };

    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
        return {
            errorMessage: formatErrorMessage(error),
        };
    }

    componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
        const combinedMessage = [
            formatErrorMessage(error),
            errorInfo.componentStack,
        ]
            .filter(Boolean)
            .join("\n\n");
        this.setState({ errorMessage: combinedMessage });
        console.error("Cosimo desktop patch view crashed during render", error, errorInfo);
    }

    render() {
        if (this.state.errorMessage) {
            return createElement(
                "pre",
                {
                    style: {
                        display: "block",
                        width: "100%",
                        height: "100%",
                        overflow: "auto",
                        margin: "0",
                        padding: "16px",
                        background: "#080b14",
                        color: "#ffd7df",
                        font: "12px/1.45 Menlo, Monaco, monospace",
                        whiteSpace: "pre-wrap",
                    },
                },
                this.state.errorMessage,
            );
        }

        return this.props.children;
    }
}

class CosimoDesktopReactViewElement extends HTMLElement {
    private patchConnection: PatchConnectionLike | null = null;
    private resourceClient: ResourceClient | null = null;
    private keyboardInputMode: SynthKeyboardInputMode = "hosted";
    private root: Root | null = null;
    private mountPoint: HTMLDivElement | null = null;
    private modulationRuntimePatchConnection: PatchConnectionLike | null = null;

    private shouldUseLightDom() {
        return import.meta.env.DEV || this.dataset.cinematic3dCapture === "1";
    }

    setPatchConnection(
        patchConnection: PatchConnectionLike,
        resourceClient?: ResourceClient,
        keyboardInputMode: SynthKeyboardInputMode = "hosted",
    ) {
        if (this.modulationRuntimePatchConnection && this.modulationRuntimePatchConnection !== patchConnection) {
            releaseModulationRuntimeBridge(this.modulationRuntimePatchConnection);
            this.modulationRuntimePatchConnection = null;
        }

        this.patchConnection = patchConnection;
        this.resourceClient = resourceClient ?? null;
        this.keyboardInputMode = keyboardInputMode;
        if (!this.modulationRuntimePatchConnection) {
            acquireModulationRuntimeBridge(patchConnection);
            this.modulationRuntimePatchConnection = patchConnection;
        }
        this.renderApp();
    }

    connectedCallback() {
        if (this.shouldUseLightDom()) {
            this.ensureLightDomStyles();

            if (!this.mountPoint || !this.root) {
                const mountPoint = document.createElement("div");
                mountPoint.style.width = "100%";
                mountPoint.style.height = "100%";
                this.replaceChildren(mountPoint);
                this.mountPoint = mountPoint;
                this.root = createRoot(mountPoint);
            }
        } else {
            if (!this.shadowRoot) {
                this.attachShadow({ mode: "open" });
            }

            if (!this.mountPoint || !this.root) {
                const shadowRoot = this.shadowRoot!;
                const style = document.createElement("style");
                style.textContent = cssText;
                const mountPoint = document.createElement("div");
                mountPoint.style.width = "100%";
                mountPoint.style.height = "100%";
                shadowRoot.replaceChildren(style, mountPoint);
                this.mountPoint = mountPoint;
                this.root = createRoot(mountPoint);
            }
        }

        this.style.display = "block";
        this.style.width = "100%";
        this.style.height = "100%";
        this.renderApp();
    }

    disconnectedCallback() {
        this.root?.unmount();
        this.root = null;

        if (this.modulationRuntimePatchConnection) {
            releaseModulationRuntimeBridge(this.modulationRuntimePatchConnection);
            this.modulationRuntimePatchConnection = null;
        }
    }

    private ensureLightDomStyles() {
        const styleId = "cosimo-desktop-react-view-styles";

        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = typeof cssText === "string" ? cssText.replaceAll(":host", getTagName()) : "";
        document.head.appendChild(style);
    }

    private renderApp() {
        if (!this.root || !this.patchConnection) {
            return;
        }

        this.root.render(
            <DesktopPatchErrorBoundary>
                <DesktopPatchView
                    patchConnection={this.patchConnection}
                    resourceClient={this.resourceClient ?? createDesktopResourceClient(this.patchConnection)}
                    keyboardInputMode={this.keyboardInputMode}
                />
            </DesktopPatchErrorBoundary>
        );
    }
}

class CosimoDesktopCurveLabElement extends HTMLElement {
    private root: Root | null = null;
    private mountPoint: HTMLDivElement | null = null;

    connectedCallback() {
        if (import.meta.env.DEV) {
            this.ensureLightDomStyles();

            if (!this.mountPoint || !this.root) {
                const mountPoint = document.createElement("div");
                mountPoint.style.width = "100%";
                mountPoint.style.height = "100%";
                this.replaceChildren(mountPoint);
                this.mountPoint = mountPoint;
                this.root = createRoot(mountPoint);
            }
        } else {
            if (!this.shadowRoot) {
                this.attachShadow({ mode: "open" });
            }

            if (!this.mountPoint || !this.root) {
                const shadowRoot = this.shadowRoot!;
                const style = document.createElement("style");
                style.textContent = cssText;
                const mountPoint = document.createElement("div");
                mountPoint.style.width = "100%";
                mountPoint.style.height = "100%";
                shadowRoot.replaceChildren(style, mountPoint);
                this.mountPoint = mountPoint;
                this.root = createRoot(mountPoint);
            }
        }

        this.style.display = "block";
        this.style.width = "100%";
        this.style.height = "100%";
        this.root?.render(
            <DesktopPatchErrorBoundary>
                <DesktopCurveLabStandaloneView />
            </DesktopPatchErrorBoundary>,
        );
    }

    disconnectedCallback() {
        this.root?.unmount();
        this.root = null;
    }

    private ensureLightDomStyles() {
        const styleId = "cosimo-desktop-curve-lab-styles";

        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = cssText.replaceAll(":host", getCurveLabTagName());
        document.head.appendChild(style);
    }
}

function getTagName() {
    return "cosimo-desktop-react-view";
}

function getCurveLabTagName() {
    return "cosimo-desktop-curve-lab";
}

function getDesktopWindowKind(globalObject: typeof globalThis = globalThis) {
    const desktopWindow = globalObject as typeof globalThis & {
        __COSIMO_DESKTOP_WINDOW_KIND__?: string;
    };

    return typeof desktopWindow.__COSIMO_DESKTOP_WINDOW_KIND__ === "string"
        ? desktopWindow.__COSIMO_DESKTOP_WINDOW_KIND__.trim()
        : "";
}

function getDesktopKeyboardInputMode(globalObject: typeof globalThis = globalThis): SynthKeyboardInputMode {
    const desktopWindow = globalObject as typeof globalThis & {
        __COSIMO_DESKTOP_RUNTIME_KIND__?: string;
    };

    return desktopWindow.__COSIMO_DESKTOP_RUNTIME_KIND__ === "standalone"
        ? "standalone-preview"
        : "hosted";
}

export function createDesktopPatchView(
    patchConnection: PatchConnectionLike,
    options: { resourceClient?: ResourceClient; keyboardInputMode?: SynthKeyboardInputMode } = {},
) {
    const tagName = getTagName();

    if (!window.customElements.get(tagName)) {
        window.customElements.define(tagName, CosimoDesktopReactViewElement);
    }

    const element = document.createElement(tagName) as CosimoDesktopReactViewElement;
    const keyboardInputMode = options.keyboardInputMode ?? getDesktopKeyboardInputMode();
    element.setPatchConnection(
        patchConnection,
        options.resourceClient,
        keyboardInputMode,
    );
    return element;
}

export function createDesktopCurveLabView() {
    const tagName = getCurveLabTagName();

    if (!window.customElements.get(tagName)) {
        window.customElements.define(tagName, CosimoDesktopCurveLabElement);
    }

    return document.createElement(tagName);
}

export default function createPatchView(patchConnection: PatchConnectionLike) {
    if (getDesktopWindowKind() === "curve-lab") {
        return createDesktopCurveLabView();
    }

    return createDesktopPatchView(patchConnection);
}
