#!/usr/bin/env bash
set -euo pipefail
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cmajor_dir="${1:?Usage: run_plugin_state_shared_data_probe.sh CMAJOR_SOURCE_DIR CMAJOR_RUNTIME_LIBRARY GENERATED_MANIFEST}"
runtime_library="${2:?Pass the Cmajor runtime library path}"
manifest="${3:?Pass the actual generated shared-data fixture manifest}"
mode="${4:-jit}"
if [[ -n "${5:-}" ]]; then
    build_dir="$5"
    mkdir -p "$build_dir"
else
    build_dir="$(mktemp -d "${TMPDIR:-/tmp}/plugin-state-shared-data.XXXXXX")"
    trap 'rm -rf "$build_dir"' EXIT INT TERM
fi
mode_flags=()
case "$mode" in
    jit) ;;
    aot)
        [[ -f "$build_dir/SharedStateDSP.h" ]] || { echo "Generate SharedStateDSP.h in the build directory before AOT qualification" >&2; exit 2; }
        mode_flags=(-DCOSIMO_SHARED_STATE_AOT=1 -I "$build_dir")
        ;;
    *) echo "Mode must be jit or aot" >&2; exit 2 ;;
esac
platform_flags=()
if [[ "$(uname)" == Darwin ]]; then
    for framework in Accelerate AudioToolbox Cocoa CoreAudio CoreMIDI Foundation IOKit; do
        platform_flags+=(-framework "$framework")
    done
fi
"${CXX:-c++}" -std=c++17 -O1 -g0 -pthread \
    -I "$cmajor_dir/include" -I "$cmajor_dir/include/choc" -I "$(dirname "$manifest")" \
    "${mode_flags[@]}" \
    "$test_dir/PluginStateSharedDataProbe.cpp" "${platform_flags[@]}" -o "$build_dir/shared-data-state-probe-$mode"
"$build_dir/shared-data-state-probe-$mode" "$runtime_library" "$manifest"
