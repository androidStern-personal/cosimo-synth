/**
 * The ADR-025 precision HUD: one fixed top-center presentation shared by
 * every draggable parameter control (voice readout cells and all knobs).
 * Consumers compute a complete view model; this component owns the DOM so
 * the presentation cannot drift between control families.
 *
 * Styles live in mobile-voice-editor.css under the `mobile-voice-hud`
 * classes (kept stable for test and CSS continuity).
 */

import { createContext, type CSSProperties } from "react";

import { hexToRGBColor } from "./theme";

import { ParameterKnobArtwork, type ParameterKnobModRing } from "./parameter-knob-artwork";

/** How long the HUD lingers after a released drag before hiding (ADR-024). */
export const PARAMETER_HUD_LINGER_MS = 420;

/**
 * The fixed top-center element every control portals its precision HUD into.
 * Hosts (desktop and iOS patch views) provide it; a null layer means the
 * surface has no HUD host and controls simply do not present one.
 */
export const ParameterHudLayerContext = createContext<Element | null>(null);

/** "#rrggbb" (or "#rgb") to the "R G B" triplet the HUD frame consumes. */
export function hexToRgbTriplet(hex: string): string {
    return hexToRGBColor(hex).join(" ");
}

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
};

export function ParameterPrecisionHud({ model }: { model: ParameterHudModel }) {
    const isModulation = model.axis === "modulation";

    return (
        <div
            data-role="mobile-voice-hud"
            data-hud-axis={model.axis}
            className={`mobile-voice-hud${model.visible ? " is-visible" : ""}${isModulation ? " is-modulation" : ""}`}
            style={{
                "--mobile-voice-source-accent": model.sourceAccent,
                "--mobile-voice-owner-accent": model.ownerAccent,
                "--mobile-voice-owner-accent-rgb": model.ownerAccentRgb,
            } as CSSProperties}
            aria-hidden="true"
        >
            <header className="mobile-voice-hud-header">
                <span
                    className="mobile-voice-hud-micro"
                    style={{ color: isModulation ? model.sourceAccent : model.ownerAccent }}
                >
                    {isModulation ? "MOD ↕" : "BASE ↔"}
                </span>
                <strong className="mobile-voice-hud-label">
                    {model.label}
                </strong>
                <span
                    className="mobile-voice-hud-micro mobile-voice-hud-source"
                    style={{ color: isModulation ? model.sourceAccent : "rgba(232, 236, 239, 0.6)" }}
                >
                    {model.sourceLine}
                </span>
            </header>
            <div className="mobile-voice-hud-knob">
                <ParameterKnobArtwork
                    baseNormalized={model.baseNormalized}
                    baseOriginNormalized={model.baseOriginNormalized}
                    ownerAccent={model.ownerAccent}
                    sourceAccent={model.sourceAccent}
                    modRing={model.modRing}
                    emphasis={model.axis === "base" ? "base" : "modulation"}
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
            <footer className="mobile-voice-hud-footer">
                <span
                    className="mobile-voice-hud-micro"
                    style={{ color: !isModulation ? model.ownerAccent : "rgba(232, 236, 239, 0.35)" }}
                >
                    ↔ Base
                </span>
                <span
                    className="mobile-voice-hud-micro"
                    style={{ color: isModulation ? model.sourceAccent : "rgba(232, 236, 239, 0.35)" }}
                >
                    ↕ Mod amount
                </span>
            </footer>
        </div>
    );
}
