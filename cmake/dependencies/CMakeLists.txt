cmake_minimum_required(VERSION 3.22)

project(CosimoBuildDependencies LANGUAGES NONE)

include("${CMAKE_CURRENT_LIST_DIR}/../dependencies.lock.cmake")

if(NOT CPM_SOURCE_CACHE)
    message(FATAL_ERROR "CPM_SOURCE_CACHE must name the shared Cosimo dependency cache")
endif()

if(NOT COSIMO_DEPENDENCY_RESULT_FILE)
    message(FATAL_ERROR "COSIMO_DEPENDENCY_RESULT_FILE must name the resolver result file")
endif()

file(SHA256 "${CMAKE_CURRENT_LIST_DIR}/../CPM.cmake" actual_cpm_sha256)
if(NOT actual_cpm_sha256 STREQUAL COSIMO_CPM_SHA256)
    message(FATAL_ERROR
        "Vendored CPM.cmake integrity failure: expected ${COSIMO_CPM_SHA256}, got ${actual_cpm_sha256}")
endif()

# The resolver owns dependency identity. CPM's optional local-package and
# per-package source overrides are intentionally disabled at this boundary.
set(CPM_USE_LOCAL_PACKAGES OFF CACHE BOOL "" FORCE)
set(CPM_LOCAL_PACKAGES_ONLY OFF CACHE BOOL "" FORCE)
set(CPM_DOWNLOAD_ALL ON CACHE BOOL "" FORCE)
set(CPM_DONT_CREATE_PACKAGE_LOCK ON CACHE BOOL "" FORCE)
set(CPM_USE_NAMED_CACHE_DIRECTORIES OFF CACHE BOOL "" FORCE)
unset(CPM_cosimo_cmajor_SOURCE CACHE)
unset(CPM_cosimo_juce_SOURCE CACHE)
unset(FETCHCONTENT_SOURCE_DIR_COSIMO_CMAJOR CACHE)
unset(FETCHCONTENT_SOURCE_DIR_COSIMO_JUCE CACHE)

if(COSIMO_DEPENDENCY_OFFLINE)
    set(FETCHCONTENT_FULLY_DISCONNECTED ON CACHE BOOL "" FORCE)
endif()

include("${CMAKE_CURRENT_LIST_DIR}/../CPM.cmake")

if(NOT CPM_VERSION STREQUAL COSIMO_CPM_VERSION)
    message(FATAL_ERROR "Vendored CPM runtime version does not match the dependency lock")
endif()

CPMAddPackage(
    NAME cosimo_cmajor
    GIT_REPOSITORY "${COSIMO_CMAJOR_REPOSITORY}"
    GIT_TAG "${COSIMO_CMAJOR_COMMIT}"
    GIT_SHALLOW FALSE
    GIT_SUBMODULES_RECURSE TRUE
    CUSTOM_CACHE_KEY "cmajor-${COSIMO_CMAJOR_COMMIT}"
    DOWNLOAD_ONLY YES
    FORCE YES
)

CPMAddPackage(
    NAME cosimo_juce
    GIT_REPOSITORY "${COSIMO_JUCE_REPOSITORY}"
    GIT_TAG "${COSIMO_JUCE_COMMIT}"
    GIT_SHALLOW FALSE
    GIT_SUBMODULES ""
    CUSTOM_CACHE_KEY "juce-${COSIMO_JUCE_COMMIT}"
    DOWNLOAD_ONLY YES
    FORCE YES
)

file(WRITE "${COSIMO_DEPENDENCY_RESULT_FILE}"
    "schema_version=1\n"
    "cpm_version=${COSIMO_CPM_VERSION}\n"
    "cpm_runtime_version=${CPM_VERSION}\n"
    "cpm_commit=${COSIMO_CPM_COMMIT}\n"
    "cpm_sha256=${COSIMO_CPM_SHA256}\n"
    "cmajor_repository=${COSIMO_CMAJOR_REPOSITORY}\n"
    "cmajor_commit=${COSIMO_CMAJOR_COMMIT}\n"
    "cmajor_source=${cosimo_cmajor_SOURCE_DIR}\n"
    "choc_repository=${COSIMO_CHOC_REPOSITORY}\n"
    "choc_commit=${COSIMO_CHOC_COMMIT}\n"
    "choc_source=${cosimo_cmajor_SOURCE_DIR}/include/choc\n"
    "juce_repository=${COSIMO_JUCE_REPOSITORY}\n"
    "juce_commit=${COSIMO_JUCE_COMMIT}\n"
    "juce_source=${cosimo_juce_SOURCE_DIR}\n"
)
