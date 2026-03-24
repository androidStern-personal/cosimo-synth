#include <JuceHeader.h>
#include <assert.h>

#define CHOC_ASSERT(x) assert(x)
#include "cmajor/helpers/cmaj_JUCEPluginFormat.h"
#include "choc/javascript/choc_javascript_QuickJS.h"

static std::optional<std::filesystem::path> findSiblingPatch (std::filesystem::path pluginFile)
{
    auto file = pluginFile;
    file.replace_extension (".cmajorpatch");

    if (exists (file))
        return file;

    return {};
}

static std::optional<std::filesystem::path> findSiblingPatchFolder (std::filesystem::path pluginFile)
{
    auto folder = pluginFile;
    folder.replace_extension ({});

    if (is_directory (folder))
    {
        std::error_code errorCode;

        for (auto& file : std::filesystem::directory_iterator (folder,
                                                                std::filesystem::directory_options::skip_permission_denied,
                                                                errorCode))
            if (file.path().extension() == ".cmajorpatch")
                return file;
    }

    return {};
}

static std::optional<std::filesystem::path> findSiblingJSONFile (std::filesystem::path pluginFile)
{
    auto file = pluginFile;
    file.replace_extension (".json");

    if (exists (file))
    {
        try
        {
            auto json = choc::json::parse (choc::file::loadFileAsString (file.string()));

            if (! json.isObject())
                throw std::runtime_error ("Expected a JSON object");

            auto manifest = std::filesystem::path (json["location"].toString());

            if (manifest.extension() != ".cmajorpatch")
                throw std::runtime_error ("Expected the path of a .cmajorpatch file");

            if (manifest.is_relative())
                manifest = pluginFile.parent_path() / manifest;

            if (! exists (manifest))
                throw std::runtime_error ("No such file: " + manifest.string());

            return manifest;
        }
        catch (const std::exception& e)
        {
            std::cerr << "Error parsing " << file << ": " << e.what() << std::endl;
        }
    }

    return {};
}

static std::optional<std::filesystem::path> findAssociatedPatch (std::filesystem::path pluginFile)
{
    try
    {
        if (auto patch = findSiblingJSONFile (pluginFile))
            return patch;

        if (auto patch = findSiblingPatch (pluginFile))
            return patch;

        if (auto patch = findSiblingPatchFolder (pluginFile))
            return patch;
    }
    catch (const std::exception& e)
    {
        std::cerr << e.what() << std::endl;
    }

    return {};
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    auto patch = std::make_shared<cmaj::Patch>();
    patch->setAutoRebuildOnFileChange (true);
    patch->createEngine = +[] { return cmaj::Engine::create(); };

    if (auto manifest = findAssociatedPatch (juce::File::getSpecialLocation (juce::File::currentApplicationFile)
                                               .getFullPathName().toStdString()))
    {
       #if CMAJ_USE_QUICKJS_WORKER
        enableQuickJSPatchWorker (*patch);
       #else
        enableWebViewPatchWorker (*patch);
       #endif

        return new cmaj::plugin::SinglePatchJITPlugin (std::move (patch), *manifest);
    }

    return new cmaj::plugin::JITLoaderPlugin (std::move (patch));
}
