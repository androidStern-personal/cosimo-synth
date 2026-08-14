#include <array>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <mutex>

#include "../../native/three_oscillator_renderer/RendererExternalFunctionProvider.h"
#include "cmajor/helpers/cmaj_Patch.h"
#include "cmajor/helpers/cmaj_PatchManifest.h"
#include "cmajor/helpers/cmaj_PatchWorker_QuickJS.h"

namespace
{
constexpr auto sampleRate = 48000.0;
constexpr auto blockSize = std::uint32_t { 128 };

struct Playback
{
    std::mutex mutex;
    bool active = false;
};

bool providerContractIsStrict()
{
    auto signature = std::array<choc::value::Type,
                                cosimo::three_osc::bridge::externalFunctionParameterCount> {};
    signature[0] = choc::value::Type::createArray<float> (1);
    for (std::size_t index = 1; index < signature.size(); ++index)
        signature[index] = choc::value::Type::createArray<std::int32_t> (1);

    const auto provider = cosimo::three_osc::bridge::createExternalFunctionProvider();
    const auto resolve = [&] (const char* name, std::size_t count)
    {
        return provider (name, { signature.data(), count });
    };

    if (resolve (cosimo::three_osc::bridge::externalFunctionName.data(), signature.size()) == nullptr
        || resolve ("WrongRenderer::renderAll", signature.size()) != nullptr
        || resolve (cosimo::three_osc::bridge::externalFunctionName.data(), signature.size() - 1) != nullptr)
        return false;

    signature[0] = choc::value::Type::createArray<std::int32_t> (1);
    if (resolve (cosimo::three_osc::bridge::externalFunctionName.data(), signature.size()) != nullptr)
        return false;

    signature[0] = choc::value::Type::createArray<float> (1);
    signature[7] = choc::value::Type::createArray<float> (1);
    if (resolve (cosimo::three_osc::bridge::externalFunctionName.data(), signature.size()) != nullptr)
        return false;

    signature[7] = choc::value::Type::createInt32();
    return resolve (cosimo::three_osc::bridge::externalFunctionName.data(), signature.size()) == nullptr;
}
}

int main (int argc, char** argv)
{
    if (argc != 3)
    {
        std::cerr << "usage: ThreeOscillatorJITProviderIntegration <runtime-dylib> <patch>\n";
        return 2;
    }

    if (! providerContractIsStrict())
    {
        std::cerr << "FAIL: external renderer provider accepted a wrong name or signature\n";
        return 1;
    }

    if (! cmaj::Library::initialise (argv[1]))
    {
        std::cerr << "FAIL: could not load Cmajor runtime\n";
        return 1;
    }

    struct LibraryScope
    {
        ~LibraryScope() { cmaj::Library::shutdown(); }
    } libraryScope;

    cmaj::PatchManifest manifest;
    manifest.initialiseWithFile (argv[2]);

    Playback playback;
    cmaj::Patch patch;
    patch.createEngine = [] { return cmaj::Engine::create(); };
    cmaj::enableQuickJSPatchWorker (patch);
    patch.externalFunctionProvider =
        cosimo::three_osc::bridge::createExternalFunctionProvider();
    patch.stopPlayback = [&]
    {
        playback.active = false;
        const std::lock_guard<std::mutex> lock (playback.mutex);
    };
    patch.startPlayback = [&] { playback.active = true; };
    patch.setPlaybackParams ({ sampleRate, blockSize, 0, 2 });

    cmaj::Patch::LoadParams params;
    params.manifest = manifest;
    if (! patch.loadPatch (params, true) || ! patch.isPlayable())
    {
        std::cerr << "FAIL: B-only external-renderer patch did not become playable\n";
        return 1;
    }

    double sumSquares = 0.0;
    for (std::uint32_t block = 0; block < 16; ++block)
    {
        std::array<float, blockSize> left {};
        std::array<float, blockSize> right {};
        float* channels[] { left.data(), right.data() };
        {
            const std::lock_guard<std::mutex> lock (playback.mutex);
            if (playback.active)
                patch.process (channels, blockSize, [] (uint32_t, choc::midi::MessageView) {});
        }

        for (std::uint32_t frame = 0; frame < blockSize; ++frame)
            sumSquares += static_cast<double> (left[frame]) * left[frame]
                        + static_cast<double> (right[frame]) * right[frame];
    }

    const auto rms = std::sqrt (sumSquares / static_cast<double> (16 * blockSize * 2));
    if (! std::isfinite (rms) || rms < 1.0e-4)
    {
        std::cerr << "FAIL: B-only renderer output was silent; rms=" << rms << '\n';
        return 1;
    }

    std::cout << "PASS native JIT provider rendered B-only audio; rms=" << rms << '\n';
    return 0;
}
