#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd "$test_dir/../.." && pwd -P)"
cmajor_source_path="${CMAJOR_SOURCE_PATH:-$(python3 "$repo_dir/scripts/ensure_cmajor_runtime.py" --path)}"
runtime_build_dir="${COSIMO_CMAJOR_RUNTIME_BUILD_DIR:-$repo_dir/build/cmajor-runtime-linux}"
probe_build_dir="$repo_dir/build/native_bounce_quickjs"
runtime_library="${COSIMO_CMAJOR_RUNTIME_LIBRARY:-}"
host_os="$(uname -s)"
platform_cflags=()
platform_ldflags=()

if [[ "$host_os" == "Darwin" ]]; then
    cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"
    runtime_candidates=(
        "$runtime_library"
        "$repo_dir/build/desktop_native/CosimoDesktopNative_artefacts/Release/Standalone/CosimoDesktopNative.app/Contents/Resources/libCmajPerformer.dylib"
        "${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}/libCmajPerformer-$cmajor_version.dylib"
    )
    runtime_library=""
    for candidate in "${runtime_candidates[@]}"; do
        if [[ -n "$candidate" && -f "$candidate" ]]; then
            runtime_library="$candidate"
            break
        fi
    done
    platform_ldflags=(
        -framework Accelerate
        -framework CoreAudio
        -framework CoreMIDI
        -framework AudioToolbox
        -framework Foundation
        -framework IOKit
        -framework Cocoa
        -ldl
    )
else
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
    read -r -a gtk_cflags <<<"$(pkg-config --cflags gtk+-3.0)"
    read -r -a gtk_libs <<<"$(pkg-config --libs gtk+-3.0)"
    platform_cflags=("${gtk_cflags[@]}")
    platform_ldflags=("${gtk_libs[@]}" -ldl)
fi

if [[ -z "$runtime_library" || ! -f "$runtime_library" ]]; then
    printf 'Cmajor runtime library was not found for %s. Build the native synth or set COSIMO_CMAJOR_RUNTIME_LIBRARY.\n' "$host_os" >&2
    exit 1
fi

mkdir -p "$probe_build_dir"
probe_binary="$probe_build_dir/BounceOfflineDriverProbe"

"${CXX:-c++}" \
    -std=c++17 -O1 -g0 -pthread -DCMAJOR_DLL=1 \
    "${platform_cflags[@]}" \
    -I "$cmajor_source_path/include" \
    -I "$cmajor_source_path/include/choc" \
    -I "$repo_dir/native/three_oscillator_renderer/third_party/xsimd/include" \
    "$repo_dir/native/bounce/BounceNativeDriver.cpp" \
    "$repo_dir/native/bounce/CmajorBounceOfflinePerformer.cpp" \
    "$repo_dir/native/three_oscillator_renderer/RendererBridge.cpp" \
    "$repo_dir/native/three_oscillator_renderer/WarpRenderer.cpp" \
    "$repo_dir/tests/native_quickjs/BounceOfflineDriverProbe.cpp" \
    -o "$probe_binary" \
    "${platform_ldflags[@]}"

"$probe_binary" "$runtime_library" "$repo_dir/WavetableSynth.cmajorpatch"
