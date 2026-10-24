#include "RendererSharedDataProvider.h"
#include "CosimoStateHistoryObservations.h"
#include "cmajor/helpers/cmaj_GeneratedCppEngine.h"
#define CosimoThreeOscillatorRenderer__renderAll(...) ::cosimo::three_osc::bridge::renderAllGenerated (__VA_ARGS__)
#define CosimoThreeOscillatorRenderer__renderShared(...) ::historyRenderSharedGenerated (__VA_ARGS__)
#define CosimoThreeOscillatorRenderer__updateSharedTables(...) ::cosimo::three_osc::bridge::updateSharedTablesGenerated (__VA_ARGS__)
#define CosimoThreeOscillatorRenderer__sharedMsegSerial(...) ::cosimo::three_osc::bridge::sharedMsegSerialNative (__VA_ARGS__)
#define CosimoThreeOscillatorRenderer__sampleSharedMseg(...) ::cosimo::three_osc::bridge::sampleSharedMsegNative (__VA_ARGS__)
#include "CosimoHistoryDSP.h"
cmaj::Engine createCosimoHistoryAot() { return cmaj::createEngineForGeneratedCppProgram<CosimoHistoryDSP>(); }
