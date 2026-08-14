#pragma once

#include "RendererBridge.h"

#include "cmajor/API/cmaj_Engine.h"

#include <string_view>

namespace cosimo::three_osc::bridge
{
inline constexpr std::string_view externalFunctionName =
    "CosimoThreeOscillatorRenderer::renderAll";
inline constexpr std::size_t externalFunctionParameterCount = 18;

inline bool matchesExternalFunction (
    const char* functionName,
    choc::span<choc::value::Type> parameterTypes) noexcept
{
    if (functionName == nullptr
        || std::string_view (functionName) != externalFunctionName
        || parameterTypes.size() != externalFunctionParameterCount)
        return false;

    try
    {
        for (std::size_t index = 0; index < parameterTypes.size(); ++index)
        {
            const auto& parameter = parameterTypes[index];
            if (! parameter.isArray())
                return false;

            const auto element = parameter.getElementType();
            if (index == 0 ? ! element.isFloat32() : ! element.isInt32())
                return false;
        }
    }
    catch (...)
    {
        return false;
    }

    return true;
}

inline cmaj::Engine::ExternalFunctionProviderFn createExternalFunctionProvider()
{
    return [] (const char* functionName,
               choc::span<choc::value::Type> parameterTypes) -> void*
    {
        if (! matchesExternalFunction (functionName, parameterTypes))
            return nullptr;

        return reinterpret_cast<void*> (&renderAll);
    };
}
}
