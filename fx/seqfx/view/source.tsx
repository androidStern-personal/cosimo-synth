import { Component, createElement, type ErrorInfo } from "react";
import { createRoot, type Root } from "react-dom/client";

import editorTokensCssText from "../../../ui/shared/editor-tokens.css?inline";
import editorTickSliderCssText from "../../../ui/shared/editor-tick-slider.css?inline";
import filterRangeEditorCssText from "../../../ui/shared/filter-range-editor.css?inline";
import crusherEditorCssText from "./crusher-editor.css?inline";
import stutterEnvelopeEditorCssText from "./stutter-envelope-editor.css?inline";
import seqFxCssText from "./styles.css?inline";
import { SeqFxPatchView } from "./SeqFxPatchView";
import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";

const cssText = [
    editorTokensCssText,
    editorTickSliderCssText,
    filterRangeEditorCssText,
    crusherEditorCssText,
    stutterEnvelopeEditorCssText,
    seqFxCssText,
].join("\n");
const styleElementId = "cosimo-seqfx-react-view-styles";

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

function createShadowCss() {
    return cssText;
}

function createLightDomCss() {
    return cssText.replaceAll(":host", getTagName());
}

class SeqFxErrorBoundary extends Component<
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
        ].filter(Boolean).join("\n\n");
        this.setState({ errorMessage: combinedMessage });
        console.error("SeqFX patch view crashed during render", error, errorInfo);
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
                        background: "#151816",
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

class SeqFxPatchViewElement extends HTMLElement {
    private patchConnection: PatchConnectionLike | null = null;
    private root: Root | null = null;
    private mountPoint: HTMLDivElement | null = null;
    private shadowStyle: HTMLStyleElement | null = null;

    setPatchConnection(patchConnection: PatchConnectionLike) {
        this.patchConnection = patchConnection;
        this.updateStyles();
        this.renderApp();
    }

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
                const mountPoint = document.createElement("div");
                mountPoint.style.width = "100%";
                mountPoint.style.height = "100%";
                shadowRoot.replaceChildren(style, mountPoint);
                this.shadowStyle = style;
                this.mountPoint = mountPoint;
                this.root = createRoot(mountPoint);
            }

            this.updateStyles();
        }

        this.style.display = "block";
        this.style.width = "100%";
        this.style.height = "100%";
        this.renderApp();
    }

    disconnectedCallback() {
        this.root?.unmount();
        this.root = null;
    }

    private ensureLightDomStyles() {
        if (!document.getElementById(styleElementId)) {
            const style = document.createElement("style");
            style.id = styleElementId;
            document.head.appendChild(style);
        }

        this.updateStyles();
    }

    private updateStyles() {
        if (import.meta.env.DEV) {
            const style = document.getElementById(styleElementId);

            if (style) {
                style.textContent = createLightDomCss();
            }

            return;
        }

        if (this.shadowStyle) {
            this.shadowStyle.textContent = createShadowCss();
        }
    }

    private renderApp() {
        if (!this.root || !this.patchConnection) {
            return;
        }

        this.root.render(
            <SeqFxErrorBoundary>
                <SeqFxPatchView patchConnection={this.patchConnection} />
            </SeqFxErrorBoundary>,
        );
    }
}

function getTagName() {
    return "cosimo-seqfx-react-view";
}

export function createSeqFxPatchView(patchConnection: PatchConnectionLike) {
    const tagName = getTagName();

    if (!window.customElements.get(tagName)) {
        window.customElements.define(tagName, SeqFxPatchViewElement);
    }

    const element = document.createElement(tagName) as SeqFxPatchViewElement;
    element.setPatchConnection(patchConnection);
    return element;
}

export default function createPatchView(patchConnection: PatchConnectionLike) {
    return createSeqFxPatchView(patchConnection);
}
