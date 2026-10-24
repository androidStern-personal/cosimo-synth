// The Enhancer's editor. Edit it live with `npm run fx:dev`; `npm run fx:build -- enhancer` bundles it.
import { useEffect, useRef, type CSSProperties } from "react";
import { createStatefulPatchView, PresetBar, SnapshotBar, usePluginHistory, usePluginState, type PluginStateControl } from "../../../kit/index";
import definition from "../state";
import css from "./enhancer.css?inline";
import { clamp, formatBoost, formatFrequency, formatPercent, formatQ } from "./format";
import { ResponsePlot } from "./response-plot";

/** How a slider maps its position to a parameter value, and how it shows that value. */
interface SliderScale {
    readonly label: string;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly logarithmic: boolean;
    readonly format: (value: number) => string;
}

const frequencyScale: SliderScale = { label: "Frequency", min: 20, max: 20_000, step: 0.0001, logarithmic: true, format: formatFrequency };
const qScale: SliderScale = { label: "Q", min: 0.1, max: 10, step: 0.001, logarithmic: false, format: formatQ };
const amountScale: SliderScale = { label: "Amount", min: 0, max: 1, step: 0.001, logarithmic: false, format: formatBoost };
const sideScale: SliderScale = { ...amountScale, label: "Side" };
const deEmphasisScale: SliderScale = { label: "De-emphasis", min: 0, max: 1, step: 0.001, logarithmic: false, format: formatPercent };

function toSliderPosition(scale: SliderScale, value: number): number {
    const clamped = clamp(value, scale.min, scale.max);
    return scale.logarithmic ? Math.log(clamped / scale.min) / Math.log(scale.max / scale.min) : clamped;
}

function fromSliderPosition(scale: SliderScale, position: number): number {
    return scale.logarithmic
        ? scale.min * Math.pow(scale.max / scale.min, clamp(position, 0, 1))
        : clamp(position, scale.min, scale.max);
}

const bandAccents = { 1: "#f0b867", 2: "#8ec5ff" } as const;

const valueOf = (control: PluginStateControl<number>) => "value" in control.state ? control.state.value : null;

/** Every sound control, and the sound itself once the plugin has reported all fourteen values. */
function useSound() {
    const controls = {
        b1FreqHz: usePluginState(definition.b1FreqHz),
        b1Q: usePluginState(definition.b1Q),
        b1Mode: usePluginState(definition.b1Mode),
        b1MidAmount: usePluginState(definition.b1MidAmount),
        b1SideAmount: usePluginState(definition.b1SideAmount),
        b1Curve: usePluginState(definition.b1Curve),
        b2FreqHz: usePluginState(definition.b2FreqHz),
        b2Q: usePluginState(definition.b2Q),
        b2Mode: usePluginState(definition.b2Mode),
        b2MidAmount: usePluginState(definition.b2MidAmount),
        b2SideAmount: usePluginState(definition.b2SideAmount),
        b2Curve: usePluginState(definition.b2Curve),
        saturationMode: usePluginState(definition.saturationMode),
        deEmphasis: usePluginState(definition.deEmphasis),
    };
    type Key = keyof typeof controls;
    const entries = Object.entries(controls).map(([key, control]) => [key, valueOf(control)] as const);
    const sound = entries.every((entry): entry is readonly [string, number] => entry[1] !== null)
        // SAFETY: the entries were built from every key of `controls` above.
        ? Object.fromEntries(entries) as { readonly [K in Key]: number }
        : null;
    return { controls, sound };
}

/**
 * A slider for one parameter. A drag is one gesture, so it is one Undo entry;
 * a double-click restores the parameter's default.
 */
function SliderControl({ scale, endpointID, control, value, label, role }: {
    readonly scale: SliderScale; readonly endpointID: string; readonly control: PluginStateControl<number>; readonly value: number;
    readonly label?: string; readonly role?: "primary-control" | "side-control";
}) {
    const finishDrag = useRef<(() => void) | null>(null);
    useEffect(() => () => finishDrag.current?.(), []);
    const startDrag = () => {
        if (finishDrag.current) return;
        void control.beginGesture();
        const finish = () => {
            window.removeEventListener("pointerup", finish);
            window.removeEventListener("pointercancel", finish);
            finishDrag.current = null;
            void control.endGesture();
        };
        window.addEventListener("pointerup", finish);
        window.addEventListener("pointercancel", finish);
        finishDrag.current = finish;
    };
    const defaultValue = "metadata" in control.state ? control.state.metadata?.defaultValue : undefined;
    const shownLabel = label ?? scale.label;
    return <label className="control" data-endpoint-id={endpointID} data-role={role}>
        <span className="control-heading">
            <span data-role={role === "primary-control" ? "primary-label" : undefined}>{shownLabel}</span>
            <output>{scale.format(value)}</output>
        </span>
        <input type="range" min={scale.logarithmic ? 0 : scale.min} max={scale.logarithmic ? 1 : scale.max} step={scale.step}
            aria-label={scale.label} aria-valuetext={scale.format(value)} value={toSliderPosition(scale, value)}
            onPointerDown={startDrag}
            onChange={event => { void control.setValue(fromSliderPosition(scale, Number(event.currentTarget.value))); }}
            onDoubleClick={() => { if (defaultValue !== undefined) void control.setValue(defaultValue); }} />
        {control.error && <p className="control-error" role="alert">{control.error.message}</p>}
    </label>;
}

/** A pair of buttons choosing between a two-way parameter's values 0 and 1. */
function Segmented({ label, className, control, value, options, attribute }: {
    readonly label: string; readonly className?: string; readonly control: PluginStateControl<number>; readonly value: number;
    readonly options: readonly [{ readonly id: string; readonly text: string }, { readonly id: string; readonly text: string }];
    readonly attribute: "data-mode" | "data-curve" | "data-saturation-mode";
}) {
    const selected = value >= 0.5 ? 1 : 0;
    return <div className={className ? `segmented ${className}` : "segmented"} aria-label={label}>
        {options.map((option, index) => <button key={option.id} type="button" {...{ [attribute]: option.id }} aria-pressed={selected === index}
            onClick={() => { if (selected !== index) void control.setValue(index); }}>{option.text}</button>)}
    </div>;
}

type Sound = NonNullable<ReturnType<typeof useSound>["sound"]>;
type Controls = ReturnType<typeof useSound>["controls"];

function bandKeys(number: 1 | 2) {
    return number === 1
        ? { frequency: "b1FreqHz", q: "b1Q", mode: "b1Mode", mid: "b1MidAmount", side: "b1SideAmount", curve: "b1Curve" } as const
        : { frequency: "b2FreqHz", q: "b2Q", mode: "b2Mode", mid: "b2MidAmount", side: "b2SideAmount", curve: "b2Curve" } as const;
}

function Band({ number, sound, controls }: { readonly number: 1 | 2; readonly sound: Sound; readonly controls: Controls }) {
    const keys = bandKeys(number);
    const midSide = sound[keys.mode] >= 0.5;
    const slider = (key: typeof keys[keyof typeof keys], scale: SliderScale, label?: string, role?: "primary-control" | "side-control") =>
        <SliderControl scale={scale} endpointID={definition[key].endpoint} control={controls[key]} value={sound[key]} label={label} role={role} />;
    return <section className="band" data-band={number} style={{ "--band-accent": bandAccents[number] } as CSSProperties}>
        <header className="band-header">
            <div>
                <span className="eyebrow">Band {number}</span>
                <p data-role="routing-description">{midSide ? "Mid and Side are driven independently" : "Left and right share one linked drive"}</p>
            </div>
            <Segmented label={`Band ${number} routing mode`} control={controls[keys.mode]} value={sound[keys.mode]} attribute="data-mode"
                options={[{ id: "stereo", text: "Stereo" }, { id: "mid-side", text: "M/S" }]} />
        </header>
        <div className="control-grid">
            {slider(keys.frequency, frequencyScale)}
            {slider(keys.q, qScale)}
            {slider(keys.mid, amountScale, midSide ? "Mid" : "Amount", "primary-control")}
            {midSide && slider(keys.side, sideScale, undefined, "side-control")}
        </div>
        <footer className="band-footer">
            <span>Character</span>
            <Segmented label={`Band ${number} character`} className="character" control={controls[keys.curve]} value={sound[keys.curve]}
                attribute="data-curve" options={[{ id: "tube", text: "Tube" }, { id: "solid", text: "Solid" }]} />
        </footer>
    </section>;
}

function View() {
    const history = usePluginHistory();
    const { controls, sound } = useSound();
    const unavailable = Object.values(controls).find(control => control.state.status === "invalid" || control.state.status === "unavailable");
    return <>
        <header className="plugin-header">
            <PresetBar definition={definition} />
            <SnapshotBar definition={definition} />
            <nav aria-label="Edit history" className="history-controls">
                <button type="button" disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
                <button type="button" disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
            </nav>
        </header>
        {sound === null
            ? <p className="status" role={unavailable ? "alert" : "status"}>{unavailable ? unavailable.error?.message ?? "Controls unavailable" : "Connecting"}</p>
            : <main className="shell">
                <header className="topline">
                    <div>
                        <h1>Enhancer</h1>
                        <p className="subtitle">Two parametric harmonic bands. Each band routes in linked Stereo or independent Mid/Side.</p>
                    </div>
                    <div className="top-controls">
                        <div className="badges" aria-label="Fixed processing">
                            <span className="badge">4× oversampling</span>
                            <span className="badge">Dry + shaped bands</span>
                        </div>
                        <div className="global-controls">
                            <div className="saturation-mode-panel">
                                <span>Saturation mode</span>
                                <Segmented label="Saturation mode" control={controls.saturationMode} value={sound.saturationMode}
                                    attribute="data-saturation-mode" options={[{ id: "subtle", text: "Subtle" }, { id: "medium", text: "Medium" }]} />
                            </div>
                            <div className="de-emphasis-panel">
                                <SliderControl scale={deEmphasisScale} endpointID={definition.deEmphasis.endpoint}
                                    control={controls.deEmphasis} value={sound.deEmphasis} />
                                <p>0% keeps the shaped bell · 100% subtracts the unprocessed bell</p>
                            </div>
                        </div>
                    </div>
                </header>
                <ResponsePlot bands={([1, 2] as const).map(number => {
                    const keys = bandKeys(number);
                    return { number, accent: bandAccents[number], frequency: sound[keys.frequency], q: sound[keys.q],
                        primary: sound[keys.mid], side: sound[keys.side], midSide: sound[keys.mode] >= 0.5 };
                })} />
                <div className="bands">
                    <Band number={1} sound={sound} controls={controls} />
                    <Band number={2} sound={sound} controls={controls} />
                </div>
                <p className="footnote">Stereo uses the Amount control for both channels. M/S relabels it Mid and reveals a separately saved Side amount. De-emphasis changes only the bell subtraction. Double-click a slider to reset it.</p>
            </main>}
    </>;
}

export default createStatefulPatchView({ definition, View, css });
