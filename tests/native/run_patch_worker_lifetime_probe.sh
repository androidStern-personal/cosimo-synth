#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd "$test_dir/../.." && pwd -P)"
probe_build_dir="$repo_dir/build/native_patch_worker_lifetime"
probe_binary="$probe_build_dir/PatchWorkerLifetimeProbe"

cmake -S "$repo_dir/tests/native" -B "$probe_build_dir" -DCMAKE_BUILD_TYPE=Release
cmake --build "$probe_build_dir" --target PatchWorkerLifetimeProbe --parallel 4

python3 - "$probe_binary" <<'PY'
import subprocess
import sys

try:
    result = subprocess.run(
        [sys.argv[1]],
        text=True,
        capture_output=True,
        timeout=5,
        check=False,
    )
except subprocess.TimeoutExpired as error:
    raise SystemExit("FAIL: PatchWorker re-entrant queue probe deadlocked") from error

sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
raise SystemExit(result.returncode)
PY
