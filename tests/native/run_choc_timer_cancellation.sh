#!/usr/bin/env bash
set -euo pipefail
# macOS: pass the authored Cmajor checkout whose CHOC dependency is under test.
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(cd "$test_dir/../.." && pwd -P)"
cmajor="${1:?Pass authored Cmajor source directory}"
output="${2:-$root/build/choc-timer-cancellation}"
mkdir -p "$output"
"${CXX:-c++}" -std=c++17 -O1 -I "$cmajor/include/choc" \
    "$test_dir/ChocTimerCancellation.cpp" -framework Cocoa -o "$output/timer-cancellation"
"$output/timer-cancellation"
