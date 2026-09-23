import { forwardRef, useCallback, useLayoutEffect, useRef, type ReactNode, type SVGProps } from 'react'
import {
    createMsegEditorMetrics,
    createMsegTimeAxisTicks,
    deleteMsegPoint,
    moveMsegPoint,
    pointToMsegEditorCoordinates,
    MSEG_POINT_RADIUS_PX,
    MSEG_SELECTED_POINT_RADIUS_PX,
    type MsegPoint,
    type MsegShape,
    type MsegTimeAxisScale,
} from './mseg'
import { buildMsegSegmentPath, buildMsegSurfacePaths } from './mseg-editor-geometry'
import { animateLiveNumber, type LiveNumber } from './live-value'
import { useMsegContext, useMsegDrawing } from './mseg-context'

export const MsegGrid = forwardRef<SVGGElement, SVGProps<SVGGElement>>(function MsegGrid(props, ref) {
    const { width, height } = useMsegDrawing()
    const m = createMsegEditorMetrics(width, height)
    return (
        <g stroke="currentColor" opacity={0.12} {...props} ref={ref} data-slot="mseg-grid" aria-hidden="true">
            {[0.25, 0.5, 0.75].map((step) => (
                <g key={step}>
                    <line
                        x1={m.plotLeft}
                        y1={m.plotTop + m.plotHeight * step}
                        x2={m.plotRight}
                        y2={m.plotTop + m.plotHeight * step}
                    />
                    <line
                        x1={m.plotLeft + m.plotWidth * step}
                        y1={m.plotTop}
                        x2={m.plotLeft + m.plotWidth * step}
                        y2={m.plotBottom}
                    />
                </g>
            ))}
        </g>
    )
})
export type MsegCurveProps = SVGProps<SVGPathElement> & { readonly value?: MsegShape }
export const MsegCurve = forwardRef<SVGPathElement, MsegCurveProps>(function MsegCurve({ value, ...props }, ref) {
    const editor = useMsegContext(),
        drawing = useMsegDrawing()
    const { curvePath } = buildMsegSurfacePaths((value ?? editor.value).points, drawing.width, drawing.height, drawing)
    return (
        <path
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            {...props}
            ref={ref}
            data-slot="mseg-curve"
            d={curvePath}
        />
    )
})
export const MsegFill = forwardRef<SVGPathElement, MsegCurveProps>(function MsegFill({ value, ...props }, ref) {
    const editor = useMsegContext(),
        drawing = useMsegDrawing()
    const { fillPath } = buildMsegSurfacePaths((value ?? editor.value).points, drawing.width, drawing.height, drawing)
    return <path fill="currentColor" fillOpacity={0.12} {...props} ref={ref} data-slot="mseg-fill" d={fillPath} />
})
/** Selected/hovered segment emphasis; optional so custom artwork can supply its own feedback. */
export const MsegSegmentHighlight = forwardRef<SVGPathElement, SVGProps<SVGPathElement>>(
    function MsegSegmentHighlight(props, ref) {
        const editor = useMsegContext(),
            drawing = useMsegDrawing()
        const index =
            drawing.activeSegment >= 0
                ? drawing.activeSegment
                : drawing.hoveredSegment >= 0
                  ? drawing.hoveredSegment
                  : editor.selection?.kind === 'segment'
                    ? editor.selection.index
                    : -1
        return (
            <path
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                {...props}
                ref={ref}
                data-slot="mseg-segment-highlight"
                data-segment-index={index}
                d={
                    index < 0
                        ? ''
                        : buildMsegSegmentPath(editor.value.points, index, drawing.width, drawing.height, drawing)
                }
            />
        )
    },
)
export type MsegPlotProps = SVGProps<SVGPathElement> & { readonly samples: ArrayLike<number> }
/** Uniform samples from time 0 to 1; DSP padding must be removed by the data owner. */
export const MsegPlot = forwardRef<SVGPathElement, MsegPlotProps>(function MsegPlot({ samples, ...props }, ref) {
    const drawing = useMsegDrawing()
    const vertices = Array.from(samples, (y, index) =>
        pointToMsegEditorCoordinates(
            { x: samples.length > 1 ? index / (samples.length - 1) : 0, y },
            drawing.width,
            drawing.height,
            drawing,
        ),
    )
    let newSubpath = true
    const d = vertices
        .map((point) => {
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                newSubpath = true
                return ''
            }
            const command = newSubpath ? 'M' : 'L'
            newSubpath = false
            return `${command} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`
        })
        .join(' ')
    return <path fill="none" stroke="currentColor" strokeWidth={2} {...props} ref={ref} data-slot="mseg-plot" d={d} />
})
export type MsegPointRender = {
    readonly point: MsegPoint
    readonly index: number
    readonly selected: boolean
    readonly state: 'selected' | 'highlighted' | 'muted' | 'default'
    readonly position: { readonly x: number; readonly y: number }
    /** Apply to the custom SVG group. It owns coordinates, focus, keyboard editing and selection. */
    readonly handleProps: SVGProps<SVGGElement>
}
export type MsegPointsProps = SVGProps<SVGGElement> & { readonly renderPoint?: (point: MsegPointRender) => ReactNode }
export const MsegPoints = forwardRef<SVGGElement, MsegPointsProps>(function MsegPoints({ renderPoint, ...props }, ref) {
    const editor = useMsegContext(),
        drawing = useMsegDrawing()
    return (
        <g {...props} ref={ref} data-slot="mseg-points">
            {editor.value.points.map((point, index) => {
                const coordinates = pointToMsegEditorCoordinates(point, drawing.width, drawing.height, drawing)
                const selected = editor.selection?.kind === 'point' && editor.selection.index === index
                const emphasized = drawing.activeSegment >= 0 ? drawing.activeSegment : drawing.hoveredSegment
                const state =
                    emphasized >= 0
                        ? index === emphasized || index === emphasized + 1
                            ? 'highlighted'
                            : 'muted'
                        : selected
                          ? 'selected'
                          : 'default'
                const handleProps: SVGProps<SVGGElement> = {
                    transform: `translate(${coordinates.x},${coordinates.y})`,
                    role: 'button',
                    tabIndex: editor.disabled ? -1 : 0,
                    'aria-label': `Point ${index + 1}: time ${point.x.toFixed(2)}, value ${point.y.toFixed(2)}`,
                    'aria-pressed': selected,
                    'aria-disabled': editor.disabled || editor.readOnly || undefined,
                    onFocus: () => editor.select({ kind: 'point', index }),
                    onKeyDown: (event) => {
                        if (editor.disabled || editor.readOnly) return
                        const step = event.shiftKey ? 0.001 : 0.01
                        if (event.key === 'Delete' || event.key === 'Backspace') {
                            event.preventDefault()
                            editor.edit((value) => deleteMsegPoint(value, index))
                        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                            event.preventDefault()
                            event.stopPropagation()
                            editor.beginGesture()
                            editor.edit((value) => {
                                const current = value.points[index]
                                const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
                                const dy = event.key === 'ArrowDown' ? -step : event.key === 'ArrowUp' ? step : 0
                                return moveMsegPoint(value, index, current.x + dx, current.y + dy)
                            })
                        }
                    },
                }
                return (
                    <g key={index} data-point-index={index} data-selected={selected || undefined}>
                        {renderPoint ? (
                            renderPoint({ point, index, selected, state, position: coordinates, handleProps })
                        ) : (
                            <g {...handleProps}>
                                <circle
                                    data-role="mseg-point"
                                    r={selected ? MSEG_SELECTED_POINT_RADIUS_PX : MSEG_POINT_RADIUS_PX}
                                    fill="currentColor"
                                    stroke="currentColor"
                                />
                            </g>
                        )}
                    </g>
                )
            })}
        </g>
    )
})
export type MsegTimeAxisProps = Omit<SVGProps<SVGGElement>, 'scale'> & { readonly scale: MsegTimeAxisScale }
export const MsegTimeAxis = forwardRef<SVGGElement, MsegTimeAxisProps>(function MsegTimeAxis({ scale, ...props }, ref) {
    const drawing = useMsegDrawing(),
        m = createMsegEditorMetrics(drawing.width, drawing.height)
    const vertical = drawing.orientation === 'vertical'
    return (
        <g
            fill="currentColor"
            stroke="currentColor"
            fontSize={11}
            {...props}
            ref={ref}
            data-slot="mseg-time-axis"
            data-time-unit={scale.kind}
            aria-hidden="true"
        >
            {createMsegTimeAxisTicks(scale).map((tick) => {
                const x = vertical ? m.plotLeft : m.plotLeft + m.plotWidth * tick.fraction
                const y = vertical ? m.plotTop + m.plotHeight * tick.fraction : m.plotBottom
                return (
                    <g key={tick.fraction}>
                        <line
                            data-role="mseg-time-tick"
                            data-axis-fraction={tick.fraction}
                            x1={x}
                            y1={y}
                            x2={vertical ? x + 6 : x}
                            y2={vertical ? y : y - 6}
                        />
                        <text
                            data-role="mseg-time-label"
                            data-axis-fraction={tick.fraction}
                            stroke="none"
                            x={vertical ? x + 9 : x}
                            y={vertical ? y : y - 9}
                            textAnchor={vertical ? 'start' : 'middle'}
                            dominantBaseline={vertical ? 'middle' : undefined}
                        >
                            {tick.label}
                        </text>
                    </g>
                )
            })}
        </g>
    )
})
export type MsegPlayheadProps = SVGProps<SVGLineElement> & { readonly position: LiveNumber }
/** Applies observed positions on a display frame. Retriggers and loop wraps never interpolate backwards. */
export const MsegPlayhead = forwardRef<SVGLineElement, MsegPlayheadProps>(function MsegPlayhead(
    { position, ...props },
    ref,
) {
    const drawing = useMsegDrawing()
    const element = useRef<SVGLineElement | null>(null)
    const setRef = useCallback(
        (node: SVGLineElement | null) => {
            element.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
        },
        [ref],
    )
    useLayoutEffect(() => {
        const node = element.current,
            view = node?.ownerDocument.defaultView
        if (!node || !view) return
        const m = createMsegEditorMetrics(drawing.width, drawing.height)
        return animateLiveNumber(
            view,
            position,
            (value) => Math.min(1, Math.max(0, value)),
            0,
            (value) => {
                node.setAttribute('visibility', value === null ? 'hidden' : 'visible')
                node.dataset.active = String(value !== null)
                if (value === null) return
                const vertical = drawing.orientation === 'vertical'
                const x = m.plotLeft + m.plotWidth * value,
                    y = m.plotTop + m.plotHeight * value
                node.setAttribute('x1', String(vertical ? m.plotLeft : x))
                node.setAttribute('x2', String(vertical ? m.plotRight : x))
                node.setAttribute('y1', String(vertical ? y : m.plotTop))
                node.setAttribute('y2', String(vertical ? y : m.plotBottom))
            },
        )
    }, [position, drawing.width, drawing.height, drawing.orientation])
    return (
        <line
            stroke="currentColor"
            strokeWidth={2}
            {...props}
            ref={setRef}
            data-slot="mseg-playhead"
            aria-hidden="true"
        />
    )
})
