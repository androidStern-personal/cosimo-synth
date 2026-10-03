import { useState } from 'react'
import { FilterEditor, type FilterValue, type FilterModulationEndpoints, type FilterModulation, type FilterEditTarget } from '../../index'
import './examples.css'

export function ModulationExample() {
    const [value, setValue] = useState<FilterValue>({ mode: 'lowpass', cutoffHz: 1200, q: 3 })
    const [endpoints, setEndpoints] = useState<FilterModulationEndpoints>({
        start: { cutoffHz: 300, q: 1 }, end: { cutoffHz: 4800, q: 8 },
    })
    const [axes, setAxes] = useState<FilterModulation['axes']>('both')
    const [unipolar, setUnipolar] = useState(false)
    const [events, setEvents] = useState<string[]>([])
    const record = (phase: string, target: FilterEditTarget) => setEvents(log => [...log.slice(-7), `${phase}:${target}`])
    return <div className="filter-example filter-dark">
        <FilterEditor value={value} onValueChange={setValue} showModeControls
            modulation={{ ...endpoints, start: unipolar ? value : endpoints.start, axes,
                showStartHandle: !unipolar, baseHandleMode: unipolar ? 'start' : 'value', color: '#ae8ef6' }}
            onModulationChange={(next, target) => {
                setEndpoints(next)
                // This demo chooses to move the base when the unipolar start or center moves.
                // A plug-in can instead translate endpoints into its own route amounts here.
                if (unipolar && (target === 'base' || target === 'center')) setValue(v => ({ ...v, ...next.start }))
            }}
            onEditStart={target => record('start', target)} onEditEnd={target => record('end', target)} />
        <div className="filter-toolbar">
            <label>Editable axes <select value={axes} onChange={e => setAxes(e.target.value as FilterModulation['axes'])}>
                <option value="both">Cutoff and resonance</option><option value="cutoff">Cutoff only</option><option value="q">Resonance only</option>
            </select></label>
            <label><input type="checkbox" checked={unipolar} onChange={e => setUnipolar(e.target.checked)} /> Unipolar</label>
        </div>
        <output className="filter-log" data-role="endpoint-values">{JSON.stringify(endpoints)}</output>
        <output className="filter-log" data-role="gesture-events">{events.join(' · ') || 'Drag a handle to see edit boundaries.'}</output>
    </div>
}
