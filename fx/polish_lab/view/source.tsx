// Curve Lab's editor. Edit it live with `npm run fx:dev`; `npm run fx:build -- polish` bundles it.
import { useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type SyntheticEvent } from "react";
import { createStatefulPatchView, PresetBar, SnapshotBar, usePatchConnection, usePluginHistory, usePluginState,
    type PluginStateControl, type PluginStateEditor } from "../../../kit/index";
import { StockControl, stockControlsOf, useVisibleParameters } from "../../../ui/shared/stock-controls-view";
import definition from "../state";
import { CONTROL_HELP } from "./control-help";
import css from "./curve-lab.css?inline";
import { SHAPER_RESET_VALUES, type CurveLabValues } from "./curve-model";
import { createPolishGraphStudio, type CurveLabSound, type MeterFrame } from "./graph-studio";

type Definition = typeof definition;
type ParameterKey = { [Key in keyof Definition]: Definition[Key] extends { readonly kind: "parameter" } ? Key : never }[keyof Definition];
type Controls = { readonly [Key in ParameterKey]: PluginStateControl<number> };
type Changes = { -readonly [Key in ParameterKey]?: number };

function isParameterKey(key: string): key is ParameterKey {
    return Object.hasOwn(definition, key) && definition[key as keyof Definition].kind === "parameter";
}

/** Every plugin parameter, in declaration order; the graphs address them by endpoint. */
const parameterKeys: readonly ParameterKey[] = Object.keys(definition).filter(isParameterKey);

const COMPRESSOR_KNOBS = ["thresholdDb", "ratio", "kneeDb", "attackMs", "releaseMs", "makeupDb"] as const;

/** Processed listening, a neutral 4:1 compressor with a 6 dB knee, and the neutral waveshaper. */
const RESET_VALUES: CurveLabValues = Object.freeze({
    bypass: 0,
    thresholdDb: 0,
    ratio: 4,
    kneeDb: 6,
    attackMs: 10,
    releaseMs: 120,
    makeupDb: 0,
    ...SHAPER_RESET_VALUES,
});

/** The help text each knob shows; one stable object per knob, so the control is created once. */
const KNOB_HELP_ATTRIBUTES: { readonly [endpointID: string]: Readonly<Record<string, string>> } = Object.freeze(Object.fromEntries(
    Object.entries(CONTROL_HELP).map(([endpointID, help]) => [endpointID, Object.freeze({ "data-control-help": help, "aria-description": help, title: help })]),
));

function parameterChanges(changes: { readonly [endpointID: string]: number | undefined }): Changes {
    const known: Changes = {};
    for (const [endpointID, value] of Object.entries(changes)) {
        if (!isParameterKey(endpointID)) throw new Error(`Curve Lab has no parameter named ${endpointID}.`);
        if (value !== undefined) known[endpointID] = value;
    }
    return known;
}

function parameterKey(endpointID: string): ParameterKey {
    if (!isParameterKey(endpointID)) throw new Error(`Curve Lab has no parameter named ${endpointID}.`);
    return endpointID;
}

function meterFrameOf(value: unknown): MeterFrame {
    if (typeof value !== "object" || value === null) return {};
    const read = (key: string) => {
        const field: unknown = Reflect.get(value, key);
        return typeof field === "number" ? field : undefined;
    };
    return {
        compressorInputDb: read("compressorInputDb"),
        compressorOutputDb: read("compressorOutputDb"),
        gainReductionDb: read("gainReductionDb"),
        clipInput: read("clipInput"),
        clipOutput: read("clipOutput"),
    };
}

/** Every parameter control, and every value once the plugin has reported them all. */
function useParameters(): { readonly controls: Controls; readonly values: CurveLabValues | null } {
    const collected: Partial<Record<ParameterKey, PluginStateControl<number>>> = {};
    // One hook per parameter, always in the same order: the definition fixes the list.
    for (const key of parameterKeys) collected[key] = usePluginState(definition[key]);
    // SAFETY: the loop above filled a control for every parameter key.
    const controls = collected as Controls;
    const values: { [endpointID: string]: number } = {};
    for (const key of parameterKeys) {
        const { state } = controls[key];
        if ("value" in state) values[key] = state.value;
    }
    // The same object while no value changes, so the graphs redraw only when the sound does.
    const previous = useRef<CurveLabValues | null>(null);
    const complete = parameterKeys.every(key => key in values);
    if (!complete) previous.current = null;
    else if (!previous.current || parameterKeys.some(key => previous.current?.[key] !== values[key])) previous.current = values;
    return { controls, values: previous.current };
}

/** A hover or focus tooltip for any element carrying `data-control-help`. */
function useHelpTooltip() {
    const [help, setHelp] = useState<{ readonly text: string; readonly left: number; readonly top: number } | null>(null);
    const helpElementOf = (event: SyntheticEvent) => event.nativeEvent.composedPath()
        .find((target): target is HTMLElement | SVGElement => (target instanceof HTMLElement || target instanceof SVGElement)
            && target.dataset.controlHelp !== undefined) ?? null;
    const placed = (text: string, x: number, y: number) => ({
        text,
        left: Math.max(8, Math.min(window.innerWidth - 298, x + 14)),
        top: Math.max(8, Math.min(window.innerHeight - 74, y + 14)),
    });
    const show = (event: PointerEvent | FocusEvent) => {
        const element = helpElementOf(event);
        const text = element?.dataset.controlHelp;
        if (!element || text === undefined) return;
        if ("clientX" in event) setHelp(placed(text, event.clientX, event.clientY));
        else {
            const bounds = element.getBoundingClientRect();
            setHelp(placed(text, bounds.right, bounds.top));
        }
    };
    const handlers = {
        onPointerOver: show,
        onFocus: show,
        onPointerMove: (event: PointerEvent) => setHelp(current => current && placed(current.text, event.clientX, event.clientY)),
        onPointerOut: (event: PointerEvent) => {
            const current = helpElementOf(event);
            const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest("[data-control-help]") : null;
            if (current && next !== current) setHelp(null);
        },
        onBlur: () => setHelp(null),
    };
    const tooltip = <div className="tooltip" data-tooltip="" data-visible={help ? "true" : "false"} role="tooltip"
        style={help ? { left: help.left, top: help.top } : undefined}>{help?.text}</div>;
    return { handlers, tooltip };
}

/**
 * The compressor and waveshaper graphs. The graph studio draws them and turns
 * drags, point buttons and typed values into edits through `sound`.
 */
function CurveLab({ values, controls, editor }: {
    readonly values: CurveLabValues; readonly controls: Controls; readonly editor: PluginStateEditor<Definition>;
}) {
    const connection = usePatchConnection();
    const stockControls = stockControlsOf(connection);
    const parameters = useVisibleParameters();
    const surface = useRef<HTMLElement>(null);
    const latest = useRef({ values, controls, editor });
    const studio = useRef<ReturnType<typeof createPolishGraphStudio> | null>(null);
    const { handlers, tooltip } = useHelpTooltip();

    useLayoutEffect(() => { latest.current = { values, controls, editor }; });
    useLayoutEffect(() => {
        if (!surface.current) return;
        const sound: CurveLabSound = {
            values: () => latest.current.values,
            edit: changes => { void latest.current.editor.edit(parameterChanges(changes)); },
            beginGesture: endpointIDs => { void latest.current.editor.beginGesture(endpointIDs.map(parameterKey)); },
            set: (endpointID, value) => { void latest.current.controls[parameterKey(endpointID)].setValue(value); },
            endGesture: () => { void latest.current.editor.endGesture(); },
        };
        const graphs = createPolishGraphStudio({ root: surface.current, sound });
        const onMeter = (frame: unknown) => graphs.pushTelemetry(meterFrameOf(frame));
        connection.addEndpointListener?.("meterOut", onMeter);
        studio.current = graphs;
        return () => {
            connection.removeEndpointListener?.("meterOut", onMeter);
            graphs.destroy();
            studio.current = null;
        };
    }, [connection]);
    useLayoutEffect(() => { studio.current?.render(); }, [values]);

    const knobs = (endpointIDs: readonly ParameterKey[]) => {
        if (!stockControls) return <p className="control-error" role="alert">This host does not provide Cmajor's parameter controls.</p>;
        return (parameters ?? []).filter(endpoint => (endpointIDs as readonly string[]).includes(endpoint.endpointID)).map(endpoint => {
            const key = parameterKey(endpoint.endpointID);
            return <StockControl key={key} controls={stockControls} field={definition[key]} endpoint={endpoint} attributes={KNOB_HELP_ATTRIBUTES[key]} />;
        });
    };
    const bypassed = (values.bypass ?? 0) >= 0.5;

    return <main className="shell" ref={surface} {...handlers}>
        {stockControls && <style>{stockControls.getAllCSS()}</style>}
        <header className="topbar">
            <h1>Curve Lab</h1>
            <div className="actions">
                <button type="button" data-compare="" data-active={String(bypassed)} data-control-help="Toggle between dry input and processed output."
                    onClick={() => { void controls.bypass.setValue(bypassed ? 0 : 1); }}>{bypassed ? "Processed" : "Dry"}</button>
                <button type="button" data-reset="" data-control-help="Restore the neutral compressor and one ceiling per side."
                    onClick={() => { void editor.edit(parameterChanges(RESET_VALUES)); }}>Reset</button>
            </div>
        </header>

        <section className="panel">
            <div className="panel-header"><h2>Compressor</h2><span className="summary" data-compressor-summary="" /></div>
            <svg className="compressor-graph" viewBox="0 0 800 280" role="img" aria-label="Compressor input to output curve"
                data-transfer-graph="compressor" data-input-min="-48" data-input-max="12" data-output-min="-48" data-output-max="12"
                data-plot-left="54" data-plot-right="746" data-plot-top="18" data-plot-bottom="262">
                <rect className="plot-border" x="54" y="18" width="692" height="244" />
                <path className="unity-line" d="M54 262L746 18" />
                <path className="transfer-curve" data-compressor-curve="" />
                <circle className="operating-point" data-compressor-operating-point="" data-active="false" r="7" />
                <path className="graph-handle-connector" data-knee-connector="" />
                <CompressorHandle name="threshold" label="Threshold" letter="T" help="Threshold: drag horizontally." />
                <CompressorHandle name="ratio" label="Ratio" letter="R" help="Ratio: drag vertically." />
                <CompressorHandle name="knee" label="Knee" letter="K" help="Knee width: drag horizontally." />
                <CompressorHandle name="makeup" label="Makeup" letter="M" help="Makeup gain: drag vertically." />
                <g className="gesture-readout" data-compressor-readout="" data-visible="false" transform="translate(64 30)">
                    <rect x="0" y="0" width="220" height="34" rx="7" /><text x="10" y="22" data-compressor-readout-text="" />
                </g>
            </svg>
            <div className="gr-strip"><span>Gain reduction</span><svg viewBox="0 0 692 60"><path className="gr-trace" data-gain-reduction-trace="" data-sample-count="0" /></svg></div>
            <div className="controls-row" data-compressor-controls="">{knobs(COMPRESSOR_KNOBS)}</div>
        </section>

        <section className="panel">
            <div className="panel-header"><h2>Waveshaper</h2></div>
            <svg className="shaper-graph" viewBox="0 0 800 430" role="img" aria-label="Editable bipolar input to output transfer curve"
                data-transfer-graph="shaper" data-input-min="-1.5" data-input-max="1.5" data-output-min="-1.5" data-output-max="1.5"
                data-plot-left="44" data-plot-right="756" data-plot-top="18" data-plot-bottom="402">
                <rect className="plot-border" x="44" y="18" width="712" height="384" />
                <path className="zero-axis" d="M400 18V402 M44 210H756" />
                <path className="unity-line" data-unity-line="" d="M44 402L756 18" />
                <path className="transfer-curve" data-shaper-curve="" />
                <g data-shape-segments="" />
                <g data-shape-points="" />
                <g data-morph-visuals="" />
                <circle className="operating-point" data-shaper-operating-point="" data-active="false" r="8" />
                <g className="gesture-readout" data-shaper-readout="" data-visible="false" transform="translate(54 28)">
                    <rect x="0" y="0" width="286" height="34" rx="7" /><text x="10" y="22" data-shaper-readout-text="" />
                </g>
                <text className="axis-label" data-shaper-axis-label="" data-axis="x" x="162.7" y="422" textAnchor="middle">−1</text>
                <text className="axis-label" data-shaper-axis-label="" data-axis="x" x="400" y="422" textAnchor="middle">0</text>
                <text className="axis-label" data-shaper-axis-label="" data-axis="x" x="637.3" y="422" textAnchor="middle">+1</text>
                <text className="axis-label" data-shaper-axis-label="" data-axis="y" x="38" y="342" textAnchor="end">−1</text>
                <text className="axis-label" data-shaper-axis-label="" data-axis="y" x="38" y="214" textAnchor="end">0</text>
                <text className="axis-label" data-shaper-axis-label="" data-axis="y" x="38" y="86" textAnchor="end">+1</text>
            </svg>
            <div className="shaper-footer">
                <div className="shape-workbench">
                    <div className="shape-tools">
                        <span className="shape-selection" data-shape-selection="" />
                        <button className="tool-button" type="button" data-shape-add="" data-control-help="Insert a point halfway along the selected segment.">Add point</button>
                        <button className="tool-button" type="button" data-shape-delete="" data-control-help="Remove the selected point." disabled>Delete point</button>
                        <span className="morph-owner" data-morph-owner="" />
                        <button className="tool-button" type="button" data-morph-assign="" data-control-help="Make the selected point Morph position A; then drag B to set its destination.">Use selected as A</button>
                    </div>
                    <div className="shape-inspector" data-shape-inspector="">
                        <span className="shape-inspector-label" data-shape-inspector-label="" />
                        <label className="shape-exact-field" data-shape-exact-wrap="input">In
                            <input type="number" step="0.000001" data-shape-exact-field="input" aria-label="Selected point input" />
                        </label>
                        <label className="shape-exact-field" data-shape-exact-wrap="output">Out
                            <input type="number" step="0.000001" min="-1.5" max="1.5" data-shape-exact-field="output" aria-label="Selected point output" />
                        </label>
                        <label className="shape-exact-field" data-shape-exact-wrap="bend" hidden>Bend
                            <input type="number" step="0.000001" min="-1" max="1" data-shape-exact-field="bend" aria-label="Selected segment bend" />
                        </label>
                    </div>
                </div>
                <div className="controls-row" data-morph-controls="">{knobs(["morph"])}</div>
            </div>
        </section>
        {tooltip}
    </main>;
}

/** A touch-sized compressor graph handle; the graph studio positions it and handles its drags. */
function CompressorHandle({ name, label, letter, help }: { readonly name: string; readonly label: string; readonly letter: string; readonly help: string }) {
    return <g data-graph-handle={name} data-control-help={help} role="slider" aria-label={label}>
        <circle className="graph-handle-hit" r="25" /><circle className="graph-handle" r="11" /><text className="graph-handle-label" y=".5">{letter}</text>
    </g>;
}

function View() {
    const history = usePluginHistory();
    const editor = usePluginState(definition);
    const { controls, values } = useParameters();
    const unavailable = Object.values<PluginStateControl<number>>(controls)
        .find(control => control.state.status === "invalid" || control.state.status === "unavailable");
    return <>
        <header className="plugin-header">
            <PresetBar definition={definition} />
            <SnapshotBar definition={definition} />
            <nav aria-label="Edit history" className="history-controls">
                <button type="button" disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
                <button type="button" disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
            </nav>
        </header>
        {values === null
            ? <p className="status" role={unavailable ? "alert" : "status"}>{unavailable ? unavailable.error?.message ?? "Controls unavailable" : "Connecting"}</p>
            : <CurveLab values={values} controls={controls} editor={editor} />}
    </>;
}

export default createStatefulPatchView({ definition, View, css });
