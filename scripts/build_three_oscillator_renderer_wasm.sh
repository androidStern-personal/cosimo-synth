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

# Homebrew's WASI packages use the post-preview rename (wasm32-wasip1),
# while Debian/Ubuntu multiarch packages still install the identical preview-1
# ABI under wasm32-wasi. Resolve both layouts without asking callers to create
# a synthetic sysroot.
wasi_target="wasm32-unknown-wasip1"
wasi_c_include="$wasi_c_root/include/wasm32-wasip1"
wasi_cxx_include="$wasi_cxx_root/include/wasm32-wasip1/c++/v1"
wasi_library_dir=""

if [[ ! -d "$wasi_c_include" && -d "$wasi_c_root/include/wasm32-wasi" ]]; then
  wasi_target="wasm32-wasi"
  wasi_c_include="$wasi_c_root/include/wasm32-wasi"
fi

if [[ ! -d "$wasi_cxx_include" && -d "$wasi_cxx_root/include/wasm32-wasi/c++/v1" ]]; then
  wasi_cxx_include="$wasi_cxx_root/include/wasm32-wasi/c++/v1"
fi

if [[ "$wasi_target" == "wasm32-wasi" ]]; then
  for candidate in "$wasi_c_root/lib/wasm32-wasi" "$wasi_cxx_root/lib/wasm32-wasi"; do
    if [[ -f "$candidate/crt1-reactor.o" ]]; then
      wasi_library_dir="$candidate"
      break
    fi
  done
fi

if [[ ! -d "$wasi_c_include" ]]; then
  printf 'WASI C headers not found below %s\n' "$wasi_c_root" >&2
  exit 1
fi

if [[ ! -d "$wasi_cxx_include" ]]; then
  printf 'WASI C++ headers not found below %s\n' "$wasi_cxx_root" >&2
  exit 1
fi

compiler_args=(
  --target="$wasi_target"
  --sysroot="$wasi_c_root"
)
wasi_c_header_args=()
linker_args=()

if [[ -n "$wasi_library_dir" ]]; then
  compiler_args+=(
    -B"$wasi_library_dir"
    -L"$wasi_library_dir"
  )
  wasi_c_header_args=(-isystem "$wasi_c_include")
fi

# LLVM 18 defaults to placing the stack after data and only exposes the
# positive --stack-first switch. Newer Homebrew linkers also accept the
# explicit negative spelling used by the original macOS build.
if "$llvm_root/bin/wasm-ld" --help 2>&1 | grep -q -- '--no-stack-first'; then
  linker_args+=(-Wl,--no-stack-first)
fi

mkdir -p "$(dirname "$output_path")"
"$llvm_root/bin/clang++" \
  "${compiler_args[@]}" \
  -mexec-model=reactor \
  -std=c++17 -O3 -ffast-math -flto -msimd128 \
  -fignore-exceptions -fno-rtti -nostdlib++ \
  -isystem "$wasi_cxx_include" \
  "${wasi_c_header_args[@]}" \
  -I "$renderer_dir" \
  -I "$renderer_dir/third_party/xsimd/include" \
  "$renderer_dir/RendererWasmExports.cpp" \
  "$renderer_dir/RendererBridge.cpp" \
  "$renderer_dir/WarpRenderer.cpp" \
  -Wl,--import-memory \
  "${linker_args[@]}" \
  -Wl,--export=CosimoThreeOscillatorRenderer__renderAll \
  -Wl,--export=__stack_pointer \
  -Wl,--strip-all -Wl,--gc-sections \
  -Wl,--global-base="$memory_base" \
  -Wl,-z,stack-size=1048576 \
  -o "$output_path"
