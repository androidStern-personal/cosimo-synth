import { createPatchViewWithOptions } from "./index.js";
import { createIOSResourceClient } from "./resource-client.js";

export default function createIOSPatchView(patchConnection) {
    return createPatchViewWithOptions(patchConnection, {
        platform: "ios",
        resourceClient: createIOSResourceClient(patchConnection),
    });
}
