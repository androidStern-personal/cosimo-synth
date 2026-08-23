#include <algorithm>
#include <array>
#include <atomic>
#include <cassert>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <memory>
#include <numeric>
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

    std::vector<std::chrono::nanoseconds> initialisationTimes;
    auto configuration = createDesktopJITBounceConfiguration (patchPath);
    configuration.initialiseDurationReported = [&] (std::chrono::nanoseconds duration)
    {
        initialisationTimes.push_back (duration);
    };
    configuration.readyTimeout = std::chrono::seconds (30);

    CapturePlan plan;
    plan.sampleRate = sampleRate;
    plan.tempoBpm = 120.0;
    plan.roots = { 48, rootNote, 72 };
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

    const auto capturedFrames = std::accumulate (
        roots.begin(), roots.end(), std::uint64_t { 0 },
        [] (std::uint64_t total, const RootCapture& root)
        {
            return total + root.frameCount;
        });
    const auto malformedRoot = std::any_of (
        roots.begin(), roots.end(), [&] (const RootCapture& root)
        {
            return root.rootIndex >= plan.roots.size()
                || root.rootNote != plan.roots[root.rootIndex]
                || root.noteOffFrameOffset != plan.holdFrames
                || root.frameCount <= plan.holdFrames
                || root.frameCount >= plan.holdFrames + plan.tailCapFrames
                || root.peak < 0.01f
                || root.interleavedStereo.size() != root.frameCount * 2;
        });
    if (roots.size() != plan.roots.size()
        || malformedRoot
        || summary.totalFrameCount != capturedFrames
        || initialisationTimes.size() != plan.roots.size()
        || std::any_of (initialisationTimes.begin(), initialisationTimes.end(),
                        [] (auto duration) { return duration.count() <= 0; }))
    {
        std::cerr << "FAIL: native QuickJS Bounce capture violated its result contract\n";
        return 1;
    }

    const auto totalSeconds = std::chrono::duration<double> (totalElapsed).count();
    std::cout << "PASS: native QuickJS driver rendered three recursive production-patch roots\n"
              << "  initSeconds=";
    for (std::size_t index = 0; index < initialisationTimes.size(); ++index)
        std::cout << (index == 0 ? "" : ",")
                  << std::chrono::duration<double> (initialisationTimes[index]).count();
    std::cout << '\n'
              << "  totalSeconds=" << totalSeconds << '\n'
              << "  capturedFrames=" << capturedFrames << '\n'
              << "  rootPeaks=";
    for (std::size_t index = 0; index < roots.size(); ++index)
        std::cout << (index == 0 ? "" : ",") << roots[index].peak;
    std::cout << '\n' << "  realtimeMultipliers=";
    for (std::size_t index = 0; index < summary.metrics.size(); ++index)
        std::cout << (index == 0 ? "" : ",")
                  << summary.metrics[index].realtimeMultiplier;
    std::cout << '\n'
              << "  absolute host timing is advisory; record hardware and compare paired runs\n";
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
