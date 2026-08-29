cmake_minimum_required(VERSION 3.16)

project(CosimoNativeCmajorProbes LANGUAGES CXX)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/cmake/CosimoDependencies.cmake")
cosimo_add_production_dependencies()

find_package(Threads REQUIRED)

set(COSIMO_RENDERER_SOURCES
    "${COSIMO_REPO_ROOT}/native/three_oscillator_renderer/RendererBridge.cpp"
    "${COSIMO_REPO_ROOT}/native/three_oscillator_renderer/WarpRenderer.cpp"
)

if(APPLE)
    find_library(ACCELERATE_FRAMEWORK Accelerate REQUIRED)
    find_library(AUDIO_TOOLBOX_FRAMEWORK AudioToolbox REQUIRED)
    find_library(COCOA_FRAMEWORK Cocoa REQUIRED)
    find_library(CORE_AUDIO_FRAMEWORK CoreAudio REQUIRED)
    find_library(CORE_MIDI_FRAMEWORK CoreMIDI REQUIRED)
    find_library(FOUNDATION_FRAMEWORK Foundation REQUIRED)
    find_library(IOKIT_FRAMEWORK IOKit REQUIRED)
    set(COSIMO_CMAJOR_PLATFORM_LIBRARIES
        "${ACCELERATE_FRAMEWORK}"
        "${AUDIO_TOOLBOX_FRAMEWORK}"
        "${COCOA_FRAMEWORK}"
        "${CORE_AUDIO_FRAMEWORK}"
        "${CORE_MIDI_FRAMEWORK}"
        "${FOUNDATION_FRAMEWORK}"
        "${IOKIT_FRAMEWORK}"
    )
elseif(UNIX)
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(GTK3 REQUIRED IMPORTED_TARGET gtk+-3.0)
    set(COSIMO_CMAJOR_PLATFORM_LIBRARIES PkgConfig::GTK3 ${CMAKE_DL_LIBS})
endif()

function(cosimo_configure_cmajor_probe target)
    target_compile_features(${target} PRIVATE cxx_std_17)
    target_compile_definitions(${target} PRIVATE CMAJOR_DLL=1)
    target_include_directories(${target} PRIVATE
        "${COSIMO_CMAJOR_SOURCE_DIR}/include"
        "${COSIMO_CHOC_SOURCE_DIR}"
        "${COSIMO_REPO_ROOT}/native/three_oscillator_renderer"
        "${COSIMO_REPO_ROOT}/native/three_oscillator_renderer/third_party/xsimd/include"
    )
    target_link_libraries(${target} PRIVATE
        Threads::Threads
        ${COSIMO_CMAJOR_PLATFORM_LIBRARIES}
    )
endfunction()

add_executable(ThreeOscillatorJITProviderIntegration
    ThreeOscillatorJITProviderIntegration.cpp
    ${COSIMO_RENDERER_SOURCES}
)
cosimo_configure_cmajor_probe(ThreeOscillatorJITProviderIntegration)

add_executable(BounceOfflineDriverProbe
    "${COSIMO_REPO_ROOT}/native/bounce/BounceNativeDriver.cpp"
    "${COSIMO_REPO_ROOT}/native/bounce/CmajorBounceOfflinePerformer.cpp"
    "${COSIMO_REPO_ROOT}/tests/native_quickjs/BounceOfflineDriverProbe.cpp"
    ${COSIMO_RENDERER_SOURCES}
)
cosimo_configure_cmajor_probe(BounceOfflineDriverProbe)
target_compile_options(BounceOfflineDriverProbe PRIVATE -O1 -g0)

add_executable(StoredStateStringComparison
    "${COSIMO_REPO_ROOT}/tests/native_quickjs/StoredStateStringComparison.cpp"
)
cosimo_configure_cmajor_probe(StoredStateStringComparison)

add_executable(QuickJSPendingJobs
    "${COSIMO_REPO_ROOT}/tests/native_quickjs/QuickJSPendingJobs.cpp"
)
cosimo_configure_cmajor_probe(QuickJSPendingJobs)

add_executable(WorkerErrorSurvivalProbe
    "${COSIMO_REPO_ROOT}/tests/native_quickjs/WorkerErrorSurvivalProbe.cpp"
)
cosimo_configure_cmajor_probe(WorkerErrorSurvivalProbe)

add_executable(ModulationRestoreProbe
    "${COSIMO_REPO_ROOT}/tests/native_quickjs/ModulationRestoreProbe.cpp"
    ${COSIMO_RENDERER_SOURCES}
)
cosimo_configure_cmajor_probe(ModulationRestoreProbe)
