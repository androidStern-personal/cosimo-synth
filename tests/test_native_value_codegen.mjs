import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, symlink, writeFile, readFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { loadUIModule } from '../kit/tests/helpers/load_ui_module.mjs';

const root = path.resolve(import.meta.dirname, '..');
const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
assert.ok(source, 'Set COSIMO_PLUGIN_STATE_CMAJOR_SOURCE to the authored Cmajor checkout');
const buildRoot = path.join(root, 'build/shared_state_native_final');
await mkdir(buildRoot, { recursive: true });
const staging = await mkdtemp(path.join(buildRoot, 'generated-values-'));
await mkdir(path.join(staging, 'kit'));
await Promise.all([
    ...['fx', 'ui', 'native', 'cmajor', 'index.ts', 'package.json', 'kit.json'].map(file =>
        cp(path.join(root, 'kit', file), path.join(staging, 'kit', file), { recursive: true })),
    cp(path.join(root, 'tests/native/fixtures/plugin_state_shared_data'), path.join(staging, 'fx/shared_mseg'), { recursive: true }),
    symlink(path.join(root, 'node_modules'), path.join(staging, 'node_modules')),
    writeFile(path.join(staging, 'package.json'), JSON.stringify({ private: true, type: 'module' })),
]);
const runtime = path.join(staging, 'build/fx/shared_mseg_runtime');
const qualifiedRuntime = path.join(staging, 'qualified-runtime');
const authoredState = expression => `import { definePluginState, parameter, Mseg, nativeValue, Native } from '../../kit/index';
export default definePluginState({ gain: parameter('gain'), shape: Mseg.state(), ${expression} }, { memoryBudgetBytes: 32768 });\n`;
async function buildState(expression) {
    await writeFile(path.join(staging, 'fx/shared_mseg/state.ts'), authoredState(expression));
    return spawnSync(process.execPath, ['kit/fx/build-effect.mjs', 'shared-mseg'], { cwd: staging, encoding: 'utf8', timeout: 30000 });
}

test('normal build emits nested native values that compile and read actual authored bytes', async () => {
    const result = await buildState(`
settings: nativeValue({ codec: Native.record({
    a: Native.record({ b: Native.choice(['low', 'high']) }), a_b: Native.choice(['off', 'on']),
    amount: Native.number({min: 0, max: 2}), enabled: Native.boolean(), mode: Native.choice(['clean', 'warm']),
}), initial: { a: { b: 'low' }, a_b: 'off', amount: 1, enabled: true, mode: 'clean' } }),
settings_value: nativeValue({ codec: Native.number(), initial: 0.25 }),
settings_codec: nativeValue({ codec: Native.boolean(), initial: false }),`);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    // Later rejection cases use the same normal build directory. Retain exactly
    // the successful generated candidate for compiled proof and inspection.
    await cp(runtime, qualifiedRuntime, { recursive: true });
    const { default: definition } = await loadUIModule(staging, 'fx/shared_mseg/state.ts');
    const parsed = definition.settings.codec.parse({ a: { b: 'high' }, a_b: 'on', amount: 1.5, enabled: false, mode: 'warm' });
    assert.equal(parsed.kind, 'ok');
    const bytes = new Uint8Array(definition.settings.engine.storage.fixedLength);
    definition.settings.engine.prepare(parsed.value, bytes, {});
    const payload = path.join(staging, 'prepared-settings.bin');
    await writeFile(payload, bytes);
    const resources = JSON.parse(await readFile(path.join(qualifiedRuntime, 'plugin-state-resources.json'), 'utf8'));
    const settings = resources.resources.find(resource => resource.key === 'settings');
    const executable = path.join(staging, 'generated-native-values');
    execFileSync(process.env.CXX ?? 'c++', ['-std=c++17', '-O1', '-g', '-Wall', '-Wextra', '-Werror',
        '-pthread', '-fsanitize=address,undefined', '-fno-omit-frame-pointer',
        '-I', path.join(source, 'include'), '-I', qualifiedRuntime, `-DSETTINGS_INPUT=${settings.input}`,
        `-DINPUT_COUNT=${resources.inputCount}`, path.join(root, 'tests/native/GeneratedNativeValueTests.cpp'), '-o', executable],
    { encoding: 'utf8', timeout: 120000 });
    assert.match(execFileSync(executable, [payload], { encoding: 'utf8', timeout: 30000 }), /PASS generated nativeValue/);
});

test('generated nested native getter reads shared Wasm storage', {
    skip: !process.env.COSIMO_NATIVE_VALUE_WASM_CXX,
}, async () => {
    const sysroot = process.env.COSIMO_NATIVE_VALUE_WASI_SYSROOT;
    const includes = process.env.COSIMO_NATIVE_VALUE_WASI_CXX_INCLUDE;
    assert.ok(sysroot && includes, 'Set COSIMO_NATIVE_VALUE_WASI_SYSROOT and COSIMO_NATIVE_VALUE_WASI_CXX_INCLUDE');
    const wasm = path.join(staging, 'generated-native-values.wasm');
    execFileSync(process.env.COSIMO_NATIVE_VALUE_WASM_CXX, [
        '--target=wasm32-unknown-wasip1', `--sysroot=${sysroot}`, '-mexec-model=reactor', '-std=c++17',
        '-O3', '-ffast-math', '-matomics', '-mbulk-memory', '-fignore-exceptions', '-fno-rtti', '-nostdlib++',
        '-isystem', includes, '-I', qualifiedRuntime, path.join(root, 'tests/native/GeneratedNativeValueWasm.cpp'),
        '-Wl,--import-memory', '-Wl,--shared-memory', '-Wl,--no-check-features', '-Wl,--max-memory=2097152',
        ...['beginSharedBlock', 'endSharedBlock', 'readSettings', 'readScalar', 'readBoolean', '__heap_base'].map(name => `-Wl,--export=${name}`),
        '-Wl,--global-base=65536', '-Wl,-z,stack-size=65536', '-o', wasm,
    ], { encoding: 'utf8', timeout: 30000 });
    const { createSharedDataMemory, createSharedDataPreparation, createSharedDataReader } = await import(
        pathToFileURL(path.join(source, 'javascript/cmaj_api/cmaj-shared-data.js')));
    const memory = new WebAssembly.Memory({ initial: 8, maximum: 32, shared: true });
    let reader;
    const module = await WebAssembly.compile(await readFile(wasm));
    const { exports: native } = new WebAssembly.Instance(module, { env: { memory,
        cmaj_sharedDataAddress: input => reader.address(input), cmaj_sharedDataSize: input => reader.size(input) } });
    native._initialize?.();
    const resources = JSON.parse(await readFile(path.join(qualifiedRuntime, 'plugin-state-resources.json'), 'utf8'));
    const host = createSharedDataMemory({ memory, programBytes: native.__heap_base.value,
        inputCount: resources.inputCount, maxRetainedBytes: 1024 });
    reader = createSharedDataReader(host.readerConfiguration);
    const preparation = createSharedDataPreparation(host, resources.inputCount);
    const input = resources.resources.find(resource => resource.key === 'settings').input;
    const bytes = await readFile(path.join(staging, 'prepared-settings.bin'));
    async function publish(bytes) {
        const allocation = preparation.api.reserve(input, bytes.byteLength);
        new Uint8Array(allocation.buffer, allocation.byteOffset, allocation.byteLength).set(bytes);
        await preparation.api.commit(allocation.id);
    }
    function read() {
        reader.beginBlock(); native.beginSharedBlock();
        const result = native.readSettings();
        native.endSharedBlock(); reader.endBlock(); preparation.drain();
        return result;
    }
    assert.equal(native.readSettings(), 11);
    assert.equal(native.readScalar(), 0.25);
    assert.equal(native.readBoolean(), 0);
    await publish(bytes);
    assert.equal(read(), 11101.5);
    assert.equal(native.readSettings(), 11, 'generated reader retained a pointer outside a block');
    const corrupt = Uint8Array.from(bytes);
    new DataView(corrupt.buffer).setUint32(8, 0x7fc00000, true);
    await publish(corrupt);
    assert.equal(read(), 11, 'fast-math generated reader accepted NaN');
    preparation.stop(); host.stop();
    await writeFile(path.join(buildRoot, 'generated-wasm-proof.json'), JSON.stringify({ wasm,
        payload: path.join(staging, 'prepared-settings.bin'), runtime: qualifiedRuntime, input, inputCount: resources.inputCount }) + '\n');
});

test('Chromium executes generated native getter with complete snapshots across blocks', {
    skip: !process.env.COSIMO_NATIVE_VALUE_WASM_CXX,
}, async () => {
    const { chromium } = await import('playwright');
    const server = createServer(async (request, response) => {
        try {
            const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
            const files = { '/getter.wasm': path.join(staging, 'generated-native-values.wasm'),
                '/payload.bin': path.join(staging, 'prepared-settings.bin') };
            const apiRoot = path.join(source, 'javascript/cmaj_api');
            const file = pathname.startsWith('/cmaj_api/') ? path.resolve(apiRoot, pathname.slice(10)) : files[pathname];
            if (pathname !== '/' && (!file || (pathname.startsWith('/cmaj_api/') && !file.startsWith(apiRoot + path.sep))))
                throw new Error('Unknown test resource');
            const body = pathname === '/' ? '<!doctype html><title>Generated nativeValue runtime proof</title>' : await readFile(file);
            response.writeHead(200, { 'content-type': pathname === '/' ? 'text/html' : pathname.endsWith('.js') ? 'text/javascript' : 'application/octet-stream',
                'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' });
            response.end(body);
        } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        const resources = JSON.parse(await readFile(path.join(qualifiedRuntime, 'plugin-state-resources.json'), 'utf8'));
        const result = await page.evaluate(async ({ input, inputCount }) => {
            const check = (condition, message) => { if (!condition) throw new Error(message); };
            check(crossOriginIsolated, 'browser is not cross-origin isolated');
            const { createSharedDataMemory, createSharedDataPreparation, createSharedDataReader } = await import('/cmaj_api/cmaj-shared-data.js');
            const module = await WebAssembly.compile(await (await fetch('/getter.wasm')).arrayBuffer());
            const bytes = new Uint8Array(await (await fetch('/payload.bin')).arrayBuffer());
            const memory = new WebAssembly.Memory({ initial: 8, maximum: 32, shared: true });
            let reader;
            const { exports: native } = new WebAssembly.Instance(module, { env: { memory,
                cmaj_sharedDataAddress: input => reader.address(input), cmaj_sharedDataSize: input => reader.size(input) } });
            native._initialize?.();
            const host = createSharedDataMemory({ memory, programBytes: native.__heap_base.value, inputCount, maxRetainedBytes: 1024 });
            reader = createSharedDataReader(host.readerConfiguration);
            const receipts = [];
            const preparation = createSharedDataPreparation(host, inputCount, { reply: receipt => receipts.push(receipt) });
            const begin = () => { reader.beginBlock(); native.beginSharedBlock(); };
            const end = () => { native.endSharedBlock(); reader.endBlock(); preparation.drain(); };
            async function publish(value) {
                const allocation = preparation.api.reserve(input, value.byteLength);
                new Uint8Array(allocation.buffer, allocation.byteOffset, allocation.byteLength).set(value);
                await preparation.api.commit(allocation.id);
            }
            try {
                check(native.readSettings() === 11 && native.readScalar() === 0.25 && native.readBoolean() === 0, 'generated defaults differ in Chromium');
                await publish(bytes);
                check(receipts.length === 0, 'submission was acknowledged before audio adoption');
                begin(); check(native.readSettings() === 11101.5, 'generated getter did not decode authored browser allocation'); end();
                check(receipts.length === 1 && receipts[0].kind === 'applied', 'browser adoption receipt missing');
                const next = new Uint8Array(20);
                new DataView(next.buffer).setFloat32(8, 0.5, true);
                begin();
                const oldBlock = [];
                for (let i = 0; i < 128; i++) {
                    if (i === 64) await publish(next);
                    oldBlock.push(native.readSettings());
                }
                check(oldBlock.every(value => value === 11101.5), 'publication exposed a partial or new record in the current block');
                end(); begin();
                const nextBlock = Array.from({ length: 128 }, () => native.readSettings());
                check(nextBlock.every(value => value === 0.5), 'next block did not adopt the complete replacement');
                end(); check(native.readSettings() === 11, 'browser retained the generated pointer outside the block');
                for (const [offset, word] of [[0, -1], [4, 99], [8, 0x7fc00000], [12, 2], [16, -1]]) {
                    const invalid = Uint8Array.from(bytes);
                    new DataView(invalid.buffer).setInt32(offset, word, true);
                    await publish(invalid); begin();
                    check(native.readSettings() === 11, 'invalid member partially changed generated record'); end();
                }
                for (const length of [16, 24]) {
                    await publish(new Uint8Array(length)); begin();
                    check(native.readSettings() === 11, 'incorrect record size accepted by generated browser reader'); end();
                }
                return { isolated: crossOriginIsolated, oldBlockSamples: oldBlock.length, newBlockSamples: nextBlock.length,
                    invalidRecords: 7, appliedReceipts: receipts.filter(receipt => receipt.kind === 'applied').length };
            } finally { preparation.stop(); host.stop(); }
        }, { input: resources.resources.find(resource => resource.key === 'settings').input, inputCount: resources.inputCount });
        assert.deepEqual(result, { isolated: true, oldBlockSamples: 128, newBlockSamples: 128, invalidRecords: 7, appliedReceipts: 9 });
        assert.deepEqual(errors, []);
        await writeFile(path.join(buildRoot, 'generated-native-value-browser.json'), JSON.stringify(result, null, 2) + '\n');
    } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});

test('normal build rejects author keywords, reserved prototypes and invalid defaults', async () => {
    for (const [expression, message] of [
        [`settings: nativeValue({codec: Native.choice(['class']), initial: 'class'})`, /distinct C\+\+ identifiers/],
        [`settings: nativeValue({codec: Native.record({class: Native.boolean()}), initial: {class: true}})`, /non-reserved C\+\+ identifiers/],
        [`settings: nativeValue({codec: Native.record({['__proto__']: Native.number()}), initial: {['__proto__']: 1}})`, /non-reserved C\+\+ identifiers/],
        [`input: nativeValue({codec: Native.boolean(), initial: true})`, /identifier/],
        [`Data: nativeValue({codec: Native.boolean(), initial: true})`, /identifier/],
        [`settings: nativeValue({codec: Native.number({min:0,max:2}), initial: 3})`, /finite range/],
    ]) {
        const result = await buildState(expression);
        assert.notEqual(result.status, 0, `normal build accepted ${expression}`);
        assert.match(result.stderr + result.stdout, message);
    }
});
