// Frozen browser DSP must correspond to the source that customers receive.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
test('MSEG browser example fingerprints match the shipped source and compiled artifacts',async()=>{
    const manifest=JSON.parse(await readFile(path.join(root,'kit/examples/mseg/playback-provenance.json'),'utf8'));
    for(const [file,expected] of Object.entries(manifest.sha256)) assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),expected,`${file} changed: regenerate the playback example with the pinned compiler.`);
});
