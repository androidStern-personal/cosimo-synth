cmake_minimum_required(VERSION 3.16)

project(CosimoCmajorWebRuntime LANGUAGES NONE)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/kit/cmake/CosimoDependencies.cmake")
cosimo_add_production_dependencies()

set(COSIMO_CMAJOR_WEB_RUNTIME_DIR "" CACHE PATH
    "Destination for the packaged Cmajor web API")

if(COSIMO_CMAJOR_WEB_RUNTIME_DIR STREQUAL "")
    message(FATAL_ERROR "COSIMO_CMAJOR_WEB_RUNTIME_DIR is required")
endif()

add_custom_target(cosimo_cmajor_web_runtime
    COMMAND "${CMAKE_COMMAND}" -E make_directory "${COSIMO_CMAJOR_WEB_RUNTIME_DIR}"
    COMMAND "${CMAKE_COMMAND}" -E copy_directory
        "${COSIMO_CMAJOR_SOURCE_DIR}/javascript/cmaj_api"
        "${COSIMO_CMAJOR_WEB_RUNTIME_DIR}"
    COMMENT "Packaging the Cmajor web API"
)
