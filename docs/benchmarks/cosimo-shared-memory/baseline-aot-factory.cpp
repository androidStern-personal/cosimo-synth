#include "RendererBridge.h"
#include "cmajor/helpers/cmaj_GeneratedCppEngine.h"
#define CosimoThreeOscillatorRenderer__renderAll(...) ::cosimo::three_osc::bridge::renderAllGenerated (__VA_ARGS__)
#include "CosimoBaselineDSP.h"
#undef CosimoThreeOscillatorRenderer__renderAll
cmaj::Engine makeBaselineAot() { return cmaj::createEngineForGeneratedCppProgram<CosimoBaselineDSP>(); }
