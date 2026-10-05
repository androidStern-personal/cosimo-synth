import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    createStatefulPatchView, PresetBar, SnapshotBar, usePatchConnection, usePluginHistory, usePluginState,
    type PatchConnectionLike, type PluginStateControl,
} from "../../kit/index";

type Definition = Parameters<typeof createStatefulPatchView>[0]["definition"];
type ParameterField = Extract<Definition[string], { readonly kind: "parameter" }>;

/** One parameter input as the host reports it in its status. */
interface EndpointInfo {
    readonly endpointID: string;
    readonly annotation?: { readonly name?: string; readonly group?: string; readonly hidden?: boolean };
}

/** The connection a Cmajor stock control reads and writes its parameter through. */
interface StockControlConnection {
    sendEventOrValue(endpointID: string, value: unknown): void;
    sendParameterGestureStart(endpointID: string): void;
    sendParameterGestureEnd(endpointID: string): void;
    addParameterListener(endpointID: string, listener: (value: number) => void): void;
    removeParameterListener(endpointID: string, listener: (value: number) => void): void;
    requestParameterValue(endpointID: string): void;
}

/** Cmajor's stock knob, switch and option controls, from the host's patch-view utilities. */
export interface StockControls {
    createLabelledControl(connection: StockControlConnection, endpoint: EndpointInfo): HTMLElement | undefined;
    getAllCSS(): string;
}

export function stockControlsOf(connection: PatchConnectionLike): StockControls | null {
    const controls: unknown = connection.utilities?.ParameterControls;
    if (typeof controls !== "object" || controls === null) return null;
    if (!("createLabelledControl" in controls) || typeof controls.createLabelledControl !== "function") return null;
    if (!("getAllCSS" in controls) || typeof controls.getAllCSS !== "function") return null;
    // SAFETY: both members Cmajor's ParameterControls module provides were checked above.
    return controls as StockControls;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The visible parameter inputs in a host status, in the order the patch declares them. */
function visibleParameters(status: unknown): EndpointInfo[] {
    const inputs = isRecord(status) && isRecord(status.details) && Array.isArray(status.details.inputs) ? status.details.inputs : [];
    return inputs.filter((input): input is EndpointInfo => isRecord(input) && input.purpose === "parameter"
        && typeof input.endpointID === "string" && !(isRecord(input.annotation) && input.annotation.hidden === true));
}

/**
 * One stock Cmajor control whose value comes from, and whose edits go to, a
 * plugin state field. Its drags are gestures on that field, so each one is a
 * single Undo entry.
 */
function StockControl({ controls, field, endpoint }: { controls: StockControls; field: ParameterField; endpoint: EndpointInfo }) {
    const control = usePluginState(field);
    const latest = useRef<PluginStateControl<number>>(control);
    const [listeners] = useState(() => new Set<(value: number) => void>());
    const holder = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => { latest.current = control; });

    useLayoutEffect(() => {
        const notifyCurrentValue = () => {
            const { state } = latest.current;
            if ("value" in state) for (const listener of listeners) listener(state.value);
        };
        const connection: StockControlConnection = {
            sendEventOrValue: (_endpointID, value) => { void latest.current.setValue(Number(value)); },
            sendParameterGestureStart: () => { void latest.current.beginGesture(); },
            sendParameterGestureEnd: () => { void latest.current.endGesture(); },
            addParameterListener: (_endpointID, listener) => { listeners.add(listener); },
            removeParameterListener: (_endpointID, listener) => { listeners.delete(listener); },
            requestParameterValue: notifyCurrentValue,
        };
        const element = controls.createLabelledControl(connection, endpoint);
        if (!element || !holder.current) return;
        holder.current.replaceChildren(element);
        return () => element.remove();
    }, [controls, endpoint, listeners]);

    const value = "value" in control.state ? control.state.value : undefined;
    useLayoutEffect(() => {
        if (value !== undefined) for (const listener of listeners) listener(value);
    }, [value, listeners]);

    return <>
        <div ref={holder} className="stock-control" />
        {control.error && <p className="control-error" role="alert">{endpoint.annotation?.name ?? endpoint.endpointID}: {control.error.message}</p>}
    </>;
}

/** Group the patch's controls under their annotated group names, in declaration order. */
export function ControlGroups({ controls, definition }: { controls: StockControls; definition: Definition }) {
    const connection = usePatchConnection();
    const [parameters, setParameters] = useState<readonly EndpointInfo[] | null>(null);

    useEffect(() => {
        const listener = (status: unknown) => {
            const next = visibleParameters(status);
            setParameters(previous => previous !== null && JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
        };
        connection.addStatusListener?.(listener);
        connection.requestStatusUpdate?.();
        return () => connection.removeStatusListener?.(listener);
    }, [connection]);

    if (parameters === null) return <section className="empty" role="status">Connecting</section>;
    const fields = new Map<string, ParameterField>();
    for (const field of Object.values(definition)) if (field.kind === "parameter") fields.set(field.endpoint, field);
    const groups = new Map<string, { endpoint: EndpointInfo; field: ParameterField }[]>();
    for (const endpoint of parameters) {
        const field = fields.get(endpoint.endpointID);
        if (!field) continue;
        const group = endpoint.annotation?.group || "General";
        groups.set(group, [...groups.get(group) ?? [], { endpoint, field }]);
    }
    if (groups.size === 0) return <section className="empty">No patch parameters were exposed.</section>;

    return <>{[...groups].map(([group, members]) => <section key={group} className="group">
        <header className="group-header"><h2>{group}</h2></header>
        <div className="controls">
            {members.map(({ endpoint, field }) => <StockControl key={endpoint.endpointID} controls={controls} field={field} endpoint={endpoint} />)}
        </div>
    </section>)}</>;
}

const frameCss = `
    :host {
        --knob-track-background-color: rgba(255, 255, 255, 0.14);
        --knob-track-value-color: var(--accent);
        --knob-dial-border-color: rgba(255, 255, 255, 0.88);
        --knob-dial-background-color: rgba(255, 255, 255, 0.05);
        --knob-dial-tick-color: var(--foreground);
        --switch-outline-color: rgba(255, 255, 255, 0.82);
        --switch-thumb-color: var(--accent);
        --switch-on-background-color: rgba(255, 255, 255, 0.04);
        --switch-off-background-color: rgba(255, 255, 255, 0.04);
        display: block;
        width: 920px;
        color: var(--foreground);
        font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
    .plugin-header {
        --editor-accent-start: var(--accent); --editor-surface-bg: var(--background);
        height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 0 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .plugin-header .bk-preset-bar, .plugin-header .bk-snapshot-bar { font-size: 10px; }
    .plugin-header .bk-preset-bar select { width: 140px; }
    .history-controls { display: flex; gap: 6px; }
    .history-controls button {
        height: 24px; padding: 0 10px; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 4px;
        color: var(--accent); background: transparent; font: inherit; font-size: 9px; letter-spacing: 0.06em;
        text-transform: uppercase; cursor: pointer;
    }
    .history-controls button:disabled { color: var(--muted-text); opacity: 0.5; cursor: default; }
    .history-controls button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .frame {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
        width: 100%;
        padding: 18px;
    }
    .title, .group, .empty {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.04);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(16px);
    }
    .title { display: flex; flex-direction: column; gap: 6px; padding: 18px; grid-column: 1 / -1; }
    .title h1, .title p, .group h2 { margin: 0; }
    .title h1 { font-size: 22px; letter-spacing: 0.06em; text-transform: uppercase; }
    .title p { color: var(--muted-text); font-size: 12px; line-height: 1.5; }
    .group { padding: 16px; }
    .group-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    h2 { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--heading-text); }
    .controls { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; }
    .stock-control { display: contents; }
    .controls .labelled-control { margin: 0; }
    .controls .labelled-control-centered-control { width: 6rem; height: 5.3rem; }
    .controls .labelled-control-label-container { max-width: 6rem; font-size: 11px; }
    .controls .labelled-control-name, .controls .labelled-control-value { letter-spacing: 0.04em; }
    .control-error { flex-basis: 100%; margin: 0; color: #ff8a7a; font-size: 11px; }
    .empty { grid-column: 1 / -1; padding: 18px; color: var(--heading-text); }
`;

/**
 * A lab view built from the patch's own parameter list with Cmajor's stock
 * controls, under the kit's preset, snapshot and Undo header. Every control
 * edits the plugin state, so a knob turn, a preset recall and a snapshot
 * switch share one Undo history.
 *
 * `css` supplies the palette as custom properties on `:host`: `--foreground`,
 * `--background`, `--accent`, `--muted-text` and `--heading-text`, plus the
 * host's background and any layout differences.
 */
export function createStockControlsView(options: {
    readonly definition: Definition;
    readonly title: string;
    readonly description: string;
    readonly css: string;
}) {
    const { definition, title, description } = options;

    function View() {
        const connection = usePatchConnection();
        const history = usePluginHistory();
        const controls = stockControlsOf(connection);
        return <>
            <header className="plugin-header">
                <PresetBar definition={definition} />
                <SnapshotBar definition={definition} />
                <nav aria-label="Edit history" className="history-controls">
                    <button type="button" disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
                    <button type="button" disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
                </nav>
            </header>
            {controls && <style>{controls.getAllCSS()}</style>}
            <div className="frame">
                <section className="title">
                    <h1>{title}</h1>
                    <p>{description}</p>
                </section>
                {controls
                    ? <ControlGroups controls={controls} definition={definition} />
                    : <section className="empty" role="alert">This host does not provide Cmajor's parameter controls.</section>}
            </div>
        </>;
    }

    return createStatefulPatchView({ definition, View, css: frameCss + options.css });
}
