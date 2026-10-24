include_guard(GLOBAL)

if(NOT DEFINED CPM_SOURCE_CACHE OR CPM_SOURCE_CACHE STREQUAL "")
    if(DEFINED ENV{CPM_SOURCE_CACHE} AND NOT "$ENV{CPM_SOURCE_CACHE}" STREQUAL "")
        set(_builder_kit_cpm_source_cache "$ENV{CPM_SOURCE_CACHE}")
    else()
        set(_builder_kit_cpm_source_cache "$ENV{HOME}/.cache/CPM")
    endif()
    set(CPM_SOURCE_CACHE "${_builder_kit_cpm_source_cache}" CACHE PATH
        "Shared CPM source cache")
    unset(_builder_kit_cpm_source_cache)
endif()

# CPM caches its script location. A build directory can outlive a repository
# move/extraction; bootstrap our bundled copy unless CPM is already loaded in
# this configure. Cached metadata alone is not a loaded CMake command.
if(NOT COMMAND CPMAddPackage)
    unset(CPM_DIRECTORY CACHE)
    unset(CPM_DIRECTORY)
endif()
include("${CMAKE_CURRENT_LIST_DIR}/CPM.cmake")
# Source URLs only: GitHub in the kit's source repository, the feed mirror in a delivered kit.
include("${CMAKE_CURRENT_LIST_DIR}/dependency-sources.cmake")

# The pinned Cmajor fork commit. Both packages below pin the same commit; they
# differ only in how much of the fork's submodule tree they check out.
set(BUILDER_KIT_CMAJOR_PINNED_COMMIT "dca85fc1f87af241af66ca31989940f2887a7e56")
set(BUILDER_KIT_CHOC_PINNED_COMMIT "eedf2aebd3049a84cdcf280664c73c53796118ac")
set(BUILDER_KIT_JUCE_PINNED_COMMIT "501c07674e1ad693085a7e7c398f205c2677f5da")

# One explicit development source for headers, tools and browser support.
# Re-evaluate on every configure: an old package-specific cache entry must not
# silently select a different checkout when returning to a pinned build.
set(_builder_kit_cmajor_source "$ENV{BUILDER_KIT_CMAJOR_SOURCE}")
if(NOT _builder_kit_cmajor_source STREQUAL "")
    if(NOT IS_ABSOLUTE "${_builder_kit_cmajor_source}" OR
       NOT EXISTS "${_builder_kit_cmajor_source}/include/cmajor/API/cmaj_Engine.h" OR
       NOT EXISTS "${_builder_kit_cmajor_source}/javascript/cmaj_api")
        message(FATAL_ERROR "BUILDER_KIT_CMAJOR_SOURCE must name an absolute Cmajor source checkout")
    endif()
    file(REAL_PATH "${_builder_kit_cmajor_source}" _builder_kit_cmajor_source)
    message(STATUS "Cmajor development source: ${_builder_kit_cmajor_source}")
endif()
foreach(_builder_kit_package builder_kit_cmajor builder_kit_cmajor_toolchain)
    set(CPM_${_builder_kit_package}_SOURCE "${_builder_kit_cmajor_source}" CACHE PATH
        "Managed by BUILDER_KIT_CMAJOR_SOURCE; unset that environment variable for pinned builds" FORCE)
endforeach()

function(builder_kit_juce_dependency)
    CPMAddPackage(
        NAME builder_kit_juce
        GIT_REPOSITORY "${BUILDER_KIT_JUCE_GIT_URL}"
        GIT_TAG "${BUILDER_KIT_JUCE_PINNED_COMMIT}"
        GIT_SHALLOW FALSE
        DOWNLOAD_ONLY YES
    )
    set(BUILDER_KIT_JUCE_SOURCE_DIR "${builder_kit_juce_SOURCE_DIR}" PARENT_SCOPE)
endfunction()

# Plugin builds: the Cmajor headers plus the CHOC submodule, nothing else. The
# fork's other submodules (LLVM, boost, clap) are only needed to build the
# Cmajor tools themselves and come from upstream SSH URLs, so a plugin build
# must never ask for them: a customer machine has the prebuilt tools from
# `npm run kit:setup` and no GitHub SSH access.
function(builder_kit_dependencies)
    CPMAddPackage(
        NAME builder_kit_cmajor
        GIT_REPOSITORY "${BUILDER_KIT_CMAJOR_GIT_URL}"
        GIT_TAG "${BUILDER_KIT_CMAJOR_PINNED_COMMIT}"
        GIT_SHALLOW FALSE
        GIT_SUBMODULES "include/choc"
        GIT_SUBMODULES_RECURSE TRUE
        DOWNLOAD_ONLY YES
    )
    builder_kit_juce_dependency()

    set(BUILDER_KIT_CMAJOR_SOURCE_DIR "${builder_kit_cmajor_SOURCE_DIR}" PARENT_SCOPE)
    set(BUILDER_KIT_CHOC_SOURCE_DIR "${builder_kit_cmajor_SOURCE_DIR}/include/choc" PARENT_SCOPE)
    set(BUILDER_KIT_JUCE_SOURCE_DIR "${BUILDER_KIT_JUCE_SOURCE_DIR}" PARENT_SCOPE)
endfunction()

# Tool builds (the `cmaj` command, the Cmajor library, CmajPlugin.vst3): the
# full fork checkout with every submodule. Maintainer-side; needs GitHub SSH
# access for the upstream submodules. Same pin as the production package.
function(builder_kit_toolchain_dependencies)
    CPMAddPackage(
        NAME builder_kit_cmajor_toolchain
        GIT_REPOSITORY "${BUILDER_KIT_CMAJOR_GIT_URL}"
        GIT_TAG "${BUILDER_KIT_CMAJOR_PINNED_COMMIT}"
        GIT_SHALLOW FALSE
        GIT_SUBMODULES_RECURSE TRUE
        DOWNLOAD_ONLY YES
    )
    builder_kit_juce_dependency()

    # Keep source locations useful in shipped diagnostics without embedding the
    # machine's checkout/cache paths. Append options; retain all build flags.
    if(CMAKE_CXX_COMPILER_ID MATCHES "^(AppleClang|Clang|GNU)$")
        add_compile_options(
            "$<$<CONFIG:Release>:-ffile-prefix-map=${builder_kit_cmajor_toolchain_SOURCE_DIR}=cmajor>"
            "$<$<CONFIG:Release>:-ffile-prefix-map=${BUILDER_KIT_JUCE_SOURCE_DIR}=juce>"
            "$<$<CONFIG:Release>:-ffile-prefix-map=${CMAKE_SOURCE_DIR}=builder-kit-tools>"
            "$<$<CONFIG:Release>:-ffile-prefix-map=${CMAKE_BINARY_DIR}=build>"
        )
    endif()

    set(BUILDER_KIT_CMAJOR_SOURCE_DIR "${builder_kit_cmajor_toolchain_SOURCE_DIR}" PARENT_SCOPE)
    set(BUILDER_KIT_CHOC_SOURCE_DIR "${builder_kit_cmajor_toolchain_SOURCE_DIR}/include/choc" PARENT_SCOPE)
    set(BUILDER_KIT_JUCE_SOURCE_DIR "${BUILDER_KIT_JUCE_SOURCE_DIR}" PARENT_SCOPE)
endfunction()
