/**
 * The shared rolling dominant-axis classifier accepted by ADR-024.
 *
 * One classifier serves both the numeric readout cells and the wavetable
 * graph. Consumers map the two axes onto different authorities (readouts:
 * horizontal = base, vertical = route amount; graph: horizontal = Warp,
 * vertical = Index), but the movement semantics are identical:
 *
 * - a gesture begins `pending` and changes nothing until movement leaves the
 *   activation radius AND one axis clearly dominates;
 * - after activation, every sample applies to exactly one axis; the
 *   orthogonal component is discarded immediately and never becomes debt;
 * - the active axis may switch during the same gesture when contrary motion
 *   clearly dominates a short rolling window; the switching sample is
 *   consumed and direction history is cleared, so a switch can never jump.
 *
 * The numeric constants are device calibration (ADR-024): tunable with real
 * phone evidence, never a license to change the mapping or reintroduce
 * release-locked direction.
 */

export type RollingAxis = "horizontal" | "vertical";

export type RollingAxisMode = "pending" | RollingAxis;

export type RollingAxisPointerType = "touch" | "mouse" | "pen";

export type RollingAxisConfig = {
    /** Activation radius for touch pointers, in CSS pixels. */
    readonly touchActivationPx: number;
    /** Activation radius for mouse/pen pointers, in CSS pixels. */
    readonly pointerActivationPx: number;
    /** Total-movement dominance ratio required for initial classification. */
    readonly initialDominanceRatio: number;
    /** Rolling-window dominance ratio required to switch the active axis. */
    readonly switchDominanceRatio: number;
    /** Minimum contrary-axis evidence, in CSS pixels, required to switch. */
    readonly switchEvidencePx: number;
    /** Rolling direction-history window, in milliseconds. */
    readonly directionWindowMs: number;
};

/** The accepted starting calibration from the Variant-D prototype. */
export const DEFAULT_ROLLING_AXIS_CONFIG: RollingAxisConfig = Object.freeze({
    touchActivationPx: 8,
    pointerActivationPx: 4,
    initialDominanceRatio: 1.3,
    switchDominanceRatio: 1.6,
    switchEvidencePx: 4,
    directionWindowMs: 36,
});

type DirectionSample = {
    readonly dx: number;
    readonly dy: number;
    readonly time: number;
};

export type RollingAxisState = {
    readonly mode: RollingAxisMode;
    readonly startX: number;
    readonly startY: number;
    readonly lastX: number;
    readonly lastY: number;
    readonly history: ReadonlyArray<DirectionSample>;
};

export type RollingAxisSample = {
    readonly x: number;
    readonly y: number;
    readonly time: number;
    readonly pointerType: RollingAxisPointerType;
};

export type RollingAxisTransition = "none" | "activate" | "switch";

export type RollingAxisApplication = {
    readonly axis: RollingAxis;
    /** Rightward-positive horizontal delta; zero when `axis` is vertical. */
    readonly dx: number;
    /** Upward-positive vertical delta; zero when `axis` is horizontal. */
    readonly dy: number;
};

export type RollingAxisResult = {
    readonly state: RollingAxisState;
    readonly transition: RollingAxisTransition;
    /** Exactly one axis application, or null for consumed/ignored samples. */
    readonly application: RollingAxisApplication | null;
};

export function createRollingAxisState(x: number, y: number): RollingAxisState {
    return Object.freeze({
        mode: "pending" as const,
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
        history: Object.freeze([]),
    });
}

function activationRadius(pointerType: RollingAxisPointerType, config: RollingAxisConfig): number {
    return pointerType === "touch" ? config.touchActivationPx : config.pointerActivationPx;
}

function prunedHistory(
    history: ReadonlyArray<DirectionSample>,
    nextSample: DirectionSample,
    windowMs: number,
): ReadonlyArray<DirectionSample> {
    const cutoff = nextSample.time - windowMs;
    return Object.freeze([...history.filter((sample) => sample.time >= cutoff), nextSample]);
}

function historyVector(history: ReadonlyArray<DirectionSample>): { readonly x: number; readonly y: number } {
    let x = 0;
    let y = 0;
    for (const sample of history) {
        x += sample.dx;
        y += sample.dy;
    }
    return { x, y };
}

function shouldSwitchAxis(
    mode: RollingAxis,
    vector: { readonly x: number; readonly y: number },
    config: RollingAxisConfig,
): boolean {
    const horizontal = Math.abs(vector.x);
    const vertical = Math.abs(vector.y);
    if (mode === "horizontal") {
        return vertical >= config.switchEvidencePx
            && vertical >= horizontal * config.switchDominanceRatio;
    }
    return horizontal >= config.switchEvidencePx
        && horizontal >= vertical * config.switchDominanceRatio;
}

function resolveInitialAxis(
    totalDx: number,
    totalDy: number,
    config: RollingAxisConfig,
): RollingAxis | null {
    const horizontal = Math.abs(totalDx);
    const vertical = Math.abs(totalDy);
    if (horizontal >= vertical * config.initialDominanceRatio) {
        return "horizontal";
    }
    if (vertical >= horizontal * config.initialDominanceRatio) {
        return "vertical";
    }
    return null;
}

/**
 * Advance the classifier by one pointer sample.
 *
 * `sample.y` uses ordinary screen coordinates (down-positive); applications
 * report `dy` up-positive so consumers read "up increases" directly.
 */
export function applyRollingAxisSample(
    state: RollingAxisState,
    sample: RollingAxisSample,
    config: RollingAxisConfig = DEFAULT_ROLLING_AXIS_CONFIG,
): RollingAxisResult {
    const dx = sample.x - state.lastX;
    const dyUp = state.lastY - sample.y;

    if (Math.abs(dx) < 0.001 && Math.abs(dyUp) < 0.001) {
        return { state, transition: "none", application: null };
    }

    const direction: DirectionSample = Object.freeze({ dx, dy: dyUp, time: sample.time });
    const history = prunedHistory(state.history, direction, config.directionWindowMs);
    const moved: RollingAxisState = Object.freeze({
        ...state,
        lastX: sample.x,
        lastY: sample.y,
        history,
    });

    if (state.mode === "pending") {
        const totalDx = sample.x - state.startX;
        const totalDyUp = state.startY - sample.y;
        if (Math.hypot(totalDx, totalDyUp) < activationRadius(sample.pointerType, config)) {
            return { state: moved, transition: "none", application: null };
        }
        const axis = resolveInitialAxis(totalDx, totalDyUp, config);
        if (axis === null) {
            return { state: moved, transition: "none", application: null };
        }
        // The classifying sample is consumed: it selects an axis but applies
        // no delta, and direction history restarts from the activation point.
        return {
            state: Object.freeze({ ...moved, mode: axis, history: Object.freeze([]) }),
            transition: "activate",
            application: null,
        };
    }

    const vector = historyVector(history);
    if (shouldSwitchAxis(state.mode, vector, config)) {
        const nextAxis: RollingAxis = state.mode === "horizontal" ? "vertical" : "horizontal";
        // The switching sample is consumed and history clears, so the new
        // axis starts from zero accumulated motion: no debt, no jump.
        return {
            state: Object.freeze({ ...moved, mode: nextAxis, history: Object.freeze([]) }),
            transition: "switch",
            application: null,
        };
    }

    const application: RollingAxisApplication = state.mode === "horizontal"
        ? Object.freeze({ axis: "horizontal" as const, dx, dy: 0 })
        : Object.freeze({ axis: "vertical" as const, dx: 0, dy: dyUp });

    return { state: moved, transition: "none", application };
}
