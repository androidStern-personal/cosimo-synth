import { FILTER_SPECTRUM_RENDER_MODE_OPTIONS, type FilterSpectrumRenderMode } from "../../kit/ui/filter-spectrum";

export * from "../../kit/ui/filter-spectrum";

export function cycleFilterSpectrumRenderMode(currentMode: FilterSpectrumRenderMode): FilterSpectrumRenderMode {
    const currentIndex = FILTER_SPECTRUM_RENDER_MODE_OPTIONS.findIndex((option) => option.value === currentMode);
    const nextIndex = currentIndex >= 0
        ? (currentIndex + 1) % FILTER_SPECTRUM_RENDER_MODE_OPTIONS.length
        : 0;
    return FILTER_SPECTRUM_RENDER_MODE_OPTIONS[nextIndex].value;
}
