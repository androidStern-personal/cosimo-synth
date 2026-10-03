import { useState } from 'react'
import { FilterEditor, type FilterValue } from '../../index'
import './examples.css'

export function StatesExample() {
    const [value, setValue] = useState<FilterValue>({ mode: 'highpass', cutoffHz: 400, q: 2 })
    const [readOnly, setReadOnly] = useState(false)
    const [disabled, setDisabled] = useState(false)
    return <div className="filter-example filter-dark filter-custom">
        <FilterEditor value={value} onValueChange={setValue} readOnly={readOnly} disabled={disabled}
            showReadout showModeControls qScale={{ qToSurface: q => Math.sqrt((q - .1) / 19.9), surfaceToQ: x => .1 + x * x * 19.9 }} />
        <div className="filter-toolbar">
            <label><input type="checkbox" checked={readOnly} onChange={e => setReadOnly(e.target.checked)} /> Read only</label>
            <label><input type="checkbox" checked={disabled} onChange={e => setDisabled(e.target.checked)} /> Disabled</label>
            <button onClick={() => setValue({ mode: 'notch', cutoffHz: 3000, q: 5 })}>External reset</button>
        </div>
    </div>
}
