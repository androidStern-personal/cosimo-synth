import { useState } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { Mseg } from '../../index'
import './examples.css'
function Toolbar() {
    const editor = Mseg.useEditor()
    const selected = editor.selection
    const point = selected?.kind === 'point' ? editor.value.points[selected.index] : null
    return (
        <div className="mseg-toolbar">
            <button onClick={() => editor.edit((value) => Mseg.addPoint(value, 0.5, 0.8))}>Add midpoint</button>
            <button
                disabled={
                    !selected ||
                    selected.kind !== 'point' ||
                    selected.index === 0 ||
                    selected.index === editor.value.points.length - 1
                }
                onClick={() => {
                    if (selected?.kind === 'point') editor.edit((value) => Mseg.deletePoint(value, selected.index))
                }}
            >
                Delete selected
            </button>
            {point && (
                <label>
                    Value{' '}
                    <input
                        aria-label="Selected point value"
                        type="number"
                        min="0"
                        max="1"
                        step=".01"
                        value={point.y}
                        onChange={(event) => {
                            const y = event.currentTarget.valueAsNumber
                            if (selected && Number.isFinite(y))
                                editor.edit((value) => Mseg.movePoint(value, selected.index, point.x, y))
                        }}
                    />
                </label>
            )}
            {selected?.kind === 'segment' && (
                <label>
                    Curvature{' '}
                    <input
                        aria-label="Selected segment curvature"
                        type="number"
                        min="-20"
                        max="20"
                        step=".5"
                        value={editor.value.points[selected.index].curvePower}
                        onChange={(event) => {
                            const power = event.currentTarget.valueAsNumber
                            if (Number.isFinite(power))
                                editor.edit((value) => Mseg.setCurvePower(value, selected.index, power))
                        }}
                    />
                </label>
            )}
        </div>
    )
}
export function ComposedExample() {
    const [value, setValue] = useState(() => Mseg.addPoint(Mseg.defaultCurve(), 0.35, 0.8))
    const [reference] = useState(() => Mseg.addPoint(Mseg.defaultCurve(), 0.65, 0.35))
    return (
        <Mseg.Root value={value} onValueChange={setValue} className="mseg-example">
            <ContextMenu.Root>
                <ContextMenu.Trigger asChild>
                    <Mseg.Surface className="envelope" aria-label="Custom envelope" style={{ height: 230 }}>
                        <Mseg.Grid />
                        <Mseg.Line value={reference} stroke="#b398da" strokeDasharray="5 5" />
                        <Mseg.Fill />
                        <Mseg.Line />
                        <Mseg.SegmentHighlight />
                        <Mseg.Points
                            renderPoint={({ selected, handleProps }) => (
                                <g {...handleProps}>
                                    <rect
                                        x={-7}
                                        y={-7}
                                        width={14}
                                        height={14}
                                        rx={selected ? 2 : 5}
                                        fill="currentColor"
                                    />
                                </g>
                            )}
                        />
                        <Mseg.TimeAxis scale={{ kind: 'seconds', totalSeconds: 2 }} />
                    </Mseg.Surface>
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                    <ContextMenu.Content className="mseg-menu">
                        <ContextMenu.Item onSelect={() => setValue(Mseg.defaultCurve())}>
                            Reset envelope
                        </ContextMenu.Item>
                    </ContextMenu.Content>
                </ContextMenu.Portal>
            </ContextMenu.Root>
            <Toolbar />
        </Mseg.Root>
    )
}
