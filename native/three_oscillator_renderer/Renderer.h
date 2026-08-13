#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace cosimo::three_osc
{
constexpr std::size_t logicalNoteCount = 16;
constexpr std::size_t oscillatorCount = 3;
constexpr std::size_t maximumUnisonCount = 8;
constexpr std::size_t lanesPerNote = oscillatorCount * maximumUnisonCount;
constexpr std::size_t laneCount = logicalNoteCount * lanesPerNote;
constexpr std::size_t wavetableSize = 2048;
constexpr std::size_t paddedFrameSize = wavetableSize + 3;
constexpr std::size_t mipLevelCount = 11;

struct Slice
{
    const float* samples = nullptr;
    std::int32_t size = 0;
};

struct StereoSample
{
    float left = 0.0f;
    float right = 0.0f;
};

struct alignas (64) RendererState
{
    std::array<float, laneCount> phases {};
};

struct alignas (64) RendererControls
{
    std::array<float, laneCount> phaseIncrements {};
    std::array<float, laneCount> frameBlend {};
    std::array<float, laneCount> leftGain {};
    std::array<float, laneCount> rightGain {};
    std::array<std::int32_t, laneCount> lowerFrameBases {};
    std::array<std::int32_t, laneCount> upperFrameBases {};
};

void reset (RendererState& state, float phase = 0.0f) noexcept;

StereoSample renderNote (RendererState& state,
                         const RendererControls& controls,
                         Slice tablePool,
                         std::size_t noteIndex) noexcept;
}
