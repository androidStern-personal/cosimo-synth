cmake_minimum_required(VERSION 3.16)

project(BuilderKitCmajorWebRuntime LANGUAGES NONE)

get_filename_component(BUILDER_KIT_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
include("${BUILDER_KIT_REPO_ROOT}/kit/cmake/dependencies.cmake")
builder_kit_dependencies()

set(BUILDER_KIT_CMAJOR_WEB_RUNTIME_DIR "" CACHE PATH
    "Destination for the packaged Cmajor web API")

if(BUILDER_KIT_CMAJOR_WEB_RUNTIME_DIR STREQUAL "")
    message(FATAL_ERROR "BUILDER_KIT_CMAJOR_WEB_RUNTIME_DIR is required")
endif()

add_custom_target(builder_kit_cmajor_web_runtime
    COMMAND "${CMAKE_COMMAND}" -E make_directory "${BUILDER_KIT_CMAJOR_WEB_RUNTIME_DIR}"
    COMMAND "${CMAKE_COMMAND}" -E copy_directory
        "${BUILDER_KIT_CMAJOR_SOURCE_DIR}/javascript/cmaj_api"
        "${BUILDER_KIT_CMAJOR_WEB_RUNTIME_DIR}"
    COMMENT "Packaging the Cmajor web API"
)
