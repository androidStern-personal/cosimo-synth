#include <cassert>
#include <iostream>
#include <string>

#undef CHOC_ASSERT
#define CHOC_ASSERT(x) assert(x)
#define CMAJOR_DLL 1

#include "cmajor/helpers/cmaj_Patch.h"

namespace
{
struct StateObserver  : public cmaj::PatchView
{
    explicit StateObserver (cmaj::Patch& patch) : PatchView (patch) {}

    void sendMessage (const choc::value::ValueView& message) override
    {
        if (message["type"].toString() != "state_key_value")
            return;

        const auto payload = message["message"];

        if (payload["key"].toString() == "modulation.v2")
        {
            ++messageCount;
            lastValue = payload["value"].toString();
        }
    }

    int messageCount = 0;
    std::string lastValue;
};

int fail (const char* message)
{
    std::cerr << "FAIL: " << message << '\n';
    return 1;
}
}

int main()
{
    cmaj::Patch patch;
    StateObserver observer (patch);

    patch.setStoredStateValue ("modulation.v2", choc::value::Value ("first"));

    if (observer.messageCount != 1 || observer.lastValue != "first")
        return fail ("initial string-valued stored state was not broadcast");

    patch.setStoredStateValue ("modulation.v2", choc::value::Value ("first"));

    if (observer.messageCount != 1)
        return fail ("equal string content produced a redundant broadcast");

    patch.setStoredStateValue ("modulation.v2", choc::value::Value ("second"));

    if (observer.messageCount != 2 || observer.lastValue != "second")
        return fail ("different string content was mistaken for the same dictionary handle");

    const auto storedValue = patch.getStoredStateValues().at ("modulation.v2").toString();

    if (storedValue != "second")
        return fail ("different string content did not replace the stored value");

    std::cout << "PASS: Cmajor compares stored string state by content\n";
    return 0;
}
