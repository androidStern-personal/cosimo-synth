import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { setImmediate } from 'node:timers/promises';

const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
assert.ok(source, 'Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the authored Cmajor checkout');
const apiURL = pathToFileURL(path.join(source, 'javascript/cmaj_api/cmaj-shared-data.js')).href;
const { createSharedDataMemory, createSharedDataReader } = await import(apiURL);
const { compileSharedDataReader } = await import(pathToFileURL(path.join(source, 'javascript/cmaj_api/cmaj-shared-data-reader.js')).href);
const readerModule = await compileSharedDataReader();

test('sample accessors are validated and captured once into unpublished memory', () => {
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 4, shared: true });
    const host = createSharedDataMemory({ memory, programBytes: 65536, inputCount: 1, maxRetainedBytes: 65536 });
    const reader = createSharedDataReader(host.readerConfiguration);
    const wasm = new WebAssembly.Instance(readerModule, { env: {
        memory,
        descriptorBase: new WebAssembly.Global({ value: 'i32', mutable: true }, host.readerConfiguration.descriptorBase),
        inputCount: new WebAssembly.Global({ value: 'i32', mutable: true }, 1),
    } }).exports;
    try {
        const resource = host.reserve(1).resource;
        let firstRead = true;
        const values = [0];
        Object.defineProperty(values, 0, { get() { if (firstRead) { firstRead = false; return 0.25; } return NaN; } });
        assert.equal(host.write(resource, 0, values).kind, 'written');
        assert.equal(host.submit(host.beginRequest(0, 1).ticket, resource).kind, 'accepted');
        host.release(resource);
        reader.beginBlock();
        assert.equal(wasm.read(0, 0), 0.25, 'the value validated must be the value captured');
        reader.endBlock();
        host.drain();
    } finally { reader.endBlock(); host.stop(); }
});

test('a freely running Worker validates every sample while control cancels, grows and reuses storage', { timeout: 20000 }, async t => {
    const inputCount = 3, budget = 256 * 1024;
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 8, shared: true });
    new Uint8Array(memory.buffer, 0, 65536).fill(0x57);
    const host = createSharedDataMemory({ memory, programBytes: 65536, inputCount, maxRetainedBytes: budget });
    const state = new Int32Array(new SharedArrayBuffer(8));
    const worker = new Worker(`
        const {parentPort,workerData}=require('node:worker_threads');
        (async () => {
            const {createSharedDataReader}=await import(workerData.apiURL);
            const reader=createSharedDataReader(workerData.configuration);
            const {memory,descriptorBase,inputCount}=workerData.configuration;
            const wasm=new WebAssembly.Instance(workerData.readerModule,{env:{memory,
                descriptorBase:new WebAssembly.Global({value:'i32',mutable:true},descriptorBase),
                inputCount:new WebAssembly.Global({value:'i32',mutable:true},inputCount)}}).exports;
            const state=new Int32Array(workerData.state);
            const descriptors=new Uint32Array(memory.buffer,descriptorBase,inputCount*2);
            const previous=new Array(inputCount).fill(0),adoptions=[];
            let blocks=0,checkedSamples=0;
            parentPort.postMessage({kind:'ready'});
            // No per-block messages, waits or control-issued render commands.
            while(Atomics.load(state,0)===0) {
                reader.beginBlock();
                for(let input=0;input<inputCount;input++) {
                    const count=wasm.size(input);
                    if(count===0)continue;
                    const version=wasm.read(input,0);
                    if(!Number.isInteger(version)||version<1||count!==4097+(version%7)*257)
                        throw Error('Invalid version/length '+JSON.stringify({input,version,count,blocks}));
                    if(version!==previous[input]) {
                        adoptions.push({input,generation:version,offset:descriptors[input*2]});
                        previous[input]=version;
                    }
                    // Independent arithmetic oracle, never a copy of the resource.
                    for(let pass=0;pass<2;pass++)for(let index=0;index<count;index++) {
                        const expected=index===0?version:((version*17+index*31)%4096)/4096-0.5;
                        const actual=wasm.read(input,index);
                        if(!Number.isFinite(actual)||actual!==expected)
                            throw Error('Sample mismatch '+JSON.stringify({input,version,index,expected,actual,blocks}));
                        checkedSamples++;
                    }
                    if(wasm.read(input,-1)!==0||wasm.read(input,count)!==0)throw Error('Bounds failure');
                }
                reader.endBlock();
                Atomics.store(state,1,++blocks);
            }
            parentPort.postMessage({kind:'finished',adoptions,blocks,checkedSamples});
        })().catch(error=>parentPort.postMessage({kind:'failed',error:String(error)}));
    `, { eval: true, workerData: { apiURL, configuration: host.readerConfiguration, readerModule, state: state.buffer } });
    let failure;
    const ready = new Promise((resolve, reject) => {
        worker.once('error', reject);
        worker.on('message', message => {
            if (message.kind === 'ready') resolve();
            if (message.kind === 'failed') { failure = message.error; reject(new Error(failure)); }
        });
    });
    const finished = new Promise((resolve, reject) => {
        worker.once('error', reject);
        worker.on('message', message => {
            if (message.kind === 'finished') resolve(message);
            if (message.kind === 'failed') { failure = message.error; reject(new Error(failure)); }
        });
    });
    // Own rejection immediately, including failures before the final await.
    finished.catch(() => {});
    const accepted = new Map(), receipts = new Map();
    let cancellationAttempts = 0, highestRetained = 0;
    const key = value => value.input + ':' + value.generation;
    function drain() {
        for (const receipt of host.drain()) {
            assert.equal(receipt.serial, accepted.get(key(receipt)), 'receipt must name an accepted ticket');
            assert.ok(!receipts.has(key(receipt)), 'receipt cannot repeat');
            receipts.set(key(receipt), receipt);
        }
        highestRetained = Math.max(highestRetained, host.retainedBytes);
        assert.ok(host.retainedBytes <= budget);
        if (failure) throw new Error(failure);
    }
    async function install(version, input, cancel = false) {
        const samples = new Float32Array(4097 + (version % 7) * 257);
        for (let index = 0; index < samples.length; index++)
            samples[index] = index === 0 ? version : ((version * 17 + index * 31) % 4096) / 4096 - 0.5;
        const created = host.createResource(samples);
        assert.equal(created.kind, 'ready');
        const requested = host.beginRequest(input, version);
        assert.equal(requested.kind, 'ready');
        const ticket = requested.ticket;
        const deadline = Date.now() + 5000;
        while (true) {
            drain();
            const result = host.submit(ticket, created.resource);
            if (result.kind === 'accepted') break;
            assert.equal(result.kind, 'busy');
            assert.ok(Date.now() < deadline, 'audio worker must continue to advance');
            await setImmediate();
        }
        accepted.set(key(ticket), ticket.serial);
        host.release(created.resource);
        if (cancel) { host.cancel(ticket); ++cancellationAttempts; }
        drain();
        return ticket;
    }
    try {
        await ready;
        let oldTicket;
        for (let version = 1; version <= 240; version++) {
            const previousBlock = Atomics.load(state, 1);
            if (oldTicket && receipts.has(key(oldTicket))) host.cancel(oldTicket); // Already-receipted cleanup cannot revoke newer data.
            oldTicket = await install(version, (version - 1) % inputCount, version % 5 === 0);
            if (version % 6 === 0) {
                const deadline = Date.now() + 5000;
                while (Atomics.load(state, 1) === previousBlock) {
                    drain();
                    assert.ok(Date.now() < deadline, 'freely running audio must make progress');
                    await setImmediate();
                }
            }
        }
        const finalTickets = [];
        for (let input = 0; input < inputCount; input++) finalTickets.push(await install(1001 + input, input));
        const deadline = Date.now() + 5000;
        while (finalTickets.some(ticket => !receipts.has(key(ticket)))) {
            drain();
            assert.ok(Date.now() < deadline, 'final accepted resources must be adopted');
            await setImmediate();
        }
        Atomics.store(state, 0, 1);
        const evidence = await finished;
        drain();
        assert.ok(evidence.blocks > 10 && evidence.checkedSamples > 100000);
        assert.ok(cancellationAttempts > 0);
        assert.deepEqual([...receipts.keys()].sort(), evidence.adoptions.map(key).sort(), 'receipts match actual reader adoptions exactly');
        assert.ok(evidence.adoptions.length > 30, 'exercise repeated actual replacements');
        assert.ok(new Set(evidence.adoptions.map(a => a.offset)).size < evidence.adoptions.length / 2, 'retired offsets are reused');
        assert.ok(memory.buffer.byteLength > 2 * 65536, 'resource loading must grow shared memory');
        assert.ok(new Uint8Array(memory.buffer, 0, 65536).every(value => value === 0x57));
        t.diagnostic(JSON.stringify({ blocks: evidence.blocks, checkedSamples: evidence.checkedSamples,
            adopted: evidence.adoptions.length, accepted: accepted.size, cancellationAttempts,
            highestRetained, allocatedBytes: host.allocatedBytes, memoryBytes: memory.buffer.byteLength }));
    } finally {
        Atomics.store(state, 0, 1);
        await worker.terminate();
        host.stop();
        assert.equal(host.retainedBytes, 0);
    }
});
