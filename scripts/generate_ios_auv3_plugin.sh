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

uv run python "$repo_root/build_assets.py"

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

       #if CHOC_IOS
        if (options->transparentBackground)
        {
            auto black = callClass<id> ("UIColor", "blackColor");
            call<void> (webview, "setOpaque:", (BOOL) 0);
            call<void> (webview, "setBackgroundColor:", black);

            if (auto scrollView = call<id> (webview, "scrollView"))
                call<void> (scrollView, "setBackgroundColor:", black);
        }
       #endif
"""

if needle not in text:
    raise SystemExit(f"Could not find the expected WebView background snippet in {path}")

path.write_text(text.replace(needle, replacement, 1), encoding="utf-8")
PY
fi

python3 - "$temp_dir" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
targets = [
    root / "include/cmajor/helpers/cmaj_EmbeddedWebAssets.h",
    root / "cmajor_plugin.cpp",
]

old_width = '            width:  view.clientHeight - parseFloat (clientStyle.paddingTop)  - parseFloat (clientStyle.paddingBottom),\\n'
new_width = '            width:  view.clientWidth  - parseFloat (clientStyle.paddingLeft) - parseFloat (clientStyle.paddingRight),\\n'
old_height = '            height: view.clientWidth  - parseFloat (clientStyle.paddingLeft) - parseFloat (clientStyle.paddingRight)\\n'
new_height = '            height: view.clientHeight - parseFloat (clientStyle.paddingTop)  - parseFloat (clientStyle.paddingBottom)\\n'

for path in targets:
    if not path.is_file():
        continue

    text = path.read_text(encoding="utf-8")

    if old_width not in text or old_height not in text:
        raise SystemExit(f"Could not find the expected patch scaling snippet in {path}")

    text = text.replace(old_width, new_width, 1)
    text = text.replace(old_height, new_height, 1)
    path.write_text(text, encoding="utf-8")
PY

python3 - "$temp_dir/include/cmajor/helpers/cmaj_PatchWebView.h" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_header = '<meta charset="utf-8" />\n  <title>Cmajor Patch Controls</title>'
new_header = '<meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n  <title>Cmajor Patch Controls</title>'
old_style = """  * { box-sizing: border-box; padding: 0; margin: 0; border: 0; }
  html { background: black; overflow: hidden; }
  body { display: block; position: absolute; width: 100%; height: 100%; color: white; font-family: Monaco, Consolas, monospace; }
  #cmaj-view-container { display: block; position: relative; width: 100%; height: 100%; overflow: auto; }
"""

if old_header not in text and new_header not in text:
    raise SystemExit(f"Could not find the expected patch webview HTML header snippet in {path}")

text = text.replace(old_header, new_header, 1)

if old_style not in text:
    raise SystemExit(f"Could not find the expected patch webview style snippet in {path}")

path.write_text(text, encoding="utf-8")
PY

python3 - "$temp_dir/include/cmajor/helpers/cmaj_JUCEPlugin.h" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_child_bounds = """        void childBoundsChanged (Component*) override
        {
            if (! isResizing && patchWebViewHolder->isVisible())
                setSize (std::max (50, patchWebViewHolder->getWidth()),
                         std::max (50, patchWebViewHolder->getHeight() + DerivedType::extraCompHeight));
        }
"""
new_child_bounds = """        void childBoundsChanged (Component*) override
        {
            if (! isResizing && patchWebViewHolder->isVisible() && ! patchWebView->resizable)
                setSize (std::max (50, patchWebViewHolder->getWidth()),
                         std::max (50, patchWebViewHolder->getHeight() + DerivedType::extraCompHeight));
        }
"""

if old_child_bounds not in text and new_child_bounds not in text:
    raise SystemExit(f"Could not find the expected JUCE editor sizing snippet in {path}")

path.write_text(text.replace(old_child_bounds, new_child_bounds, 1), encoding="utf-8")
PY

rm -rf "$output_dir"
mv "$temp_dir" "$output_dir"

printf 'Generated self-contained iOS plug-in source at %s\n' "$output_dir"
