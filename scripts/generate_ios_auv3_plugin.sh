#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
output_dir="${1:-$repo_root/build/ios_auv3/generated/cmajor}"
default_patch_path="$repo_root/WavetableSynth.iOS.cmajorpatch"

if [[ ! -f "$default_patch_path" ]]; then
  default_patch_path="$repo_root/WavetableSynth.cmajorpatch"
fi

patch_path="${2:-$default_patch_path}"
output_parent="$(dirname "$output_dir")"

mkdir -p "$output_parent"

resolved_output_parent="$(cd "$output_parent" && pwd -P)"
output_basename="$(basename "$output_dir")"

if [[ "$output_basename" == "." || "$output_basename" == ".." ]]; then
  resolved_output_dir="$(cd "$output_parent/$output_basename" && pwd -P)"
else
  resolved_output_dir="$resolved_output_parent/$output_basename"
fi

case "$resolved_output_dir" in
  ""|"/"|"$repo_root")
    printf 'Refusing to overwrite unsafe output directory: %s\n' "$resolved_output_dir" >&2
    exit 1
    ;;
esac

output_dir="$resolved_output_dir"

if ! command -v cmaj >/dev/null 2>&1; then
  printf 'cmaj is required to generate the AUv3 plug-in source.\n' >&2
  exit 1
fi

if [[ ! -f "$patch_path" ]]; then
  printf 'Patch file not found: %s\n' "$patch_path" >&2
  exit 1
fi

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/cosimo-ios-auv3.XXXXXX")"
cleanup() {
  rm -rf "$temp_dir"
}
trap cleanup EXIT

cmaj generate --target=juce "$patch_path" --output="$temp_dir"

webview_header="$temp_dir/include/choc/choc/gui/choc_WebView.h"

if [[ -f "$webview_header" ]]; then
  python3 - "$webview_header" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
needle = """        if (options->transparentBackground)
            call<void> (webview, "setValue:forKey:", getNSNumberBool (false), getNSString ("drawsBackground"));
"""
replacement = """       #if CHOC_OSX
        if (options->transparentBackground)
            call<void> (webview, "setValue:forKey:", getNSNumberBool (false), getNSString ("drawsBackground"));
       #endif
"""

if needle not in text:
    raise SystemExit(f"Could not find the expected WebView background snippet in {path}")

path.write_text(text.replace(needle, replacement, 1), encoding="utf-8")
PY
fi

rm -rf "$output_dir"
mv "$temp_dir" "$output_dir"

printf 'Generated self-contained iOS plug-in source at %s\n' "$output_dir"
