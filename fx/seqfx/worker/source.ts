import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import { startPatchWorkerServices } from "../../../ui/shared/patch-worker-services";
import { createSeqFxWorkerService } from "./seqfx-worker-service";

export default async function runSeqFxWorker(connection: PatchConnectionLike) {
    return startPatchWorkerServices(connection, [
        createSeqFxWorkerService,
    ]);
}
