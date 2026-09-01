import type { PatchConnectionLike } from "../../../kit/ui/cmajor-react";
import { startPatchWorkerServices } from "../../../kit/ui/patch-worker-services";
import { createSpectralWorkerService } from "./spectral-worker-service";

export default async function runSpectralWorker(connection: PatchConnectionLike) {
    return startPatchWorkerServices(connection, [
        createSpectralWorkerService,
    ]);
}
