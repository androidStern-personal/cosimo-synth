/** Proposed Enhance That native inputs; qualification and tool archives remain pending. */
export const enhanceThatNativeDependencies = Object.freeze({
    declarationPath: "kit/cmake/CosimoDependencies.cmake",
    cmajor: Object.freeze({
        cpmName: "cosimo_cmajor",
        sourceDirectoryCacheKey: "CPM_PACKAGE_cosimo_cmajor_SOURCE_DIR",
        repository: "https://github.com/androidStern-personal/cmajor.git",
        revision: "2fc4c2dce2a1b625c1578409e10bf312a5ac39b5",
    }),
    choc: Object.freeze({
        repository: "https://github.com/androidStern-personal/choc.git",
        revision: "11f7dc63d7cb78f6dbaa559fe09ade8e941c0188",
        submodulePath: "include/choc",
    }),
    juce: Object.freeze({
        cpmName: "cosimo_juce",
        sourceDirectoryCacheKey: "CPM_PACKAGE_cosimo_juce_SOURCE_DIR",
        repository: "https://github.com/juce-framework/JUCE.git",
        revision: "501c07674e1ad693085a7e7c398f205c2677f5da",
    }),
});
