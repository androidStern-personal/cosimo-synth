// Real generated full Cosimo; before/after transport adapters, identical source curves and MIDI.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const [webArg,outputArg,mode='before',voicesArg='1']=process.argv.slice(2);
const web=path.resolve(webArg),output=path.resolve(outputArg),voices=Number(voicesArg);
const load=name=>import(pathToFileURL(path.join(web,name)));
const {default:Program}=await load('cmaj_Cosimo_Synth.offline.js');
const {initialiseSharedDataPerformer}=await load('cmaj_api/cmaj-offline-shared-data.js');
const {prepareOfflineWavetables,prepareOfflineMseg}=await load('cosimo-offline-preparation.js');
const source=path.resolve('build/shared-mseg-proof/before/patch_gui');
const {renderMsegShape,createDefaultMsegShape}=await import(pathToFileURL(path.join(source,'mseg.js')));
const {compileModulationRuntimeProgram}=await import(pathToFileURL(path.join(source,'modulation-runtime-program.js')));
const performer=new Program(),session=13579,frames=128,rate=48000;
const runtime=await initialiseSharedDataPerformer(performer,session,rate,{format:'bytes',inputCount:mode==='before'?3:9,maxRetainedBytes:52572624});
let serial=0;const left=new Float32Array(frames),right=new Float32Array(frames),audio=[];
const timed=fn=>{const start=performance.now();fn();return (performance.now()-start)*1000;};
const quantiles=values=>{const v=[...values].sort((a,b)=>a-b);return {medianUs:v[Math.floor(v.length*.5)],p95Us:v[Math.floor(v.length*.95)],minUs:v[0],maxUs:v.at(-1)};};
function advance(capture=false){performer.advance(frames);if(capture){performer.getOutputFrames_audioOut([left,right],frames,0);for(let i=0;i<frames;i++)audio.push(left[i],right[i]);}}
function event(name,value){performer['sendInputEvent_'+name]({...value,dspSessionId:session,deliverySerial:++serial});advance();}
function shape(index,edit=0){return {...createDefaultMsegShape(),points:[{x:0,y:index?.85:.1,curvePower:0},{x:.4,y:Math.min(.95,.25+edit*.01),curvePower:.4},{x:1,y:index?.15:.9,curvePower:0}]};}
async function upload(index,edit=0){let prepUs=0,transferUs=0;
 if(mode==='before') {const start=performance.now();const buffer=renderMsegShape(shape(index,edit));prepUs=(performance.now()-start)*1000;transferUs=timed(()=>performer.sendInputEvent_modulationMsegBuffer({slot:1,shapeIndex:index,buffer,dspSessionId:session,deliverySerial:++serial}));}
 else {const start=performance.now();await prepareOfflineMseg(runtime,{slotIndex:0,shapeIndex:index,shape:shape(index,edit),dspSessionId:session,deliverySerial:++serial});prepUs=(performance.now()-start)*1000;}
 const adoptionUs=timed(()=>advance());return {prepUs,transferUs,adoptionUs};}

try {
 const sine=Float32Array.from({length:2048},(_,i)=>Math.sin(2*Math.PI*i/2048));
 await prepareOfflineWavetables(runtime,[0,1,2].map(input=>({input,tableIndex:35,generation:1,frames:[sine]})),session);advance();
 await upload(0);await upload(1);
 event('modulationMsegPlayback',{slot:1,holdFinalValue:true,rateKind:0,loopEnabled:true,loopStart:.1,loopEnd:.9,noteOffPolicy:0,legatoRestarts:false});
 const program=compileModulationRuntimeProgram([{id:'proof',sourceKind:'mseg',sourceSlot:1,targetKind:'oscA.pan',enabled:true,polarity:'bipolar',amount:.8}]);
 event('modulationProgram',program);performer.setInputValue_mseg1Rate(.12,0);
 for(let n=0;n<voices;n++)performer.sendInputEvent_midiIn({message:0x900064|((48+n*3)<<8)});
 const sections=[];
 for(let phase=0;phase<4;phase++){
  if(phase===1)performer.setInputValue_mseg1Morph(.5,0);
  if(phase===2){await upload(0,45);performer.setInputValue_mseg1Morph(1,0);}
  if(phase===3){event('modulationMsegPlayback',{slot:1,holdFinalValue:true,rateKind:0,loopEnabled:true,loopStart:.3,loopEnd:.6,noteOffPolicy:0,legatoRestarts:false});performer.setInputValue_mseg1Morph(.25,0);}
  const start=audio.length;for(let b=0;b<128;b++)advance(true);sections.push({phase,offset:start,samples:audio.length-start});
 }
 for(let b=0;b<256;b++)advance();
 const steady=[];for(let repetition=0;repetition<9;repetition++){const start=performance.now();for(let b=0;b<1024;b++)advance();steady.push((performance.now()-start)*1000/1024);}
 const edits=[];for(let i=0;i<100;i++)edits.push(await upload(i%2,i%50));
 const floats=Float32Array.from(audio),rms=Math.sqrt(audio.reduce((s,x)=>s+x*x,0)/audio.length);
 let stereoDifference=0;for(let i=0;i<audio.length;i+=2)stereoDifference+=Math.abs(audio[i]-audio[i+1]);
 const result={mode,voices,rate,frames,sections,samples:audio.length,rms,stereoDifference,steady:{...quantiles(steady),repetitionsUs:steady,cpuPercent:quantiles(steady).medianUs/(frames/rate*1e6)*100},edits:{count:edits.length,preparation:quantiles(edits.map(x=>x.prepUs)),delivery:quantiles(edits.map(x=>x.transferUs)),adoptionBlock:quantiles(edits.map(x=>x.adoptionUs))},lastSerial:serial};
 await fs.writeFile(output+'.f32',Buffer.from(floats.buffer));await fs.writeFile(output+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 if(!(rms>.001)||!audio.every(Number.isFinite)||!(stereoDifference>.1))throw Error('Expected finite nonzero audio with audible MSEG pan modulation');
}finally{runtime.dispose();}
