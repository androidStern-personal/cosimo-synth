#include "cmajor/helpers/cmaj_PatchSharedData.h"
#include <iostream>
#include <stdexcept>

using Data = cmaj::PatchSharedData;
using Value = choc::value::Value;

static void expect (bool condition, const char* reason)
{
    if (! condition) throw std::runtime_error (reason);
}

static Value scope (int document = 0) { return choc::json::create ("owner", "worker", "document", document); }
static Value message (const char* kind, int request = 1, int document = 0)
{
    return choc::json::create ("kind", kind, "request", request, "scope", scope (document));
}
static Value begin (int input, int count, int generation = 1)
{
    auto value = message ("begin");
    value.addMember ("input", input, "sampleCount", count, "generation", generation);
    return value;
}
static Value transferMessage (const char* kind, int64_t transfer, int request = 2, int document = 0)
{
    auto value = message (kind, request, document);
    value.addMember ("transfer", transfer);
    return value;
}
static Value write (int64_t transfer, int offset, std::initializer_list<float> samples)
{
    auto value = transferMessage ("write", transfer);
    auto data = choc::value::createArray (static_cast<uint32_t> (samples.size()), [&] (uint32_t i) { return samples.begin()[i]; });
    value.addMember ("offset", offset, "samples", data);
    return value;
}
static bool replyIs (const Data::Replies& replies, const char* kind, const char* reason = nullptr)
{
    return replies.size() == 1 && replies[0]["kind"].toString() == kind
        && (reason == nullptr || replies[0]["reason"].toString() == reason);
}

int main()
{
    try
    {
        Data data (2, 32);
        expect (replyIs (data.handle ({}, false), "failed", "invalid-request"), "missing body did not fail cleanly");
        expect (replyIs (data.handle (Value (42), false), "failed", "invalid-request"), "primitive body did not fail cleanly");
        expect (replyIs (data.handle (begin (0, 4), false), "failed", "stale-scope"), "unauthorised begin");
        auto ready = data.handle (begin (0, 4), true);
        expect (replyIs (ready, "ready"), "begin did not stage resource");
        auto transfer = ready[0]["transfer"].get<int64_t>();
        expect (replyIs (data.handle (write (transfer, 0, { 1, 2 }), false), "failed", "stale-scope"), "unauthorised write");
        expect (replyIs (data.handle (write (transfer, 1, { 1, 2 }), true), "failed", "invalid-chunk"), "out of order write");
        expect (replyIs (data.handle (write (transfer, 0, { 1, 2 }), true), "written"), "valid first chunk");
        expect (replyIs (data.handle (transferMessage ("commit", transfer), true), "failed", "incomplete-transfer"), "partial resource committed");
        expect (replyIs (data.handle (write (transfer, 2, { 3, 4 }), true), "written"), "valid second chunk");
        expect (data.handle (transferMessage ("commit", transfer, 9), true).empty(), "commit acknowledged before rendering");
        expect (data.drain().empty(), "drain acknowledged unadopted data");
        data.store.beginBlock();
        {
            Data::ReadScope reading (&data);
            expect (Data::size (0) == 4 && Data::read (0, 3) == 4 && Data::read (0, -1) == 0, "native read context");
            Data other (1, 16);
            {
                Data::ReadScope nested (&other);
                expect (Data::size (0) == 0 && Data::read (0, 0) == 0, "nested context isolated");
            }
            expect (Data::read (0, 3) == 4, "nested context did not restore outer store");
        }
        expect (Data::size (0) == 0 && Data::read (0, 0) == 0, "read context leaked out of render");
        expect (data.drain().empty(), "applied preceded endBlock");
        data.store.endBlock();
        auto applied = data.drain();
        expect (replyIs (applied, "applied") && applied[0]["request"].get<int>() == 9,
                "receipt lost commit correlation");
        expect (replyIs (data.handle (begin (1, 5), true), "failed", "budget-exceeded"), "staging ignored retained budget");
        ready = data.handle (begin (1, 4), true);
        expect (replyIs (ready, "ready"), "available staging budget rejected");
        auto second = ready[0]["transfer"].get<int64_t>();
        expect (replyIs (data.handle (begin (0, 1), true), "failed", "budget-exceeded"), "simultaneous staging not charged");
        expect (replyIs (data.handle (transferMessage ("cancel", second, 3, 1), false), "failed", "stale-scope"), "foreign scope cancelled resource");
        expect (replyIs (data.handle (transferMessage ("cancel", second), false), "cancelled"), "exact stale scope could not release transfer");
        expect (replyIs (data.handle (transferMessage ("cancel", second), false), "cancelled"), "cancel was not idempotent");
        ready = data.handle (begin (1, 4), true);
        second = ready[0]["transfer"].get<int64_t>();
        data.handle (write (second, 0, { 5, 6, 7, 8 }), true);
        data.handle (transferMessage ("commit", second, 11), true);
        expect (replyIs (data.revoke(), "failed", "stale-scope"), "revoke did not settle pending commit");
        data.store.beginBlock();
        expect (data.store.size (1) == 0 && data.store.read (0, 3) == 4, "revoked pending data adopted or current was lost");
        data.store.endBlock();
        expect (data.drain().empty(), "revoked data acknowledged");
        expect (replyIs (data.handle (write (second, 0, { 9 }), false), "failed", "stale-scope"), "revoked write accepted");
        auto oversized = write (second, 0, { 1 });
        oversized.setMember ("samples", choc::value::createArray (8193, [] (uint32_t) { return 1.0f; }));
        ready = data.handle (begin (1, 1), true);
        oversized.setMember ("transfer", ready[0]["transfer"]);
        expect (replyIs (data.handle (oversized, true), "failed", "invalid-chunk"), "unbounded chunk accepted");
        expect (Data::create ({}).get() == nullptr, "absent manifest option enabled shared data");
        bool invalid = false;
        try { Data::create (choc::json::create ("inputCount", 0, "maxRetainedBytes", 32)); }
        catch (const std::runtime_error&) { invalid = true; }
        expect (invalid, "invalid manifest accepted");
        Data lostReady (1, 16);
        auto lost = lostReady.handle (begin (0, 4), true);
        const auto lostTransfer = lost[0]["transfer"].get<int64_t>();
        auto cancelByBegin = message ("cancel", 100, 1);
        cancelByBegin.addMember ("beginRequest", 1);
        expect (replyIs (lostReady.handle (cancelByBegin, false), "cancelled"), "unknown begin cancellation not idempotent");
        expect (replyIs (lostReady.handle (write (lostTransfer, 0, { 1, 2 }), true), "written"),
                "another document cancelled a matching begin request id");
        cancelByBegin.setMember ("scope", scope());
        expect (replyIs (lostReady.handle (cancelByBegin, false), "cancelled"), "lost-ready cancellation failed");
        expect (replyIs (lostReady.handle (cancelByBegin, false), "cancelled"), "lost-ready cancellation not idempotent");
        expect (replyIs (lostReady.handle (write (lostTransfer, 2, { 3, 4 }), true), "failed", "invalid-transfer"),
                "cancelled begin request still owned staging");
        expect (replyIs (lostReady.handle (begin (0, 4), true), "ready"), "lost-ready cancellation leaked staging budget");
        lostReady.stop();
        data.stop();
        expect (data.store.retainedBytes() == 0 && data.store.size (0) == 0 && data.drain().empty(),
                "quiesced stop retained current payload or a pending receipt");
        std::cout << "PatchSharedData protocol: passed\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL: " << error.what() << '\n';
        return 1;
    }
}
