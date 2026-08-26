// Prints the exact JUCE 7.0.1 maximum-quality 4x FIR coefficients used by the
// retained Spectre-Good prototype. This is a provenance helper for the fixed
// coefficient tables in cmajor/Enhancer.cmajor.

#include <juce_dsp/juce_dsp.h>

#include <iomanip>
#include <iostream>

namespace
{
void printCoefficients (const char* name, float transitionWidth, float stopbandDb)
{
    const auto coefficients =
        juce::dsp::FilterDesign<float>::designFIRLowpassHalfBandEquirippleMethod (
            transitionWidth,
            stopbandDb);

    const auto coefficientCount = coefficients->getFilterOrder() + 1;
    const auto* values = coefficients->getRawCoefficients();
    std::cout << name << " " << coefficientCount << '\n';
    std::cout << std::setprecision (10);
    for (size_t index = 0; index < coefficientCount; ++index)
        std::cout << values[index] << '\n';
}
}

int main()
{
    printCoefficients ("stage0_up", 0.05f, -90.0f);
    printCoefficients ("stage0_down", 0.06f, -75.0f);
    printCoefficients ("stage1_up", 0.10f, -80.0f);
    printCoefficients ("stage1_down", 0.12f, -65.0f);
}
