#include "AtlasFile.h"

#include <CommonCrypto/CommonDigest.h>

#include <algorithm>
#include <array>
#include <fstream>
#include <iomanip>
#include <limits>
#include <sstream>
#include <system_error>
#include <utility>

namespace cosimo::warp_atlas_diagnostic
{
namespace
{
std::string sha256Hex (const void* bytes, std::size_t byteCount)
{
    if (byteCount > std::numeric_limits<CC_LONG>::max())
        return {};

    std::array<unsigned char, CC_SHA256_DIGEST_LENGTH> digest {};
    if (CC_SHA256 (bytes, static_cast<CC_LONG> (byteCount), digest.data()) == nullptr)
        return {};

    std::ostringstream output;
    output << std::hex << std::setfill ('0');
    for (const auto byte : digest)
        output << std::setw (2) << static_cast<unsigned int> (byte);
    return output.str();
}
}

AtlasFile::AtlasFile (std::vector<std::int32_t> loadedSamples)
    : samples (std::move (loadedSamples))
{
}

cosimo::three_osc::PackedWarpAtlasView AtlasFile::view() const noexcept
{
    return {
        samples.data(),
        static_cast<std::int32_t> (samples.size())
    };
}

std::size_t AtlasFile::storageByteCount() const noexcept
{
    return samples.size() * sizeof (std::int32_t);
}

AtlasLoadResult loadCanonicalAtlas (const std::filesystem::path& path)
{
    std::error_code statusError;
    const auto status = std::filesystem::status (path, statusError);
    if (statusError)
    {
        const auto missing = statusError == std::errc::no_such_file_or_directory;
        return AtlasLoadError {
            missing ? AtlasLoadErrorCode::missing : AtlasLoadErrorCode::openFailed,
            path,
            std::nullopt,
            std::nullopt,
            statusError.message()
        };
    }
    if (! std::filesystem::exists (status))
    {
        return AtlasLoadError {
            AtlasLoadErrorCode::missing,
            path,
            std::nullopt,
            std::nullopt,
            "file does not exist"
        };
    }
    if (! std::filesystem::is_regular_file (status))
    {
        return AtlasLoadError {
            AtlasLoadErrorCode::notRegularFile,
            path,
            std::nullopt,
            std::nullopt,
            "atlas path is not a regular file"
        };
    }

    std::error_code sizeError;
    const auto byteCount = std::filesystem::file_size (path, sizeError);
    if (sizeError)
    {
        return AtlasLoadError {
            AtlasLoadErrorCode::openFailed,
            path,
            std::nullopt,
            std::nullopt,
            sizeError.message()
        };
    }
    if (byteCount != canonicalAtlasByteCount)
    {
        return AtlasLoadError {
            AtlasLoadErrorCode::sizeMismatch,
            path,
            byteCount,
            std::nullopt,
            "atlas byte count does not match the canonical diagnostic asset"
        };
    }

    std::ifstream input (path, std::ios::binary);
    if (! input)
    {
        return AtlasLoadError {
            AtlasLoadErrorCode::openFailed,
            path,
            byteCount,
            std::nullopt,
            "failed to open atlas for reading"
        };
    }

    std::vector<std::int32_t> samples (canonicalAtlasPackedSampleCount);
    input.read (reinterpret_cast<char*> (samples.data()),
                static_cast<std::streamsize> (canonicalAtlasByteCount));
    if (input.gcount() != static_cast<std::streamsize> (canonicalAtlasByteCount)
        || input.bad())
    {
        return AtlasLoadError {
            AtlasLoadErrorCode::readFailed,
            path,
            static_cast<std::uintmax_t> (std::max<std::streamsize> (0, input.gcount())),
            std::nullopt,
            "atlas contents changed or became unreadable during startup"
        };
    }

    const auto actualSha256 = sha256Hex (samples.data(), canonicalAtlasByteCount);
    if (actualSha256.empty())
    {
        return AtlasLoadError {
            AtlasLoadErrorCode::sha256Failed,
            path,
            byteCount,
            std::nullopt,
            "SHA-256 calculation failed"
        };
    }
    if (actualSha256 != canonicalAtlasSha256)
    {
        return AtlasLoadError {
            AtlasLoadErrorCode::sha256Mismatch,
            path,
            byteCount,
            actualSha256,
            "atlas SHA-256 does not match the canonical diagnostic asset"
        };
    }

    return AtlasFile (std::move (samples));
}

const char* codeName (AtlasLoadErrorCode code) noexcept
{
    switch (code)
    {
        case AtlasLoadErrorCode::missing: return "atlas_missing";
        case AtlasLoadErrorCode::notRegularFile: return "atlas_not_regular_file";
        case AtlasLoadErrorCode::sizeMismatch: return "atlas_size_mismatch";
        case AtlasLoadErrorCode::openFailed: return "atlas_open_failed";
        case AtlasLoadErrorCode::readFailed: return "atlas_read_failed";
        case AtlasLoadErrorCode::sha256Mismatch: return "atlas_sha256_mismatch";
        case AtlasLoadErrorCode::sha256Failed: return "atlas_sha256_failed";
    }
    return "atlas_load_failed";
}
}
