import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import { startPatchWorkerServices } from "../../../ui/shared/patch-worker-services";
import { createSpectralWorkerService } from "./spectral-worker-service";

export default async function runSpectralWorker(connection: PatchConnectionLike) {
    return startPatchWorkerServices(connection, [
        createSpectralWorkerService,
    ]);
}
