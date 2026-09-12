import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'../..');
const directory=await mkdtemp(path.join(tmpdir(),'kit-mseg-editor-'));
let browser,server;
try {
    await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import {useState} from 'react';import {MsegEditor} from './kit/ui/mseg-editor';import {createDefaultMsegShape} from './kit/ui/mseg';
function View(){const [shape,setShape]=useState(createDefaultMsegShape());window.shape=shape;window.gestures??=[];return <MsegEditor value={shape} onChange={setShape} onGestureStart={()=>window.gestures.push('start')} onGestureEnd={cancelled=>window.gestures.push(cancelled?'cancel':'end')} style={{width:400,height:180}}/>;}createRoot(document.querySelector('main')).render(<View/>);`,resolveDir:root,loader:'tsx'},outfile:path.join(directory,'app.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',logLevel:'silent'});
    await writeFile(path.join(directory,'index.html'),'<!doctype html><main></main><script type="module" src="/app.js"></script>');
    server=createServer(async(req,res)=>{try{const file=req.url==='/app.js'?'app.js':'index.html';res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':'text/html'});res.end(await readFile(path.join(directory,file)));}catch{res.writeHead(404);res.end();}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}`);const svg=page.locator('[data-role=mseg-editor]');await svg.waitFor();await page.waitForFunction(()=>window.shape?.points.length===2);
    const box=await svg.boundingBox();assert.ok(box);
    await page.mouse.click(box.x+180,box.y+125);await page.waitForFunction(()=>window.shape.points.length===3);
    const point=page.locator('[data-point-index="1"]');let bounds=await point.boundingBox();assert.ok(bounds);
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(box.x+260,box.y+55,{steps:4});await page.mouse.up();
    let shape=await page.evaluate(()=>window.shape);assert.ok(shape.points[1].x>.6&&shape.points[1].y>.6);
    const circles=await page.locator('[data-role=mseg-point]').evaluateAll(elements=>elements.map(element=>({x:Number(element.getAttribute('cx')),y:Number(element.getAttribute('cy'))})));
    const segment={x:(circles[0].x+circles[1].x)/2,y:(circles[0].y+circles[1].y)/2};
    await page.mouse.move(box.x+segment.x,box.y+segment.y);await page.mouse.down();await page.mouse.move(box.x+segment.x,box.y+segment.y+24,{steps:3});await page.mouse.up();
    shape=await page.evaluate(()=>window.shape);assert.ok(Math.abs(shape.points[0].curvePower)>.1);
    bounds=await point.boundingBox();await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.waitForFunction(()=>window.shape.points.length===2);
    const original=await page.evaluate(()=>window.shape);bounds=await page.locator('[data-point-index="1"]').boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(box.x+380,box.y+90,{steps:3});
    const accepted=await page.evaluate(()=>window.shape);assert.notDeepEqual(accepted,original);
    await svg.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();assert.deepEqual(await page.evaluate(()=>window.shape),accepted, 'cancellation preserves accepted movement and never applies a release-only edit');
    assert.ok((await page.evaluate(()=>window.gestures)).includes('cancel'));assert.deepEqual(errors,[]);
    console.log('MSEG single-curve editor: add, move, curve bend, delete, cancel passed; no product UI or page errors.');
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
