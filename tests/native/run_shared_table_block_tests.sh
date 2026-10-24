#!/usr/bin/env bash
set -euo pipefail
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
renderer_dir="$test_dir/../../native/three_oscillator_renderer"
cmajor_dir="${1:?Usage: run_shared_table_block_tests.sh CMAJOR_SOURCE_DIR [none|address]}"
sanitizer="${2:-address}"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/shared-table-block.XXXXXX")"
trap 'rm -rf "$build_dir"' EXIT INT TERM
flags=(-std=c++17 -O2 -g -Wall -Wextra -Werror -Wno-unused-function -Wno-unused-local-typedef -pthread)
case "$sanitizer" in
    none) ;;
    address) flags+=(-fsanitize=address,undefined -fno-omit-frame-pointer) ;;
    *) echo "Unknown sanitizer: $sanitizer" >&2; exit 2 ;;
esac
"${CXX:-c++}" "${flags[@]}" -I "$cmajor_dir/include" -I "$renderer_dir" \
    -I "$renderer_dir/third_party/xsimd/include" \
    "$test_dir/SharedTableBlockTests.cpp" "$renderer_dir/RendererBridge.cpp" \
    "$renderer_dir/WarpRenderer.cpp" -o "$build_dir/shared-table-block-tests"
"$build_dir/shared-table-block-tests"
