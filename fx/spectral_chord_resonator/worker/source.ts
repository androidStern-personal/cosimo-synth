import type { PatchConnectionLike } from "../../../kit/index";
import { startPatchWorkerServices } from "../../../ui/shared/patch-worker-services";
import { createSpectralWorkerService } from "./spectral-worker-service";

export default async function runSpectralWorker(connection: PatchConnectionLike) {
    return startPatchWorkerServices(connection, [
        createSpectralWorkerService,
    ]);
}
