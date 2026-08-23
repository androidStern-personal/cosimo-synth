#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd "$test_dir/../.." && pwd -P)"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/cosimo-bounce-driver.XXXXXX")"

cleanup() {
    rm -rf "$build_dir"
}
trap cleanup EXIT INT TERM

"${CXX:-c++}" \
    -std=c++17 -O2 -g0 -Wall -Wextra -Werror -pthread \
    "$repo_dir/native/bounce/BounceNativeDriver.cpp" \
    "$test_dir/BounceNativeDriverTests.cpp" \
    -o "$build_dir/bounce-native-driver-tests"

"$build_dir/bounce-native-driver-tests"
