cmake_minimum_required(VERSION 3.22)

project(CosimoCmajorExternalCodegen LANGUAGES C CXX)

get_filename_component(COSIMO_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
include("${COSIMO_REPO_ROOT}/kit/cmake/CosimoDependencies.cmake")
cosimo_add_production_dependencies()

set(CMAJ_VERSION "1.0.3066")
set(CMAJ_TARGET_COMPILER cxx_std_17)

add_subdirectory("${COSIMO_CMAJOR_SOURCE_DIR}/modules" cmajor_modules)

MAKE_CMAJ_LIBRARY(
    LIBRARY_NAME cosimo_cmaj_codegen_lib
    ENABLE_PERFORMER_CPP
    ENABLE_CODEGEN_CPP
    ENABLE_CODEGEN_LLVM_WASM
)

add_executable(cosimo_cmajor_external_codegen main.cpp)
target_compile_features(cosimo_cmajor_external_codegen PRIVATE cxx_std_17)
target_link_libraries(cosimo_cmajor_external_codegen PRIVATE cosimo_cmaj_codegen_lib)
