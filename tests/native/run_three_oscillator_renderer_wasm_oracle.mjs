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
process.stdout.write(`${fingerprint}\n`);
