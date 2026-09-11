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
const {createSharedDataMemory,createSharedDataReader}=await api('cmaj-shared-data.js');
const {SharedDataTransferBridge}=await api('cmaj-shared-data-bridge.js');
const {createSharedDataPort}=await loadUIModule(root,'kit/ui/plugin-state-shared-data-port.ts');
const {createCmajorPluginStateService}=await loadUIModule(root,'kit/ui/plugin-state-cmajor.ts');
const {definePluginState,preparedState}=await loadUIModule(root,'kit/ui/plugin-state-definition.ts');
const scope={owner:'data-test',document:1};
function setup({drop=()=>false,timeoutMs=1000}={}) {
    const memory=new WebAssembly.Memory({initial:2,maximum:8,shared:true});
    const host=createSharedDataMemory({memory,programBytes:65536,inputCount:1,maxRetainedBytes:131072});
    const reader=createSharedDataReader(host.readerConfiguration),listeners=new Set();
    const messages=[];
    const bridge=new SharedDataTransferBridge({host,inputCount:1,isAuthorised:s=>s.owner===scope.owner&&s.document===scope.document,
        reply(body){if(!drop(body)) for(const receive of listeners)receive(body);}});
    const connection={
        addEventListener(type,receive){assert.equal(type,'kit_data');listeners.add(receive);},
        removeEventListener(type,receive){assert.equal(type,'kit_data');listeners.delete(receive);},
        sendMessageToServer(envelope){assert.equal(envelope.type,'kit_data');messages.push(envelope.message);bridge.receive(envelope.message);},
    };
    const port=createSharedDataPort(connection,{timeoutMs});
    function render(){reader.beginBlock();reader.endBlock();bridge.drain();}
    function job(generation){const callbacks=new Set();let aborted=false;return {
        target:{scope,key:'curve',generation},signal:{get aborted(){return aborted;},onAbort(cb){callbacks.add(cb);return()=>callbacks.delete(cb);}},
        cancel(){aborted=true;for(const cb of callbacks)cb();},
    };}
    return {host,port,connection,render,messages,job,inject(body){for(const receive of listeners)receive(body);},close(){port.stop();bridge.revoke();host.stop();assert.equal(listeners.size,0);}};
}
test('stock port transfers a large value through the real bridge and waits for audio adoption',async()=>{
    const f=setup();
    try {
        const job=f.job(1),samples=Float32Array.from({length:20000},(_,i)=>i/32768);
        let completed=false;
        const result=f.port.replace(0,samples,job.target,job.signal).then(value=>{completed=true;return value;});
        await setImmediate();
        assert.equal(completed,false);
        const writes=f.messages.filter(x=>x.kind==='write');
        assert.deepEqual(writes.map(x=>x.samples.length),[8192,8192,3616]);
        assert.deepEqual(writes.flatMap(x=>x.samples),Array.from(samples));
        f.render();assert.equal((await result).kind,'acknowledged');
        assert.equal(f.host.retainedBytes,samples.byteLength);
    } finally {f.close();}
});

test('a reply for the wrong transfer cannot claim audio adoption',async()=>{
    const f=setup();
    try {
        const job=f.job(1),result=f.port.replace(0,new Float32Array([0.25]),job.target,job.signal);
        await setImmediate();
        const commit=f.messages.find(x=>x.kind==='commit');assert.ok(commit);
        f.inject({kind:'applied',scope,request:commit.request,transfer:999,input:999,generation:999});
        assert.equal((await result).kind,'failed');
        assert.equal(f.host.retainedBytes,0,'false evidence must cancel the still-pending audio replacement');
    } finally {f.close();}
});

for(const lost of ['written','applied']) test(`a lost ${lost} reply does not strand the port or poison the next update`,async()=>{
    let lose=true;
    const f=setup({drop:body=>lose&&body.kind===lost,timeoutMs:15});
    try {
        const first=f.job(1),old=f.port.replace(0,new Float32Array([0.25]),first.target,first.signal);
        await setImmediate();f.render();
        assert.equal((await old).kind,'failed');
        assert.equal(f.host.retainedBytes,lost==='applied'?4:0);
        lose=false;
        const next=f.job(2),result=f.port.replace(0,new Float32Array([0.75]),next.target,next.signal);
        await setImmediate();
        // An obsolete receipt for the previous operation must not settle this one.
        const previous=f.messages.find(x=>x.kind==='begin');
        f.inject({kind:'applied',scope,request:previous.request,transfer:1,input:0,generation:1});
        f.render();assert.equal((await result).kind,'acknowledged');assert.equal(f.host.retainedBytes,4);
    } finally {f.close();}
});

test('stopping during an unanswered begin cancels resources and detaches the listener',async()=>{
    const f=setup({drop:body=>body.kind==='ready'});
    try {
        const job=f.job(1),result=f.port.replace(0,new Float32Array(4096),job.target,job.signal);
        f.port.stop();assert.equal((await result).kind,'cancelled');assert.equal(f.host.retainedBytes,0);
    } finally {f.close();}
});

test('a custom delivery cannot leave background data work alive after its apply call ends',async()=>{
    const f=setup(),stateListeners=new Set(),defects=[];
    // Only native saved-state/open replies are controlled here. The edit service,
    // delivery port, shared memory bridge and storage are production modules.
    const connection={
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
        eventEndpoints:[],dataInputs:[0],create:()=>({
            async apply(samples,context){background=context.replaceData(0,samples);return {kind:'unconfirmed'};},stop(){},
        }),
    }})});
    const service=createCmajorPluginStateService(definition,connection,{onDefect:error=>defects.push(error)});
    try {
        await service.start();await setImmediate();
        assert.equal(f.host.retainedBytes,0,'ending apply releases its unpublished data request');
        assert.equal((await background).kind,'cancelled');assert.deepEqual(defects,[]);
    } finally {await service.stop();f.close();}
});
test('a lost begin reply times out and releases staging without closing unrelated state',async()=>{
    const f=setup({drop:body=>body.kind==='ready',timeoutMs:10});
    try {
        const job=f.job(1);
        const result=await f.port.replace(0,new Float32Array(4096),job.target,job.signal);
        assert.equal(result.kind,'failed');assert.equal(result.error.kind,'transport');
        assert.equal(f.host.retainedBytes,0,'timeout cancels the allocation even when transfer id never arrived');
    } finally {f.close();}
});
test('cancellation before a begin reply cannot leave a transfer behind or affect its replacement',async()=>{
    let loseFirst=true;
    const f=setup({drop:body=>body.kind==='ready'&&loseFirst});
    try {
        const first=f.job(1),second=f.job(2);
        const old=f.port.replace(0,new Float32Array(4096),first.target,first.signal);
        first.cancel();assert.equal((await old).kind,'cancelled');assert.equal(f.host.retainedBytes,0);
        loseFirst=false;
        const current=f.port.replace(0,new Float32Array([0.25]),second.target,second.signal);
        await setImmediate();f.render();assert.equal((await current).kind,'acknowledged');
        assert.equal(f.host.retainedBytes,4);
    } finally {f.close();}
});
