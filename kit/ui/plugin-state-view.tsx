import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import type { PluginStateFields } from "./plugin-state-definition";
import { createCmajorPluginStateClient, type CmajorStateConnection } from "./plugin-state-cmajor";
import { PatchConnectionProvider, type PatchConnectionLike } from "./cmajor-react";
import { PluginStateProvider } from "./plugin-state-react";

interface StateViewElement extends HTMLElement {
    configure(mount: (element: HTMLElement) => () => void): void;
}

// Registration is lazy: importing state declarations in the patch worker must
// not touch DOM globals. A registered element receives each factory's current
// mount function, so reloaded modules do not keep the first View's closure.
function createElement(): StateViewElement {
    const tag = "builder-kit-state-view";
    if (!customElements.get(tag)) {
        customElements.define(tag, class extends HTMLElement {
            private mount: ((element: HTMLElement) => () => void) | undefined;
            private release: (() => void) | undefined;

            configure(mount: (element: HTMLElement) => () => void) {
                this.disconnectedCallback();
                this.mount = mount;
                if (this.isConnected) this.connectedCallback();
            }

            connectedCallback() {
                if (!this.release && this.mount) this.release = this.mount(this);
            }

            disconnectedCallback() {
                const release = this.release;
                this.release = undefined;
                release?.();
            }
        });
    }
    const element = document.createElement(tag);
    if (!("configure" in element) || typeof element.configure !== "function")
        throw new Error("The Builder Kit state view element name is already in use.");
    // SAFETY: the registered cross-module element's configure capability was
    // checked above; it accepts the same private mount contract after HMR.
    return element as StateViewElement;
}

/** Build the ordinary Cmajor view entry from an author view and state definition. */
export function createStatefulPatchView<const Fields extends PluginStateFields>(options: {
    readonly definition: Fields;
    readonly View: ComponentType;
    readonly css?: string;
}): (connection: CmajorStateConnection & PatchConnectionLike) => HTMLElement {
    return connection => {
        const element = createElement();
        element.configure(host => {
            const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
            const style = document.createElement("style");
            style.textContent = `:host { display: block; width: 100%; height: 100%; }\n${options.css ?? ""}`;
            const mount = document.createElement("div");
            mount.style.cssText = "width:100%;height:100%";
            shadow.replaceChildren(style, mount);
            const client = createCmajorPluginStateClient(options.definition, connection, {
                onDefect: error => console.error(error instanceof Error ? error.stack ?? error.message : String(error)),
            });
            const root = createRoot(mount);
            const View = options.View;
            root.render(<PatchConnectionProvider patchConnection={connection}>
                <PluginStateProvider definition={options.definition} client={client}><View /></PluginStateProvider>
            </PatchConnectionProvider>);
            return () => {
                try { root.unmount(); }
                finally { client.stop(); }
            };
        });
        return element;
    };
}
