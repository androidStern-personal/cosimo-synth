include_guard(GLOBAL)

function(cosimo_resolve_build_dependencies out_cmajor out_choc out_juce)
    if(NOT DEFINED COSIMO_REPO_ROOT OR COSIMO_REPO_ROOT STREQUAL "")
        message(FATAL_ERROR "COSIMO_REPO_ROOT must be set before resolving build dependencies")
    endif()

    if(NOT Python3_EXECUTABLE)
        find_package(Python3 REQUIRED COMPONENTS Interpreter)
    endif()

    set(resolver "${COSIMO_REPO_ROOT}/scripts/resolve_build_dependencies.py")
    if(NOT EXISTS "${resolver}")
        message(FATAL_ERROR "Canonical dependency resolver not found: ${resolver}")
    endif()

    set(resolver_arguments)
    # Storage-only seam for isolated acceptance tests and CI. Dependency URLs
    # and commits remain exclusively owned by dependencies.lock.cmake.
    if(DEFINED COSIMO_DEPENDENCY_CACHE_ROOT AND NOT COSIMO_DEPENDENCY_CACHE_ROOT STREQUAL "")
        if(NOT IS_ABSOLUTE "${COSIMO_DEPENDENCY_CACHE_ROOT}")
            message(FATAL_ERROR "COSIMO_DEPENDENCY_CACHE_ROOT must be an absolute path")
        endif()
        list(APPEND resolver_arguments "--cache-root" "${COSIMO_DEPENDENCY_CACHE_ROOT}")
    endif()

    execute_process(
        COMMAND "${Python3_EXECUTABLE}" "${resolver}" ${resolver_arguments}
        WORKING_DIRECTORY "${COSIMO_REPO_ROOT}"
        RESULT_VARIABLE resolver_result
        OUTPUT_VARIABLE resolver_output
        ERROR_VARIABLE resolver_error
        OUTPUT_STRIP_TRAILING_WHITESPACE
    )

    if(NOT resolver_result EQUAL 0)
        string(STRIP "${resolver_error}" resolver_error)
        message(FATAL_ERROR "CPM dependency resolution failed: ${resolver_error}")
    endif()

    string(JSON cmajor_source GET "${resolver_output}" dependencies cmajor path)
    string(JSON cmajor_commit GET "${resolver_output}" dependencies cmajor commit)
    string(JSON choc_source GET "${resolver_output}" dependencies choc path)
    string(JSON choc_commit GET "${resolver_output}" dependencies choc commit)
    string(JSON juce_source GET "${resolver_output}" dependencies juce path)
    string(JSON juce_commit GET "${resolver_output}" dependencies juce commit)
    string(JSON cache_root GET "${resolver_output}" cacheRoot)

    file(WRITE "${CMAKE_BINARY_DIR}/cosimo-dependency-resolution.json" "${resolver_output}\n")
    message(STATUS
        "Cosimo CPM dependencies: Cmajor@${cmajor_commit}, CHOC@${choc_commit}, "
        "JUCE@${juce_commit} (${cache_root})"
    )

    set(${out_cmajor} "${cmajor_source}" PARENT_SCOPE)
    set(${out_choc} "${choc_source}" PARENT_SCOPE)
    set(${out_juce} "${juce_source}" PARENT_SCOPE)
endfunction()
