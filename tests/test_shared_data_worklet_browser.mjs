import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
assert.ok(source, 'Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the authored Cmajor checkout');
const generator = process.env.CMAJOR_SHARED_GENERATOR ?? path.resolve('build/shared_data_codegen/source/shared_memory_generator');
const directory = await mkdtemp(path.join(tmpdir(), 'cmajor-shared-worklet-'));
const generated = path.join(directory, 'generated.js');
execFileSync(generator, [path.join(source, 'tests/shared_memory_codegen/browser.cmajor'), generated,
    JSON.stringify({ SIMD: 'simd-only', sharedMemory: { maximumPages: 256 } })]);
for (const [fixture, filename, options] of [
    ['browser_history.cmajor', 'history.js', { SIMD:'simd-only', sharedMemory:{maximumPages:256} }],
    ['stock.cmajor', 'ordinary.js', { SIMD:'simd-only' }],
]) execFileSync(generator, [path.join(source, 'tests/shared_memory_codegen', fixture), path.join(directory, filename), JSON.stringify(options)]);
await writeFile(path.join(directory, 'worker.js'), `
export const replies = [];
export let connection, scope;
export default function start(worker) {
    connection = worker;
    worker.addEventListener('kit_state', message => { if (message.kind === 'opened' || message.kind === 'replaced') scope = message.scope; });
    worker.addEventListener('kit_data', message => replies.push(message));
    worker.sendMessageToServer({type:'kit_state',message:{kind:'open',request:1,parameters:[],storedKeys:[],eventEndpoints:[]}});
    return {stop() {}};
}
`);
await writeFile(path.join(directory, 'index.html'), `<!doctype html><button id="start">Start</button>
<script type="module">
import {AudioWorkletPatchConnection} from '/cmaj_api/cmaj-audio-worklet-helper.js';
import Probe from '/generated.js';
import HistoryProbe from '/history.js';
import OrdinaryProbe from '/ordinary.js';
import * as worker from '/worker.js';
document.querySelector('#start').onclick = async () => {
    try {
        const context = new AudioContext({sampleRate:48000});
        const connection = new AudioWorkletPatchConnection({worker:'worker.js',sharedData:{inputCount:2,maxRetainedBytes:1024*1024}});
        await connection.initialise({CmajorClass:Probe,audioContext:context,workletName:'shared-probe',rootResourcePath:location.origin+'/'});
        const capture = context.createScriptProcessor(256,1,1);
        const state = {context,connection,worker,capture,Probe,HistoryProbe,OrdinaryProbe,layouts:[],minimum:0,maximum:0,blocks:0};
        capture.onaudioprocess = event => { const values=event.inputBuffer.getChannelData(0);state.minimum=Math.min(...values);state.maximum=Math.max(...values);++state.blocks; };
        connection.audioNode.connect(capture);capture.connect(context.destination);
        await context.resume();
        window.fixture = state;
    } catch (error) { window.failure = String(error); }
};
</script>`);

const server = createServer(async (request, response) => {
    try {
        const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
        const filename = pathname.startsWith('/cmaj_api/')
            ? path.join(source, 'javascript/cmaj_api', pathname.slice('/cmaj_api/'.length))
            : path.join(directory, pathname === '/' ? 'index.html' : pathname.slice(1));
        assert.ok(!pathname.includes('..'));
        response.writeHead(200, {'content-type':filename.endsWith('.html')?'text/html':'text/javascript',
            'cross-origin-opener-policy':'same-origin','cross-origin-embedder-policy':'require-corp'});
        response.end(await readFile(filename));
    } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.click('#start');
    await page.waitForFunction(() => window.fixture || window.failure, null, {timeout:15000});
    assert.equal(await page.evaluate(() => window.failure), undefined);
    await page.waitForFunction(() => window.fixture.worker.scope);
    const request = async body => {
        await page.evaluate(body => {const w=window.fixture.worker;w.connection.sendMessageToServer({type:'kit_data',message:{scope:w.scope,...body}});}, body);
        await page.waitForFunction(request => window.fixture.worker.replies.some(r => r.request === request), body.request);
        return page.evaluate(request => window.fixture.worker.replies.find(r => r.request === request), body.request);
    };
    const ready = await request({kind:'begin',request:2,input:0,generation:1,sampleCount:4});
    assert.equal(ready.kind,'ready');
    const written = await request({kind:'write',request:3,transfer:ready.transfer,offset:0,samples:[0.75,0.5,0.25,0]});
    assert.equal(written.kind,'written');
    const applied = await request({kind:'commit',request:4,transfer:ready.transfer});
    assert.equal(applied.kind,'applied');
    await page.waitForFunction(() => window.fixture.minimum === 0.75 && window.fixture.maximum === 0.75);
    const forged = await page.evaluate(() => {const f=window.fixture;return f.connection.sendMessageToServer({type:'kit_data',message:{kind:'begin',request:9,scope:f.worker.scope,input:0,generation:2,sampleCount:1}});});
    assert.equal(forged,false,'ordinary view cannot use the worker data protocol');
    assert.deepEqual(errors,[]);
    assert.ok((await page.evaluate(() => window.fixture.connection.getSharedDataMemoryUsage())).ownedBytes > 0);
    await page.evaluate(async () => {const f=window.fixture;await f.context.suspend();await f.connection.dispose();f.capture.disconnect();f.disposed=[f.connection];});
    const released = await page.evaluate(() => window.fixture.connection.getSharedDataMemoryUsage());
    assert.equal(released.ownedBytes,0,'retaining a disposed connection must not retain its sample store');
    assert.equal(released.readerReleased,true,'the worklet must release its runtime closures before acknowledging stop');
    const requirements = await page.evaluate(() => [new window.fixture.Probe().getMemoryRequirements(),new window.fixture.HistoryProbe().getMemoryRequirements()]);
    assert.ok(requirements[1].minimumBytes - requirements[0].minimumBytes >= 256*1024,JSON.stringify(requirements));
    for (let iteration=0;iteration<8;iteration++) {
        await page.evaluate(async iteration => {
            const f=window.fixture;
            const next=new f.connection.constructor({worker:'worker.js',sharedData:{inputCount:2,maxRetainedBytes:1024*1024}});
            await next.initialise({CmajorClass:iteration%2?f.Probe:f.HistoryProbe,audioContext:f.context,workletName:'shared-replacement-'+iteration,rootResourcePath:location.origin+'/'});
            f.layouts.push(next.getSharedDataMemoryUsage().ownedBytes);
            f.disposed.push(next);
            f.replacement=next;
        },iteration);
        if(iteration===0) {
            await page.evaluate(async () => {const f=window.fixture;f.minimum=0;f.maximum=0;f.replacement.audioNode.connect(f.capture);f.capture.connect(f.context.destination);await f.context.resume();});
            const changedReady=await request({kind:'begin',request:20,input:0,generation:1,sampleCount:1});
            assert.equal(changedReady.kind,'ready');
            assert.equal((await request({kind:'write',request:21,transfer:changedReady.transfer,offset:0,samples:[0.75]})).kind,'written');
            assert.equal((await request({kind:'commit',request:22,transfer:changedReady.transfer})).kind,'applied');
            await page.waitForFunction(() => window.fixture.minimum===1.125 && window.fixture.maximum===1.125,null,{timeout:10000});
            await page.evaluate(async () => {const f=window.fixture;await f.context.suspend();f.capture.disconnect();});
        }
        await page.evaluate(() => window.fixture.replacement.dispose());
    }
    const layouts = await page.evaluate(() => window.fixture.layouts);
    assert.equal(new Set(layouts).size,2,'each compiler layout must allocate its own appropriately sized memory');
    assert.ok(layouts[0]>layouts[1]);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.collectGarbage');
    const ownership = await page.evaluate(() => window.fixture.disposed.map(connection => connection.getSharedDataMemoryUsage()));
    assert.ok(ownership.every(item => item.ownedBytes===0 && !item.memoryObjectAlive && item.readerReleased),JSON.stringify(ownership));
    await page.evaluate(async () => {
        const f=window.fixture;
        const ordinary=new f.connection.constructor({worker:'worker.js'});
        await ordinary.initialise({CmajorClass:f.OrdinaryProbe,audioContext:f.context,workletName:'ordinary-probe',rootResourcePath:location.origin+'/'});
        f.ordinary=ordinary;
    });
    await page.waitForFunction(() => window.fixture.worker.scope);
    const unavailable=await request({kind:'begin',request:100,input:0,generation:1,sampleCount:4});
    assert.equal(unavailable.kind,'failed');
    assert.equal(unavailable.reason,'shared-data-unavailable');
    assert.equal(await page.evaluate(() => window.fixture.ordinary.sendMessageToServer({type:'kit_data',message:{kind:'begin',request:101}})),false);
    await page.evaluate(async () => {await window.fixture.ordinary.dispose();await window.fixture.context.close();});
    console.log('PASS real AudioWorklet shared startup, private-worker transfer, reader Wasm output and suspended disposal');
    console.log('PASS ordinary worker receives immediate shared-data-unavailable failure');
    console.log('PASS retained AudioContext and nine retained disposed connections across two compiler layouts release main memory objects and worklet runtime ownership');
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    await rm(directory,{recursive:true,force:true});
}
