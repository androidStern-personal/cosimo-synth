#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${CMAJPLUGIN_BUILD_DIR:-$repo_root/build/cmajplugin_vst3}"
built_vst3="$build_dir/tools/CmajPlugin/CmajPlugin_artefacts/Release/VST3/CmajPlugin.vst3"
built_binary="$built_vst3/Contents/MacOS/CmajPlugin"
install_dir="$HOME/Library/Audio/Plug-Ins/VST3"
installed_vst3="$install_dir/CmajPlugin.vst3"
installed_binary="$installed_vst3/Contents/MacOS/CmajPlugin"

usage() {
  cat <<'USAGE'
Usage: npm run cmajplugin:install -- [--dry-run]

Installs the already-built patched generic CmajPlugin.vst3.
It does not build and does not write CmajPlugin.json.
USAGE
}

dry_run=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac

  shift
done

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

if [[ ! -d "$built_vst3" ]]; then
  printf 'Built CmajPlugin VST3 not found: %s\n' "$built_vst3" >&2
  printf 'Run npm run cmajplugin:build first.\n' >&2
  exit 1
fi

validate_patched_binary "$built_binary"

if [[ "$dry_run" == true ]]; then
  printf 'Validated patched CmajPlugin VST3: %s\n' "$built_vst3"
  printf 'Would install to: %s\n' "$installed_vst3"
  exit 0
fi

mkdir -p "$install_dir"
rm -rf "$installed_vst3"
cp -R "$built_vst3" "$installed_vst3"
codesign --force --deep --sign - "$installed_vst3" >/dev/null
codesign --verify --deep --strict --verbose=4 "$installed_vst3" >/dev/null
validate_patched_binary "$installed_binary"

printf 'Installed patched CmajPlugin VST3: %s\n' "$installed_vst3"
printf 'CmajPlugin.json was not changed.\n'
