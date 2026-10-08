function(builder_kit_sync_generated_project source_directory destination_directory)
    get_filename_component(_builder_kit_sync_source "${source_directory}" ABSOLUTE)
    get_filename_component(_builder_kit_sync_destination "${destination_directory}" ABSOLUTE)

    if(NOT IS_DIRECTORY "${_builder_kit_sync_source}")
        message(FATAL_ERROR "Generated project staging directory not found: ${_builder_kit_sync_source}")
    endif()

    if(_builder_kit_sync_source STREQUAL _builder_kit_sync_destination)
        message(FATAL_ERROR "Generated project staging and destination directories must differ")
    endif()

    file(MAKE_DIRECTORY "${_builder_kit_sync_destination}")
    file(GLOB_RECURSE _builder_kit_sync_source_entries
        LIST_DIRECTORIES true
        RELATIVE "${_builder_kit_sync_source}"
        "${_builder_kit_sync_source}/*")
    list(SORT _builder_kit_sync_source_entries)

    foreach(_builder_kit_sync_relative IN LISTS _builder_kit_sync_source_entries)
        if(_builder_kit_sync_relative STREQUAL "_build"
                OR _builder_kit_sync_relative MATCHES "^_build/")
            message(FATAL_ERROR "Generated project may not contain the reserved _build directory")
        endif()

        set(_builder_kit_sync_from "${_builder_kit_sync_source}/${_builder_kit_sync_relative}")
        set(_builder_kit_sync_to "${_builder_kit_sync_destination}/${_builder_kit_sync_relative}")

        if(IS_SYMLINK "${_builder_kit_sync_from}")
            file(READ_SYMLINK "${_builder_kit_sync_from}" _builder_kit_sync_link_target)
            set(_builder_kit_sync_link_matches false)

            if(IS_SYMLINK "${_builder_kit_sync_to}")
                file(READ_SYMLINK "${_builder_kit_sync_to}" _builder_kit_sync_existing_link_target)
                if(_builder_kit_sync_link_target STREQUAL _builder_kit_sync_existing_link_target)
                    set(_builder_kit_sync_link_matches true)
                endif()
            endif()

            if(NOT _builder_kit_sync_link_matches)
                file(REMOVE_RECURSE "${_builder_kit_sync_to}")
                get_filename_component(_builder_kit_sync_parent "${_builder_kit_sync_to}" DIRECTORY)
                file(MAKE_DIRECTORY "${_builder_kit_sync_parent}")
                file(CREATE_LINK
                    "${_builder_kit_sync_link_target}"
                    "${_builder_kit_sync_to}"
                    SYMBOLIC
                    RESULT _builder_kit_sync_link_result)
                if(NOT _builder_kit_sync_link_result STREQUAL "0")
                    message(FATAL_ERROR
                        "Could not copy generated symlink ${_builder_kit_sync_relative}: "
                        "${_builder_kit_sync_link_result}")
                endif()
            endif()
        elseif(IS_DIRECTORY "${_builder_kit_sync_from}")
            if((EXISTS "${_builder_kit_sync_to}" OR IS_SYMLINK "${_builder_kit_sync_to}")
                    AND (NOT IS_DIRECTORY "${_builder_kit_sync_to}" OR IS_SYMLINK "${_builder_kit_sync_to}"))
                file(REMOVE_RECURSE "${_builder_kit_sync_to}")
            endif()
            file(MAKE_DIRECTORY "${_builder_kit_sync_to}")
        elseif(EXISTS "${_builder_kit_sync_from}")
            if(_builder_kit_sync_relative STREQUAL "CMakeLists.txt"
                    OR _builder_kit_sync_relative MATCHES "\\.(cmake|c|cc|cpp|cxx|h|hpp|m|mm|json|plist|txt)$")
                file(READ "${_builder_kit_sync_from}" _builder_kit_sync_text)
                string(FIND "${_builder_kit_sync_text}" "${_builder_kit_sync_source}" _builder_kit_sync_stage_path_index)
                if(NOT _builder_kit_sync_stage_path_index EQUAL -1)
                    message(FATAL_ERROR
                        "Generated file ${_builder_kit_sync_relative} contains its staging directory path; "
                        "refusing to publish location-dependent output")
                endif()
            endif()

            if(IS_DIRECTORY "${_builder_kit_sync_to}" OR IS_SYMLINK "${_builder_kit_sync_to}")
                file(REMOVE_RECURSE "${_builder_kit_sync_to}")
            endif()
            get_filename_component(_builder_kit_sync_parent "${_builder_kit_sync_to}" DIRECTORY)
            file(MAKE_DIRECTORY "${_builder_kit_sync_parent}")
            execute_process(
                COMMAND "${CMAKE_COMMAND}" -E copy_if_different
                    "${_builder_kit_sync_from}"
                    "${_builder_kit_sync_to}"
                RESULT_VARIABLE _builder_kit_sync_copy_result
                ERROR_VARIABLE _builder_kit_sync_copy_error)
            if(NOT _builder_kit_sync_copy_result EQUAL 0)
                message(FATAL_ERROR
                    "Could not synchronize generated file ${_builder_kit_sync_relative}: "
                    "${_builder_kit_sync_copy_error}")
            endif()
        else()
            message(FATAL_ERROR "Unsupported generated project entry: ${_builder_kit_sync_relative}")
        endif()
    endforeach()

    file(GLOB_RECURSE _builder_kit_sync_destination_entries
        LIST_DIRECTORIES true
        RELATIVE "${_builder_kit_sync_destination}"
        "${_builder_kit_sync_destination}/*")
    list(SORT _builder_kit_sync_destination_entries ORDER DESCENDING)

    foreach(_builder_kit_sync_relative IN LISTS _builder_kit_sync_destination_entries)
        if(_builder_kit_sync_relative STREQUAL "_build"
                OR _builder_kit_sync_relative MATCHES "^_build/")
            continue()
        endif()

        list(FIND _builder_kit_sync_source_entries "${_builder_kit_sync_relative}" _builder_kit_sync_source_index)
        if(_builder_kit_sync_source_index EQUAL -1)
            file(REMOVE_RECURSE "${_builder_kit_sync_destination}/${_builder_kit_sync_relative}")
        endif()
    endforeach()
endfunction()

if(CMAKE_SCRIPT_MODE_FILE STREQUAL CMAKE_CURRENT_LIST_FILE)
    if(NOT DEFINED BUILDER_KIT_GENERATED_PROJECT_SOURCE)
        message(FATAL_ERROR "BUILDER_KIT_GENERATED_PROJECT_SOURCE is required")
    endif()
    if(NOT DEFINED BUILDER_KIT_GENERATED_PROJECT_DESTINATION)
        message(FATAL_ERROR "BUILDER_KIT_GENERATED_PROJECT_DESTINATION is required")
    endif()

    builder_kit_sync_generated_project(
        "${BUILDER_KIT_GENERATED_PROJECT_SOURCE}"
        "${BUILDER_KIT_GENERATED_PROJECT_DESTINATION}")
endif()
