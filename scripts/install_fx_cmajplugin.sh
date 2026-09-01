#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
registry="$repo_root/fx/build-effect.mjs"
vst3_dir="$HOME/Library/Audio/Plug-Ins/VST3"
vst3_bundle="$vst3_dir/CmajPlugin.vst3"
vst3_binary="$vst3_bundle/Contents/MacOS/CmajPlugin"
patch_json="$vst3_dir/CmajPlugin.json"

if ! command -v node >/dev/null 2>&1; then
  printf 'node was not found on PATH.\n' >&2
  exit 1
fi

usage() {
  printf 'Usage: npm run fx:jit:install -- <plugin> [--dry-run]\n\nAvailable plugins:\n'
  node "$registry" --targets | while IFS= read -r target_name; do
    printf '  %s\n' "$target_name"
  done
}

jit_plan_field() {
  printf '%s' "$jit_plan" | node -pe 'JSON.parse(require("node:fs").readFileSync(0, "utf8"))[process.argv[1]]' "$1"
}

validate_patched_cmajplugin() {
  if [[ ! -f "$vst3_binary" ]]; then
    printf 'CmajPlugin binary not found: %s\n' "$vst3_binary" >&2
    exit 1
  fi

  if ! node "$repo_root/scripts/check_choc_markers.mjs" "$vst3_binary"; then
    printf 'Installed CmajPlugin.vst3 failed the patched CHOC WebView marker check: %s\n' "$vst3_bundle" >&2
    printf 'Run npm run cmajplugin:build and npm run cmajplugin:install first.\n' >&2
    exit 1
  fi

  if ! codesign --verify --deep --strict --verbose=4 "$vst3_bundle" >/dev/null 2>&1; then
    printf 'Installed CmajPlugin.vst3 does not pass code-signature verification: %s\n' "$vst3_bundle" >&2
    exit 1
  fi
}

plugin="${1:-}"
if [[ -z "$plugin" ]]; then
  usage >&2
  exit 1
fi

if [[ "$plugin" == "--help" || "$plugin" == "-h" ]]; then
  usage
  exit 0
fi

shift

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

# Keep the registry's own diagnostics: an unknown plugin name and a genuine
# discovery failure (e.g. a malformed sidecar) print different errors.
jit_plan_errors="$(mktemp "${TMPDIR:-/tmp}/cosimo-jit-plan.XXXXXX")"
if ! jit_plan="$(node "$registry" --jit-plan "$plugin" 2>"$jit_plan_errors")"; then
  cat "$jit_plan_errors" >&2
  rm -f "$jit_plan_errors"
  exit 1
fi
rm -f "$jit_plan_errors"

patch_rel="$(jit_plan_field patch)"
runtime_patch_rel="$(jit_plan_field runtimePatch)"
requires_runtime_build="$(jit_plan_field jitInstallRuntime)"
patch_path="$repo_root/$patch_rel"

if ! command -v cmaj >/dev/null 2>&1; then
  printf 'cmaj was not found on PATH.\n' >&2
  exit 1
fi

if [[ ! -f "$patch_path" ]]; then
  printf 'Patch file not found: %s\n' "$patch_path" >&2
  exit 1
fi

if [[ ! -d "$vst3_bundle" ]]; then
  printf 'CmajPlugin.vst3 is not installed at: %s\n' "$vst3_bundle" >&2
  exit 1
fi

validate_patched_cmajplugin

view_src="$(node -e 'const fs = require("node:fs"); const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); console.log(manifest.view?.src ?? "");' "$patch_path")"
dev_module="$(node -e 'const fs = require("node:fs"); const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); console.log(manifest.view?.devModule ?? "");' "$patch_path")"

if [[ "$view_src" != "view/index.js" ]]; then
  printf '%s must set view.src to "view/index.js"; found "%s".\n' "$patch_rel" "$view_src" >&2
  exit 1
fi

if [[ -z "$dev_module" ]]; then
  printf '%s must declare view.devModule for Vite development.\n' "$patch_rel" >&2
  exit 1
fi

dev_module_rel="${dev_module#/}"
if [[ ! -f "$repo_root/$dev_module_rel" ]]; then
  printf 'view.devModule points to a missing file: %s\n' "$dev_module" >&2
  exit 1
fi

if [[ "$requires_runtime_build" == "true" ]]; then
  node "$registry" "$plugin" >/dev/null

  patch_rel="$runtime_patch_rel"
  patch_path="$repo_root/$patch_rel"

  if [[ ! -f "$patch_path" ]]; then
    printf 'Built runtime patch was not found: %s\n' "$patch_path" >&2
    exit 1
  fi
fi

cmaj play --dry-run --stop-on-error "$patch_path" >/dev/null

if [[ "$dry_run" == true ]]; then
  printf 'Validated patch: %s\n' "$patch_path"
  printf 'Validated patched installed VST3: %s\n' "$vst3_bundle"
  printf 'Validated view.src: %s\n' "$view_src"
  printf 'Validated view.devModule: %s\n' "$dev_module"
  printf 'Would write patch association: %s\n' "$patch_json"
  printf 'Would point CmajPlugin.vst3 at: %s\n' "$patch_path"
  exit 0
fi

mkdir -p "$vst3_dir"
node -e 'const fs = require("node:fs"); fs.writeFileSync(process.argv[2], JSON.stringify({ location: process.argv[1] }, null, 2) + "\n");' "$patch_path" "$patch_json"

printf 'Validated patch: %s\n' "$patch_path"
printf 'Validated patched installed VST3: %s\n' "$vst3_bundle"
printf 'Wrote patch association: %s\n' "$patch_json"
printf 'CmajPlugin.vst3 will load: %s\n' "$patch_path"
printf 'Start the shared effects dev server separately with: npm run fx:dev\n'
