import { useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import * as Examples from './examples';
import source from './examples.tsx?raw';
import './docs.css';

const examples: { id: string; title: string; description: string; component: ComponentType; note?: string }[] = [
    { id: 'default', title: 'Default', description: 'A complete control in one component. Drag up to increase. Every knob below is interactive.', component: Examples.DefaultExample },
    { id: 'scales', title: 'Values & scales', description: 'Bipolar ranges, discrete choices, and a custom response curve. The value always stays in your parameter’s units.', component: Examples.ScalesExample },
    { id: 'entry', title: 'Exact entry', description: 'Compose an input with the dial. Try “2.5 kHz”, an invalid unit, or an out-of-range value.', component: Examples.EntryExample, note: 'Enter or blur to commit · Escape to discard the draft' },
    { id: 'live', title: 'Live modulation', description: 'The outer light follows a simulated signal. Drag the base value while it moves—the two remain independent.', component: Examples.LiveExample, note: 'The render count stays still while the marker moves. Stop the signal or detach the knob to exercise cleanup.' },
    { id: 'two-axis', title: 'Two-axis editing', description: 'One surface can edit two quantities. Change direction during a drag; ownership rolls to the other axis without a jump.', component: Examples.TwoAxisExample },
    { id: 'menu', title: 'Context menu', description: 'Compose an ordinary Radix context-menu trigger with the knob. The menu’s actions belong to your application.', component: Examples.MenuExample },
    { id: 'custom', title: 'Your own artwork', description: 'Replace the dial with a needle or a meter. Both share the same value and keep pointer, keyboard and gesture behavior.', component: Examples.CustomExample },
    { id: 'styles', title: 'Size & color', description: 'CSS variables and ordinary classes. These three controls share one value.', component: Examples.StylesExample, note: 'Set --knob-size, --knob-color, --knob-range-color, --knob-indicator, and --knob-ink.' },
    { id: 'states', title: 'Controlled & unavailable', description: 'External updates reach every view. Read-only stays focusable; disabled leaves the tab order.', component: Examples.StatesExample },
    { id: 'horizontal', title: 'Input configuration', description: 'A horizontal drag with 320 pixels of full-range travel and keyboard increments of five.', component: Examples.HorizontalExample },
    { id: 'gestures', title: 'Gesture lifecycle', description: 'One drag produces one edit bracket. Keyboard repeats stay grouped until release. Cancellation keeps accepted values.', component: Examples.GesturesExample },
];

function exampleSource(id: string) {
    return source.split(`// example:${id}\n`)[1]?.split('// endexample')[0]?.trim() ?? '';
}
function Code({ text }: { text: string }) {
    const tokens = text.split(/("[^"\n]*"|'[^'\n]*'|\/\/[^\n]*|\b(?:export|function|return|const|let|if|else|type|import|from|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/g);
    return <pre><code>{tokens.map((token, i) => <span key={i} className={token.startsWith('//') ? 'comment' : /^['"]/.test(token) ? 'string' : /^(export|function|return|const|let|if|else|type|import|from|true|false|null|undefined)$/.test(token) ? 'keyword' : /^\d/.test(token) ? 'number' : ''}>{token}</span>)}</code></pre>;
}
function Copy({ text }: { text: string }) {
    const [status, setStatus] = useState('Copy');
    return <button className="copy" onClick={async () => {
        try { await navigator.clipboard.writeText(text); setStatus('Copied'); }
        catch { setStatus('Select code to copy'); }
    }}>{status}</button>;
}
function Example({ example }: { example: typeof examples[number] }) {
    const [tab, setTab] = useState<'preview' | 'code'>('preview');
    const Demo = example.component;
    return <section id={example.id} className="example">
        <div className="section-heading"><h2><a href={`#${example.id}`}>{example.title}</a></h2><span className="section-number">{String(examples.indexOf(example) + 1).padStart(2, '0')}</span></div>
        <p>{example.description}</p>
        <div className="example-card">
            <div role="tablist" aria-label={`${example.title} view`} className="tabs">
                <button role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>Preview</button>
                <button role="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')}>Code</button>
                {tab === 'code' && <Copy text={exampleSource(example.id)} />}
            </div>
            {tab === 'preview' ? <div className="preview" role="tabpanel"><Demo /></div>
                : <div role="tabpanel" className="source"><Code text={exampleSource(example.id)} /></div>}
            {example.note && <div className="example-note">{example.note}</div>}
        </div>
    </section>;
}
function App() {
    const [light, setLight] = useState(false);
    return <div className="docs" data-theme={light ? 'light' : 'dark'}>
        <header className="topbar"><a href="#" className="brand"><span className="brand-icon">◔</span> Builder Kit <span className="brand-divider">/</span><span className="muted">UI</span></a>
            <div className="top-links"><a href="#api">API reference</a><button onClick={() => setLight(!light)} aria-label="Toggle color theme">{light ? '◐ Dark' : '◑ Light'}</button></div></header>
        <div className="page-layout">
            <aside className="sidebar"><div className="sidebar-label">COMPONENTS</div><a className="selected" href="#">Knob <span>↗</span></a>
                <div className="sidebar-label section-gap">ON THIS PAGE</div>{examples.map(e => <a key={e.id} href={`#${e.id}`}>{e.title}</a>)}
                <a href="#usage">Usage</a><a href="#keyboard">Keyboard</a><a href="#api">API reference</a>
                <div className="sidebar-foot">Real components.<br/>Editable source.<br/>Your plugin.</div>
            </aside>
            <main>
                <div className="breadcrumb">Components <span>/</span> Knob</div>
                <div className="page-title"><h1>Knob</h1><span className="badge">Interactive preview</span></div>
                <p className="lead">A numeric control that feels right.<br/>Use the finished dial, or compose your own.</p>
                <div className="capabilities"><span>Pointer & keyboard</span><span>Unit-aware</span><span>Composable</span><span>Live indicators</span></div>
                {examples.map(example => <Example key={example.id} example={example} />)}
                <section id="usage" className="reference-section"><h2>Usage</h2><p>Import from the kit’s public entry. Styles are included and scoped to the knob’s classes.</p>
                    <div className="standalone-code"><Copy text={'import { Knob } from "../../kit/index";'} /><Code text={'import { Knob } from "../../kit/index";\n\n<Knob\n  label="Gain"\n  value={gain}\n  onValueChange={setGain}\n/>'} /></div>
                    <h3>Connect plugin state</h3><p>The component owns interaction. Your state control owns saving, synchronization and Undo.</p>
                    <div className="standalone-code"><Code text={'const gain = usePluginState(state.gain);\n\nif (!("value" in gain.state)) return null;\n\nreturn <Knob\n  label="Gain"\n  value={gain.state.value}\n  onValueChange={value => { void gain.setValue(value); }}\n  onGestureStart={() => { void gain.beginGesture(); }}\n  onGestureEnd={() => { void gain.endGesture(); }}\n/>;'} /></div>
                </section>
                <section id="keyboard" className="reference-section"><h2>Keyboard</h2><div className="table-wrap"><table><thead><tr><th>Input</th><th>Behavior</th></tr></thead><tbody>
                    <tr><td>↑ → / ↓ ←</td><td>Increase / decrease. A stepped domain moves by one step; otherwise 1% of dial travel.</td></tr>
                    <tr><td>Shift + arrow / drag</td><td>Fine adjustment: one tenth of continuous travel. Discrete steps remain discrete.</td></tr>
                    <tr><td>Page Up / Page Down</td><td>Ten increments.</td></tr><tr><td>Home / End</td><td>Minimum / maximum.</td></tr><tr><td>Escape</td><td>End the active gesture. In exact entry, discard the text draft.</td></tr>
                </tbody></table></div></section>
                <section id="api" className="reference-section"><h2>API reference</h2><p>Every visual part accepts standard props, classes, styles and a ref.</p>
                    <div className="table-wrap"><table><thead><tr><th>Part</th><th>Purpose</th><th>Key props</th></tr></thead><tbody>
                        {[
                            ['Knob', 'Ready-made control', 'label + root options'],
                            ['KnobRoot', 'Value, scale & interaction context', 'value, onValueChange, min, max, step, scale, formatValue, disabled, readOnly, onGestureStart, onGestureEnd'],
                            ['KnobControl', 'Pointer & keyboard input', 'asChild, drag, sensitivity, keyboardStep'],
                            ['KnobDial', 'Default SVG artwork', 'children'],
                            ['KnobRange', 'Read-only interval', 'from, to, innerRadius, outerRadius'],
                            ['KnobMarker', 'Read-only live or static value', 'value, radius, smoothingMs'],
                            ['KnobLabel / KnobValue', 'Accessible label / formatted base value', 'Standard element props'],
                            ['KnobInput', 'Validated exact entry', 'parseValue + input props'],
                            ['useKnob()', 'Custom presentation', 'value, position, toPosition, isDragging, activeAxis'],
                        ].map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{i === 0 ? <code>{cell}</code> : cell}</td>)}</tr>)}
                    </tbody></table></div>
                    <h3>Live source</h3><p>A number draws a marker; null hides it. For streamed updates, supply this read-only interface. The kit owns the display loop and unsubscribes on unmount.</p>
                    <div className="standalone-code"><Code text={'type LiveValue<T> = {\n  getSnapshot(): T;\n  subscribe(onChange: () => void): () => void;\n};\n\n// Values use the knob’s units, such as Hz.\n<KnobMarker value={liveFrequency} smoothingMs={45} />'} /></div>
                </section>
                <footer>Builder Kit <span>Knob composition reference</span><a href="#">Back to top ↑</a></footer>
            </main>
        </div>
    </div>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Demo root is missing.');
createRoot(root).render(<App />);
