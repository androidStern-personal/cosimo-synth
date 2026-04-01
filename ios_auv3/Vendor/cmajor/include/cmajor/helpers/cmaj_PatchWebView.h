//
//     ,ad888ba,                              88
//    d8"'    "8b
//   d8            88,dba,,adba,   ,aPP8A.A8  88     The Cmajor Toolkit
//   Y8,           88    88    88  88     88  88
//    Y8a.   .a8P  88    88    88  88,   ,88  88     (C)2024 Cmajor Software Ltd
//     '"Y888Y"'   88    88    88  '"8bbP"Y8  88     https://cmajor.dev
//                                           ,88
//                                        888P"
//
//  The Cmajor project is subject to commercial or open-source licensing.
//  You may use it under the terms of the GPLv3 (see www.gnu.org/licenses), or
//  visit https://cmajor.dev to learn about our commercial licence options.
//
//  CMAJOR IS PROVIDED "AS IS" WITHOUT ANY WARRANTY, AND ALL WARRANTIES, WHETHER
//  EXPRESSED OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR PURPOSE, ARE
//  DISCLAIMED.

#pragma once

#include <cstdlib>
#include <memory>
#include "cmaj_Patch.h"
#include "../../choc/choc/gui/choc_WebView.h"
#include "../../choc/choc/network/choc_MIMETypes.h"

namespace cmaj
{

//==============================================================================
/// A HTML patch GUI implementation.
struct PatchWebView  : public PatchView
{
    PatchWebView (Patch&, const PatchManifest::View&);
    ~PatchWebView() override;

    void sendMessage (const choc::value::ValueView&) override;
    void reload();

    choc::ui::WebView& getWebView();

    void setStatusMessage (const std::string& newMessage);

    /// Provides a chunk of javascript that goes in a function which is run before the
    /// view element is added to its parent element.
    std::string extraSetupCode;

    /// Map a file extension (".html", ".js") to a MIME type (i.e. "text/html", "text/javascript").
    /// A default implementation is provided, but it is non-exhaustive. If a custom mapping function is given,
    /// it will be called first, falling back to the default implementation if an empty result is returned.
    std::function<std::string(std::string_view extension)> getMIMETypeForExtension;

private:
    std::unique_ptr<choc::ui::WebView> webview;
    std::optional<choc::ui::WebView::Options::Resource> onRequest (const std::string&);
    void createBindings();
};




//==============================================================================
//        _        _           _  _
//     __| |  ___ | |_   __ _ (_)| | ___
//    / _` | / _ \| __| / _` || || |/ __|
//   | (_| ||  __/| |_ | (_| || || |\__ \ _  _  _
//    \__,_| \___| \__| \__,_||_||_||___/(_)(_)(_)
//
//   Code beyond this point is implementation detail...
//
//==============================================================================

inline PatchWebView::PatchWebView (Patch& p, const PatchManifest::View& view)
    : PatchView (p, view)
{
    choc::ui::WebView::Options options;

   #if CMAJ_ENABLE_WEBVIEW_DEV_TOOLS
    options.enableDebugMode = true;
   #else
    options.enableDebugMode = false;
   #endif

    options.transparentBackground = true;
    options.acceptsFirstMouseClick = true;
    options.fetchResource = [this] (const auto& path) { return onRequest (path); };

    options.webviewIsReady = [this] (choc::ui::WebView& w)
    {
        const auto normaliseResourcePath = [] (std::string pathText)
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
    };

    webview = std::make_unique<choc::ui::WebView> (options);
}

inline PatchWebView::~PatchWebView() = default;

inline void PatchWebView::sendMessage (const choc::value::ValueView& msg)
{
    getWebView().evaluateJavascript ("window.cmaj_deliverMessageFromServer?.(" + choc::json::toString (msg, true) + ");");
}

inline choc::ui::WebView& PatchWebView::getWebView()
{
    CMAJ_ASSERT (webview != nullptr);
    return *webview;
}

inline void PatchWebView::setStatusMessage (const std::string& newMessage)
{
    getWebView().evaluateJavascript ("if (typeof window.setStatusMessage === 'function') window.setStatusMessage (" + choc::json::getEscapedQuotedString (newMessage) + ")");
}

inline void PatchWebView::reload()
{
    getWebView().evaluateJavascript ("document.location.reload()");
}

inline std::string getPatchWebViewDevelopmentServerURL()
{
    std::string url;

   #if defined(COSIMO_ENABLE_WEBVIEW_DEV_SERVER) && COSIMO_ENABLE_WEBVIEW_DEV_SERVER
   #if defined(COSIMO_WEBVIEW_DEV_SERVER_URL)
    url = COSIMO_WEBVIEW_DEV_SERVER_URL;
   #endif

    if (url.empty())
        if (const auto* env = std::getenv ("COSIMO_WEBVIEW_DEV_SERVER_URL"))
            url = env;
   #endif

    if (! url.empty() && url.back() != '/')
        url.push_back ('/');

    return url;
}

static constexpr auto cmajor_patch_gui_html = R"(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Cmajor Patch Controls</title>
</head>

<style>
  * { box-sizing: border-box; padding: 0; margin: 0; border: 0; }
  html { background: black; overflow: hidden; }
  body { display: block; position: absolute; width: 100%; height: 100%; color: white; font-family: Monaco, Consolas, monospace; }
  #cmaj-view-container { display: block; position: relative; width: 100%; height: 100%; overflow: auto; }
  #cmaj-error-text { display: block; position: relative; width: 100%; height: 100%; padding: 1rem; text-wrap: wrap; }
</style>

<body>
  <div id="cmaj-view-container"></div>
</body>

<script type="module">

//==============================================================================
const patchManifest = $MANIFEST$;

const viewInfo = $VIEW_TO_USE$;
const configuredDevServerURL = $DEV_SERVER_URL$;

function normaliseDevServerURL (url)
{
    if (typeof url !== "string")
        return "";

    const trimmed = url.trim();

    if (trimmed.length === 0)
        return "";

    return trimmed.endsWith ("/") ? trimmed : `${trimmed}/`;
}

function toResourcePath (path)
{
    const pathText = typeof path === "string" ? path : String (path ?? "");
    return pathText.startsWith ("/") ? pathText.slice (1) : pathText;
}

async function tryImportModule (address, description)
{
    try
    {
        return await import (address);
    }
    catch (error)
    {
        console.warn (`Failed to import ${description} from ${address}`, error);
        return null;
    }
}

const devServerURL = normaliseDevServerURL (configuredDevServerURL);
window.__cosimoPatchDevServerURL = devServerURL;

let PatchConnectionClass = null;
let createPatchViewHolderFunction = null;

async function ensurePatchGUIRuntimeLoaded()
{
    if (PatchConnectionClass && createPatchViewHolderFunction)
        return;

    if (devServerURL)
        await tryImportModule (new URL ("@vite/client", devServerURL).toString(), "Vite HMR client");

    const patchConnectionModule = devServerURL
        ? await tryImportModule (new URL ("cmaj_api/cmaj-patch-connection.js", devServerURL).toString(), "PatchConnection")
        : null;
    const patchViewModule = devServerURL
        ? await tryImportModule (new URL ("cmaj_api/cmaj-patch-view.js", devServerURL).toString(), "patch view host")
        : null;

    const localPatchConnectionModule = patchConnectionModule
        ?? await import ("../cmaj_api/cmaj-patch-connection.js");
    const localPatchViewModule = patchViewModule
        ?? await import ("./cmaj_api/cmaj-patch-view.js");

    PatchConnectionClass = localPatchConnectionModule.PatchConnection;
    createPatchViewHolderFunction = localPatchViewModule.createPatchViewHolder;

    if (! PatchConnectionClass || ! createPatchViewHolderFunction)
        throw new Error ("Could not load the Cmajor patch web bridge runtime");
}

//==============================================================================
function createEmbeddedPatchConnectionClass()
{
    return class EmbeddedPatchConnection extends PatchConnectionClass
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
            const resourcePath = toResourcePath (path);

            if (devServerURL)
                return new URL (resourcePath, devServerURL).toString();

            return resourcePath.length === 0 ? "/" : ("/" + resourcePath);
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
    };
}

//==============================================================================
const container = document.getElementById ("cmaj-view-container");
let isViewActive = false;

async function initialiseContainer()
{
$EXTRA_SETUP_CODE$
}

window.setStatusMessage = (newMessage) =>
{
    const messageText = typeof newMessage === "string" ? newMessage : String (newMessage ?? "");
    const isErrorLike = /(^|\b)(error|failed|could not)\b/i.test (messageText)
        || /no view available/i.test (messageText);

    if (! isErrorLike)
        return;

    isViewActive = false;
    container.innerHTML = `<pre id="cmaj-error-text">${messageText}</pre>`;
};

async function createViewIfNeeded (patchConnection)
{
    if (isViewActive)
        return;

    container.innerHTML = "";

    await initialiseContainer();

    await ensurePatchGUIRuntimeLoaded();

    const view = await createPatchViewHolderFunction (patchConnection, viewInfo);

    if (view)
    {
        container.appendChild (view);
        isViewActive = true;
    }
    else
    {
        window.setStatusMessage ("No view available");
    }
}

async function initialisePatch()
{
    await ensurePatchGUIRuntimeLoaded();

    const EmbeddedPatchConnection = createEmbeddedPatchConnectionClass();
    const patchConnection = new EmbeddedPatchConnection();

    const statusListener = async status =>
    {
        const getDescription = () =>
        {
            if (status.manifest?.name)
                return `Error building '${status.manifest.name}':`;

            return `Error:`;
        }

        if (status.error)
            window.setStatusMessage (getDescription() + "\n\n" + status.error.toString());
        else
            await createViewIfNeeded (patchConnection);
    };

    patchConnection.addStatusListener (statusListener);
    patchConnection.requestStatusUpdate();
}

initialisePatch().catch (error =>
{
    const message = error?.stack || error?.message || String (error);
    window.setStatusMessage (message);
});


</script>
</html>
)";

inline std::optional<choc::ui::WebView::Options::Resource> PatchWebView::onRequest (const std::string& path)
{
    const auto toMimeType = [this] (const auto& extension)
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
    auto relativePath = std::filesystem::path (normalisedPath).relative_path();

    if (relativePath.empty())
    {
        choc::value::Value manifestObject;
        cmaj::PatchManifest::View viewToUse;

        if (auto manifest = patch.getManifest())
        {
            manifestObject = manifest->manifest;

            if (auto v = manifest->findDefaultView())
                viewToUse = *v;
        }

        return choc::ui::WebView::Options::Resource (choc::text::replace (cmajor_patch_gui_html,
                                                        "$MANIFEST$", choc::json::toString (manifestObject, true),
                                                        "$VIEW_TO_USE$", choc::json::toString (viewToUse.view, true),
                                                        "$DEV_SERVER_URL$", choc::json::getEscapedQuotedString (getPatchWebViewDevelopmentServerURL()),
                                                        "$EXTRA_SETUP_CODE$", extraSetupCode),
                                                     "text/html");
    }

    if (auto content = readJavascriptResource (path, patch.getManifest()))
        if (! content->empty())
            return choc::ui::WebView::Options::Resource (*content, toMimeType (relativePath.extension().string()));

    if (auto manifest = patch.getManifest())
        if (auto content = manifest->readFileContent (relativePath.generic_string()))
            return choc::ui::WebView::Options::Resource (*content, toMimeType (relativePath.extension().string()));

    return {};
}


} // namespace cmaj
