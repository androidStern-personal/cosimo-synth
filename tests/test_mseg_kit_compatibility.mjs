import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const temporary=await mkdtemp(path.join(tmpdir(),'kit-mseg-'));
const bundle=async (name,source)=>{const outfile=path.join(temporary,name+'.mjs');await build({entryPoints:[path.join(root,source)],outfile,bundle:true,format:'esm',platform:'node',logLevel:'silent'});return import(pathToFileURL(outfile));};
const kit=await bundle('kit','kit/ui/mseg.ts');
const cosimo=await bundle('cosimo','ui/shared/mseg.ts');
test.after(()=>rm(temporary,{recursive:true,force:true}));
test('neutral MSEG edits preserve endpoint geometry and write the final caller-owned padded curve',()=>{
 let shape=kit.createDefaultMsegShape();shape=kit.addMsegPoint(shape,.35,.9);shape=kit.moveMsegPoint(shape,1,.4,.7);shape=kit.setMsegSegmentCurvePower(shape,0,3.5);
 assert.equal(shape.format,'mseg.shape');assert.equal(shape.points[0].x,0);assert.equal(shape.points.at(-1).x,1);
 const memory=new Float32Array(kit.MSEG_PADDED_SAMPLES+8);memory.fill(-123);const destination=memory.subarray(4,-4);kit.renderMsegShapeInto(shape,destination);
 assert.deepEqual(destination,cosimo.renderMsegShape(shape));assert.equal(memory[0],-123);assert.equal(memory.at(-1),-123);
 assert.equal(destination[0],destination[1]);assert.equal(destination.at(-1),destination.at(-3));
 assert.deepEqual(kit.deleteMsegPoint(shape,1).points,[{x:0,y:0,curvePower:3.5},{x:1,y:1,curvePower:0}]);
});
test('Cosimo compatibility seam retains its stored identifiers across edits and serialization',()=>{
 let shape=cosimo.createDefaultMsegShape();shape=cosimo.addMsegPoint(shape,.5,.2);shape=cosimo.moveMsegPoint(shape,1,.6,.8);
 assert.equal(shape.format,'cosimo.mseg.shape');assert.equal(cosimo.deserializeMsegShape(cosimo.serializeMsegShape(shape)).format,'cosimo.mseg.shape');assert.equal(cosimo.createDefaultMsegPlayback().format,'cosimo.mseg.playback');
 assert.equal(kit.createDefaultMsegPlayback().format,'mseg.playback');assert.deepEqual(cosimo.renderMsegShape(shape),kit.renderMsegShape(shape));
});
