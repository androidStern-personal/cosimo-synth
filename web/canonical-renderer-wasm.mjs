const WASM_PAGE_BYTES = 65_536;
const RENDERER_RESERVED_PAGES = 32;
const RENDERER_FUNCTION_NAME = "CosimoThreeOscillatorRenderer__renderAll";

function requireSingleMatch(source, expression, description) {
    const matches = [...source.matchAll(expression)];
    if (matches.length !== 1) {
        throw new Error(`Expected one ${description}, found ${matches.length}.`);
    }
    return matches[0];
}

export function cmajorInitialMemoryPages(source) {
    const match = requireSingleMatch(
        source,
        /const memory = new WebAssembly\.Memory \(\{ initial: ([0-9]+) \}\);/g,
        "Cmajor SIMD memory declaration",
    );
    return Number(match[1]);
}

export function connectCanonicalRendererWasm(cmajorSource, rendererWasm) {
    const memoryMatch = requireSingleMatch(
        cmajorSource,
        /const memory = new WebAssembly\.Memory \(\{ initial: ([0-9]+) \}\);/g,
        "Cmajor SIMD memory declaration",
    );
    requireSingleMatch(cmajorSource, /\n\s*env: \{\n/g, "Cmajor Wasm env import object");

    const rendererBytes = [...rendererWasm].join(",");
    const memorySetup = `${memoryMatch[0]}
    memory.grow (${RENDERER_RESERVED_PAGES});
    const rendererResult = await WebAssembly.instantiate (
      new Uint8Array([${rendererBytes}]),
      { env: { memory } });
    rendererResult.instance.exports._initialize?.();
    const rendererFunction = rendererResult.instance.exports.${RENDERER_FUNCTION_NAME};
    if (typeof rendererFunction !== "function")
      throw new Error ("Canonical oscillator renderer is unavailable");`;

    const withRenderer = cmajorSource.replace(memoryMatch[0], memorySetup);
    return withRenderer.replace(
        /(\n\s*env: \{\n)/,
        `$1        ${RENDERER_FUNCTION_NAME}: rendererFunction,\n`,
    );
}

export const canonicalRendererWasmLayout = Object.freeze({
    pageBytes: WASM_PAGE_BYTES,
    rendererReservedPages: RENDERER_RESERVED_PAGES,
});
