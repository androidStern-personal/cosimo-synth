#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
output_path="${1:?output Wasm path is required}"
shift

memory_base=""
while (( $# > 0 )); do
  case "$1" in
    --memory-base)
      memory_base="${2:?--memory-base requires a byte address}"
      shift 2
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

if [[ ! "$memory_base" =~ ^[0-9]+$ ]] || (( memory_base <= 0 || memory_base % 65536 != 0 )); then
  printf '%s\n' '--memory-base must be a positive 64-KiB-aligned byte address' >&2
  exit 1
fi

llvm_root="${COSIMO_RENDERER_LLVM_DIR:-/opt/homebrew/opt/llvm}"
wasi_c_root="${COSIMO_RENDERER_WASI_C_DIR:-/opt/homebrew/opt/wasi-libc/share/wasi-sysroot}"
wasi_cxx_root="${COSIMO_RENDERER_WASI_CXX_DIR:-/opt/homebrew/opt/wasi-runtimes/share/wasi-sysroot}"
renderer_dir="$repo_root/native/three_oscillator_renderer"

mkdir -p "$(dirname "$output_path")"
"$llvm_root/bin/clang++" \
  --target=wasm32-unknown-wasip1 \
  --sysroot="$wasi_c_root" \
  -mexec-model=reactor \
  -std=c++17 -O3 -ffast-math -flto -msimd128 \
  -fignore-exceptions -fno-rtti -nostdlib++ \
  -isystem "$wasi_cxx_root/include/wasm32-wasip1/c++/v1" \
  -I "$renderer_dir" \
  -I "$renderer_dir/third_party/xsimd/include" \
  "$renderer_dir/RendererWasmExports.cpp" \
  "$renderer_dir/RendererBridge.cpp" \
  "$renderer_dir/WarpRenderer.cpp" \
  -Wl,--import-memory \
  -Wl,--no-stack-first \
  -Wl,--export=CosimoThreeOscillatorRenderer__renderAll \
  -Wl,--export=__stack_pointer \
  -Wl,--strip-all -Wl,--gc-sections \
  -Wl,--global-base="$memory_base" \
  -Wl,-z,stack-size=1048576 \
  -o "$output_path"
