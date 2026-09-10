#include <cmath>
#include <fstream>
#include <iostream>
#include <limits>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "cmajor/API/cmaj_Engine.h"
#ifdef ENGINE_DATA_GENERATED_SOURCE
 #include ENGINE_DATA_GENERATED_SOURCE
 #include "cmajor/helpers/cmaj_GeneratedCppEngine.h"
#endif

namespace
{
void require (bool condition, const std::string& message)
{
    if (! condition) throw std::runtime_error (message);
}

std::string readFile (const char* path)
{
    std::ifstream input (path);
    require (input.good(), std::string ("Cannot read ") + path);
    std::ostringstream result;
    result << input.rdbuf();
    return result.str();
}

void assignJSON (choc::value::ValueView target, const choc::value::ValueView& source)
{
    if (target.isObject())
    {
        require (source.isObject() && source.size() == target.size(), "Wrong event object shape");
        target.visitObjectMembers ([&] (std::string_view name, choc::value::ValueView member)
        {
            require (source.hasObjectMember (name), "Missing event member: " + std::string (name));
            assignJSON (member, source[name]);
        });
        return;
    }

    if (target.isArray() || target.isVector())
    {
        require (source.isArray() && source.size() == target.size(), "Wrong event array length");
        for (uint32_t i = 0; i < target.size(); ++i) assignJSON (target[i], source[i]);
        return;
    }

    require (target.isInt32() && (source.isInt() || source.isFloat()), "Only int32 fixture inputs are supported");
    const auto value = source.get<double>();
    require (std::isfinite (value) && std::floor (value) == value
             && value >= std::numeric_limits<int32_t>::min()
             && value <= std::numeric_limits<int32_t>::max(), "Fixture input is not int32");
    target.set (static_cast<int32_t> (value));
}

struct Endpoint
{
    cmaj::EndpointHandle handle;
    choc::value::Type type;
};

void run (const char* modulePath, const char* fixturePath)
{
    cmaj::DiagnosticMessageList messages;
    cmaj::Program program;
   #ifdef ENGINE_DATA_GENERATED_SOURCE
    // The same public Performer interface runs a separately compiled C++
    // performer. This path does not initialise or invoke the JIT library.
    auto engine = cmaj::createEngineForGeneratedCppProgram<EngineDataGenerated>();
   #else
    if (! program.parse (messages, modulePath, readFile (modulePath)))
        throw std::runtime_error (messages.toString());
    if (! program.parse (messages, fixturePath, readFile (fixturePath)))
        throw std::runtime_error (messages.toString());
    auto engine = cmaj::Engine::create();
   #endif
    require (bool (engine), "Cmajor engine unavailable");
    auto settings = engine.getBuildSettings();
    settings.setFrequency (48000).setMaxBlockSize (512).setEventBufferSize (64).setSessionID (1);
    engine.setBuildSettings (settings);
    // GeneratedCppEngine accepts the empty Program: its load/link operations
    // only establish the common Engine lifecycle around already compiled code.
    if (! engine.load (messages, program, {}, {}))
        throw std::runtime_error (messages.toString());

    std::map<std::string, Endpoint> inputs;
    for (const auto& endpoint : engine.getInputEndpoints())
    {
        require (endpoint.dataTypes.size() == 1, "Fixture endpoint must have one type");
        inputs.emplace (endpoint.endpointID.toString(), Endpoint {
            engine.getEndpointHandle (endpoint.endpointID.toString().c_str()), endpoint.dataTypes[0] });
    }
    const auto output = engine.getEndpointHandle ("out");
    Endpoint receipt;
    for (const auto& endpoint : engine.getOutputEndpoints())
        if (endpoint.endpointID.toString() == "receipt")
            receipt = { engine.getEndpointHandle ("receipt"), endpoint.dataTypes[0] };
    if (! engine.link (messages)) throw std::runtime_error (messages.toString());
    auto performer = engine.createPerformer();
    require (bool (performer), "Cmajor performer unavailable");

    std::string line;
    while (std::getline (std::cin, line))
    {
        if (line.empty()) continue;
        const auto request = choc::json::parse (line);
        const auto frames = request["frames"].getWithDefault<int> (1);
        require (frames > 0 && frames <= 512, "frames must be 1..512");
        performer.setBlockSize (static_cast<uint32_t> (frames));
        if (request.hasObjectMember ("values"))
            request["values"].visitObjectMembers ([&] (std::string_view name, const choc::value::ValueView& source)
            {
                const auto& endpoint = inputs.at (std::string (name));
                choc::value::Value value (endpoint.type);
                assignJSON (value.getView(), source);
                performer.setInputValue (endpoint.handle, value, 0);
            });
        if (request.hasObjectMember ("events"))
            for (const auto& event : request["events"])
            {
                const auto& endpoint = inputs.at (event["endpoint"].get<std::string>());
                choc::value::Value value (endpoint.type);
                assignJSON (value.getView(), event["value"]);
                performer.addInputEvent (endpoint.handle, 0, value);
            }
        performer.advance();
        require (performer.getRuntimeError() == nullptr, "Cmajor runtime error");
        auto samples = choc::value::createArray (static_cast<uint32_t> (frames), [] (uint32_t)
        {
            return choc::value::Value (choc::value::Type::createVector<double> (3));
        });
        performer.copyOutputFrames (output, samples.getRawData(), static_cast<uint32_t> (frames));
        auto receipts = choc::value::createEmptyArray();
        performer.iterateOutputEvents (receipt.handle, [&] (cmaj::EndpointHandle, uint32_t, uint32_t,
                                                          const void* data, uint32_t)
        {
            // The performer supplies the bytes for its declared endpoint type.
            receipts.addArrayElement (choc::value::ValueView (receipt.type, const_cast<void*> (data), nullptr));
            return true;
        });
        std::cout << choc::json::toString (choc::value::createObject ({}, "samples", samples,
                                                                    "receipts", receipts)) << '\n' << std::flush;
    }
    require (performer.getXRuns() == 0, "Cmajor endpoint overrun");
}
}

int main (int argc, char** argv)
{
    if (argc != 4)
    {
        std::cerr << "usage: EngineDataProbe <Cmajor runtime> <engine-data.cmajor> <fixture.cmajor>\n";
        return 2;
    }
    try
    {
       #ifndef ENGINE_DATA_GENERATED_SOURCE
        require (cmaj::Library::initialise (argv[1]), "Cannot load Cmajor runtime");
       #endif
        run (argv[2], argv[3]);
       #ifndef ENGINE_DATA_GENERATED_SOURCE
        cmaj::Library::shutdown();
       #endif
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL: " << error.what() << '\n';
        return 1;
    }
}
