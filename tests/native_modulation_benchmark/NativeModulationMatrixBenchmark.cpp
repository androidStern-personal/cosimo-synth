#include <algorithm>
#include <array>
#include <bit>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <limits>
#include <memory>
#include <numeric>
#include <set>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#ifndef COSIMO_GENERATED_CPP_PATH
#error "COSIMO_GENERATED_CPP_PATH must name the production generated C++ performer"
#endif

#ifndef COSIMO_NATIVE_BENCHMARK_PROFILE_HEADER_PATH
#error "COSIMO_NATIVE_BENCHMARK_PROFILE_HEADER_PATH must name the generated shared-profile header"
#endif

#include COSIMO_GENERATED_CPP_PATH
#include COSIMO_NATIVE_BENCHMARK_PROFILE_HEADER_PATH

namespace
{
using Clock = std::chrono::steady_clock;
namespace benchmark_profiles = cosimo::native_modulation_benchmark;

constexpr double sampleRate = 48000.0;
constexpr std::uint32_t blockSize = 128;
constexpr std::int32_t dspSessionID = 1;
constexpr std::int32_t wavetableGeneration = 1;
constexpr std::int32_t wavetableTableIndex = 0;
constexpr std::uint32_t fullRackEnableMask = 0xff;
constexpr double audioEquivalenceTolerance = 1.0e-7;
constexpr double nonSilentRmsThreshold = 1.0e-5;
constexpr std::size_t rackCommitBlocks = 8;

static_assert (WavetableSynth::maxFramesPerBlock == blockSize);
static_assert (sizeof (WavetableSynth::wt_RuntimeInstallAck) == 44);
static_assert (sizeof (WavetableSynth::wt_VoiceArticulationMonitor) == 36);

struct EffectSetting
{
    const char* endpoint;
    float value;
};

constexpr std::array effectSettings
{
    EffectSetting { "unisonVoices", 1.0f },
    EffectSetting { "warpMode", 0.0f },
    EffectSetting { "warpAmount", 0.0f },
    EffectSetting { "filterMode", 1.0f },
    EffectSetting { "filterCutoff", 1200.0f },
    EffectSetting { "globalFilterMode", 1.0f },
    EffectSetting { "globalFilterCutoff", 1200.0f },
    EffectSetting { "globalFilterResonance", 0.707107f },
    EffectSetting { "globalFilterDrive", 1.0f },
    EffectSetting { "distortionWet", 0.35f },
    EffectSetting { "ottAmount", 35.0f },
    EffectSetting { "ottMix", 35.0f },
    EffectSetting { "chorusMix", 0.3f },
    EffectSetting { "flangerMix", 0.25f },
    EffectSetting { "phaserMix", 0.25f },
    EffectSetting { "delayMix", 0.25f },
    EffectSetting { "reverbMix", 0.3f },
};

struct Arguments
{
    std::size_t measuredBlocks = 4096;
    std::size_t warmupBlocks = 256;
    std::size_t settleBlocks = 128;
    std::size_t repeatIndex = 0;
};

struct InstalledCounts
{
    std::int32_t voice = 0;
    std::int32_t macroVoice = 0;
    std::int32_t voiceRack = 0;
    std::int32_t macroRack = 0;
};

struct AudioEvidence
{
    long double emptySumSquares = 0.0;
    long double loadedSumSquares = 0.0;
    std::uint64_t sampleCount = 0;
    std::uint64_t nonFiniteSampleCount = 0;
    std::uint64_t bitMismatchSampleCount = 0;
    double maximumAbsoluteSampleDelta = 0.0;
};

struct ProfileResult
{
    std::size_t profileIndex = 0;
    InstalledCounts emptyInstalledCounts;
    InstalledCounts installedCounts;
    std::uint32_t emptyVoiceMask = 0;
    std::uint32_t loadedVoiceMask = 0;
    std::int32_t emptyRackMask = -1;
    std::int32_t loadedRackMask = -1;
    AudioEvidence audio;
    std::vector<double> emptyNanoseconds;
    std::vector<double> loadedNanoseconds;
    std::vector<double> pairedDeltaNanoseconds;
};

std::size_t parsePositiveSize (const char* value, std::string_view argument)
{
    char* end = nullptr;
    const auto parsed = std::strtoull (value, &end, 10);
    if (end == value || *end != '\0' || parsed == 0)
        throw std::invalid_argument (std::string (argument) + " must be a positive integer");
    return static_cast<std::size_t> (parsed);
}

Arguments parseArguments (int argc, char** argv)
{
    Arguments arguments;
    for (int index = 1; index < argc; ++index)
    {
        const std::string_view argument (argv[index]);
        if (index + 1 >= argc)
            throw std::invalid_argument (std::string (argument) + " requires a value");

        if (argument == "--blocks")
            arguments.measuredBlocks = parsePositiveSize (argv[++index], argument);
        else if (argument == "--warmup-blocks")
            arguments.warmupBlocks = parsePositiveSize (argv[++index], argument);
        else if (argument == "--settle-blocks")
            arguments.settleBlocks = parsePositiveSize (argv[++index], argument);
        else if (argument == "--repeat-index")
        {
            char* end = nullptr;
            const auto parsed = std::strtoull (argv[++index], &end, 10);
            if (end == argv[index] || *end != '\0')
                throw std::invalid_argument ("--repeat-index must be a non-negative integer");
            arguments.repeatIndex = static_cast<std::size_t> (parsed);
        }
        else
            throw std::invalid_argument ("Unknown argument: " + std::string (argument));
    }
    return arguments;
}

WavetableSynth::EndpointHandle endpoint (std::string_view name)
{
    const auto handle = WavetableSynth::getEndpointHandleForName (name);
    if (handle == 0) throw std::runtime_error ("Generated performer omitted endpoint " + std::string (name));
    return handle;
}

void clearOutputEvents (WavetableSynth& performer)
{
    for (const auto& output : WavetableSynth::outputEvents)
        performer.resetOutputEventCount (output.handle);
}

void setParameter (WavetableSynth& performer, std::string_view name, float value)
{
    performer.setValue (endpoint (name), &value, 0);
}

WavetableSynth::std_midi_Message midiMessage (std::uint8_t status,
                                               std::uint8_t data1,
                                               std::uint8_t data2 = 0)
{
    WavetableSynth::std_midi_Message message;
    message.message = (static_cast<std::int32_t> (status) << 16)
        | (static_cast<std::int32_t> (data1) << 8)
        | static_cast<std::int32_t> (data2);
    return message;
}

WavetableSynth::wt_RuntimeInstallAck readLatestInstallAck (WavetableSynth& performer)
{
    const auto handle = endpoint ("runtimeInstallAck");
    const auto eventCount = performer.getNumOutputEvents (handle);
    if (eventCount == 0 || eventCount > WavetableSynth::eventBufferSize)
        throw std::runtime_error ("Generated performer did not expose exactly buffered install evidence");

    WavetableSynth::wt_RuntimeInstallAck acknowledgement;
    performer.readOutputEvent (handle,
                               eventCount - 1,
                               reinterpret_cast<unsigned char*> (&acknowledgement));
    performer.resetOutputEventCount (handle);
    return acknowledgement;
}

InstalledCounts countsFrom (const WavetableSynth::wt_RuntimeInstallAck& acknowledgement)
{
    return {
        acknowledgement.installedVoiceRouteCount,
        acknowledgement.installedMacroVoiceRouteCount,
        acknowledgement.installedVoiceRackRouteCount,
        acknowledgement.installedMacroRackRouteCount,
    };
}

void requireAcceptedSerial (const WavetableSynth::wt_RuntimeInstallAck& acknowledgement,
                            std::int32_t expectedSerial)
{
    if (acknowledgement.dspSessionId != dspSessionID
        || acknowledgement.acceptedModulationSerial != expectedSerial
        || acknowledgement.rejectedSerial != 0
        || acknowledgement.rejectionReason != 0)
        throw std::runtime_error (
            "Production performer rejected the neutral modulation source contract: expected="
            + std::to_string (expectedSerial)
            + ", session=" + std::to_string (acknowledgement.dspSessionId)
            + ", accepted=" + std::to_string (acknowledgement.acceptedModulationSerial)
            + ", rejected=" + std::to_string (acknowledgement.rejectedSerial)
            + ", reason=" + std::to_string (acknowledgement.rejectionReason));
}

std::int32_t installNeutralSourcesAndEmptyProgram (WavetableSynth& performer)
{
    std::int32_t deliverySerial = 0;
    for (const auto& playback : benchmark_profiles::msegPlaybacks)
    {
        for (std::int32_t shapeIndex = 0; shapeIndex < 2; ++shapeIndex)
        {
            WavetableSynth::wt_ModulationMsegBufferUpload upload;
            upload.slot = playback.slot;
            upload.shapeIndex = shapeIndex;
            upload.dspSessionId = dspSessionID;
            upload.deliverySerial = ++deliverySerial;
            performer.addEvent_modulationMsegBuffer (upload);
            requireAcceptedSerial (readLatestInstallAck (performer), deliverySerial);
        }

        WavetableSynth::wt_ModulationMsegPlaybackUpload upload;
        upload.slot = playback.slot;
        upload.seconds = playback.seconds;
        upload.holdFinalValue = playback.holdFinalValue;
        upload.rateKind = playback.rateKind;
        upload.loopEnabled = playback.loopEnabled;
        upload.loopStart = playback.loopStart;
        upload.loopEnd = playback.loopEnd;
        upload.noteOffPolicy = playback.noteOffPolicy;
        upload.legatoRestarts = playback.legatoRestarts;
        upload.dspSessionId = dspSessionID;
        upload.deliverySerial = ++deliverySerial;
        performer.addEvent_modulationMsegPlayback (upload);
        requireAcceptedSerial (readLatestInstallAck (performer), deliverySerial);
    }

    for (const auto& envelope : benchmark_profiles::envelopes)
    {
        WavetableSynth::wt_ModulationEnvelopeUpload upload;
        upload.slot = envelope.slot;
        upload.attackSeconds = envelope.attackSeconds;
        upload.decaySeconds = envelope.decaySeconds;
        upload.sustain = envelope.sustain;
        upload.releaseSeconds = envelope.releaseSeconds;
        upload.dspSessionId = dspSessionID;
        upload.deliverySerial = ++deliverySerial;
        performer.addEvent_modulationEnvelope (upload);
        requireAcceptedSerial (readLatestInstallAck (performer), deliverySerial);
    }

    WavetableSynth::wt_ModulationProgramUpload emptyProgram;
    benchmark_profiles::loadProgram (0, emptyProgram);
    emptyProgram.dspSessionId = dspSessionID;
    emptyProgram.deliverySerial = ++deliverySerial;
    performer.addEvent_modulationProgram (emptyProgram);
    const auto acknowledgement = readLatestInstallAck (performer);
    requireAcceptedSerial (acknowledgement, deliverySerial);
    if (acknowledgement.acceptedModulationProgramSerial != deliverySerial)
        throw std::runtime_error ("Production performer did not accept the initial empty program");
    return deliverySerial;
}

WavetableSynth::wt_RuntimeInstallAck installProgram (WavetableSynth& performer,
                                                     std::size_t profileIndex,
                                                     std::int32_t deliverySerial)
{
    WavetableSynth::wt_ModulationProgramUpload program;
    benchmark_profiles::loadProgram (profileIndex, program);
    program.dspSessionId = dspSessionID;
    program.deliverySerial = deliverySerial;
    performer.addEvent_modulationProgram (program);
    const auto acknowledgement = readLatestInstallAck (performer);
    requireAcceptedSerial (acknowledgement, deliverySerial);
    if (acknowledgement.acceptedModulationProgramSerial != deliverySerial)
        throw std::runtime_error ("Production performer did not accept the measured modulation program");
    return acknowledgement;
}

void loadSineWavetable (WavetableSynth& performer)
{
    WavetableSynth::wt_WavetableLoadBegin begin;
    begin.dspSessionId = dspSessionID;
    begin.generation = wavetableGeneration;
    begin.tableIndex = wavetableTableIndex;
    begin.frameCount = 1;
    performer.addEvent_wavetableLoadBegin (begin);

    constexpr double twoPi = 6.283185307179586476925286766559;
    for (std::int32_t mipIndex = 0; mipIndex < 11; ++mipIndex)
    {
        WavetableSynth::wt_WavetableMipFrame frame;
        frame.dspSessionId = dspSessionID;
        frame.generation = wavetableGeneration;
        frame.tableIndex = wavetableTableIndex;
        frame.mipIndex = mipIndex;
        frame.frameIndex = 0;
        for (std::int32_t sampleIndex = 0; sampleIndex < 2048; ++sampleIndex)
            frame.samples[sampleIndex] = static_cast<float> (std::sin (twoPi * sampleIndex / 2048.0));
        performer.addEvent_wavetableMipFrame (frame);
    }
    clearOutputEvents (performer);
}

std::int32_t initialisePerformer (WavetableSynth& performer)
{
    performer.initialise (dspSessionID, sampleRate);
    loadSineWavetable (performer);
    for (const auto& setting : effectSettings)
        setParameter (performer, setting.endpoint, setting.value);
    for (std::int32_t macroIndex = 1; macroIndex <= 4; ++macroIndex)
        setParameter (performer, "macro" + std::to_string (macroIndex), benchmark_profiles::macroValue);

    WavetableSynth::wt_RackEnableUpload rackEnable;
    for (std::int32_t moduleIndex = 0; moduleIndex < 8; ++moduleIndex)
        rackEnable.enabledFlags[moduleIndex] = 1;
    performer.addEvent_rackEnable (rackEnable);

    const auto serial = installNeutralSourcesAndEmptyProgram (performer);
    clearOutputEvents (performer);
    return serial;
}

std::uint32_t startSustainedVoices (WavetableSynth& performer)
{
    const auto monitorHandle = endpoint ("voiceArticulationStart");
    performer.resetOutputEventCount (monitorHandle);
    for (std::uint8_t voiceIndex = 0; voiceIndex < 16; ++voiceIndex)
        performer.addEvent_midiIn (midiMessage (0x90,
                                                static_cast<std::uint8_t> (48 + voiceIndex),
                                                static_cast<std::uint8_t> (benchmark_profiles::expressionMidiValue)));

    const auto eventCount = performer.getNumOutputEvents (monitorHandle);
    if (eventCount != 16)
        throw std::runtime_error ("Production note dispatcher did not report 16 voice starts");
    std::uint32_t voiceMask = 0;
    for (std::uint32_t eventIndex = 0; eventIndex < eventCount; ++eventIndex)
    {
        WavetableSynth::wt_VoiceArticulationMonitor monitor;
        performer.readOutputEvent (monitorHandle,
                                   eventIndex,
                                   reinterpret_cast<unsigned char*> (&monitor));
        if (monitor.voiceIndex < 0 || monitor.voiceIndex >= 16)
            throw std::runtime_error ("Production note dispatcher reported an invalid voice index");
        voiceMask |= 1u << static_cast<std::uint32_t> (monitor.voiceIndex);
    }
    performer.resetOutputEventCount (monitorHandle);

    performer.addEvent_midiIn (midiMessage (0xd0,
                                            static_cast<std::uint8_t> (benchmark_profiles::expressionMidiValue)));
    performer.addEvent_midiIn (midiMessage (0xb0,
                                            74,
                                            static_cast<std::uint8_t> (benchmark_profiles::expressionMidiValue)));
    clearOutputEvents (performer);
    return voiceMask;
}

void observeRackMask (WavetableSynth& performer, std::int32_t& latestMask)
{
    const auto rackHandle = endpoint ("effectiveRackState");
    const auto eventCount = std::min<std::uint32_t> (performer.getNumOutputEvents (rackHandle),
                                                     WavetableSynth::eventBufferSize);
    for (std::uint32_t eventIndex = 0; eventIndex < eventCount; ++eventIndex)
    {
        WavetableSynth::wt_EffectiveRackState state;
        performer.readOutputEvent (rackHandle,
                                   eventIndex,
                                   reinterpret_cast<unsigned char*> (&state));
        latestMask = state.committedEnableMask;
    }
}

double timedAdvance (WavetableSynth& performer)
{
    const auto started = Clock::now();
    performer.advance (blockSize);
    const auto finished = Clock::now();
    return std::chrono::duration<double, std::nano> (finished - started).count();
}

void copyAudio (WavetableSynth& performer, std::array<float, blockSize * 2>& destination)
{
    performer.copyOutputFrames (endpoint ("audioOut"), destination.data(), blockSize);
}

void compareAudio (const std::array<float, blockSize * 2>& empty,
                   const std::array<float, blockSize * 2>& loaded,
                   AudioEvidence* evidence)
{
    for (std::size_t sampleIndex = 0; sampleIndex < empty.size(); ++sampleIndex)
    {
        const auto emptySample = empty[sampleIndex];
        const auto loadedSample = loaded[sampleIndex];
        if (! std::isfinite (emptySample) || ! std::isfinite (loadedSample))
        {
            if (evidence != nullptr) ++evidence->nonFiniteSampleCount;
            continue;
        }
        const auto delta = std::abs (static_cast<double> (loadedSample) - emptySample);
        if (delta > audioEquivalenceTolerance)
            throw std::runtime_error ("Neutral modulation profile changed production audio");
        if (evidence == nullptr) continue;
        evidence->maximumAbsoluteSampleDelta = std::max (evidence->maximumAbsoluteSampleDelta, delta);
        evidence->emptySumSquares += static_cast<long double> (emptySample) * emptySample;
        evidence->loadedSumSquares += static_cast<long double> (loadedSample) * loadedSample;
        evidence->bitMismatchSampleCount += std::bit_cast<std::uint32_t> (emptySample)
            != std::bit_cast<std::uint32_t> (loadedSample);
        ++evidence->sampleCount;
    }
}

void advancePairUntimed (WavetableSynth& empty,
                         WavetableSynth& loaded,
                         std::size_t blockIndex,
                         std::int32_t* emptyRackMask = nullptr,
                         std::int32_t* loadedRackMask = nullptr)
{
    if ((blockIndex & 1u) == 0)
    {
        empty.advance (blockSize);
        loaded.advance (blockSize);
    }
    else
    {
        loaded.advance (blockSize);
        empty.advance (blockSize);
    }
    std::array<float, blockSize * 2> emptyAudio;
    std::array<float, blockSize * 2> loadedAudio;
    copyAudio (empty, emptyAudio);
    copyAudio (loaded, loadedAudio);
    compareAudio (emptyAudio, loadedAudio, nullptr);
    if (emptyRackMask != nullptr) observeRackMask (empty, *emptyRackMask);
    if (loadedRackMask != nullptr) observeRackMask (loaded, *loadedRackMask);
    clearOutputEvents (empty);
    clearOutputEvents (loaded);
}

void measurePairBlock (WavetableSynth& empty,
                       WavetableSynth& loaded,
                       std::size_t blockIndex,
                       ProfileResult& result)
{
    double emptyNanoseconds = 0.0;
    double loadedNanoseconds = 0.0;
    if ((blockIndex & 1u) == 0)
    {
        emptyNanoseconds = timedAdvance (empty);
        loadedNanoseconds = timedAdvance (loaded);
    }
    else
    {
        loadedNanoseconds = timedAdvance (loaded);
        emptyNanoseconds = timedAdvance (empty);
    }

    std::array<float, blockSize * 2> emptyAudio;
    std::array<float, blockSize * 2> loadedAudio;
    copyAudio (empty, emptyAudio);
    copyAudio (loaded, loadedAudio);
    compareAudio (emptyAudio, loadedAudio, &result.audio);
    clearOutputEvents (empty);
    clearOutputEvents (loaded);

    result.emptyNanoseconds.push_back (emptyNanoseconds);
    result.loadedNanoseconds.push_back (loadedNanoseconds);
    result.pairedDeltaNanoseconds.push_back (loadedNanoseconds - emptyNanoseconds);
}

ProfileResult runProfile (std::size_t profileIndex, const Arguments& arguments)
{
    auto empty = std::make_unique<WavetableSynth>();
    auto loaded = std::make_unique<WavetableSynth>();
    const auto emptyInitialSerial = initialisePerformer (*empty);
    const auto loadedInitialSerial = initialisePerformer (*loaded);
    if (emptyInitialSerial != loadedInitialSerial)
        throw std::runtime_error ("Paired performers did not share an install frontier");

    ProfileResult result;
    result.profileIndex = profileIndex;
    for (std::size_t blockIndex = 0; blockIndex < rackCommitBlocks; ++blockIndex)
        advancePairUntimed (*empty,
                            *loaded,
                            blockIndex,
                            &result.emptyRackMask,
                            &result.loadedRackMask);
    if (result.emptyRackMask != static_cast<std::int32_t> (fullRackEnableMask)
        || result.loadedRackMask != static_cast<std::int32_t> (fullRackEnableMask))
        throw std::runtime_error ("Production rack did not commit all eight enabled effects");

    result.emptyVoiceMask = startSustainedVoices (*empty);
    result.loadedVoiceMask = startSustainedVoices (*loaded);
    if (result.emptyVoiceMask != 0xffff || result.loadedVoiceMask != 0xffff)
        throw std::runtime_error ("Production note dispatcher did not exercise voice indexes 0 through 15");

    for (std::size_t blockIndex = 0; blockIndex < arguments.settleBlocks; ++blockIndex)
        advancePairUntimed (*empty, *loaded, blockIndex);

    const auto measuredSerial = emptyInitialSerial + 1;
    const auto emptyAck = installProgram (*empty, 0, measuredSerial);
    const auto loadedAck = installProgram (*loaded, profileIndex, measuredSerial);
    result.emptyInstalledCounts = countsFrom (emptyAck);
    result.installedCounts = countsFrom (loadedAck);

    const auto expected = benchmark_profiles::profiles[profileIndex].compiledCounts;
    if (result.emptyInstalledCounts.voice != 0
        || result.emptyInstalledCounts.macroVoice != 0
        || result.emptyInstalledCounts.voiceRack != 0
        || result.emptyInstalledCounts.macroRack != 0
        || result.installedCounts.voice != expected.voice
        || result.installedCounts.macroVoice != expected.macroVoice
        || result.installedCounts.voiceRack != expected.voiceRack
        || result.installedCounts.macroRack != expected.macroRack)
        throw std::runtime_error ("Installed route counts differ from the shared compiled profile");

    for (std::size_t blockIndex = 0; blockIndex < arguments.warmupBlocks; ++blockIndex)
        advancePairUntimed (*empty, *loaded, blockIndex);

    result.emptyNanoseconds.reserve (arguments.measuredBlocks);
    result.loadedNanoseconds.reserve (arguments.measuredBlocks);
    result.pairedDeltaNanoseconds.reserve (arguments.measuredBlocks);
    for (std::size_t blockIndex = 0; blockIndex < arguments.measuredBlocks; ++blockIndex)
        measurePairBlock (*empty, *loaded, blockIndex, result);
    return result;
}

double mean (const std::vector<double>& values)
{
    return std::accumulate (values.begin(), values.end(), 0.0) / static_cast<double> (values.size());
}

double median (std::vector<double> values)
{
    std::sort (values.begin(), values.end());
    const auto middle = values.size() / 2;
    return (values.size() & 1u) != 0 ? values[middle] : (values[middle - 1] + values[middle]) * 0.5;
}

double rms (long double sumSquares, std::uint64_t sampleCount)
{
    return std::sqrt (static_cast<double> (sumSquares / static_cast<long double> (sampleCount)));
}

void writeCounts (const InstalledCounts& counts)
{
    std::cout << '\t' << counts.voice
              << '\t' << counts.macroVoice
              << '\t' << counts.voiceRack
              << '\t' << counts.macroRack;
}

void writeResult (const ProfileResult& result)
{
    const auto& profile = benchmark_profiles::profiles[result.profileIndex];
    const auto emptyRms = rms (result.audio.emptySumSquares, result.audio.sampleCount);
    const auto loadedRms = rms (result.audio.loadedSumSquares, result.audio.sampleCount);
    if (result.audio.nonFiniteSampleCount != 0
        || emptyRms <= nonSilentRmsThreshold
        || loadedRms <= nonSilentRmsThreshold)
        throw std::runtime_error ("Measured production audio was silent or non-finite");

    const auto emptyMean = mean (result.emptyNanoseconds);
    const auto loadedMean = mean (result.loadedNanoseconds);
    const auto pairedMeanDelta = mean (result.pairedDeltaNanoseconds);
    const auto pairedMedianDelta = median (result.pairedDeltaNanoseconds);
    const auto deadlineNanoseconds = 1.0e9 * blockSize / sampleRate;
    const auto addedRenderLoadPoints = pairedMeanDelta * 100.0 / deadlineNanoseconds;

    std::cout << "PROFILE\t" << profile.name
              << '\t' << profile.stateSha256
              << '\t' << profile.storedRouteCount
              << '\t' << profile.activeRouteCount;
    writeCounts (result.installedCounts);
    writeCounts (result.emptyInstalledCounts);
    std::cout << '\t' << result.emptyVoiceMask
              << '\t' << result.loadedVoiceMask
              << '\t' << result.emptyRackMask
              << '\t' << result.loadedRackMask
              << '\t' << result.emptyNanoseconds.size()
              << '\t' << result.audio.sampleCount
              << '\t' << result.audio.nonFiniteSampleCount
              << '\t' << result.audio.bitMismatchSampleCount
              << '\t' << std::setprecision (17) << result.audio.maximumAbsoluteSampleDelta
              << '\t' << emptyRms
              << '\t' << loadedRms
              << '\t' << emptyMean
              << '\t' << loadedMean
              << '\t' << pairedMeanDelta
              << '\t' << pairedMedianDelta
              << '\t' << addedRenderLoadPoints
              << '\n';
}

void writeUnavailableProfile (const benchmark_profiles::ProfileMetadata& profile)
{
    std::cout << "UNAVAILABLE\t" << profile.name
              << '\t' << profile.stateSha256
              << '\t' << profile.storedRouteCount
              << '\t' << profile.activeRouteCount
              << '\t' << profile.blockedBy
              << '\n';
}

void requireUnavailableProgramsRejectWithoutMutation()
{
    for (std::size_t profileIndex = 0; profileIndex < benchmark_profiles::profiles.size(); ++profileIndex)
    {
        if (benchmark_profiles::profiles[profileIndex].blockedBy == nullptr)
            continue;

        WavetableSynth::wt_ModulationProgramUpload destination {};
        destination.voiceRouteCount = 7;
        destination.macroVoiceRouteCount = 8;
        destination.voiceRouteCells[0] = 9;
        destination.voiceRouteAmounts[0] = 0.25f;
        bool rejected = false;

        try
        {
            benchmark_profiles::loadProgram (profileIndex, destination);
        }
        catch (const std::logic_error& error)
        {
            rejected = std::string_view (error.what()).find ("RT-01") != std::string_view::npos;
        }

        if (! rejected
            || destination.voiceRouteCount != 7
            || destination.macroVoiceRouteCount != 8
            || destination.voiceRouteCells[0] != 9
            || destination.voiceRouteAmounts[0] != 0.25f)
            throw std::runtime_error ("An unavailable modulation profile was executable or mutated its destination");
    }
}

std::vector<std::size_t> profileOrder (std::size_t repeatIndex)
{
    std::vector<std::size_t> result;
    for (std::size_t profileIndex = 1; profileIndex < benchmark_profiles::profiles.size(); ++profileIndex)
        if (benchmark_profiles::profiles[profileIndex].blockedBy == nullptr)
            result.push_back (profileIndex);
    if (result.empty())
        throw std::runtime_error ("No pre-RT-01 benchmark profile is executable");
    std::rotate (result.begin(),
                 result.begin() + static_cast<std::ptrdiff_t> (repeatIndex % result.size()),
                 result.end());
    if ((repeatIndex & 1u) != 0) std::reverse (result.begin(), result.end());
    return result;
}
}

int main (int argc, char** argv)
{
    try
    {
        const auto arguments = parseArguments (argc, argv);
        requireUnavailableProgramsRejectWithoutMutation();
        std::cout << "META\t" << static_cast<std::int32_t> (sampleRate)
                  << '\t' << blockSize
                  << '\t' << benchmark_profiles::profileGenerator
                  << '\t' << benchmark_profiles::profileDocumentSha256
                  << '\t' << arguments.repeatIndex
                  << '\n';
        for (const auto& setting : effectSettings)
            std::cout << "EFFECT\t" << setting.endpoint << '\t' << std::setprecision (9) << setting.value << '\n';
        for (std::size_t profileIndex = 1; profileIndex < benchmark_profiles::profiles.size(); ++profileIndex)
            if (benchmark_profiles::profiles[profileIndex].blockedBy != nullptr)
                writeUnavailableProfile (benchmark_profiles::profiles[profileIndex]);
        for (const auto profileIndex : profileOrder (arguments.repeatIndex))
            writeResult (runProfile (profileIndex, arguments));
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "ERROR: " << error.what() << '\n';
        return 1;
    }
}
