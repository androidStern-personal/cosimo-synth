if(NOT DEFINED COSIMO_GENERATED_PLUGIN_SOURCE)
    message(FATAL_ERROR "COSIMO_GENERATED_PLUGIN_SOURCE is required")
endif()

if(NOT EXISTS "${COSIMO_GENERATED_PLUGIN_SOURCE}")
    message(FATAL_ERROR "Generated JUCE source not found: ${COSIMO_GENERATED_PLUGIN_SOURCE}")
endif()

if(NOT DEFINED COSIMO_GENERATED_PLUGIN_EDITOR_MAX_WIDTH
        OR NOT COSIMO_GENERATED_PLUGIN_EDITOR_MAX_WIDTH MATCHES "^[0-9]+$"
        OR COSIMO_GENERATED_PLUGIN_EDITOR_MAX_WIDTH LESS 250)
    message(FATAL_ERROR "COSIMO_GENERATED_PLUGIN_EDITOR_MAX_WIDTH must be an integer of at least 250")
endif()

file(STRINGS "${COSIMO_GENERATED_PLUGIN_SOURCE}" _cosimo_helper_include_lines
    REGEX "^[ \t]*#include \"cmajor/helpers/cmaj_JUCEPlugin.h\"[ \t]*$")
file(STRINGS "${COSIMO_GENERATED_PLUGIN_SOURCE}" _cosimo_generated_plugin_alias_lines
    REGEX "^[ \t]*using Plugin = cmaj::plugin::GeneratedPlugin<::[A-Za-z_][A-Za-z0-9_]*>;[ \t]*$")
list(LENGTH _cosimo_helper_include_lines _cosimo_helper_include_count)
list(LENGTH _cosimo_generated_plugin_alias_lines _cosimo_generated_plugin_alias_count)

if(NOT _cosimo_helper_include_count EQUAL 1)
    message(FATAL_ERROR
        "Expected exactly one Cmajor JUCE helper include in ${COSIMO_GENERATED_PLUGIN_SOURCE}; "
        "found ${_cosimo_helper_include_count}")
endif()

if(NOT _cosimo_generated_plugin_alias_count EQUAL 1)
    message(FATAL_ERROR
        "Expected exactly one generated JUCE plugin alias in ${COSIMO_GENERATED_PLUGIN_SOURCE}; "
        "found ${_cosimo_generated_plugin_alias_count}")
endif()

list(GET _cosimo_generated_plugin_alias_lines 0 _cosimo_generated_plugin_alias_line)
string(REGEX REPLACE
    "^[ \t]*using Plugin = cmaj::plugin::GeneratedPlugin<(::[A-Za-z_][A-Za-z0-9_]*)>;[ \t]*$"
    "    using Plugin = cosimo::BoundedGeneratedPlugin<\\1, ${COSIMO_GENERATED_PLUGIN_EDITOR_MAX_WIDTH}>;"
    _cosimo_bounded_plugin_alias_line
    "${_cosimo_generated_plugin_alias_line}")

file(READ "${COSIMO_GENERATED_PLUGIN_SOURCE}" _cosimo_generated_plugin_source)
string(REPLACE
    "#include \"cmajor/helpers/cmaj_JUCEPlugin.h\""
    "#include \"cmajor/helpers/cmaj_JUCEPlugin.h\"\n#include \"CosimoBoundedGeneratedPlugin.h\""
    _cosimo_generated_plugin_source
    "${_cosimo_generated_plugin_source}")
string(REPLACE
    "${_cosimo_generated_plugin_alias_line}"
    "${_cosimo_bounded_plugin_alias_line}"
    _cosimo_generated_plugin_source
    "${_cosimo_generated_plugin_source}")
file(WRITE "${COSIMO_GENERATED_PLUGIN_SOURCE}" "${_cosimo_generated_plugin_source}")
