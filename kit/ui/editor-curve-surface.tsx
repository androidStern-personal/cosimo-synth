import { forwardRef, type SVGProps } from "react";

import {
    EDITOR_HIT_RADIUS_PX,
    EDITOR_RANGE_HANDLE_RADIUS_PX,
    EDITOR_VALUE_HANDLE_HALO_RADIUS_PX,
    EDITOR_VALUE_HANDLE_RADIUS_PX,
    type EditorCurvePlotRect,
} from "./editor-curve-geometry";

function joinClasses(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(" ");
}

export type EditorCurveSurfaceProps = Omit<SVGProps<SVGSVGElement>, "height" | "width" | "viewBox"> & {
    widthPx: number;
    heightPx: number;
};

/** An SVG drawn in the measured pixel space of its container (see useElementSize). */
export const EditorCurveSurface = forwardRef<SVGSVGElement, EditorCurveSurfaceProps>(function EditorCurveSurface(
    { widthPx, heightPx, className, children, ...svgProps },
    ref,
) {
    return (
        <svg
            {...svgProps}
            ref={ref}
            className={joinClasses("editor-curve-surface", className)}
            viewBox={`0 0 ${Math.max(1, widthPx)} ${Math.max(1, heightPx)}`}
        >
            {children}
        </svg>
    );
});

export function EditorCurvePlotArea({
    plot,
    className,
}: {
    plot: EditorCurvePlotRect;
    className?: string;
}) {
    return (
        <rect
            className={joinClasses("editor-curve-plot-area", className)}
            data-role="editor-curve-plot-area"
            height={plot.plotHeight}
            rx="5"
            width={plot.plotWidth}
            x={plot.plotLeft}
            y={plot.plotTop}
        />
    );
}

export function EditorCurveAxis({ className, ...lineProps }: SVGProps<SVGLineElement>) {
    return <line {...lineProps} className={joinClasses("editor-curve-axis", className)} />;
}

export function EditorCurvePath({
    variant = "primary",
    className,
    ...pathProps
}: SVGProps<SVGPathElement> & {
    variant?: "primary" | "preview" | "muted" | "highlight";
}) {
    return (
        <path
            {...pathProps}
            className={joinClasses(
                "editor-curve-path",
                variant !== "primary" && `editor-curve-path--${variant}`,
                className,
            )}
        />
    );
}

export function EditorCurveHandleHalo({
    className,
    r = EDITOR_VALUE_HANDLE_HALO_RADIUS_PX,
    ...circleProps
}: SVGProps<SVGCircleElement>) {
    return (
        <circle
            {...circleProps}
            className={joinClasses("editor-curve-handle-halo", className)}
            r={r}
        />
    );
}

export function EditorCurveHandle({
    className,
    r,
    variant = "value",
    ...circleProps
}: SVGProps<SVGCircleElement> & {
    variant?: "value" | "range-start" | "range-end" | "secondary";
}) {
    const resolvedRadius = r ?? (variant === "value" ? EDITOR_VALUE_HANDLE_RADIUS_PX : EDITOR_RANGE_HANDLE_RADIUS_PX);

    return (
        <circle
            {...circleProps}
            className={joinClasses(
                "editor-curve-handle",
                `editor-curve-handle--${variant}`,
                className,
            )}
            r={resolvedRadius}
        />
    );
}

export function EditorCurveHitTarget({
    className,
    r = EDITOR_HIT_RADIUS_PX,
    ...circleProps
}: SVGProps<SVGCircleElement>) {
    return (
        <circle
            {...circleProps}
            className={joinClasses("editor-curve-hit-target", className)}
            r={r}
        />
    );
}
