#pragma once

#include <atomic>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <exception>
#include <functional>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <vector>

namespace cosimo::bounce
{

inline constexpr std::uint32_t maxOfflineBlockFrames = 128;
inline constexpr std::uint32_t maxBankRootCount = 19;
inline constexpr std::uint64_t maxBankFrameCapacity = 5'472'000;
inline constexpr std::int32_t firstDeterministicSessionID = 0x424000;
inline constexpr std::uint8_t captureVelocity = 100;

class CaptureCancelled final : public std::runtime_error
{
public:
    CaptureCancelled();
};

struct CapturePlan
{
    std::uint32_t sampleRate = 48000;
    double tempoBpm = 120.0;
    std::vector<std::int32_t> roots;
    std::uint32_t holdFrames = 144000;
    std::uint32_t tailCapFrames = 288000;
    std::uint32_t silenceWindowFrames = 2400;
    std::uint32_t tailPaddingFrames = 4800;
    float silenceThresholdLinear = 0.0001f;
    std::uint32_t blockFrames = maxOfflineBlockFrames;
    std::uint64_t bankFrameCapacity = maxBankFrameCapacity;
    std::int32_t firstSessionID = firstDeterministicSessionID;

    void validate() const;
};

struct RootMetrics
{
    std::int32_t rootNote = 0;
    std::uint64_t renderedFrameCount = 0;
    std::chrono::nanoseconds elapsed {};
    double realtimeMultiplier = 0.0;
    std::size_t performerResidentBytes = 0;
};

struct RootCapture
{
    std::uint32_t rootIndex = 0;
    std::int32_t rootNote = 0;
    std::uint32_t noteOffFrameOffset = 0;
    std::uint32_t frameCount = 0;
    std::uint32_t tailFrameCount = 0;
    float peak = 0.0f;
    std::vector<std::int16_t> interleavedStereo;
    RootMetrics metrics;
};

struct CaptureProgress
{
    std::uint32_t completedRoots = 0;
    std::uint32_t totalRoots = 0;
    std::int32_t rootNote = 0;
};

struct CaptureSummary
{
    std::uint32_t sampleRate = 0;
    std::uint64_t totalFrameCount = 0;
    std::vector<RootMetrics> metrics;
};

/**
 * One fresh offline patch instance. Implementations may JIT (desktop) or wrap
 * a transient generated performer (iOS), but every method is called only from
 * the capture thread and never from processBlock.
 */
class OfflinePerformer
{
public:
    virtual ~OfflinePerformer() = default;

    virtual void initialise (std::int32_t sessionID,
                             double sampleRate,
                             double tempoBpm,
                             std::int32_t rootNote) = 0;
    virtual void noteOn (std::int32_t note, std::uint8_t velocity) = 0;
    virtual void noteOff (std::int32_t note) = 0;
    virtual void process (float* left, float* right, std::uint32_t frameCount) = 0;
    virtual std::size_t residentBytes() const noexcept { return 0; }
};

using PerformerFactory = std::function<std::unique_ptr<OfflinePerformer> (
    std::uint32_t rootIndex, std::int32_t rootNote)>;
using RootSink = std::function<void (RootCapture&&)>;
using ProgressCallback = std::function<void (const CaptureProgress&)>;

/**
 * Runs the platform-neutral capture loop. RootSink is invoked before the next
 * performer is created, allowing iOS to append PCM to a staging file and free
 * each root immediately instead of retaining both float and i16 banks.
 */
class SequentialCaptureDriver final
{
public:
    CaptureSummary capture (const CapturePlan&,
                            const PerformerFactory&,
                            const RootSink&,
                            const ProgressCallback&,
                            const std::atomic<bool>& cancelRequested) const;
};

struct BackgroundCaptureCompletion
{
    std::uint64_t jobID = 0;
    std::exception_ptr error;
    std::unique_ptr<CaptureSummary> summary;

    bool succeeded() const noexcept { return summary != nullptr && error == nullptr; }
};

using CompletionCallback = std::function<void (BackgroundCaptureCompletion&&)>;

/**
 * Single-job owner modelled on ModulationRestoreProbe: the host starts this
 * object off its audio/message thread, pumps a second patch there, and posts
 * progress/completion back to its UI. Job IDs fence callbacks from a cancelled
 * or superseded lifecycle. Completion runs on the worker thread.
 */
class BackgroundCaptureJob final
{
public:
    BackgroundCaptureJob() = default;
    ~BackgroundCaptureJob();

    BackgroundCaptureJob (const BackgroundCaptureJob&) = delete;
    BackgroundCaptureJob& operator= (const BackgroundCaptureJob&) = delete;

    std::uint64_t start (CapturePlan,
                         PerformerFactory,
                         RootSink,
                         ProgressCallback,
                         CompletionCallback);
    void cancel() noexcept;
    void wait();
    bool isRunning() const noexcept;
    std::uint64_t currentJobID() const noexcept;

private:
    mutable std::mutex mutex;
    std::thread worker;
    std::shared_ptr<std::atomic<bool>> cancelFlag;
    std::atomic<std::uint64_t> jobCounter { 0 };
    std::atomic<std::uint64_t> activeJobID { 0 };
    std::atomic<bool> running { false };
};

} // namespace cosimo::bounce
