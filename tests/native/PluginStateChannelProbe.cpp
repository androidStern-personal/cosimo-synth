#include <array>
#include <chrono>
#include <cmath>
#include <functional>
#include <future>
#include <iostream>
#include <memory>
#include <limits>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include "cmajor/helpers/cmaj_Patch.h"
#include "choc/gui/choc_MessageLoop.h"

namespace
{
using Value = choc::value::Value;
using View = choc::value::ValueView;
constexpr auto deadline = std::chrono::seconds (5);

void require (bool condition, const char* message)
{
    if (! condition)
        throw std::runtime_error (message);
}

Value envelope (const View& body) { return choc::json::create ("type", "kit_state", "message", body); }
cmaj::EndpointID gainID() { return cmaj::EndpointID::create (std::string ("gain")); }

struct Inbox
{
    void receive (const View& message)
    {
        messages.emplace_back (message);
        if (auto callback = changed)
            callback();
    }

    Value last (const char* kind) const
    {
        for (auto i = messages.rbegin(); i != messages.rend(); ++i)
            if ((*i)["type"].toString() == "kit_state" && (*i)["message"]["kind"].toString() == kind)
                return Value ((*i)["message"]);
        return choc::value::createObject ({});
    }

    size_t count (const char* kind) const
    {
        return static_cast<size_t> (std::count_if (messages.begin(), messages.end(), [&] (const auto& message)
        { return message["type"].toString() == "kit_state" && message["message"]["kind"].toString() == kind; }));
    }

    std::vector<Value> messages;
    std::function<void()> changed;
};

struct RecordingContext final : cmaj::Patch::WorkerContext, Inbox
{
    void initialise (std::function<void(const View&)> send, std::function<void(const std::string&)>) override
    {
        sendToHost = std::move (send);
        if (auto callback = changed)
            callback();
    }
    void sendMessage (const std::string& json, std::function<void(const std::string&)>) override { receive (choc::json::parse (json)); }
    void send (const View& body) { sendToHost (envelope (body)); }
    std::function<void(const View&)> sendToHost;
};

struct RecordingView final : cmaj::PatchView, Inbox
{
    explicit RecordingView (cmaj::Patch& p) : PatchView (p) {}
    void sendMessage (const View& message) override { receive (message); }
};

// The orchestration thread waits, while every Patch operation and inbox access
// runs on the real native message loop. No private PatchWorker API is accessed.
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
            changed = [done, condition, settled = false] () mutable
            {
                if (settled)
                    return;
                try
                {
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
        onLoop ([&] { changed = {}; });
        require (status == std::future_status::ready, failure);
        result.get();
    }

    void notify() { if (changed) changed(); }

    void load (const char* patchPath)
    {
        onLoop ([&]
        {
            patch = std::make_unique<cmaj::Patch>();
            patch->createEngine = [] { return cmaj::Engine::create(); };
            patch->createContextForPatchWorker = [&] (std::string)
            {
                auto context = std::make_unique<RecordingContext>();
                context->changed = [&] { notify(); };
                worker = context.get();
                return context;
            };
            patch->handleOutputEvent = [] (uint64_t, std::string_view, const View&) {};
            patch->statusChanged = [] (const cmaj::Patch::Status& status)
            {
                if (status.messageList.hasErrors())
                    std::cerr << status.messageList.toString() << '\n';
            };
            patch->setPlaybackParams ({ 48000, 128, 0, 1 });
            cmaj::Patch::LoadParams params;
            params.manifest.initialiseWithFile (patchPath);
            require (patch->loadPatch (params, true) && patch->isPlayable(), "actual channel fixture did not load");
            const auto gain = patch->findParameter (gainID());
            require (gain != nullptr && gain->setValue (2.5f, true, -1, 0), "live host gain update failed");
            patch->setStoredStateValue ("curve", choc::json::parse ("{\"points\":[0,1]}"));
            a = std::make_unique<RecordingView> (*patch);
            b = std::make_unique<RecordingView> (*patch);
            a->changed = b->changed = [&] { notify(); };
        });
        waitFor ([&] { return worker != nullptr && static_cast<bool> (worker->sendToHost); }, "Patch did not initialise its worker context");
    }

    void close()
    {
        onLoop ([&]
        {
            changed = {};
            a.reset();
            b.reset();
            patch.reset();
            worker = nullptr;
        });
    }

    void sendWorker (Value body) { onLoop ([&, body] { worker->send (body); }); }

    std::unique_ptr<cmaj::Patch> patch;
    RecordingContext* worker = nullptr;
    std::unique_ptr<RecordingView> a, b;
    Value scope;
    std::vector<std::string> gestures;
    std::function<void()> changed;
};

void testOpen (Fixture& f)
{
    f.sendWorker (choc::json::parse (R"({"kind":"open","request":1,"parameters":["gain"],"storedKeys":["curve"],"eventEndpoints":["curveBuffer"]})"));
    f.waitFor ([&] { return f.worker->count ("opened") == 1; }, "actual worker open did not receive opened");
    f.onLoop ([&]
    {
        const auto opened = f.worker->last ("opened");
        f.scope = Value (opened["scope"]);
        require (! f.scope["owner"].toString().empty() && f.scope["document"].isInt(), "native scope is invalid");
        require (opened["native"]["parameters"].size() == 1, "native parameter snapshot is incomplete");
        const auto gain = opened["native"]["parameters"][0];
        require (gain["endpoint"].toString() == "gain" && gain["value"].getWithDefault<double> (999) == 2.5,
                 "snapshot did not read the actual live native gain");
        require (gain["min"].getWithDefault<double> (0) == -12 && gain["max"].getWithDefault<double> (0) == 12
                 && gain["step"].getWithDefault<double> (0) == 0.5 && gain["defaultValue"].getWithDefault<double> (0) == 1,
                 "snapshot did not preserve native metadata separately from live value");
        const auto points = opened["native"]["values"]["curve"]["points"];
        require (points.size() == 2 && points[0].getWithDefault<double> (-1) == 0 && points[1].getWithDefault<double> (-1) == 1,
                 "snapshot did not preserve exact native stored points");
        require (! f.patch->handleClientMessage (*f.a, envelope (choc::json::parse (R"({"kind":"open","request":91,"parameters":[],"storedKeys":[],"eventEndpoints":[]})"))),
                 "ordinary GUI gained worker open authority");
    });
    std::cout << "PASS: actual Patch worker opens a native parameter/stored snapshot\n";
}

void testAttach (Fixture& f)
{
    f.onLoop ([&]
    {
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "attach", "request", 11))), "native did not handle first GUI attach");
        require (f.patch->handleClientMessage (*f.b, envelope (choc::json::create ("kind", "attach", "request", 12))), "native did not handle second GUI attach");
    });
    f.waitFor ([&] { return f.worker->count ("attached-client") == 2; }, "native did not route both real view attachments");
    f.onLoop ([&]
    {
        int64_t first = 0;
        for (const auto& message : f.worker->messages)
        {
            const auto body = message["message"];
            if (body["kind"].toString() != "attached-client")
                continue;
            const auto client = body["client"].getWithDefault<int64_t> (0);
            require (client > 0 && client != first, "native did not assign distinct clients to real views");
            first = client;
            f.worker->send (choc::json::create ("kind", "snapshot", "scope", f.scope, "to", client,
                "attachRequest", body["request"], "revision", 0, "state", choc::json::create ("gain", 2.5)));
        }
        require (f.a->last ("attached")["request"].getWithDefault<int64_t> (0) == 11, "first real view lost snapshot correlation");
        require (f.b->last ("attached")["request"].getWithDefault<int64_t> (0) == 12, "second real view lost snapshot correlation");
        require (f.a->last ("attached")["state"]["gain"].getWithDefault<double> (0) == 2.5, "service snapshot did not reach GUI");
    });
    std::cout << "PASS: real GUI views attach through worker identity and receive correlated snapshots\n";
}

void testPublish (Fixture& f)
{
    f.onLoop ([&]
    {
        const auto gain = f.patch->findParameter (gainID());
        gain->gestureStart = [&] { f.gestures.push_back ("begin"); };
        gain->gestureEnd = [&] { f.gestures.push_back ("end"); };
        auto body = choc::json::parse (R"({"kind":"publish","request":21,"operations":[{"kind":"gesture-start","endpoint":"gain"},{"kind":"parameter","endpoint":"gain","value":3.5},{"kind":"gesture-end","endpoint":"gain"},{"kind":"stored","key":"curve","value":{"points":[0,0.5,1]}},{"kind":"event","endpoint":"curveBuffer","value":0.75}]})");
        body.addMember ("scope", f.scope);
        require (! f.patch->handleClientMessage (*f.a, envelope (body)), "ordinary GUI gained publication authority");
        require (gain->currentValue == 2.5f, "forged GUI publication changed native state");
        f.worker->send (body);
    });
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 21; }, "native did not reply to publication");
    f.onLoop ([&]
    {
        require (f.worker->last ("published")["result"]["kind"].toString() == "observed", "native publication failed");
        require (f.gestures == std::vector<std::string> { "begin", "end" }, "host gestures were unbalanced");
        require (f.patch->findParameter (gainID())->currentValue == 3.5f, "native parameter was not published");
        require (f.patch->getFullStoredState()["values"]["curve"]["points"][1].getWithDefault<double> (-1) == 0.5, "native stored state was not published");
        std::array<float, 128> output {};
        float* channels[] { output.data() };
        for (int i = 0; i < 32; ++i)
            f.patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
        require (std::abs (output.back() - 4.25f) < 0.001f, "published event/parameter did not reach actual DSP output");
    });
    std::cout << "PASS: guarded publication reaches native state, gestures and actual DSP\n";
}

void testPublicationValidation (Fixture& f)
{
    f.onLoop ([&]
    {
        auto body = choc::json::parse (R"({"kind":"publish","request":22,"operations":[{"kind":"stored","key":"curve","value":{"points":[99]}},{"kind":"parameter","endpoint":"notDeclared","value":3}]})");
        body.addMember ("scope", f.scope);
        f.worker->send (body);
    });
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 22; }, "invalid publication was not answered");
    f.onLoop ([&]
    {
        require (f.worker->last ("published")["result"]["reason"].toString() == "invalid-publication", "later invalid operation was accepted");
        require (f.patch->getFullStoredState()["values"]["curve"]["points"][1].getWithDefault<double> (-1) == 0.5,
                 "valid first operation mutated state before later operation validation");
        auto operations = choc::value::createArray (1, [] (uint32_t)
        {
            return choc::json::create ("kind", "stored", "key", "curve", "value",
                choc::json::create ("point", std::numeric_limits<double>::quiet_NaN()));
        });
        f.worker->send (choc::json::create ("kind", "publish", "request", 23, "scope", f.scope, "operations", operations));
    });
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 23; }, "nonfinite publication was not answered");
    f.onLoop ([&]
    {
        require (f.worker->last ("published")["result"]["reason"].toString() == "invalid-publication", "nested nonfinite stored value was accepted");
        require (f.patch->getFullStoredState()["values"]["curve"]["points"].size() == 3, "malformed publication changed native state");
    });
    std::cout << "PASS: whole publication validates before mutation and rejects nonfinite stored values\n";
}


void testCommandRouting (Fixture& f)
{
    f.onLoop ([&]
    {
        const auto send = [&] (RecordingView& view, int sequence)
        {
            return f.patch->handleClientMessage (view, envelope (choc::json::create ("kind", "command", "scope", f.scope,
                "sequence", sequence, "client", view.last ("attached")["client"], "command", choc::json::create ("kind", "edit", "key", "gain", "value", 9))));
        };
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "command", "scope", f.scope,
            "sequence", 1, "client", f.b->last ("attached")["client"], "command", choc::json::create ("kind", "undo")))),
            "forged other-view client guard received no rejection");
        require (f.a->last ("receipt")["result"]["reason"].toString() == "closed-client", "another actual view's identity was accepted");
        require (send (*f.a, 1) && send (*f.b, 1), "native did not route real client commands");
        require (send (*f.a, 1), "native did not answer duplicate sequence");
        require (f.a->last ("receipt")["result"]["reason"].toString() == "sequence", "duplicate sequence was not rejected");
        require (send (*f.a, 2), "duplicate rejection stranded following sequence");
        require (f.patch->findParameter (gainID())->currentValue == 3.5f, "native interpreted opaque user edit as a direct parameter write");
    });
    f.waitFor ([&] { return f.worker->count ("command") == 3; }, "native command routing lost or duplicated a command");
    f.onLoop ([&]
    {
        std::vector<Value> addresses;
        for (const auto& message : f.worker->messages)
            if (message["message"]["kind"].toString() == "command")
                addresses.emplace_back (message["message"]["address"]);
        require (addresses[0]["client"] == f.a->last ("attached")["client"]
                 && addresses[1]["client"] == f.b->last ("attached")["client"]
                 && addresses[2]["sequence"].getWithDefault<int64_t> (0) == 2,
                 "native trusted forged client identity or lost per-client sequence");
        f.worker->send (choc::json::create ("kind", "receipt", "address", addresses[1],
            "result", choc::json::create ("kind", "rejected", "reason", "busy")));
        auto update = choc::json::create ("kind", "update", "scope", f.scope, "revision", 8,
            "state", choc::json::create ("gain", 9), "receipt", choc::json::create ("address", addresses[2],
                "result", choc::json::create ("kind", "accepted", "revision", 8, "version", 4)));
        require (! f.patch->handleClientMessage (*f.a, envelope (update)), "GUI forged a service update");
        f.worker->send (update);
        require (f.b->last ("receipt")["result"]["reason"].toString() == "busy", "service rejection was not routed to the originating view");
        require (f.a->last ("update")["receipt"]["result"]["version"].getWithDefault<int64_t> (0) == 4,
                 "accepted field version did not cross the native channel unchanged");
        require (f.b->last ("update")["state"]["gain"].getWithDefault<double> (0) == 9, "other client did not receive coherent service update");
    });
    std::cout << "PASS: native stamps client identity, rejects duplicate sequence, and routes opaque receipts/updates\n";
}


void testRestoreFence (Fixture& f)
{
    const auto oldScope = f.onLoop ([&] { return f.scope; });
    f.onLoop ([&]
    {
        auto body = choc::json::parse (R"({"kind":"publish","request":31,"operations":[{"kind":"gesture-start","endpoint":"gain"}]})");
        body.addMember ("scope", f.scope);
        f.worker->send (body);
    });
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 31; }, "gesture begin publication did not complete");
    f.onLoop ([&]
    {
        require (f.patch->findParameter (gainID())->setValue (5.5f, true, -1, 0), "old host parameter write failed");
        require (f.patch->setFullStoredState (choc::json::parse (R"({"parameters":[{"name":"gain","value":-2}],"values":{"curve":{"points":[1,0]}}})")),
                 "actual full native state replacement failed");
        const auto reset = f.a->last ("reset");
        require (reset.isObject() && reset["scope"]["document"].getWithDefault<int64_t> (-1) == oldScope["document"].getWithDefault<int64_t> (0) + 1,
                 "actual host restore did not advance native document scope before mutation");
        f.scope = Value (reset["scope"]);
        auto late = choc::json::parse (R"({"kind":"publish","request":32,"operations":[{"kind":"stored","key":"curve","value":{"points":[99]}},{"kind":"parameter","endpoint":"gain","value":9},{"kind":"event","endpoint":"curveBuffer","value":20}]})");
        late.addMember ("scope", oldScope);
        f.worker->send (late);
    });
    f.waitFor ([&]
    {
        return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 32
            && f.worker->count ("replaced") == 1 && f.worker->count ("parameter") > 0
            && f.worker->last ("parameter")["scope"]["document"].getWithDefault<int64_t> (-1) == f.scope["document"].getWithDefault<int64_t> (-2);
    }, "restore fence did not deliver complete replacement and current parameter observation");
    f.onLoop ([&]
    {
        require (f.worker->last ("published")["result"]["reason"].toString() == "stale-scope", "old publication crossed restore fence");
        const auto replacement = f.worker->last ("replaced");
        require (replacement["native"]["parameters"][0]["value"].getWithDefault<double> (99) == -2
                 && replacement["native"]["values"]["curve"]["points"][0].getWithDefault<double> (99) == 1,
                 "replacement snapshot mixed old and new state");
        for (const auto& message : f.worker->messages)
            if (message["message"]["kind"].toString() == "parameter" && message["message"]["scope"]["owner"].toString() == f.scope["owner"].toString()
                && message["message"]["scope"]["document"].getWithDefault<int64_t> (-1) == f.scope["document"].getWithDefault<int64_t> (-2))
                require (message["message"]["value"].getWithDefault<double> (99) == -2, "old FIFO parameter payload was relabeled as new document truth");
        require (f.patch->findParameter (gainID())->currentValue == -2, "old publication changed restored gain");
        require (f.gestures == std::vector<std::string> { "begin", "end", "begin", "end" }, "restore left an active host gesture open");
        auto oldCommand = choc::json::create ("kind", "command", "scope", oldScope, "client", f.a->last ("attached")["client"], "sequence", 3,
            "command", choc::json::create ("kind", "undo"));
        require (f.patch->handleClientMessage (*f.a, envelope (oldCommand)), "old-scope command received no rejection");
        require (f.a->last ("receipt")["result"]["reason"].toString() == "stale-scope", "old-scope command was not rejected");
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "command", "scope", f.scope, "client", f.a->last ("attached")["client"], "sequence", 1,
            "command", choc::json::create ("kind", "undo")))), "fresh sequence did not route after restore");
        std::array<float, 128> output {};
        float* channels[] { output.data() };
        for (int i = 0; i < 32; ++i)
            f.patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
        require (std::abs (output.back() + 1.25f) < 0.001f, "old-epoch event reached actual DSP after restore");
    });
    f.waitFor ([&] { return f.worker->count ("command") == 4; }, "new document sequence was stranded by old rejection");
    std::cout << "PASS: actual host restore fences old work, closes gestures, and observes current native parameter truth\n";
}


void testFailedPublicationClosesGesture (Fixture& f)
{
    const auto before = f.onLoop ([&]
    {
        const auto endpoint = cmaj::EndpointID::create (std::string ("curveBuffer"));
        bool full = false;
        for (int i = 0; i < 100000; ++i)
            if (! f.patch->sendEventOrValueToPatch (endpoint, Value (0.75f), -1, 0))
            {
                full = true;
                break;
            }
        require (full, "actual native event queue did not reach its bounded capacity");
        return f.gestures.size();
    });
    auto body = choc::json::parse (R"({"kind":"publish","request":41,"operations":[{"kind":"gesture-start","endpoint":"gain"},{"kind":"event","endpoint":"curveBuffer","value":0.75},{"kind":"gesture-end","endpoint":"gain"}]})");
    body.addMember ("scope", f.scope);
    f.sendWorker (body);
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 41; }, "failed send received no publication response");
    f.onLoop ([&]
    {
        require (f.worker->last ("published")["result"]["reason"].toString() == "send-failed", "actual full event queue was not reported");
        require (f.gestures.size() == before + 2 && f.gestures[before] == "begin" && f.gestures.back() == "end",
                 "failed native event send left its preceding host gesture open");
    });
    std::cout << "PASS: actual native send failure balances an already started host gesture\n";
}


void testReentrantRestore (Fixture& f)
{
    f.onLoop ([&]
    {
        std::array<float, 128> output {};
        float* channels[] { output.data() };
        f.patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
        f.patch->findParameter (gainID())->gestureStart = [&]
        {
            f.gestures.push_back ("begin");
            require (f.patch->setFullStoredState (choc::json::parse (R"({"parameters":[{"name":"gain","value":4}],"values":{"curve":{"points":[0.25,0.75]}}})")),
                     "reentrant actual host restore failed");
            f.scope = f.a->last ("reset")["scope"];
        };
    });
    for (const auto request : { 51, 52 })
    {
        const auto oldScope = f.scope;
        const auto before = f.onLoop ([&] { return f.gestures.size(); });
        auto body = choc::json::parse (request == 51
            ? R"({"kind":"publish","operations":[{"kind":"gesture-start","endpoint":"gain"},{"kind":"stored","key":"curve","value":{"points":[99]}},{"kind":"event","endpoint":"curveBuffer","value":20}]})"
            : R"({"kind":"publish","operations":[{"kind":"gesture-start","endpoint":"gain"}]})");
        body.addMember ("request", request);
        body.addMember ("scope", oldScope);
        f.sendWorker (body);
        f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == request; }, "reentrant publication did not settle");
        f.onLoop ([&]
        {
            require (f.worker->last ("published")["result"]["reason"].toString() == "stale-scope", "restore inside final native callback was reported as observed");
            require (f.scope["document"].getWithDefault<int64_t> (-1) == oldScope["document"].getWithDefault<int64_t> (-1) + 1,
                     "reentrant restore did not advance document exactly once");
            require (f.gestures.size() == before + 2 && f.gestures.back() == "end", "reentrant restore left host gesture unbalanced");
            require (f.patch->getFullStoredState()["values"]["curve"]["points"][0].getWithDefault<double> (-1) == 0.25,
                     "remaining old publication overwrote reentrant restore");
            std::array<float, 128> output {};
            float* channels[] { output.data() };
            for (int i = 0; i < 32; ++i)
                f.patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
            require (std::abs (output.back() - 4.75f) < 0.001f, "remaining event crossed reentrant restore into DSP");
        });
    }
    f.onLoop ([&] { f.patch->findParameter (gainID())->gestureStart = [&] { f.gestures.push_back ("begin"); }; });
    std::cout << "PASS: restore inside actual host callback balances gestures and fences remainder and final acknowledgement\n";
}


void testRealViewDetach (Fixture& f)
{
    const auto client = f.onLoop ([&]
    {
        const auto id = f.a->last ("attached")["client"].getWithDefault<int64_t> (0);
        for (const auto sequence : { 1, 2 })
            require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "command", "scope", f.scope,
                "client", f.a->last ("attached")["client"], "sequence", sequence, "command", choc::json::create ("kind", "undo")))), "last client commands did not route");
        f.a.reset();
        return id;
    });
    f.waitFor ([&] { return f.worker->last ("detach")["client"].getWithDefault<int64_t> (0) == client; }, "destroying actual PatchView did not emit detach");
    f.onLoop ([&]
    {
        require (f.worker->last ("detach")["routedThrough"].getWithDefault<int64_t> (0) == 2, "detach lost routed command prefix");
        int observedCommands = 0;
        bool detached = false;
        for (const auto& entry : f.worker->messages)
        {
            const auto body = entry["message"];
            if (body["kind"].toString() == "command" && body["address"]["owner"].toString() == f.scope["owner"].toString()
                && body["address"]["document"].getWithDefault<int64_t> (-1) == f.scope["document"].getWithDefault<int64_t> (-2) && body["address"]["client"].getWithDefault<int64_t> (0) == client)
            {
                require (! detached, "routed command arrived after actual view detach");
                ++observedCommands;
            }
            if (body["kind"].toString() == "detach" && body["client"].getWithDefault<int64_t> (0) == client)
                detached = true;
        }
        require (observedCommands == 2, "detach did not follow both real queued commands");
        f.worker->send (choc::json::create ("kind", "update", "scope", f.scope, "revision", 20, "state", choc::json::create ("gain", 4)));
        require (f.b->last ("update")["revision"].getWithDefault<int64_t> (0) == 20, "surviving view missed update after another view destruction");
    });
    std::cout << "PASS: actual view destruction delivers routed prefix and removes broadcast recipient\n";
}


void testTerminalServiceClose (Fixture& f)
{
    const auto before = f.onLoop ([&]
    {
        require (! f.patch->handleClientMessage (*f.b, envelope (choc::json::create ("kind", "close", "reason", "service-closed"))),
                 "ordinary view forged service close authority");
        return f.gestures.size();
    });
    auto publication = choc::json::parse (R"({"kind":"publish","request":61,"operations":[{"kind":"gesture-start","endpoint":"gain"}]})");
    publication.addMember ("scope", f.scope);
    f.sendWorker (publication);
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 61; }, "pre-close gesture did not start");
    f.sendWorker (choc::json::create ("kind", "close", "reason", "service-closed"));
    f.waitFor ([&] { return f.b->count ("closed") == 1; }, "actual worker close did not notify attached view");
    f.onLoop ([&]
    {
        require (f.b->last ("closed")["reason"].toString() == "service-closed", "terminal reason changed");
        require (f.gestures.size() == before + 2 && f.gestures.back() == "end", "terminal close left host gesture open");
        f.worker->send (choc::json::create ("kind", "close", "reason", "service-closed"));
        require (f.b->count ("closed") == 1, "repeated service close broadcast twice");
        const auto body = choc::json::create ("kind", "command", "scope", f.scope, "client", f.b->last ("attached")["client"], "sequence", 1,
            "command", choc::json::create ("kind", "undo"));
        require (f.patch->handleClientMessage (*f.b, envelope (body)), "terminal command was left unresolved");
        require (f.b->last ("receipt")["result"]["reason"].toString() == "closed", "terminal owner still routed user command");
        auto late = choc::json::parse (R"({"kind":"publish","request":62,"operations":[{"kind":"parameter","endpoint":"gain","value":9}]})");
        late.addMember ("scope", f.scope);
        f.worker->send (late);
        f.worker->send (choc::json::parse (R"({"kind":"open","request":63,"parameters":["gain"],"storedKeys":["curve"],"eventEndpoints":["curveBuffer"]})"));
    });
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 62
        && f.worker->last ("open-failed")["request"].getWithDefault<int64_t> (0) == 63; }, "closed owner calls did not settle");
    f.onLoop ([&]
    {
        require (f.worker->last ("published")["result"]["reason"].toString() == "closed", "closed owner published native effects");
        require (f.worker->last ("open-failed")["reason"].toString() == "closed", "same actual worker reopened terminal owner");
        require (f.patch->findParameter (gainID())->currentValue == 4, "late closed-owner effect mutated gain");
        const auto updates = f.b->count ("update");
        f.worker->send (choc::json::create ("kind", "update", "scope", f.scope, "revision", 21, "state", choc::json::create ("gain", 9)));
        require (f.b->count ("update") == updates, "closed owner still broadcast service update");
    });
    std::cout << "PASS: actual worker terminal close revokes commands and effects, balances gestures, and cannot reopen\n";
}


void testActualWorkerReplacement (Fixture& f, const char* patchPath)
{
    const auto oldOwner = f.scope["owner"].toString();
    f.onLoop ([&]
    {
        f.worker = nullptr;
        f.patch->unload();
        require (f.patch->loadPatchFromFile (patchPath, true) && f.patch->isPlayable(), "actual replacement Patch did not load");
        f.a = std::make_unique<RecordingView> (*f.patch);
        f.a->changed = [&] { f.notify(); };
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "attach", "request", 70))), "pre-open attach was not handled");
        require (f.a->last ("attach-failed")["reason"].toString() == "not-ready", "old worker terminal state survived actual worker replacement");
    });
    f.waitFor ([&] { return f.worker != nullptr && static_cast<bool> (f.worker->sendToHost); }, "replacement worker context did not initialise");
    f.sendWorker (choc::json::parse (R"({"kind":"open","request":71,"parameters":["gain"],"storedKeys":["curve"],"eventEndpoints":["curveBuffer"]})"));
    f.waitFor ([&] { return f.worker->count ("opened") == 1; }, "actual replacement worker could not open");
    f.onLoop ([&]
    {
        f.scope = f.worker->last ("opened")["scope"];
        require (f.scope["owner"].toString() != oldOwner && f.scope["document"].getWithDefault<int64_t> (-1) == 0,
                 "replacement worker reused prior lifetime scope");
        require (f.a->last ("owner-changed")["scope"]["owner"].toString() == f.scope["owner"].toString(),
                 "pre-open failed attach received no authoritative readiness notification");
        require (f.b->last ("owner-changed")["scope"]["owner"].toString() == f.scope["owner"].toString(),
                 "surviving old view received no owner replacement notification");
        require (f.worker->last ("opened")["native"]["parameters"][0]["value"].getWithDefault<double> (99) == 1,
                 "replacement snapshot did not read replacement native renderer");
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "attach", "request", 72))), "ready view did not reattach");
    });
    f.waitFor ([&] { return f.worker->last ("attached-client")["request"].getWithDefault<int64_t> (0) == 72; }, "new lifetime attach did not reach new worker");
    f.onLoop ([&]
    {
        const auto client = f.worker->last ("attached-client")["client"].getWithDefault<int64_t> (0);
        f.worker->send (choc::json::create ("kind", "snapshot", "scope", f.scope, "to", client, "attachRequest", 72,
            "revision", 0, "state", choc::json::create ("gain", 1)));
        require (f.a->last ("attached")["request"].getWithDefault<int64_t> (0) == 72, "new lifetime snapshot lost correlation");
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "command", "scope", f.scope,
            "client", client, "sequence", 1, "command", choc::json::create ("kind", "undo")))), "new lifetime first command did not route");
    });
    f.waitFor ([&] { return f.worker->count ("command") == 1; }, "new lifetime command remained blocked by previous owner");
    std::cout << "PASS: actual worker replacement renews scope and wakes both old views and pre-open failed attaches\n";
}


void testAttachDuringRestore (Fixture& f)
{
    f.onLoop ([&]
    {
        bool requested = false;
        f.a->changed = [&]
        {
            if (! requested && f.a->count ("reset") > 0)
            {
                requested = true;
                require (f.patch->findParameter (gainID())->currentValue == 1, "reset arrived after native mutation instead of before it");
                require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "attach", "request", 81))),
                         "reset callback attach was not handled");
            }
            f.notify();
        };
        require (f.patch->setFullStoredState (choc::json::parse (R"({"parameters":[{"name":"gain","value":3}],"values":{"curve":{"points":[0,1]}}})")),
                 "restore with synchronously reattaching view failed");
        f.a->changed = [&] { f.notify(); };
        require (requested, "actual reset listener did not attempt fresh attach");
        f.scope = f.a->last ("reset")["scope"];
    });
    f.waitFor ([&] { return f.worker->last ("attached-client")["request"].getWithDefault<int64_t> (0) == 81; },
               "attach requested inside actual reset callback was stranded");
    f.onLoop ([&]
    {
        bool replaced = false;
        for (const auto& message : f.worker->messages)
        {
            const auto body = message["message"];
            if (body["kind"].toString() == "replaced" && body["scope"]["document"].getWithDefault<int64_t> (-1) == f.scope["document"].getWithDefault<int64_t> (-2))
            {
                require (body["native"]["parameters"][0]["value"].getWithDefault<double> (99) == 3, "deferred attach saw incomplete native restore");
                replaced = true;
            }
            if (body["kind"].toString() == "attached-client" && body["request"].getWithDefault<int64_t> (0) == 81)
                require (replaced, "reattach was routed before complete native replacement snapshot");
        }
        const auto client = f.worker->last ("attached-client")["client"].getWithDefault<int64_t> (0);
        f.worker->send (choc::json::create ("kind", "snapshot", "scope", f.scope, "to", client, "attachRequest", 81,
            "revision", 0, "state", choc::json::create ("gain", 3)));
        require (f.a->last ("attached")["request"].getWithDefault<int64_t> (0) == 81, "deferred attach never became ready");
    });
    std::cout << "PASS: synchronous reset listener reattaches after complete native replacement without polling\n";
}


void testBoundedPayloads (Fixture& f)
{
    for (const auto request : { 91, 92 })
    {
        Value value (std::string (request == 91 ? 16 * 1024 * 1024 : 1, 'x'));
        if (request == 92)
            for (int depth = 0; depth < 65; ++depth)
                value = choc::json::create ("nested", value);
        auto operations = choc::value::createArray (1, [&] (uint32_t)
        { return choc::json::create ("kind", "stored", "key", "curve", "value", value); });
        f.sendWorker (choc::json::create ("kind", "publish", "request", request, "scope", f.scope, "operations", operations));
        f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == request; }, "oversized/deep publication was not answered");
        f.onLoop ([&]
        {
            require (f.worker->last ("published")["result"]["reason"].toString() == "invalid-publication", "native accepted unbounded stored payload");
            require (f.patch->getFullStoredState()["values"]["curve"]["points"][1].getWithDefault<double> (-1) == 1,
                     "rejected bounded payload changed persistent native state");
        });
    }
    f.onLoop ([&]
    {
        const auto commands = f.worker->count ("command");
        auto body = choc::json::create ("kind", "command", "scope", f.scope, "client", f.a->last ("attached")["client"], "sequence", 1,
            "command", choc::json::create ("payload", std::string (16 * 1024 * 1024, 'x')));
        require (! f.patch->handleClientMessage (*f.a, envelope (body)), "native accepted oversized opaque command");
        require (f.worker->count ("command") == commands, "oversized opaque command reached service");
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "command", "scope", f.scope,
            "client", f.a->last ("attached")["client"], "sequence", 1, "command", choc::json::create ("kind", "undo")))), "oversized command consumed valid sequence");
    });
    f.waitFor ([&] { return f.worker->count ("command") == 2; }, "valid command after bounded rejection did not reach service");
    std::cout << "PASS: native rejects oversized and deep payloads without stored mutation or sequence consumption\n";
}


void testSameViewNewBinding (Fixture& f)
{
    const auto oldClient = f.onLoop ([&] { return f.a->last ("attached")["client"].getWithDefault<int64_t> (0); });
    const auto before = f.onLoop ([&]
    {
        auto gain = f.patch->findParameter (gainID());
        gain->gestureStart = [&] { f.gestures.push_back ("begin"); };
        gain->gestureEnd = [&] { f.gestures.push_back ("end"); };
        for (const auto sequence : { 2, 3 })
            require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "command", "scope", f.scope,
                "client", oldClient, "sequence", sequence, "command", choc::json::create ("kind", sequence == 2 ? "begin" : "edit",
                "key", "gain", "gesture", 1, "value", 3)))), "old binding command did not route");
        auto start = choc::json::parse (R"({"kind":"publish","request":112,"operations":[{"kind":"gesture-start","endpoint":"gain"}]})");
        start.addMember ("scope", f.scope);
        f.worker->send (start);
        return f.gestures.size();
    });
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 112; }, "old binding native gesture did not start");
    f.onLoop ([&]
    {
        require (f.gestures.back() == "begin", "same-view reconnect setup has no native host gesture");
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "attach", "request", 113))),
                 "same surviving PatchView reattach was not handled");
    });
    f.waitFor ([&] { return f.worker->last ("attached-client")["request"].getWithDefault<int64_t> (0) == 113; }, "same-view new binding did not reach worker");
    f.onLoop ([&]
    {
        const auto client = f.worker->last ("attached-client")["client"].getWithDefault<int64_t> (0);
        require (client != oldClient, "reattach reused old binding client incarnation");
        bool detached = false;
        for (const auto& message : f.worker->messages)
        {
            const auto body = message["message"];
            if (body["kind"].toString() == "detach" && body["client"].getWithDefault<int64_t> (0) == oldClient)
            {
                require (body["routedThrough"].getWithDefault<int64_t> (0) == 3, "binding detach lost old command prefix");
                detached = true;
            }
            if (body["kind"].toString() == "attached-client" && body["request"].getWithDefault<int64_t> (0) == 113)
                require (detached, "new binding arrived before old binding detach");
        }
        // The controlled owner answers its real detach through the production
        // publication path; domain history sealing is the service's separate test.
        auto end = choc::json::parse (R"({"kind":"publish","request":114,"operations":[{"kind":"gesture-end","endpoint":"gain"}]})");
        end.addMember ("scope", f.scope);
        f.worker->send (end);
        f.worker->send (choc::json::create ("kind", "snapshot", "scope", f.scope, "to", client, "attachRequest", 113,
            "revision", 0, "state", choc::json::create ("gain", 3)));
        const auto command = [&] (int64_t identity, int sequence)
        {
            return f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "command", "scope", f.scope,
                "client", identity, "sequence", sequence, "command", choc::json::create ("kind", "undo"))));
        };
        require (command (oldClient, 4), "late old binding command was left unresolved");
        require (f.a->last ("receipt")["result"]["reason"].toString() == "closed-client", "late old binding command reached new incarnation");
        require (command (client, 1), "fresh binding sequence one did not route");
        require (f.gestures.size() == before + 1 && f.gestures.back() == "end", "detach response could not finish old binding host gesture");
    });
    f.waitFor ([&] { return f.worker->count ("command") == 5; }, "old binding rejection consumed or delivered a new binding sequence");
    std::cout << "PASS: same actual PatchView rotates binding identity after ordered detach and rejects old incarnation commands\n";
}

void testExplicitClientDetach (Fixture& f)
{
    const auto oldClient = f.onLoop ([&] { return f.a->last ("attached")["client"].getWithDefault<int64_t> (0); });
    f.onLoop ([&]
    {
        require (f.patch->handleClientMessage (*f.b, envelope (choc::json::create ("kind", "attach", "request", 121))),
                 "second source could not attach for explicit detach test");
    });
    f.waitFor ([&] { return f.worker->last ("attached-client")["request"].getWithDefault<int64_t> (0) == 121; }, "second source attachment did not reach owner");
    const auto before = f.onLoop ([&]
    {
        const auto bClient = f.worker->last ("attached-client")["client"].getWithDefault<int64_t> (0);
        f.worker->send (choc::json::create ("kind", "snapshot", "scope", f.scope, "to", bClient,
            "attachRequest", 121, "revision", 0, "state", choc::json::create ("gain", 3)));
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "command", "scope", f.scope,
            "client", oldClient, "sequence", 2, "command", choc::json::create ("kind", "begin", "key", "gain", "gesture", 2)))),
            "old client could not begin its final routed group");
        auto start = choc::json::parse (R"({"kind":"publish","request":122,"operations":[{"kind":"gesture-start","endpoint":"gain"}]})");
        start.addMember ("scope", f.scope);
        f.worker->send (start);
        return f.worker->count ("detach");
    });
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 122; }, "explicit detach setup did not start actual host gesture");
    f.onLoop ([&]
    {
        require (f.gestures.back() == "begin", "explicit detach setup has no live host gesture");
        const auto detach = choc::json::create ("kind", "detach", "scope", f.scope, "client", oldClient);
        require (! f.patch->handleClientMessage (*f.b, envelope (detach)), "another registered source forged the target client's detach");
        require (f.patch->handleClientMessage (*f.b, envelope (choc::json::create ("kind", "command", "scope", f.scope,
            "client", f.b->last ("attached")["client"], "sequence", 1, "command", choc::json::create ("kind", "undo")))),
            "rejected forged detach damaged its sender's registration");
        auto stale = choc::json::create ("kind", "detach", "scope", choc::json::create ("owner", f.scope["owner"],
            "document", f.scope["document"].getWithDefault<int64_t> (-1) + 1), "client", oldClient);
        require (! f.patch->handleClientMessage (*f.a, envelope (stale)), "wrong document detached a current client");
        f.worker->send (detach);
        require (f.worker->count ("detach") == before, "worker identity forged an ordinary client detach");
        require (f.patch->handleClientMessage (*f.a, envelope (detach)), "matching explicit client detach was not handled");
        require (f.a->isActive(), "client detach destroyed its surviving native PatchView");
        require (! f.patch->handleClientMessage (*f.a, envelope (detach)), "repeated client detach was handled twice");
    });
    f.waitFor ([&] { return f.worker->count ("detach") == before + 1; }, "explicit detach did not reach actual owner exactly once");
    f.onLoop ([&]
    {
        const auto detached = f.worker->last ("detach");
        require (detached["client"].getWithDefault<int64_t> (0) == oldClient
            && detached["routedThrough"].getWithDefault<int64_t> (0) == 2, "explicit detach lost its actual routed client prefix");
        // The controlled owner translates the real detach into its native
        // gesture cleanup. Domain group/history sealing has separate service proof.
        auto end = choc::json::parse (R"({"kind":"publish","request":123,"operations":[{"kind":"gesture-end","endpoint":"gain"}]})");
        end.addMember ("scope", f.scope);
        f.worker->send (end);
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "attach", "request", 124))),
                 "surviving view could not reattach after explicit client detach");
    });
    f.waitFor ([&] { return f.worker->last ("attached-client")["request"].getWithDefault<int64_t> (0) == 124; }, "reattach after explicit detach did not reach actual owner");
    f.onLoop ([&]
    {
        require (f.gestures.back() == "end", "actual owner could not finish explicitly detached client's host gesture");
        const auto client = f.worker->last ("attached-client")["client"].getWithDefault<int64_t> (0);
        require (client != oldClient, "explicitly detached identity was reused");
        require (! f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "detach", "scope", f.scope, "client", oldClient))),
                 "late detach from old incarnation closed its replacement");
        require (f.worker->count ("detach") == before + 1, "stale detach sent an owner notification");
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "command", "scope", f.scope,
            "client", client, "sequence", 1, "command", choc::json::create ("kind", "undo")))), "stale detach broke new incarnation sequence one");
    });
    f.waitFor ([&] { return f.worker->count ("command") == 8; }, "fresh client command after explicit detach did not reach owner");
    std::cout << "PASS: scoped client detach releases a surviving PatchView registration once and cannot close another incarnation\n";
}

void testLiveOwnerUnload (Fixture& f)
{
    const auto before = f.onLoop ([&]
    {
        auto gain = f.patch->findParameter (gainID());
        gain->gestureStart = [&] { f.gestures.push_back ("begin"); };
        gain->gestureEnd = [&] { f.gestures.push_back ("end"); };
        return f.gestures.size();
    });
    auto publication = choc::json::parse (R"({"kind":"publish","request":101,"operations":[{"kind":"gesture-start","endpoint":"gain"}]})");
    publication.addMember ("scope", f.scope);
    f.sendWorker (publication);
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 101; }, "live owner gesture did not start before unload");
    f.onLoop ([&]
    {
        const auto beforeClosed = f.a->count ("closed");
        require (f.gestures.size() == before + 1 && f.gestures.back() == "begin", "live unload setup has no active actual host gesture");
        f.worker = nullptr;
        f.patch->unload();
        require (! f.patch->isPlayable(), "actual Patch remained playable after unload");
        require (f.gestures.size() == before + 2 && f.gestures.back() == "end", "live renderer teardown destroyed parameter before closing host gesture");
        require (f.a->count ("closed") == beforeClosed + 1 && f.a->last ("closed")["reason"].toString() == "owner-removed",
                 "live owner unload did not deliver one authoritative close");
        f.patch->unload();
        require (f.a->count ("closed") == beforeClosed + 1 && f.gestures.size() == before + 2, "repeated unload repeated lifecycle cleanup");
    });
    std::cout << "PASS: live owner unload closes actual host gesture before renderer teardown and notifies once\n";
}

void testExternalStoredReplacement (Fixture& f)
{
    f.sendWorker (choc::json::parse (R"({"kind":"open","request":201,"parameters":["gain"],"storedKeys":["curve","shape"],"eventEndpoints":["curveBuffer"]})"));
    f.waitFor ([&] { return f.worker->count ("opened") == 1; }, "external-state fixture did not open");
    const auto original = f.onLoop ([&]
    {
        const Value scope (f.worker->last ("opened")["scope"]);
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "attach", "request", 201))),
                 "external-state observer did not register as a real client");
        f.patch->setStoredStateValue ("unowned", Value ("ordinary"));
        f.patch->setStoredStateValue ("curve", choc::json::parse (R"({"points":[0,1]})"));
        require (f.a->count ("reset") == 0, "unowned or unchanged stored write reset the document");
        require (f.patch->findParameter (gainID())->setValue (5.5f, true, -1, 0), "raw replacement gain setup failed");
        f.patch->setStoredStateValue ("curve", choc::json::parse (R"({"points":[0.2,0.8]})"));
        require (f.a->count ("reset") == 1, "external owned stored write did not synchronously fence the document");
        require (f.a->last ("reset")["scope"]["document"].getWithDefault<int64_t> (-1) == scope["document"].getWithDefault<int64_t> (-1) + 1,
                 "external owned stored write did not advance the document once");
        require (f.patch->findParameter (gainID())->currentValue == 5.5f, "raw stored replacement reset host parameters");
        require (f.patch->getFullStoredState()["values"]["curve"]["points"][0].getWithDefault<double> (-1) == 0.2,
                 "raw stored replacement was not visible before its setter returned");
        return scope;
    });
    f.waitFor ([&] { return f.worker->count ("replaced") == 1; }, "raw replacement did not notify its owner");
    f.onLoop ([&]
    {
        const auto replaced = f.worker->last ("replaced");
        require (replaced["changedStoredKey"].toString() == "curve", "raw replacement lost its changed stored key");
        require (replaced["native"]["parameters"][0]["value"].getWithDefault<double> (99) == 5.5,
                 "raw replacement snapshot did not retain current native gain");
        f.scope = replaced["scope"];
    });
    auto late = choc::json::parse (R"({"kind":"publish","request":202,"operations":[{"kind":"stored","key":"curve","value":{"points":[99]}},{"kind":"parameter","endpoint":"gain","value":9},{"kind":"event","endpoint":"curveBuffer","value":20}]})");
    late.addMember ("scope", original);
    f.sendWorker (late);
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 202; }, "old raw-replacement publication did not settle");
    f.onLoop ([&]
    {
        require (f.worker->last ("published")["result"]["reason"].toString() == "stale-scope", "old publication crossed raw replacement");
        require (f.patch->getFullStoredState()["values"]["curve"]["points"][0].getWithDefault<double> (-1) == 0.2,
                 "old publication overwrote raw state");
        require (f.patch->findParameter (gainID())->currentValue == 5.5f, "old publication overwrote raw replacement gain");
    });

    const auto beforeOwn = f.onLoop ([&] { return f.a->count ("reset"); });
    auto own = choc::json::parse (R"({"kind":"publish","request":203,"operations":[{"kind":"stored","key":"curve","value":{"points":[0.3,0.7]}},{"kind":"event","endpoint":"curveBuffer","value":0.25}]})");
    own.addMember ("scope", f.scope);
    f.sendWorker (own);
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 203; }, "own stored publication did not settle");
    f.onLoop ([&]
    {
        require (f.worker->last ("published")["result"]["kind"].toString() == "observed", "own stored publication was rejected");
        require (f.a->count ("reset") == beforeOwn, "own stored publication reset its own document");
        const auto wrote = std::make_shared<bool> (false);
        f.a->changed = [&, wrote]
        {
            const auto& message = f.a->messages.back();
            if (! *wrote && message["type"].toString() == "state_key_value" && message["message"]["key"].toString() == "curve")
            {
                *wrote = true;
                f.patch->setStoredStateValue ("shape", choc::json::parse (R"({"points":[0.4,0.6]})"));
            }
            f.notify();
        };
        auto reentrant = choc::json::parse (R"({"kind":"publish","request":204,"operations":[{"kind":"stored","key":"curve","value":{"points":[0.5,0.5]}},{"kind":"stored","key":"shape","value":{"points":[99]}},{"kind":"parameter","endpoint":"gain","value":9},{"kind":"event","endpoint":"curveBuffer","value":20}]})");
        reentrant.addMember ("scope", f.scope);
        f.worker->send (reentrant);
    });
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 204; }, "reentrant raw publication did not settle");
    f.onLoop ([&]
    {
        f.a->changed = [&] { f.notify(); };
        require (f.a->count ("reset") == beforeOwn + 1, "reentrant raw write borrowed owner-publication suppression");
        require (f.worker->last ("published")["result"]["reason"].toString() == "stale-scope", "reentrant raw write did not fence publication remainder");
        require (f.patch->getFullStoredState()["values"]["shape"]["points"][0].getWithDefault<double> (-1) == 0.4,
                 "publication remainder overwrote reentrant external state");
        require (f.patch->findParameter (gainID())->currentValue == 5.5f, "reentrant external state let a stale scalar through");
        std::array<float, 128> output {};
        float* channels[] { output.data() };
        for (int i = 0; i < 32; ++i)
            f.patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
        require (std::abs (output.back() - 5.75f) < 0.001f, "raw replacement rejected its current event or let an old event reach the real DSP");
        const auto resets = f.a->count ("reset");
        require (f.patch->setFullStoredState (choc::json::parse (R"({"parameters":[{"name":"gain","value":4}],"values":{"curve":{"points":[1,0]},"shape":{"points":[0,1]}}})")), "nested stored restore failed");
        require (f.a->count ("reset") == resets + 1, "full restore repeated its barrier for owned stored keys");
    });
    f.waitFor ([&] { return f.worker->count ("replaced") == 3; }, "full restore replacement did not arrive");
    f.onLoop ([&]
    {
        require (! f.worker->last ("replaced").hasObjectMember ("changedStoredKey"), "full restore was mislabeled a single-key replacement");
    });
    std::cout << "PASS: external owned stored writes fence old effects, preserve parameters, and exclude own/no-op/full-restore writes\n";
}

void testHostEffects (Fixture& f)
{
    f.sendWorker (choc::json::parse (R"({"kind":"open","request":300,"parameters":["gain"],"storedKeys":["curve"],"eventEndpoints":["curveBuffer"],"hostEffects":["trigger-config","trigger-config"]})"));
    f.waitFor ([&] { return f.worker->last ("open-failed")["request"].getWithDefault<int64_t> (0) == 300; }, "invalid host-effect declaration was not answered");
    f.onLoop ([&]
    {
        require (f.worker->last ("open-failed")["reason"].toString() == "invalid-declaration", "duplicate host-effect declaration opened");
    });
    f.sendWorker (choc::json::parse (R"({"kind":"open","request":301,"parameters":["gain"],"storedKeys":["curve"],"eventEndpoints":["curveBuffer"],"hostEffects":["trigger-config"]})"));
    f.waitFor ([&] { return f.worker->count ("opened") == 1; }, "host-effect fixture did not open");
    f.onLoop ([&]
    {
        f.scope = f.worker->last ("opened")["scope"];
        auto publication = choc::json::parse (R"({"kind":"publish","request":301,"operations":[{"kind":"host-effect","name":"trigger-config","value":{"slot":7}}]})");
        publication.addMember ("scope", f.scope);
        f.worker->send (publication);
    });
    f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == 301; }, "missing host-effect callback was not answered");
    f.onLoop ([&]
    {
        require (f.worker->last ("published")["result"]["reason"].toString() == "unsupported-host-effect",
                 "declared host effect without a native callback was not reported as unsupported");
        require (f.patch->findParameter (gainID())->currentValue == 2.5f,
                 "unsupported host effect changed a host parameter");
        require (f.worker->count ("closed") == 0, "unsupported host effect closed the state owner");
    });

    const auto calls = std::make_shared<std::vector<Value>>();
    const auto gestureCount = f.onLoop ([&] { return f.gestures.size(); });
    f.onLoop ([&]
    {
        const auto gain = f.patch->findParameter (gainID());
        gain->gestureStart = [&] { f.gestures.push_back ("begin"); };
        gain->gestureEnd = [&] { f.gestures.push_back ("end"); };
        f.patch->handleStateHostEffect = [&, calls] (std::string_view name, const View& value)
        {
            require (name == "trigger-config", "undeclared host-effect name reached its callback");
            calls->emplace_back (value);
            const auto mode = value["mode"].toString();
            if (mode == "reject") return false;
            if (mode == "throw") throw std::runtime_error ("host callback defect");
            if (mode == "restore")
                f.patch->setStoredStateValue ("curve", choc::json::parse (R"({"points":[0.25,0.75]})"));
            return true;
        };
    });
    const auto publish = [&] (int64_t request, const char* operations, const Value& scope)
    {
        f.sendWorker (choc::json::create ("kind", "publish", "request", request, "scope", scope,
                                        "operations", choc::json::parse (operations)));
        f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == request; }, "host-effect publication did not settle");
        return f.onLoop ([&] { return Value (f.worker->last ("published")["result"]); });
    };
    require (publish (302, R"([{"kind":"parameter","endpoint":"gain","value":3},{"kind":"event","endpoint":"curveBuffer","value":0.5},{"kind":"host-effect","name":"trigger-config","value":{"slot":7}}])", f.scope)["kind"].toString() == "observed",
             "supported synchronous host callback was not accepted");
    f.onLoop ([&]
    {
        require (calls->size() == 1 && calls->back()["slot"].getWithDefault<int> (-1) == 7, "host callback lost its structured value");
        auto forged = choc::json::parse (R"({"kind":"publish","request":399,"operations":[{"kind":"host-effect","name":"trigger-config","value":{"slot":99}}]})");
        forged.addMember ("scope", f.scope);
        require (! f.patch->handleClientMessage (*f.a, envelope (forged)), "ordinary GUI forged host-effect publication authority");
    });
    require (publish (303, R"([{"kind":"host-effect","name":"trigger-config","value":{"slot":8}},{"kind":"host-effect","name":"undeclared","value":0}])", f.scope)["reason"].toString() == "invalid-publication",
             "undeclared host effect did not reject the complete publication");
    f.onLoop ([&] { require (calls->size() == 1, "valid prefix ran before host-effect declaration validation completed"); });
    require (publish (304, R"([{"kind":"gesture-start","endpoint":"gain"},{"kind":"host-effect","name":"trigger-config","value":{"mode":"reject"}},{"kind":"parameter","endpoint":"gain","value":10},{"kind":"gesture-end","endpoint":"gain"}])", f.scope)["reason"].toString() == "host-effect-rejected",
             "host callback rejection was reported as successful delivery");
    f.onLoop ([&]
    {
        require (f.gestures.size() == gestureCount + 2 && f.gestures.back() == "end",
                 "host callback refusal leaked a gesture started by its publication");
    });
    require (publish (305, R"([{"kind":"gesture-start","endpoint":"gain"},{"kind":"host-effect","name":"trigger-config","value":{"mode":"throw"}},{"kind":"parameter","endpoint":"gain","value":10},{"kind":"gesture-end","endpoint":"gain"}])", f.scope)["reason"].toString() == "host-effect-failed",
             "host callback throw escaped or was reported as successful delivery");
    f.onLoop ([&]
    {
        require (f.patch->findParameter (gainID())->currentValue == 3, "failed host callback did not stop publication remainder");
        require (f.gestures.size() == gestureCount + 4 && f.gestures.back() == "end", "throwing host callback leaked its publication gesture");
        require (f.worker->count ("closed") == 0, "host callback failure closed editable state");
    });

    const Value originalScope (f.scope);
    require (publish (306, R"([{"kind":"host-effect","name":"trigger-config","value":{"mode":"restore"}},{"kind":"host-effect","name":"trigger-config","value":{"slot":99}},{"kind":"event","endpoint":"curveBuffer","value":20}])", originalScope)["reason"].toString() == "stale-scope",
             "restore inside host callback did not fence later host/DSP effects");
    f.waitFor ([&] { return f.worker->count ("replaced") == 1; }, "host callback restore did not reach owner");
    f.onLoop ([&]
    {
        require (calls->size() == 4, "later host callback crossed a reentrant raw replacement");
        f.scope = f.worker->last ("replaced")["scope"];
    });
    require (publish (307, R"([{"kind":"host-effect","name":"trigger-config","value":{"slot":99}}])", originalScope)["reason"].toString() == "stale-scope",
             "held old host callback crossed raw replacement");
    f.onLoop ([&]
    {
        std::array<float, 128> output {};
        float* channels[] { output.data() };
        for (int i = 0; i < 32; ++i)
            f.patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
        require (std::abs (output.back() - 3.5f) < 0.001f, "stale host publication delivered a DSP remainder before current replacement");
    });
    require (publish (308, R"([{"kind":"host-effect","name":"trigger-config","value":{"slot":8}},{"kind":"event","endpoint":"curveBuffer","value":0.75}])", f.scope)["kind"].toString() == "observed",
             "new document could not deliver its host callback and DSP event");
    f.onLoop ([&]
    {
        require (calls->size() == 5 && calls->back()["slot"].getWithDefault<int> (-1) == 8, "new document host callback did not run exactly once");
        std::array<float, 128> output {};
        float* channels[] { output.data() };
        for (int i = 0; i < 32; ++i)
            f.patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
        require (std::abs (output.back() - 3.75f) < 0.001f, "host-effect fencing lost current DSP delivery or accepted stale remainder");
        f.patch->handleStateHostEffect = {};
    });
    std::cout << "PASS: declared synchronous host effects retain failures, fence reentrant/late callbacks, and allow current DSP delivery\n";
}

void testFailedOldPublicationPreservesRestoredGesture (Fixture& f)
{
    f.sendWorker (choc::json::parse (R"({"kind":"open","request":401,"parameters":["gain"],"storedKeys":["curve"],"eventEndpoints":[],"hostEffects":["restore-and-fail"]})"));
    f.waitFor ([&] { return f.worker->count ("opened") == 1; }, "reentrant failure fixture did not open");
    f.onLoop ([&]
    {
        f.scope = f.worker->last ("opened")["scope"];
        require (f.patch->handleClientMessage (*f.a, envelope (choc::json::create ("kind", "attach", "request", 402))),
                 "reentrant failure view could not attach");
        const auto gain = f.patch->findParameter (gainID());
        gain->gestureStart = [&] { f.gestures.push_back ("begin"); };
        gain->gestureEnd = [&] { f.gestures.push_back ("end"); };
    });
    for (const auto throws : { false, true })
    {
        const auto request = throws ? 420 : 410;
        const auto before = f.onLoop ([&]
        {
            f.patch->handleStateHostEffect = [&, throws, request] (std::string_view, const View&)
            {
                // A real restore closes the old document's gesture. The real
                // worker connection may synchronously publish for the new one.
                f.patch->setStoredStateValue ("curve", choc::json::parse (throws
                    ? R"({"points":[0.75,1]})" : R"({"points":[0.25,1]})"));
                f.scope = f.a->last ("reset")["scope"];
                f.worker->send (choc::json::create ("kind", "publish", "request", request + 1, "scope", f.scope,
                    "operations", choc::json::parse (R"([{"kind":"gesture-start","endpoint":"gain"}])")));
                if (throws) throw std::runtime_error ("callback failed after restore");
                return false;
            };
            return f.gestures.size();
        });
        const auto oldScope = f.scope;
        f.sendWorker (choc::json::create ("kind", "publish", "request", request, "scope", oldScope,
            "operations", choc::json::parse (R"([{"kind":"gesture-start","endpoint":"gain"},{"kind":"host-effect","name":"restore-and-fail","value":{}},{"kind":"parameter","endpoint":"gain","value":10}])")));
        f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == request; },
                   "reentrant failed publication did not settle");
        f.onLoop ([&]
        {
            require (f.scope["document"].getWithDefault<int64_t> (-1) == oldScope["document"].getWithDefault<int64_t> (-1) + 1,
                     "host callback did not enter a fresh document");
            require (f.gestures.size() == before + 3 && f.gestures[before] == "begin"
                     && f.gestures[before + 1] == "end" && f.gestures.back() == "begin",
                     "failed old publication ended the restored document's new gesture");
            require (f.patch->findParameter (gainID())->currentValue == 2.5f,
                     "failed old publication changed the restored parameter");
            require (f.worker->last ("published")["result"]["kind"].toString() == "failed",
                     "failed old publication was reported as applied");
        });
        f.sendWorker (choc::json::create ("kind", "publish", "request", request + 2, "scope", f.scope,
            "operations", choc::json::parse (R"([{"kind":"gesture-end","endpoint":"gain"}])")));
        f.waitFor ([&] { return f.worker->last ("published")["request"].getWithDefault<int64_t> (0) == request + 2; },
                   "new document gesture end did not settle");
        f.onLoop ([&]
        {
            require (f.gestures.size() == before + 4 && f.gestures.back() == "end",
                     "new document lost ownership of its actual host gesture");
        });
    }
    f.onLoop ([&] { f.patch->handleStateHostEffect = {}; });
    std::cout << "PASS: failed old host publication cannot end a gesture started after reentrant restore\n";
}

}

int main (int argc, char** argv)
{
    if (argc != 3)
    {
        std::cerr << "Usage: PluginStateChannelProbe <runtime-library> <patch>\n";
        return 2;
    }
    choc::messageloop::initialise();
    if (! cmaj::Library::initialise (argv[1]))
        return 1;
    int result = 1;
    std::thread orchestration ([&]
    {
        Fixture fixture;
        try
        {
            fixture.load (argv[2]);
            testOpen (fixture);
            testAttach (fixture);
            testPublish (fixture);
            testPublicationValidation (fixture);
            testCommandRouting (fixture);
            testRestoreFence (fixture);
            testFailedPublicationClosesGesture (fixture);
            testReentrantRestore (fixture);
            testRealViewDetach (fixture);
            testTerminalServiceClose (fixture);
            testActualWorkerReplacement (fixture, argv[2]);
            testAttachDuringRestore (fixture);
            testBoundedPayloads (fixture);
            testSameViewNewBinding (fixture);
            testExplicitClientDetach (fixture);
            testLiveOwnerUnload (fixture);
            fixture.close();
            fixture.load (argv[2]);
            testExternalStoredReplacement (fixture);
            fixture.close();
            fixture.load (argv[2]);
            testHostEffects (fixture);
            fixture.close();
            fixture.load (argv[2]);
            testFailedOldPublicationPreservesRestoredGesture (fixture);
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
