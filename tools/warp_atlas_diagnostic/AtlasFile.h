#pragma once

#include "WarpRenderer.h"

#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <optional>
#include <string>
#include <variant>
#include <vector>

namespace cosimo::warp_atlas_diagnostic
{
inline constexpr std::uintmax_t canonicalAtlasByteCount = 71170064;
inline constexpr std::size_t canonicalAtlasPackedSampleCount = 17792516;
inline constexpr const char* canonicalAtlasSha256
    = "faf3a9d7cb967ae1a572b4ff5dfdfb874641c0f942eabec1c789566b527f2157";

enum class AtlasLoadErrorCode
{
    missing,
    notRegularFile,
    sizeMismatch,
    openFailed,
    readFailed,
    sha256Mismatch,
    sha256Failed
};

struct AtlasLoadError
{
    AtlasLoadErrorCode code;
    std::filesystem::path path;
    std::optional<std::uintmax_t> actualByteCount;
    std::optional<std::string> actualSha256;
    std::string detail;
};

class AtlasFile final
{
public:
    explicit AtlasFile (std::vector<std::int32_t> samples);
    AtlasFile (const AtlasFile&) = delete;
    AtlasFile& operator= (const AtlasFile&) = delete;
    AtlasFile (AtlasFile&&) noexcept = default;
    AtlasFile& operator= (AtlasFile&&) noexcept = default;

    cosimo::three_osc::PackedWarpAtlasView view() const noexcept;
    std::size_t storageByteCount() const noexcept;

private:
    std::vector<std::int32_t> samples;
};

using AtlasLoadResult = std::variant<AtlasFile, AtlasLoadError>;

AtlasLoadResult loadCanonicalAtlas (const std::filesystem::path& path);
const char* codeName (AtlasLoadErrorCode code) noexcept;
}
