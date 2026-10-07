import { createRoot } from "react-dom/client";

import { SpeedrunStudioApp } from "../../../ui/speedrun/studio/app";
import { SpeedrunStudioSession } from "../../../ui/speedrun/studio/pipeline";
import { loadSpeedrunStudioRuntime } from "../../../ui/speedrun/studio/runtime";

declare global {
    interface Window {
        speedrunStudio?: SpeedrunStudioSession;
    }
}

// The harness is served one folder below the built web root, beside the
// generated synth and its checkpoint worker.
const runtime = await loadSpeedrunStudioRuntime(new URL("../", document.baseURI));
const session = new SpeedrunStudioSession(runtime);
const rootElement = document.querySelector<HTMLElement>("#root");
if (rootElement === null) throw new Error("The speedrun studio harness root is missing.");
createRoot(rootElement).render(<SpeedrunStudioApp session={session} />);
window.speedrunStudio = session;
