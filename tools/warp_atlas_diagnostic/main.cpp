#include "AtlasFile.h"
#include "WarpRenderer.h"

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <sys/resource.h>
#include <utility>
#include <variant>
#include <vector>

namespace
{
using namespace cosimo::three_osc;
using namespace cosimo::warp_atlas_diagnostic;

constexpr double pi = 3.1415926535897932384626433832795;
constexpr std::uint32_t sampleRate = 48000;
constexpr float initialPhase = 0.173f;
constexpr std::size_t activeOscillatorFamilyBatchCount
    = maximumUnisonCount / warpFamilyBatchWidth;

enum class PathSelection
{
    runtimeOnly,
    autoHandoff,
    atlasOnly
};

struct Options
{
    std::filesystem::path outputDirectory;
    std::optional<std::filesystem::path> atlasPath;
    std::optional<PathSelection> requestedSelection;
    bool quick = false;
};

struct CommandLineError
{
    std::string detail;
};

using ParsedOptions = std::variant<Options, CommandLineError>;

struct CaptureCase
{
    const char* name;
    const char* family;
    const char* amountClass;
    WarpMode mode;
    float amount;
    float phaseIncrement;
    float pitchWobble;
    bool mipBoundaryPitchCase;
};

constexpr std::array captureCases {
    CaptureCase { "bend-neutral", "bend", "neutral", WarpMode::bend,
                  0.5f, 0.225f, 0.001f, false },
    CaptureCase { "bend-extreme", "bend", "extreme", WarpMode::bend,
                  0.0f, 0.020f, 0.001f, false },
    CaptureCase { "pwm-neutral", "pwm", "neutral", WarpMode::pwm,
                  0.0f, 0.420f, 0.001f, false },
    CaptureCase { "pwm-extreme", "pwm", "extreme", WarpMode::pwm,
                  1.0f, 0.020f, 0.001f, false },
    CaptureCase { "asym-neutral", "asym", "neutral", WarpMode::asym,
                  0.5f, 0.420f, 0.001f, false },
    CaptureCase { "asym-extreme", "asym", "extreme", WarpMode::asym,
                  0.0f, 0.020f, 0.001f, false },
    CaptureCase { "mirror-centre", "mirror", "neutral", WarpMode::mirror,
                  0.5f, 0.225f, 0.001f, false },
    CaptureCase { "mirror-extreme", "mirror", "extreme", WarpMode::mirror,
                  0.0f, 0.012f, 0.001f, false },
    CaptureCase { "pwm-mip-boundary-below", "pwm", "extreme", WarpMode::pwm,
                  1.0f, (0.9f / 64.0f) * 0.999f, 0.0f, true },
    CaptureCase { "pwm-mip-boundary-above", "pwm", "extreme", WarpMode::pwm,
                  1.0f, (0.9f / 64.0f) * 1.001f, 0.0f, true }
};

struct RunShape
{
    std::size_t warmupFrames;
    std::size_t captureFrames;
    std::size_t repetitions;
};

struct TableFixture
{
    TablePoolLayout layout;
    std::vector<std::int32_t> samples;
};

struct CaptureResult
{
    const CaptureCase* specification = nullptr;
    std::vector<float> samples;
    double cpuSeconds = 0.0;
    double wallSeconds = 0.0;
    double checksum = 0.0;
    double rms = 0.0;
    bool purePathVerified = false;
};

std::string jsonEscape (std::string_view value)
{
    constexpr std::string_view hexadecimal = "0123456789abcdef";
    std::string escaped;
    escaped.reserve (value.size() + 8);
    for (const auto character : value)
    {
        switch (character)
        {
            case '\\': escaped += "\\\\"; break;
            case '"': escaped += "\\\""; break;
            case '\n': escaped += "\\n"; break;
            case '\r': escaped += "\\r"; break;
            case '\t': escaped += "\\t"; break;
            default:
                if (static_cast<unsigned char> (character) < 0x20U)
                {
                    escaped += "\\u00";
                    escaped += hexadecimal[(static_cast<unsigned char> (character) >> 4U) & 0xfU];
                    escaped += hexadecimal[static_cast<unsigned char> (character) & 0xfU];
                }
                else
                    escaped += character;
                break;
        }
    }
    return escaped;
}

const char* selectionName (PathSelection selection) noexcept
{
    switch (selection)
    {
        case PathSelection::runtimeOnly: return "runtime-only";
        case PathSelection::autoHandoff: return "auto-handoff";
        case PathSelection::atlasOnly: return "atlas-only";
    }
    return "unknown";
}

std::optional<PathSelection> parseSelection (std::string_view value)
{
    if (value == "runtime-only") return PathSelection::runtimeOnly;
    if (value == "auto-handoff") return PathSelection::autoHandoff;
    if (value == "atlas-only") return PathSelection::atlasOnly;
    return std::nullopt;
}

ParsedOptions parseOptions (int argc, char** argv)
{
    Options options;
    for (auto index = 1; index < argc; ++index)
    {
        const auto argument = std::string_view (argv[index]);
        if (argument == "--output-dir" && index + 1 < argc)
            options.outputDirectory = argv[++index];
        else if (argument == "--atlas" && index + 1 < argc)
            options.atlasPath = std::filesystem::path (argv[++index]);
        else if (argument == "--path" && index + 1 < argc)
        {
            options.requestedSelection = parseSelection (argv[++index]);
            if (! options.requestedSelection.has_value())
                return CommandLineError { "--path must be runtime-only, auto-handoff, or atlas-only" };
        }
        else if (argument == "--quick")
            options.quick = true;
        else
            return CommandLineError { "unknown or incomplete argument: " + std::string (argument) };
    }
    if (options.outputDirectory.empty())
        return CommandLineError { "--output-dir is required" };
    return options;
}

PathSelection resolveSelection (const Options& options)
{
    if (options.requestedSelection.has_value())
        return *options.requestedSelection;
    return options.atlasPath.has_value() ? PathSelection::autoHandoff
                                         : PathSelection::runtimeOnly;
}

void emitError (std::string_view code,
                std::string_view stage,
                std::string_view detail,
                bool beforeAudioPrepare)
{
    std::cerr << "{\"schema\":\"cosimo.warp-atlas-diagnostic-error.v1\""
              << ",\"code\":\"" << jsonEscape (code) << "\""
              << ",\"stage\":\"" << jsonEscape (stage) << "\""
              << ",\"beforeAudioPrepare\":"
              << (beforeAudioPrepare ? "true" : "false")
              << ",\"detail\":\"" << jsonEscape (detail) << "\"}\n";
}

void emitAtlasLoadError (const AtlasLoadError& error)
{
    std::cerr << "{\"schema\":\"cosimo.warp-atlas-diagnostic-error.v1\""
              << ",\"code\":\"" << codeName (error.code) << "\""
              << ",\"stage\":\"atlas-load\""
              << ",\"beforeAudioPrepare\":true"
              << ",\"path\":\"" << jsonEscape (error.path.string()) << "\""
              << ",\"expectedByteCount\":" << canonicalAtlasByteCount;
    if (error.actualByteCount.has_value())
        std::cerr << ",\"actualByteCount\":" << *error.actualByteCount;
    else
        std::cerr << ",\"actualByteCount\":null";
    std::cerr << ",\"expectedSha256\":\"" << canonicalAtlasSha256 << "\"";
    if (error.actualSha256.has_value())
        std::cerr << ",\"actualSha256\":\""
                  << jsonEscape (*error.actualSha256) << "\"";
    else
        std::cerr << ",\"actualSha256\":null";
    std::cerr << ",\"detail\":\"" << jsonEscape (error.detail) << "\"}\n";
}

void appendSineFrame (std::vector<std::int32_t>& destination,
                      std::size_t length)
{
    constexpr auto valueRange = 1.0f;
    constexpr auto derivativeRange = 0.05f;
    std::vector<float> body (length);
    for (std::size_t sample = 0; sample < length; ++sample)
    {
        const auto phase = static_cast<double> (sample) / static_cast<double> (length);
        body[sample] = static_cast<float> (std::sin (2.0 * pi * phase));
    }
    for (std::size_t sample = 0; sample <= length; ++sample)
    {
        const auto index = sample % length;
        const auto previous = body[(index + length - 1) % length];
        const auto next = body[(index + 1) % length];
        destination.push_back (packSourcePoint (
            body[index], 0.5f * (next - previous), valueRange, derivativeRange));
    }
}

TableFixture prepareTableFixture()
{
    TableFixture fixture;
    constexpr auto tableLength = std::size_t { 256 };
    fixture.layout.frameCounts[0] = 1;
    fixture.layout.oscillatorSlots.fill (0);
    for (std::size_t mip = 0; mip < mipLevelCount; ++mip)
    {
        fixture.layout.mipOffsets[mip]
            = static_cast<std::int32_t> (fixture.samples.size());
        fixture.layout.mipLengths[mip] = static_cast<std::int32_t> (tableLength);
        appendSineFrame (fixture.samples, tableLength);
    }
    fixture.layout.slots[0] = {
        fixture.samples.data(),
        static_cast<std::int32_t> (fixture.samples.size()),
        1.0f / static_cast<float> (sourceValueMaximum),
        0.05f / static_cast<float> (sourceDerivativeMaximum)
    };
    return fixture;
}

WarpRendererControls prepareControls (const CaptureCase& capture)
{
    WarpRendererControls controls;
    controls.oversampleFactor = maximumWarpOversampleFactor;
    controls.use441Filter = 0;
    controls.phaseIncrements.fill (capture.phaseIncrement);
    controls.positions.fill (0.0f);
    controls.warpAmounts.fill (capture.amount);
    controls.leftGains.fill (0.0f);
    controls.rightGains.fill (0.0f);
    controls.warpModes.fill (static_cast<std::int32_t> (WarpMode::off));
    controls.warpModes[0] = static_cast<std::int32_t> (capture.mode);
    controls.leftGains[0] = 1.0f;
    controls.rightGains[0] = 1.0f;
    controls.atlasDc.fill (0.0f);
    controls.atlasBasisWeights[0].fill (1.0f);
    controls.atlasBasisWeights[1].fill (0.0f);
    controls.atlasBasisWeights[2].fill (0.0f);
    controls.atlasBasisWeights[3].fill (0.0f);
    return controls;
}

void applyControlSchedule (WarpRendererControls& controls,
                           const CaptureCase& capture,
                           std::size_t frame)
{
    const auto schedulePhase = 2.0 * pi * static_cast<double> (frame % 257) / 257.0;
    const auto increment = capture.phaseIncrement
                         * (1.0f + capture.pitchWobble
                                    * static_cast<float> (std::sin (schedulePhase)));
    for (std::size_t lane = 0; lane < maximumUnisonCount; ++lane)
    {
        controls.phaseIncrements[lane] = increment;
        controls.warpAmounts[lane] = capture.amount;
    }
}

void pinAtlasOnly (WarpRendererState& state) noexcept
{
    for (std::size_t batch = 0; batch < activeOscillatorFamilyBatchCount; ++batch)
    {
        state.atlasFamilyTargets[batch] = 1;
        state.atlasFamilyMix[batch] = 1.0f;
    }
}

bool verifyPurePath (const WarpRendererState& state,
                     PathSelection selection) noexcept
{
    if (selection == PathSelection::autoHandoff)
        return true;
    const auto expectedTarget = selection == PathSelection::atlasOnly ? 1 : 0;
    const auto expectedMix = selection == PathSelection::atlasOnly ? 1.0f : 0.0f;
    for (std::size_t batch = 0; batch < activeOscillatorFamilyBatchCount; ++batch)
    {
        if (state.atlasFamilyTargets[batch] != expectedTarget
            || state.atlasFamilyMix[batch] != expectedMix)
            return false;
    }
    return true;
}

bool verifyAutomaticHandoff (const TableFixture& fixture,
                             PackedWarpAtlasView atlas)
{
    constexpr CaptureCase probe {
        "auto-handoff-probe", "pwm", "extreme", WarpMode::pwm,
        1.0f, 0.010f, 0.0f, false
    };
    auto controls = prepareControls (probe);
    WarpRendererState state;
    resetWarpRenderer (state, initialPhase);
    const auto renderAtIncrement = [&] (float increment, std::size_t frames)
    {
        for (std::size_t frame = 0; frame < frames; ++frame)
        {
            for (std::size_t lane = 0; lane < maximumUnisonCount; ++lane)
                controls.phaseIncrements[lane] = increment;
            static_cast<void> (renderWarpedNote (
                state, controls, fixture.layout, atlas, 0));
        }
    };
    const auto activeBatchesMatch = [&] (std::int32_t target, float mix)
    {
        for (std::size_t batch = 0; batch < activeOscillatorFamilyBatchCount; ++batch)
        {
            if (state.atlasFamilyTargets[batch] != target
                || std::abs (state.atlasFamilyMix[batch] - mix) > 1.0e-6f)
                return false;
        }
        return true;
    };

    renderAtIncrement (0.010f, 1);
    if (! activeBatchesMatch (1, 1.0f))
        return false;
    renderAtIncrement (0.005f, 65);
    if (! activeBatchesMatch (0, 0.0f))
        return false;
    renderAtIncrement (0.010f, 65);
    return activeBatchesMatch (1, 1.0f);
}

double cpuSeconds() noexcept
{
    return static_cast<double> (std::clock()) / static_cast<double> (CLOCKS_PER_SEC);
}

CaptureResult renderCapture (const CaptureCase& capture,
                             const TableFixture& fixture,
                             PathSelection selection,
                             PackedWarpAtlasView atlas,
                             const RunShape& shape)
{
    CaptureResult result;
    result.specification = &capture;
    result.samples.reserve (shape.captureFrames);
    result.purePathVerified = true;

    auto controls = prepareControls (capture);
    const auto selectedAtlas = selection == PathSelection::runtimeOnly
        ? PackedWarpAtlasView {}
        : atlas;
    const auto startedAt = std::chrono::steady_clock::now();
    const auto cpuStartedAt = cpuSeconds();
    for (std::size_t repetition = 0; repetition < shape.repetitions; ++repetition)
    {
        WarpRendererState state;
        resetWarpRenderer (state, initialPhase);
        for (std::size_t frame = 0;
             frame < shape.warmupFrames + shape.captureFrames;
             ++frame)
        {
            applyControlSchedule (controls, capture, frame);
            if (selection == PathSelection::atlasOnly)
                pinAtlasOnly (state);
            const auto output = renderWarpedNote (
                state, controls, fixture.layout, selectedAtlas, 0);
            result.purePathVerified = result.purePathVerified
                                   && verifyPurePath (state, selection);
            result.checksum += static_cast<double> (output.left)
                             + static_cast<double> (output.right);
            if (repetition == 0 && frame >= shape.warmupFrames)
                result.samples.push_back (output.left);
        }
    }
    result.cpuSeconds = cpuSeconds() - cpuStartedAt;
    result.wallSeconds = std::chrono::duration<double> (
        std::chrono::steady_clock::now() - startedAt).count();

    double energy = 0.0;
    for (const auto sample : result.samples)
        energy += static_cast<double> (sample) * static_cast<double> (sample);
    result.rms = std::sqrt (energy / static_cast<double> (result.samples.size()));
    if (result.rms <= 1.0e-6)
        throw std::runtime_error (std::string (capture.name) + " produced silent diagnostic audio");
    if (! result.purePathVerified)
        throw std::runtime_error (std::string (capture.name)
                                  + " crossed renderer families during a pinned capture");
    return result;
}

void writeLittleEndian16 (std::ostream& output, std::uint16_t value)
{
    const std::array<char, 2> bytes {
        static_cast<char> (value & 0xffU),
        static_cast<char> ((value >> 8U) & 0xffU)
    };
    output.write (bytes.data(), static_cast<std::streamsize> (bytes.size()));
}

void writeLittleEndian32 (std::ostream& output, std::uint32_t value)
{
    const std::array<char, 4> bytes {
        static_cast<char> (value & 0xffU),
        static_cast<char> ((value >> 8U) & 0xffU),
        static_cast<char> ((value >> 16U) & 0xffU),
        static_cast<char> ((value >> 24U) & 0xffU)
    };
    output.write (bytes.data(), static_cast<std::streamsize> (bytes.size()));
}

void writeFloat32Wav (const std::filesystem::path& path,
                      const std::vector<float>& samples)
{
    const auto dataBytes = samples.size() * sizeof (float);
    if (dataBytes > std::numeric_limits<std::uint32_t>::max() - 36U)
        throw std::runtime_error ("diagnostic WAV is too large");
    std::ofstream output (path, std::ios::binary);
    if (! output)
        throw std::runtime_error ("failed to create WAV: " + path.string());
    output.write ("RIFF", 4);
    writeLittleEndian32 (output, static_cast<std::uint32_t> (36U + dataBytes));
    output.write ("WAVEfmt ", 8);
    writeLittleEndian32 (output, 16U);
    writeLittleEndian16 (output, 3U);
    writeLittleEndian16 (output, 1U);
    writeLittleEndian32 (output, sampleRate);
    writeLittleEndian32 (output, sampleRate * sizeof (float));
    writeLittleEndian16 (output, sizeof (float));
    writeLittleEndian16 (output, 32U);
    output.write ("data", 4);
    writeLittleEndian32 (output, static_cast<std::uint32_t> (dataBytes));
    output.write (reinterpret_cast<const char*> (samples.data()),
                  static_cast<std::streamsize> (dataBytes));
    if (! output)
        throw std::runtime_error ("failed while writing WAV: " + path.string());
}

std::uint64_t peakResidentBytes() noexcept
{
    rusage usage {};
    if (getrusage (RUSAGE_SELF, &usage) != 0)
        return 0;
#if defined(__APPLE__)
    return static_cast<std::uint64_t> (usage.ru_maxrss);
#else
    return static_cast<std::uint64_t> (usage.ru_maxrss) * 1024U;
#endif
}

void emitRunReport (PathSelection selection,
                    const RunShape& shape,
                    const std::optional<AtlasFile>& atlasFile,
                    double atlasLoadSeconds,
                    bool autoHandoffVerified,
                    const std::vector<CaptureResult>& captures)
{
    double totalCpuSeconds = 0.0;
    double totalWallSeconds = 0.0;
    for (const auto& capture : captures)
    {
        totalCpuSeconds += capture.cpuSeconds;
        totalWallSeconds += capture.wallSeconds;
    }
    std::cout << std::fixed << std::setprecision (10)
              << "{\"schema\":\"cosimo.warp-atlas-diagnostic-run.v1\""
              << ",\"fixtureContract\":\"cosimo.warp-atlas-paired-fixture.v1\""
              << ",\"selection\":\"" << selectionName (selection) << "\""
              << ",\"automaticFamilyCrossoverEnabled\":"
              << (selection == PathSelection::autoHandoff ? "true" : "false")
              << ",\"automaticHandoffVerified\":";
    if (selection == PathSelection::autoHandoff)
        std::cout << (autoHandoffVerified ? "true" : "false");
    else
        std::cout << "null";
    std::cout
              << ",\"sampleRate\":" << sampleRate
              << ",\"oversampleFactor\":" << maximumWarpOversampleFactor
              << ",\"initialPhase\":" << initialPhase
              << ",\"warmupFrames\":" << shape.warmupFrames
              << ",\"captureFrames\":" << shape.captureFrames
              << ",\"repetitions\":" << shape.repetitions
              << ",\"atlas\":{\"requested\":"
              << (atlasFile.has_value() ? "true" : "false")
              << ",\"validated\":"
              << (atlasFile.has_value() ? "true" : "false")
              << ",\"viewPackedSampleCount\":"
              << (atlasFile.has_value() ? atlasFile->view().packedSampleCount : 0)
              << ",\"storageByteCount\":"
              << (atlasFile.has_value() ? atlasFile->storageByteCount() : 0)
              << ",\"loadSeconds\":" << atlasLoadSeconds
              << ",\"canonicalByteCount\":" << canonicalAtlasByteCount
              << ",\"canonicalSha256\":\"" << canonicalAtlasSha256 << "\""
              << ",\"validatedSha256\":";
    if (atlasFile.has_value())
        std::cout << "\"" << canonicalAtlasSha256 << "\"";
    else
        std::cout << "null";
    std::cout << '}'
              << ",\"renderCpuSeconds\":" << totalCpuSeconds
              << ",\"renderWallSeconds\":" << totalWallSeconds
              << ",\"peakRssBytes\":" << peakResidentBytes()
              << ",\"cases\":[";
    for (std::size_t index = 0; index < captures.size(); ++index)
    {
        if (index != 0)
            std::cout << ',';
        const auto& capture = captures[index];
        const auto& specification = *capture.specification;
        std::cout << "{\"name\":\"" << specification.name << "\""
                  << ",\"family\":\"" << specification.family << "\""
                  << ",\"amountClass\":\"" << specification.amountClass << "\""
                  << ",\"amount\":" << specification.amount
                  << ",\"phaseIncrement\":" << specification.phaseIncrement
                  << ",\"pitchWobble\":" << specification.pitchWobble
                  << ",\"mipBoundaryPitchCase\":"
                  << (specification.mipBoundaryPitchCase ? "true" : "false")
                  << ",\"wav\":\"" << specification.name << ".wav\""
                  << ",\"cpuSeconds\":" << capture.cpuSeconds
                  << ",\"wallSeconds\":" << capture.wallSeconds
                  << ",\"checksum\":" << capture.checksum
                  << ",\"rms\":" << capture.rms
                  << ",\"purePathVerified\":";
        if (selection == PathSelection::autoHandoff)
            std::cout << "null";
        else
            std::cout << (capture.purePathVerified ? "true" : "false");
        std::cout << '}';
    }
    std::cout << "]}\n";
}
}

int main (int argc, char** argv)
{
    const auto parsed = parseOptions (argc, argv);
    if (const auto* error = std::get_if<CommandLineError> (&parsed))
    {
        emitError ("invalid_arguments", "command-line", error->detail, true);
        return 2;
    }
    const auto options = std::get<Options> (parsed);
    const auto selection = resolveSelection (options);
    if (selection == PathSelection::runtimeOnly && options.atlasPath.has_value())
    {
        emitError ("unused_atlas_argument", "command-line",
                   "runtime-only must not receive or open an atlas path", true);
        return 2;
    }
    if (selection != PathSelection::runtimeOnly && ! options.atlasPath.has_value())
    {
        emitError ("atlas_path_required", "command-line",
                   "auto-handoff and atlas-only require --atlas", true);
        return 2;
    }

    std::optional<AtlasFile> atlasFile;
    auto atlasLoadSeconds = 0.0;
    if (options.atlasPath.has_value())
    {
        const auto loadStartedAt = std::chrono::steady_clock::now();
        auto loaded = loadCanonicalAtlas (*options.atlasPath);
        atlasLoadSeconds = std::chrono::duration<double> (
            std::chrono::steady_clock::now() - loadStartedAt).count();
        if (const auto* error = std::get_if<AtlasLoadError> (&loaded))
        {
            emitAtlasLoadError (*error);
            return 3;
        }
        atlasFile.emplace (std::move (std::get<AtlasFile> (loaded)));
    }

    try
    {
        std::error_code directoryError;
        std::filesystem::create_directories (options.outputDirectory, directoryError);
        if (directoryError)
            throw std::runtime_error ("failed to create output directory: "
                                      + directoryError.message());

        // Audio fixtures are deliberately prepared only after the optional atlas
        // has passed both canonical checks. Loader failures therefore cannot
        // reach renderer/table preparation.
        const auto fixture = prepareTableFixture();
        const auto shape = options.quick
            ? RunShape { 64, 512, 1 }
            : RunShape { 512, 4096, 12 };
        const auto atlasView = atlasFile.has_value()
            ? atlasFile->view()
            : PackedWarpAtlasView {};
        const auto autoHandoffVerified = selection != PathSelection::autoHandoff
                                      || verifyAutomaticHandoff (fixture, atlasView);
        if (! autoHandoffVerified)
            throw std::runtime_error (
                "automatic atlas eligibility and 64-frame handoff probe failed");
        std::vector<CaptureResult> captures;
        captures.reserve (captureCases.size());
        for (const auto& capture : captureCases)
        {
            auto result = renderCapture (
                capture, fixture, selection, atlasView, shape);
            writeFloat32Wav (
                options.outputDirectory / (std::string (capture.name) + ".wav"),
                result.samples);
            captures.push_back (std::move (result));
        }
        emitRunReport (
            selection, shape, atlasFile, atlasLoadSeconds,
            autoHandoffVerified, captures);
        return 0;
    }
    catch (const std::exception& error)
    {
        emitError ("diagnostic_run_failed", "audio-capture", error.what(), false);
        return 4;
    }
}
