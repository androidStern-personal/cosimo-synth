#!/bin/zsh

set -euo pipefail

TEST_DIR=${0:A:h}
REPO_DIR=${TEST_DIR:h:h}
LLVM_DIR=${COSIMO_RENDERER_LLVM_DIR:-/opt/homebrew/opt/llvm}
WASI_C_DIR=${COSIMO_RENDERER_WASI_C_DIR:-/opt/homebrew/opt/wasi-libc/share/wasi-sysroot}
WASI_CXX_DIR=${COSIMO_RENDERER_WASI_CXX_DIR:-/opt/homebrew/opt/wasi-runtimes/share/wasi-sysroot}
# The macOS default /usr/bin/c++ is clang; Linux runners point this at a
# clang++ so the clang-spelled warning suppressions hold under -Werror.
HOST_CXX=${COSIMO_RENDERER_HOST_CXX:-/usr/bin/c++}

# Homebrew's WASI packages use the post-preview rename (wasm32-wasip1) while
# Debian/Ubuntu multiarch installs the identical preview-1 ABI under
# wasm32-wasi - the same resolution build_three_oscillator_renderer_wasm.sh
# performs.
WASI_TARGET="wasm32-unknown-wasip1"
WASI_CXX_INCLUDE="$WASI_CXX_DIR/include/wasm32-wasip1/c++/v1"
if [[ ! -d "$WASI_CXX_INCLUDE" && -d "$WASI_CXX_DIR/include/wasm32-wasi/c++/v1" ]]; then
    WASI_TARGET="wasm32-wasi"
    WASI_CXX_INCLUDE="$WASI_CXX_DIR/include/wasm32-wasi/c++/v1"
fi
RENDERER_DIR="$REPO_DIR/native/three_oscillator_renderer"
BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/cosimo-renderer-oracle.XXXXXX")

cleanup() {
    rm -rf "$BUILD_DIR"
}
trap cleanup EXIT INT TERM

COMMON_SOURCES=(
    "$TEST_DIR/ThreeOscillatorRendererOracle.cpp"
    "$RENDERER_DIR/WarpRenderer.cpp"
    "$RENDERER_DIR/RendererBridge.cpp"
)
COMMON_FLAGS=(
    -std=c++17 -O3 -ffast-math -Wall -Wextra -Werror
    -Wno-unused-local-typedef -Wno-unused-function
    -I"$RENDERER_DIR"
    -I"$RENDERER_DIR/third_party/xsimd/include"
)

"$HOST_CXX" "${COMMON_FLAGS[@]}" "${COMMON_SOURCES[@]}" \
    -o "$BUILD_DIR/renderer-oracle-native"
NATIVE_FINGERPRINT=$("$BUILD_DIR/renderer-oracle-native")

"$LLVM_DIR/bin/clang++" \
    --target="$WASI_TARGET" \
    --sysroot="$WASI_C_DIR" \
    -mexec-model=reactor -flto -msimd128 -fignore-exceptions -fno-rtti \
    -nostdlib++ \
    -isystem "$WASI_CXX_INCLUDE" \
    "${COMMON_FLAGS[@]}" "${COMMON_SOURCES[@]}" \
    -Wl,--export=three_osc_renderer_oracle -Wl,--export=three_osc_dynamic_detune_oracle \
    -Wl,--export-memory \
    -Wl,--strip-all -Wl,--gc-sections -Wl,-z,stack-size=524288 \
    -o "$BUILD_DIR/renderer-oracle.wasm"

if "$LLVM_DIR/bin/llvm-readobj" --sections "$BUILD_DIR/renderer-oracle.wasm" \
    | rg -q 'Type: IMPORT'; then
    print -u2 'FAIL: renderer oracle Wasm unexpectedly imports host functions'
    exit 1
fi
WASM_DISASSEMBLY=$("$LLVM_DIR/bin/llvm-objdump" -d "$BUILD_DIR/renderer-oracle.wasm")
rg -q 'v128\.load32' <<< "$WASM_DISASSEMBLY"
rg -q 'f32x4\.add' <<< "$WASM_DISASSEMBLY"
rg -q 'f32x4\.mul' <<< "$WASM_DISASSEMBLY"

WASM_FINGERPRINT=$(node "$TEST_DIR/run_three_oscillator_renderer_wasm_oracle.mjs" \
    "$BUILD_DIR/renderer-oracle.wasm")
FINGERPRINT_DELTA=$((NATIVE_FINGERPRINT - WASM_FINGERPRINT))
if (( FINGERPRINT_DELTA < 0 )); then
    FINGERPRINT_DELTA=$((-FINGERPRINT_DELTA))
fi
if (( FINGERPRINT_DELTA > 2 )); then
    print -u2 "FAIL: native/Wasm fingerprints differ: $NATIVE_FINGERPRINT vs $WASM_FINGERPRINT"
    exit 1
fi

rg -Fq 'renderWarpedNotes (state, controls, tables, {}, nullptr,' \
    "$RENDERER_DIR/RendererBridge.cpp"
rg -Fq 'external int32 renderAll (float32[] packedFloats,' \
    "$REPO_DIR/cmajor/ThreeOscillatorRendererExternal.cmajor"
rg -Fq 'int32[] slot3Chunk3);' \
    "$REPO_DIR/cmajor/ThreeOscillatorRendererExternal.cmajor"
if find "$RENDERER_DIR" -type f \
    \( -name '*.i16' -o -name '*.bin' -o -name '*.json' \) | rg -q .; then
    print -u2 'FAIL: runtime renderer unexpectedly contains an atlas asset'
    exit 1
fi

print "PASS renderer oracle: native=$NATIVE_FINGERPRINT wasm=$WASM_FINGERPRINT"
print 'PASS packed bridge contract and runtime-only empty-atlas default'
