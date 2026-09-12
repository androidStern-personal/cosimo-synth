import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { build } from 'esbuild';

const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
assert.ok(source, 'Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the authored Cmajor checkout');
const generator = process.env.CMAJOR_SHARED_GENERATOR ?? path.resolve('build/shared_data_codegen/source/shared_memory_generator');
const directory = await mkdtemp(path.join(tmpdir(), 'cmajor-shared-worklet-'));
const generated = path.join(directory, 'generated.js');
await build({entryPoints:[path.resolve('kit/ui/prepared-shared-data.ts')],outfile:path.join(directory,'prepare.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
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
import {prepareSharedData} from '/prepare.js';
document.querySelector('#start').onclick = async () => {
    try {
        const context = new AudioContext({sampleRate:48000});
        const connection = new AudioWorkletPatchConnection({worker:'worker.js',sharedData:{inputCount:2,maxRetainedBytes:1024*1024}});
        await connection.initialise({CmajorClass:Probe,audioContext:context,workletName:'shared-probe',rootResourcePath:location.origin+'/'});
        const capture = context.createScriptProcessor(256,1,1);
        const state = {context,connection,worker,capture,Probe,HistoryProbe,OrdinaryProbe,prepareSharedData,layouts:[],minimum:0,maximum:0,blocks:0,
            editable:{level:0.75,falloff:0.25,pointCount:4},compileBlocks:null};
        capture.onaudioprocess = event => { const values=event.inputBuffer.getChannelData(0);state.minimum=Math.min(...values);state.maximum=Math.max(...values);++state.blocks;
            state.compileBlocks?.push([state.minimum,state.maximum]); };
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
    const submitted = await page.evaluate(async () => {
        const w=window.fixture.worker, storage=w.connection.sharedData;
        const destination=storage.reserve(0,16);
        const samples=new Float32Array(destination.buffer,destination.byteOffset,4);
        samples.set([0.75,0.5,0.25,0]);
        return {receipt:await storage.commit(destination.id),scope:w.scope,bytes:destination.byteLength};
    });
    assert.equal(submitted.bytes,16,'the private worker reserves the complete sample resource');
    assert.equal(submitted.receipt.kind,'submitted');
    await page.waitForFunction(({receipt,scope})=>window.fixture.worker.replies.some(reply=>reply.kind==='applied'
        &&reply.id===receipt.id&&reply.serial===receipt.serial&&reply.generation===receipt.generation
        &&reply.scope.owner===scope.owner&&reply.scope.document===scope.document),submitted);
    await page.waitForFunction(() => window.fixture.minimum === 0.75 && window.fixture.maximum === 0.75);
    const forged = await page.evaluate(async () => {
        const f=window.fixture;
        try {await f.prepareSharedData(f.connection,{input:0,byteLength:4},()=>{throw new Error('view unexpectedly received writable storage');});return {kind:'accepted'};}
        catch(error){return {kind:'rejected',message:String(error)};}
    });
    assert.equal(forged.kind,'rejected','ordinary view cannot obtain the worker writable capability');
    assert.match(forged.message,/does not support direct shared-data preparation/);
    assert.deepEqual(errors,[]);
    assert.ok((await page.evaluate(() => window.fixture.connection.getSharedDataMemoryUsage())).ownedBytes > 0);
    const editedSource = path.join(directory, 'edited.cmajor');
    const recoveredModule = path.join(directory, 'recovered.js');
    const correctedSource = await readFile(path.join(source, 'tests/shared_memory_codegen/browser_history.cmajor'), 'utf8');
    assert.ok(correctedSource.includes('out <- value + history[cursor] * 0.5f;'));
    await writeFile(editedSource, correctedSource.replace('out <- value + history[cursor] * 0.5f;', 'out <- ;'));
    await page.evaluate(() => {window.fixture.compileBlocks=[];});
    const rejectedCompile = spawnSync(generator, [editedSource, recoveredModule,
        JSON.stringify({SIMD:'simd-only',sharedMemory:{maximumPages:256}})], {encoding:'utf8',timeout:30000});
    assert.equal(rejectedCompile.error, undefined, 'compiler must run and reject the source itself');
    assert.equal(rejectedCompile.status, 2, 'invalid authored Cmajor must take the compiler source-parse failure path');
    assert.match(rejectedCompile.stdout+rejectedCompile.stderr, /edited\.cmajor/, 'the diagnostic identifies the edited source');
    assert.match(rejectedCompile.stdout+rejectedCompile.stderr, /error/i, 'failed compilation reports a source diagnostic');
    await page.waitForFunction(() => window.fixture.compileBlocks.length >= 3);
    assert.ok((await page.evaluate(() => window.fixture.compileBlocks)).every(block => block[0]===0.75 && block[1]===0.75),
        'the running program continues producing its old audio across the failed compile');
    await writeFile(editedSource, correctedSource);
    execFileSync(generator, [editedSource, recoveredModule, JSON.stringify({SIMD:'simd-only',sharedMemory:{maximumPages:256}})]);
    await page.evaluate(async () => {window.fixture.HistoryProbe=(await import('/recovered.js')).default;});
    const compileAudio = await page.evaluate(() => {const f=window.fixture;const blocks=f.compileBlocks;f.compileBlocks=null;return blocks;});
    assert.ok(compileAudio.every(block => block[0]===0.75 && block[1]===0.75),
        'correcting and compiling a different layout must also leave the old program audible until replacement');
    await page.evaluate(async () => {const f=window.fixture;await f.context.suspend();await f.connection.dispose();f.capture.disconnect();f.disposed=[f.connection];});
    const released = await page.evaluate(() => window.fixture.connection.getSharedDataMemoryUsage());
    assert.equal(released.ownedBytes,0,'retaining a disposed connection must not retain its sample store');
    assert.equal(released.readerReleased,true,'the worklet must release its runtime closures before acknowledging stop');
    const requirements = await page.evaluate(() => [new window.fixture.Probe().getMemoryRequirements(),new window.fixture.HistoryProbe().getMemoryRequirements()]);
    assert.ok(requirements[1].minimumBytes - requirements[0].minimumBytes >= 256*1024,JSON.stringify(requirements));
    for (let iteration=0;iteration<8;iteration++) {
        await page.evaluate(async iteration => {
            const f=window.fixture;
            const next=new f.connection.constructor({worker:'worker.js',sharedData:{format:'bytes',inputCount:2,maxRetainedBytes:1024*1024}});
            await next.initialise({CmajorClass:iteration%2?f.Probe:f.HistoryProbe,audioContext:f.context,workletName:'shared-replacement-'+iteration,rootResourcePath:location.origin+'/'});
            f.layouts.push(next.getSharedDataMemoryUsage().ownedBytes);
            f.disposed.push(next);
            f.replacement=next;
        },iteration);
        if(iteration===0) {
            await page.evaluate(async () => {const f=window.fixture;f.minimum=0;f.maximum=0;f.replacement.audioNode.connect(f.capture);f.capture.connect(f.context.destination);await f.context.resume();});
            const restored = await page.evaluate(async () => {
                const f=window.fixture,w=f.worker,storage=w.connection.sharedData;
                const destination=storage.reserve(0,f.editable.pointCount*4);
                const samples=new Float32Array(destination.buffer,destination.byteOffset,f.editable.pointCount);
                for(let i=0;i<samples.length;++i)samples[i]=f.editable.level-i*f.editable.falloff;
                const submitted=await storage.commit(destination.id);
                return {submitted,scope:w.scope,byteLength:destination.byteLength};
            });
            assert.equal(restored.byteLength,16,'the replacement reserves the complete prepared resource');
            assert.equal(restored.submitted.kind,'submitted');
            await page.waitForFunction(({submitted,scope}) => window.fixture.worker.replies.some(reply => reply.kind==='applied'
                && reply.id===submitted.id && reply.serial===submitted.serial && reply.generation===submitted.generation
                && reply.scope.owner===scope.owner && reply.scope.document===scope.document),restored);
            const recoveredBlocks=await page.evaluate(() => window.fixture.blocks);
            await page.waitForFunction(blocks => window.fixture.blocks>=blocks+3 && window.fixture.minimum===1.125 && window.fixture.maximum===1.125,recoveredBlocks);
            await page.evaluate(() => {
                const f=window.fixture;
                f.oldStorage=f.worker.connection.sharedData;
                const abandoned=f.oldStorage.reserve(0,4);
                new Float32Array(abandoned.buffer,abandoned.byteOffset,1)[0]=0.125;
                f.abandonedReservation=abandoned.id;
            });
            await page.evaluate(async () => {const f=window.fixture;await f.context.suspend();f.capture.disconnect();});
        }
        await page.evaluate(() => window.fixture.replacement.dispose());
        if(iteration===0) {
            const obsolete=await page.evaluate(async () => {
                const f=window.fixture;
                try {await f.oldStorage.commit(f.abandonedReservation);return {kind:'accepted'};}
                catch(error){return {kind:'rejected',message:String(error)};}
            });
            assert.equal(obsolete.kind,'rejected','a disposed program cannot submit its abandoned direct reservation');
            assert.match(obsolete.message,/Invalid shared data reservation/);
        }
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
    const unavailable=await page.evaluate(async()=>{
        const f=window.fixture;
        try {await f.prepareSharedData(f.worker.connection,{input:0,byteLength:16},()=>{throw new Error('unsupported host unexpectedly allocated storage');});return {kind:'accepted'};}
        catch(error){return {kind:'failed',message:String(error)};}
    });
    assert.equal(unavailable.kind,'failed');
    assert.match(unavailable.message,/does not support direct shared-data preparation/);
    assert.equal(await page.evaluate(()=>window.fixture.ordinary.sharedData===undefined),true);
    await page.evaluate(async () => {await window.fixture.ordinary.dispose();await window.fixture.context.close();});
    console.log('PASS real AudioWorklet shared startup, private-worker transfer, reader Wasm output and suspended disposal');
    console.log('PASS actual compiler parse failure retains '+compileAudio.length+' old-audio blocks; corrected layout restores prepared editable data directly and rejects the disposed reservation');
    console.log('PASS ordinary worker receives immediate direct shared-data unsupported failure');
    console.log('PASS retained AudioContext and nine retained disposed connections across two compiler layouts release main memory objects and worklet runtime ownership');
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    await rm(directory,{recursive:true,force:true});
}
