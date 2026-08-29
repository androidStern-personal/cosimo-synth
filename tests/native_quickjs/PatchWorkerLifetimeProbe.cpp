#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <functional>
#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

#include "cmajor/helpers/cmaj_AudioMIDIPerformer.h"
#include "cmajor/helpers/cmaj_PatchHelpers.h"

#define private public
#include "cmajor/helpers/cmaj_Patch.h"
#undef private

namespace
{
struct ReentrantContext final : cmaj::Patch::WorkerContext
{
    ReentrantContext (cmaj::Patch::PatchWorker& workerToUse,
                      std::atomic<int>& deliveryCountToUse,
                      std::atomic<bool>& detachedBeforeContextDestructionToUse,
                      std::function<void()> destroyWorkerToUse)
        : worker (workerToUse),
          deliveryCount (deliveryCountToUse),
          detachedBeforeContextDestruction (detachedBeforeContextDestructionToUse),
          destroyWorker (std::move (destroyWorkerToUse))
    {}

    ~ReentrantContext() override
    {
        detachedBeforeContextDestruction = ! worker.isActive();
    }

    void initialise (std::function<void(const choc::value::ValueView&)>,
                     std::function<void(const std::string&)>) override
    {}

    void sendMessage (const std::string&,
                      std::function<void(const std::string&)>) override
    {
        const auto delivery = ++deliveryCount;

        if (delivery == 1)
        {
            // This re-enters PatchWorker::postMessage while the initial queue is
            // being drained. Delivering that queue under its mutex deadlocks here.
            worker.sendMessage (choc::value::createObject (
                "patchWorkerProbe", "type", "reentrant-probe"));
            return;
        }

        if (delivery == 2)
        {
            auto finish = destroyWorker;
            choc::messageloop::postMessage ([finish = std::move (finish)]
            {
                finish();
                choc::messageloop::stop();
            });
        }
    }

    cmaj::Patch::PatchWorker& worker;
    std::atomic<int>& deliveryCount;
    std::atomic<bool>& detachedBeforeContextDestruction;
    std::function<void()> destroyWorker;
};
}

int main()
{
    choc::messageloop::initialise();

    cmaj::Patch patch;
    std::unique_ptr<cmaj::Patch::PatchWorker> worker;
    std::atomic<int> deliveryCount { 0 };
    std::atomic<bool> detachedBeforeContextDestruction { false };

    patch.createContextForPatchWorker = [&] (std::string)
    {
        return std::make_unique<ReentrantContext> (
            *worker,
            deliveryCount,
            detachedBeforeContextDestruction,
            [&worker] { worker.reset(); });
    };

    worker = std::make_unique<cmaj::Patch::PatchWorker> (patch);
    worker->sendMessage (choc::value::createObject (
        "patchWorkerProbe", "type", "initial-probe"));
    choc::messageloop::run();

    if (worker)
        worker.reset();

    if (deliveryCount != 2)
    {
        std::cerr << "FAIL: re-entrant PatchWorker delivery count was "
                  << deliveryCount.load() << ", expected 2\n";
        return 1;
    }

    if (! detachedBeforeContextDestruction)
    {
        std::cerr << "FAIL: PatchWorker context was destroyed before its PatchView detached\n";
        return 1;
    }

    std::cout << "PASS: PatchWorker re-entrant queue and early detachment behavior\n";
    return 0;
}
