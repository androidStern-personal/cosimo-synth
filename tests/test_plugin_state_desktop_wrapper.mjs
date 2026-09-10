import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readFile, readlink, symlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");

test("actual desktop wrapper consumes the pending articulation mailbox and reapplies identical saved state", async () => {
    const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
    const runtime = process.env.COSIMO_CMAJOR_RUNTIME_LIBRARY;
    assert.ok(source && runtime, "Set the qualified Cmajor source and runtime explicitly");
    const build = path.join(root, "build/plugin_state_desktop_qualification");
    let cache;
    try { cache = await readFile(path.join(build, "CMakeCache.txt"), "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const configureArgs = ["-S", path.join(root, "tools/desktop_native"), "-B", build];
    if (cache !== undefined) {
        const configuredSource = cache.match(/^CPM_cosimo_cmajor_SOURCE:[^=]+=(.*)$/m)?.[1];
        assert.equal(configuredSource, source, "Build must use the assigned source checkout");
    } else {
        const juce = process.env.COSIMO_PLUGIN_STATE_JUCE_SOURCE;
        assert.ok(juce, "A fresh task build requires an explicit qualified JUCE source");
        configureArgs.push(`-DCPM_cosimo_cmajor_SOURCE=${source}`, `-DCPM_cosimo_juce_SOURCE=${juce}`,
            `-DCOSIMO_PATCH_PATH=${path.join(root, "WavetableSynth.cmajorpatch")}`, "-DCMAKE_BUILD_TYPE=Release");
    }
    const configured = spawnSync("cmake", configureArgs, {
        encoding: "utf8", timeout: 60000,
    });
    assert.equal(configured.status, 0, configured.error?.message ?? configured.stdout + configured.stderr);
    const compiled = spawnSync("cmake", ["--build", build, "--target", "cosimo_plugin_state_desktop_wrapper_probe", "-j", "2"], {
        encoding: "utf8", timeout: 180000,
    });
    assert.equal(compiled.status, 0, compiled.error?.message ?? compiled.stdout + compiled.stderr);
    // The real JUCE wrapper discovers its runtime beside the executable. This
    // task-owned symlink uses the explicitly qualified library, without changing
    // production discovery or touching an installed application.
    const siblingRuntime = path.join(build, "libCmajPerformer.dylib");
    try { await symlink(path.resolve(runtime), siblingRuntime); }
    catch (error) {
        if (error.code !== "EEXIST") throw error;
        assert.equal(await readlink(siblingRuntime), path.resolve(runtime), "Refuse to replace another runtime");
    }
    const run = spawnSync(path.join(build, "cosimo_plugin_state_desktop_wrapper_probe"), [
        runtime, path.join(root, "tests/native/fixtures/plugin_state_desktop_wrapper/DesktopWrapperState.cmajorpatch"),
    ], { encoding: "utf8", timeout: 30000 });
    assert.equal(run.status, 0, run.error?.message ?? run.stdout + run.stderr);
    assert.match(run.stdout, /^PASS actual desktop wrapper:/m);
});
