#include "cmajor/helpers/cmaj_SharedData.h"

#include <atomic>
#include <chrono>
#include <cstdint>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <thread>
#include <vector>

namespace
{
using Store = cmaj::SharedDataStore;

void expect (bool condition, const char* message)
{
    if (! condition)
        throw std::runtime_error (message);
}

Store::Resource resource (float value, size_t count = 4)
{
    return Store::makeResource (std::vector<float> (count, value));
}

Store::Ticket request (Store& store, uint32_t input, uint64_t generation)
{
    auto result = store.beginRequest (input, generation);
    expect (result.status == Store::RequestStatus::ready, "request was not ready");
    return result.ticket;
}

void submit (Store& store, uint32_t input, uint64_t generation, Store::Resource data)
{
    expect (store.submit (request (store, input, generation), std::move (data))
                == Store::SubmitResult::accepted, "submission was not accepted");
}

void expectReceipt (const Store::Receipt& receipt, uint32_t input, uint64_t generation)
{
    expect (receipt.input == input && receipt.generation == generation && receipt.serial != 0,
            "receipt lost adoption correlation");
}

void testAdoptionAndBounds()
{
    Store store (2, 128);
    expect (store.size (0) == 0 && store.read (0, 0) == 0, "empty input must read zero");
    expect (store.read (2, 0) == 0 && store.size (2) == 0, "invalid input must read zero");
    auto data = Store::makeResource ({ 1.0f, 2.0f, 3.0f });
    auto ticket = request (store, 0, 42);
    expect (store.submit (ticket, data) == Store::SubmitResult::accepted, "initial submit");
    expect (store.read (0, 0) == 0 && store.drain().empty(), "submission must not adopt or acknowledge");
    store.beginBlock();
    expect (store.size (0) == 3 && store.read (0, 0) == 1 && store.read (0, 2) == 3,
            "beginBlock must expose the complete resource");
    expect (store.read (0, -1) == 0 && store.read (0, 3) == 0
                && store.read (0, std::numeric_limits<int64_t>::max()) == 0,
            "sample bounds must return zero");
    expect (store.drain().empty(), "receipt cannot precede endBlock");
    store.endBlock();
    auto receipts = store.drain();
    expect (receipts.size() == 1, "exactly one initial adoption receipt");
    expectReceipt (receipts[0], 0, 42);
    expect (receipts[0].serial == ticket.serial, "receipt lost request serial");
    store.beginBlock();
    store.endBlock();
    expect (store.drain().empty(), "unchanged block must not repeat a receipt");
}

void testReplacementDuringBlockAndReclamation()
{
    Store store (1, 128);
    auto first = resource (1);
    std::weak_ptr<const std::vector<float>> firstLifetime = first;
    submit (store, 0, 1, std::move (first));
    store.beginBlock();
    store.endBlock();
    store.drain();

    store.beginBlock();
    submit (store, 0, 2, resource (2));
    expect (store.read (0, 0) == 1 && ! firstLifetime.expired(),
            "mid-block submission changed or freed current data");
    store.endBlock();
    expect (store.drain().empty(), "pending update cannot claim adoption");
    store.beginBlock();
    expect (store.read (0, 0) == 2 && ! firstLifetime.expired(), "old data must survive adoption block");
    expect (store.drain().empty() && ! firstLifetime.expired(), "control reclaimed an active transition");
    store.endBlock();
    expect (! firstLifetime.expired(), "audio thread must not destroy retired data");
    auto receipts = store.drain();
    expect (receipts.size() == 1, "replacement receipt missing");
    expectReceipt (receipts[0], 0, 2);
    expect (firstLifetime.expired() && store.retainedBytes() == 16, "control did not reclaim retired data");
}

void testLatestPendingAndReceiptBackpressure()
{
    Store store (1, 128);
    submit (store, 0, 1, resource (1));
    store.beginBlock();
    store.endBlock();
    auto second = resource (2);
    std::weak_ptr<const std::vector<float>> secondLifetime = second;
    submit (store, 0, 2, std::move (second));
    submit (store, 0, 3, resource (3));
    expect (secondLifetime.expired(), "superseded pending data must be reclaimed on control");
    store.beginBlock();
    expect (store.read (0, 0) == 1, "undrained receipt must preserve previous adoption");
    store.endBlock();
    auto receipts = store.drain();
    expect (receipts.size() == 1, "backpressure overwrote previous receipt");
    expectReceipt (receipts[0], 0, 1);
    store.beginBlock();
    expect (store.read (0, 0) == 3, "latest pending replacement did not win");
    store.endBlock();
    receipts = store.drain();
    expect (receipts.size() == 1, "latest adoption receipt missing");
    expectReceipt (receipts[0], 0, 3);
}

void testStaleTicketsGenerationReuseAndOwnerIdentity()
{
    Store store (1, 128);
    Store other (1, 128);
    auto old = request (store, 0, 7);
    auto latest = request (store, 0, 7);
    expect (latest.serial != old.serial, "reused generation needs a distinct request serial");
    expect (store.submit (old, resource (1)) == Store::SubmitResult::staleTicket, "stale completion accepted");
    expect (other.submit (latest, resource (1)) == Store::SubmitResult::staleTicket, "foreign owner ticket accepted");
    expect (store.submit (latest, resource (7)) == Store::SubmitResult::accepted, "latest ticket rejected");
    expect (store.submit (latest, resource (8)) == Store::SubmitResult::staleTicket, "duplicate completion accepted");
    auto newest = request (store, 0, 8);
    store.beginBlock();
    expect (store.read (0, 0) == 0, "new request failed to invalidate older pending resource");
    store.endBlock();
    expect (store.drain().empty(), "cancelled pending resource acknowledged");
    expect (store.submit (newest, {}) == Store::SubmitResult::invalidResource, "null resource accepted");
    expect (store.submit (newest, resource (8)) == Store::SubmitResult::accepted, "invalid payload consumed ticket");
    expect (store.beginRequest (1, 1).status == Store::RequestStatus::invalidInput, "invalid input request accepted");
}

void testSharedResourceHasTwoReaders()
{
    Store store (2, 48);
    auto shared = resource (5);
    std::weak_ptr<const std::vector<float>> lifetime = shared;
    submit (store, 0, 1, shared);
    submit (store, 1, 1, shared);
    shared.reset();
    expect (store.retainedBytes() == 16, "shared resource was charged twice");
    store.beginBlock();
    expect (store.read (0, 3) == 5 && store.read (1, 3) == 5, "two inputs did not share samples");
    store.endBlock();
    expect (store.drain().size() == 2, "two independent adoptions need two receipts");
    submit (store, 0, 2, resource (6));
    store.beginBlock();
    store.endBlock();
    store.drain();
    expect (! lifetime.expired() && store.retainedBytes() == 32, "replacing first reader freed second reader data");
    submit (store, 1, 2, resource (7));
    store.beginBlock();
    expect (store.read (0, 0) == 6 && store.read (1, 0) == 7 && ! lifetime.expired(), "shared retirement too early");
    store.endBlock();
    expect (! lifetime.expired(), "audio released final shared owner");
    store.drain();
    expect (lifetime.expired() && store.retainedBytes() == 32, "final reader retirement not reclaimed");
}

void testBudgetPreservesCurrentAndCanRetry()
{
    Store store (1, 16);
    submit (store, 0, 1, resource (1));
    store.beginBlock();
    store.endBlock();
    store.drain();
    auto ticket = request (store, 0, 2);
    expect (store.submit (ticket, resource (2)) == Store::SubmitResult::budgetExceeded, "byte budget overcommitted");
    store.beginBlock();
    expect (store.read (0, 0) == 1 && store.retainedBytes() == 16, "budget failure disturbed current data");
    store.endBlock();
    expect (store.drain().empty(), "rejected submission acknowledged");

    Store retry (1, 32);
    submit (retry, 0, 1, resource (1));
    retry.beginBlock();
    retry.endBlock();
    retry.drain();
    submit (retry, 0, 2, resource (2));
    retry.beginBlock();
    retry.endBlock();
    auto retryTicket = request (retry, 0, 3);
    auto third = resource (3);
    expect (retry.submit (retryTicket, third) == Store::SubmitResult::budgetExceeded,
            "retired data must still consume budget until control reclaims it");
    retry.drain();
    expect (retry.submit (retryTicket, third) == Store::SubmitResult::accepted,
            "budget rejection consumed the current request ticket");
    retry.beginBlock();
    expect (retry.read (0, 0) == 3, "retried resource did not adopt");
    retry.endBlock();
    auto retriedReceipts = retry.drain();
    expect (retriedReceipts.size() == 1, "retried adoption receipt missing");
    expectReceipt (retriedReceipts[0], 0, 3);

    std::vector<float> overallocated (1, 1);
    overallocated.reserve (64);
    Store capacityBudget (1, 4);
    expect (capacityBudget.submit (request (capacityBudget, 0, 1),
                                   Store::makeResource (std::move (overallocated)))
                == Store::SubmitResult::budgetExceeded,
            "unused vector capacity escaped the payload memory budget");

    // The same immutable allocation needs no extra payload charge.
    Store sharing (2, 16);
    auto shared = resource (3);
    submit (sharing, 0, 1, shared);
    submit (sharing, 1, 1, shared);
    expect (sharing.retainedBytes() == 16, "budget rejected valid sharing");
    Store empty (1, 0);
    submit (empty, 0, 1, Store::makeResource ({}));
    empty.beginBlock();
    expect (empty.size (0) == 0 && empty.read (0, 0) == 0, "empty resource bounds");
    empty.endBlock();
    expect (empty.drain().size() == 1, "empty resource adoption receipt");
}

void testStopResetWithoutAnotherCallback()
{
    Store store (1, 64);
    auto data = resource (1);
    std::weak_ptr<const std::vector<float>> current = data;
    submit (store, 0, 1, std::move (data));
    store.beginBlock();
    store.endBlock();
    store.drain();
    auto stale = request (store, 0, 2);
    auto pending = resource (2);
    std::weak_ptr<const std::vector<float>> pendingLifetime = pending;
    expect (store.submit (stale, std::move (pending)) == Store::SubmitResult::accepted, "pending submit");
    store.stop(); // Audio is quiesced; no follow-up callback is needed for reclamation.
    expect (current.expired() && pendingLifetime.expired() && store.retainedBytes() == 0,
            "stop did not release current and pending resources");
    expect (store.beginRequest (0, 3).status == Store::RequestStatus::stopped, "stopped request accepted");
    expect (store.submit (stale, resource (4)) == Store::SubmitResult::stopped, "completion republished after stop");
    expect (store.drain().empty() && store.read (0, 0) == 0, "stopped state retained receipts or samples");
    store.reset();
    expect (store.submit (stale, resource (4)) == Store::SubmitResult::staleTicket, "pre-reset completion republished");
    submit (store, 0, 2, resource (9));
    store.beginBlock();
    expect (store.read (0, 0) == 9, "reset failed to accept fresh request with reused generation");
    store.endBlock();
    store.stop(); // Undrained receipt also needs no callback.
    expect (store.retainedBytes() == 0 && store.drain().empty(), "stop retained an undrained adoption");
}

void testConcurrentPublication()
{
    constexpr uint64_t replacements = 20000;
    constexpr size_t sampleCount = 64;
    Store store (2, sampleCount * sizeof (float) * 10);
    std::atomic<bool> producerFinished { false }, audioFailed { false };
    std::atomic<uint64_t> blocks { 0 };
    std::vector<uint64_t> heard[2];
    heard[0].reserve (replacements);
    heard[1].reserve (replacements);
    std::thread audio ([&]
    {
        uint64_t last[2] = {};
        uint32_t tailBlocks = 0;
        while (! producerFinished.load (std::memory_order_acquire) || tailBlocks++ < 1000)
        {
            store.beginBlock();
            for (uint32_t input = 0; input != 2; ++input)
            {
                auto size = store.size (input);
                auto first = store.read (input, 0);
                if (size != 0 && size != sampleCount)
                    audioFailed.store (true);
                for (size_t sample = 0; sample < size; ++sample)
                    if (store.read (input, static_cast<int64_t> (sample)) != first)
                        audioFailed.store (true);
                auto generation = static_cast<uint64_t> (first);
                if (generation != last[input])
                {
                    if (generation <= last[input])
                        audioFailed.store (true);
                    heard[input].push_back (generation);
                    last[input] = generation;
                }
            }
            store.endBlock();
            blocks.fetch_add (1, std::memory_order_release);
            std::this_thread::yield();
        }
    });
    std::vector<uint64_t> receipts[2];
    auto drain = [&]
    {
        for (auto receipt : store.drain())
            receipts[receipt.input].push_back (receipt.generation);
    };
    for (uint64_t generation = 1; generation <= replacements; ++generation)
    {
        drain();
        auto data = resource (static_cast<float> (generation), sampleCount);
        for (uint32_t input = 0; input != 2; ++input)
        {
            auto result = store.submit (request (store, input, generation), data);
            if (result != Store::SubmitResult::accepted)
            {
                producerFinished.store (true, std::memory_order_release);
                audio.join();
                expect (false, "bounded concurrent state exceeded its payload budget");
            }
        }
        if (generation % 19 == 0)
            std::this_thread::yield();
    }
    // Wait for the actual final receipts, not an assumed number of callbacks:
    // audio may run many blocks before the control thread is scheduled again.
    const auto finishDeadline = std::chrono::steady_clock::now() + std::chrono::seconds (10);
    const auto finalReceiptsArrived = [&]
    {
        return ! receipts[0].empty() && receipts[0].back() == replacements
            && ! receipts[1].empty() && receipts[1].back() == replacements;
    };
    while (! finalReceiptsArrived() && std::chrono::steady_clock::now() < finishDeadline)
    {
        drain();
        std::this_thread::yield();
    }
    producerFinished.store (true, std::memory_order_release);
    audio.join();
    drain();
    expect (finalReceiptsArrived(), "final concurrent receipts timed out");
    expect (! audioFailed.load(), "concurrent publication produced partial or stale samples");
    for (uint32_t input = 0; input != 2; ++input)
    {
        expect (! heard[input].empty() && heard[input].back() == replacements,
                "latest concurrent replacement never adopted");
        expect (heard[input] == receipts[input], "receipts do not exactly match rendered adoptions");
    }
    store.stop();
    expect (store.retainedBytes() == 0, "concurrent store did not reclaim on stop");
    std::cout << "concurrent blocks=" << blocks.load() << " adoptions="
              << receipts[0].size() + receipts[1].size() << '\n';
}
}

int main()
{
    try
    {
        testAdoptionAndBounds();
        testReplacementDuringBlockAndReclamation();
        testLatestPendingAndReceiptBackpressure();
        testStaleTicketsGenerationReuseAndOwnerIdentity();
        testSharedResourceHasTwoReaders();
        testBudgetPreservesCurrentAndCanRetry();
        testStopResetWithoutAnotherCallback();
        testConcurrentPublication();
        std::cout << "SharedDataStore: 8 tests passed\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL: " << error.what() << '\n';
        return 1;
    }
}
