#include <JuceHeader.h>

#include "CosimoCmajorPlugin.h"

#if CMAJ_USE_QUICKJS_WORKER
 #include "choc/javascript/choc_javascript_QuickJS.h"
#endif

#ifndef COSIMO_GENERATED_CPP_PATH
 #error "COSIMO_GENERATED_CPP_PATH must point to the generated WavetableSynth.cpp"
#endif

#include COSIMO_GENERATED_CPP_PATH

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new cosimo::ios::GeneratedPlugin<::WavetableSynth>();
}
