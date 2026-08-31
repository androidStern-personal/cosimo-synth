export const SEQFX_VISUAL_EFFECTS = Object.freeze([
    { id: 1, name: "Filter", fileStem: "filter" },
    { id: 2, name: "Crush", fileStem: "crush" },
    { id: 3, name: "Tape Stop", fileStem: "tape-stop" },
    { id: 4, name: "Stutter", fileStem: "stutter" },
    { id: 5, name: "Pitch", fileStem: "pitch" },
    { id: 6, name: "Comb", fileStem: "comb" },
    { id: 7, name: "Ring", fileStem: "ring" },
    { id: 8, name: "Reverse", fileStem: "reverse" },
    { id: 9, name: "Talk Box", fileStem: "talk-box" },
    { id: 10, name: "Vibro", fileStem: "vibro" },
    { id: 11, name: "Flange", fileStem: "flange" },
    { id: 12, name: "Dirty", fileStem: "dirty" },
]);

export const SEQFX_VISUAL_PROOF_SIZES = Object.freeze([
    { id: "default", width: 1120, height: 680 },
    { id: "compact", width: 900, height: 600 },
    { id: "minimum", width: 720, height: 520 },
    { id: "wide", width: 1440, height: 800 },
]);

export const SEQFX_VISUAL_INSPECTOR_VIEWS = Object.freeze(["top", "lower"]);

export const SEQFX_INTERACTIVE_TARGET_SELECTOR = [
    "button",
    "select",
    "input",
    "[role='button']",
    "[role='slider']",
    "[role='switch']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='tab']",
    "[role='spinbutton']",
    "[data-pointer-target='true']",
].join(", ");

export function seqFxVisualProofStateKey({ size, effectId, inspectorView }) {
    return `${size}:${effectId}:${inspectorView}`;
}

export function createSeqFxVisualProofContract() {
    return SEQFX_VISUAL_PROOF_SIZES.flatMap((size) => [
        {
            size: size.id,
            effectId: 0,
            effectName: "Empty",
            file: `${size.id}-empty.png`,
            inspectorView: "empty",
        },
        ...SEQFX_VISUAL_EFFECTS.flatMap((effect) => (
            SEQFX_VISUAL_INSPECTOR_VIEWS.map((inspectorView) => ({
                size: size.id,
                effectId: effect.id,
                effectName: effect.name,
                file: `${size.id}-${effect.fileStem}${inspectorView === "lower" ? "-lower" : ""}.png`,
                inspectorView,
            }))
        )),
    ]);
}

export function validateSeqFxVisualProofCoverage(entries) {
    const expected = createSeqFxVisualProofContract();
    const expectedByKey = new Map(expected.map((entry) => [seqFxVisualProofStateKey(entry), entry]));
    const seen = new Map();
    const failures = [];

    for (const entry of entries) {
        const key = seqFxVisualProofStateKey(entry);
        seen.set(key, (seen.get(key) ?? 0) + 1);
        const contractEntry = expectedByKey.get(key);
        if (!contractEntry) {
            failures.push(`unexpected visual state ${key}`);
            continue;
        }
        if (entry.effectName !== contractEntry.effectName) {
            failures.push(`${key} used effect name ${entry.effectName} instead of ${contractEntry.effectName}`);
        }
        if (typeof entry.file === "string" && entry.file !== contractEntry.file) {
            failures.push(`${key} used screenshot ${entry.file} instead of ${contractEntry.file}`);
        }
    }

    for (const [key] of expectedByKey) {
        const count = seen.get(key) ?? 0;
        if (count === 0) failures.push(`missing visual state ${key}`);
        if (count > 1) failures.push(`duplicate visual state ${key}`);
    }

    return failures;
}

export function validateSeqFxInspectorDepthCoverage(entries) {
    const expectedKeys = new Set(
        SEQFX_VISUAL_PROOF_SIZES.flatMap((size) => (
            SEQFX_VISUAL_EFFECTS.map((effect) => `${size.id}:${effect.id}`)
        )),
    );
    const seen = new Map();
    const failures = [];

    for (const entry of entries) {
        const key = `${entry.size}:${entry.effectId}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
        if (!expectedKeys.has(key)) failures.push(`unexpected inspector traversal ${key}`);
        if ((entry.missingControlIndexes?.length ?? 0) > 0) {
            failures.push(`${key} never exposed controls ${entry.missingControlIndexes.join(",")}`);
        }
    }

    for (const key of expectedKeys) {
        const count = seen.get(key) ?? 0;
        if (count === 0) failures.push(`missing inspector traversal ${key}`);
        if (count > 1) failures.push(`duplicate inspector traversal ${key}`);
    }

    return failures;
}
