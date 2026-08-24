import type { GestureScript } from "./gestures";

export function FingerOverlay({ gesture }: { readonly gesture: GestureScript | null }) {
    if (gesture === null) return <svg className="speedrun-finger-layer" viewBox="0 0 393 852" aria-hidden="true" />;
    const ringRadius = 13 + (gesture.ripple * 17);
    return (
        <svg className="speedrun-finger-layer" viewBox="0 0 393 852" aria-hidden="true" data-direction={gesture.direction}>
            {gesture.capture > 0 ? (
                <circle cx={gesture.target.x} cy={gesture.target.y} r={18 + gesture.capture * 12} fill="rgba(255,211,110,.14)" stroke="#ffd36e" strokeWidth="2" opacity={gesture.capture} />
            ) : null}
            {gesture.ghost !== null ? (
                <g transform={`translate(${gesture.ghost.x - 16} ${gesture.ghost.y - 9})`} opacity="0.86">
                    <rect width="32" height="18" rx="9" fill="#ffd36e" />
                    <path d="M 8 9 H 24" stroke="#2b2111" strokeWidth="2" />
                </g>
            ) : null}
            {gesture.ripple > 0 ? (
                <circle cx={gesture.finger.x} cy={gesture.finger.y} r={ringRadius} fill="none" stroke="#ffffff" strokeWidth="2" opacity={1 - gesture.ripple * 0.7} />
            ) : null}
            <circle cx={gesture.finger.x + 2} cy={gesture.finger.y + 4} r="13" fill="rgba(0,0,0,.48)" />
            <circle cx={gesture.finger.x} cy={gesture.finger.y} r="12" fill="#f3d4bd" stroke="#fff4ec" strokeWidth="2" />
            <circle cx={gesture.finger.x - 3} cy={gesture.finger.y - 4} r="3" fill="rgba(255,255,255,.56)" />
        </svg>
    );
}
