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
# Source URLs only (GitHub in the monorepo, feed mirror in a customer export).
include("${CMAKE_CURRENT_LIST_DIR}/dependency-sources.cmake")

# The pinned Cmajor fork commit. Both packages below pin the same commit; they
# differ only in how much of the fork's submodule tree they check out.
set(COSIMO_CMAJOR_PINNED_COMMIT "7820a453f25e1b6eaf898d0bb2feb7e4ce01c207")

function(cosimo_add_juce_dependency)
    CPMAddPackage(
        NAME cosimo_juce
        GIT_REPOSITORY "${COSIMO_JUCE_GIT_URL}"
        GIT_TAG "501c07674e1ad693085a7e7c398f205c2677f5da"
        GIT_SHALLOW FALSE
        DOWNLOAD_ONLY YES
    )
    set(COSIMO_JUCE_SOURCE_DIR "${cosimo_juce_SOURCE_DIR}" PARENT_SCOPE)
endfunction()

# Plugin builds: the Cmajor headers plus the CHOC submodule, nothing else. The
# fork's other submodules (LLVM, boost, clap) are only needed to build the
# Cmajor tools themselves and come from upstream SSH URLs, so a plugin build
# must never ask for them: a customer machine has the prebuilt tools from
# `npm run kit:setup` and no GitHub SSH access.
function(cosimo_add_production_dependencies)
    CPMAddPackage(
        NAME cosimo_cmajor
        GIT_REPOSITORY "${COSIMO_CMAJOR_GIT_URL}"
        GIT_TAG "${COSIMO_CMAJOR_PINNED_COMMIT}"
        GIT_SHALLOW FALSE
        GIT_SUBMODULES "include/choc"
        GIT_SUBMODULES_RECURSE TRUE
        DOWNLOAD_ONLY YES
    )
    cosimo_add_juce_dependency()

    set(COSIMO_CMAJOR_SOURCE_DIR "${cosimo_cmajor_SOURCE_DIR}" PARENT_SCOPE)
    set(COSIMO_CHOC_SOURCE_DIR "${cosimo_cmajor_SOURCE_DIR}/include/choc" PARENT_SCOPE)
    set(COSIMO_JUCE_SOURCE_DIR "${COSIMO_JUCE_SOURCE_DIR}" PARENT_SCOPE)
endfunction()

# Tool builds (the `cmaj` command, the Cmajor library, CmajPlugin.vst3): the
# full fork checkout with every submodule. Maintainer-side; needs GitHub SSH
# access for the upstream submodules. Same pin as the production package.
function(cosimo_add_cmajor_toolchain_dependencies)
    CPMAddPackage(
        NAME cosimo_cmajor_toolchain
        GIT_REPOSITORY "${COSIMO_CMAJOR_GIT_URL}"
        GIT_TAG "${COSIMO_CMAJOR_PINNED_COMMIT}"
        GIT_SHALLOW FALSE
        GIT_SUBMODULES_RECURSE TRUE
        DOWNLOAD_ONLY YES
    )
    cosimo_add_juce_dependency()

    set(COSIMO_CMAJOR_SOURCE_DIR "${cosimo_cmajor_toolchain_SOURCE_DIR}" PARENT_SCOPE)
    set(COSIMO_CHOC_SOURCE_DIR "${cosimo_cmajor_toolchain_SOURCE_DIR}/include/choc" PARENT_SCOPE)
    set(COSIMO_JUCE_SOURCE_DIR "${COSIMO_JUCE_SOURCE_DIR}" PARENT_SCOPE)
endfunction()

function(cosimo_add_t26_research_juce)
    CPMAddPackage(
        NAME cosimo_t26_juce
        GIT_REPOSITORY "${COSIMO_JUCE_GIT_URL}"
        GIT_TAG "b08520c2de1771af3dfcbfbc0e0b6b0b5eb083b0"
        GIT_SHALLOW FALSE
        DOWNLOAD_ONLY YES
    )

    set(COSIMO_T26_JUCE_SOURCE_DIR "${cosimo_t26_juce_SOURCE_DIR}" PARENT_SCOPE)
endfunction()
