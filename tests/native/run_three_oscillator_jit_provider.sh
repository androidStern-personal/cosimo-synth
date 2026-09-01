#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
runtime_dylib="${COSIMO_CMAJOR_RUNTIME_LIBRARY:-}"
runtime_build_dir="$repo_root/build/cmajor_runtime"

if [[ -z "$runtime_dylib" || ! -f "$runtime_dylib" ]]; then
  cmake -S "$repo_root/kit/tools/cmajor_runtime_build" -B "$runtime_build_dir" \
      -DCMAKE_BUILD_TYPE=Release
  cmake --build "$runtime_build_dir" --target CmajPerformer --parallel 4
  runtime_dylib="$runtime_build_dir/lib/libCmajPerformer.dylib"
fi

build_dir="${COSIMO_JIT_PROVIDER_BUILD_DIR:-$repo_root/build/native_jit_provider}"
cmake -S "$repo_root/tests/native" -B "$build_dir" -DCMAKE_BUILD_TYPE=Release
cmake --build "$build_dir" --target ThreeOscillatorJITProviderIntegration --parallel 4

"$build_dir/ThreeOscillatorJITProviderIntegration" \
  "$runtime_dylib" \
  "$repo_root/tests/native/fixtures/ThreeOscillatorExternalSmoke.cmajorpatch"
