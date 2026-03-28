export const DEFAULT_SAMPLES_PER_FRAME = 2048;
export const DEFAULT_MIP_LEVEL_COUNT = 11;
export const DEFAULT_MAX_FRAMES_PER_TABLE = 256;

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function isPowerOfTwo(value) {
    return value > 0 && (value & (value - 1)) === 0;
}

const bitReverseIndexCache = new Map();

function getBitReverseIndices(size) {
    const cached = bitReverseIndexCache.get(size);

    if (cached) {
        return cached;
    }

    const bitCount = Math.round(Math.log2(size));
    const indices = new Uint32Array(size);

    for (let index = 0; index < size; index += 1) {
        let reversed = 0;
        let source = index;

        for (let bit = 0; bit < bitCount; bit += 1) {
            reversed = (reversed << 1) | (source & 1);
            source >>= 1;
        }

        indices[index] = reversed;
    }

    bitReverseIndexCache.set(size, indices);
    return indices;
}

function fftComplexInPlace(real, imaginary, inverse = false) {
    const size = real.length;

    assert(
        size === imaginary.length,
        "FFT real and imaginary buffers must have the same length"
    );
    assert(
        isPowerOfTwo(size),
        "FFT input length must be a power of two"
    );

    const bitReverseIndices = getBitReverseIndices(size);

    for (let index = 0; index < size; index += 1) {
        const reversedIndex = bitReverseIndices[index];

        if (reversedIndex <= index) {
            continue;
        }

        const realSample = real[index];
        real[index] = real[reversedIndex];
        real[reversedIndex] = realSample;

        const imaginarySample = imaginary[index];
        imaginary[index] = imaginary[reversedIndex];
        imaginary[reversedIndex] = imaginarySample;
    }

    for (let blockSize = 2; blockSize <= size; blockSize <<= 1) {
        const halfBlockSize = blockSize >> 1;
        const angle = (inverse ? 2 : -2) * Math.PI / blockSize;
        const phaseStepReal = Math.cos(angle);
        const phaseStepImaginary = Math.sin(angle);

        for (let blockOffset = 0; blockOffset < size; blockOffset += blockSize) {
            let twiddleReal = 1;
            let twiddleImaginary = 0;

            for (let pairIndex = 0; pairIndex < halfBlockSize; pairIndex += 1) {
                const evenIndex = blockOffset + pairIndex;
                const oddIndex = evenIndex + halfBlockSize;
                const oddReal = real[oddIndex];
                const oddImaginary = imaginary[oddIndex];
                const transformedReal =
                    (twiddleReal * oddReal) - (twiddleImaginary * oddImaginary);
                const transformedImaginary =
                    (twiddleReal * oddImaginary) + (twiddleImaginary * oddReal);
                const evenReal = real[evenIndex];
                const evenImaginary = imaginary[evenIndex];

                real[evenIndex] = evenReal + transformedReal;
                imaginary[evenIndex] = evenImaginary + transformedImaginary;
                real[oddIndex] = evenReal - transformedReal;
                imaginary[oddIndex] = evenImaginary - transformedImaginary;

                const nextTwiddleReal =
                    (twiddleReal * phaseStepReal) - (twiddleImaginary * phaseStepImaginary);
                twiddleImaginary =
                    (twiddleReal * phaseStepImaginary) + (twiddleImaginary * phaseStepReal);
                twiddleReal = nextTwiddleReal;
            }
        }
    }

    if (inverse) {
        for (let index = 0; index < size; index += 1) {
            real[index] /= size;
            imaginary[index] /= size;
        }
    }
}

export function canonicalizeFrame(frame) {
    const sourceFrame = ArrayBuffer.isView(frame)
        ? frame
        : Float32Array.from(frame);

    let sum = 0;

    for (let index = 0; index < sourceFrame.length; index += 1) {
        sum += sourceFrame[index];
    }

    const mean = sum / Math.max(1, sourceFrame.length);
    const canonical = new Float32Array(sourceFrame.length);

    for (let index = 0; index < sourceFrame.length; index += 1) {
        canonical[index] = sourceFrame[index] - mean;
    }

    return canonical;
}

export function normalizeDecodedAudioFileSamples(audioFile) {
    const frames = audioFile?.frames;

    assert(
        Array.isArray(frames) || ArrayBuffer.isView(frames),
        "Decoded audio data must provide a frames array"
    );

    const frameArray = Array.from(frames);
    const samples = new Float32Array(frameArray.length);

    for (let index = 0; index < frameArray.length; index += 1) {
        const frame = frameArray[index];

        if (typeof frame === "number") {
            samples[index] = frame;
            continue;
        }

        if (ArrayBuffer.isView(frame) || Array.isArray(frame)) {
            assert(frame.length === 1, "Only mono wavetable source files are supported");
            samples[index] = Number(frame[0]) || 0;
            continue;
        }

        throw new Error("Decoded audio frames must contain numeric mono samples");
    }

    return {
        sampleRate: Number(audioFile?.sampleRate) || 0,
        samples,
    };
}

export function extractSourceFramesFromSamples(
    samples,
    {
        expectedFrameCount = undefined,
        samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME,
        maxFramesPerTable = DEFAULT_MAX_FRAMES_PER_TABLE,
    } = {}
) {
    const sourceSamples = ArrayBuffer.isView(samples)
        ? samples
        : Float32Array.from(samples);

    assert(
        sourceSamples.length % samplesPerFrame === 0,
        `Source wavetable files must contain a whole number of ${samplesPerFrame}-sample frames`
    );

    const frameCount = sourceSamples.length / samplesPerFrame;
    assert(frameCount > 0, "Source wavetable files must contain at least one frame");
    assert(
        frameCount <= maxFramesPerTable,
        `Source wavetable files must contain at most ${maxFramesPerTable} frames`
    );

    if (expectedFrameCount !== undefined) {
        assert(
            frameCount === expectedFrameCount,
            `Source wavetable frame count mismatch: expected ${expectedFrameCount}, got ${frameCount}`
        );
    }

    const frames = [];

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const start = frameIndex * samplesPerFrame;
        const end = start + samplesPerFrame;
        frames.push(canonicalizeFrame(sourceSamples.slice(start, end)));
    }

    return {
        frameCount,
        frames,
    };
}

export function buildFrameSpectrum(frame) {
    const canonical = canonicalizeFrame(frame);
    const real = Float64Array.from(canonical);
    const imaginary = new Float64Array(real.length);

    fftComplexInPlace(real, imaginary, false);
    real[0] = 0;
    imaginary[0] = 0;

    return {
        real,
        imaginary,
    };
}

export function buildMipFrameFromSpectrum(
    spectrum,
    mipIndex,
    {
        mipLevelCount = DEFAULT_MIP_LEVEL_COUNT,
    } = {}
) {
    const size = spectrum?.real?.length ?? 0;

    assert(size > 0, "Spectrum must contain real samples");
    assert(
        size === spectrum.imaginary.length,
        "Spectrum real and imaginary buffers must have the same length"
    );
    assert(
        mipIndex >= 0 && mipIndex < mipLevelCount,
        `Mip index must stay inside [0, ${mipLevelCount - 1}]`
    );

    const harmonicLimit = Math.min(1 << mipIndex, size >> 1);
    const real = new Float64Array(size);
    const imaginary = new Float64Array(size);

    for (let harmonic = 1; harmonic <= harmonicLimit; harmonic += 1) {
        real[harmonic] = spectrum.real[harmonic];
        imaginary[harmonic] = spectrum.imaginary[harmonic];

        const mirrorIndex = (size - harmonic) % size;
        if (mirrorIndex !== harmonic) {
            real[mirrorIndex] = spectrum.real[mirrorIndex];
            imaginary[mirrorIndex] = spectrum.imaginary[mirrorIndex];
        }
    }

    fftComplexInPlace(real, imaginary, true);
    return Float32Array.from(real);
}

export function buildMipFrameFromFrame(frame, mipIndex, options = {}) {
    return buildMipFrameFromSpectrum(buildFrameSpectrum(frame), mipIndex, options);
}

export function buildSpectrumCacheForFrames(frames) {
    return frames.map((frame) => buildFrameSpectrum(frame));
}

