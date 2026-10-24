#pragma once

#include <chrono>
#include <future>
#include <memory>
#include <stdexcept>
#include <type_traits>
#include <utility>
#include "choc/gui/choc_MessageLoop.h"

namespace native_test
{
// Keep all Patch access on the actual message loop; callers own their deadlines.
template <typename Fn, typename Rep, typename Period>
auto onMessageLoop (Fn run, std::chrono::duration<Rep, Period> timeout, const char* failure)
{
    using Result = std::invoke_result_t<Fn>;
    auto task = std::make_shared<std::packaged_task<Result()>> (std::move (run));
    auto result = task->get_future();
    choc::messageloop::postMessage ([task] { (*task)(); });
    if (result.wait_for (timeout) != std::future_status::ready)
        throw std::runtime_error (failure);
    return result.get();
}
}
