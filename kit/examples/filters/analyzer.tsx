import { useEffect, useState } from 'react'
import { FilterEditor, type FilterValue, type FilterSpectrumFrame, type FilterSpectrumRenderMode } from '../../index'
import './examples.css'

export function AnalyzerExample() {
    const [value, setValue] = useState<FilterValue>({ mode: 'bandpass', cutoffHz: 2200, q: 4 })
    const [frame, setFrame] = useState<FilterSpectrumFrame | null>(null)
    const [renderMode, setRenderMode] = useState<FilterSpectrumRenderMode>('graph')
    const [enabled, setEnabled] = useState(true)
    useEffect(() => {
        if (!enabled) { setFrame(null); return }
        // A demonstration signal; supply linear FFT magnitudes from your own audio engine.
        let phase = 0
        const timer = window.setInterval(() => {
            phase += .12
            setFrame({ sampleRateHz: 48000, magnitudes: Array.from({ length: 512 }, (_, i) =>
                .035 * Math.exp(-(((i - 25 - Math.sin(phase) * 12) / 10) ** 2)) +
                .015 * Math.exp(-(((i - 105) / 40) ** 2)) + .00006) })
        }, 50)
        return () => window.clearInterval(timer)
    }, [enabled])
    return <div className="filter-example filter-dark">
        <FilterEditor value={value} onValueChange={setValue} preview={{ cutoffHz: value.cutoffHz * 1.6, q: value.q * 1.2 }}
            spectrum={{ frame, renderMode }} showModeControls />
        <div className="filter-toolbar"><label>Analyzer <select value={renderMode}
            onChange={e => setRenderMode(e.target.value as FilterSpectrumRenderMode)}>
            <option value="graph">Graph</option><option value="bars">Bars</option><option value="round-bars">Rounded bars</option>
        </select></label><label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Demo signal</label></div>
    </div>
}
