import { useState } from 'react'
import { FilterEditor, type FilterValue } from '../../index'
import './examples.css'

export function DefaultExample() {
    const [value, setValue] = useState<FilterValue>({ mode: 'lowpass', cutoffHz: 1200, q: 3 })
    return <div className="filter-example">
        <FilterEditor value={value} onValueChange={setValue} showModeControls showReadout />
    </div>
}
