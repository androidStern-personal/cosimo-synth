import { useState } from 'react'
import { FilterEditor, type FilterValue, type FilterRangeEndpoints } from '../../index'
import './examples.css'

export function BandExample() {
    const [value, setValue] = useState<FilterValue>({ mode: 'lowpass', cutoffHz: 1200, q: 3 })
    const [range, setRange] = useState<FilterRangeEndpoints>({ startCutoffHz: 300, endCutoffHz: 4800 })
    const [unipolar, setUnipolar] = useState(false)
    return <div className="filter-example">
        <FilterEditor value={value} range={range} rangePolarity={unipolar ? 'unipolar' : 'bipolar'}
            preview={{ cutoffHz: range.endCutoffHz }} showHandleChips showReadout showModeControls
            onValueChange={setValue} onRangeChange={setRange} />
        <label className="filter-toolbar"><input type="checkbox" checked={unipolar}
            onChange={e => setUnipolar(e.target.checked)} /> Start range at the value handle</label>
    </div>
}
