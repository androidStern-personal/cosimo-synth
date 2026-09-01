cmake_minimum_required(VERSION 3.16)

project(CosimoT26EnhancerWrapperProbe LANGUAGES CXX OBJCXX)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/kit/cmake/CosimoDependencies.cmake")
cosimo_add_t26_research_juce()

set(COSIMO_T26_PROBE_OUTPUT_DIR "${CMAKE_BINARY_DIR}/direct" CACHE PATH
    "Destination for the T26 research probe")

add_executable(enhancer_wrapper_probe
    "${COSIMO_T26_JUCE_SOURCE_DIR}/modules/juce_core/juce_core.mm"
    "${COSIMO_T26_JUCE_SOURCE_DIR}/modules/juce_audio_basics/juce_audio_basics.mm"
    "${COSIMO_T26_JUCE_SOURCE_DIR}/modules/juce_dsp/juce_dsp.mm"
    enhancer_wrapper_probe.cpp
)

target_compile_features(enhancer_wrapper_probe PRIVATE cxx_std_17)
target_compile_definitions(enhancer_wrapper_probe PRIVATE
    JUCE_GLOBAL_MODULE_SETTINGS_INCLUDED=1
    JUCE_USE_CURL=0
    JUCE_WEB_BROWSER=0
)
target_compile_options(enhancer_wrapper_probe PRIVATE -O2)
target_include_directories(enhancer_wrapper_probe PRIVATE
    "${COSIMO_T26_JUCE_SOURCE_DIR}/modules"
)

find_library(ACCELERATE_FRAMEWORK Accelerate REQUIRED)
find_library(COCOA_FRAMEWORK Cocoa REQUIRED)
find_library(FOUNDATION_FRAMEWORK Foundation REQUIRED)
target_link_libraries(enhancer_wrapper_probe PRIVATE
    "${ACCELERATE_FRAMEWORK}"
    "${COCOA_FRAMEWORK}"
    "${FOUNDATION_FRAMEWORK}"
)
target_link_options(enhancer_wrapper_probe PRIVATE -Wl,-dead_strip)

set_target_properties(enhancer_wrapper_probe PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${COSIMO_T26_PROBE_OUTPUT_DIR}"
)
