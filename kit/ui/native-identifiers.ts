// Common C++ and Cmajor keywords. Declared names appear in generated source.
const reserved = new Set(("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq").split(" "));

export function isNativeIdentifier(name: string): boolean {
    return /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !name.includes("__") && !reserved.has(name);
}
