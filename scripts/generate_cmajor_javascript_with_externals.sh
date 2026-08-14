#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

exec "$repo_root/scripts/generate_cmajor_cpp_with_externals.sh" \
  "${1:?patch path is required}" \
  "${2:?output JavaScript path is required}" \
  "${3:-WavetableSynth}" \
  --target javascript \
  --max-frames-per-block "${COSIMO_CMAJOR_JAVASCRIPT_MAX_FRAMES:-128}"
