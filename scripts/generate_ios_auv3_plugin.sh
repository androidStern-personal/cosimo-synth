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

stage_dir="$temp_dir/staging"
generated_dir="$temp_dir/generated"
codegen_patch_path="$stage_dir/$(basename "$patch_path")"

mkdir -p "$stage_dir"
mkdir -p "$generated_dir"
cp -R "$repo_root/cmajor" "$stage_dir/cmajor"
cp -R "$repo_root/patch_gui" "$stage_dir/patch_gui"
cp "$patch_path" "$codegen_patch_path"

cmaj generate --target=juce "$codegen_patch_path" --output="$generated_dir"

objective_c_helpers_header="$generated_dir/include/choc/choc/platform/choc_ObjectiveCHelpers.h"

if [[ -f "$objective_c_helpers_header" ]]; then
  python3 - "$objective_c_helpers_header" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
needle = """    struct CGPoint { CGFloat x = 0, y = 0; };
    struct CGSize  { CGFloat width = 0, height = 0; };
    struct CGRect  { CGPoint origin; CGSize size; };
"""
replacement = """    struct CGPoint { CGFloat x = 0, y = 0; };
    struct CGSize  { CGFloat width = 0, height = 0; };
    struct CGRect  { CGPoint origin; CGSize size; };
    struct UIEdgeInsets { CGFloat top = 0, left = 0, bottom = 0, right = 0; };
"""

if needle not in text and replacement not in text:
    raise SystemExit(f"Could not find the expected Objective-C geometry helper snippet in {path}")

path.write_text(text.replace(needle, replacement, 1), encoding="utf-8")
PY
fi

webview_header="$generated_dir/include/choc/choc/gui/choc_WebView.h"

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
        if (auto scrollView = call<id> (webview, "scrollView"))
        {
            // Let the patch UI handle the safe area itself instead of shrinking the HTML viewport.
            call<void> (scrollView, "setContentInsetAdjustmentBehavior:", 2);
            call<void> (scrollView, "setAutomaticallyAdjustsScrollIndicatorInsets:", (BOOL) 0);
        }

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

text = text.replace(needle, replacement, 1)

safe_area_needle = """            class_addMethod (webviewClass, sel_registerName ("performKeyEquivalent:"),
                            (IMP) (+[](id self, SEL, id e) -> BOOL
                            {
                                if (auto p = getPimpl (self))
                                    if (p->performKeyEquivalent (self, e))
                                        return true;

                                return choc::objc::callSuper<BOOL> (self, "performKeyEquivalent:", e);
                            }), "B@:@");

            objc_registerClassPair (webviewClass);
"""
safe_area_replacement = """            class_addMethod (webviewClass, sel_registerName ("performKeyEquivalent:"),
                            (IMP) (+[](id self, SEL, id e) -> BOOL
                            {
                                if (auto p = getPimpl (self))
                                    if (p->performKeyEquivalent (self, e))
                                        return true;

                                return choc::objc::callSuper<BOOL> (self, "performKeyEquivalent:", e);
                            }), "B@:@");

           #if CHOC_IOS
            class_addMethod (webviewClass, sel_registerName ("safeAreaInsets"),
                            (IMP) (+[](id, SEL) -> choc::objc::UIEdgeInsets
                            {
                                return {};
                            }), "{UIEdgeInsets=dddd}@:");
           #endif

            objc_registerClassPair (webviewClass);
"""

if safe_area_needle not in text and safe_area_replacement not in text:
    raise SystemExit(f"Could not find the expected WebView subclass snippet in {path}")

path.write_text(text.replace(safe_area_needle, safe_area_replacement, 1), encoding="utf-8")
PY
fi

python3 - "$generated_dir" <<'PY'
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

python3 - "$generated_dir/include/cmajor/helpers/cmaj_PatchWebView.h" <<'PY'
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

old_cpp_status_message = """inline void PatchWebView::setStatusMessage (const std::string& newMessage)
{
    getWebView().evaluateJavascript ("window.setStatusMessage (" + choc::json::getEscapedQuotedString (newMessage) + ")");
}
"""
new_cpp_status_message = """inline void PatchWebView::setStatusMessage (const std::string& newMessage)
{
    getWebView().evaluateJavascript ("if (typeof window.setStatusMessage === 'function') window.setStatusMessage (" + choc::json::getEscapedQuotedString (newMessage) + ")");
}
"""
old_js_status_message = """window.setStatusMessage = (newMessage) =>
{
    isViewActive = false;
    container.innerHTML = `<pre id="cmaj-error-text">${newMessage}</pre>`;
};
"""
new_js_status_message = """window.setStatusMessage = (newMessage) =>
{
    const messageText = typeof newMessage === "string" ? newMessage : String (newMessage ?? "");
    const isErrorLike = /(^|\\b)(error|failed|could not)\\b/i.test (messageText)
        || /no view available/i.test (messageText);

    if (! isErrorLike)
        return;

    isViewActive = false;
    container.innerHTML = `<pre id="cmaj-error-text">${messageText}</pre>`;
};
"""
old_view_bindings = """        bool boundOK = w.bind ("cmaj_sendMessageToServer", [this] (const choc::value::ValueView& args) -> choc::value::Value
        {
            try
            {
                if (args.isArray() && args.size() != 0)
                    patch.handleClientMessage (*this, args[0]);
            }
            catch (const std::exception& e)
            {
                std::cout << "Error processing message from client: " << e.what() << std::endl;
            }

            return {};
        });

        (void) boundOK;
        CMAJ_ASSERT (boundOK);
"""
new_view_bindings = """        const auto normaliseResourcePath = [] (std::string pathText)
        {
            if (auto schemePos = pathText.find ("://"); schemePos != std::string::npos)
                if (auto pathPos = pathText.find ('/', schemePos + 3); pathPos != std::string::npos)
                    pathText = pathText.substr (pathPos);
                else
                    pathText.clear();

            while (! pathText.empty() && pathText.front() == '/')
                pathText.erase (pathText.begin());

            return pathText;
        };

        bool boundOK = w.bind ("cmaj_sendMessageToServer", [this] (const choc::value::ValueView& args) -> choc::value::Value
        {
            try
            {
                if (args.isArray() && args.size() != 0)
                    patch.handleClientMessage (*this, args[0]);
            }
            catch (const std::exception& e)
            {
                std::cout << "Error processing message from client: " << e.what() << std::endl;
            }

            return {};
        });

        boundOK = boundOK && w.bind ("_internalReadResource", [this, normaliseResourcePath] (const choc::value::ValueView& args) -> choc::value::Value
        {
            try
            {
                if (args.isArray() && args.size() != 0)
                    if (auto manifest = patch.getManifest())
                        if (auto content = manifest->readFileContent (normaliseResourcePath (args[0].toString())))
                            return choc::value::createArray (static_cast<uint32_t> (content->length()),
                                                             [&] (uint32_t i) { return static_cast<int32_t> ((*content)[i]); });
            }
            catch (...)
            {}

            return {};
        });

        boundOK = boundOK && w.bind ("_internalReadResourceAsAudioData", [this, normaliseResourcePath] (const choc::value::ValueView& args) -> choc::value::Value
        {
            try
            {
                if (args.isArray() && args.size() != 0)
                {
                    const auto path = normaliseResourcePath (args[0].toString());

                    if (! path.empty())
                    {
                        choc::value::Value annotation;

                        if (args.size() > 1)
                            annotation = args[1];

                        if (auto manifest = patch.getManifest())
                            return readManifestResourceAsAudioData (*manifest, path, annotation);
                    }
                }
            }
            catch (...)
            {}

            return {};
        });

        (void) boundOK;
        CMAJ_ASSERT (boundOK);
"""
old_embedded_connection = """class EmbeddedPatchConnection  extends PatchConnection
{
    constructor()
    {
        super();
        this.manifest = patchManifest;
        window.cmaj_deliverMessageFromServer = msg => this.deliverMessageFromServer (msg);
    }

    getResourceAddress (path)
    {
        return path.startsWith ("/") ? path : ("/" + path);
    }

    sendMessageToServer (message)
    {
        window.cmaj_sendMessageToServer (message);
    }
}
"""
new_embedded_connection = """class EmbeddedPatchConnection  extends PatchConnection
{
    constructor()
    {
        super();
        this.manifest = patchManifest;
        this.prefersResourceReadBridge = true;
        window.cmaj_deliverMessageFromServer = msg => this.deliverMessageFromServer (msg);
    }

    getResourceAddress (path)
    {
        return path.startsWith ("/") ? path : ("/" + path);
    }

    async readResource (path)
    {
        return _internalReadResource (path);
    }

    async readResourceAsAudioData (path)
    {
        return _internalReadResourceAsAudioData (path);
    }

    sendMessageToServer (message)
    {
        window.cmaj_sendMessageToServer (message);
    }
}
"""

for old, new, label in [
    (old_cpp_status_message, new_cpp_status_message, "PatchWebView::setStatusMessage"),
    (old_js_status_message, new_js_status_message, "window.setStatusMessage"),
    (old_view_bindings, new_view_bindings, "PatchWebView resource bindings"),
    (old_embedded_connection, new_embedded_connection, "EmbeddedPatchConnection resource bridge"),
]:
    if old not in text and new not in text:
        raise SystemExit(f"Could not find the expected {label} snippet in {path}")

    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
PY

python3 - "$generated_dir/include/cmajor/helpers/cmaj_PatchWebView.h" "$generated_dir/include/cmajor/helpers/cmaj_PatchWorker_WebView.h" <<'PY'
from pathlib import Path
import sys


def patch_view_header(path: Path) -> None:
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    old = """    const auto toMimeType = [this] (const auto& extension)
    {
        if (getMIMETypeForExtension)
            if (auto m = getMIMETypeForExtension (extension); ! m.empty())
                return m;

        return choc::network::getMIMETypeFromFilename (extension, "application/octet-stream");
    };
"""
    new = """    const auto toMimeType = [this] (const auto& extension)
    {
        if (extension == ".mjs" || extension == "mjs")
            return std::string ("text/javascript");

        if (extension == ".json" || extension == "json")
            return std::string ("application/json");

        if (getMIMETypeForExtension)
            if (auto m = getMIMETypeForExtension (extension); ! m.empty())
                return m;

        return choc::network::getMIMETypeFromFilename (extension, "application/octet-stream");
    };
"""

    if old not in text and new not in text:
        raise SystemExit(f"Could not find the expected PatchWebView MIME mapping snippet in {path}")

    text = text.replace(old, new, 1)

    old_relative_path = """    auto relativePath = std::filesystem::path (path).relative_path();
"""
    new_relative_path = """    const auto normaliseRequestPath = [] (std::string requestPath)
    {
        if (auto schemePos = requestPath.find ("://"); schemePos != std::string::npos)
            if (auto pathPos = requestPath.find ('/', schemePos + 3); pathPos != std::string::npos)
                requestPath = requestPath.substr (pathPos);
            else
                requestPath = "/";

        while (! requestPath.empty() && requestPath.front() == '/')
            requestPath.erase (requestPath.begin());

        return requestPath;
    };

    const auto normalisedPath = normaliseRequestPath (path);
    const auto requestPathForLookup = normalisedPath.empty() ? std::string ("/") : ("/" + normalisedPath);
    auto relativePath = std::filesystem::path (normalisedPath).relative_path();
"""

    if old_relative_path not in text and new_relative_path not in text:
        raise SystemExit(f"Could not find the expected PatchWebView relative-path snippet in {path}")

    text = text.replace(old_relative_path, new_relative_path, 1)

    old_read_javascript = """    if (auto content = readJavascriptResource (path, patch.getManifest()))
"""
    new_read_javascript = """    if (auto content = readJavascriptResource (requestPathForLookup, patch.getManifest()))
"""

    if old_read_javascript not in text and new_read_javascript not in text:
        raise SystemExit(f"Could not find the expected PatchWebView javascript-resource snippet in {path}")

    text = text.replace(old_read_javascript, new_read_javascript, 1)

    old_resource_fallback = """    if (auto content = readJavascriptResource (requestPathForLookup, patch.getManifest()))
        if (! content->empty())
            return choc::ui::WebView::Options::Resource (*content, toMimeType (relativePath.extension().string()));

    return {};
}
"""
    new_resource_fallback = """    if (auto content = readJavascriptResource (path, patch.getManifest()))
        if (! content->empty())
            return choc::ui::WebView::Options::Resource (*content, toMimeType (relativePath.extension().string()));

    if (auto manifest = patch.getManifest())
        if (auto content = manifest->readFileContent (relativePath.generic_string()))
            return choc::ui::WebView::Options::Resource (*content, toMimeType (relativePath.extension().string()));

    return {};
}
"""

    if old_resource_fallback not in text and new_resource_fallback not in text:
        raise SystemExit(f"Could not find the expected PatchWebView resource fallback snippet in {path}")

    path.write_text(text.replace(old_resource_fallback, new_resource_fallback, 1), encoding="utf-8")


def patch_worker_header(path: Path) -> None:
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    old_audio_binding = """                w.bind ("_internalReadResourceAsAudioData", [&p] (const choc::value::ValueView& args) -> choc::value::Value
                {
                    try
                    {
                        if (args.isArray() && args.size() != 0)
                        {
                            if (auto path = args[0].toString(); ! path.empty())
                            {
                                choc::value::Value annotation;

                                if (args.size() > 1)
                                    annotation = args[1];

                                if (auto manifest = p.getManifest())
                                    return readManifestResourceAsAudioData (*manifest, path, annotation);
                            }
                        }
                    }
                    catch (...)
                    {}

                    return {};
                });
"""
    new_audio_binding = """                w.bind ("_internalReadResource", [&p] (const choc::value::ValueView& args) -> choc::value::Value
                {
                    try
                    {
                        if (args.isArray() && args.size() != 0)
                        {
                            auto path = args[0].toString();

                            if (auto schemePos = path.find ("://"); schemePos != std::string::npos)
                                if (auto pathPos = path.find ('/', schemePos + 3); pathPos != std::string::npos)
                                    path = path.substr (pathPos);
                                else
                                    path.clear();

                            while (! path.empty() && path.front() == '/')
                                path.erase (path.begin());

                            if (auto manifest = p.getManifest())
                                if (auto content = manifest->readFileContent (path))
                                    return choc::value::createArray (static_cast<uint32_t> (content->length()),
                                                                     [&] (uint32_t i) { return static_cast<int32_t> ((*content)[i]); });
                        }
                    }
                    catch (...)
                    {}

                    return {};
                });

                w.bind ("_internalReadResourceAsAudioData", [&p] (const choc::value::ValueView& args) -> choc::value::Value
                {
                    try
                    {
                        if (args.isArray() && args.size() != 0)
                        {
                            if (auto path = args[0].toString(); ! path.empty())
                            {
                                if (auto schemePos = path.find ("://"); schemePos != std::string::npos)
                                    if (auto pathPos = path.find ('/', schemePos + 3); pathPos != std::string::npos)
                                        path = path.substr (pathPos);
                                    else
                                        path.clear();

                                while (! path.empty() && path.front() == '/')
                                    path.erase (path.begin());

                                choc::value::Value annotation;

                                if (args.size() > 1)
                                    annotation = args[1];

                                if (auto manifest = p.getManifest())
                                    return readManifestResourceAsAudioData (*manifest, path, annotation);
                            }
                        }
                    }
                    catch (...)
                    {}

                    return {};
                });
"""
    old_fetch_resource = """        std::optional<choc::ui::WebView::Options::Resource> fetchResource (const std::string& path)
        {
            if (auto manifest = patch.getManifest())
            {
                if (path == "/")
                    return choc::ui::WebView::Options::Resource (getHTML (*manifest), "text/html");

                if (auto moduleText = readJavascriptResource (path, manifest))
                    return choc::ui::WebView::Options::Resource (*moduleText, choc::network::getMIMETypeFromFilename (path, "application/octet-stream"));
            }

            return {};
        }
"""
    new_fetch_resource = """        std::optional<choc::ui::WebView::Options::Resource> fetchResource (const std::string& path)
        {
            const auto normaliseRequestPath = [] (std::string requestPath)
            {
                if (auto schemePos = requestPath.find ("://"); schemePos != std::string::npos)
                    if (auto pathPos = requestPath.find ('/', schemePos + 3); pathPos != std::string::npos)
                        requestPath = requestPath.substr (pathPos);
                    else
                        requestPath = "/";

                while (! requestPath.empty() && requestPath.front() == '/')
                    requestPath.erase (requestPath.begin());

                return requestPath;
            };

            const auto normalisedPath = normaliseRequestPath (path);
            const auto requestPathForLookup = normalisedPath.empty() ? std::string ("/") : ("/" + normalisedPath);
            const auto relativePath = std::filesystem::path (normalisedPath).relative_path();
            const auto toMimeType = [] (const auto& extension)
            {
                if (extension == ".mjs" || extension == "mjs")
                    return std::string ("text/javascript");

                if (extension == ".json" || extension == "json")
                    return std::string ("application/json");

                return choc::network::getMIMETypeFromFilename (extension, "application/octet-stream");
            };

            if (auto manifest = patch.getManifest())
            {
                if (normalisedPath.empty())
                    return choc::ui::WebView::Options::Resource (getHTML (*manifest), "text/html");

                if (auto moduleText = readJavascriptResource (requestPathForLookup, manifest))
                    return choc::ui::WebView::Options::Resource (*moduleText, toMimeType (relativePath.extension().string()));

                if (auto content = manifest->readFileContent (relativePath.generic_string()))
                    return choc::ui::WebView::Options::Resource (*content, toMimeType (relativePath.extension().string()));
            }

            return {};
        }
"""
    old_read_resource = """    async readResource (path)
    {
        return fetch (path);
    }
"""
    new_read_resource = """    async readResource (path)
    {
        return _internalReadResource (path);
    }
"""
    old_worker_connection = """class WorkerPatchConnection  extends PatchConnection
{
    constructor()
    {
        super();
        this.manifest = MANIFEST;
        window.currentView = this;
    }
"""
    new_worker_connection = """class WorkerPatchConnection  extends PatchConnection
{
    constructor()
    {
        super();
        this.manifest = MANIFEST;
        this.prefersResourceReadBridge = true;
        window.currentView = this;
    }
"""

    for old, new, label in [
        (old_audio_binding, new_audio_binding, "_internalReadResource binding"),
        (old_fetch_resource, new_fetch_resource, "fetchResource"),
        (old_read_resource, new_read_resource, "readResource"),
        (old_worker_connection, new_worker_connection, "WorkerPatchConnection resource bridge"),
    ]:
        if old not in text and new not in text:
            raise SystemExit(f"Could not find the expected PatchWorker {label} snippet in {path}")

        text = text.replace(old, new, 1)

    path.write_text(text, encoding="utf-8")


patch_view_header(Path(sys.argv[1]))
patch_worker_header(Path(sys.argv[2]))
PY

python3 - "$generated_dir/include/cmajor/helpers/cmaj_Patch.h" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_client_queue = "    static constexpr uint32_t clientEventQueueSize = 65536;\n"
new_client_queue = "    static constexpr uint32_t clientEventQueueSize = 8388608;\n"
old_performer_queue = "    static constexpr uint32_t performerEventQueueSize = 65536;\n"
new_performer_queue = "    static constexpr uint32_t performerEventQueueSize = 8388608;\n"

for old, new, label in [
    (old_client_queue, new_client_queue, "client event queue size"),
    (old_performer_queue, new_performer_queue, "performer event queue size"),
]:
    if old not in text and new not in text:
        raise SystemExit(f"Could not find the expected Patch {label} snippet in {path}")

    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
PY

python3 - "$generated_dir/include/cmajor/helpers/cmaj_JUCEPlugin.h" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_header_include = """#include <utility>
#include "../../choc/choc/memory/choc_xxHash.h"
"""
new_header_include = """#include <utility>
#include "CosimoSharedWavetableLibrary.h"
#include "../../choc/choc/memory/choc_xxHash.h"
"""
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
                         std::max (50, patchWebViewHolder->getHeight()));
        }
"""
old_status_message_changed = """        void statusMessageChanged()
        {
            owner.refreshExtraComp (extraComp.get());
            patchWebView->setStatusMessage (owner.statusMessage);
        }
"""
new_status_message_changed = """        void statusMessageChanged()
        {
            owner.refreshExtraComp (extraComp.get());
            patchWebView->setStatusMessage (owner.statusMessage);

            if (patchWebViewHolder->isVisible())
            {
                if (! isResizing && ! patchWebView->resizable)
                    childBoundsChanged (nullptr);
                else
                    resized();
            }
        }
"""
old_prepare_manifest = """    bool prepareManifest (Patch::LoadParams& loadParams, const juce::ValueTree& newState) override
    {
        loadParams.manifest.needsToBuildSource = false;

        loadParams.manifest.initialiseWithVirtualFile (std::string (PatchClass::filename),
            [] (const std::string& f) -> std::shared_ptr<std::istream>
            {
                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return std::make_shared<std::istringstream> (std::string (file.content), std::ios::binary);

                return {};
            },
            [] (const std::string& name) -> std::string { return name; },
            [] (const std::string&) -> std::filesystem::file_time_type { return {}; },
            [] (const std::string& f)
            {
                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return true;

                return false;
            });

        this->readParametersFromState (loadParams, newState);
        return true;
    }
"""
new_prepare_manifest = """    bool prepareManifest (Patch::LoadParams& loadParams, const juce::ValueTree& newState) override
    {
        loadParams.manifest.needsToBuildSource = false;

        const auto getRuntimeResourceFile = [] (const std::string& path) -> juce::File
        {
            if (auto managedFile = cosimo::ios::resolveManagedWavetableAssetFile (path); managedFile.existsAsFile())
                return managedFile;

            const auto relativePath = juce::String (path);
            const auto app = juce::File::getSpecialLocation (juce::File::currentApplicationFile);
            auto root = app.isDirectory() ? app : app.getParentDirectory();

            for (int depth = 0; depth < 4 && root.exists(); ++depth)
            {
                const auto direct = root.getChildFile (relativePath);

                if (direct.existsAsFile())
                    return direct;

                const auto flatResources = root.getChildFile ("Resources").getChildFile (relativePath);

                if (flatResources.existsAsFile())
                    return flatResources;

                const auto bundleResources = root.getChildFile ("Contents")
                                                  .getChildFile ("Resources")
                                                  .getChildFile (relativePath);

                if (bundleResources.existsAsFile())
                    return bundleResources;

                const auto parent = root.getParentDirectory();

                if (parent == root)
                    break;

                root = parent;
            }

            return {};
        };

        loadParams.manifest.initialiseWithVirtualFile (std::string (PatchClass::filename),
            [getRuntimeResourceFile] (const std::string& f) -> std::shared_ptr<std::istream>
            {
                if (f == PatchClass::filename)
                    if (auto bundledFile = getRuntimeResourceFile (f); bundledFile.existsAsFile())
                        return std::make_shared<std::ifstream> (bundledFile.getFullPathName().toStdString(), std::ios::binary | std::ios::in);

                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return std::make_shared<std::istringstream> (std::string (file.content), std::ios::binary);

                if (auto bundledFile = getRuntimeResourceFile (f); bundledFile.existsAsFile())
                    return std::make_shared<std::ifstream> (bundledFile.getFullPathName().toStdString(), std::ios::binary | std::ios::in);

                return {};
            },
            [getRuntimeResourceFile] (const std::string& name) -> std::string
            {
                if (name == PatchClass::filename)
                    if (auto bundledFile = getRuntimeResourceFile (name); bundledFile.existsAsFile())
                        return bundledFile.getFullPathName().toStdString();

                for (auto& file : PatchClass::files)
                    if (name == file.name)
                        return name;

                if (auto bundledFile = getRuntimeResourceFile (name); bundledFile.existsAsFile())
                    return bundledFile.getFullPathName().toStdString();

                return name;
            },
            [getRuntimeResourceFile] (const std::string& f) -> std::filesystem::file_time_type
            {
                if (f == PatchClass::filename)
                {
                    try
                    {
                        if (auto bundledFile = getRuntimeResourceFile (f); bundledFile.existsAsFile())
                            return std::filesystem::last_write_time (std::filesystem::path (bundledFile.getFullPathName().toStdString()));
                    }
                    catch (...) {}
                }

                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return {};

                try
                {
                    if (auto bundledFile = getRuntimeResourceFile (f); bundledFile.existsAsFile())
                        return std::filesystem::last_write_time (std::filesystem::path (bundledFile.getFullPathName().toStdString()));
                }
                catch (...) {}

                return {};
            },
            [getRuntimeResourceFile] (const std::string& f)
            {
                if (f == PatchClass::filename && getRuntimeResourceFile (f).existsAsFile())
                    return true;

                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return true;

                return getRuntimeResourceFile (f).existsAsFile();
            });

        this->readParametersFromState (loadParams, newState);
        return true;
    }
"""
old_ios_default_size = """            if (view.getWidth()  == 0)  view.view.setMember ("width", defaultWidth);
            if (view.getHeight() == 0)  view.view.setMember ("height", defaultHeight);

            return view;
"""
new_ios_default_size = """           #if JUCE_IOS
            if ((view.getWidth() == 0 || view.getHeight() == 0) && view.isResizable())
                if (auto* display = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay())
                {
                    const auto screenBounds = display->userArea.isEmpty() ? display->totalArea
                                                                          : display->userArea;

                    if (view.getWidth() == 0)
                        view.view.setMember ("width", std::max (50, screenBounds.getWidth()));

                    if (view.getHeight() == 0)
                        view.view.setMember ("height", std::max (50, screenBounds.getHeight()));
                }
           #endif

            if (view.getWidth()  == 0)  view.view.setMember ("width", defaultWidth);
            if (view.getHeight() == 0)  view.view.setMember ("height", defaultHeight);

            return view;
"""

if old_child_bounds not in text and new_child_bounds not in text:
    raise SystemExit(f"Could not find the expected JUCE editor sizing snippet in {path}")

if old_header_include not in text and new_header_include not in text:
    raise SystemExit(f"Could not find the expected JUCE plugin include block in {path}")

text = text.replace(old_header_include, new_header_include, 1)

text = text.replace(old_child_bounds, new_child_bounds, 1)

if old_prepare_manifest not in text and new_prepare_manifest not in text:
    raise SystemExit(f"Could not find the expected GeneratedPlugin prepareManifest snippet in {path}")

text = text.replace(old_prepare_manifest, new_prepare_manifest, 1)

if old_ios_default_size not in text and new_ios_default_size not in text:
    raise SystemExit(f"Could not find the expected JUCE iOS default editor size snippet in {path}")

text = text.replace(old_ios_default_size, new_ios_default_size, 1)
path.write_text(text, encoding="utf-8")
PY

python3 - "$generated_dir/include/cmajor/helpers/cmaj_JUCEPlugin.h" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_patch_members = """    std::shared_ptr<Patch> patch;
    std::string statusMessage;
    bool isStatusMessageError = false;
    bool dllLoadedSuccessfully = false;

protected:
"""
new_patch_members = """    std::shared_ptr<Patch> patch;
    std::string statusMessage;
    bool isStatusMessageError = false;
    bool dllLoadedSuccessfully = false;

protected:
    Patch& getPatchForDerived() const { return *patch; }
    virtual void patchLoadedFromState (const juce::ValueTree&) {}
    virtual void patchParameterValueDidChange (std::string_view, float) {}
"""
old_patch_load = "        patch->loadPatch (loadParams, DerivedType::isPrecompiled);\n"
new_patch_load = """        patch->loadPatch (loadParams, DerivedType::isPrecompiled);
        patchLoadedFromState (newState);
"""
old_parameter_ctor = """        Parameter (juce::String&& pID)
            : HostedAudioProcessorParameter (1),
              paramID (std::move (pID))
        {
        }
"""
new_parameter_ctor = """        Parameter (JUCEPluginBase& ownerToNotify, juce::String&& pID)
            : HostedAudioProcessorParameter (1),
              owner (ownerToNotify),
              paramID (std::move (pID))
        {
        }
"""
old_value_changed = """            patchParam->valueChanged = [this] (float v)
            {
                sendValueChangedMessageToListeners (patchParam->properties.convertTo0to1 (v));
            };
"""
new_value_changed = """            patchParam->valueChanged = [this] (float v)
            {
                sendValueChangedMessageToListeners (patchParam->properties.convertTo0to1 (v));
                owner.patchParameterValueDidChange (patchParam->properties.endpointID, v);
            };
"""
old_parameter_member = "        juce::String getParameterID() const override                { return paramID; }\n"
new_parameter_member = """        juce::String getParameterID() const override                { return paramID; }\n
        JUCEPluginBase& owner;
"""
old_parameter_set_value = "        void setValue (float newValue) override      { if (patchParam != nullptr) patchParam->setValue (patchParam->properties.convertFrom0to1 (newValue), false, -1, 0); }\n"
new_parameter_set_value = """        void setValue (float newValue) override
        {
            if (patchParam != nullptr)
            {
                const auto mappedValue = patchParam->properties.convertFrom0to1 (newValue);
                patchParam->setValue (mappedValue, false, -1, 0);
                owner.patchParameterValueDidChange (patchParam->properties.endpointID, mappedValue);
            }
        }
"""
old_parameter_allocation = '            auto p = std::make_unique<Parameter> ("P" + juce::String (parameters.size()));\n'
new_parameter_allocation = '            auto p = std::make_unique<Parameter> (*this, "P" + juce::String (parameters.size()));\n'
old_parameter_tree_allocation = '                    auto newParam = std::make_unique<Parameter> (param->properties.endpointID);\n'
new_parameter_tree_allocation = '                    auto newParam = std::make_unique<Parameter> (owner, param->properties.endpointID);\n'
old_parameter_tree_members = """                std::map<std::string, juce::AudioProcessorParameterGroup*> groups;
                juce::AudioProcessorParameterGroup tree;
            };

            ParameterTreeBuilder builder;
"""
new_parameter_tree_members = """                JUCEPluginBase& owner;
                std::map<std::string, juce::AudioProcessorParameterGroup*> groups;
                juce::AudioProcessorParameterGroup tree;
            };

            ParameterTreeBuilder builder { *this };
"""
old_status_message_block = """        void statusMessageChanged()
        {
            owner.refreshExtraComp (extraComp.get());
            patchWebView->setStatusMessage (owner.statusMessage);
        }

        static cmaj::PatchManifest::View derivePatchViewSize (const DerivedType& owner)
"""
new_status_message_block = """        void statusMessageChanged()
        {
            owner.refreshExtraComp (extraComp.get());
            patchWebView->setStatusMessage (owner.statusMessage);
        }

       #if JUCE_IOS
        void scheduleIOSLayoutMetricsDump (int remainingAttempts = 24)
        {
            auto safeThis = juce::Component::SafePointer<Editor> (this);

            juce::Timer::callAfterDelay (250, [safeThis, remainingAttempts]
            {
                if (safeThis != nullptr)
                    safeThis->dumpIOSLayoutMetrics (remainingAttempts);
            });
        }

        void dumpIOSLayoutMetrics (int remainingAttempts)
        {
            if (patchWebView == nullptr || patchWebViewHolder == nullptr || ! patchWebViewHolder->isShowing())
            {
                if (remainingAttempts > 0)
                    scheduleIOSLayoutMetricsDump (remainingAttempts - 1);

                return;
            }

            const auto displayBounds = []() -> juce::Rectangle<int>
            {
                if (auto* display = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay())
                    return display->userArea.isEmpty() ? display->totalArea : display->userArea;

                return {};
            }();

            auto safeThis = juce::Component::SafePointer<Editor> (this);

            struct NativeEdgeInsets
            {
                choc::objc::CGFloat top = 0;
                choc::objc::CGFloat left = 0;
                choc::objc::CGFloat bottom = 0;
                choc::objc::CGFloat right = 0;
            };

            const auto webViewHandle = reinterpret_cast<id> (safeThis->patchWebView->getWebView().getViewHandle());
            const auto webViewFrame = webViewHandle != nullptr
                ? choc::objc::call<choc::objc::CGRect> (webViewHandle, "frame")
                : choc::objc::CGRect {};
            const auto webViewSafeAreaInsets = webViewHandle != nullptr
                ? choc::objc::call<NativeEdgeInsets> (webViewHandle, "safeAreaInsets")
                : NativeEdgeInsets {};
            const auto scrollViewHandle = webViewHandle != nullptr
                ? choc::objc::call<id> (webViewHandle, "scrollView")
                : nullptr;
            const auto scrollViewFrame = scrollViewHandle != nullptr
                ? choc::objc::call<choc::objc::CGRect> (scrollViewHandle, "frame")
                : choc::objc::CGRect {};
            const auto scrollViewContentInset = scrollViewHandle != nullptr
                ? choc::objc::call<NativeEdgeInsets> (scrollViewHandle, "contentInset")
                : NativeEdgeInsets {};
            const auto scrollViewAdjustedContentInset = scrollViewHandle != nullptr
                ? choc::objc::call<NativeEdgeInsets> (scrollViewHandle, "adjustedContentInset")
                : NativeEdgeInsets {};
            const auto scrollViewContentInsetAdjustmentBehavior = scrollViewHandle != nullptr
                ? choc::objc::call<int> (scrollViewHandle, "contentInsetAdjustmentBehavior")
                : -1;

            patchWebView->getWebView().evaluateJavascript ("typeof window.__cosimoCollectLayoutMetrics === 'function' ? window.__cosimoCollectLayoutMetrics() : null",
                                                           [safeThis,
                                                            remainingAttempts,
                                                            displayBounds,
                                                            webViewFrame,
                                                            webViewSafeAreaInsets,
                                                            scrollViewFrame,
                                                            scrollViewContentInset,
                                                            scrollViewAdjustedContentInset,
                                                            scrollViewContentInsetAdjustmentBehavior] (const std::string& error,
                                                                                                      const choc::value::ValueView& result)
            {
                if (safeThis == nullptr)
                    return;

                const bool hasMetrics = ! result.isVoid() && result.isObject();
                const bool metricsReady = hasMetrics
                    && result.hasObjectMember ("isReady")
                    && result["isReady"].getWithDefault (false);
                std::string json = "{\\n";
                json += "  \\"native\\": {\\n";
                json += "    \\"displayWidth\\": " + std::to_string (displayBounds.getWidth()) + ",\\n";
                json += "    \\"displayHeight\\": " + std::to_string (displayBounds.getHeight()) + ",\\n";
                json += "    \\"editorWidth\\": " + std::to_string (safeThis->getWidth()) + ",\\n";
                json += "    \\"editorHeight\\": " + std::to_string (safeThis->getHeight()) + ",\\n";
                json += "    \\"holderWidth\\": " + std::to_string (safeThis->patchWebViewHolder != nullptr ? safeThis->patchWebViewHolder->getWidth() : 0) + ",\\n";
                json += "    \\"holderHeight\\": " + std::to_string (safeThis->patchWebViewHolder != nullptr ? safeThis->patchWebViewHolder->getHeight() : 0) + ",\\n";
                json += "    \\"holderX\\": " + std::to_string (safeThis->patchWebViewHolder != nullptr ? safeThis->patchWebViewHolder->getX() : 0) + ",\\n";
                json += "    \\"holderY\\": " + std::to_string (safeThis->patchWebViewHolder != nullptr ? safeThis->patchWebViewHolder->getY() : 0) + ",\\n";
                json += "    \\"webViewPreferredWidth\\": " + std::to_string ((int) safeThis->patchWebView->width) + ",\\n";
                json += "    \\"webViewPreferredHeight\\": " + std::to_string ((int) safeThis->patchWebView->height) + ",\\n";
                json += "    \\"webViewFrameHeight\\": " + std::to_string (webViewFrame.size.height) + ",\\n";
                json += "    \\"webViewSafeAreaTop\\": " + std::to_string (webViewSafeAreaInsets.top) + ",\\n";
                json += "    \\"webViewSafeAreaBottom\\": " + std::to_string (webViewSafeAreaInsets.bottom) + ",\\n";
                json += "    \\"scrollViewFrameHeight\\": " + std::to_string (scrollViewFrame.size.height) + ",\\n";
                json += "    \\"scrollViewContentInsetTop\\": " + std::to_string (scrollViewContentInset.top) + ",\\n";
                json += "    \\"scrollViewContentInsetBottom\\": " + std::to_string (scrollViewContentInset.bottom) + ",\\n";
                json += "    \\"scrollViewAdjustedInsetTop\\": " + std::to_string (scrollViewAdjustedContentInset.top) + ",\\n";
                json += "    \\"scrollViewAdjustedInsetBottom\\": " + std::to_string (scrollViewAdjustedContentInset.bottom) + ",\\n";
                json += "    \\"scrollViewInsetAdjustmentBehavior\\": " + std::to_string (scrollViewContentInsetAdjustmentBehavior) + "\\n";
                json += "  },\\n";
                json += "  \\"domMetrics\\": " + (hasMetrics ? choc::json::toString (result, true) : std::string ("null")) + ",\\n";
                json += "  \\"error\\": " + (error.empty() ? std::string ("null") : choc::json::getEscapedQuotedString (error)) + "\\n";
                json += "}\\n";

                const auto metricsFile = juce::File::getSpecialLocation (juce::File::userDocumentsDirectory)
                    .getChildFile ("ui-geometry.json");
                const bool shouldWriteSnapshot = metricsReady
                    || ! error.empty()
                    || remainingAttempts <= 0
                    || ! metricsFile.existsAsFile();

                if (shouldWriteSnapshot)
                    metricsFile.replaceWithText (juce::String::fromUTF8 (json.c_str()));

                if ((! hasMetrics || ! metricsReady) && remainingAttempts > 0)
                    safeThis->scheduleIOSLayoutMetricsDump (remainingAttempts - 1);
            });
        }
       #endif

       static cmaj::PatchManifest::View derivePatchViewSize (const DerivedType& owner)
"""
old_editor_setup_block = """            extraComp = owner.createExtraComponent();

            onPatchChanged (false);

            if (extraComp)
                addAndMakeVisible (*extraComp);

            statusMessageChanged();
"""
new_editor_setup_block = """            extraComp = owner.createExtraComponent();

            if (extraComp != nullptr)
                addChildComponent (*extraComp);

            onPatchChanged (false);
            statusMessageChanged();
"""
old_on_patch_changed_block = """        void onPatchChanged (bool forceReload = true)
        {
            if (owner.isViewVisible())
            {
                patchWebView->setActive (true);
                patchWebView->update (derivePatchViewSize (owner));
                patchWebViewHolder->setSize ((int) patchWebView->width, (int) patchWebView->height);

                setResizable (patchWebView->resizable, false);

                addAndMakeVisible (*patchWebViewHolder);
                childBoundsChanged (nullptr);
            }
            else
            {
                removeChildComponent (patchWebViewHolder.get());

                patchWebView->setActive (false);
                patchWebViewHolder->setVisible (false);

                setSize (defaultWidth, defaultHeight);
                setResizable (true, false);
            }

            if (forceReload)
                patchWebView->reload();
        }
"""
new_on_patch_changed_block = """        void onPatchChanged (bool forceReload = true)
        {
            owner.refreshExtraComp (extraComp.get());

            if (owner.isViewVisible())
            {
                patchWebView->setActive (true);
                patchWebView->update (derivePatchViewSize (owner));
                patchWebViewHolder->setSize ((int) patchWebView->width, (int) patchWebView->height);

                setResizable (patchWebView->resizable, false);

                addAndMakeVisible (*patchWebViewHolder);
                patchWebViewHolder->toFront (false);

                if (extraComp != nullptr)
                    extraComp->setVisible (false);

                if (! isResizing && ! patchWebView->resizable)
                    childBoundsChanged (nullptr);
                else
                    resized();

                if (forceReload)
                    patchWebView->reload();
            }
            else
            {
                removeChildComponent (patchWebViewHolder.get());

                patchWebView->setActive (false);
                patchWebViewHolder->setVisible (false);

                if (extraComp != nullptr)
                {
                    addAndMakeVisible (*extraComp);
                    extraComp->toFront (false);
                }

                setSize (defaultWidth, defaultHeight);
                setResizable (true, false);
                resized();
            }
        }
"""
old_resized_block = """        void resized() override
        {
            isResizing = true;
            juce::AudioProcessorEditor::resized();

            auto r = getLocalBounds();

            if (patchWebViewHolder->isVisible())
            {
                patchWebViewHolder->setBounds (r.removeFromTop (getHeight() - DerivedType::extraCompHeight));
                r.removeFromTop (4);

                if (getWidth() > 0 && getHeight() > 0)
                {
                    owner.lastEditorWidth = patchWebViewHolder->getWidth();
                    owner.lastEditorHeight = patchWebViewHolder->getHeight();
                }
            }

            if (extraComp)
                extraComp->setBounds (r);

            isResizing = false;
        }
"""
new_resized_block = """        void resized() override
        {
            isResizing = true;
            juce::AudioProcessorEditor::resized();

            auto r = getLocalBounds();

            if (patchWebViewHolder->isVisible())
            {
                patchWebViewHolder->setBounds (r);

                if (getWidth() > 0 && getHeight() > 0)
                {
                    owner.lastEditorWidth = patchWebViewHolder->getWidth();
                    owner.lastEditorHeight = patchWebViewHolder->getHeight();
                }

               #if JUCE_IOS
                scheduleIOSLayoutMetricsDump();
               #endif
            }

            if (extraComp != nullptr && extraComp->isVisible())
                extraComp->setBounds (getLocalBounds());

            isResizing = false;
        }
"""
old_generated_extra_component = """    using PatchClass = GeneratedInfoClass;
    using PerformerClass = typename PatchClass::PerformerClass;
    static constexpr bool isPrecompiled = true;
    static constexpr bool isFixedPatch = true;

    static constexpr int extraCompHeight = 0;
    static bool isViewVisible()  { return true; }
    std::unique_ptr<juce::Component> createExtraComponent() { return {}; }
    void refreshExtraComp (juce::Component*) {}
"""
new_generated_extra_component = """    using PatchClass = GeneratedInfoClass;
    using PerformerClass = typename PatchClass::PerformerClass;
    static constexpr bool isPrecompiled = true;
    static constexpr bool isFixedPatch = true;

    enum class SharedWavetableLibraryScreenMode
    {
        patchView,
        standaloneInstaller,
        extensionUnavailable,
    };

    SharedWavetableLibraryScreenMode getSharedWavetableLibraryScreenMode() const
    {
        if (cosimo::ios::inspectSharedWavetableLibrary().ready)
            return SharedWavetableLibraryScreenMode::patchView;

        if (this->wrapperType == juce::AudioProcessor::wrapperType_Standalone)
            return SharedWavetableLibraryScreenMode::standaloneInstaller;

        if (this->wrapperType == juce::AudioProcessor::wrapperType_AudioUnitv3)
            return SharedWavetableLibraryScreenMode::extensionUnavailable;

        return SharedWavetableLibraryScreenMode::patchView;
    }

    bool isViewVisible() const
    {
        return getSharedWavetableLibraryScreenMode() == SharedWavetableLibraryScreenMode::patchView;
    }

    std::unique_ptr<juce::Component> createExtraComponent()
    {
        if (this->wrapperType == juce::AudioProcessor::wrapperType_Standalone)
        {
            return cosimo::ios::createSharedWavetableLibraryComponent (cosimo::ios::SharedWavetableLibraryComponentMode::standaloneInstaller,
                                                                       {
                                                                           [this]
                                                                           {
                                                                               this->setNewStateAsync (this->getUpdatedState());
                                                                           }
                                                                       });
        }

        if (this->wrapperType == juce::AudioProcessor::wrapperType_AudioUnitv3)
            return cosimo::ios::createSharedWavetableLibraryComponent (cosimo::ios::SharedWavetableLibraryComponentMode::extensionUnavailable,
                                                                       {});

        return {};
    }

    void refreshExtraComp (juce::Component* c)
    {
        cosimo::ios::refreshSharedWavetableLibraryComponent (c);
    }
"""
old_loader_extra_component = """    static constexpr int extraCompHeight = 50;

    std::unique_ptr<ExtraEditorComponent> createExtraComponent()
    {
        return std::make_unique<ExtraEditorComponent> (*this);
    }

    void refreshExtraComp (juce::Component* c)
    {
        if (auto v = dynamic_cast<ExtraEditorComponent*> (c))
            v->refresh();
    }
"""
new_loader_extra_component = """    static constexpr int extraCompHeight = 50;

    int getExtraCompHeight() const
    {
        return extraCompHeight;
    }

    std::unique_ptr<ExtraEditorComponent> createExtraComponent()
    {
        return std::make_unique<ExtraEditorComponent> (*this);
    }

    void refreshExtraComp (juce::Component* c)
    {
        if (auto v = dynamic_cast<ExtraEditorComponent*> (c))
            v->refresh();
    }
"""
old_single_patch_extra_component = """    static constexpr int extraCompHeight = 0;
    static bool isViewVisible()  { return true; }
    std::unique_ptr<juce::Component> createExtraComponent() { return {}; }
    void refreshExtraComp (juce::Component*) {}
"""
new_single_patch_extra_component = """    static constexpr int extraCompHeight = 0;

    int getExtraCompHeight() const
    {
        return extraCompHeight;
    }

    static bool isViewVisible()  { return true; }
    std::unique_ptr<juce::Component> createExtraComponent() { return {}; }
    void refreshExtraComp (juce::Component*) {}
"""

for old, new, label in [
    (old_patch_members, new_patch_members, "patch members"),
    (old_patch_load, new_patch_load, "patch load"),
    (old_parameter_ctor, new_parameter_ctor, "parameter constructor"),
    (old_value_changed, new_value_changed, "parameter valueChanged"),
    (old_parameter_member, new_parameter_member, "parameter owner member"),
    (old_parameter_set_value, new_parameter_set_value, "parameter setValue"),
    (old_parameter_allocation, new_parameter_allocation, "parameter allocation"),
    (old_parameter_tree_allocation, new_parameter_tree_allocation, "parameter tree allocation"),
    (old_parameter_tree_members, new_parameter_tree_members, "parameter tree members"),
    (old_status_message_block, new_status_message_block, "iOS layout metrics exporter"),
    (old_editor_setup_block, new_editor_setup_block, "generated editor setup"),
    (old_on_patch_changed_block, new_on_patch_changed_block, "patch view screen switch"),
    (old_resized_block, new_resized_block, "iOS layout metrics trigger"),
    (old_generated_extra_component, new_generated_extra_component, "generated plugin extra component"),
    (old_loader_extra_component, new_loader_extra_component, "JIT loader extra component"),
    (old_single_patch_extra_component, new_single_patch_extra_component, "single patch extra component"),
]:
    if old not in text and new not in text:
        raise SystemExit(f"Could not find the expected JUCEPlugin {label} snippet in {path}")

    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
PY

python3 - "$generated_dir/cmajor_plugin.cpp" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old = """        \"    async readResource (path)\\n\"
        \"    {\\n\"
        \"        return fetch (path);\\n\"
        \"    }\\n\"
"""
new = """        \"    async readResource (path)\\n\"
        \"    {\\n\"
        \"        const resourceAddress = this.getResourceAddress (path);\\n\"
        \"\\n\"
        \"        if (resourceAddress instanceof URL)\\n\"
        \"            return fetch (resourceAddress.toString());\\n\"
        \"\\n\"
        \"        if (typeof resourceAddress === \\\"string\\\" && resourceAddress.length > 0)\\n\"
        \"        {\\n\"
        \"            try\\n\"
        \"            {\\n\"
        \"                return fetch (new URL (resourceAddress, this.rootResourcePath).toString());\\n\"
        \"            }\\n\"
        \"            catch (error)\\n\"
        \"            {\\n\"
        \"                return fetch (resourceAddress);\\n\"
        \"            }\\n\"
        \"        }\\n\"
        \"\\n\"
        \"        return fetch (path);\\n\"
        \"    }\\n\"
"""

if old not in text and new not in text:
    raise SystemExit(f"Could not find the expected PatchConnection readResource snippet in {path}")

path.write_text(text.replace(old, new, 1), encoding="utf-8")
PY

rm -rf "$output_dir"
mv "$generated_dir" "$output_dir"

printf 'Generated iOS plug-in source at %s\n' "$output_dir"
