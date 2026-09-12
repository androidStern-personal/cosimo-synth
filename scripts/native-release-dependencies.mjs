import { readFileSync } from "node:fs";

// Release checks use the same pins as CMake, then verify the actual clean
// checkouts and Cmajor's CHOC gitlink. Products do not maintain their own pins.
const declarations = readFileSync(new URL("../kit/cmake/CosimoDependencies.cmake", import.meta.url), "utf8")
    + readFileSync(new URL("../kit/cmake/dependency-sources.cmake", import.meta.url), "utf8");
function declared(name) {
    const matches = [...declarations.matchAll(new RegExp(`set\\(${name}\\s+"([^"]+)"\\)`, "g"))];
    if (matches.length !== 1) throw new Error(`Expected one ${name} declaration in kit/cmake`);
    return matches[0][1];
}
function commit(name) {
    const value = declared(name);
    if (!/^[0-9a-f]{40}$/.test(value)) throw new Error(`${name} must be a full Git commit`);
    return value;
}
const cmajorRepository = declared("COSIMO_CMAJOR_GIT_URL");

export const nativeReleaseDependencies = Object.freeze({
    declarationPath: "kit/cmake/CosimoDependencies.cmake",
    cmajor: Object.freeze({
        cpmName: "cosimo_cmajor",
        sourceDirectoryCacheKey: "CPM_PACKAGE_cosimo_cmajor_SOURCE_DIR",
        repository: cmajorRepository,
        revision: commit("COSIMO_CMAJOR_PINNED_COMMIT"),
    }),
    choc: Object.freeze({
        repository: new URL("choc.git", cmajorRepository).href,
        revision: commit("COSIMO_CHOC_PINNED_COMMIT"),
        submodulePath: "include/choc",
    }),
    juce: Object.freeze({
        cpmName: "cosimo_juce",
        sourceDirectoryCacheKey: "CPM_PACKAGE_cosimo_juce_SOURCE_DIR",
        repository: declared("COSIMO_JUCE_GIT_URL"),
        revision: commit("COSIMO_JUCE_PINNED_COMMIT"),
    }),
});
