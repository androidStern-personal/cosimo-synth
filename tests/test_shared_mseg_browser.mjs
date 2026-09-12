import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { build as bundle } from 'esbuild';
import { buildSharedMsegFixture } from './helpers/build_shared_mseg_fixture.mjs';

const cmaj=process.env.COSIMO_CMAJ_EXECUTABLE??path.resolve('build/cmajor_command/bin/cmaj');
const {staging,manifest,runtime}=await buildSharedMsegFixture();
await bundle({entryPoints:[path.join(staging,'fx/shared_mseg/view/browser.tsx')],outfile:path.join(runtime,'view/browser.js'),
    bundle:true,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',logLevel:'silent'});
const output=path.join(path.dirname(runtime),'shared_mseg_web');
execFileSync(cmaj,['generate','--target=webaudio-html',`--output=${output}`,manifest],{stdio:'pipe'});
const modules=(await readdir(output)).filter(file=>/^cmaj_.*\.js$/.test(file));
assert.equal(modules.length,1,'the supported CLI emits one patch module');
for(const file of ['index.html','cmaj_api/cmaj-shared-data.js','cmaj_api/cmaj-shared-data-reader.js','worker.js','ascending.json','descending.json','view/browser.js'])
    assert.ok((await readFile(path.join(output,file))).length>0,`CLI packages ${file}`);
await writeFile(path.join(output,'qualification.html'),`<!doctype html><button id="start">Start</button><main></main>
<script type="module">
import {createAudioWorkletNodePatchConnection} from '/${modules[0]}';
import createView,{createAgent,outcomes,defects} from '/view/browser.js';
document.querySelector('#start').onclick=async()=>{try{
 const context=new AudioContext({sampleRate:48000});
 const connection=await createAudioWorkletNodePatchConnection(context,'shared-mseg');
 connection.sendStoredStateValue('shape',{format:'mseg.shape',version:1,name:'MSEG 1',globalSmooth:false,
     points:[{x:0,y:0,curvePower:0},{x:1,y:1,curvePower:0}]});
 const capture=context.createScriptProcessor(256,3,1),silent=context.createGain();silent.gain.value=0;
 capture.channelInterpretation='discrete';connection.audioNode.connect(capture);capture.connect(silent);silent.connect(context.destination);
 const state={connection,context,outcomes,defects,audio:[],blocks:0};
 capture.onaudioprocess=e=>{state.audio=Array.from({length:3},(_,i)=>{const v=e.inputBuffer.getChannelData(i);return [Math.min(...v),Math.max(...v)];});state.blocks++;};
 let gui,element,agentConnection;
 state.open=()=>{gui=connection.createViewConnection();element=createView(gui);document.querySelector('main').append(element);agentConnection=connection.createViewConnection();state.agent=createAgent(agentConnection);};
 state.close=()=>{element.remove();gui.dispose();state.agent.stop();agentConnection.dispose();};
 state.dispose=async()=>{state.close();capture.disconnect();silent.disconnect();await connection.dispose();await context.close();};
 state.open();await context.resume();window.fixture=state;
}catch(error){window.failure=String(error.stack??error);}};
</script>`);
const server=createServer(async(req,res)=>{
    try {
        const url=new URL(req.url,'http://127.0.0.1');assert.ok(!url.pathname.includes('..'));
        const file=path.join(output,url.pathname==='/'?'qualification.html':url.pathname.slice(1));
        res.writeHead(200,{'content-type':file.endsWith('.html')?'text/html':'text/javascript',
            'cross-origin-opener-policy':'same-origin','cross-origin-embedder-policy':'require-corp'});
        res.end(await readFile(file));
    }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage(),errors=[];
page.on('pageerror',error=>errors.push(String(error)));
async function expect(y,gain) {
    await page.waitForFunction(({y,gain})=>{
        const f=window.fixture,s=f.agent.getSnapshot();
        if(s.kind!=='ready')return false;
        const fields=s.state.fields;
        return fields.shape.value.points[1].y===y&&fields.shape.application?.kind==='acknowledged'&&fields.gain.value===gain;
    },{y,gain},{timeout:10000});
    const baseline=await page.evaluate(()=>window.fixture.blocks);
    await page.waitForFunction(({y,gain,baseline})=>{
        const f=window.fixture,expected=[y*1024/2047,2051,gain];
        return f.blocks>baseline+3&&f.audio.every((range,i)=>range.every(v=>Math.abs(v-expected[i])<0.00001));
    },{y,gain,baseline},{timeout:5000});
    const shape=JSON.parse(await page.getByTestId('shape').textContent());
    assert.equal(shape.value.points[1].y,y);assert.equal(shape.application.kind,'acknowledged');
    assert.equal(JSON.parse(await page.getByTestId('gain').textContent()).value,gain);
    const saved=await page.evaluate(()=>new Promise(resolve=>window.fixture.connection.requestFullStoredState(resolve)));
    assert.equal(saved.values.shape.points[1].y,y);
    assert.deepEqual(await page.evaluate(()=>window.fixture.defects),[]);assert.deepEqual(errors,[]);
}
async function expectLoaded(file, values) {
    await page.waitForFunction(file => {
        const f = window.fixture.agent.getSnapshot();
        return f.kind === 'ready' && f.state.fields.loaded.value === file
            && f.state.fields.loaded.application?.kind === 'acknowledged';
    }, file);
    await page.evaluate(() => window.fixture.connection.sendEventOrValue('readLoaded', true));
    for (let index = -1; index <= values.length; index++) {
        await page.evaluate(index => window.fixture.connection.sendEventOrValue('readIndex', index), index);
        const baseline = await page.evaluate(() => window.fixture.blocks);
        await page.waitForFunction(({baseline, sample, length}) => {
            const f = window.fixture;
            return f.blocks > baseline + 3 && f.audio[0].every(v => v === sample)
                && f.audio[1].every(v => v === length);
        }, {baseline, sample: values[index] ?? 0, length: values.length});
    }
    const field = JSON.parse(await page.getByTestId('loaded').textContent());
    assert.equal(field.value, file); assert.equal(field.application.kind, 'acknowledged');
    assert.deepEqual(await page.evaluate(() => window.fixture.defects), []);
    assert.deepEqual(errors, []);
    await page.evaluate(() => {
        window.fixture.connection.sendEventOrValue('readLoaded', false);
        window.fixture.connection.sendEventOrValue('readIndex', 1025);
    });
}
try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.click('#start');
    await page.waitForFunction(()=>window.fixture||window.failure,null,{timeout:15000});
    assert.equal(await page.evaluate(()=>window.failure),undefined);
    await expect(1,1);
    await page.getByText('Begin',{exact:true}).click();
    await page.getByText('Low',{exact:true}).click();await expect(0.25,1);
    await page.getByText('High',{exact:true}).click();await expect(0.75,1);
    await page.getByText('End',{exact:true}).click();
    await page.getByText('Gain',{exact:true}).click();await expect(0.75,1.5);
    await page.getByText('Undo',{exact:true}).click();await expect(0.75,1);
    await page.getByText('Undo',{exact:true}).click();await expect(1,1);
    assert.equal(JSON.parse(await page.getByTestId('history').textContent()).canUndo,false,'drag is exactly one entry and gain is latest-first');
    await page.getByText('Redo',{exact:true}).click();await expect(0.75,1);
    await page.evaluate(()=>{const f=window.fixture;f.close();f.open();});await expect(0.75,1);
    await page.getByText('Undo',{exact:true}).click();await expect(1,1);
    const old=await page.evaluate(()=>window.fixture.agent.getSnapshot().state.scope);
    await page.evaluate(()=>window.fixture.connection.sendFullStoredState({parameters:[{name:'gain',value:0.5}],values:{shape:{
        format:'mseg.shape',version:1,name:'MSEG 1',globalSmooth:false,points:[{x:0,y:0,curvePower:0},{x:1,y:1,curvePower:0}],
    }}}));
    await expect(1,0.5);
    const next=await page.evaluate(()=>window.fixture.agent.getSnapshot().state.scope);
    assert.equal(next.document,old.document+1);
    assert.equal(JSON.parse(await page.getByTestId('history').textContent()).canUndo,false);
    assert.ok((await page.evaluate(()=>window.fixture.outcomes)).every(r=>r.kind==='accepted'));
    await expectLoaded('ascending.json', [0.125,0.25,0.5]);
    await page.getByText('Load file', {exact:true}).click();
    await expectLoaded('descending.json', [1,0.75,0.5,0.25,0]);
    const savedLoaded = await page.evaluate(() => new Promise(resolve => window.fixture.connection.requestFullStoredState(resolve)));
    assert.equal(savedLoaded.values.loaded, 'descending.json');
    await page.getByText('Gain', {exact:true}).click(); await expect(1,1.5);
    await page.getByText('Undo', {exact:true}).click(); await expect(1,0.5);
    await expectLoaded('descending.json', [1,0.75,0.5,0.25,0]);
    await page.getByText('Undo', {exact:true}).click();
    await expectLoaded('ascending.json', [0.125,0.25,0.5]);
    await page.getByText('Redo', {exact:true}).click();
    await expectLoaded('descending.json', [1,0.75,0.5,0.25,0]);
    await page.evaluate(() => { window.fixture.close(); window.fixture.open(); });
    await expectLoaded('descending.json', [1,0.75,0.5,0.25,0]);
    await page.evaluate(()=>window.fixture.dispose());
    console.log('PASS customer CLI webaudio-html export, real kit MSEG renderer, generated state worker, public React edit/Undo/Redo, saved values, actual 3-channel Cmajor audio, GUI reopen, full restore, and custom async file loading with variable storage and mixed Undo.');
} catch(error) {
    console.error('Browser errors:',errors);
    console.error('Fixture diagnostics:',await page.evaluate(()=>({failure:window.failure,errors:window.fixture?.defects,state:window.fixture?.agent.getSnapshot(),audio:window.fixture?.audio})));
    throw error;
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
