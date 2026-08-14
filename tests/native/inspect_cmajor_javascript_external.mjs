import fs from "node:fs";

const sourcePath = process.argv[2];
if (!sourcePath) {
    throw new Error("usage: inspect_cmajor_javascript_external.mjs <generated.js>");
}

const source = fs.readFileSync(sourcePath, "utf8");
const className = source.match(/^class\s+(\w+)/m)?.[1];
if (!className) {
    throw new Error("generated JavaScript did not contain a Cmajor class");
}

const CmajorClass = Function(`${source}\nreturn ${className};`)();
const performer = new CmajorClass();
const getWasmBytes = performer._getWasmBytes ?? performer._getWasmBytesSIMD;
if (typeof getWasmBytes !== "function") {
    throw new Error("generated JavaScript did not contain SIMD Wasm bytes");
}

const module = new WebAssembly.Module(getWasmBytes.call(performer));
const rendererImport = WebAssembly.Module.imports(module).find(
    ({ module: namespace, name, kind }) => (
        namespace === "env"
        && name === "CosimoThreeOscillatorRenderer__renderAll"
        && kind === "function"
    ),
);

if (!rendererImport) {
    throw new Error("generated Wasm did not import the canonical renderer");
}

console.log("PASS JavaScript imports canonical renderer");
