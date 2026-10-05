import type { PatchConnectionLike } from "../../../kit/index";
import { startPatchWorkerServices } from "../../../ui/shared/patch-worker-services";
import { createSeqFxWorkerService } from "./seqfx-worker-service";

export default async function runSeqFxWorker(connection: PatchConnectionLike) {
    return startPatchWorkerServices(connection, [
        createSeqFxWorkerService,
    ]);
}
