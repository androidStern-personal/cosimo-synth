cmake_minimum_required(VERSION 3.16)

project(CosimoCmajPluginBuild VERSION 1.0.3066 LANGUAGES C CXX)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/cmake/CosimoDependencies.cmake")
cosimo_add_production_dependencies()

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
