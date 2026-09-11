#define CMAJOR_DLL 1
#include "cmajor/helpers/cmaj_Patch.h"
#include "cmajor/helpers/cmaj_PatchWorker_QuickJS.h"
#include "choc/gui/choc_MessageLoop.h"
#if defined(COSIMO_SHARED_STATE_AOT)
 #include "cmajor/helpers/cmaj_GeneratedCppEngine.h"
 #define cmaj__data__read(...) ::cmaj::PatchSharedData::read (__VA_ARGS__)
 #define cmaj__data__readInt32(...) ::cmaj::PatchSharedData::readInt32 (__VA_ARGS__)
 #define cmaj__data__size(...) ::cmaj::PatchSharedData::size (__VA_ARGS__)
 #include "SharedStateDSP.h"
 #include "PluginState.h"
 #undef cmaj__data__read
 #undef cmaj__data__readInt32
 #undef cmaj__data__size

// This wrapper observes the generated author-facing native getter at the same
// real Patch audio scope as the compiled DSP, without installing another store.
thread_local auto observedSettings = PluginState::settings.readForAudioBlock();
thread_local std::uint64_t settingsReadCount = 0;
struct ObservedSharedStateDSP : SharedStateDSP
{
    void advance (std::int32_t frames)
    {
        observedSettings = PluginState::settings.readForAudioBlock();
        ++settingsReadCount;
        SharedStateDSP::advance (frames);
    }
};
#endif
#include <array>
#include <chrono>
#include <future>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <thread>
#include <vector>

namespace
{
using Value = choc::value::Value;
using View = choc::value::ValueView;
constexpr auto deadline = std::chrono::seconds (10);
void require (bool condition, const std::string& reason) { if (! condition) throw std::runtime_error (reason); }
Value envelope (const View& message) { return choc::json::create ("type", "kit_state", "message", message); }

// Observes the same native GUI protocol as an ordinary view. Editable state,
// preparation, history and transfer run in the actual generated QuickJS worker.
struct ObservingView final : cmaj::PatchView
{
    explicit ObservingView (cmaj::Patch& patch) : PatchView (patch) {}
    void sendMessage (const View& message) override
    {
        if (message["type"].toString() == "kit_state") messages.emplace_back (message["message"]);
    }
    Value last (const char* kind) const
    {
        for (auto item = messages.rbegin(); item != messages.rend(); ++item)
            if ((*item)["kind"].toString() == kind) return *item;
        return {};
    }
    Value state() const
    {
        for (auto item = messages.rbegin(); item != messages.rend(); ++item)
            if ((*item)["kind"].toString() == "attached" || (*item)["kind"].toString() == "update")
                return Value ((*item)["state"]);
        return {};
    }
    Value receipt (int64_t sequence) const
    {
        for (auto item = messages.rbegin(); item != messages.rend(); ++item)
        {
            const auto receipt = (*item)["kind"].toString() == "receipt" ? View (*item) : (*item)["receipt"];
            if (receipt.isObject() && receipt["address"].isObject() && receipt["address"]["client"].getWithDefault<int64_t> (-1) == client
                 && receipt["address"]["sequence"].getWithDefault<int64_t> (-1) == sequence)
                return Value (receipt["result"]);
        }
        return {};
    }
    std::vector<Value> messages;
    Value scope;
    int64_t client = 0, sequence = 0;
};

struct Fixture
{
    template <typename Fn> auto onLoop (Fn run)
    {
        using Result = std::invoke_result_t<Fn>;
        auto task = std::make_shared<std::packaged_task<Result()>> (std::move (run));
        auto result = task->get_future();
        choc::messageloop::postMessage ([task] { (*task)(); });
        require (result.wait_for (deadline) == std::future_status::ready, "native message loop timed out");
        return result.get();
    }

    std::array<float, 3> render()
    {
        std::array<std::array<float, 128>, 3> output {};
        float* channels[] { output[0].data(), output[1].data(), output[2].data() };
        patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
        lastAudio = { output[0].back(), output[1].back(), output[2].back() };
        return lastAudio;
    }

    template <typename Fn> void waitFor (Fn condition, const char* failure, bool progressAudio = true)
    {
        const auto until = std::chrono::steady_clock::now() + deadline;
        do
        {
            if (onLoop ([&]
            {
                require (workerError.empty(), "actual QuickJS worker failed: " + workerError);
                if (progressAudio) render();
                return condition();
            })) return;
            std::this_thread::sleep_for (std::chrono::milliseconds (2));
        } while (std::chrono::steady_clock::now() < until);
        throw std::runtime_error (std::string (failure) + ": " + onLoop ([&]
        { return view ? choc::json::toString (view->state()) : std::string ("no view"); }));
    }

    void load (const char* manifest)
    {
        onLoop ([&]
        {
            patch = std::make_unique<cmaj::Patch>();
            patch->createEngine = []
            {
               #if defined(COSIMO_SHARED_STATE_AOT)
                return cmaj::createEngineForGeneratedCppProgram<ObservedSharedStateDSP>();
               #else
                return cmaj::Engine::create();
               #endif
            };
            cmaj::enableQuickJSPatchWorker (*patch);
            patch->handleOutputEvent = [] (auto, auto, auto) {};
            patch->statusChanged = [this] (const cmaj::Patch::Status& status)
            {
                if (status.messageList.hasErrors()) workerError = status.messageList.toString();
            };
            patch->setPlaybackParams ({ 48000, 128, 0, 3 });
            cmaj::Patch::LoadParams params;
            params.manifest.initialiseWithFile (manifest);
            require (patch->loadPatch (params, true) && patch->isPlayable(), "generated shared-data patch did not load: " + workerError);
            view = std::make_unique<ObservingView> (*patch);
        });
        waitFor ([&] { const auto opened = view->last ("owner-changed"); return opened.isObject() && opened["scope"].isObject(); },
                 "generated worker did not open");
        attach();
    }

    void attach()
    {
        const auto request = onLoop ([&]
        {
            if (! view) view = std::make_unique<ObservingView> (*patch);
            const auto request = ++attachRequest;
            require (patch->handleClientMessage (*view, envelope (choc::json::create ("kind", "attach", "request", request))),
                     "native attach rejected");
            return request;
        });
        waitFor ([&] { const auto attached = view->last ("attached"); return attached.isObject() && attached["request"].getWithDefault<int64_t> (-1) == request; },
                 "view attach did not complete");
        onLoop ([&]
        {
            const auto attached = view->last ("attached");
            view->scope = Value (attached["scope"]);
            view->client = attached["client"].getWithDefault<int64_t> (0);
            view->sequence = 0;
            require (view->client > 0, "native view received no client identity");
        });
    }

    void command (const View& command)
    {
        const auto sequence = onLoop ([&]
        {
            const auto sequence = ++view->sequence;
            require (patch->handleClientMessage (*view, envelope (choc::json::create ("kind", "command", "scope", view->scope,
                "client", view->client, "sequence", sequence, "command", command))), "view command rejected by native channel");
            return sequence;
        });
        waitFor ([&] { return view->receipt (sequence).isObject(); }, "generated worker did not settle command");
        onLoop ([&] { require (view->receipt (sequence)["kind"].toString() == "accepted", "generated worker rejected command"); });
    }

    void endpoint (const char* name, int32_t value)
    {
        require (patch->sendEventOrValueToPatch (cmaj::EndpointID::create (std::string (name)), Value (value), 0, 0),
                 std::string ("reader endpoint rejected: ") + name);
    }

    void edit (const char* key, const View& value)
    {
        auto request = onLoop ([&]
        {
            return choc::json::create ("kind", "edit", "key", key, "value", value,
                "expectedVersion", view->state()["fields"][key]["version"]);
        });
        command (request);
    }

    void close()
    {
        onLoop ([&] { view.reset(); patch.reset(); });
    }

    std::unique_ptr<cmaj::Patch> patch;
    std::unique_ptr<ObservingView> view;
    std::string workerError;
    std::array<float, 3> lastAudio {};
    int64_t attachRequest = 0;
};

Value shape (bool descending)
{
    return choc::json::create ("format", "mseg.shape", "version", 1, "name", "MSEG 1", "globalSmooth", false,
        "points", choc::value::createArray (2, [&] (uint32_t index)
        {
            return choc::json::create ("x", static_cast<int32_t> (index),
                "y", static_cast<int32_t> (descending ? 1 - index : index), "curvePower", 0);
        }));
}

bool matchesShape (const View& value, bool descending)
{
    if (! value.isObject()) return false;
    const auto points = value["points"];
    return value["format"].toString() == "mseg.shape" && value["version"].getWithDefault<int> (0) == 1
        && value["name"].toString() == "MSEG 1" && value["globalSmooth"].isBool() && ! value["globalSmooth"].get<bool>()
        && points.isArray() && points.size() == 2
        && points[0]["x"].getWithDefault<double> (-1) == 0 && points[1]["x"].getWithDefault<double> (-1) == 1
        && points[0]["y"].getWithDefault<double> (-1) == (descending ? 1 : 0)
        && points[1]["y"].getWithDefault<double> (-1) == (descending ? 0 : 1)
        && points[0]["curvePower"].getWithDefault<double> (-1) == 0 && points[1]["curvePower"].getWithDefault<double> (-1) == 0;
}

float expectedSample (int32_t index, bool descending)
{
    if (index < 0 || index >= 2051) return 0;
    const auto phase = index == 0 ? 0.0 : index >= 2049 ? 1.0 : static_cast<double> (index - 1) / 2047.0;
    return static_cast<float> (descending ? 1.0 - phase : phase);
}

void expectApplied (Fixture& fixture, bool descending, float gain, bool shapeStored)
{
    fixture.waitFor ([&]
    {
        const auto state = fixture.view->state();
        const auto field = state["fields"]["shape"];
        const auto stored = fixture.patch->getFullStoredState();
        const auto saved = stored["values"]["shape"];
        const auto persistenceMatches = shapeStored ? matchesShape (saved, descending)
            : saved.isVoid() && field["persistence"]["kind"].toString() == "not-written";
        return matchesShape (field["value"], descending) && persistenceMatches
            && state["fields"]["gain"]["value"].getWithDefault<double> (-1) == gain
            && fixture.lastAudio[2] == gain
            && field["application"]["kind"].toString() == "acknowledged";
    }, "editable/native/shared-data application did not converge");
}

Value checkpoint (Fixture& fixture, const char* name, bool descending, float gain, bool canUndo, bool canRedo, bool shapeStored = true)
{
    expectApplied (fixture, descending, gain, shapeStored);
    return fixture.onLoop ([&]
    {
        const auto state = fixture.view->state();
        require (state["history"]["canUndo"].getWithDefault<bool> (! canUndo) == canUndo
            && state["history"]["canRedo"].getWithDefault<bool> (! canRedo) == canRedo,
            std::string (name) + ": shared Undo/Redo frontier was wrong");
        const auto scope = fixture.view->scope;
        const auto session = scope["owner"].toString() + ":" + std::to_string (scope["document"].get<int64_t>());
        require (state["fields"]["shape"]["application"]["engineSession"].toString() == session,
                 std::string (name) + ": acknowledged application belongs to another document");
        auto actual = choc::value::createEmptyArray();
        for (int32_t index = -1; index <= 2052; ++index)
        {
            fixture.endpoint ("readIndex", index);
            const auto output = fixture.render();
            require (output[0] == expectedSample (index, descending),
                     std::string (name) + ": actual sample mismatch at index " + std::to_string (index)
                        + ", heard " + std::to_string (output[0]) + ", expected " + std::to_string (expectedSample (index, descending)));
            require (output[1] == 2051 && output[2] == gain, std::string (name) + ": actual size or gain mismatch");
            actual.addArrayElement (output[0]);
        }
        return choc::json::create ("name", name, "state", state, "scope", scope, "client", fixture.view->client,
                                  "samplesIncludingBounds", actual, "sampleCount", 2051, "gain", gain);
    });
}

Value settingsCheckpoint (Fixture& fixture, const char* name, float amount, bool enabled, bool warm)
{
    fixture.waitFor ([&]
    {
        const auto state = fixture.view->state();
        const auto field = state["fields"]["settings"];
        const auto value = field["value"];
        const bool editableMatches = value["amount"].getWithDefault<float> (-1) == amount
            && value["enabled"].isBool() && value["enabled"].get<bool>() == enabled
            && value["mode"].toString() == (warm ? "warm" : "clean")
            && field["application"]["kind"].toString() == "acknowledged";
       #if defined(COSIMO_SHARED_STATE_AOT)
        return editableMatches && settingsReadCount > 0 && observedSettings.amount == amount
            && observedSettings.enabled == enabled
            && observedSettings.mode == (warm ? decltype(observedSettings.mode)::warm : decltype(observedSettings.mode)::clean);
       #else
        return editableMatches;
       #endif
    }, "generated native setting did not reach its declared application and reader");
    return fixture.onLoop ([&]
    {
        auto result = choc::json::create ("name", name, "field", fixture.view->state()["fields"]["settings"]);
       #if defined(COSIMO_SHARED_STATE_AOT)
        result.addMember ("compiledNativeValue", choc::json::create ("amount", observedSettings.amount,
            "enabled", observedSettings.enabled, "mode", observedSettings.mode == decltype(observedSettings.mode)::warm ? "warm" : "clean"));
       #endif
        return result;
    });
}

void exercise (Fixture& fixture, const char* manifest)
{
    auto checkpoints = choc::value::createEmptyArray();
    fixture.load (manifest);
    checkpoints.addArrayElement (checkpoint (fixture, "hydrated", false, 1, false, false, false));
    fixture.edit ("gain", Value (0.5f));
    checkpoints.addArrayElement (checkpoint (fixture, "gain-edited", false, 0.5f, true, false, false));
    fixture.edit ("shape", shape (true));
    checkpoints.addArrayElement (checkpoint (fixture, "shape-edited", true, 0.5f, true, false));
    fixture.command (choc::json::create ("kind", "undo"));
    checkpoints.addArrayElement (checkpoint (fixture, "shape-undone", false, 0.5f, true, true));
    fixture.command (choc::json::create ("kind", "undo"));
    checkpoints.addArrayElement (checkpoint (fixture, "gain-undone", false, 1, false, true));
    fixture.command (choc::json::create ("kind", "redo"));
    checkpoints.addArrayElement (checkpoint (fixture, "gain-redone", false, 0.5f, true, true));
    fixture.command (choc::json::create ("kind", "redo"));
    checkpoints.addArrayElement (checkpoint (fixture, "shape-redone", true, 0.5f, true, false));

    const auto beforeReopen = fixture.onLoop ([&]
    {
        auto saved = choc::json::create ("scope", fixture.view->scope, "client", fixture.view->client,
            "application", fixture.view->state()["fields"]["shape"]["application"]);
        fixture.view.reset();
        fixture.render();
        return saved;
    });
    fixture.attach();
    auto reopened = checkpoint (fixture, "reopened", true, 0.5f, true, false);
    require (reopened["scope"]["owner"].toString() == beforeReopen["scope"]["owner"].toString()
        && reopened["scope"]["document"].get<int64_t>() == beforeReopen["scope"]["document"].get<int64_t>(),
        "GUI reopen recreated the state owner/document");
    require (reopened["client"].get<int64_t>() != beforeReopen["client"].get<int64_t>(), "GUI reopen reused client incarnation");
    require (reopened["state"]["fields"]["shape"]["application"]["operation"].toString()
              == beforeReopen["application"]["operation"].toString(), "GUI reopen needlessly installed the curve again");
    checkpoints.addArrayElement (reopened);

    fixture.onLoop ([&] { fixture.patch->resetToInitialState(); });
    fixture.waitFor ([&]
    {
        const auto reset = fixture.view->last ("reset");
        return reset.isObject() && reset["scope"].isObject() && reset["scope"]["document"].getWithDefault<int64_t> (-1)
            > beforeReopen["scope"]["document"].get<int64_t>();
    }, "public Performer reset did not advance document scope");
    fixture.attach();
    auto reset = checkpoint (fixture, "reset", true, 1, false, false);
    require (reset["scope"]["owner"].toString() == reopened["scope"]["owner"].toString(), "Performer reset replaced worker identity");
    require (reset["state"]["fields"]["shape"]["application"]["engineSession"].toString()
              != reopened["state"]["fields"]["shape"]["application"]["engineSession"].toString(),
             "Performer reset reused old application evidence");
    checkpoints.addArrayElement (reset);
    auto settings = choc::value::createEmptyArray();
    settings.addArrayElement (settingsCheckpoint (fixture, "settings-hydrated-after-reset", 1, true, false));
    fixture.edit ("settings", choc::json::create ("amount", 1.5f, "enabled", false, "mode", "warm"));
    settings.addArrayElement (settingsCheckpoint (fixture, "settings-edited", 1.5f, false, true));
    fixture.command (choc::json::create ("kind", "undo"));
    settings.addArrayElement (settingsCheckpoint (fixture, "settings-undone", 1, true, false));
    fixture.command (choc::json::create ("kind", "redo"));
    settings.addArrayElement (settingsCheckpoint (fixture, "settings-redone", 1.5f, false, true));
   #if defined(COSIMO_SHARED_STATE_AOT)
    const char* renderer = "actual compiled native Cmajor";
   #else
    const char* renderer = "actual native Cmajor JIT";
   #endif
    std::cout << "RESULT " << choc::json::toString (choc::json::create ("checkpoints", checkpoints,
        "verifiedSamples", 9 * 2054, "worker", "actual generated QuickJS", "renderer", renderer, "settings", settings)) << '\n';
}
}

int main (int argc, char** argv)
{
    if (argc != 3) { std::cerr << "Usage: PluginStateSharedDataProbe CMAJOR_RUNTIME_LIBRARY GENERATED_MANIFEST\n"; return 2; }
    choc::messageloop::initialise();
    if (! cmaj::Library::initialise (argv[1])) { std::cerr << "Cmajor runtime load failed\n"; return 1; }
    int result = 1;
    std::thread orchestration ([&]
    {
        Fixture fixture;
        try { exercise (fixture, argv[2]); result = 0; }
        catch (const std::exception& error) { std::cerr << "FAIL: " << error.what() << '\n'; }
        try { fixture.close(); }
        catch (const std::exception& error) { std::cerr << "CLEANUP FAIL: " << error.what() << '\n'; result = 1; }
        choc::messageloop::stop();
    });
    choc::messageloop::run();
    orchestration.join();
    cmaj::Library::shutdown();
    return result;
}
