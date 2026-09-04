// An actual loadable factory, with no processor or editor implementation.
// Calling createInstance is a test failure; install preflight must only inspect.
#include "pluginterfaces/base/ipluginbase.h"
#include <cstdlib>
#include <csignal>
#include <cstring>
#include <unistd.h>

#if FIXTURE_VARIANT != 8
[[gnu::used]] static const char markers[] =
    "chocHostKeyboard __chocHostKeyboardBridgeInstalled __chocUserFiles chocUserFiles";
#endif

class Factory final : public Steinberg::IPluginFactory
{
public:
    Steinberg::tresult PLUGIN_API queryInterface (const Steinberg::TUID, void** result) override
    {
        *result = nullptr;
        return Steinberg::kNoInterface;
    }
    Steinberg::uint32 PLUGIN_API addRef() override { return 1; }
    Steinberg::uint32 PLUGIN_API release() override { return 1; }
    Steinberg::tresult PLUGIN_API getFactoryInfo (Steinberg::PFactoryInfo*) override { return Steinberg::kNotImplemented; }
    Steinberg::int32 PLUGIN_API countClasses() override { return FIXTURE_VARIANT == 2 ? 2 : 1; }
    Steinberg::tresult PLUGIN_API getClassInfo (Steinberg::int32 index, Steinberg::PClassInfo* info) override
    {
        if (FIXTURE_VARIANT == 3)
            return Steinberg::kInternalError;
        if (FIXTURE_VARIANT == 4)
            for (;;) pause();
        if (FIXTURE_VARIANT == 5)
            _exit (71);
        if (FIXTURE_VARIANT == 7)
            std::raise (SIGKILL);
        std::memset (info, 0, sizeof (*info));
        info->cid[0] = FIXTURE_VARIANT == 1 ? 2 : 1;
        info->cid[15] = static_cast<char> (index + 1);
        std::strcpy (info->category, FIXTURE_VARIANT == 6 ? "Component Controller Class" : "Audio Module Class");
        std::strcpy (info->name, "Fixture Tone");
        return Steinberg::kResultOk;
    }
    Steinberg::tresult PLUGIN_API createInstance (Steinberg::FIDString, Steinberg::FIDString, void**) override
    {
        std::abort();
    }
};

extern "C" __attribute__((visibility("default"))) bool bundleEntry (void*) { return true; }
extern "C" __attribute__((visibility("default"))) bool bundleExit() { return true; }
extern "C" __attribute__((visibility("default"))) Steinberg::IPluginFactory* GetPluginFactory()
{
    static Factory factory;
    return &factory;
}
