import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readFile, readlink, symlink, mkdir, copyFile, chmod, writeFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { stageCustomerStateFixture, buildCustomerStateFixture } from "./helpers/build_customer_state_fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("actual desktop factory runs its worker, consumes articulation and reapplies identical saved state", async () => {
    const source = process.env.COSIMO_CMAJOR_SOURCE;
    const runtime = process.env.COSIMO_CMAJOR_RUNTIME_LIBRARY;
    assert.ok(source && runtime, "Set the qualified Cmajor source and runtime explicitly");
    const build = path.join(root, "build/plugin_state_desktop_qualification");
    const staging = await stageCustomerStateFixture(build, "plugin_state_desktop_wrapper", "desktop_wrapper_state");
    const { manifestPath: generatedManifest } = await buildCustomerStateFixture(staging, "desktop-wrapper-state",
        "build/fx/desktop_wrapper_state_runtime/DesktopWrapperState.cmajorpatch");
    // Keep the factory's compiled path stable while replacing the actual freshly
    // exported runtime on every run; this avoids rebuilding JUCE for a temp name.
    const fixtureLink = path.join(build, "current-fixture");
    try { await unlink(fixtureLink); } catch (error) { if (error.code !== "ENOENT") throw error; }
    await symlink(path.dirname(generatedManifest), fixtureLink, "dir");
    const manifestPath = path.join(fixtureLink, path.basename(generatedManifest));
    let cache;
    try { cache = await readFile(path.join(build, "CMakeCache.txt"), "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const configureArgs = ["-S", path.join(root, "tools/desktop_native"), "-B", build, `-DCOSIMO_PATCH_PATH=${manifestPath}`];
    if (cache !== undefined) {
        const configuredSource = cache.match(/^CPM_cosimo_cmajor_SOURCE:[^=]+=(.*)$/m)?.[1];
        assert.equal(configuredSource, source, "Build must use the assigned source checkout");
    } else {
        const juce = process.env.COSIMO_PLUGIN_STATE_JUCE_SOURCE;
        assert.ok(juce, "A fresh task build requires an explicit qualified JUCE source");
        configureArgs.push(`-DCPM_cosimo_cmajor_SOURCE=${source}`, `-DCPM_cosimo_juce_SOURCE=${juce}`,
            "-DCMAKE_BUILD_TYPE=Release");
    }
    const configured = spawnSync("cmake", configureArgs, {
        encoding: "utf8", timeout: 60000,
    });
    assert.equal(configured.status, 0, configured.error?.message ?? configured.stdout + configured.stderr);
    const compiled = spawnSync("cmake", ["--build", build, "--target", "cosimo_plugin_state_desktop_wrapper_probe", "-j", "2"], {
        encoding: "utf8", timeout: 180000,
    });
    assert.equal(compiled.status, 0, compiled.error?.message ?? compiled.stdout + compiled.stderr);
    // Exercise production factory/runtime discovery from a task-owned app
    // bundle. No installed application or runtime search rule is changed.
    const app = path.join(build, "WrapperQualification.app", "Contents");
    const executable = path.join(app, "MacOS", "WrapperQualification");
    await mkdir(path.dirname(executable), { recursive: true });
    await mkdir(path.join(app, "Resources"), { recursive: true });
    await copyFile(path.join(build, "cosimo_plugin_state_desktop_wrapper_probe"), executable);
    await chmod(executable, 0o755);
    await writeFile(path.join(app, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>WrapperQualification</string>
<key>CFBundleIdentifier</key><string>dev.cosimo.tests.wrapper</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>`);
    const bundledRuntime = path.join(app, "Resources", "libCmajPerformer.dylib");
    try { await symlink(path.resolve(runtime), bundledRuntime); }
    catch (error) {
        if (error.code !== "EEXIST") throw error;
        assert.equal(await readlink(bundledRuntime), path.resolve(runtime), "Refuse to replace another runtime");
    }
    const run = spawnSync(executable, [
        manifestPath,
    ], { encoding: "utf8", timeout: 30000 });
    assert.equal(run.status, 0, run.error?.message ?? run.stdout + run.stderr);
    assert.match(run.stdout, /^PASS actual desktop wrapper:/m);
});
