#pragma once

#include "BounceNativeDriver.h"
#include "Sha256.h"

#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <optional>
#include <string>
#include <vector>

namespace cosimo::bounce
{

inline constexpr std::uint32_t bounceBankVersion = 1;
inline constexpr std::uint32_t bounceBankFixedHeaderBytes = 32;
inline constexpr std::uint32_t bounceBankRootRecordBytes = 16;

struct BankRootMetadata
{
    std::int32_t note = 0;
    std::uint32_t frameOffset = 0;
    std::uint32_t frameCount = 0;
    std::uint32_t noteOffFrameOffset = 0;
};

struct BankFileInfo
{
    std::uint32_t sampleRate = 0;
    std::uint32_t totalFrameCount = 0;
    std::uint64_t byteLength = 0;
    std::vector<BankRootMetadata> roots;
};

BankFileInfo validateBounceBankFile (const std::filesystem::path&);
std::string digestBounceBankFile (const std::filesystem::path&);

/** Streams per-root PCM to disk, retaining metadata but never a full bank. */
class BounceBankFileBuilder final
{
public:
    BounceBankFileBuilder (std::filesystem::path payloadPath,
                           std::uint32_t sampleRate);
    ~BounceBankFileBuilder();

    BounceBankFileBuilder (const BounceBankFileBuilder&) = delete;
    BounceBankFileBuilder& operator= (const BounceBankFileBuilder&) = delete;

    void append (RootCapture&&);
    BankFileInfo finish (const std::filesystem::path& bankPath);
    void abort() noexcept;

private:
    std::filesystem::path payloadPath;
    std::uint32_t sampleRate = 0;
    std::uint32_t totalFrameCount = 0;
    std::vector<BankRootMetadata> roots;
    std::ofstream payload;
    bool finished = false;
};

struct StoreUsage
{
    std::uint64_t bankCount = 0;
    std::uint64_t byteLength = 0;
};

struct PublishResult
{
    std::filesystem::path path;
    BankFileInfo bank;
    bool alreadyExisted = false;
};

class BounceBankStore final
{
public:
    class ExclusiveLock final
    {
    public:
        ExclusiveLock() = default;
        ~ExclusiveLock();
        ExclusiveLock (ExclusiveLock&&) noexcept;
        ExclusiveLock& operator= (ExclusiveLock&&) noexcept;
        ExclusiveLock (const ExclusiveLock&) = delete;
        ExclusiveLock& operator= (const ExclusiveLock&) = delete;

        explicit operator bool() const noexcept { return descriptor >= 0; }

    private:
        friend class BounceBankStore;
        int descriptor = -1;
        std::filesystem::path ownerRoot;
    };

    explicit BounceBankStore (std::filesystem::path rootDirectory);

    void initialise();
    const std::filesystem::path& root() const noexcept { return rootDirectory; }
    std::filesystem::path bankPath (const std::string& digest) const;
    PublishResult publish (const std::string& digest,
                           const std::filesystem::path& verifiedSourceBank);
    std::optional<std::vector<std::uint8_t>> readVerified (
        const std::string& digest,
        std::optional<std::uint64_t> expectedByteLength = std::nullopt) const;
    std::vector<std::string> listDigests() const;
    StoreUsage usage() const;

    std::optional<ExclusiveLock> tryAcquireExclusiveLock() const;
    bool remove (const std::string& digest, const ExclusiveLock&);

private:
    void verifyPublished (const std::string& digest,
                          const std::filesystem::path& path) const;

    std::filesystem::path rootDirectory;
};

/** Native-only binary DAW envelope; no base64 and no JSON PCM. */
std::vector<std::uint8_t> createPortableBounceEnvelope (
    const std::string& digest,
    const std::vector<std::uint8_t>& bankBytes);
std::vector<std::uint8_t> readPortableBounceEnvelope (
    const std::vector<std::uint8_t>& envelope,
    std::string* digestOut = nullptr);

} // namespace cosimo::bounce
