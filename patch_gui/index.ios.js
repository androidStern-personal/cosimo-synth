import { createPatchViewWithOptions } from "./index.js";

export default function createIOSPatchView(patchConnection) {
    return createPatchViewWithOptions(patchConnection, { platform: "ios" });
}
