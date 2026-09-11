// Diagnostic: real generated Cosimo, real preparation/storage/readers; no fake transport.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
// Usage: node block-cache-check.mjs BUILD_WEB_DIR OUTPUT_PREFIX
const root=path.resolve(process.argv[2]),label=path.resolve(process.argv[3]);
const {default:Program}=await import(pathToFileURL(path.join(root,'cmaj_Cosimo_Synth.offline.js')));
const {initialiseSharedDataPerformer}=await import(pathToFileURL(path.join(root,'cmaj_api/cmaj-offline-shared-data.js')));
const {prepareOfflineWavetables}=await import(pathToFileURL(path.join(root,'cosimo-offline-preparation.js')));
const performer=new Program();
let addressReads=0,sizeReads=0;
const initialise=performer.initialise.bind(performer);
performer.initialise=(session,rate,options)=>initialise(session,rate,{...options,
 sharedDataAddress:input=>{addressReads++;return options.sharedDataAddress(input);},
 sharedDataSize:input=>{sizeReads++;return options.sharedDataSize(input);},
});
const runtime=await initialiseSharedDataPerformer(performer,13579,48000,{format:'bytes',inputCount:3,maxRetainedBytes:52473984});
try {
 const frame=Float32Array.from({length:2048},(_,i)=>Math.sin(2*Math.PI*i/2048));
 await prepareOfflineWavetables(runtime,[0,1,2].map(input=>({input,tableIndex:35,generation:1,frames:[frame]})),13579);
 performer.advance(128);
 performer.sendInputEvent_midiIn({message:0x903c64});
 const left=new Float32Array(128),right=new Float32Array(128),samples=[];
 addressReads=0;sizeReads=0;
 const blocks=128;
 for(let block=0;block<blocks;block++) {
   performer.advance(128);
   performer.getOutputFrames_audioOut([left,right],128,0);
   for(let i=0;i<128;i++)samples.push(left[i],right[i]);
 }
 const rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);
 const result={label,blocks,samples:samples.length,rms,addressReads,sizeReads,expectedAddressReads:blocks*3,expectedSizeReads:blocks*3};
 await fs.writeFile(label+'.json',JSON.stringify(result,null,2));
 await fs.writeFile(label+'.f32',Buffer.from(Float32Array.from(samples).buffer));
 console.log(JSON.stringify(result));
 if(!(rms>0.001)||samples.some(x=>!Number.isFinite(x)))throw Error('Real Cosimo did not render valid audio.');
 if(addressReads!==blocks*3||sizeReads!==blocks*3)throw Error('Table readers are called more than once per input per audio block.');
} finally {runtime.dispose();}
