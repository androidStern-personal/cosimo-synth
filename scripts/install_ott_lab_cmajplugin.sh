#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}"
patch_path="$repo_root/fx/ott_lab/OttLab.cmajorpatch"

cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"
dmg_path="$cache_root/cmajor-$cmajor_version.dmg"
download_url="https://github.com/cmajor-lang/cmajor/releases/download/$cmajor_version/cmajor.dmg"

component_dir="$HOME/Library/Audio/Plug-Ins/Components"
vst3_dir="$HOME/Library/Audio/Plug-Ins/VST3"
mount_point="$cache_root/cmajor-dmg-install-$cmajor_version"

if [[ ! -f "$patch_path" ]]; then
  printf 'Patch file not found: %s\n' "$patch_path" >&2
  exit 1
fi

mkdir -p "$cache_root" "$component_dir" "$vst3_dir"

if [[ ! -f "$dmg_path" ]]; then
  curl -L "$download_url" -o "$dmg_path"
fi

mkdir -p "$mount_point"

cleanup() {
  if mount | grep -q "on $mount_point "; then
    hdiutil detach "$mount_point" >/dev/null || true
  fi

  rmdir "$mount_point" 2>/dev/null || true
}

trap cleanup EXIT

hdiutil attach "$dmg_path" -mountpoint "$mount_point" -nobrowse >/dev/null

if [[ ! -d "$mount_point/CmajPlugin.vst3" ]]; then
  printf 'Expected CmajPlugin.vst3 inside %s\n' "$dmg_path" >&2
  exit 1
fi

disable_repo_pointed_generic_au() {
  local component_path="$component_dir/CmajPlugin.component"
  local component_json="$component_dir/CmajPlugin.json"

  if [[ ! -e "$component_path" && ! -e "$component_json" ]]; then
    return
  fi

  if [[ -f "$component_json" ]] && grep -Fq "$repo_root" "$component_json"; then
    local disabled_root="$HOME/Library/Audio/Plug-Ins/Disabled/CosimoUnsafeCmajPluginAU-$(date +%Y%m%d%H%M%S)"
    mkdir -p "$disabled_root/Components"

    if [[ -e "$component_path" ]]; then
      mv "$component_path" "$disabled_root/Components/"
    fi

    if [[ -e "$component_json" ]]; then
      mv "$component_json" "$disabled_root/Components/"
    fi

    printf 'Moved repo-pointed official AU loader out of Ableton scan path: %s\n' "$disabled_root"
  fi
}

rm -rf "$vst3_dir/CmajPlugin.vst3"

cp -R "$mount_point/CmajPlugin.vst3" "$vst3_dir/CmajPlugin.vst3"

printf '{\n  "location": "%s"\n}\n' "$patch_path" > "$vst3_dir/CmajPlugin.json"

disable_repo_pointed_generic_au

printf 'Installed VST3: %s\n' "$vst3_dir/CmajPlugin.vst3"
printf 'Default patch JSON: %s\n' "$vst3_dir/CmajPlugin.json"
printf 'Default patch: %s\n' "$patch_path"
