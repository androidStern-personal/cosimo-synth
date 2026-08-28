#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"
cmajor_source_path="$(python3 "$repo_root/scripts/resolve_build_dependencies.py" --path cmajor)"
native_build_dir="$repo_root/build/native_quickjs"
pending_jobs_source="$repo_root/tests/native_quickjs/QuickJSPendingJobs.cpp"
pending_jobs_binary="$native_build_dir/QuickJSPendingJobs"
stored_state_source="$repo_root/tests/native_quickjs/StoredStateStringComparison.cpp"
stored_state_binary="$native_build_dir/StoredStateStringComparison"
worker_error_source="$repo_root/tests/native_quickjs/WorkerErrorSurvivalProbe.cpp"
worker_error_binary="$native_build_dir/WorkerErrorSurvivalProbe"
worker_error_patch="$repo_root/tests/native_quickjs/fixtures/worker_error/WorkerErrorSignal.cmajorpatch"
probe_source="$repo_root/tests/native_quickjs/ModulationRestoreProbe.cpp"
probe_binary="$native_build_dir/ModulationRestoreProbe"
probe_log="$native_build_dir/ModulationRestoreProbe.log"
patch_path="$repo_root/WavetableSynth.cmajorpatch"

runtime_candidates=(
    "${COSIMO_CMAJOR_RUNTIME_LIBRARY:-}"
    "$repo_root/build/desktop_native/CosimoDesktopNative_artefacts/Release/Standalone/CosimoDesktopNative.app/Contents/Resources/libCmajPerformer.dylib"
    "${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}/libCmajPerformer-$cmajor_version.dylib"
)

runtime_dylib=""
for candidate in "${runtime_candidates[@]}"; do
    if [[ -n "$candidate" && -f "$candidate" ]]; then
        runtime_dylib="$candidate"
        break
    fi
done

if [[ -z "$runtime_dylib" ]]; then
    printf 'Cmajor runtime library not found. Build the native synth first or set COSIMO_CMAJOR_RUNTIME_LIBRARY.\n' >&2
    exit 1
fi

mkdir -p "$native_build_dir"

compile_native_test() {
    local source_path="$1"
    local binary_path="$2"
    shift 2

    clang++ \
        -std=c++17 \
        -O2 \
        -DCMAJOR_DLL=1 \
        -I "$cmajor_source_path/include" \
        -I "$cmajor_source_path/include/choc" \
        "$source_path" \
        "$@" \
        -o "$binary_path" \
        -framework Accelerate \
        -framework CoreAudio \
        -framework CoreMIDI \
        -framework AudioToolbox \
        -framework Foundation \
        -framework IOKit \
        -framework Cocoa \
        -ldl
}

compile_native_test "$stored_state_source" "$stored_state_binary"
compile_native_test "$pending_jobs_source" "$pending_jobs_binary"
compile_native_test "$worker_error_source" "$worker_error_binary"
compile_native_test \
    "$probe_source" \
    "$probe_binary" \
    -I "$repo_root/native/three_oscillator_renderer/third_party/xsimd/include" \
    "$repo_root/native/three_oscillator_renderer/RendererBridge.cpp" \
    "$repo_root/native/three_oscillator_renderer/WarpRenderer.cpp"

"$stored_state_binary"
"$pending_jobs_binary"
"$worker_error_binary" "$runtime_dylib" "$worker_error_patch"

if ! "$probe_binary" "$runtime_dylib" "$patch_path" >"$probe_log" 2>&1; then
    cat "$probe_log"
    exit 1
fi

awk '/^PASS:/ { printing = 1 } printing' "$probe_log"
