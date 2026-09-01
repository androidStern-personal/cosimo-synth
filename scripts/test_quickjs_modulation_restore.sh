#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
native_build_dir="$repo_root/build/native_quickjs"
runtime_build_dir="$repo_root/build/cmajor_runtime"
pending_jobs_binary="$native_build_dir/QuickJSPendingJobs"
stored_state_binary="$native_build_dir/StoredStateStringComparison"
worker_error_binary="$native_build_dir/WorkerErrorSurvivalProbe"
worker_error_patch="$repo_root/tests/native_quickjs/fixtures/worker_error/WorkerErrorSignal.cmajorpatch"
probe_binary="$native_build_dir/ModulationRestoreProbe"
probe_log="$native_build_dir/ModulationRestoreProbe.log"
patch_path="$repo_root/WavetableSynth.cmajorpatch"

runtime_dylib="${COSIMO_CMAJOR_RUNTIME_LIBRARY:-}"

if [[ -z "$runtime_dylib" || ! -f "$runtime_dylib" ]]; then
    cmake -S "$repo_root/kit/tools/cmajor_runtime_build" -B "$runtime_build_dir" \
        -DCMAKE_BUILD_TYPE=Release
    cmake --build "$runtime_build_dir" --target CmajPerformer --parallel 4
    runtime_dylib="$runtime_build_dir/lib/libCmajPerformer.dylib"
fi

cmake -S "$repo_root/tests/native" -B "$native_build_dir" -DCMAKE_BUILD_TYPE=Release
cmake --build "$native_build_dir" \
    --target StoredStateStringComparison QuickJSPendingJobs WorkerErrorSurvivalProbe ModulationRestoreProbe \
    --parallel 4

"$stored_state_binary"
"$pending_jobs_binary"
"$worker_error_binary" "$runtime_dylib" "$worker_error_patch"

if ! "$probe_binary" "$runtime_dylib" "$patch_path" >"$probe_log" 2>&1; then
    cat "$probe_log"
    exit 1
fi

awk '/^PASS:/ { printing = 1 } printing' "$probe_log"
