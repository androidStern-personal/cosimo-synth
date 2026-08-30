#!/bin/zsh

set -euo pipefail

TEST_DIR=${0:A:h}
REPO_DIR=${TEST_DIR:h:h}
# The macOS default /usr/bin/c++ is clang; Linux runners point this at a
# clang++ so the clang-spelled warning suppressions hold under -Werror.
HOST_CXX=${COSIMO_RENDERER_HOST_CXX:-/usr/bin/c++}

LLVM_DIR=${COSIMO_RENDERER_LLVM_DIR:-/opt/homebrew/opt/llvm}
WASI_C_DIR=${COSIMO_RENDERER_WASI_C_DIR:-/opt/homebrew/opt/wasi-libc/share/wasi-sysroot}
WASI_CXX_DIR=${COSIMO_RENDERER_WASI_CXX_DIR:-/opt/homebrew/opt/wasi-runtimes/share/wasi-sysroot}
RENDERER_DIR="$REPO_DIR/native/three_oscillator_renderer"
BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/cosimo-generated-renderer.XXXXXX")
MAX_FRAMES_PER_BLOCK=${COSIMO_GENERATED_MAX_FRAMES:-512}

cleanup() {
    rm -rf "$BUILD_DIR"
}
trap cleanup EXIT INT TERM

GENERATED_CPP="$BUILD_DIR/ThreeOscillatorExternalSmoke.cpp"
GENERATED_METADATA="$BUILD_DIR/endpoints.json"
PATCH_PATH="$TEST_DIR/fixtures/ThreeOscillatorExternalSmoke.cmajorpatch"
INTEGRATION_SOURCE="$TEST_DIR/ThreeOscillatorGeneratedIntegration.cpp"

"$REPO_DIR/scripts/generate_cmajor_cpp_with_externals.sh" \
    "$PATCH_PATH" "$GENERATED_CPP" ThreeOscillatorExternalSmoke \
    --metadata "$GENERATED_METADATA" \
    --max-frames-per-block "$MAX_FRAMES_PER_BLOCK"

rg -Fq 'CosimoThreeOscillatorRenderer__renderAll' "$GENERATED_CPP"
rg -Fq '"endpointID": "audioOut"' "$GENERATED_METADATA"
GENERATED_CHUNK_COUNT=$(rg -c 'Array<int32_t, 819904> (slot|g_slot)[0-3]Chunk[0-3]' "$GENERATED_CPP")
if (( GENERATED_CHUNK_COUNT != 16 )); then
    print -u2 "FAIL: generated performer has $GENERATED_CHUNK_COUNT table chunks instead of 16"
    exit 1
fi
for SLOT in 0 1 2 3; do
    for CHUNK in 0 1 2 3; do
        rg -q "Array<int32_t, 819904> (g_)?slot${SLOT}Chunk${CHUNK}" "$GENERATED_CPP"
    done
done

COMMON_SOURCES=(
    "$INTEGRATION_SOURCE"
    "$RENDERER_DIR/WarpRenderer.cpp"
    "$RENDERER_DIR/RendererBridge.cpp"
)
COMMON_FLAGS=(
    -std=c++17 -O2 -ffast-math -Wall -Wextra -Werror
    -Wno-unused-local-typedef -Wno-unused-function
    -I"$RENDERER_DIR"
    -I"$RENDERER_DIR/third_party/xsimd/include"
    -DCOSIMO_GENERATED_CPP_PATH=\"$GENERATED_CPP\"
    -DCOSIMO_GENERATED_BLOCK_SIZE="$MAX_FRAMES_PER_BLOCK"
)

# The generated performer must retain a real link-time dependency on the renderer.
if "$HOST_CXX" "${COMMON_FLAGS[@]}" "$INTEGRATION_SOURCE" \
    -o "$BUILD_DIR/provider-missing" 2>"$BUILD_DIR/provider-missing.log"; then
    print -u2 'FAIL: generated performer linked without the external renderer provider'
    exit 1
fi
rg -q 'renderAll' "$BUILD_DIR/provider-missing.log"

"$HOST_CXX" "${COMMON_FLAGS[@]}" "${COMMON_SOURCES[@]}" \
    -o "$BUILD_DIR/generated-renderer-native"
NATIVE_FINGERPRINT=$("$BUILD_DIR/generated-renderer-native")

"$LLVM_DIR/bin/clang++" \
    --target=wasm32-unknown-wasip1 \
    --sysroot="$WASI_C_DIR" \
    -mexec-model=reactor -flto -msimd128 -fignore-exceptions -fno-rtti \
    -nostdlib++ \
    -isystem "$WASI_CXX_DIR/include/wasm32-wasip1/c++/v1" \
    "${COMMON_FLAGS[@]}" "${COMMON_SOURCES[@]}" \
    -Wl,--export=three_oscillator_generated_integration -Wl,--export-memory \
    -Wl,--strip-all -Wl,--gc-sections -Wl,-z,stack-size=1048576 \
    -o "$BUILD_DIR/generated-renderer.wasm"

if "$LLVM_DIR/bin/llvm-readobj" --sections "$BUILD_DIR/generated-renderer.wasm" \
    | rg -q 'Type: IMPORT'; then
    print -u2 'FAIL: generated renderer Wasm unexpectedly imports host functions'
    exit 1
fi

WASM_FINGERPRINT=$(node "$TEST_DIR/run_three_oscillator_generated_wasm.mjs" \
    "$BUILD_DIR/generated-renderer.wasm")
FINGERPRINT_DELTA=$((NATIVE_FINGERPRINT - WASM_FINGERPRINT))
if (( FINGERPRINT_DELTA < 0 )); then
    FINGERPRINT_DELTA=$((-FINGERPRINT_DELTA))
fi
if (( FINGERPRINT_DELTA > 4 )); then
    print -u2 "FAIL: generated native/Wasm fingerprints differ: $NATIVE_FINGERPRINT vs $WASM_FINGERPRINT"
    exit 1
fi

print "PASS generated external renderer: native=$NATIVE_FINGERPRINT wasm=$WASM_FINGERPRINT"
print 'PASS missing external renderer provider fails at link time'
