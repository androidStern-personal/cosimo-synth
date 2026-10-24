#include "RendererBridge.h"
#include "RendererSharedDataProvider.h"
#include "cmajor/helpers/cmaj_GeneratedCppEngine.h"
#define CosimoThreeOscillatorRenderer__renderAll(...) ::cosimo::three_osc::bridge::renderAllGenerated (__VA_ARGS__)
#define CosimoThreeOscillatorRenderer__renderShared(...) ::cosimo::three_osc::bridge::renderSharedGenerated (__VA_ARGS__)
#define CosimoThreeOscillatorRenderer__updateSharedTables(...) ::cosimo::three_osc::bridge::updateSharedTablesGenerated (__VA_ARGS__)
#include "CosimoCurrentDSP.h"
#undef CosimoThreeOscillatorRenderer__renderAll
#undef CosimoThreeOscillatorRenderer__renderShared
#undef CosimoThreeOscillatorRenderer__updateSharedTables
cmaj::Engine makeBaselineAot() { return cmaj::createEngineForGeneratedCppProgram<CosimoCurrentDSP>(); }
