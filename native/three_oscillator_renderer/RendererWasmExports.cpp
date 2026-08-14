#include "RendererBridge.h"

#include <cstdint>

extern "C" std::int32_t CosimoThreeOscillatorRenderer__renderAll (
    float* packedFloats, std::int32_t packedFloatCount,
    std::int32_t* packedInts, std::int32_t packedIntCount,
    std::int32_t* slot0Chunk0, std::int32_t slot0Chunk0Count,
    std::int32_t* slot0Chunk1, std::int32_t slot0Chunk1Count,
    std::int32_t* slot0Chunk2, std::int32_t slot0Chunk2Count,
    std::int32_t* slot0Chunk3, std::int32_t slot0Chunk3Count,
    std::int32_t* slot1Chunk0, std::int32_t slot1Chunk0Count,
    std::int32_t* slot1Chunk1, std::int32_t slot1Chunk1Count,
    std::int32_t* slot1Chunk2, std::int32_t slot1Chunk2Count,
    std::int32_t* slot1Chunk3, std::int32_t slot1Chunk3Count,
    std::int32_t* slot2Chunk0, std::int32_t slot2Chunk0Count,
    std::int32_t* slot2Chunk1, std::int32_t slot2Chunk1Count,
    std::int32_t* slot2Chunk2, std::int32_t slot2Chunk2Count,
    std::int32_t* slot2Chunk3, std::int32_t slot2Chunk3Count,
    std::int32_t* slot3Chunk0, std::int32_t slot3Chunk0Count,
    std::int32_t* slot3Chunk1, std::int32_t slot3Chunk1Count,
    std::int32_t* slot3Chunk2, std::int32_t slot3Chunk2Count,
    std::int32_t* slot3Chunk3, std::int32_t slot3Chunk3Count) noexcept
{
    using cosimo::three_osc::bridge::Slice;
    return cosimo::three_osc::bridge::renderAll (
        Slice<float> { packedFloats, packedFloatCount },
        Slice<std::int32_t> { packedInts, packedIntCount },
        Slice<std::int32_t> { slot0Chunk0, slot0Chunk0Count },
        Slice<std::int32_t> { slot0Chunk1, slot0Chunk1Count },
        Slice<std::int32_t> { slot0Chunk2, slot0Chunk2Count },
        Slice<std::int32_t> { slot0Chunk3, slot0Chunk3Count },
        Slice<std::int32_t> { slot1Chunk0, slot1Chunk0Count },
        Slice<std::int32_t> { slot1Chunk1, slot1Chunk1Count },
        Slice<std::int32_t> { slot1Chunk2, slot1Chunk2Count },
        Slice<std::int32_t> { slot1Chunk3, slot1Chunk3Count },
        Slice<std::int32_t> { slot2Chunk0, slot2Chunk0Count },
        Slice<std::int32_t> { slot2Chunk1, slot2Chunk1Count },
        Slice<std::int32_t> { slot2Chunk2, slot2Chunk2Count },
        Slice<std::int32_t> { slot2Chunk3, slot2Chunk3Count },
        Slice<std::int32_t> { slot3Chunk0, slot3Chunk0Count },
        Slice<std::int32_t> { slot3Chunk1, slot3Chunk1Count },
        Slice<std::int32_t> { slot3Chunk2, slot3Chunk2Count },
        Slice<std::int32_t> { slot3Chunk3, slot3Chunk3Count });
}
