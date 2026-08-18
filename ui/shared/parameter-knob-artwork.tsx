/**
 * The pure dual-ring knob artwork shared by the ADR-024 precision HUD.
 *
 * Geometry matches the accepted production FX knob exactly
 * (`ui/desktop/rack-parameter-knob.tsx`): a 106-unit viewBox with the base
 * pie at radius 25 inside the modulation annulus between radii 36 and 48,
 * sweeping 270° clockwise from 225°, both tracks stippled with a 4×4
 * user-space dot pattern. Colors follow ADR-025: the base wears the owning
 * section's accent, the outer ring wears the selected source's accent, and
 * grey is reserved for bypassed/unavailable states.
 *
 * This is artwork only. It owns no gestures; the FX controller's behavior
 * is deliberately untouched (ADR-024 §14).
 */

import { useId } from "react";

const KNOB_CENTER = 50;
const KNOB_SWEEP_START_DEGREES = 225;
const KNOB_SWEEP_DEGREES = 270;
const BASE_RADIUS = 25;
const MOD_INNER_RADIUS = 36;
const MOD_OUTER_RADIUS = 48;
const HANDLE_RADIUS = BASE_RADIUS * 0.72;
const PRESENCE_RADIUS = (MOD_INNER_RADIUS + MOD_OUTER_RADIUS) / 2;
const BYPASSED_GREY = "#758084";

function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

function polarPoint(normalized: number, radius: number): { x: number; y: number } {
    const degrees = KNOB_SWEEP_START_DEGREES - (clamp01(normalized) * KNOB_SWEEP_DEGREES);
    const radians = (degrees * Math.PI) / 180;
    return {
        x: KNOB_CENTER + (radius * Math.cos(radians)),
        y: KNOB_CENTER - (radius * Math.sin(radians)),
    };
}

function pointText(point: { x: number; y: number }): string {
    return `${point.x.toFixed(3)} ${point.y.toFixed(3)}`;
}

function pieSectorPath(fromNormalized: number, toNormalized: number, radius: number): string {
    const low = Math.min(fromNormalized, toNormalized);
    const high = Math.max(fromNormalized, toNormalized);
    const extent = (high - low) * KNOB_SWEEP_DEGREES;
    if (extent <= 0.001) {
        return "";
    }
    const start = polarPoint(low, radius);
    const end = polarPoint(high, radius);
    const largeArc = extent > 180 ? 1 : 0;
    return `M ${KNOB_CENTER} ${KNOB_CENTER} L ${pointText(start)} A ${radius} ${radius} 0 ${largeArc} 1 ${pointText(end)} Z`;
}

function annularSectorPath(
    fromNormalized: number,
    toNormalized: number,
    innerRadius: number,
    outerRadius: number,
): string {
    const low = Math.min(fromNormalized, toNormalized);
    const high = Math.max(fromNormalized, toNormalized);
    const extent = (high - low) * KNOB_SWEEP_DEGREES;
    if (extent <= 0.001) {
        return "";
    }
    const outerStart = polarPoint(low, outerRadius);
    const outerEnd = polarPoint(high, outerRadius);
    const innerStart = polarPoint(low, innerRadius);
    const innerEnd = polarPoint(high, innerRadius);
    const largeArc = extent > 180 ? 1 : 0;
    return `M ${pointText(outerStart)} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${pointText(outerEnd)}`
        + ` L ${pointText(innerEnd)} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${pointText(innerStart)} Z`;
}

export type ParameterKnobModRing =
    /** No armed source: the outer ring is absent entirely. */
    | { readonly kind: "hidden" }
    /** Armed but unmapped: a source-colored dotted ring, never a band. */
    | { readonly kind: "unmapped" }
    /** A real route: band between normalized low/high plus a presence dot. */
    | {
        readonly kind: "mapped";
        readonly lowNormalized: number;
        readonly highNormalized: number;
        readonly bypassed: boolean;
    };

export type ParameterKnobArtworkProps = {
    /** Normalized base value that positions the pie fill and handle. */
    readonly baseNormalized: number;
    /** Normalized fill origin: 0 for unipolar ranges, the zero point for bipolar. */
    readonly baseOriginNormalized: number;
    /** The owning section's accent (ADR-025): Voice teal, an FX accent, … */
    readonly ownerAccent: string;
    /** The selected modulation source's accent. */
    readonly sourceAccent: string;
    readonly modRing: ParameterKnobModRing;
    /** Which half of the artwork the active gesture emphasizes. */
    readonly emphasis: "base" | "modulation" | "none";
    readonly className?: string;
};

/** Render the dual-ring artwork. Purely presentational; sized by its host. */
export function ParameterKnobArtwork({
    baseNormalized,
    baseOriginNormalized,
    ownerAccent,
    sourceAccent,
    modRing,
    emphasis,
    className,
}: ParameterKnobArtworkProps) {
    const patternIDBase = useId();
    const basePatternID = `${patternIDBase}-base`;
    const modPatternID = `${patternIDBase}-mod`;
    const handle = polarPoint(clamp01(baseNormalized), HANDLE_RADIUS);
    const presence = polarPoint(clamp01(baseNormalized), PRESENCE_RADIUS);

    const baseTrackOpacity = 0.34;
    const baseFillStyle = emphasis === "base"
        ? { opacity: 1, filter: `drop-shadow(0 0 5px ${ownerAccent})` }
        : { opacity: emphasis === "modulation" ? 0.46 : 1 };
    const baseTrackStyle = emphasis === "base"
        ? { opacity: 1, filter: `drop-shadow(0 0 5px ${ownerAccent})` }
        : { opacity: baseTrackOpacity };

    return (
        <svg
            viewBox="-3 -3 106 106"
            className={className}
            style={{ overflow: "visible" }}
            aria-hidden="true"
            data-role="parameter-knob-artwork"
        >
            <defs>
                <pattern id={basePatternID} width="4" height="4" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="0.9" fill={ownerAccent} />
                </pattern>
                <pattern id={modPatternID} width="4" height="4" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="0.9" fill={sourceAccent} />
                </pattern>
            </defs>

            <path
                data-role="knob-artwork-base-track"
                d={pieSectorPath(0, 1, BASE_RADIUS)}
                fill={`url(#${basePatternID})`}
                style={baseTrackStyle}
            />
            <path
                data-role="knob-artwork-base-fill"
                d={pieSectorPath(baseOriginNormalized, baseNormalized, BASE_RADIUS)}
                fill={ownerAccent}
                style={baseFillStyle}
            />

            {modRing.kind === "unmapped" ? (
                <path
                    data-role="knob-artwork-mod-track"
                    data-mod-ring="unmapped"
                    d={annularSectorPath(0, 1, MOD_INNER_RADIUS, MOD_OUTER_RADIUS)}
                    fill="none"
                    stroke={sourceAccent}
                    strokeWidth={2}
                    strokeDasharray="1.2 4.6"
                    style={{ opacity: 0.62 }}
                />
            ) : null}

            {modRing.kind === "mapped" ? (
                <g data-mod-ring={modRing.bypassed ? "bypassed" : "mapped"}>
                    <path
                        data-role="knob-artwork-mod-track"
                        d={annularSectorPath(0, 1, MOD_INNER_RADIUS, MOD_OUTER_RADIUS)}
                        fill={modRing.bypassed ? "none" : `url(#${modPatternID})`}
                        stroke={modRing.bypassed ? BYPASSED_GREY : "none"}
                        strokeWidth={modRing.bypassed ? 1.2 : 0}
                        strokeDasharray={modRing.bypassed ? "2.4 2.4" : undefined}
                        style={{ opacity: modRing.bypassed ? 0.32 : (emphasis === "modulation" ? 0.38 : 0.34) }}
                    />
                    <path
                        data-role="knob-artwork-mod-fill"
                        d={annularSectorPath(
                            modRing.lowNormalized,
                            modRing.highNormalized,
                            MOD_INNER_RADIUS,
                            MOD_OUTER_RADIUS,
                        )}
                        fill={modRing.bypassed ? BYPASSED_GREY : sourceAccent}
                        style={modRing.bypassed
                            ? { opacity: 0.32 }
                            : emphasis === "modulation"
                                ? { opacity: 0.94, filter: `drop-shadow(0 0 5px ${sourceAccent})` }
                                : { opacity: 0.46 }}
                    />
                    <circle
                        data-role="knob-artwork-route-presence"
                        cx={presence.x.toFixed(3)}
                        cy={presence.y.toFixed(3)}
                        r="2.25"
                        fill={modRing.bypassed ? "transparent" : sourceAccent}
                        stroke={modRing.bypassed ? BYPASSED_GREY : "rgba(255, 255, 255, 0.84)"}
                        strokeWidth="0.9"
                        strokeDasharray={modRing.bypassed ? "1 1" : undefined}
                        style={modRing.bypassed
                            ? { opacity: 0.32 }
                            : { filter: `drop-shadow(0 0 2px ${sourceAccent})` }}
                    />
                </g>
            ) : null}

            <circle
                data-role="knob-artwork-handle"
                cx={handle.x.toFixed(3)}
                cy={handle.y.toFixed(3)}
                r="2.5"
                fill="#f5f6f6"
                stroke="rgba(3, 5, 12, 0.72)"
                strokeWidth="1"
            />
        </svg>
    );
}
