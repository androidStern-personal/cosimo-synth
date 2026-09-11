import { prepareSharedData, type SharedDataConnection, type SharedDataCancellation } from "../../kit/ui/prepared-shared-data";
import { MSEG_PADDED_SAMPLES, renderMsegShapeInto, type MsegShape } from "./mseg";
import type { RuntimeInstallCommand } from "./runtime-install-channel";

/** Cosimo reserves inputs 0–2 for wavetables, then A/B for each of three MSEGs. */
export const SHARED_MSEG_FIRST_INPUT = 3;
/** Four identity words followed by one padded float32 curve. */
export const SHARED_MSEG_BYTES = (4 + MSEG_PADDED_SAMPLES) * 4;

/** Live and offline renderers prepare the same complete curve directly in place. */
export function prepareSharedMseg(connection: SharedDataConnection, source: {
    readonly slotIndex: number; readonly shapeIndex: number; readonly shape: MsegShape;
    readonly dspSessionId: number; readonly deliverySerial: number;
}, signal?: SharedDataCancellation) {
    return prepareSharedData(connection, {
        input: SHARED_MSEG_FIRST_INPUT + source.slotIndex * 2 + source.shapeIndex,
        byteLength: SHARED_MSEG_BYTES,
    }, destination => {
        new Int32Array(destination.buffer, destination.byteOffset, 4)
            .set([0x4d534547, source.dspSessionId, source.deliverySerial, MSEG_PADDED_SAMPLES]);
        renderMsegShapeInto(source.shape, new Float32Array(destination.buffer,
            destination.byteOffset + 16, MSEG_PADDED_SAMPLES));
    }, { signal });
}

/** Prepare the actual curve in shared storage; the existing DSP lane confirms adoption. */
export function sharedMsegCommand(connection: SharedDataConnection, slotIndex: number,
    shapeIndex: number, shape: MsegShape): RuntimeInstallCommand {
    return {
        submit: async ({ dspSessionId, deliverySerial, signal }) => {
            const submission = await prepareSharedMseg(connection,
                { slotIndex, shapeIndex, shape, dspSessionId, deliverySerial }, signal);
            // The command remains cancellable until the lane receives the DSP
            // acknowledgement, including the time after commit merely submits it.
            signal.onAbort(submission.cancel);
        },
    };
}
