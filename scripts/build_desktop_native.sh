#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="$repo_root/build/desktop_native"
runtime_build_dir="$repo_root/build/cmajor_runtime"
runtime_dylib="$runtime_build_dir/lib/libCmajPerformer.dylib"
patch_path="$repo_root/WavetableSynth.cmajorpatch"
desktop_ui_source_mode="${COSIMO_DESKTOP_UI_SOURCE_MODE:-compiled}"
desktop_dev_server_origin="${COSIMO_DESKTOP_DEV_SERVER_ORIGIN:-http://127.0.0.1:5174}"
desktop_dev_server_module_url="${desktop_dev_server_origin%/}/patch_gui/desktop/index.js"
desktop_dev_server_status_url="${desktop_dev_server_origin%/}/__cosimo-dev-status"

au_install_dir="$HOME/Library/Audio/Plug-Ins/Components"
vst3_install_dir="$HOME/Library/Audio/Plug-Ins/VST3"

au_bundle="$au_install_dir/CosimoDesktopNative.component"
vst3_bundle="$vst3_install_dir/CosimoDesktopNative.vst3"

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

cmake -S "$repo_root/tools/cmajor_runtime_build" \
      -B "$runtime_build_dir" \
      -DCMAKE_BUILD_TYPE=Release
cmake --build "$runtime_build_dir" \
      --config Release \
      --target CmajPerformer \
      --parallel "${CMAKE_BUILD_PARALLEL_LEVEL:-8}"

if [[ ! -f "$runtime_dylib" ]]; then
  printf 'Built Cmajor runtime not found: %s\n' "$runtime_dylib" >&2
  exit 1
fi

mkdir -p "$build_dir" "$au_install_dir" "$vst3_install_dir"

cmake -S "$repo_root/tools/desktop_native" \
      -B "$build_dir" \
      -DCMAKE_BUILD_TYPE=Release \
      -DCOSIMO_PATCH_PATH="$patch_path" \
      -DCOSIMO_DESKTOP_UI_SOURCE_MODE="$desktop_ui_source_mode" \
      -DCOSIMO_DESKTOP_DEV_SERVER_ORIGIN="$desktop_dev_server_origin"

cmake --build "$build_dir" --config Release

au_built="$build_dir/CosimoDesktopNative_artefacts/Release/AU/CosimoDesktopNative.component"
vst3_built="$build_dir/CosimoDesktopNative_artefacts/Release/VST3/CosimoDesktopNative.vst3"
standalone_built="$build_dir/CosimoDesktopNative_artefacts/Release/Standalone/CosimoDesktopNative.app"

if [[ ! -d "$au_built" ]]; then
  printf 'Built AU bundle not found: %s\n' "$au_built" >&2
  exit 1
fi

if [[ ! -d "$vst3_built" ]]; then
  printf 'Built VST3 bundle not found: %s\n' "$vst3_built" >&2
  exit 1
fi

if [[ ! -d "$standalone_built" ]]; then
  printf 'Built standalone app not found: %s\n' "$standalone_built" >&2
  exit 1
fi

rm -rf "$au_bundle"
cp -R "$au_built" "$au_bundle"

rm -rf "$vst3_bundle"
cp -R "$vst3_built" "$vst3_bundle"

mkdir -p "$au_bundle/Contents/Resources"
cp "$runtime_dylib" "$au_bundle/Contents/Resources/libCmajPerformer.dylib"

mkdir -p "$vst3_bundle/Contents/Resources"
cp "$runtime_dylib" "$vst3_bundle/Contents/Resources/libCmajPerformer.dylib"

mkdir -p "$standalone_built/Contents/Resources"
cp "$runtime_dylib" "$standalone_built/Contents/Resources/libCmajPerformer.dylib"

codesign --force --deep --sign - "$au_bundle" >/dev/null
codesign --force --deep --sign - "$vst3_bundle" >/dev/null
codesign --force --deep --sign - "$standalone_built" >/dev/null

printf 'Installed %s\n' "$au_bundle"
printf 'Installed %s\n' "$vst3_bundle"
printf 'Bundled standalone runtime into %s\n' "$standalone_built"
printf 'Bundled %s\n' "$runtime_dylib"
printf 'Using patch %s\n' "$patch_path"
