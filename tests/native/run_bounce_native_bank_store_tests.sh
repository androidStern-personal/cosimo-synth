#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd "$test_dir/../.." && pwd -P)"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/cosimo-bounce-store.XXXXXX")"

cleanup() {
    rm -rf "$build_dir"
}
trap cleanup EXIT INT TERM

"${CXX:-c++}" \
    -std=c++17 -O2 -g0 -Wall -Wextra -Werror -pthread \
    "$repo_dir/native/bounce/Sha256.cpp" \
    "$repo_dir/native/bounce/BounceNativePlatform.cpp" \
    "$repo_dir/native/bounce/BounceNativeBankStore.cpp" \
    "$test_dir/BounceNativeBankStoreTests.cpp" \
    -o "$build_dir/bounce-native-bank-store-tests"

"$build_dir/bounce-native-bank-store-tests"
