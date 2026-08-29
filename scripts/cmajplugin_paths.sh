#!/usr/bin/env bash

cmajplugin_vst3_bundle_path() {
  local build_dir="$1"
  printf '%s/cmajplugin/CmajPlugin_artefacts/Release/VST3/CmajPlugin.vst3\n' "$build_dir"
}
