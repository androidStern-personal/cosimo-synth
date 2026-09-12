import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { startStaticWebServer } from './helpers/static_web_server.mjs';
import { stageCmajorWebRuntime } from '../ui/vite.shared.mjs';
const root=path.resolve(import.meta.dirname,'..');

test('ordinary synth parameters and MSEG edits share real public React Undo while host automation stays outside history',async()=>{
    const server=await startStaticWebServer(root,{bundleTypeScript:true,mounts:{'/cmaj_api':()=>process.env.COSIMO_CMAJOR_SOURCE
        ?path.join(process.env.COSIMO_CMAJOR_SOURCE,'javascript/cmaj_api')
        :stageCmajorWebRuntime(root,{buildDirectory:path.join(root,'build/cmajor_web_runtime-ordinary-state'),instanceId:String(process.pid)})}});
    const browser=await chromium.launch({headless:true});
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    const state=()=>page.getByTestId('ordinary-state').evaluate(element=>JSON.parse(element.textContent));
    const wait=async(cutoff,table,y)=>page.waitForFunction(({cutoff,table,y})=>{
        const raw=document.querySelector('[data-testid="ordinary-state"]')?.textContent;if(!raw)return false;const s=JSON.parse(raw);
        return s.cutoff.value===cutoff&&s.table.value===table&&s.modulation.kind==='ready'
            &&(y===null||s.modulation.value.msegSlots[0].shapeA.points[0].y===y);
    },{cutoff,table,y});
    try {
        await page.goto(`${server.baseUrl}/kit/tests/helpers/module_test_shell.html`);
        await page.evaluate(async()=>{const {mount}=await import('/tests/browser/fixtures/synth_parameter_state/view.tsx');window.fixture=await mount(document.getElementById('mount'));});
        await page.getByTestId('ordinary-state').waitFor();
        assert.equal((await state()).cutoff.isReady,false);
        await page.evaluate(()=>{window.fixture.commit('cutoff',4000);window.fixture.commit('inactive',0.7);});
        assert.equal(await page.evaluate(()=>window.fixture.snapshot().sentMessages.filter(message=>['filterCutoff','macro4'].includes(message.endpointID)).length),0,
            'declared but unready/inactive controls cannot fall back to raw sends');
        await page.evaluate(()=>window.fixture.releaseBoot());
        await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="ordinary-state"]').textContent).cutoff.isReady);
        const initial=await state(),table=initial.table.value,y=initial.modulation.value.msegSlots[0].shapeA.points[0].y;
        assert.equal(initial.cutoff.value,8000);assert.equal(initial.inactive.isReady,false);
        await page.evaluate(()=>{window.fixture.begin('cutoff');window.fixture.set('cutoff',6000);});
        assert.equal((await state()).cutoff.value,6000,'parameter draft moves immediately through the public client');
        await page.evaluate(()=>{window.fixture.set('cutoff',4000);window.fixture.end('cutoff');});
        await wait(4000,table,y);
        await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="ordinary-state"]').textContent).history.canUndo);
        const reports=await page.evaluate(()=>window.fixture.edits());
        assert.deepEqual(reports,[{kind:'begin'},{kind:'edit',endpointID:'filterCutoff',changed:true},{kind:'edit',endpointID:'filterCutoff',changed:true},{kind:'end'}]);
        await page.evaluate(()=>window.fixture.commit('table',12));await wait(4000,12,y);
        assert.equal((await page.evaluate(()=>window.fixture.shape(0.4))).kind,'accepted');await wait(4000,12,0.4);
        for(const expected of [[4000,12,y],[4000,table,y],[8000,table,y]]){
            assert.equal((await page.evaluate(()=>window.fixture.undo())).kind,'accepted');await wait(...expected);
        }
        assert.equal((await state()).history.canUndo,false,'one cutoff drag, one table choice and one shape form exactly three entries');
        for(const expected of [[4000,table,y],[4000,12,y],[4000,12,0.4]]){
            assert.equal((await page.evaluate(()=>window.fixture.redo())).kind,'accepted');await wait(...expected);
        }
        await page.evaluate(()=>window.fixture.automate('filterCutoff',9000));await wait(9000,12,0.4);
        await page.evaluate(()=>window.fixture.reopen());await wait(9000,12,0.4);
        assert.equal((await page.evaluate(()=>window.fixture.undo())).kind,'accepted');await wait(9000,12,y);
        assert.equal((await page.evaluate(()=>window.fixture.undo())).kind,'accepted');await wait(9000,table,y);
        await page.evaluate(()=>window.fixture.commit('inactive',0.8));
        assert.equal(await page.evaluate(()=>window.fixture.snapshot().sentMessages.filter(message=>message.endpointID==='macro4').length),0);
        await page.evaluate(()=>{window.fixture.begin('detune');window.fixture.set('detune',0.2);});
        await page.waitForFunction(()=>window.fixture.snapshot().parameterValues.oscAUnisonDetune===0.2);
        await page.evaluate(()=>{window.fixture.set('detune',0.3);window.fixture.end('detune');});
        await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="ordinary-state"]').textContent).detune.value===0.3);
        assert.equal((await page.evaluate(()=>window.fixture.undo())).kind,'accepted');
        await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="ordinary-state"]').textContent).detune.value===0.1);
        assert.equal((await page.evaluate(()=>window.fixture.redo())).kind,'accepted');
        await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="ordinary-state"]').textContent).detune.value===0.3);
        assert.deepEqual(errors,[]);
    } catch (error) { console.error(JSON.stringify({ errors, cutoff: (await state()).cutoff, modulation: (await state()).modulation.kind })); throw error;
    } finally {await page.evaluate(()=>window.fixture?.dispose());await browser.close();await server.stop();}
});
