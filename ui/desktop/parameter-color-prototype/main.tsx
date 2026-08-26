import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import {
    RackParameterKnob,
    type RackParameterHud,
} from "../rack-parameter-knob";
import type { ModulationRoute } from "../../shared/modulation";
import type { PatchControlBinding } from "../../shared/patch-controls";
import {
    getRackParameterDescriptor,
    type RackParameterDescriptor,
} from "../../shared/rack-parameter-descriptors";
import type { RackRouteEffectiveness } from "../../shared/rack-route-presentation";

import "../rack-parameter-knob.css";
import "./styles.css";

// PROTOTYPE: Three views of the proposed parameter color-state contract, switchable via ?variant=.

const EFFECT_ACCENTS = {
    filter: "#c6db3f",
    drive: "#ff6a27",
    chorus: "#38d9d5",
    phaser: "#df74cf",
    delay: "#55d9ff",
    reverb: "#e1b456",
    voice: "#69d5c5",
} as const;

const SOURCE_ACCENTS = {
    mseg: "#cc59d2",
    envelope: "#b8e236",
    macro: "#ff6428",
} as const;

type RouteMode = "none" | "unmapped" | "zero" | "mapped" | "bypassed";
type Treatment =
    | "default"
    | "selected"
    | "base-edit"
    | "route-count"
    | "eligible"
    | "captured"
    | "pending"
    | "success"
    | "duplicate"
    | "invalid";

type BoardState = {
    readonly id: string;
    readonly title: string;
    readonly note: string;
    readonly ownerAccent: string;
    readonly sourceAccent: string;
    readonly routeMode: RouteMode;
    readonly effectiveness?: RackRouteEffectiveness;
    readonly treatment?: Treatment;
    readonly badge?: string;
    readonly result?: string;
};

type KnobStyle = CSSProperties & {
    readonly "--owner-accent": string;
    readonly "--source-accent": string;
};

function requireBoardDescriptor(): RackParameterDescriptor {
    const candidate = getRackParameterDescriptor("reverbSize");
    if (candidate === null) {
        throw new Error("The parameter color prototype requires the production reverbSize descriptor.");
    }
    return candidate;
}

const descriptor = requireBoardDescriptor();

const noOp = () => {};
const noHud = (_hud: RackParameterHud | null) => {};
const noContextMenu = (_clientX: number, _clientY: number) => {};

function createStaticBinding(parameter: RackParameterDescriptor, value: number): PatchControlBinding<number> {
    return {
        endpointID: parameter.endpointID,
        value,
        isReady: true,
        setValue: noOp,
        commitValue: noOp,
        beginGesture: noOp,
        endGesture: noOp,
    };
}

function createRoute(mode: RouteMode): ModulationRoute | null {
    if (mode === "none" || mode === "unmapped") {
        return null;
    }

    return {
        id: `prototype-${mode}`,
        enabled: mode !== "bypassed",
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "lane.reverb#1.reverbSize",
        amount: mode === "zero" ? 0 : 0.38,
        reducer: "max",
    };
}

function RealKnobPreview({ state, compact = false }: { readonly state: BoardState; readonly compact?: boolean }) {
    const route = createRoute(state.routeMode);
    const sourceIsSelected = state.routeMode !== "none";
    const style: KnobStyle = {
        "--owner-accent": state.ownerAccent,
        "--source-accent": state.sourceAccent,
    };

    return (
        <div
            className={`knob-state-surface state-${state.treatment ?? "default"} route-${state.routeMode}${compact ? " is-compact" : ""}`}
            data-effectiveness={state.effectiveness ?? "active"}
            style={style}
        >
            {state.badge ? <span className="prototype-route-badge">{state.badge}</span> : null}
            {state.result ? <span className="prototype-result">{state.result}</span> : null}
            <RackParameterKnob
                descriptor={descriptor}
                binding={createStaticBinding(descriptor, 0.62)}
                route={route}
                sourceIsSelected={sourceIsSelected}
                sourceAccent={state.sourceAccent}
                effectiveness={state.effectiveness ?? "active"}
                dataRole={`prototype-knob-${state.id}`}
                trackDataRole={`prototype-track-${state.id}`}
                handleDataRole={`prototype-handle-${state.id}`}
                onSelect={noOp}
                onModulationAmountChange={noOp}
                onRequestContextMenu={noContextMenu}
            />
        </div>
    );
}

const baseStates: ReadonlyArray<BoardState> = [
    {
        id: "active-default",
        title: "Active · default",
        note: "Reverb Size is active, so the knob is gold even when you are not touching it.",
        ownerAccent: EFFECT_ACCENTS.reverb,
        sourceAccent: SOURCE_ACCENTS.mseg,
        routeMode: "none",
    },
    {
        id: "selected",
        title: "Selected",
        note: "The gold border gets brighter to show that Size is the selected parameter.",
        ownerAccent: EFFECT_ACCENTS.reverb,
        sourceAccent: SOURCE_ACCENTS.mseg,
        routeMode: "none",
        treatment: "selected",
    },
    {
        id: "base-edit",
        title: "Changing Size",
        note: "A gold glow means this drag is changing Size itself.",
        ownerAccent: EFFECT_ACCENTS.reverb,
        sourceAccent: SOURCE_ACCENTS.mseg,
        routeMode: "none",
        treatment: "base-edit",
    },
];

const relationshipStates: ReadonlyArray<BoardState> = [
    {
        id: "armed-unmapped",
        title: "MSEG 1 selected · not mapped",
        note: "Purple dots mean MSEG 1 is selected, but it is not mapped to Size.",
        ownerAccent: EFFECT_ACCENTS.reverb,
        sourceAccent: SOURCE_ACCENTS.mseg,
        routeMode: "unmapped",
    },
    {
        id: "mapped-zero",
        title: "MSEG 1 mapped · amount 0%",
        note: "The purple dot shows that MSEG 1 is mapped to Size. There is no purple arc because the amount is 0%.",
        ownerAccent: EFFECT_ACCENTS.reverb,
        sourceAccent: SOURCE_ACCENTS.mseg,
        routeMode: "zero",
    },
    {
        id: "mapped-active",
        title: "MSEG 1 mapped · amount 38%",
        note: "The purple outer arc shows how far MSEG 1 can move Size.",
        ownerAccent: EFFECT_ACCENTS.reverb,
        sourceAccent: SOURCE_ACCENTS.mseg,
        routeMode: "mapped",
    },
    {
        id: "other-routes",
        title: "Three other mappings on Size",
        note: "The 3 badge counts all mappings on Size. The green dotted ring says the selected Envelope is not one of them.",
        ownerAccent: EFFECT_ACCENTS.reverb,
        sourceAccent: SOURCE_ACCENTS.envelope,
        routeMode: "unmapped",
        treatment: "route-count",
        badge: "3",
    },
];

const inactiveStates: ReadonlyArray<BoardState> = [
    {
        id: "route-bypassed",
        title: "MSEG 1 mapping turned off",
        note: "Size stays gold because Reverb is active. The outer ring turns grey because this mapping is bypassed.",
        ownerAccent: EFFECT_ACCENTS.reverb,
        sourceAccent: SOURCE_ACCENTS.mseg,
        routeMode: "bypassed",
    },
    {
        id: "effect-bypassed",
        title: "Reverb turned off",
        note: "The entire knob turns grey because Reverb is bypassed.",
        ownerAccent: EFFECT_ACCENTS.reverb,
        sourceAccent: SOURCE_ACCENTS.mseg,
        routeMode: "mapped",
        effectiveness: "effect-bypassed",
    },
    {
        id: "mode-suspended",
        title: "Size unavailable in this mode",
        note: "The knob turns grey and shows MODE because this parameter cannot affect sound in the current mode.",
        ownerAccent: EFFECT_ACCENTS.filter,
        sourceAccent: SOURCE_ACCENTS.envelope,
        routeMode: "mapped",
        effectiveness: "target-suspended",
        result: "MODE",
    },
    {
        id: "invalid",
        title: "Cannot accept this source",
        note: "The knob turns grey during dragging because this source cannot be dropped here.",
        ownerAccent: EFFECT_ACCENTS.chorus,
        sourceAccent: SOURCE_ACCENTS.macro,
        routeMode: "none",
        treatment: "invalid",
    },
];

const dragStates: ReadonlyArray<BoardState> = [
    {
        id: "eligible",
        title: "Can accept Envelope 1",
        note: "A thin green outline means releasing the source here would create a mapping.",
        ownerAccent: EFFECT_ACCENTS.delay,
        sourceAccent: SOURCE_ACCENTS.envelope,
        routeMode: "none",
        treatment: "eligible",
    },
    {
        id: "captured",
        title: "Envelope 1 will be dropped here",
        note: "The bright green outline means releasing now will map Envelope 1 to Size.",
        ownerAccent: EFFECT_ACCENTS.delay,
        sourceAccent: SOURCE_ACCENTS.envelope,
        routeMode: "none",
        treatment: "captured",
    },
    {
        id: "pending",
        title: "Waiting for the mapping to save",
        note: "The green border pulses while the app waits for confirmation.",
        ownerAccent: EFFECT_ACCENTS.delay,
        sourceAccent: SOURCE_ACCENTS.envelope,
        routeMode: "unmapped",
        treatment: "pending",
        result: "CREATING",
    },
    {
        id: "success",
        title: "Mapping created at 0%",
        note: "The green flash confirms success. The green dot remains to show the new 0% mapping.",
        ownerAccent: EFFECT_ACCENTS.delay,
        sourceAccent: SOURCE_ACCENTS.envelope,
        routeMode: "zero",
        treatment: "success",
        result: "✓ MAPPED",
    },
    {
        id: "duplicate",
        title: "Envelope 1 was already mapped",
        note: "The orange warning says no new mapping was created. The existing green mapping remains.",
        ownerAccent: EFFECT_ACCENTS.delay,
        sourceAccent: SOURCE_ACCENTS.envelope,
        routeMode: "mapped",
        treatment: "duplicate",
        result: "ALREADY MAPPED",
    },
];

function StateCard({ state }: { readonly state: BoardState }) {
    return (
        <article className="state-card">
            <RealKnobPreview state={state} />
            <div className="state-copy">
                <h3>{state.title}</h3>
                <p>{state.note}</p>
            </div>
        </article>
    );
}

function StateGroup({ title, eyebrow, states }: {
    readonly title: string;
    readonly eyebrow: string;
    readonly states: ReadonlyArray<BoardState>;
}) {
    return (
        <section className="matrix-group">
            <header>
                <span>{eyebrow}</span>
                <h2>{title}</h2>
            </header>
            <div className="state-grid">
                {states.map((state) => <StateCard key={state.id} state={state} />)}
            </div>
        </section>
    );
}

function BoardHeader({ variant, children }: { readonly variant: string; readonly children: ReactNode }) {
    return (
        <header className="board-header">
            <div>
                <span className="prototype-kicker">THROWAWAY COLOR DESIGN · {variant}</span>
                <h1>Active controls stay colored.<br />Modulation uses the outer ring.</h1>
            </div>
            <p>{children}</p>
        </header>
    );
}

function VariantA() {
    return (
        <div className="board board-matrix">
            <BoardHeader variant="STATE MATRIX">
                Every knob state is shown with the real production knob. Active controls stay colored;
                grey is used only when something is turned off or unavailable.
            </BoardHeader>
            <StateGroup eyebrow="01 · PARAMETER COLOR" title="Normal control states" states={baseStates} />
            <StateGroup eyebrow="02 · OUTER MODULATION RING" title="What the outside ring means" states={relationshipStates} />
            <StateGroup eyebrow="03 · GREY STATES" title="Only off or unavailable" states={inactiveStates} />
            <StateGroup eyebrow="04 · DRAG FEEDBACK" title="Creating a mapping" states={dragStates} />
        </div>
    );
}

const rackPanels = [
    {
        name: "REVERB",
        accent: EFFECT_ACCENTS.reverb,
        source: SOURCE_ACCENTS.mseg,
        sourceName: "MSEG 1",
        states: [baseStates[0], baseStates[1], relationshipStates[1], relationshipStates[2]],
    },
    {
        name: "FILTER",
        accent: EFFECT_ACCENTS.filter,
        source: SOURCE_ACCENTS.envelope,
        sourceName: "ENV 1",
        states: [relationshipStates[0], relationshipStates[3], inactiveStates[2], inactiveStates[1]],
    },
] as const;

function VariantB() {
    return (
        <div className="board board-rack">
            <BoardHeader variant="IN CONTEXT">
                The same color rules shown at normal FX-rack density. Each active effect keeps its
                own color even before modulation is selected.
            </BoardHeader>
            <nav className="effect-tabs" aria-label="Prototype effect identities">
                {Object.entries(EFFECT_ACCENTS).slice(0, 6).map(([name, accent]) => (
                    <span key={name} style={{ color: accent, borderColor: accent }}>{name.toUpperCase()}</span>
                ))}
            </nav>
            <div className="rack-panels">
                {rackPanels.map((panel) => (
                    <section
                        key={panel.name}
                        className="rack-context-panel"
                        style={{ "--panel-accent": panel.accent } as CSSProperties}
                    >
                        <header>
                            <div><span>SELECTED FX</span><h2>{panel.name}</h2></div>
                            <div className="armed-source" style={{ "--chip-accent": panel.source } as CSSProperties}>
                                <i /> {panel.sourceName} SELECTED
                            </div>
                        </header>
                        <div className="rack-knob-row">
                            {panel.states.map((sourceState, index) => {
                                if (sourceState === undefined) {
                                    return null;
                                }
                                const state: BoardState = {
                                    ...sourceState,
                                    id: `${panel.name}-${index}`,
                                    ownerAccent: panel.accent,
                                    sourceAccent: panel.source,
                                };
                                return (
                                    <div className="rack-knob-cell" key={state.id}>
                                        <RealKnobPreview state={state} compact />
                                        <span>{state.title}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
            <aside className="context-rule">
                <strong>How to read each knob</strong>
                <span><i className="owner-key" /> inside = the parameter value</span>
                <span><i className="source-key" /> outside = the selected source's mapping</span>
                <span><i className="inactive-key" /> grey = turned off or unavailable</span>
            </aside>
        </div>
    );
}

const lifecycleStates: ReadonlyArray<BoardState> = [
    baseStates[0],
    relationshipStates[0],
    dragStates[1],
    dragStates[2],
    dragStates[3],
    relationshipStates[2],
    inactiveStates[0],
].filter((state): state is BoardState => state !== undefined);

function VariantC() {
    return (
        <div className="board board-lifecycle">
            <BoardHeader variant="ROUTE LIFECYCLE">
                The same Size knob followed from normal use through selecting Envelope 1, dropping it,
                changing the amount, and turning the mapping off.
            </BoardHeader>
            <section className="lifecycle-track">
                {lifecycleStates.map((state, index) => (
                    <article className="lifecycle-step" key={state.id}>
                        <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                        <RealKnobPreview state={state} compact />
                        <div><h2>{state.title}</h2><p>{state.note}</p></div>
                        {index < lifecycleStates.length - 1 ? <span className="step-arrow">→</span> : null}
                    </article>
                ))}
            </section>
            <div className="lifecycle-verdict">
                <span>Rule</span>
                <strong>The inside stays the effect color until the effect or parameter is turned off or unavailable.</strong>
            </div>
        </div>
    );
}

const VARIANTS = [
    { id: "A", name: "Every knob state" },
    { id: "B", name: "Knobs in the FX rack" },
    { id: "C", name: "One mapping from start to finish" },
] as const;

type VariantID = typeof VARIANTS[number]["id"];

function readVariant(): VariantID {
    const requested = new URLSearchParams(window.location.search).get("variant");
    return VARIANTS.some((variant) => variant.id === requested) ? requested as VariantID : "A";
}

function PrototypeSwitcher({ variant, onChange }: {
    readonly variant: VariantID;
    readonly onChange: (next: VariantID) => void;
}) {
    const currentIndex = VARIANTS.findIndex((candidate) => candidate.id === variant);
    const current = VARIANTS[currentIndex] ?? VARIANTS[0];
    const cycle = (offset: number) => {
        const nextIndex = (currentIndex + offset + VARIANTS.length) % VARIANTS.length;
        const next = VARIANTS[nextIndex];
        if (next) {
            onChange(next.id);
        }
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) {
                return;
            }
            if (event.key === "ArrowLeft") {
                cycle(-1);
            }
            if (event.key === "ArrowRight") {
                cycle(1);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    return (
        <div className="prototype-switcher" aria-label="Prototype variant switcher">
            <button type="button" onClick={() => cycle(-1)} aria-label="Previous variant">←</button>
            <span><b>{current.id}</b> — {current.name}</span>
            <button type="button" onClick={() => cycle(1)} aria-label="Next variant">→</button>
        </div>
    );
}

function App() {
    const [variant, setVariant] = useState<VariantID>(readVariant);
    const changeVariant = (next: VariantID) => {
        const url = new URL(window.location.href);
        url.searchParams.set("variant", next);
        window.history.replaceState(null, "", url);
        setVariant(next);
    };

    return (
        <>
            {variant === "A" ? <VariantA /> : null}
            {variant === "B" ? <VariantB /> : null}
            {variant === "C" ? <VariantC /> : null}
            {import.meta.env.DEV ? <PrototypeSwitcher variant={variant} onChange={changeVariant} /> : null}
        </>
    );
}

const rootElement = document.getElementById("app");
if (rootElement === null) {
    throw new Error("Parameter color prototype root was not found.");
}

createRoot(rootElement).render(<App />);
