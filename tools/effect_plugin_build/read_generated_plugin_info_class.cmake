function(cosimo_read_generated_plugin_info_class output_variable generated_source)
    if(NOT EXISTS "${generated_source}")
        message(FATAL_ERROR "Generated JUCE source not found: ${generated_source}")
    endif()

    file(STRINGS "${generated_source}" _cosimo_generated_plugin_factory_lines
        REGEX "^[ \t]*using Plugin = (cmaj::plugin::GeneratedPlugin|cosimo::BoundedGeneratedPlugin)<::[A-Za-z_][A-Za-z0-9_]*(, [0-9]+)?>;[ \t]*$")
    list(LENGTH _cosimo_generated_plugin_factory_lines _cosimo_generated_plugin_factory_count)

    if(NOT _cosimo_generated_plugin_factory_count EQUAL 1)
        message(FATAL_ERROR
            "Expected exactly one generated JUCE factory type in ${generated_source}; "
            "found ${_cosimo_generated_plugin_factory_count}")
    endif()

    list(GET _cosimo_generated_plugin_factory_lines 0 _cosimo_generated_plugin_factory_line)
    string(REGEX REPLACE
        "^[ \t]*using Plugin = (cmaj::plugin::GeneratedPlugin|cosimo::BoundedGeneratedPlugin)<::([A-Za-z_][A-Za-z0-9_]*)(, [0-9]+)?>;[ \t]*$"
        "\\2"
        _cosimo_generated_plugin_info_class
        "${_cosimo_generated_plugin_factory_line}")
    set(${output_variable} "${_cosimo_generated_plugin_info_class}" PARENT_SCOPE)
endfunction()

if(CMAKE_SCRIPT_MODE_FILE STREQUAL CMAKE_CURRENT_LIST_FILE)
    if(NOT DEFINED COSIMO_GENERATED_PLUGIN_SOURCE)
        message(FATAL_ERROR "COSIMO_GENERATED_PLUGIN_SOURCE is required")
    endif()

    cosimo_read_generated_plugin_info_class(
        _cosimo_script_generated_plugin_info_class
        "${COSIMO_GENERATED_PLUGIN_SOURCE}")
    message(STATUS "${_cosimo_script_generated_plugin_info_class}")
endif()
