import { Component, createElement, type ErrorInfo } from "react";
import { createRoot, type Root } from "react-dom/client";

import cssText from "./styles.css?inline";
import { IOSPatchView } from "./IOSPatchView";
import type { PatchConnectionLike } from "../shared/cmajor-react";
import { acquireSynthViewState } from "../shared/synth-state-client";

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

class IOSPatchErrorBoundary extends Component<
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
        console.error("Cosimo iPhone patch view crashed during render", error, errorInfo);
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

class CosimoIOSReactViewElement extends HTMLElement {
    private patchConnection: PatchConnectionLike | null = null;
    private root: Root | null = null;
    private mountPoint: HTMLDivElement | null = null;
    private stateLease: { readonly connection: PatchConnectionLike; release(): void } | null = null;

    setPatchConnection(patchConnection: PatchConnectionLike) {
        this.patchConnection = patchConnection;
        this.holdSynthState();
        this.renderApp();
    }

    connectedCallback() {
        this.holdSynthState();
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

        this.style.display = "block";
        this.style.width = "100%";
        this.style.height = "100%";
        this.renderApp();
    }

    disconnectedCallback() {
        this.root?.unmount();
        this.root = null;
        this.stateLease?.release();
        this.stateLease = null;
    }

    /** One synth state client lives as long as this element shows its connection, even if the React tree remounts. */
    private holdSynthState() {
        if (!this.patchConnection || this.stateLease?.connection === this.patchConnection) {
            return;
        }
        this.stateLease?.release();
        const { release } = acquireSynthViewState(this.patchConnection);
        this.stateLease = { connection: this.patchConnection, release };
    }

    private renderApp() {
        if (!this.root || !this.patchConnection) {
            return;
        }

        this.root.render(
            <IOSPatchErrorBoundary>
                <IOSPatchView patchConnection={this.patchConnection} />
            </IOSPatchErrorBoundary>
        );
    }
}

const tagName = "cosimo-synth-view";

export function createIOSPatchView(patchConnection: PatchConnectionLike) {
    if (!window.customElements.get(tagName)) {
        window.customElements.define(tagName, CosimoIOSReactViewElement);
    }

    const element = document.createElement(tagName) as CosimoIOSReactViewElement;
    element.setPatchConnection(patchConnection);
    return element;
}

export default createIOSPatchView;
