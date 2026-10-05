import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState, type SVGProps } from 'react'
import css from './mseg.css?inline'
import { isStepKey, stepForKey } from './keyboard-steps'
import {
    addMsegPoint,
    deleteMsegPoint,
    moveMsegPoint,
    resolveMsegSurfaceOrientation,
    setMsegSegmentCurvePower,
    type MsegSurfaceOrientation,
} from './mseg'
import { useMsegGestures } from './mseg-gestures'
import { MsegDrawingContext, useMsegContext } from './mseg-context'
import { retainStyles } from './styles'
import { useElementSize } from './use-element-size'

/** Curve-power change per keyboard step on a selected segment. */
const CURVE_POWER_KEY_STEP = 0.5

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
    useLayoutEffect(() => (surfaceRef.current ? retainStyles(surfaceRef.current, 'mseg', css) : undefined), [])
    const size = useElementSize(surfaceRef)
    const [autoOrientation, setAutoOrientation] = useState<MsegSurfaceOrientation>('horizontal')
    useLayoutEffect(() => {
        setAutoOrientation((previous) => resolveMsegSurfaceOrientation(size.width, size.height, previous))
    }, [size.width, size.height])
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
    useEffect(() => editor.onCancel(gestures.cancelGesture), [editor.onCancel, gestures.cancelGesture])
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
                    if (isStepKey(event.key)) editor.endGesture()
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
                        return
                    }
                    if (event.key === 'Insert') {
                        event.preventDefault()
                        editor.edit((value) => addMsegPoint(value, 0.5, 0.5))
                        return
                    }
                    const step = stepForKey(event)
                    if (selection?.kind !== 'segment' || step?.kind !== 'step' || step.axis !== 'vertical') return
                    event.preventDefault()
                    editor.beginGesture()
                    editor.edit((value) =>
                        setMsegSegmentCurvePower(
                            value,
                            selection.index,
                            value.points[selection.index].curvePower + step.steps * CURVE_POWER_KEY_STEP,
                        ),
                    )
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
