#include <cassert>

#define CHOC_ASSERT(x) assert (x)

#include "cmajor/API/cmaj_Engine.h"
#include "cmajor/helpers/cmaj_PatchManifest.h"

#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

namespace
{
constexpr auto rendererFunctionName = "CosimoThreeOscillatorRenderer::renderAll";

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
    require (argc == 4 || argc == 5,
             "usage: cosimo_cmajor_external_codegen <patch.cmajorpatch> <output.cpp> <class-name> [endpoint-metadata.json]");

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
                                     .setMaxBlockSize (512));

        const auto resolveExternal = [] (
            const char* functionName,
            choc::span<choc::value::Type> parameterTypes) -> void*
        {
            require (functionName != nullptr && std::string (functionName) == rendererFunctionName,
                     std::string ("unexpected external function; expected ")
                         + rendererFunctionName + ", received "
                         + (functionName == nullptr ? "<null>" : functionName));
            require (parameterTypes.size() == 18,
                     "external renderer signature mismatch: expected 18 array parameters, received "
                         + std::to_string (parameterTypes.size()));

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
        if (argc == 5)
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

        if (argc == 5)
        {
            std::ofstream metadataOutput (argv[4], std::ios::binary | std::ios::trunc);
            require (metadataOutput.good(), std::string ("could not write ") + argv[4]);
            metadataOutput << choc::json::toString (metadata, true);
            require (metadataOutput.good(), std::string ("failed writing ") + argv[4]);
        }

        std::cout << "Generated C++ with external renderer call preserved\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        fail (error.what());
    }
}
