import fs from 'node:fs/promises';

const modulePath = process.argv[2];
if (!modulePath) {
    throw new Error('usage: node run_three_oscillator_renderer_wasm_oracle.mjs MODULE.wasm');
}

const bytes = await fs.readFile(modulePath);
const { instance } = await WebAssembly.instantiate(bytes, {});
instance.exports._initialize?.();
const fingerprint = instance.exports.three_osc_renderer_oracle();
if (!Number.isInteger(fingerprint) || fingerprint <= 0) {
    throw new Error(`renderer oracle failed with ${fingerprint}`);
}
const detuneResult = instance.exports.three_osc_dynamic_detune_oracle(250);
if (detuneResult !== 4242) {
    throw new Error(`dynamic Wasm detune oracle failed with ${detuneResult}`);
}
process.stdout.write(`${fingerprint}\n`);
