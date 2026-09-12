#include <chrono>
#include <iostream>
#include <memory>
#include <mutex>
#include "choc/gui/choc_MessageLoop.h"

// The old macOS implementation queued a raw Pimpl address. Cancelling a timer
// freed that address, letting its queued callback fire a newly allocated timer.
// This reproduced a 10-second resource deadline firing after only 65 ms.
int main()
{
    using namespace choc::messageloop;
    initialise();
    struct State {
        bool replacementFired = false, ordinaryTimerFired = false;
        int mutableTicks = 0, repeatingCalls = 0, selfClearingCalls = 0;
        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
    } state;
    { Timer cancelled (1, [] { return false; }); }
    Timer replacement (10000, [&]
    {
        state.replacementFired = true;
        const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - state.start).count();
        std::cerr << "FAIL: cancelled timer fired a 10000 ms replacement after " << elapsed << " ms\n";
        stop();
        return false;
    });
    Timer ordinary (10, [&] { state.ordinaryTimerFired = true; return false; });
    Timer repeating (1, [&, count = 0]() mutable
    {
        state.mutableTicks = ++count;
        ++state.repeatingCalls;
        return count < 3;
    });
    std::unique_ptr<Timer> selfClearing;
    selfClearing = std::make_unique<Timer> (2, [&]
    {
        ++state.selfClearingCalls;
        selfClearing.reset();
        return true;
    });
    Timer watchdog (100, [&] { stop(); return false; });
    run();
    if (state.replacementFired) return 1;
    if (!state.ordinaryTimerFired) { std::cerr << "FAIL: the real native timer loop did not execute\n"; return 1; }
    if (state.mutableTicks != 3 || state.repeatingCalls != 3) { std::cerr << "FAIL: repeating callback state was reset or ignored\n"; return 1; }
    if (state.selfClearingCalls != 1) { std::cerr << "FAIL: destroyed timer repeated its callback\n"; return 1; }
    std::cout << "PASS: cancellation isolates replacements, mutable callbacks persist, and self-destruction stops repetition\n";
}
