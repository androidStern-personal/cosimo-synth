#pragma once

#include "BounceNativeDriver.h"

#include <array>
#include <chrono>
#include <filesystem>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

#include "cmajor/helpers/cmaj_GeneratedCppEngine.h"
#include "cmajor/helpers/cmaj_Patch.h"
#include "cmajor/helpers/cmaj_PatchWorker_QuickJS.h"

namespace cosimo::bounce
{

struct CmajorParameterValue
{
    std::string endpointID;
    float value = 0.0f;
};

struct CmajorSetupEvent
{
    std::string endpointID;
    choc::value::Value value;
    std::uint32_t advanceFrames = 1;
    bool sessionScoped = false;
    // Empty for global setup events. A root-scoped event receives the current
    // MIDI root under this member before it crosses into the offline patch.
    std::string rootNoteField;
};

struct CmajorPatchSnapshot
{
    std::vector<CmajorParameterValue> parameters;
    std::vector<std::pair<std::string, choc::value::Value>> storedState;
    std::vector<CmajorSetupEvent> setupEvents;
    std::vector<CmajorSetupEvent> rootSetupEvents;
    std::uint32_t settleFrames = maxOfflineBlockFrames;

    bool usesSampledSource() const noexcept;
    void validate() const;
};

struct CmajorPatchConfiguration
{
    // configurePatch supplies the JIT or generated-AOT engine, external
    // provider, and QuickJS worker. prepareLoadParams supplies a file or
    // virtual-resource manifest for each fresh root.
    std::function<void (cmaj::Patch&)> configurePatch;
    std::function<void (cmaj::Patch::LoadParams&)> prepareLoadParams;
    std::uint32_t sendTimeoutMilliseconds = 2000;
    std::chrono::milliseconds readyTimeout { 20000 };
    std::size_t performerResidentBytesEstimate = 0;
    std::function<void (std::chrono::nanoseconds)> initialiseDurationReported;

    void validate() const;
};

/** Actual cmaj::Patch adapter used by the desktop JIT and iOS AOT drivers. */
class CmajorBounceOfflinePerformer final : public OfflinePerformer
{
public:
    CmajorBounceOfflinePerformer (CmajorPatchConfiguration,
                                  CmajorPatchSnapshot);
    ~CmajorBounceOfflinePerformer() override;

    void initialise (std::int32_t sessionID,
                     double sampleRate,
                     double tempoBpm,
                     std::int32_t rootNote) override;
    void noteOn (std::int32_t note, std::uint8_t velocity) override;
    void noteOff (std::int32_t note) override;
    void process (float* left, float* right, std::uint32_t frameCount) override;
    std::size_t residentBytes() const noexcept override;

    std::chrono::nanoseconds lastInitialiseDuration() const noexcept;

private:
    void installSetupEvent (const CmajorSetupEvent&,
                            std::int32_t sessionID,
                            std::int32_t rootNote);
    void pumpDiscard (std::uint32_t frameCount);
    std::int32_t waitForDSPCurrentSession();
    void waitUntilReady();
    void throwIfPatchFailed();
    void resetObservations();

    CmajorPatchConfiguration configuration;
    CmajorPatchSnapshot snapshot;
    std::unique_ptr<cmaj::Patch> patch;
    mutable std::mutex observationMutex;
    std::array<bool, 3> oscillatorReady {};
    std::int32_t observedDspSessionID = 0;
    bool bounceBankReady = false;
    bool playbackActive = false;
    std::int32_t rejectedBounceDeliverySerial = 0;
    std::int32_t bounceRejectionReason = 0;
    std::string patchError;
    std::chrono::nanoseconds initialiseDuration {};
};

/** Desktop: a second JIT patch, QuickJS worker, no auto-rebuild watcher. */
CmajorPatchConfiguration createDesktopJITBounceConfiguration (
    std::filesystem::path manifestPath,
    std::size_t performerResidentBytesEstimate = 0);

/**
 * iOS: one transient generated/AOT performer, roots sequential. The caller
 * supplies the same virtual-manifest callback as the live GeneratedPlugin.
 * AUv3 policy may decline to create this factory and direct capture to the
 * standalone App-Group writer if the on-device memory gate fails.
 */
template <typename GeneratedPerformerClass>
CmajorPatchConfiguration createIOSAOTBounceConfiguration (
    std::function<void (cmaj::Patch::LoadParams&)> prepareLoadParams,
    std::size_t performerResidentBytesEstimate = sizeof (GeneratedPerformerClass))
{
    CmajorPatchConfiguration configuration;
    configuration.configurePatch = [] (cmaj::Patch& target)
    {
        target.setAutoRebuildOnFileChange (false);
        cmaj::enableQuickJSPatchWorker (target);
        target.createEngine = []
        {
            return cmaj::createEngineForGeneratedCppProgram<GeneratedPerformerClass>();
        };
    };
    configuration.prepareLoadParams = std::move (prepareLoadParams);
    configuration.performerResidentBytesEstimate = performerResidentBytesEstimate;
    configuration.validate();
    return configuration;
}

inline PerformerFactory createCmajorPerformerFactory (
    CmajorPatchConfiguration configuration,
    CmajorPatchSnapshot snapshot)
{
    configuration.validate();
    snapshot.validate();
    return [configuration = std::move (configuration),
            snapshot = std::move (snapshot)] (std::uint32_t, std::int32_t)
    {
        return std::make_unique<CmajorBounceOfflinePerformer> (configuration, snapshot);
    };
}

} // namespace cosimo::bounce
