#include "cmajor/COM/cmaj_Library.h"
#include "choc/containers/choc_COM.h"

namespace cmaj
{

namespace
{
class SourceBuildUnavailableProgram final
    : public choc::com::ObjectWithAtomicRefCount<ProgramInterface, SourceBuildUnavailableProgram>
{
public:
    choc::com::String* parse(const char*, const char*, size_t) override
    {
        return choc::com::createRawString(
            R"json({"severity":"error","message":"The generated iOS shell can only load precompiled Cmajor code.","fileName":"","lineNumber":0,"columnNumber":0,"sourceLine":"","annotatedLine":"","fullDescription":"error: The generated iOS shell can only load precompiled Cmajor code.","category":"compile"})json"
        );
    }

    choc::com::String* getSyntaxTree(const SyntaxTreeOptions&) override
    {
        return choc::com::createRawString("{}");
    }
};
} // namespace

const char* Library::getVersion()
{
   #ifdef CMAJ_VERSION
    return CMAJ_VERSION;
   #else
    return "generated";
   #endif
}

ProgramPtr Library::createProgram()
{
    return choc::com::create<SourceBuildUnavailableProgram>();
}

const char* Library::getEngineTypes()
{
    return "";
}

EngineFactoryPtr Library::createEngineFactory(const char*)
{
    return {};
}

} // namespace cmaj
