#!/usr/bin/env bash
set -euo pipefail
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cmajor_dir="${1:?Usage: run_patch_shared_data_native_probe.sh CMAJOR_SOURCE_DIR CMAJOR_RUNTIME_LIBRARY}"
runtime_library="${2:?Pass the Cmajor runtime library path}"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/patch-shared-data-jit.XXXXXX")"
trap 'rm -rf "$build_dir"' EXIT INT TERM
platform_flags=()
if [[ "$(uname)" == Darwin ]]; then platform_flags=(-framework CoreFoundation -lobjc); fi
"${CXX:-c++}" -std=c++17 -O1 -g -pthread -fsanitize=address,undefined -fno-omit-frame-pointer \
    -I "$cmajor_dir/include" "$test_dir/PatchSharedDataNativeProbe.cpp" \
    "${platform_flags[@]}" -o "$build_dir/native-probe"
"$build_dir/native-probe" "$runtime_library"
