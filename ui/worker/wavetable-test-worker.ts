import type { PatchConnectionLike } from "../shared/cmajor-react";
import { startPatchWorkerServices } from "../shared/patch-worker-services";
import { createRackStateWorkerService } from "./rack-state-worker-service";
import {
    createWavetableWorkerController,
    type WavetableWorkerOptions,
} from "./wavetable-worker";

/**
 * Browser-stress worker: wavetable and rack services remain production-real,
 * while the test host exclusively owns the two acknowledged runtime lanes.
 */
export default async function runWavetableTestWorker(
    connection: PatchConnectionLike,
    options: WavetableWorkerOptions = {},
) {
    return startPatchWorkerServices(connection, [
        createRackStateWorkerService,
        () => createWavetableWorkerController(connection, options),
    ]);
}
