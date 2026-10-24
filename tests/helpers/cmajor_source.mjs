import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
let resolved;

/**
 * The Cmajor checkout tests compile and import against: the local fork named
 * by BUILDER_KIT_CMAJOR_SOURCE when a developer sets one, otherwise the pinned
 * checkout the kit's CMake dependency step fetches for every build.
 */
export function cmajorSourceDirectory() {
    if (process.env.BUILDER_KIT_CMAJOR_SOURCE) return process.env.BUILDER_KIT_CMAJOR_SOURCE;
    if (resolved) return resolved;
    const configureDirectory = mkdtempSync(path.join(os.tmpdir(), "cosimo-cmajor-source-"));
    try {
        execFileSync("cmake", [
            "-S", path.join(root, "kit/tools/cmajor_web_runtime"),
            "-B", configureDirectory,
            `-DBUILDER_KIT_CMAJOR_WEB_RUNTIME_DIR=${path.join(configureDirectory, "cmaj_api")}`,
        ], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
        const cache = readFileSync(path.join(configureDirectory, "CMakeCache.txt"), "utf8");
        const match = /^CPM_PACKAGE_builder_kit_cmajor_SOURCE_DIR:INTERNAL=(.+)$/mu.exec(cache);
        if (!match) throw new Error("The kit's CMake dependency step did not report the pinned Cmajor checkout.");
        resolved = match[1];
        return resolved;
    } finally {
        rmSync(configureDirectory, { recursive: true, force: true });
    }
}

/** The Cmajor JavaScript API directory of that checkout. */
export function cmajorWebApiDirectory() {
    return path.join(cmajorSourceDirectory(), "javascript/cmaj_api");
}

/**
 * The Cmajor code generator the web build uses, built (or brought up to
 * date) against that same checkout; returns the executable's path.
 */
export function cmajorExternalCodegen() {
    return buildCmakeTarget(path.join(root, "tools/cmajor_external_codegen"),
        path.join(root, "build/cmajor_external_codegen-host"), "cosimo_cmajor_external_codegen");
}

/**
 * The Cmajor fork's own shared-memory JavaScript generator, which takes
 * engine code-generation options directly; built from the full toolchain
 * checkout the code generator above compiles against.
 */
export function cmajorSharedMemoryGenerator() {
    cmajorExternalCodegen();
    const cache = readFileSync(path.join(root, "build/cmajor_external_codegen-host/CMakeCache.txt"), "utf8");
    const toolchain = /^CPM_PACKAGE_builder_kit_cmajor_toolchain_SOURCE_DIR:INTERNAL=(.+)$/mu.exec(cache)?.[1]
        ?? process.env.BUILDER_KIT_CMAJOR_SOURCE;
    if (!toolchain) throw new Error("The code generator build did not report its Cmajor toolchain checkout.");
    return buildCmakeTarget(path.join(toolchain, "tests/shared_memory_codegen"),
        path.join(root, "build/shared_data_codegen"), "shared_memory_generator");
}

function buildCmakeTarget(sourceDirectory, buildDirectory, target) {
    execFileSync("cmake", ["-S", sourceDirectory, "-B", buildDirectory, "-DCMAKE_BUILD_TYPE=Release"],
        { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
    execFileSync("cmake", ["--build", buildDirectory, "--config", "Release", "--target", target],
        { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
    return path.join(buildDirectory, target);
}
