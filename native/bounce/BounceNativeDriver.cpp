#include "BounceNativeDriver.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <string>
#include <utility>

namespace cosimo::bounce
{
namespace
{

void require (bool condition, const char* message)
{
    if (! condition)
        throw std::invalid_argument (message);
}

void checkCancellation (const std::atomic<bool>& cancelRequested)
{
    if (cancelRequested.load (std::memory_order_relaxed))
        throw CaptureCancelled {};
}

float stereoWindowRMS (const std::vector<float>& samples,
                       std::uint32_t firstFrame,
                       std::uint32_t frameCount)
{
    const auto availableFrames = static_cast<std::uint32_t> (samples.size() / 2);
    const auto lastFrame = std::min (availableFrames, firstFrame + frameCount);
    if (firstFrame >= lastFrame)
        return 0.0f;

    double sumSquares = 0.0;
    for (auto frame = firstFrame; frame < lastFrame; ++frame)
    {
        const auto offset = static_cast<std::size_t> (frame) * 2;
        const auto left = static_cast<double> (samples[offset]);
        const auto right = static_cast<double> (samples[offset + 1]);
        sumSquares += 0.5 * ((left * left) + (right * right));
    }

    return static_cast<float> (std::sqrt (
        sumSquares / static_cast<double> (lastFrame - firstFrame)));
}

std::uint32_t findTailEndFrame (const std::vector<float>& samples,
                                const CapturePlan& plan)
{
    const auto totalFrames = static_cast<std::uint32_t> (samples.size() / 2);
    auto lastActiveFrame = plan.holdFrames;

    for (auto firstFrame = plan.holdFrames;
         firstFrame < totalFrames;
         firstFrame += plan.silenceWindowFrames)
    {
        const auto count = std::min (plan.silenceWindowFrames, totalFrames - firstFrame);
        if (stereoWindowRMS (samples, firstFrame, count) >= plan.silenceThresholdLinear)
            lastActiveFrame = firstFrame + count;
    }

    const auto minimumEnd = static_cast<std::uint64_t> (plan.holdFrames) + 4;
    const auto paddedEnd = static_cast<std::uint64_t> (lastActiveFrame)
                         + plan.tailPaddingFrames;
    return static_cast<std::uint32_t> (std::min<std::uint64_t> (
        totalFrames, std::max (minimumEnd, paddedEnd)));
}

std::int16_t quantizeFloatToInt16 (float sample) noexcept
{
    const auto finite = std::isfinite (sample) ? sample : 0.0f;
    const auto clamped = std::clamp (finite, -1.0f, 1.0f);
    // floor(x + 0.5) deliberately matches JavaScript Math.round, including
    // negative half-way values, so native/browser banks remain byte-stable.
    const auto rounded = static_cast<std::int32_t> (
        std::floor (static_cast<double> (clamped) * 32768.0 + 0.5));
    return static_cast<std::int16_t> (std::clamp (rounded, -32768, 32767));
}

RootCapture renderRoot (const CapturePlan& plan,
                        std::uint32_t rootIndex,
                        std::int32_t rootNote,
                        OfflinePerformer& performer,
                        const std::atomic<bool>& cancelRequested)
{
    checkCancellation (cancelRequested);
    const auto totalFrames64 = static_cast<std::uint64_t> (plan.holdFrames)
                             + plan.tailCapFrames;
    require (totalFrames64 <= std::numeric_limits<std::uint32_t>::max(),
             "Bounce render length exceeds the native frame range");
    const auto totalFrames = static_cast<std::uint32_t> (totalFrames64);

    std::vector<float> rendered (static_cast<std::size_t> (totalFrames) * 2);
    std::vector<float> left (plan.blockFrames);
    std::vector<float> right (plan.blockFrames);
    const auto startedAt = std::chrono::steady_clock::now();

    performer.noteOn (rootNote, captureVelocity);
    auto frameOffset = std::uint32_t { 0 };
    while (frameOffset < totalFrames)
    {
        checkCancellation (cancelRequested);
        if (frameOffset == plan.holdFrames)
            performer.noteOff (rootNote);

        auto count = std::min (plan.blockFrames, totalFrames - frameOffset);
        if (frameOffset < plan.holdFrames && frameOffset + count > plan.holdFrames)
            count = plan.holdFrames - frameOffset;

        performer.process (left.data(), right.data(), count);
        for (auto frame = std::uint32_t { 0 }; frame < count; ++frame)
        {
            const auto target = static_cast<std::size_t> (frameOffset + frame) * 2;
            rendered[target] = left[frame];
            rendered[target + 1] = right[frame];
        }
        frameOffset += count;
    }

    const auto retainedFrames = findTailEndFrame (rendered, plan);
    auto peak = 0.0f;
    for (auto index = std::size_t { 0 };
         index < static_cast<std::size_t> (retainedFrames) * 2;
         ++index)
    {
        const auto value = std::isfinite (rendered[index]) ? rendered[index] : 0.0f;
        peak = std::max (peak, std::abs (value));
    }
    if (peak < plan.silenceThresholdLinear)
        throw std::runtime_error ("Bounce root " + std::to_string (rootNote)
                                  + " captured silence");

    RootCapture root;
    root.rootIndex = rootIndex;
    root.rootNote = rootNote;
    root.noteOffFrameOffset = plan.holdFrames;
    root.frameCount = retainedFrames;
    root.tailFrameCount = retainedFrames - plan.holdFrames;
    root.peak = peak;
    root.interleavedStereo.resize (static_cast<std::size_t> (retainedFrames) * 2);
    std::transform (rendered.begin(),
                    rendered.begin() + static_cast<std::ptrdiff_t> (root.interleavedStereo.size()),
                    root.interleavedStereo.begin(),
                    quantizeFloatToInt16);

    root.metrics.rootNote = rootNote;
    root.metrics.renderedFrameCount = totalFrames;
    root.metrics.elapsed = std::chrono::steady_clock::now() - startedAt;
    const auto elapsedSeconds = std::chrono::duration<double> (root.metrics.elapsed).count();
    root.metrics.realtimeMultiplier = elapsedSeconds > 0.0
        ? static_cast<double> (totalFrames) / (elapsedSeconds * plan.sampleRate)
        : 0.0;
    root.metrics.performerResidentBytes = performer.residentBytes();
    return root;
}

} // namespace

CaptureCancelled::CaptureCancelled()
    : std::runtime_error ("Bounce capture was cancelled")
{
}

void CapturePlan::validate() const
{
    require (sampleRate >= 8000 && sampleRate <= 384000,
             "Bounce sample rate must be from 8000 to 384000 Hz");
    require (std::isfinite (tempoBpm) && tempoBpm > 0.0,
             "Bounce tempo must be positive and finite");
    require (! roots.empty() && roots.size() <= maxBankRootCount,
             "Bounce plan must contain 1 to 19 roots");
    auto previous = std::int32_t { -1 };
    for (const auto root : roots)
    {
        require (root >= 0 && root <= 127,
                 "Bounce roots must be MIDI notes");
        require (root > previous,
                 "Bounce roots must be strictly ascending");
        previous = root;
    }
    require (holdFrames > 0 && tailCapFrames > 0,
             "Bounce hold and tail lengths must be positive");
    require (silenceWindowFrames > 0,
             "Bounce silence window must be positive");
    require (tailPaddingFrames >= silenceWindowFrames,
             "Bounce tail padding must cover at least one silence window");
    require (std::isfinite (silenceThresholdLinear)
                 && silenceThresholdLinear > 0.0f
                 && silenceThresholdLinear < 1.0f,
             "Bounce silence threshold must be in (0, 1)");
    require (blockFrames > 0 && blockFrames <= maxOfflineBlockFrames,
             "Bounce offline blocks must contain 1 to 128 frames");
    require (bankFrameCapacity > 0 && bankFrameCapacity <= maxBankFrameCapacity,
             "Bounce bank capacity exceeds the performer contract");
    require (firstSessionID >= 0
                 && static_cast<std::uint64_t> (firstSessionID) + roots.size()
                    <= static_cast<std::uint64_t> (std::numeric_limits<std::int32_t>::max()),
             "Bounce session ID range is invalid");
}

CaptureSummary SequentialCaptureDriver::capture (
    const CapturePlan& plan,
    const PerformerFactory& performerFactory,
    const RootSink& rootSink,
    const ProgressCallback& onProgress,
    const std::atomic<bool>& cancelRequested) const
{
    plan.validate();
    require (static_cast<bool> (performerFactory), "Bounce performer factory is missing");
    require (static_cast<bool> (rootSink), "Bounce root sink is missing");

    CaptureSummary summary;
    summary.sampleRate = plan.sampleRate;
    summary.metrics.reserve (plan.roots.size());

    for (auto rootIndex = std::uint32_t { 0 };
         rootIndex < plan.roots.size();
         ++rootIndex)
    {
        checkCancellation (cancelRequested);
        const auto rootNote = plan.roots[rootIndex];
        auto performer = performerFactory (rootIndex, rootNote);
        if (performer == nullptr)
            throw std::runtime_error ("Bounce performer factory returned null");

        performer->initialise (plan.firstSessionID + static_cast<std::int32_t> (rootIndex),
                               plan.sampleRate,
                               plan.tempoBpm,
                               rootNote);
        auto root = renderRoot (plan, rootIndex, rootNote, *performer, cancelRequested);
        const auto nextTotal = summary.totalFrameCount + root.frameCount;
        if (nextTotal > plan.bankFrameCapacity)
            throw std::runtime_error ("Bounce capture exceeds the live bank frame capacity");

        summary.totalFrameCount = nextTotal;
        summary.metrics.push_back (root.metrics);
        rootSink (std::move (root));
        if (onProgress)
            onProgress ({ rootIndex + 1,
                          static_cast<std::uint32_t> (plan.roots.size()),
                          rootNote });
    }

    return summary;
}

BackgroundCaptureJob::~BackgroundCaptureJob()
{
    cancel();
    wait();
}

std::uint64_t BackgroundCaptureJob::start (CapturePlan plan,
                                           PerformerFactory performerFactory,
                                           RootSink rootSink,
                                           ProgressCallback onProgress,
                                           CompletionCallback onCompletion)
{
    std::lock_guard<std::mutex> lock (mutex);
    if (running.load (std::memory_order_acquire) || worker.joinable())
        throw std::logic_error ("A native Bounce job is already running");
    if (! onCompletion)
        throw std::invalid_argument ("Native Bounce completion callback is missing");

    const auto jobID = jobCounter.fetch_add (1, std::memory_order_relaxed) + 1;
    activeJobID.store (jobID, std::memory_order_release);
    cancelFlag = std::make_shared<std::atomic<bool>> (false);
    running.store (true, std::memory_order_release);
    const auto localCancelFlag = cancelFlag;

    worker = std::thread ([this,
                           jobID,
                           localCancelFlag,
                           plan = std::move (plan),
                           performerFactory = std::move (performerFactory),
                           rootSink = std::move (rootSink),
                           onProgress = std::move (onProgress),
                           onCompletion = std::move (onCompletion)] () mutable
    {
        BackgroundCaptureCompletion completion;
        completion.jobID = jobID;
        try
        {
            auto summary = SequentialCaptureDriver {}.capture (
                plan, performerFactory, rootSink,
                [this, jobID, localCancelFlag, callback = std::move (onProgress)]
                    (const CaptureProgress& progress)
                {
                    if (callback
                        && ! localCancelFlag->load (std::memory_order_relaxed)
                        && activeJobID.load (std::memory_order_acquire) == jobID)
                        callback (progress);
                },
                *localCancelFlag);
            completion.summary = std::make_unique<CaptureSummary> (std::move (summary));
        }
        catch (...)
        {
            completion.error = std::current_exception();
        }

        running.store (false, std::memory_order_release);
        if (activeJobID.load (std::memory_order_acquire) == jobID)
            onCompletion (std::move (completion));
    });
    return jobID;
}

void BackgroundCaptureJob::cancel() noexcept
{
    std::shared_ptr<std::atomic<bool>> flag;
    {
        std::lock_guard<std::mutex> lock (mutex);
        flag = cancelFlag;
    }
    if (flag != nullptr)
        flag->store (true, std::memory_order_relaxed);
}

void BackgroundCaptureJob::wait()
{
    std::thread threadToJoin;
    {
        std::lock_guard<std::mutex> lock (mutex);
        if (worker.joinable())
            threadToJoin = std::move (worker);
    }
    if (threadToJoin.joinable())
        threadToJoin.join();

    std::lock_guard<std::mutex> lock (mutex);
    cancelFlag.reset();
}

bool BackgroundCaptureJob::isRunning() const noexcept
{
    return running.load (std::memory_order_acquire);
}

std::uint64_t BackgroundCaptureJob::currentJobID() const noexcept
{
    return activeJobID.load (std::memory_order_acquire);
}

} // namespace cosimo::bounce
