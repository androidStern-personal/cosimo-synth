import { forwardRef, type SVGProps } from "react";

import {
    EDITOR_HIT_RADIUS_PX,
    EDITOR_RANGE_HANDLE_RADIUS_PX,
    EDITOR_VALUE_HANDLE_HALO_RADIUS_PX,
    EDITOR_VALUE_HANDLE_RADIUS_PX,
} from "./editor-tokens";
import type { EditorCurvePlotRect } from "./editor-curve-geometry";

function joinClasses(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(" ");
}

type DataRoleProp = {
    "data-role"?: string;
};

export type EditorCurveSurfaceProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & DataRoleProp & {
    widthPx: number;
    heightPx: number;
    dataRole: string;
    ariaLabel: string;
};

export const EditorCurveSurface = forwardRef<SVGSVGElement, EditorCurveSurfaceProps>(function EditorCurveSurface(
    {
        widthPx,
        heightPx,
        dataRole,
        ariaLabel,
        className,
        children,
        ...svgProps
    },
    ref,
) {
    const resolvedDataRole = dataRole ?? svgProps["data-role"];

    return (
        <svg
            {...svgProps}
            ref={ref}
            aria-label={ariaLabel}
            className={joinClasses("editor-curve-surface", className)}
            data-role={resolvedDataRole}
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

export function EditorCurveGrid({
    plot,
    xTicks = [0.25, 0.5, 0.75],
    yTicks = [],
}: {
    plot: EditorCurvePlotRect;
    xTicks?: number[];
    yTicks?: number[];
}) {
    return (
        <>
            {xTicks.map((tick) => {
                const x = plot.plotLeft + (plot.plotWidth * tick);
                return (
                    <line
                        className="editor-curve-grid-line"
                        data-role="editor-curve-grid-line"
                        key={`x-${tick}`}
                        x1={x}
                        x2={x}
                        y1={plot.plotTop}
                        y2={plot.plotBottom}
                    />
                );
            })}
            {yTicks.map((tick) => {
                const y = plot.plotTop + (plot.plotHeight * tick);
                return (
                    <line
                        className="editor-curve-grid-line"
                        data-role="editor-curve-grid-line"
                        key={`y-${tick}`}
                        x1={plot.plotLeft}
                        x2={plot.plotRight}
                        y1={y}
                        y2={y}
                    />
                );
            })}
        </>
    );
}

export function EditorCurveAxis(props: SVGProps<SVGLineElement> & DataRoleProp) {
    return (
        <line
            {...props}
            className={joinClasses("editor-curve-axis", props.className)}
            data-role={props["data-role"] ?? "editor-curve-axis"}
        />
    );
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

export function EditorCurveFill({
    className,
    ...pathProps
}: SVGProps<SVGPathElement>) {
    return (
        <path
            {...pathProps}
            className={joinClasses("editor-curve-fill", className)}
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
