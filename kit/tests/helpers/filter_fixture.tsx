import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FilterEditor, type FilterValue, type FilterModulationEndpoints, type FilterEditTarget } from '../../index'
export function mount(host: HTMLElement) {
    const shadow = host.attachShadow({ mode: 'open' })
    const mountPoint = document.createElement('div')
    mountPoint.style.width = '600px'
    shadow.append(mountPoint)
    const root = createRoot(mountPoint)
    let value: FilterValue = { mode: 'lowpass', cutoffHz: 1200, q: 3 }
    let endpoints: FilterModulationEndpoints = { start: { cutoffHz: 300, q: 1 }, end: { cutoffHz: 4800, q: 8 } }
    const events: string[] = []
    let writes = 0
    type Options = { disabled: boolean; readOnly: boolean; version: number; second: boolean }
    let configure = (_next: Partial<Options>) => {}
    function View() {
        const [current, setValue] = useState(value)
        const [range, setEndpoints] = useState(endpoints)
        const [options, setOptions] = useState<Options>({ disabled: false, readOnly: false, version: 0, second: true })
        configure = next => setOptions(o => ({ ...o, ...next }))
        const record = (phase: string, target: FilterEditTarget) => events.push(`${phase}:${options.version}:${target}`)
        return <>
            <FilterEditor value={current} modulation={range} disabled={options.disabled} readOnly={options.readOnly}
                onValueChange={next => { writes++; value=next; setValue(next) }}
                onModulationChange={next => { writes++; endpoints=next; setEndpoints(next) }}
                onEditStart={t => record('start', t)} onEditEnd={t => record('end', t)} />
            {options.second && <FilterEditor value={current} readOnly />}
        </>
    }
    root.render(<View />)
    return { configure: (next: Partial<Options>) => configure(next), events,
        writes: () => writes, value: () => value, endpoints: () => endpoints, unmount: () => root.unmount() }
}
