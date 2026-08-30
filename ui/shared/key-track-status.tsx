import type { CSSProperties } from "react";

const MUSIC_NOTE_URL = new URL(
    "../assets/material-symbols-rounded/music_note-20px.svg",
    import.meta.url,
).href;

/**
 * The one presentation-only Key Track state mark. It owns no hit area and
 * sits inside a position-relative parameter surface, leaving the surface's
 * existing pointer and long-press gesture as the sole interaction owner.
 */
export function KeyTrackStatus({ controlKey }: { readonly controlKey: string }) {
    return (
        <span
            aria-hidden="true"
            data-role={`key-track-status-${controlKey}`}
            data-icon-source="material-symbols-rounded-music-note"
            style={{
                position: "absolute",
                zIndex: 4,
                top: 3,
                left: 3,
                width: 12,
                height: 12,
                pointerEvents: "none",
                backgroundColor: "#facc15",
                WebkitMaskImage: `url("${MUSIC_NOTE_URL}")`,
                maskImage: `url("${MUSIC_NOTE_URL}")`,
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
            } as CSSProperties}
        />
    );
}
