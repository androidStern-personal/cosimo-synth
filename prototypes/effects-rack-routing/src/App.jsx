import { useEffect, useMemo, useRef, useState } from "react";

const EFFECTS = [
  { id: "filter", label: "Filter", quick: "Cutoff", value: "1.42 kHz" },
  { id: "drive", label: "Drive", quick: "Drive", value: "28%" },
  { id: "ott", label: "OTT", quick: "Depth", value: "64%" },
  { id: "chorus", label: "Chorus", quick: "Rate", value: "0.38 Hz" },
  { id: "flange", label: "Flange", quick: "Mix", value: "34%" },
  { id: "phaser", label: "Phaser", quick: "Rate", value: "0.21 Hz" },
  { id: "delay", label: "Delay", quick: "Time", value: "1/4" },
  { id: "reverb", label: "Reverb", quick: "Mix", value: "18%" },
];

const CONCEPTS = [
  {
    id: "parameter",
    label: "Parameter first",
    summary: "Tap the thing you want to modulate; edit its sources in a drawer.",
    instruction: "Tap Edit modulation, add MSEG 1, then tap the MSEG chip.",
  },
  {
    id: "source",
    label: "Source first",
    summary: "Tap a modulator; its editor and complete target list take focus.",
    instruction: "Tap Add target, choose Filter · Cutoff, then return to the effect.",
  },
  {
    id: "split",
    label: "Split routing",
    summary: "Keep source and target visible together in a compact routing tray.",
    instruction: "Tap Add route, choose MSEG 1 below, then tap the cutoff handle.",
  },
];

function useCanvas(draw, dependencies) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const paint = () => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      canvas.width = Math.round(bounds.width * scale);
      canvas.height = Math.round(bounds.height * scale);
      const context = canvas.getContext("2d");
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      draw(context, bounds.width, bounds.height);
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, dependencies);

  return canvasRef;
}

function FilterGraph({ compact = false, cutoff, mapped = false, onSelectCutoff, onCutoffChange }) {
  const canvasRef = useCanvas((context, width, height) => {
    const pad = compact ? 10 : 16;
    context.lineWidth = 1;
    context.strokeStyle = "rgba(147, 178, 194, 0.12)";
    for (let column = 0; column <= 6; column += 1) {
      const x = pad + ((width - pad * 2) * column) / 6;
      context.beginPath();
      context.moveTo(x, pad);
      context.lineTo(x, height - pad);
      context.stroke();
    }
    for (let row = 0; row <= 4; row += 1) {
      const y = pad + ((height - pad * 2) * row) / 4;
      context.beginPath();
      context.moveTo(pad, y);
      context.lineTo(width - pad, y);
      context.stroke();
    }

    const barCount = compact ? 54 : 76;
    for (let index = 0; index < barCount; index += 1) {
      const normalized = index / (barCount - 1);
      const energy = (0.24 + Math.abs(Math.sin(index * 0.43)) * 0.56) * (1 - normalized * 0.74);
      const x = pad + normalized * (width - pad * 2);
      const barHeight = energy * (height - pad * 2) * 0.66;
      context.strokeStyle = `rgba(67, 209, 238, ${0.12 + energy * 0.34})`;
      context.beginPath();
      context.moveTo(x, height - pad);
      context.lineTo(x, height - pad - barHeight);
      context.stroke();
    }

    const cutoffX = pad + cutoff * (width - pad * 2);
    const baseline = compact ? height * 0.34 : height * 0.28;
    context.lineWidth = compact ? 2 : 3;
    context.strokeStyle = "#61ebff";
    context.beginPath();
    context.moveTo(pad, baseline);
    context.lineTo(cutoffX - 20, baseline);
    context.bezierCurveTo(cutoffX + 30, baseline, width * 0.76, height * 0.50, width - pad, height - pad);
    context.stroke();
  }, [cutoff, compact]);

  const cutoffPercent = 4 + cutoff * 91;
  const cutoffLabel = `${(0.42 + cutoff * 2.08).toFixed(2)} kHz`;

  return (
    <section className={`filter-graph ${compact ? "is-compact" : ""}`} aria-label="Global Filter response">
      <div className="graph-heading">
        <span>Global Filter</span>
        <span className="graph-mode">Low Pass 24</span>
      </div>
      <div className="filter-canvas-wrap">
        <canvas ref={canvasRef} aria-hidden="true" />
        <button
          type="button"
          className={`cutoff-handle ${mapped ? "is-mapped" : ""}`}
          style={{ left: `${cutoffPercent}%` }}
          onClick={onSelectCutoff}
          aria-label={`Filter cutoff ${cutoffLabel}. Edit modulation.`}
        >
          <span>{cutoffLabel}</span>
        </button>
      </div>
      {!compact && (
        <div className="filter-controls">
          <label>
            <span>Cutoff</span>
            <input
              type="range"
              min="0.28"
              max="0.78"
              step="0.01"
              value={cutoff}
              onChange={(event) => onCutoffChange?.(Number(event.target.value))}
            />
          </label>
          <div><span>Resonance</span><strong>0.71</strong></div>
          <div><span>Drive</span><strong>18%</strong></div>
        </div>
      )}
    </section>
  );
}

function MsegGraph({ compact = false }) {
  const canvasRef = useCanvas((context, width, height) => {
    const pad = compact ? 5 : 16;
    const points = [
      [0, 0.82],
      [0.16, 0.18],
      [0.34, 0.34],
      [0.54, 0.72],
      [0.75, 0.44],
      [1, 0.12],
    ];

    context.strokeStyle = "rgba(255,255,255,0.10)";
    context.lineWidth = 1;
    for (let row = 0; row <= 3; row += 1) {
      const y = pad + ((height - pad * 2) * row) / 3;
      context.beginPath();
      context.moveTo(pad, y);
      context.lineTo(width - pad, y);
      context.stroke();
    }

    context.lineWidth = compact ? 1.6 : 2.5;
    context.strokeStyle = "#ff78ab";
    context.beginPath();
    points.forEach(([x, y], index) => {
      const px = pad + x * (width - pad * 2);
      const py = pad + y * (height - pad * 2);
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.stroke();

    points.forEach(([x, y]) => {
      const px = pad + x * (width - pad * 2);
      const py = pad + y * (height - pad * 2);
      context.fillStyle = "#101722";
      context.strokeStyle = "#ff78ab";
      context.lineWidth = compact ? 1.5 : 2;
      context.beginPath();
      context.arc(px, py, compact ? 2.5 : 4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
  }, [compact]);

  return <canvas className={`mseg-graph ${compact ? "is-compact" : ""}`} ref={canvasRef} aria-label="MSEG 1 curve" />;
}

function RackStrip({ onFocusEffect }) {
  const [enabled, setEnabled] = useState(() => Object.fromEntries(EFFECTS.map((effect) => [effect.id, true])));
  const [selected, setSelected] = useState("filter");

  return (
    <div className="rack-wrap">
      <div className="rack-label"><span>In</span><span>Ordered effects</span><span>Out</span></div>
      <div className="rack-strip" aria-label="Effects rack">
        {EFFECTS.map((effect, index) => (
          <article className={`rack-item ${selected === effect.id ? "is-selected" : ""} ${enabled[effect.id] ? "" : "is-disabled"}`} key={effect.id}>
            <button className="rack-main" type="button" onClick={() => { setSelected(effect.id); onFocusEffect?.(effect.id); }}>
              <span className="rack-index">{index + 1}</span>
              <strong>{effect.label}</strong>
              <small>{effect.quick}</small>
              <span className="rack-value">{effect.value}</span>
            </button>
            <button
              className="rack-toggle"
              type="button"
              aria-label={`${enabled[effect.id] ? "Disable" : "Enable"} ${effect.label}`}
              aria-pressed={enabled[effect.id]}
              onClick={() => setEnabled((current) => ({ ...current, [effect.id]: !current[effect.id] }))}
            >
              {enabled[effect.id] ? "ON" : "OFF"}
            </button>
            <span className="rack-drag">DRAG</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function ModDock({ selected = "mseg", onSelectMseg, onSelectEnv, onSelectMacro }) {
  return (
    <nav className="mod-dock" aria-label="Modulation sources">
      <button type="button" className={selected === "macro" ? "is-selected macro" : "macro"} onClick={onSelectMacro}>
        <span>Macro 1</span><strong>45%</strong>
      </button>
      <button type="button" className={selected === "env" ? "is-selected env" : "env"} onClick={onSelectEnv}>
        <span>Env 1</span><span className="env-line" aria-hidden="true" /></button>
      <button type="button" className={selected === "mseg" ? "is-selected mseg" : "mseg"} onClick={onSelectMseg}>
        <span>MSEG 1</span><MsegGraph compact /></button>
      <button type="button" className="add-mod" aria-label="Add another modulation source"><span>Add</span></button>
    </nav>
  );
}

function RouteRow({ name, amount, setAmount, reducer = "Max", onOpenSource }) {
  return (
    <div className="route-row">
      <button className="route-source" type="button" onClick={onOpenSource}>{name}</button>
      <label className="amount-field">
        <span>{Number(amount) > 0 ? "+" : ""}{amount}%</span>
        <input type="range" min="-100" max="100" value={amount} onChange={(event) => setAmount?.(Number(event.target.value))} />
      </label>
      <button className="relation-control" type="button">Bipolar</button>
      <button className="relation-control" type="button">{reducer}</button>
    </div>
  );
}

function SourceInspector({ onClose, amount, setAmount }) {
  return (
    <section className="source-overlay" aria-label="MSEG 1 source inspector">
      <header><button type="button" onClick={onClose}>Back to Filter</button><strong>MSEG 1</strong><span>0.640 s</span></header>
      <MsegGraph />
      <div className="source-targets">
        <div className="section-heading"><span>Targets</span><small>2 routes</small></div>
        <RouteRow name="Filter · Cutoff" amount={amount} setAmount={setAmount} reducer="Max" />
        <RouteRow name="Reverb · Mix" amount={24} reducer="Mean" />
      </div>
    </section>
  );
}

function ParameterFirst() {
  const [cutoff, setCutoff] = useState(0.52);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hasMseg, setHasMseg] = useState(false);
  const [amount, setAmount] = useState(62);
  const [sourceOpen, setSourceOpen] = useState(false);

  return (
    <PrototypeFrame>
      <RackStrip />
      <div className="effect-workspace parameter-workspace">
        <FilterGraph
          cutoff={cutoff}
          mapped={hasMseg}
          onCutoffChange={setCutoff}
          onSelectCutoff={() => setDrawerOpen(true)}
        />
        <button className="primary-action" type="button" onClick={() => setDrawerOpen(true)}>Edit cutoff modulation</button>
      </div>
      <ModDock selected={sourceOpen ? "mseg" : null} onSelectMseg={() => hasMseg && setSourceOpen(true)} />

      {drawerOpen && (
        <section className="mod-drawer" aria-label="Cutoff modulation drawer">
          <header><div><small>Filter</small><strong>Cutoff modulation</strong></div><button type="button" onClick={() => setDrawerOpen(false)}>Close</button></header>
          {hasMseg ? (
            <RouteRow name="MSEG 1" amount={amount} setAmount={setAmount} reducer="Max" onOpenSource={() => setSourceOpen(true)} />
          ) : (
            <div className="empty-route"><span>No sources assigned yet.</span><small>The cutoff value remains unchanged.</small></div>
          )}
          <RouteRow name="Pressure" amount={18} reducer="Mean" />
          {pickerOpen ? (
            <div className="source-picker">
              <span>Choose a source</span>
              <button type="button" onClick={() => { setHasMseg(true); setPickerOpen(false); }}>MSEG 1</button>
              <button type="button">Env 1</button>
              <button type="button">Macro 1</button>
            </div>
          ) : (
            <button className="drawer-add" type="button" onClick={() => setPickerOpen(true)}>Add source</button>
          )}
        </section>
      )}

      {sourceOpen && <SourceInspector onClose={() => setSourceOpen(false)} amount={amount} setAmount={setAmount} />}
    </PrototypeFrame>
  );
}

function TargetRow({ name, amount, setAmount, reducer = "Max", onOpenTarget }) {
  return (
    <div className="target-row">
      <button type="button" onClick={onOpenTarget}><strong>{name}</strong><small>Continuous target</small></button>
      <label><span>+{amount}%</span><input type="range" min="0" max="100" value={amount} onChange={(event) => setAmount?.(Number(event.target.value))} /></label>
      <span>{reducer}</span>
    </div>
  );
}

function SourceFirst() {
  const [cutoff, setCutoff] = useState(0.52);
  const [hasFilterTarget, setHasFilterTarget] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amount, setAmount] = useState(62);
  const [effectFocused, setEffectFocused] = useState(false);

  if (effectFocused) {
    return (
      <PrototypeFrame>
        <RackStrip />
        <div className="effect-workspace source-return-workspace">
          <button className="back-action" type="button" onClick={() => setEffectFocused(false)}>Back to MSEG 1 targets</button>
          <FilterGraph cutoff={cutoff} mapped={hasFilterTarget} onCutoffChange={setCutoff} onSelectCutoff={() => setEffectFocused(false)} />
          <div className="mapping-summary"><span>MSEG 1 → Cutoff</span><strong>{hasFilterTarget ? `+${amount}%` : "Not assigned"}</strong></div>
        </div>
        <ModDock selected={null} onSelectMseg={() => setEffectFocused(false)} />
      </PrototypeFrame>
    );
  }

  return (
    <PrototypeFrame>
      <RackStrip />
      <FilterGraph compact cutoff={cutoff} mapped={hasFilterTarget} onSelectCutoff={() => setEffectFocused(true)} />
      <section className="source-workspace">
        <header><div><small>Modulation source</small><strong>MSEG 1</strong></div><div><small>Rate</small><strong>0.640 s</strong></div></header>
        <MsegGraph />
        <div className="target-list">
          <div className="section-heading"><span>Targets</span><small>{hasFilterTarget ? "2 routes" : "1 route"}</small></div>
          {hasFilterTarget && <TargetRow name="Filter · Cutoff" amount={amount} setAmount={setAmount} reducer="Max" onOpenTarget={() => setEffectFocused(true)} />}
          <TargetRow name="Reverb · Mix" amount={24} reducer="Mean" />
          {pickerOpen ? (
            <div className="target-picker">
              <span>Choose target</span>
              <button type="button" onClick={() => { setHasFilterTarget(true); setPickerOpen(false); }}>Filter · Cutoff</button>
              <button type="button">Drive · Mix</button>
              <button type="button">Chorus · Rate</button>
            </div>
          ) : (
            <button className="target-add" type="button" onClick={() => setPickerOpen(true)}>Add target</button>
          )}
        </div>
      </section>
      <ModDock selected="mseg" onSelectMseg={() => setEffectFocused(false)} />
    </PrototypeFrame>
  );
}

function SplitRouting() {
  const [cutoff, setCutoff] = useState(0.52);
  const [building, setBuilding] = useState(false);
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [amount, setAmount] = useState(62);

  const beginRoute = () => {
    setBuilding(true);
    setSource(null);
    setTarget(null);
  };
  const chooseMseg = () => {
    if (building) setSource("MSEG 1");
  };
  const chooseCutoff = () => {
    if (building && source) setTarget("Filter · Cutoff");
  };
  const routeComplete = Boolean(source && target);
  const instruction = !building
    ? "Add a route without leaving the effect."
    : !source
      ? "Choose a source from the dock."
      : !target
        ? "Now tap the cutoff handle above."
        : "Route complete. Adjust it in place.";

  return (
    <PrototypeFrame>
      <RackStrip />
      <div className="split-filter">
        <FilterGraph cutoff={cutoff} mapped={routeComplete} onCutoffChange={setCutoff} onSelectCutoff={chooseCutoff} />
      </div>
      <section className={`routing-tray ${building ? "is-building" : ""}`}>
        <header><div><small>Routing</small><strong>{instruction}</strong></div>{building && <button type="button" onClick={() => setBuilding(false)}>Cancel</button>}</header>
        {building ? (
          <>
            <div className="route-builder">
              <button className={source ? "is-filled" : ""} type="button" onClick={() => setSource(null)}>{source || "Choose source"}</button>
              <label><span>{routeComplete ? `+${amount}%` : "Amount"}</span><input disabled={!routeComplete} type="range" min="-100" max="100" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
              <button className={target ? "is-filled" : ""} type="button" onClick={() => setTarget(null)}>{target || "Choose target"}</button>
            </div>
            {routeComplete && <div className="relation-row"><button type="button">Bipolar</button><button type="button">Reducer: Max</button><button type="button" onClick={() => setBuilding(false)}>Done</button></div>}
          </>
        ) : (
          <>
            {routeComplete && <div className="saved-route"><button type="button" onClick={() => setBuilding(true)}>MSEG 1</button><strong>+{amount}%</strong><button type="button" onClick={() => setBuilding(true)}>Filter · Cutoff</button></div>}
            <div className="saved-route pressure"><span>Pressure</span><strong>+18%</strong><span>Filter · Cutoff</span></div>
            <button className="route-add" type="button" onClick={beginRoute}>Add route</button>
          </>
        )}
      </section>
      <ModDock selected={source === "MSEG 1" ? "mseg" : null} onSelectMseg={chooseMseg} />
    </PrototypeFrame>
  );
}

function PrototypeFrame({ children }) {
  return (
    <div className="mobile-prototype">
      <header className="app-header"><span>Cosimo</span><strong>Effects</strong><button type="button">Patch</button></header>
      {children}
    </div>
  );
}

function CoherentPrototype() {
  const [focus, setFocus] = useState("filter");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cutoff, setCutoff] = useState(0.52);
  const [amount, setAmount] = useState(62);

  const focusFilter = () => {
    setFocus("filter");
    setDrawerOpen(false);
  };

  const focusMseg = () => {
    setFocus("mseg");
    setDrawerOpen(false);
  };

  return (
    <PrototypeFrame>
      <RackStrip onFocusEffect={(effectID) => effectID === "filter" && focusFilter()} />

      {focus === "filter" ? (
        <div className="effect-workspace coherent-filter-workspace">
          <FilterGraph
            cutoff={cutoff}
            mapped
            onCutoffChange={setCutoff}
            onSelectCutoff={() => setDrawerOpen(true)}
          />
          <button className="primary-action" type="button" onClick={() => setDrawerOpen(true)}>Cutoff modulation</button>
        </div>
      ) : (
        <section className="coherent-mseg-workspace">
          <header>
            <div><small>Focused editor</small><strong>MSEG 1</strong></div>
            <div><small>Rate</small><strong>0.640 s</strong></div>
          </header>
          <MsegGraph />
          <div className="target-list">
            <div className="section-heading"><span>Targets</span><small>2 routes</small></div>
            <TargetRow name="Filter · Cutoff" amount={amount} setAmount={setAmount} reducer="Max" />
            <TargetRow name="Reverb · Mix" amount={24} reducer="Mean" />
            <button className="target-add" type="button">Add target</button>
          </div>
        </section>
      )}

      <ModDock selected={focus === "mseg" ? "mseg" : null} onSelectMseg={focusMseg} />

      {focus === "filter" && drawerOpen && (
        <section className="mod-drawer coherent-drawer" aria-label="Cutoff modulation mappings">
          <header>
            <div><small>Filter · Cutoff</small><strong>Modulation mappings</strong></div>
            <button type="button" onClick={() => setDrawerOpen(false)}>Close</button>
          </header>
          <RouteRow name="MSEG 1" amount={amount} setAmount={setAmount} reducer="Max" />
          <RouteRow name="Pressure" amount={18} reducer="Mean" />
          <button className="drawer-add" type="button">Add source</button>
        </section>
      )}
    </PrototypeFrame>
  );
}

export function App() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <main className="prototype-lab">
      <section className="lab-copy">
        <div>
          <span className="eyebrow">Corrected interaction model</span>
          <h1>One instrument, two explicit focus states</h1>
          <p>The focused editor never changes unless the user deliberately selects a different module or modulator.</p>
        </div>
        <div className="focus-rules">
          <article><strong>Filter selected</strong><span>Filter stays centered. Cutoff mappings open without replacing it.</span></article>
          <article><strong>MSEG 1 selected</strong><span>MSEG stays centered. Its complete target list appears below it.</span></article>
        </div>
        <div className="test-prompt"><strong>Try the model</strong><span>Open Cutoff Modulation. Close it. Tap MSEG 1 in the bottom dock. Tap Filter in the rack to return.</span><button type="button" onClick={() => setResetKey((current) => current + 1)}>Reset</button></div>
      </section>
      <CoherentPrototype key={resetKey} />
    </main>
  );
}
