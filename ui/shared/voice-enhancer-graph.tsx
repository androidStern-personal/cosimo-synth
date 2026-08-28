import {
    useCallback,
    useId,
    useMemo,
    useRef,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 320;
const GRAPH_LEFT = 34;
const GRAPH_RIGHT = VIEWBOX_WIDTH - 34;
const GRAPH_TOP = 28;
const GRAPH_BASELINE = VIEWBOX_HEIGHT - 38;

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

type VoiceEnhancerGraphProps = {
    readonly frequencyNormalized: number;
    readonly q: number;
    readonly amount: number;
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
    disabled = false,
    className,
    onGestureStart,
    onGestureEnd,
    onFrequencyNormalizedChange,
    onAmountChange,
}: VoiceEnhancerGraphProps) {
    const activePointerRef = useRef<number | null>(null);
    const gradientID = useId();
    const normalizedFrequency = clamp01(frequencyNormalized);
    const normalizedAmount = clamp01(amount);
    const centerX = GRAPH_LEFT + (normalizedFrequency * (GRAPH_RIGHT - GRAPH_LEFT));
    const peakY = GRAPH_BASELINE - (normalizedAmount * (GRAPH_BASELINE - GRAPH_TOP));
    const curvePath = useMemo(() => {
        const safeQ = Math.min(10, Math.max(0.1, q));
        const width = Math.max(0.025, 0.22 / Math.sqrt(safeQ));
        const points = Array.from({ length: 97 }, (_, index) => {
            const xNormalized = index / 96;
            const distance = (xNormalized - normalizedFrequency) / width;
            const bell = Math.exp(-0.5 * distance * distance);
            const x = GRAPH_LEFT + (xNormalized * (GRAPH_RIGHT - GRAPH_LEFT));
            const y = GRAPH_BASELINE
                - (normalizedAmount * bell * (GRAPH_BASELINE - GRAPH_TOP));
            return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        });
        return points.join(" ");
    }, [normalizedAmount, normalizedFrequency, q]);

    const applyPointer = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return;
        const viewboxX = ((event.clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH;
        const viewboxY = ((event.clientY - bounds.top) / bounds.height) * VIEWBOX_HEIGHT;
        onFrequencyNormalizedChange(clamp01(
            (viewboxX - GRAPH_LEFT) / (GRAPH_RIGHT - GRAPH_LEFT),
        ));
        onAmountChange(clamp01(
            (GRAPH_BASELINE - viewboxY) / (GRAPH_BASELINE - GRAPH_TOP),
        ));
    }, [onAmountChange, onFrequencyNormalizedChange]);

    const finishGesture = useCallback((pointerID: number) => {
        if (activePointerRef.current !== pointerID) return;
        activePointerRef.current = null;
        onGestureEnd();
    }, [onGestureEnd]);

    const handleKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
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
        <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            preserveAspectRatio="none"
            data-role="voice-enhancer-graph"
            data-frequency-normalized={normalizedFrequency.toFixed(6)}
            data-amount={normalizedAmount.toFixed(6)}
            className={className}
            role="slider"
            aria-label="Enhancer Frequency or Ratio and Amount"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(normalizedAmount * 100)}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            onPointerDown={(event) => {
                if (disabled || activePointerRef.current !== null) return;
                event.preventDefault();
                activePointerRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                onGestureStart();
                applyPointer(event);
            }}
            onPointerMove={(event) => {
                if (activePointerRef.current !== event.pointerId) return;
                applyPointer(event);
            }}
            onPointerUp={(event) => finishGesture(event.pointerId)}
            onPointerCancel={(event) => finishGesture(event.pointerId)}
            onLostPointerCapture={(event) => finishGesture(event.pointerId)}
        >
            <defs>
                <linearGradient id={gradientID} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#a78bfa" stopOpacity="0.42" />
                    <stop offset="1" stopColor="#a78bfa" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} rx="18" fill="#080d10" />
            {[0.25, 0.5, 0.75].map((position) => (
                <line
                    key={`vertical-${position}`}
                    x1={GRAPH_LEFT + (position * (GRAPH_RIGHT - GRAPH_LEFT))}
                    x2={GRAPH_LEFT + (position * (GRAPH_RIGHT - GRAPH_LEFT))}
                    y1={GRAPH_TOP}
                    y2={GRAPH_BASELINE}
                    stroke="rgba(255,255,255,0.055)"
                    strokeWidth="1"
                />
            ))}
            <line
                x1={GRAPH_LEFT}
                x2={GRAPH_RIGHT}
                y1={GRAPH_BASELINE}
                y2={GRAPH_BASELINE}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1.5"
            />
            <path
                d={`${curvePath} L ${GRAPH_RIGHT} ${GRAPH_BASELINE} L ${GRAPH_LEFT} ${GRAPH_BASELINE} Z`}
                fill={`url(#${gradientID})`}
            />
            <path d={curvePath} fill="none" stroke="#a78bfa" strokeWidth="4" />
            <line
                x1={centerX}
                x2={centerX}
                y1={peakY}
                y2={GRAPH_BASELINE}
                stroke="rgba(167,139,250,0.38)"
                strokeDasharray="5 7"
                strokeWidth="2"
            />
            <circle
                data-role="voice-enhancer-graph-handle"
                cx={centerX}
                cy={peakY}
                r="9"
                fill="#d9ccff"
                stroke="#6d46d8"
                strokeWidth="4"
            />
            <text x={GRAPH_LEFT + 4} y={GRAPH_TOP + 14} fill="rgba(255,255,255,0.46)" fontSize="15">
                LINKED M/S
            </text>
        </svg>
    );
}
