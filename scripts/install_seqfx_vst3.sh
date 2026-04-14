#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
project_dir="$repo_root/build/seqfx_juce"
build_dir="$repo_root/build/seqfx_juce_build"
source_vst3="$build_dir/CosimoSeqFX_artefacts/Release/VST3/CosimoSeqFX.vst3"
install_dir="$HOME/Library/Audio/Plug-Ins/VST3"
installed_vst3="$install_dir/CosimoSeqFX.vst3"

cd "$repo_root"

npm run seqfx:plugin:generate

cmake -S "$project_dir" -B "$build_dir" -DCMAKE_BUILD_TYPE=Release
cmake --build "$build_dir" --config Release --target CosimoSeqFX_VST3 -j "${CMAKE_BUILD_PARALLEL_LEVEL:-4}"

if [[ ! -d "$source_vst3" ]]; then
  printf 'Built VST3 bundle not found: %s\n' "$source_vst3" >&2
  exit 1
fi

mkdir -p "$install_dir"
rm -rf "$installed_vst3"
ditto "$source_vst3" "$installed_vst3"
xattr -dr com.apple.quarantine "$installed_vst3" 2>/dev/null || true

codesign --force --deep --sign - "$installed_vst3"
codesign --verify --deep --strict --verbose=2 "$installed_vst3"

printf 'Installed VST3 plugin: %s\n' "$installed_vst3"
