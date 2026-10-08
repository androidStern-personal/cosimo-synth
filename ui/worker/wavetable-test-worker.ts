import type { PatchConnectionLike } from "../shared/cmajor-react";
import { startPatchWorkerServices } from "../shared/patch-worker-services";
import { createSynthRackRestore } from "./synth-rack-restore";
import {
    createWavetableWorkerController,
    type WavetableWorkerOptions,
} from "./wavetable-worker";

/**
 * Browser-stress worker: the test page owns the modulation and articulation
 * lanes itself, so this worker runs the production wavetable service and the
 * synth's own rack delivery, without the rest of the plugin state.
 */
export default async function runWavetableTestWorker(
    connection: PatchConnectionLike,
    options: WavetableWorkerOptions = {},
) {
    return startPatchWorkerServices(connection, [
        () => createSynthRackRestore(connection, {
            onDefect: error => console.error("Cosimo rack restore failed", error),
        }),
        () => createWavetableWorkerController(connection, options),
    ]);
}
