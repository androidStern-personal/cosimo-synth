cmake_minimum_required(VERSION 3.16)

# Set the supported macOS floor before CMake initializes compiler flags.
set(CMAKE_OSX_DEPLOYMENT_TARGET "15.0" CACHE STRING
    "Minimum macOS version for the pinned Cmajor command")

project(CosimoPinnedCmajorCommand LANGUAGES C CXX)

if(APPLE AND (CMAKE_OSX_DEPLOYMENT_TARGET STREQUAL ""
        OR CMAKE_OSX_DEPLOYMENT_TARGET VERSION_GREATER "15.0"))
    message(FATAL_ERROR
        "The pinned Cmajor command must support macOS 15. "
        "Set -DCMAKE_OSX_DEPLOYMENT_TARGET=15.0 and use a fresh build directory.")
endif()

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/kit/cmake/CosimoDependencies.cmake")
cosimo_add_cmajor_toolchain_dependencies()

set(BUILD_CMAJ ON CACHE BOOL "Build the pinned Cmajor command" FORCE)
set(BUILD_CMAJ_LIB OFF CACHE BOOL "Do not build the Cmajor shared library" FORCE)
set(BUILD_PLUGIN OFF CACHE BOOL "Do not build the generic Cmajor plugin" FORCE)
set(BUILD_EXAMPLES OFF CACHE BOOL "Do not build Cmajor examples" FORCE)
set(WARNINGS_AS_ERRORS ON CACHE BOOL "Keep the production generator build strict" FORCE)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
foreach(configuration DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
    set("CMAKE_RUNTIME_OUTPUT_DIRECTORY_${configuration}" "${CMAKE_BINARY_DIR}/bin")
endforeach()

add_subdirectory("${COSIMO_CMAJOR_SOURCE_DIR}" cmajor)
