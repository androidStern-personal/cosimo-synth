#include "RendererSharedDataProvider.h"
#include "WarpRenderer.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <vector>

namespace
{
using namespace cosimo::three_osc::bridge;
using PatchData = cmaj::PatchSharedData;
using Store = cmaj::SharedDataStore;
constexpr int session = 23;
constexpr size_t tableBytes = (tableSlotSampleCount + 8ull) * sizeof (int32_t);

void expect (bool value, const char* message)
{
    if (! value) throw std::runtime_error (message);
}

Store::ByteResource table (float sample, int generation = 1, int tableSession = session)
{
    auto result = std::make_shared<std::vector<int32_t>> (
        tableSlotSampleCount + 8, cosimo::three_osc::packSourcePoint (sample, 0));
    const int32_t header[] { 0x5754424c, 1, tableSession, generation, 4, 1, 11, 256 };
    std::copy (std::begin (header), std::end (header), result->begin());
    return result;
}

void submit (PatchData& data, Store::ByteResource bytes, int input = 0)
{
    const auto request = data.store.beginRequest (input, 1);
    expect (request.status == Store::RequestStatus::ready, "request rejected");
    expect (data.store.submitBytes (request.ticket, std::move (bytes)) == Store::SubmitResult::accepted,
            "submission rejected");
}

template <typename Fn> void block (PatchData& data, Fn run)
{
    data.store.beginBlock();
    try
    {
        PatchData::ReadScope scope (&data);
        run();
    }
    catch (...)
    {
        data.store.endBlock();
        data.store.drain();
        throw;
    }
    data.store.endBlock();
    data.store.drain();
}

struct State
{
    std::array<float, packedFloatCount> floats {};
    std::array<int32_t, sharedPackedIntCount> ints {};

    State()
    {
        std::fill_n (ints.data() + atlasFamilyTargetOffset, 96, -1);
        std::fill_n (ints.data() + cachedAtlasModeOffset, 384, -1);
        for (int oscillator = 0; oscillator < 3; ++oscillator)
        {
            ints[oscillatorSlotOffset + oscillator] = oscillator;
            ints[unisonVoicesOffset + oscillator] = 1;
            for (int mip = 0; mip < 11; ++mip)
                ints[mipLengthOffset + oscillator * 11 + mip] = 1;
        }
        ints[oversampleFactorOffset] = 1;
        floats[basePhaseIncrementOffset] = 0.0025f;
        floats[oscillatorGainOffset] = 0.5f;
    }

    Slice<float> f() { return { floats.data(), packedFloatCount }; }
    Slice<int32_t> i() { return { ints.data(), sharedPackedIntCount }; }
    float render()
    {
        // Let the production anti-alias FIR settle before checking table identity.
        for (int sample = 0; sample < 80; ++sample)
            expect (renderSharedNative (f(), i()) == 1, "native renderer rejected state");
        const auto output = floats[noteOutputOffset];
        expect (std::isfinite (output), "nonfinite audio");
        return output;
    }
};

void testInstancesAndNestedScopes()
{
    PatchData first (3, tableBytes * 2), second (3, tableBytes * 2), empty (3, tableBytes);
    submit (first, table (0.75f));
    submit (second, table (-0.75f));
    expect (PatchData::readScopeToken() == 0, "scope leaked before render");
    uint64_t previousToken = 0;
    for (int repeat = 0; repeat < 3; ++repeat)
        block (first, [&]
        {
            const auto outerToken = PatchData::readScopeToken();
            expect (outerToken != 0 && outerToken != previousToken, "render token reused");
            previousToken = outerToken;
            State a;
            expect (updateSharedTablesNative (session, a.i()) == 1, "first instance not adopted");
            const auto firstSample = a.render();
            expect (firstSample > 0.1f, "first instance lacks positive table audio");
            block (second, [&]
            {
                expect (PatchData::readScopeToken() != outerToken, "nested instance reused token");
                State b;
                expect (updateSharedTablesNative (session, b.i()) == 1, "second instance not adopted");
                expect (b.render() < -0.1f, "second instance borrowed first table");
            });
            expect (PatchData::readScopeToken() == outerToken, "outer scope not restored");
            expect (std::abs (a.render() - firstSample) < 1.0e-6f, "restored outer instance borrowed nested table");
            block (empty, [&]
            {
                State missing;
                expect (updateSharedTablesNative (session, missing.i()) == 0, "empty instance adopted foreign metadata");
                expect (missing.render() == 0, "empty instance borrowed foreign audio");
            });
            expect (std::abs (a.render() - firstSample) < 1.0e-6f, "empty nested scope corrupted outer cache");
        });
    expect (PatchData::readScopeToken() == 0, "scope leaked after render");
    State outside;
    outside.ints[sharedTableGenerationOffset] = 1;
    expect (outside.render() == 0, "cached pointer used outside a read scope");
}

void testReplacementRetirementAndSessionReset()
{
    PatchData data (3, tableBytes * 2);
    auto first = table (0.75f);
    std::weak_ptr<std::vector<int32_t>> retired = first;
    submit (data, std::move (first));
    State state;
    block (data, [&]
    {
        expect (updateSharedTablesNative (session, state.i()) == 1, "initial adoption missing");
        expect (state.render() > 0.1f, "initial table silent");
        submit (data, table (-0.75f)); // Same metadata, a different allocation.
        expect (state.render() > 0.1f, "pending table became audible mid-block");
    });
    block (data, [&]
    {
        expect (updateSharedTablesNative (session, state.i()) == 0, "same generation falsely readopted");
        expect (state.render() < -0.1f, "same-generation replacement retained old pointer");
        expect (! retired.expired(), "old resource released before endBlock");
    });
    expect (retired.expired(), "retired resource not reclaimed on control");
    block (data, [&]
    {
        expect (state.render() < -0.1f, "next block used reclaimed pointer");
        State reset;
        expect (updateSharedTablesNative (session + 1, reset.i()) == 0, "wrong session accepted");
        expect (reset.render() == 0, "reset instance rendered unadopted generation");
        expect (updateSharedTablesNative (session, reset.i()) == 1, "mid-block session change not observed");
        expect (reset.render() < -0.1f, "mid-block adoption did not produce audio");
    });
    auto invalid = table (0.75f, 2);
    (*invalid)[0] = 0;
    submit (data, std::move (invalid));
    block (data, [&]
    {
        expect (updateSharedTablesNative (session, state.i()) == 0, "invalid header adopted");
        State fresh;
        fresh.ints[sharedTableGenerationOffset] = 1;
        fresh.ints[frameCountOffset] = 1;
        expect (fresh.render() == 0, "invalid replacement retained prior source");
    });
}

int reads = 0;
SharedDataView countedReader (int32_t input) noexcept
{
    ++reads;
    return readNativeSharedData (input);
}

void testLookupCountAndConstantAudio()
{
    PatchData data (3, tableBytes);
    submit (data, table (0.75f));
    block (data, [&]
    {
        SharedTableBlock snapshot;
        reads = 0;
        snapshot.refresh (countedReader);
        expect (reads == 3, "snapshot must resolve each oscillator once");
        State cached;
        float firstSample = 0;
        for (int sample = 0; sample < 160; ++sample)
        {
            expect (snapshot.update (session, cached.i()) == (sample == 0 ? 1 : 0),
                    "snapshot repeated or missed adoption");
            expect (snapshot.render (cached.f(), cached.i()) == 1, "snapshot render rejected");
            const auto output = cached.floats[noteOutputOffset];
            if (sample == 80) firstSample = output;
            if (sample < 80) continue;
            expect (output > 0.1f && std::abs (output - firstSample) < 1.0e-6f,
                    "constant table did not produce stable nonzero audio");
            expect (std::abs (output - cached.floats[noteOutputOffset + 1]) < 1.0e-6f,
                    "centered voice stereo mismatch");
        }
        expect (reads == 3, "per-sample update/render repeated shared-data lookups");
    });
}

Store::ByteResource mseg (int serial, bool descending = false)
{
    auto result = std::make_shared<std::vector<int32_t>> (2051 + 4);
    const int32_t header[] { 0x4d534547, session, serial, 2051 };
    std::copy (std::begin (header), std::end (header), result->begin());
    for (int i = 0; i < 2051; ++i)
    {
        const float ascending = std::clamp (static_cast<float> (i - 1) / 2047.0f, 0.0f, 1.0f);
        const float value = descending ? 1.0f - ascending : ascending;
        std::memcpy (result->data() + 4 + i, &value, sizeof (value));
    }
    return result;
}

void testSharedMsegScopesInterpolationAndRetirement()
{
    constexpr size_t curveBytes = (2051 + 4) * sizeof (int32_t);
    PatchData data (9, curveBytes * 3), nested (9, curveBytes * 2);
    auto initial = mseg (1);
    std::weak_ptr<std::vector<int32_t>> retired = initial;
    submit (data, std::move (initial), 3);
    submit (nested, mseg (1, true), 3);
    block (data, [&]
    {
        SharedMsegBlock snapshot;
        reads = 0;
        snapshot.refresh (countedReader);
        expect (reads == 6, "MSEG snapshot must resolve each curve once");
        expect (sharedMsegSerialNative (3, session) == 1, "MSEG serial not adopted");
        expect (sharedMsegSerialNative (3, session + 1) == 0, "MSEG accepted stale session");
        expect (sharedMsegSerialNative (2, session) == 0, "MSEG accepted wavetable input");
        expect (sharedMsegSerialNative (9, session) == 0, "MSEG accepted out-of-range input");
        for (int i = 0; i <= 100; ++i)
        {
            const float x = static_cast<float> (i) / 100.0f;
            expect (std::abs (snapshot.sample (3, session, 1, x) - x) < 1.0e-6f,
                    "MSEG interpolation differs from padded linear curve");
        }
        expect (reads == 6, "MSEG sample repeated storage lookup");
        expect (snapshot.sample (3, session, 2, 0.25f) == 0.5f, "MSEG accepted stale serial");
        expect (snapshot.sample (4, session, 1, 0.25f) == 0.5f, "missing MSEG lacks initial value");
        block (nested, [&]
        {
            expect (std::abs (sampleSharedMsegNative (3, session, 1, 0.25f) - 0.75f) < 1.0e-6f,
                    "nested MSEG scope borrowed outer curve");
        });
        expect (std::abs (sampleSharedMsegNative (3, session, 1, 0.25f) - 0.25f) < 1.0e-6f,
                "outer MSEG scope not restored");
        submit (data, mseg (2, true), 3);
        expect (std::abs (sampleSharedMsegNative (3, session, 1, 0.25f) - 0.25f) < 1.0e-6f,
                "MSEG changed allocation inside block");
    });
    block (data, [&]
    {
        expect (sharedMsegSerialNative (3, session) == 2, "replacement MSEG serial not adopted");
        expect (std::abs (sampleSharedMsegNative (3, session, 2, 0.25f) - 0.75f) < 1.0e-6f,
                "replacement MSEG retained old pointer");
        expect (! retired.expired(), "MSEG retired during render block");
    });
    expect (retired.expired(), "MSEG allocation not reclaimed after block");
    expect (sharedMsegSerialNative (3, session) == 0, "MSEG metadata leaked outside render scope");
    expect (sampleSharedMsegNative (3, session, 2, 0.25f) == 0.5f, "MSEG pointer leaked outside render scope");
    auto invalid = mseg (3);
    (*invalid)[3] = 2048;
    submit (data, std::move (invalid), 3);
    block (data, [&]
    {
        expect (sharedMsegSerialNative (3, session) == 0, "MSEG accepted invalid sample count");
        expect (sampleSharedMsegNative (3, session, 2, 0.25f) == 0.5f, "MSEG retained invalidated pointer");
    });
}
}

int main()
{
    try
    {
        testInstancesAndNestedScopes();
        testReplacementRetirementAndSessionReset();
        testLookupCountAndConstantAudio();
        testSharedMsegScopesInterpolationAndRetirement();
        std::cout << "PASS shared table and MSEG blocks: instance isolation, nested scopes, retirement, reset, lookup count, interpolation and constant audio\n";
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
