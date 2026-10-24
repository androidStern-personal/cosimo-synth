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
template <typename Fn> static bool rejects (Fn run)
{
    try { run(); } catch (const std::runtime_error&) { return true; }
    return false;
}
static void fill (Data::Reservation& reservation, std::initializer_list<float> samples)
{
    expect (reservation.bytes->size() * sizeof(int32_t) == samples.size() * sizeof(float), "reservation has wrong byte size");
    std::memcpy (reservation.bytes->data(), samples.begin(), samples.size() * sizeof(float));
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
        {
            Data direct (1, 48);
            Data::Replies replies;
            auto reservation = direct.reserve (0, 16, scope(), replies);
            direct.commit (reservation.id, scope());
            expect (direct.drain().empty(), "direct submission reported audio adoption");
            direct.store.beginBlock();
            expect (direct.drain().empty(), "direct resource acknowledged before endBlock");
            direct.store.endBlock();
            const auto applied = direct.drain();
            expect (replyIs (applied, "applied"), "direct adoption did not emit receipt");
            expect (applied[0]["id"].get<uint64_t>() == reservation.id
                    && applied[0]["input"].get<int>() == 0 && applied[0]["scope"]["owner"].toString() == "worker"
                    && applied[0]["generation"].get<uint64_t>() == reservation.id
                    && applied[0]["serial"].get<uint64_t>() > 0, "direct receipt lost correlation");
            expect (direct.drain().empty(), "direct adoption reported twice");
            reservation = direct.reserve (0, 16, scope(), replies);
            direct.commit (reservation.id, scope());
            direct.cancel (reservation.id);
            direct.store.beginBlock(); direct.store.endBlock();
            expect (direct.drain().empty(), "cancelled direct resource acknowledged");
            reservation = direct.reserve (0, 16, scope(), replies);
            direct.commit (reservation.id, scope());
            expect (replyIs (direct.revoke(), "failed", "stale-scope"), "revoked direct submission left waiter unresolved");
            direct.store.beginBlock(); direct.store.endBlock();
            expect (direct.drain().empty(), "revoked direct resource acknowledged");
            reservation = direct.reserve (0, 16, scope(), replies);
            direct.commit (reservation.id, scope());
            replies.clear();
            direct.reserve (0, 16, scope(), replies);
            expect (replyIs (replies, "failed", "superseded"), "superseded direct submission left waiter unresolved");
            direct.stop();
        }
        Data data (2, 32);
        Data::Replies replies;
        expect (rejects ([&] { data.reserve (2, 16, scope(), replies); }), "invalid resource input accepted");
        expect (rejects ([&] { data.reserve (0, 3, scope(), replies); }), "unaligned resource accepted");
        auto reservation = data.reserve (0, 16, scope(), replies);
        fill (reservation, {1, 2, 3, 4});
        data.store.beginBlock();
        expect (data.store.size (0) == 0, "an unpublished writer became audible");
        data.store.endBlock();
        expect (rejects ([&] { data.commit (reservation.id, scope (1)); }), "wrong scope committed a reservation");
        int detached = 0;
        data.setReservationDetach (reservation.id, [&] { ++detached; });
        auto receipt = data.commit (reservation.id, scope());
        expect (detached == 1, "commit did not synchronously detach the writer alias");
        expect (rejects ([&] { data.commit (reservation.id, scope()); }), "reservation committed twice");
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
        expect (replyIs (applied, "applied") && applied[0]["id"].get<uint64_t>() == reservation.id
                && applied[0]["serial"].get<uint64_t>() == receipt.serial, "receipt lost commit correlation");
        expect (rejects ([&] { data.reserve (1, 20, scope(), replies); }), "staging ignored retained budget");
        auto second = data.reserve (1, 16, scope(), replies);
        expect (rejects ([&] { data.reserve (0, 4, scope(), replies); }), "simultaneous staging not charged");
        int cancelledDetach = 0;
        data.setReservationDetach (second.id, [&] { ++cancelledDetach; });
        data.cancel (second.id); data.cancel (second.id);
        expect (cancelledDetach == 1, "cancellation was not idempotent");
        expect (rejects ([&] { data.commit (second.id, scope()); }), "cancelled reservation committed");
        auto next = data.reserve (1, 16, scope(), replies);
        data.cancel (second.id);
        fill (next, {5, 6, 7, 8}); data.commit (next.id, scope());
        expect (replyIs (data.revoke(), "failed", "stale-scope"), "revoke did not settle pending commit");
        data.store.beginBlock();
        expect (data.store.size (1) == 0 && data.store.read (0, 3) == 4, "revoked pending data adopted or current was lost");
        data.store.endBlock();
        expect (data.drain().empty(), "revoked data acknowledged");
        expect (rejects ([&] { data.commit (next.id, scope()); }), "revoked reservation committed");
        expect (Data::create ({}).get() == nullptr, "absent manifest option enabled shared data");
        expect (rejects ([&] { Data::create (choc::json::create ("inputCount", 0, "maxRetainedBytes", 32)); }), "invalid manifest accepted");
        auto reclaimed = data.reserve (1, 16, scope (1), replies);
        fill (reclaimed, {9, 10, 11, 12});
        data.commit (reclaimed.id, scope (1));
        data.store.beginBlock();
        expect (data.store.read (1, 3) == 12, "revocation leaked staging or old cancellation damaged its replacement");
        data.store.endBlock(); data.drain();
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
