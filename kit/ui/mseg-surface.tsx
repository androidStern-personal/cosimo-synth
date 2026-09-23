import { forwardRef, useCallback, useLayoutEffect, useRef, useState, type SVGProps } from 'react'
import {
    addMsegPoint,
    deleteMsegPoint,
    moveMsegPoint,
    resolveMsegSurfaceOrientation,
    setMsegSegmentCurvePower,
    type MsegSurfaceOrientation,
} from './mseg'
import { useMsegGestures } from './mseg-gestures'
import { retainMsegStyles } from './mseg-styles'
import { MsegDrawingContext, useMsegContext } from './mseg-context'

export type MsegSurfaceProps = SVGProps<SVGSVGElement> & {
    readonly orientation?: MsegSurfaceOrientation | 'auto'
    readonly curveEditActivationMode?: 'immediate' | 'hold-or-drag'
    readonly curveEditHoldDelayMs?: number
    readonly onCurveEditHoldActivated?: () => void
}
/** Measured interaction surface. JSX layer order and all appearance belong to its caller. */
export const MsegSurface = forwardRef<SVGSVGElement, MsegSurfaceProps>(function MsegSurface(
    {
        orientation: requestedOrientation = 'auto',
        curveEditActivationMode,
        curveEditHoldDelayMs,
        onCurveEditHoldActivated,
        children,
        style,
        className,
        onKeyDown,
        onKeyUp,
        onBlur,
        onPointerDown,
        onPointerMove,
        onPointerLeave,
        onPointerUp,
        onPointerCancel,
        onLostPointerCapture,
        ...props
    },
    ref,
) {
    const editor = useMsegContext()
    const latest = useRef(editor)
    latest.current = editor
    const surfaceRef = useRef<SVGSVGElement | null>(null)
    const setRef = useCallback(
        (element: SVGSVGElement | null) => {
            surfaceRef.current = element
            if (typeof ref === 'function') ref(element)
            else if (ref) ref.current = element
        },
        [ref],
    )
    useLayoutEffect(() => (surfaceRef.current ? retainMsegStyles(surfaceRef.current) : undefined), [])
    const [size, setSize] = useState({ width: 1, height: 1 })
    const [autoOrientation, setAutoOrientation] = useState<MsegSurfaceOrientation>('horizontal')
    const orientation = requestedOrientation === 'auto' ? autoOrientation : requestedOrientation
    const controller = useRef({
        getShape: () => latest.current.current.current,
        addPoint: (x: number, y: number) => latest.current.edit((value) => addMsegPoint(value, x, y)),
        movePoint: (index: number, x: number, y: number) =>
            latest.current.edit((value) => moveMsegPoint(value, index, x, y)),
        deletePoint: (index: number) => latest.current.edit((value) => deleteMsegPoint(value, index)),
        setSegmentCurvePower: (index: number, power: number) =>
            latest.current.edit((value) => setMsegSegmentCurvePower(value, index, power)),
    })
    const edit = useCallback((action: () => void, grouped = false) => {
        if (latest.current.disabled || latest.current.readOnly) return
        if (grouped) latest.current.beginGesture()
        action()
    }, [])
    const setSelectedPoint = useCallback((index: number) => latest.current.select({ kind: 'point', index }), [])
    const setSelectedSegment = useCallback((index: number) => latest.current.select({ kind: 'segment', index }), [])
    const gestures = useMsegGestures({
        shape: editor.value,
        controller,
        surfaceRef,
        edit,
        finishGesture: editor.endGesture,
        orientation,
        curveEditActivationMode,
        curveEditHoldDelayMs,
        onCurveEditHoldActivated,
        selectedPoint: editor.selection?.kind === 'point' ? editor.selection.index : -1,
        onSelectedPointChange: setSelectedPoint,
        onSelectedSegmentChange: setSelectedSegment,
    })
    useLayoutEffect(() => {
        const element = surfaceRef.current
        if (!element) return
        const resize = () => {
            const bounds = element.getBoundingClientRect()
            const next = { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) }
            setSize((previous) => (previous.width === next.width && previous.height === next.height ? previous : next))
            setAutoOrientation((previous) => resolveMsegSurfaceOrientation(next.width, next.height, previous))
        }
        const observer = new ResizeObserver(resize)
        observer.observe(element)
        resize()
        return () => observer.disconnect()
    }, [])
    useLayoutEffect(() => {
        gestures.cancelGesture()
    }, [editor.disabled, editor.readOnly, orientation, gestures.cancelGesture])
    const canEdit = !editor.disabled && !editor.readOnly
    return (
        <MsegDrawingContext.Provider
            value={{
                ...size,
                orientation,
                hoveredSegment: gestures.hoveredSegmentIndex,
                activeSegment: gestures.activeSegmentIndex,
            }}
        >
            <svg
                {...props}
                ref={setRef}
                data-slot="mseg-surface"
                data-hovered-segment={gestures.hoveredSegmentIndex}
                data-active-segment={gestures.activeSegmentIndex}
                data-time-axis={orientation}
                role={props.role ?? 'group'}
                tabIndex={editor.disabled ? -1 : (props.tabIndex ?? 0)}
                aria-disabled={editor.disabled || undefined}
                aria-readonly={editor.readOnly || undefined}
                className={['bk-mseg-surface', className].filter(Boolean).join(' ')}
                style={style}
                viewBox={`0 0 ${size.width} ${size.height}`}
                onBlur={(event) => {
                    onBlur?.(event)
                    editor.endGesture()
                }}
                onKeyUp={(event) => {
                    onKeyUp?.(event)
                    if (event.key.startsWith('Arrow')) editor.endGesture()
                }}
                onKeyDown={(event) => {
                    onKeyDown?.(event)
                    if (event.defaultPrevented || !canEdit || event.target !== event.currentTarget) return
                    const selection = editor.selection
                    if (event.key === '[' || event.key === ']') {
                        event.preventDefault()
                        const index = Math.max(
                            0,
                            Math.min(
                                editor.value.points.length - 2,
                                (selection?.kind === 'segment' ? selection.index : -1) + (event.key === ']' ? 1 : -1),
                            ),
                        )
                        editor.select({ kind: 'segment', index })
                    } else if (
                        selection?.kind === 'segment' &&
                        (event.key === 'ArrowUp' || event.key === 'ArrowDown')
                    ) {
                        event.preventDefault()
                        editor.beginGesture()
                        const delta = (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 0.05 : 0.5)
                        editor.edit((value) =>
                            setMsegSegmentCurvePower(
                                value,
                                selection.index,
                                value.points[selection.index].curvePower + delta,
                            ),
                        )
                    } else if (event.key === 'Insert') {
                        event.preventDefault()
                        editor.edit((value) => addMsegPoint(value, 0.5, 0.5))
                    } else if (event.key === 'Escape') {
                        gestures.cancelGesture()
                        editor.endGesture(true)
                    }
                }}
                onPointerDown={(event) => {
                    onPointerDown?.(event)
                    if (!event.defaultPrevented && canEdit) gestures.handlePointerDown(event)
                }}
                onPointerMove={(event) => {
                    onPointerMove?.(event)
                    if (!event.defaultPrevented && canEdit) gestures.handlePointerMove(event)
                }}
                onPointerLeave={(event) => {
                    onPointerLeave?.(event)
                    gestures.handlePointerLeave(event)
                }}
                onPointerUp={(event) => {
                    onPointerUp?.(event)
                    gestures.handlePointerUp(event)
                }}
                onPointerCancel={(event) => {
                    onPointerCancel?.(event)
                    gestures.handlePointerUp(event)
                }}
                onLostPointerCapture={(event) => {
                    onLostPointerCapture?.(event)
                    gestures.handlePointerUp(event)
                }}
            >
                {children}
            </svg>
        </MsegDrawingContext.Provider>
    )
})
