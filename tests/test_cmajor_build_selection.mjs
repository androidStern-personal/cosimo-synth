import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("one Cmajor selection drives headers, tools and browser files, including reused caches", async context => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cmajor-build-selection-"));
    context.after(() => rm(root, { recursive: true, force: true }));
    const run = (command, args, cwd = root, env = process.env) =>
        execFileSync(command, args, { cwd, env, encoding: "utf8", stdio: "pipe" }).trim();
    async function repository(name) {
        const directory = path.join(root, name);
        await mkdir(path.join(directory, "include/cmajor/API"), { recursive: true });
        await mkdir(path.join(directory, "javascript/cmaj_api"), { recursive: true });
        await writeFile(path.join(directory, "include/cmajor/API/cmaj_Engine.h"), name);
        await writeFile(path.join(directory, "javascript/cmaj_api/marker"), name);
        run("git", ["init", "-q"], directory);
        run("git", ["add", "."], directory);
        run("git", ["-c", "user.name=Build Test", "-c", "user.email=test@example.invalid", "commit", "-qm", name], directory);
        return { directory, commit: run("git", ["rev-parse", "HEAD"], directory) };
    }
    // Real local Git repositories stand in for dependency origins. We test
    // CMake/CPM selection and packaged bytes, not compiler or DSP behavior.
    const pinned = await repository("pinned");
    const development = await repository("development");
    const moduleDirectory = path.join(root, "cmake");
    await mkdir(moduleDirectory);
    await cp(new URL("../kit/cmake/CPM.cmake", import.meta.url), path.join(moduleDirectory, "CPM.cmake"));
    const source = await readFile(new URL("../kit/cmake/CosimoDependencies.cmake", import.meta.url), "utf8");
    await writeFile(path.join(moduleDirectory, "CosimoDependencies.cmake"), source
        .replace(/set\(COSIMO_CMAJOR_PINNED_COMMIT "[0-9a-f]+"\)/, `set(COSIMO_CMAJOR_PINNED_COMMIT "${pinned.commit}")`)
        .replace(/set\(COSIMO_JUCE_PINNED_COMMIT "[0-9a-f]+"\)/, `set(COSIMO_JUCE_PINNED_COMMIT "${pinned.commit}")`)
        .replace('GIT_SUBMODULES "include/choc"', 'GIT_SUBMODULES ""'));
    await writeFile(path.join(moduleDirectory, "dependency-sources.cmake"),
        `set(COSIMO_CMAJOR_GIT_URL "${pinned.directory}")\nset(COSIMO_JUCE_GIT_URL "${pinned.directory}")\n`);
    await writeFile(path.join(root, "CMakeLists.txt"), `cmake_minimum_required(VERSION 3.22)
project(DependencySelection LANGUAGES NONE)
include("\${CMAKE_CURRENT_LIST_DIR}/cmake/CosimoDependencies.cmake")
cosimo_add_production_dependencies()
file(READ "\${COSIMO_CMAJOR_SOURCE_DIR}/include/cmajor/API/cmaj_Engine.h" headers)
file(READ "\${COSIMO_CMAJOR_SOURCE_DIR}/javascript/cmaj_api/marker" browser)
cosimo_add_cmajor_toolchain_dependencies()
file(READ "\${COSIMO_CMAJOR_SOURCE_DIR}/include/cmajor/API/cmaj_Engine.h" tools)
file(WRITE "\${CMAKE_BINARY_DIR}/selected.txt" "\${headers}|\${browser}|\${tools}")
`);
    const env = { ...process.env, CPM_SOURCE_CACHE: path.join(root, "cache") };
    delete env.COSIMO_CMAJOR_SOURCE;
    delete env.CPM_cosimo_cmajor_SOURCE;
    delete env.CPM_cosimo_cmajor_toolchain_SOURCE;
    delete env.CPM_cosimo_juce_SOURCE;
    const build = path.join(root, "build");
    async function configure(environment, extraArgs = []) {
        run("cmake", ["-S", root, "-B", build, ...extraArgs], root, environment);
        return readFile(path.join(build, "selected.txt"), "utf8");
    }
    assert.equal(await configure({ ...env, CPM_cosimo_cmajor_SOURCE: development.directory }, [
        `-DCPM_DIRECTORY=${path.join(root, "previous-cmake-location")}`,
        `-DCPM_cosimo_cmajor_SOURCE=${development.directory}`,
        `-DCPM_cosimo_cmajor_toolchain_SOURCE=${pinned.directory}`,
    ]), "pinned|pinned|pinned", "legacy per-package overrides cannot silently bypass the pin");
    assert.equal(await configure({ ...env, COSIMO_CMAJOR_SOURCE: development.directory }),
        "development|development|development");
    assert.equal(await configure(env), "pinned|pinned|pinned", "unset override must not leave cached development inputs");
});
