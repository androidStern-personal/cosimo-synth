cmake_minimum_required(VERSION 3.16)

project(BuilderKitEffectPluginBuild LANGUAGES C CXX)

get_filename_component(BUILDER_KIT_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
include("${BUILDER_KIT_REPO_ROOT}/kit/cmake/dependencies.cmake")
include("${CMAKE_CURRENT_LIST_DIR}/sync_generated_project.cmake")
builder_kit_dependencies()

set(BUILDER_KIT_EFFECT_PATCH_PATH "" CACHE FILEPATH "Cmajor patch to generate")
set(BUILDER_KIT_EFFECT_OUTPUT_DIR "" CACHE PATH "Generated JUCE project directory")
set(BUILDER_KIT_EFFECT_PLUGIN_TARGET "" CACHE STRING "Generated JUCE shared-code target")
set(BUILDER_KIT_CMAJ_EXECUTABLE "" CACHE FILEPATH "Pinned Cmajor command executable")
option(BUILDER_KIT_DISABLE_MICROPHONE_PERMISSION
    "Disable microphone permission metadata in the generated plugin project"
    OFF)

if(NOT EXISTS "${BUILDER_KIT_EFFECT_PATCH_PATH}")
    message(FATAL_ERROR "BUILDER_KIT_EFFECT_PATCH_PATH must name an existing Cmajor patch")
endif()

if(BUILDER_KIT_EFFECT_OUTPUT_DIR STREQUAL "")
    message(FATAL_ERROR "BUILDER_KIT_EFFECT_OUTPUT_DIR is required")
endif()

if(BUILDER_KIT_EFFECT_PLUGIN_TARGET STREQUAL "")
    message(FATAL_ERROR "BUILDER_KIT_EFFECT_PLUGIN_TARGET is required")
endif()

if(NOT IS_ABSOLUTE "${BUILDER_KIT_CMAJ_EXECUTABLE}" OR NOT EXISTS "${BUILDER_KIT_CMAJ_EXECUTABLE}")
    message(FATAL_ERROR "BUILDER_KIT_CMAJ_EXECUTABLE must name the absolute pinned Cmajor command")
endif()

set(_builder_kit_generated_project_stage "${CMAKE_BINARY_DIR}/generated-project-stage")
file(REMOVE_RECURSE "${_builder_kit_generated_project_stage}")
file(MAKE_DIRECTORY "${_builder_kit_generated_project_stage}")

set(_builder_kit_cmaj_generate_arguments
    generate
    --target=juce
    "${BUILDER_KIT_EFFECT_PATCH_PATH}"
    "--output=${_builder_kit_generated_project_stage}"
    "--jucePath=${BUILDER_KIT_JUCE_SOURCE_DIR}"
    "--cmajorIncludePath=${BUILDER_KIT_CMAJOR_SOURCE_DIR}/include")
if(BUILDER_KIT_DISABLE_MICROPHONE_PERMISSION)
    list(APPEND _builder_kit_cmaj_generate_arguments
        --juceMicrophonePermissionEnabled=false)
endif()

execute_process(
    COMMAND "${BUILDER_KIT_CMAJ_EXECUTABLE}" ${_builder_kit_cmaj_generate_arguments}
    RESULT_VARIABLE generate_result
    OUTPUT_VARIABLE generate_output
    ERROR_VARIABLE generate_error
)
unset(_builder_kit_cmaj_generate_arguments)

if(NOT generate_result EQUAL 0)
    message(FATAL_ERROR "cmaj generate failed:\n${generate_output}${generate_error}")
endif()

message(STATUS "${generate_output}${generate_error}")

builder_kit_sync_generated_project(
    "${_builder_kit_generated_project_stage}"
    "${BUILDER_KIT_EFFECT_OUTPUT_DIR}")
file(REMOVE_RECURSE "${_builder_kit_generated_project_stage}")
unset(_builder_kit_generated_project_stage)

add_subdirectory("${BUILDER_KIT_EFFECT_OUTPUT_DIR}" plugin)

if(NOT TARGET "${BUILDER_KIT_EFFECT_PLUGIN_TARGET}")
    message(FATAL_ERROR "Generated JUCE target not found: ${BUILDER_KIT_EFFECT_PLUGIN_TARGET}")
endif()

include("${CMAKE_CURRENT_LIST_DIR}/read_generated_plugin_info_class.cmake")
builder_kit_read_generated_plugin_info_class(
    _builder_kit_generated_plugin_info_class
    "${BUILDER_KIT_EFFECT_OUTPUT_DIR}/cmajor_plugin.cpp")

get_directory_property(
    _builder_kit_effect_osx_deployment_target
    DIRECTORY "${BUILDER_KIT_EFFECT_OUTPUT_DIR}"
    DEFINITION CMAKE_OSX_DEPLOYMENT_TARGET)
if(_builder_kit_effect_osx_deployment_target)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "${_builder_kit_effect_osx_deployment_target}")
endif()

add_executable(builder_kit_generated_latency_probe EXCLUDE_FROM_ALL
    "${CMAKE_CURRENT_LIST_DIR}/cmajor_plugin_latency_probe.cpp")
get_target_property(
    _builder_kit_effect_juce_generated_sources_dir
    "${BUILDER_KIT_EFFECT_PLUGIN_TARGET}"
    JUCE_GENERATED_SOURCES_DIRECTORY)
if(NOT _builder_kit_effect_juce_generated_sources_dir)
    message(FATAL_ERROR "Generated JUCE source directory not found for ${BUILDER_KIT_EFFECT_PLUGIN_TARGET}")
endif()
target_compile_features(builder_kit_generated_latency_probe PRIVATE cxx_std_17)
target_compile_definitions(builder_kit_generated_latency_probe PRIVATE
    BUILDER_KIT_GENERATED_INFO_CLASS=${_builder_kit_generated_plugin_info_class}
    JUCE_USE_CURL=0)
target_include_directories(builder_kit_generated_latency_probe PRIVATE
    "${BUILDER_KIT_EFFECT_OUTPUT_DIR}"
    "${_builder_kit_effect_juce_generated_sources_dir}"
    "${BUILDER_KIT_CMAJOR_SOURCE_DIR}/include"
    "${BUILDER_KIT_CMAJOR_SOURCE_DIR}/include/choc"
    "${BUILDER_KIT_JUCE_SOURCE_DIR}/modules")
target_link_libraries(builder_kit_generated_latency_probe PRIVATE
    "${BUILDER_KIT_EFFECT_PLUGIN_TARGET}")
unset(_builder_kit_generated_plugin_info_class)
unset(_builder_kit_effect_juce_generated_sources_dir)

set(_builder_kit_latency_probe_output "${CMAKE_BINARY_DIR}/latency_probe")
set_target_properties(builder_kit_generated_latency_probe PROPERTIES
    INTERPROCEDURAL_OPTIMIZATION_RELEASE ON
    RUNTIME_OUTPUT_DIRECTORY "${_builder_kit_latency_probe_output}")
foreach(configuration DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
    set_target_properties(builder_kit_generated_latency_probe PROPERTIES
        "RUNTIME_OUTPUT_DIRECTORY_${configuration}" "${_builder_kit_latency_probe_output}")
endforeach()
unset(_builder_kit_effect_osx_deployment_target)
unset(_builder_kit_latency_probe_output)
