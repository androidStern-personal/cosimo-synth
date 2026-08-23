#include <algorithm>
#include <array>
#include <atomic>
#include <cassert>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#undef CHOC_ASSERT
#define CHOC_ASSERT(x) assert (x)
#define CMAJOR_DLL 1

#include "cmajor/API/cmaj_Engine.h"
#include "choc/gui/choc_MessageLoop.h"
#include "../../native/bounce/CmajorBounceOfflinePerformer.h"

namespace
{
using namespace cosimo::bounce;

constexpr auto sampleRate = std::uint32_t { 48000 };
constexpr auto rootNote = std::int32_t { 60 };
constexpr auto sourceFrameCount = std::uint32_t { 4800 };
constexpr auto sourceNoteOffFrame = std::uint32_t { 2400 };

std::int32_t packStereo (std::int16_t left, std::int16_t right) noexcept
{
    const auto packed = static_cast<std::uint32_t> (static_cast<std::uint16_t> (left))
                      | (static_cast<std::uint32_t> (static_cast<std::uint16_t> (right)) << 16u);
    return static_cast<std::int32_t> (packed);
}

choc::value::Value intArray (std::uint32_t size,
                             const std::function<std::int32_t (std::uint32_t)>& valueAt)
{
    return choc::value::createArray (size, [&] (std::uint32_t index)
    {
        return choc::value::Value (valueAt (index));
    });
}

CmajorPatchSnapshot createRecursiveSnapshot()
{
    CmajorPatchSnapshot snapshot;
    snapshot.parameters = {
        { "sourceMode", 1.0f },
        { "filterMode", 0.0f },
        { "ampRelease", 0.05f },
    };

    auto rootNotes = intArray (19, [] (std::uint32_t index)
    {
        return index == 0 ? rootNote : 0;
    });
    auto rootOffsets = intArray (19, [] (std::uint32_t) { return 0; });
    auto rootCounts = intArray (19, [] (std::uint32_t index)
    {
        return index == 0 ? static_cast<std::int32_t> (sourceFrameCount) : 0;
    });
    auto rootNoteOffs = intArray (19, [] (std::uint32_t index)
    {
        return index == 0 ? static_cast<std::int32_t> (sourceNoteOffFrame) : 0;
    });
    snapshot.setupEvents.push_back ({
        "bounceBankLoadBegin",
        choc::json::create (
            "dspSessionId", 0,
            "generation", 1,
            "deliverySerial", 1,
            "sampleRate", static_cast<std::int32_t> (sampleRate),
            "rootCount", 1,
            "totalFrameCount", static_cast<std::int32_t> (sourceFrameCount),
            "rootNotes", std::move (rootNotes),
            "rootFrameOffsets", std::move (rootOffsets),
            "rootFrameCounts", std::move (rootCounts),
            "rootNoteOffFrameOffsets", std::move (rootNoteOffs)),
        2,
        true,
        {},
    });

    auto packedFrames = intArray (6000, [] (std::uint32_t frame)
    {
        if (frame >= sourceFrameCount)
            return 0;
        const auto phase = 2.0 * 3.14159265358979323846 * 220.0
                         * static_cast<double> (frame) / sampleRate;
        const auto edge = std::min ({ 1.0,
                                     static_cast<double> (frame) / 64.0,
                                     static_cast<double> (sourceFrameCount - 1 - frame) / 64.0 });
        const auto sample = static_cast<std::int16_t> (
            std::lround (std::sin (phase) * edge * 8192.0));
        return packStereo (sample, sample);
    });
    snapshot.setupEvents.push_back ({
        "bounceBankFrameBatch",
        choc::json::create (
            "dspSessionId", 0,
            "generation", 1,
            "deliverySerial", 2,
            "frameIndexBase", 0,
            "frameCount", static_cast<std::int32_t> (sourceFrameCount),
            "packedFrames", std::move (packedFrames)),
        2,
        true,
        {},
    });
    snapshot.setupEvents.push_back ({
        "bounceBankCommit",
        choc::json::create (
            "dspSessionId", 0,
            "generation", 1,
            "deliverySerial", 3),
        2,
        true,
        {},
    });
    snapshot.settleFrames = 384;
    snapshot.validate();
    return snapshot;
}

struct CmajorLibraryScope
{
    ~CmajorLibraryScope() { cmaj::Library::shutdown(); }
};

int runProbe (const char* runtimePath, const char* patchPath)
{
    if (! cmaj::Library::initialise (runtimePath))
    {
        std::cerr << "FAIL: could not load Cmajor runtime: " << runtimePath << '\n';
        return 1;
    }
    CmajorLibraryScope libraryScope;

    auto initialisationTime = std::chrono::nanoseconds {};
    auto configuration = createDesktopJITBounceConfiguration (patchPath);
    configuration.initialiseDurationReported = [&] (std::chrono::nanoseconds duration)
    {
        initialisationTime = duration;
    };
    configuration.readyTimeout = std::chrono::seconds (30);

    CapturePlan plan;
    plan.sampleRate = sampleRate;
    plan.tempoBpm = 120.0;
    plan.roots = { rootNote };
    plan.holdFrames = 1200;
    plan.tailCapFrames = 4800;
    plan.silenceWindowFrames = 256;
    plan.tailPaddingFrames = 512;
    plan.blockFrames = 128;

    std::vector<RootCapture> roots;
    std::atomic<bool> cancelled { false };
    const auto totalStartedAt = std::chrono::steady_clock::now();
    const auto summary = SequentialCaptureDriver {}.capture (
        plan,
        createCmajorPerformerFactory (std::move (configuration), createRecursiveSnapshot()),
        [&roots] (RootCapture&& root) { roots.push_back (std::move (root)); },
        {},
        cancelled);
    const auto totalElapsed = std::chrono::steady_clock::now() - totalStartedAt;

    if (roots.size() != 1
        || roots[0].rootNote != rootNote
        || roots[0].noteOffFrameOffset != plan.holdFrames
        || roots[0].frameCount <= plan.holdFrames
        || roots[0].frameCount >= plan.holdFrames + plan.tailCapFrames
        || roots[0].peak < 0.01f
        || roots[0].interleavedStereo.size() != roots[0].frameCount * 2
        || summary.totalFrameCount != roots[0].frameCount
        || initialisationTime.count() <= 0)
    {
        std::cerr << "FAIL: native QuickJS Bounce capture violated its result contract\n";
        return 1;
    }

    const auto initSeconds = std::chrono::duration<double> (initialisationTime).count();
    const auto totalSeconds = std::chrono::duration<double> (totalElapsed).count();
    std::cout << "PASS: native QuickJS driver rendered a recursive production-patch root\n"
              << "  initSeconds=" << initSeconds << '\n'
              << "  totalSeconds=" << totalSeconds << '\n'
              << "  capturedFrames=" << roots[0].frameCount << '\n'
              << "  peak=" << roots[0].peak << '\n'
              << "  realtimeMultiplier=" << summary.metrics[0].realtimeMultiplier << '\n'
              << "  absolute Linux VM timing is advisory; Mac/iOS must be measured separately\n";
    return 0;
}
}

int main (int argc, char** argv)
{
    if (argc != 3)
    {
        std::cerr << "Usage: " << argv[0]
                  << " <libCmajPerformer> <WavetableSynth.cmajorpatch>\n";
        return 2;
    }

    choc::messageloop::initialise();
    std::atomic<int> result { 1 };
    auto probeThread = std::thread ([&]
    {
        try
        {
            result = runProbe (argv[1], argv[2]);
        }
        catch (const std::exception& error)
        {
            std::cerr << "FAIL: native QuickJS Bounce probe threw: " << error.what() << '\n';
            result = 1;
        }
        catch (...)
        {
            std::cerr << "FAIL: native QuickJS Bounce probe threw an unknown exception\n";
            result = 1;
        }
        choc::messageloop::stop();
    });
    choc::messageloop::run();
    probeThread.join();
    return result.load();
}
