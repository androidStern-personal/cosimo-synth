#!/usr/bin/env bash
set -euo pipefail
# Usage: runner <authored Cmajor source> <runtime library> [output] [jit|aot] [codegen tool]
# AOT requires the matching built cosimo_cmajor_external_codegen tool, supplied
# as argument 5 or COSIMO_CMAJOR_EXTERNAL_CODEGEN. Rebuild the product worker first.
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(cd "$test_dir/../.." && pwd -P)"
cmajor="${1:?Pass authored Cmajor source directory}"
library="${2:?Pass Cmajor runtime library}"
output="${3:-$root/build/cosimo-state-history-proof}"
mode="${4:-jit}"
renderer="$root/native/three_oscillator_renderer"
extra=()
case "$mode" in
    jit) ;;
    aot) extra=(-DCOSIMO_HISTORY_AOT=1 "$test_dir/CosimoStateHistoryAot.cpp") ;;
    *) echo 'Mode must be jit or aot' >&2; exit 2 ;;
esac
node "$root/tests/helpers/build_cosimo_state_history_fixture.mjs" "$output"
if [[ "$mode" == aot ]]; then
    codegen="${5:-${COSIMO_CMAJOR_EXTERNAL_CODEGEN:-}}"
    if [[ ! -x "$codegen" ]]; then
        echo 'AOT requires executable argument 5 or COSIMO_CMAJOR_EXTERNAL_CODEGEN' >&2
        exit 2
    fi
    "$codegen" "$root/WavetableSynth.cmajorpatch" "$output/CosimoHistoryDSP.h" CosimoHistoryDSP --max-frames-per-block 128
fi
"${CXX:-c++}" -std=c++17 -O1 -g0 -pthread -DCMAJOR_DLL=1 \
    -I "$cmajor/include" -I "$cmajor/include/choc" -I "$renderer" \
    -I "$renderer/third_party/xsimd/include" -I "$output" \
    "$test_dir/CosimoStateHistoryProbe.cpp" "${extra[@]}" \
    "$renderer/RendererBridge.cpp" "$renderer/WarpRenderer.cpp" \
    -framework Accelerate -framework AudioToolbox -framework Cocoa -framework CoreAudio \
    -framework CoreMIDI -framework Foundation -framework IOKit -o "$output/probe-$mode"
"$output/probe-$mode" "$library" "$output/Cosimo.cmajorpatch" "$output/client.js"
