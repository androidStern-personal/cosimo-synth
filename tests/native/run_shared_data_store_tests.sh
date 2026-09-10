#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cmajor_dir="${1:?Usage: run_shared_data_store_tests.sh CMAJOR_SOURCE_DIR [none|address|thread]}"
sanitizer="${2:-none}"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/cmajor-shared-data.XXXXXX")"
trap 'rm -rf "$build_dir"' EXIT INT TERM

flags=(-std=c++17 -O2 -g -Wall -Wextra -Werror -pthread)
case "$sanitizer" in
    none) ;;
    address) flags+=(-fsanitize=address,undefined -fno-omit-frame-pointer) ;;
    thread) flags+=(-fsanitize=thread -fno-omit-frame-pointer) ;;
    *) echo "Unknown sanitizer: $sanitizer" >&2; exit 2 ;;
esac

"${CXX:-c++}" "${flags[@]}" -I "$cmajor_dir/include" \
    "$test_dir/SharedDataStoreTests.cpp" -o "$build_dir/shared-data-tests"
"$build_dir/shared-data-tests"
