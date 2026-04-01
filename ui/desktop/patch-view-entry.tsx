import { Component, createElement, type ErrorInfo } from "react";
import { createRoot, type Root } from "react-dom/client";

import cssText from "./styles.css?inline";
import { DesktopPatchView } from "./DesktopPatchView";
import type { PatchConnectionLike } from "../shared/cmajor-react";

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
    private root: Root | null = null;
    private mountPoint: HTMLDivElement | null = null;

    setPatchConnection(patchConnection: PatchConnectionLike) {
        this.patchConnection = patchConnection;
        this.renderApp();
    }

    connectedCallback() {
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
    }

    private renderApp() {
        if (!this.root || !this.patchConnection) {
            return;
        }

        this.root.render(
            <DesktopPatchErrorBoundary>
                <DesktopPatchView patchConnection={this.patchConnection} />
            </DesktopPatchErrorBoundary>
        );
    }
}

function getTagName() {
    return "cosimo-desktop-react-view";
}

export function createDesktopPatchView(patchConnection: PatchConnectionLike) {
    const tagName = getTagName();

    if (!window.customElements.get(tagName)) {
        window.customElements.define(tagName, CosimoDesktopReactViewElement);
    }

    const element = document.createElement(tagName) as CosimoDesktopReactViewElement;
    element.setPatchConnection(patchConnection);
    return element;
}

declare global {
    interface Window {
        __cosimoCollectLayoutMetrics?: () => Record<string, unknown>;
    }
}

window.__cosimoCollectLayoutMetrics = () => {
    const elements = Array.from(document.querySelectorAll("cosimo-desktop-react-view"));

    return {
        isReady: elements.length > 0,
        bodyClassName: document.body.className,
        bodyChildCount: document.body.childElementCount,
        patchViewCount: elements.length,
        patchViews: elements.map((element) => {
            const host = element as HTMLElement;
            const shadowRoot = host.shadowRoot;
            const mountPoint = shadowRoot?.querySelector("div") as HTMLDivElement | null;

            return {
                width: host.getBoundingClientRect().width,
                height: host.getBoundingClientRect().height,
                childElementCount: host.childElementCount,
                shadowChildElementCount: shadowRoot?.childElementCount ?? 0,
                hasMountPoint: Boolean(mountPoint),
                mountChildElementCount: mountPoint?.childElementCount ?? 0,
                mountTextLength: mountPoint?.textContent?.length ?? 0,
                shadowTextLength: shadowRoot?.textContent?.length ?? 0,
            };
        }),
    };
};

export default function createPatchView(patchConnection: PatchConnectionLike) {
    return createDesktopPatchView(patchConnection);
}
