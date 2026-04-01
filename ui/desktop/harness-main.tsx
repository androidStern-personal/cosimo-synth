import { createRoot } from "react-dom/client";

import "./styles.css";
import { DesktopPatchView } from "./DesktopPatchView";
import { loadHarnessManifest, MockPatchConnection } from "../shared/patch-connection-mock";

const rootElement = document.getElementById("root");

if (!rootElement) {
    throw new Error("Harness root element is missing.");
}

const harnessRoot = rootElement;

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
    document.body.dataset.bootStage = "rendering";

    createRoot(harnessRoot).render(
        <DesktopPatchView patchConnection={patchConnection} />
    );
    document.body.dataset.bootStage = "render-called";
} catch (error) {
    renderFatalError(error);
}
