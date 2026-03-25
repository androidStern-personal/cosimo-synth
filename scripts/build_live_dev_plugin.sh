#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}"
build_dir="$repo_root/build/live-dev-plugin"
patch_path="$repo_root/WavetableSynth.cmajorpatch"

cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"

cmajor_source_path="${CMAJOR_SOURCE_PATH:-$cache_root/cmajor-source-$cmajor_version}"
juce_path="${JUCE_PATH:-$cache_root/JUCE}"
dmg_path="$cache_root/cmajor-$cmajor_version.dmg"
runtime_dylib="$cache_root/libCmajPerformer-$cmajor_version.dylib"
mount_point="$cache_root/cmajor-dmg-$cmajor_version"

vst3_install_dir="$HOME/Library/Audio/Plug-Ins/VST3"
au_install_dir="$HOME/Library/Audio/Plug-Ins/Components"

vst3_bundle="$vst3_install_dir/CmajInstrumentDev.vst3"
au_bundle="$au_install_dir/CmajInstrumentDev.component"
vst3_sidecar="$vst3_install_dir/CmajInstrumentDev.json"
au_sidecar="$au_install_dir/CmajInstrumentDev.json"

if [[ ! -e "$patch_path" ]]; then
  printf 'Patch file not found: %s\n' "$patch_path" >&2
  exit 1
fi

mkdir -p "$cache_root"

if [[ ! -d "$juce_path/.git" ]]; then
  git clone --depth 1 https://github.com/juce-framework/JUCE.git "$juce_path"
fi

if [[ ! -d "$cmajor_source_path/.git" ]]; then
  git clone --depth 1 --branch "$cmajor_version" https://github.com/cmajor-lang/cmajor.git "$cmajor_source_path"
fi

if [[ ! -f "$cmajor_source_path/include/choc/choc/json/choc_JSON.h" ]]; then
  git -C "$cmajor_source_path" submodule update --init --depth 1 include/choc
fi

if [[ ! -f "$runtime_dylib" ]]; then
  if [[ ! -f "$dmg_path" ]]; then
    curl -L "https://github.com/cmajor-lang/cmajor/releases/download/$cmajor_version/cmajor.dmg" -o "$dmg_path"
  fi

  mkdir -p "$mount_point"
  hdiutil attach "$dmg_path" -mountpoint "$mount_point" -nobrowse >/dev/null
  cp "$mount_point/libCmajPerformer.dylib" "$runtime_dylib"
  hdiutil detach "$mount_point" >/dev/null
  rmdir "$mount_point" 2>/dev/null || true
fi

mkdir -p "$build_dir" "$au_install_dir"

cmake -S "$repo_root/live_dev_plugin" \
      -B "$build_dir" \
      -DCMAKE_BUILD_TYPE=Release \
      -DCOSIMO_PATCH_PATH="$patch_path" \
      -DCMAJOR_SOURCE_PATH="$cmajor_source_path" \
      -DJUCE_PATH="$juce_path"

cmake --build "$build_dir" --config Release

au_built="$build_dir/CmajInstrumentDev_artefacts/Release/AU/CmajInstrumentDev.component"

if [[ ! -d "$au_built" ]]; then
  printf 'Built AU bundle not found: %s\n' "$au_built" >&2
  exit 1
fi

rm -rf "$vst3_bundle"
rm -f "$vst3_sidecar" "$au_sidecar"
rm -rf "$au_bundle"
cp -R "$au_built" "$au_bundle"

mkdir -p "$au_bundle/Contents/Resources"
cp "$runtime_dylib" "$au_bundle/Contents/Resources/libCmajPerformer.dylib"

codesign --force --deep --sign - "$au_bundle" >/dev/null

printf 'Installed %s\n' "$au_bundle"
printf 'Bundled %s\n' "$runtime_dylib"
printf 'Using patch %s\n' "$patch_path"
