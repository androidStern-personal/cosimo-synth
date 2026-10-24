function(builder_kit_read_generated_plugin_info_class output_variable generated_source)
    if(NOT EXISTS "${generated_source}")
        message(FATAL_ERROR "Generated JUCE source not found: ${generated_source}")
    endif()

    file(STRINGS "${generated_source}" _builder_kit_generated_plugin_factory_lines
        REGEX "^[ \t]*using Plugin = cmaj::plugin::GeneratedPlugin<::[A-Za-z_][A-Za-z0-9_]*>;[ \t]*$")
    list(LENGTH _builder_kit_generated_plugin_factory_lines _builder_kit_generated_plugin_factory_count)

    if(NOT _builder_kit_generated_plugin_factory_count EQUAL 1)
        message(FATAL_ERROR
            "Expected exactly one generated JUCE factory type in ${generated_source}; "
            "found ${_builder_kit_generated_plugin_factory_count}")
    endif()

    list(GET _builder_kit_generated_plugin_factory_lines 0 _builder_kit_generated_plugin_factory_line)
    string(REGEX REPLACE
        "^[ \t]*using Plugin = cmaj::plugin::GeneratedPlugin<::([A-Za-z_][A-Za-z0-9_]*)>;[ \t]*$"
        "\\1"
        _builder_kit_generated_plugin_info_class
        "${_builder_kit_generated_plugin_factory_line}")
    set(${output_variable} "${_builder_kit_generated_plugin_info_class}" PARENT_SCOPE)
endfunction()

if(CMAKE_SCRIPT_MODE_FILE STREQUAL CMAKE_CURRENT_LIST_FILE)
    if(NOT DEFINED BUILDER_KIT_GENERATED_PLUGIN_SOURCE)
        message(FATAL_ERROR "BUILDER_KIT_GENERATED_PLUGIN_SOURCE is required")
    endif()

    builder_kit_read_generated_plugin_info_class(
        _builder_kit_script_generated_plugin_info_class
        "${BUILDER_KIT_GENERATED_PLUGIN_SOURCE}")
    message(STATUS "${_builder_kit_script_generated_plugin_info_class}")
endif()
