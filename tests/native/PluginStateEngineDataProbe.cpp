#include <array>
#include <chrono>
#include <future>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>
#include "cmajor/helpers/cmaj_Patch.h"
#include "cmajor/helpers/cmaj_PatchWorker_QuickJS.h"
#include "choc/gui/choc_MessageLoop.h"

namespace
{
#ifndef ENGINE_DATA_WORD_COUNT
 #define ENGINE_DATA_WORD_COUNT 257
#endif
constexpr int wordCount = ENGINE_DATA_WORD_COUNT;
using Value = choc::value::Value;
using View = choc::value::ValueView;
constexpr auto deadline = std::chrono::seconds (8);
void require (bool condition, const std::string& message) { if (! condition) throw std::runtime_error (message); }
Value envelope (const View& message) { return choc::json::create ("type", "kit_state", "message", message); }

// Actual native messages only. The generated QuickJS worker owns all editable
// state and history; no worker context or DSP receipt implementation is injected.
struct RecordingView final : cmaj::PatchView
{
    explicit RecordingView (cmaj::Patch& patch) : PatchView (patch) {}
    void sendMessage (const View& message) override
    {
        if (message["type"].toString() == "kit_state") bodies.emplace_back (message["message"]);
    }
    Value last (const char* kind) const
    {
        for (auto item = bodies.rbegin(); item != bodies.rend(); ++item)
            if ((*item)["kind"].toString() == kind) return *item;
        return {};
    }
    Value state() const
    {
        for (auto item = bodies.rbegin(); item != bodies.rend(); ++item)
            if ((*item)["kind"].toString() == "attached" || (*item)["kind"].toString() == "update")
                return Value ((*item)["state"]);
        return {};
    }
    Value receipt (int64_t sequence) const
    {
        for (auto item = bodies.rbegin(); item != bodies.rend(); ++item)
        {
            const auto receipt = (*item)["kind"].toString() == "receipt" ? View (*item) : (*item)["receipt"];
            if (receipt.isObject() && receipt["address"].isObject()
                && receipt["address"]["client"].getWithDefault<double> (-1) == client
                && receipt["address"]["sequence"].getWithDefault<double> (-1) == sequence)
                return Value (receipt["result"]);
        }
        return {};
    }
    std::vector<Value> bodies;
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
        require (result.wait_for (deadline) == std::future_status::ready, "native loop did not respond");
        return result.get();
    }
    std::array<float, 3> render()
    {
        std::array<std::array<float, 128>, 3> output {};
        float* channels[] { output[0].data(), output[1].data(), output[2].data() };
        patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
        return { output[0].back(), output[1].back(), output[2].back() };
    }
    template <typename Fn> void waitFor (Fn condition, const char* failure)
    {
        const auto until = std::chrono::steady_clock::now() + deadline;
        do
        {
            if (onLoop ([&]
            {
                require (workerError.empty(), "actual worker or DSP failed: " + workerError);
                render(); // Real audio progress produces the receiver's events.
                return condition();
            })) return;
            // Bounded orchestration polling permits real queued worker/output
            // callbacks to run; it never manufactures an acknowledgement.
            std::this_thread::sleep_for (std::chrono::milliseconds (2));
        } while (std::chrono::steady_clock::now() < until);
        const auto observed = onLoop ([&] { return view ? choc::json::toString (view->state()) : "no view"; });
        throw std::runtime_error (std::string (failure) + ": " + observed);
    }
    void load (const char* manifest)
    {
        onLoop ([&]
        {
            patch = std::make_unique<cmaj::Patch>();
            patch->createEngine = [] { return cmaj::Engine::create(); };
            cmaj::enableQuickJSPatchWorker (*patch);
            patch->handleOutputEvent = [this] (uint64_t, std::string_view endpoint, const View& value)
            {
                if (endpoint == "receipt") receipts.emplace_back (value);
            };
            patch->statusChanged = [this] (const cmaj::Patch::Status& status)
            {
                if (status.messageList.hasErrors())
                {
                    workerError = status.messageList.toString();
                    workerErrors.push_back (workerError);
                }
            };
            patch->setPlaybackParams ({ 48000, 128, 0, 3 });
            cmaj::Patch::LoadParams params;
            params.manifest.initialiseWithFile (manifest);
            require (patch->loadPatch (params, true) && patch->isPlayable(), "generated engine-data patch did not load");
            patch->setStoredStateValue ("shape", choc::json::create ("base", -700001, "step", 997));
            view = std::make_unique<RecordingView> (*patch);
        });
        waitFor ([&] { const auto opened = view->last ("owner-changed"); return opened.isObject() && opened["scope"].isObject(); }, "generated worker did not open");
        attach();
    }
    void attach()
    {
        const auto request = onLoop ([&]
        {
            if (! view) view = std::make_unique<RecordingView> (*patch);
            const auto request = ++attachRequest;
            require (patch->handleClientMessage (*view, envelope (choc::json::create ("kind", "attach", "request", request))), "native attach refused");
            return request;
        });
        waitFor ([&] { const auto attached = view->last ("attached"); return attached.isObject() && attached["request"].getWithDefault<double> (-1) == request; }, "generated worker did not attach view");
        onLoop ([&]
        {
            const auto attached = view->last ("attached");
            view->scope = Value (attached["scope"]);
            view->client = static_cast<int64_t> (attached["client"].getWithDefault<double> (0));
            view->sequence = 0;
            require (view->client > 0, "native did not assign a client incarnation");
        });
    }
    void command (const char* json)
    {
        const auto sequence = onLoop ([&]
        {
            const auto sequence = ++view->sequence;
            const auto body = choc::json::create ("kind", "command", "scope", view->scope, "client", view->client,
                "sequence", sequence, "command", choc::json::parse (json));
            require (patch->handleClientMessage (*view, envelope (body)), "native rejected a well-formed view command");
            return sequence;
        });
        waitFor ([&] { return view->receipt (sequence).isObject(); }, "actual worker did not settle command");
        onLoop ([&] { require (view->receipt (sequence)["kind"].toString() == "accepted", "editable command was not accepted"); });
    }
    void expectApplied (int base, int step)
    {
        waitFor ([&]
        {
            const auto state = view->state();
            if (! state.isObject()) return false;
            const auto field = state["fields"]["shape"];
            const auto stored = patch->getFullStoredState();
            return field["value"]["base"].getWithDefault<double> (9999999) == base
                && field["value"]["step"].getWithDefault<double> (9999999) == step
                && stored["values"]["shape"]["base"].getWithDefault<double> (9999999) == base
                && stored["values"]["shape"]["step"].getWithDefault<double> (9999999) == step
                && field["application"]["kind"].toString() == "acknowledged";
        }, "actual editable/native/engine state did not converge");
    }
    void endpoint (const char* name, int value)
    {
        require (patch->sendEventOrValueToPatch (cmaj::EndpointID::create (std::string (name)), Value (value), 0, 0), "public reader endpoint refused");
    }
    Value checkpoint (const char* name)
    {
        return onLoop ([&]
        {
            auto current = choc::value::createEmptyArray();
            auto held = choc::value::createEmptyArray();
            for (int index = 0; index < wordCount; ++index)
            {
                endpoint ("readIndex", index);
                const auto sample = render();
                current.addArrayElement (sample[0]);
                held.addArrayElement (sample[1]);
            }
            return choc::json::create ("name", name, "state", view->state(), "scope", view->scope,
                "client", view->client, "current", current, "held", held);
        });
    }
    void close() { onLoop ([&] { view.reset(); patch.reset(); }); }
    std::unique_ptr<cmaj::Patch> patch;
    std::unique_ptr<RecordingView> view;
    int64_t attachRequest = 0;
    std::vector<Value> receipts;
    std::string workerError;
    std::vector<std::string> workerErrors;
};
}

int main (int argc, char** argv)
{
    if (argc != 3 && argc != 4) { std::cerr << "Usage: PluginStateEngineDataProbe <runtime-library> <generated-patch> [--expect-boot-error|--reset]\n"; return 2; }
    choc::messageloop::initialise();
    if (! cmaj::Library::initialise (argv[1])) { std::cerr << "Runtime load failed\n"; return 1; }
    int result = 1;
    std::thread orchestration ([&]
    {
        Fixture fixture;
        try
        {
            if (argc == 4 && std::string (argv[3]) == "--expect-boot-error")
            {
                bool failed = false;
                try { fixture.load (argv[2]); }
                catch (const std::exception&) { failed = true; }
                require (failed, "invalid authored worker unexpectedly opened");
                fixture.onLoop ([&]
                {
                    // Exercise the real native-to-worker path after the module
                    // import failed, when WorkerPatchConnection was never made.
                    fixture.patch->broadcastMessageToViews ("probe_after_boot_failure", choc::json::create ("value", 1));
                });
                auto errors = fixture.onLoop ([&]
                {
                    auto captured = choc::value::createEmptyArray();
                    for (const auto& error : fixture.workerErrors) captured.addArrayElement (error);
                    return captured;
                });
                std::cout << "RESULT " << choc::json::toString (choc::json::create ("bootErrors", errors)) << '\n';
                result = 0;
            }
            else
            {
            auto checkpoints = choc::value::createEmptyArray();
            fixture.load (argv[2]);
            fixture.expectApplied (-700001, 997);
            fixture.onLoop ([&] { fixture.endpoint ("holdReader", 0); fixture.render(); });
            checkpoints.addArrayElement (fixture.checkpoint ("hydrated"));
            fixture.command (R"({"kind":"edit","key":"shape","value":{"base":300007,"step":-613},"expectedVersion":0})");
            fixture.expectApplied (300007, -613);
            checkpoints.addArrayElement (fixture.checkpoint ("edited"));
            fixture.command (R"({"kind":"undo"})");
            fixture.expectApplied (-700001, 997);
            checkpoints.addArrayElement (fixture.checkpoint ("undone"));
            fixture.onLoop ([&] { fixture.view.reset(); for (int block = 0; block < 4; ++block) fixture.render(); });
            fixture.attach();
            fixture.expectApplied (-700001, 997);
            checkpoints.addArrayElement (fixture.checkpoint ("reopened"));
            if (argc == 4 && std::string (argv[3]) == "--reset")
            {
                const auto previousScope = fixture.onLoop ([&]
                {
                    const auto scope = fixture.view->scope;
                    // The real public reset replaces the Performer while the
                    // generated worker and the saved editable value survive.
                    fixture.patch->resetToInitialState();
                    return scope;
                });
                fixture.waitFor ([&]
                {
                    const auto reset = fixture.view->last ("reset");
                    return reset.isObject()
                        && reset["scope"]["document"].getWithDefault<double> (-1)
                            > previousScope["document"].getWithDefault<double> (-1);
                }, "real performer reset did not invalidate the previous application evidence");
                fixture.attach();
                fixture.expectApplied (-700001, 997);
                checkpoints.addArrayElement (fixture.checkpoint ("reset"));
            }
            auto receipts = choc::value::createEmptyArray();
            fixture.onLoop ([&] { for (const auto& receipt : fixture.receipts) receipts.addArrayElement (receipt); });
            std::cout << "RESULT " << choc::json::toString (choc::json::create ("checkpoints", checkpoints, "receipts", receipts)) << '\n';
            result = 0;
            }
        }
        catch (const std::exception& error) { std::cerr << "FAIL: " << error.what() << '\n'; }
        fixture.close();
        choc::messageloop::stop();
    });
    choc::messageloop::run();
    orchestration.join();
    cmaj::Library::shutdown();
    return result;
}
