import {
    advanceEnhancerSpectrum,
    type EnhancerSpectrumDisplay,
} from "./enhancer-spectrum";
import {
    normalizePolishMeterMessage,
    SILENT_POLISH_METER_FRAME,
    type PolishMeterFrame,
} from "./polish";

/** Retained UI state decoded from the two event types on `polishMeter`. */
export type PolishTelemetryDisplay = {
    readonly meter: PolishMeterFrame;
    readonly spectrum: EnhancerSpectrumDisplay | null;
};

/** Create the disconnected/silent state for the shared Polish telemetry endpoint. */
export function createPolishTelemetryDisplay(): PolishTelemetryDisplay {
    return {
        meter: SILENT_POLISH_METER_FRAME,
        spectrum: null,
    };
}

/**
 * Retain the last valid meter and spectrum independently as their Cmajor union
 * events alternate on the existing endpoint. A null message resets the seam.
 */
export function advancePolishTelemetryDisplay(
    current: PolishTelemetryDisplay,
    message: unknown | null,
    timestampMs: number,
): PolishTelemetryDisplay {
    if (message === null) {
        return createPolishTelemetryDisplay();
    }

    return {
        meter: normalizePolishMeterMessage(message) ?? current.meter,
        spectrum: advanceEnhancerSpectrum(message, current.spectrum, timestampMs),
    };
}
