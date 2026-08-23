#include <cassert>

#ifndef CHOC_ASSERT
 #define CHOC_ASSERT(x) assert (x)
#endif

#include "CmajorBounceOfflinePerformer.h"

#include "../three_oscillator_renderer/RendererExternalFunctionProvider.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <thread>

namespace cosimo::bounce
{
namespace
{

void require (bool condition, const char* message)
{
    if (! condition)
        throw std::invalid_argument (message);
}

bool validEndpointID (const std::string& endpointID)
{
    if (endpointID.empty()
        || ! ((endpointID.front() >= 'A' && endpointID.front() <= 'Z')
              || (endpointID.front() >= 'a' && endpointID.front() <= 'z')
              || endpointID.front() == '_'))
        return false;

    return std::all_of (endpointID.begin() + 1, endpointID.end(), [] (char character)
    {
        return (character >= 'A' && character <= 'Z')
            || (character >= 'a' && character <= 'z')
            || (character >= '0' && character <= '9')
            || character == '_';
    });
}

choc::value::Value prepareEventValue (const CmajorSetupEvent& event,
                                      std::int32_t sessionID,
                                      std::int32_t rootNote)
{
    auto value = event.value;
    if (event.sessionScoped || ! event.rootNoteField.empty())
    {
        if (! value.isObject())
            throw std::invalid_argument ("Session/root-scoped Bounce setup event must be an object");
        if (event.sessionScoped)
            value.setMember ("dspSessionId", sessionID);
        if (! event.rootNoteField.empty())
            value.setMember (event.rootNoteField, rootNote);
    }
    return value;
}

} // namespace

bool CmajorPatchSnapshot::usesSampledSource() const noexcept
{
    for (const auto& parameter : parameters)
        if (parameter.endpointID == "sourceMode")
            return parameter.value >= 0.5f;
    return false;
}

void CmajorPatchSnapshot::validate() const
{
    require (settleFrames > 0, "Native Bounce snapshot settleFrames must be positive");
    for (const auto& parameter : parameters)
    {
        require (validEndpointID (parameter.endpointID),
                 "Native Bounce snapshot has an invalid parameter endpoint");
        require (std::isfinite (parameter.value),
                 "Native Bounce parameter values must be finite");
    }
    const auto validateEvents = [] (const std::vector<CmajorSetupEvent>& events)
    {
        for (const auto& event : events)
        {
            require (validEndpointID (event.endpointID),
                     "Native Bounce snapshot has an invalid setup endpoint");
            require (event.advanceFrames <= maxOfflineBlockFrames * 1024,
                     "Native Bounce setup event advance is not bounded");
            if (! event.rootNoteField.empty())
                require (validEndpointID (event.rootNoteField),
                         "Native Bounce snapshot has an invalid root field");
        }
    };
    validateEvents (setupEvents);
    validateEvents (rootSetupEvents);
    for (const auto& stored : storedState)
        require (! stored.first.empty(), "Native Bounce stored-state key is empty");
}

void CmajorPatchConfiguration::validate() const
{
    require (static_cast<bool> (configurePatch),
             "Native Bounce Cmajor patch configurator is missing");
    require (static_cast<bool> (prepareLoadParams),
             "Native Bounce Cmajor manifest provider is missing");
    require (sendTimeoutMilliseconds > 0,
             "Native Bounce send timeout must be positive");
    require (readyTimeout.count() > 0,
             "Native Bounce readiness timeout must be positive");
}

CmajorBounceOfflinePerformer::CmajorBounceOfflinePerformer (
    CmajorPatchConfiguration configurationToUse,
    CmajorPatchSnapshot snapshotToUse)
    : configuration (std::move (configurationToUse)),
      snapshot (std::move (snapshotToUse))
{
    configuration.validate();
    snapshot.validate();
}

CmajorBounceOfflinePerformer::~CmajorBounceOfflinePerformer()
{
    if (patch != nullptr)
    {
        patch->statusChanged = [] (const cmaj::Patch::Status&) {};
        patch->handleOutputEvent = [] (std::uint64_t,
                                       std::string_view,
                                       const choc::value::ValueView&) {};
        patch->unload();
    }
}

void CmajorBounceOfflinePerformer::resetObservations()
{
    const std::lock_guard<std::mutex> lock (observationMutex);
    oscillatorReady.fill (false);
    observedDspSessionID = 0;
    bounceBankReady = false;
    playbackActive = false;
    rejectedBounceDeliverySerial = 0;
    bounceRejectionReason = 0;
    patchError.clear();
}

void CmajorBounceOfflinePerformer::initialise (std::int32_t sessionID,
                                               double sampleRate,
                                               double tempoBpm,
                                               std::int32_t rootNote)
{
    if (patch != nullptr)
        throw std::logic_error ("Native Bounce performer cannot be initialised twice");
    if (sessionID < 0 || sampleRate < 8000.0 || sampleRate > 384000.0
        || ! std::isfinite (tempoBpm) || tempoBpm <= 0.0
        || rootNote < 0 || rootNote > 127)
        throw std::invalid_argument ("Native Bounce performer initialisation is invalid");

    // The portable planner supplies a deterministic logical session. A
    // cmaj::Patch owns its engine-session sequence, so the transport events
    // below deliberately use the session observed from this fresh DSP instead.
    static_cast<void> (sessionID);

    resetObservations();
    const auto startedAt = std::chrono::steady_clock::now();
    patch = std::make_unique<cmaj::Patch>();
    configuration.configurePatch (*patch);
    patch->setHostDescription ("Cosimo Native Bounce Offline Driver");
    patch->stopPlayback = [this]
    {
        const std::lock_guard<std::mutex> lock (observationMutex);
        playbackActive = false;
    };
    patch->startPlayback = [this]
    {
        const std::lock_guard<std::mutex> lock (observationMutex);
        playbackActive = true;
    };
    patch->statusChanged = [this] (const cmaj::Patch::Status& status)
    {
        if (! status.messageList.hasErrors())
            return;
        const std::lock_guard<std::mutex> lock (observationMutex);
        patchError = status.messageList.toString();
    };
    patch->handleOutputEvent = [this] (std::uint64_t,
                                       std::string_view endpointID,
                                       const choc::value::ValueView& value)
    {
        const std::lock_guard<std::mutex> lock (observationMutex);
        if (endpointID == "runtimeState")
        {
            observedDspSessionID =
                value["dspSessionId"].getWithDefault<std::int32_t> (observedDspSessionID);
            const auto oscillator = value["oscillatorIndex"].getWithDefault<std::int32_t> (-1);
            if (oscillator >= 0 && oscillator < static_cast<std::int32_t> (oscillatorReady.size()))
                oscillatorReady[static_cast<std::size_t> (oscillator)] =
                    value["hasActive"].getWithDefault<std::int32_t> (0) != 0;
        }
        else if (endpointID == "bounceBankRuntimeState")
        {
            observedDspSessionID =
                value["dspSessionId"].getWithDefault<std::int32_t> (observedDspSessionID);
            bounceBankReady = value["hasActive"].getWithDefault<std::int32_t> (0) != 0;
            rejectedBounceDeliverySerial =
                value["rejectedDeliverySerial"].getWithDefault<std::int32_t> (0);
            bounceRejectionReason = value["rejectionReason"].getWithDefault<std::int32_t> (0);
        }
    };

    for (const auto& stored : snapshot.storedState)
        patch->setStoredStateValue (stored.first, stored.second);

    patch->setPlaybackParams ({ sampleRate, maxOfflineBlockFrames, 0, 2 });
    cmaj::Patch::LoadParams loadParams;
    configuration.prepareLoadParams (loadParams);
    for (const auto& parameter : snapshot.parameters)
        loadParams.parameterValues[parameter.endpointID] = parameter.value;

    if (! patch->loadPatch (loadParams, true) || ! patch->isPlayable())
    {
        throwIfPatchFailed();
        throw std::runtime_error ("Native Bounce production patch did not become playable");
    }
    patch->sendBPM (static_cast<float> (tempoBpm), configuration.sendTimeoutMilliseconds);

    // cmaj::Patch owns the actual engine session sequence. Unlike the direct
    // generated class, its caller cannot inject the planner's session integer.
    // Read the fresh session from DSP before stamping any scoped install so an
    // acknowledgement from an old lifecycle can never be accepted.
    const auto currentDspSessionID = waitForDSPCurrentSession();

    for (const auto& event : snapshot.setupEvents)
        installSetupEvent (event, currentDspSessionID, rootNote);
    for (const auto& event : snapshot.rootSetupEvents)
        installSetupEvent (event, currentDspSessionID, rootNote);

    waitUntilReady();
    pumpDiscard (snapshot.settleFrames);
    throwIfPatchFailed();
    initialiseDuration = std::chrono::steady_clock::now() - startedAt;
    if (configuration.initialiseDurationReported)
        configuration.initialiseDurationReported (initialiseDuration);
}

std::int32_t CmajorBounceOfflinePerformer::waitForDSPCurrentSession()
{
    const auto deadline = std::chrono::steady_clock::now() + configuration.readyTimeout;
    for (;;)
    {
        throwIfPatchFailed();
        {
            const std::lock_guard<std::mutex> lock (observationMutex);
            if (observedDspSessionID != 0)
                return observedDspSessionID;
        }
        if (std::chrono::steady_clock::now() >= deadline)
            throw std::runtime_error ("Native Bounce timed out waiting for a fresh DSP session");
        pumpDiscard (maxOfflineBlockFrames);
        std::this_thread::yield();
    }
}

void CmajorBounceOfflinePerformer::installSetupEvent (const CmajorSetupEvent& event,
                                                       std::int32_t sessionID,
                                                       std::int32_t rootNote)
{
    auto value = prepareEventValue (event, sessionID, rootNote);
    if (! patch->sendEventOrValueToPatch (
            cmaj::EndpointID::create (std::string_view { event.endpointID }),
            value,
            0,
            configuration.sendTimeoutMilliseconds))
        throw std::runtime_error ("Native Bounce could not send setup event " + event.endpointID);
    pumpDiscard (event.advanceFrames);
    throwIfPatchFailed();
}

void CmajorBounceOfflinePerformer::waitUntilReady()
{
    const auto deadline = std::chrono::steady_clock::now() + configuration.readyTimeout;
    for (;;)
    {
        throwIfPatchFailed();
        {
            const std::lock_guard<std::mutex> lock (observationMutex);
            const auto ready = snapshot.usesSampledSource()
                ? bounceBankReady
                : std::all_of (oscillatorReady.begin(), oscillatorReady.end(), [] (bool value)
                  {
                      return value;
                  });
            if (ready)
                return;
            if (rejectedBounceDeliverySerial != 0)
                throw std::runtime_error (
                    "Native Bounce bank setup was rejected (serial="
                    + std::to_string (rejectedBounceDeliverySerial)
                    + ", reason=" + std::to_string (bounceRejectionReason) + ")");
        }
        if (std::chrono::steady_clock::now() >= deadline)
            throw std::runtime_error (snapshot.usesSampledSource()
                ? "Native Bounce timed out waiting for its recursive source bank"
                : "Native Bounce timed out waiting for factory wavetable readiness");

        pumpDiscard (maxOfflineBlockFrames);
        // The QuickJS worker and patch callbacks use the host message loop.
        // Yielding here avoids starving it while the offline pump runs faster
        // than realtime; the timeout remains a bounded wall-clock gate.
        std::this_thread::yield();
    }
}

void CmajorBounceOfflinePerformer::throwIfPatchFailed()
{
    const std::lock_guard<std::mutex> lock (observationMutex);
    if (! patchError.empty())
        throw std::runtime_error ("Native Bounce patch failed: " + patchError);
    if (! playbackActive)
        throw std::runtime_error ("Native Bounce patch stopped playback");
}

void CmajorBounceOfflinePerformer::pumpDiscard (std::uint32_t frameCount)
{
    std::array<float, maxOfflineBlockFrames> left {};
    std::array<float, maxOfflineBlockFrames> right {};
    while (frameCount > 0)
    {
        const auto count = std::min (frameCount, maxOfflineBlockFrames);
        process (left.data(), right.data(), count);
        frameCount -= count;
    }
}

void CmajorBounceOfflinePerformer::noteOn (std::int32_t note, std::uint8_t velocity)
{
    if (patch == nullptr || note < 0 || note > 127 || velocity > 127)
        throw std::invalid_argument ("Native Bounce note-on is invalid");
    const std::array<std::uint8_t, 3> message {
        0x90,
        static_cast<std::uint8_t> (note),
        velocity,
    };
    patch->addMIDIMessage (0, message.data(), static_cast<std::uint32_t> (message.size()));
}

void CmajorBounceOfflinePerformer::noteOff (std::int32_t note)
{
    if (patch == nullptr || note < 0 || note > 127)
        throw std::invalid_argument ("Native Bounce note-off is invalid");
    const std::array<std::uint8_t, 3> message {
        0x80,
        static_cast<std::uint8_t> (note),
        0,
    };
    patch->addMIDIMessage (0, message.data(), static_cast<std::uint32_t> (message.size()));
}

void CmajorBounceOfflinePerformer::process (float* left,
                                            float* right,
                                            std::uint32_t frameCount)
{
    if (patch == nullptr || left == nullptr || right == nullptr
        || frameCount == 0 || frameCount > maxOfflineBlockFrames)
        throw std::invalid_argument ("Native Bounce process block is invalid");
    throwIfPatchFailed();
    std::fill_n (left, frameCount, 0.0f);
    std::fill_n (right, frameCount, 0.0f);
    float* channels[] { left, right };
    patch->process (channels, frameCount, [] (std::uint32_t, choc::midi::MessageView) {});
}

std::size_t CmajorBounceOfflinePerformer::residentBytes() const noexcept
{
    return configuration.performerResidentBytesEstimate;
}

std::chrono::nanoseconds CmajorBounceOfflinePerformer::lastInitialiseDuration() const noexcept
{
    return initialiseDuration;
}

CmajorPatchConfiguration createDesktopJITBounceConfiguration (
    std::filesystem::path manifestPath,
    std::size_t performerResidentBytesEstimate)
{
    if (manifestPath.empty())
        throw std::invalid_argument ("Desktop Bounce manifest path is empty");
    CmajorPatchConfiguration configuration;
    configuration.configurePatch = [] (cmaj::Patch& target)
    {
        target.setAutoRebuildOnFileChange (false);
        target.createEngine = [] { return cmaj::Engine::create(); };
        target.externalFunctionProvider =
            cosimo::three_osc::bridge::createExternalFunctionProvider();
        cmaj::enableQuickJSPatchWorker (target);
    };
    configuration.prepareLoadParams = [manifestPath = std::move (manifestPath)]
        (cmaj::Patch::LoadParams& loadParams)
    {
        loadParams.manifest.initialiseWithFile (manifestPath);
    };
    configuration.performerResidentBytesEstimate = performerResidentBytesEstimate;
    configuration.validate();
    return configuration;
}

} // namespace cosimo::bounce
