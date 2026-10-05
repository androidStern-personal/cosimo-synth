#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd "$test_dir/../.." && pwd -P)"
runtime_build_dir="${COSIMO_CMAJOR_RUNTIME_BUILD_DIR:-$repo_dir/build/cmajor-runtime-linux}"
probe_build_dir="$repo_dir/build/native_bounce_quickjs"
runtime_library="${COSIMO_CMAJOR_RUNTIME_LIBRARY:-}"
host_os="$(uname -s)"

if [[ -z "$runtime_library" || ! -f "$runtime_library" ]]; then
    if [[ "$host_os" == "Darwin" ]]; then
        cmake -S "$repo_dir/tools/cmajor_runtime_build" -B "$runtime_build_dir" \
            -DCMAKE_BUILD_TYPE=Release
        runtime_library="$runtime_build_dir/lib/libCmajPerformer.dylib"
    else
        cmake -S "$repo_dir/tools/cmajor_runtime_build" -B "$runtime_build_dir" -G Ninja \
            -DCMAKE_BUILD_TYPE=Release
        runtime_library="$runtime_build_dir/lib/libCmajPerformer.so"
    fi
    cmake --build "$runtime_build_dir" --target CmajPerformer \
        -j "${COSIMO_CMAJOR_BUILD_JOBS:-1}"
fi

if [[ -z "$runtime_library" || ! -f "$runtime_library" ]]; then
    printf 'Cmajor runtime library was not found for %s. Build the native synth or set COSIMO_CMAJOR_RUNTIME_LIBRARY.\n' "$host_os" >&2
    exit 1
fi

cmake -S "$repo_dir/tests/native" -B "$probe_build_dir" -DCMAKE_BUILD_TYPE=Release
cmake --build "$probe_build_dir" --target BounceOfflineDriverProbe --parallel 4
probe_binary="$probe_build_dir/BounceOfflineDriverProbe"

"$probe_binary" "$runtime_library" "$repo_dir/WavetableSynth.cmajorpatch"
