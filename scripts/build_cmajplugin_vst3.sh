#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${1:-$repo_root/build/cmajplugin_vst3}"
source "$repo_root/scripts/cmajplugin_paths.sh"

validate_patched_binary() {
  local binary_path="$1"

  if [[ ! -f "$binary_path" ]]; then
    printf 'CmajPlugin binary not found: %s\n' "$binary_path" >&2
    exit 1
  fi

  if ! command -v node >/dev/null 2>&1; then
    printf 'node was not found on PATH (required for the CHOC marker check).\n' >&2
    exit 1
  fi

  if ! node "$repo_root/scripts/check_choc_markers.mjs" "$binary_path"; then
    printf 'Built CmajPlugin binary failed the patched CHOC WebView marker check: %s\n' "$binary_path" >&2
    exit 1
  fi
}

cmake -S "$repo_root/tools/cmajplugin_build" \
      -B "$build_dir" \
      -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET=10.15 \
      -DCMAKE_BUILD_TYPE=Release

cmake --build "$build_dir" \
      --config Release \
      --target CmajPlugin_VST3 \
      --parallel "${CMAKE_BUILD_PARALLEL_LEVEL:-8}"

built_vst3="$(cmajplugin_vst3_bundle_path "$build_dir")"
built_binary="$built_vst3/Contents/MacOS/CmajPlugin"

if [[ ! -d "$built_vst3" ]]; then
  printf 'Built CmajPlugin VST3 not found: %s\n' "$built_vst3" >&2
  exit 1
fi

validate_patched_binary "$built_binary"

printf 'Built patched CmajPlugin VST3: %s\n' "$built_vst3"
