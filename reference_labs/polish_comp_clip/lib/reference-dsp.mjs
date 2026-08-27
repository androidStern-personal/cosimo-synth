import { decodedSettings, mappingBySuffix } from "./fixture-settings.mjs";

const facts = decodedSettings.decodedPresetFacts;
const derived = decodedSettings.cosimoDerivedValues;
const inputAmplitudeMapping = mappingBySuffix("/AMPLITUDE");
const compressorMakeupMapping = mappingBySuffix("/OUTPUT_GAIN");
const ratioMapping = mappingBySuffix("/HIGH_RATIO");

export const MODEL_ID = "cosimo.t27.transparentReferenceInference.v1";

export function dbToAmplitude(db) {
    return 10 ** (db / 20);
}

export function amplitudeToDb(amplitude) {
    return 20 * Math.log10(Math.max(Math.abs(amplitude), 1e-30));
}

export function clampMacro(value) {
    if (!Number.isFinite(value)) throw new Error("Reference macro must be finite");
    return Math.min(1, Math.max(0, value));
}

export function effectiveSettingsAtMacro(value) {
    const macro = clampMacro(value);
    const baseSlope = facts.compressor.HIGH_RATIO.value;
    const inferredSlope = baseSlope + (1 - baseSlope) * macro;
    const decodedMacroDeltas = {
        inputAmplitudeDb: inputAmplitudeMapping.mappedAmount.value * macro,
        compressorOutputGainDb: compressorMakeupMapping.mappedAmount.value * macro,
        highRatioNormalized: ratioMapping.mappedAmount.value * macro,
    };
    return {
        macro,
        decodedMacroDeltas,
        inputGainDb: derived.inputToolGainDb + decodedMacroDeltas.inputAmplitudeDb,
        compressorMakeupDb: facts.compressor.OUTPUT_GAIN.value
            + decodedMacroDeltas.compressorOutputGainDb,
        compressorRatio: macro === 1 ? Number.POSITIVE_INFINITY : 1 / (1 - inferredSlope),
        inferredRatioSlope: inferredSlope,
        decodedRatioMappingAmount: ratioMapping.mappedAmount.value,
    };
}

function tensionWarp(position, tension) {
    // Open Cosimo inference: a monotonic cubic perturbation of linear interpolation.
    // It preserves both endpoints and uses the decoded tension without claiming
    // Bitwig's closed interpolation law.
    return position + tension * position * (1 - position) * (1 - 2 * position);
}

export function evaluateTransferCurve(input) {
    if (!Number.isFinite(input)) throw new Error("Transfer input must be finite");
    if (input === 0) return 0;

    const sign = input < 0 ? -1 : 1;
    const magnitude = Math.abs(input);
    const points = facts.curve.points;
    const last = points.at(-1);
    if (magnitude >= last.input.value) return sign * last.output.value;

    for (let index = 1; index < points.length; index += 1) {
        const left = points[index - 1];
        const right = points[index];
        if (magnitude <= right.input.value) {
            if (magnitude === left.input.value) return sign * left.output.value;
            if (magnitude === right.input.value) return sign * right.output.value;
            const position = (magnitude - left.input.value) / (right.input.value - left.input.value);
            const shaped = tensionWarp(position, right.tension.value);
            return sign * (left.output.value + (right.output.value - left.output.value) * shaped);
        }
    }

    throw new Error("Transfer curve did not resolve a finite input");
}

function desiredGainReductionDb(detectorAmplitude, thresholdDb, ratio) {
    const detectorDb = amplitudeToDb(detectorAmplitude);
    if (detectorDb <= thresholdDb) return 0;
    const compressedDb = thresholdDb + (detectorDb - thresholdDb) / ratio;
    return compressedDb - detectorDb;
}

function percentile(sortedValues, fraction) {
    if (sortedValues.length === 0) return 0;
    const position = (sortedValues.length - 1) * fraction;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sortedValues[lower];
    const mix = position - lower;
    return sortedValues[lower] * (1 - mix) + sortedValues[upper] * mix;
}

export function processReference(channels, sampleRate, macroValue) {
    if (!Array.isArray(channels) || channels.length !== 2) {
        throw new Error("The T27 reference renderer requires exactly two channels");
    }
    if (channels[0].length !== channels[1].length) throw new Error("Reference channels differ in length");
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("Invalid sample rate");

    const settings = effectiveSettingsAtMacro(macroValue);
    const inputGain = dbToAmplitude(settings.inputGainDb);
    const compressorMakeup = dbToAmplitude(settings.compressorMakeupDb);
    const clipperDrive = dbToAmplitude(facts.curve.drive.value);
    const outputGain = facts.outputToolVolume.value;
    const thresholdDb = facts.compressor.HIGH_THRESHOLD.value;
    const attackSeconds = derived.compressorAttackSeconds;
    const releaseSeconds = derived.compressorReleaseSeconds;
    const attackCoefficient = Math.exp(-1 / (attackSeconds * sampleRate));
    const releaseCoefficient = Math.exp(-1 / (releaseSeconds * sampleRate));
    const plateauInput = facts.curve.points.at(-1).input.value;
    const kneeInput = facts.curve.points[1].input.value;
    const frameCount = channels[0].length;
    const output = [new Float32Array(frameCount), new Float32Array(frameCount)];
    const reductionSamples = new Float64Array(frameCount);
    let smoothedReductionDb = 0;
    let reductionSum = 0;
    let plateauSamples = 0;
    let kneeSamples = 0;
    let overFullScaleSamples = 0;
    let nonFiniteSamples = 0;

    for (let frame = 0; frame < frameCount; frame += 1) {
        const inputLeft = channels[0][frame] * inputGain;
        const inputRight = channels[1][frame] * inputGain;
        const detector = Math.max(Math.abs(inputLeft), Math.abs(inputRight));
        const targetReductionDb = desiredGainReductionDb(detector, thresholdDb, settings.compressorRatio);
        const coefficient = targetReductionDb < smoothedReductionDb ? attackCoefficient : releaseCoefficient;
        smoothedReductionDb = coefficient * smoothedReductionDb + (1 - coefficient) * targetReductionDb;
        const reduction = Math.max(0, -smoothedReductionDb);
        reductionSamples[frame] = reduction;
        reductionSum += reduction;
        const compressorGain = dbToAmplitude(smoothedReductionDb) * compressorMakeup;

        for (let channel = 0; channel < 2; channel += 1) {
            const compressed = channels[channel][frame] * inputGain * compressorGain;
            const curveInput = compressed * clipperDrive;
            if (Math.abs(curveInput) >= plateauInput) plateauSamples += 1;
            else if (Math.abs(curveInput) >= kneeInput) kneeSamples += 1;
            const sample = evaluateTransferCurve(curveInput) * outputGain;
            if (!Number.isFinite(sample)) nonFiniteSamples += 1;
            if (Math.abs(sample) >= 1) overFullScaleSamples += 1;
            output[channel][frame] = sample;
        }
    }

    const sortedReductions = Array.from(reductionSamples).sort((left, right) => left - right);
    return {
        channels: output,
        effectiveSettings: settings,
        telemetry: {
            attackCoefficient,
            releaseCoefficient,
            maximumGainReductionDb: sortedReductions.at(-1) ?? 0,
            meanGainReductionDb: reductionSum / Math.max(frameCount, 1),
            p95GainReductionDb: percentile(sortedReductions, 0.95),
            curveKneeSampleFraction: kneeSamples / Math.max(frameCount * 2, 1),
            curvePlateauSampleFraction: plateauSamples / Math.max(frameCount * 2, 1),
            overFullScaleSampleFraction: overFullScaleSamples / Math.max(frameCount * 2, 1),
            nonFiniteSamples,
        },
    };
}
