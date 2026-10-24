// This repository builds cmaj from the pinned Cmajor fork (tools/cmajor_command_build)
// instead of downloading it with kit:setup, and hands it to the kit's build
// commands through BUILDER_KIT_CMAJ.
//
//   node scripts/source_cmaj.mjs <command> [args...]
//
// builds (or incrementally refreshes) build/cmajor_command/bin/cmaj, then runs
// the command with BUILDER_KIT_CMAJ pointing at it. `node` as the command means
// this Node executable; `cmaj` means the pinned cmaj itself, so a script never
// picks up whichever cmaj happens to be on PATH.

import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { isMainModule, projectRoot, runCommand } from "../kit/scripts/common.mjs";
import { cmajOverrideVariable } from "../kit/scripts/toolchain.mjs";

export const sourceCmajBuildDirectory = path.join(projectRoot, "build", "cmajor_command");
export const sourceCmajExecutable = path.join(sourceCmajBuildDirectory, "bin", "cmaj");

/** The two CMake invocations (configure, build) that produce the pinned cmaj. */
export function sourceCmajCMakeArguments(jobs = process.env.BUILDER_KIT_CMAKE_JOBS ?? String(os.availableParallelism())) {
    return [
        ["-S", path.join(projectRoot, "tools/cmajor_command_build"), "-B", sourceCmajBuildDirectory, "-DCMAKE_BUILD_TYPE=Release"],
        ["--build", sourceCmajBuildDirectory, "--config", "Release", "--target", "cmaj", "--parallel", jobs],
    ];
}

/** Configure and build the pinned cmaj; returns its path. */
export function buildSourceCmaj({ cmake = "cmake" } = {}) {
    for (const args of sourceCmajCMakeArguments())
        runCommand(cmake, args, { capture: false });

    return sourceCmajExecutable;
}

/** The environment that makes kit build commands use the source-built cmaj. */
export function withSourceCmaj(environment = process.env) {
    return { ...environment, [cmajOverrideVariable]: sourceCmajExecutable };
}

if (isMainModule(import.meta.url)) {
    const [command, ...args] = process.argv.slice(2);

    if (!command) {
        console.error("Usage: node scripts/source_cmaj.mjs <command> [args...]");
        process.exit(2);
    }

    try {
        buildSourceCmaj();
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }

    const executables = { node: process.execPath, cmaj: sourceCmajExecutable };
    const result = spawnSync(executables[command] ?? command, args, { stdio: "inherit", env: withSourceCmaj() });

    process.exitCode = result.status ?? 1;
}
