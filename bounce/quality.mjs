function channelPeakAbsolute(samples) {
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    return peak;
}

function windowRms(samples, firstSample, sampleCount) {
    let sumSquares = 0;
    const last = Math.min(samples.length, firstSample + sampleCount);
    for (let index = firstSample; index < last; index += 1) {
        sumSquares += samples[index] * samples[index];
    }
    return Math.sqrt(sumSquares / Math.max(1, last - firstSample));
}

/**
 * Product A/B gate: independently peak-normalize stereo-interleaved signals,
 * then compare 50 ms RMS windows. Windows below -80 dBFS in both signals are
 * outside the captured audible tail and are omitted. The mean absolute delta
 * must stay below 1 dB and no audible window may exceed 3 dB.
 */
export function comparePeakNormalizedRms(reference, candidate, sampleRate, {
    windowSeconds = 0.05,
    audibleFloorDb = -80,
} = {}) {
    if (!(reference instanceof Float32Array) || !(candidate instanceof Float32Array)) {
        throw new TypeError("Bounce A/B signals must be Float32Array");
    }
    if (reference.length !== candidate.length || reference.length % 2 !== 0) {
        throw new Error("Bounce A/B signals must have equal stereo frame counts");
    }
    const referencePeak = channelPeakAbsolute(reference);
    const candidatePeak = channelPeakAbsolute(candidate);
    if (!(referencePeak > 0) || !(candidatePeak > 0)) {
        throw new Error("Bounce A/B signals must be non-silent");
    }
    const windowSamples = Math.max(2, Math.round(windowSeconds * sampleRate) * 2);
    const audibleFloor = 10 ** (audibleFloorDb / 20);
    const deltasDb = [];
    for (let offset = 0; offset < reference.length; offset += windowSamples) {
        const count = Math.min(windowSamples, reference.length - offset);
        const referenceRms = windowRms(reference, offset, count) / referencePeak;
        const candidateRms = windowRms(candidate, offset, count) / candidatePeak;
        if (Math.max(referenceRms, candidateRms) < audibleFloor) continue;
        const deltaDb = Math.abs(20 * Math.log10(
            Math.max(candidateRms, 1e-12) / Math.max(referenceRms, 1e-12),
        ));
        deltasDb.push(deltaDb);
    }
    if (deltasDb.length === 0) throw new Error("Bounce A/B had no audible windows");
    const meanDeltaDb = deltasDb.reduce((sum, value) => sum + value, 0) / deltasDb.length;
    const maxDeltaDb = Math.max(...deltasDb);
    return Object.freeze({
        passes: meanDeltaDb < 1 && maxDeltaDb < 3,
        meanDeltaDb,
        maxDeltaDb,
        windowCount: deltasDb.length,
        deltasDb: Object.freeze(deltasDb),
    });
}
