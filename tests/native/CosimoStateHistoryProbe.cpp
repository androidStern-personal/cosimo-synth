#define CMAJOR_DLL 1
#include "cmajor/helpers/cmaj_Patch.h"
#include "NativeMessageLoop.h"
#include "cmajor/helpers/cmaj_PatchWorker_QuickJS.h"
#include "choc/javascript/choc_javascript_Timer.h"
#include "RendererExternalFunctionProvider.h"
#include "CosimoStateHistoryObservations.h"
#include "../../native/ArticulationStateEffect.h"
#include <array>
#include <chrono>
#include <cmath>
#include <fstream>
#include <future>
#include <iostream>
#include <map>
#include <thread>

#if defined(COSIMO_HISTORY_AOT)
cmaj::Engine createCosimoHistoryAot();
#endif
using Value = choc::value::Value;
using View = choc::value::ValueView;
void require (bool condition, const std::string& reason) { if (!condition) throw std::runtime_error (reason); }
std::string readFile (const char* path) { std::ifstream file (path); return { std::istreambuf_iterator<char>(file), {} }; }
bool modulationPublished(const View& field)
{
    return field["application"]["kind"].toString() == "sent"
        && field["application"]["proof"].toString() == "native-publication-processed";
}

struct ClientView : cmaj::PatchView
{
    explicit ClientView (cmaj::Patch& target) : PatchView (target), patch (target) {}
    void sendMessage (const View& message) override
    {
        if (message["type"].toString() != "kit_state") return;
        if (message["message"]["kind"].toString() == "owner-changed") ownerOpened = true;
        if (context) context.invoke ("historyReceive", message["message"]);
    }
    void start (const std::string& script)
    {
        context = choc::javascript::createQuickJSContext();
        choc::javascript::registerTimerFunctions (context);
        context.registerFunction ("sendNative", [this] (choc::javascript::ArgumentList arguments)
        {
            require (arguments.size() == 1 && patch.handleClientMessage (*this, *arguments[0]), "native view message rejected");
            return Value();
        });
        std::string failure;
        context.run (script, [&] (const std::string& error, const View&) { failure = error; });
        require (failure.empty(), "public client bundle failed: " + failure);
        context.invoke ("historyOpen");
    }
    Value snapshot() { return choc::json::parse (context.invoke ("historySnapshot").toString()); }
    Value state() { return Value (snapshot()["state"]); }
    void stop() { if (context) { context.invoke ("historyClose"); context = {}; } }
    cmaj::Patch& patch;
    choc::javascript::Context context;
    bool ownerOpened = false;
};

struct Fixture
{
    template <typename Fn> auto onLoop (Fn run)
    {
        return native_test::onMessageLoop (std::move (run), std::chrono::seconds(120), "native message loop timed out");
    }
    void render()
    {
        std::array<std::array<float,128>,2> output {};
        float* channels[] { output[0].data(), output[1].data() };
        patch->process (channels, 128, [] (uint32_t, choc::midi::MessageView) {});
        double sum = 0;
        for (const auto& channel : output) for (float sample : channel)
        {
            require (std::isfinite(sample), "actual Cosimo PCM is nonfinite");
            sum += double(sample) * sample;
        }
        lastRms = std::sqrt(sum / 256);
        renderedSamples += 256;
    }
    template <typename Fn> void waitFor (Fn condition, const char* failure)
    {
        const auto until = std::chrono::steady_clock::now() + std::chrono::seconds(90);
        do {
            if (onLoop ([&] {
                require (workerError.empty(), workerError);
                render();
                if (view && view->context) require (view->context.invoke("historyDefects").toString() == "[]", "public client defect");
                return condition();
            })) return;
            std::this_thread::sleep_for (std::chrono::milliseconds(2));
        } while (std::chrono::steady_clock::now() < until);
        throw std::runtime_error (std::string(failure) + ": " + onLoop([&] {
            return choc::json::toString (choc::json::create ("state", view && view->context ? view->snapshot() : Value(),
                "runtimeA", runtime[0], "install", events["runtimeInstallAck"], "sources", events["effectiveModSourceState"],
                "position", events["effectiveWavetablePosition"]));
        }));
    }
    void load (const char* manifest, const char* client)
    {
        script = readFile(client);
        onLoop([&] {
            patch = std::make_unique<cmaj::Patch>();
            patch->createEngine = [] {
               #if defined(COSIMO_HISTORY_AOT)
                return createCosimoHistoryAot();
               #else
                return cmaj::Engine::create();
               #endif
            };
            const auto provider = cosimo::three_osc::bridge::createExternalFunctionProvider();
            patch->externalFunctionProvider = [provider](const char* name, auto types) -> void* {
                if (std::string_view(name) == "CosimoThreeOscillatorRenderer::renderShared"
                    && cosimo::three_osc::bridge::matchesExternalFunction(name,types))
                    return reinterpret_cast<void*>(&historyRenderShared);
                return provider(name,types);
            };
            patch->handleStateHostEffect = cosimo::future_daw::createArticulationStateEffectHandler(
                [this] (auto config) { noteMeta.setTriggerConfig (std::move(config)); });
            cmaj::enableQuickJSPatchWorker(*patch);
            patch->handleOutputEvent = [this] (uint64_t, std::string_view endpoint, const View& value) {
                events[std::string(endpoint)] = Value(value);
                if (endpoint == "runtimeState") {
                    const auto oscillator = value["oscillatorIndex"].getWithDefault<int>(-1);
                    if (oscillator >= 0 && oscillator < 3) runtime[oscillator] = Value(value);
                }
            };
            patch->statusChanged = [this] (const auto& status) { if (status.messageList.hasErrors()) workerError = status.messageList.toString(); };
            patch->setPlaybackParams ({48000,128,0,2});
            cmaj::Patch::LoadParams params;
            params.manifest.initialiseWithFile(manifest);
            require (patch->loadPatch(params,true) && patch->isPlayable(), "actual Cosimo patch load failed: " + workerError);
            view = std::make_unique<ClientView>(*patch);
        });
        waitFor([&] { return view->ownerOpened; }, "production worker did not open state owner");
        onLoop([&] { view->start(script); });
        waitFor([&] { return view->snapshot()["kind"].toString() == "ready"; }, "public client did not attach");
        waitFor([&] {
            for (const auto& state : runtime)
                if (state["hasActive"].getWithDefault<int>(0) != 1 || state["activeTableIndex"].getWithDefault<int>(-1) != 35) return false;
            return modulationPublished(view->state()["fields"]["modulation.v6"])
                && events["runtimeInstallAck"]["acceptedModulationProgramSerial"].getWithDefault<int>(0) > 0;
        }, "production worker did not install initial tables/modulation");
        onLoop([&] {
            require (patch->sendEventOrValueToPatch(cmaj::EndpointID::create(std::string("midiIn")),
                choc::json::create("message", 0x900064 | (48 << 8)), 0, 0), "note input rejected");
        });
    }
    void awaitCommand (int id)
    {
        waitFor([&] { return view->context.invoke("historyOutcome",id).toString() != "null"; }, "public client command did not settle");
        onLoop([&] {
            const auto outcome = choc::json::parse(view->context.invoke("historyOutcome",id).toString());
            require (outcome["kind"].toString() == "accepted", "public client command rejected: " + choc::json::toString(outcome));
        });
    }
    void command (const View& value) { awaitCommand(onLoop([&] { return view->context.invoke("historyCommand",value).get<int>(); })); }
    void edit (const char* key, float value) { command(choc::json::create("kind","edit","key",key,"value",value)); }
    void modulation (bool curve) { awaitCommand(onLoop([&] { return view->context.invoke("historyModulationEdit",curve).get<int>(); })); }
    void editDocument(const char* function) { awaitCommand(onLoop([&] { return view->context.invoke(function).get<int>(); })); }
    int midiSelector()
    {
        const std::uint8_t midi[] {0x90,60,100};
        std::vector<cosimo::future_daw::BridgeOutputEvent> output;
        noteMeta.processMidiEvent(0,midi,3,output);
        noteMeta.finishBlock();
        int selector = -1, shortMessages = 0;
        for(const auto& event : output)
            if(event.kind == cosimo::future_daw::BridgeOutputKind::noteMeta) selector = event.noteMeta.selectorA;
            else ++shortMessages;
        require(shortMessages == 1, "native MIDI handler lost or duplicated the note");
        return selector;
    }
    void reopen()
    {
        const auto before = onLoop([&] { auto state = view->state(); view->stop(); view.reset(); return state; });
        // The patch worker and DSP remain alive for one second of rendered audio without a GUI.
        for (int block = 0; block < 375; ++block) onLoop([&] { render(); });
        onLoop([&] { view = std::make_unique<ClientView>(*patch); view->start(script); });
        waitFor([&] { return view->snapshot()["kind"].toString() == "ready"; }, "public client did not reopen");
        onLoop([&] { require(choc::json::toString(view->state()["history"]) == choc::json::toString(before["history"]), "GUI close changed shared history"); });
    }
    void close() { onLoop([&] { if(view) view->stop(); view.reset(); patch.reset(); }); }
    std::unique_ptr<cmaj::Patch> patch;
    std::unique_ptr<ClientView> view;
    cosimo::future_daw::NoteMetaBridge noteMeta;
    std::map<std::string,Value> events;
    std::array<Value,3> runtime;
    std::string workerError, script;
    double lastRms = 0;
    float initialPhaseIncrement = 0;
    int previousModulation = -1, previousProgramSerial = 0;
    uint64_t renderedSamples = 0;
};

Value rackCheckpoint(Fixture& f,const char* name,bool enabled,int previousGeneration)
{
    f.waitFor([&] {
        const auto state = f.view->state(); const auto& rack = f.events["effectiveRackState"];
        return state["fields"]["lane.v1"]["value"]["chain"][0]["enabled"].getWithDefault<bool>(!enabled) == enabled
            && state["fields"]["laneDistortion1OutputTrimDb"]["value"].getWithDefault<float>(999) == (enabled ? -6.0f : 0.0f)
            && f.patch->findParameter(cmaj::EndpointID::create(std::string("laneDistortion1OutputTrimDb")))->currentValue == (enabled ? -6.0f : 0.0f)
            && modulationPublished(state["fields"]["lane.v1"])
            && rack["laneCommittedChainLength"].getWithDefault<int>(0) == 3
            && rack["laneCommittedPositionMask"].getWithDefault<int>(-1) == (enabled ? 1 : 0)
            && rack["laneCommittedGeneration"].getWithDefault<int>(0) > previousGeneration
            && rack["laneRejectedUploadCount"].getWithDefault<int>(-1) == 0;
    },name);
    return f.onLoop([&] {
        for(int block=0;block<24;++block) f.render();
        require(f.lastRms>0.00001,"rack checkpoint is silent");
        std::cerr << "CHECKPOINT " << name << " rackMask=" << (enabled ? 1 : 0) << '\n';
        return choc::json::create("name",name,"rack",f.events["effectiveRackState"],
            "nativeTrimDb",f.patch->findParameter(cmaj::EndpointID::create(std::string("laneDistortion1OutputTrimDb")))->currentValue,
            "trimField",f.view->state()["fields"]["laneDistortion1OutputTrimDb"],
            "field",f.view->state()["fields"]["lane.v1"],"pcmRms",f.lastRms);
    });
}

Value articulationCheckpoint(Fixture& f,const char* name,bool enabled,int previousSerial)
{
    f.waitFor([&] {
        const auto state = f.view->state();
        return state["fields"]["articulations.v4"]["value"]["slots"].size() == (enabled ? 1u : 0u)
            && f.events["runtimeInstallAck"]["acceptedArticulationSerial"].getWithDefault<int>(0) < previousSerial
            && f.midiSelector() == (enabled ? 7 : -1);
    },name);
    return f.onLoop([&] {
        const int selector=f.midiSelector();
        for(int block=0;block<24;++block) f.render();
        require(f.lastRms>0.00001,"articulation checkpoint is silent");
        std::cerr << "CHECKPOINT " << name << " nativeMidiSelector=" << selector << '\n';
        return choc::json::create("name",name,"install",f.events["runtimeInstallAck"],"nativeMidiSelector",selector,
            "field",f.view->state()["fields"]["articulations.v4"],"pcmRms",f.lastRms);
    });
}

Value checkpoint (Fixture& f, const char* name, float tune, int table, int modulation, bool canUndo, bool canRedo)
{
    f.waitFor([&] {
        const auto state = f.view->state(); const auto fields = state["fields"];
        const auto doc = fields["modulation.v6"]["value"];
        const auto routes = doc["routes"];
        const auto& ack = f.events["runtimeInstallAck"];
        const auto& sources = f.events["effectiveModSourceState"];
        const auto position = f.events["effectiveWavetablePosition"]["position"].getWithDefault<float>(-1);
        if (f.initialPhaseIncrement == 0 && historyPhaseIncrement > 0 && tune == 0) f.initialPhaseIncrement = historyPhaseIncrement;
        for (int shape = 0; shape < 2; ++shape)
            if (historyMsegSerial[shape] <= 0 || historyMsegSerial[shape] > ack["acceptedModulationSerial"].getWithDefault<int>(0)
                || std::abs(historyMsegQuarter[shape] - (modulation == 2 ? 0.75f : 0.25f)) > 0.0001f) return false;
        if (fields["globalTune"]["value"].getWithDefault<float>(999) != tune
            || fields["oscAWavetableSelect"]["value"].getWithDefault<int>(-1) != table
            || f.patch->findParameter(cmaj::EndpointID::create(std::string("globalTune")))->currentValue != tune
            || f.runtime[0]["hasActive"].getWithDefault<int>(0) != 1
            || f.runtime[0]["activeTableIndex"].getWithDefault<int>(-1) != table
            || f.runtime[0]["desiredTableIndex"].getWithDefault<int>(-1) != table
            || f.runtime[0]["hasLoading"].getWithDefault<int>(1) != 0
            || !modulationPublished(fields["modulation.v6"])
            || ack["dspSessionId"].getWithDefault<int>(0) != f.runtime[0]["dspSessionId"].getWithDefault<int>(-1)
            || ack["rejectedSerial"].getWithDefault<int>(-1) != 0
            || (f.previousModulation != modulation && ack["acceptedModulationProgramSerial"].getWithDefault<int>(0) <= f.previousProgramSerial)
            || !routes.isArray() || routes.size() != (modulation == 0 ? 0u : 1u)
            || ack["installedVoiceRouteCount"].getWithDefault<int>(-1) != (modulation == 0 ? 0 : 1)
            || sources["hasActive"].getWithDefault<int>(0) != 1 || f.lastRms < 0.00001
            || f.initialPhaseIncrement <= 0
            || std::abs(historyPhaseIncrement / f.initialPhaseIncrement - std::pow(2.0f,tune/12.0f)) > 0.0001f) return false;
        if (modulation == 2) {
            if (routes[0]["sourceKind"].toString() != "mseg"
                || std::abs(sources["values"][0].getWithDefault<float>(-1) - 0.75f) > 0.0001f
                || std::abs(position - 0.375f) > 0.0001f) return false;
        } else if (modulation == 1) {
            if (routes[0]["sourceKind"].toString() != "velocity"
                || std::abs(position - 0.5f * sources["values"][6].getWithDefault<float>(-1)) > 0.0001f) return false;
        } else if (std::abs(position) > 0.0001f) return false;
        return state["history"]["canUndo"].getWithDefault<bool>(!canUndo) == canUndo
            && state["history"]["canRedo"].getWithDefault<bool>(!canRedo) == canRedo;
    }, name);
    return f.onLoop([&] {
        auto state = f.view->state();
        f.previousModulation = modulation;
        f.previousProgramSerial = f.events["runtimeInstallAck"]["acceptedModulationProgramSerial"].get<int>();
        const auto stored = f.patch->getFullStoredState();
        const auto savedModulation = stored["values"]["modulation.v6"];
        if (savedModulation.isString())
        {
            const auto saved = choc::json::parse(savedModulation.toString());
            require(choc::json::toString(saved) == choc::json::toString(state["fields"]["modulation.v6"]["value"]),
                "native saved modulation differs from acknowledged client state");
        }
        double sum = 0;
        for(int block = 0; block < 24; ++block) { f.render(); sum += f.lastRms * f.lastRms; }
        require(sum > 0.000001, "checkpoint audio is silent");
        std::cerr << "CHECKPOINT " << name << " table=" << table << " routes=" << (modulation == 0 ? 0 : 1)
                  << " programSerial=" << f.previousProgramSerial << " pcmRms=" << std::sqrt(sum/24) << '\n';
        return choc::json::create("name",name,"state",state,"stored",stored,"runtimeA",f.runtime[0],
            "install",f.events["runtimeInstallAck"],"modSources",f.events["effectiveModSourceState"],
            "position",f.events["effectiveWavetablePosition"],"rendererPhaseIncrement",historyPhaseIncrement,
            "sharedMsegShapeAQuarter",historyMsegQuarter[0],"sharedMsegShapeBQuarter",historyMsegQuarter[1],
            "pcmRms",std::sqrt(sum/24),"checkedSamples",6144);
    });
}

void exercise (Fixture& f, const char* manifest, const char* client)
{
    f.load(manifest,client);
    auto checkpoints = choc::value::createEmptyArray();
    const auto add = [&](const char* name,float tune,int table,int modulation,bool undo,bool redo) {
        checkpoints.addArrayElement(checkpoint(f,name,tune,table,modulation,undo,redo));
    };
    add("initial",0,35,0,false,false);
    f.edit("globalTune",7); add("parameter",7,35,0,true,false);
    f.edit("oscAWavetableSelect",1); add("wavetable",7,1,0,true,false);
    f.modulation(false); add("matrix",7,1,1,true,false);
    f.modulation(true); add("curve",7,1,2,true,false);
    f.reopen(); add("view-reopened",7,1,2,true,false);
    f.command(choc::json::create("kind","undo")); add("undo-curve",7,1,1,true,true);
    f.command(choc::json::create("kind","undo")); add("undo-matrix",7,1,0,true,true);
    f.command(choc::json::create("kind","undo")); add("undo-wavetable",7,35,0,true,true);
    f.command(choc::json::create("kind","undo")); add("undo-parameter",0,35,0,false,true);
    f.command(choc::json::create("kind","redo")); add("redo-parameter",7,35,0,true,true);
    f.command(choc::json::create("kind","redo")); add("redo-wavetable",7,1,0,true,true);
    f.command(choc::json::create("kind","redo")); add("redo-matrix",7,1,1,true,true);
    f.command(choc::json::create("kind","redo")); add("redo-curve",7,1,2,true,false);
    auto extras = choc::value::createEmptyArray();
    int rackGeneration=f.onLoop([&] { return f.events["effectiveRackState"]["laneCommittedGeneration"].get<int>(); });
    for(int step=0;step<3;++step) {
        if(step==0) f.editDocument("historyRackEdit"); else f.command(choc::json::create("kind",step==1?"undo":"redo"));
        auto result=rackCheckpoint(f,step==0?"rack-edited":step==1?"rack-undone":"rack-redone",step!=1,rackGeneration);
        rackGeneration=result["rack"]["laneCommittedGeneration"].get<int>(); extras.addArrayElement(result);
    }
    int articulationSerial=f.onLoop([&] { return f.events["runtimeInstallAck"]["acceptedArticulationSerial"].get<int>(); });
    for(int step=0;step<3;++step) {
        if(step==0) f.editDocument("historyArticulationEdit"); else f.command(choc::json::create("kind",step==1?"undo":"redo"));
        auto result=articulationCheckpoint(f,step==0?"articulation-edited":step==1?"articulation-undone":"articulation-redone",step!=1,articulationSerial);
        articulationSerial=result["install"]["acceptedArticulationSerial"].get<int>(); extras.addArrayElement(result);
    }
    std::cout << "RESULT " << choc::json::toString(choc::json::create("checkpoints",checkpoints,
        "rackAndArticulation",extras,
        "renderedSamples",static_cast<int64_t>(f.renderedSamples),"client","actual public PluginStateClient in QuickJS",
        "worker","actual production Cosimo QuickJS worker")) << '\n';
}

int main(int argc,char** argv)
{
    if(argc != 4) { std::cerr << "Usage: probe CMAJOR_LIBRARY COSIMO_MANIFEST PUBLIC_CLIENT_BUNDLE\n"; return 2; }
    choc::messageloop::initialise();
    if(!cmaj::Library::initialise(argv[1])) return 1;
    int result = 1;
    std::thread control([&] {
        Fixture f;
        try { exercise(f,argv[2],argv[3]); result = 0; }
        catch(const std::exception& error) { std::cerr << "FAIL " << error.what() << '\n'; }
        try { f.close(); } catch(const std::exception& error) { std::cerr << "CLEANUP " << error.what() << '\n'; result = 1; }
        choc::messageloop::stop();
    });
    choc::messageloop::run(); control.join(); cmaj::Library::shutdown(); return result;
}
