import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import path from 'node:path'
import { createServer } from 'vite'
import { build } from 'esbuild'
import ts from 'typescript'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const root = path.resolve(import.meta.dirname, '../..')
let server, browser, base
before(async () => {
    server = await createServer({ configFile: path.join(root, 'kit/examples/filters/vite.config.mjs'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
    await server.listen()
    base = `http://127.0.0.1:${server.httpServer.address().port}`
    browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await server?.close() })
async function withPage(run, options = {}) {
    const page = await browser.newPage(options)
    page.setDefaultTimeout(5000)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    try { await page.goto(base); await page.locator('#default [data-slot=filter-editor]').waitFor(); await run(page); assert.deepEqual(errors, []) }
    finally { await page.close() }
}
async function drag(page, handle, dx, dy) {
    await handle.scrollIntoViewIfNeeded()
    const b = await handle.boundingBox()
    assert.ok(b)
    await page.mouse.move(b.x+b.width/2, b.y+b.height/2); await page.mouse.down()
    await page.mouse.move(b.x+b.width/2+dx, b.y+b.height/2+dy, { steps: 4 }); await page.mouse.up()
}
const valueHandle = section => section.locator('[data-role=filter-range-value-hit-target]')
const endpoint = (section, side) => section.locator(`[data-role=filter-travel-hit-target-${side}]`)
const endpointState = section => section.locator('[data-role=endpoint-values]').textContent().then(JSON.parse)
const debug = section => section.locator('[data-role=filter-graph-debug]').textContent().then(JSON.parse)
test('the simple filter supports pointer, keyboard, mode and externally driven rendering', () => withPage(async page => {
    const s=page.locator('#default'), h=valueHandle(s)
    const before=await debug(s)
    await drag(page,h,45,-25)
    const after=await debug(s)
    assert.ok(after.base.cutoffHz>before.base.cutoffHz); assert.ok(after.base.q>before.base.q)
    const original=await h.getAttribute('aria-valuetext'); await h.press('ArrowUp'); assert.notEqual(await h.getAttribute('aria-valuetext'),original)
    await s.getByRole('button',{name:/Cycle filter mode/}).click(); assert.equal((await debug(s)).base.mode,2)
}))
test('the cutoff band keeps the base independent and anchors unipolar start',()=>withPage(async page=>{
    const s=page.locator('#band');const baseBefore=(await debug(s)).base.cutoffHz
    const start=s.locator('[data-role=filter-range-start-hit-target]'), original=await start.getAttribute('aria-valuenow')
    await drag(page,start,40,0);assert.notEqual(await start.getAttribute('aria-valuenow'),original);assert.equal((await debug(s)).base.cutoffHz,baseBefore)
    await s.getByRole('checkbox').check();assert.equal(await start.count(),0)
    const guide=s.locator('[data-role=filter-range-start-guide]'), handle=s.locator('[data-role=filter-range-value-handle]')
    assert.equal(await guide.getAttribute('x1'),await handle.getAttribute('cx'))
}))
test('two-dimensional endpoints and rigid center translation use the same value mapping',()=>withPage(async page=>{
    const s=page.locator('#modulation'), before=await endpointState(s)
    await drag(page,endpoint(s,'end'),-40,-20)
    let state=await endpointState(s);assert.deepEqual(state.start,before.start);assert.ok(state.end.cutoffHz<before.end.cutoffHz);assert.ok(state.end.q>before.end.q)
    const positions=await s.locator('[data-role^=filter-travel-handle-]').evaluateAll(nodes=>nodes.filter(n=>n.tagName==='circle').map(n=>({x:Number(n.getAttribute('cx')),y:Number(n.getAttribute('cy'))})))
    await drag(page,endpoint(s,'center'),20,20)
    const moved=await s.locator('[data-role^=filter-travel-handle-]').evaluateAll(nodes=>nodes.filter(n=>n.tagName==='circle').map(n=>({x:Number(n.getAttribute('cx')),y:Number(n.getAttribute('cy'))})))
    for(let i=0;i<positions.length;i++){assert.ok(Math.abs(moved[i].x-positions[i].x-20)<.2);assert.ok(Math.abs(moved[i].y-positions[i].y-20)<.2)}
    assert.match(await s.locator('[data-role=gesture-events]').textContent(),/start:modulation-center · end:modulation-center/)
}))
test('axis constraints, unipolar start and endpoint keyboard editing remain independent',()=>withPage(async page=>{
    const s=page.locator('#modulation');await s.getByRole('combobox').selectOption('cutoff');const before=await endpointState(s)
    await drag(page,endpoint(s,'end'),-25,-25);let state=await endpointState(s);assert.equal(state.end.q,before.end.q);assert.notEqual(state.end.cutoffHz,before.end.cutoffHz)
    await s.getByRole('combobox').selectOption('q');const cutoff=state.end.cutoffHz;await endpoint(s,'end').press('ArrowUp');state=await endpointState(s);assert.equal(state.end.cutoffHz,cutoff);assert.ok(state.end.q>before.end.q)
    await s.getByRole('checkbox').check();assert.equal(await endpoint(s,'start').count(),0)
    const fixedEnd=state.end;await drag(page,valueHandle(s),0,20);assert.deepEqual((await endpointState(s)).end,fixedEnd)
}))
test('analyzer modes, live preview and removing a frame change the actual canvas',()=>withPage(async page=>{
    const s=page.locator('#analyzer');await s.scrollIntoViewIfNeeded()
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#analyzer [data-role=filter-graph-debug]').textContent).spectrum.hasSpectrum)
    let d=await debug(s);assert.equal(d.spectrum.renderGeometry.kind,'graph');assert.ok(d.live.hasActive)
    const canvas=s.locator('canvas'), graphImage=await canvas.evaluate(c=>c.toDataURL())
    await s.getByRole('combobox').selectOption('round-bars');await page.waitForFunction(()=>JSON.parse(document.querySelector('#analyzer [data-role=filter-graph-debug]').textContent).spectrum.renderGeometry?.rounded)
    assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),graphImage)
    await s.getByRole('checkbox').uncheck();await page.waitForFunction(()=>!JSON.parse(document.querySelector('#analyzer [data-role=filter-graph-debug]').textContent).spectrum.hasSpectrum)
    assert.equal(await canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data).some(v=>v!==0)),false)
}))
test('custom styles do not change interaction and read-only/disabled prevent writes',()=>withPage(async page=>{
    const s=page.locator('#states'), h=valueHandle(s)
    assert.equal(await s.locator('[data-role=filter-range-value-response]').evaluate(n=>getComputedStyle(n).stroke),'rgb(235, 166, 118)')
    await drag(page,h,20,-30);assert.ok((await debug(s)).base.cutoffHz>400)
    await s.getByRole('checkbox',{name:'Read only'}).check();let original=await h.getAttribute('aria-valuetext');await h.press('ArrowRight');await drag(page,h,20,20);assert.equal(await h.getAttribute('aria-valuetext'),original)
    await s.getByRole('button',{name:'External reset'}).click();assert.equal((await debug(s)).base.cutoffHz,3000)
    await s.getByRole('checkbox',{name:'Read only'}).uncheck();await s.getByRole('checkbox',{name:'Disabled'}).check();original=await h.getAttribute('aria-valuetext');await h.press('ArrowLeft');assert.equal(await h.getAttribute('aria-valuetext'),original);assert.equal(await s.getByRole('button',{name:/Cycle filter mode/}).isDisabled(),true)
}))
test('examples and their copyable code remain readable on a phone',()=>withPage(async page=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    for(const id of ['default','band','modulation','analyzer','states']){
        const s=page.locator('#'+id);const box=await s.locator('[data-slot=filter-editor]').boundingBox();assert.ok(box.width>200)
        await s.getByRole('tab',{name:'Code',exact:true}).click();assert.match(await s.locator('pre').first().innerText(),/import \{ FilterEditor.*from '..\/..\/index'/)
    }
},{viewport:{width:393,height:852}}))

test('copied examples typecheck using only the public kit boundary',async()=>{
    const files=['default','band','modulation','analyzer','states'].map(n=>path.join(root,'kit/examples/filters/'+n+'.tsx'))
    const config=ts.readConfigFile(path.join(root,'tsconfig.json'),ts.sys.readFile).config
    const options=ts.parseJsonConfigFileContent(config,ts.sys,root).options
    const program=ts.createProgram([...files,path.join(root,'kit/ui/style-modules.d.ts')],{...options,noEmit:true})
    assert.deepEqual(ts.getPreEmitDiagnostics(program).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[])
    for(const file of files){const source=await readFile(file,'utf8');assert.ok(!source.includes('/ui/filter-'));assert.ok(!source.includes('ui/shared'))}
})

async function fixture(page) {
    await page.evaluate(async url=>{
        const {mount}=await import(url), host=document.createElement('div');host.id='fixture';document.body.append(host);window.filterFixture=mount(host)
    }, `/@fs/${path.join(root,'kit/tests/helpers/filter_fixture.tsx')}`)
    await page.locator('#fixture [data-slot=filter-editor]').first().waitFor()
    return page.locator('#fixture [data-slot=filter-editor]').first()
}
test('shadow-root defaults share one sheet and release it with the last control',()=>withPage(async page=>{
    const host=await fixture(page)
    const sheet=()=>page.evaluate(()=>document.querySelector('#fixture').shadowRoot.querySelectorAll('style[data-builder-kit-filter]').length)
    assert.equal(await sheet(),1)
    assert.equal(await host.locator('[data-role=filter-range-value-response]').evaluate(n=>getComputedStyle(n).stroke),'rgb(28, 28, 28)')
    await page.evaluate(()=>window.filterFixture.configure({second:false}));await page.waitForFunction(()=>document.querySelector('#fixture').shadowRoot.querySelectorAll('[data-slot=filter-editor]').length===1)
    assert.equal(await sheet(),1)
    await page.evaluate(()=>window.filterFixture.unmount());assert.equal(await sheet(),0)
}))
test('blur, cancellation, disabling and unmount close each gesture once and stop writes',()=>withPage(async page=>{
    for(const action of ['blur','cancel','disabled','readOnly','unmount']){
        const host=await fixture(page), h=valueHandle(host)
        await h.scrollIntoViewIfNeeded();const box=await h.boundingBox(), sx=box.x+box.width/2, sy=box.y+box.height/2
        await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx+20,sy-15,{steps:3})
        assert.deepEqual(await page.evaluate(()=>window.filterFixture.events),['start:0:value'])
        const writes=await page.evaluate(()=>window.filterFixture.writes())
        if(action==='blur') await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
        else if(action==='cancel') await host.locator('svg').dispatchEvent('pointercancel',{pointerId:1})
        else if(action==='unmount') await page.evaluate(()=>window.filterFixture.unmount())
        else await page.evaluate(which=>window.filterFixture.configure({[which]:true}),action)
        await page.waitForFunction(()=>window.filterFixture.events.length===2)
        await page.mouse.move(sx+45,sy-30);await page.mouse.up()
        assert.deepEqual(await page.evaluate(()=>window.filterFixture.events),['start:0:value','end:0:value']);assert.equal(await page.evaluate(()=>window.filterFixture.writes()),writes)
        await page.evaluate(()=>{window.filterFixture.unmount();document.getElementById('fixture').remove()})
    }
}))
test('modulation captures its anchor on press and uses current callbacks when released',()=>withPage(async page=>{
    const host=await fixture(page), h=endpoint(host,'end');await h.scrollIntoViewIfNeeded();const b=await h.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2
    await page.mouse.move(x,y);await page.mouse.down();assert.deepEqual(await page.evaluate(()=>window.filterFixture.events),['start:0:modulation-end'])
    await page.evaluate(()=>window.filterFixture.configure({version:1}));await page.mouse.move(x-20,y-20,{steps:3});await page.mouse.up()
    assert.deepEqual(await page.evaluate(()=>window.filterFixture.events),['start:0:modulation-end','end:1:modulation-end'])
    await page.evaluate(()=>window.filterFixture.unmount());assert.equal(await page.evaluate(()=>window.filterFixture.events.length),2)
}))

test('the displayed TSX and CSS run when copied into a standalone customer page',async()=>{
    const directory=path.join(root,'kit/examples/filters'), names=['default','band','modulation','analyzer','states']
    const copied=new Map(await Promise.all(names.map(async name=>[name+'.tsx',await readFile(path.join(directory,name+'.tsx'),'utf8')])))
    const examples=[...copied].map(([file,source])=>({file,name:source.match(/export function (\w+Example)/)[1],id:file.replace('.tsx','')}))
    const entry=examples.map(e=>`import {${e.name}} from 'copy:${e.file}';`).join('\n')+"\nimport {createRoot} from 'react-dom/client';createRoot(document.getElementById('root')).render(<>"+examples.map(e=>`<section id="${e.id}"><${e.name}/></section>`).join('')+'</>);'
    const bundle=await build({stdin:{contents:entry,loader:'tsx',resolveDir:directory},bundle:true,write:false,outfile:'copied.js',format:'esm',jsx:'automatic',plugins:[{name:'copy-proof',setup(b){
        b.onResolve({filter:/^copy:/},args=>({path:args.path.slice(5),namespace:'copy'}))
        b.onLoad({filter:/.*/,namespace:'copy'},args=>({contents:copied.get(args.path),loader:'tsx',resolveDir:directory}))
        b.onResolve({filter:/\?(inline|raw)$/},args=>({path:path.resolve(args.resolveDir,args.path.replace(/\?.*$/,'')),namespace:'raw'}))
        b.onLoad({filter:/.*/,namespace:'raw'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}))
    }}]})
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
    try{
        await page.route('**/copy-proof',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'}))
        await page.goto(base+'/copy-proof')
        await page.addStyleTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.css')).text})
        await page.addScriptTag({type:'module',content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text})
        await page.locator('#default [data-slot=filter-editor]').waitFor()
        await drag(page,valueHandle(page.locator('#default')),40,-20);assert.ok((await debug(page.locator('#default'))).base.cutoffHz>1200)
        await drag(page,endpoint(page.locator('#modulation'),'end'),-20,-20);assert.ok((await endpointState(page.locator('#modulation'))).end.cutoffHz<4800)
        await page.waitForFunction(()=>JSON.parse(document.querySelector('#analyzer [data-role=filter-graph-debug]').textContent).spectrum.hasSpectrum)
        assert.deepEqual(errors,[])
    }finally{await page.close()}
})
