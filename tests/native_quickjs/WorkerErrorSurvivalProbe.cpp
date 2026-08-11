#include <algorithm>
#include <array>
#include <atomic>
#include <cassert>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdint>
#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <thread>

#undef CHOC_ASSERT
#define CHOC_ASSERT(x) assert(x)
#define CMAJOR_DLL 1

#include "cmajor/API/cmaj_Engine.h"
#include "cmajor/helpers/cmaj_Patch.h"
#include "cmajor/helpers/cmaj_PatchWorker_QuickJS.h"
#include "choc/gui/choc_MessageLoop.h"

namespace
{
constexpr double sampleRate = 48000.0;
constexpr uint32_t blockSize = 128;
constexpr auto observationTimeout = std::chrono::seconds (8);
constexpr std::string_view expectedWorkerError = "intentional QuickJS worker delivery failure";

struct CmajorLibraryScope
{
    ~CmajorLibraryScope() { cmaj::Library::shutdown(); }
};

struct PlaybackControl
{
    std::mutex mutex;
    std::atomic<bool> active { false };
    std::atomic<int> stopCount { 0 };
};

struct ErrorObservation
{
    std::mutex mutex;
    std::string message;
};

struct MessageLoopBarrierState
{
    std::mutex mutex;
    std::condition_variable condition;
    bool complete = false;
};

bool waitForMessageLoopBarrier()
{
    const auto state = std::make_shared<MessageLoopBarrierState>();

    choc::messageloop::postMessage ([state]
    {
        {
            const std::lock_guard<std::mutex> lock (state->mutex);
            state->complete = true;
        }

        state->condition.notify_one();
    });

    auto lock = std::unique_lock<std::mutex> (state->mutex);
    return state->condition.wait_for (lock, observationTimeout, [&] { return state->complete; });
}

bool rendersConstantSignal (cmaj::Patch& patch, PlaybackControl& playback)
{
    std::array<float, blockSize> output {};
    float* channels[] { output.data() };

    {
        const std::lock_guard<std::mutex> lock (playback.mutex);

        if (! playback.active)
            return false;

        patch.process (channels, blockSize, [] (uint32_t, choc::midi::MessageView) {});
    }

    return std::all_of (output.begin(), output.end(), [] (float sample)
    {
        return std::abs (sample - 0.25f) < 0.0001f;
    });
}

int fail (const std::string& message)
{
    std::cerr << "FAIL: " << message << '\n';
    return 1;
}
}

int runProbe (const char* runtimePath, const char* patchPath)
{
    if (! cmaj::Library::initialise (runtimePath))
        return fail ("could not load the Cmajor runtime");

    CmajorLibraryScope libraryScope;
    cmaj::PatchManifest manifest;
    manifest.initialiseWithFile (patchPath);

    PlaybackControl playback;
    ErrorObservation error;
    cmaj::Patch patch;
    patch.createEngine = [] { return cmaj::Engine::create(); };
    cmaj::enableQuickJSPatchWorker (patch);
    patch.handleOutputEvent = [] (uint64_t, std::string_view, const choc::value::ValueView&) {};

    patch.stopPlayback = [&playback]
    {
        playback.active = false;
        const std::lock_guard<std::mutex> lock (playback.mutex);
        playback.stopCount += 1;
    };

    patch.startPlayback = [&playback]
    {
        playback.active = true;
    };

    patch.statusChanged = [&error] (const cmaj::Patch::Status& status)
    {
        if (! status.messageList.hasErrors())
            return;

        const std::lock_guard<std::mutex> lock (error.mutex);
        error.message = status.messageList.toString();
    };

    patch.setPlaybackParams ({ sampleRate, blockSize, 0, 1 });
    cmaj::Patch::LoadParams loadParams;
    loadParams.manifest = manifest;

    if (! patch.loadPatch (loadParams, true) || ! patch.isPlayable())
        return fail ("worker-error fixture did not become playable");

    if (! rendersConstantSignal (patch, playback))
        return fail ("fixture did not render its baseline constant signal");

    const auto stopCountBeforeError = playback.stopCount.load();
    patch.setStoredStateValue ("quickjs.error.probe", choc::value::Value ("trigger"));

    if (! waitForMessageLoopBarrier())
        return fail ("worker error delivery did not cross the native message loop");

    std::string reportedError;
    {
        const std::lock_guard<std::mutex> lock (error.mutex);
        reportedError = error.message;
    }

    if (reportedError.find (expectedWorkerError) == std::string::npos)
        return fail ("worker error was not reported through Patch::statusChanged");

    if (! patch.isPlayable())
        return fail ("worker error unloaded an otherwise playable patch");

    if (playback.stopCount.load() != stopCountBeforeError)
        return fail ("worker error stopped audio playback");

    if (! rendersConstantSignal (patch, playback))
        return fail ("working audio did not survive the worker error");

    std::cout << "PASS: QuickJS worker errors are reported without unloading working audio\n";
    patch.unload();
    return 0;
}

int main (int argc, char** argv)
{
    if (argc != 3)
    {
        std::cerr << "Usage: " << argv[0] << " <libCmajPerformer> <WorkerErrorSignal.cmajorpatch>\n";
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
        catch (const std::exception& exception)
        {
            std::cerr << "FAIL: worker-error probe threw: " << exception.what() << '\n';
            result = 1;
        }
        catch (...)
        {
            std::cerr << "FAIL: worker-error probe threw an unknown exception\n";
            result = 1;
        }

        choc::messageloop::stop();
    });

    choc::messageloop::run();
    probeThread.join();
    return result.load();
}
