#!/usr/bin/env bash
set -euo pipefail
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cmajor_dir="${1:?Usage: run_patch_shared_data_protocol_tests.sh CMAJOR_SOURCE_DIR}"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/patch-shared-data.XXXXXX")"
trap 'rm -rf "$build_dir"' EXIT INT TERM
"${CXX:-c++}" -std=c++17 -O1 -g -Wall -Wextra -Werror -pthread \
    -fsanitize=address,undefined -fno-omit-frame-pointer -I "$cmajor_dir/include" \
    "$test_dir/PatchSharedDataProtocolTests.cpp" -o "$build_dir/protocol-tests"
"$build_dir/protocol-tests"
