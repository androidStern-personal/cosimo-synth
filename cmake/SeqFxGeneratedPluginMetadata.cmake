function(cosimo_disable_generated_microphone_permission generated_cmake_path)
    if(NOT EXISTS "${generated_cmake_path}")
        message(FATAL_ERROR "Generated plugin CMake file does not exist: ${generated_cmake_path}")
    endif()

    file(READ "${generated_cmake_path}" generated_cmake)
    string(REGEX MATCHALL
        "[ \t]*MICROPHONE_PERMISSION_ENABLED[ \t]+TRUE"
        microphone_permission_matches
        "${generated_cmake}")
    list(LENGTH microphone_permission_matches microphone_permission_count)

    if(NOT microphone_permission_count EQUAL 1)
        message(FATAL_ERROR
            "Expected exactly one generated MICROPHONE_PERMISSION_ENABLED TRUE entry, found ${microphone_permission_count}")
    endif()

    string(REGEX MATCHALL
        "[ \t]*MICROPHONE_PERMISSION_TEXT[ \t]+[^\r\n]*"
        microphone_text_matches
        "${generated_cmake}")
    list(LENGTH microphone_text_matches microphone_text_count)

    if(NOT microphone_text_count EQUAL 0)
        message(FATAL_ERROR
            "Generated plugin already declares MICROPHONE_PERMISSION_TEXT; refusing an ambiguous metadata rewrite")
    endif()

    string(REGEX REPLACE
        "([ \t]*)MICROPHONE_PERMISSION_ENABLED[ \t]+TRUE"
        "\\1MICROPHONE_PERMISSION_ENABLED FALSE\n\\1MICROPHONE_PERMISSION_TEXT \"\""
        hardened_cmake
        "${generated_cmake}")
    file(WRITE "${generated_cmake_path}" "${hardened_cmake}")
endfunction()
