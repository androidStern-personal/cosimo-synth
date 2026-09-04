function(cosimo_sync_generated_project source_directory destination_directory)
    get_filename_component(_cosimo_sync_source "${source_directory}" ABSOLUTE)
    get_filename_component(_cosimo_sync_destination "${destination_directory}" ABSOLUTE)

    if(NOT IS_DIRECTORY "${_cosimo_sync_source}")
        message(FATAL_ERROR "Generated project staging directory not found: ${_cosimo_sync_source}")
    endif()

    if(_cosimo_sync_source STREQUAL _cosimo_sync_destination)
        message(FATAL_ERROR "Generated project staging and destination directories must differ")
    endif()

    file(MAKE_DIRECTORY "${_cosimo_sync_destination}")
    file(GLOB_RECURSE _cosimo_sync_source_entries
        LIST_DIRECTORIES true
        RELATIVE "${_cosimo_sync_source}"
        "${_cosimo_sync_source}/*")
    list(SORT _cosimo_sync_source_entries)

    foreach(_cosimo_sync_relative IN LISTS _cosimo_sync_source_entries)
        if(_cosimo_sync_relative STREQUAL "_build"
                OR _cosimo_sync_relative MATCHES "^_build/")
            message(FATAL_ERROR "Generated project may not contain the reserved _build directory")
        endif()

        set(_cosimo_sync_from "${_cosimo_sync_source}/${_cosimo_sync_relative}")
        set(_cosimo_sync_to "${_cosimo_sync_destination}/${_cosimo_sync_relative}")

        if(IS_SYMLINK "${_cosimo_sync_from}")
            file(READ_SYMLINK "${_cosimo_sync_from}" _cosimo_sync_link_target)
            set(_cosimo_sync_link_matches false)

            if(IS_SYMLINK "${_cosimo_sync_to}")
                file(READ_SYMLINK "${_cosimo_sync_to}" _cosimo_sync_existing_link_target)
                if(_cosimo_sync_link_target STREQUAL _cosimo_sync_existing_link_target)
                    set(_cosimo_sync_link_matches true)
                endif()
            endif()

            if(NOT _cosimo_sync_link_matches)
                file(REMOVE_RECURSE "${_cosimo_sync_to}")
                get_filename_component(_cosimo_sync_parent "${_cosimo_sync_to}" DIRECTORY)
                file(MAKE_DIRECTORY "${_cosimo_sync_parent}")
                file(CREATE_LINK
                    "${_cosimo_sync_link_target}"
                    "${_cosimo_sync_to}"
                    SYMBOLIC
                    RESULT _cosimo_sync_link_result)
                if(NOT _cosimo_sync_link_result STREQUAL "0")
                    message(FATAL_ERROR
                        "Could not copy generated symlink ${_cosimo_sync_relative}: "
                        "${_cosimo_sync_link_result}")
                endif()
            endif()
        elseif(IS_DIRECTORY "${_cosimo_sync_from}")
            if((EXISTS "${_cosimo_sync_to}" OR IS_SYMLINK "${_cosimo_sync_to}")
                    AND (NOT IS_DIRECTORY "${_cosimo_sync_to}" OR IS_SYMLINK "${_cosimo_sync_to}"))
                file(REMOVE_RECURSE "${_cosimo_sync_to}")
            endif()
            file(MAKE_DIRECTORY "${_cosimo_sync_to}")
        elseif(EXISTS "${_cosimo_sync_from}")
            if(_cosimo_sync_relative STREQUAL "CMakeLists.txt"
                    OR _cosimo_sync_relative MATCHES "\\.(cmake|c|cc|cpp|cxx|h|hpp|m|mm|json|plist|txt)$")
                file(READ "${_cosimo_sync_from}" _cosimo_sync_text)
                string(FIND "${_cosimo_sync_text}" "${_cosimo_sync_source}" _cosimo_sync_stage_path_index)
                if(NOT _cosimo_sync_stage_path_index EQUAL -1)
                    message(FATAL_ERROR
                        "Generated file ${_cosimo_sync_relative} contains its staging directory path; "
                        "refusing to publish location-dependent output")
                endif()
            endif()

            if(IS_DIRECTORY "${_cosimo_sync_to}" OR IS_SYMLINK "${_cosimo_sync_to}")
                file(REMOVE_RECURSE "${_cosimo_sync_to}")
            endif()
            get_filename_component(_cosimo_sync_parent "${_cosimo_sync_to}" DIRECTORY)
            file(MAKE_DIRECTORY "${_cosimo_sync_parent}")
            execute_process(
                COMMAND "${CMAKE_COMMAND}" -E copy_if_different
                    "${_cosimo_sync_from}"
                    "${_cosimo_sync_to}"
                RESULT_VARIABLE _cosimo_sync_copy_result
                ERROR_VARIABLE _cosimo_sync_copy_error)
            if(NOT _cosimo_sync_copy_result EQUAL 0)
                message(FATAL_ERROR
                    "Could not synchronize generated file ${_cosimo_sync_relative}: "
                    "${_cosimo_sync_copy_error}")
            endif()
        else()
            message(FATAL_ERROR "Unsupported generated project entry: ${_cosimo_sync_relative}")
        endif()
    endforeach()

    file(GLOB_RECURSE _cosimo_sync_destination_entries
        LIST_DIRECTORIES true
        RELATIVE "${_cosimo_sync_destination}"
        "${_cosimo_sync_destination}/*")
    list(SORT _cosimo_sync_destination_entries ORDER DESCENDING)

    foreach(_cosimo_sync_relative IN LISTS _cosimo_sync_destination_entries)
        if(_cosimo_sync_relative STREQUAL "_build"
                OR _cosimo_sync_relative MATCHES "^_build/")
            continue()
        endif()

        list(FIND _cosimo_sync_source_entries "${_cosimo_sync_relative}" _cosimo_sync_source_index)
        if(_cosimo_sync_source_index EQUAL -1)
            file(REMOVE_RECURSE "${_cosimo_sync_destination}/${_cosimo_sync_relative}")
        endif()
    endforeach()
endfunction()

if(CMAKE_SCRIPT_MODE_FILE STREQUAL CMAKE_CURRENT_LIST_FILE)
    if(NOT DEFINED COSIMO_GENERATED_PROJECT_SOURCE)
        message(FATAL_ERROR "COSIMO_GENERATED_PROJECT_SOURCE is required")
    endif()
    if(NOT DEFINED COSIMO_GENERATED_PROJECT_DESTINATION)
        message(FATAL_ERROR "COSIMO_GENERATED_PROJECT_DESTINATION is required")
    endif()

    cosimo_sync_generated_project(
        "${COSIMO_GENERATED_PROJECT_SOURCE}"
        "${COSIMO_GENERATED_PROJECT_DESTINATION}")
endif()
