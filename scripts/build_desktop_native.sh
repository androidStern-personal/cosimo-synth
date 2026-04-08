#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${COSIMO_DEV_CACHE:-$HOME/Library/Caches/cosimo-synth-dev}"
build_dir="$repo_root/build/desktop_native"
patch_path="$repo_root/WavetableSynth.cmajorpatch"
desktop_ui_source_mode="${COSIMO_DESKTOP_UI_SOURCE_MODE:-compiled}"
desktop_dev_server_origin="${COSIMO_DESKTOP_DEV_SERVER_ORIGIN:-http://127.0.0.1:5174}"
desktop_dev_server_module_url="${desktop_dev_server_origin%/}/patch_gui/desktop/index.js"
desktop_dev_server_status_url="${desktop_dev_server_origin%/}/__cosimo-dev-status"

cmajor_version="$(cmaj version | awk '/Cmajor Version:/ { print $3; exit }')"

cmajor_source_path="${CMAJOR_SOURCE_PATH:-$cache_root/cmajor-source-$cmajor_version}"
juce_path="${JUCE_PATH:-$cache_root/JUCE}"
dmg_path="$cache_root/cmajor-$cmajor_version.dmg"
runtime_dylib="$cache_root/libCmajPerformer-$cmajor_version.dylib"
mount_point="$cache_root/cmajor-dmg-$cmajor_version"

au_install_dir="$HOME/Library/Audio/Plug-Ins/Components"

au_bundle="$au_install_dir/CosimoDesktopNative.component"

if [[ ! -e "$patch_path" ]]; then
  printf 'Patch file not found: %s\n' "$patch_path" >&2
  exit 1
fi

if [[ "$desktop_ui_source_mode" == "compiled" ]]; then
  npm run ui:build
else
  node ui/build.mjs --desktop-runtime
fi
uv run python "$repo_root/build_assets.py"

if [[ "$desktop_ui_source_mode" != "compiled" && "$desktop_ui_source_mode" != "dev-server" ]]; then
  printf 'Unsupported COSIMO_DESKTOP_UI_SOURCE_MODE value: %s\n' "$desktop_ui_source_mode" >&2
  exit 1
fi

if [[ "$desktop_ui_source_mode" == "dev-server" ]]; then
  if ! curl --fail --silent --show-error "$desktop_dev_server_status_url" >/dev/null; then
    printf 'Desktop Vite dev server status is not reachable at %s\n' "$desktop_dev_server_status_url" >&2
    exit 1
  fi

  if ! curl --fail --silent --show-error "$desktop_dev_server_module_url" >/dev/null; then
    printf 'Desktop Vite dev server entry module is not reachable at %s\n' "$desktop_dev_server_module_url" >&2
    exit 1
  fi
fi

mkdir -p "$cache_root"

if [[ -f "$build_dir/CMakeCache.txt" ]]; then
  cached_source_dir="$(awk -F= '/^CMAKE_HOME_DIRECTORY:INTERNAL=/{print $2; exit}' "$build_dir/CMakeCache.txt")"

  if [[ -n "$cached_source_dir" && "$cached_source_dir" != "$repo_root/tools/desktop_native" ]]; then
    rm -rf "$build_dir"
  fi
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

cmake -S "$repo_root/tools/desktop_native" \
      -B "$build_dir" \
      -DCMAKE_BUILD_TYPE=Release \
      -DCOSIMO_PATCH_PATH="$patch_path" \
      -DCOSIMO_DESKTOP_UI_SOURCE_MODE="$desktop_ui_source_mode" \
      -DCOSIMO_DESKTOP_DEV_SERVER_ORIGIN="$desktop_dev_server_origin" \
      -DCMAJOR_SOURCE_PATH="$cmajor_source_path" \
      -DJUCE_PATH="$juce_path"

cmake --build "$build_dir" --config Release

au_built="$build_dir/CosimoDesktopNative_artefacts/Release/AU/CosimoDesktopNative.component"
standalone_built="$build_dir/CosimoDesktopNative_artefacts/Release/Standalone/CosimoDesktopNative.app"

if [[ ! -d "$au_built" ]]; then
  printf 'Built AU bundle not found: %s\n' "$au_built" >&2
  exit 1
fi

if [[ ! -d "$standalone_built" ]]; then
  printf 'Built standalone app not found: %s\n' "$standalone_built" >&2
  exit 1
fi

rm -rf "$au_bundle"
cp -R "$au_built" "$au_bundle"

mkdir -p "$au_bundle/Contents/Resources"
cp "$runtime_dylib" "$au_bundle/Contents/Resources/libCmajPerformer.dylib"

mkdir -p "$standalone_built/Contents/Resources"
cp "$runtime_dylib" "$standalone_built/Contents/Resources/libCmajPerformer.dylib"

codesign --force --deep --sign - "$au_bundle" >/dev/null
codesign --force --deep --sign - "$standalone_built" >/dev/null

printf 'Installed %s\n' "$au_bundle"
printf 'Bundled standalone runtime into %s\n' "$standalone_built"
printf 'Bundled %s\n' "$runtime_dylib"
printf 'Using patch %s\n' "$patch_path"
