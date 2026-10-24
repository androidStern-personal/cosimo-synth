cmake_minimum_required(VERSION 3.16)

project(BuilderKitCmajPluginBuild VERSION 1.0.3066 LANGUAGES C CXX)

get_filename_component(BUILDER_KIT_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${BUILDER_KIT_REPO_ROOT}/kit/cmake/dependencies.cmake")
builder_kit_toolchain_dependencies()

set(CMAJ_VERSION "1.0.3066")
set(CMAJ_TARGET_COMPILER
    $<$<OR:$<CXX_COMPILER_ID:Clang>,$<CXX_COMPILER_ID:AppleClang>>:cxx_std_17>
    $<$<CXX_COMPILER_ID:GNU>:cxx_std_17>
    $<$<CXX_COMPILER_ID:MSVC>:cxx_std_17>
)
include("${BUILDER_KIT_CMAJOR_SOURCE_DIR}/tools/scripts/cmake_warning_flags")

set(JUCE_ENABLE_MODULE_SOURCE_GROUPS ON)
add_subdirectory("${BUILDER_KIT_JUCE_SOURCE_DIR}" juce)
add_subdirectory("${BUILDER_KIT_CMAJOR_SOURCE_DIR}/tools/CmajPlugin" cmajplugin)

# LLVM is linked statically; its build-machine search directory is not a
# runtime dependency and must not be embedded in the shipped tool.
set_target_properties(CmajPlugin_VST3 PROPERTIES SKIP_BUILD_RPATH TRUE)
