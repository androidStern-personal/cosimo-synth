#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}"
build_dir="${1:-$repo_root/build/cmajplugin_vst3}"
juce_path="${JUCE_PATH:-$cache_root/JUCE}"

if [[ -n "${CMAJOR_SOURCE_PATH:-}" ]]; then
  cmajor_source_path="$CMAJOR_SOURCE_PATH"
else
  cmajor_source_path="$(python3 "$repo_root/scripts/ensure_cmajor_runtime.py" --path)"
fi

validate_patched_binary() {
  local binary_path="$1"
  local binary_strings

  if [[ ! -f "$binary_path" ]]; then
    printf 'CmajPlugin binary not found: %s\n' "$binary_path" >&2
    exit 1
  fi

  binary_strings="$(strings "$binary_path")"

  if [[ "$binary_strings" != *chocHostKeyboard* \
      || "$binary_strings" != *__chocHostKeyboardBridgeInstalled* ]]; then
    printf 'CmajPlugin binary was not built with the patched CHOC keyboard bridge: %s\n' "$binary_path" >&2
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

validate_patched_cmajor_runtime() {
  local webview_header="$cmajor_source_path/include/choc/choc/gui/choc_WebView.h"

  if [[ ! -f "$webview_header" ]]; then
    printf 'Cmajor runtime is missing CHOC WebView header: %s\n' "$webview_header" >&2
    exit 1
  fi

  if ! grep -Fq 'chocHostKeyboard' "$webview_header" \
      || ! grep -Fq '__chocHostKeyboardBridgeInstalled' "$webview_header"; then
    printf 'Cmajor runtime does not include the patched CHOC keyboard bridge: %s\n' "$cmajor_source_path" >&2
    printf 'Use scripts/ensure_cmajor_runtime.py --path or set CMAJOR_SOURCE_PATH to a patched Cmajor checkout.\n' >&2
    exit 1
  fi
}

validate_patched_cmajor_runtime

if [[ ! -d "$juce_path/.git" ]]; then
  mkdir -p "$cache_root"
  git clone --depth 1 https://github.com/juce-framework/JUCE.git "$juce_path"
fi

cmake -S "$cmajor_source_path" \
      -B "$build_dir" \
      -DBUILD_PLUGIN=ON \
      -DBUILD_CMAJ=OFF \
      -DBUILD_CMAJ_LIB=OFF \
      -DBUILD_EXAMPLES=OFF \
      -DJUCE_PATH="$juce_path" \
      -DCMAJ_VERSION=1.0.3066 \
      -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET=10.15 \
      -DCMAKE_BUILD_TYPE=Release

cmake --build "$build_dir" \
      --config Release \
      --target CmajPlugin_VST3 \
      --parallel "${CMAKE_BUILD_PARALLEL_LEVEL:-8}"

built_vst3="$build_dir/tools/CmajPlugin/CmajPlugin_artefacts/Release/VST3/CmajPlugin.vst3"
built_binary="$built_vst3/Contents/MacOS/CmajPlugin"

if [[ ! -d "$built_vst3" ]]; then
  printf 'Built CmajPlugin VST3 not found: %s\n' "$built_vst3" >&2
  exit 1
fi

validate_patched_binary "$built_binary"

printf 'Built patched CmajPlugin VST3: %s\n' "$built_vst3"
printf 'Using patched Cmajor runtime: %s\n' "$cmajor_source_path"
