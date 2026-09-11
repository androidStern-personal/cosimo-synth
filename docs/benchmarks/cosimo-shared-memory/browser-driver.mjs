// Actual full Cosimo DSP and production wavetable worker in Chromium AudioWorklet.
// This driver observes endpoints/audio; it never supplies a fake transport.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../..');
const mode=process.argv[2]??'new',index=Number(process.argv[3]??3);
const root=mode==='old'?path.join(here,'old'):path.join(repo,'build/web');
const pageSource=`<!doctype html><script type="module">
const errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.run=async()=>{
 const {PatchConnection}=await import('./cmaj_api/cmaj-patch-connection.js');
 const metrics={messages:{},jsonInstrumentationMs:0,callback:[],audio:[],errors};
 const original=PatchConnection.prototype.sendEventOrValue;
 let counting=false;
 PatchConnection.prototype.sendEventOrValue=function(endpoint,value,...args){
  if(counting&&(endpoint==='wavetableMipFrame'||endpoint==='wavetableLoadBegin')){
   const start=performance.now(),bytes=JSON.stringify(value).length;
   metrics.jsonInstrumentationMs+=performance.now()-start;
   const entry=metrics.messages[endpoint]??={count:0,jsonBytes:0};entry.count++;entry.jsonBytes+=bytes;
  }
  return original.call(this,endpoint,value,...args);
 };
 const {createAudioWorkletNodePatchConnection}=await import('./${mode==='old'?'patch.js':'cmaj_Cosimo_Synth.js'}');
 const context=new AudioContext({sampleRate:48000});await context.resume();
 const connection=await createAudioWorkletNodePatchConnection(context,'actual-cosimo-'+${JSON.stringify(mode)});
 const statsModule=URL.createObjectURL(new Blob([
 'registerProcessor("audio-stats",class extends AudioWorkletProcessor {constructor(){super();this.s=0;this.n=0;this.bad=0;this.port.onmessage=()=>{this.port.postMessage({rms:Math.sqrt(this.s/this.n),samples:this.n,nonfinite:this.bad});this.s=0;this.n=0;this.bad=0;};} process(i,o){const a=i[0];if(a)for(let c=0;c<a.length;c++){o[0][c]?.set(a[c]);for(const x of a[c]){this.s+=x*x;this.n++;if(!Number.isFinite(x))this.bad++;}}return true;}});'
 ],{type:'text/javascript'}));
 await context.audioWorklet.addModule(statsModule);URL.revokeObjectURL(statsModule);
 const capture=new AudioWorkletNode(context,'audio-stats',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
 capture.port.onmessage=e=>metrics.audio.push(e.data);
 const mute=context.createGain();mute.gain.value=0;connection.audioNode.connect(capture);capture.connect(mute);mute.connect(context.destination);
 connection.audioNode.port.addEventListener('message',e=>{if(e.data.type==='cosimo-perf')metrics.callback.push(e.data);});
 let state=[null,null,null],selectedAt=0,desiredAt=0,activeAt=0;
 connection.addEndpointListener('runtimeState',v=>{state[v.oscillatorIndex]=v;if(v.oscillatorIndex===0&&selectedAt){if(v.desiredTableIndex===${index}&&!desiredAt)desiredAt=performance.now();if(v.hasActive&&v.activeTableIndex===${index}&&!activeAt)activeAt=performance.now();}});
 connection.sendEventOrValue('runtimeSyncRequest',2147483647);
 const wait=async(predicate,description)=>{const end=performance.now()+60000;while(!predicate()){if(errors.length)throw Error(errors.join('\\n'));if(performance.now()>end)throw Error(description+' timeout '+JSON.stringify(state));await new Promise(r=>setTimeout(r,10));}};
 await wait(()=>state.every(s=>s?.hasActive),'initial tables');
 connection.sendMIDIInputEvent('midiIn',0x903c64);await new Promise(r=>setTimeout(r,250));
 capture.port.postMessage('read');await new Promise(r=>setTimeout(r,20));metrics.audio=[];
 connection.sendMessageToServer({type:'cosimo-perf-config',enabled:true,epoch:1});
 counting=true;selectedAt=performance.now();connection.sendEventOrValue('oscAWavetableSelect',${index});
 await wait(()=>activeAt>0,'selected table');
 counting=false;const afterLoad=performance.now();capture.port.postMessage('read');
 connection.sendMessageToServer({type:'cosimo-perf-reset',epoch:2});metrics.callback=[];
 await new Promise(r=>setTimeout(r,2000));capture.port.postMessage('read');await new Promise(r=>setTimeout(r,50));
 const result={mode:${JSON.stringify(mode)},tableIndex:${index},selectionToActiveMs:activeAt-selectedAt,desiredObservedToActiveMs:activeAt-desiredAt,observedFinishedMs:afterLoad-selectedAt,state,sharedMemory:connection.getSharedDataMemoryUsage?.(),...metrics};
 connection.dispose?.();await context.close();return result;
};
</script>`;
const server=createServer(async(req,res)=>{
 try{const pathname=new URL(req.url,'http://localhost').pathname;
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
 if(pathname==='/'||pathname==='/benchmark.html'){res.setHeader('Content-Type','text/html');res.end(pageSource);return;}
 const name=path.resolve(root,'.'+decodeURIComponent(pathname));if(!name.startsWith(root+'/'))throw Error('path');
 const type=name.endsWith('.js')||name.endsWith('.mjs')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.wav')?'audio/wav':'application/octet-stream';
 res.setHeader('Content-Type',type);res.end(await fs.readFile(name));
 }catch(e){res.writeHead(404);res.end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage();const logs=[];
page.on('console',m=>logs.push(m.type()+': '+m.text()));page.on('pageerror',e=>logs.push('PAGE ERROR '+e.stack));
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/benchmark.html');
 await page.waitForFunction(()=>typeof window.run==='function');
 const result=await page.evaluate(()=>window.run());
 result.browser=browser.version();await fs.writeFile(path.join(here,mode+'-acid40.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(e){console.error(e);process.exitCode=1;}
finally{await fs.writeFile(path.join(here,mode+'-console.log'),logs.join('\n'));await browser.close();await new Promise(r=>server.close(r));}
