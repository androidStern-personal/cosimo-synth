#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
probe_build_dir="$repo_dir/build/native_plugin_state_system"
: "${COSIMO_CMAJOR_SOURCE:?Set the isolated Cmajor source worktree}"
: "${COSIMO_PLUGIN_STATE_JUCE_SOURCE:?Set the verified pinned JUCE source directory}"
: "${COSIMO_CMAJOR_RUNTIME_LIBRARY:?Set the verified Cmajor runtime library}"

node "$repo_dir/tests/helpers/build_plugin_state_fixture.mjs" "$probe_build_dir"

cmake -S "$repo_dir/tests/native" -B "$probe_build_dir" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCPM_SOURCE_CACHE="$probe_build_dir/sources" \
    -DCPM_cosimo_juce_SOURCE="$COSIMO_PLUGIN_STATE_JUCE_SOURCE"
cmake --build "$probe_build_dir" --target PluginStateSystemProbe --parallel 2

python3 - "$probe_build_dir/PluginStateSystemProbe" "$COSIMO_CMAJOR_RUNTIME_LIBRARY" \
    "$probe_build_dir/fixture-path.txt" "$COSIMO_CMAJOR_SOURCE" <<'PY'
import hashlib
import json
from pathlib import Path
import subprocess
import sys

probe, runtime, fixture_path, source = (Path(value).resolve() for value in sys.argv[1:])
manifest = Path(fixture_path.read_text().strip())
report_dir = fixture_path.parent
try:
    result = subprocess.run([str(probe), str(runtime), str(manifest)], timeout=45,
                            check=False, capture_output=True, text=True)
except subprocess.TimeoutExpired:
    raise SystemExit("FAIL: actual QuickJS plugin-state system probe did not complete")
output = result.stdout + result.stderr
(report_dir / "probe-run.log").write_text(output)
report = json.loads((report_dir / "fixture-build.json").read_text())
report["exitCode"] = result.returncode
report["cmajorCommit"] = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
report["files"] = {
    label: {"path": str(file), "sha256": hashlib.sha256(file.read_bytes()).hexdigest()}
    for label, file in {
        "probe": probe,
        "runtime": runtime,
        "patchHeader": source / "include/cmajor/helpers/cmaj_Patch.h",
        "workerHeader": source / "include/cmajor/helpers/cmaj_PatchWorker_QuickJS.h",
        "quickJSHeader": source / "include/choc/choc/javascript/choc_javascript_QuickJS.h",
    }.items()
}
(report_dir / "probe-result.json").write_text(json.dumps(report, indent=2) + "\n")
print(output, end="")
raise SystemExit(result.returncode)
PY
