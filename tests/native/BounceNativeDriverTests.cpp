#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdint>
#include <iostream>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <utility>
#include <vector>

#include "../../native/bounce/BounceNativeDriver.h"

namespace
{
using namespace cosimo::bounce;

void expect (bool condition, const char* message)
{
    if (! condition)
        throw std::runtime_error (message);
}

struct SharedObservations
{
    std::mutex mutex;
    std::vector<std::int32_t> sessions;
    std::vector<std::int32_t> roots;
    std::uint32_t largestBlock = 0;
    std::uint32_t performerCount = 0;
};

class DecayingSinePerformer final : public OfflinePerformer
{
public:
    DecayingSinePerformer (std::shared_ptr<SharedObservations> observationsToUse,
                          const std::atomic<bool>* cancellationToTrigger = nullptr)
        : observations (std::move (observationsToUse)),
          cancellation (cancellationToTrigger)
    {
    }

    void initialise (std::int32_t session,
                     double rate,
                     double bpm,
                     std::int32_t root) override
    {
        expect (rate == 48000.0, "driver changed the requested sample rate");
        expect (bpm == 123.0, "driver changed the frozen tempo");
        sampleRate = rate;
        rootNote = root;
        const std::lock_guard<std::mutex> lock (observations->mutex);
        observations->sessions.push_back (session);
        observations->roots.push_back (root);
        ++observations->performerCount;
    }

    void noteOn (std::int32_t note, std::uint8_t velocity) override
    {
        expect (note == rootNote, "driver sent note-on for the wrong root");
        expect (velocity == captureVelocity, "driver changed capture velocity");
        active = true;
    }

    void noteOff (std::int32_t note) override
    {
        expect (note == rootNote, "driver sent note-off for the wrong root");
        released = true;
        releaseFrame = renderedFrames;
    }

    void process (float* left, float* right, std::uint32_t frameCount) override
    {
        expect (active, "driver processed before note-on");
        expect (frameCount > 0 && frameCount <= maxOfflineBlockFrames,
                "driver exceeded the fixed offline block bound");
        {
            const std::lock_guard<std::mutex> lock (observations->mutex);
            observations->largestBlock = std::max (observations->largestBlock, frameCount);
        }
        for (auto frame = std::uint32_t { 0 }; frame < frameCount; ++frame)
        {
            auto gain = 0.25;
            if (released)
            {
                const auto age = renderedFrames + frame - releaseFrame;
                gain = age < 320 ? 0.25 * (1.0 - static_cast<double> (age) / 320.0) : 0.0;
            }
            const auto phase = 2.0 * 3.14159265358979323846
                             * (110.0 + rootNote) * (renderedFrames + frame) / sampleRate;
            left[frame] = static_cast<float> (std::sin (phase) * gain);
            right[frame] = left[frame];
        }
        renderedFrames += frameCount;

        if (cancellation != nullptr && renderedFrames >= 128)
            const_cast<std::atomic<bool>*> (cancellation)->store (true);
    }

    std::size_t residentBytes() const noexcept override { return 135'615'616; }

private:
    std::shared_ptr<SharedObservations> observations;
    const std::atomic<bool>* cancellation = nullptr;
    double sampleRate = 0.0;
    std::int32_t rootNote = 0;
    std::uint32_t renderedFrames = 0;
    std::uint32_t releaseFrame = 0;
    bool active = false;
    bool released = false;
};

CapturePlan makePlan()
{
    CapturePlan plan;
    plan.sampleRate = 48000;
    plan.tempoBpm = 123.0;
    plan.roots = { 48, 60, 72 };
    plan.holdFrames = 256;
    plan.tailCapFrames = 1024;
    plan.silenceWindowFrames = 64;
    plan.tailPaddingFrames = 128;
    plan.blockFrames = 128;
    return plan;
}

void testSequentialCaptureAndFlush()
{
    auto observations = std::make_shared<SharedObservations>();
    std::vector<RootCapture> roots;
    std::vector<CaptureProgress> progress;
    std::atomic<bool> cancelled { false };

    const auto summary = SequentialCaptureDriver {}.capture (
        makePlan(),
        [observations] (std::uint32_t, std::int32_t)
        {
            return std::make_unique<DecayingSinePerformer> (observations);
        },
        [&roots] (RootCapture&& root) { roots.push_back (std::move (root)); },
        [&progress] (const CaptureProgress& value) { progress.push_back (value); },
        cancelled);

    expect (roots.size() == 3, "driver did not flush exactly one result per root");
    expect (progress.size() == 3 && progress.back().completedRoots == 3,
            "driver progress did not complete every root");
    expect (summary.metrics.size() == 3 && summary.totalFrameCount > 0,
            "driver summary omitted capture accounting");
    expect (observations->performerCount == 3,
            "driver reused an offline performer between roots");
    expect (observations->sessions == std::vector<std::int32_t> ({
                firstDeterministicSessionID,
                firstDeterministicSessionID + 1,
                firstDeterministicSessionID + 2,
            }),
            "driver did not assign fresh deterministic sessions");
    expect (observations->largestBlock == 128,
            "driver did not preserve the fixed 128-frame upper bound");

    for (std::size_t index = 0; index < roots.size(); ++index)
    {
        const auto& root = roots[index];
        expect (root.rootIndex == index && root.rootNote == makePlan().roots[index],
                "driver changed root ordering");
        expect (root.noteOffFrameOffset == makePlan().holdFrames,
                "driver changed the logical note-off offset");
        expect (root.frameCount > makePlan().holdFrames
                    && root.frameCount < makePlan().holdFrames + makePlan().tailCapFrames,
                "driver did not silence-truncate the release tail");
        expect (root.interleavedStereo.size() == root.frameCount * 2,
                "driver emitted malformed stereo i16 PCM");
        expect (root.peak > 0.1f,
                "driver emitted a silent captured root");
        expect (root.metrics.performerResidentBytes == 135'615'616,
                "driver lost performer memory accounting");
    }
}

void testCancellationAndCapacity()
{
    auto observations = std::make_shared<SharedObservations>();
    auto plan = makePlan();
    plan.roots = { 60 };
    std::atomic<bool> cancelled { false };
    bool sawCancellation = false;
    try
    {
        SequentialCaptureDriver {}.capture (
            plan,
            [observations, &cancelled] (std::uint32_t, std::int32_t)
            {
                return std::make_unique<DecayingSinePerformer> (observations, &cancelled);
            },
            [] (RootCapture&&) {},
            {},
            cancelled);
    }
    catch (const CaptureCancelled&)
    {
        sawCancellation = true;
    }
    expect (sawCancellation, "driver did not stop at a block-boundary cancellation");

    cancelled = false;
    plan.bankFrameCapacity = 300;
    bool sawCapacityFailure = false;
    try
    {
        SequentialCaptureDriver {}.capture (
            plan,
            [observations] (std::uint32_t, std::int32_t)
            {
                return std::make_unique<DecayingSinePerformer> (observations);
            },
            [] (RootCapture&&) {},
            {},
            cancelled);
    }
    catch (const std::runtime_error& error)
    {
        sawCapacityFailure = std::string (error.what()).find ("capacity") != std::string::npos;
    }
    expect (sawCapacityFailure, "driver did not reject a capture above fixed bank capacity");
}

void testBackgroundLifecycleFence()
{
    BackgroundCaptureJob job;
    auto observations = std::make_shared<SharedObservations>();
    auto plan = makePlan();
    plan.roots = { 60 };
    std::mutex completionMutex;
    std::condition_variable completionCondition;
    std::vector<std::uint64_t> completedJobs;
    std::vector<bool> successes;

    const auto startJob = [&]
    {
        return job.start (
            plan,
            [observations] (std::uint32_t, std::int32_t)
            {
                return std::make_unique<DecayingSinePerformer> (observations);
            },
            [] (RootCapture&&) {},
            {},
            [&] (BackgroundCaptureCompletion&& completion)
            {
                {
                    const std::lock_guard<std::mutex> lock (completionMutex);
                    completedJobs.push_back (completion.jobID);
                    successes.push_back (completion.succeeded());
                }
                completionCondition.notify_one();
            });
    };

    const auto first = startJob();
    job.wait();
    const auto second = startJob();
    job.wait();

    expect (first == 1 && second == 2 && job.currentJobID() == 2,
            "background driver did not advance its lifecycle fence");
    expect (completedJobs == std::vector<std::uint64_t> ({ 1, 2 }),
            "background driver lost or duplicated completion");
    expect (successes == std::vector<bool> ({ true, true }),
            "background driver reported a successful job as failed");
    expect (! job.isRunning(), "background driver stayed busy after join");
}
}

int main()
{
    try
    {
        testSequentialCaptureAndFlush();
        testCancellationAndCapacity();
        testBackgroundLifecycleFence();
        std::cout << "PASS native Bounce sequential driver, cancellation, capacity, and lifecycle fencing\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL native Bounce driver: " << error.what() << '\n';
        return 1;
    }
}
