import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, cpus, platform } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(repo, "build/engine_data_bulk");
const modulePath = path.join(repo, "kit/cmajor/engine-data.cmajor");
const fixturePath = path.join(repo, "tests/native/fixtures/engine_data/EngineDataBulk.cmajor");
const backend = process.env.COSIMO_ENGINE_DATA_BACKEND ?? "jit";

function run(command, args, timeout = 60_000) {
    const result = spawnSync(command, args, { encoding: "utf8", timeout, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(result.error, undefined, `${command}: ${result.error?.message}`);
    assert.equal(result.status, 0, `${command}: ${result.stderr}`);
    return result.stdout;
}

function hash(filename) {
    return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

test("full-capacity compiled Bank preserves indexed words and reports bounded-operation costs", () => {
    const source = process.env.COSIMO_ENGINE_DATA_CMAJOR_SOURCE;
    const runtime = process.env.COSIMO_CMAJOR_RUNTIME_LIBRARY;
    assert.ok(source && runtime, "Set the qualified Cmajor source and runtime paths.");
    assert.ok(["jit", "cpp", "wasm"].includes(backend), "Bulk timing supports jit, cpp, or wasm.");
    mkdirSync(build, { recursive: true });
    const executable = path.join(build, `EngineDataBulkProbe-${backend}`);
    const flags = ["-std=c++17", "-O2", "-g0", "-DCMAJOR_DLL=1", "-I", path.join(source, "include")];
    const generated = {};
    let generatedSource;
    if (backend === "cpp" || backend === "wasm") {
        const generator = process.env.COSIMO_ENGINE_DATA_CODEGEN;
        assert.ok(generator, "Set the qualified Cmajor codegen path.");
        generatedSource = path.join(build, `EngineDataBulkGenerated.${backend === "cpp" ? "h" : "js"}`);
        run(generator, [path.join(repo, "tests/native/fixtures/engine_data/EngineDataBulk.cmajorpatch"),
            generatedSource, "EngineDataBulkGenerated", "--target", backend === "cpp" ? "cpp" : "javascript", "--max-frames-per-block", "512"]);
        if (backend === "cpp") flags.push(`-DENGINE_DATA_BULK_GENERATED_SOURCE="${generatedSource}"`);
        generated.generator = generator;
        generated.generatorSha256 = hash(generator);
        generated.generatedSourceSha256 = hash(generatedSource);
    }
    let cases;
    if (backend === "wasm") {
        cases = JSON.parse(run(process.execPath, [path.join(repo, "tests/native/EngineDataBulkWasmRunner.mjs"), generatedSource]));
    } else {
        run("/usr/bin/c++", [...flags, path.join(repo, "tests/native/EngineDataBulkProbe.cpp"), "-o", executable]);
        cases = JSON.parse(run(executable, [backend === "cpp" ? "engine-data-no-jit-library" : runtime,
            modulePath, fixturePath]));
    }
    const report = {
        backend, platform: platform(), arch: arch(), cpu: cpus()[0]?.model,
        node: process.version, source, runtimeSha256: hash(runtime),
        moduleSha256: hash(modulePath), fixtureSha256: hash(fixturePath),
        ...(backend === "wasm" ? {} : { executableSha256: hash(executable) }), ...generated,
        qualification: "Direct public Performer calls with actual compiled receiver and indexed DSP output; no Patch FIFO, worker, browser, or audio-host deadline claim.",
        timingScope: "Event delivery and 64-frame advance measured separately; input formula preparation and output checking excluded. Timings are observations, not performance test thresholds.",
        cases,
    };
    const reportPath = path.join(build, `results-${backend}.json`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Bulk evidence: ${reportPath}`);
    console.log(JSON.stringify(cases));
});
