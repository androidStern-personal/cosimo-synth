import type { PatchConnectionLike } from "../../../kit/ui/cmajor-react";
import { startPatchWorkerServices } from "../../../kit/ui/patch-worker-services";
import { createSeqFxWorkerService } from "./seqfx-worker-service";

export default async function runSeqFxWorker(connection: PatchConnectionLike) {
    return startPatchWorkerServices(connection, [
        createSeqFxWorkerService,
    ]);
}
