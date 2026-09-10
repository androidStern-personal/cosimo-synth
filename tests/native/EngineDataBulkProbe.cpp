#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "cmajor/API/cmaj_Engine.h"
#ifdef ENGINE_DATA_BULK_GENERATED_SOURCE
 #include ENGINE_DATA_BULK_GENERATED_SOURCE
 #include "cmajor/helpers/cmaj_GeneratedCppEngine.h"
#endif

namespace
{
using Clock = std::chrono::steady_clock;
constexpr int capacity = 3279616, packetWords = 6144, periodFrames = 64;

void require (bool condition, const std::string& message)
{
    if (! condition) throw std::runtime_error (message);
}

double microseconds (Clock::time_point start)
{
    return std::chrono::duration<double, std::micro> (Clock::now() - start).count();
}

std::string readFile (const char* path)
{
    std::ifstream input (path);
    require (input.good(), std::string ("Cannot read ") + path);
    std::ostringstream text;
    text << input.rdbuf();
    return text.str();
}

int32_t word (int generation, int index)
{
    return static_cast<int32_t> ((int64_t (index) * 811 + int64_t (generation) * 194971) % 2000003) - 1000001;
}

choc::value::Value summary (std::vector<double> samples)
{
    require (! samples.empty(), "Timing sample is empty");
    std::sort (samples.begin(), samples.end());
    return choc::value::createObject ({}, "count", int32_t (samples.size()),
        "medianUs", samples[samples.size() / 2],
        "p95Us", samples[std::min (samples.size() - 1, samples.size() * 95 / 100)],
        "maximumUs", samples.back());
}

struct Endpoint { cmaj::EndpointHandle handle; choc::value::Type type; };

struct Fixture
{
    cmaj::Engine engine;
    cmaj::Performer performer;
    std::map<std::string, Endpoint> inputs;
    Endpoint receipt;
    cmaj::EndpointHandle output;
    double createUs = 0;

    Fixture (const char* modulePath, const char* fixturePath)
    {
        cmaj::DiagnosticMessageList errors;
        cmaj::Program program;
       #ifdef ENGINE_DATA_BULK_GENERATED_SOURCE
        engine = cmaj::createEngineForGeneratedCppProgram<EngineDataBulkGenerated>();
       #else
        require (program.parse (errors, modulePath, readFile (modulePath)), errors.toString());
        require (program.parse (errors, fixturePath, readFile (fixturePath)), errors.toString());
        engine = cmaj::Engine::create();
       #endif
        require (bool (engine), "Engine unavailable");
        auto settings = engine.getBuildSettings();
        settings.setFrequency (48000).setMaxBlockSize (512).setEventBufferSize (64).setSessionID (1);
        engine.setBuildSettings (settings);
        require (engine.load (errors, program, {}, {}), errors.toString());
        for (const auto& endpoint : engine.getInputEndpoints())
        {
            require (endpoint.dataTypes.size() == 1, "Expected one endpoint type");
            inputs.emplace (endpoint.endpointID.toString(), Endpoint {
                engine.getEndpointHandle (endpoint.endpointID.toString().c_str()), endpoint.dataTypes[0] });
        }
        for (const auto& endpoint : engine.getOutputEndpoints())
            if (endpoint.endpointID.toString() == "receipt")
                receipt = { engine.getEndpointHandle ("receipt"), endpoint.dataTypes[0] };
        output = engine.getEndpointHandle ("out");
        require (engine.link (errors), errors.toString());
        const auto start = Clock::now();
        performer = engine.createPerformer();
        createUs = microseconds (start);
        require (bool (performer), "Performer unavailable");
        advance (periodFrames);
    }

    choc::value::Value value (const std::string& endpoint) const
    {
        return choc::value::Value (inputs.at (endpoint).type);
    }

    double send (const std::string& endpoint, const choc::value::ValueView& payload)
    {
        const auto start = Clock::now();
        const auto result = performer.addInputEvent (inputs.at (endpoint).handle, 0, payload);
        const auto duration = microseconds (start);
        require (result == cmaj::Result::Ok, "Input event failed: " + endpoint);
        return duration;
    }

    double advance (int frames)
    {
        require (performer.setBlockSize (frames) == cmaj::Result::Ok, "Invalid block size");
        const auto start = Clock::now();
        const auto result = performer.advance();
        const auto duration = microseconds (start);
        require (result == cmaj::Result::Ok && performer.getRuntimeError() == nullptr, "DSP processing failed");
        return duration;
    }

    void expectReceipt (int operation, int scope, int generation, int frontier)
    {
        int count = 0;
        performer.iterateOutputEvents (receipt.handle, [&] (cmaj::EndpointHandle, uint32_t, uint32_t,
                                                            const void* data, uint32_t)
        {
            const choc::value::ValueView actual (receipt.type, const_cast<void*> (data), nullptr);
            require (actual["operation"].get<int>() == operation && actual["status"].get<int>() == 0
                && actual["scope"].get<int>() == scope && actual["generation"].get<int>() == generation
                && actual["receivedWords"].get<int>() == frontier, "Unexpected receiver receipt: " + choc::json::toString (actual));
            ++count;
            return true;
        });
        require (count == 1, "Expected exactly one actual DSP receipt");
    }

    // Only the consumer's production Bank reads produce these output words.
    // The host checks every position, not a checksum or a receipt-only oracle.
    void scan (int count, int currentGeneration, int heldGeneration)
    {
        auto from = value ("scanFrom");
        from = choc::value::Value (int32_t (0));
        send ("scanFrom", from);
        std::array<std::array<double, 3>, 512> samples;
        for (int base = 0; base < count; base += 512)
        {
            const auto frames = std::min (512, count - base);
            advance (frames);
            require (performer.copyOutputFrames (output, samples.data(), frames) == cmaj::Result::Ok,
                     "Output copy failed");
            for (int index = 0; index < frames; ++index)
            {
                const auto expectedCurrent = currentGeneration == 0 ? 0 : word (currentGeneration, base + index);
                const auto expectedHeld = heldGeneration == 0 ? 0 : word (heldGeneration, base + index);
                require (samples[index][0] == expectedCurrent && samples[index][1] == expectedHeld
                          && samples[index][2] == expectedHeld,
                         "Bulk DSP word mismatch at " + std::to_string (base + index));
            }
        }
        auto stop = value ("stopScan");
        send ("stopScan", stop);
        advance (periodFrames);
    }
};

choc::value::Value runCase (const char* modulePath, const char* fixturePath, int wordCount)
{
    Fixture fixture (modulePath, fixturePath);
    std::vector<double> beginTimes, chunkTimes, processingTimes, commitTimes, resetTimes, wholeResetTimes;
    std::vector<double> queryTimes, idleTimes;
    auto query = fixture.value ("query");
    for (int trial = 1; trial <= 32; ++trial)
    {
        query["request"].set (int32_t (trial));
        queryTimes.push_back (fixture.send ("query", query));
        idleTimes.push_back (fixture.advance (periodFrames));
        fixture.expectReceipt (5, 0, 0, 0);
    }
    auto begin = fixture.value ("begin");
    auto chunk = fixture.value ("chunk");
    auto commit = fixture.value ("commit");
    begin["scope"].set (int32_t (1));
    begin["wordCount"].set (int32_t (wordCount));
    chunk["scope"].set (int32_t (1));
    commit["scope"].set (int32_t (1));
    const auto uploadStart = Clock::now();

    for (int generation = 1; generation <= 8; ++generation)
    {
        begin["generation"].set (int32_t (generation));
        beginTimes.push_back (fixture.send ("begin", begin));
        fixture.advance (periodFrames);
        fixture.expectReceipt (1, 1, generation, 0);
        chunk["generation"].set (int32_t (generation));
        for (int offset = 0; offset < wordCount; offset += packetWords)
        {
            const auto count = std::min (packetWords, wordCount - offset);
            chunk["offset"].set (int32_t (offset));
            chunk["count"].set (int32_t (count));
            // Test data preparation is outside the timed performer calls.
            for (int index = 0; index < count; ++index)
                chunk["words"][index].set (word (generation, offset + index));
            chunkTimes.push_back (fixture.send ("chunk", chunk));
            processingTimes.push_back (fixture.advance (periodFrames));
            fixture.expectReceipt (2, 1, generation, offset + count);
            if (generation == 2 && offset == packetWords * ((wordCount / packetWords) / 2))
                fixture.scan (wordCount, 1, 1);
        }
        if (generation == 2) fixture.scan (wordCount, 1, 1);
        commit["generation"].set (int32_t (generation));
        commitTimes.push_back (fixture.send ("commit", commit));
        fixture.advance (periodFrames);
        fixture.expectReceipt (3, 1, generation, wordCount);
        if (generation == 1)
        {
            auto hold = fixture.value ("holdReader");
            for (int reader = 0; reader < 16; ++reader)
            {
                hold = choc::value::Value (int32_t (reader));
                fixture.send ("holdReader", hold);
            }
            fixture.advance (periodFrames);
        }
        fixture.scan (wordCount, generation, 1);
    }
    const auto uploadAndOracleUs = microseconds (uploadStart);

    auto reset = fixture.value ("resetScope");
    for (int scope = 2; scope <= 33; ++scope)
    {
        reset["scope"].set (int32_t (scope));
        resetTimes.push_back (fixture.send ("resetScope", reset));
        fixture.advance (periodFrames);
        fixture.expectReceipt (4, scope, 0, 0);
    }
    fixture.scan (wordCount, 8, 1);

    // This intentionally measures the different whole-performer lifecycle,
    // whose compiled implementation clears all resident state.
    for (int trial = 0; trial < 8; ++trial)
    {
        const auto start = Clock::now();
        require (fixture.performer.reset() == cmaj::Result::Ok, "Whole-performer reset failed");
        wholeResetTimes.push_back (microseconds (start));
    }
    fixture.scan (wordCount, 0, 0);
    require (fixture.performer.getXRuns() == 0, "Endpoint overrun");
    return choc::value::createObject ({},
        "wordCount", wordCount, "capacityWords", capacity, "slots", 3, "heldReaders", 16,
        "packetWords", packetWords, "packetPayloadBytes", packetWords * 4,
        "logicalPayloadCapacityBytes", int64_t (capacity) * 3 * 4,
        "minimumUploadAudioMs", std::ceil (double (wordCount) / packetWords) * periodFrames / 48.0,
        "createPerformerUs", fixture.createUs, "uploadAndOracleUs", uploadAndOracleUs,
        "begin", summary (beginTimes), "chunkEvent", summary (chunkTimes),
        "queryEventBaseline", summary (queryTimes), "idle64FramesBaseline", summary (idleTimes),
        "advance64Frames", summary (processingTimes), "commitEvent", summary (commitTimes),
        "metadataResetEvent", summary (resetTimes), "wholePerformerReset", summary (wholeResetTimes),
        "scannedWordsPerChannel", int64_t (wordCount) * 12);
}
}

int main (int argc, char** argv)
{
    if (argc != 4)
    {
        std::cerr << "usage: EngineDataBulkProbe <runtime> <module.cmajor> <fixture.cmajor>\n";
        return 2;
    }
    try
    {
       #ifndef ENGINE_DATA_BULK_GENERATED_SOURCE
        require (cmaj::Library::initialise (argv[1]), "Cannot load Cmajor runtime");
       #endif
        auto results = choc::value::createEmptyArray();
        results.addArrayElement (runCase (argv[2], argv[3], 257));
        results.addArrayElement (runCase (argv[2], argv[3], capacity));
        std::cout << choc::json::toString (results, true) << '\n';
       #ifndef ENGINE_DATA_BULK_GENERATED_SOURCE
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
