import { clampFilterCutoffHz, type FilterResponseModel } from "../../kit/ui/filter-response";

export * from "../../kit/ui/filter-response";

export function magnitudeAtFrequency(model: FilterResponseModel, targetHz: number) {
    const frequencies = model.frequenciesHz;
    const magnitudes = model.magnitudesDb;
    const clampedTarget = clampFilterCutoffHz(targetHz);

    if (clampedTarget <= frequencies[0]) {
        return magnitudes[0];
    }

    if (clampedTarget >= frequencies[frequencies.length - 1]) {
        return magnitudes[magnitudes.length - 1];
    }

    for (let index = 1; index < frequencies.length; index += 1) {
        if (frequencies[index] < clampedTarget) {
            continue;
        }

        const leftHz = frequencies[index - 1];
        const rightHz = frequencies[index];
        const t = (clampedTarget - leftHz) / Math.max(1e-9, rightHz - leftHz);
        return magnitudes[index - 1] + ((magnitudes[index] - magnitudes[index - 1]) * t);
    }

    return magnitudes[magnitudes.length - 1];
}
