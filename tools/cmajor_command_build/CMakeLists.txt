cmake_minimum_required(VERSION 3.16)

project(CosimoPinnedCmajorCommand LANGUAGES C CXX)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/cmake/CosimoDependencies.cmake")
cosimo_add_production_dependencies()

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
