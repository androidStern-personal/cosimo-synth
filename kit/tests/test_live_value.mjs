import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { loadUIModule } from './helpers/load_ui_module.mjs';
const { animateLiveNumber } = await loadUIModule(path.resolve(import.meta.dirname,'../..'), 'kit/ui/live-value.ts');
function clock() {
    let id=0,time=0;const pending=new Map();
    return { view:{requestAnimationFrame:run=>{pending.set(++id,run);return id;},cancelAnimationFrame:id=>pending.delete(id)},
        step:()=>{time+=16;const batch=[...pending.values()];pending.clear();for(const fn of batch)fn(time);}, pending:()=>pending.size };
}
function source(initial) {
    let value=initial; const listeners=new Set();
    return {getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},
        set:next=>{value=next;for(const fn of listeners)fn();},listeners:()=>listeners.size};
}
test('many indicators share one frame and unsubscribe/stop on final detach',()=>{
    const frames=clock(),signal=source(0),a=[],b=[];
    const stopA=animateLiveNumber(frames.view,signal,x=>x,0,x=>a.push(x));
    const stopB=animateLiveNumber(frames.view,signal,x=>x*2,0,x=>b.push(x));
    signal.set(.2);signal.set(.4);signal.set(.8);
    assert.equal(frames.pending(),1);frames.step();assert.deepEqual(a,[.8]);assert.deepEqual(b,[1.6]);assert.equal(frames.pending(),0);
    signal.set(1);stopA();stopB();assert.equal(signal.listeners(),0);assert.equal(frames.pending(),0);
    signal.set(0);assert.equal(frames.pending(),0);
});
test('smoothing converges and stops; inactive/invalid values hide and break continuity',()=>{
    const frames=clock(),signal=source(.2),output=[];
    const stop=animateLiveNumber(frames.view,signal,x=>x,45,x=>output.push(x));
    frames.step();assert.equal(output.at(-1),.2);
    signal.set(.8);frames.step();assert.ok(output.at(-1)>.2&&output.at(-1)<.8);
    for(let i=0;i<80&&frames.pending();i++)frames.step();assert.equal(output.at(-1),.8);assert.equal(frames.pending(),0);
    signal.set(null);frames.step();assert.equal(output.at(-1),null);
    signal.set(.1);frames.step();assert.equal(output.at(-1),.1);
    signal.set(NaN);frames.step();assert.equal(output.at(-1),null);stop();
});
test('detaching during a pending smoothed update cannot write afterward',()=>{
    const frames=clock(),signal=source(.2),output=[];
    const stop=animateLiveNumber(frames.view,signal,x=>x,100,x=>output.push(x));
    frames.step();signal.set(.9);frames.step();const count=output.length;
    stop();for(let i=0;i<20;i++)frames.step();assert.equal(output.length,count);assert.equal(signal.listeners(),0);assert.equal(frames.pending(),0);
});
