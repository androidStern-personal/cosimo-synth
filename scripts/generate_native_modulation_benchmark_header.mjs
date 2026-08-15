#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
    buildModulationRuntimeEvents,
    deserializeModulationState,
} from "../patch_gui/modulation.js";
import { compileModulationRuntimeProgram } from "../patch_gui/modulation-runtime-program.js";
import { buildModulationBenchmarkDocument } from "./generate_modulation_benchmark_profiles.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function readOutputPath(argv) {
    const outputIndex = argv.indexOf("--output");
    if (outputIndex < 0 || typeof argv[outputIndex + 1] !== "string") {
        throw new Error("Usage: generate_native_modulation_benchmark_header.mjs --output <path>");
    }
    return path.resolve(argv[outputIndex + 1]);
}

function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

function cppString(value) {
    return JSON.stringify(String(value));
}

function cppFloat(value) {
    if (!Number.isFinite(value)) throw new Error(`Cannot emit non-finite float ${String(value)}`);
    if (Object.is(value, -0)) return "-0.0f";
    if (Number.isInteger(value)) return `${value}.0f`;
    return `${value}f`;
}

function cppInt(value) {
    if (!Number.isInteger(value)) throw new Error(`Cannot emit non-integer ${String(value)}`);
    return String(value);
}

const programArrayFields = [
    ["voiceRouteCells", "int"],
    ["voiceRouteSources", "int"],
    ["voiceRouteTargets", "int"],
    ["voiceRoutePolarities", "int"],
    ["voiceRouteAmounts", "float"],
    ["macroVoiceRouteCells", "int"],
    ["macroVoiceRouteSources", "int"],
    ["macroVoiceRouteTargets", "int"],
    ["macroVoiceRoutePolarities", "int"],
    ["macroVoiceRouteAmounts", "float"],
    ["voiceRackRouteCells", "int"],
    ["voiceRackRouteSources", "int"],
    ["voiceRackRouteTargets", "int"],
    ["voiceRackRoutePolarities", "int"],
    ["voiceRackRouteReducers", "int"],
    ["voiceRackRouteAmounts", "float"],
    ["macroRackRouteCells", "int"],
    ["macroRackRouteSources", "int"],
    ["macroRackRouteTargets", "int"],
    ["macroRackRoutePolarities", "int"],
    ["macroRackRouteAmounts", "float"],
];

function commonSourceEvents(state) {
    return buildModulationRuntimeEvents(state).filter((event) => event.endpointID !== "modulationProgram");
}

function requireCommonSourceContract(events) {
    const msegBuffers = events.filter((event) => event.endpointID === "modulationMsegBuffer");
    const msegPlaybacks = events.filter((event) => event.endpointID === "modulationMsegPlayback");
    if (msegBuffers.length !== 6 || msegPlaybacks.length !== 3) {
        throw new Error("Neutral profile no longer installs the expected 6 MSEG buffers and 3 discrete playbacks");
    }
    for (const event of msegBuffers) {
        if (!Array.isArray(event.value.buffer)
            || event.value.buffer.length !== 2051
            || event.value.buffer.some((sample) => sample !== 0)) {
            throw new Error("Neutral benchmark MSEG buffers must remain exact zero through the production renderer");
        }
    }
    return { msegPlaybacks };
}

function emitMetadata(profile, stateSha256) {
    const counts = profile.compiledCounts;
    return `    { ${cppString(profile.name)}, ${profile.storedRouteCount}, ${profile.activeRouteCount}, { ${counts.voice}, ${counts.macroVoice}, ${counts.voiceRack}, ${counts.macroRack} }, ${cppString(stateSha256)} }`;
}

function emitProgramCase(profileIndex, program) {
    const lines = [
        `        case ${profileIndex}:`,
        "        {",
        "            destination = {};",
        `            destination.voiceRouteCount = ${cppInt(program.voiceRouteCount)};`,
        `            destination.macroVoiceRouteCount = ${cppInt(program.macroVoiceRouteCount)};`,
        `            destination.voiceRackRouteCount = ${cppInt(program.voiceRackRouteCount)};`,
        `            destination.macroRackRouteCount = ${cppInt(program.macroRackRouteCount)};`,
    ];
    for (const [field, kind] of programArrayFields) {
        const values = program[field];
        if (!Array.isArray(values)) throw new Error(`Compiled program omitted ${field}`);
        values.forEach((value, index) => {
            if (value === 0 && !Object.is(value, -0)) return;
            const literal = kind === "float" ? cppFloat(value) : cppInt(value);
            lines.push(`            destination.${field}[${index}] = ${literal};`);
        });
    }
    lines.push("            return;", "        }");
    return lines.join("\n");
}

function generateHeader() {
    const document = buildModulationBenchmarkDocument();
    const compiled = document.profiles.map((profile) => {
        const state = deserializeModulationState(profile.stateJSON);
        const program = compileModulationRuntimeProgram(state.routes);
        const counts = {
            voice: program.voiceRouteCount,
            macroVoice: program.macroVoiceRouteCount,
            voiceRack: program.voiceRackRouteCount,
            macroRack: program.macroRackRouteCount,
        };
        if (JSON.stringify(counts) !== JSON.stringify(profile.compiledCounts)) {
            throw new Error(`Profile ${profile.name} differs from its declared compiled counts`);
        }
        return {
            profile,
            state,
            program,
            stateSha256: sha256(profile.stateJSON),
        };
    });

    const referenceCommonEvents = commonSourceEvents(compiled[0].state);
    for (const entry of compiled.slice(1)) {
        if (JSON.stringify(commonSourceEvents(entry.state)) !== JSON.stringify(referenceCommonEvents)) {
            throw new Error(`Profile ${entry.profile.name} does not share the exact neutral source contract`);
        }
    }
    const { msegPlaybacks } = requireCommonSourceContract(referenceCommonEvents);

    const profileMetadata = compiled
        .map(({ profile, stateSha256 }) => emitMetadata(profile, stateSha256))
        .join(",\n");
    const programCases = compiled
        .map(({ program }, profileIndex) => emitProgramCase(profileIndex, program))
        .join("\n");
    const playbackRows = msegPlaybacks.map(({ value }) => (
        `    { ${cppInt(value.slot)}, ${value.holdFinalValue ? "true" : "false"}, ${cppInt(value.rateKind)}, ${value.loopEnabled ? "true" : "false"}, ${cppFloat(value.loopStart)}, ${cppFloat(value.loopEnd)}, ${cppInt(value.noteOffPolicy)}, ${value.legatoRestarts ? "true" : "false"} }`
    )).join(",\n");

    return `// Generated by ${path.basename(scriptPath)} from the shared production benchmark profiles.
// Do not edit this derived header.
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <stdexcept>

namespace cosimo::native_modulation_benchmark
{
struct CompiledCounts
{
    std::int32_t voice;
    std::int32_t macroVoice;
    std::int32_t voiceRack;
    std::int32_t macroRack;
};

struct ProfileMetadata
{
    const char* name;
    std::int32_t storedRouteCount;
    std::int32_t activeRouteCount;
    CompiledCounts compiledCounts;
    const char* stateSha256;
};

struct MsegPlayback
{
    std::int32_t slot;
    bool holdFinalValue;
    std::int32_t rateKind;
    bool loopEnabled;
    float loopStart;
    float loopEnd;
    std::int32_t noteOffPolicy;
    bool legatoRestarts;
};

inline constexpr const char* profileGenerator = ${cppString(document.generatedFrom)};
inline constexpr const char* profileDocumentSha256 = ${cppString(sha256(JSON.stringify(document)))};
inline constexpr std::int32_t expressionMidiValue = ${cppInt(document.sourceContract.expressionMidiValue)};
inline constexpr float macroValue = ${cppFloat(document.sourceContract.macroValue)};

inline constexpr std::array<ProfileMetadata, ${compiled.length}> profiles {{
${profileMetadata}
}};

inline constexpr std::array<MsegPlayback, ${msegPlaybacks.length}> msegPlaybacks {{
${playbackRows}
}};

inline void loadProgram (std::size_t profileIndex, WavetableSynth::wt_ModulationProgramUpload& destination)
{
    switch (profileIndex)
    {
${programCases}
        default:
            throw std::out_of_range ("Unknown native modulation benchmark profile");
    }
}
}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    const outputPath = readOutputPath(process.argv.slice(2));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, generateHeader());
}
