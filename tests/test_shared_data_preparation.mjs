import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
assert.ok(source, 'Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the authored Cmajor checkout');
const { createSharedDataMemory, createSharedDataPreparation, createSharedDataReader } = await import(
    pathToFileURL(path.join(source, 'javascript/cmaj_api/cmaj-shared-data.js')));

function open() {
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 4, shared: true });
    const host = createSharedDataMemory({ memory, programBytes: 65536, inputCount: 2, maxRetainedBytes: 1024 });
    const replies = [];
    let scope = { owner: 'worker', document: 1 };
    const preparation = createSharedDataPreparation(host, 2, { scope: () => scope, reply: body => replies.push(body) });
    const reader = createSharedDataReader(host.readerConfiguration);
    return { host, preparation, reader, replies, setScope: value => { scope = value; } };
}

test('direct publication acknowledges only completed audio adoption with its saved scope', async () => {
    const f = open();
    const reservation = f.preparation.api.reserve(0, 16);
    new Float32Array(reservation.buffer, reservation.byteOffset, 4).set([1, 2, 3, 4]);
    const submitted = await f.preparation.api.commit(reservation.id);
    assert.equal(submitted.kind, 'submitted');
    assert.deepEqual(f.preparation.drain(), []);
    f.reader.beginBlock();
    assert.deepEqual(f.preparation.drain(), []);
    f.reader.endBlock();
    f.setScope({ owner: 'worker', document: 2 });
    f.preparation.drain();
    assert.deepEqual(f.replies, [{ kind: 'applied', id: reservation.id, input: 0,
        generation: submitted.generation, serial: submitted.serial, scope: { owner: 'worker', document: 1 } }]);
    assert.deepEqual(f.preparation.drain(), []);
    f.preparation.stop(); f.host.stop();
});

test('direct receipts are not lost when another reservation drains control storage', async () => {
    const f = open();
    const first = f.preparation.api.reserve(0, 16);
    await f.preparation.api.commit(first.id);
    f.reader.beginBlock(); f.reader.endBlock();
    f.preparation.api.reserve(1, 16);
    assert.equal(f.replies.length, 1);
    assert.equal(f.replies[0].id, first.id);
    assert.equal(f.replies[0].kind, 'applied');
    f.preparation.stop(); f.host.stop();
});

test('supersession, cancellation after commit and scope revocation settle without claiming adoption', async () => {
    const f = open();
    const first = f.preparation.api.reserve(0, 16);
    await f.preparation.api.commit(first.id);
    const second = f.preparation.api.reserve(0, 16);
    assert.equal(f.replies[0].reason, 'superseded');
    await f.preparation.api.commit(second.id);
    f.preparation.api.cancel(second.id);
    assert.equal(f.replies[1].reason, 'cancelled');
    f.reader.beginBlock(); f.reader.endBlock(); f.preparation.drain();
    assert.equal(f.replies.length, 2);
    const third = f.preparation.api.reserve(0, 16);
    await f.preparation.api.commit(third.id);
    f.preparation.revoke();
    assert.equal(f.replies[2].reason, 'stale-scope');
    f.setScope(undefined);
    assert.throws(() => f.preparation.api.reserve(0, 16), /active worker scope/);
    f.reader.beginBlock(); f.reader.endBlock(); f.preparation.drain();
    assert.equal(f.replies.length, 3);
    f.preparation.stop(); f.host.stop();
});
