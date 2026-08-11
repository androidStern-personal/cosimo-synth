#include <iostream>
#include <optional>
#include <string>
#include <vector>

#include "choc/javascript/choc_javascript_QuickJS.h"
#include "choc/javascript/choc_javascript_Timer.h"

int main()
{
    auto context = choc::javascript::createQuickJSContext();
    std::vector<std::string> completedJobs;

    choc::javascript::registerTimerFunctions (context);

    if (! context.evaluateExpression ("typeof clearTimeout === 'function'").getWithDefault<bool> (false))
    {
        std::cerr << "FAIL: QuickJS worker runtime does not provide clearTimeout\n";
        return 1;
    }

    context.registerFunction ("recordPendingJob", [&] (choc::javascript::ArgumentList arguments)
    {
        completedJobs.push_back (arguments.get (0, std::string {}));
        return choc::value::Value {};
    });

    context.run (R"js(
        Promise.resolve().then (() => recordPendingJob ("run"));

        globalThis.resumeFromNative = () =>
        {
            Promise.resolve().then (() => recordPendingJob ("invoke"));
        };
    )js");

    if (completedJobs != std::vector<std::string> { "run" })
    {
        std::cerr << "FAIL: QuickJS did not execute the Promise job queued by Context::run\n";
        return 1;
    }

    context.evaluateExpression (R"js(
        (() => {
            Promise.resolve().then (() => recordPendingJob ("evaluate"));
            return 42;
        })()
    )js");

    if (completedJobs != std::vector<std::string> { "run", "evaluate" })
    {
        std::cerr << "FAIL: QuickJS did not execute the Promise job queued by Context::evaluateExpression\n";
        return 1;
    }

    std::string moduleError;
    context.runModule (R"js(
        Promise.resolve().then (() => recordPendingJob ("module"));
        export const value = 42;
    )js",
                       [] (std::string_view) -> std::optional<std::string> { return {}; },
                       [&] (const std::string& error, const choc::value::ValueView&) { moduleError = error; });

    if (! moduleError.empty())
    {
        std::cerr << "FAIL: QuickJS module evaluation failed: " << moduleError << '\n';
        return 1;
    }

    if (completedJobs != std::vector<std::string> { "run", "evaluate", "module" })
    {
        std::cerr << "FAIL: QuickJS did not execute the Promise job queued by Context::runModule\n";
        return 1;
    }

    context.invoke ("resumeFromNative");

    if (completedJobs != std::vector<std::string> { "run", "evaluate", "module", "invoke" })
    {
        std::cerr << "FAIL: QuickJS did not execute the Promise job queued by Context::invoke\n";
        return 1;
    }

    std::cout << "PASS: QuickJS drains Promise jobs at every execution boundary\n";
    return 0;
}
