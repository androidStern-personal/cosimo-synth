import { useState, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { DefaultExample } from './default'
import { BandExample } from './band'
import { ModulationExample } from './modulation'
import { StatesExample } from './states'
import { AnalyzerExample } from './analyzer'
import analyzerSource from './analyzer.tsx?raw'
import defaultSource from './default.tsx?raw'
import bandSource from './band.tsx?raw'
import modulationSource from './modulation.tsx?raw'
import statesSource from './states.tsx?raw'
import styles from './examples.css?raw'
import '../knobs/docs.css'
const examples = [
    { id: 'default', title: 'Simple filter', description: 'Drag the value grip: left/right adjusts cutoff, up/down adjusts resonance. Focus it and use arrow keys. The mode button cycles filter types.', component: DefaultExample, source: defaultSource },
    { id: 'band', title: 'Cutoff range and value chips', description: 'A one-dimensional range band, optional preview response and readouts. The unipolar switch anchors the start at the base value.', component: BandExample, source: bandSource },
    { id: 'modulation', title: 'Two-axis modulation', description: 'Drag either endpoint or translate the entire interval with the center diamond. The zero-width endpoint parks beside the base. Choose which axes are editable; the plug-in owns routing.', component: ModulationExample, source: modulationSource },
    { id: 'analyzer', title: 'Spectrum and live response', description: 'An optional FFT layer with attack/release smoothing, peak hold, graph, bars and rounded bars. This example uses a generated demo signal; the kit does not supply an audio engine.', component: AnalyzerExample, source: analyzerSource },
    { id: 'states', title: 'Theme, scale and external state', description: 'CSS tokens change the artwork without changing behavior. A custom resonance transfer, read-only/disabled states, and an externally replaced value.', component: StatesExample, source: statesSource },
]
function Example({
    id,
    title,
    description,
    component: Demo,
    source,
}: {
    id: string
    title: string
    description: string
    component: ComponentType
    source: string
}) {
    const [code, setCode] = useState(false)
    return (
        <section className="example" id={id}>
            <h2>{title}</h2>
            <p>{description}</p>
            <div className="example-card">
                <div role="tablist" aria-label={`${title} view`} className="tabs">
                    <button role="tab" aria-selected={!code} onClick={() => setCode(false)}>
                        Preview
                    </button>
                    <button role="tab" aria-selected={code} onClick={() => setCode(true)}>
                        Code
                    </button>
                </div>
                {code ? (
                    <div className="source">
                        <p>Complete example. Adjust the public kit import path for your project.</p>
                        <pre data-source-file={`${id}.tsx`}>
                            <code>{source}</code>
                        </pre>
                        <h3>examples.css</h3>
                        <pre data-source-file="examples.css">
                            <code>{styles}</code>
                        </pre>
                    </div>
                ) : (
                    <div className="preview" role="tabpanel">
                        <Demo />
                    </div>
                )}
            </div>
        </section>
    )
}
function App() {
    return (
        <div className="docs" data-theme="dark">
            <header className="topbar">
                <a href="#" className="brand">
                    Builder Kit / Filter
                </a>
                <span>Interactive reference</span>
            </header>
            <div className="page-layout">
                <aside className="sidebar">
                    <div className="sidebar-label">ON THIS PAGE</div>
                    {examples.map((e) => (
                        <a key={e.id} href={`#${e.id}`}>
                            {e.title}
                        </a>
                    ))}
                </aside>
                <main>
                    <div className="breadcrumb">Components / Filter</div>
                    <div className="page-title">
                        <h1>Filter</h1>
                        <span className="badge">Shared editor</span>
                    </div>
                    <p className="lead">
                        One filter editor, optional layers.
                        <br />
                        Start with cutoff and resonance; add ranges and an analyzer when needed.
                    </p>
                    {examples.map((e) => (
                        <Example key={e.id} {...e} />
                    ))}
                </main>
            </div>
        </div>
    )
}
createRoot(document.getElementById('root')!).render(<App />)
