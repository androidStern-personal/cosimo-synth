#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${1:-$repo_root/build/cmajplugin_vst3}"

validate_patched_binary() {
  local binary_path="$1"
  local binary_strings

  if [[ ! -f "$binary_path" ]]; then
    printf 'CmajPlugin binary not found: %s\n' "$binary_path" >&2
    exit 1
  fi

  binary_strings="$(strings "$binary_path")"

  if [[ "$binary_strings" != *chocHostKeyboard* \
      || "$binary_strings" != *__chocHostKeyboardBridgeInstalled* \
      || "$binary_strings" != *__chocUserFiles* \
      || "$binary_strings" != *chocUserFiles* ]]; then
    printf 'CmajPlugin binary was not built with the required patched CHOC WebView features: %s\n' "$binary_path" >&2
    exit 1
  fi

  if [[ "$binary_strings" == *cosimoKeyboard* \
      || "$binary_strings" == *cosimoKeyboardProbe* \
      || "$binary_strings" == *cosimo-keyboard-probe-panel* \
      || "$binary_strings" == *forwarded-buffered-flags-changed* ]]; then
    printf 'CmajPlugin binary still contains old keyboard probe markers: %s\n' "$binary_path" >&2
    exit 1
  fi
}

if [[ -f "$build_dir/CMakeCache.txt" ]]; then
  cached_source_dir="$(awk -F= '/^CMAKE_HOME_DIRECTORY:INTERNAL=/{print $2; exit}' "$build_dir/CMakeCache.txt")"

  if [[ -n "$cached_source_dir" && "$cached_source_dir" != "$repo_root/tools/cmajplugin_build" ]]; then
    rm -rf "$build_dir"
  fi
fi

cmake -S "$repo_root/tools/cmajplugin_build" \
      -B "$build_dir" \
      -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET=10.15 \
      -DCMAKE_BUILD_TYPE=Release

cmake --build "$build_dir" \
      --config Release \
      --target CmajPlugin_VST3 \
      --parallel "${CMAKE_BUILD_PARALLEL_LEVEL:-8}"

built_vst3="$build_dir/cmajplugin/CmajPlugin_artefacts/Release/VST3/CmajPlugin.vst3"
built_binary="$built_vst3/Contents/MacOS/CmajPlugin"

if [[ ! -d "$built_vst3" ]]; then
  printf 'Built CmajPlugin VST3 not found: %s\n' "$built_vst3" >&2
  exit 1
fi

validate_patched_binary "$built_binary"

printf 'Built patched CmajPlugin VST3: %s\n' "$built_vst3"
printf 'Dependency evidence: %s\n' "$build_dir/cosimo-dependency-resolution.json"
