#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd "$test_dir/../.." && pwd -P)"
renderer_dir="$repo_dir/native/three_oscillator_renderer"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/cosimo-t53-gain-path.XXXXXX")"

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

for endpoint in oscAVolumeDb oscBVolumeDb oscCVolumeDb oscAMute oscBMute oscCMute audioOut; do
    rg -Fq "\"endpointID\": \"$endpoint\"" "$generated_metadata"
done

"${CXX:-c++}" \
    -std=c++17 -O1 -g0 -Wall -Wextra -Werror \
    -Wno-unused-local-typedefs -Wno-unused-function \
    -I"$renderer_dir" \
    -I"$renderer_dir/third_party/xsimd/include" \
    -DCOSIMO_GENERATED_CPP_PATH=\"$generated_cpp\" \
    "$test_dir/OscillatorDefaultGainPathIntegration.cpp" \
    "$renderer_dir/RendererBridge.cpp" \
    "$renderer_dir/WarpRenderer.cpp" \
    -o "$build_dir/oscillator-default-gain-path"

"$build_dir/oscillator-default-gain-path"
