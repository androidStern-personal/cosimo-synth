#include "WarpRenderer.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>

#if defined(__wasm_simd128__) && ! defined(__EMSCRIPTEN__)
// xsimd 13 detects its Wasm backend only through Emscripten even though the
// backend itself uses the toolchain-neutral wasm_simd128.h intrinsics. Limit
// the compatibility define to this include so the same renderer builds under
// Cmajor's WASI toolchain without pretending the rest of the target is Emscripten.
#define COSIMO_XSIMD_WASI_COMPAT 1
#define __EMSCRIPTEN__ 1
#endif
#include <xsimd/xsimd.hpp>
#if defined(COSIMO_XSIMD_WASI_COMPAT)
#undef __EMSCRIPTEN__
#undef COSIMO_XSIMD_WASI_COMPAT
#endif

namespace cosimo::three_osc
{
namespace
{
#if defined(__wasm_simd128__)
using SimdArchitecture = xsimd::wasm;
#elif defined(__aarch64__) || defined(_M_ARM64)
using SimdArchitecture = xsimd::neon64;
#elif defined(__x86_64__) || defined(_M_X64)
using SimdArchitecture = xsimd::sse2;
#else
using SimdArchitecture = xsimd::default_arch;
#endif

using FloatBatch = xsimd::batch<float, SimdArchitecture>;
using IntBatch = xsimd::batch<std::int32_t, SimdArchitecture>;
using FloatBoolBatch = xsimd::batch_bool<float, SimdArchitecture>;
constexpr std::size_t batchSize = FloatBatch::size;
static_assert (batchSize == 4);
static_assert (batchSize == warpFamilyBatchWidth);
static_assert (maximumUnisonCount % batchSize == 0);

constexpr std::array<float, 29> standardRateTapValues {
    -0.00012148717251567235f, 0.00020998967686316014f,
    0.0012854280096012522f, 0.0020485596381400839f,
    0.00073995687789565835f, -0.0019545838870931968f,
    -0.0022514451200559712f, 0.0014878521000839021f,
    0.0043277695665701809f, 0.00055145517147702156f,
    -0.0059467434307829883f, -0.0044083148096704669f,
    0.0057910715585931605f, 0.0095849213489235235f,
    -0.0024941306296903591f, -0.014669821257526409f,
    -0.0049002132830797251f, 0.017379544143778052f,
    0.016495801691917517f, -0.014754956588460887f,
    -0.031277497235072317f, 0.0032210418478690081f,
    0.0471690254646547f, 0.022619406962534682f,
    -0.061439912504550789f, -0.078624602756345432f,
    0.07135902468851793f, 0.30863655589724748f,
    0.42508767187214058f
};

constexpr std::array<float, 40> lowRateTapValues {
    0.00026380907583268843f, 0.000527482355555931068f,
    0.000118317429550480972f, -0.00104695409333505703f,
    -0.00162468078313233815f, -0.000440370680645149279f,
    0.0011692417614402339f, 0.000618611165398756787f,
    -0.00164800369740555723f, -0.00184288546058863347f,
    0.00120735433394803817f, 0.00289380047059266312f,
    -0.000386734923052359984f, -0.00402162141454164446f,
    -0.00126692811487913557f, 0.0046443120346659492f,
    0.00356955149477907819f, -0.00446769778341067278f,
    -0.00639473951138334537f, 0.0030463878231637171f,
    0.0093115928381967486f, -0.0000904189661943094968f,
    -0.0117473671310204739f, -0.00456770144712684203f,
    0.0129441241859949794f, 0.0108660152591071035f,
    -0.0120297871959060259f, -0.018506755455890464f,
    0.00801356259920249676f, 0.026953914522667155f,
    0.000304034549660547881f, -0.0354910086104430963f,
    -0.0147887914110427735f, 0.0433021647775713309f,
    0.0397298293626788257f, -0.0495831654402946048f,
    -0.0908805845117537925f, 0.0536552811646038089f,
    0.313085855904510935f, 0.444934603362753645f
};

template <std::size_t TapCount>
constexpr auto makeReversedNearTapValues (const std::array<float, TapCount>& values) noexcept
{
    constexpr auto pairCount = TapCount - 1;
    constexpr auto vectorisedCount = (pairCount / batchSize) * batchSize;
    std::array<float, vectorisedCount> result {};
    for (std::size_t group = 0; group < result.size(); group += batchSize)
        for (std::size_t lane = 0; lane < batchSize; ++lane)
            result[group + lane] = values[group + batchSize - 1 - lane];
    return result;
}

constexpr auto standardReversedNearTapValues = makeReversedNearTapValues (standardRateTapValues);
constexpr auto lowReversedNearTapValues = makeReversedNearTapValues (lowRateTapValues);

constexpr float atlasQuantisationScale = 1.5f / 32767.0f;
constexpr float atlasDerivativeQuantisationScale = 0.5f / 32767.0f;
constexpr std::uint32_t sourceValueMask = (1U << sourceValueBits) - 1U;
constexpr std::int32_t atlasPackedSampleCount = 17792516;
constexpr float piValue = 3.1415927f;

struct UnisonLookupTables
{
    float spreads[maximumUnisonCount + 1][5][maximumUnisonCount] {};
    float stackSemitones[maximumUnisonCount + 1][5][maximumUnisonCount] {};
    float sideAmounts[maximumUnisonCount + 1][maximumUnisonCount] {};
    float weightBaseSums[maximumUnisonCount + 1] {};
    float weightSideSums[maximumUnisonCount + 1] {};
};

UnisonLookupTables makeUnisonLookupTables() noexcept
{
    UnisonLookupTables result;
    for (std::size_t voiceCount = 1; voiceCount <= maximumUnisonCount; ++voiceCount)
    {
        const auto center = static_cast<float> (voiceCount - 1) * 0.5f;
        for (std::size_t subVoice = 0; subVoice < voiceCount; ++subVoice)
        {
            const auto normalized = voiceCount <= 1
                ? 0.0f
                : (static_cast<float> (subVoice) / static_cast<float> (voiceCount - 1))
                    * 2.0f - 1.0f;
            const auto sign = normalized < 0.0f ? -1.0f : 1.0f;
            const auto seeded = std::sin (static_cast<float> (
                (subVoice + 1) * 37 + voiceCount * 19) * 12.9898f) * 43758.5453f;
            const auto wrappedSeed = seeded - std::floor (seeded);
            result.spreads[voiceCount][0][subVoice] = normalized;
            result.spreads[voiceCount][1][subVoice]
                = std::sin (normalized * 0.5f * piValue);
            result.spreads[voiceCount][2][subVoice]
                = sign * std::pow (std::abs (normalized), 1.6f);
            result.spreads[voiceCount][3][subVoice]
                = sign * (1.0f - std::pow (1.0f - std::abs (normalized), 1.6f));
            result.spreads[voiceCount][4][subVoice]
                = voiceCount <= 1 ? 0.0f : wrappedSeed * 2.0f - 1.0f;

            if (voiceCount > 1)
            {
                const auto offset = static_cast<float> (subVoice) - center;
                result.stackSemitones[voiceCount][1][subVoice]
                    = static_cast<float> (subVoice) * 12.0f;
                result.stackSemitones[voiceCount][2][subVoice]
                    = (static_cast<float> (subVoice / 2) * 12.0f)
                    + ((subVoice & 1U) != 0U ? 7.0f : 0.0f);
                result.stackSemitones[voiceCount][3][subVoice] = offset * 12.0f;
                result.stackSemitones[voiceCount][4][subVoice] = offset * 24.0f;
                result.sideAmounts[voiceCount][subVoice]
                    = std::abs (static_cast<float> (subVoice) - center) / center;
            }
            result.weightBaseSums[voiceCount]
                += 1.0f - result.sideAmounts[voiceCount][subVoice];
            result.weightSideSums[voiceCount]
                += result.sideAmounts[voiceCount][subVoice];
        }
    }
    return result;
}

// Fixed-size, allocation-free module initialisation. The values depend only on
// the discrete unison count/mode controls and are never rebuilt on the audio thread.
const UnisonLookupTables unisonLookupTables = makeUnisonLookupTables();

struct AtlasModeMetadata
{
    std::int32_t sampleOffset;
    std::int32_t amountCount;
    std::int32_t amountStride;
    std::int32_t bankStride;
    std::int32_t basisCount;
    std::int32_t mipCount;
    std::array<std::int32_t, 7> mipOffsets;
    std::array<std::int32_t, 7> tableLengths;
};

constexpr std::array<AtlasModeMetadata, 4> atlasModes {{
    { 0, 769, 6556, 0, 4, 7,
      { 0, 260, 520, 780, 1168, 1940, 3480 },
      { 64, 64, 64, 96, 192, 384, 768 } },
    { 5041564, 2049, 3278, 1639, 2, 7,
      { 0, 65, 130, 195, 292, 485, 870 },
      { 64, 64, 64, 96, 192, 384, 768 } },
    { 11758186, 1537, 1740, 870, 2, 6,
      { 0, 65, 130, 195, 292, 485, 0 },
      { 64, 64, 64, 96, 192, 384, 0 } },
    { 14432566, 1025, 3278, 1639, 2, 7,
      { 0, 65, 130, 195, 292, 485, 870 },
      { 64, 64, 64, 96, 192, 384, 768 } }
}};

FloatBatch clamp (const FloatBatch& value, float low, float high) noexcept
{
    return xsimd::min (FloatBatch (high), xsimd::max (FloatBatch (low), value));
}

FloatBatch wrap01 (const FloatBatch& value) noexcept
{
    return value - xsimd::floor (value);
}

// xsimd 13's generic exp2 path folds correctly for literals but returns 1.0
// for small dynamic Wasm inputs, which silently disables unison detune. This
// bounded polynomial keeps the computation in four SIMD lanes on every target.
// The renderer's supported stack/detune domain stays inside [-8, 8], so an
// exact power-of-two exponent plus the same minimax fractional polynomial used
// by xsimd is both allocation-free and comfortably within float audio accuracy.
FloatBatch unisonPitchRatio (const FloatBatch& exponent) noexcept
{
    const auto bounded = clamp (exponent, -8.0f, 8.0f);
    const auto integral = xsimd::floor (bounded + FloatBatch (0.5f));
    const auto fractional = bounded - integral;

    auto polynomial = FloatBatch (0.00015524314949288964f);
    polynomial = FloatBatch (0.0013433126732707024f) + fractional * polynomial;
    polynomial = FloatBatch (0.009617837145924568f) + fractional * polynomial;
    polynomial = FloatBatch (0.055502813309431076f) + fractional * polynomial;
    polynomial = FloatBatch (0.24022652208805084f) + fractional * polynomial;
    const auto approximation = FloatBatch (1.0f)
        + fractional * FloatBatch (0.6931471824645996f)
        + fractional * fractional * polynomial;

    const auto exponentBits = (xsimd::to_int (integral) + IntBatch (127)) << 23;
    return approximation * xsimd::bitwise_cast<float> (exponentBits);
}

FloatBatch quinticHermite (const FloatBatch& x,
                            const FloatBatch& x0,
                            const FloatBatch& x1,
                            const FloatBatch& y0,
                            const FloatBatch& y1,
                            const FloatBatch& d0,
                            const FloatBatch& d1,
                            const FloatBatch& dd0 = FloatBatch (0.0f),
                            const FloatBatch& dd1 = FloatBatch (0.0f)) noexcept
{
    const auto width = x1 - x0;
    const auto u = (x - x0) / width;
    const auto delta = y1 - y0;
    const auto d0s = d0 * width;
    const auto d1s = d1 * width;
    const auto dd0s = dd0 * width * width;
    const auto dd1s = dd1 * width * width;
    const auto c2 = FloatBatch (0.5f) * dd0s;
    const auto c3 = FloatBatch (10.0f) * delta - FloatBatch (6.0f) * d0s
                  - FloatBatch (4.0f) * d1s - FloatBatch (1.5f) * dd0s
                  + FloatBatch (0.5f) * dd1s;
    const auto c4 = FloatBatch (-15.0f) * delta + FloatBatch (8.0f) * d0s
                  + FloatBatch (7.0f) * d1s + FloatBatch (1.5f) * dd0s - dd1s;
    const auto c5 = FloatBatch (6.0f) * delta - FloatBatch (3.0f) * d0s
                  - FloatBatch (3.0f) * d1s - FloatBatch (0.5f) * dd0s
                  + FloatBatch (0.5f) * dd1s;
    return y0 + u * (d0s + u * (c2 + u * (c3 + u * (c4 + u * c5))));
}

FloatBatch linearSkew (const FloatBatch& phase,
                       const FloatBatch& split,
                       const FloatBatch& leftSlope,
                       const FloatBatch& rightSlope) noexcept
{
    const auto left = leftSlope * phase;
    const auto right = FloatBatch (0.5f) + rightSlope * (phase - split);
    return xsimd::select (phase < split, left, right);
}

struct SkewParameters
{
    FloatBatch split;
    FloatBatch leftSlope;
    FloatBatch rightSlope;
    FloatBatch width;
};

SkewParameters prepareSkew (const FloatBatch& amount,
                            const FloatBatch& halfWidth) noexcept
{
    const auto split = clamp (FloatBatch (0.5f) + FloatBatch (0.48f)
                            * (FloatBatch (2.0f) * amount - FloatBatch (1.0f)), 0.02f, 0.98f);
    const auto leftSlope = FloatBatch (0.5f) / split;
    const auto rightSlope = FloatBatch (0.5f) / (FloatBatch (1.0f) - split);
    return {
        split,
        leftSlope,
        rightSlope,
        xsimd::min (halfWidth,
                    xsimd::min (split * FloatBatch (0.475f),
                                (FloatBatch (1.0f) - split) * FloatBatch (0.475f)))
    };
}

struct PwmParameters
{
    FloatBatch active;
    FloatBatch slope;
    FloatBatch width;
};

PwmParameters preparePwm (const FloatBatch& amount,
                          const FloatBatch& halfWidth) noexcept
{
    const auto active = FloatBatch (1.0f) - FloatBatch (0.98f) * amount;
    return {
        active,
        FloatBatch (1.0f) / active,
        xsimd::min (halfWidth,
                    xsimd::min (active * FloatBatch (0.475f),
                                (FloatBatch (1.0f) - active) * FloatBatch (0.475f)))
    };
}

struct MirrorParameters
{
    FloatBatch split;
    FloatBatch leftSlope;
    FloatBatch rightSlope;
    FloatBatch risingCorner;
    FloatBatch fallingCorner;
    FloatBatch leftPhaseSlope;
    FloatBatch rightPhaseSlope;
    FloatBatch internalWidth;
    FloatBatch turnWidth;
    FloatBatch boundaryWidth;
};

MirrorParameters prepareMirror (const FloatBatch& amount,
                                const FloatBatch& halfWidth) noexcept
{
    const auto skew = prepareSkew (amount, halfWidth);
    const auto risingCorner = FloatBatch (0.5f) * skew.split;
    const auto leftPhaseSlope = FloatBatch (2.0f) * skew.leftSlope;
    const auto rightPhaseSlope = FloatBatch (2.0f) * skew.rightSlope;
    return {
        skew.split,
        skew.leftSlope,
        skew.rightSlope,
        risingCorner,
        FloatBatch (1.0f) - risingCorner,
        leftPhaseSlope,
        rightPhaseSlope,
        xsimd::min (halfWidth,
                    xsimd::min (risingCorner * FloatBatch (0.475f),
                                (FloatBatch (0.5f) - risingCorner) * FloatBatch (0.475f))),
        xsimd::min (halfWidth,
                    (FloatBatch (0.5f) - risingCorner) * FloatBatch (0.475f)),
        xsimd::min (halfWidth, risingCorner * FloatBatch (0.475f))
    };
}

FloatBatch smoothAsym (const FloatBatch& phase,
                       const SkewParameters& parameters) noexcept
{
    const auto& split = parameters.split;
    const auto& leftSlope = parameters.leftSlope;
    const auto& rightSlope = parameters.rightSlope;
    const auto& width = parameters.width;
    auto result = linearSkew (phase, split, leftSlope, rightSlope);

    const auto internal = xsimd::abs (phase - split) < width;
    if (xsimd::any (internal))
    {
        const auto transitioned = quinticHermite (
            phase, split - width, split + width,
            FloatBatch (0.5f) - leftSlope * width,
            FloatBatch (0.5f) + rightSlope * width,
            leftSlope, rightSlope);
        result = xsimd::select (internal, transitioned, result);
    }

    const auto local = xsimd::select (phase > FloatBatch (0.5f), phase - FloatBatch (1.0f), phase);
    const auto boundary = xsimd::abs (local) < width;
    if (xsimd::any (boundary))
    {
        const auto boundaryValue = quinticHermite (
            local, -width, width,
            FloatBatch (1.0f) - rightSlope * width,
            FloatBatch (1.0f) + leftSlope * width,
            rightSlope, leftSlope);
        result = xsimd::select (boundary, boundaryValue, result);
    }
    return wrap01 (result);
}

FloatBatch smoothPwm (const FloatBatch& phase,
                      const PwmParameters& parameters) noexcept
{
    const auto& active = parameters.active;
    const auto& slope = parameters.slope;
    const auto& width = parameters.width;
    auto result = xsimd::select (phase < active, phase * slope, FloatBatch (1.0f));
    const auto internal = xsimd::abs (phase - active) < width;
    if (xsimd::any (internal))
    {
        const auto transitioned = quinticHermite (
            phase, active - width, active + width,
            FloatBatch (1.0f) - slope * width, FloatBatch (1.0f),
            slope, FloatBatch (0.0f));
        result = xsimd::select (internal, transitioned, result);
    }

    const auto local = xsimd::select (phase > FloatBatch (0.5f), phase - FloatBatch (1.0f), phase);
    const auto boundary = xsimd::abs (local) < width;
    if (xsimd::any (boundary))
    {
        const auto boundaryValue = quinticHermite (
            local, -width, width,
            FloatBatch (1.0f), FloatBatch (1.0f) + slope * width,
            FloatBatch (0.0f), slope);
        result = xsimd::select (boundary, boundaryValue, result);
    }
    return wrap01 (result);
}

FloatBatch smoothMirror (const FloatBatch& phase,
                         const MirrorParameters& parameters) noexcept
{
    const auto& split = parameters.split;
    const auto& leftSlope = parameters.leftSlope;
    const auto& rightSlope = parameters.rightSlope;
    const auto mirror = xsimd::select (phase < FloatBatch (0.5f),
                                      FloatBatch (2.0f) * phase,
                                      FloatBatch (2.0f) - FloatBatch (2.0f) * phase);
    auto result = linearSkew (mirror, split, leftSlope, rightSlope);

    const auto& risingCorner = parameters.risingCorner;
    const auto& fallingCorner = parameters.fallingCorner;
    const auto& leftPhaseSlope = parameters.leftPhaseSlope;
    const auto& rightPhaseSlope = parameters.rightPhaseSlope;
    const auto& internalWidth = parameters.internalWidth;

    const auto rising = xsimd::abs (phase - risingCorner) < internalWidth;
    if (xsimd::any (rising))
    {
        const auto risingValue = quinticHermite (
            phase, risingCorner - internalWidth, risingCorner + internalWidth,
            FloatBatch (0.5f) - leftPhaseSlope * internalWidth,
            FloatBatch (0.5f) + rightPhaseSlope * internalWidth,
            leftPhaseSlope, rightPhaseSlope);
        result = xsimd::select (rising, risingValue, result);
    }

    const auto falling = xsimd::abs (phase - fallingCorner) < internalWidth;
    if (xsimd::any (falling))
    {
        const auto fallingValue = quinticHermite (
            phase, fallingCorner - internalWidth, fallingCorner + internalWidth,
            FloatBatch (0.5f) + rightPhaseSlope * internalWidth,
            FloatBatch (0.5f) - leftPhaseSlope * internalWidth,
            -rightPhaseSlope, -leftPhaseSlope);
        result = xsimd::select (falling, fallingValue, result);
    }

    const auto& turnWidth = parameters.turnWidth;
    const auto turnDistance = xsimd::abs (phase - FloatBatch (0.5f));
    const auto turn = turnDistance < turnWidth;
    if (xsimd::any (turn))
    {
        const auto turnValue = quinticHermite (
            phase, FloatBatch (0.5f) - turnWidth, FloatBatch (0.5f) + turnWidth,
            FloatBatch (1.0f) - rightPhaseSlope * turnWidth,
            FloatBatch (1.0f) - rightPhaseSlope * turnWidth,
            rightPhaseSlope, -rightPhaseSlope);
        result = xsimd::select (turn, turnValue, result);
    }

    const auto& boundaryWidth = parameters.boundaryWidth;
    const auto local = xsimd::select (phase > FloatBatch (0.5f), phase - FloatBatch (1.0f), phase);
    const auto boundary = xsimd::abs (local) < boundaryWidth;
    if (xsimd::any (boundary))
    {
        const auto boundaryValue = quinticHermite (
            local, -boundaryWidth, boundaryWidth,
            leftPhaseSlope * boundaryWidth, leftPhaseSlope * boundaryWidth,
            -leftPhaseSlope, leftPhaseSlope);
        result = xsimd::select (boundary, boundaryValue, result);
    }
    return wrap01 (result);
}

struct PowerCurveResult
{
    FloatBatch value;
    FloatBatch firstDerivative;
    FloatBatch secondDerivative;
};

struct PowerCurveShape
{
    FloatBatch lowerExponent;
    FloatBatch upperExponent;
    FloatBatch blend;
    FloatBoolBatch segment1;
    FloatBoolBatch segment2;
    FloatBoolBatch segment3;
};

PowerCurveShape preparePowerCurve (const FloatBatch& magnitude) noexcept
{
    const auto scaled = clamp (magnitude, 0.0f, 1.0f) * FloatBatch (4.0f);
    const auto segment = xsimd::min (xsimd::floor (scaled), FloatBatch (3.0f));
    const auto blend = scaled - segment;
    auto lowerExponent = FloatBatch (1.0f);
    auto upperExponent = FloatBatch (2.0f);
    const auto segment1 = segment == FloatBatch (1.0f);
    const auto segment2 = segment == FloatBatch (2.0f);
    const auto segment3 = segment == FloatBatch (3.0f);
    lowerExponent = xsimd::select (segment1, FloatBatch (2.0f), lowerExponent);
    upperExponent = xsimd::select (segment1, FloatBatch (4.0f), upperExponent);
    lowerExponent = xsimd::select (segment2, FloatBatch (4.0f), lowerExponent);
    upperExponent = xsimd::select (segment2, FloatBatch (8.0f), upperExponent);
    lowerExponent = xsimd::select (segment3, FloatBatch (8.0f), lowerExponent);
    upperExponent = xsimd::select (segment3, FloatBatch (16.0f), upperExponent);
    return { lowerExponent, upperExponent, blend, segment1, segment2, segment3 };
}

struct PowerCurvePowers
{
    FloatBatch lower;
    FloatBatch upper;
};

PowerCurvePowers selectPowerCurvePowers (const FloatBatch& phase,
                                        const PowerCurveShape& shape) noexcept
{
    const auto x = clamp (phase, 0.0f, 1.0f);
    const auto x2 = x * x;
    const auto x4 = x2 * x2;
    const auto x8 = x4 * x4;
    const auto x16 = x8 * x8;
    auto lower = xsimd::select (shape.segment1, x2, x);
    auto upper = xsimd::select (shape.segment1, x4, x2);
    lower = xsimd::select (shape.segment2, x4, lower);
    upper = xsimd::select (shape.segment2, x8, upper);
    lower = xsimd::select (shape.segment3, x8, lower);
    upper = xsimd::select (shape.segment3, x16, upper);
    return { lower, upper };
}

FloatBatch powerCurveValue (const FloatBatch& phase, const PowerCurveShape& shape) noexcept
{
    const auto powers = selectPowerCurvePowers (phase, shape);
    return powers.lower + (powers.upper - powers.lower) * shape.blend;
}

PowerCurveResult powerCurve (const FloatBatch& phase, const PowerCurveShape& shape) noexcept
{
    const auto x = clamp (phase, 0.0f, 1.0f);
    const auto powers = selectPowerCurvePowers (x, shape);
    const auto safeX = xsimd::max (x, FloatBatch (1.0e-12f));
    const auto& lowerPower = powers.lower;
    const auto& upperPower = powers.upper;
    const auto& lowerExponent = shape.lowerExponent;
    const auto& upperExponent = shape.upperExponent;
    const auto& blend = shape.blend;
    const auto lowerFirst = lowerExponent * lowerPower / safeX;
    const auto upperFirst = upperExponent * upperPower / safeX;
    const auto lowerSecond = lowerExponent * (lowerExponent - FloatBatch (1.0f))
                           * lowerPower / (safeX * safeX);
    const auto upperSecond = upperExponent * (upperExponent - FloatBatch (1.0f))
                           * upperPower / (safeX * safeX);
    return {
        lowerPower + (upperPower - lowerPower) * blend,
        lowerFirst + (upperFirst - lowerFirst) * blend,
        lowerSecond + (upperSecond - lowerSecond) * blend
    };
}

FloatBatch signedCurve (const FloatBatch& phase,
                        const PowerCurveShape& shape,
                        const FloatBoolBatch& isPositive) noexcept
{
    const auto lookupPhase = xsimd::select (isPositive, phase, FloatBatch (1.0f) - phase);
    const auto curve = powerCurveValue (lookupPhase, shape);
    return xsimd::select (isPositive, curve, FloatBatch (1.0f) - curve);
}

struct QuinticCoefficients
{
    FloatBatch x0;
    FloatBatch inverseWidth;
    FloatBatch c0;
    FloatBatch c1;
    FloatBatch c2;
    FloatBatch c3;
    FloatBatch c4;
    FloatBatch c5;
};

QuinticCoefficients makeQuintic (const FloatBatch& x0,
                                 const FloatBatch& x1,
                                 const FloatBatch& y0,
                                 const FloatBatch& y1,
                                 const FloatBatch& d0,
                                 const FloatBatch& d1,
                                 const FloatBatch& dd0,
                                 const FloatBatch& dd1) noexcept
{
    const auto width = x1 - x0;
    const auto delta = y1 - y0;
    const auto d0s = d0 * width;
    const auto d1s = d1 * width;
    const auto dd0s = dd0 * width * width;
    const auto dd1s = dd1 * width * width;
    return {
        x0,
        FloatBatch (1.0f) / width,
        y0,
        d0s,
        FloatBatch (0.5f) * dd0s,
        FloatBatch (10.0f) * delta - FloatBatch (6.0f) * d0s
            - FloatBatch (4.0f) * d1s - FloatBatch (1.5f) * dd0s
            + FloatBatch (0.5f) * dd1s,
        FloatBatch (-15.0f) * delta + FloatBatch (8.0f) * d0s
            + FloatBatch (7.0f) * d1s + FloatBatch (1.5f) * dd0s - dd1s,
        FloatBatch (6.0f) * delta - FloatBatch (3.0f) * d0s
            - FloatBatch (3.0f) * d1s - FloatBatch (0.5f) * dd0s
            + FloatBatch (0.5f) * dd1s
    };
}

FloatBatch evaluateQuintic (const QuinticCoefficients& coefficients,
                            const FloatBatch& x) noexcept
{
    const auto u = (x - coefficients.x0) * coefficients.inverseWidth;
    return coefficients.c0 + u * (coefficients.c1
        + u * (coefficients.c2 + u * (coefficients.c3
        + u * (coefficients.c4 + u * coefficients.c5))));
}

struct BendParameters
{
    FloatBatch signedAmount;
    FloatBoolBatch isPositive;
    PowerCurveShape curveShape;
    bool extreme;
    FloatBatch width;
    QuinticCoefficients centre;
    QuinticCoefficients boundary;
};

FloatBatch powerCurve16Value (const FloatBatch& phase) noexcept
{
    const auto x = clamp (phase, 0.0f, 1.0f);
    const auto x2 = x * x;
    const auto x4 = x2 * x2;
    const auto x8 = x4 * x4;
    return x8 * x8;
}

PowerCurveResult powerCurve16 (const FloatBatch& phase) noexcept
{
    const auto x = clamp (phase, 0.0f, 1.0f);
    const auto x2 = x * x;
    const auto x4 = x2 * x2;
    const auto x8 = x4 * x4;
    const auto x16 = x8 * x8;
    const auto safeX = xsimd::max (x, FloatBatch (1.0e-12f));
    return {
        x16,
        FloatBatch (16.0f) * x16 / safeX,
        FloatBatch (240.0f) * x16 / (safeX * safeX)
    };
}

BendParameters prepareBend (const FloatBatch& amount,
                            const FloatBatch& halfWidth) noexcept
{
    const auto signedAmount = FloatBatch (2.0f) * (FloatBatch (1.0f) - amount) - FloatBatch (1.0f);
    const auto magnitude = xsimd::abs (signedAmount);
    const auto isPositive = signedAmount >= FloatBatch (0.0f);
    const auto extreme = xsimd::all (magnitude == FloatBatch (1.0f));
    const auto curveShape = extreme
        ? PowerCurveShape {
            FloatBatch (8.0f), FloatBatch (16.0f), FloatBatch (1.0f),
            FloatBoolBatch (false), FloatBoolBatch (false), FloatBoolBatch (true)
        }
        : preparePowerCurve (magnitude);
    const auto width = xsimd::min (halfWidth, FloatBatch (0.24f));
    const auto positiveBase = FloatBatch (1.0f) - FloatBatch (2.0f) * width;
    const auto edge = extreme ? powerCurve16 (positiveBase)
                              : powerCurve (positiveBase, curveShape);
    const auto positiveY0 = FloatBatch (0.5f) * edge.value;
    const auto positiveD = edge.firstDerivative;
    const auto positiveDd = FloatBatch (2.0f) * edge.secondDerivative;
    const auto negativeCurve = FloatBatch (1.0f) - edge.value;
    const auto negativeY0 = FloatBatch (1.0f) - FloatBatch (0.5f) * negativeCurve;
    const auto negativeY1 = FloatBatch (1.0f) + FloatBatch (0.5f) * negativeCurve;
    return {
        signedAmount,
        isPositive,
        curveShape,
        extreme,
        width,
        makeQuintic (FloatBatch (0.5f) - width, FloatBatch (0.5f) + width,
                      positiveY0, FloatBatch (1.0f) - positiveY0,
                      positiveD, positiveD, positiveDd, -positiveDd),
        makeQuintic (-width, width, negativeY0, negativeY1,
                      edge.firstDerivative, edge.firstDerivative,
                      positiveDd, -positiveDd)
    };
}

FloatBatch smoothBend (const FloatBatch& phase,
                       const BendParameters& parameters) noexcept
{
    const auto& signedAmount = parameters.signedAmount;
    const auto isLeft = phase < FloatBatch (0.5f);
    const auto curvePhase = xsimd::select (isLeft,
                                          FloatBatch (2.0f) * phase,
                                          FloatBatch (2.0f) - FloatBatch (2.0f) * phase);
    const auto curve = parameters.extreme
        ? (xsimd::all (parameters.isPositive)
            ? powerCurve16Value (curvePhase)
            : (! xsimd::any (parameters.isPositive)
                ? FloatBatch (1.0f)
                    - powerCurve16Value (FloatBatch (1.0f) - curvePhase)
                : xsimd::select (
                    parameters.isPositive,
                    powerCurve16Value (curvePhase),
                    FloatBatch (1.0f)
                        - powerCurve16Value (FloatBatch (1.0f) - curvePhase))))
        : signedCurve (curvePhase, parameters.curveShape, parameters.isPositive);
    auto result = xsimd::select (isLeft,
                                 FloatBatch (0.5f) * curve,
                                 FloatBatch (1.0f) - FloatBatch (0.5f) * curve);
    const auto centre = xsimd::abs (phase - FloatBatch (0.5f)) < parameters.width;
    const auto activeCentre = (signedAmount >= FloatBatch (0.0f)) & centre;
    if (xsimd::any (activeCentre))
    {
        const auto centreValue = evaluateQuintic (parameters.centre, phase);
        result = xsimd::select (activeCentre, centreValue, result);
    }

    const auto local = xsimd::select (phase > FloatBatch (0.5f), phase - FloatBatch (1.0f), phase);
    const auto boundary = xsimd::abs (local) < parameters.width;
    const auto activeBoundary = (signedAmount < FloatBatch (0.0f)) & boundary;
    if (xsimd::any (activeBoundary))
    {
        const auto boundaryValue = evaluateQuintic (parameters.boundary, local);
        result = xsimd::select (activeBoundary, wrap01 (boundaryValue), result);
    }
    return wrap01 (result);
}

FloatBatch smoothBendDirect (const FloatBatch& phase,
                             const FloatBatch& amount,
                             const FloatBatch& halfWidth) noexcept
{
    const auto signedAmount = FloatBatch (2.0f) * (FloatBatch (1.0f) - amount)
                            - FloatBatch (1.0f);
    const auto magnitude = xsimd::abs (signedAmount);
    const auto isPositive = signedAmount >= FloatBatch (0.0f);
    const auto isLeft = phase < FloatBatch (0.5f);
    const auto curvePhase = xsimd::select (
        isLeft, FloatBatch (2.0f) * phase,
        FloatBatch (2.0f) - FloatBatch (2.0f) * phase);
    const auto extreme = xsimd::all (magnitude == FloatBatch (1.0f));
    const auto curve = extreme
        ? (xsimd::all (isPositive)
            ? powerCurve16Value (curvePhase)
            : (! xsimd::any (isPositive)
                ? FloatBatch (1.0f)
                    - powerCurve16Value (FloatBatch (1.0f) - curvePhase)
                : xsimd::select (
                    isPositive,
                    powerCurve16Value (curvePhase),
                    FloatBatch (1.0f)
                        - powerCurve16Value (FloatBatch (1.0f) - curvePhase))))
        : signedCurve (curvePhase, preparePowerCurve (magnitude), isPositive);
    auto result = xsimd::select (
        isLeft, FloatBatch (0.5f) * curve,
        FloatBatch (1.0f) - FloatBatch (0.5f) * curve);

    const auto width = xsimd::min (halfWidth, FloatBatch (0.24f));
    const auto centre = xsimd::abs (phase - FloatBatch (0.5f)) < width;
    const auto local = xsimd::select (
        phase > FloatBatch (0.5f), phase - FloatBatch (1.0f), phase);
    const auto boundary = xsimd::abs (local) < width;
    if (xsimd::any ((isPositive & centre) | ((! isPositive) & boundary)))
        return smoothBend (phase, prepareBend (amount, halfWidth));
    return wrap01 (result);
}

FloatBatch maximumDerivative (WarpMode mode, const FloatBatch& rawAmount) noexcept
{
    const auto amount = clamp (rawAmount, 0.0f, 1.0f);
    if (mode == WarpMode::bend)
    {
        const auto scaled = FloatBatch (4.0f)
                          * xsimd::abs (FloatBatch (2.0f)
                                       * (FloatBatch (1.0f) - amount) - FloatBatch (1.0f));
        return xsimd::select (
            scaled < FloatBatch (1.0f), FloatBatch (1.0f) + scaled,
            xsimd::select (
                scaled < FloatBatch (2.0f), FloatBatch (2.0f) * scaled,
                xsimd::select (
                    scaled < FloatBatch (3.0f), FloatBatch (4.0f) * scaled - FloatBatch (4.0f),
                    FloatBatch (8.0f) * scaled - FloatBatch (16.0f))));
    }
    if (mode == WarpMode::pwm)
        return FloatBatch (1.0f) / (FloatBatch (1.0f) - FloatBatch (0.98f) * amount);
    if (mode == WarpMode::asym || mode == WarpMode::mirror)
    {
        const auto split = clamp (FloatBatch (0.5f) + FloatBatch (0.48f)
                                  * ((FloatBatch (2.0f) * amount) - FloatBatch (1.0f)),
                                  0.02f, 0.98f);
        const auto derivative = xsimd::max (FloatBatch (0.5f) / split,
                                            FloatBatch (0.5f) / (FloatBatch (1.0f) - split));
        return mode == WarpMode::mirror ? FloatBatch (2.0f) * derivative : derivative;
    }
    return FloatBatch (1.0f);
}

FloatBatch sourceHarmonicBudget (WarpMode mode,
                                 const FloatBatch& amount,
                                 const FloatBatch& phaseIncrement,
                                 std::int32_t oversampleFactor) noexcept
{
    const auto safeIncrement = xsimd::max (phaseIncrement, FloatBatch (1.0e-20f));
    const auto budget = FloatBatch (0.4f * static_cast<float> (oversampleFactor))
                      / (safeIncrement * maximumDerivative (mode, amount));
    return xsimd::select (
        phaseIncrement <= FloatBatch (0.0f),
        FloatBatch (static_cast<float> (std::size_t { 1 } << (mipLevelCount - 1))),
        budget);
}

std::int32_t selectSourceMip (float budget) noexcept
{
    auto harmonics = std::max (1, static_cast<std::int32_t> (std::floor (budget)));
    auto mip = std::int32_t { 0 };
    while (harmonics > 1 && mip + 1 < static_cast<std::int32_t> (mipLevelCount))
    {
        harmonics >>= 1;
        ++mip;
    }
    return mip;
}

float smoothStep01 (float value) noexcept
{
    value = std::clamp (value, 0.0f, 1.0f);
    return value * value * (3.0f - 2.0f * value);
}

struct SourcePointBatch
{
    FloatBatch value;
    FloatBatch derivative;
};

SourcePointBatch unpackSourcePoints (const IntBatch& packed,
                                     float valueScale,
                                     float derivativeScale) noexcept
{
    const auto low = (packed << sourceDerivativeBits) >> sourceDerivativeBits;
    const auto high = packed >> sourceValueBits;
    return {
        xsimd::to_float (low) * FloatBatch (valueScale),
        xsimd::to_float (high) * FloatBatch (derivativeScale)
    };
}

FloatBatch evaluateSourceHermite (const SourcePointBatch& current,
                                  const SourcePointBatch& next,
                                  const FloatBatch& fractional) noexcept
{
    const auto u2 = fractional * fractional;
    const auto u3 = u2 * fractional;
    return (FloatBatch (2.0f) * u3 - FloatBatch (3.0f) * u2 + FloatBatch (1.0f))
             * current.value
         + (u3 - FloatBatch (2.0f) * u2 + fractional) * current.derivative
         + (FloatBatch (-2.0f) * u3 + FloatBatch (3.0f) * u2) * next.value
         + (u3 - u2) * next.derivative;
}

struct AtlasPointBatch
{
    FloatBatch value;
    FloatBatch derivative;
};

struct AtlasHermiteWeights
{
    FloatBatch h00;
    FloatBatch h10;
    FloatBatch h01;
    FloatBatch h11;
};

AtlasPointBatch unpackAtlasPoints (const IntBatch& packed) noexcept
{
    const auto low = (packed << 16) >> 16;
    const auto high = packed >> 16;
    return {
        xsimd::to_float (low) * FloatBatch (atlasQuantisationScale),
        xsimd::to_float (high) * FloatBatch (atlasDerivativeQuantisationScale)
    };
}

AtlasPointBatch readPackedAtlasPoint (const std::int32_t* samples,
                                      const IntBatch& indices) noexcept
{
    return unpackAtlasPoints (IntBatch::gather (samples, indices));
}

AtlasHermiteWeights makeAtlasHermiteWeights (const FloatBatch& fractional) noexcept
{
    const auto u2 = fractional * fractional;
    const auto u3 = u2 * fractional;
    return {
        FloatBatch (2.0f) * u3 - FloatBatch (3.0f) * u2 + FloatBatch (1.0f),
        u3 - FloatBatch (2.0f) * u2 + fractional,
        FloatBatch (-2.0f) * u3 + FloatBatch (3.0f) * u2,
        u3 - u2
    };
}

FloatBatch evaluateAtlasHermite (const AtlasPointBatch& current,
                                 const AtlasPointBatch& next,
                                 const AtlasHermiteWeights& weights) noexcept
{
    return weights.h00 * current.value + weights.h10 * current.derivative
         + weights.h01 * next.value + weights.h11 * next.derivative;
}

FloatBatch readPackedBendBasis (const std::int32_t* samples,
                                std::int32_t tableBase0,
                                std::int32_t tableBase1,
                                std::int32_t sampleIndex,
                                float amountWeight0,
                                float amountWeight1,
                                float fractional) noexcept
{
    constexpr auto interleavedBasisCount = std::int32_t { 4 };
    const auto index0 = tableBase0 + sampleIndex * interleavedBasisCount;
    const auto index1 = tableBase1 + sampleIndex * interleavedBasisCount;
    const auto current0 = unpackAtlasPoints (IntBatch::load_unaligned (samples + index0));
    const auto current1 = unpackAtlasPoints (IntBatch::load_unaligned (samples + index1));
    const auto next0 = unpackAtlasPoints (
        IntBatch::load_unaligned (samples + index0 + interleavedBasisCount));
    const auto next1 = unpackAtlasPoints (
        IntBatch::load_unaligned (samples + index1 + interleavedBasisCount));
    const auto weight0 = FloatBatch (amountWeight0);
    const auto weight1 = FloatBatch (amountWeight1);
    return evaluateAtlasHermite (
        {
            current0.value * weight0 + current1.value * weight1,
            current0.derivative * weight0 + current1.derivative * weight1
        },
        {
            next0.value * weight0 + next1.value * weight1,
            next0.derivative * weight0 + next1.derivative * weight1
        },
        makeAtlasHermiteWeights (FloatBatch (fractional)));
}

FloatBatch readPackedBendBasisSingle (const std::int32_t* samples,
                                      std::int32_t tableBase,
                                      std::int32_t sampleIndex,
                                      float fractional) noexcept
{
    constexpr auto interleavedBasisCount = std::int32_t { 4 };
    const auto index = tableBase + sampleIndex * interleavedBasisCount;
    return evaluateAtlasHermite (
        unpackAtlasPoints (IntBatch::load_unaligned (samples + index)),
        unpackAtlasPoints (IntBatch::load_unaligned (
            samples + index + interleavedBasisCount)),
        makeAtlasHermiteWeights (FloatBatch (fractional)));
}

#if XSIMD_WITH_WASM
struct BendBasisPoints
{
    AtlasPointBatch current;
    AtlasPointBatch next;
};

BendBasisPoints readPackedBendPoints (const std::int32_t* samples,
                                      std::int32_t tableBase0,
                                      std::int32_t tableBase1,
                                      std::int32_t sampleIndex,
                                      float amountWeight0,
                                      float amountWeight1) noexcept
{
    constexpr auto interleavedBasisCount = std::int32_t { 4 };
    const auto index0 = tableBase0 + sampleIndex * interleavedBasisCount;
    if (amountWeight1 == 0.0f)
        return {
            unpackAtlasPoints (IntBatch::load_unaligned (samples + index0)),
            unpackAtlasPoints (IntBatch::load_unaligned (
                samples + index0 + interleavedBasisCount))
        };

    const auto index1 = tableBase1 + sampleIndex * interleavedBasisCount;
    if (amountWeight0 == 0.0f)
        return {
            unpackAtlasPoints (IntBatch::load_unaligned (samples + index1)),
            unpackAtlasPoints (IntBatch::load_unaligned (
                samples + index1 + interleavedBasisCount))
        };

    const auto current0 = unpackAtlasPoints (IntBatch::load_unaligned (samples + index0));
    const auto current1 = unpackAtlasPoints (IntBatch::load_unaligned (samples + index1));
    const auto next0 = unpackAtlasPoints (
        IntBatch::load_unaligned (samples + index0 + interleavedBasisCount));
    const auto next1 = unpackAtlasPoints (
        IntBatch::load_unaligned (samples + index1 + interleavedBasisCount));
    const auto weight0 = FloatBatch (amountWeight0);
    const auto weight1 = FloatBatch (amountWeight1);
    return {
        {
            current0.value * weight0 + current1.value * weight1,
            current0.derivative * weight0 + current1.derivative * weight1
        },
        {
            next0.value * weight0 + next1.value * weight1,
            next0.derivative * weight0 + next1.derivative * weight1
        }
    };
}
#endif

FloatBatch readPackedAtlasQuadraticAmount (const std::int32_t* samples,
                                           const IntBatch& tableBase0,
                                           const IntBatch& tableBase1,
                                           const IntBatch& tableBase2,
                                           const IntBatch& sampleIndices,
                                           const FloatBatch& weight0,
                                           const FloatBatch& weight1,
                                           const FloatBatch& weight2,
                                           const AtlasHermiteWeights& hermite) noexcept
{
    const auto index0 = tableBase0 + sampleIndices;
    const auto index1 = tableBase1 + sampleIndices;
    const auto index2 = tableBase2 + sampleIndices;
    const auto current0 = readPackedAtlasPoint (samples, index0);
    const auto current1 = readPackedAtlasPoint (samples, index1);
    const auto current2 = readPackedAtlasPoint (samples, index2);
    const auto next0 = readPackedAtlasPoint (samples, index0 + IntBatch (1));
    const auto next1 = readPackedAtlasPoint (samples, index1 + IntBatch (1));
    const auto next2 = readPackedAtlasPoint (samples, index2 + IntBatch (1));
    return evaluateAtlasHermite (
        {
            current0.value * weight0 + current1.value * weight1 + current2.value * weight2,
            current0.derivative * weight0 + current1.derivative * weight1
                + current2.derivative * weight2
        },
        {
            next0.value * weight0 + next1.value * weight1 + next2.value * weight2,
            next0.derivative * weight0 + next1.derivative * weight1
                + next2.derivative * weight2
        },
        hermite);
}

FloatBatch readPackedAtlasSingleAmount (const std::int32_t* samples,
                                        const IntBatch& tableBases,
                                        const IntBatch& sampleIndices,
                                        const AtlasHermiteWeights& hermite) noexcept
{
    const auto indices = tableBases + sampleIndices;
    return evaluateAtlasHermite (
        readPackedAtlasPoint (samples, indices),
        readPackedAtlasPoint (samples, indices + IntBatch (1)),
        hermite);
}

std::int32_t selectAtlasOutputMip (float phaseIncrement,
                                   int mipCount,
                                   std::int32_t oversampleFactor) noexcept
{
    if (phaseIncrement <= 0.0f)
        return mipCount - 1;
    auto harmonics = std::max (1, static_cast<std::int32_t> (
        std::floor (0.45f * static_cast<float> (oversampleFactor)
                    / phaseIncrement)));
    auto mip = std::int32_t { 0 };
    while (harmonics > 1 && mip + 1 < mipCount)
    {
        harmonics >>= 1;
        ++mip;
    }
    return mip;
}

IntBatch gatherSourcePoints (const TablePoolLayout::PackedSourceSlice& source,
                             const IntBatch& indices) noexcept
{
    if (source.samples != nullptr)
        return IntBatch::gather (source.samples, indices);

    alignas (16) std::array<std::int32_t, batchSize> unpackedIndices {};
    alignas (16) std::array<std::int32_t, batchSize> packedPoints {};
    indices.store_aligned (unpackedIndices.data());

    for (std::size_t lane = 0; lane < batchSize; ++lane)
    {
        const auto index = unpackedIndices[lane];
        if (index < 0 || index >= source.size || source.chunkSampleCount <= 0)
            continue;

        const auto chunk = static_cast<std::size_t> (index / source.chunkSampleCount);
        const auto indexWithinChunk = index % source.chunkSampleCount;
        if (chunk >= source.chunkSamples.size()
            || source.chunkSamples[chunk] == nullptr
            || indexWithinChunk >= source.chunkSizes[chunk])
            continue;

        packedPoints[lane] = source.chunkSamples[chunk][indexWithinChunk];
    }

    return IntBatch::load_aligned (packedPoints.data());
}

FloatBatch readFrames (const TablePoolLayout::PackedSourceSlice& source,
                       const FloatBatch& phase,
                       const IntBatch& lengths,
                       const IntBatch& lowerBases,
                       const IntBatch& upperBases,
                       const FloatBatch& frameBlend,
                       float valueScale,
                       float derivativeScale) noexcept
{
    const auto x = phase * xsimd::to_float (lengths);
    const auto floored = xsimd::floor (x);
    const auto sampleIndex = xsimd::to_int (floored);
    const auto fractional = x - floored;
    const auto lowerIndex = lowerBases + sampleIndex;
    const auto upperIndex = upperBases + sampleIndex;
    const auto lower = evaluateSourceHermite (
        unpackSourcePoints (gatherSourcePoints (source, lowerIndex), valueScale, derivativeScale),
        unpackSourcePoints (gatherSourcePoints (source, lowerIndex + IntBatch (1)),
                            valueScale, derivativeScale),
        fractional);
    const auto upper = evaluateSourceHermite (
        unpackSourcePoints (gatherSourcePoints (source, upperIndex), valueScale, derivativeScale),
        unpackSourcePoints (gatherSourcePoints (source, upperIndex + IntBatch (1)),
                            valueScale, derivativeScale),
        fractional);
    return lower + (upper - lower) * frameBlend;
}

template <std::size_t TapCount, std::size_t ReversedCount>
float convolveWarpFilter (const float* history,
                          std::int32_t writeIndex,
                          const std::array<float, TapCount>& tapValues,
                          const std::array<float, ReversedCount>& reversedNearValues) noexcept
{
    constexpr auto pairCount = TapCount - 1;
    auto latest = writeIndex - 1;
    if (latest < 0)
        latest += static_cast<std::int32_t> (secondHalfbandLength);
    latest += static_cast<std::int32_t> (secondHalfbandLength);
    FloatBatch sum0 (0.0f);
    FloatBatch sum1 (0.0f);
    for (std::size_t tap = 0; tap + batchSize <= reversedNearValues.size(); tap += batchSize)
    {
        const auto near = FloatBatch::load_unaligned (
            history + latest - static_cast<std::int32_t> (tap + batchSize - 1));
        const auto far = FloatBatch::load_unaligned (
            history + latest - static_cast<std::int32_t> (2 * pairCount) + tap);
        const auto product = near * FloatBatch::load_unaligned (reversedNearValues.data() + tap)
                           + far * FloatBatch::load_unaligned (tapValues.data() + tap);
        if ((tap / batchSize) % 2 == 0)
            sum0 += product;
        else
            sum1 += product;
    }
    auto scalarSum = xsimd::reduce_add (sum0 + sum1);
    for (std::size_t tap = ReversedCount; tap < pairCount; ++tap)
        scalarSum += tapValues[tap]
                   * (history[latest - static_cast<std::int32_t> (tap)]
                      + history[latest - static_cast<std::int32_t> (2 * pairCount - tap)]);
    return scalarSum + tapValues.back()
         * history[latest - static_cast<std::int32_t> (pairCount)];
}

float filterWarpOutput (const float* history,
                        std::int32_t writeIndex,
                        bool use441Filter) noexcept
{
    return use441Filter
        ? convolveWarpFilter (history, writeIndex, lowRateTapValues,
                              lowReversedNearTapValues)
        : convolveWarpFilter (history, writeIndex, standardRateTapValues,
                              standardReversedNearTapValues);
}

void pushStereo (float* history,
                 std::size_t length,
                 std::int32_t& writeIndex,
                 StereoSample value) noexcept
{
    const auto index = static_cast<std::size_t> (writeIndex);
    history[index] = value.left;
    history[length + index] = value.left;
    history[2 * length + index] = value.right;
    history[3 * length + index] = value.right;
    ++writeIndex;
    if (writeIndex >= static_cast<std::int32_t> (length))
        writeIndex = 0;
}

template <std::size_t TapCount>
FloatBatch convolveNoteBatch (const float* history,
                              std::int32_t writeIndex,
                              std::size_t noteOffset,
                              const std::array<float, TapCount>& tapValues) noexcept
{
    constexpr auto pairCount = TapCount - 1;
    auto latest = writeIndex - 1;
    if (latest < 0)
        latest += static_cast<std::int32_t> (secondHalfbandLength);
    latest += static_cast<std::int32_t> (secondHalfbandLength);
    FloatBatch sum0 (0.0f);
    FloatBatch sum1 (0.0f);
    for (std::size_t tap = 0; tap < pairCount; ++tap)
    {
        const auto near = FloatBatch::load_unaligned (
            history + (latest - static_cast<std::int32_t> (tap)) * logicalNoteCount
                    + noteOffset);
        const auto far = FloatBatch::load_unaligned (
            history + (latest - static_cast<std::int32_t> (2 * pairCount - tap))
                    * logicalNoteCount + noteOffset);
        const auto product = (near + far) * FloatBatch (tapValues[tap]);
        if ((tap & 1U) == 0U)
            sum0 += product;
        else
            sum1 += product;
    }
    return sum0 + sum1 + FloatBatch (tapValues.back())
         * FloatBatch::load_unaligned (
             history + (latest - static_cast<std::int32_t> (pairCount))
                     * logicalNoteCount + noteOffset);
}

FloatBatch filterNoteBatch (const float* history,
                            std::int32_t writeIndex,
                            std::size_t noteOffset,
                            bool use441Filter) noexcept
{
    return use441Filter
        ? convolveNoteBatch (history, writeIndex, noteOffset, lowRateTapValues)
        : convolveNoteBatch (history, writeIndex, noteOffset, standardRateTapValues);
}
}

std::int32_t packSourcePoint (float value,
                              float derivative,
                              float valueRange,
                              float derivativeRange) noexcept
{
    const auto quantise = [] (float input, float scale, std::int32_t maximum)
    {
        return std::clamp (static_cast<std::int32_t> (std::lround (input / scale)),
                           -maximum, maximum);
    };
    const auto packedValue = static_cast<std::uint32_t> (
        quantise (value, valueRange / static_cast<float> (sourceValueMaximum),
                  sourceValueMaximum)) & sourceValueMask;
    const auto packedDerivative = static_cast<std::uint32_t> (
        quantise (derivative, derivativeRange / static_cast<float> (sourceDerivativeMaximum),
                  sourceDerivativeMaximum));
    const auto bits = packedValue | (packedDerivative << sourceValueBits);
    std::int32_t packed = 0;
    std::memcpy (&packed, &bits, sizeof (packed));
    return packed;
}

void resetWarpRenderer (WarpRendererState& state, float phase) noexcept
{
    phase -= std::floor (phase);
    state = {};
    state.phases.fill (phase);
    state.atlasFamilyTargets.fill (-1);
    state.cachedAtlasModes.fill (-1);
}

WarpRendererStateView view (WarpRendererState& state) noexcept
{
    return { state.phases.data(), state.secondHistory.data(), state.atlasFamilyMix.data(),
             state.cachedAtlasPhaseIncrements.data(),
             state.cachedAtlasWarpAmounts.data(),
             state.atlasAmountWeights0.data(), state.atlasAmountWeights1.data(),
             state.atlasAmountWeights2.data(), state.secondWriteIndices.data(),
             state.atlasFamilyTargets.data(), state.cachedAtlasModes.data(),
             state.atlasLengths.data(), state.atlasAmountBases0.data(),
             state.atlasAmountBases1.data(), state.atlasAmountBases2.data() };
}

WarpRendererControlsView view (const WarpRendererControls& controls) noexcept
{
    return { controls.phaseIncrements.data(), controls.positions.data(),
             controls.warpAmounts.data(), controls.leftGains.data(),
             controls.rightGains.data(), controls.warpModes.data(),
             controls.oversampleFactor, controls.use441Filter };
}

TablePoolView view (const TablePoolLayout& tables) noexcept
{
    return { tables.slots.data(), tables.mipOffsets.data(), tables.mipLengths.data(),
             tables.frameCounts.data(), tables.oscillatorSlots.data() };
}

void expandVoiceOscillatorControls (VoiceOscillatorControlsView controls,
                                    WarpRendererControlsWorkspaceView workspace) noexcept
{
    if (controls.basePhaseIncrements == nullptr || controls.positions == nullptr
        || controls.warpAmounts == nullptr || controls.pans == nullptr
        || controls.gains == nullptr || controls.detunes == nullptr
        || controls.blends == nullptr || controls.widths == nullptr
        || controls.positionSpreads == nullptr || controls.warpSpreads == nullptr
        || controls.unisonVoices == nullptr || controls.detuneModes == nullptr
        || controls.stackModes == nullptr || workspace.phaseIncrements == nullptr
        || workspace.positions == nullptr || workspace.warpAmounts == nullptr
        || workspace.leftGains == nullptr || workspace.rightGains == nullptr)
        return;

    constexpr auto voiceOscillatorCount = logicalNoteCount * oscillatorCount;
    for (std::size_t voiceOscillator = 0; voiceOscillator < voiceOscillatorCount;
         ++voiceOscillator)
    {
        // A quiescent voice-oscillator (the engine clears its base increment
        // and gain when the voice retires) expands to exact zeros: active is
        // 0 on every lane, so amplitude and phase increment are +0 and the
        // remaining lanes are never read while the note stays inactive.
        // Write those zeros once - lane 0's phase increment is the sentinel,
        // since an expanded active voice-oscillator always leaves it > 0 -
        // and skip the unison math entirely afterwards.
        if (controls.basePhaseIncrements[voiceOscillator] <= 0.0f)
        {
            const auto quietLane = voiceOscillator * maximumUnisonCount;
            if (workspace.phaseIncrements[quietLane] != 0.0f)
            {
                const FloatBatch zero (0.0f);
                for (std::size_t firstSubVoice = 0; firstSubVoice < maximumUnisonCount;
                     firstSubVoice += batchSize)
                {
                    zero.store_unaligned (workspace.phaseIncrements + quietLane + firstSubVoice);
                    zero.store_unaligned (workspace.positions + quietLane + firstSubVoice);
                    zero.store_unaligned (workspace.warpAmounts + quietLane + firstSubVoice);
                    zero.store_unaligned (workspace.leftGains + quietLane + firstSubVoice);
                    zero.store_unaligned (workspace.rightGains + quietLane + firstSubVoice);
                }
            }
            continue;
        }

        const auto voices = static_cast<std::size_t> (std::clamp (
            controls.unisonVoices[voiceOscillator], 1,
            static_cast<std::int32_t> (maximumUnisonCount)));
        const auto detuneMode = static_cast<std::size_t> (
            std::clamp (controls.detuneModes[voiceOscillator], 0, 4));
        const auto stackMode = static_cast<std::size_t> (
            std::clamp (controls.stackModes[voiceOscillator], 0, 4));
        const auto blend = std::clamp (controls.blends[voiceOscillator], 0.0f, 1.0f);
        const auto gain = std::max (0.0f, controls.gains[voiceOscillator]);
        const auto weightSum = unisonLookupTables.weightBaseSums[voices]
                             + blend * unisonLookupTables.weightSideSums[voices];
        const auto gainScale = weightSum > 0.0f ? gain / weightSum : 0.0f;
        const auto firstLane = voiceOscillator * maximumUnisonCount;

        for (std::size_t firstSubVoice = 0; firstSubVoice < maximumUnisonCount;
             firstSubVoice += batchSize)
        {
            const auto lane = firstLane + firstSubVoice;
            const auto spread = FloatBatch::load_unaligned (
                unisonLookupTables.spreads[voices][detuneMode] + firstSubVoice);
            const auto stack = FloatBatch::load_unaligned (
                unisonLookupTables.stackSemitones[voices][stackMode] + firstSubVoice);
            const auto side = FloatBatch::load_unaligned (
                unisonLookupTables.sideAmounts[voices] + firstSubVoice);
            alignas (16) float activeValues[batchSize];
            for (std::size_t subLane = 0; subLane < batchSize; ++subLane)
                // Level, mute and solo control gain without freezing oscillator time.
                activeValues[subLane]
                    = controls.basePhaseIncrements[voiceOscillator] > 0.0f
                        && firstSubVoice + subLane < voices ? 1.0f : 0.0f;
            const auto active = FloatBatch::load_aligned (activeValues);

            const auto pitchOffset = spread
                * FloatBatch (std::clamp (controls.detunes[voiceOscillator], 0.0f, 1.0f)
                              * 0.5f)
                + stack;
            const auto phaseIncrement = FloatBatch (
                std::max (0.0f, controls.basePhaseIncrements[voiceOscillator]))
                * unisonPitchRatio (pitchOffset * FloatBatch (1.0f / 12.0f)) * active;
            const auto position = clamp (
                FloatBatch (controls.positions[voiceOscillator])
                    + spread * FloatBatch (
                        std::clamp (controls.positionSpreads[voiceOscillator], 0.0f, 1.0f)
                        * 0.5f),
                0.0f, 1.0f);
            const auto warpAmount = clamp (
                FloatBatch (controls.warpAmounts[voiceOscillator])
                    + spread * FloatBatch (
                        std::clamp (controls.warpSpreads[voiceOscillator], 0.0f, 1.0f)
                        * 0.5f),
                0.0f, 1.0f);
            const auto pan = clamp (
                FloatBatch (controls.pans[voiceOscillator])
                    + spread * FloatBatch (
                        std::clamp (controls.widths[voiceOscillator], 0.0f, 1.0f)),
                -1.0f, 1.0f);
            const auto amplitude = (FloatBatch (1.0f) - side + FloatBatch (blend) * side)
                * FloatBatch (gainScale) * active;
            const auto panGains = xsimd::sincos (
                (pan + FloatBatch (1.0f)) * FloatBatch (0.25f * piValue));

            phaseIncrement.store_unaligned (workspace.phaseIncrements + lane);
            position.store_unaligned (workspace.positions + lane);
            warpAmount.store_unaligned (workspace.warpAmounts + lane);
            (amplitude * panGains.second).store_unaligned (workspace.leftGains + lane);
            (amplitude * panGains.first).store_unaligned (workspace.rightGains + lane);
        }
    }
}

static StereoSample renderWarpedNoteInternal (
                               WarpRendererStateView state,
                               WarpRendererControlsView controls,
                               TablePoolView tables,
                               PackedWarpAtlasView atlas,
                               const float* atlasDc,
                               const std::array<const float*, 4>& atlasBasisWeights,
                               std::size_t noteIndex,
                               StereoSample* unfilteredSamples) noexcept
{
    if (state.phases == nullptr || state.secondHistory == nullptr
        || state.atlasFamilyMix == nullptr || state.secondWriteIndices == nullptr
        || state.atlasFamilyTargets == nullptr
        || state.cachedAtlasPhaseIncrements == nullptr
        || state.cachedAtlasWarpAmounts == nullptr
        || state.atlasAmountWeights0 == nullptr || state.atlasAmountWeights1 == nullptr
        || state.atlasAmountWeights2 == nullptr || state.cachedAtlasModes == nullptr
        || state.atlasLengths == nullptr || state.atlasAmountBases0 == nullptr
        || state.atlasAmountBases1 == nullptr || state.atlasAmountBases2 == nullptr
        || controls.phaseIncrements == nullptr
        || controls.positions == nullptr || controls.warpAmounts == nullptr
        || controls.leftGains == nullptr || controls.rightGains == nullptr
        || controls.warpModes == nullptr || tables.slots == nullptr
        || tables.mipOffsets == nullptr || tables.mipLengths == nullptr
        || tables.frameCounts == nullptr || tables.oscillatorSlots == nullptr
        || noteIndex >= logicalNoteCount)
        return {};

    const auto firstLane = noteIndex * lanesPerNote;
    const auto firstMode = noteIndex * oscillatorCount;
    const auto oversampleFactor = controls.oversampleFactor <= 1
        ? std::int32_t { 1 } : maximumWarpOversampleFactor;
    std::array<std::int32_t, lanesPerNote> lengths;
    std::array<std::int32_t, lanesPerNote> lowerBases;
    std::array<std::int32_t, lanesPerNote> upperBases;
    std::array<float, lanesPerNote> frameBlends;
    std::array<bool, lanesPerNote / batchSize> renderAtlas;
    std::array<bool, lanesPerNote / batchSize> renderGeneral;
    std::array<float, lanesPerNote / batchSize> atlasFamilyWeights;
    std::array<float, lanesPerNote> sourceBudgets;
    const auto atlasIsAvailable = atlas.samples != nullptr
                               && atlas.packedSampleCount >= atlasPackedSampleCount
                               && atlasDc != nullptr
                               && atlasBasisWeights[0] != nullptr
                               && atlasBasisWeights[1] != nullptr;

    constexpr auto batchesPerNote = lanesPerNote / batchSize;
    constexpr auto familyTransitionFrames = 64.0f;
    const auto firstFamilyBatch = noteIndex * batchesPerNote;
    for (std::size_t laneOffset = 0; laneOffset < lanesPerNote; laneOffset += batchSize)
    {
        const auto oscillator = laneOffset / maximumUnisonCount;
        const auto mode = static_cast<WarpMode> (controls.warpModes[firstMode + oscillator]);
        const auto lane = firstLane + laneOffset;
        sourceHarmonicBudget (
            mode,
            FloatBatch::load_unaligned (controls.warpAmounts + lane),
            FloatBatch::load_unaligned (controls.phaseIncrements + lane),
            oversampleFactor).store_unaligned (sourceBudgets.data() + laneOffset);
    }
    for (std::size_t batch = 0; batch < batchesPerNote; ++batch)
    {
        const auto firstLaneOffset = batch * batchSize;
        const auto oscillator = firstLaneOffset / maximumUnisonCount;
        const auto mode = static_cast<WarpMode> (controls.warpModes[firstMode + oscillator]);
        const auto supported = atlasIsAvailable && mode != WarpMode::off
                            && (mode != WarpMode::bend
                                || (atlasBasisWeights[2] != nullptr
                                    && atlasBasisWeights[3] != nullptr));
        auto allLanesEnterAtlas = supported;
        auto anyLaneExitsAtlas = ! supported;
        const auto inputHarmonics = mode == WarpMode::bend ? 2.0f : 1.0f;
        for (std::size_t offset = 0; offset < batchSize; ++offset)
        {
            const auto budget = sourceBudgets[firstLaneOffset + offset];
            allLanesEnterAtlas = allLanesEnterAtlas
                              && budget < 2.0f * inputHarmonics;
            anyLaneExitsAtlas = anyLaneExitsAtlas
                             || budget > 2.25f * inputHarmonics;
        }

        const auto stateIndex = firstFamilyBatch + batch;
        auto& target = state.atlasFamilyTargets[stateIndex];
        auto& mix = state.atlasFamilyMix[stateIndex];
        if (! supported)
        {
            // There is no atlas representation for the unwarped mode. A stale
            // handoff from the previous warped mode must not index atlasModes
            // with WarpMode::off (mode - 1).
            target = 0;
            mix = 0.0f;
            atlasFamilyWeights[batch] = 0.0f;
            renderAtlas[batch] = false;
            renderGeneral[batch] = true;
            continue;
        }
        if (target < 0)
        {
            target = allLanesEnterAtlas ? 1 : 0;
            mix = static_cast<float> (target);
        }
        else if (target == 0 && allLanesEnterAtlas)
            target = 1;
        else if (target != 0 && anyLaneExitsAtlas)
            target = 0;

        const auto targetMix = static_cast<float> (target);
        const auto step = 1.0f / familyTransitionFrames;
        mix += std::clamp (targetMix - mix, -step, step);
        mix = std::clamp (mix, 0.0f, 1.0f);
        atlasFamilyWeights[batch] = smoothStep01 (mix);
        renderAtlas[batch] = mix > 0.0f;
        renderGeneral[batch] = mix < 1.0f;
    }

    for (std::size_t laneOffset = 0; laneOffset < lanesPerNote; ++laneOffset)
    {
        if (! renderAtlas[laneOffset / batchSize])
            continue;
        const auto lane = firstLane + laneOffset;
        const auto oscillator = laneOffset / maximumUnisonCount;
        const auto mode = static_cast<WarpMode> (controls.warpModes[firstMode + oscillator]);
        const auto phaseIncrement = controls.phaseIncrements[lane];
        const auto warpAmount = controls.warpAmounts[lane];
        if (state.cachedAtlasModes[lane] == static_cast<std::int32_t> (mode)
            && state.cachedAtlasPhaseIncrements[lane] == phaseIncrement
            && state.cachedAtlasWarpAmounts[lane] == warpAmount)
            continue;

        const auto& metadata = atlasModes[static_cast<std::size_t> (mode) - 1];
        const auto outputMip = selectAtlasOutputMip (
            phaseIncrement, metadata.mipCount, oversampleFactor);
        state.atlasLengths[lane] = metadata.tableLengths[static_cast<std::size_t> (outputMip)];
        const auto amountPosition = std::clamp (warpAmount, 0.0f, 1.0f)
                                  * static_cast<float> (metadata.amountCount - 1);
        const auto flooredAmount = static_cast<std::int32_t> (std::floor (amountPosition));
        const auto mipOffset = metadata.mipOffsets[static_cast<std::size_t> (outputMip)];
        if (mode == WarpMode::bend)
        {
            const auto lowerAmount = std::clamp (flooredAmount, 0, metadata.amountCount - 2);
            const auto blend = amountPosition - static_cast<float> (lowerAmount);
            state.atlasAmountBases0[lane] = metadata.sampleOffset
                                          + lowerAmount * metadata.amountStride + mipOffset;
            state.atlasAmountBases1[lane] = state.atlasAmountBases0[lane]
                                          + metadata.amountStride;
            state.atlasAmountWeights0[lane] = 1.0f - blend;
            state.atlasAmountWeights1[lane] = blend;
        }
        else
        {
            const auto firstAmount = std::clamp (flooredAmount - 1, 0, metadata.amountCount - 3);
            const auto local = amountPosition - static_cast<float> (firstAmount);
            state.atlasAmountBases0[lane] = metadata.sampleOffset
                                          + firstAmount * metadata.amountStride + mipOffset;
            state.atlasAmountBases1[lane] = state.atlasAmountBases0[lane]
                                          + metadata.amountStride;
            state.atlasAmountBases2[lane] = state.atlasAmountBases1[lane]
                                          + metadata.amountStride;
            state.atlasAmountWeights0[lane] = 0.5f * (local - 1.0f) * (local - 2.0f);
            state.atlasAmountWeights1[lane] = -local * (local - 2.0f);
            state.atlasAmountWeights2[lane] = 0.5f * local * (local - 1.0f);
        }
        state.cachedAtlasModes[lane] = static_cast<std::int32_t> (mode);
        state.cachedAtlasPhaseIncrements[lane] = phaseIncrement;
        state.cachedAtlasWarpAmounts[lane] = warpAmount;
    }

    // Fully atlas-rendered batches never read the source table. A family
    // transition prepares both sides for only 64 output frames.
    for (std::size_t laneOffset = 0; laneOffset < lanesPerNote; ++laneOffset)
    {
        if (! renderGeneral[laneOffset / batchSize])
            continue;
        const auto lane = firstLane + laneOffset;
        const auto oscillator = laneOffset / maximumUnisonCount;
        const auto slot = static_cast<std::size_t> (
            std::clamp (tables.oscillatorSlots[oscillator], 0,
                        static_cast<std::int32_t> (tableSlotCount - 1)));
        const auto mip = selectSourceMip (sourceBudgets[laneOffset]);
        const auto tableMetadata = slot * mipLevelCount + static_cast<std::size_t> (mip);
        const auto length = tables.mipLengths[tableMetadata];
        const auto frameCount = std::max (1, tables.frameCounts[slot]);
        const auto framePosition = std::clamp (controls.positions[lane], 0.0f, 1.0f)
                                 * static_cast<float> (frameCount - 1);
        const auto lowerFrame = static_cast<std::int32_t> (std::floor (framePosition));
        const auto upperFrame = std::min (lowerFrame + 1, frameCount - 1);
        const auto stride = length + 1;
        lengths[laneOffset] = length;
        lowerBases[laneOffset] = tables.mipOffsets[tableMetadata] + lowerFrame * stride;
        upperBases[laneOffset] = tables.mipOffsets[tableMetadata] + upperFrame * stride;
        frameBlends[laneOffset] = framePosition - static_cast<float> (lowerFrame);
    }

    const auto secondHistoryBase = noteIndex * 4 * secondHalfbandLength;
    auto* secondHistory = state.secondHistory + secondHistoryBase;
    auto& secondWrite = state.secondWriteIndices[noteIndex];
    StereoSample stage2Output {};
    std::array<BendParameters, lanesPerNote / batchSize> bendParameters;
    std::array<PwmParameters, lanesPerNote / batchSize> pwmParameters;
    std::array<SkewParameters, lanesPerNote / batchSize> skewParameters;
    std::array<MirrorParameters, lanesPerNote / batchSize> mirrorParameters;
    for (std::size_t laneOffset = 0; laneOffset < lanesPerNote; laneOffset += batchSize)
    {
        const auto oscillator = laneOffset / maximumUnisonCount;
        const auto mode = static_cast<WarpMode> (controls.warpModes[firstMode + oscillator]);
        const auto lane = firstLane + laneOffset;
        const auto batch = laneOffset / batchSize;
        if (oversampleFactor == 1 || ! renderGeneral[batch])
            continue;
        const auto amount = FloatBatch::load_unaligned (controls.warpAmounts + lane);
        const auto increment = FloatBatch::load_unaligned (controls.phaseIncrements + lane);
        const auto smoothingHalfWidth = increment
            * FloatBatch (2.0f / static_cast<float> (oversampleFactor));
        if (mode == WarpMode::bend)
        {
            bendParameters[laneOffset / batchSize] = prepareBend (
                amount, smoothingHalfWidth);
        }
        else if (mode == WarpMode::pwm)
            pwmParameters[laneOffset / batchSize] = preparePwm (amount, smoothingHalfWidth);
        else if (mode == WarpMode::asym)
            skewParameters[laneOffset / batchSize] = prepareSkew (amount, smoothingHalfWidth);
        else if (mode == WarpMode::mirror)
            mirrorParameters[laneOffset / batchSize] = prepareMirror (amount, smoothingHalfWidth);
    }

    for (std::int32_t subSample = 0; subSample < oversampleFactor; ++subSample)
    {
        FloatBatch left (0.0f);
        FloatBatch right (0.0f);
        for (std::size_t laneOffset = 0; laneOffset < lanesPerNote; laneOffset += batchSize)
        {
            const auto lane = firstLane + laneOffset;
            const auto oscillator = laneOffset / maximumUnisonCount;
            const auto mode = static_cast<WarpMode> (controls.warpModes[firstMode + oscillator]);
            const auto basePhase = FloatBatch::load_unaligned (state.phases + lane);
            auto phase = basePhase;
            FloatBatch increment;
            if (oversampleFactor == 1)
                increment = FloatBatch::load_unaligned (controls.phaseIncrements + lane);
            else if (subSample != 0)
            {
                increment = FloatBatch::load_unaligned (controls.phaseIncrements + lane);
                phase = wrap01 (basePhase + increment * FloatBatch (0.5f));
            }
            const auto batch = laneOffset / batchSize;
            FloatBatch atlasSample (0.0f);
            if (renderAtlas[batch])
            {
                const auto& metadata = atlasModes[static_cast<std::size_t> (mode) - 1];
                if (mode == WarpMode::bend)
                {
                    alignas (16) std::array<float, batchSize> phaseValues;
#if XSIMD_WITH_WASM
                    alignas (16) std::array<float, batchSize> fractionalValues;
                    std::array<FloatBatch, batchSize> currentValues;
                    std::array<FloatBatch, batchSize> currentDerivatives;
                    std::array<FloatBatch, batchSize> nextValues;
                    std::array<FloatBatch, batchSize> nextDerivatives;
#else
                    alignas (16) std::array<float, batchSize> sampleValues;
#endif
                    phase.store_unaligned (phaseValues.data());
                    for (std::size_t batchLane = 0; batchLane < batchSize; ++batchLane)
                    {
                        const auto laneIndex = lane + batchLane;
                        const auto length = state.atlasLengths[laneIndex];
                        const auto x = phaseValues[batchLane] * static_cast<float> (length);
                        const auto sampleIndex = static_cast<std::int32_t> (std::floor (x));
                        const auto amountWeight0 = state.atlasAmountWeights0[laneIndex];
                        const auto amountWeight1 = state.atlasAmountWeights1[laneIndex];
                        const auto fractional = x - static_cast<float> (sampleIndex);
#if XSIMD_WITH_WASM
                        const auto points = readPackedBendPoints (
                            atlas.samples,
                            state.atlasAmountBases0[laneIndex],
                            state.atlasAmountBases1[laneIndex],
                            sampleIndex, amountWeight0, amountWeight1);
                        fractionalValues[batchLane] = fractional;
                        currentValues[batchLane] = points.current.value;
                        currentDerivatives[batchLane] = points.current.derivative;
                        nextValues[batchLane] = points.next.value;
                        nextDerivatives[batchLane] = points.next.derivative;
#else
                        const auto basis = amountWeight1 == 0.0f
                            ? readPackedBendBasisSingle (
                                atlas.samples, state.atlasAmountBases0[laneIndex],
                                sampleIndex, fractional)
                            : (amountWeight0 == 0.0f
                                ? readPackedBendBasisSingle (
                                    atlas.samples, state.atlasAmountBases1[laneIndex],
                                    sampleIndex, fractional)
                                : readPackedBendBasis (
                                    atlas.samples,
                                    state.atlasAmountBases0[laneIndex],
                                    state.atlasAmountBases1[laneIndex],
                                    sampleIndex, amountWeight0, amountWeight1,
                                    fractional));
                        const std::array<float, 4> scalarWeights {
                            atlasBasisWeights[0][laneIndex],
                            atlasBasisWeights[1][laneIndex],
                            atlasBasisWeights[2][laneIndex],
                            atlasBasisWeights[3][laneIndex]
                        };
                        const auto weights = FloatBatch::load_unaligned (scalarWeights.data());
                        sampleValues[batchLane] = atlasDc[laneIndex]
                            + xsimd::reduce_add (basis * weights);
#endif
                    }
#if XSIMD_WITH_WASM
                    xsimd::transpose (currentValues.data(),
                                      currentValues.data() + currentValues.size());
                    xsimd::transpose (currentDerivatives.data(),
                                      currentDerivatives.data() + currentDerivatives.size());
                    xsimd::transpose (nextValues.data(),
                                      nextValues.data() + nextValues.size());
                    xsimd::transpose (nextDerivatives.data(),
                                      nextDerivatives.data() + nextDerivatives.size());
                    const auto basisWeight0 = FloatBatch::load_unaligned (
                        atlasBasisWeights[0] + lane);
                    const auto basisWeight1 = FloatBatch::load_unaligned (
                        atlasBasisWeights[1] + lane);
                    const auto basisWeight2 = FloatBatch::load_unaligned (
                        atlasBasisWeights[2] + lane);
                    const auto basisWeight3 = FloatBatch::load_unaligned (
                        atlasBasisWeights[3] + lane);
                    const auto weighted = [&] (const std::array<FloatBatch, batchSize>& values)
                    {
                        return (values[0] * basisWeight0 + values[2] * basisWeight2)
                             + (values[1] * basisWeight1 + values[3] * basisWeight3);
                    };
                    atlasSample = FloatBatch::load_unaligned (atlasDc + lane)
                        + evaluateAtlasHermite (
                            { weighted (currentValues), weighted (currentDerivatives) },
                            { weighted (nextValues), weighted (nextDerivatives) },
                            makeAtlasHermiteWeights (
                                FloatBatch::load_unaligned (fractionalValues.data())));
#else
                    atlasSample = FloatBatch::load_unaligned (sampleValues.data());
#endif
                }
                else
                {
                    const auto x = phase * xsimd::to_float (
                        IntBatch::load_unaligned (state.atlasLengths + lane));
                    const auto floored = xsimd::floor (x);
                    const auto sampleIndices = xsimd::to_int (floored);
                    const auto hermite = makeAtlasHermiteWeights (x - floored);
                    const auto base0 = IntBatch::load_unaligned (
                        state.atlasAmountBases0 + lane);
                    const auto base1 = IntBatch::load_unaligned (
                        state.atlasAmountBases1 + lane);
                    const auto base2 = IntBatch::load_unaligned (
                        state.atlasAmountBases2 + lane);
                    const auto weight0 = FloatBatch::load_unaligned (
                        state.atlasAmountWeights0 + lane);
                    const auto weight1 = FloatBatch::load_unaligned (
                        state.atlasAmountWeights1 + lane);
                    const auto weight2 = FloatBatch::load_unaligned (
                        state.atlasAmountWeights2 + lane);
                    atlasSample = FloatBatch::load_unaligned (atlasDc + lane);
                    const auto exactAmount = (weight0 == FloatBatch (1.0f))
                                           | (weight1 == FloatBatch (1.0f))
                                           | (weight2 == FloatBatch (1.0f));
                    for (std::int32_t basis = 0; basis < metadata.basisCount; ++basis)
                    {
                        const auto basisOffset = IntBatch (basis * metadata.bankStride);
                        const auto basisSample = xsimd::all (exactAmount)
                            ? readPackedAtlasSingleAmount (
                                atlas.samples,
                                xsimd::select (
                                    xsimd::batch_bool_cast<std::int32_t> (
                                        weight0 == FloatBatch (1.0f)),
                                    base0,
                                    xsimd::select (
                                        xsimd::batch_bool_cast<std::int32_t> (
                                            weight1 == FloatBatch (1.0f)),
                                        base1, base2)) + basisOffset,
                                sampleIndices, hermite)
                            : readPackedAtlasQuadraticAmount (
                                atlas.samples, base0 + basisOffset, base1 + basisOffset,
                                base2 + basisOffset, sampleIndices,
                                weight0, weight1, weight2, hermite);
                        atlasSample += basisSample
                            * FloatBatch::load_unaligned (atlasBasisWeights[basis] + lane);
                    }
                }
            }

            FloatBatch generalSample (0.0f);
            if (renderGeneral[batch])
            {
                auto warped = phase;
                const auto directPreparation = oversampleFactor == 1;
                switch (mode)
                {
                    case WarpMode::bend:
                        warped = directPreparation
                            ? smoothBendDirect (phase,
                                FloatBatch::load_unaligned (controls.warpAmounts + lane),
                                increment * FloatBatch (2.0f))
                            : smoothBend (phase, bendParameters[batch]);
                        break;
                    case WarpMode::pwm:
                        warped = directPreparation
                            ? smoothPwm (phase, preparePwm (
                                FloatBatch::load_unaligned (controls.warpAmounts + lane),
                                increment * FloatBatch (2.0f)))
                            : smoothPwm (phase, pwmParameters[batch]);
                        break;
                    case WarpMode::asym:
                        warped = directPreparation
                            ? smoothAsym (phase, prepareSkew (
                                FloatBatch::load_unaligned (controls.warpAmounts + lane),
                                increment * FloatBatch (2.0f)))
                            : smoothAsym (phase, skewParameters[batch]);
                        break;
                    case WarpMode::mirror:
                        warped = directPreparation
                            ? smoothMirror (phase, prepareMirror (
                                FloatBatch::load_unaligned (controls.warpAmounts + lane),
                                increment * FloatBatch (2.0f)))
                            : smoothMirror (phase, mirrorParameters[batch]);
                        break;
                    case WarpMode::off: break;
                }
                const auto slot = static_cast<std::size_t> (
                    std::clamp (tables.oscillatorSlots[oscillator], 0,
                                static_cast<std::int32_t> (tableSlotCount - 1)));
                generalSample = readFrames (
                    tables.slots[slot], warped,
                    IntBatch::load_unaligned (lengths.data() + laneOffset),
                    IntBatch::load_unaligned (lowerBases.data() + laneOffset),
                    IntBatch::load_unaligned (upperBases.data() + laneOffset),
                    FloatBatch::load_unaligned (frameBlends.data() + laneOffset),
                    tables.slots[slot].valueScale,
                    tables.slots[slot].derivativeScale);
            }
            const auto sample = renderAtlas[batch] && renderGeneral[batch]
                ? generalSample + (atlasSample - generalSample)
                    * FloatBatch (atlasFamilyWeights[batch])
                : (renderAtlas[batch] ? atlasSample : generalSample);
            left += sample * FloatBatch::load_unaligned (controls.leftGains + lane);
            right += sample * FloatBatch::load_unaligned (controls.rightGains + lane);
            if (subSample + 1 == oversampleFactor)
            {
                if (subSample == 0 && oversampleFactor != 1)
                    increment = FloatBatch::load_unaligned (controls.phaseIncrements + lane);
                wrap01 (basePhase + increment).store_unaligned (state.phases + lane);
            }
        }

        const auto mixed = StereoSample {
            xsimd::reduce_add (left), xsimd::reduce_add (right)
        };
        if (unfilteredSamples != nullptr)
        {
            unfilteredSamples[subSample] = mixed;
            continue;
        }
        if (oversampleFactor == maximumWarpOversampleFactor)
        {
            pushStereo (secondHistory, secondHalfbandLength, secondWrite, mixed);
            if (subSample == 0)
            {
                const auto use441Filter = controls.use441Filter != 0;
                stage2Output.left = filterWarpOutput (
                    secondHistory, secondWrite, use441Filter);
                stage2Output.right = filterWarpOutput (
                    secondHistory + 2 * secondHalfbandLength, secondWrite, use441Filter);
            }
        }
        else
        {
            // At native 88.2/96 kHz the oscillator need not be decimated, but
            // warp still creates ultrasonic images. Run the same 18--24 kHz
            // audible-band FIR at every sample so they cannot fold through
            // downstream nonlinear processing. Its 28-sample 96 kHz delay is
            // the same wall-clock latency as 14 output samples at 48 kHz.
            pushStereo (secondHistory, secondHalfbandLength, secondWrite, mixed);
            stage2Output.left = filterWarpOutput (secondHistory, secondWrite, false);
            stage2Output.right = filterWarpOutput (
                secondHistory + 2 * secondHalfbandLength, secondWrite, false);
        }
    }

    return stage2Output;
}

StereoSample renderWarpedNote (WarpRendererStateView state,
                               WarpRendererControlsView controls,
                               TablePoolView tables,
                               PackedWarpAtlasView atlas,
                               const float* atlasDc,
                               const std::array<const float*, 4>& atlasBasisWeights,
                               std::size_t noteIndex) noexcept
{
    return renderWarpedNoteInternal (state, controls, tables, atlas, atlasDc,
                                     atlasBasisWeights, noteIndex, nullptr);
}

// One drain counter per 4-note filter batch: how many zero pushes its slice
// of the halfband history still needs before every tap reads exactly zero.
// A batch with no active note and a drained history is skipped whole - its
// FIR output over an all-zero history is exactly +0 at any write alignment,
// so writing 0 directly is bit-identical to convolving. Renderer statics
// persist per instance, exactly like the packed history they describe.
static std::array<std::int32_t, logicalNoteCount / batchSize> noteBatchDrainRemaining {};

void renderWarpedNotes (WarpRendererStateView state,
                        WarpRendererControlsView controls,
                        TablePoolView tables,
                        PackedWarpAtlasView atlas,
                        const float* atlasDc,
                        const std::array<const float*, 4>& atlasBasisWeights,
                        std::array<StereoSample, logicalNoteCount>& outputs) noexcept
{
    const auto oversampleFactor = controls.oversampleFactor <= 1
        ? std::int32_t { 1 } : maximumWarpOversampleFactor;
    std::array<std::array<StereoSample, logicalNoteCount>,
               maximumWarpOversampleFactor> mixed {};
    std::array<bool, logicalNoteCount / batchSize> batchHasActiveNote {};
    for (std::size_t note = 0; note < logicalNoteCount; ++note)
    {
        const auto firstLane = note * lanesPerNote;
        bool isActive = false;
        for (std::size_t lane = 0; lane < lanesPerNote && ! isActive; ++lane)
            isActive = controls.phaseIncrements[firstLane + lane] > 0.0f;
        if (! isActive)
            continue;

        batchHasActiveNote[note / batchSize] = true;
        StereoSample noteSamples[maximumWarpOversampleFactor] {};
        renderWarpedNoteInternal (state, controls, tables, atlas, atlasDc,
                                  atlasBasisWeights, note, noteSamples);
        for (std::int32_t subSample = 0; subSample < oversampleFactor; ++subSample)
            mixed[static_cast<std::size_t> (subSample)][note] = noteSamples[subSample];
    }

    // Decide this call's work from the PRE-decrement counters: the call that
    // drains a counter to zero must still push its final zeros and filter
    // them, or the history would keep a nonzero remnant forever.
    std::array<bool, logicalNoteCount / batchSize> processBatch {};
    for (std::size_t batch = 0; batch < noteBatchDrainRemaining.size(); ++batch)
    {
        processBatch[batch] = batchHasActiveNote[batch] || noteBatchDrainRemaining[batch] > 0;
        if (batchHasActiveNote[batch])
            noteBatchDrainRemaining[batch] = static_cast<std::int32_t> (secondHalfbandLength);
        else if (noteBatchDrainRemaining[batch] > 0)
            noteBatchDrainRemaining[batch] -= oversampleFactor;
    }

    auto* history = state.secondHistory;
    auto& writeIndex = state.secondWriteIndices[0];
    constexpr auto channelStride = 2 * secondHalfbandLength * logicalNoteCount;
    for (std::int32_t subSample = 0; subSample < oversampleFactor; ++subSample)
    {
        const auto write = static_cast<std::size_t> (writeIndex) * logicalNoteCount;
        const auto duplicate = (secondHalfbandLength
                              + static_cast<std::size_t> (writeIndex)) * logicalNoteCount;
        for (std::size_t note = 0; note < logicalNoteCount; note += batchSize)
        {
            if (! processBatch[note / batchSize])
                continue;

            alignas (16) std::array<float, batchSize> left;
            alignas (16) std::array<float, batchSize> right;
            for (std::size_t lane = 0; lane < batchSize; ++lane)
            {
                left[lane] = mixed[static_cast<std::size_t> (subSample)][note + lane].left;
                right[lane] = mixed[static_cast<std::size_t> (subSample)][note + lane].right;
            }
            const auto leftBatch = FloatBatch::load_unaligned (left.data());
            const auto rightBatch = FloatBatch::load_unaligned (right.data());
            leftBatch.store_unaligned (history + write + note);
            leftBatch.store_unaligned (history + duplicate + note);
            rightBatch.store_unaligned (history + channelStride + write + note);
            rightBatch.store_unaligned (history + channelStride + duplicate + note);
        }
        if (++writeIndex >= static_cast<std::int32_t> (secondHalfbandLength))
            writeIndex = 0;

        if (subSample == 0)
        {
            const auto use441Filter = controls.use441Filter != 0;
            for (std::size_t note = 0; note < logicalNoteCount; note += batchSize)
            {
                alignas (16) std::array<float, batchSize> left;
                alignas (16) std::array<float, batchSize> right;
                if (! processBatch[note / batchSize])
                {
                    for (std::size_t lane = 0; lane < batchSize; ++lane)
                        outputs[note + lane] = { 0.0f, 0.0f };
                    continue;
                }
                filterNoteBatch (history, writeIndex, note, use441Filter)
                    .store_unaligned (left.data());
                filterNoteBatch (history + channelStride, writeIndex, note, use441Filter)
                    .store_unaligned (right.data());
                for (std::size_t lane = 0; lane < batchSize; ++lane)
                    outputs[note + lane] = { left[lane], right[lane] };
            }
        }
    }
    for (std::size_t note = 1; note < logicalNoteCount; ++note)
        state.secondWriteIndices[note] = writeIndex;
}

StereoSample renderWarpedNote (WarpRendererStateView state,
                               WarpRendererControlsView controls,
                               TablePoolView tables,
                               std::size_t noteIndex) noexcept
{
    return renderWarpedNote (state, controls, tables, {}, nullptr,
                             { nullptr, nullptr, nullptr, nullptr }, noteIndex);
}

StereoSample renderWarpedNote (WarpRendererState& state,
                               const WarpRendererControls& controls,
                               const TablePoolLayout& tables,
                               std::size_t noteIndex) noexcept
{
    return renderWarpedNote (view (state), view (controls), view (tables), noteIndex);
}

StereoSample renderWarpedNote (WarpRendererState& state,
                               const WarpRendererControls& controls,
                               const TablePoolLayout& tables,
                               PackedWarpAtlasView atlas,
                               std::size_t noteIndex) noexcept
{
    const std::array<const float*, 4> basis {{
        controls.atlasBasisWeights[0].data(),
        controls.atlasBasisWeights[1].data(),
        controls.atlasBasisWeights[2].data(),
        controls.atlasBasisWeights[3].data()
    }};
    return renderWarpedNote (view (state), view (controls), view (tables), atlas,
                             controls.atlasDc.data(), basis, noteIndex);
}
}
