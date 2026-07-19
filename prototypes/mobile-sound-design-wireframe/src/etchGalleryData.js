import {
  FILTER_MODE_LOWPASS,
  createFilterResponseModel,
  magnitudeAtFrequency,
} from "../../../ui/shared/filter-response.ts";
import { shapeDistortionSample } from "../../../ui/shared/distortion-visualization.ts";

const WAVETABLE_FRAME_COUNT = 24;
const WAVETABLE_SAMPLE_COUNT = 256;
const FILTER_SAMPLE_RATE_HZ = 48_000;
const FILTER_BIN_COUNT = 512;
const DISTORTION_SCOPE_SAMPLE_COUNT = 768;
const DISTORTION_HISTORY_BIN_COUNT = 160;

function peakOf(samples) {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  return peak;
}

/** Synthetic wavetable stack copied from the established Phase-4 etch bench. */
export function synthesizeFrames() {
  const frames = [];
  for (let f = 0; f < WAVETABLE_FRAME_COUNT; f += 1) {
    const morph = f / (WAVETABLE_FRAME_COUNT - 1);
    const frame = new Float32Array(WAVETABLE_SAMPLE_COUNT);
    for (let i = 0; i < WAVETABLE_SAMPLE_COUNT; i += 1) {
      const phase = (i / WAVETABLE_SAMPLE_COUNT) * Math.PI * 2;
      const sine = Math.sin(phase);
      const folded = Math.sin(phase + morph * 2.6 * Math.sin(2 * phase));
      const squared = Math.tanh((1 + morph * 9) * sine) / Math.tanh(1 + morph * 9);
      frame[i] = (1 - morph) * sine + morph * (0.55 * folded + 0.45 * squared);
    }
    frames.push(frame);
  }
  return frames;
}

/**
 * Build a deterministic synthetic FFT frame filtered by the production response model.
 */
export function makeFilterSpectrumFrame(timeSeconds, cutoffHz, q) {
  const response = createFilterResponseModel({
    mode: FILTER_MODE_LOWPASS,
    cutoffHz,
    q,
    sampleRate: FILTER_SAMPLE_RATE_HZ,
  });
  const nyquistHz = FILTER_SAMPLE_RATE_HZ * 0.5;
  const movingBumpHz = 340 * Math.pow(2, 0.85 * (0.5 + 0.5 * Math.sin(timeSeconds * 0.43)));
  const magnitudes = Array.from({ length: FILTER_BIN_COUNT }, (_, index) => {
    const frequencyHz = (index / (FILTER_BIN_COUNT - 1)) * nyquistHz;
    const safeFrequencyHz = Math.max(20, frequencyHz);
    const pinkSlope = 0.24 * Math.pow(safeFrequencyHz / 80, -0.34);
    const jitter = 0.78
      + (0.12 * Math.sin((index * 1.731) + (timeSeconds * 7.1)))
      + (0.08 * Math.sin((index * 0.337) - (timeSeconds * 11.3)));
    const logDistance = Math.log2(safeFrequencyHz / movingBumpHz);
    const lowMidBump = 0.16 * Math.exp(-(logDistance * logDistance) / 0.42);
    const responseDb = magnitudeAtFrequency(response, safeFrequencyHz);
    const responseGain = Math.pow(10, responseDb / 20);
    return Math.max(0, (pinkSlope * jitter + lowMidBump) * responseGain);
  });

  return {
    sampleRateHz: FILTER_SAMPLE_RATE_HZ,
    magnitudes,
  };
}

/** Build one 768-sample synthetic distortion scope frame using the production shaper. */
export function makeDistortionScopeFrame(timeSeconds, driveDb, knee) {
  const driveGain = Math.pow(10, driveDb / 20);
  const inputSamples = Array.from({ length: DISTORTION_SCOPE_SAMPLE_COUNT }, (_, index) => {
    const phase = (index / DISTORTION_SCOPE_SAMPLE_COUNT) * Math.PI * 2;
    const envelope = 0.68 + (0.25 * Math.sin((timeSeconds * 0.9) + (phase * 0.5)));
    const signal = (0.56 * Math.sin((phase * 3) + (timeSeconds * 1.7)))
      + (0.29 * Math.sin((phase * 7) - (timeSeconds * 2.3)));
    return signal * envelope * driveGain;
  });
  const outputSamples = inputSamples.map((sample) => shapeDistortionSample(sample, knee));
  const removedSamples = inputSamples.map((sample, index) => sample - (outputSamples[index] ?? 0));

  return {
    sampleRateHz: FILTER_SAMPLE_RATE_HZ,
    dominantChannel: 0,
    inputPeak: peakOf(inputSamples),
    outputPeak: peakOf(outputSamples),
    removedPeak: peakOf(removedSamples),
    inputSamples,
    outputSamples,
  };
}

/** Build 160 synthetic min/max history bins using the production distortion shaper. */
export function makeDistortionHistoryFrame(timeSeconds, driveDb, knee) {
  const driveGain = Math.pow(10, driveDb / 20);
  const horizonMs = 3_200;
  const binDurationMs = horizonMs / DISTORTION_HISTORY_BIN_COUNT;
  const inputMins = [];
  const inputMaxs = [];
  const outputMins = [];
  const outputMaxs = [];

  for (let index = 0; index < DISTORTION_HISTORY_BIN_COUNT; index += 1) {
    const historyTime = timeSeconds - ((DISTORTION_HISTORY_BIN_COUNT - 1 - index) * binDurationMs / 1000);
    const slowEnvelope = 0.34 + (0.24 * (0.5 + 0.5 * Math.sin(historyTime * 1.25)));
    const transientPhase = ((historyTime * 2.15) % 1 + 1) % 1;
    const transient = 0.52 * Math.exp(-Math.pow(transientPhase / 0.095, 2));
    const asymmetry = 0.86 + (0.12 * Math.sin(historyTime * 0.71));
    const positivePeak = (slowEnvelope + transient) * driveGain;
    const negativePeak = positivePeak * asymmetry;
    const inputMin = -negativePeak;
    const inputMax = positivePeak;

    inputMins.push(inputMin);
    inputMaxs.push(inputMax);
    outputMins.push(shapeDistortionSample(inputMin, knee));
    outputMaxs.push(shapeDistortionSample(inputMax, knee));
  }

  return {
    sampleRateHz: FILTER_SAMPLE_RATE_HZ,
    horizonMs,
    binDurationMs,
    binCount: DISTORTION_HISTORY_BIN_COUNT,
    validBinCount: DISTORTION_HISTORY_BIN_COUNT,
    inputMins,
    inputMaxs,
    outputMins,
    outputMaxs,
  };
}
