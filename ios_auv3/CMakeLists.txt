cmake_minimum_required(VERSION 3.22)

project(
    CosimoSynthAUv3
    VERSION 0.1.1
    LANGUAGES CXX C OBJC OBJCXX
)

find_package(Python3 REQUIRED COMPONENTS Interpreter)

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
    "Where the generated raw Cmajor performer source should be written"
)

set(
    COSIMO_WEBVIEW_DEV_SERVER_URL
    "$ENV{COSIMO_WEBVIEW_DEV_SERVER_URL}"
    CACHE STRING
    "Optional absolute URL for a development web server that serves patch_gui/ and cmaj_api/ with HMR"
)

set(
    COSIMO_ENABLE_EDITOR_INSPECTION
    ""
    CACHE STRING
    "Optional override for the in-extension editor inspection hook. Leave empty to enable it only in Debug builds."
)

set(COSIMO_IOS_GENERATOR_SCRIPT "${COSIMO_REPO_ROOT}/scripts/generate_ios_auv3_plugin.sh")

if (NOT EXISTS "${COSIMO_CMAJOR_PATCH_FILE}")
    message(FATAL_ERROR "Patch file not found: ${COSIMO_CMAJOR_PATCH_FILE}")
endif()

if (NOT EXISTS "${COSIMO_IOS_GENERATOR_SCRIPT}")
    message(FATAL_ERROR "Generator script not found: ${COSIMO_IOS_GENERATOR_SCRIPT}")
endif()

set(COSIMO_CMAJOR_RUNTIME_SCRIPT "${COSIMO_REPO_ROOT}/scripts/ensure_cmajor_runtime.py")

if (NOT EXISTS "${COSIMO_CMAJOR_RUNTIME_SCRIPT}")
    message(FATAL_ERROR "Pinned Cmajor runtime fetch helper not found: ${COSIMO_CMAJOR_RUNTIME_SCRIPT}")
endif()

execute_process(
    COMMAND
        "${Python3_EXECUTABLE}"
        "${COSIMO_CMAJOR_RUNTIME_SCRIPT}"
        --path
    WORKING_DIRECTORY
        "${COSIMO_REPO_ROOT}"
    RESULT_VARIABLE
        COSIMO_CMAJOR_RUNTIME_RESULT
    OUTPUT_VARIABLE
        COSIMO_CMAJOR_RUNTIME_DIR
    ERROR_VARIABLE
        COSIMO_CMAJOR_RUNTIME_ERROR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

if (NOT COSIMO_CMAJOR_RUNTIME_RESULT EQUAL 0)
    string(STRIP "${COSIMO_CMAJOR_RUNTIME_ERROR}" COSIMO_CMAJOR_RUNTIME_ERROR)
    message(FATAL_ERROR "Failed to fetch the pinned Cmajor runtime: ${COSIMO_CMAJOR_RUNTIME_ERROR}")
endif()

if (NOT EXISTS "${COSIMO_CMAJOR_RUNTIME_DIR}/include/cmajor/helpers/cmaj_Patch.h")
    message(FATAL_ERROR "Pinned Cmajor helper runtime is incomplete: ${COSIMO_CMAJOR_RUNTIME_DIR}")
endif()

if (NOT EXISTS "${COSIMO_CMAJOR_RUNTIME_DIR}/javascript/cmaj_api/cmaj-patch-view.js")
    message(FATAL_ERROR "Pinned Cmajor web API files are incomplete: ${COSIMO_CMAJOR_RUNTIME_DIR}")
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

set(JUCE_ENABLE_MODULE_SOURCE_GROUPS ON)

add_subdirectory("${JUCE_PATH}" juce)

file(
    GLOB_RECURSE COSIMO_REACT_UI_FILES
    CONFIGURE_DEPENDS
    "${COSIMO_REPO_ROOT}/ui/ios/*"
    "${COSIMO_REPO_ROOT}/ui/shared/*"
)
file(
    GLOB_RECURSE COSIMO_WORKER_UI_FILES
    CONFIGURE_DEPENDS
    "${COSIMO_REPO_ROOT}/ui/worker/*"
)
file(
    GLOB_RECURSE COSIMO_FACTORY_SOURCE_FILES
    CONFIGURE_DEPENDS
    "${COSIMO_REPO_ROOT}/assets/factory_sources/*"
)
file(
    GLOB_RECURSE COSIMO_CMAJOR_WEB_FILES
    CONFIGURE_DEPENDS
    "${COSIMO_CMAJOR_RUNTIME_DIR}/javascript/cmaj_api/*"
)

set(
    COSIMO_RUNTIME_PATCH_FILE
    "${COSIMO_REPO_ROOT}/WavetableSynth.iOS.cmajorpatch"
)
set(
    COSIMO_SHARED_WAVETABLE_ENTITLEMENTS
    "${CMAKE_CURRENT_LIST_DIR}/Entitlements/CosimoSharedWavetableLibrary.entitlements"
)

set(
    COSIMO_GENERATED_PERFORMER_CPP
    "${COSIMO_GENERATED_DIR}/WavetableSynth.cpp"
)

add_custom_command(
    OUTPUT
        "${COSIMO_GENERATED_PERFORMER_CPP}"
    COMMAND
        "${COSIMO_IOS_GENERATOR_SCRIPT}"
        "${COSIMO_GENERATED_DIR}"
        "${COSIMO_CMAJOR_PATCH_FILE}"
    DEPENDS
        "${COSIMO_IOS_GENERATOR_SCRIPT}"
        "${COSIMO_REPO_ROOT}/build_assets.py"
        "${COSIMO_REPO_ROOT}/package.json"
        "${COSIMO_REPO_ROOT}/cmajor/WavetableSynth.cmajor"
        "${COSIMO_REPO_ROOT}/WavetableSynth.cmajorpatch"
        "${COSIMO_REPO_ROOT}/cmajor/FixedFrameOscillator.cmajor"
        "${COSIMO_REPO_ROOT}/assets/factory-table-catalog.json"
        "${COSIMO_REPO_ROOT}/assets/factory-bank-catalog.json"
        "${COSIMO_REPO_ROOT}/ui/build.mjs"
        "${COSIMO_REPO_ROOT}/ui/vite.shared.mjs"
        "${COSIMO_REPO_ROOT}/ui/vite.worker.config.mjs"
        "${COSIMO_REPO_ROOT}/ios_auv3/vite.config.mjs"
        ${COSIMO_FACTORY_SOURCE_FILES}
        ${COSIMO_REACT_UI_FILES}
        ${COSIMO_WORKER_UI_FILES}
        ${COSIMO_CMAJOR_WEB_FILES}
    COMMENT
        "Generating the raw Cmajor performer source for the iOS app and AUv3 extension"
    VERBATIM
)

add_custom_target(
    cosimo_ios_auv3_generated_performer
    DEPENDS
        "${COSIMO_GENERATED_PERFORMER_CPP}"
)

juce_add_plugin(CosimoSynth
    PRODUCT_NAME "Cosimo Synth"
    BUNDLE_ID "dev.cosimo.wavetable-synth"
    COMPANY_NAME "Cosimo"
    COMPANY_COPYRIGHT "(C)2026 Cosimo"
    FILE_SHARING_ENABLED TRUE
    PLIST_TO_MERGE "<plist><dict><key>LSSupportsOpeningDocumentsInPlace</key><true/></dict></plist>"
    PLUGIN_CODE CmDv
    PLUGIN_MANUFACTURER_CODE Manu
    FORMATS Standalone AUv3
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_SYNTH TRUE
    MICROPHONE_PERMISSION_ENABLED FALSE
)

juce_generate_juce_header(CosimoSynth)

set(COSIMO_GENERATED_CPP_PATH_DEFINE "\"${COSIMO_GENERATED_PERFORMER_CPP}\"")
set(COSIMO_WEBVIEW_DEV_SERVER_URL_DEFINE "\"${COSIMO_WEBVIEW_DEV_SERVER_URL}\"")

if (COSIMO_ENABLE_EDITOR_INSPECTION STREQUAL "")
    set(COSIMO_ENABLE_EDITOR_INSPECTION_DEFINE "$<IF:$<CONFIG:Debug>,1,0>")
else()
    set(COSIMO_ENABLE_EDITOR_INSPECTION_DEFINE "${COSIMO_ENABLE_EDITOR_INSPECTION}")
endif()

target_sources(CosimoSynth PRIVATE
    "${CMAKE_CURRENT_LIST_DIR}/Source/CosimoPluginMain.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/Source/cmaj_StaticLibraryShim.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/Source/CosimoSharedWavetableLibrary.mm"
)

target_compile_features(CosimoSynth PRIVATE cxx_std_17)

target_compile_definitions(CosimoSynth PRIVATE
    $<$<CONFIG:Debug>:DEBUG=1>
    $<$<CONFIG:Debug>:CMAJ_ENABLE_ALLOCATION_CHECKER=1>
    CMAJ_VERSION="${CMAJOR_VERSION}"
    COSIMO_ENABLE_WEBVIEW_DEV_SERVER=$<IF:$<CONFIG:Debug>,1,0>
    COSIMO_ENABLE_EDITOR_INSPECTION=${COSIMO_ENABLE_EDITOR_INSPECTION_DEFINE}
    COSIMO_GENERATED_CPP_PATH=${COSIMO_GENERATED_CPP_PATH_DEFINE}
    COSIMO_WEBVIEW_DEV_SERVER_URL=${COSIMO_WEBVIEW_DEV_SERVER_URL_DEFINE}
    CMAJ_ENABLE_WEBVIEW_DEV_TOOLS=0
    JUCE_DISABLE_JUCE_VERSION_PRINTING=1
    JUCE_USE_CURL=0
)

target_include_directories(CosimoSynth PRIVATE
    "${COSIMO_CMAJOR_RUNTIME_DIR}/include"
    "${COSIMO_CMAJOR_RUNTIME_DIR}/include/choc"
    "${CMAKE_CURRENT_LIST_DIR}/Source"
)

target_link_libraries(CosimoSynth PRIVATE
    juce::juce_audio_utils
    $<$<AND:$<CXX_COMPILER_ID:GNU>,$<VERSION_LESS:$<CXX_COMPILER_VERSION>,9.0>>:stdc++fs>
)

add_dependencies(CosimoSynth cosimo_ios_auv3_generated_performer)

foreach(bundle_target CosimoSynth_Standalone CosimoSynth_AUv3)
    set_target_properties(${bundle_target} PROPERTIES
        XCODE_ATTRIBUTE_CODE_SIGN_ENTITLEMENTS "${COSIMO_SHARED_WAVETABLE_ENTITLEMENTS}"
        XCODE_ATTRIBUTE_IPHONEOS_DEPLOYMENT_TARGET "18.0"
    )

    add_custom_command(
        TARGET ${bundle_target}
        POST_BUILD
        COMMAND
            "${CMAKE_COMMAND}" -E rm -rf
            "$<TARGET_FILE_DIR:${bundle_target}>/patch_gui"
        COMMAND
            "${CMAKE_COMMAND}" -E make_directory
            "$<TARGET_FILE_DIR:${bundle_target}>/patch_gui"
        COMMAND
            "${CMAKE_COMMAND}" -E copy_if_different
            "${COSIMO_REPO_ROOT}/patch_gui/index.ios.html"
            "$<TARGET_FILE_DIR:${bundle_target}>/patch_gui/index.ios.html"
        COMMAND
            "${CMAKE_COMMAND}" -E copy_if_different
            "${COSIMO_REPO_ROOT}/patch_gui/index.ios-host.js"
            "$<TARGET_FILE_DIR:${bundle_target}>/patch_gui/index.ios-host.js"
        COMMAND
            "${CMAKE_COMMAND}" -E copy_if_different
            "${COSIMO_REPO_ROOT}/patch_gui/index.ios.js"
            "$<TARGET_FILE_DIR:${bundle_target}>/patch_gui/index.ios.js"
        COMMAND
            "${CMAKE_COMMAND}" -E copy_if_different
            "${COSIMO_REPO_ROOT}/patch_gui/resource-client.js"
            "$<TARGET_FILE_DIR:${bundle_target}>/patch_gui/resource-client.js"
        COMMAND
            "${CMAKE_COMMAND}" -E copy_if_different
            "${COSIMO_REPO_ROOT}/patch_gui/wavetable-worker.js"
            "$<TARGET_FILE_DIR:${bundle_target}>/patch_gui/wavetable-worker.js"
        COMMAND
            "${CMAKE_COMMAND}" -E rm -rf
            "$<TARGET_FILE_DIR:${bundle_target}>/cmaj_api"
        COMMAND
            "${CMAKE_COMMAND}" -E copy_directory
            "${COSIMO_CMAJOR_RUNTIME_DIR}/javascript/cmaj_api"
            "$<TARGET_FILE_DIR:${bundle_target}>/cmaj_api"
        COMMAND
            "${CMAKE_COMMAND}" -E rm -rf
            "$<TARGET_FILE_DIR:${bundle_target}>/assets"
        COMMAND
            "${CMAKE_COMMAND}" -E copy_directory
            "${COSIMO_REPO_ROOT}/assets"
            "$<TARGET_FILE_DIR:${bundle_target}>/assets"
        COMMAND
            "${CMAKE_COMMAND}" -E copy_if_different
            "${COSIMO_REPO_ROOT}/WavetableSynth.cmajorpatch"
            "$<TARGET_FILE_DIR:${bundle_target}>/WavetableSynth.cmajorpatch"
        COMMAND
            "${CMAKE_COMMAND}" -E copy_if_different
            "${COSIMO_RUNTIME_PATCH_FILE}"
            "$<TARGET_FILE_DIR:${bundle_target}>/WavetableSynth.iOS.cmajorpatch"
        COMMENT
            "Copying the runtime patch, iPhone UI runtime files, Cmajor web API, and factory assets into ${bundle_target}"
        VERBATIM
    )
endforeach()

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
    XCODE_ATTRIBUTE_IPHONEOS_DEPLOYMENT_TARGET "18.0"
)

target_compile_features(CosimoSynthHost PRIVATE cxx_std_17)

target_link_libraries(CosimoSynthHost PRIVATE
    "-framework UIKit"
    "-framework AVFoundation"
    "-framework AudioToolbox"
    "-framework CoreAudioKit"
    "-framework WebKit"
)
