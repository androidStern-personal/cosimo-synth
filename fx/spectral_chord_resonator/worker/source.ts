import type { PatchConnectionLike } from "../../../kit/index";
import { startPatchWorkerServices } from "../../../kit/index";
import { createSpectralWorkerService } from "./spectral-worker-service";

export default async function runSpectralWorker(connection: PatchConnectionLike) {
    return startPatchWorkerServices(connection, [
        createSpectralWorkerService,
    ]);
}
