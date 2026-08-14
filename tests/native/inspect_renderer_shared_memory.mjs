import fs from "node:fs";

const modulePath = process.argv[2];
const memoryBase = Number(process.argv[3]);
if (!modulePath || !Number.isInteger(memoryBase) || memoryBase <= 0) {
    throw new Error("usage: inspect_renderer_shared_memory.mjs <renderer.wasm> <memory-base>");
}

const bytes = fs.readFileSync(modulePath);
const module = new WebAssembly.Module(bytes);
const imports = WebAssembly.Module.imports(module);
if (
    imports.length !== 1
    || imports[0].module !== "env"
    || imports[0].name !== "memory"
    || imports[0].kind !== "memory"
) {
    throw new Error(`renderer imports were not exactly env.memory: ${JSON.stringify(imports)}`);
}

const exports = WebAssembly.Module.exports(module);
if (!exports.some(({ name, kind }) => (
    name === "CosimoThreeOscillatorRenderer__renderAll" && kind === "function"
))) {
    throw new Error("renderer Wasm did not export the canonical function");
}

const memory = new WebAssembly.Memory({ initial: 64 });
const bytesBeforeRenderer = new Uint8Array(memory.buffer, 0, memoryBase);
bytesBeforeRenderer.fill(0xa5);
const instance = await WebAssembly.instantiate(module, { env: { memory } });
const stackPointer = instance.exports.__stack_pointer?.value;
if (!Number.isInteger(stackPointer) || stackPointer < memoryBase) {
    throw new Error(
        `renderer stack starts below its assigned memory: ${stackPointer} < ${memoryBase}`,
    );
}
if (stackPointer >= memory.buffer.byteLength) {
    throw new Error(`renderer stack exceeds shared memory: ${stackPointer}`);
}
const rejected = instance.exports.CosimoThreeOscillatorRenderer__renderAll(...Array(36).fill(0));
if (rejected !== 0) {
    throw new Error(`renderer accepted invalid empty slices: ${rejected}`);
}
if (bytesBeforeRenderer.some((value) => value !== 0xa5)) {
    throw new Error("renderer stack or initialisation changed memory below its assigned base");
}

console.log("PASS renderer Wasm shares memory without overlap");
