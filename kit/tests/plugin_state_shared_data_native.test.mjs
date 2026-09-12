import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setImmediate } from 'node:timers/promises';
import { loadUIModule } from './helpers/load_ui_module.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const source=process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
assert.ok(source,'Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the authored Cmajor checkout');
const api=file=>import(pathToFileURL(path.join(source,'javascript/cmaj_api',file)).href);
const {createSharedDataMemory,createSharedDataReader,createSharedDataPreparation}=await api('cmaj-shared-data.js');
const {createDirectDataPort}=await loadUIModule(root,'kit/ui/plugin-state-direct-data.ts');
const {createCmajorPluginStateService}=await loadUIModule(root,'kit/ui/plugin-state-cmajor.ts');
const {definePluginState,preparedState}=await loadUIModule(root,'kit/ui/plugin-state-definition.ts');
const scope={owner:'data-test',document:1};
function setup({drop=()=>false,timeoutMs=1000}={}) {
    const memory=new WebAssembly.Memory({initial:2,maximum:8,shared:true});
    const host=createSharedDataMemory({memory,programBytes:65536,inputCount:1,maxRetainedBytes:131072});
    const reader=createSharedDataReader(host.readerConfiguration),listeners=new Set();
    const messages=[];
    const preparation=createSharedDataPreparation(host,1,{scope:()=>scope,
        reply(body){if(!drop(body))for(const receive of listeners)receive(body);}});
    const storage={
        reserve(input,bytes){const destination=preparation.api.reserve(input,bytes);messages.push({kind:'reserve',id:destination.id,input});return destination;},
        async commit(id){const receipt=await preparation.api.commit(id);messages.push({kind:'commit',...receipt});return drop({kind:'submitted'})?new Promise(()=>{}):receipt;},
        cancel(id){messages.push({kind:'cancel',id});return preparation.api.cancel(id);},
    };
    const connection={sharedData:storage,
        addEventListener(type,receive){assert.equal(type,'kit_data');listeners.add(receive);},
        removeEventListener(type,receive){assert.equal(type,'kit_data');listeners.delete(receive);},
        sendMessageToServer(){assert.fail('Direct data preparation must not send sample upload messages');},
    };
    const port=createDirectDataPort(connection,{timeoutMs});
    function render(){reader.beginBlock();const values=Array.from(new Float32Array(memory.buffer,reader.address(0),reader.size(0)/4));reader.endBlock();preparation.drain();return values;}
    function replace(samples,job){return port.prepare({input:0,byteLength:samples.byteLength},job.target,job.signal,destination=>{
        assert.equal(destination.buffer,memory.buffer,'the author writer receives the same allocation used by the actual audio reader');
        new Float32Array(destination.buffer,destination.byteOffset,samples.length).set(samples);
    });}
    function job(generation){const callbacks=new Set();let aborted=false;return {
        target:{scope,key:'curve',generation},signal:{get aborted(){return aborted;},onAbort(cb){callbacks.add(cb);return()=>callbacks.delete(cb);}},
        cancel(){aborted=true;for(const cb of callbacks)cb();},
    };}
    return {host,port,connection,render,messages,job,replace,inject(body){for(const receive of listeners)receive(body);},close(){port.stop();preparation.stop();host.stop();assert.equal(listeners.size,0);}};
}
test('direct port writes a large value into actual shared memory and waits for audio adoption',async()=>{
    const f=setup();
    try {
        const job=f.job(1),samples=Float32Array.from({length:20000},(_,i)=>i/32768);
        let completed=false;
        const result=f.replace(samples,job).then(value=>{completed=true;return value;});
        await setImmediate();
        assert.equal(completed,false);
        assert.equal(f.messages.filter(x=>x.kind==='reserve').length,1,'one final allocation replaces all chunk messages');
        assert.equal(f.messages.some(x=>Object.hasOwn(x,'samples')),false);
        assert.deepEqual(f.render(),Array.from(samples),'all prepared samples are consumed through the actual shared reader');
        assert.equal((await result).kind,'acknowledged');
        assert.equal(f.host.retainedBytes,samples.byteLength);
    } finally {f.close();}
});

test('a reply for the wrong transfer cannot claim audio adoption',async()=>{
    const f=setup({timeoutMs:15});
    try {
        const job=f.job(1),result=f.replace(new Float32Array([0.25]),job);
        await setImmediate();
        const commit=f.messages.find(x=>x.kind==='submitted');assert.ok(commit);
        f.inject({kind:'applied',scope,id:commit.id,input:999,generation:999,serial:999});
        assert.equal((await result).kind,'failed');
        assert.equal(f.host.retainedBytes,0,'false evidence must cancel the still-pending audio replacement');
    } finally {f.close();}
});

for(const lost of ['submitted','applied']) test(`a lost ${lost} reply does not strand the port or poison the next update`,async()=>{
    let lose=true;
    const f=setup({drop:body=>lose&&body.kind===lost,timeoutMs:15});
    try {
        const first=f.job(1),old=f.replace(new Float32Array([0.25]),first);
        await setImmediate();if(lost==='applied')f.render();
        assert.equal((await old).kind,'failed');
        assert.equal(f.host.retainedBytes,lost==='applied'?4:0);
        lose=false;
        const next=f.job(2),result=f.replace(new Float32Array([0.75]),next);
        await setImmediate();
        // An obsolete receipt for the previous operation must not settle this one.
        const previous=f.messages.find(x=>x.kind==='reserve');
        f.inject({kind:'applied',scope,id:previous.id,input:0,generation:previous.id,serial:1});
        f.render();assert.equal((await result).kind,'acknowledged');assert.equal(f.host.retainedBytes,4);
    } finally {f.close();}
});

test('stopping during an unanswered submission cancels resources and detaches the listener',async()=>{
    const f=setup({drop:body=>body.kind==='submitted'});
    try {
        const job=f.job(1),result=f.replace(new Float32Array(4096),job);
        f.port.stop();assert.equal((await result).kind,'cancelled');assert.equal(f.host.retainedBytes,0);
    } finally {f.close();}
});

test('a custom delivery cannot leave background data work alive after its apply call ends',async()=>{
    const f=setup(),stateListeners=new Set(),defects=[];
    // Only native saved-state/open replies are controlled here. The edit service,
    // delivery port, shared memory bridge and storage are production modules.
    const connection={sharedData:f.connection.sharedData,
        addEventListener(type,receive){if(type==='kit_state')stateListeners.add(receive);else f.connection.addEventListener(type,receive);},
        removeEventListener(type,receive){if(type==='kit_state')stateListeners.delete(receive);else f.connection.removeEventListener(type,receive);},
        sendMessageToServer(envelope){
            if(envelope.type==='kit_data')return f.connection.sendMessageToServer(envelope);
            const body=envelope.message;
            if(body.kind==='open')for(const receive of stateListeners)receive({kind:'opened',request:body.request,scope,native:{parameters:[],values:{shape:[0,1]}}});
        },
    };
    let background;
    const codec={parse:value=>({kind:'ok',value:Object.freeze([...value])}),encode:value=>[...value],equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b)};
    const definition=definePluginState({shape:preparedState({codec,initial:[0,1],prepare:value=>new Float32Array(value),engine:{
        eventEndpoints:[],dataInputs:[0],create:document=>({
            async apply(samples,context){background=document.prepareData(0,samples.byteLength,destination=>new Float32Array(destination.buffer,destination.byteOffset,samples.length).set(samples),context.signal);return {kind:'unconfirmed'};},stop(){},
        }),
    }})});
    const service=createCmajorPluginStateService(definition,connection,{onDefect:error=>defects.push(error)});
    try {
        await service.start();await setImmediate();
        assert.equal(f.host.retainedBytes,0,'ending apply releases its unpublished data request');
        assert.equal((await background).kind,'cancelled');assert.deepEqual(defects,[]);
    } finally {await service.stop();f.close();}
});
test('a lost submission receipt times out and releases staging without closing unrelated state',async()=>{
    const f=setup({drop:body=>body.kind==='submitted',timeoutMs:10});
    try {
        const job=f.job(1);
        const result=await f.replace(new Float32Array(4096),job);
        assert.equal(result.kind,'failed');assert.equal(result.error.kind,'resource');
        assert.equal(f.host.retainedBytes,0,'timeout cancels the allocation even when submission receipt never arrived');
    } finally {f.close();}
});
test('cancellation before a submission receipt cannot leave a transfer behind or affect its replacement',async()=>{
    let loseFirst=true;
    const f=setup({drop:body=>body.kind==='submitted'&&loseFirst});
    try {
        const first=f.job(1),second=f.job(2);
        const old=f.replace(new Float32Array(4096),first);
        first.cancel();assert.equal((await old).kind,'cancelled');assert.equal(f.host.retainedBytes,0);
        loseFirst=false;
        const current=f.replace(new Float32Array([0.25]),second);
        await setImmediate();f.render();assert.equal((await current).kind,'acknowledged');
        assert.equal(f.host.retainedBytes,4);
    } finally {f.close();}
});
