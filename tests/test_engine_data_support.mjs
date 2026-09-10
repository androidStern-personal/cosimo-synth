import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(repo, "build/native_engine_data");
const generatedBuild = path.join(repo, "build/engine_data_codegen");
let executable;
let generatedExecutable;
let generatedWasm;

function engineDataPaths() {
    const source = process.env.COSIMO_ENGINE_DATA_CMAJOR_SOURCE;
    const runtime = process.env.COSIMO_CMAJOR_RUNTIME_LIBRARY;
    if (!source || !runtime) {
        throw new Error("Set COSIMO_ENGINE_DATA_CMAJOR_SOURCE and COSIMO_CMAJOR_RUNTIME_LIBRARY to the qualified toolchain.");
    }
    return {
        source,
        runtime,
        modulePath: path.join(repo, "kit/cmajor/engine-data.cmajor"),
        fixturePath: path.join(repo, "tests/native/fixtures/engine_data/EngineData.cmajor"),
    };
}

export function buildEngineDataProbe() {
    const { source, ...paths } = engineDataPaths();
    if (!executable) {
        mkdirSync(build, { recursive: true });
        executable = path.join(build, "EngineDataProbe");
        const result = spawnSync("/usr/bin/c++", [
            "-std=c++17", "-O1", "-g0", "-DCMAJOR_DLL=1",
            "-I", path.join(source, "include"),
            path.join(repo, "tests/native/EngineDataProbe.cpp"),
            "-o", executable,
        ], { encoding: "utf8", timeout: 60_000 });
        if (result.error || result.status !== 0) {
            throw new Error(`EngineDataProbe compile failed: ${result.error?.message ?? result.stderr}`);
        }
    }
    return { executable, ...paths };
}

export function buildEngineDataGeneratedProbe() {
    const { source, ...paths } = engineDataPaths();
    if (!generatedExecutable) {
        mkdirSync(generatedBuild, { recursive: true });
        const generator = process.env.COSIMO_ENGINE_DATA_CODEGEN;
        if (!generator) throw new Error("Set COSIMO_ENGINE_DATA_CODEGEN to the qualified Cmajor codegen executable.");
        const generatedSource = path.join(generatedBuild, "EngineDataGenerated.h");
        const commands = [
            [generator, [path.join(repo, "tests/native/fixtures/engine_data/EngineData.cmajorpatch"),
                generatedSource, "EngineDataGenerated", "--target", "cpp", "--max-frames-per-block", "512"]],
            ["/usr/bin/c++", ["-std=c++17", "-O1", "-g0", "-DCMAJOR_DLL=1", "-I", path.join(source, "include"),
                `-DENGINE_DATA_GENERATED_SOURCE="${generatedSource}"`,
                path.join(repo, "tests/native/EngineDataProbe.cpp"), "-o", path.join(generatedBuild, "EngineDataGeneratedProbe")]],
        ];
        for (const [command, args] of commands) {
            const result = spawnSync(command, args, { encoding: "utf8", timeout: 60_000 });
            if (result.error || result.status !== 0) {
                throw new Error(`EngineData generated build failed: ${[result.error?.message, result.stderr].filter(Boolean).join("\n")}`);
            }
        }
        generatedExecutable = path.join(generatedBuild, "EngineDataGeneratedProbe");
    }
    return { ...paths, executable: generatedExecutable };
}

function buildEngineDataWasm() {
    engineDataPaths();
    if (!generatedWasm) {
        const generator = process.env.COSIMO_ENGINE_DATA_CODEGEN;
        if (!generator) throw new Error("Set COSIMO_ENGINE_DATA_CODEGEN to the qualified Cmajor codegen executable.");
        mkdirSync(generatedBuild, { recursive: true });
        const output = path.join(generatedBuild, "EngineDataGenerated.js");
        const result = spawnSync(generator, [
            path.join(repo, "tests/native/fixtures/engine_data/EngineData.cmajorpatch"),
            output, "EngineDataGenerated", "--target", "javascript", "--max-frames-per-block", "512",
        ], { encoding: "utf8", timeout: 60_000 });
        if (result.error || result.status !== 0) {
            throw new Error(`EngineData Wasm codegen failed: ${[result.error?.message, result.stderr].filter(Boolean).join("\n")}`);
        }
        generatedWasm = output;
    }
    return generatedWasm;
}

export function runEngineData(commands) {
    const backend = process.env.COSIMO_ENGINE_DATA_BACKEND ?? "jit";
    const options = {
        input: commands.map(command => JSON.stringify(command)).join("\n") + "\n",
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30_000,
    };
    if (backend === "wasm") {
        const result = spawnSync(process.execPath, [
            path.join(repo, "tests/native/EngineDataWasmRunner.mjs"), buildEngineDataWasm(),
        ], options);
        if (result.error || result.status !== 0) {
            throw new Error(`EngineData Wasm run failed: ${[result.error?.message, result.stderr].filter(Boolean).join("\n")}`);
        }
        return result.stdout.trim().split("\n").map(line => JSON.parse(line));
    }
    if (backend !== "jit" && backend !== "cpp") throw new Error(`Unknown engine data test backend: ${backend}`);
    const { executable, runtime, modulePath, fixturePath } = backend === "cpp"
        ? buildEngineDataGeneratedProbe() : buildEngineDataProbe();
    // A generated performer must run without loading a JIT library. An
    // accidental fallback therefore fails instead of silently passing here.
    const runtimeArgument = backend === "cpp" ? "engine-data-no-jit-library" : runtime;
    const result = spawnSync(executable, [runtimeArgument, modulePath, fixturePath], options);
    if (result.error || result.status !== 0) {
        throw new Error(`EngineDataProbe run failed: ${[result.error?.message, result.stderr].filter(Boolean).join("\n")}`);
    }
    return result.stdout.trim().split("\n").map(line => JSON.parse(line));
}
