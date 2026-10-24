// Cutoff ranges for the synth and SeqFX filter modulation, in octaves around a
// base or center cutoff. The kit FilterEditor only draws a range; these helpers
// decide how a modulation amount becomes one.
import { clampFilterCutoffHz } from "../../kit/ui/filter-response";
import type { FilterRangePolarity } from "../../kit/ui/filter-editor";
import type { FilterRange } from "../../kit/index";

const MODULATION_RANGE_OCTAVE_LIMIT = 20;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown, fallback: number) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function cutoffsFromBaseModulationOctaves({
    baseCutoffHz,
    amountOctaves,
    polarity,
}: {
    baseCutoffHz: number;
    amountOctaves: number;
    polarity: FilterRangePolarity;
}): FilterRange {
    const base = clampFilterCutoffHz(baseCutoffHz);
    const amount = clamp(finiteNumber(amountOctaves, 0), -MODULATION_RANGE_OCTAVE_LIMIT, MODULATION_RANGE_OCTAVE_LIMIT);

    if (polarity === "bipolar") {
        const ratio = 2 ** Math.abs(amount);
        return {
            startCutoffHz: clampFilterCutoffHz(base / ratio),
            endCutoffHz: clampFilterCutoffHz(base * ratio),
        };
    }

    return {
        startCutoffHz: base,
        endCutoffHz: clampFilterCutoffHz(base * (2 ** amount)),
    };
}

export function cutoffsFromBipolarRangeHandleCutoff({
    baseCutoffHz,
    handleCutoffHz,
}: {
    baseCutoffHz: number;
    handleCutoffHz: number;
}): FilterRange {
    const base = clampFilterCutoffHz(baseCutoffHz);
    const handle = clampFilterCutoffHz(handleCutoffHz);
    return cutoffsFromBaseModulationOctaves({
        baseCutoffHz: base,
        amountOctaves: Math.abs(Math.log2(handle / base)),
        polarity: "bipolar",
    });
}

export function modulationOctavesFromCutoffRange({
    baseCutoffHz,
    range,
    polarity,
}: {
    baseCutoffHz: number;
    range: FilterRange;
    polarity: FilterRangePolarity;
}) {
    const base = clampFilterCutoffHz(baseCutoffHz);
    const start = clampFilterCutoffHz(range.startCutoffHz);
    const end = clampFilterCutoffHz(range.endCutoffHz);

    if (polarity === "bipolar") {
        return Math.max(Math.abs(Math.log2(start / base)), Math.abs(Math.log2(end / base)));
    }

    return Math.log2(end / base);
}

export function cutoffsFromCenterRangeOctaves({
    centerCutoffHz,
    rangeOctaves,
    direction,
}: {
    centerCutoffHz: number;
    rangeOctaves: number;
    direction: 1 | -1;
}): FilterRange {
    const center = clampFilterCutoffHz(centerCutoffHz);
    const ratio = 2 ** (clamp(finiteNumber(rangeOctaves, 0), 0, MODULATION_RANGE_OCTAVE_LIMIT) * 0.5);
    const lowCutoffHz = clampFilterCutoffHz(center / ratio);
    const highCutoffHz = clampFilterCutoffHz(center * ratio);

    return direction >= 0
        ? { startCutoffHz: lowCutoffHz, endCutoffHz: highCutoffHz }
        : { startCutoffHz: highCutoffHz, endCutoffHz: lowCutoffHz };
}
