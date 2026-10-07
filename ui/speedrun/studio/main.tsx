import { createRoot } from "react-dom/client";

import { SpeedrunStudioApp } from "./app";
import { SpeedrunStudioSession } from "./pipeline";
import { loadSpeedrunStudioRuntime } from "./runtime";

const rootElement = document.querySelector<HTMLElement>("#root");
if (rootElement === null) throw new Error("The speedrun studio root is missing.");

try {
    const runtime = await loadSpeedrunStudioRuntime();
    const session = new SpeedrunStudioSession(runtime);
    createRoot(rootElement).render(<SpeedrunStudioApp session={session} />);
    window.addEventListener("pagehide", () => session.dispose(), { once: true });
} catch (error) {
    const message = error instanceof Error ? error.message : "The speedrun studio could not start.";
    rootElement.innerHTML = `<main class="startup-error"><small>SPEEDRUN STUDIO FAILED TO START</small><strong></strong></main>`;
    const strong = rootElement.querySelector("strong");
    if (strong) strong.textContent = message;
}
