#include <JuceHeader.h>

#include "CosimoBounceNativeDriver.h"
#include "CosimoCmajorPlugin.h"

#if CMAJ_USE_QUICKJS_WORKER
 #include "choc/javascript/choc_javascript_QuickJS.h"
#endif

#ifndef COSIMO_GENERATED_CPP_PATH
 #error "COSIMO_GENERATED_CPP_PATH must point to the generated WavetableSynth.cpp"
#endif

#include "../../native/three_oscillator_renderer/RendererBridge.h"

#define CosimoThreeOscillatorRenderer__renderAll(...) \
    ::cosimo::three_osc::bridge::renderAllGenerated (__VA_ARGS__)
#include COSIMO_GENERATED_CPP_PATH
#undef CosimoThreeOscillatorRenderer__renderAll

namespace cosimo::ios
{

bounce::PerformerFactory createIOSBouncePerformerFactory (
    bounce::CmajorPatchSnapshot snapshot)
{
    auto configuration = bounce::createIOSAOTBounceConfiguration<::WavetableSynth> (
        [] (cmaj::Patch::LoadParams& loadParams)
        {
            loadParams.manifest.needsToBuildSource = false;
            loadParams.manifest.initialiseWithVirtualFile (
                "WavetableSynth.iOS.cmajorpatch",
                detail::createRuntimeResourceReader,
                [] (const std::filesystem::path& path)
                {
                    return detail::getRuntimeResourceFullPath (path).string();
                },
                detail::getRuntimeResourceModificationTime,
                detail::runtimeResourceExists);
        });
    return bounce::createCmajorPerformerFactory (
        std::move (configuration), std::move (snapshot));
}

std::size_t iosBouncePerformerResidentBytes() noexcept
{
    return sizeof (::WavetableSynth);
}

} // namespace cosimo::ios

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new cosimo::ios::GeneratedPlugin<::WavetableSynth>();
}
