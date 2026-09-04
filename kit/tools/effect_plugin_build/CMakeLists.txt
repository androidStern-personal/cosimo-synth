cmake_minimum_required(VERSION 3.16)

project(CosimoEffectPluginBuild LANGUAGES C CXX)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/kit/cmake/CosimoDependencies.cmake")
cosimo_add_production_dependencies()

set(COSIMO_EFFECT_PATCH_PATH "" CACHE FILEPATH "Cmajor patch to generate")
set(COSIMO_EFFECT_OUTPUT_DIR "" CACHE PATH "Generated JUCE project directory")
set(COSIMO_EFFECT_PLUGIN_TARGET "" CACHE STRING "Generated JUCE shared-code target")
set(COSIMO_EFFECT_EDITOR_MAX_WIDTH "" CACHE STRING "Optional maximum generated editor width")
set(COSIMO_CMAJ_EXECUTABLE "" CACHE FILEPATH "Pinned Cmajor command executable")
option(COSIMO_DISABLE_MICROPHONE_PERMISSION
    "Disable microphone permission metadata in the generated plugin project"
    OFF)

if(NOT EXISTS "${COSIMO_EFFECT_PATCH_PATH}")
    message(FATAL_ERROR "COSIMO_EFFECT_PATCH_PATH must name an existing Cmajor patch")
endif()

if(COSIMO_EFFECT_OUTPUT_DIR STREQUAL "")
    message(FATAL_ERROR "COSIMO_EFFECT_OUTPUT_DIR is required")
endif()

if(COSIMO_EFFECT_PLUGIN_TARGET STREQUAL "")
    message(FATAL_ERROR "COSIMO_EFFECT_PLUGIN_TARGET is required")
endif()

if(NOT IS_ABSOLUTE "${COSIMO_CMAJ_EXECUTABLE}" OR NOT EXISTS "${COSIMO_CMAJ_EXECUTABLE}")
    message(FATAL_ERROR "COSIMO_CMAJ_EXECUTABLE must name the absolute pinned Cmajor command")
endif()

file(MAKE_DIRECTORY "${COSIMO_EFFECT_OUTPUT_DIR}")

set(_cosimo_cmaj_generate_arguments
    generate
    --target=juce
    "${COSIMO_EFFECT_PATCH_PATH}"
    "--output=${COSIMO_EFFECT_OUTPUT_DIR}"
    "--jucePath=${COSIMO_JUCE_SOURCE_DIR}"
    "--cmajorIncludePath=${COSIMO_CMAJOR_SOURCE_DIR}/include")
if(COSIMO_DISABLE_MICROPHONE_PERMISSION)
    list(APPEND _cosimo_cmaj_generate_arguments
        --juceMicrophonePermissionEnabled=false)
endif()

execute_process(
    COMMAND "${COSIMO_CMAJ_EXECUTABLE}" ${_cosimo_cmaj_generate_arguments}
    RESULT_VARIABLE generate_result
    OUTPUT_VARIABLE generate_output
    ERROR_VARIABLE generate_error
)
unset(_cosimo_cmaj_generate_arguments)

if(NOT generate_result EQUAL 0)
    message(FATAL_ERROR "cmaj generate failed:\n${generate_output}${generate_error}")
endif()

message(STATUS "${generate_output}${generate_error}")

if(NOT COSIMO_EFFECT_EDITOR_MAX_WIDTH STREQUAL "")
    configure_file(
        "${CMAKE_CURRENT_LIST_DIR}/CosimoBoundedGeneratedPlugin.h"
        "${COSIMO_EFFECT_OUTPUT_DIR}/CosimoBoundedGeneratedPlugin.h"
        COPYONLY)
    execute_process(
        COMMAND "${CMAKE_COMMAND}"
            "-DCOSIMO_GENERATED_PLUGIN_SOURCE=${COSIMO_EFFECT_OUTPUT_DIR}/cmajor_plugin.cpp"
            "-DCOSIMO_GENERATED_PLUGIN_EDITOR_MAX_WIDTH=${COSIMO_EFFECT_EDITOR_MAX_WIDTH}"
            -P "${CMAKE_CURRENT_LIST_DIR}/apply_generated_editor_width_ceiling.cmake"
        RESULT_VARIABLE editor_width_result
        OUTPUT_VARIABLE editor_width_output
        ERROR_VARIABLE editor_width_error)
    if(NOT editor_width_result EQUAL 0)
        message(FATAL_ERROR
            "Applying generated editor width ceiling failed:\n"
            "${editor_width_output}${editor_width_error}")
    endif()
endif()

add_subdirectory("${COSIMO_EFFECT_OUTPUT_DIR}" plugin)

if(NOT TARGET "${COSIMO_EFFECT_PLUGIN_TARGET}")
    message(FATAL_ERROR "Generated JUCE target not found: ${COSIMO_EFFECT_PLUGIN_TARGET}")
endif()

if(APPLE)
    include("${CMAKE_CURRENT_LIST_DIR}/add_vst3_identity_probe.cmake")
    kit_add_vst3_identity_probe("${COSIMO_JUCE_SOURCE_DIR}")
    add_dependencies("${COSIMO_EFFECT_PLUGIN_TARGET}_VST3" kit_vst3_identity_probe)
endif()

include("${CMAKE_CURRENT_LIST_DIR}/read_generated_plugin_info_class.cmake")
cosimo_read_generated_plugin_info_class(
    _cosimo_generated_plugin_info_class
    "${COSIMO_EFFECT_OUTPUT_DIR}/cmajor_plugin.cpp")

get_directory_property(
    _cosimo_effect_osx_deployment_target
    DIRECTORY "${COSIMO_EFFECT_OUTPUT_DIR}"
    DEFINITION CMAKE_OSX_DEPLOYMENT_TARGET)
if(_cosimo_effect_osx_deployment_target)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "${_cosimo_effect_osx_deployment_target}")
endif()

add_executable(cosimo_generated_latency_probe EXCLUDE_FROM_ALL
    "${CMAKE_CURRENT_LIST_DIR}/cmajor_plugin_latency_probe.cpp")
get_target_property(
    _cosimo_effect_juce_generated_sources_dir
    "${COSIMO_EFFECT_PLUGIN_TARGET}"
    JUCE_GENERATED_SOURCES_DIRECTORY)
if(NOT _cosimo_effect_juce_generated_sources_dir)
    message(FATAL_ERROR "Generated JUCE source directory not found for ${COSIMO_EFFECT_PLUGIN_TARGET}")
endif()
target_compile_features(cosimo_generated_latency_probe PRIVATE cxx_std_17)
target_compile_definitions(cosimo_generated_latency_probe PRIVATE
    COSIMO_GENERATED_INFO_CLASS=${_cosimo_generated_plugin_info_class}
    JUCE_USE_CURL=0)
target_include_directories(cosimo_generated_latency_probe PRIVATE
    "${COSIMO_EFFECT_OUTPUT_DIR}"
    "${_cosimo_effect_juce_generated_sources_dir}"
    "${COSIMO_CMAJOR_SOURCE_DIR}/include"
    "${COSIMO_CMAJOR_SOURCE_DIR}/include/choc"
    "${COSIMO_JUCE_SOURCE_DIR}/modules")
target_link_libraries(cosimo_generated_latency_probe PRIVATE
    "${COSIMO_EFFECT_PLUGIN_TARGET}")
unset(_cosimo_generated_plugin_info_class)
unset(_cosimo_effect_juce_generated_sources_dir)

set(_cosimo_latency_probe_output "${CMAKE_BINARY_DIR}/latency_probe")
set_target_properties(cosimo_generated_latency_probe PROPERTIES
    INTERPROCEDURAL_OPTIMIZATION_RELEASE ON
    RUNTIME_OUTPUT_DIRECTORY "${_cosimo_latency_probe_output}")
foreach(configuration DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
    set_target_properties(cosimo_generated_latency_probe PROPERTIES
        "RUNTIME_OUTPUT_DIRECTORY_${configuration}" "${_cosimo_latency_probe_output}")
endforeach()
unset(_cosimo_effect_osx_deployment_target)
unset(_cosimo_latency_probe_output)
