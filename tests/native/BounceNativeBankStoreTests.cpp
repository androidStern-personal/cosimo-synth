#include <algorithm>
#include <chrono>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <system_error>
#include <vector>

#include <unistd.h>

#include "../../native/bounce/BounceNativeBankStore.h"

namespace
{
using namespace cosimo::bounce;

void expect (bool condition, const char* message)
{
    if (! condition)
        throw std::runtime_error (message);
}

class TestDirectory final
{
public:
    TestDirectory()
    {
        const auto tick = std::chrono::steady_clock::now().time_since_epoch().count();
        path = std::filesystem::temp_directory_path()
             / ("cosimo-bounce-store-test-" + std::to_string (::getpid())
                + "-" + std::to_string (tick));
        std::filesystem::create_directories (path);
    }

    ~TestDirectory()
    {
        std::error_code ignored;
        std::filesystem::remove_all (path, ignored);
    }

    std::filesystem::path path;
};

RootCapture createRoot (std::uint32_t index,
                        std::int32_t note,
                        std::uint32_t frames,
                        std::uint32_t noteOff)
{
    RootCapture root;
    root.rootIndex = index;
    root.rootNote = note;
    root.noteOffFrameOffset = noteOff;
    root.frameCount = frames;
    root.tailFrameCount = frames - noteOff;
    root.peak = 0.5f;
    root.interleavedStereo.resize (static_cast<std::size_t> (frames) * 2);
    for (std::size_t sample = 0; sample < root.interleavedStereo.size(); ++sample)
        root.interleavedStereo[sample] = static_cast<std::int16_t> (
            (static_cast<std::int32_t> (sample * 97 + note * 13) % 32767) - 16384);
    return root;
}

std::filesystem::path createBank (const std::filesystem::path& directory)
{
    const auto payload = directory / ".payload.tmp";
    const auto bank = directory / "capture.csbk";
    BounceBankFileBuilder builder (payload, 48000);
    builder.append (createRoot (0, 48, 257, 128));
    builder.append (createRoot (1, 60, 311, 200));
    const auto info = builder.finish (bank);
    expect (info.sampleRate == 48000
                && info.totalFrameCount == 568
                && info.roots.size() == 2
                && info.roots[1].frameOffset == 257
                && info.roots[1].noteOffFrameOffset == 200,
            "streaming bank builder lost canonical metadata");
    expect (! std::filesystem::exists (payload),
            "streaming bank builder retained its payload staging file");
    return bank;
}

void testSha256()
{
    const std::string empty;
    const std::string abc = "abc";
    expect (Sha256::toHex (Sha256::hash (empty.data(), empty.size()))
                == "e3b0c44298fc1c149afbf4c8996fb924"
                   "27ae41e4649b934ca495991b7852b855",
            "SHA-256 empty vector mismatch");
    expect (Sha256::toHex (Sha256::hash (abc.data(), abc.size()))
                == "ba7816bf8f01cfea414140de5dae2223"
                   "b00361a396177a9cb410ff61f20015ad",
            "SHA-256 abc vector mismatch");
}

void testBuilderStoreAndEnvelope()
{
    TestDirectory temporary;
    const auto source = createBank (temporary.path);
    const auto sourceInfo = validateBounceBankFile (source);
    const auto digest = digestBounceBankFile (source);
    expect (digest.size() == 64, "bank digest is not lowercase SHA-256");

    const auto storeRoot = temporary.path / "CosimoSynth" / "BounceBanks" / "v1";
    std::filesystem::create_directories (storeRoot);
    {
        std::ofstream stale (storeRoot / (".staging-" + digest + "-stale.tmp"));
        stale << "partial";
    }
    BounceBankStore store (storeRoot);
    store.initialise();
    expect (std::none_of (std::filesystem::directory_iterator (storeRoot),
                          std::filesystem::directory_iterator {},
                          [] (const auto& entry)
                          {
                              return entry.path().filename().string().rfind (".staging-", 0) == 0;
                          }),
            "store startup did not remove stale staging files");

    const auto first = store.publish (digest, source);
    expect (! first.alreadyExisted && first.bank.byteLength == sourceInfo.byteLength,
            "first content-addressed publish was not new");
    const auto second = store.publish (digest, source);
    expect (second.alreadyExisted && second.path == first.path,
            "idempotent content-addressed publish rewrote the bank");
    expect (store.listDigests() == std::vector<std::string> ({ digest }),
            "store index exposed a non-bank file or lost the bank");
    const auto usage = store.usage();
    expect (usage.bankCount == 1 && usage.byteLength == sourceInfo.byteLength,
            "store usage accounting is incorrect");

    const auto bytes = store.readVerified (digest, sourceInfo.byteLength);
    expect (bytes.has_value() && bytes->size() == sourceInfo.byteLength,
            "store could not read its verified content");
    auto envelope = createPortableBounceEnvelope (digest, *bytes);
    std::string restoredDigest;
    const auto restored = readPortableBounceEnvelope (envelope, &restoredDigest);
    expect (restoredDigest == digest && restored == *bytes,
            "binary portable envelope did not round-trip exact bank bytes");
    envelope.back() ^= 0x01;
    bool rejectedCorruptEnvelope = false;
    try
    {
        static_cast<void> (readPortableBounceEnvelope (envelope));
    }
    catch (const std::runtime_error&)
    {
        rejectedCorruptEnvelope = true;
    }
    expect (rejectedCorruptEnvelope,
            "binary portable envelope accepted corrupt embedded PCM");

    BounceBankStore secondProcessView (storeRoot);
    auto lock = store.tryAcquireExclusiveLock();
    expect (lock.has_value(), "store could not acquire its interprocess GC lock");
    expect (! secondProcessView.tryAcquireExclusiveLock().has_value(),
            "interprocess GC lock admitted a second writer");
    expect (store.remove (digest, *lock),
            "locked retirement did not remove the explicit bank");
    expect (store.listDigests().empty() && ! store.readVerified (digest).has_value(),
            "retired bank remained reachable in the store");
}

void testEmptyStoreRootIsRejected()
{
    bool rejected = false;
    try
    {
        static_cast<void> (BounceBankStore ({}));
    }
    catch (const std::runtime_error&)
    {
        rejected = true;
    }
    expect (rejected, "store resolved an empty root to the current directory");
}

void testCorruptAndMismatchedBanksStayVisible()
{
    TestDirectory temporary;
    const auto source = createBank (temporary.path);
    const auto digest = digestBounceBankFile (source);
    BounceBankStore store (temporary.path / "store");
    store.initialise();

    bool rejectedWrongDigest = false;
    try
    {
        static_cast<void> (store.publish (std::string (64, '0'), source));
    }
    catch (const std::runtime_error&)
    {
        rejectedWrongDigest = true;
    }
    expect (rejectedWrongDigest, "store published a bank under the wrong digest");

    static_cast<void> (store.publish (digest, source));
    {
        std::fstream corrupt (store.bankPath (digest),
                              std::ios::binary | std::ios::in | std::ios::out);
        corrupt.seekg (-1, std::ios::end);
        char value = 0;
        corrupt.read (&value, 1);
        corrupt.clear();
        corrupt.seekp (-1, std::ios::end);
        value ^= 0x7f;
        corrupt.write (&value, 1);
    }
    bool rejectedCorruptRead = false;
    try
    {
        static_cast<void> (store.readVerified (digest));
    }
    catch (const std::runtime_error&)
    {
        rejectedCorruptRead = true;
    }
    expect (rejectedCorruptRead,
            "store returned a same-named bank after integrity corruption");
}
}

int main()
{
    try
    {
        testSha256();
        testBuilderStoreAndEnvelope();
        testEmptyStoreRootIsRejected();
        testCorruptAndMismatchedBanksStayVisible();
        std::cout << "PASS native Bounce bank streaming, SHA-256, atomic store, lock, and binary envelope\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL native Bounce bank store: " << error.what() << '\n';
        return 1;
    }
}
