#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
patch_path="${1:?patch path is required}"
output_path="${2:?output C++ path is required}"
class_name="${3:-WavetableSynth}"
metadata_path=""
max_frames_per_block="512"
target="cpp"
build_jobs="${COSIMO_CMAJOR_BUILD_JOBS:-4}"
if (( $# >= 3 )); then
  shift 3
else
  shift 2
fi

while (( $# > 0 )); do
  case "$1" in
    --metadata)
      metadata_path="${2:?--metadata requires a path}"
      shift 2
      ;;
    --max-frames-per-block)
      max_frames_per_block="${2:?--max-frames-per-block requires a value}"
      shift 2
      ;;
    --target)
      target="${2:?--target requires a value}"
      shift 2
      ;;
    *)
      # Preserve the original optional positional metadata argument.
      if [[ -z "$metadata_path" ]]; then
        metadata_path="$1"
        shift
      else
        printf 'Unknown argument: %s\n' "$1" >&2
        exit 1
      fi
      ;;
  esac
done
build_dir="${COSIMO_CMAJOR_EXTERNAL_CODEGEN_BUILD_DIR:-$repo_root/build/cmajor_external_codegen-host}"
cmajor_source_path="${CMAJOR_SOURCE_PATH:-}"

if [[ -z "$cmajor_source_path" ]]; then
  cmajor_source_path="$(python3 "$repo_root/scripts/ensure_cmajor_runtime.py" --path)"
fi

host_cmake() {
  env \
    -u SDKROOT \
    -u PLATFORM_NAME \
    -u EFFECTIVE_PLATFORM_NAME \
    -u ARCHS \
    -u CURRENT_ARCH \
    -u NATIVE_ARCH_ACTUAL \
    -u CMAKE_GENERATOR \
    -u CMAKE_OSX_ARCHITECTURES \
    -u CMAKE_OSX_DEPLOYMENT_TARGET \
    -u CMAKE_OSX_SYSROOT \
    -u IPHONEOS_DEPLOYMENT_TARGET \
    cmake "$@"
}

host_cmake -S "$repo_root/tools/cmajor_external_codegen" -B "$build_dir" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_OSX_SYSROOT=macosx \
  -DCMAJOR_SOURCE_PATH="$cmajor_source_path"
host_cmake --build "$build_dir" --config Release --target cosimo_cmajor_external_codegen -j "$build_jobs"

mkdir -p "$(dirname "$output_path")"
if [[ -n "$metadata_path" ]]; then
  mkdir -p "$(dirname "$metadata_path")"
  "$build_dir/cosimo_cmajor_external_codegen" \
    "$patch_path" "$output_path" "$class_name" \
    --metadata "$metadata_path" \
    --max-frames-per-block "$max_frames_per_block" \
    --target "$target"
else
  "$build_dir/cosimo_cmajor_external_codegen" \
    "$patch_path" "$output_path" "$class_name" \
    --max-frames-per-block "$max_frames_per_block" \
    --target "$target"
fi
