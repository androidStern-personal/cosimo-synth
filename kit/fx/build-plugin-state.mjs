import { build } from "esbuild";
import { writeFile, rm, cp } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Evaluate inert declarations once at build time; never start the worker here. */
export async function buildPluginState({ source, runtimeRoot, repoRoot }) {
    const output = path.join(runtimeRoot, ".state-declaration.mjs");
    const definition = JSON.stringify(path.join(repoRoot, source));
    const helpers = JSON.stringify(path.join(repoRoot, "kit/ui/plugin-state-definition.ts"));
    await build({
        stdin: { contents: `import definition from ${definition};
import {sharedStateResources,getDefinitionOptions} from ${helpers};
export const options=getDefinitionOptions(definition);
export const resources=sharedStateResources(definition).map(resource=>({...resource,storage:definition[resource.key].engine.storage,native:definition[resource.key].engine.native}));`,
            resolveDir: repoRoot, sourcefile: "plugin-state-build.ts", loader: "ts" },
        outfile: output, bundle: true, platform: "node", format: "esm", logLevel: "silent",
    });
    let declaration;
    try { declaration = await import(`${pathToFileURL(output).href}?build=${Date.now()}`); }
    finally { await rm(output, { force: true }); }
    const { resources, options } = declaration;
    if (!resources.length) return { source: [], resources };
    const functions = resources.map(({ key, input }) => `    namespace ${key}
    {
        let inputIndex = ${input};
        int size() { return cmaj::data::size(inputIndex); }
        float read(int index) { return cmaj::data::read(inputIndex, index); }
        int readInt(int index) { return cmaj::data::readInt32(inputIndex, index); }
    }`).join("\n");
    await writeFile(path.join(runtimeRoot, "PluginState.cmajor"), `// Generated from the plugin state declaration. Do not edit.
namespace cmaj::data
{
    external float read(int inputIndex, int sampleIndex);
    external int readInt32(int inputIndex, int wordIndex);
    external int size(int inputIndex);
}
namespace PluginState
{
${functions}
}
`);
    await writeFile(path.join(runtimeRoot, "plugin-state-resources.json"), JSON.stringify({
        inputCount: resources.length, maxRetainedBytes: options.memoryBudgetBytes, resources,
    }, null, 2) + "\n");
    await writeFile(path.join(runtimeRoot, "PluginState.h"), nativeHeader(resources));
    await cp(path.join(repoRoot, "kit/native"), path.join(runtimeRoot, "plugin-state-native"), { recursive: true });
    return { source: ["PluginState.cmajor"], resources,
        sharedData: { format: "bytes", inputCount: resources.length, maxRetainedBytes: options.memoryBudgetBytes } };
}

function floatLiteral(value) { const text=String(value); return (/[.e]/i.test(text)?text:`${text}.0`)+"f"; }

function nativeHeader(resources) {
    const declarations=[];
    const claimedTypes=new Set(['Data',...resources.map(resource=>resource.key)]);
    const claimType=name=>{let candidate=name,serial=1;while(claimedTypes.has(candidate))candidate=`${name}_${++serial}`;claimedTypes.add(candidate);return candidate;};
    for(const {key,input,native} of resources) {
        if(!native) continue;
        let offset=0;
        const definitions=[],checks=[];
        function describe(layout,name,access,value) {
            if(layout.kind==='float32') {
                checks.push(`builder_kit::native_state::decodeFloat(bytes, ${offset++}, ${floatLiteral(layout.min)}, ${floatLiteral(layout.max)}, ${access})`);
                return {type:'float',initial:floatLiteral(value)};
            }
            if(layout.kind==='bool') {
                checks.push(`builder_kit::native_state::decodeBool(bytes, ${offset++}, ${access})`);
                return {type:'bool',initial:value?'true':'false'};
            }
            if(layout.kind==='enum') {
                name=claimType(name);
                definitions.push(`enum class ${name} : std::int32_t { ${layout.choices.join(', ')} };`);
                checks.push(`builder_kit::native_state::decodeEnum(bytes, ${offset++}, ${layout.choices.length}, ${access})`);
                return {type:name,initial:`${name}::${value}`};
            }
            name=claimType(name);
            const members=Object.entries(layout.fields).map(([member,child])=>({member,...describe(child,`${name}_${member}`,`${access}.${member}`,value[member])}));
            definitions.push(`struct ${name} { ${members.map(({member,type})=>`${type} ${member};`).join(' ')} };`);
            return {type:name,initial:`${name}{${members.map(member=>member.initial).join(', ')}}`};
        }
        const described=describe(native.layout,`${key}_value`,'value',native.initial);
        const codecName=claimType(`${key}_codec`);
        declarations.push(...definitions,`struct ${codecName} {
    static constexpr std::size_t wordCount = ${offset};
    static bool decode(const void* bytes, ${described.type}& value) noexcept { return ${checks.join(' && ')}; }
};
inline constexpr builder_kit::native_state::Value<${described.type}, ${codecName}, Data> ${key}{${input}, ${described.initial}};`);
    }
    return `// Generated from the plugin state declaration. Do not edit.
#pragma once
#include "plugin-state-native/native_state/NativeValue.h"
#if defined(__wasm__)
#include "plugin-state-native/shared_data/WasmSharedData.h"
#else
#include "plugin-state-native/shared_data/NativeSharedData.h"
#endif
namespace PluginState {
#if defined(__wasm__)
using Data = builder_kit::shared_data::WasmData<${resources.length}>;
#else
using Data = builder_kit::shared_data::NativeData<${resources.length}>;
#endif
${declarations.join('\n')}
}
`;
}
