cmake_minimum_required(VERSION 3.22)

project(CosimoCmajorExternalCodegen LANGUAGES C CXX)

if (NOT DEFINED CMAJOR_SOURCE_PATH OR CMAJOR_SOURCE_PATH STREQUAL "")
    message(FATAL_ERROR "CMAJOR_SOURCE_PATH must point to the pinned Cmajor checkout")
endif()

set(CMAJ_VERSION "1.0.3066")
set(CMAJ_TARGET_COMPILER cxx_std_17)

add_subdirectory("${CMAJOR_SOURCE_PATH}/modules" cmajor_modules)

MAKE_CMAJ_LIBRARY(
    LIBRARY_NAME cosimo_cmaj_codegen_lib
    ENABLE_PERFORMER_CPP
    ENABLE_CODEGEN_CPP
    ENABLE_CODEGEN_LLVM_WASM
)

add_executable(cosimo_cmajor_external_codegen main.cpp)
target_compile_features(cosimo_cmajor_external_codegen PRIVATE cxx_std_17)
target_link_libraries(cosimo_cmajor_external_codegen PRIVATE cosimo_cmaj_codegen_lib)
