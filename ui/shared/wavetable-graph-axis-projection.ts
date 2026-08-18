/**
 * The provisional graph-axis seam accepted by ADR-024.
 *
 * The wavetable graph reuses the shared rolling-axis classifier; this module
 * owns ONLY which oscillator control each classified axis edits and how
 * pixel travel projects onto that control's normalized value. The horizontal
 * binding (Warp Amount) is provisional: a later physical-use review may
 * replace it with discrete wavetable switching. Keeping the axis resolution
 * behind this descriptor lets that happen without touching the classifier,
 * the vertical Index binding, or the renderer.
 */

import type { RollingAxis } from "./rolling-axis-classifier";
import type { OscillatorControlID } from "./oscillator-binding";

export type GraphAxisBinding = {
    readonly controlID: OscillatorControlID;
    /**
     * Sign applied to the axis delta before integration. Horizontal deltas
     * are rightward-positive; vertical deltas are upward-positive.
     */
    readonly direction: 1 | -1;
    /** CSS pixels of travel that cross the control's full normalized range. */
    readonly pixelsPerFullRange: number;
};

export type WavetableGraphAxisDescriptor = {
    readonly horizontal: GraphAxisBinding;
    readonly vertical: GraphAxisBinding;
};

/**
 * The accepted cutover: X edits Warp Amount (provisional), Y edits Index.
 * 220 px per full range is the accepted base-sensitivity calibration.
 */
export const PROVISIONAL_WAVETABLE_GRAPH_AXES: WavetableGraphAxisDescriptor = Object.freeze({
    horizontal: Object.freeze({
        controlID: "warpAmount" as const,
        direction: 1 as const,
        pixelsPerFullRange: 220,
    }),
    vertical: Object.freeze({
        controlID: "framePosition" as const,
        direction: 1 as const,
        pixelsPerFullRange: 220,
    }),
});

export type GraphAxisWrite = {
    readonly controlID: OscillatorControlID;
    readonly nextNormalized: number;
};

function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

/**
 * Project one applied classifier sample onto exactly one control write.
 * `dx` is rightward-positive, `dy` upward-positive; the classifier
 * guarantees the orthogonal component is zero.
 */
export function projectGraphAxisWrite(
    descriptor: WavetableGraphAxisDescriptor,
    axis: RollingAxis,
    currentNormalized: number,
    dx: number,
    dy: number,
): GraphAxisWrite {
    const binding = axis === "horizontal" ? descriptor.horizontal : descriptor.vertical;
    const delta = axis === "horizontal" ? dx : dy;
    const nextNormalized = clamp01(
        currentNormalized + (delta * binding.direction) / binding.pixelsPerFullRange,
    );
    return Object.freeze({ controlID: binding.controlID, nextNormalized });
}
