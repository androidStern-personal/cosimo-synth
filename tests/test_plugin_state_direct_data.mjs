import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {setImmediate} from 'node:timers/promises';
import {loadUIModule} from '../kit/tests/helpers/load_ui_module.mjs';

const source=process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
assert.ok(source,'Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the authored Cmajor checkout');
const {createSharedDataMemory,createSharedDataPreparation,createSharedDataReader}=await import(pathToFileURL(path.join(source,'javascript/cmaj_api/cmaj-shared-data.js')));
const {createDirectDataPort}=await loadUIModule(path.resolve(import.meta.dirname,'..'),'kit/ui/plugin-state-direct-data.ts');

function cancellation() {
    let aborted=false;const listeners=new Set();
    return {signal:{get aborted(){return aborted;},onAbort(fn){if(aborted)fn();else listeners.add(fn);return()=>listeners.delete(fn);}},
        cancel(){aborted=true;for(const fn of [...listeners])fn();listeners.clear();}};
}
function fixture() {
    const memory=new WebAssembly.Memory({initial:2,maximum:4,shared:true});
    const host=createSharedDataMemory({memory,programBytes:65536,inputCount:2,maxRetainedBytes:64});
    const listeners=new Set(),scope={owner:'direct-worker',document:1};
    const preparation=createSharedDataPreparation(host,2,{scope:()=>scope,reply:body=>{for(const fn of [...listeners])fn(body);}});
    const reader=createSharedDataReader(host.readerConfiguration);
    const port=createDirectDataPort({sharedData:preparation.api,
        addEventListener(type,fn){assert.equal(type,'kit_data');listeners.add(fn);},
        removeEventListener(type,fn){assert.equal(type,'kit_data');listeners.delete(fn);},
        sendMessageToServer(){assert.fail('Direct sample contents must not use upload messages.');},
    });
    let generation=0;
    function submit(input,values,job=cancellation()) {
        const outcome=port.prepare({input,byteLength:values.length*4},{scope,key:`input${input}`,generation:++generation},job.signal,destination=>{
            assert.equal(destination.buffer,memory.buffer,'prepare must write the host allocation');
            new Float32Array(destination.buffer,destination.byteOffset,values.length).set(values);
        });
        return {outcome,...job};
    }
    function render(input,count) {
        reader.beginBlock();
        const result=Array.from(new Float32Array(memory.buffer,reader.address(input),count));
        reader.endBlock();preparation.drain();return result;
    }
    return {host,memory,submit,render,close(){port.stop();preparation.stop();host.stop();assert.equal(host.retainedBytes,0);assert.equal(listeners.size,0);}};
}

test('real shared storage preserves active A, cancels submitted B, then adopts complete C with per-input receipts',async()=>{
    const f=fixture();
    try {
        const a=f.submit(0,[1,2,3,4]);await setImmediate();assert.deepEqual(f.render(0,4),[1,2,3,4]);assert.equal((await a.outcome).kind,'acknowledged');
        const other=f.submit(1,[9]);await setImmediate();assert.deepEqual(f.render(1,1),[9]);assert.equal((await other.outcome).kind,'acknowledged','input1 serial1 differs from globalreservationid2');
        const b=f.submit(0,[20,30]);await setImmediate();b.cancel();assert.equal((await b.outcome).kind,'cancelled');
        assert.deepEqual(f.render(0,4),[1,2,3,4],'cancellation after commit must leave A audible');
        const c=f.submit(0,[5,6,7,8,9,10]);await setImmediate();assert.deepEqual(f.render(0,6),[5,6,7,8,9,10]);assert.equal((await c.outcome).kind,'acknowledged');
        assert.deepEqual(f.render(1,1),[9],'another resource must stay unchanged');
    } finally {f.close();}
});

test('budget refusal preserves audio and frees staging so a smaller subsequent edit succeeds',async()=>{
    const f=fixture();
    try {
        const a=f.submit(0,[1,2,3,4]);await setImmediate();f.render(0,4);await a.outcome;
        const tooLarge=f.submit(0,new Array(16).fill(7));assert.equal((await tooLarge.outcome).kind,'failed');
        assert.deepEqual(f.render(0,4),[1,2,3,4]);
        const next=f.submit(0,[0.5]);await setImmediate();assert.deepEqual(f.render(0,1),[0.5]);assert.equal((await next.outcome).kind,'acknowledged');
        assert.equal(f.host.retainedBytes,4,'old resource and refused staging must be released');
    } finally {f.close();}
});

for (const preparationKind of ['fixed', 'loaded']) test(`public ${preparationKind} preparation preserves audio, retries expected failures and isolates author defects`,async()=>{
    const root=path.resolve(import.meta.dirname,'..');
    const [{definePluginState,preparedState,preparationFailure,parameter},{sharedData},{createCmajorPluginStateService,createCmajorPluginStateClient},{PluginStateChannel}]=await Promise.all([
        loadUIModule(root,'kit/ui/plugin-state-definition.ts'),loadUIModule(root,'kit/ui/shared-data-delivery.ts'),
        loadUIModule(root,'kit/ui/plugin-state-cmajor.ts'),import(pathToFileURL(path.join(source,'javascript/cmaj_api/cmaj-plugin-state-channel.js'))),
    ]);
    const memory=new WebAssembly.Memory({initial:2,maximum:4,shared:true});
    const host=createSharedDataMemory({memory,programBytes:65536,inputCount:1,maxRetainedBytes:64});
    const reader=createSharedDataReader(host.readerConfiguration);
    let scope,channel,mode='ok';
    const defects=[],saved=new Map(),writes=[],views=new Set();
    const makePort=()=>{
        const listeners=new Map();
        const port={
            addEventListener(type,listener){const group=listeners.get(type)??new Set();group.add(listener);listeners.set(type,group);},
            removeEventListener(type,listener){listeners.get(type)?.delete(listener);},
            deliverMessageFromServer(envelope){for(const listener of [...(listeners.get(envelope.type)??[])])listener(envelope.message);},
            sendMessageToServer(envelope){assert.equal(envelope.type,'kit_state','no sample payload upload');channel.receive(port,envelope.message);},
        };
        return port;
    };
    const worker=makePort(),view=makePort();views.add(view);
    const preparation=createSharedDataPreparation(host,1,{scope:()=>scope,reply:body=>worker.deliverMessageFromServer({type:'kit_data',message:body})});
    worker.sharedData=preparation.api;
    let gain=1;
    channel=new PluginStateChannel(worker,async request=>{
        if(request.kind==='open'||request.kind==='restore'){
            scope=request.scope;
            return {parameters:[{endpoint:'gain',value:gain,min:0,max:10,step:1,defaultValue:1}]};
        }
        if(request.kind==='effect'){gain=request.operation.value;return {};}
        if(request.kind==='close')return {};
        if(request.kind==='read')return {value:gain};
        assert.fail(`Unexpected native request ${request.kind}`);
    },keys=>Object.fromEntries(keys.filter(key=>saved.has(key)).map(key=>[key,saved.get(key)])),
    (key,value)=>{saved.set(key,value);writes.push({key,value});},()=>views);
    const thrown=new Error('writer invariant violated');
    const codec={parse:value=>typeof value==='number'&&Number.isFinite(value)?{kind:'ok',value}:{kind:'error',message:'number required'},encode:value=>value,equals:Object.is};
    const held = new Map(), loadedWrites = [];
    function write(value,destination){
            assert.equal(destination.buffer,memory.buffer,'public writer must borrow the exact host allocation');
            destination[0]=value; // A partial write must never leak into the active resource on failure.
            if(mode==='missing')return preparationFailure('Source disappeared');
            if(mode==='throw')throw thrown;
            destination.fill(value);
    }
    const preparationOptions = preparationKind === 'fixed'
        ? {engine:sharedData({type:'float32',length:4}),prepare:write}
        : {engine:sharedData({type:'float32'}),async prepare(value,context){
            const metadata = await (mode==='held' ? new Promise(resolve=>held.set(value,{resolve,signal:context.signal})) : Promise.resolve({length:4,value}));
            if(mode==='load-throw')throw thrown;
            return {length:metadata.length,write(destination){loadedWrites.push(metadata.value);return write(metadata.value,destination);}};
        }};
    const definition=definePluginState({gain:parameter('gain'),curve:preparedState({codec,initial:1,...preparationOptions})},{memoryBudgetBytes:64});
    const service=createCmajorPluginStateService(definition,worker,{onDefect:error=>defects.push(error)});
    let client;
    const field=()=>client.getSnapshot().kind==='ready'?client.getSnapshot().state.fields.curve:undefined;
    const until=async predicate=>{const deadline=Date.now()+2000;while(!predicate()){assert.ok(Date.now()<deadline,'public stock state did not settle');await setImmediate();}};
    const render=()=>{reader.beginBlock();const data=Array.from(new Float32Array(memory.buffer,reader.address(0),4));reader.endBlock();preparation.drain();return data;};
    try {
        await service.start();
        client=createCmajorPluginStateClient(definition,view,{onDefect:error=>defects.push(error)});
        await until(()=>field()?.readiness.kind==='ready');await setImmediate();
        assert.deepEqual(render(),[1,1,1,1]);await until(()=>field()?.application?.kind==='acknowledged');
        mode='missing';
        assert.equal((await client.dispatch({kind:'edit',key:'curve',value:2})).kind,'accepted');
        await until(()=>field()?.application?.kind==='failed'&&field()?.persistence?.kind==='observed-in-native-state');
        assert.deepEqual(field().application,{kind:'failed',error:{kind:'resource',message:'Source disappeared'}});
        assert.deepEqual(render(),[1,1,1,1]);assert.equal(host.retainedBytes,16,'refused staging must be released');
        const version=field().version,history=client.getSnapshot().state.history,writeCount=writes.length;
        const retry={kind:'retry',key:'curve',expectedVersion:version,expectedGeneration:field().target.generation,expectedPersistenceRequest:null};
        mode='ok';assert.equal((await client.dispatch(retry)).kind,'accepted');await setImmediate();
        assert.deepEqual(render(),[2,2,2,2]);await until(()=>field()?.application?.kind==='acknowledged');
        assert.equal(field().version,version);assert.deepEqual(client.getSnapshot().state.history,history);assert.equal(writes.length,writeCount);
        assert.equal((await client.dispatch(retry)).kind,'rejected','obsolete retry cannot publish again');
        assert.equal((await client.dispatch({kind:'edit',key:'gain',value:3})).kind,'accepted','resource failure did not close the state owner');
        mode='throw';assert.equal((await client.dispatch({kind:'edit',key:'curve',value:4})).kind,'accepted');
        await until(()=>field()?.application?.kind==='failed'&&field()?.application?.error.kind==='defect');
        assert.deepEqual(defects,[thrown],'unexpected writer failure retains its original diagnostic');
        assert.equal(client.getSnapshot().kind,'ready','an author preparation defect does not close unrelated fields');
        assert.equal((await client.dispatch({kind:'edit',key:'gain',value:5})).kind,'accepted');
        assert.equal((await client.dispatch({kind:'retry',key:'curve',expectedVersion:field().version,
            expectedGeneration:field().target.generation,expectedPersistenceRequest:null})).kind,'rejected','a preparation defect cannot be automatically retried');
        assert.deepEqual(render(),[2,2,2,2]);assert.equal(host.retainedBytes,16);
        if(preparationKind==='loaded'){
            mode='load-throw';assert.equal((await client.dispatch({kind:'edit',key:'curve',value:6})).kind,'accepted');
            await until(()=>field()?.application?.kind==='failed'&&defects.length===2);
            assert.deepEqual(defects,[thrown,thrown]);assert.equal(field().application.error.kind,'defect');
            mode='held';assert.equal((await client.dispatch({kind:'edit',key:'curve',value:7})).kind,'accepted');await until(()=>held.has(7));
            assert.equal((await client.dispatch({kind:'edit',key:'curve',value:8})).kind,'accepted');await until(()=>held.has(8));
            assert.equal(held.get(7).signal.aborted,true,'superseded source work owns a revoked lifetime');
            mode='ok';held.get(8).resolve({length:4,value:8});await setImmediate();
            assert.deepEqual(render(),[8,8,8,8]);await until(()=>field()?.application?.kind==='acknowledged');
            const count=loadedWrites.length;held.get(7).resolve({length:4,value:7});await setImmediate();
            assert.equal(loadedWrites.length,count,'a late source must never receive a final allocation');
            assert.deepEqual(render(),[8,8,8,8]);assert.equal(host.retainedBytes,16);
        }
    } finally {client?.stop();await service.stop();channel.close();preparation.stop();host.stop();assert.equal(host.retainedBytes,0);}
});
