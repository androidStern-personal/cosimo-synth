#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd "$test_dir/../.." && pwd -P)"
cmajor_source_path="${CMAJOR_SOURCE_PATH:-$(python3 "$repo_dir/scripts/ensure_cmajor_runtime.py" --path)}"
runtime_build_dir="${COSIMO_CMAJOR_RUNTIME_BUILD_DIR:-$repo_dir/build/cmajor-runtime-linux}"
probe_build_dir="$repo_dir/build/native_bounce_quickjs"
runtime_library="${COSIMO_CMAJOR_RUNTIME_LIBRARY:-}"

if [[ -z "$runtime_library" || ! -f "$runtime_library" ]]; then
    cmake -S "$cmajor_source_path" -B "$runtime_build_dir" -G Ninja \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_CMAJ=OFF \
        -DBUILD_CMAJ_LIB=ON \
        -DBUILD_PLUGIN=OFF \
        -DBUILD_EXAMPLES=OFF \
        -DCMAJ_VERSION=1.0.3066
    cmake --build "$runtime_build_dir" --target CmajPerformer \
        -j "${COSIMO_CMAJOR_BUILD_JOBS:-1}"
    runtime_library="$(find "$runtime_build_dir" -type f -name 'libCmajPerformer.so' -print -quit)"
fi

if [[ -z "$runtime_library" || ! -f "$runtime_library" ]]; then
    printf 'Linux Cmajor runtime library was not produced.\n' >&2
    exit 1
fi

mkdir -p "$probe_build_dir"
probe_binary="$probe_build_dir/BounceOfflineDriverProbe"
gtk_cflags="$(pkg-config --cflags gtk+-3.0)"
gtk_libs="$(pkg-config --libs gtk+-3.0)"

# shellcheck disable=SC2086
"${CXX:-c++}" \
    -std=c++17 -O1 -g0 -pthread -DCMAJOR_DLL=1 \
    $gtk_cflags \
    -I "$cmajor_source_path/include" \
    -I "$cmajor_source_path/include/choc" \
    -I "$repo_dir/native/three_oscillator_renderer/third_party/xsimd/include" \
    "$repo_dir/native/bounce/BounceNativeDriver.cpp" \
    "$repo_dir/native/bounce/CmajorBounceOfflinePerformer.cpp" \
    "$repo_dir/native/three_oscillator_renderer/RendererBridge.cpp" \
    "$repo_dir/native/three_oscillator_renderer/WarpRenderer.cpp" \
    "$repo_dir/tests/native_quickjs/BounceOfflineDriverProbe.cpp" \
    -o "$probe_binary" \
    $gtk_libs -ldl

"$probe_binary" "$runtime_library" "$repo_dir/WavetableSynth.cmajorpatch"
