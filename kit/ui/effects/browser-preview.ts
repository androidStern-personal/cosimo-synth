import { createBrowserPreviewConnection } from "./browser-preview-connection";
import { isPlainObject } from "./effect-utils";

const mount = document.getElementById("plugin-preview");
const errorView = document.getElementById("preview-error");
const title = document.getElementById("preview-title");

try {
    if (!mount || !errorView || !title) throw new Error("The shared browser preview page is incomplete.");
    const patchPath: unknown = JSON.parse(document.getElementById("preview-patch")?.textContent ?? "null");
    if (typeof patchPath !== "string" || !patchPath.startsWith("/fx/")) throw new Error("The preview patch path is missing.");
    const response = await fetch(patchPath);
    if (!response.ok) throw new Error(`Could not read the preview patch (HTTP ${response.status}).`);
    const manifest: unknown = await response.json();
    if (!isPlainObject(manifest) || !isPlainObject(manifest.view)
        || typeof manifest.view.devModule !== "string" || !manifest.view.devModule.startsWith("/fx/")) {
        throw new Error("This patch needs view.devModule to load its real interface in the browser.");
    }
    const viewModule = await import(/* @vite-ignore */ manifest.view.devModule);
    const connection = createBrowserPreviewConnection(manifest, viewModule.browserPreviewParameters);
    if (connection._tag === "err") throw new Error(connection.message);
    const factory: unknown = viewModule.default ?? viewModule.createPatchView;
    if (typeof factory !== "function") throw new Error("The view module does not export a patch-view factory.");
    const view: unknown = await factory(connection.value);
    if (!(view instanceof HTMLElement)) throw new Error("The patch-view factory did not return an HTML element.");
    title.textContent = `${typeof manifest.name === "string" ? manifest.name : "Plugin"} — UI preview`;
    document.title = title.textContent;
    mount.replaceChildren(view);
} catch (error: unknown) {
    console.error("Could not open plugin UI preview:", error);
    if (errorView) {
        errorView.hidden = false;
        errorView.textContent = error instanceof Error ? error.message : "Could not open the plugin UI preview.";
    }
}
