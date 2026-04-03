import { MockPatchConnection } from "../shared/patch-connection-mock";
import { createDesktopResourceClient } from "../shared/resource-client";
import { createIOSPatchView } from "./patch-view-entry";

declare global {
    interface Window {
        __COSIMO_IOS_REACT_HARNESS__?: {
            patchConnection: MockPatchConnection;
        };
    }
}

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

async function loadIOSHarnessManifest() {
    const response = await fetch("/WavetableSynth.iOS.cmajorpatch");

    if (!response.ok) {
        throw new Error(`Could not load iPhone patch manifest: ${response.status}`);
    }

    return response.json();
}

try {
    harnessRoot.textContent = "Booting iPhone React harness…";
    const manifest = await loadIOSHarnessManifest();
    const patchConnection = new MockPatchConnection(manifest);
    const resourceClient = createDesktopResourceClient(patchConnection);
    const patchView = createIOSPatchView(patchConnection, { resourceClient });
    patchView.style.width = "100%";
    patchView.style.height = "100%";
    harnessRoot.replaceChildren(patchView);
    window.__COSIMO_IOS_REACT_HARNESS__ = { patchConnection };
} catch (error) {
    renderFatalError(error);
}
