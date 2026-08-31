import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
    EnhancerSpectrumGraph,
    type EnhancerSpectrumCurve,
    type EnhancerSpectrumMarker,
} from "./enhancer-spectrum-graph";
import {
    ENHANCER_SPECTRUM_PLOT,
    enhancerBellResponseDb,
    type EnhancerSpectrumDisplay,
} from "./enhancer-spectrum";
import type { VoiceEnhancerResponseDisplay } from "./voice-enhancer";

const GRAPH_RIGHT = ENHANCER_SPECTRUM_PLOT.width - ENHANCER_SPECTRUM_PLOT.right;
const GRAPH_BASELINE = ENHANCER_SPECTRUM_PLOT.height - ENHANCER_SPECTRUM_PLOT.bottom;
const PRIMARY_VOICE_CURVE_COLOR = "#a78bfa";
const VOICE_CURVE_COLORS = Object.freeze([
    PRIMARY_VOICE_CURVE_COLOR,
    "#7dd3fc",
    "#f0abfc",
    "#67e8f9",
    "#c4b5fd",
    "#93c5fd",
    "#e879f9",
    "#5eead4",
]);

function voiceCurveColor(voiceIndex: number): string {
    return VOICE_CURVE_COLORS[voiceIndex % VOICE_CURVE_COLORS.length]
        ?? PRIMARY_VOICE_CURVE_COLOR;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

type VoiceEnhancerGraphProps = {
    readonly frequencyNormalized: number;
    readonly q: number;
    readonly amount: number;
    readonly frequencyHz: number | null;
    readonly frequencyMode: "frequency" | "ratio";
    readonly spectrum: EnhancerSpectrumDisplay | null;
    readonly responses: ReadonlyArray<VoiceEnhancerResponseDisplay>;
    readonly compact?: boolean;
    readonly disabled?: boolean;
    readonly className?: string;
    readonly onGestureStart: () => void;
    readonly onGestureEnd: () => void;
    readonly onFrequencyNormalizedChange: (value: number) => void;
    readonly onAmountChange: (value: number) => void;
};

/**
 * The Enhancer's two-axis bell editor. Horizontal travel owns Frequency or
 * Ratio, vertical travel owns Amount, and Q only changes the visible width.
 */
export function VoiceEnhancerGraph({
    frequencyNormalized,
    q,
    amount,
    frequencyHz,
    frequencyMode,
    spectrum,
    responses,
    compact = false,
    disabled = false,
    className,
    onGestureStart,
    onGestureEnd,
    onFrequencyNormalizedChange,
    onAmountChange,
}: VoiceEnhancerGraphProps) {
    const graphRef = useRef<HTMLDivElement | null>(null);
    const activePointerRef = useRef<number | null>(null);
    const captureWasObservedRef = useRef(false);
    const captureWatchFrameRef = useRef<number | null>(null);
    const onGestureEndRef = useRef(onGestureEnd);
    const onFrequencyNormalizedChangeRef = useRef(onFrequencyNormalizedChange);
    const onAmountChangeRef = useRef(onAmountChange);
    onGestureEndRef.current = onGestureEnd;
    onFrequencyNormalizedChangeRef.current = onFrequencyNormalizedChange;
    onAmountChangeRef.current = onAmountChange;
    const normalizedFrequency = clamp01(frequencyNormalized);
    const normalizedAmount = clamp01(amount);
    const curves = useMemo<ReadonlyArray<EnhancerSpectrumCurve>>(() => {
        if (responses.length > 0) {
            return responses.map((response) => ({
                id: `voice-${response.voiceIndex}`,
                label: `Voice ${response.voiceIndex + 1}`,
                color: voiceCurveColor(response.voiceIndex),
                gainDbAtFrequency: (nextFrequencyHz: number) => enhancerBellResponseDb(
                    nextFrequencyHz,
                    response.frequencyHz,
                    response.q,
                    response.amount,
                ),
            }));
        }

        return frequencyHz === null ? [] : [{
            id: "base",
            label: "Base response",
            color: PRIMARY_VOICE_CURVE_COLOR,
            gainDbAtFrequency: (nextFrequencyHz: number) => enhancerBellResponseDb(
                nextFrequencyHz,
                frequencyHz,
                q,
                amount,
            ),
        }];
    }, [amount, frequencyHz, q, responses]);
    const markers = useMemo<ReadonlyArray<EnhancerSpectrumMarker>>(() => (
        frequencyHz === null ? [] : [{
            id: "base-edit",
            label: "Editable base frequency and amount",
            frequencyHz,
            gainDb: normalizedAmount * 12,
            color: "#d9ccff",
            dataRole: "voice-enhancer-graph-handle",
        }]
    ), [frequencyHz, normalizedAmount]);

    const applyPointer = useCallback((event: Pick<PointerEvent, "clientX" | "clientY">) => {
        const bounds = graphRef.current?.getBoundingClientRect();
        if (!bounds) return;
        if (bounds.width <= 0 || bounds.height <= 0) return;
        const viewboxX = ((event.clientX - bounds.left) / bounds.width)
            * ENHANCER_SPECTRUM_PLOT.width;
        const viewboxY = ((event.clientY - bounds.top) / bounds.height)
            * ENHANCER_SPECTRUM_PLOT.height;
        onFrequencyNormalizedChangeRef.current(clamp01(
            (viewboxX - ENHANCER_SPECTRUM_PLOT.left)
                / (GRAPH_RIGHT - ENHANCER_SPECTRUM_PLOT.left),
        ));
        onAmountChangeRef.current(clamp01(
            (GRAPH_BASELINE - viewboxY)
                / (GRAPH_BASELINE - ENHANCER_SPECTRUM_PLOT.top),
        ));
    }, []);

    const finishGesture = useCallback((pointerID?: number) => {
        if (activePointerRef.current === null
            || (pointerID !== undefined && activePointerRef.current !== pointerID)) return;
        if (captureWatchFrameRef.current !== null) {
            window.cancelAnimationFrame(captureWatchFrameRef.current);
            captureWatchFrameRef.current = null;
        }
        captureWasObservedRef.current = false;
        activePointerRef.current = null;
        onGestureEndRef.current();
    }, []);

    const watchPointerCapture = useCallback((pointerID: number) => {
        const inspectCapture = () => {
            captureWatchFrameRef.current = null;
            if (activePointerRef.current !== pointerID) return;

            let hasCapture = false;
            try {
                hasCapture = graphRef.current?.hasPointerCapture(pointerID) ?? false;
            } catch {
                // Unsupported capture continues through the window fallbacks.
            }

            if (hasCapture) {
                captureWasObservedRef.current = true;
            } else if (captureWasObservedRef.current) {
                finishGesture(pointerID);
                return;
            }

            captureWatchFrameRef.current = window.requestAnimationFrame(inspectCapture);
        };

        captureWatchFrameRef.current = window.requestAnimationFrame(inspectCapture);
    }, [finishGesture]);

    useEffect(() => {
        const graph = graphRef.current;
        const handleFallbackPointerMove = (event: PointerEvent) => {
            if (activePointerRef.current !== event.pointerId) return;
            if (event.target instanceof Node && graph?.contains(event.target)) return;
            applyPointer(event);
        };
        const handlePointerEnd = (event: PointerEvent) => finishGesture(event.pointerId);
        const handleLostPointerCapture = (event: PointerEvent) => finishGesture(event.pointerId);
        const handleWindowBlur = () => finishGesture();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") finishGesture();
        };
        // Own capture loss at the native target: programmatic release can miss
        // React's delegated lost-pointer-capture dispatch in real browsers.
        graph?.addEventListener("lostpointercapture", handleLostPointerCapture);
        window.addEventListener("pointermove", handleFallbackPointerMove, true);
        window.addEventListener("pointerup", handlePointerEnd, true);
        window.addEventListener("pointercancel", handlePointerEnd, true);
        window.addEventListener("blur", handleWindowBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            graph?.removeEventListener("lostpointercapture", handleLostPointerCapture);
            window.removeEventListener("pointermove", handleFallbackPointerMove, true);
            window.removeEventListener("pointerup", handlePointerEnd, true);
            window.removeEventListener("pointercancel", handlePointerEnd, true);
            window.removeEventListener("blur", handleWindowBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            finishGesture();
        };
    }, [applyPointer, finishGesture]);

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        const coarse = event.shiftKey ? 0.05 : 0.01;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            onGestureStart();
            onFrequencyNormalizedChange(clamp01(
                normalizedFrequency + (event.key === "ArrowRight" ? coarse : -coarse),
            ));
            onGestureEnd();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            onGestureStart();
            onAmountChange(clamp01(
                normalizedAmount + (event.key === "ArrowUp" ? coarse : -coarse),
            ));
            onGestureEnd();
        }
    };

    return (
        <div
            ref={graphRef}
            data-role="voice-enhancer-graph"
            data-frequency-normalized={normalizedFrequency.toFixed(6)}
            data-amount={normalizedAmount.toFixed(6)}
            data-frequency-mode={frequencyMode}
            data-active-response-count={responses.length}
            className={`voice-enhancer-graph${compact ? " is-compact" : ""} ${className ?? ""}`.trim()}
            role="slider"
            aria-label="Enhancer Frequency or Ratio and Amount"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(normalizedAmount * 100)}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            onPointerDown={(event) => {
                if (disabled || event.button !== 0 || activePointerRef.current !== null) return;
                event.preventDefault();
                activePointerRef.current = event.pointerId;
                try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    captureWasObservedRef.current = event.currentTarget.hasPointerCapture(event.pointerId);
                } catch {
                    // Window fallbacks continue the gesture when capture is unavailable.
                }
                onGestureStart();
                applyPointer(event);
                watchPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                if (activePointerRef.current !== event.pointerId) return;
                applyPointer(event);
            }}
            onPointerUp={(event) => finishGesture(event.pointerId)}
            onPointerCancel={(event) => finishGesture(event.pointerId)}
        >
            <EnhancerSpectrumGraph
                spectrum={spectrum}
                curves={curves}
                markers={markers}
                ariaLabel="Live audio entering the per-voice Enhancer and its active voice responses"
                className="voice-enhancer-spectrum"
            />
            <span className="voice-enhancer-graph-topline" aria-hidden="true">LINKED M/S</span>
        </div>
    );
}
