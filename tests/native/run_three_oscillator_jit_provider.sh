#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
runtime_root="${CMAJOR_SOURCE_PATH:-$(python3 "$repo_root/scripts/ensure_cmajor_runtime.py" --path)}"
runtime_dylib="${COSIMO_CMAJOR_RUNTIME_LIBRARY:-}"

if [[ -z "$runtime_dylib" ]]; then
  runtime_dylib="$(find "$repo_root/build" -name libCmajPerformer.dylib -print -quit 2>/dev/null || true)"
fi

if [[ -z "$runtime_dylib" || ! -f "$runtime_dylib" ]]; then
  printf 'Cmajor runtime library not found; set COSIMO_CMAJOR_RUNTIME_LIBRARY.\n' >&2
  exit 1
fi

build_dir="${COSIMO_JIT_PROVIDER_BUILD_DIR:-$repo_root/build/native_jit_provider}"
mkdir -p "$build_dir"

clang++ -std=c++17 -O2 -DCMAJOR_DLL=1 \
  -I "$runtime_root/include" \
  -I "$runtime_root/include/choc" \
  -I "$repo_root/native/three_oscillator_renderer" \
  -I "$repo_root/native/three_oscillator_renderer/third_party/xsimd/include" \
  "$repo_root/tests/native/ThreeOscillatorJITProviderIntegration.cpp" \
  "$repo_root/native/three_oscillator_renderer/RendererBridge.cpp" \
  "$repo_root/native/three_oscillator_renderer/WarpRenderer.cpp" \
  -o "$build_dir/ThreeOscillatorJITProviderIntegration" \
  -framework Accelerate -framework CoreAudio -framework CoreMIDI \
  -framework AudioToolbox -framework Foundation -framework IOKit -framework Cocoa -ldl

"$build_dir/ThreeOscillatorJITProviderIntegration" \
  "$runtime_dylib" \
  "$repo_root/tests/native/fixtures/ThreeOscillatorExternalSmoke.cmajorpatch"
