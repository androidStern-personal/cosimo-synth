cmake_minimum_required(VERSION 3.28)
project(KitVST3InstallFixtures LANGUAGES CXX)

if(NOT APPLE)
    message(FATAL_ERROR "The VST3 install fixtures exercise macOS bundle loading")
endif()

include("${CMAKE_CURRENT_LIST_DIR}/../../../cmake/CosimoDependencies.cmake")
cosimo_add_juce_dependency()
include("${CMAKE_CURRENT_LIST_DIR}/../../../tools/effect_plugin_build/add_vst3_identity_probe.cmake")
kit_add_vst3_identity_probe("${COSIMO_JUCE_SOURCE_DIR}")
add_custom_target(native_install_fixtures DEPENDS kit_vst3_identity_probe)

foreach(variant RANGE 0 8)
    add_library(factory_${variant} MODULE factory.cpp)
    target_compile_features(factory_${variant} PRIVATE cxx_std_17)
    target_compile_definitions(factory_${variant} PRIVATE FIXTURE_VARIANT=${variant})
    target_include_directories(factory_${variant} PRIVATE
        "${COSIMO_JUCE_SOURCE_DIR}/modules/juce_audio_processors_headless/format_types/VST3_SDK")
    set_target_properties(factory_${variant} PROPERTIES
        PREFIX "" LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/factories")
    add_dependencies(native_install_fixtures factory_${variant})
endforeach()
