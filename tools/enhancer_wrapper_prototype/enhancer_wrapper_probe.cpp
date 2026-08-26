// PROTOTYPE ONLY: identify whether Spectre 1.5.6 Good uses a JUCE 7.0.1
// oversampling topology that can replace Cmajor node oversampling. This is not
// production DSP and deliberately exposes only one mono band.

#include <juce_dsp/juce_dsp.h>

#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace
{
struct Arguments
{
    std::string inputPath;
    std::string outputPath;
    std::string filterType;
    bool maximumQuality = false;
    bool integerLatency = false;
    float sampleRate = 48000.0f;
    float frequencyHz = 1000.0f;
    float q = 0.71f;
    float gainDb = 12.0f;
    std::string mode;
    std::string color;
    float deEmphasis = 1.0f;
};

Arguments parseArguments (int argc, char** argv)
{
    if (argc != 13)
        throw std::runtime_error (
            "usage: enhancer_wrapper_probe input.raw output.raw iir|fir "
            "maximumQuality integerLatency sampleRate frequency q gainDb "
            "Subtle|Medium Clean|Solid|Tube|Dry deEmphasis");

    return {
        argv[1],
        argv[2],
        argv[3],
        std::stoi (argv[4]) != 0,
        std::stoi (argv[5]) != 0,
        std::stof (argv[6]),
        std::stof (argv[7]),
        std::stof (argv[8]),
        std::stof (argv[9]),
        argv[10],
        argv[11],
        std::stof (argv[12]),
    };
}

std::vector<float> readRawFloat32 (const std::string& path)
{
    std::ifstream stream (path, std::ios::binary | std::ios::ate);
    if (! stream)
        throw std::runtime_error ("could not open input " + path);

    const auto byteCount = stream.tellg();
    if (byteCount < 0 || byteCount % static_cast<std::streamoff> (sizeof (float)) != 0)
        throw std::runtime_error ("input is not packed float32");

    std::vector<float> samples (
        static_cast<size_t> (byteCount / static_cast<std::streamoff> (sizeof (float))));
    stream.seekg (0, std::ios::beg);
    stream.read (
        reinterpret_cast<char*> (samples.data()),
        static_cast<std::streamsize> (samples.size() * sizeof (float)));
    if (! stream)
        throw std::runtime_error ("could not read input " + path);
    return samples;
}

void writeRawFloat32 (const std::string& path, const std::vector<float>& samples)
{
    std::ofstream stream (path, std::ios::binary | std::ios::trunc);
    if (! stream)
        throw std::runtime_error ("could not open output " + path);
    stream.write (
        reinterpret_cast<const char*> (samples.data()),
        static_cast<std::streamsize> (samples.size() * sizeof (float)));
    if (! stream)
        throw std::runtime_error ("could not write output " + path);
}

class PeakDifference
{
public:
    PeakDifference (double sampleRate, double frequencyHz, double q, double gainDb)
    {
        const auto amplitude = std::pow (10.0, gainDb / 40.0);
        const auto omega = juce::MathConstants<double>::twoPi * frequencyHz / sampleRate;
        const auto alpha = std::sin (omega) / (2.0 * q);
        const auto cosine = std::cos (omega);
        const auto a0 = 1.0 + alpha / amplitude;

        b0 = (1.0 + alpha * amplitude) / a0;
        b1 = (-2.0 * cosine) / a0;
        b2 = (1.0 - alpha * amplitude) / a0;
        a1 = (-2.0 * cosine) / a0;
        a2 = (1.0 - alpha / amplitude) / a0;
    }

    float process (float input)
    {
        const auto input64 = static_cast<double> (input);
        const auto peak = b0 * input64 + state1;
        state1 = b1 * input64 - a1 * peak + state2;
        state2 = b2 * input64 - a2 * peak;
        return static_cast<float> (peak - input64);
    }

private:
    double b0 = 0.0;
    double b1 = 0.0;
    double b2 = 0.0;
    double a1 = 0.0;
    double a2 = 0.0;
    double state1 = 0.0;
    double state2 = 0.0;
};

class DcBlocker
{
public:
    explicit DcBlocker (double sampleRate)
        : pole (static_cast<float> (
              std::exp (-juce::MathConstants<double>::twoPi * 15.0 / sampleRate)))
    {
    }

    float process (float input)
    {
        const auto output = input - previousInput + pole * previousOutput;
        previousInput = input;
        previousOutput = output;
        return output;
    }

private:
    float previousInput = 0.0f;
    float previousOutput = 0.0f;
    float pole = 0.0f;
};

float shape (float sample, const std::string& mode, const std::string& color)
{
    if (color == "Clean")
        return sample;

    const auto medium = mode == "Medium";
    const auto drive = medium ? 6.0f : 3.0f;
    const auto output = medium ? 0.5f : 0.7071067811865476f;
    const auto bias = color == "Tube" ? (medium ? 0.3125f : 0.125f) : 0.0f;
    return output * (std::tanh (drive * sample + bias) - std::tanh (bias));
}

juce::dsp::Oversampling<float>::FilterType parseFilterType (const std::string& value)
{
    if (value == "iir")
        return juce::dsp::Oversampling<float>::FilterType::filterHalfBandPolyphaseIIR;
    if (value == "fir")
        return juce::dsp::Oversampling<float>::FilterType::filterHalfBandFIREquiripple;
    throw std::runtime_error ("unknown filter type " + value);
}
}

int main (int argc, char** argv)
{
    try
    {
        const auto arguments = parseArguments (argc, argv);
        auto samples = readRawFloat32 (arguments.inputPath);
        if (samples.empty())
            throw std::runtime_error ("input is empty");

        juce::AudioBuffer<float> buffer (1, static_cast<int> (samples.size()));
        std::copy (samples.begin(), samples.end(), buffer.getWritePointer (0));
        juce::dsp::AudioBlock<float> block (buffer);
        juce::dsp::Oversampling<float> oversampling (
            1,
            2,
            parseFilterType (arguments.filterType),
            arguments.maximumQuality,
            arguments.integerLatency);
        oversampling.initProcessing (samples.size());
        oversampling.reset();

        if (arguments.color == "Dry")
        {
            juce::dsp::DelayLine<float, juce::dsp::DelayLineInterpolationTypes::Thiran>
                dryDelay (128);
            dryDelay.prepare ({
                arguments.sampleRate,
                static_cast<juce::uint32> (samples.size()),
                1,
            });
            dryDelay.setDelay (oversampling.getLatencyInSamples());
            dryDelay.reset();
            juce::dsp::ProcessContextReplacing<float> context (block);
            dryDelay.process (context);
        }
        else
        {
            auto oversampled = oversampling.processSamplesUp (block);
            PeakDifference bell (
                static_cast<double> (arguments.sampleRate) * 4.0,
                arguments.frequencyHz,
                arguments.q,
                arguments.gainDb);
            auto* channel = oversampled.getChannelPointer (0);
            for (size_t frame = 0; frame < oversampled.getNumSamples(); ++frame)
            {
                const auto selected = bell.process (channel[frame]);
                channel[frame] = shape (selected, arguments.mode, arguments.color)
                               - arguments.deEmphasis * selected;
            }

            oversampling.processSamplesDown (block);
            DcBlocker dcBlocker (arguments.sampleRate);
            for (auto* sample = buffer.getWritePointer (0);
                 sample != buffer.getWritePointer (0) + buffer.getNumSamples();
                 ++sample)
                *sample = dcBlocker.process (*sample);
        }

        std::copy (
            buffer.getReadPointer (0),
            buffer.getReadPointer (0) + buffer.getNumSamples(),
            samples.begin());
        writeRawFloat32 (arguments.outputPath, samples);
        std::cout << "{\"latency_samples\":" << oversampling.getLatencyInSamples()
                  << ",\"factor\":4,\"filter_type\":\"" << arguments.filterType
                  << "\",\"maximum_quality\":"
                  << (arguments.maximumQuality ? "true" : "false")
                  << ",\"integer_latency\":"
                  << (arguments.integerLatency ? "true" : "false") << "}\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
