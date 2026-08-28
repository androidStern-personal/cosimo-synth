cmake_minimum_required(VERSION 3.22)

project(CosimoCmajPluginBuild VERSION 1.0.3066 LANGUAGES C CXX)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/cmake/ResolveBuildDependencies.cmake")
cosimo_resolve_build_dependencies(
    COSIMO_CMAJOR_SOURCE_DIR
    COSIMO_CHOC_SOURCE_DIR
    COSIMO_JUCE_SOURCE_DIR
)

set(CMAJ_VERSION "1.0.3066")
set(CMAJ_TARGET_COMPILER
    $<$<OR:$<CXX_COMPILER_ID:Clang>,$<CXX_COMPILER_ID:AppleClang>>:cxx_std_17>
    $<$<CXX_COMPILER_ID:GNU>:cxx_std_17>
    $<$<CXX_COMPILER_ID:MSVC>:cxx_std_17>
)
include("${COSIMO_CMAJOR_SOURCE_DIR}/tools/scripts/cmake_warning_flags")

set(JUCE_ENABLE_MODULE_SOURCE_GROUPS ON)
add_subdirectory("${COSIMO_JUCE_SOURCE_DIR}" juce)
add_subdirectory("${COSIMO_CMAJOR_SOURCE_DIR}/tools/CmajPlugin" cmajplugin)

# AppleClang 21 diagnoses an existing Cmajor PatchHelpers integer-to-float
# conversion under the upstream warning set. Keep the warning and every other
# upstream warning-as-error contract, but do not make this one diagnostic fatal.
target_compile_options(CmajPlugin PRIVATE
    $<$<OR:$<CXX_COMPILER_ID:Clang>,$<CXX_COMPILER_ID:AppleClang>>:
        -Wno-error=implicit-int-float-conversion>
)
