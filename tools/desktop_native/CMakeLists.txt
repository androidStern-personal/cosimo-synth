cmake_minimum_required(VERSION 3.16..3.22)

project(
    CosimoDesktopNative
    VERSION 1.0.3066
    LANGUAGES CXX C)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/kit/cmake/CosimoDependencies.cmake")
cosimo_add_production_dependencies()

if (NOT DEFINED COSIMO_PATCH_PATH OR COSIMO_PATCH_PATH STREQUAL "")
    message(FATAL_ERROR "COSIMO_PATCH_PATH must point to WavetableSynth.cmajorpatch")
endif()

if (NOT DEFINED COSIMO_DESKTOP_UI_SOURCE_MODE OR COSIMO_DESKTOP_UI_SOURCE_MODE STREQUAL "")
    set(COSIMO_DESKTOP_UI_SOURCE_MODE "compiled")
endif()

if (NOT COSIMO_DESKTOP_UI_SOURCE_MODE STREQUAL "compiled"
    AND NOT COSIMO_DESKTOP_UI_SOURCE_MODE STREQUAL "dev-server")
    message(FATAL_ERROR "COSIMO_DESKTOP_UI_SOURCE_MODE must be 'compiled' or 'dev-server'")
endif()

if (NOT DEFINED COSIMO_DESKTOP_DEV_SERVER_ORIGIN OR COSIMO_DESKTOP_DEV_SERVER_ORIGIN STREQUAL "")
    set(COSIMO_DESKTOP_DEV_SERVER_ORIGIN "http://127.0.0.1:5174")
endif()

set(CMAJ_VERSION ${PROJECT_VERSION})
set(JUCE_ENABLE_MODULE_SOURCE_GROUPS ON)

add_subdirectory("${COSIMO_JUCE_SOURCE_DIR}" juce)

juce_add_plugin(CosimoDesktopNative
    PRODUCT_NAME "CosimoDesktopNative"
    BUNDLE_ID "dev.cosimo.desktop.native"
    COMPANY_NAME "Cosimo"
    COMPANY_COPYRIGHT "(C)2026 Cosimo"
    PLUGIN_CODE CmDv
    FORMATS AU VST3 Standalone
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT TRUE
    IS_SYNTH TRUE
)

juce_generate_juce_header(CosimoDesktopNative)

target_sources(CosimoDesktopNative PRIVATE
    Source/cmaj_PatchLoaderPlugin.cpp
    Source/CosimoBounceNativePlatform.cpp
    "${CMAKE_CURRENT_LIST_DIR}/../../native/bounce/BounceNativeDriver.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/../../native/bounce/BounceNativePlatform.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/../../native/bounce/Sha256.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/../../native/bounce/BounceNativeBankStore.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/../../native/bounce/CmajorBounceOfflinePerformer.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/../../native/three_oscillator_renderer/RendererBridge.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/../../native/three_oscillator_renderer/WarpRenderer.cpp"
)

target_compile_features(CosimoDesktopNative PRIVATE cxx_std_17)

target_compile_definitions(CosimoDesktopNative PRIVATE
    $<$<CONFIG:Debug>:DEBUG=1>
    $<$<CONFIG:Debug>:CMAJ_ENABLE_ALLOCATION_CHECKER=1>
    CMAJOR_DLL=1
    CMAJ_ENABLE_WEBVIEW_DEV_TOOLS=1
    COSIMO_ENABLE_WEBVIEW_DEV_SERVER=1
    COSIMO_DESKTOP_UI_SOURCE_MODE="${COSIMO_DESKTOP_UI_SOURCE_MODE}"
    COSIMO_DESKTOP_DEV_SERVER_ORIGIN="${COSIMO_DESKTOP_DEV_SERVER_ORIGIN}"
    COSIMO_PATCH_PATH="${COSIMO_PATCH_PATH}"
    COSIMO_HOST_KEYBOARD_RELAY_PROCESS_NAME="CosimoDesktopNative"
    JUCE_DISABLE_JUCE_VERSION_PRINTING=1
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_USE_CURL=0
)

target_include_directories(CosimoDesktopNative PRIVATE
    "${COSIMO_CMAJOR_SOURCE_DIR}/include"
    "${COSIMO_CHOC_SOURCE_DIR}"
    "${CMAKE_CURRENT_LIST_DIR}/../../native/three_oscillator_renderer"
    "${CMAKE_CURRENT_LIST_DIR}/../../native/bounce"
    "${CMAKE_CURRENT_LIST_DIR}/../../native/three_oscillator_renderer/third_party/xsimd/include"
)

target_link_libraries(CosimoDesktopNative
    PRIVATE
        juce::juce_audio_utils
        $<$<AND:$<CXX_COMPILER_ID:GNU>,$<VERSION_LESS:$<CXX_COMPILER_VERSION>,9.0>>:stdc++fs>
)

add_executable(cosimo_t78_vst3_automation_probe EXCLUDE_FROM_ALL
    Source/T78VST3AutomationProbe.cpp
)

target_compile_features(cosimo_t78_vst3_automation_probe PRIVATE cxx_std_17)

target_compile_definitions(cosimo_t78_vst3_automation_probe PRIVATE
    JUCE_PLUGINHOST_AU=0
    JUCE_PLUGINHOST_VST3=1
    JUCE_USE_CURL=0
)

target_include_directories(cosimo_t78_vst3_automation_probe PRIVATE
    "${COSIMO_REPO_ROOT}"
)

target_link_libraries(cosimo_t78_vst3_automation_probe PRIVATE
    juce::juce_audio_processors
)
