cmake_minimum_required(VERSION 3.16)

project(CosimoEffectPluginBuild LANGUAGES C CXX)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/cmake/CosimoDependencies.cmake")
cosimo_add_production_dependencies()

set(COSIMO_EFFECT_PATCH_PATH "" CACHE FILEPATH "Cmajor patch to generate")
set(COSIMO_EFFECT_OUTPUT_DIR "" CACHE PATH "Generated JUCE project directory")

if(NOT EXISTS "${COSIMO_EFFECT_PATCH_PATH}")
    message(FATAL_ERROR "COSIMO_EFFECT_PATCH_PATH must name an existing Cmajor patch")
endif()

if(COSIMO_EFFECT_OUTPUT_DIR STREQUAL "")
    message(FATAL_ERROR "COSIMO_EFFECT_OUTPUT_DIR is required")
endif()

find_program(COSIMO_CMAJ_EXECUTABLE cmaj REQUIRED)
file(MAKE_DIRECTORY "${COSIMO_EFFECT_OUTPUT_DIR}")

execute_process(
    COMMAND "${COSIMO_CMAJ_EXECUTABLE}" generate
        --target=juce
        "${COSIMO_EFFECT_PATCH_PATH}"
        "--output=${COSIMO_EFFECT_OUTPUT_DIR}"
        "--jucePath=${COSIMO_JUCE_SOURCE_DIR}"
        "--cmajorIncludePath=${COSIMO_CMAJOR_SOURCE_DIR}/include"
    RESULT_VARIABLE generate_result
    OUTPUT_VARIABLE generate_output
    ERROR_VARIABLE generate_error
)

if(NOT generate_result EQUAL 0)
    message(FATAL_ERROR "cmaj generate failed:\n${generate_output}${generate_error}")
endif()

message(STATUS "${generate_output}${generate_error}")
add_subdirectory("${COSIMO_EFFECT_OUTPUT_DIR}" plugin)
