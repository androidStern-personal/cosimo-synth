cmake_minimum_required(VERSION 3.22)

project(
    CosimoSynthAUv3
    VERSION 0.1.1
    LANGUAGES CXX C OBJC OBJCXX
)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/.." ABSOLUTE)

set(
    COSIMO_CMAJOR_PATCH_FILE
    "${COSIMO_REPO_ROOT}/WavetableSynth.iOS.cmajorpatch"
    CACHE FILEPATH
    "The Cmajor patch to compile into the iOS app and AUv3 extension"
)

set(
    COSIMO_GENERATED_DIR
    "${CMAKE_BINARY_DIR}/generated/cmajor"
    CACHE PATH
    "Where the generated self-contained Cmajor JUCE files should be written"
)

set(COSIMO_IOS_GENERATOR_SCRIPT "${COSIMO_REPO_ROOT}/scripts/generate_ios_auv3_plugin.sh")

if (NOT EXISTS "${COSIMO_CMAJOR_PATCH_FILE}")
    message(FATAL_ERROR "Patch file not found: ${COSIMO_CMAJOR_PATCH_FILE}")
endif()

if (NOT EXISTS "${COSIMO_IOS_GENERATOR_SCRIPT}")
    message(FATAL_ERROR "Generator script not found: ${COSIMO_IOS_GENERATOR_SCRIPT}")
endif()

if (NOT JUCE_PATH)
    message(FATAL_ERROR "Set JUCE_PATH to a local JUCE checkout before configuring ios_auv3")
endif()

if (NOT EXISTS "${JUCE_PATH}/CMakeLists.txt")
    message(FATAL_ERROR "JUCE_PATH does not look like a JUCE checkout: ${JUCE_PATH}")
endif()

set(
    CMAJOR_VERSION
    ""
    CACHE STRING
    "The Cmajor version string reported by the cmaj tool"
)

if (NOT CMAJOR_VERSION)
    message(FATAL_ERROR "Set CMAJOR_VERSION to the version reported by the cmaj tool before configuring ios_auv3")
endif()

if (NOT CMAKE_SYSTEM_NAME STREQUAL "iOS")
    message(STATUS "Configure ios_auv3 with -G Xcode -DCMAKE_SYSTEM_NAME=iOS to build the iOS app and AUv3 extension.")
endif()

find_library(UIKitFramework UIKit REQUIRED)
find_library(AVFoundationFramework AVFoundation REQUIRED)
find_library(AudioToolboxFramework AudioToolbox REQUIRED)
find_library(WebKitFramework WebKit REQUIRED)
find_library(CoreAudioKitFramework CoreAudioKit REQUIRED)

set(JUCE_ENABLE_MODULE_SOURCE_GROUPS ON)

add_subdirectory("${JUCE_PATH}" juce)

file(
    GLOB_RECURSE COSIMO_PATCH_UI_FILES
    CONFIGURE_DEPENDS
    "${COSIMO_REPO_ROOT}/patch_gui/*"
)

set(
    COSIMO_GENERATED_PLUGIN_CPP
    "${COSIMO_GENERATED_DIR}/cmajor_plugin.cpp"
)
set(
    COSIMO_GENERATED_CMAJOR_HEADER
    "${COSIMO_GENERATED_DIR}/include/cmajor/helpers/cmaj_JUCEPlugin.h"
)
set(
    COSIMO_GENERATED_CHOC_HEADER
    "${COSIMO_GENERATED_DIR}/include/choc/choc/javascript/choc_javascript_QuickJS.h"
)

add_custom_command(
    OUTPUT
        "${COSIMO_GENERATED_PLUGIN_CPP}"
        "${COSIMO_GENERATED_CMAJOR_HEADER}"
        "${COSIMO_GENERATED_CHOC_HEADER}"
    COMMAND
        "${COSIMO_IOS_GENERATOR_SCRIPT}"
        "${COSIMO_GENERATED_DIR}"
        "${COSIMO_CMAJOR_PATCH_FILE}"
    DEPENDS
        "${COSIMO_IOS_GENERATOR_SCRIPT}"
        "${COSIMO_REPO_ROOT}/WavetableSynth.cmajor"
        "${COSIMO_REPO_ROOT}/WavetableSynth.cmajorpatch"
        "${COSIMO_REPO_ROOT}/cmajor/FixedFrameOscillator.cmajor"
        "${COSIMO_REPO_ROOT}/assets/factory-bank.wav"
        ${COSIMO_PATCH_UI_FILES}
    COMMENT
        "Generating the self-contained Cmajor JUCE source for the iOS app and AUv3 extension"
    VERBATIM
)

add_custom_target(
    cosimo_ios_auv3_generated_plugin
    DEPENDS
        "${COSIMO_GENERATED_PLUGIN_CPP}"
        "${COSIMO_GENERATED_CMAJOR_HEADER}"
        "${COSIMO_GENERATED_CHOC_HEADER}"
)

juce_add_plugin(CosimoSynth
    PRODUCT_NAME "Cosimo Synth"
    BUNDLE_ID "dev.cosimo.wavetable-synth"
    COMPANY_NAME "Cosimo"
    COMPANY_COPYRIGHT "(C)2026 Cosimo"
    PLUGIN_CODE CmDv
    PLUGIN_MANUFACTURER_CODE Manu
    FORMATS Standalone AUv3
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_SYNTH TRUE
    MICROPHONE_PERMISSION_ENABLED FALSE
)

juce_generate_juce_header(CosimoSynth)

set_source_files_properties(
    "${COSIMO_GENERATED_PLUGIN_CPP}"
    PROPERTIES GENERATED TRUE
)

target_sources(CosimoSynth PRIVATE
    "${COSIMO_GENERATED_PLUGIN_CPP}"
    "${CMAKE_CURRENT_LIST_DIR}/Source/cmaj_StaticLibraryShim.cpp"
)

target_compile_features(CosimoSynth PRIVATE cxx_std_17)

target_compile_definitions(CosimoSynth PRIVATE
    $<$<CONFIG:Debug>:DEBUG=1>
    $<$<CONFIG:Debug>:CMAJ_ENABLE_ALLOCATION_CHECKER=1>
    CMAJ_VERSION="${CMAJOR_VERSION}"
    CMAJ_ENABLE_WEBVIEW_DEV_TOOLS=0
    JUCE_DISABLE_JUCE_VERSION_PRINTING=1
    JUCE_USE_CURL=0
)

target_include_directories(CosimoSynth PRIVATE
    "${COSIMO_GENERATED_DIR}/include"
    "${COSIMO_GENERATED_DIR}/include/choc"
)

target_link_libraries(CosimoSynth PRIVATE
    juce::juce_audio_utils
    $<$<AND:$<CXX_COMPILER_ID:GNU>,$<VERSION_LESS:$<CXX_COMPILER_VERSION>,9.0>>:stdc++fs>
)

add_dependencies(CosimoSynth cosimo_ios_auv3_generated_plugin)

add_executable(CosimoSynthHost MACOSX_BUNDLE
    "${CMAKE_CURRENT_LIST_DIR}/Source/CosimoHostMain.mm"
    "${CMAKE_CURRENT_LIST_DIR}/Source/CosimoHostViewController.mm"
    "${CMAKE_CURRENT_LIST_DIR}/Source/CosimoAUv3HostHarness.mm"
)

set_target_properties(CosimoSynthHost PROPERTIES
    MACOSX_BUNDLE_INFO_PLIST "${CMAKE_CURRENT_LIST_DIR}/Source/CosimoHost-Info.plist.in"
    XCODE_ATTRIBUTE_PRODUCT_BUNDLE_IDENTIFIER "dev.cosimo.wavetable-synth-host"
    XCODE_ATTRIBUTE_TARGETED_DEVICE_FAMILY "1,2"
    XCODE_ATTRIBUTE_CLANG_ENABLE_OBJC_ARC YES
    XCODE_ATTRIBUTE_IPHONEOS_DEPLOYMENT_TARGET "16.0"
)

target_compile_features(CosimoSynthHost PRIVATE cxx_std_17)

target_link_libraries(CosimoSynthHost PRIVATE
    "${UIKitFramework}"
    "${AVFoundationFramework}"
    "${AudioToolboxFramework}"
    "${CoreAudioKitFramework}"
    "${WebKitFramework}"
)
