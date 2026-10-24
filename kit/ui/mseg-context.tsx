import {
    createContext,
    forwardRef,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type HTMLAttributes,
} from 'react'
import type { MsegShape, MsegSurfaceOrientation } from './mseg'

export type MsegSelection = { readonly kind: 'point' | 'segment'; readonly index: number } | null
export type MsegEditing = {
    readonly value: MsegShape
    readonly selection: MsegSelection
    select(selection: MsegSelection): void
    edit(change: (current: MsegShape) => MsegShape): void
    beginGesture(): void
    endGesture(cancelled?: boolean): void
}
export type MsegRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
    readonly value: MsegShape
    readonly onValueChange: (value: MsegShape) => void
    readonly selection?: MsegSelection
    readonly defaultSelection?: MsegSelection
    readonly onSelectionChange?: (selection: MsegSelection) => void
    readonly onGestureStart?: () => void
    readonly onGestureEnd?: (cancelled: boolean) => void
    readonly disabled?: boolean
    readonly readOnly?: boolean
}
function validSelection(selection: MsegSelection, value: MsegShape): MsegSelection {
    if (!selection || !Number.isInteger(selection.index) || selection.index < 0) return null
    return selection.index < value.points.length - (selection.kind === 'segment' ? 1 : 0) ? selection : null
}
function sameSelection(a: MsegSelection, b: MsegSelection) {
    return a?.kind === b?.kind && a?.index === b?.index
}
type EditorContext = MsegEditing & {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly current: { current: MsegShape }
    /** Surfaces register their pointer cleanup so one cancellation ends every interaction. */
    onCancel(listener: () => void): () => void
}
const EditingContext = createContext<EditorContext | null>(null)
/** Internal context; public consumers get only the editing interface. */
export function useMsegContext(): EditorContext {
    const context = useContext(EditingContext)
    if (!context) throw new Error('MSEG parts must be inside Mseg.Root.')
    return context
}
export function useMsegEditor(): MsegEditing {
    const { value, selection, select, edit, beginGesture, endGesture } = useMsegContext()
    return { value, selection, select, edit, beginGesture, endGesture }
}

/** Controlled curve and shared editing commands, independent of rendering and persistence. */
export const MsegRoot = forwardRef<HTMLDivElement, MsegRootProps>(function MsegRoot(
    {
        value,
        onValueChange,
        selection: suppliedSelection,
        defaultSelection = null,
        onSelectionChange,
        onGestureStart,
        onGestureEnd,
        disabled = false,
        readOnly = false,
        children,
        ...props
    },
    ref,
) {
    const [localSelection, setLocalSelection] = useState<MsegSelection>(defaultSelection)
    const selection = validSelection(suppliedSelection === undefined ? localSelection : suppliedSelection, value)
    const current = useRef(value)
    const observed = useRef(value)
    if (observed.current !== value) {
        observed.current = value
        current.current = value
    }
    const latest = useRef({
        onValueChange,
        onSelectionChange,
        onGestureStart,
        onGestureEnd,
        suppliedSelection,
        selection,
        disabled,
        readOnly,
    })
    latest.current = {
        onValueChange,
        onSelectionChange,
        onGestureStart,
        onGestureEnd,
        suppliedSelection,
        selection,
        disabled,
        readOnly,
    }
    const finish = useRef<((cancelled: boolean) => void) | null>(null)
    const cancelListeners = useRef(new Set<() => void>())
    const onCancel = useCallback((listener: () => void) => {
        cancelListeners.current.add(listener)
        return () => {
            cancelListeners.current.delete(listener)
        }
    }, [])
    const endGesture = useCallback((cancelled = false) => {
        const close = finish.current
        finish.current = null
        close?.(cancelled)
    }, [])
    const beginGesture = useCallback(() => {
        if (finish.current || latest.current.disabled || latest.current.readOnly) return
        const end = latest.current.onGestureEnd
        finish.current = (cancelled) => end?.(cancelled)
        latest.current.onGestureStart?.()
    }, [])
    const select = useCallback((next: MsegSelection) => {
        next = validSelection(next, current.current)
        if (sameSelection(next, latest.current.selection)) return
        if (latest.current.suppliedSelection === undefined) setLocalSelection(next)
        latest.current.onSelectionChange?.(next)
    }, [])
    const edit = useCallback(
        (change: (current: MsegShape) => MsegShape) => {
            if (latest.current.disabled || latest.current.readOnly) return
            const previous = current.current
            const next = change(previous)
            if (next === previous) return
            const grouped = finish.current !== null
            beginGesture()
            try {
                current.current = next
                latest.current.onValueChange(next)
                // Insertion/deletion may shift indices. Preserve the selected point by
                // coordinates when it survives; clear a deleted point/changed segment.
                const selected = latest.current.selection
                if (selected && previous.points.length !== next.points.length) {
                    const point = previous.points[selected.index]
                    const index =
                        selected.kind === 'point'
                            ? next.points.findIndex((p) => p.x === point.x && p.y === point.y)
                            : -1
                    select(index >= 0 ? { kind: 'point', index } : null)
                }
            } finally {
                if (!grouped) endGesture()
            }
        },
        [beginGesture, endGesture, select],
    )
    useEffect(() => {
        if (disabled || readOnly) endGesture(true)
    }, [disabled, readOnly, endGesture])
    const rootElement = useRef<HTMLDivElement | null>(null)
    const setRef = useCallback(
        (node: HTMLDivElement | null) => {
            rootElement.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
        },
        [ref],
    )
    // Escape, leaving the window or hiding the page cancels whatever is in progress,
    // wherever focus is: a drag does not move focus to the surface.
    useEffect(() => {
        const document = rootElement.current?.ownerDocument,
            view = document?.defaultView
        if (!document || !view) return
        const cancel = () => {
            for (const listener of cancelListeners.current) listener()
            endGesture(true)
        }
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') cancel()
        }
        const visibility = () => {
            if (document.visibilityState !== 'visible') cancel()
        }
        view.addEventListener('blur', cancel)
        view.addEventListener('keydown', key)
        document.addEventListener('visibilitychange', visibility)
        return () => {
            view.removeEventListener('blur', cancel)
            view.removeEventListener('keydown', key)
            document.removeEventListener('visibilitychange', visibility)
            cancel()
        }
    }, [endGesture])
    return (
        <EditingContext.Provider
            value={{ value, selection, select, edit, beginGesture, endGesture, disabled, readOnly, current, onCancel }}
        >
            <div
                {...props}
                ref={setRef}
                data-slot="mseg-root"
                data-selected-point={selection?.kind === 'point' ? selection.index : -1}
                data-disabled={disabled || undefined}
                data-readonly={readOnly || undefined}
            >
                {children}
            </div>
        </EditingContext.Provider>
    )
})

export type MsegDrawing = {
    readonly width: number
    readonly height: number
    readonly orientation: MsegSurfaceOrientation
    readonly hoveredSegment: number
    readonly activeSegment: number
}
export const MsegDrawingContext = createContext<MsegDrawing | null>(null)
export function useMsegDrawing() {
    const drawing = useContext(MsegDrawingContext)
    if (!drawing) throw new Error('MSEG drawing layers must be inside Mseg.Surface.')
    return drawing
}
