function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

export function nearestBounceRootIndex(bank, note = 60) {
    invariant(Array.isArray(bank?.roots) && bank.roots.length > 0,
        "Bounce waveform requires a bank with roots");
    const target = Number.isFinite(Number(note)) ? Number(note) : 60;
    let nearestIndex = 0;
    let nearestDistance = Math.abs(bank.roots[0].note - target);
    for (let index = 1; index < bank.roots.length; index += 1) {
        const distance = Math.abs(bank.roots[index].note - target);
        if (distance < nearestDistance) {
            nearestIndex = index;
            nearestDistance = distance;
        }
    }
    return nearestIndex;
}

/** Peak-preserving stereo envelope for a compact SVG PCM scope. */
export function createBounceWaveformEnvelope(bank, {
    note = 60,
    columnCount = 256,
} = {}) {
    invariant(bank?.pcm instanceof Int16Array, "Bounce waveform requires Int16 PCM");
    invariant(Number.isInteger(columnCount) && columnCount >= 8 && columnCount <= 2_048,
        "Bounce waveform columnCount must be from 8 to 2048");
    const rootIndex = nearestBounceRootIndex(bank, note);
    const root = bank.roots[rootIndex];
    invariant(Number.isInteger(root.frameOffset) && Number.isInteger(root.frameCount)
        && root.frameCount > 0, "Bounce waveform root range is invalid");
    const columns = [];
    for (let column = 0; column < columnCount; column += 1) {
        const firstFrame = root.frameOffset + Math.floor((column * root.frameCount) / columnCount);
        const lastFrame = root.frameOffset + Math.max(
            Math.floor(((column + 1) * root.frameCount) / columnCount),
            Math.floor((column * root.frameCount) / columnCount) + 1,
        );
        let minimum = 1;
        let maximum = -1;
        for (let frame = firstFrame; frame < Math.min(root.frameOffset + root.frameCount, lastFrame); frame += 1) {
            const left = bank.pcm[frame * 2] / 32_768;
            const right = bank.pcm[(frame * 2) + 1] / 32_768;
            minimum = Math.min(minimum, left, right);
            maximum = Math.max(maximum, left, right);
        }
        if (maximum < minimum) {
            minimum = 0;
            maximum = 0;
        }
        columns.push(Object.freeze({ minimum, maximum }));
    }
    return Object.freeze({
        rootIndex,
        rootNote: root.note,
        frameCount: root.frameCount,
        columns: Object.freeze(columns),
    });
}
