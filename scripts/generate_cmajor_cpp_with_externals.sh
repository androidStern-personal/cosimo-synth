#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
patch_path="${1:?patch path is required}"
output_path="${2:?output C++ path is required}"
class_name="${3:-WavetableSynth}"
metadata_path="${4:-}"
build_dir="${COSIMO_CMAJOR_EXTERNAL_CODEGEN_BUILD_DIR:-$repo_root/build/cmajor_external_codegen}"
cmajor_source_path="${CMAJOR_SOURCE_PATH:-}"

if [[ -z "$cmajor_source_path" ]]; then
  cmajor_source_path="$(python3 "$repo_root/scripts/ensure_cmajor_runtime.py" --path)"
fi

cmake -S "$repo_root/tools/cmajor_external_codegen" -B "$build_dir" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAJOR_SOURCE_PATH="$cmajor_source_path"
cmake --build "$build_dir" --config Release --target cosimo_cmajor_external_codegen -j 4

mkdir -p "$(dirname "$output_path")"
if [[ -n "$metadata_path" ]]; then
  mkdir -p "$(dirname "$metadata_path")"
  "$build_dir/cosimo_cmajor_external_codegen" \
    "$patch_path" "$output_path" "$class_name" "$metadata_path"
else
  "$build_dir/cosimo_cmajor_external_codegen" "$patch_path" "$output_path" "$class_name"
fi
