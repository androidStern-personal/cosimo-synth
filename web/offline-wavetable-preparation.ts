import type {BounceWavetableSource} from '../bounce/capture-plan.mjs';
import { prepareSharedData } from "../ui/shared/prepared-shared-data";
import type { SharedDataConnection } from "../kit/ui/plugin-state-direct-data";
import {PACKED_WAVETABLE_BYTES,preparePackedWavetable} from '../ui/shared/packed-wavetable';
import {buildFrameSpectrum} from '../ui/shared/wavetable-mip';
export {prepareSharedMseg as prepareOfflineMseg} from '../ui/shared/shared-mseg';

/** The live worker and offline worker use the same final packed representation. */
export async function prepareOfflineWavetables(connection:SharedDataConnection,sources:ReadonlyArray<BounceWavetableSource>,sessionID:number) {
    for(const source of sources) {
        const spectra=source.frames.map(buildFrameSpectrum);
        await prepareSharedData(connection,{input:source.input,byteLength:PACKED_WAVETABLE_BYTES},destination=>{
            preparePackedWavetable(destination,{dspSessionId:sessionID,generation:source.generation,
                tableIndex:source.tableIndex,frameCount:source.frames.length},frame=>{
                    const spectrum=spectra[frame];
                    if(!spectrum) throw new Error('Missing offline wavetable source frame.');
                    return spectrum;
                });
        });
    }
}
