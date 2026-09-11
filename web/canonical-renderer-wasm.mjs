const WASM_PAGE_BYTES = 65_536;

// The compiler emits one complete class expression. Composition keeps that
// output intact and uses its public memory/module/import API.
export function cmajorInitialMemoryPages(source) {
    const Program = Function(`"use strict"; return (${source});`)();
    return new Program().getMemoryRequirements().minimumPages;
}

function importedMemoryMinimum(bytes) {
    let at = 8;
    const integer = () => {
        let value = 0;
        for (let shift = 0; shift <= 28; shift += 7) {
            if (at >= bytes.length) throw new Error('Truncated renderer Wasm');
            const next = bytes[at++];
            value += (next & 127) * 2 ** shift;
            if (!(next & 128)) return value;
        }
        throw new Error('Invalid renderer Wasm integer');
    };
    const string = () => { const length = integer(); const end = at + length; if (end > bytes.length) throw new Error('Truncated renderer import'); const value = new TextDecoder().decode(bytes.subarray(at, end)); at = end; return value; };
    while (at < bytes.length) {
        const section = bytes[at++], length = integer(), end = at + length;
        if (end > bytes.length) throw new Error('Truncated renderer section');
        if (section === 2) {
            let minimum;
            const count = integer();
            for (let index = 0; index < count; index++) {
                const namespace = string(), name = string(), kind = bytes[at++];
                if (kind === 0) integer();
                else if (kind === 2) {
                    const flags = integer(), pages = integer(), maximum = integer();
                    if (namespace !== 'env' || name !== 'memory' || flags !== 3 || minimum !== undefined || maximum < pages)
                        throw new Error('Renderer must import exactly one bounded shared env.memory');
                    minimum = pages;
                } else throw new Error('Unsupported renderer import kind');
            }
            if (at !== end || minimum === undefined) throw new Error('Invalid renderer memory import');
            return minimum;
        }
        at = end;
    }
    throw new Error('Renderer does not import memory');
}

export function connectCanonicalRendererWasm(cmajorSource, rendererWasm, className = 'WavetableSynth') {
    if (!/^[A-Za-z_$][\w$]*$/.test(className)) throw new Error('Invalid generated class name');
    const module = new WebAssembly.Module(rendererWasm);
    const imports = WebAssembly.Module.imports(module);
    const allowed = new Set(['cmaj_sharedDataAddress', 'cmaj_sharedDataSize']);
    for (const imported of imports)
        if (imported.module !== 'env' || (imported.kind === 'function' ? !allowed.has(imported.name) : imported.kind !== 'memory'))
            throw new Error(`Unsupported renderer import ${imported.module}.${imported.name}`);
    const memory = new WebAssembly.Memory({ initial: importedMemoryMinimum(rendererWasm), maximum: 32768, shared: true });
    const instance = new WebAssembly.Instance(module, { env: { memory, cmaj_sharedDataAddress: () => 0, cmaj_sharedDataSize: () => 0 } });
    const minimumBytes = instance.exports.__heap_base?.value;
    const stackTop = instance.exports.__stack_pointer?.value;
    if (!Number.isSafeInteger(stackTop) || stackTop < cmajorInitialMemoryPages(cmajorSource)*WASM_PAGE_BYTES + 1048576)
        throw new Error("Renderer stack overlaps the Cmajor program region");
    if (!Number.isSafeInteger(minimumBytes) || minimumBytes <= cmajorInitialMemoryPages(cmajorSource) * WASM_PAGE_BYTES)
        throw new Error('Renderer must export its actual reserved memory extent');
    const rendererBytes = [...rendererWasm].join(',');
    return `// Composition through the authored Cmajor memory/module/import API.\nclass ${className} extends (\n${cmajorSource}\n)\n{
    getRuntimeMemoryRequirements() { return { minimumBytes: ${minimumBytes} }; }
    async compileExternalModules() { return [await WebAssembly.compile(new Uint8Array([${rendererBytes}]))]; }
    async initialise(sessionID, frequency, options = {}) {
        const requirements = this.getMemoryRequirements();
        const memory = options.memory ?? new WebAssembly.Memory({initial:Math.ceil(this.getRuntimeMemoryRequirements().minimumBytes/65536),maximum:requirements.maximumPages,shared:true});
        const modules = options.externalModules ?? await this.compileExternalModules();
        const renderer = new WebAssembly.Instance(modules[0], {env:{memory,
            cmaj_sharedDataAddress: options.sharedDataAddress ?? (() => 0),
            cmaj_sharedDataSize: options.sharedDataSize ?? (() => 0)}});
        renderer.exports._initialize?.();
        const module = options.module ?? await this.compile();
        const externalFunctions = {...options.externalFunctions};
        for (const imported of WebAssembly.Module.imports(module))
            if (imported.kind === 'function' && typeof renderer.exports[imported.name] === 'function')
                externalFunctions[imported.name] = renderer.exports[imported.name];
        return super.initialise(sessionID, frequency, {...options,memory,module,externalFunctions});
    }
}\n`;
}

export const canonicalRendererWasmLayout = Object.freeze({ pageBytes: WASM_PAGE_BYTES });
