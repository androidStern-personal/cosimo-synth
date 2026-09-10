import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
assert.ok(source, 'Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the authored Cmajor checkout');
const moduleURL = pathToFileURL(path.join(source, 'javascript/cmaj_api/cmaj-shared-data.js')).href;
const { createSharedDataMemory } = await import(moduleURL);
const { compileSharedDataReader } = await import(pathToFileURL(path.join(source, 'javascript/cmaj_api/cmaj-shared-data-reader.js')).href);
const readerModule = await compileSharedDataReader();

function open(maxRetainedBytes=64*1024) {
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 16, shared: true });
    new Uint8Array(memory.buffer, 0, 65536).fill(73);
    const host = createSharedDataMemory({memory, programBytes:65536, inputCount:2, maxRetainedBytes});
    const worker = new Worker(`
        const {parentPort,workerData}=require('node:worker_threads');
        import(workerData.moduleURL).then(({createSharedDataReader})=>{
            const reader=createSharedDataReader(workerData.configuration);
            const wasm=new WebAssembly.Instance(workerData.readerModule,{env:{
                memory:workerData.configuration.memory,
                descriptorBase:new WebAssembly.Global({value:"i32",mutable:true},workerData.configuration.descriptorBase),
                inputCount:new WebAssembly.Global({value:"i32",mutable:true},workerData.configuration.inputCount),
            }}).exports;
            parentPort.on('message',({id,kind})=>{
                if(kind==='begin')reader.beginBlock();
                const values=[0,1].map(input=>Array.from({length:wasm.size(input)},(_,index)=>wasm.read(input,index)));
                if(kind==='end')reader.endBlock();
                parentPort.postMessage({id,values});
            }); parentPort.postMessage({id:0});
        });
    `,{eval:true,workerData:{moduleURL,configuration:host.readerConfiguration,readerModule}});
    let sequence=0;
    const ready=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
    async function command(kind) {
        await ready;const id=++sequence;
        return new Promise((resolve,reject)=>{
            const fail=error=>{worker.off('message',listener);reject(error);};
            const listener=result=>{if(result.id===id){worker.off('message',listener);worker.off('error',fail);resolve(result.values);}};
            worker.once('error',fail);worker.on('message',listener);worker.postMessage({id,kind});
        });
    }
    return {host,memory,command,close:async()=>{await worker.terminate();host.stop();}};
}

test('a real worker reads complete shared data; receipts wait for endBlock',async()=>{
    const {host,memory,command,close}=open();
    try {
        const a=Float32Array.from({length:257},(_,i)=>Math.fround((i-117)/512));
        const created=host.createResource(a);assert.equal(created.kind,'ready');
        const first=host.beginRequest(0,1);assert.equal(first.kind,'ready');
        assert.equal(host.submit(first.ticket,created.resource).kind,'accepted');host.release(created.resource);
        assert.deepEqual(await command('read'),[[],[]]);assert.deepEqual(host.drain(),[]);
        assert.deepEqual(await command('begin'),[Array.from(a),[]]);assert.deepEqual(host.drain(),[]);
        await command('end');assert.deepEqual(host.drain(),[{input:0,generation:1,serial:first.ticket.serial}]);
        assert.equal(host.retainedBytes,a.byteLength);
        assert.ok(new Uint8Array(memory.buffer,0,65536).every(x=>x===73),'DSP program region must be untouched');
    } finally {await close();}
    assert.equal(host.retainedBytes,0);
});

test('old, forged and already-used tickets cannot publish or acknowledge another replacement',async()=>{
    const {host,command,close}=open();
    try {
        const resource=host.createResource(new Float32Array([0.2,0.4])).resource;
        const old=host.beginRequest(0,1).ticket;
        const current=host.beginRequest(0,2).ticket;
        assert.equal(host.submit(old,resource).kind,'stale-ticket');
        assert.equal(host.submit({...current},resource).kind,'stale-ticket','matching fields do not grant ownership');
        assert.equal(host.submit(current,resource).kind,'accepted');
        await command('begin');await command('end');assert.equal(host.drain().length,1);
        assert.equal(host.submit(current,resource).kind,'stale-ticket','an acknowledged request is single-use');
        host.release(resource);
    } finally {await close();}
});

test('staged samples stay unpublished until complete, and submitted samples cannot be changed',async()=>{
    const {host,command,close}=open();
    try {
        const resource=host.reserve(4).resource,ticket=host.beginRequest(0,1).ticket;
        assert.equal(host.write(resource,0,[0.25,0.5]).kind,'written');
        assert.equal(host.submit(ticket,resource).kind,'incomplete');
        assert.deepEqual(await command('begin'),[[],[]]);await command('end');
        assert.equal(host.write(resource,3,[1]).kind,'invalid-write');
        assert.equal(host.write(resource,2,[Infinity,1]).kind,'invalid-write');
        assert.equal(host.write(resource,2,Array(2)).kind,'invalid-write','holes cannot introduce NaN');
        assert.equal(host.write(resource,2,[0.75,1]).kind,'written');
        assert.equal(host.submit(ticket,resource).kind,'accepted');
        assert.equal(host.write(resource,0,[9,9,9,9]).kind,'invalid-write');
        host.release(resource);
        assert.deepEqual(await command('begin'),[[0.25,0.5,0.75,1],[]]);await command('end');
        assert.equal(host.drain().length,1);
    } finally {await close();}
});

test('shared resources retire after the last reader switches and their storage is reused',async()=>{
    const {host,memory,command,close}=open(512*1024);
    try {
        const length=20000;
        const a=host.createResource(new Float32Array(length).fill(0.25)).resource;
        for(const input of [0,1]) assert.equal(host.submit(host.beginRequest(input,1).ticket,a).kind,'accepted');
        host.release(a);
        assert.equal(host.retainedBytes,length*4,'two inputs share one resource allocation');
        assert.deepEqual((await command('begin')).map(x=>[x.length,x[0],x.at(-1)]),[[length,0.25,0.25],[length,0.25,0.25]]);
        await command('end');assert.equal(host.drain().length,2);
        for(let iteration=0;iteration<20;iteration++) {
            const value=(iteration+2)/32;
            const b=host.createResource(new Float32Array(length).fill(value)).resource;
            for(const input of [0,1]) {
                assert.equal(host.submit(host.beginRequest(input,iteration+2).ticket,b).kind,'accepted');
                const heard=await command('begin');
                assert.ok(heard[input].every(x=>x===value),'the actual Wasm reader sees only the complete replacement');
                assert.deepEqual(host.drain(),[],'control cannot reclaim while audio owns this block');
                assert.equal(host.retainedBytes,length*8,'the previous reader allocation remains live until end and drain');
                await command('end');assert.equal(host.drain().length,1);
            }
            host.release(b);
            assert.equal(host.retainedBytes,length*4);
            assert.equal(host.allocatedBytes,length*8,'replacements reuse holes instead of growing indefinitely');
        }
        assert.equal(memory.buffer.byteLength,4*65536,'growth is bounded by the two live resources plus program storage');
        assert.ok(new Uint8Array(memory.buffer,0,65536).every(x=>x===73));
    } finally {await close();}
});

test('cancellation is exact, cannot revoke a newer request, and does not erase data already in use',async()=>{
    const {host,command,close}=open(16);
    try {
        const a=host.createResource(new Float32Array([0.25,0.5])).resource;
        const cancelled=host.beginRequest(0,1).ticket;
        host.submit(cancelled,a);host.release(a);
        host.cancel(cancelled);
        assert.equal(host.retainedBytes,0);
        assert.deepEqual(await command('begin'),[[],[]]);await command('end');assert.deepEqual(host.drain(),[]);
        const b=host.createResource(new Float32Array([0.75,1])).resource;
        const next=host.beginRequest(0,2).ticket;
        assert.equal(host.submit(next,b).kind,'accepted');host.release(b);
        host.cancel(cancelled);host.cancel({...next});
        assert.deepEqual(await command('begin'),[[0.75,1],[]]);
        host.cancel(next);
        assert.equal(host.retainedBytes,8,'cancelling cannot reclaim a resource that audio already uses');
        await command('end');host.drain();
        assert.deepEqual(await command('read'),[[0.75,1],[]]);
        assert.equal(host.createResource(new Float32Array(3)).kind,'budget-exceeded');
    } finally {await close();}
    assert.equal(host.beginRequest(0,1).kind,'stopped');
    assert.equal(host.reserve(1).kind,'stopped');
});

test('an empty resource clears an input and releases the previous allocation after adoption',async()=>{
    const {host,command,close}=open();
    try {
        const a=host.createResource(new Float32Array([1])).resource;
        host.submit(host.beginRequest(0,1).ticket,a);host.release(a);
        await command('begin');await command('end');host.drain();
        const clear=host.createResource(new Float32Array());assert.equal(clear.kind,'ready');
        host.submit(host.beginRequest(0,2).ticket,clear.resource);host.release(clear.resource);
        assert.deepEqual(await command('begin'),[[],[]]);assert.equal(host.retainedBytes,4);
        await command('end');assert.equal(host.drain().length,1);assert.equal(host.retainedBytes,0);
    } finally {await close();}
});

test('Wasm data reads reject invalid input, index and descriptor bounds without trapping',()=>{
    const memory=new WebAssembly.Memory({initial:1,maximum:2,shared:true});
    const base=64,descriptor=new Uint32Array(memory.buffer,base,2);
    const reader=new WebAssembly.Instance(readerModule,{env:{memory,
        descriptorBase:new WebAssembly.Global({value:'i32',mutable:true},base),
        inputCount:new WebAssembly.Global({value:'i32',mutable:true},1),
    }}).exports;
    descriptor.set([128,2]);new Float32Array(memory.buffer,128,2).set([0.25,0.75]);
    assert.equal(reader.read(0,1),0.75);
    for(const input of [-1,1,2147483647]) {assert.equal(reader.read(input,0),0);assert.equal(reader.size(input),0);}
    for(const index of [-1,2,2147483647]) assert.equal(reader.read(0,index),0);
    for(const values of [[129,2],[65532,2],[0xffffffff,1],[128,0xffffffff]]) {
        descriptor.set(values);assert.equal(reader.read(0,0),0);assert.equal(reader.size(0),0);
    }
});
