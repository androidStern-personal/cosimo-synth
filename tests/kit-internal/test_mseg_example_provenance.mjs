// Frozen browser DSP must correspond to the source that customers receive.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const regenerate='regenerate the playback example with scripts/build_mseg_example.mjs.';
test('MSEG browser example fingerprints match the shipped source and compiled artifacts',async()=>{
    const manifest=JSON.parse(await readFile(path.join(root,'kit/examples/mseg/playback-provenance.json'),'utf8'));
    for(const [file,expected] of Object.entries(manifest.sha256)) assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),expected,`${file} changed: ${regenerate}`);
});
test('MSEG browser example was compiled with the pinned Cmajor commit',async()=>{
    const manifest=JSON.parse(await readFile(path.join(root,'kit/examples/mseg/playback-provenance.json'),'utf8'));
    const dependencies=await readFile(path.join(root,'kit/cmake/dependencies.cmake'),'utf8');
    const pinned=/set\(BUILDER_KIT_CMAJOR_PINNED_COMMIT "([0-9a-f]{40})"\)/u.exec(dependencies)?.[1];
    assert.match(pinned??'',/^[0-9a-f]{40}$/u);
    assert.equal(manifest.cmajorCommit,pinned,`The Cmajor pin changed: ${regenerate}`);
});
