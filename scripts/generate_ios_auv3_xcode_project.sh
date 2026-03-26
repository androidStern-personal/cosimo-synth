#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}"
build_dir="${1:-$repo_root/build/ios_auv3}"
ios_sysroot="${COSIMO_IOS_SYSROOT:-iphoneos}"
cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"
juce_path="${JUCE_PATH:-$cache_root/JUCE}"

if [[ ! -d "$juce_path/.git" ]]; then
  mkdir -p "$cache_root"
  git clone --depth 1 https://github.com/juce-framework/JUCE.git "$juce_path"
fi

cmake -S "$repo_root/ios_auv3" \
      -B "$build_dir" \
      -G Xcode \
      -DCMAKE_SYSTEM_NAME=iOS \
      -DCMAKE_OSX_SYSROOT="$ios_sysroot" \
      -DCMAJOR_VERSION="$cmajor_version" \
      -DJUCE_PATH="$juce_path"

printf 'Generated Xcode project in %s for %s\n' "$build_dir" "$ios_sysroot"
