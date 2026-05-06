#pragma once

#include "cmajor/helpers/cmaj_Patch.h"
#include "choc/text/choc_JSON.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <string_view>
#include <vector>

namespace cosimo::modulation
{

constexpr auto modulationStateKey = "modulation.v2";
constexpr auto modulationClearEndpointID = "modulationClear";
constexpr auto modulationEnableEndpointID = "modulationEnable";
constexpr auto modulationMsegBufferEndpointID = "modulationMsegBuffer";
constexpr auto modulationMsegPlaybackEndpointID = "modulationMsegPlayback";
constexpr auto modulationEnvelopeEndpointID = "modulationEnvelope";
constexpr auto modulationRouteEndpointID = "modulationRoute";

constexpr int modulationMsegSlotCount = 3;
constexpr int modulationEnvelopeSlotCount = 3;
constexpr int modulationRouteCount = 12;
constexpr int msegBodySamples = 2048;
constexpr int msegPaddedSamples = msegBodySamples + 3;
constexpr float msegCurvePowerLimit = 20.0f;
constexpr double msegRateMinSeconds = 0.0;
constexpr double msegRateMaxSeconds = 2.0;
constexpr double envMinSeconds = 0.001;
constexpr double envMaxSeconds = 10.0;
constexpr float filterQMin = 0.1f;
constexpr float filterQMax = 20.0f;

constexpr int sourceMseg = 1;
constexpr int sourceEnv = 2;
constexpr int sourceVelocity = 3;
constexpr int sourcePressure = 4;
constexpr int sourceSlide = 5;

constexpr int targetWavetablePosition = 1;
constexpr int targetWarpAmount = 2;
constexpr int targetFilterCutoffOctaves = 3;
constexpr int targetFilterQ = 4;
constexpr int targetPitchSemitones = 5;
constexpr int targetAmpGainDb = 6;
constexpr int targetPan = 7;

struct MsegPoint
{
    float x = 0.0f;
    float y = 0.0f;
    float curvePower = 0.0f;
};

struct MsegSlot
{
    std::vector<MsegPoint> pointsA
    {
        { 0.0f, 0.0f, 0.0f },
        { 1.0f, 1.0f, 0.0f },
    };
    std::vector<MsegPoint> pointsB
    {
        { 0.0f, 0.0f, 0.0f },
        { 1.0f, 1.0f, 0.0f },
    };
    float morph = 0.0f;
    double seconds = 1.0;
    bool holdFinalValue = true;
    bool loopEnabled = true;
    double loopStart = 0.0;
    double loopEnd = 1.0;
    int noteOffPolicy = 0;
    bool legatoRestarts = false;
};

struct EnvelopeSlot
{
    double attackSeconds = 0.01;
    double decaySeconds = 0.25;
    float sustain = 0.5f;
    double releaseSeconds = 0.2;
};

struct Route
{
    bool enabled = false;
    int sourceKind = sourceMseg;
    int sourceSlot = 0;
    int targetKind = targetWavetablePosition;
    float amount = 0.0f;
};

struct State
{
    std::array<MsegSlot, modulationMsegSlotCount> msegSlots {};
    std::array<EnvelopeSlot, modulationEnvelopeSlotCount> envelopeSlots {};
    std::array<Route, modulationRouteCount> routes {};
};

template <typename ValueType>
ValueType clampValue (ValueType value, ValueType minValue, ValueType maxValue)
{
    return std::min (std::max (value, minValue), maxValue);
}

inline float clamp01 (float value)
{
    return clampValue (std::isfinite (value) ? value : 0.0f, 0.0f, 1.0f);
}

inline double clampSeconds (double value, double fallback, double minValue, double maxValue)
{
    return clampValue (std::isfinite (value) ? value : fallback, minValue, maxValue);
}

inline bool almostEqual (float left, float right, float epsilon = 1.0e-12f)
{
    return std::abs (left - right) <= epsilon;
}

inline float clampCurvePower (float value)
{
    return clampValue (std::isfinite (value) ? value : 0.0f, -msegCurvePowerLimit, msegCurvePowerLimit);
}

inline int clampSlot (int slot, int maxSlot)
{
    return clampValue (slot, 1, maxSlot);
}

inline int sourceKindFromString (std::string_view value)
{
    if (value == "env") return sourceEnv;
    if (value == "velocity") return sourceVelocity;
    if (value == "pressure") return sourcePressure;
    if (value == "slide") return sourceSlide;
    return sourceMseg;
}

inline int targetKindFromString (std::string_view value)
{
    if (value == "warpAmount") return targetWarpAmount;
    if (value == "filterCutoffOctaves") return targetFilterCutoffOctaves;
    if (value == "filterQ") return targetFilterQ;
    if (value == "pitchSemitones") return targetPitchSemitones;
    if (value == "ampGainDb") return targetAmpGainDb;
    if (value == "pan") return targetPan;
    return targetWavetablePosition;
}

inline float clampRouteAmount (int targetKind, float value)
{
    const auto numericValue = std::isfinite (value) ? value : 0.0f;

    switch (targetKind)
    {
        case targetWavetablePosition:      return clampValue (numericValue, -1.0f, 1.0f);
        case targetWarpAmount:             return clampValue (numericValue, -1.0f, 1.0f);
        case targetFilterCutoffOctaves:    return clampValue (numericValue, -6.0f, 6.0f);
        case targetFilterQ:                return clampValue (numericValue, -(filterQMax - filterQMin), filterQMax - filterQMin);
        case targetPitchSemitones:         return clampValue (numericValue, -48.0f, 48.0f);
        case targetAmpGainDb:              return clampValue (numericValue, -48.0f, 6.0f);
        case targetPan:                    return clampValue (numericValue, -1.0f, 1.0f);
        default:                           return 0.0f;
    }
}

inline float powerScale (float value, float power)
{
    if (std::abs (power) < 0.01f)
        return value;

    const auto numerator = std::exp (power * value) - 1.0f;
    const auto denominator = std::exp (power) - 1.0f;
    return denominator == 0.0f ? value : (numerator / denominator);
}

inline float evaluateShape (const std::vector<MsegPoint>& points, float x)
{
    if (points.empty())
        return 0.0f;

    const auto clampedX = clamp01 (x);

    if (clampedX <= points.front().x)
        return points.front().y;

    for (size_t index = 0; index + 1 < points.size(); ++index)
    {
        const auto& from = points[index];
        const auto& to = points[index + 1];

        if (clampedX < to.x)
        {
            const auto width = to.x - from.x;
            const auto t = width <= 0.0f ? 1.0f : ((clampedX - from.x) / width);
            const auto curvedT = clamp01 (powerScale (t, from.curvePower));
            return from.y + ((to.y - from.y) * curvedT);
        }

        if (almostEqual (clampedX, to.x))
        {
            auto latestIndex = index + 1;

            while (latestIndex + 1 < points.size() && almostEqual (points[latestIndex + 1].x, clampedX))
                latestIndex += 1;

            return points[latestIndex].y;
        }
    }

    return points.back().y;
}

inline std::vector<float> renderMsegBuffer (const std::vector<MsegPoint>& points)
{
    std::vector<float> rendered (msegPaddedSamples, 0.0f);

    for (int sampleIndex = 0; sampleIndex < msegBodySamples; ++sampleIndex)
    {
        const auto x = static_cast<float> (sampleIndex) / static_cast<float> (msegBodySamples - 1);
        rendered[static_cast<size_t> (sampleIndex + 1)] = evaluateShape (points, x);
    }

    rendered[0] = rendered[1];
    rendered[static_cast<size_t> (msegBodySamples + 1)] = rendered[static_cast<size_t> (msegBodySamples)];
    rendered[static_cast<size_t> (msegBodySamples + 2)] = rendered[static_cast<size_t> (msegBodySamples)];
    return rendered;
}

inline MsegPoint parsePoint (const choc::value::ValueView& value, size_t pointIndex, size_t pointCount)
{
    auto point = MsegPoint {};
    point.x = pointIndex == 0 ? 0.0f : (pointIndex + 1 == pointCount ? 1.0f : clamp01 (value["x"].getWithDefault (0.0f)));
    point.y = clamp01 (value["y"].getWithDefault (0.0f));
    point.curvePower = clampCurvePower (value["curvePower"].getWithDefault (0.0f));
    return point;
}

inline std::vector<MsegPoint> parsePoints (const choc::value::ValueView& shapeValue)
{
    if (! shapeValue.isObject() || ! shapeValue.hasObjectMember ("points"))
        return MsegSlot {}.pointsA;

    const auto pointsValue = shapeValue["points"];

    if (! pointsValue.isArray() || pointsValue.size() < 2)
        return MsegSlot {}.pointsA;

    std::vector<MsegPoint> points;
    points.reserve (pointsValue.size());

    for (uint32_t index = 0; index < pointsValue.size(); ++index)
        points.push_back (parsePoint (pointsValue[index], static_cast<size_t> (index), static_cast<size_t> (pointsValue.size())));

    if (! almostEqual (points.front().x, 0.0f) || ! almostEqual (points.back().x, 1.0f))
        return MsegSlot {}.pointsA;

    for (size_t index = 1; index < points.size(); ++index)
        if (points[index].x < points[index - 1].x)
            return MsegSlot {}.pointsA;

    return points;
}

inline MsegSlot parseMsegSlot (const choc::value::ValueView& value)
{
    auto slot = MsegSlot {};

    if (! value.isObject())
        return slot;

    if (value.hasObjectMember ("shapeA"))
        slot.pointsA = parsePoints (value["shapeA"]);

    if (value.hasObjectMember ("shapeB"))
        slot.pointsB = parsePoints (value["shapeB"]);
    else
        slot.pointsB = slot.pointsA;

    slot.morph = clamp01 (value["morph"].getWithDefault (0.0f));

    if (value.hasObjectMember ("playback") && value["playback"].isObject())
    {
        const auto playback = value["playback"];
        const auto loop = playback["loop"];
        const auto noteOffPolicy = playback["noteOffPolicy"].toString();
        slot.seconds = clampSeconds (playback["rate"]["seconds"].getWithDefault (1.0), 1.0, msegRateMinSeconds, msegRateMaxSeconds);
        slot.holdFinalValue = playback["holdFinalValue"].getWithDefault (true);
        slot.loopEnabled = loop.isObject();
        slot.loopStart = slot.loopEnabled ? clampValue (loop["startX"].getWithDefault (0.0), 0.0, 1.0) : 0.0;
        slot.loopEnd = slot.loopEnabled ? clampValue (loop["endX"].getWithDefault (1.0), 0.0, 1.0) : 1.0;
        if (slot.loopEnd < slot.loopStart)
            std::swap (slot.loopStart, slot.loopEnd);
        slot.noteOffPolicy = noteOffPolicy == "immediate" ? 1 : (noteOffPolicy == "ignore" ? 2 : 0);
        slot.legatoRestarts = playback["legatoRestarts"].getWithDefault (false);
    }

    return slot;
}

inline EnvelopeSlot parseEnvelopeSlot (const choc::value::ValueView& value)
{
    auto slot = EnvelopeSlot {};

    if (! value.isObject())
        return slot;

    slot.attackSeconds = clampSeconds (value["attackSeconds"].getWithDefault (slot.attackSeconds), slot.attackSeconds, envMinSeconds, envMaxSeconds);
    slot.decaySeconds = clampSeconds (value["decaySeconds"].getWithDefault (slot.decaySeconds), slot.decaySeconds, envMinSeconds, envMaxSeconds);
    slot.sustain = clamp01 (value["sustain"].getWithDefault (slot.sustain));
    slot.releaseSeconds = clampSeconds (value["releaseSeconds"].getWithDefault (slot.releaseSeconds), slot.releaseSeconds, envMinSeconds, envMaxSeconds);
    return slot;
}

inline Route parseRoute (const choc::value::ValueView& value)
{
    auto route = Route {};

    if (! value.isObject())
        return route;

    route.enabled = value["enabled"].getWithDefault (true);
    route.sourceKind = sourceKindFromString (value["sourceKind"].toString());
    route.targetKind = targetKindFromString (value["targetKind"].toString());

    if (! route.enabled)
        return route;

    if (route.sourceKind == sourceVelocity || route.sourceKind == sourcePressure || route.sourceKind == sourceSlide)
    {
        route.sourceSlot = 0;
    }
    else
    {
        const auto maxSlot = route.sourceKind == sourceEnv ? modulationEnvelopeSlotCount : modulationMsegSlotCount;
        route.sourceSlot = clampSlot (value["sourceSlot"].getWithDefault (1), maxSlot);
    }

    route.amount = clampRouteAmount (route.targetKind, value["amount"].getWithDefault (0.0f));
    return route;
}

inline State createStateFromJSON (const choc::value::ValueView& value)
{
    auto state = State {};

    if (! value.isObject())
        return state;

    const auto msegSlots = value["msegSlots"];
    const auto envelopeSlots = value["envelopeSlots"];
    const auto routes = value["routes"];

    for (int index = 0; index < modulationMsegSlotCount; ++index)
        if (msegSlots.isArray() && index < static_cast<int> (msegSlots.size()))
            state.msegSlots[static_cast<size_t> (index)] = parseMsegSlot (msegSlots[static_cast<uint32_t> (index)]);

    for (int index = 0; index < modulationEnvelopeSlotCount; ++index)
        if (envelopeSlots.isArray() && index < static_cast<int> (envelopeSlots.size()))
            state.envelopeSlots[static_cast<size_t> (index)] = parseEnvelopeSlot (envelopeSlots[static_cast<uint32_t> (index)]);

    for (int index = 0; index < modulationRouteCount; ++index)
        if (routes.isArray() && index < static_cast<int> (routes.size()))
            state.routes[static_cast<size_t> (index)] = parseRoute (routes[static_cast<uint32_t> (index)]);

    return state;
}

inline State createStateFromStoredValue (const choc::value::ValueView& value)
{
    if (! value.isString())
        return {};

    try
    {
        return createStateFromJSON (choc::json::parse (value.toString()));
    }
    catch (...)
    {
        return {};
    }
}

inline bool sendValue (cmaj::Patch& patch, std::string_view endpointID, const choc::value::ValueView& value, int32_t rampFrames = 0, uint32_t timeoutMilliseconds = 2000)
{
    return patch.sendEventOrValueToPatch (cmaj::EndpointID::create (endpointID), value, rampFrames, timeoutMilliseconds);
}

inline bool sendValue (cmaj::Patch& patch, std::string_view endpointID, int32_t value, int32_t rampFrames = 0, uint32_t timeoutMilliseconds = 2000)
{
    auto wrappedValue = choc::value::createInt32 (value);
    return patch.sendEventOrValueToPatch (cmaj::EndpointID::create (endpointID), wrappedValue, rampFrames, timeoutMilliseconds);
}

inline bool sendValue (cmaj::Patch& patch, std::string_view endpointID, float value, int32_t rampFrames = 0, uint32_t timeoutMilliseconds = 2000)
{
    auto wrappedValue = choc::value::createFloat32 (clamp01 (value));
    return patch.sendEventOrValueToPatch (cmaj::EndpointID::create (endpointID), wrappedValue, rampFrames, timeoutMilliseconds);
}

inline bool uploadStateToPatch (cmaj::Patch& patch, const State& state)
{
    auto ok = true;
    ok = ok && sendValue (patch, modulationEnableEndpointID, 0);
    ok = ok && sendValue (patch, modulationClearEndpointID, 1);

    for (int slotIndex = 0; slotIndex < modulationMsegSlotCount; ++slotIndex)
    {
        const auto& slot = state.msegSlots[static_cast<size_t> (slotIndex)];
        auto bufferUploadA = choc::json::create (
            "slot", slotIndex + 1,
            "shapeIndex", 0,
            "buffer", choc::value::createArray (renderMsegBuffer (slot.pointsA))
        );
        ok = ok && sendValue (patch, modulationMsegBufferEndpointID, bufferUploadA);

        auto bufferUploadB = choc::json::create (
            "slot", slotIndex + 1,
            "shapeIndex", 1,
            "buffer", choc::value::createArray (renderMsegBuffer (slot.pointsB))
        );
        ok = ok && sendValue (patch, modulationMsegBufferEndpointID, bufferUploadB);

        ok = ok && sendValue (patch, "mseg" + std::to_string (slotIndex + 1) + "Morph", slot.morph);

        auto playbackUpload = choc::json::create (
            "slot", slotIndex + 1,
            "seconds", slot.seconds,
            "holdFinalValue", slot.holdFinalValue,
            "rateKind", 0,
            "loopEnabled", slot.loopEnabled,
            "loopStart", slot.loopStart,
            "loopEnd", slot.loopEnd,
            "noteOffPolicy", slot.noteOffPolicy,
            "legatoRestarts", slot.legatoRestarts
        );
        ok = ok && sendValue (patch, modulationMsegPlaybackEndpointID, playbackUpload);
    }

    for (int slotIndex = 0; slotIndex < modulationEnvelopeSlotCount; ++slotIndex)
    {
        const auto& slot = state.envelopeSlots[static_cast<size_t> (slotIndex)];
        auto envelopeUpload = choc::json::create (
            "slot", slotIndex + 1,
            "attackSeconds", slot.attackSeconds,
            "decaySeconds", slot.decaySeconds,
            "sustain", slot.sustain,
            "releaseSeconds", slot.releaseSeconds
        );
        ok = ok && sendValue (patch, modulationEnvelopeEndpointID, envelopeUpload);
    }

    for (int routeIndex = 0; routeIndex < modulationRouteCount; ++routeIndex)
    {
        const auto& route = state.routes[static_cast<size_t> (routeIndex)];
        auto routeUpload = choc::json::create (
            "routeIndex", routeIndex,
            "enabled", route.enabled,
            "sourceKind", route.enabled ? route.sourceKind : sourceMseg,
            "sourceSlot", route.enabled ? route.sourceSlot : 0,
            "targetKind", route.targetKind,
            "amount", route.enabled ? route.amount : 0.0f
        );
        ok = ok && sendValue (patch, modulationRouteEndpointID, routeUpload);
    }

    ok = ok && sendValue (patch, modulationEnableEndpointID, 1);
    return ok;
}

inline bool uploadStoredModulationStateToPatch (cmaj::Patch& patch)
{
    const auto& storedValues = patch.getStoredStateValues();
    const auto foundState = storedValues.find (modulationStateKey);
    const auto state = foundState == storedValues.end() ? State {} : createStateFromStoredValue (foundState->second);
    return uploadStateToPatch (patch, state);
}

} // namespace cosimo::modulation
