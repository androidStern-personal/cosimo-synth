#include <array>
#include <chrono>
#include <cmath>
#include <functional>
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
using Value = choc::value::Value;
using View = choc::value::ValueView;
constexpr auto deadline = std::chrono::seconds (6);

void require (bool condition, const std::string& message)
{
    if (! condition)
        throw std::runtime_error (message);
}

Value envelope (const View& body) { return choc::json::create ("type", "kit_state", "message", body); }
cmaj::EndpointID gainID() { return cmaj::EndpointID::create (std::string ("gain")); }

// QuickJS serializes some integral numbers as doubles. Compare the wire
// domain, not CHOC's allocation/type representation of equivalent JSON.
bool sameScope (const View& left, const View& right)
{
    return left.isObject() && right.isObject() && left["owner"].toString() == right["owner"].toString()
        && left["document"].getWithDefault<double> (-1) == right["document"].getWithDefault<double> (-2);
}

bool sameAddress (const View& left, const View& right)
{
    return sameScope (left, right)
        && left["client"].getWithDefault<double> (-1) == right["client"].getWithDefault<double> (-2)
        && left["sequence"].getWithDefault<double> (-1) == right["sequence"].getWithDefault<double> (-2);
}

bool pointsEqual (const View& curve, const std::vector<double>& expected)
{
    const auto points = curve["points"];
    if (! points.isArray() || points.size() != expected.size())
        return false;
    for (size_t index = 0; index < expected.size(); ++index)
        if (points[static_cast<uint32_t> (index)].getWithDefault<double> (999) != expected[index])
            return false;
    return true;
}

// This records only actual messages delivered by Patch to an ordinary view.
// The owner and every owner reply execute in the generated QuickJS worker.
struct RecordingView final : cmaj::PatchView
{
    explicit RecordingView (cmaj::Patch& patch) : PatchView (patch) {}

    void sendMessage (const View& message) override
    {
        if (message["type"].toString() == "kit_state")
            bodies.emplace_back (message["message"]);
        if (changed)
            changed();
    }

    Value last (const char* kind) const
    {
        for (auto message = bodies.rbegin(); message != bodies.rend(); ++message)
            if ((*message)["kind"].toString() == kind)
                return *message;
        return {};
    }

    Value state() const
    {
        for (auto message = bodies.rbegin(); message != bodies.rend(); ++message)
            if ((*message)["kind"].toString() == "attached" || (*message)["kind"].toString() == "update")
                return Value ((*message)["state"]);
        return {};
    }

    Value receipt (const View& address) const
    {
        for (auto message = bodies.rbegin(); message != bodies.rend(); ++message)
        {
            const auto candidate = (*message)["kind"].toString() == "receipt" ? View (*message) : (*message)["receipt"];
            if (candidate.isObject() && sameAddress (candidate["address"], address))
                return Value (candidate["result"]);
        }
        return {};
    }

    std::vector<Value> bodies;
    std::function<void()> changed;
    Value scope;
    int64_t client = 0, sequence = 0;
};

// Every Patch operation and recording read runs on the real native message
// loop. The orchestration thread waits for observable messages, never sleeps.
struct Fixture
{
    template <typename Fn> auto onLoop (Fn run)
    {
        using Result = std::invoke_result_t<Fn>;
        auto task = std::make_shared<std::packaged_task<Result()>> (std::move (run));
        auto result = task->get_future();
        choc::messageloop::postMessage ([task] { (*task)(); });
        require (result.wait_for (deadline) == std::future_status::ready, "native message-loop operation timed out");
        return result.get();
    }

    void waitFor (std::function<bool()> condition, const char* failure)
    {
        auto done = std::make_shared<std::promise<void>>();
        auto result = done->get_future();
        onLoop ([&, done, condition = std::move (condition)]
        {
            changed = [this, done, condition, settled = false] () mutable
            {
                if (settled)
                    return;
                try
                {
                    require (workerError.empty(), "actual QuickJS worker failed: " + workerError);
                    if (! condition())
                        return;
                    settled = true;
                    done->set_value();
                }
                catch (...)
                {
                    settled = true;
                    done->set_exception (std::current_exception());
                }
            };
            changed();
        });
        const auto status = result.wait_for (deadline);
        const auto context = onLoop ([&]
        {
            changed = {};
            return workerError.empty() ? std::string() : ": " + workerError;
        });
        require (status == std::future_status::ready, failure + context);
        result.get();
    }

    void notify() { if (changed) changed(); }

    void newView (std::unique_ptr<RecordingView>& view)
    {
        view = std::make_unique<RecordingView> (*patch);
        view->changed = [this] { notify(); };
    }

    void load (const char* patchPath)
    {
        onLoop ([&]
        {
            patch = std::make_unique<cmaj::Patch>();
            patch->createEngine = [] { return cmaj::Engine::create(); };
            cmaj::enableQuickJSPatchWorker (*patch);
            patch->handleOutputEvent = [] (uint64_t, std::string_view, const View&) {};
            patch->statusChanged = [this] (const cmaj::Patch::Status& status)
            {
                if (status.messageList.hasErrors())
                    workerError = status.messageList.toString();
                notify();
            };
            patch->setPlaybackParams ({ 48000, 128, 0, 1 });
            cmaj::Patch::LoadParams params;
            params.manifest.initialiseWithFile (patchPath);
            require (patch->loadPatch (params, true) && patch->isPlayable(), "production fixture did not load");
            auto gain = patch->findParameter (gainID());
            require (gain != nullptr && gain->setValue (2.5f, true, -1, 0), "could not set the live pre-GUI parameter");
            gain->gestureStart = [this] { gestures.push_back ("begin"); };
            gain->gestureEnd = [this] { gestures.push_back ("end"); };
            patch->setStoredStateValue ("curve", choc::json::parse (R"({"points":[0,0.25,1]})"));
            newView (a);
            newView (b);
        });
        waitFor ([&] { return a->last ("owner-changed")["scope"].isObject(); }, "production worker never opened its native owner");
        attach (a);
        attach (b);
    }

    void attach (std::unique_ptr<RecordingView>& view)
    {
        const auto request = onLoop ([&]
        {
            if (! view)
                newView (view);
            const auto id = ++attachRequest;
            require (patch->handleClientMessage (*view, envelope (choc::json::create ("kind", "attach", "request", id))),
                     "actual view attach was not handled");
            return id;
        });
        waitFor ([&] { return view->last ("attached")["request"].getWithDefault<int64_t> (0) == request; }, "actual worker did not answer view attach");
        onLoop ([&]
        {
            const auto attached = view->last ("attached");
            view->scope = Value (attached["scope"]);
            view->client = attached["client"].getWithDefault<int64_t> (0);
            view->sequence = 0;
            require (view->client > 0, "native did not assign the view incarnation");
        });
    }

    // Returns the actual native address. A routed command is only submitted;
    // receipt()/native state below establish acceptance and persistence.
    Value submit (RecordingView& view, const View& command)
    {
        const auto sequence = ++view.sequence;
        auto address = choc::json::create ("owner", view.scope["owner"], "document", view.scope["document"],
                                           "client", view.client, "sequence", sequence);
        require (patch->handleClientMessage (view, envelope (choc::json::create (
            "kind", "command", "scope", view.scope, "client", view.client, "sequence", sequence, "command", command))),
            "native refused a well-formed GUI command");
        return address;
    }

    void command (std::unique_ptr<RecordingView>& view, const char* json)
    {
        const auto address = onLoop ([&] { return submit (*view, choc::json::parse (json)); });
        try
        {
            waitFor ([&] { return view->receipt (address).isObject(); }, "real worker did not settle the GUI command");
        }
        catch (...)
        {
            onLoop ([&]
            {
                std::cerr << "Unsettled command " << json << " at " << choc::json::toString (address) << '\n';
                for (const auto& body : view->bodies)
                    std::cerr << "Observed " << choc::json::toString (body) << '\n';
            });
            throw;
        }
        onLoop ([&]
        {
            const auto result = view->receipt (address);
            require (result["kind"].toString() == "accepted", "worker rejected " + std::string (json) + ": " + choc::json::toString (result));
        });
    }

    void expectValues (double gain, const std::vector<double>& curve)
    {
        waitFor ([&]
        {
            const auto matches = [&] (const std::unique_ptr<RecordingView>& view)
            {
                return ! view || (view->state()["fields"]["gain"]["value"].getWithDefault<double> (999) == gain
                    && pointsEqual (view->state()["fields"]["curve"]["value"], curve));
            };
            return matches (a) && matches (b) && patch->findParameter (gainID())->currentValue == gain
                && pointsEqual (patch->getFullStoredState()["values"]["curve"], curve);
        }, "GUI projections and actual native state did not converge");
        float lastOutput = 999;
        try
        {
            waitFor ([&]
            {
                const auto state = (a ? a : b)->state();
                const auto application = state["fields"]["curve"]["application"];
                // The ordinary author preparation adds all points and a captured
                // gain dependency. Audio output independently proves both the
                // actual native parameter and the generated event reached DSP.
                auto expected = gain * 1.1;
                for (const auto point : curve)
                    expected += point;
                std::array<float, 128> output {};
                float* channels[] { output.data() };
                for (int block = 0; block < 32; ++block)
                    patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
                lastOutput = output.back();
                return application.isObject() && application["kind"].toString() == "sent"
                    && application["proof"].toString() == "native-publication-processed"
                    && std::abs (lastOutput - expected) < 0.0001;
            }, "declared preparation/dependencies did not reach actual DSP with truthful send-only evidence");
        }
        catch (...)
        {
            onLoop ([&]
            {
                std::cerr << "Engine convergence failed for gain " << gain << ", last DSP sample " << lastOutput
                          << ", actual state " << choc::json::toString ((a ? a : b)->state()) << '\n';
            });
            throw;
        }
    }

    void close()
    {
        onLoop ([&]
        {
            changed = {};
            a.reset();
            b.reset();
            patch.reset();
        });
    }

    std::unique_ptr<cmaj::Patch> patch;
    std::unique_ptr<RecordingView> a, b;
    int64_t attachRequest = 0;
    std::string workerError;
    std::vector<std::string> gestures;
    std::function<void()> changed;
};

void testBoot (Fixture& f)
{
    f.expectValues (2.5, { 0, 0.25, 1 });
    f.onLoop ([&]
    {
        const auto state = f.a->state();
        const auto gain = state["fields"]["gain"];
        require (gain["metadata"]["defaultValue"].getWithDefault<double> (999) == 1
                 && gain["metadata"]["min"].getWithDefault<double> (999) == -12
                 && gain["metadata"]["max"].getWithDefault<double> (999) == 12
                 && gain["metadata"]["step"].getWithDefault<double> (999) == 0.5,
                 "real owner confused live host value with parameter metadata");
        require (state["fields"]["curve"]["persistence"]["kind"].toString() == "observed-in-native-state",
                 "boot did not retain native storage evidence");
        require (! state["history"]["canUndo"].getWithDefault<bool> (true), "initial hydration created history");
        require (f.a->client != f.b->client && sameScope (f.a->scope, f.b->scope), "views did not share one owner with distinct clients");
    });
    std::cout << "PASS: production public-Kit worker boots in actual QuickJS from live host and stored state\n";
}

void testGestureAndSharedHistory (Fixture& f)
{
    f.command (f.a, R"({"kind":"begin","key":"curve","gesture":1})");
    f.command (f.a, R"({"kind":"edit","key":"curve","gesture":1,"value":{"points":[0,0.4,1]}})");
    f.expectValues (2.5, { 0, 0.4, 1 });
    f.command (f.a, R"({"kind":"edit","key":"curve","gesture":1,"value":{"points":[0,0.8,1]}})");
    f.command (f.a, R"({"kind":"end","key":"curve","gesture":1})");
    f.expectValues (2.5, { 0, 0.8, 1 });
    f.command (f.b, R"({"kind":"undo"})");
    f.expectValues (2.5, { 0, 0.25, 1 });
    f.onLoop ([&] { require (! f.a->state()["history"]["canUndo"].getWithDefault<bool> (true), "one gesture created multiple Undo entries"); });
    f.command (f.b, R"({"kind":"redo"})");
    f.expectValues (2.5, { 0, 0.8, 1 });
    f.command (f.a, R"({"kind":"begin","key":"gain","gesture":2})");
    f.command (f.a, R"({"kind":"edit","key":"gain","gesture":2,"value":5.5})");
    f.expectValues (5.5, { 0, 0.8, 1 });
    f.command (f.a, R"({"kind":"edit","key":"gain","gesture":2,"value":6.5})");
    f.command (f.a, R"({"kind":"end","key":"gain","gesture":2})");
    f.expectValues (6.5, { 0, 0.8, 1 });
    f.waitFor ([&] { return f.a->state()["fields"]["gain"]["application"]["proof"].toString() == "native-publication-processed"; },
               "scalar publication completion was not reported");
    f.onLoop ([&]
    {
        const auto snapshot = f.a->state();
        const auto application = snapshot["fields"]["gain"]["application"];
        require (application["kind"].toString() == "sent", "native send-only evidence was mislabeled as engine acknowledgement");
        require (f.gestures == std::vector<std::string> { "begin", "end" }, "scalar gesture did not use actual host gesture callbacks");
    });
    f.command (f.b, R"({"kind":"undo"})");
    f.expectValues (2.5, { 0, 0.8, 1 });
    f.command (f.b, R"({"kind":"undo"})");
    f.expectValues (2.5, { 0, 0.25, 1 });
    std::cout << "PASS: live gesture edits, one-entry shared Undo/Redo, host gestures and scalar DSP delivery\n";
}

void testHostAutomation (Fixture& f)
{
    f.onLoop ([&] { require (f.patch->findParameter (gainID())->setValue (-3.5f, true, -1, 0), "native host automation failed"); });
    f.expectValues (-3.5, { 0, 0.25, 1 });
    f.onLoop ([&] { require (! f.a->state()["history"]["canUndo"].getWithDefault<bool> (true), "host automation became an Undo entry"); });
    f.command (f.b, R"({"kind":"edit","key":"gain","value":4.5})");
    f.expectValues (4.5, { 0, 0.25, 1 });
    f.command (f.a, R"({"kind":"undo"})");
    f.expectValues (-3.5, { 0, 0.25, 1 });
    std::cout << "PASS: actual host automation updates both clients and supplies the next edit's Undo baseline\n";
}

void testCloseAndReopen (Fixture& f)
{
    const auto owner = f.onLoop ([&] { return f.a->scope; });
    const auto gesturesBefore = f.onLoop ([&] { return f.gestures.size(); });
    f.command (f.a, R"({"kind":"begin","key":"gain","gesture":3})");
    f.command (f.a, R"({"kind":"edit","key":"gain","gesture":3,"value":2})");
    f.onLoop ([&] { f.a.reset(); f.b.reset(); });
    f.attach (f.a);
    f.expectValues (2, { 0, 0.25, 1 });
    f.onLoop ([&]
    {
        require (sameScope (f.a->scope, owner), "closing every GUI destroyed the QuickJS state owner");
        require (! f.a->state()["fields"]["gain"].hasObjectMember ("gesture"), "closed GUI left its gesture active");
        require (f.gestures.size() == gesturesBefore + 2 && f.gestures[gesturesBefore] == "begin"
                 && f.gestures.back() == "end", "native view destruction left the host gesture open");
    });
    f.command (f.a, R"({"kind":"undo"})");
    f.expectValues (-3.5, { 0, 0.25, 1 });
    f.onLoop ([&]
    {
        f.submit (*f.a, choc::json::parse (R"({"kind":"edit","key":"curve","value":{"points":[0,0.9,1]}})"));
        // Teardown immediately after native routing, before any JS receipt has
        // returned. Only subsequent real state establishes what was saved.
        f.a.reset();
    });
    f.attach (f.b);
    f.expectValues (-3.5, { 0, 0.9, 1 });
    f.onLoop ([&] { require (sameScope (f.b->scope, owner), "routed edit restarted the owner during GUI closure"); });
    f.command (f.b, R"({"kind":"undo"})");
    f.expectValues (-3.5, { 0, 0.25, 1 });
    f.attach (f.a);
    std::cout << "PASS: GUI closure seals gestures; owner/history and a natively routed edit survive every GUI closing\n";
}

void testFullRestore (Fixture& f)
{
    const auto gesturesBefore = f.onLoop ([&] { return f.gestures.size(); });
    f.command (f.a, R"({"kind":"begin","key":"gain","gesture":4})");
    const auto oldScope = f.onLoop ([&]
    {
        auto old = f.a->scope;
        require (f.patch->findParameter (gainID())->setValue (8.5f, true, -1, 0), "pre-restore host FIFO update failed");
        f.submit (*f.a, choc::json::parse (R"({"kind":"edit","key":"curve","value":{"points":[0,0.99,1]}})"));
        require (f.patch->setFullStoredState (choc::json::parse (R"({"parameters":[{"name":"gain","value":-2}],"values":{"curve":{"points":[1,0.25,0]}}})")),
                 "actual full native restore failed");
        require (f.a->last ("reset")["scope"]["document"].getWithDefault<int64_t> (-1)
                     == old["document"].getWithDefault<int64_t> (-2) + 1,
                 "native restore did not advance the document before queued work could publish");
        return old;
    });
    f.attach (f.a);
    f.attach (f.b);
    f.expectValues (-2, { 1, 0.25, 0 });
    f.onLoop ([&]
    {
        require (f.a->scope["owner"] == oldScope["owner"], "full restore replaced the persistent worker owner");
        for (const auto& view : { f.a.get(), f.b.get() })
        {
            const auto state = view->state();
            require (! state["history"]["canUndo"].getWithDefault<bool> (true)
                     && ! state["history"]["canRedo"].getWithDefault<bool> (true), "preset replacement retained old-document history");
            require (! state["fields"]["gain"].hasObjectMember ("gesture"), "restore retained an old gesture");
            for (const auto& body : view->bodies)
                if (body["kind"].toString() == "update" && sameScope (body["scope"], view->scope))
                {
                    require (body["state"]["fields"]["gain"]["value"].getWithDefault<double> (999) == -2,
                             "old host FIFO value entered a new-document snapshot");
                    require (pointsEqual (body["state"]["fields"]["curve"]["value"], { 1, 0.25, 0 }),
                             "queued old edit entered a new-document snapshot");
                }
        }
        require (f.gestures.size() == gesturesBefore + 2 && f.gestures[gesturesBefore] == "begin" && f.gestures.back() == "end",
                 "restore failed to close the actual native host gesture");
    });
    // First command from each new attachment must use sequence 1 and remain
    // actionable after the discarded old document command.
    f.command (f.a, R"({"kind":"edit","key":"curve","value":{"points":[1,0.5,0]}})");
    f.expectValues (-2, { 1, 0.5, 0 });
    f.command (f.b, R"({"kind":"undo"})");
    f.expectValues (-2, { 1, 0.25, 0 });
    std::cout << "PASS: actual full restore fences queued edits/host observations and resets history and command scopes\n";
}
}

int main (int argc, char** argv)
{
    if (argc != 3)
    {
        std::cerr << "Usage: PluginStateSystemProbe <runtime-library> <generated-patch>\n";
        return 2;
    }
    choc::messageloop::initialise();
    if (! cmaj::Library::initialise (argv[1]))
    {
        std::cerr << "FAIL: could not load the configured Cmajor runtime library\n";
        return 1;
    }
    int result = 1;
    std::thread orchestration ([&]
    {
        Fixture fixture;
        try
        {
            fixture.load (argv[2]);
            testBoot (fixture);
            testGestureAndSharedHistory (fixture);
            testHostAutomation (fixture);
            testCloseAndReopen (fixture);
            testFullRestore (fixture);
            std::cout << "PASS: ordinary event preparation and declared scalar dependencies reach real DSP after edits, history, automation and restore\n";
            result = 0;
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
