#!/bin/zsh

set -euo pipefail

TEST_DIR=${0:A:h}
REPO_DIR=${TEST_DIR:h:h}
LLVM_DIR=${COSIMO_RENDERER_LLVM_DIR:-/opt/homebrew/opt/llvm}
WASI_C_DIR=${COSIMO_RENDERER_WASI_C_DIR:-/opt/homebrew/opt/wasi-libc/share/wasi-sysroot}
WASI_CXX_DIR=${COSIMO_RENDERER_WASI_CXX_DIR:-/opt/homebrew/opt/wasi-runtimes/share/wasi-sysroot}
RENDERER_DIR="$REPO_DIR/native/three_oscillator_renderer"
BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/cosimo-shared-voice-engine.XXXXXX")

cleanup() {
    rm -rf "$BUILD_DIR"
}
trap cleanup EXIT INT TERM

GENERATED_CPP="$BUILD_DIR/ThreeOscillatorSharedVoiceEngine.cpp"
GENERATED_METADATA="$BUILD_DIR/endpoints.json"
PATCH_PATH="$TEST_DIR/fixtures/ThreeOscillatorSharedVoiceEngine.cmajorpatch"
INTEGRATION_SOURCE="$TEST_DIR/ThreeOscillatorSharedVoiceEngineIntegration.cpp"

"$REPO_DIR/scripts/generate_cmajor_cpp_with_externals.sh" \
    "$PATCH_PATH" "$GENERATED_CPP" ThreeOscillatorSharedVoiceEngine "$GENERATED_METADATA"

rg -Fq 'CosimoThreeOscillatorRenderer__renderAll' "$GENERATED_CPP"
rg -Fq 'ThreeOscillatorSharedVoiceEngine' "$GENERATED_CPP"
rg -Fq '"endpointID": "audioOut"' "$GENERATED_METADATA"
GENERATED_CHUNK_COUNT=$(rg -c 'Array<int32_t, 819904> packedSlot[0-3]Chunk[0-3]' "$GENERATED_CPP")
if (( GENERATED_CHUNK_COUNT != 16 )); then
    print -u2 "FAIL: generated SharedVoiceEngine has $GENERATED_CHUNK_COUNT table chunks instead of 16"
    exit 1
fi

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
)

/usr/bin/c++ "${COMMON_FLAGS[@]}" "${COMMON_SOURCES[@]}" \
    -o "$BUILD_DIR/shared-voice-engine-native"
NATIVE_FINGERPRINT=$("$BUILD_DIR/shared-voice-engine-native")

"$LLVM_DIR/bin/clang++" \
    --target=wasm32-unknown-wasip1 \
    --sysroot="$WASI_C_DIR" \
    -mexec-model=reactor -flto -msimd128 -fignore-exceptions -fno-rtti \
    -nostdlib++ \
    -isystem "$WASI_CXX_DIR/include/wasm32-wasip1/c++/v1" \
    "${COMMON_FLAGS[@]}" "${COMMON_SOURCES[@]}" \
    -Wl,--export=three_oscillator_generated_integration -Wl,--export-memory \
    -Wl,--strip-all -Wl,--gc-sections -Wl,-z,stack-size=1048576 \
    -o "$BUILD_DIR/shared-voice-engine.wasm"

if "$LLVM_DIR/bin/llvm-readobj" --sections "$BUILD_DIR/shared-voice-engine.wasm" \
    | rg -q 'Type: IMPORT'; then
    print -u2 'FAIL: SharedVoiceEngine Wasm unexpectedly imports host functions'
    exit 1
fi

WASM_FINGERPRINT=$(node "$TEST_DIR/run_three_oscillator_generated_wasm.mjs" \
    "$BUILD_DIR/shared-voice-engine.wasm")
if (( NATIVE_FINGERPRINT != 424242 || WASM_FINGERPRINT != 424242 )); then
    print -u2 "FAIL: SharedVoiceEngine semantic gates differ: $NATIVE_FINGERPRINT vs $WASM_FINGERPRINT"
    exit 1
fi

for PRODUCT_NAME in WavetableSynth WavetableSynth.iOS; do
    PRODUCT_CPP="$BUILD_DIR/$PRODUCT_NAME.cpp"
    PRODUCT_METADATA="$BUILD_DIR/$PRODUCT_NAME.endpoints.json"
    "$REPO_DIR/scripts/generate_cmajor_cpp_with_externals.sh" \
        "$REPO_DIR/$PRODUCT_NAME.cmajorpatch" \
        "$PRODUCT_CPP" \
        WavetableSynth \
        "$PRODUCT_METADATA"

    rg -Fq 'CosimoThreeOscillatorRenderer__renderAll' "$PRODUCT_CPP"
    PRODUCT_OSCILLATOR_ENDPOINT_COUNT=$(rg -c '"endpointID": "osc[ABC]' "$PRODUCT_METADATA")
    if (( PRODUCT_OSCILLATOR_ENDPOINT_COUNT != 66 )); then
        print -u2 "FAIL: $PRODUCT_NAME exposes $PRODUCT_OSCILLATOR_ENDPOINT_COUNT A/B/C controls instead of 66"
        exit 1
    fi

    if rg -q '"endpointID": "(wavetablePosition|wavetableSelect|pan|warpMode|warpAmount|unisonVoices|unisonDetune|unisonBlend|unisonWidth|unisonPhase|unisonRandom|unisonPhaseMode|unisonDetuneMode|unisonStackMode|unisonWavetablePositionSpread|unisonWarpSpread)"' \
        "$PRODUCT_METADATA"; then
        print -u2 "FAIL: $PRODUCT_NAME still exposes scalar oscillator-A controls"
        exit 1
    fi
done

if rg -qi 'selectedOscillator|oscillatorTab|activeOscillatorTab' \
    "$TEST_DIR/fixtures/ThreeOscillatorSharedVoiceEngine.cmajor"; then
    print -u2 'FAIL: focused sound fixture depends on UI oscillator selection'
    exit 1
fi

print "PASS SharedVoiceEngine semantic gates: native=$NATIVE_FINGERPRINT wasm=$WASM_FINGERPRINT"
print 'PASS hard-cut products: one renderer call and exact 66-control A/B/C surface'
