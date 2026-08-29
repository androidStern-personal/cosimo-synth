#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${1:-$repo_root/build/ios_device_run}"
ios_sysroot="${COSIMO_IOS_SYSROOT:-iphoneos}"
cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"

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

cmake -S "$repo_root/ios_auv3" \
      -B "$build_dir" \
      -G Xcode \
      -DCMAKE_SYSTEM_NAME=iOS \
      -DCMAKE_OSX_SYSROOT="$ios_sysroot" \
      -DCMAJOR_VERSION="$cmajor_version" \
      -DCOSIMO_WEBVIEW_DEV_SERVER_URL="${COSIMO_WEBVIEW_DEV_SERVER_URL:-}" \
      -DCOSIMO_ENABLE_EDITOR_INSPECTION="${COSIMO_ENABLE_EDITOR_INSPECTION:-}" \
      -DCOSIMO_PRODUCT_NAME="${COSIMO_PRODUCT_NAME:-Cosimo Synth}" \
      -DCOSIMO_BUNDLE_ID="${COSIMO_BUNDLE_ID:-dev.cosimo.wavetable-synth}" \
      -DCOSIMO_HOST_BUNDLE_ID="${COSIMO_HOST_BUNDLE_ID:-dev.cosimo.wavetable-synth-host}" \
      -DCOSIMO_PLUGIN_CODE="${COSIMO_PLUGIN_CODE:-CmDv}" \
      -DCOSIMO_PLUGIN_MANUFACTURER_CODE="${COSIMO_PLUGIN_MANUFACTURER_CODE:-Manu}" \
      -DCOSIMO_ENABLE_APP_GROUP="${COSIMO_ENABLE_APP_GROUP:-ON}" \
      -DCOSIMO_USE_BUNDLED_WAVETABLE_LIBRARY="${COSIMO_USE_BUNDLED_WAVETABLE_LIBRARY:-OFF}" \
      -DCOSIMO_ENABLE_MODULATION_BENCHMARK_METRICS="${COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS:-OFF}" \
      -DCOSIMO_MODULATION_BENCHMARK_PROFILES_PATH="${COSIMO_MODULATION_BENCHMARK_PROFILES_PATH:-}"

if [[ "${COSIMO_ENABLE_APP_GROUP:-ON}" == "ON" ]]; then
  enable_app_groups_capability "$build_dir/CosimoSynthAUv3.xcodeproj/project.pbxproj"
fi

printf 'Generated Xcode project in %s for %s\n' "$build_dir" "$ios_sysroot"
