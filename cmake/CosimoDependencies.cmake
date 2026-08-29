include_guard(GLOBAL)

if(NOT DEFINED CPM_SOURCE_CACHE OR CPM_SOURCE_CACHE STREQUAL "")
    if(DEFINED ENV{CPM_SOURCE_CACHE} AND NOT "$ENV{CPM_SOURCE_CACHE}" STREQUAL "")
        set(_cosimo_cpm_source_cache "$ENV{CPM_SOURCE_CACHE}")
    else()
        set(_cosimo_cpm_source_cache "$ENV{HOME}/.cache/CPM")
    endif()
    set(CPM_SOURCE_CACHE "${_cosimo_cpm_source_cache}" CACHE PATH
        "Shared CPM source cache")
    unset(_cosimo_cpm_source_cache)
endif()

include("${CMAKE_CURRENT_LIST_DIR}/CPM.cmake")

function(cosimo_add_production_dependencies)
    CPMAddPackage(
        NAME cosimo_cmajor
        GIT_REPOSITORY "https://github.com/androidStern-personal/cmajor.git"
        GIT_TAG "f1c9a9a8e85dcc82141326a2fc1c5160241f346c"
        GIT_SHALLOW FALSE
        GIT_SUBMODULES_RECURSE TRUE
        DOWNLOAD_ONLY YES
    )

    CPMAddPackage(
        NAME cosimo_juce
        GIT_REPOSITORY "https://github.com/juce-framework/JUCE.git"
        GIT_TAG "501c07674e1ad693085a7e7c398f205c2677f5da"
        GIT_SHALLOW FALSE
        DOWNLOAD_ONLY YES
    )

    set(COSIMO_CMAJOR_SOURCE_DIR "${cosimo_cmajor_SOURCE_DIR}" PARENT_SCOPE)
    set(COSIMO_CHOC_SOURCE_DIR "${cosimo_cmajor_SOURCE_DIR}/include/choc" PARENT_SCOPE)
    set(COSIMO_JUCE_SOURCE_DIR "${cosimo_juce_SOURCE_DIR}" PARENT_SCOPE)
endfunction()

function(cosimo_add_t26_research_juce)
    CPMAddPackage(
        NAME cosimo_t26_juce
        GIT_REPOSITORY "https://github.com/juce-framework/JUCE.git"
        GIT_TAG "b08520c2de1771af3dfcbfbc0e0b6b0b5eb083b0"
        GIT_SHALLOW FALSE
        DOWNLOAD_ONLY YES
    )

    set(COSIMO_T26_JUCE_SOURCE_DIR "${cosimo_t26_juce_SOURCE_DIR}" PARENT_SCOPE)
endfunction()
