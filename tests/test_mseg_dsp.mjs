// Reader DSP qualification; framework publication/lifetime is covered by shared-data integration tests.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const source=process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
const generator=process.env.CMAJOR_SHARED_GENERATOR;
assert.ok(source&&generator,'Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE and CMAJOR_SHARED_GENERATOR to the authored compiler/runtime.');
const directory=await mkdtemp(path.join(tmpdir(),'kit-mseg-dsp-'));
try {
    const module=await readFile(path.resolve(import.meta.dirname,'../kit/cmajor/mseg.cmajor'),'utf8');
    const filename=path.join(directory,'Probe.cmajor'),generated=path.join(directory,'generated.mjs');
    await writeFile(filename,`namespace cmaj::data { external float read(int inputIndex,int sampleIndex); external int size(int inputIndex); }\n${module}\ngraph Probe [[ main ]] {
        input event int32 trigger; input event int32 noteOff; input event kit::mseg::Playback playback;
        input value float32 duration; output stream float32 out;
        node reader=kit::mseg::Reader(0);
        connection trigger->reader.trigger; connection noteOff->reader.noteOff;
        connection playback->reader.playback; connection duration->reader.durationSeconds; connection reader.out->out;
    }`);
    execFileSync(generator,[filename,generated,JSON.stringify({SIMD:'simd-only',sharedMemory:{maximumPages:256}})],{stdio:'pipe'});
    const {default:Program}=await import(pathToFileURL(generated));
    const {compileSharedDataReader}=await import(pathToFileURL(path.join(source,'javascript/cmaj_api/cmaj-shared-data-reader.js')));
    const performer=new Program(),requirements=performer.getMemoryRequirements();
    const memory=new WebAssembly.Memory({initial:requirements.minimumPages+2,maximum:256,shared:true});
    const descriptorBase=requirements.minimumBytes,descriptors=new Uint32Array(memory.buffer,descriptorBase,2);
    const first=descriptorBase+8,second=first+2051*4;
    const ramp=new Float32Array(memory.buffer,first,2051);for(let i=0;i<ramp.length;i++)ramp[i]=Math.min(1,Math.max(0,(i-1)/2047));
    new Float32Array(memory.buffer,second,2051).fill(.8);descriptors.set([first,2051]);
    const reader=new WebAssembly.Instance(await compileSharedDataReader(),{env:{memory,descriptorBase:new WebAssembly.Global({value:'i32',mutable:true},descriptorBase),inputCount:new WebAssembly.Global({value:'i32',mutable:true},1)}}).exports;
    await performer.initialise(17,48000,{memory,externalFunctions:{cmaj__data__read:reader.read,cmaj__data__size:reader.size}});
    const output=new Float32Array(128);const render=()=>{performer.advance(128);performer.getOutputFrames_out([output],128,0);};
    performer.setInputValue_duration(.01,0);performer.sendInputEvent_trigger(1);render();
    assert.equal(output[0],0);assert.ok(Math.abs(output[127]-127/480)<1e-5);
    // The reader receives a different immutable allocation between complete blocks.
    descriptors.set([second,2051]);render();assert.ok(output.every(value=>Math.abs(value-.8)<1e-6));assert.equal(ramp[0],0);
    descriptors.set([first,2051]);performer.sendInputEvent_playback({holdFinalValue:true,loopEnabled:true,loopStart:.2,loopEnd:.6,ignoreNoteOff:false,legatoRestarts:false});render();
    assert.ok(Math.min(...output)>=.2-1e-5&&Math.max(...output)<=.6+1e-5);
    performer.sendInputEvent_noteOff(1);for(let i=0;i<4;i++)render();assert.ok(output.every(value=>value===1));
    console.log('MSEG generated DSP: interpolation, duration, held allocation replacement, loop window and note-off passed.');
}finally{await rm(directory,{recursive:true,force:true});}
