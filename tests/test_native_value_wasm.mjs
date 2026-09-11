import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
const wasmPath = process.env.COSIMO_NATIVE_VALUE_WASM;
assert.ok(source && wasmPath, 'Set authored Cmajor source and the compiled NativeValueTests.cpp Wasm path');
const { createSharedDataMemory, createSharedDataPreparation, createSharedDataReader } = await import(
    pathToFileURL(path.join(source, 'javascript/cmaj_api/cmaj-shared-data.js')));
const module = await WebAssembly.compile(await readFile(wasmPath));

test('compiled C++ NativeValue reads real shared Wasm allocation snapshots', async () => {
    const memory = new WebAssembly.Memory({ initial: 8, maximum: 32, shared: true });
    let reader;
    const { exports: native } = new WebAssembly.Instance(module, { env: { memory,
        cmaj_sharedDataAddress: input => reader.address(input), cmaj_sharedDataSize: input => reader.size(input) } });
    native._initialize?.();
    const host = createSharedDataMemory({ memory, programBytes: native.__heap_base.value, inputCount: 2, maxRetainedBytes: 1024 });
    reader = createSharedDataReader(host.readerConfiguration);
    const replies = [];
    const preparation = createSharedDataPreparation(host, 2, { scope: () => ({ owner: 'worker', document: 1 }), reply: body => replies.push(body) });
    async function submit(input, amount, enabled = 0, quality = 0) {
        const allocation = preparation.api.reserve(input, input === 0 ? 4 : 12);
        const floats = new Float32Array(allocation.buffer, allocation.byteOffset, allocation.byteLength / 4);
        const ints = new Int32Array(allocation.buffer, allocation.byteOffset, allocation.byteLength / 4);
        floats[0] = amount;
        if (input === 1) { ints[1] = enabled; ints[2] = quality; }
        return preparation.api.commit(allocation.id);
    }
    function begin() { reader.beginBlock(); native.beginSharedBlock(); }
    function end() { native.endSharedBlock(); reader.endBlock(); preparation.drain(); }
    assert.equal(native.readSettings(), 0.25);
    await submit(0, 0.75); await submit(1, 0.125, 1, 2);
    assert.equal(replies.length, 0);
    begin();
    assert.equal(native.readGain(), 0.75);
    assert.equal(native.readSettings(), 210.125);
    end();
    begin();
    await submit(1, 0.625, 0, 1);
    assert.equal(native.readSettings(), 210.125, 'pending setting changed compiled reader mid-block');
    end();
    begin();
    assert.equal(native.readSettings(), 100.625);
    end();
    assert.equal(native.readSettings(), 0.25, 'compiled reader retained a pointer outside the block');
    await submit(1, 0.9, 7, 1);
    begin(); assert.equal(native.readSettings(), 0.25, 'invalid boolean partly changed record'); end();
    await submit(0, Number.NaN);
    begin(); assert.equal(native.readGain(), 0.5, 'fast-math native reader accepted NaN'); end();
    assert.ok(replies.some(reply => reply.kind === 'applied'));
    preparation.stop(); host.stop();
});
