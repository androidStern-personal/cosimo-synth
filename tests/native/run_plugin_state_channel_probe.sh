#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
probe_build_dir="$repo_dir/build/native_plugin_state"
: "${COSIMO_CMAJOR_SOURCE:?Set the isolated Cmajor source worktree}"
: "${COSIMO_PLUGIN_STATE_JUCE_SOURCE:?Set the verified pinned JUCE source directory}"
: "${COSIMO_CMAJOR_RUNTIME_LIBRARY:?Set the verified Cmajor runtime library}"

cmake -S "$repo_dir/tests/native" -B "$probe_build_dir" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCPM_SOURCE_CACHE="$probe_build_dir/sources" \
    -DCPM_cosimo_juce_SOURCE="$COSIMO_PLUGIN_STATE_JUCE_SOURCE"
cmake --build "$probe_build_dir" --target PluginStateChannelProbe --parallel 2

python3 - "$probe_build_dir/PluginStateChannelProbe" "$COSIMO_CMAJOR_RUNTIME_LIBRARY" \
    "$repo_dir/tests/native/fixtures/plugin_state_channel/PluginStateChannel.cmajorpatch" <<'PY'
import subprocess
import sys

try:
    result = subprocess.run(sys.argv[1:], timeout=15, check=False)
except subprocess.TimeoutExpired:
    raise SystemExit("FAIL: native plugin-state channel probe did not complete")
raise SystemExit(result.returncode)
PY
