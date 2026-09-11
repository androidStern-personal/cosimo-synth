import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

/** Build the actual offline engine's control-side preparation adapter. */
export async function buildOfflineRendererModule({outputDirectory,generatedClass,sharedData}) {
    await build({configFile:false,root:path.resolve(fileURLToPath(new URL('..',import.meta.url))),
        build:{outDir:outputDirectory,emptyOutDir:false,minify:true,
            lib:{entry:fileURLToPath(new URL('./offline-wavetable-preparation.ts',import.meta.url)),formats:['es'],fileName:()=> 'cosimo-offline-preparation.js'},
            rollupOptions:{output:{inlineDynamicImports:true}}}});
    const source=`// Cosimo offline performer: shared storage and preparation stay on this worker.\n`
        + `import {initialiseSharedDataPerformer} from './cmaj_api/cmaj-offline-shared-data.js';\n`
        + `import {prepareOfflineWavetables} from './cosimo-offline-preparation.js';\n`
        + generatedClass
        + `\nWavetableSynth.createOfflinePerformer = async (sessionID,frequency) => {\n`
        + `  const runtime=await initialiseSharedDataPerformer(new WavetableSynth(),sessionID,frequency,${JSON.stringify(sharedData)});\n`
        + `  return {...runtime,prepareWavetables:sources=>prepareOfflineWavetables(runtime,sources,sessionID)};\n`
        + `};\nexport {WavetableSynth};\nexport default WavetableSynth;\n`;
    await fs.writeFile(path.join(outputDirectory,'cmaj_Cosimo_Synth.offline.js'),source);
}
