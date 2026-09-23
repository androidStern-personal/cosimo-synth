import { useState, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { DefaultExample } from './default'
import { ComposedExample } from './composed'
import { MorphExample } from './morph'
import { StatesExample } from './states'
import { PlaybackExample } from './playback'
import playbackSource from './playback.tsx?raw'
import runtimeSource from './playback-runtime.ts?raw'
import defaultSource from './default.tsx?raw'
import composedSource from './composed.tsx?raw'
import morphSource from './morph.tsx?raw'
import statesSource from './states.tsx?raw'
import styles from './examples.css?raw'
import '../knobs/docs.css'
const examples = [
    {
        id: 'playback',
        title: 'Real engine playback',
        description:
            'Trigger, retrigger and release the shipped Cmajor MSEG Reader. Its reports drive the playhead through the public adapter. Edit the envelope while it plays.',
        component: PlaybackExample,
        source: playbackSource,
    },
    {
        id: 'default',
        title: 'Default editor',
        description:
            'Click empty space to add a point. Drag a point or bend a segment. Click an interior point to delete it; Tab and arrow keys also work.',
        component: DefaultExample,
        source: defaultSource,
    },
    {
        id: 'composed',
        title: 'Your layers, handles & controls',
        description:
            'A reference curve, square handles, a time axis and a custom inspector use the same editing behavior. Right-click for an ordinary context menu.',
        component: ComposedExample,
        source: composedSource,
    },
    {
        id: 'morph',
        title: 'Optional A/B morphing',
        description:
            'Two independent curves with different point counts. The gold line is their sampled result. The editor has no built-in A/B state.',
        component: MorphExample,
        source: morphSource,
    },
    {
        id: 'states',
        title: 'Orientation & external state',
        description:
            'Vertical time uses the same coordinates for rendering and editing. Lock the editor or replace its value externally.',
        component: StatesExample,
        source: statesSource,
    },
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
                        {id === 'playback' && (
                            <>
                                <h3>playback-runtime.ts</h3>
                                <pre data-source-file="playback-runtime.ts">
                                    <code>{runtimeSource}</code>
                                </pre>
                                <p>
                                    Copy the frozen playback-program.js, playback-program.d.ts and playback-reader.json
                                    alongside this runtime from kit/examples/mseg. A plugin uses its own patch
                                    connection instead.
                                </p>
                            </>
                        )}
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
                    Builder Kit / MSEG
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
                    <div className="breadcrumb">Components / MSEG</div>
                    <div className="page-title">
                        <h1>MSEG</h1>
                        <span className="badge">Composable editor</span>
                    </div>
                    <p className="lead">
                        One curve, your presentation.
                        <br />
                        Start with the editor, then compose the parts.
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
