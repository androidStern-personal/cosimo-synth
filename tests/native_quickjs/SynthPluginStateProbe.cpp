#include <algorithm>
#include <array>
#include <atomic>
#include <cassert>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdint>
#include <iostream>
#include <future>
#include <fstream>
#include <iterator>
#include <vector>
#include <stdexcept>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <utility>

#undef CHOC_ASSERT
#define CHOC_ASSERT(x) assert(x)
#define CMAJOR_DLL 1

#include "cmajor/API/cmaj_Engine.h"
#include "cmajor/helpers/cmaj_Patch.h"
#include "cmajor/helpers/cmaj_PatchWorker_QuickJS.h"
#include "choc/gui/choc_MessageLoop.h"
#include "../../native/three_oscillator_renderer/RendererExternalFunctionProvider.h"
#include "../../native/ArticulationStateEffect.h"

namespace
{
constexpr double sampleRate = 48000.0;
constexpr uint32_t blockSize = 128;
constexpr uint32_t sendTimeoutMilliseconds = 2000;
constexpr auto observationTimeout = std::chrono::seconds (8);
std::atomic<uint64_t> renderedBlocks { 0 };
const auto diagnosticStart = std::chrono::steady_clock::now();

constexpr auto storedStatePrefix = R"json({
  "format": "cosimo.modulation",
  "version": 6,
  "msegSlots": [
    {
      "shapeA": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 1", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "shapeB": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 1", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "playback": { "format": "cosimo.mseg.playback", "version": 1, "loop": { "startX": 0, "endX": 1 }, "noteOffPolicy": "finish_loop", "legatoRestarts": false, "holdFinalValue": true }
    },
    {
      "shapeA": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 2", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "shapeB": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 2", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "playback": { "format": "cosimo.mseg.playback", "version": 1, "loop": { "startX": 0, "endX": 1 }, "noteOffPolicy": "finish_loop", "legatoRestarts": false, "holdFinalValue": true }
    },
    {
      "shapeA": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 3", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "shapeB": { "format": "cosimo.mseg.shape", "version": 1, "name": "MSEG 3", "globalSmooth": false, "points": [{ "x": 0, "y": 0, "curvePower": 0 }, { "x": 1, "y": 1, "curvePower": 0 }] },
      "playback": { "format": "cosimo.mseg.playback", "version": 1, "loop": { "startX": 0, "endX": 1 }, "noteOffPolicy": "finish_loop", "legatoRestarts": false, "holdFinalValue": true }
    }
  ],
  "envelopeSlots": [
    { "name": "Env 1" },
    { "name": "Env 2" },
    { "name": "Env 3" }
  ],
  "routes": )json";

constexpr auto storedStateSuffix = R"json(,
  "macroNames": ["Macro 1", "Macro 2", "Macro 3", "Macro 4"]
})json";

const auto routedStoredState = std::string (storedStatePrefix) + R"json([
  {
    "id": "quickjs-restore-macro-rack-filter",
    "enabled": true,
    "sourceKind": "macro",
    "sourceSlot": 1,
    "polarity": "unipolar",
    "targetKind": "lane.globalFilter#1.globalFilterCutoff",
    "amount": -6,
    "reducer": "max"
  }
])json" + storedStateSuffix;



using Value = choc::value::Value;
using View = choc::value::ValueView;
void require (bool condition, const char* message) { if (! condition) throw std::runtime_error (message); }
template <typename Fn> auto onLoop (Fn run)
{
    using Result = std::invoke_result_t<Fn>;
    auto task = std::make_shared<std::packaged_task<Result()>> (std::move (run));
    auto result = task->get_future();
    choc::messageloop::postMessage ([task] { (*task)(); });
    require (result.wait_for (observationTimeout) == std::future_status::ready, "native message loop stalled");
    return result.get();
}
// Only actual messages delivered by the native Patch/QuickJS worker are stored.
// This view neither accepts commands nor implements state/history/ACK policy.
struct StateView final : cmaj::PatchView
{
    explicit StateView (cmaj::Patch& patch) : PatchView (patch) {}
    void sendMessage (const View& message) override
    {
        if (message["type"].toString() == "kit_state") messages.emplace_back (message["message"]);
    }
    Value last (const char* kind) const
    {
        for (auto i = messages.rbegin(); i != messages.rend(); ++i)
            if ((*i)["kind"].toString() == kind) return *i;
        return choc::value::createObject ("");
    }
    Value state() const
    {
        for (auto i = messages.rbegin(); i != messages.rend(); ++i)
            if ((*i)["kind"].toString() == "attached" || (*i)["kind"].toString() == "update") return Value ((*i)["state"]);
        return choc::value::createObject ("");
    }
    Value receipt (int sequence) const
    {
        for (auto i = messages.rbegin(); i != messages.rend(); ++i)
        {
            const auto r = (*i)["kind"].toString() == "receipt" ? View (*i) : (*i)["receipt"];
            if (r.isObject() && r["address"].isObject()
                && r["address"]["client"].getWithDefault<int64_t> (0) == client
                && r["address"]["sequence"].getWithDefault<int> (0) == sequence) return Value (r["result"]);
        }
        return choc::value::createObject ("");
    }
    std::vector<Value> messages;
    Value scope;
    int64_t client = 0;
    int sequence = 0;
};

struct StateViewDeleter
{
    void operator() (StateView* view) const noexcept
    {
        try { onLoop ([view] { delete view; }); } catch (...) {}
    }
};
using ScopedStateView = std::unique_ptr<StateView, StateViewDeleter>;

struct PatchUnloadGuard
{
    cmaj::Patch& patch;
    bool closed = false;
    void close()
    {
        onLoop ([patchPtr = &patch] { patchPtr->unload(); });
        closed = true;
    }
    ~PatchUnloadGuard()
    {
        if (! closed) try { close(); } catch (...) {}
    }
};

struct Observations
{
    std::mutex mutex;
    int32_t dspSessionID = 0;
    bool hasActiveTable = false;
    int32_t acceptedModulationSerial = 0;
    int32_t installedMacroRackRouteCount = 0;
    int32_t rejectedSerial = 0;
    int32_t rejectionReason = 0;
    int32_t rejectedRouteCount = 0;
    int32_t rackEnableMask = 0;
    int32_t rackParamsSerial = 0;
    int32_t rackRejected = 0;
    std::string patchError;
};

struct Snapshot
{
    int32_t dspSessionID = 0;
    bool hasActiveTable = false;
    int32_t acceptedModulationSerial = 0;
    int32_t installedMacroRackRouteCount = 0;
    int32_t rejectedSerial = 0;
    int32_t rejectionReason = 0;
    int32_t rejectedRouteCount = 0;
    int32_t rackEnableMask = 0;
    int32_t rackParamsSerial = 0;
    int32_t rackRejected = 0;
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
        observations.hasActiveTable,
        observations.acceptedModulationSerial,
        observations.installedMacroRackRouteCount,
        observations.rejectedSerial,
        observations.rejectionReason,
        observations.rejectedRouteCount,
        observations.rackEnableMask,
        observations.rackParamsSerial,
        observations.rackRejected,
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

std::optional<double> processBlock (cmaj::Patch& patch, PlaybackControl& playback)
{
    std::array<float, blockSize> left {};
    std::array<float, blockSize> right {};
    float* channels[] { left.data(), right.data() };
    bool processed = false;

    {
        const std::lock_guard<std::mutex> lock (playback.mutex);

        if (playback.active)
        {
            patch.process (channels, blockSize, [] (uint32_t, choc::midi::MessageView) {});
            ++renderedBlocks;
            processed = true;
        }
    }

    double sumSquares = 0.0;
    for (std::size_t frame = 0; frame < blockSize; ++frame)
        sumSquares += static_cast<double> (left[frame]) * left[frame]
            + static_cast<double> (right[frame]) * right[frame];

    std::this_thread::sleep_for (std::chrono::microseconds (2667));
    if (! processed) return std::nullopt;
    return sumSquares / static_cast<double> (blockSize * 2);
}

// The audio producer must keep draining while the orchestration thread waits
// for a GUI/message-loop query. This is the only thread that calls process().
struct AudioPump
{
    AudioPump (cmaj::Patch& patch, PlaybackControl& playback)
        : thread ([&, this]
        {
            while (! stopping.load())
            {
                const auto meanSquare = processBlock (patch, playback);
                if (meanSquare.has_value())
                {
                    {
                        const std::lock_guard<std::mutex> lock (mutex);
                        meanSquares.push_back (*meanSquare);
                    }
                    changed.notify_all();
                }
            }
        }) {}

    void stop()
    {
        stopping = true;
        if (thread.joinable()) thread.join();
    }
    ~AudioPump() { stop(); }

    void waitForBlock()
    {
        auto lock = std::unique_lock<std::mutex> (mutex);
        const auto next = meanSquares.size() + 1;
        require (changed.wait_for (lock, observationTimeout, [&] { return meanSquares.size() >= next; }),
                 "actual audio producer stalled");
    }

    double measureRms (size_t blocks)
    {
        auto lock = std::unique_lock<std::mutex> (mutex);
        const auto first = meanSquares.size();
        require (changed.wait_for (lock, observationTimeout, [&] { return meanSquares.size() >= first + blocks; }),
                 "actual audio measurement stalled");
        double total = 0;
        for (size_t i = first; i < first + blocks; ++i) total += meanSquares[i];
        return std::sqrt (total / static_cast<double> (blocks));
    }

    std::atomic<bool> stopping { false };
    std::mutex mutex;
    std::condition_variable changed;
    std::vector<double> meanSquares;
    std::thread thread;
};

template <typename Predicate>
bool processUntil (AudioPump& audio, Observations& observations, Predicate&& predicate)
{
    const auto deadline = std::chrono::steady_clock::now() + observationTimeout;
    while (std::chrono::steady_clock::now() < deadline)
    {
        audio.waitForBlock();
        const auto snapshot = takeSnapshot (observations);
        if (! snapshot.patchError.empty()) return false;
        if (predicate (snapshot)) return true;
    }
    return false;
}

void reportFailure (const std::string& message, const Snapshot& snapshot)
{
    std::cerr << "FAIL: " << message << '\n'
              << "  dspSessionID=" << snapshot.dspSessionID << '\n'
              << "  hasActiveTable=" << snapshot.hasActiveTable << '\n'
              << "  acceptedModulationSerial=" << snapshot.acceptedModulationSerial << '\n'
              << "  installedMacroRackRouteCount=" << snapshot.installedMacroRackRouteCount << '\n'
              << "  rejectedSerial=" << snapshot.rejectedSerial << '\n'
              << "  rejectionReason=" << snapshot.rejectionReason << '\n'
              << "  rejectedRouteCount=" << snapshot.rejectedRouteCount << '\n'
              << "  rackEnableMask=" << snapshot.rackEnableMask << '\n';

    if (! snapshot.patchError.empty())
        std::cerr << "  patchError=" << snapshot.patchError << '\n';
}
}

int runProbe (const char* runtimePath, const char* patchPath, const char* lanePath)
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
    std::atomic<int> inputPushFailures { 0 };
    cmaj::Patch patch;
    patch.createEngine = [] { return cmaj::Engine::create(); };
    patch.externalFunctionProvider =
        cosimo::three_osc::bridge::createExternalFunctionProvider();
    cmaj::enableQuickJSPatchWorker (patch);
    patch.handleXrun = [&] {
        ++inputPushFailures;
        std::cerr << "NATIVE_INPUT_PUSH_FAILED ms=" << std::chrono::duration_cast<std::chrono::milliseconds> (std::chrono::steady_clock::now() - diagnosticStart).count()
            << " blocks=" << renderedBlocks.load() << std::endl;
    };
    cosimo::future_daw::NoteMetaBridge noteMeta;
    std::atomic<int> hostEffects { 0 };
    patch.handleStateHostEffect = cosimo::future_daw::createArticulationStateEffectHandler (
        [&] (cosimo::future_daw::ArticulationTriggerConfig config) {
            noteMeta.setTriggerConfig (config);
            ++hostEffects;
        });
    // Declared after callback captures, before the audio pump: unwind stops
    // audio first, then unloads while every callback dependency is still alive.
    PatchUnloadGuard unload { patch };

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
            observations.hasActiveTable = value["hasActive"].getWithDefault<int32_t> (0) != 0;
        }
        else if (endpointID == "runtimeInstallAck")
        {
            observations.acceptedModulationSerial = std::max (
                observations.acceptedModulationSerial,
                value["acceptedModulationSerial"].getWithDefault<int32_t> (0));
            observations.installedMacroRackRouteCount =
                value["installedMacroRackRouteCount"].getWithDefault<int32_t> (0);

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
        else if (endpointID == "effectiveRackState")
        {
            observations.rackEnableMask = value["laneCommittedPositionMask"].getWithDefault<int32_t> (0);
            observations.rackParamsSerial = value["laneParamsAcknowledgedSerial"].getWithDefault<int32_t> (0);
            observations.rackRejected = value["laneRejectedUploadCount"].getWithDefault<int32_t> (0);
        }
    };

    std::ifstream laneFile (lanePath);
    require (laneFile.good(), "complete lane fixture missing");
    const std::string laneState ((std::istreambuf_iterator<char> (laneFile)), std::istreambuf_iterator<char>());
    patch.setStoredStateValue ("lane.v1", Value (laneState));
    patch.setStoredStateValue ("modulation.v6", choc::value::Value (routedStoredState));
    patch.setPlaybackParams ({ sampleRate, blockSize, 0, 2 });

    cmaj::Patch::LoadParams loadParams;
    loadParams.manifest = manifest;

    if (! patch.loadPatch (loadParams, true) || ! patch.isPlayable())
    {
        reportFailure ("production patch did not become playable", takeSnapshot (observations));
        return 1;
    }

    AudioPump audio (patch, playback);

    for (const auto& endpoint : patch.getInputEndpoints())
        if (endpoint.endpointID.toString() == "modulationProgram" || endpoint.endpointID.toString() == "wavetableMipFrame")
            std::cerr << "NATIVE_INPUT_BYTES " << endpoint.endpointID.toString() << " " << endpoint.dataTypes.front().getValueDataSize() << std::endl;

    if (! processUntil (audio, observations, [] (const Snapshot& snapshot)
        {
            return snapshot.dspSessionID != 0
                && snapshot.hasActiveTable
                && snapshot.acceptedModulationSerial >= 1;
        }))
    {
        reportFailure ("QuickJS worker did not restore and acknowledge the stored modulation program",
                       takeSnapshot (observations));
        return 1;
    }

    auto view = onLoop ([&] { return ScopedStateView (new StateView (patch)); });
    auto send = [&] (const View& body) {
        return patch.handleClientMessage (*view, choc::json::create ("type", "kit_state", "message", body));
    };
    onLoop ([&] { require (send (choc::json::create ("kind", "attach", "request", 1)), "native attach refused"); });
    require (processUntil (audio, observations, [&] (const Snapshot&) {
        return onLoop ([&] { return view->last ("attached")["client"].getWithDefault<int64_t> (0) > 0; });
    }), "actual worker did not attach GUI client");
    onLoop ([&] {
        const auto attached = view->last ("attached");
        view->scope = Value (attached["scope"]);
        view->client = attached["client"].get<int64_t>();
    });
    auto command = [&] (const View& value) {
        const auto sequence = onLoop ([&] {
            const auto next = ++view->sequence;
            require (send (choc::json::create ("kind", "command", "scope", view->scope,
                "client", view->client, "sequence", next, "command", value)), "native command refused");
            return next;
        });
        require (processUntil (audio, observations, [&] (const Snapshot&) {
            return onLoop ([&] { return view->receipt (sequence)["kind"].toString() == "accepted"; });
        }), "actual worker did not accept state command");
    };
    auto expectState = [&] (float amount, bool undo, bool redo) {
        return onLoop ([&] {
            const auto state = view->state();
            const auto field = state["fields"]["modulation.v6"];
            const auto stored = choc::json::parse (patch.getFullStoredState()["values"]["modulation.v6"].getString());
            const auto projected = choc::json::parse (field["value"].getString());
            return projected["routes"][0]["amount"].get<float>() == amount
                && stored["routes"][0]["amount"].get<float>() == amount
                && field["application"]["kind"].toString() == "sent"
                && field["application"]["proof"].toString() == "native-publication-processed"
                && state["history"]["canUndo"].get<bool>() == undo
                && state["history"]["canRedo"].get<bool>() == redo;
        });
    };
    const auto bootReady = processUntil (audio, observations, [&] (const Snapshot& state) {
        return state.installedMacroRackRouteCount == 1 && expectState (-6, false, false);
    });
    if (! bootReady) onLoop ([&] { std::cerr << "BOOT STATE " << choc::json::toString (view->state()) << std::endl; });
    require (bootReady, "boot state/native persistence/application did not converge");

    // The real rack worker hydrates the complete persisted lane. No raw
    // topology write races that owner or bypasses its parameter installation.
    require (processUntil (audio, observations, [] (const Snapshot& state) {
        return state.rackEnableMask == 1 && state.rackParamsSerial == 8 && state.rackRejected == 0;
    }), "the production rack owner did not enable the persisted filter");

    if (! onLoop ([&] { return patch.sendEventOrValueToPatch (
            cmaj::EndpointID::create (std::string_view { "macro1" }),
            choc::value::Value (1.0f), 0, sendTimeoutMilliseconds); }))
    {
        reportFailure ("could not set Macro 1 through the production patch endpoint",
                       takeSnapshot (observations));
        return 1;
    }

    const std::array<uint8_t, 3> noteOn { 0x90, 84, 127 };
    {
        const std::lock_guard<std::mutex> lock (playback.mutex);
        patch.addMIDIMessage (0, noteOn.data(), static_cast<uint32_t> (noteOn.size()));
    }
    const auto routedRms = audio.measureRms (256);
    const auto routedSnapshot = takeSnapshot (observations);

    auto changed = routedStoredState;
    const auto amountPosition = changed.find ("\"amount\": -6");
    require (amountPosition != std::string::npos, "fixture route amount missing");
    changed.replace (amountPosition, std::string ("\"amount\": -6").size(), "\"amount\": -0.5");
    command (choc::json::create ("kind", "edit", "key", "modulation.v6", "value", changed));
    require (processUntil (audio, observations, [&] (const Snapshot& state) {
        return state.acceptedModulationSerial == routedSnapshot.acceptedModulationSerial + 1
            && state.installedMacroRackRouteCount == 1 && expectState (-0.5f, true, false);
    }), "amount-only edit did not produce one actual DSP ACK and coherent saved state");
    const auto editedRms = audio.measureRms (256);
    const auto editedSnapshot = takeSnapshot (observations);
    command (choc::json::create ("kind", "undo"));
    require (processUntil (audio, observations, [&] (const Snapshot& state) {
        return state.acceptedModulationSerial == editedSnapshot.acceptedModulationSerial + 1
            && state.installedMacroRackRouteCount == 1 && expectState (-6, false, true);
    }), "shared Undo did not restore the original amount through one actual DSP ACK");
    const auto undoneRms = audio.measureRms (256);
    const auto finalState = takeSnapshot (observations);
    std::cerr << "MEASURE routed=" << routedRms << " edited=" << editedRms << " undone=" << undoneRms
        << " serials=" << routedSnapshot.acceptedModulationSerial << "," << editedSnapshot.acceptedModulationSerial << "," << finalState.acceptedModulationSerial << " rackMask=" << finalState.rackEnableMask << std::endl;
    require (std::isfinite (routedRms) && std::isfinite (editedRms) && std::isfinite (undoneRms)
        && editedRms > 0.0001 && editedRms > routedRms * 4.0 && editedRms > undoneRms * 4.0,
        "actual synth audio did not follow amount edit and Undo");
    require (finalState.rejectedSerial == 0 && finalState.rejectionReason == 0 && finalState.rejectedRouteCount == 0,
        "actual DSP rejected a modulation installation");
    require (hostEffects.load() >= 3, "real native articulation handler did not process hydration/edit/Undo");
    require (inputPushFailures.load() == 0, "native input enqueue failed during synth qualification");
    onLoop ([closingView = view.release()] { delete closingView; });
    audio.stop();
    unload.close();
    require (inputPushFailures.load() == 0, "native input enqueue failed during teardown");
    std::cout << "RESULT " << choc::json::toString (choc::json::create (
        "routedRms", routedRms, "editedRms", editedRms, "undoneRms", undoneRms,
        "rackParamsSerial", finalState.rackParamsSerial, "rackMask", finalState.rackEnableMask,
        "bootSerial", routedSnapshot.acceptedModulationSerial, "editSerial", editedSnapshot.acceptedModulationSerial,
        "undoSerial", finalState.acceptedModulationSerial, "hostEffects", hostEffects.load(),
        "inputPushFailures", inputPushFailures.load())) << std::endl;

    return 0;
}

int main (int argc, char** argv)
{
    if (argc != 4)
    {
        std::cerr << "Usage: " << argv[0] << " <libCmajPerformer> <WavetableSynth.cmajorpatch> <lane.json>\n";
        return 2;
    }

    choc::messageloop::initialise();
    std::atomic<int> result { 1 };

    auto probeThread = std::thread ([&]
    {
        try
        {
            result = runProbe (argv[1], argv[2], argv[3]);
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
