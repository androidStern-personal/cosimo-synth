#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}"
build_dir="${1:-$repo_root/build/ios_auv3}"
ios_sysroot="${COSIMO_IOS_SYSROOT:-iphoneos}"
cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"
juce_path="${JUCE_PATH:-$cache_root/JUCE}"

enable_app_groups_capability() {
  local project_file="$1"

  [[ -f "$project_file" ]] || return 0

  local project_json root_id
  project_json="$(plutil -convert json -o - "$project_file")"
  root_id="$(jq -r '.rootObject' <<<"$project_json")"

  /usr/libexec/PlistBuddy -c "Add :objects:$root_id:attributes:TargetAttributes dict" "$project_file" 2>/dev/null || true

  for target_name in CosimoSynth_AUv3 CosimoSynth_Standalone; do
    local target_id target_base
    target_id="$(
      jq -r --arg name "$target_name" '
        .objects
        | to_entries[]
        | select(.value.isa == "PBXNativeTarget" and .value.name == $name)
        | .key
      ' <<<"$project_json"
    )"

    [[ -n "$target_id" && "$target_id" != "null" ]] || continue

    target_base=":objects:$root_id:attributes:TargetAttributes:$target_id"
    /usr/libexec/PlistBuddy -c "Add $target_base dict" "$project_file" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Set $target_base:ProvisioningStyle Automatic" "$project_file" 2>/dev/null \
      || /usr/libexec/PlistBuddy -c "Add $target_base:ProvisioningStyle string Automatic" "$project_file"
    /usr/libexec/PlistBuddy -c "Add $target_base:SystemCapabilities dict" "$project_file" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Add $target_base:SystemCapabilities:com.apple.ApplicationGroups.iOS dict" "$project_file" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Set $target_base:SystemCapabilities:com.apple.ApplicationGroups.iOS:enabled 1" "$project_file" 2>/dev/null \
      || /usr/libexec/PlistBuddy -c "Add $target_base:SystemCapabilities:com.apple.ApplicationGroups.iOS:enabled integer 1" "$project_file"
  done
}

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

enable_app_groups_capability "$build_dir/CosimoSynthAUv3.xcodeproj/project.pbxproj"

printf 'Generated Xcode project in %s for %s\n' "$build_dir" "$ios_sysroot"
