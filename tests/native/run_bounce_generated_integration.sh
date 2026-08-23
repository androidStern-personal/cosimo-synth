#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd "$test_dir/../.." && pwd -P)"
renderer_dir="$repo_dir/native/three_oscillator_renderer"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/cosimo-bounce-generated.XXXXXX")"

cleanup() {
    rm -rf "$build_dir"
}
trap cleanup EXIT INT TERM

generated_cpp="$build_dir/WavetableSynth.cpp"
generated_metadata="$build_dir/endpoints.json"

"$repo_dir/scripts/generate_cmajor_cpp_with_externals.sh" \
    "$repo_dir/WavetableSynth.cmajorpatch" \
    "$generated_cpp" \
    WavetableSynth \
    --metadata "$generated_metadata" \
    --max-frames-per-block 128

rg -Fq 'Array<int32_t, 684000> bounceSlot0Chunk0' "$generated_cpp"
rg -Fq 'Array<int32_t, 684000> bounceSlot1Chunk7' "$generated_cpp"
rg -Fq 'bounceSlotRootNoteOffFrameOffsets' "$generated_cpp"
rg -Fq '"endpointID": "bounceBankLoadBegin"' "$generated_metadata"
rg -Fq '"endpointID": "bounceBankFrameBatch"' "$generated_metadata"
rg -Fq '"endpointID": "bounceBankCommit"' "$generated_metadata"
rg -Fq '"endpointID": "sourceMode"' "$generated_metadata"

compile_started="$(date +%s)"
"${CXX:-c++}" \
    -std=c++17 -O1 -g0 -Wall -Wextra -Werror \
    -Wno-unused-local-typedefs -Wno-unused-function \
    -I"$renderer_dir" \
    -I"$renderer_dir/third_party/xsimd/include" \
    -DCOSIMO_GENERATED_CPP_PATH=\"$generated_cpp\" \
    "$test_dir/BounceGeneratedIntegration.cpp" \
    "$renderer_dir/RendererBridge.cpp" \
    "$renderer_dir/WarpRenderer.cpp" \
    -o "$build_dir/bounce-generated-integration"
compile_elapsed="$(( $(date +%s) - compile_started ))"

"$build_dir/bounce-generated-integration"
printf 'PASS generated C++ compiled and linked on %s in %ss (absolute VM timing is advisory)\n' \
    "$(uname -s)" "$compile_elapsed"
