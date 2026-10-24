import { useState } from 'react'
import { Mseg } from '../../index'
import './examples.css'
export function StatesExample() {
    const [value, setValue] = useState(() => Mseg.addPoint(Mseg.defaultCurve(), 0.4, 0.8))
    const [locked, setLocked] = useState(false)
    return (
        <div className="mseg-example">
            <label>
                <input type="checkbox" checked={locked} onChange={(event) => setLocked(event.currentTarget.checked)} />{' '}
                Read only
            </label>
            <Mseg.Root value={value} onValueChange={setValue} readOnly={locked}>
                <Mseg.Surface className="envelope vertical" aria-label="Vertical envelope" orientation="vertical">
                    <Mseg.Grid />
                    <Mseg.Fill />
                    <Mseg.Line />
                    <Mseg.Points />
                    <Mseg.TimeAxis scale={{ kind: 'notes', totalDivision: { numerator: 1, denominator: 1 } }} />
                </Mseg.Surface>
            </Mseg.Root>
            <button onClick={() => setValue(Mseg.defaultCurve())}>External reset</button>
        </div>
    )
}
