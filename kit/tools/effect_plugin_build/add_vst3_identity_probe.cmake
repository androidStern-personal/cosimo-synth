# The installer uses this build-produced probe and never compiles tools itself.
# Keep its SDK headers on the ordinary pinned JUCE dependency seam.
function(kit_add_vst3_identity_probe juce_source_directory)
    if(NOT APPLE)
        return()
    endif()

    add_executable(kit_vst3_identity_probe EXCLUDE_FROM_ALL
        "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/vst3_identity_probe.cpp")
    target_compile_features(kit_vst3_identity_probe PRIVATE cxx_std_17)
    target_include_directories(kit_vst3_identity_probe PRIVATE
        "${juce_source_directory}/modules/juce_audio_processors_headless/format_types/VST3_SDK")
    target_link_libraries(kit_vst3_identity_probe PRIVATE "-framework CoreFoundation")
    set_target_properties(kit_vst3_identity_probe PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/identity_probe")
    foreach(configuration DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
        set_target_properties(kit_vst3_identity_probe PROPERTIES
            "RUNTIME_OUTPUT_DIRECTORY_${configuration}" "${CMAKE_BINARY_DIR}/identity_probe")
    endforeach()
endfunction()
