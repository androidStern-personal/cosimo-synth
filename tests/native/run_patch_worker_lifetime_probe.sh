#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_dir="$(cd "$test_dir/../.." && pwd -P)"
cmajor_source_path="$(python3 "$repo_dir/scripts/resolve_build_dependencies.py" --path cmajor)"
probe_build_dir="$repo_dir/build/native_patch_worker_lifetime"
probe_binary="$probe_build_dir/PatchWorkerLifetimeProbe"
host_os="$(uname -s)"
platform_cflags=()
platform_ldflags=(-ldl)

if [[ "$host_os" == "Darwin" ]]; then
    platform_ldflags=(
        -framework Accelerate
        -framework CoreAudio
        -framework CoreMIDI
        -framework AudioToolbox
        -framework Foundation
        -framework IOKit
        -framework Cocoa
        -ldl
    )
else
    read -r -a gtk_cflags <<<"$(pkg-config --cflags gtk+-3.0)"
    read -r -a gtk_libs <<<"$(pkg-config --libs gtk+-3.0)"
    platform_cflags=("${gtk_cflags[@]}")
    platform_ldflags=("${gtk_libs[@]}" -ldl)
fi

mkdir -p "$probe_build_dir"
"${CXX:-c++}" \
    -std=c++17 -O1 -g0 -pthread -DCMAJOR_DLL=1 \
    "${platform_cflags[@]}" \
    -I "$cmajor_source_path/include" \
    -I "$cmajor_source_path/include/choc" \
    "$repo_dir/tests/native_quickjs/PatchWorkerLifetimeProbe.cpp" \
    -o "$probe_binary" \
    "${platform_ldflags[@]}"

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
