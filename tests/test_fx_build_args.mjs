import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadBuildModules() {
    const buildModule = await import(pathToFileURL(path.join(repoRoot, "fx/build-effect.mjs")));
    const prodModule = await import(pathToFileURL(path.join(repoRoot, "fx/prod-effect.mjs")));
    return { buildModule, prodModule };
}

test("fx_build_all_expands_to_every_known_effect_plugin_in_manifest_order", async () => {
    const { buildModule, prodModule } = await loadBuildModules();
    const expectedPluginNames = ["ott", "chorus", "seqfx"];

    assert.deepEqual(buildModule.effectPluginNames(), expectedPluginNames);
    assert.deepEqual(buildModule.resolvePluginNames("all"), expectedPluginNames);
    assert.deepEqual(prodModule.resolveProdPluginNames("all"), expectedPluginNames);
});

test("fx_build_single_plugin_still_resolves_to_only_that_plugin", async () => {
    const { buildModule, prodModule } = await loadBuildModules();

    assert.deepEqual(buildModule.resolvePluginNames("seqfx"), ["seqfx"]);
    assert.deepEqual(prodModule.resolveProdPluginNames("chorus"), ["chorus"]);
});

test("fx_build_unknown_plugin_reports_all_as_an_available_target", async () => {
    const { buildModule, prodModule } = await loadBuildModules();

    assert.throws(() => buildModule.resolvePluginNames("wat"), /Available plugins: all, ott, chorus, seqfx/);
    assert.throws(() => prodModule.resolveProdPluginNames("wat"), /Available plugins: all, ott, chorus, seqfx/);
});

test("fx_prod_install_accepts_all_with_dry_run_without_swallowing_unknown_flags", async () => {
    const { prodModule } = await loadBuildModules();

    assert.deepEqual(prodModule.parseArgs(["node", "prod-effect.mjs", "install", "all", "--dry-run"]), {
        action: "install",
        pluginName: "all",
        clean: false,
        dryRun: true,
        help: false,
    });
    assert.deepEqual(prodModule.parseArgs(["node", "prod-effect.mjs", "build", "seqfx", "--clean"]), {
        action: "build",
        pluginName: "seqfx",
        clean: true,
        dryRun: false,
        help: false,
    });
    assert.throws(
        () => prodModule.parseArgs(["node", "prod-effect.mjs", "install", "all", "--wat"]),
        /Unknown argument: --wat/,
    );
});

test("fx_prod_parallelism_defaults_to_three_plugin_builds_and_splits_cmake_jobs", async () => {
    const { prodModule } = await loadBuildModules();

    assert.deepEqual(prodModule.resolveProdBuildParallelism(3, {}, 8), {
        pluginJobs: 3,
        cmakeJobs: 2,
    });
    assert.deepEqual(prodModule.resolveProdBuildParallelism(1, {}, 8), {
        pluginJobs: 1,
        cmakeJobs: 8,
    });
    assert.deepEqual(prodModule.resolveProdBuildParallelism(3, {}, 1), {
        pluginJobs: 1,
        cmakeJobs: 1,
    });
});

test("fx_prod_parallelism_accepts_explicit_safe_overrides", async () => {
    const { prodModule } = await loadBuildModules();

    assert.deepEqual(prodModule.resolveProdBuildParallelism(
        3,
        {
            COSIMO_PLUGIN_JOBS: "3",
            COSIMO_CMAKE_JOBS: "2",
        },
        8,
    ), {
        pluginJobs: 3,
        cmakeJobs: 2,
    });
    assert.deepEqual(prodModule.resolveProdBuildParallelism(
        3,
        {
            COSIMO_PLUGIN_JOBS: "99",
        },
        8,
    ), {
        pluginJobs: 3,
        cmakeJobs: 2,
    });
});

test("fx_prod_parallelism_rejects_invalid_job_counts", async () => {
    const { prodModule } = await loadBuildModules();

    assert.throws(
        () => prodModule.resolveProdBuildParallelism(3, { COSIMO_PLUGIN_JOBS: "0" }, 8),
        /COSIMO_PLUGIN_JOBS must be a positive integer/,
    );
    assert.throws(
        () => prodModule.resolveProdBuildParallelism(3, { COSIMO_CMAKE_JOBS: "1.5" }, 8),
        /COSIMO_CMAKE_JOBS must be a positive integer/,
    );
});

test("fx_prod_cmake_build_args_include_parallel_jobs_when_available", async () => {
    const { prodModule } = await loadBuildModules();

    assert.deepEqual(prodModule.createCmakeBuildArgs("/tmp/cosimo-build", "SeqFX_VST3", 4), [
        "--build",
        "/tmp/cosimo-build",
        "--config",
        "Release",
        "--target",
        "SeqFX_VST3",
        "--parallel",
        "4",
    ]);
    assert.deepEqual(prodModule.createCmakeBuildArgs("/tmp/cosimo-build", "SeqFX_VST3"), [
        "--build",
        "/tmp/cosimo-build",
        "--config",
        "Release",
        "--target",
        "SeqFX_VST3",
    ]);
});

test("fx_prod_all_child_build_args_keep_single_plugin_builds_import_safe", async () => {
    const { prodModule } = await loadBuildModules();
    const args = prodModule.createProdBuildChildArgs("seqfx", { clean: true });

    assert.equal(path.isAbsolute(args[0]), true);
    assert.equal(args[0], path.join(repoRoot, "fx/prod-effect.mjs"));
    assert.deepEqual(args.slice(1), ["build", "seqfx", "--clean"]);
});

test("fx_prod_prepare_preserves_cmake_build_tree_but_removes_stale_generated_files", async () => {
    const { prodModule } = await loadBuildModules();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-prod-prepare-"));
    const juceOut = path.join(tempRoot, "seqfx_juce");

    try {
        await mkdir(path.join(juceOut, "_build", "objects"), { recursive: true });
        await mkdir(path.join(juceOut, "stale-dir"), { recursive: true });
        await writeFile(path.join(juceOut, "_build", "objects", "cmajor_plugin.o"), "compiled object");
        await writeFile(path.join(juceOut, "CMakeLists.txt"), "old generated cmake");
        await writeFile(path.join(juceOut, "cmajor_plugin.cpp"), "old generated source");
        await writeFile(path.join(juceOut, "stale-dir", "old.cpp"), "stale source");

        await prodModule.prepareJuceProjectOutput(juceOut);

        assert.equal(await readFile(path.join(juceOut, "_build", "objects", "cmajor_plugin.o"), "utf8"), "compiled object");
        await assert.rejects(readFile(path.join(juceOut, "CMakeLists.txt"), "utf8"), { code: "ENOENT" });
        await assert.rejects(readFile(path.join(juceOut, "cmajor_plugin.cpp"), "utf8"), { code: "ENOENT" });
        await assert.rejects(readFile(path.join(juceOut, "stale-dir", "old.cpp"), "utf8"), { code: "ENOENT" });
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("fx_prod_prepare_clean_removes_the_cmake_build_tree", async () => {
    const { prodModule } = await loadBuildModules();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-prod-clean-"));
    const juceOut = path.join(tempRoot, "seqfx_juce");

    try {
        await mkdir(path.join(juceOut, "_build"), { recursive: true });
        await writeFile(path.join(juceOut, "_build", "CMakeCache.txt"), "cache");
        await writeFile(path.join(juceOut, "CMakeLists.txt"), "old generated cmake");

        await prodModule.prepareJuceProjectOutput(juceOut, { clean: true });

        await assert.rejects(readFile(path.join(juceOut, "_build", "CMakeCache.txt"), "utf8"), { code: "ENOENT" });
        await assert.rejects(readFile(path.join(juceOut, "CMakeLists.txt"), "utf8"), { code: "ENOENT" });
        await writeFile(path.join(juceOut, "generation-can-write-here.txt"), "ok");
        assert.equal(await readFile(path.join(juceOut, "generation-can-write-here.txt"), "utf8"), "ok");
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});
