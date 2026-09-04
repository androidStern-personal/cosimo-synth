// Read the factory advertised by the actual macOS bundle. Do not substitute
// moduleinfo.json or a factory compiled from the candidate's build settings.
#include <CoreFoundation/CoreFoundation.h>
#include "pluginterfaces/base/ipluginbase.h"

#include <cstring>
#include <cerrno>
#include <iostream>
#include <stdexcept>
#include <string>
#include <sys/stdio.h>

namespace
{
template <typename T> struct CFHandle
{
    T value;
    ~CFHandle() { if (value != nullptr) CFRelease (value); }
};

std::string asString (CFTypeRef value)
{
    if (value == nullptr || CFGetTypeID (value) != CFStringGetTypeID())
        throw std::runtime_error ("Missing or invalid bundle string metadata");

    auto string = static_cast<CFStringRef> (value);
    std::string result (static_cast<size_t> (CFStringGetMaximumSizeForEncoding (
        CFStringGetLength (string), kCFStringEncodingUTF8)) + 1, '\0');

    if (! CFStringGetCString (string, result.data(), static_cast<CFIndex> (result.size()), kCFStringEncodingUTF8))
        throw std::runtime_error ("Bundle metadata is not readable UTF-8");

    result.resize (std::strlen (result.c_str()));
    if (result.empty())
        throw std::runtime_error ("Empty bundle string metadata");
    return result;
}

std::string jsonString (const std::string& value)
{
    static constexpr auto digits = "0123456789abcdef";
    std::string result = "\"";
    for (unsigned char character : value)
    {
        if (character == '"' || character == '\\')
            result += std::string ("\\") + static_cast<char> (character);
        else if (character < 32)
        {
            result += "\\u00";
            result += digits[character >> 4];
            result += digits[character & 15];
        }
        else
            result += static_cast<char> (character);
    }
    return result + "\"";
}

struct LoadedBundle
{
    explicit LoadedBundle (CFBundleRef nextBundle) : bundle (nextBundle)
    {
        if (! CFBundleLoadExecutable (bundle))
            throw std::runtime_error ("Could not load the bundle executable");

        auto entry = reinterpret_cast<bool (*) (CFBundleRef)> (
            CFBundleGetFunctionPointerForName (bundle, CFSTR ("bundleEntry")));
        exit = reinterpret_cast<bool (*)()> (
            CFBundleGetFunctionPointerForName (bundle, CFSTR ("bundleExit")));

        if (entry == nullptr || exit == nullptr || ! entry (bundle))
            throw std::runtime_error ("Missing or unsuccessful VST3 bundle entry point");
    }

    ~LoadedBundle() { exit(); CFBundleUnloadExecutable (bundle); }
    CFBundleRef bundle;
    bool (*exit)() = nullptr;
};

struct FactoryHandle
{
    Steinberg::IPluginFactory* value;
    ~FactoryHandle() { if (value != nullptr) value->release(); }
};

void inspect (const char* bundlePath)
{
    CFHandle<CFURLRef> url { CFURLCreateFromFileSystemRepresentation (
        nullptr, reinterpret_cast<const UInt8*> (bundlePath), static_cast<CFIndex> (std::strlen (bundlePath)), true) };
    if (url.value == nullptr)
        throw std::runtime_error ("Invalid bundle path");

    CFHandle<CFBundleRef> bundle { CFBundleCreate (nullptr, url.value) };
    if (bundle.value == nullptr)
        throw std::runtime_error ("Could not open the bundle");

    LoadedBundle loaded { bundle.value };
    auto getFactory = reinterpret_cast<Steinberg::IPluginFactory* (*)()> (
        CFBundleGetFunctionPointerForName (bundle.value, CFSTR ("GetPluginFactory")));
    if (getFactory == nullptr)
        throw std::runtime_error ("Missing VST3 GetPluginFactory export");

    FactoryHandle factory { getFactory() };
    if (factory.value == nullptr)
        throw std::runtime_error ("VST3 factory is unavailable");

    const auto count = factory.value->countClasses();
    if (count < 1 || count > 64)
        throw std::runtime_error ("Invalid VST3 factory class count");

    Steinberg::PClassInfo processor {};
    int processorCount = 0;
    for (Steinberg::int32 index = 0; index < count; ++index)
    {
        Steinberg::PClassInfo info {};
        if (factory.value->getClassInfo (index, &info) != Steinberg::kResultOk
            || std::memchr (info.category, '\0', sizeof (info.category)) == nullptr)
            throw std::runtime_error ("Unreadable VST3 factory class information");

        if (std::strcmp (info.category, "Audio Module Class") == 0)
        {
            processor = info;
            ++processorCount;
        }
    }

    if (processorCount != 1)
        throw std::runtime_error ("Expected exactly one VST3 audio processor class");
    if (processor.name[0] == '\0' || std::memchr (processor.name, '\0', sizeof (processor.name)) == nullptr)
        throw std::runtime_error ("Unreadable VST3 processor display name");

    static constexpr auto digits = "0123456789ABCDEF";
    std::string cid;
    bool nonzero = false;
    for (unsigned char byte : processor.cid)
    {
        cid += digits[byte >> 4];
        cid += digits[byte & 15];
        nonzero = nonzero || byte != 0;
    }
    if (! nonzero)
        throw std::runtime_error ("Empty VST3 processor class identifier");

    // Independently read the identity from the bundle that was actually loaded.
    const auto bundleIdentifier = asString (CFBundleGetValueForInfoDictionaryKey (
        bundle.value, kCFBundleIdentifierKey));
    CFHandle<CFURLRef> executableURL { CFBundleCopyExecutableURL (bundle.value) };
    if (executableURL.value == nullptr)
        throw std::runtime_error ("Missing bundle executable URL");
    CFHandle<CFStringRef> executablePath { CFURLCopyFileSystemPath (executableURL.value, kCFURLPOSIXPathStyle) };

    std::cout << "{\"schemaVersion\":1,\"bundleIdentifier\":" << jsonString (bundleIdentifier)
              << ",\"processorClassId\":" << jsonString (cid)
              << ",\"displayName\":" << jsonString (processor.name)
              << ",\"binaryPath\":" << jsonString (asString (executablePath.value)) << "}\n";
}
}

int main (int argc, const char* argv[])
{
    try
    {
        if (argc == 4 && std::strcmp (argv[1], "--move-exclusive") == 0)
        {
            // Node's rename can replace an existing path. Transaction moves
            // must never overwrite a path that appeared after preflight.
            if (renamex_np (argv[2], argv[3], RENAME_EXCL) != 0)
                throw std::runtime_error (std::string ("Exclusive bundle move failed: ") + std::strerror (errno));
            return 0;
        }
        if (argc != 2)
            throw std::runtime_error ("Usage: kit_vst3_identity_probe <bundle> | --move-exclusive <source> <destination>");
        inspect (argv[1]);
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "VST3 bundle operation failed: " << error.what() << '\n';
        return 1;
    }
}
