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
constexpr uint32_t sendTimeoutMilliseconds = 2000;
constexpr auto observationTimeout = std::chrono::seconds (8);

constexpr auto storedStatePrefix = R"json({
  "format": "cosimo.modulation",
  "version": 2,
  "msegSlots": [
    {
      "shapeA": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 1", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "shapeB": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 1", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "morph": 0,
      "playback": { "format": "cosimo.mseg.playback", "version": 1, "rate": { "kind": "seconds", "seconds": 1 }, "loop": { "startX": 0, "endX": 1 }, "noteOffPolicy": "finish_loop", "legatoRestarts": false, "holdFinalValue": true }
    },
    {
      "shapeA": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 2", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "shapeB": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 2", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "morph": 0,
      "playback": { "format": "cosimo.mseg.playback", "version": 1, "rate": { "kind": "seconds", "seconds": 1 }, "loop": { "startX": 0, "endX": 1 }, "noteOffPolicy": "finish_loop", "legatoRestarts": false, "holdFinalValue": true }
    },
    {
      "shapeA": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 3", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "shapeB": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 3", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "morph": 0,
      "playback": { "format": "cosimo.mseg.playback", "version": 1, "rate": { "kind": "seconds", "seconds": 1 }, "loop": { "startX": 0, "endX": 1 }, "noteOffPolicy": "finish_loop", "legatoRestarts": false, "holdFinalValue": true }
    }
  ],
  "envelopeSlots": [
    { "name": "Env 1", "attackSeconds": 0.01, "decaySeconds": 0.25, "sustain": 0.5, "releaseSeconds": 0.2 },
    { "name": "Env 2", "attackSeconds": 0.01, "decaySeconds": 0.25, "sustain": 0.5, "releaseSeconds": 0.2 },
    { "name": "Env 3", "attackSeconds": 0.01, "decaySeconds": 0.25, "sustain": 0.5, "releaseSeconds": 0.2 }
  ],
  "routes": )json";

constexpr auto storedStateSuffix = R"json(,
  "macroNames": ["Macro 1", "Macro 2", "Macro 3", "Macro 4"]
})json";

const auto routedStoredState = std::string (storedStatePrefix) + R"json([
  {
    "id": "quickjs-restore-macro-q",
    "enabled": true,
    "sourceKind": "macro",
    "sourceSlot": 1,
    "polarity": "unipolar",
    "targetKind": "filterQ",
    "amount": 10,
    "reducer": "max"
  }
])json" + storedStateSuffix;

const auto emptyStoredState = std::string (storedStatePrefix) + "[]" + storedStateSuffix;

struct Observations
{
    std::mutex mutex;
    int32_t dspSessionID = 0;
    int32_t acceptedModulationSerial = 0;
    int32_t rejectedSerial = 0;
    int32_t rejectionReason = 0;
    int32_t rejectedRouteCount = 0;
    float latestActiveFilterQ = 0.0f;
    bool hasActiveFilterQ = false;
    std::string patchError;
};

struct Snapshot
{
    int32_t dspSessionID = 0;
    int32_t acceptedModulationSerial = 0;
    int32_t rejectedSerial = 0;
    int32_t rejectionReason = 0;
    int32_t rejectedRouteCount = 0;
    float latestActiveFilterQ = 0.0f;
    bool hasActiveFilterQ = false;
    std::string patchError;
};

struct PlaybackControl
{
    std::mutex mutex;
    std::atomic<bool> active { false };
};

struct CmajorLibraryScope
{
    ~CmajorLibraryScope() { cmaj::Library::shutdown(); }
};

struct MessageLoopBarrierState
{
    std::mutex mutex;
    std::condition_variable condition;
    bool complete = false;
};

Snapshot takeSnapshot (Observations& observations)
{
    const std::lock_guard<std::mutex> lock (observations.mutex);
    return {
        observations.dspSessionID,
        observations.acceptedModulationSerial,
        observations.rejectedSerial,
        observations.rejectionReason,
        observations.rejectedRouteCount,
        observations.latestActiveFilterQ,
        observations.hasActiveFilterQ,
        observations.patchError,
    };
}

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

void processBlock (cmaj::Patch& patch, PlaybackControl& playback)
{
    std::array<float, blockSize> left {};
    std::array<float, blockSize> right {};
    float* channels[] { left.data(), right.data() };

    {
        const std::lock_guard<std::mutex> lock (playback.mutex);

        if (playback.active)
            patch.process (channels, blockSize, [] (uint32_t, choc::midi::MessageView) {});
    }

    std::this_thread::sleep_for (std::chrono::microseconds (2667));
}

template <typename Predicate>
bool processUntil (cmaj::Patch& patch,
                   PlaybackControl& playback,
                   Observations& observations,
                   Predicate&& predicate)
{
    const auto deadline = std::chrono::steady_clock::now() + observationTimeout;

    while (std::chrono::steady_clock::now() < deadline)
    {
        processBlock (patch, playback);
        const auto snapshot = takeSnapshot (observations);

        if (! snapshot.patchError.empty())
            return false;

        if (predicate (snapshot))
            return true;
    }

    return false;
}

void reportFailure (const std::string& message, const Snapshot& snapshot)
{
    std::cerr << "FAIL: " << message << '\n'
              << "  dspSessionID=" << snapshot.dspSessionID << '\n'
              << "  acceptedModulationSerial=" << snapshot.acceptedModulationSerial << '\n'
              << "  rejectedSerial=" << snapshot.rejectedSerial << '\n'
              << "  rejectionReason=" << snapshot.rejectionReason << '\n'
              << "  rejectedRouteCount=" << snapshot.rejectedRouteCount << '\n'
              << "  latestActiveFilterQ=" << snapshot.latestActiveFilterQ << '\n';

    if (! snapshot.patchError.empty())
        std::cerr << "  patchError=" << snapshot.patchError << '\n';
}
}

int runProbe (const char* runtimePath, const char* patchPath)
{
    if (! cmaj::Library::initialise (runtimePath))
    {
        std::cerr << "FAIL: could not load Cmajor runtime: " << runtimePath << '\n';
        return 1;
    }

    CmajorLibraryScope libraryScope;

    cmaj::PatchManifest manifest;

    try
    {
        manifest.initialiseWithFile (patchPath);
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL: could not read production patch: " << error.what() << '\n';
        return 1;
    }

    Observations observations;
    PlaybackControl playback;
    cmaj::Patch patch;
    patch.createEngine = [] { return cmaj::Engine::create(); };
    cmaj::enableQuickJSPatchWorker (patch);

    patch.stopPlayback = [&playback]
    {
        playback.active = false;
        const std::lock_guard<std::mutex> lock (playback.mutex);
    };

    patch.startPlayback = [&playback]
    {
        playback.active = true;
    };

    patch.statusChanged = [&observations] (const cmaj::Patch::Status& status)
    {
        if (! status.messageList.hasErrors())
            return;

        const std::lock_guard<std::mutex> lock (observations.mutex);
        observations.patchError = status.messageList.toString();
    };

    patch.handleOutputEvent = [&observations] (uint64_t,
                                               std::string_view endpointID,
                                               const choc::value::ValueView& value)
    {
        const std::lock_guard<std::mutex> lock (observations.mutex);

        if (endpointID == "runtimeState")
        {
            observations.dspSessionID = value["dspSessionId"].getWithDefault<int32_t> (0);
        }
        else if (endpointID == "runtimeInstallAck")
        {
            observations.acceptedModulationSerial = std::max (
                observations.acceptedModulationSerial,
                value["acceptedModulationSerial"].getWithDefault<int32_t> (0));

            const auto rejectedSerial = value["rejectedSerial"].getWithDefault<int32_t> (0);
            if (rejectedSerial != 0)
            {
                observations.rejectedSerial = rejectedSerial;
                observations.rejectionReason = value["rejectionReason"].getWithDefault<int32_t> (0);
            }
        }
        else if (endpointID == "modulationRejectedRouteCount")
        {
            observations.rejectedRouteCount = value.getWithDefault<int32_t> (0);
        }
        else if (endpointID == "effectiveFilterState"
                 && value["hasActive"].getWithDefault<int32_t> (0) != 0)
        {
            observations.latestActiveFilterQ = value["q"].getWithDefault<float> (0.0f);
            observations.hasActiveFilterQ = true;
        }
    };

    patch.setStoredStateValue ("modulation.v2", choc::value::Value (routedStoredState));
    patch.setPlaybackParams ({ sampleRate, blockSize, 0, 2 });

    cmaj::Patch::LoadParams loadParams;
    loadParams.manifest = manifest;

    if (! patch.loadPatch (loadParams, true) || ! patch.isPlayable())
    {
        reportFailure ("production patch did not become playable", takeSnapshot (observations));
        return 1;
    }

    if (! processUntil (patch, playback, observations, [] (const Snapshot& snapshot)
        {
            return snapshot.dspSessionID != 0 && snapshot.acceptedModulationSerial >= 1;
        }))
    {
        reportFailure ("QuickJS worker did not restore and acknowledge the stored modulation program",
                       takeSnapshot (observations));
        return 1;
    }

    if (! patch.sendEventOrValueToPatch (cmaj::EndpointID::create (std::string_view { "macro1" }),
                                         choc::value::Value (1.0f),
                                         0,
                                         sendTimeoutMilliseconds))
    {
        reportFailure ("could not set Macro 1 through the production patch endpoint",
                       takeSnapshot (observations));
        return 1;
    }

    const std::array<uint8_t, 3> noteOn { 0x90, 60, 127 };
    patch.addMIDIMessage (0, noteOn.data(), static_cast<uint32_t> (noteOn.size()));

    if (! processUntil (patch, playback, observations, [] (const Snapshot& snapshot)
        {
            return snapshot.hasActiveFilterQ && snapshot.latestActiveFilterQ > 10.0f;
        }))
    {
        reportFailure ("restored Macro 1 to Filter Q mapping did not execute in the real engine",
                       takeSnapshot (observations));
        return 1;
    }

    const auto routedSnapshot = takeSnapshot (observations);

    patch.setStoredStateValue ("modulation.v2", choc::value::Value (emptyStoredState));

    if (! waitForMessageLoopBarrier())
    {
        reportFailure ("stored mapping update did not reach the production worker",
                       takeSnapshot (observations));
        return 1;
    }

    if (! processUntil (patch, playback, observations, [&] (const Snapshot& snapshot)
        {
            return snapshot.acceptedModulationSerial > routedSnapshot.acceptedModulationSerial
                && snapshot.hasActiveFilterQ
                && snapshot.latestActiveFilterQ < 1.0f;
        }))
    {
        reportFailure ("clearing stored mappings did not remove the live modulation program",
                       takeSnapshot (observations));
        return 1;
    }

    const auto emptySnapshot = takeSnapshot (observations);

    if (routedSnapshot.latestActiveFilterQ - emptySnapshot.latestActiveFilterQ < 9.5f
        || emptySnapshot.rejectedSerial != 0
        || emptySnapshot.rejectionReason != 0
        || emptySnapshot.rejectedRouteCount != 0)
    {
        reportFailure ("runtime acknowledgement or modulation delta was outside the acceptance contract",
                       emptySnapshot);
        return 1;
    }

    std::cout << "PASS: QuickJS restored modulation.v2 through the production worker and engine\n"
              << "  dspSessionID=" << emptySnapshot.dspSessionID << '\n'
              << "  acceptedModulationSerial=" << emptySnapshot.acceptedModulationSerial << '\n'
              << "  routedFilterQ=" << routedSnapshot.latestActiveFilterQ << '\n'
              << "  emptyFilterQ=" << emptySnapshot.latestActiveFilterQ << '\n'
              << "  delta=" << (routedSnapshot.latestActiveFilterQ - emptySnapshot.latestActiveFilterQ) << '\n';

    patch.unload();
    return 0;
}

int main (int argc, char** argv)
{
    if (argc != 3)
    {
        std::cerr << "Usage: " << argv[0] << " <libCmajPerformer> <WavetableSynth.cmajorpatch>\n";
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
            std::cerr << "FAIL: native QuickJS probe threw: " << error.what() << '\n';
            result = 1;
        }
        catch (...)
        {
            std::cerr << "FAIL: native QuickJS probe threw an unknown exception\n";
            result = 1;
        }

        choc::messageloop::stop();
    });

    choc::messageloop::run();
    probeThread.join();
    return result.load();
}
