#include <cassert>

#define CHOC_ASSERT(x) assert (x)

#include "cmajor/API/cmaj_Engine.h"
#include "cmajor/helpers/cmaj_PatchManifest.h"
#include "../../native/three_oscillator_renderer/RendererExternalFunctionProvider.h"

#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <string_view>

namespace
{
[[noreturn]] void fail (const std::string& message)
{
    std::cerr << "FAIL: " << message << '\n';
    std::exit (1);
}

void require (bool condition, const std::string& message)
{
    if (! condition)
        fail (message);
}
}

int main (int argc, char** argv)
{
    require (argc >= 4,
             "usage: cosimo_cmajor_external_codegen <patch.cmajorpatch> <output.cpp> <class-name> [--metadata path] [--max-frames-per-block frames]");

    std::filesystem::path metadataPath;
    auto maxFramesPerBlock = 512;
    for (auto index = 4; index < argc; ++index)
    {
        const auto option = std::string_view (argv[index]);
        require (index + 1 < argc, "missing value for " + std::string (option));

        if (option == "--metadata")
            metadataPath = argv[++index];
        else if (option == "--max-frames-per-block")
            maxFramesPerBlock = std::stoi (argv[++index]);
        else
            fail ("unknown option: " + std::string (option));
    }
    require (maxFramesPerBlock > 0, "max frames per block must be positive");

    try
    {
        cmaj::PatchManifest manifest;
        manifest.initialiseWithFile (std::filesystem::path (argv[1]));

        cmaj::Program program;
        cmaj::DiagnosticMessageList messages;
        const auto identityTransform = [] (cmaj::DiagnosticMessageList&,
                                           const std::string&,
                                           const std::string& source)
        {
            return source;
        };
        require (manifest.addSourceFilesToProgram (
                     program, messages, identityTransform, [] {}),
                 messages.toString());

        auto engine = cmaj::Engine::create ("cpp");
        require (engine != nullptr,
                 "C++ engine unavailable; available engines: "
                     + choc::text::joinStrings (cmaj::Engine::getAvailableEngineTypes(), ", "));
        engine.setBuildSettings (cmaj::BuildSettings()
                                     .setFrequency (48000)
                                     .setMaxBlockSize (maxFramesPerBlock));

        const auto resolveExternal = [] (
            const char* functionName,
            choc::span<choc::value::Type> parameterTypes) -> void*
        {
            require (cosimo::three_osc::bridge::matchesExternalFunction (
                         functionName, parameterTypes),
                     "external renderer name or signature mismatch");

            // Code generation needs the external declaration resolved but does not call this
            // sentinel. The generated C++ deliberately retains a link-time renderer symbol.
            return reinterpret_cast<void*> (1);
        };

        require (engine.load (messages, program,
                              manifest.createExternalResolverFunction(),
                              resolveExternal),
                 messages.toString());

        const auto inputs = engine.getInputEndpoints();
        const auto outputs = engine.getOutputEndpoints();

        for (const auto& endpoint : inputs)
            (void) engine.getEndpointHandle (endpoint.endpointID);
        for (const auto& endpoint : outputs)
            (void) engine.getEndpointHandle (endpoint.endpointID);

        choc::value::Value metadata;
        if (! metadataPath.empty())
        {
            const auto addEndpoint = [&engine] (choc::value::Value& list,
                                                const cmaj::EndpointDetails& endpoint)
            {
                auto value = endpoint.toJSON (false);
                value.addMember ("handle", static_cast<int32_t> (
                    engine.getEndpointHandle (endpoint.endpointID)));
                list.addArrayElement (std::move (value));
            };

            auto inputMetadata = choc::value::createEmptyArray();
            auto outputMetadata = choc::value::createEmptyArray();
            for (const auto& endpoint : inputs)
                addEndpoint (inputMetadata, endpoint);
            for (const auto& endpoint : outputs)
                addEndpoint (outputMetadata, endpoint);

            metadata = choc::value::createObject ("CosimoEndpointMetadata");
            metadata.addMember ("inputs", std::move (inputMetadata));
            metadata.addMember ("outputs", std::move (outputMetadata));
        }

        auto options = choc::value::createObject ("options");
        options.addMember ("classname", std::string (argv[3]));
        const auto generated = engine.generateCode (
            "cpp", choc::json::toString (options, false).c_str());
        require (! generated.messages.hasErrors(), generated.messages.toString());
        require (! generated.generatedCode.empty(), "C++ generator returned no source");

        std::ofstream output (argv[2], std::ios::binary | std::ios::trunc);
        require (output.good(), std::string ("could not write ") + argv[2]);
        output << generated.generatedCode;
        require (output.good(), std::string ("failed writing ") + argv[2]);

        if (! metadataPath.empty())
        {
            std::ofstream metadataOutput (metadataPath, std::ios::binary | std::ios::trunc);
            require (metadataOutput.good(), std::string ("could not write ") + metadataPath.string());
            metadataOutput << choc::json::toString (metadata, true);
            require (metadataOutput.good(), std::string ("failed writing ") + metadataPath.string());
        }

        std::cout << "Generated C++ with external renderer call preserved\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        fail (error.what());
    }
}
