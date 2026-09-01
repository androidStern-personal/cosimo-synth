cmake_minimum_required(VERSION 3.16)

project(CosimoCmajorRuntimeBuild LANGUAGES C CXX)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/kit/cmake/CosimoDependencies.cmake")
cosimo_add_cmajor_toolchain_dependencies()

set(BUILD_CMAJ OFF)
set(BUILD_CMAJ_LIB ON)
set(BUILD_PLUGIN OFF)
set(BUILD_EXAMPLES OFF)
set(CMAJ_VERSION "1.0.3066")
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
add_subdirectory("${COSIMO_CMAJOR_SOURCE_DIR}" cmajor)
