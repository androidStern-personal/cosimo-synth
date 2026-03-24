#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}"
build_dir="$repo_root/build/live-dev-plugin"
generated_dir="$build_dir/generated-juce"
generated_build_dir="$build_dir/generated-build"
patch_path="$repo_root/WavetableSynth.cmajorpatch"
plugin_version="1.0.3066"

cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"

cmajor_source_path="${CMAJOR_SOURCE_PATH:-$cache_root/cmajor-source-$cmajor_version}"
juce_path="${JUCE_PATH:-$cache_root/JUCE}"

au_install_dir="$HOME/Library/Audio/Plug-Ins/Components"

au_bundle="$au_install_dir/CmajInstrumentDev.component"
au_sidecar="$au_install_dir/CmajInstrumentDev.json"

if [[ ! -e "$patch_path" ]]; then
  printf 'Patch file not found: %s\n' "$patch_path" >&2
  exit 1
fi

mkdir -p "$cache_root"

if [[ ! -d "$juce_path/.git" ]]; then
  git clone --depth 1 https://github.com/juce-framework/JUCE.git "$juce_path"
fi

git -C "$juce_path" checkout -- modules/juce_audio_plugin_client/juce_audio_plugin_client_AU_1.mm

if [[ ! -d "$cmajor_source_path/.git" ]]; then
  git clone --depth 1 --branch "$cmajor_version" https://github.com/cmajor-lang/cmajor.git "$cmajor_source_path"
fi

if [[ ! -f "$cmajor_source_path/include/choc/choc/json/choc_JSON.h" ]]; then
  git -C "$cmajor_source_path" submodule update --init --depth 1 include/choc
fi

rm -rf "$generated_dir" "$generated_build_dir"
mkdir -p "$build_dir" "$au_install_dir"

cmaj generate --target=juce "$patch_path" \
              --output="$generated_dir" \
              --jucePath="$juce_path" \
              --cmajorIncludePath="$cmajor_source_path/include" \
              --juceFormats="Standalone AU"

generated_cmake="$generated_dir/CMakeLists.txt"

if [[ ! -f "$generated_cmake" ]]; then
  printf 'Generated CMake project not found: %s\n' "$generated_cmake" >&2
  exit 1
fi

perl -0pi -e '
  s/\bWavetableSynth\b/CmajInstrumentDev/g;
  s/\bCosimoSynth\b/CmajInstrumentDev/g;
  s/dev\.cosimo\.wavetable-synth/dev.cosimo.cmajor.instrument.dev/g;
  s/VERSION\s+[0-9]+\.[0-9]+\.[0-9]+/VERSION 1.0.3066/g;
' "$generated_cmake"

cmake -S "$generated_dir" \
      -B "$generated_build_dir" \
      -DCMAKE_BUILD_TYPE=Release \
      -DJUCE_PATH="$juce_path"

cmake --build "$generated_build_dir" --config Release

au_built="$generated_build_dir/CmajInstrumentDev_artefacts/Release/AU/CmajInstrumentDev.component"

if [[ ! -d "$au_built" ]]; then
  printf 'Built AU bundle not found: %s\n' "$au_built" >&2
  exit 1
fi

rm -f "$au_sidecar"
rm -rf "$au_bundle"
cp -R "$au_built" "$au_bundle"

codesign --force --deep --sign - "$au_bundle" >/dev/null

printf 'Installed %s\n' "$au_bundle"
printf 'Built from %s\n' "$patch_path"
printf 'Generated project %s\n' "$generated_dir"
