/**
 * The ADR-025 precision HUD: one fixed top-center presentation shared by
 * every draggable parameter control (voice readout cells and all knobs).
 * Consumers compute a complete view model; this component owns the DOM so
 * the presentation cannot drift between control families.
 *
 * Styles live in mobile-voice-editor.css under the `mobile-voice-hud`
 * classes (kept stable for test and CSS continuity).
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react";

import { hexToRGBColor } from "./theme";
import { casesHandled } from "./result";

import {
    MOD_LIGHT_RADIUS,
    ParameterKnobArtwork,
    type ParameterKnobModRing,
} from "./parameter-knob-artwork";
import {
    useModSourceLight,
    type ModSourceIdentity,
    type ModSourceLightPlacement,
} from "./mod-source-live";
import type { MsegShape } from "./mseg";
import { DistortionVisualizer } from "./distortion-visualizer";
import {
    FilterResponseGraph,
    MsegPreview,
    WavetableCanvas,
} from "./synth-components";

/** How long the HUD lingers after a released drag before hiding (ADR-024). */
export const PARAMETER_HUD_LINGER_MS = 420;

/**
 * The fixed top-center element every control portals its precision HUD into.
 * Hosts (desktop and iOS patch views) provide it; a null layer means the
 * surface has no HUD host and controls simply do not present one.
 */
export const ParameterHudLayerContext = createContext<Element | null>(null);

const NOOP_PARAMETER_HUD_SUPPRESSION_RELEASE = () => undefined;
const DEFAULT_PARAMETER_HUD_SUPPRESSION = {
    suppressed: false,
    acquire: () => NOOP_PARAMETER_HUD_SUPPRESSION_RELEASE,
};

const ParameterHudSuppressionContext = createContext<{
    readonly suppressed: boolean;
    readonly acquire: () => () => void;
}>(DEFAULT_PARAMETER_HUD_SUPPRESSION);

/** Own all active direct-manipulation leases that temporarily hide HUD portals. */
export function ParameterHudSuppressionProvider({ children }: { readonly children: ReactNode }) {
    const [activeLeases, setActiveLeases] = useState<ReadonlySet<symbol>>(() => new Set());
    const acquire = useCallback(() => {
        const lease = Symbol("parameter-hud-suppression");
        setActiveLeases((current) => {
            const next = new Set(current);
            next.add(lease);
            return next;
        });
        let released = false;

        return () => {
            if (released) {
                return;
            }
            released = true;
            setActiveLeases((current) => {
                if (!current.has(lease)) {
                    return current;
                }
                const next = new Set(current);
                next.delete(lease);
                return next;
            });
        };
    }, []);
    const value = useMemo(() => ({
        suppressed: activeLeases.size > 0,
        acquire,
    }), [acquire, activeLeases.size]);

    return (
        <ParameterHudSuppressionContext.Provider value={value}>
            {children}
        </ParameterHudSuppressionContext.Provider>
    );
}

/** Acquire/release one graph gesture's HUD suppression, with unmount cleanup. */
export function useParameterHudSuppression() {
    const { acquire } = useContext(ParameterHudSuppressionContext);
    const releaseRef = useRef<(() => void) | null>(null);
    const suppress = useCallback(() => {
        releaseRef.current?.();
        releaseRef.current = acquire();
    }, [acquire]);
    const release = useCallback(() => {
        releaseRef.current?.();
        releaseRef.current = null;
    }, []);

    useEffect(() => release, [release]);

    return useMemo(() => ({ suppress, release }), [release, suppress]);
}

/** "#rrggbb" (or "#rgb") to the "R G B" triplet the HUD frame consumes. */
export function hexToRgbTriplet(hex: string): string {
    return hexToRGBColor(hex).join(" ");
}

/** Production-backed graphic that can replace the ordinary HUD knob. */
export type ParameterHudVisualization =
    | {
        readonly kind: "wavetable";
        readonly frames: Float32Array[] | null;
        readonly position: number;
        readonly warpMode: number;
        readonly warpAmount: number;
    }
    | {
        readonly kind: "filter";
        readonly mode: number;
        readonly cutoffHz: number;
        readonly q: number;
    }
    | {
        readonly kind: "mseg-morph";
        readonly shapeAPoints: MsegShape["points"];
        readonly shapeBPoints: MsegShape["points"];
        readonly morph: number;
    }
    | {
        readonly kind: "distortion";
        readonly driveDb: number;
        readonly knee: number;
        readonly type: number;
    };

export type ParameterHudModel = {
    readonly visible: boolean;
    readonly axis: "base" | "modulation";
    readonly label: string;
    /** "SRC 1 · +12.0 st" line; empty hides the slot (no fake mappings). */
    readonly sourceLine: string;
    readonly ownerAccent: string;
    /** Owner accent as an "R G B" triplet for the frame's translucent uses. */
    readonly ownerAccentRgb: string;
    readonly sourceAccent: string;
    readonly baseNormalized: number;
    readonly baseOriginNormalized: number;
    readonly baseText: string;
    readonly lowText: string;
    readonly highText: string;
    readonly limitsVisible: boolean;
    readonly modRing: ParameterKnobModRing;
    /** Omitted for the established generic knob/value presentation. */
    readonly visualization?: ParameterHudVisualization;
    /** Live traveling light on the mod ring; absent → no light rendered. */
    readonly liveLight?: {
        readonly source: ModSourceIdentity;
        readonly project: (sourceValue01: number) => number;
    } | null;
};

const HUD_KNOB_LIGHT_PLACEMENT: ModSourceLightPlacement = {
    kind: "knob-arc",
    radius: MOD_LIGHT_RADIUS,
};

const IDENTITY_PROJECTION = (sourceValue01: number) => sourceValue01;

function ParameterHudWavetable({
    visualization,
    baseText,
}: {
    readonly visualization: Extract<ParameterHudVisualization, { readonly kind: "wavetable" }>;
    readonly baseText: string;
}) {
    return (
        <div className="mobile-voice-hud-visual" data-role="parameter-hud-wavetable">
            <div className="mobile-voice-hud-graphic">
                <WavetableCanvas
                    frames={visualization.frames}
                    position={visualization.position}
                    warpMode={visualization.warpMode}
                    warpAmount={visualization.warpAmount}
                    paintBackground={false}
                    showSliceCaption={false}
                />
            </div>
            <div className="mobile-voice-hud-visual-value">
                <span>Base</span>
                <strong data-role="mobile-voice-hud-base">{baseText}</strong>
            </div>
        </div>
    );
}

function ignoreFilterValue(_value: number): void {}

function ParameterHudFilter({
    visualization,
    baseText,
    ownerAccent,
    ownerAccentRgb,
}: {
    readonly visualization: Extract<ParameterHudVisualization, { readonly kind: "filter" }>;
    readonly baseText: string;
    readonly ownerAccent: string;
    readonly ownerAccentRgb: string;
}) {
    return (
        <div
            className="mobile-voice-hud-visual"
            data-role="parameter-hud-filter"
            style={{
                "--section-accent": ownerAccent,
                "--section-accent-rgb": ownerAccentRgb,
                "--section-accent-dim": ownerAccent,
            } as CSSProperties}
        >
            <div className="mobile-voice-hud-graphic">
                <FilterResponseGraph
                    baseMode={visualization.mode}
                    baseCutoffHz={visualization.cutoffHz}
                    baseQ={visualization.q}
                    liveMode={visualization.mode}
                    liveCutoffHz={visualization.cutoffHz}
                    liveQ={visualization.q}
                    liveHasActive={false}
                    onCutoffSet={ignoreFilterValue}
                    onQSet={ignoreFilterValue}
                    className="h-full w-full"
                />
            </div>
            <div className="mobile-voice-hud-visual-value">
                <span>Base</span>
                <strong data-role="mobile-voice-hud-base">{baseText}</strong>
            </div>
        </div>
    );
}

function ParameterHudMsegMorph({
    visualization,
    baseText,
}: {
    readonly visualization: Extract<ParameterHudVisualization, { readonly kind: "mseg-morph" }>;
    readonly baseText: string;
}) {
    return (
        <div className="mobile-voice-hud-visual" data-role="parameter-hud-mseg-morph">
            <div className="mobile-voice-hud-graphic">
                <MsegPreview
                    points={visualization.shapeAPoints}
                    morphShapeAPoints={visualization.shapeAPoints}
                    morphShapeBPoints={visualization.shapeBPoints}
                    morphValue={visualization.morph}
                    className="h-full w-full"
                />
            </div>
            <div className="mobile-voice-hud-visual-value">
                <span>Base</span>
                <strong data-role="mobile-voice-hud-base">{baseText}</strong>
            </div>
        </div>
    );
}

function ParameterHudDistortion({
    visualization,
    baseText,
    ownerAccent,
    ownerAccentRgb,
}: {
    readonly visualization: Extract<ParameterHudVisualization, { readonly kind: "distortion" }>;
    readonly baseText: string;
    readonly ownerAccent: string;
    readonly ownerAccentRgb: string;
}) {
    return (
        <div
            className="mobile-voice-hud-visual"
            data-role="parameter-hud-distortion"
            style={{
                "--section-accent": ownerAccent,
                "--section-accent-rgb": ownerAccentRgb,
            } as CSSProperties}
        >
            <div className="mobile-voice-hud-graphic">
                <DistortionVisualizer
                    compact
                    driveDb={visualization.driveDb}
                    knee={visualization.knee}
                    type={visualization.type}
                    transferFrame={null}
                    historyFrame={null}
                    className="h-full w-full"
                />
            </div>
            <div className="mobile-voice-hud-visual-value">
                <span>Base</span>
                <strong data-role="mobile-voice-hud-base">{baseText}</strong>
            </div>
        </div>
    );
}

function ParameterHudSpecialized({
    visualization,
    baseText,
    ownerAccent,
    ownerAccentRgb,
}: {
    readonly visualization: ParameterHudVisualization;
    readonly baseText: string;
    readonly ownerAccent: string;
    readonly ownerAccentRgb: string;
}) {
    switch (visualization.kind) {
        case "wavetable":
            return <ParameterHudWavetable visualization={visualization} baseText={baseText} />;
        case "filter":
            return (
                <ParameterHudFilter
                    visualization={visualization}
                    baseText={baseText}
                    ownerAccent={ownerAccent}
                    ownerAccentRgb={ownerAccentRgb}
                />
            );
        case "mseg-morph":
            return <ParameterHudMsegMorph visualization={visualization} baseText={baseText} />;
        case "distortion":
            return (
                <ParameterHudDistortion
                    visualization={visualization}
                    baseText={baseText}
                    ownerAccent={ownerAccent}
                    ownerAccentRgb={ownerAccentRgb}
                />
            );
        default:
            return casesHandled(visualization);
    }
}

export function ParameterPrecisionHud({ model }: { model: ParameterHudModel }) {
    const isModulation = model.axis === "modulation";
    const hudSuppression = useContext(ParameterHudSuppressionContext);
    const liveLightRef = useModSourceLight({
        source: model.liveLight?.source ?? null,
        project: model.liveLight?.project ?? IDENTITY_PROJECTION,
        placement: HUD_KNOB_LIGHT_PLACEMENT,
    });

    return (
        <div
            data-role="mobile-voice-hud"
            data-hud-axis={model.axis}
            className={`mobile-voice-hud${model.visible && !hudSuppression.suppressed ? " is-visible" : ""}${isModulation ? " is-modulation" : ""}`}
            style={{
                "--mobile-voice-source-accent": model.sourceAccent,
                "--mobile-voice-owner-accent": model.ownerAccent,
                "--mobile-voice-owner-accent-rgb": model.ownerAccentRgb,
            } as CSSProperties}
            aria-hidden="true"
        >
            <header className="mobile-voice-hud-header">
                <span
                    className="cosimo-label is-strong"
                    style={{ color: isModulation ? model.sourceAccent : model.ownerAccent }}
                >
                    {isModulation ? "MOD ↕" : "BASE ↔"}
                </span>
                <strong className="cosimo-label is-strong is-centered">
                    {model.label}
                </strong>
                <span
                    className="cosimo-label is-strong mobile-voice-hud-source"
                    style={{ color: isModulation ? model.sourceAccent : "rgba(232, 236, 239, 0.6)" }}
                >
                    {model.sourceLine}
                </span>
            </header>
            {model.visualization === undefined ? (
                <div className="mobile-voice-hud-knob">
                    <ParameterKnobArtwork
                        baseNormalized={model.baseNormalized}
                        baseOriginNormalized={model.baseOriginNormalized}
                        ownerAccent={model.ownerAccent}
                        sourceAccent={model.sourceAccent}
                        modRing={model.modRing}
                        emphasis={model.axis === "base" ? "base" : "modulation"}
                        liveLightRef={model.liveLight ? liveLightRef : undefined}
                    />
                    <div className="mobile-voice-hud-center">
                        <span>Base</span>
                        <strong data-role="mobile-voice-hud-base">
                            {model.baseText}
                        </strong>
                    </div>
                    <div
                        className="mobile-voice-hud-limit is-low"
                        style={{ visibility: model.limitsVisible ? "visible" : "hidden" }}
                    >
                        <span>Low</span>
                        <strong data-role="mobile-voice-hud-low">{model.lowText}</strong>
                    </div>
                    <div
                        className="mobile-voice-hud-limit is-high"
                        style={{ visibility: model.limitsVisible ? "visible" : "hidden" }}
                    >
                        <span>High</span>
                        <strong data-role="mobile-voice-hud-high">{model.highText}</strong>
                    </div>
                </div>
            ) : (
                <ParameterHudSpecialized
                    visualization={model.visualization}
                    baseText={model.baseText}
                    ownerAccent={model.ownerAccent}
                    ownerAccentRgb={model.ownerAccentRgb}
                />
            )}
            <footer className="mobile-voice-hud-footer">
                <span
                    className="cosimo-label is-strong"
                    style={{ color: !isModulation ? model.ownerAccent : "rgba(232, 236, 239, 0.35)" }}
                >
                    ↔ Base
                </span>
                <span
                    className="cosimo-label is-strong"
                    style={{ color: isModulation ? model.sourceAccent : "rgba(232, 236, 239, 0.35)" }}
                >
                    ↕ Mod amount
                </span>
            </footer>
        </div>
    );
}
