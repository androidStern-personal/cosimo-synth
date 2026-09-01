import { type RefObject, useLayoutEffect, useState } from "react";

/*
 * Numeric layout tokens for interactive editor components.
 *
 * These are consumed by geometry math (buildMagnitudePath,
 * pointerToGate, etc.) that cannot easily read CSS custom
 * properties. Keep these consistent with editor-tokens.css —
 * stroke widths and handle radii declared here must match the
 * corresponding visual sizes in the CSS tokens file.
 */

/** Fraction of surface width reserved as left/right gutter on each side. */
export const EDITOR_PLOT_GUTTER_RATIO = 0.05;
/** Minimum absolute gutter (px) so labels don't collide at narrow widths. */
export const EDITOR_PLOT_GUTTER_MIN_PX = 10;

export const EDITOR_PLOT_TOP_PADDING_PX = 20;
export const EDITOR_PLOT_BOTTOM_PADDING_PX = 40;

/** Visible radius of the primary value handle. */
export const EDITOR_VALUE_HANDLE_RADIUS_PX = 9.5;
/** Visible radius of the halo/ring behind the primary handle. */
export const EDITOR_VALUE_HANDLE_HALO_RADIUS_PX = 14;
/** Visible radius of secondary/range handles (start/end endpoints). */
export const EDITOR_RANGE_HANDLE_RADIUS_PX = 8.5;
/** Transparent hit-target radius — sized for comfortable touch (iOS HIG ~44pt tap target). */
export const EDITOR_HIT_RADIUS_PX = 22;

/** Stroke widths — must match the CSS custom properties. */
export const EDITOR_CURVE_STROKE_WIDTH = 2.6;
export const EDITOR_CURVE_PREVIEW_STROKE_WIDTH = 1.8;

/** Pixel threshold before a pointerdown promotes to a drag gesture. */
export const EDITOR_DRAG_START_THRESHOLD_PX = 1.5;

/**
 * Resolves the horizontal gutter in px for a given surface width.
 * Both editor components use this so they scale identically.
 */
export function editorPlotGutter(surfaceWidthPx: number): number {
    return Math.max(EDITOR_PLOT_GUTTER_MIN_PX, surfaceWidthPx * EDITOR_PLOT_GUTTER_RATIO);
}

export type EditorSurfaceSize = {
    width: number;
    height: number;
};

/**
 * Shared hook for editor components that need to read their own
 * rendered size so they can position SVG content in 1:1 pixel space
 * (avoids text warping from preserveAspectRatio=none).
 */
export function useEditorSurfaceSize<TElement extends Element>(
    ref: RefObject<TElement | null>,
): EditorSurfaceSize {
    const [size, setSize] = useState<EditorSurfaceSize>({ width: 1, height: 1 });

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) {
            return;
        }

        const update = () => {
            const bounds = element.getBoundingClientRect();
            const host = element as unknown as HTMLElement;
            setSize({
                width: Math.max(1, bounds.width || host.clientWidth || 1),
                height: Math.max(1, bounds.height || host.clientHeight || 1),
            });
        };

        const observer = new ResizeObserver(update);
        observer.observe(element);
        update();

        return () => observer.disconnect();
    }, [ref]);

    return size;
}
