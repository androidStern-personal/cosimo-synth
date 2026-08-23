#include "BounceNativeBankStore.h"

#include <algorithm>
#include <array>
#include <atomic>
#include <cerrno>
#include <chrono>
#include <cstring>
#include <limits>
#include <stdexcept>
#include <system_error>
#include <utility>

#include <fcntl.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>

namespace cosimo::bounce
{
namespace
{
constexpr std::array<std::uint8_t, 8> bankMagic {
    'C', 'S', 'B', 'N', 'K', '0', '0', '1',
};
constexpr std::array<std::uint8_t, 8> envelopeMagic {
    'C', 'O', 'S', 'I', 'M', 'O', 'B', '1',
};
constexpr std::uint32_t envelopeVersion = 1;
constexpr std::uint64_t envelopeHeaderBytes = 56;

void require (bool condition, const std::string& message)
{
    if (! condition)
        throw std::runtime_error (message);
}

std::uint32_t readLE32 (const std::uint8_t* bytes) noexcept
{
    return static_cast<std::uint32_t> (bytes[0])
         | (static_cast<std::uint32_t> (bytes[1]) << 8)
         | (static_cast<std::uint32_t> (bytes[2]) << 16)
         | (static_cast<std::uint32_t> (bytes[3]) << 24);
}

std::uint64_t readLE64 (const std::uint8_t* bytes) noexcept
{
    auto value = std::uint64_t { 0 };
    for (std::size_t index = 0; index < 8; ++index)
        value |= static_cast<std::uint64_t> (bytes[index]) << (index * 8);
    return value;
}

void writeLE32 (std::uint8_t* bytes, std::uint32_t value) noexcept
{
    for (std::size_t index = 0; index < 4; ++index)
        bytes[index] = static_cast<std::uint8_t> (value >> (index * 8));
}

void writeLE64 (std::uint8_t* bytes, std::uint64_t value) noexcept
{
    for (std::size_t index = 0; index < 8; ++index)
        bytes[index] = static_cast<std::uint8_t> (value >> (index * 8));
}

BankFileInfo validateBankBytes (const std::uint8_t* bytes, std::uint64_t byteLength)
{
    require (bytes != nullptr && byteLength >= bounceBankFixedHeaderBytes,
             "Bounce bank header is truncated");
    require (std::equal (bankMagic.begin(), bankMagic.end(), bytes),
             "Bounce bank magic is invalid");
    const auto headerLength = readLE32 (bytes + 8);
    const auto version = readLE32 (bytes + 12);
    const auto sampleRate = readLE32 (bytes + 16);
    const auto rootCount = readLE32 (bytes + 20);
    const auto totalFrames = readLE32 (bytes + 24);
    require (version == bounceBankVersion, "Unsupported Bounce bank version");
    require (sampleRate > 0, "Bounce bank sample rate is invalid");
    require (rootCount > 0 && rootCount <= maxBankRootCount,
             "Bounce bank root count is invalid");
    require (headerLength == bounceBankFixedHeaderBytes
                                + rootCount * bounceBankRootRecordBytes,
             "Bounce bank header length is invalid");
    require (headerLength <= byteLength,
             "Bounce bank root table is truncated");
    require (totalFrames <= maxBankFrameCapacity,
             "Bounce bank exceeds the live frame capacity");
    require (static_cast<std::uint64_t> (headerLength)
                    + static_cast<std::uint64_t> (totalFrames) * 4
                == byteLength,
             "Bounce bank PCM length does not match its header");

    BankFileInfo info;
    info.sampleRate = sampleRate;
    info.totalFrameCount = totalFrames;
    info.byteLength = byteLength;
    info.roots.reserve (rootCount);
    auto expectedOffset = std::uint32_t { 0 };
    auto previousNote = std::int32_t { -1 };
    for (auto index = std::uint32_t { 0 }; index < rootCount; ++index)
    {
        const auto* record = bytes + bounceBankFixedHeaderBytes
                           + index * bounceBankRootRecordBytes;
        BankRootMetadata root;
        root.note = static_cast<std::int32_t> (readLE32 (record));
        root.frameOffset = readLE32 (record + 4);
        root.frameCount = readLE32 (record + 8);
        root.noteOffFrameOffset = readLE32 (record + 12);
        require (root.note >= 0 && root.note <= 127 && root.note > previousNote,
                 "Bounce bank roots are not strictly ascending MIDI notes");
        require (root.frameOffset == expectedOffset && root.frameCount > 0,
                 "Bounce bank root ranges are not contiguous");
        require (static_cast<std::uint64_t> (root.frameOffset) + root.frameCount
                    <= totalFrames,
                 "Bounce bank root range exceeds PCM");
        require (root.noteOffFrameOffset == 0
                    || root.noteOffFrameOffset < root.frameCount,
                 "Bounce bank note-off offset exceeds its root");
        info.roots.push_back (root);
        expectedOffset += root.frameCount;
        previousNote = root.note;
    }
    require (expectedOffset == totalFrames,
             "Bounce bank root ranges do not cover PCM");
    return info;
}

std::vector<std::uint8_t> readWholeFile (const std::filesystem::path& path)
{
    const auto size = std::filesystem::file_size (path);
    require (size <= static_cast<std::uint64_t> (std::numeric_limits<std::size_t>::max()),
             "Bounce bank is too large for this process");
    std::vector<std::uint8_t> bytes (static_cast<std::size_t> (size));
    std::ifstream input (path, std::ios::binary);
    require (static_cast<bool> (input), "Could not open Bounce bank " + path.string());
    if (! bytes.empty())
        input.read (reinterpret_cast<char*> (bytes.data()),
                    static_cast<std::streamsize> (bytes.size()));
    require (input.good() || input.eof(), "Could not read Bounce bank " + path.string());
    require (static_cast<std::size_t> (input.gcount()) == bytes.size() || bytes.empty(),
             "Bounce bank read was truncated");
    return bytes;
}

void flushFile (const std::filesystem::path& path)
{
    const auto descriptor = ::open (path.c_str(), O_RDONLY);
    if (descriptor < 0)
        throw std::system_error (errno, std::generic_category(),
                                 "Could not reopen Bounce staging file");
    const auto result = ::fsync (descriptor);
    const auto savedError = errno;
    ::close (descriptor);
    if (result != 0)
        throw std::system_error (savedError, std::generic_category(),
                                 "Could not flush Bounce staging file");
}

void flushDirectory (const std::filesystem::path& path)
{
    const auto descriptor = ::open (path.c_str(), O_RDONLY | O_DIRECTORY);
    if (descriptor < 0)
        throw std::system_error (errno, std::generic_category(),
                                 "Could not open Bounce store directory");
    const auto result = ::fsync (descriptor);
    const auto savedError = errno;
    ::close (descriptor);
    if (result != 0)
        throw std::system_error (savedError, std::generic_category(),
                                 "Could not flush Bounce store directory");
}

void copyFileStrict (const std::filesystem::path& source,
                     const std::filesystem::path& destination)
{
    std::ifstream input (source, std::ios::binary);
    std::ofstream output (destination, std::ios::binary | std::ios::trunc);
    require (static_cast<bool> (input), "Could not open Bounce source bank");
    require (static_cast<bool> (output), "Could not create Bounce staging bank");
    std::array<char, 64 * 1024> buffer {};
    while (input)
    {
        input.read (buffer.data(), static_cast<std::streamsize> (buffer.size()));
        const auto count = input.gcount();
        if (count > 0)
            output.write (buffer.data(), count);
    }
    require (input.eof(), "Could not finish reading Bounce source bank");
    output.flush();
    require (static_cast<bool> (output), "Could not finish Bounce staging bank");
    output.close();
    flushFile (destination);
}

bool validDigest (const std::string& digest)
{
    try
    {
        static_cast<void> (Sha256::fromHex (digest));
        return true;
    }
    catch (...)
    {
        return false;
    }
}

std::string digestFromFilename (const std::string& filename)
{
    constexpr auto prefix = "bank-";
    constexpr auto suffix = ".csbk";
    if (filename.size() != std::strlen (prefix) + 64 + std::strlen (suffix)
        || filename.compare (0, std::strlen (prefix), prefix) != 0
        || filename.compare (filename.size() - std::strlen (suffix),
                             std::strlen (suffix), suffix) != 0)
        return {};
    const auto digest = filename.substr (std::strlen (prefix), 64);
    return validDigest (digest) ? digest : std::string {};
}

std::filesystem::path uniqueStagingPath (const std::filesystem::path& root,
                                         const std::string& digest)
{
    static std::atomic<std::uint64_t> sequence { 0 };
    const auto tick = static_cast<std::uint64_t> (
        std::chrono::steady_clock::now().time_since_epoch().count());
    return root / (".staging-" + digest + "-"
                   + std::to_string (static_cast<long long> (::getpid())) + "-"
                   + std::to_string (tick) + "-"
                   + std::to_string (sequence.fetch_add (1)) + ".tmp");
}

std::vector<std::string> listDigestsUnlocked (const std::filesystem::path& root)
{
    std::vector<std::string> digests;
    for (const auto& entry : std::filesystem::directory_iterator (root))
    {
        if (! entry.is_regular_file())
            continue;
        if (auto digest = digestFromFilename (entry.path().filename().string());
            ! digest.empty())
            digests.push_back (std::move (digest));
    }
    std::sort (digests.begin(), digests.end());
    return digests;
}

struct RemoveOnExit
{
    std::filesystem::path path;
    ~RemoveOnExit()
    {
        std::error_code ignored;
        if (! path.empty())
            std::filesystem::remove (path, ignored);
    }
};

class ScopedStoreLock final
{
public:
    ScopedStoreLock (const std::filesystem::path& root, int operation)
    {
        descriptor = ::open ((root / ".gc.lock").c_str(),
                             O_CREAT | O_RDWR,
                             S_IRUSR | S_IWUSR);
        if (descriptor < 0)
            throw std::system_error (errno, std::generic_category(),
                                     "Could not open the native Bounce store lock");
        if (::flock (descriptor, operation) != 0)
        {
            const auto savedError = errno;
            ::close (descriptor);
            descriptor = -1;
            throw std::system_error (savedError, std::generic_category(),
                                     "Could not acquire the native Bounce store lock");
        }
    }

    ~ScopedStoreLock()
    {
        if (descriptor >= 0)
        {
            ::flock (descriptor, LOCK_UN);
            ::close (descriptor);
        }
    }

    ScopedStoreLock (const ScopedStoreLock&) = delete;
    ScopedStoreLock& operator= (const ScopedStoreLock&) = delete;

private:
    int descriptor = -1;
};

} // namespace

BankFileInfo validateBounceBankFile (const std::filesystem::path& path)
{
    require (std::filesystem::is_regular_file (path),
             "Bounce bank is not a regular file: " + path.string());
    const auto size = std::filesystem::file_size (path);
    require (size >= bounceBankFixedHeaderBytes,
             "Bounce bank header is truncated");
    const auto headerProbeLength = std::min<std::uint64_t> (
        size, bounceBankFixedHeaderBytes + maxBankRootCount * bounceBankRootRecordBytes);
    std::vector<std::uint8_t> header (static_cast<std::size_t> (headerProbeLength));
    std::ifstream input (path, std::ios::binary);
    require (static_cast<bool> (input), "Could not open Bounce bank " + path.string());
    input.read (reinterpret_cast<char*> (header.data()),
                static_cast<std::streamsize> (header.size()));
    require (static_cast<std::size_t> (input.gcount()) == header.size(),
             "Bounce bank header read was truncated");
    return validateBankBytes (header.data(), size);
}

std::string digestBounceBankFile (const std::filesystem::path& path)
{
    return Sha256::toHex (Sha256::hashFile (path));
}

BounceBankFileBuilder::BounceBankFileBuilder (std::filesystem::path payloadPathToUse,
                                              std::uint32_t sampleRateToUse)
    : payloadPath (std::move (payloadPathToUse)),
      sampleRate (sampleRateToUse)
{
    require (sampleRate > 0, "Bounce bank builder sample rate is invalid");
    require (! payloadPath.empty(), "Bounce bank builder payload path is empty");
    std::filesystem::create_directories (payloadPath.parent_path());
    payload.open (payloadPath, std::ios::binary | std::ios::trunc);
    require (static_cast<bool> (payload), "Could not create Bounce payload staging file");
}

BounceBankFileBuilder::~BounceBankFileBuilder()
{
    abort();
}

void BounceBankFileBuilder::append (RootCapture&& root)
{
    require (! finished && payload.is_open(), "Bounce bank builder is closed");
    require (roots.size() < maxBankRootCount, "Bounce bank has too many roots");
    require (root.rootIndex == roots.size(), "Bounce roots arrived out of order");
    require (root.rootNote >= 0 && root.rootNote <= 127
                && (roots.empty() || root.rootNote > roots.back().note),
             "Bounce roots must be strictly ascending MIDI notes");
    require (root.frameCount > 0
                && root.interleavedStereo.size()
                    == static_cast<std::size_t> (root.frameCount) * 2,
             "Bounce root PCM does not match its frame count");
    require (root.noteOffFrameOffset == 0
                || root.noteOffFrameOffset < root.frameCount,
             "Bounce root note-off offset is invalid");
    require (static_cast<std::uint64_t> (totalFrameCount) + root.frameCount
                <= maxBankFrameCapacity,
             "Bounce roots exceed the live bank frame capacity");

    std::array<std::uint8_t, 16 * 1024> bytes {};
    auto sampleOffset = std::size_t { 0 };
    while (sampleOffset < root.interleavedStereo.size())
    {
        const auto sampleCount = std::min (root.interleavedStereo.size() - sampleOffset,
                                           bytes.size() / 2);
        for (std::size_t index = 0; index < sampleCount; ++index)
        {
            const auto value = static_cast<std::uint16_t> (
                root.interleavedStereo[sampleOffset + index]);
            bytes[index * 2] = static_cast<std::uint8_t> (value);
            bytes[index * 2 + 1] = static_cast<std::uint8_t> (value >> 8);
        }
        payload.write (reinterpret_cast<const char*> (bytes.data()),
                       static_cast<std::streamsize> (sampleCount * 2));
        require (static_cast<bool> (payload), "Could not append Bounce root PCM");
        sampleOffset += sampleCount;
    }

    roots.push_back ({ root.rootNote,
                       totalFrameCount,
                       root.frameCount,
                       root.noteOffFrameOffset });
    totalFrameCount += root.frameCount;
}

BankFileInfo BounceBankFileBuilder::finish (const std::filesystem::path& bankPath)
{
    require (! finished && payload.is_open(), "Bounce bank builder is closed");
    require (! roots.empty(), "Bounce bank cannot be empty");
    require (! bankPath.empty(), "Bounce bank output path is empty");
    payload.flush();
    require (static_cast<bool> (payload), "Could not flush Bounce payload staging file");
    payload.close();
    flushFile (payloadPath);

    std::filesystem::create_directories (bankPath.parent_path());
    std::ofstream output (bankPath, std::ios::binary | std::ios::trunc);
    require (static_cast<bool> (output), "Could not create encoded Bounce bank");
    const auto headerLength = bounceBankFixedHeaderBytes
                            + static_cast<std::uint32_t> (roots.size())
                                * bounceBankRootRecordBytes;
    std::vector<std::uint8_t> header (headerLength);
    std::copy (bankMagic.begin(), bankMagic.end(), header.begin());
    writeLE32 (header.data() + 8, headerLength);
    writeLE32 (header.data() + 12, bounceBankVersion);
    writeLE32 (header.data() + 16, sampleRate);
    writeLE32 (header.data() + 20, static_cast<std::uint32_t> (roots.size()));
    writeLE32 (header.data() + 24, totalFrameCount);
    writeLE32 (header.data() + 28, 0);
    for (std::size_t index = 0; index < roots.size(); ++index)
    {
        auto* record = header.data() + bounceBankFixedHeaderBytes
                     + index * bounceBankRootRecordBytes;
        writeLE32 (record, static_cast<std::uint32_t> (roots[index].note));
        writeLE32 (record + 4, roots[index].frameOffset);
        writeLE32 (record + 8, roots[index].frameCount);
        writeLE32 (record + 12, roots[index].noteOffFrameOffset);
    }
    output.write (reinterpret_cast<const char*> (header.data()),
                  static_cast<std::streamsize> (header.size()));

    std::ifstream input (payloadPath, std::ios::binary);
    require (static_cast<bool> (input), "Could not reopen Bounce payload staging file");
    std::array<char, 64 * 1024> copyBuffer {};
    while (input)
    {
        input.read (copyBuffer.data(), static_cast<std::streamsize> (copyBuffer.size()));
        if (const auto count = input.gcount(); count > 0)
            output.write (copyBuffer.data(), count);
    }
    require (input.eof(), "Could not finish Bounce payload read");
    output.flush();
    require (static_cast<bool> (output), "Could not finish encoded Bounce bank");
    output.close();
    flushFile (bankPath);

    const auto info = validateBounceBankFile (bankPath);
    std::error_code removeError;
    std::filesystem::remove (payloadPath, removeError);
    require (! removeError, "Could not remove Bounce payload staging file");
    finished = true;
    return info;
}

void BounceBankFileBuilder::abort() noexcept
{
    if (payload.is_open())
        payload.close();
    if (! finished && ! payloadPath.empty())
    {
        std::error_code ignored;
        std::filesystem::remove (payloadPath, ignored);
    }
    finished = true;
}

BounceBankStore::ExclusiveLock::~ExclusiveLock()
{
    if (descriptor >= 0)
    {
        ::flock (descriptor, LOCK_UN);
        ::close (descriptor);
    }
}

BounceBankStore::ExclusiveLock::ExclusiveLock (ExclusiveLock&& other) noexcept
    : descriptor (std::exchange (other.descriptor, -1)),
      ownerRoot (std::move (other.ownerRoot))
{
}

BounceBankStore::ExclusiveLock& BounceBankStore::ExclusiveLock::operator= (
    ExclusiveLock&& other) noexcept
{
    if (this != &other)
    {
        if (descriptor >= 0)
        {
            ::flock (descriptor, LOCK_UN);
            ::close (descriptor);
        }
        descriptor = std::exchange (other.descriptor, -1);
        ownerRoot = std::move (other.ownerRoot);
    }
    return *this;
}

BounceBankStore::BounceBankStore (std::filesystem::path rootDirectoryToUse,
                                  FilePreparation filePreparationToUse)
    : filePreparation (std::move (filePreparationToUse))
{
    require (! rootDirectoryToUse.empty(), "Native Bounce store root is empty");
    rootDirectory = std::filesystem::absolute (std::move (rootDirectoryToUse)).lexically_normal();
}

void BounceBankStore::prepareFile (const std::filesystem::path& path) const
{
    if (filePreparation)
        filePreparation (path);
}

void BounceBankStore::initialise()
{
    std::filesystem::create_directories (rootDirectory);
    require (std::filesystem::is_directory (rootDirectory),
             "Native Bounce store root is not a directory");
    // Cleanup holds the same exclusive lock as retirement. Publishers and
    // readers take shared locks, so a newly started instance cannot unlink
    // another process's active stage or an open verification candidate.
    const ScopedStoreLock storeLock (rootDirectory, LOCK_EX);
    for (const auto& entry : std::filesystem::directory_iterator (rootDirectory))
    {
        const auto name = entry.path().filename().string();
        if (name.rfind (".staging-", 0) == 0 && entry.is_regular_file())
            std::filesystem::remove (entry.path());
    }
    flushDirectory (rootDirectory);
}

std::filesystem::path BounceBankStore::bankPath (const std::string& digest) const
{
    require (validDigest (digest), "Native Bounce digest is invalid");
    return rootDirectory / ("bank-" + digest + ".csbk");
}

void BounceBankStore::verifyPublished (const std::string& digest,
                                       const std::filesystem::path& path) const
{
    static_cast<void> (validateBounceBankFile (path));
    require (digestBounceBankFile (path) == digest,
             "Native Bounce bank SHA-256 does not match its content name");
}

PublishResult BounceBankStore::publish (const std::string& digest,
                                        const std::filesystem::path& source)
{
    require (validDigest (digest), "Native Bounce publish digest is invalid");
    const auto sourceInfo = validateBounceBankFile (source);
    require (digestBounceBankFile (source) == digest,
             "Native Bounce source bank SHA-256 mismatch");
    std::filesystem::create_directories (rootDirectory);
    const ScopedStoreLock storeLock (rootDirectory, LOCK_SH);
    const auto destination = bankPath (digest);
    if (std::filesystem::exists (destination))
    {
        verifyPublished (digest, destination);
        prepareFile (destination);
        verifyPublished (digest, destination);
        return { destination, validateBounceBankFile (destination), true };
    }

    const auto staging = uniqueStagingPath (rootDirectory, digest);
    RemoveOnExit cleanup { staging };
    copyFileStrict (source, staging);
    verifyPublished (digest, staging);
    // iOS applies backup exclusion and first-unlock data protection here.
    // The no-replace hard link below publishes the same inode and attributes.
    prepareFile (staging);
    flushFile (staging);
    verifyPublished (digest, staging);

    if (::link (staging.c_str(), destination.c_str()) != 0)
    {
        if (errno != EEXIST)
            throw std::system_error (errno, std::generic_category(),
                                     "Could not atomically publish Bounce bank");
        verifyPublished (digest, destination);
        prepareFile (destination);
        verifyPublished (digest, destination);
        return { destination, validateBounceBankFile (destination), true };
    }
    std::filesystem::remove (staging);
    cleanup.path.clear();
    flushDirectory (rootDirectory);
    verifyPublished (digest, destination);
    return { destination, sourceInfo, false };
}

std::optional<std::vector<std::uint8_t>> BounceBankStore::readVerified (
    const std::string& digest,
    std::optional<std::uint64_t> expectedByteLength) const
{
    if (! std::filesystem::is_directory (rootDirectory))
        return std::nullopt;
    const ScopedStoreLock storeLock (rootDirectory, LOCK_SH);
    const auto path = bankPath (digest);
    if (! std::filesystem::exists (path))
        return std::nullopt;
    const auto info = validateBounceBankFile (path);
    if (expectedByteLength.has_value())
        require (info.byteLength == *expectedByteLength,
                 "Native Bounce bank length does not match bounce.v1");
    require (digestBounceBankFile (path) == digest,
             "Native Bounce bank failed SHA-256 verification");
    return readWholeFile (path);
}

std::vector<std::string> BounceBankStore::listDigests() const
{
    if (! std::filesystem::is_directory (rootDirectory))
        return {};
    const ScopedStoreLock storeLock (rootDirectory, LOCK_SH);
    return listDigestsUnlocked (rootDirectory);
}

StoreUsage BounceBankStore::usage() const
{
    if (! std::filesystem::is_directory (rootDirectory))
        return {};
    const ScopedStoreLock storeLock (rootDirectory, LOCK_SH);
    StoreUsage result;
    for (const auto& digest : listDigestsUnlocked (rootDirectory))
    {
        ++result.bankCount;
        result.byteLength += std::filesystem::file_size (bankPath (digest));
    }
    return result;
}

std::optional<BounceBankStore::ExclusiveLock> BounceBankStore::tryAcquireExclusiveLock() const
{
    if (! std::filesystem::is_directory (rootDirectory))
        return std::nullopt;
    const auto path = rootDirectory / ".gc.lock";
    const auto descriptor = ::open (path.c_str(), O_CREAT | O_RDWR, S_IRUSR | S_IWUSR);
    if (descriptor < 0)
        return std::nullopt;
    if (::flock (descriptor, LOCK_EX | LOCK_NB) != 0)
    {
        ::close (descriptor);
        return std::nullopt;
    }
    ExclusiveLock lock;
    lock.descriptor = descriptor;
    lock.ownerRoot = rootDirectory;
    return lock;
}

bool BounceBankStore::remove (const std::string& digest, const ExclusiveLock& lock)
{
    require (lock.descriptor >= 0 && lock.ownerRoot == rootDirectory,
             "Native Bounce deletion requires this store's exclusive lock");
    const auto path = bankPath (digest);
    if (! std::filesystem::exists (path))
        return false;
    // Verify immediately before unlink so GC never turns a corrupt/unknown file
    // into an apparently successful retirement.
    verifyPublished (digest, path);
    const auto removed = std::filesystem::remove (path);
    if (removed)
        flushDirectory (rootDirectory);
    return removed;
}

std::vector<std::uint8_t> createPortableBounceEnvelope (
    const std::string& digest,
    const std::vector<std::uint8_t>& bankBytes)
{
    require (validDigest (digest), "Portable Bounce digest is invalid");
    static_cast<void> (validateBankBytes (bankBytes.data(), bankBytes.size()));
    require (Sha256::toHex (Sha256::hash (bankBytes.data(), bankBytes.size())) == digest,
             "Portable Bounce bank digest mismatch");
    std::vector<std::uint8_t> envelope (
        static_cast<std::size_t> (envelopeHeaderBytes) + bankBytes.size());
    std::copy (envelopeMagic.begin(), envelopeMagic.end(), envelope.begin());
    writeLE32 (envelope.data() + 8, envelopeVersion);
    writeLE32 (envelope.data() + 12, 0);
    const auto rawDigest = Sha256::fromHex (digest);
    std::copy (rawDigest.begin(), rawDigest.end(), envelope.begin() + 16);
    writeLE64 (envelope.data() + 48, bankBytes.size());
    std::copy (bankBytes.begin(), bankBytes.end(), envelope.begin() + envelopeHeaderBytes);
    return envelope;
}

std::vector<std::uint8_t> readPortableBounceEnvelope (
    const std::vector<std::uint8_t>& envelope,
    std::string* digestOut)
{
    require (envelope.size() >= envelopeHeaderBytes,
             "Portable Bounce envelope is truncated");
    require (std::equal (envelopeMagic.begin(), envelopeMagic.end(), envelope.begin()),
             "Portable Bounce envelope magic is invalid");
    require (readLE32 (envelope.data() + 8) == envelopeVersion
                && readLE32 (envelope.data() + 12) == 0,
             "Portable Bounce envelope version is unsupported");
    const auto bankLength = readLE64 (envelope.data() + 48);
    require (bankLength == envelope.size() - envelopeHeaderBytes,
             "Portable Bounce envelope length is invalid");
    std::vector<std::uint8_t> bank (
        envelope.begin() + static_cast<std::ptrdiff_t> (envelopeHeaderBytes),
        envelope.end());
    static_cast<void> (validateBankBytes (bank.data(), bank.size()));
    Sha256::Digest storedDigest {};
    std::copy_n (envelope.begin() + 16, storedDigest.size(), storedDigest.begin());
    const auto expectedDigest = Sha256::toHex (storedDigest);
    require (Sha256::hash (bank.data(), bank.size()) == storedDigest,
             "Portable Bounce envelope SHA-256 mismatch");
    if (digestOut != nullptr)
        *digestOut = expectedDigest;
    return bank;
}

} // namespace cosimo::bounce
