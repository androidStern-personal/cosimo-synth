#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}"
patch_path="$repo_root/fx/chorus_lab/ChorusLab.cmajorpatch"
output_dir="${1:-$repo_root/build/chorus_lab_juce}"

cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"
cmajor_source_path="${CMAJOR_SOURCE_PATH:-$cache_root/cmajor-source-$cmajor_version}"
juce_path="${JUCE_PATH:-$cache_root/JUCE}"

if [[ ! -f "$patch_path" ]]; then
  printf 'Patch file not found: %s\n' "$patch_path" >&2
  exit 1
fi

if [[ ! -d "$juce_path/.git" ]]; then
  git clone --depth 1 https://github.com/juce-framework/JUCE.git "$juce_path"
fi

if [[ ! -d "$cmajor_source_path/.git" ]]; then
  git clone --depth 1 --branch "$cmajor_version" https://github.com/cmajor-lang/cmajor.git "$cmajor_source_path"
fi

if [[ ! -f "$cmajor_source_path/include/choc/choc/json/choc_JSON.h" ]]; then
  git -C "$cmajor_source_path" submodule update --init --depth 1 include/choc
fi

rm -rf "$output_dir"

cmaj generate \
  --target=juce \
  "$patch_path" \
  --output="$output_dir" \
  --jucePath="$juce_path" \
  --cmajorIncludePath="$cmajor_source_path/include"

printf 'Generated Chorus Lab JUCE plugin project at %s\n' "$output_dir"
