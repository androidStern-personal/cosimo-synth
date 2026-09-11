#pragma once

#include "RendererBridge.h"
#include "RendererSharedDataProvider.h"

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
    if (functionName == nullptr) return false;

    try
    {
        const auto name = std::string_view (functionName);
        if (parameterTypes.size() == 2)
        {
            const auto& first = parameterTypes[0];
            const auto& second = parameterTypes[1];
            if (!second.isArray() || !second.getElementType().isInt32()) return false;
            if (name == "CosimoThreeOscillatorRenderer::renderShared")
                return first.isArray() && first.getElementType().isFloat32();
            if (name == "CosimoThreeOscillatorRenderer::updateSharedTables") return first.isInt32();
        }
        if (name != externalFunctionName || parameterTypes.size() != externalFunctionParameterCount) return false;
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
        if (! matchesExternalFunction (functionName, parameterTypes)) return nullptr;
        if (functionName != nullptr && parameterTypes.size() == 2)
        {
            const auto name = std::string_view (functionName);
            const auto& first = parameterTypes[0];
            const auto& second = parameterTypes[1];
            if (second.isArray() && second.getElementType().isInt32())
            {
                if (name == "CosimoThreeOscillatorRenderer::renderShared"
                    && first.isArray() && first.getElementType().isFloat32())
                    return reinterpret_cast<void*> (&renderSharedNative);
                if (name == "CosimoThreeOscillatorRenderer::updateSharedTables" && first.isInt32())
                    return reinterpret_cast<void*> (&updateSharedTablesNative);
            }
        }
        return reinterpret_cast<void*> (&renderAll);
    };
}
}
