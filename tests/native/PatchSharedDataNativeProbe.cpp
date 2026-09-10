#define CMAJOR_DLL 1
#include "cmajor/helpers/cmaj_Patch.h"
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>

static void expect (bool condition, const std::string& reason)
{
    if (! condition) throw std::runtime_error (reason);
}

static float customValue() { return 0.25f; }

int main (int argc, char** argv)
{
    try
    {
        expect (argc == 2, "Pass the Cmajor runtime library path");
        expect (cmaj::Library::initialise (argv[1]), "runtime library did not initialise");
        const auto directory = std::filesystem::temp_directory_path()
            / ("patch-shared-data-native-" + std::to_string (std::chrono::steady_clock::now().time_since_epoch().count()));
        std::filesystem::create_directory (directory);
        struct Cleanup { std::filesystem::path directory; ~Cleanup() { std::filesystem::remove_all (directory); } } cleanup { directory };
        std::ofstream (directory / "main.cmajor") << R"(
namespace cmaj::data
{
    external float32 read (int32 inputIndex, int32 sampleIndex);
    external int32 size (int32 inputIndex);
}
namespace Other { external float32 value(); }
processor Main [[ main ]]
{
    output stream float32 out;
    void main()
    {
        loop
        {
            out <- cmaj::data::read (0, 0) + float32 (cmaj::data::size (0)) + Other::value();
            advance();
        }
    }
})";
        std::ofstream (directory / "main.cmajorpatch") << R"({"CmajorVersion":1,"ID":"shared.data.native.probe","version":"1.0","name":"Shared data native probe","source":"main.cmajor","sharedData":{"inputCount":2,"maxRetainedBytes":128}})";
        cmaj::Patch patch;
        patch.createEngine = [] { return cmaj::Engine::create(); };
        patch.createContextForPatchWorker = [] (std::string) -> std::unique_ptr<cmaj::Patch::WorkerContext>
        { throw std::runtime_error ("This binding probe has no patch worker"); };
        bool fallbackCalled = false;
        patch.externalFunctionProvider = [&] (const char* name, choc::span<choc::value::Type> types) -> void*
        {
            expect (std::string_view (name) == "Other::value" && types.size() == 0,
                    "internal shared-data externals leaked into the caller's provider");
            fallbackCalled = true;
            return reinterpret_cast<void*> (&customValue);
        };
        std::string status;
        patch.statusChanged = [&] (const auto& s) { status = s.statusMessage; };
        patch.handleOutputEvent = [] (auto, auto, auto) {};
        patch.setPlaybackParams ({ 48000, 64, 0, 1 });
        expect (patch.loadPatchFromFile ((directory / "main.cmajorpatch").string(), true)
                 && patch.isPlayable(), "native patch failed: " + status);
        expect (fallbackCalled, "custom external provider was not chained");
        choc::buffer::ChannelArrayBuffer<float> audio (1, 64);
        patch.process ({ {}, audio.getView(), {}, [] (auto, auto) {} }, true);
        for (uint32_t frame = 0; frame < 64; ++frame)
            expect (audio.getSample (0, frame) == 0.25f, "native external output mismatch");
        expect (cmaj::PatchSharedData::read (0, 0) == 0 && cmaj::PatchSharedData::size (0) == 0,
                "native renderer leaked its TLS context");
        patch.unload();
        std::cout << "PatchSharedData native JIT binding: passed (64 samples, provider chaining)\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL: " << error.what() << '\n';
        return 1;
    }
}
