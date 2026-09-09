cmake_minimum_required(VERSION 3.22)
project(EnhanceThatNativeProbe LANGUAGES CXX C)

if(NOT APPLE)
    message(FATAL_ERROR "This bounded candidate probe is for macOS only")
endif()

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/kit/cmake/CosimoDependencies.cmake")
cosimo_add_juce_dependency()
add_subdirectory("${COSIMO_JUCE_SOURCE_DIR}" juce)

# Independent host executable. Never link or regenerate the product target.
add_executable(enhance_that_vst3_probe main.cpp)
target_compile_features(enhance_that_vst3_probe PRIVATE cxx_std_17)
target_compile_definitions(enhance_that_vst3_probe PRIVATE
    JUCE_PLUGINHOST_VST3=1
    JUCE_PLUGINHOST_AU=0
    JUCE_PLUGINHOST_VST=0
    JUCE_PLUGINHOST_LADSPA=0
    JUCE_MODAL_LOOPS_PERMITTED=1
    JUCE_USE_CURL=0
    JUCE_WEB_BROWSER=0
    JUCE_DISABLE_JUCE_VERSION_PRINTING=1
)
target_link_libraries(enhance_that_vst3_probe PRIVATE
    juce::juce_audio_processors
    juce::juce_cryptography
)
