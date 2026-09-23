import { useMemo, useState } from 'react'
import { Mseg } from '../../index'
import './examples.css'
export function MorphExample() {
    const [a, setA] = useState(() => Mseg.addPoint(Mseg.defaultCurve(), 0.2, 0.9))
    const [b, setB] = useState(() => Mseg.addPoint(Mseg.addPoint(Mseg.defaultCurve(), 0.4, 0.15), 0.7, 0.8))
    const [editing, setEditing] = useState<'A' | 'B'>('A')
    const [morph, setMorph] = useState(0.5)
    const samples = useMemo(() => {
        const left = new Float32Array(Mseg.sampleCount),
            right = new Float32Array(Mseg.sampleCount)
        Mseg.renderInto(a, left)
        Mseg.renderInto(b, right)
        // The renderer adds one leading and two trailing interpolation samples.
        return left.slice(1, -2).map((sample, index) => sample * (1 - morph) + right[index + 1] * morph)
    }, [a, b, morph])
    return (
        <div className="mseg-example">
            <div className="mseg-toolbar">
                <button aria-pressed={editing === 'A'} onClick={() => setEditing('A')}>
                    Edit A
                </button>
                <button aria-pressed={editing === 'B'} onClick={() => setEditing('B')}>
                    Edit B
                </button>
            </div>
            <Mseg.Root key={editing} value={editing === 'A' ? a : b} onValueChange={editing === 'A' ? setA : setB}>
                <Mseg.Surface aria-label={`Shape ${editing}`} className="envelope" style={{ height: 230 }}>
                    <Mseg.Grid />
                    <Mseg.Curve value={editing === 'A' ? b : a} stroke="#b398da" opacity={0.45} />
                    <Mseg.Fill />
                    <Mseg.Curve />
                    <Mseg.Plot samples={samples} stroke="#eab67b" strokeWidth={3} />
                    <Mseg.Points />
                </Mseg.Surface>
            </Mseg.Root>
            <label className="morph-control">
                Morph A → B{' '}
                <input
                    aria-label="Morph"
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={morph}
                    onChange={(event) => setMorph(event.currentTarget.valueAsNumber)}
                />
            </label>
        </div>
    )
}
