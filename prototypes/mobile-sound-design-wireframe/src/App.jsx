import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowSquareOut,
  BezierCurve,
  Circle,
  CursorClick,
  DotsSixVertical,
  Feather,
  FadersHorizontal,
  Gauge,
  Lightning,
  LinkSimple,
  Plus,
  Pulse,
  Waveform,
  WaveSine,
} from "@phosphor-icons/react";

const clamp = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, value));

const SOURCE_COLORS = {
  "macro-1": "#9d5ca8",
  "macro-2": "#bd5f8b",
  "macro-3": "#5c70b2",
  "macro-4": "#aa7933",
  "envelope-1": "#2698bd",
  "envelope-2": "#4b9f67",
  "envelope-3": "#6c78b6",
  "mseg-1": "#df7045",
  "mseg-2": "#d2a12e",
  "mseg-3": "#795ca3",
  pressure: "#c34f55",
};

const ARTICULATIONS = {
  Default: { color: "#716e68", icon: Circle },
  Pluck: { color: "#de8e38", icon: CursorClick },
  Bowed: { color: "#2f8f82", icon: Feather },
  Accent: { color: "#d65c52", icon: Lightning },
};

const sourceColor = (source) => SOURCE_COLORS[source?.id] || "#716e68";

function haptic(kind = "light") {
  const duration = kind === "success" ? 14 : 7;
  navigator.vibrate?.(duration);
}

function mappingNeedsReducer(source, target) {
  return target?.workspace === "effects" && source?.type !== "macro";
}

const parameter = (id, label, initial, defaultValue, format = "percent", compound = null) => ({
  id,
  label,
  initial,
  defaultValue,
  format,
  compound,
});

const EFFECTS = [
  {
    id: "filter",
    label: "Filter",
    workspace: "effects",
    quick: "cutoff",
    graphicLabel: "Filter response graphic",
    graphicAxes: ["cutoff", "resonance"],
    params: [
      parameter("cutoff", "Cutoff", 62, 70, "frequency"),
      parameter("resonance", "Resonance", 30, 0),
      parameter("drive", "Drive", 22, 0),
    ],
  },
  {
    id: "drive",
    label: "Drive",
    workspace: "effects",
    quick: "amount",
    graphicLabel: "Drive transfer graphic",
    graphicAxes: ["amount", "tone"],
    params: [
      parameter("amount", "Amount", 45, 0),
      parameter("tone", "Tone", 55, 50),
      parameter("mix", "Mix", 38, 0),
    ],
  },
  {
    id: "ott",
    label: "OTT",
    workspace: "effects",
    quick: "depth",
    graphicLabel: "OTT compression graphic",
    graphicAxes: ["depth", "time"],
    params: [
      parameter("depth", "Depth", 64, 0),
      parameter("time", "Time", 48, 50),
      parameter("mix", "Mix", 50, 0),
    ],
  },
  {
    id: "chorus",
    label: "Chorus",
    workspace: "effects",
    quick: "depth",
    graphicLabel: "Chorus motion graphic",
    graphicAxes: ["rate", "depth"],
    params: [
      parameter("rate", "Rate", 28, 20, "rate", "sync"),
      parameter("depth", "Depth", 55, 0),
      parameter("delay", "Delay", 36, 25),
      parameter("mix", "Mix", 35, 0),
    ],
  },
  {
    id: "flanger",
    label: "Flanger",
    workspace: "effects",
    quick: "rate",
    graphicLabel: "Flanger motion graphic",
    graphicAxes: ["rate", "depth"],
    params: [
      parameter("rate", "Rate", 26, 20, "rate", "sync"),
      parameter("depth", "Depth", 68, 0),
      parameter("feedback", "Feedback", 42, 50, "signed"),
      parameter("mix", "Mix", 38, 0),
    ],
  },
  {
    id: "phaser",
    label: "Phaser",
    workspace: "effects",
    quick: "frequency",
    graphicLabel: "Response / motion graphic",
    graphicAxes: ["frequency", "depth"],
    params: [
      parameter("rate", "Rate", 26, 20, "rate", "sync"),
      parameter("depth", "Depth", 68, 50),
      parameter("frequency", "Frequency", 54, 45, "frequency"),
      parameter("feedback", "Feedback", 42, 50, "signed"),
      parameter("phase", "Phase", 50, 50, "phase"),
      parameter("mix", "Mix", 38, 0),
    ],
  },
  {
    id: "delay",
    label: "Delay",
    workspace: "effects",
    quick: "time",
    graphicLabel: "Delay timing graphic",
    graphicAxes: ["time", "feedback"],
    params: [
      parameter("time", "Time", 48, 40, "percent", "sync"),
      parameter("feedback", "Feedback", 36, 0, "signed"),
      parameter("filter", "Filter", 58, 70, "frequency"),
      parameter("mix", "Mix", 30, 0),
    ],
  },
  {
    id: "reverb",
    label: "Reverb",
    workspace: "effects",
    quick: "size",
    graphicLabel: "Reverb space graphic",
    graphicAxes: ["size", "decay"],
    params: [
      parameter("size", "Size", 72, 50),
      parameter("decay", "Decay", 64, 40),
      parameter("damping", "Damping", 43, 50),
      parameter("mix", "Mix", 28, 0),
    ],
  },
];

const VOICE_MODULES = [
  {
    id: "wavetable",
    label: "Wavetable",
    workspace: "voice",
    quick: "index",
    graphicLabel: "Wavetable display",
    graphicAxes: ["warp", "index"],
    params: [
      parameter("index", "Index", 44, 0),
      parameter("warp", "Warp", 58, 50),
      parameter("unison", "Unison", 35, 0),
      parameter("tune", "Tune", 50, 50, "semitone"),
    ],
  },
  {
    id: "voice-filter",
    label: "Voice Filter",
    workspace: "voice",
    quick: "cutoff",
    graphicLabel: "Per-voice filter response",
    graphicAxes: ["cutoff", "resonance"],
    params: [
      parameter("cutoff", "Cutoff", 67, 70, "frequency"),
      parameter("resonance", "Resonance", 25, 0),
      parameter("drive", "Drive", 15, 0),
    ],
  },
  {
    id: "amp-pan",
    label: "Amp / Pan",
    workspace: "voice",
    quick: "level",
    graphicLabel: "Amplitude and pan graphic",
    graphicAxes: ["pan", "level"],
    params: [
      parameter("level", "Level", 80, 80),
      parameter("pan", "Pan", 50, 50, "signed"),
      parameter("attack", "Attack", 10, 0),
      parameter("release", "Release", 35, 25),
    ],
  },
];

const ALL_MODULES = [...EFFECTS, ...VOICE_MODULES];
const MODULES_BY_ID = Object.fromEntries(ALL_MODULES.map((module) => [module.id, module]));

const TARGETS = Object.fromEntries(
  ALL_MODULES.flatMap((module) =>
    module.params.map((param) => {
      const key = module.id + "." + param.id;
      return [
        key,
        {
          ...param,
          key,
          moduleId: module.id,
          moduleLabel: module.label,
          workspace: module.workspace,
        },
      ];
    }),
  ),
);

const INITIAL_BASE_VALUES = Object.fromEntries(
  Object.values(TARGETS).map((target) => [target.key, target.initial]),
);

const INITIAL_SOURCES = [
  { id: "macro-1", type: "macro", slot: 1, label: "Macro 1" },
  { id: "envelope-1", type: "envelope", slot: 1, label: "Envelope 1" },
  { id: "mseg-1", type: "mseg", slot: 1, label: "MSEG 1" },
];

const FIXED_SOURCES = [
  { id: "pressure", type: "fixed", slot: null, label: "Pressure" },
];

const mapping = (targetKey, sourceId, amount, polarity = "Bipolar", reducer = "Max") => ({
  id: targetKey + "::" + sourceId,
  targetKey,
  sourceId,
  amount,
  polarity,
  reducer,
});

const INITIAL_MAPPINGS = [
  mapping("phaser.frequency", "mseg-1", 62, "Bipolar", "Max"),
  mapping("phaser.frequency", "pressure", 18, "Bipolar", "Mean"),
  mapping("phaser.depth", "macro-1", 22, "Unipolar", "Max"),
  mapping("drive.amount", "macro-1", 28, "Unipolar", "Max"),
  mapping("wavetable.index", "mseg-1", 34, "Unipolar", "Max"),
  mapping("wavetable.warp", "envelope-1", 40, "Bipolar", "Max"),
  mapping("voice-filter.cutoff", "envelope-1", 55, "Unipolar", "Max"),
];

const INITIAL_ACTIVE_SOURCES = {
  "phaser.frequency": "mseg-1",
  "phaser.depth": "macro-1",
  "drive.amount": "macro-1",
  "wavetable.index": "mseg-1",
  "wavetable.warp": "envelope-1",
  "voice-filter.cutoff": "envelope-1",
};

function formatValue(target, value) {
  if (!target) return Math.round(value) + "%";
  if (target.format === "frequency") {
    const hz = Math.round(20 * 1000 ** (value / 100));
    return hz >= 1000 ? (hz / 1000).toFixed(2) + " kHz" : hz + " Hz";
  }
  if (target.format === "rate") return (0.05 + (value / 100) * 9.95).toFixed(2) + " Hz";
  if (target.format === "phase") return Math.round((value / 100) * 360) + "°";
  if (target.format === "signed") return Math.round((value - 50) * 2) + "%";
  if (target.format === "semitone") return (value >= 50 ? "+" : "") + Math.round((value - 50) / 2) + " st";
  return Math.round(value) + "%";
}

function SourceIcon({ source, size = 19 }) {
  if (source?.type === "macro") return <Gauge aria-hidden="true" size={size} weight="regular" />;
  if (source?.type === "envelope") return <Pulse aria-hidden="true" size={size} weight="regular" />;
  if (source?.type === "mseg") return <BezierCurve aria-hidden="true" size={size} weight="regular" />;
  return <Waveform aria-hidden="true" size={size} weight="regular" />;
}

function SourceMark({ source, showLabel = false }) {
  return (
    <span
      className="source-mark"
      style={{ "--source-color": sourceColor(source) }}
      title={source?.label}
    >
      <SourceIcon source={source} size={16} />
      {source?.slot != null && <span>{source.slot}</span>}
      {showLabel && <span>{source?.label}</span>}
    </span>
  );
}

function ArticulationIcon({ articulation, size = 15 }) {
  const definition = ARTICULATIONS[articulation] || ARTICULATIONS.Default;
  const Icon = definition.icon;
  return <Icon aria-hidden="true" size={size} weight="regular" />;
}

function WireRange({
  ariaLabel,
  value,
  minimum = 0,
  maximum = 100,
  defaultValue = minimum,
  color = "currentColor",
  onInput,
}) {
  const normalizedValue = ((value - minimum) / (maximum - minimum)) * 100;
  const normalizedDefault = ((defaultValue - minimum) / (maximum - minimum)) * 100;
  return (
    <span className="wire-range" style={{ "--range-color": color }}>
      <span className="parameter-track" aria-hidden="true">
        <span className="base-fill" style={{ width: normalizedValue + "%" }} />
        <span className="default-tick" style={{ left: normalizedDefault + "%" }} />
        <span className="base-position" style={{ left: normalizedValue + "%" }} />
      </span>
      <input
        aria-label={ariaLabel}
        type="range"
        min={minimum}
        max={maximum}
        value={value}
        onChange={onInput}
      />
    </span>
  );
}

function WorkspaceIcon({ workspace, size }) {
  return workspace === "effects"
    ? <FadersHorizontal aria-hidden="true" size={size} weight="regular" />
    : <WaveSine aria-hidden="true" size={size} weight="regular" />;
}

function GlobalHeader({ workspace, onWorkspace }) {
  const gesture = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const otherWorkspace = workspace === "effects" ? "voice" : "effects";
  const workspaceLabel = workspace === "effects" ? "Effects" : "Voice / Oscillator";
  const otherLabel = otherWorkspace === "effects" ? "Effects" : "Voice / Oscillator";

  const finishSwipe = (event) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - current.startX) > 24) onWorkspace(otherWorkspace);
    gesture.current = null;
    setDragOffset(0);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <header className="global-header">
      <button>Glass Pluck *</button>
      <div
        aria-label={workspaceLabel + " workspace carousel"}
        className="workspace-carousel"
        onPointerDown={(event) => {
          gesture.current = { pointerId: event.pointerId, startX: event.clientX };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current || current.pointerId !== event.pointerId) return;
          setDragOffset(clamp(event.clientX - current.startX, -42, 42));
        }}
        onPointerUp={finishSwipe}
        onPointerCancel={() => {
          gesture.current = null;
          setDragOffset(0);
        }}
        role="group"
        style={{ "--workspace-drag": dragOffset + "px" }}
      >
        <button aria-label={"Previous workspace: " + otherLabel} className="workspace-neighbor" onClick={() => onWorkspace(otherWorkspace)}>
          <WorkspaceIcon workspace={otherWorkspace} size={18} />
        </button>
        <button aria-current="page" aria-label={workspaceLabel} className="workspace-current">
          <WorkspaceIcon workspace={workspace} size={27} />
        </button>
        <button aria-label={"Next workspace: " + otherLabel} className="workspace-neighbor" onClick={() => onWorkspace(otherWorkspace)}>
          <WorkspaceIcon workspace={otherWorkspace} size={18} />
        </button>
      </div>
      <button aria-label="Patch menu">Menu</button>
    </header>
  );
}

function EffectRack({
  effects,
  activeModuleId,
  enabled,
  baseValues,
  lastTweaked,
  onEnable,
  onFocus,
  onQuickChange,
  onReorder,
  onReadout,
}) {
  const activeTileRef = useRef(null);
  const reorderGesture = useRef(null);

  useEffect(() => {
    activeTileRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeModuleId]);

  return (
    <section className="module-strip" aria-label="Ordered global effects">
      <div className="rack-list">
        {effects.map((effect) => {
          const quickId = lastTweaked[effect.id] || effect.quick;
          const target = TARGETS[effect.id + "." + quickId];
          return (
            <article
              className="rack-tile"
              data-active={activeModuleId === effect.id}
              data-effect-id={effect.id}
              key={effect.id}
              ref={activeModuleId === effect.id ? activeTileRef : null}
            >
              <button className="rack-focus" onClick={() => onFocus(effect)}>
                <strong>{effect.label}</strong>
              </button>
              <label className="rack-quick-control">
                <span>{target.label}</span>
                <output>{formatValue(target, baseValues[target.key])}</output>
                <WireRange
                  ariaLabel={effect.label + " " + target.label + " quick control"}
                  value={baseValues[target.key]}
                  defaultValue={target.defaultValue}
                  onInput={(event) => {
                    const value = Number(event.target.value);
                    onQuickChange(target.key, value);
                    onReadout(effect.label + " · " + target.label + " " + formatValue(target, value));
                  }}
                />
              </label>
              <label className="rack-enabled">
                <input
                  type="checkbox"
                  checked={enabled[effect.id]}
                  onChange={(event) => onEnable(effect.id, event.target.checked)}
                />
                On
              </label>
              <button
                aria-label={"Reorder " + effect.label}
                className="rack-drag-handle"
                onPointerDown={(event) => {
                  reorderGesture.current = {
                    pointerId: event.pointerId,
                    movingId: effect.id,
                    lastOverId: effect.id,
                  };
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  haptic("light");
                }}
                onPointerMove={(event) => {
                  const current = reorderGesture.current;
                  if (!current || current.pointerId !== event.pointerId) return;
                  const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-effect-id]");
                  const overId = tile?.getAttribute("data-effect-id");
                  if (!overId || overId === current.lastOverId) return;
                  onReorder(current.movingId, overId);
                  current.lastOverId = overId;
                  haptic("light");
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  reorderGesture.current = null;
                  haptic("success");
                }}
                onPointerCancel={() => {
                  reorderGesture.current = null;
                }}
              >
                <DotsSixVertical aria-hidden="true" size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function VoiceStrip({ activeModuleId, baseValues, lastTweaked, onFocus }) {
  return (
    <section className="module-strip" aria-label="Per-note voice path">
      <div className="voice-module-list">
        {VOICE_MODULES.map((module) => {
          const quickId = lastTweaked[module.id] || module.quick;
          const target = TARGETS[module.id + "." + quickId];
          return (
            <button
              data-selected={activeModuleId === module.id}
              key={module.id}
              onClick={() => onFocus(module)}
            >
              <span>{module.label}</span>
              <small>{target.label} {formatValue(target, baseValues[target.key])}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ModuleGraphic({ module, baseValues }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      const context = canvas.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      context.strokeStyle = getComputedStyle(canvas).color;
      context.fillStyle = context.strokeStyle;
      context.lineCap = "round";
      context.lineJoin = "round";

      const width = bounds.width;
      const height = bounds.height;
      const left = 14;
      const right = width - 14;
      const top = 10;
      const bottom = height - 10;
      const plotWidth = right - left;
      const plotHeight = bottom - top;

      context.save();
      context.globalAlpha = 0.16;
      context.lineWidth = 1;
      for (let index = 1; index < 4; index += 1) {
        const x = left + (plotWidth * index) / 4;
        const y = top + (plotHeight * index) / 4;
        context.beginPath();
        context.moveTo(x, top);
        context.lineTo(x, bottom);
        context.stroke();
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(right, y);
        context.stroke();
      }
      context.restore();

      const value = (parameterId, fallback = 50) =>
        baseValues[module.id + "." + parameterId] ?? fallback;
      const trace = (pointForStep, steps = 120, alpha = 1, lineWidth = 1.8) => {
        context.save();
        context.globalAlpha = alpha;
        context.lineWidth = lineWidth;
        context.beginPath();
        for (let step = 0; step <= steps; step += 1) {
          const t = step / steps;
          const point = pointForStep(t);
          if (step === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        }
        context.stroke();
        context.restore();
      };

      if (module.id === "filter" || module.id === "voice-filter") {
        const cutoff = value("cutoff") / 100;
        const resonance = value("resonance", 20) / 100;
        trace((t) => {
          const lowPass = 1 / (1 + Math.exp((t - cutoff) * 18));
          const peak = resonance * 0.34 * Math.exp(-((t - cutoff) ** 2) / 0.0035);
          const response = clamp(lowPass + peak, 0, 1.12);
          return { x: left + t * plotWidth, y: bottom - response * plotHeight * 0.82 };
        });
      } else if (module.id === "drive") {
        const amount = 1.2 + value("amount") / 7;
        trace((t) => {
          const input = t * 2 - 1;
          const output = Math.tanh(input * amount) / Math.tanh(amount);
          return { x: left + t * plotWidth, y: top + (1 - (output + 1) / 2) * plotHeight };
        });
      } else if (module.id === "phaser") {
        const frequency = value("frequency") / 100;
        const depth = 0.08 + (value("depth") / 100) * 0.38;
        const phase = value("phase", 50) / 100;
        trace((t) => {
          const windowing = 0.35 + Math.sin(t * Math.PI) * 0.65;
          const wave = Math.sin((t * 5.5 + frequency * 1.8 + phase) * Math.PI * 2);
          return {
            x: left + t * plotWidth,
            y: top + plotHeight * (0.5 + wave * depth * windowing),
          };
        });
        trace((t) => ({
          x: left + t * plotWidth,
          y: top + plotHeight * (0.5 + Math.sin((t * 5.5 + frequency * 1.8 + phase + 0.08) * Math.PI * 2) * depth * 0.55),
        }), 120, 0.35, 1);
      } else if (["chorus", "flanger"].includes(module.id)) {
        const depth = value("depth") / 100;
        const rate = value("rate") / 100;
        [0, 0.16, 0.31].forEach((offset, index) => {
          trace((t) => ({
            x: left + t * plotWidth,
            y: top + plotHeight * (0.5 + Math.sin((t * (2.2 + rate * 2) + offset) * Math.PI * 2) * (0.12 + depth * 0.2)),
          }), 100, 1 - index * 0.27, 1.5 - index * 0.2);
        });
      } else if (module.id === "delay") {
        const time = 0.1 + value("time") / 160;
        const feedback = value("feedback") / 100;
        context.lineWidth = 1.7;
        context.beginPath();
        context.moveTo(left, bottom);
        for (let echo = 0; echo < 7; echo += 1) {
          const x = left + echo * time * plotWidth;
          if (x > right) break;
          const amplitude = plotHeight * 0.75 * (echo === 0 ? 1 : feedback ** echo);
          context.lineTo(x, bottom);
          context.lineTo(x, bottom - amplitude);
          context.lineTo(x + 2, bottom);
        }
        context.lineTo(right, bottom);
        context.stroke();
      } else if (module.id === "reverb") {
        const size = value("size") / 100;
        const decay = 1.5 + size * 5;
        trace((t) => ({
          x: left + t * plotWidth,
          y: top + plotHeight * (0.5 + Math.sin(t * 90) * Math.exp(-t * decay) * 0.45),
        }), 160);
      } else if (module.id === "ott") {
        [0.25, 0.5, 0.75].forEach((band, index) => {
          const depth = value("depth") / 100;
          trace((t) => ({
            x: left + t * plotWidth,
            y: top + plotHeight * (band + Math.tanh((t - 0.5) * (2 + depth * 5)) * 0.12),
          }), 80, 1 - index * 0.18, 1.5);
        });
      } else if (module.id === "amp-pan") {
        const level = value("level") / 100;
        const pan = (value("pan") - 50) / 50;
        const leftLevel = level * (pan > 0 ? 1 - pan : 1);
        const rightLevel = level * (pan < 0 ? 1 + pan : 1);
        [leftLevel, rightLevel].forEach((channel, index) => {
          const y = top + plotHeight * (0.35 + index * 0.3);
          context.lineWidth = 5;
          context.globalAlpha = 0.25;
          context.beginPath();
          context.moveTo(left, y);
          context.lineTo(right, y);
          context.stroke();
          context.globalAlpha = 1;
          context.beginPath();
          context.moveTo(left, y);
          context.lineTo(left + plotWidth * channel, y);
          context.stroke();
        });
      } else {
        const indexValue = value("index") / 100;
        const warp = value("warp") / 100;
        trace((t) => {
          const angle = t * Math.PI * 2;
          const wave = Math.sin(angle) * 0.62 + Math.sin(angle * (2 + Math.round(indexValue * 4))) * (0.08 + warp * 0.22);
          return { x: left + t * plotWidth, y: top + plotHeight * (0.5 - wave * 0.5) };
        });
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [module, baseValues]);

  return <canvas aria-hidden="true" className="module-graphic" ref={canvasRef} />;
}

function DirectPad({
  module,
  baseValues,
  syncSettings,
  onSyncSettings,
  onChange,
  onReadout,
  onSelect,
}) {
  const targets = module.graphicAxes.map((id) => TARGETS[module.id + "." + id]);
  const xTarget = targets[0];
  const yTarget = targets[1];
  const syncTarget = module.params
    .map((param) => TARGETS[module.id + "." + param.id])
    .find((target) => target.compound === "sync");
  const syncState = syncTarget
    ? syncSettings[syncTarget.key] || { mode: "Free", division: "1/8" }
    : null;
  const xValue = baseValues[xTarget.key];
  const yValue = baseValues[yTarget.key];

  const updateFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextX = clamp(((event.clientX - bounds.left) / bounds.width) * 100);
    const nextY = clamp((1 - (event.clientY - bounds.top) / bounds.height) * 100);
    onChange(xTarget.key, nextX);
    onChange(yTarget.key, nextY);
    onReadout(
      xTarget.label + " " + formatValue(xTarget, nextX) +
      " · " + yTarget.label + " " + formatValue(yTarget, nextY),
    );
  };

  return (
    <div
      className="graphic-pad"
      role="slider"
      aria-label={module.graphicLabel + ". Horizontal changes " + xTarget.label + ", vertical changes " + yTarget.label + "."}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(xValue)}
      tabIndex={0}
      onPointerDown={(event) => {
        onSelect(xTarget);
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
      }}
    >
      <ModuleGraphic baseValues={baseValues} module={module} />
      <span className="graphic-position" style={{ left: xValue + "%", bottom: yValue + "%" }} />
      {syncTarget && (
        <div
          aria-label={syncTarget.label + " timing mode"}
          className="graphic-mode-control"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          role="group"
        >
          <strong>{syncTarget.label}</strong>
          <button
            data-selected={syncState.mode === "Free"}
            onClick={() => onSyncSettings(syncTarget.key, { mode: "Free" })}
          >
            Free
          </button>
          <button
            data-selected={syncState.mode === "Sync"}
            onClick={() => onSyncSettings(syncTarget.key, { mode: "Sync" })}
          >
            Sync
          </button>
          <select
            aria-label={syncTarget.label + " musical division"}
            disabled={syncState.mode !== "Sync"}
            value={syncState.division}
            onChange={(event) => onSyncSettings(syncTarget.key, { division: event.target.value })}
          >
            <option>1/4</option>
            <option>1/8</option>
            <option>1/8 dotted</option>
            <option>1/8 triplet</option>
            <option>1/16</option>
          </select>
        </div>
      )}
    </div>
  );
}

function ParameterControl({
  target,
  label,
  baseValue,
  patchBaseValue = baseValue,
  mapping: activeMapping,
  source,
  articulation,
  articulationOverride,
  dropActive = false,
  selected,
  onSelect,
  onBaseChange,
  onMappingAmountChange,
  onReadout,
  variant = "tile",
}) {
  const gesture = useRef(null);
  const modulationEnd = activeMapping
    ? clamp(baseValue + activeMapping.amount * 0.45)
    : baseValue;
  const modulationLeft = Math.min(baseValue, modulationEnd);
  const modulationWidth = Math.abs(modulationEnd - baseValue);
  const hasArticulationOverride = articulationOverride != null;
  const articulationColor = ARTICULATIONS[articulation]?.color || ARTICULATIONS.Default.color;
  const activeSourceColor = sourceColor(source);

  const finishGesture = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    gesture.current = null;
  };

  return (
    <button
      aria-label={"Select " + (label || target.label)}
      className={"parameter-control parameter-" + variant}
      data-articulation-override={hasArticulationOverride}
      data-drop-active={dropActive}
      data-modulation-target={target.key}
      data-selected={selected}
      onClick={onSelect}
      style={{
        "--source-color": activeSourceColor,
        "--articulation-color": articulationColor,
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const nextBase = clamp(baseValue + (event.key === "ArrowRight" ? 1 : -1));
        onBaseChange(nextBase);
        onReadout((label || target.label) + " base " + formatValue(target, nextBase));
      }}
      onPointerDown={(event) => {
        onSelect();
        const bounds = event.currentTarget.getBoundingClientRect();
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          width: bounds.width,
          height: bounds.height,
          base: baseValue,
          amount: activeMapping?.amount ?? 0,
          axis: null,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (!current.axis && Math.hypot(dx, dy) >= 6) {
          current.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
          haptic("light");
        }
        if (current.axis === "x") {
          const nextBase = clamp(current.base + (dx / current.width) * 100);
          onBaseChange(nextBase);
          onReadout((label || target.label) + " base " + formatValue(target, nextBase));
        }
        if (current.axis === "y") {
          if (!activeMapping) {
            onReadout((label || target.label) + ": select a modulation source below");
            return;
          }
          const nextAmount = clamp(
            current.amount - (dy / Math.max(current.height, 44)) * 100,
            -100,
            100,
          );
          onMappingAmountChange(nextAmount);
          onReadout(
            source.label + " → " + (label || target.label) + " " +
            (nextAmount > 0 ? "+" : "") + Math.round(nextAmount) + "%",
          );
        }
      }}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
    >
      <span className="parameter-control-heading">
        <span>{label || target.label}</span>
        <span className="parameter-control-marks">
          {hasArticulationOverride && (
            <span className="articulation-mark" title={articulation + " override"}>
              <ArticulationIcon articulation={articulation} />
            </span>
          )}
          {activeMapping && <SourceMark source={source} />}
        </span>
      </span>
      <span className="parameter-track" aria-hidden="true">
        <span className="base-fill" style={{ width: baseValue + "%" }} />
        <span
          className="modulation-band"
          style={{ left: modulationLeft + "%", width: Math.max(modulationWidth, activeMapping ? 2 : 0) + "%" }}
        />
        <span className="default-tick" style={{ left: target.defaultValue + "%" }} />
        {hasArticulationOverride && (
          <span className="patch-base-position" style={{ left: patchBaseValue + "%" }} />
        )}
        <span className="base-position" style={{ left: baseValue + "%" }} />
      </span>
      <span className="parameter-gesture-hint">
        X base
        <span>{activeMapping ? "Y " + (activeMapping.amount > 0 ? "+" : "") + Math.round(activeMapping.amount) + "%" : "Y no source"}</span>
      </span>
    </button>
  );
}

function ModuleEditor({
  module,
  selectedTarget,
  baseValues,
  patchBaseValues,
  articulation,
  articulationOverrides,
  dropTargetKey,
  mappings,
  sourceLookup,
  activeSourceByTarget,
  readout,
  sourceReturn,
  syncSettings,
  onSyncSettings,
  onSelectTarget,
  onBaseChange,
  onMappingAmountChange,
  onReadout,
  onReturnToSource,
}) {
  return (
    <section className="primary-editor" aria-label={module.label + " editor"}>
      <header className="editor-heading">
        <div>
          <strong>{module.label}</strong>
          <small>{module.workspace === "effects" ? "Global effect · patch base" : "Per-note voice module"}</small>
        </div>
        <div className="editor-heading-actions">
          <output aria-live="polite">{readout || "Exact value appears while dragging"}</output>
          {sourceReturn && (
            <button className="source-return-button" onClick={onReturnToSource}>
              Back to {sourceReturn.label}
            </button>
          )}
        </div>
      </header>

      <DirectPad
        module={module}
        baseValues={baseValues}
        syncSettings={syncSettings}
        onSyncSettings={onSyncSettings}
        onChange={onBaseChange}
        onReadout={onReadout}
        onSelect={onSelectTarget}
      />

      <div className="parameter-grid" aria-label={module.label + " parameters"}>
        {module.params.map((param) => {
          const target = TARGETS[module.id + "." + param.id];
          const targetMappings = mappings.filter((item) => item.targetKey === target.key);
          const activeSourceId =
            activeSourceByTarget[target.key] ||
            targetMappings[0]?.sourceId ||
            null;
          const activeMapping = targetMappings.find((item) => item.sourceId === activeSourceId) || null;
          const source = activeMapping ? sourceLookup[activeMapping.sourceId] : null;
          return (
            <ParameterControl
              key={target.key}
              target={target}
              baseValue={baseValues[target.key]}
              patchBaseValue={patchBaseValues[target.key]}
              mapping={activeMapping}
              source={source}
              articulation={articulation}
              articulationOverride={articulationOverrides[target.key]}
              dropActive={dropTargetKey === target.key}
              selected={selectedTarget.key === target.key}
              onSelect={() => onSelectTarget(target)}
              onBaseChange={(value) => onBaseChange(target.key, value)}
              onMappingAmountChange={(amount) => onMappingAmountChange(activeMapping.id, amount)}
              onReadout={onReadout}
            />
          );
        })}
      </div>
    </section>
  );
}

function MappingCard({
  mapping: activeMapping,
  source,
  target,
  onUpdate,
  onRemove,
  onOpenSource,
  onReadout,
}) {
  if (!activeMapping) return null;

  return (
    <div className="mapping-card" style={{ "--source-color": sourceColor(source) }}>
      <button aria-label={"Edit " + source.label} className="source-preview" onClick={() => onOpenSource(source)}>
        <SourceIcon source={source} size={30} />
        <strong>{source.label}</strong>
        <span>{source.type === "mseg" ? "Shape thumbnail" : source.type === "macro" ? "Macro position" : "Source preview"}</span>
      </button>
      <div className="mapping-settings">
        <label>
          Amount
          <WireRange
            ariaLabel={source.label + " mapping amount"}
            minimum={-100}
            maximum={100}
            defaultValue={0}
            color={sourceColor(source)}
            value={activeMapping.amount}
            onInput={(event) => {
              const amount = Number(event.target.value);
              onUpdate({ amount });
              onReadout(
                source.label + " amount " +
                (amount > 0 ? "+" : "") + Math.round(amount) + "%",
              );
            }}
          />
          <output>{activeMapping.amount > 0 ? "+" : ""}{Math.round(activeMapping.amount)}%</output>
        </label>
        <div className="mapping-options">
          <select
            aria-label="Mapping polarity"
            value={activeMapping.polarity}
            onChange={(event) => onUpdate({ polarity: event.target.value })}
          >
            <option>Bipolar</option>
            <option>Unipolar</option>
          </select>
          {mappingNeedsReducer(source, target) && (
            <select
              aria-label="MPE reducer"
              value={activeMapping.reducer}
              onChange={(event) => onUpdate({ reducer: event.target.value })}
            >
              <option>Max</option>
              <option>Mean</option>
            </select>
          )}
          <button onClick={onRemove}>Remove</button>
        </div>
      </div>
    </div>
  );
}

function MappingChips({
  mappings,
  sourceLookup,
  activeSourceId,
  leading,
  onActivate,
  onChoose,
  onToggleAdd,
  onAmountChange,
  onReadout,
}) {
  const gesture = useRef(null);

  const finishGesture = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    gesture.current = null;
  };

  return (
    <div className="mapping-chips">
      {leading}
      {mappings.map((item) => {
        const source = sourceLookup[item.sourceId];
        return (
          <button
            aria-label={source.label}
            data-selected={activeSourceId === item.sourceId}
            key={item.id}
            onClick={() => onChoose(item.sourceId)}
            style={{ "--source-color": sourceColor(source) }}
            onPointerDown={(event) => {
              onActivate(item.sourceId);
              gesture.current = {
                pointerId: event.pointerId,
                startY: event.clientY,
                amount: item.amount,
                height: Math.max(event.currentTarget.getBoundingClientRect().height, 32),
              };
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              const current = gesture.current;
              if (!current || current.pointerId !== event.pointerId) return;
              const deltaY = event.clientY - current.startY;
              if (Math.abs(deltaY) < 4) return;
              if (!current.locked) {
                current.locked = true;
                haptic("light");
              }
              const nextAmount = clamp(current.amount - (deltaY / current.height) * 100, -100, 100);
              onAmountChange(item.id, nextAmount);
              onReadout(
                source.label + " → " +
                (nextAmount > 0 ? "+" : "") + Math.round(nextAmount) + "%",
              );
            }}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
          >
            <SourceMark source={source} />
            <span className="mapping-chip-label">{source.label}</span>
            <output>{item.amount > 0 ? "+" : ""}{Math.round(item.amount)}%</output>
          </button>
        );
      })}
      <button aria-label="Add modulation source mapping" onClick={onToggleAdd}><Plus aria-hidden="true" size={15} /></button>
    </div>
  );
}

function ParameterContext({
  target,
  mappings,
  sourceLookup,
  patchSources,
  activeSourceId,
  articulation,
  articulationOverride,
  onChoose,
  onAdd,
  onUpdate,
  onRemove,
  onOpenSource,
  onClearArticulationOverride,
  onReadout,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [expandedSourceId, setExpandedSourceId] = useState(null);
  const expandedMapping = mappings.find((item) => item.sourceId === expandedSourceId) || null;
  const source = expandedMapping ? sourceLookup[expandedMapping.sourceId] : null;
  const availableSources = patchSources.filter(
    (candidate) => !mappings.some((item) => item.sourceId === candidate.id),
  );

  useEffect(() => {
    setExpandedSourceId(null);
    setAddOpen(false);
  }, [target.key]);

  return (
    <section className="context-editor" aria-label={target.label + " modulation mappings"}>
      <MappingChips
        mappings={mappings}
        sourceLookup={sourceLookup}
        activeSourceId={activeSourceId}
        leading={articulationOverride != null ? (
          <button
            aria-label={"Clear " + articulation + " override"}
            className="articulation-override-chip"
            onClick={onClearArticulationOverride}
            style={{ "--articulation-color": ARTICULATIONS[articulation]?.color }}
          >
            <ArticulationIcon articulation={articulation} />
            <span>{articulation}</span>
            <span>Reset</span>
          </button>
        ) : null}
        onActivate={onChoose}
        onChoose={(sourceId) => {
          onChoose(sourceId);
          setExpandedSourceId((current) => current === sourceId ? null : sourceId);
        }}
        onToggleAdd={() => setAddOpen((open) => !open)}
        onAmountChange={(mappingId, amount) => onUpdate(mappingId, { amount })}
        onReadout={onReadout}
      />
      {addOpen && (
        <div className="mapping-add-menu" role="menu" aria-label="Choose modulation source">
          {availableSources.map((candidate) => (
            <button
              key={candidate.id}
              onClick={() => {
                onAdd(candidate.id);
                setExpandedSourceId(candidate.id);
                setAddOpen(false);
              }}
            >
              <SourceMark source={candidate} />
              {candidate.label}
            </button>
          ))}
          {availableSources.length === 0 && <span>Every source is already mapped.</span>}
        </div>
      )}
      <MappingCard
        mapping={expandedMapping}
        source={source}
        target={target}
        onUpdate={(patch) => onUpdate(expandedMapping.id, patch)}
        onRemove={() => {
          onRemove(expandedMapping.id);
          setExpandedSourceId(null);
        }}
        onOpenSource={onOpenSource}
        onReadout={onReadout}
      />
    </section>
  );
}

const defaultSourceSettings = (source) => {
  if (source.type === "macro") return { value: 45 };
  if (source.type === "envelope") return { attack: 20, decay: 32, sustain: 65, release: 35 };
  if (source.type === "fixed") return { value: 52 };
  return { time: 55, scale: 80, curve: 50 };
};

function SourcePrimary({ source, onReadout }) {
  const canvasRef = useRef(null);
  const gesture = useRef(null);
  const [settings, setSettings] = useState(() => defaultSourceSettings(source));
  const color = sourceColor(source);

  useEffect(() => setSettings(defaultSourceSettings(source)), [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      const context = canvas.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      context.strokeStyle = color;
      context.fillStyle = "white";
      context.lineWidth = 2;
      const left = 16;
      const right = bounds.width - 16;
      const top = 16;
      const bottom = bounds.height - 28;
      const width = right - left;
      const height = bottom - top;
      const handle = (x, y) => {
        context.fillRect(x - 4, y - 4, 8, 8);
        context.strokeRect(x - 4, y - 4, 8, 8);
      };

      context.save();
      context.globalAlpha = 0.16;
      context.strokeStyle = getComputedStyle(canvas).getPropertyValue("--ink").trim() || "#171717";
      context.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach((position) => {
        context.beginPath();
        context.moveTo(left + width * position, top);
        context.lineTo(left + width * position, bottom);
        context.stroke();
      });
      context.restore();
      context.strokeStyle = color;
      context.fillStyle = "white";

      if (source.type === "envelope") {
        const attackX = left + width * (0.08 + settings.attack * 0.0022);
        const decayX = attackX + width * (0.08 + settings.decay * 0.0016);
        const sustainY = bottom - height * (settings.sustain / 100);
        const releaseX = left + width * (0.73 + settings.release * 0.0022);
        const points = [
          { x: left, y: bottom },
          { x: attackX, y: top },
          { x: decayX, y: sustainY },
          { x: left + width * 0.7, y: sustainY },
          { x: releaseX, y: bottom },
        ];
        context.beginPath();
        points.forEach((point, index) => index === 0
          ? context.moveTo(point.x, point.y)
          : context.lineTo(point.x, point.y));
        context.stroke();
        points.slice(1).forEach((point) => handle(point.x, point.y));
      } else if (source.type === "macro" || source.type === "fixed") {
        const value = settings.value / 100;
        const y = top + height * 0.52;
        context.lineWidth = 1;
        context.strokeRect(left, y - 6, width, 12);
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(left + width * value, y);
        context.stroke();
        handle(left + width * value, y);
      } else {
        const scale = settings.scale / 100;
        const curve = (settings.curve - 50) / 50;
        const points = [
          [0, 0.72],
          [0.16, 0.18 + curve * 0.08],
          [0.34, 0.62 - scale * 0.32],
          [0.55, 0.32 + curve * 0.12],
          [0.73, 0.76 - scale * 0.28],
          [1, 0.2 + (1 - scale) * 0.28],
        ];
        context.beginPath();
        points.forEach(([x, y], index) => index === 0
          ? context.moveTo(left + x * width, top + y * height)
          : context.lineTo(left + x * width, top + y * height));
        context.stroke();
        points.slice(1, -1).forEach(([x, y]) => handle(left + x * width, top + y * height));
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [color, settings, source.type]);

  const updateFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - bounds.left) / bounds.width) * 100);
    const y = clamp((1 - (event.clientY - bounds.top) / bounds.height) * 100);
    if (source.type === "envelope") {
      const stage = gesture.current?.stage || "sustain";
      const patch = stage === "attack"
        ? { attack: clamp(x * 2.6) }
        : stage === "decay"
          ? { decay: clamp((x - 25) * 2.6), sustain: y }
          : stage === "sustain"
            ? { sustain: y }
            : { release: clamp((x - 65) * 2.85) };
      setSettings((current) => ({ ...current, ...patch }));
      const [name, value] = Object.entries(patch).at(-1);
      onReadout(source.label + " · " + name[0].toUpperCase() + name.slice(1) + " " + Math.round(value) + "%");
      return;
    }
    if (source.type === "macro") {
      setSettings({ value: x });
      onReadout(source.label + " · Value " + Math.round(x) + "%");
      return;
    }
    if (source.type === "fixed") return;
    setSettings((current) => ({ ...current, time: x, scale: y }));
    onReadout(source.label + " · Time " + Math.round(x) + "% · Scale " + Math.round(y) + "%");
  };

  const labels = source.type === "envelope"
    ? [["A", settings.attack], ["D", settings.decay], ["S", settings.sustain], ["R", settings.release]]
    : source.type === "macro" || source.type === "fixed"
      ? [["Value", settings.value]]
      : [["Time", settings.time], ["Scale", settings.scale], ["Curve", settings.curve]];

  return (
    <div
      aria-label={source.label + " direct editor"}
      className="source-shape"
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * 100;
        const stage = x < 28 ? "attack" : x < 50 ? "decay" : x < 72 ? "sustain" : "release";
        gesture.current = { pointerId: event.pointerId, stage };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        haptic("light");
        updateFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (gesture.current?.pointerId === event.pointerId) updateFromPointer(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        gesture.current = null;
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
      role="application"
      style={{ "--source-color": color }}
      tabIndex="0"
    >
      <canvas aria-hidden="true" ref={canvasRef} />
      <div className="source-stage-readouts">
        {labels.map(([label, value]) => (
          <span key={label}><strong>{label}</strong> {Math.round(value)}</span>
        ))}
      </div>
    </div>
  );
}

function SourceEditor({
  source,
  returnModule,
  targetMappings,
  baseValues,
  patchBaseValues,
  articulation,
  articulationOverrides,
  dropTargetKey,
  sourceLookup,
  availableTargets,
  readout,
  restoreTargetKey,
  restoreScrollTop,
  onBack,
  onSelectTarget,
  onOpenTarget,
  onBaseChange,
  onMappingAmountChange,
  onUpdateMapping,
  onRemoveMapping,
  onAddTarget,
  onReadout,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [newTargetKey, setNewTargetKey] = useState(availableTargets[0]?.key || "");
  const [expandedMappingId, setExpandedMappingId] = useState(
    targetMappings.find((item) => item.targetKey === restoreTargetKey)?.id || null,
  );
  const targetContextRef = useRef(null);
  const targetMappingIds = targetMappings.map((item) => item.id).join("|");

  useEffect(() => {
    if (!availableTargets.some((target) => target.key === newTargetKey)) {
      setNewTargetKey(availableTargets[0]?.key || "");
    }
  }, [availableTargets, newTargetKey]);

  useEffect(() => {
    const restored = targetMappings.find((item) => item.targetKey === restoreTargetKey)?.id || null;
    setExpandedMappingId(restored);
    if (targetContextRef.current && restoreScrollTop != null) {
      targetContextRef.current.scrollTop = restoreScrollTop;
    }
  }, [restoreScrollTop, restoreTargetKey, targetMappingIds]);

  return (
    <div className="workspace-stack source-workspace">
      <section className="primary-editor source-primary">
        <header className="editor-heading">
          <div>
            <strong>{source.label} · source editor</strong>
            <small>{targetMappings.length} target{targetMappings.length === 1 ? "" : "s"}</small>
          </div>
          <div className="source-header-actions">
            <output aria-live="polite">{readout}</output>
            <button onClick={onBack}>Back to {returnModule.label}</button>
          </div>
        </header>
        <SourcePrimary source={source} onReadout={onReadout} />
      </section>

      <section className="context-editor target-context" ref={targetContextRef}>
        <header className="context-heading">
          <strong>{source.label} targets</strong>
          <button onClick={() => setAddOpen((open) => !open)}><Plus aria-hidden="true" size={15} /> Target</button>
        </header>
        {addOpen && (
          <div className="target-add-control">
            <select aria-label="New modulation target" value={newTargetKey} onChange={(event) => setNewTargetKey(event.target.value)}>
              {availableTargets.map((target) => (
                <option key={target.key} value={target.key}>{target.moduleLabel} · {target.label}</option>
              ))}
            </select>
            <button
              disabled={!newTargetKey}
              onClick={() => {
                onAddTarget(newTargetKey);
                setAddOpen(false);
              }}
            >
              Add
            </button>
          </div>
        )}
        <div className="target-list">
          {targetMappings.map((item) => {
            const target = TARGETS[item.targetKey];
            const expanded = expandedMappingId === item.id;
            return (
              <article
                className="target-mapping-row"
                data-expanded={expanded}
                key={item.id}
                style={{ "--source-color": sourceColor(source) }}
              >
                <ParameterControl
                  target={target}
                  label={target.moduleLabel + " · " + target.label}
                  baseValue={baseValues[target.key]}
                  patchBaseValue={patchBaseValues[target.key]}
                  mapping={item}
                  source={source}
                  articulation={articulation}
                  articulationOverride={articulationOverrides[target.key]}
                  dropActive={dropTargetKey === target.key}
                  selected={expanded}
                  variant="target"
                  onSelect={() => {
                    onSelectTarget(target);
                    setExpandedMappingId((current) => current === item.id ? null : item.id);
                  }}
                  onBaseChange={(value) => onBaseChange(target.key, value)}
                  onMappingAmountChange={(amount) => onMappingAmountChange(item.id, amount)}
                  onReadout={onReadout}
                />
                <button
                  aria-label={"Open " + target.moduleLabel + " " + target.label}
                  className="target-open-button"
                  onClick={() => onOpenTarget(target, targetContextRef.current?.scrollTop || 0)}
                  title={"Open " + target.moduleLabel}
                >
                  <ArrowSquareOut aria-hidden="true" size={17} />
                </button>
                {expanded && (
                  <div className="target-mapping-options">
                    <select
                      aria-label={target.label + " polarity"}
                      value={item.polarity}
                      onChange={(event) => onUpdateMapping(item.id, { polarity: event.target.value })}
                    >
                      <option>Bipolar</option>
                      <option>Unipolar</option>
                    </select>
                    {mappingNeedsReducer(source, target) && (
                      <select
                        aria-label={target.label + " reducer"}
                        value={item.reducer}
                        onChange={(event) => onUpdateMapping(item.id, { reducer: event.target.value })}
                      >
                        <option>Max</option>
                        <option>Mean</option>
                      </select>
                    )}
                    <button onClick={() => onRemoveMapping(item.id)}>Remove</button>
                  </div>
                )}
              </article>
            );
          })}
          {targetMappings.length === 0 && <div className="empty-card">This source has no targets yet.</div>}
        </div>
      </section>
    </div>
  );
}

function SourceShelf({
  sources,
  mappingCounts,
  focusedSourceId,
  draggedSourceId,
  addOpen,
  deletedSource,
  onFocus,
  onToggleAdd,
  onAdd,
  onDelete,
  onDragStart,
  onDragMove,
  onDrop,
  onUndoDelete,
}) {
  const [contextSourceId, setContextSourceId] = useState(null);
  const longPress = useRef(null);
  const suppressClick = useRef(false);
  const contextSource = sources.find((source) => source.id === contextSourceId) || null;

  useEffect(() => () => window.clearTimeout(longPress.current?.timer), []);

  const cancelLongPress = () => {
    window.clearTimeout(longPress.current?.timer);
    longPress.current = null;
  };

  const beginLongPress = (event, source) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClick.current = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const timer = window.setTimeout(() => {
      suppressClick.current = true;
      setContextSourceId(source.id);
    }, 520);
    longPress.current = { timer, startX, startY, pointerId: event.pointerId, dragging: false };
  };

  const moveLongPress = (event, source) => {
    const current = longPress.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - current.startX,
      event.clientY - current.startY,
    );
    if (distance > 8 && !current.dragging) {
      window.clearTimeout(current.timer);
      current.dragging = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onDragStart(source);
      haptic("light");
    }
    if (current.dragging) onDragMove(event.clientX, event.clientY);
  };

  const finishPointer = (event, cancelled = false) => {
    const current = longPress.current;
    if (current?.dragging) {
      onDrop(cancelled);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
    cancelLongPress();
  };

  return (
    <section className="source-shelf" aria-label="Patch modulation sources">
      <div className="source-list">
        {sources.map((source) => {
          const targetCount = mappingCounts[source.id] || 0;
          return (
            <button
              aria-label={source.label + ", " + targetCount + " targets"}
              data-dragging={draggedSourceId === source.id}
              data-orphan={targetCount === 0}
              data-selected={focusedSourceId === source.id}
              key={source.id}
              onClick={(event) => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  event.preventDefault();
                  return;
                }
                onFocus(source);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                cancelLongPress();
                setContextSourceId(source.id);
              }}
              onPointerDown={(event) => beginLongPress(event, source)}
              onPointerMove={(event) => moveLongPress(event, source)}
              onPointerUp={finishPointer}
              onPointerCancel={(event) => finishPointer(event, true)}
              style={{ "--source-color": sourceColor(source) }}
              title={source.label}
            >
              <SourceIcon source={source} size={22} />
              <span>{source.slot}</span>
              <span className="source-attachment-badge">
                <LinkSimple aria-hidden="true" size={8} />
                {targetCount}
              </span>
            </button>
          );
        })}
        <button aria-label="Add modulation source" onClick={onToggleAdd} title="Add modulation source">
          <Plus aria-hidden="true" size={22} />
        </button>
      </div>
      {addOpen && (
        <div className="source-add-menu" role="menu" aria-label="Add modulation source">
          {[
            { type: "macro", label: "Macro" },
            { type: "envelope", label: "Envelope" },
            { type: "mseg", label: "MSEG" },
          ].map((candidate) => (
            <button key={candidate.type} onClick={() => onAdd(candidate.type)}>
              <SourceIcon source={candidate} />
              {candidate.label}
            </button>
          ))}
          <button onClick={onToggleAdd}>Cancel</button>
        </div>
      )}
      {contextSource && (
        <div className="source-context-menu" role="menu" aria-label={contextSource.label + " actions"}>
          <strong>{contextSource.label}</strong>
          <button
            onClick={() => {
              onDelete(contextSource.id);
              setContextSourceId(null);
            }}
          >
            Delete · {mappingCounts[contextSource.id] || 0} mapping{mappingCounts[contextSource.id] === 1 ? "" : "s"}
          </button>
          <button onClick={() => setContextSourceId(null)}>Cancel</button>
        </div>
      )}
      {deletedSource && (
        <div className="source-undo-toast" role="status">
          <span>{deletedSource.source.label} deleted</span>
          <button onClick={onUndoDelete}>Undo</button>
        </div>
      )}
    </section>
  );
}

function AuditionBar({
  articulation,
  onArticulation,
  note,
  onNote,
  repeat,
  onRepeat,
  latch,
  onLatch,
  onTriggerStart,
  onTriggerEnd,
  canCapture,
  onCapture,
  status,
}) {
  return (
    <section className="audition-bar" aria-label="Persistent audition controls">
      <div className="audition-row">
        <label
          className="articulation-picker"
          style={{ "--articulation-color": ARTICULATIONS[articulation]?.color }}
        >
          Articulation
          <span className="articulation-picker-icon">
            <ArticulationIcon articulation={articulation} />
          </span>
          <select value={articulation} onChange={(event) => onArticulation(event.target.value)}>
            {Object.keys(ARTICULATIONS).map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <button onClick={() => onArticulation("Default")}>Default articulation</button>
        <label>
          Note
          <select value={note} onChange={(event) => onNote(event.target.value)}>
            <option>C2</option>
            <option>C3</option>
            <option>C4</option>
          </select>
        </label>
        <button
          className="trigger-button"
          onPointerDown={onTriggerStart}
          onPointerUp={onTriggerEnd}
          onPointerCancel={onTriggerEnd}
          onPointerLeave={(event) => {
            if (event.buttons) onTriggerEnd(event);
          }}
        >
          Trigger
        </button>
      </div>
      <div className="audition-row">
        <label><input type="checkbox" checked={repeat} onChange={(event) => onRepeat(event.target.checked)} /> Repeat</label>
        <label><input type="checkbox" checked={latch} onChange={(event) => onLatch(event.target.checked)} /> Latch</label>
        <button disabled={!canCapture} onClick={onCapture}>Capture motion</button>
        <output aria-live="polite">{status}</output>
      </div>
    </section>
  );
}

export function App() {
  const [workspace, setWorkspace] = useState("effects");
  const [activeModuleId, setActiveModuleId] = useState("phaser");
  const [effectOrder, setEffectOrder] = useState(EFFECTS.map((effect) => effect.id));
  const [lastModuleByWorkspace, setLastModuleByWorkspace] = useState({
    effects: "phaser",
    voice: "wavetable",
  });
  const [selectedTargetKey, setSelectedTargetKey] = useState("phaser.frequency");
  const [lastTargetByModule, setLastTargetByModule] = useState({
    phaser: "phaser.frequency",
    wavetable: "wavetable.index",
  });
  const [baseValues, setBaseValues] = useState(INITIAL_BASE_VALUES);
  const [articulationOverrides, setArticulationOverrides] = useState({
    Pluck: {},
    Bowed: {},
    Accent: {},
  });
  const [lastTweaked, setLastTweaked] = useState(
    Object.fromEntries(ALL_MODULES.map((module) => [module.id, module.quick])),
  );
  const [enabled, setEnabled] = useState(
    Object.fromEntries(EFFECTS.map((effect) => [effect.id, true])),
  );
  const [mappings, setMappings] = useState(INITIAL_MAPPINGS);
  const [activeSourceByTarget, setActiveSourceByTarget] = useState(INITIAL_ACTIVE_SOURCES);
  const [sources, setSources] = useState(INITIAL_SOURCES);
  const [sourceFocusId, setSourceFocusId] = useState(null);
  const [returnContext, setReturnContext] = useState(null);
  const [sourceNavigation, setSourceNavigation] = useState(null);
  const [sourceAddOpen, setSourceAddOpen] = useState(false);
  const sourceDrag = useRef(null);
  const [draggedSourceId, setDraggedSourceId] = useState(null);
  const [dropTargetKey, setDropTargetKey] = useState(null);
  const [deletedSource, setDeletedSource] = useState(null);
  const [readout, setReadout] = useState("");
  const readoutTimer = useRef(null);
  const [syncSettings, setSyncSettings] = useState({});
  const [articulation, setArticulation] = useState("Pluck");
  const [note, setNote] = useState("C3");
  const [repeat, setRepeat] = useState(false);
  const [latch, setLatch] = useState(false);
  const triggerHeld = useRef(false);
  const [captureCandidate, setCaptureCandidate] = useState(null);
  const [auditionStatus, setAuditionStatus] = useState("Buffer waiting for a note");

  useEffect(() => () => window.clearTimeout(readoutTimer.current), []);

  const sourceLookup = useMemo(
    () => Object.fromEntries([...sources, ...FIXED_SOURCES].map((source) => [source.id, source])),
    [sources],
  );
  const orderedEffects = useMemo(
    () => effectOrder.map((id) => MODULES_BY_ID[id]),
    [effectOrder],
  );
  const activeArticulationOverrides = articulation === "Default"
    ? {}
    : articulationOverrides[articulation] || {};
  const effectiveValues = useMemo(
    () => ({ ...baseValues, ...activeArticulationOverrides }),
    [activeArticulationOverrides, baseValues],
  );
  const mappingCounts = useMemo(
    () => mappings.reduce((counts, item) => ({
      ...counts,
      [item.sourceId]: (counts[item.sourceId] || 0) + 1,
    }), {}),
    [mappings],
  );
  const activeModule = MODULES_BY_ID[activeModuleId];
  const selectedTarget = TARGETS[selectedTargetKey] || TARGETS[activeModule.id + "." + activeModule.params[0].id];
  const selectedMappings = mappings.filter((item) => item.targetKey === selectedTarget.key);
  const activeSourceId =
    activeSourceByTarget[selectedTarget.key] ||
    selectedMappings[0]?.sourceId ||
    null;
  const sourceFocus = sourceFocusId ? sourceLookup[sourceFocusId] : null;
  const sourceReturn = sourceNavigation ? sourceLookup[sourceNavigation.sourceId] : null;
  const returnModule = returnContext
    ? MODULES_BY_ID[returnContext.moduleId]
    : activeModule;
  const sourceTargetMappings = sourceFocus
    ? mappings.filter((item) => item.sourceId === sourceFocus.id)
    : [];
  const sourceAvailableTargets = sourceFocus
    ? Object.values(TARGETS).filter(
        (target) => !mappings.some(
          (item) => item.sourceId === sourceFocus.id && item.targetKey === target.key,
        ),
      )
    : [];

  const showReadout = (text) => {
    setReadout(text);
    window.clearTimeout(readoutTimer.current);
    readoutTimer.current = window.setTimeout(() => setReadout(""), 1400);
  };

  const markMotion = (targetKey, layer) => {
    if (!triggerHeld.current) return;
    const target = TARGETS[targetKey];
    const candidate = { targetKey, layer, articulation };
    setCaptureCandidate(candidate);
    setAuditionStatus(
      "Recording: " + layer + " · " + target.moduleLabel + " " + target.label,
    );
  };

  const selectTarget = (target) => {
    setSelectedTargetKey(target.key);
    setLastTargetByModule((current) => ({ ...current, [target.moduleId]: target.key }));
  };

  const changeBase = (targetKey, value) => {
    const target = TARGETS[targetKey];
    const nextValue = clamp(value);
    const editsArticulation = articulation !== "Default" && target.workspace === "voice";
    if (editsArticulation) {
      setArticulationOverrides((current) => ({
        ...current,
        [articulation]: {
          ...current[articulation],
          [targetKey]: nextValue,
        },
      }));
    } else {
      setBaseValues((current) => ({ ...current, [targetKey]: nextValue }));
    }
    setLastTweaked((current) => ({ ...current, [target.moduleId]: target.id }));
    markMotion(targetKey, editsArticulation ? articulation + " override" : "Patch base");
  };

  const clearArticulationOverride = (targetKey) => {
    if (articulation === "Default") return;
    setArticulationOverrides((current) => {
      const nextArticulation = { ...current[articulation] };
      delete nextArticulation[targetKey];
      return { ...current, [articulation]: nextArticulation };
    });
    const target = TARGETS[targetKey];
    showReadout(articulation + " · " + target.label + " override cleared");
    haptic("success");
  };

  const updateMapping = (mappingId, patch) => {
    setMappings((current) =>
      current.map((item) => item.id === mappingId ? { ...item, ...patch } : item),
    );
  };

  const focusModule = (module) => {
    setWorkspace(module.workspace);
    setActiveModuleId(module.id);
    setLastModuleByWorkspace((current) => ({ ...current, [module.workspace]: module.id }));
    const targetKey =
      lastTargetByModule[module.id] ||
      module.id + "." + module.quick;
    setSelectedTargetKey(targetKey);
    setSourceFocusId(null);
    setReturnContext(null);
    setSourceNavigation(null);
  };

  const chooseWorkspace = (nextWorkspace) => {
    const moduleId = lastModuleByWorkspace[nextWorkspace];
    const module = MODULES_BY_ID[moduleId];
    focusModule(module);
  };

  const reorderEffect = (movingId, overId) => {
    setEffectOrder((current) => {
      const fromIndex = current.indexOf(movingId);
      const toIndex = current.indexOf(overId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const next = [...current];
      const [moving] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moving);
      return next;
    });
  };

  const openSource = (source) => {
    if (!sourceFocusId) {
      setReturnContext({
        workspace,
        moduleId: activeModule.id,
        targetKey: selectedTarget.key,
      });
    }
    setSourceNavigation(null);
    setSourceFocusId(source.id);
  };

  const returnFromSource = () => {
    if (returnContext) {
      setWorkspace(returnContext.workspace);
      setActiveModuleId(returnContext.moduleId);
      setSelectedTargetKey(returnContext.targetKey);
    }
    setSourceFocusId(null);
    setReturnContext(null);
    setSourceNavigation(null);
  };

  const openTargetFromSource = (target, sourceId, scrollTop = 0) => {
    const module = MODULES_BY_ID[target.moduleId];
    setSourceNavigation({ sourceId, targetKey: target.key, scrollTop });
    setWorkspace(module.workspace);
    setActiveModuleId(module.id);
    setLastModuleByWorkspace((current) => ({ ...current, [module.workspace]: module.id }));
    setSelectedTargetKey(target.key);
    setLastTargetByModule((current) => ({ ...current, [module.id]: target.key }));
    setActiveSourceByTarget((current) => ({ ...current, [target.key]: sourceId }));
    setSourceFocusId(null);
  };

  const returnToSource = () => {
    if (!sourceNavigation) return;
    setSourceFocusId(sourceNavigation.sourceId);
    haptic("light");
  };

  const addMapping = (targetKey, sourceId, amount = 25) => {
    const id = targetKey + "::" + sourceId;
    if (!mappings.some((item) => item.id === id)) {
      setMappings((current) => [...current, mapping(targetKey, sourceId, amount, "Unipolar", "Max")]);
    }
    setActiveSourceByTarget((current) => ({ ...current, [targetKey]: sourceId }));
  };

  const beginSourceDrag = (source) => {
    sourceDrag.current = { sourceId: source.id, targetKey: null };
    setDraggedSourceId(source.id);
    setDropTargetKey(null);
    setSourceAddOpen(false);
  };

  const moveSourceDrag = (clientX, clientY) => {
    if (!sourceDrag.current) return;
    const targetElement = document
      .elementFromPoint(clientX, clientY)
      ?.closest?.("[data-modulation-target]");
    const targetKey = targetElement?.getAttribute("data-modulation-target") || null;
    if (targetKey === sourceDrag.current.targetKey) return;
    sourceDrag.current.targetKey = targetKey;
    setDropTargetKey(targetKey);
    if (targetKey) haptic("light");
  };

  const finishSourceDrag = (cancelled = false) => {
    const current = sourceDrag.current;
    if (!cancelled && current?.targetKey) {
      const target = TARGETS[current.targetKey];
      selectTarget(target);
      addMapping(current.targetKey, current.sourceId);
      showReadout(sourceLookup[current.sourceId].label + " → " + target.moduleLabel + " " + target.label);
      haptic("success");
    }
    sourceDrag.current = null;
    setDraggedSourceId(null);
    setDropTargetKey(null);
  };

  const removeMapping = (mappingId) => {
    const item = mappings.find((candidate) => candidate.id === mappingId);
    setMappings((current) => current.filter((candidate) => candidate.id !== mappingId));
    if (item) {
      const replacement = mappings.find(
        (candidate) => candidate.targetKey === item.targetKey && candidate.id !== mappingId,
      );
      setActiveSourceByTarget((current) => ({
        ...current,
        [item.targetKey]: replacement?.sourceId || null,
      }));
    }
  };

  const addSource = (type) => {
    const limits = { macro: 4, envelope: 3, mseg: 3 };
    const existing = sources.filter((source) => source.type === type).length;
    if (existing >= limits[type]) {
      setAuditionStatus(type.toUpperCase() + " slots are full");
      setSourceAddOpen(false);
      return;
    }
    const occupiedSlots = new Set(
      sources.filter((source) => source.type === type).map((source) => source.slot),
    );
    const slot = Array.from({ length: limits[type] }, (_, index) => index + 1)
      .find((candidate) => !occupiedSlots.has(candidate));
    const labels = { macro: "Macro", envelope: "Envelope", mseg: "MSEG" };
    const source = {
      id: type + "-" + slot,
      type,
      slot,
      label: labels[type] + " " + slot,
    };
    setSources((current) => [...current, source]);
    setSourceAddOpen(false);
    openSource(source);
  };

  const deleteSource = (sourceId) => {
    const source = sources.find((candidate) => candidate.id === sourceId);
    const removedMappings = mappings.filter((item) => item.sourceId === sourceId);
    const remainingMappings = mappings.filter((item) => item.sourceId !== sourceId);
    setDeletedSource({ source, mappings: removedMappings });
    setSources((current) => current.filter((candidate) => candidate.id !== sourceId));
    setMappings(remainingMappings);
    setActiveSourceByTarget((current) => Object.fromEntries(
      Object.entries(current).map(([targetKey, activeId]) => {
        if (activeId !== sourceId) return [targetKey, activeId];
        const replacement = remainingMappings.find((item) => item.targetKey === targetKey);
        return [targetKey, replacement?.sourceId || null];
      }),
    ));
    if (sourceFocusId === sourceId) returnFromSource();
    setAuditionStatus((source?.label || "Source") + " deleted");
  };

  const undoDeleteSource = () => {
    if (!deletedSource) return;
    const typeOrder = { macro: 0, envelope: 1, mseg: 2 };
    setSources((current) => [...current, deletedSource.source].sort((left, right) =>
      typeOrder[left.type] - typeOrder[right.type] || left.slot - right.slot));
    setMappings((current) => [...current, ...deletedSource.mappings]);
    setAuditionStatus(deletedSource.source.label + " restored");
    setDeletedSource(null);
    haptic("success");
  };

  const captureMotion = () => {
    if (!captureCandidate) return;
    const occupiedSlots = new Set(
      sources.filter((source) => source.type === "mseg").map((source) => source.slot),
    );
    const slot = [1, 2, 3].find((candidate) => !occupiedSlots.has(candidate)) || 3;
    const sourceId = "mseg-" + slot;
    if (!sources.some((source) => source.id === sourceId)) {
      setSources((current) => [
        ...current,
        { id: sourceId, type: "mseg", slot, label: "MSEG " + slot },
      ]);
    }
    addMapping(captureCandidate.targetKey, sourceId, 100);
    const target = TARGETS[captureCandidate.targetKey];
    setCaptureCandidate(null);
    setAuditionStatus(
      "Captured " + target.moduleLabel + " " + target.label + " as MSEG " + slot,
    );
    haptic("success");
  };

  return (
    <main
      className="mobile-prototype"
      data-source-dragging={Boolean(draggedSourceId)}
      style={{
        "--drag-source-color": sourceColor(sourceLookup[draggedSourceId]),
      }}
    >
      <GlobalHeader
        workspace={workspace}
        onWorkspace={chooseWorkspace}
      />

      {workspace === "effects" ? (
        <EffectRack
          effects={orderedEffects}
          activeModuleId={activeModuleId}
          enabled={enabled}
          baseValues={baseValues}
          lastTweaked={lastTweaked}
          onEnable={(id, checked) => setEnabled((current) => ({ ...current, [id]: checked }))}
          onFocus={focusModule}
          onQuickChange={changeBase}
          onReorder={reorderEffect}
          onReadout={showReadout}
        />
      ) : (
        <VoiceStrip
          activeModuleId={activeModuleId}
          baseValues={effectiveValues}
          lastTweaked={lastTweaked}
          onFocus={focusModule}
        />
      )}

      {sourceFocus ? (
        <SourceEditor
          source={sourceFocus}
          returnModule={returnModule}
          targetMappings={sourceTargetMappings}
          baseValues={effectiveValues}
          patchBaseValues={baseValues}
          articulation={articulation}
          articulationOverrides={activeArticulationOverrides}
          dropTargetKey={dropTargetKey}
          sourceLookup={sourceLookup}
          availableTargets={sourceAvailableTargets}
          readout={readout}
          restoreTargetKey={sourceNavigation?.targetKey}
          restoreScrollTop={sourceNavigation?.scrollTop}
          onBack={returnFromSource}
          onSelectTarget={(target) => {
            selectTarget(target);
            setActiveSourceByTarget((current) => ({ ...current, [target.key]: sourceFocus.id }));
          }}
          onOpenTarget={(target, scrollTop) => openTargetFromSource(target, sourceFocus.id, scrollTop)}
          onBaseChange={changeBase}
          onMappingAmountChange={(id, amount) => updateMapping(id, { amount })}
          onUpdateMapping={updateMapping}
          onRemoveMapping={removeMapping}
          onAddTarget={(targetKey) => addMapping(targetKey, sourceFocus.id)}
          onReadout={showReadout}
        />
      ) : (
        <div className="workspace-stack">
          <ModuleEditor
            module={activeModule}
            selectedTarget={selectedTarget}
            baseValues={effectiveValues}
            patchBaseValues={baseValues}
            articulation={articulation}
            articulationOverrides={activeArticulationOverrides}
            dropTargetKey={dropTargetKey}
            mappings={mappings}
            sourceLookup={sourceLookup}
            activeSourceByTarget={activeSourceByTarget}
            readout={readout}
            sourceReturn={sourceReturn}
            syncSettings={syncSettings}
            onSyncSettings={(targetKey, patch) => setSyncSettings((current) => ({
              ...current,
              [targetKey]: { mode: "Free", division: "1/8", ...current[targetKey], ...patch },
            }))}
            onSelectTarget={selectTarget}
            onBaseChange={changeBase}
            onMappingAmountChange={(id, amount) => updateMapping(id, { amount })}
            onReadout={showReadout}
            onReturnToSource={returnToSource}
          />
          <ParameterContext
            target={selectedTarget}
            mappings={selectedMappings}
            sourceLookup={sourceLookup}
            patchSources={sources}
            activeSourceId={activeSourceId}
            articulation={articulation}
            articulationOverride={activeArticulationOverrides[selectedTarget.key]}
            onChoose={(sourceId) => setActiveSourceByTarget((current) => ({ ...current, [selectedTarget.key]: sourceId }))}
            onAdd={(sourceId) => addMapping(selectedTarget.key, sourceId)}
            onUpdate={updateMapping}
            onRemove={removeMapping}
            onOpenSource={openSource}
            onClearArticulationOverride={() => clearArticulationOverride(selectedTarget.key)}
            onReadout={showReadout}
          />
        </div>
      )}

      <SourceShelf
        sources={sources}
        mappingCounts={mappingCounts}
        focusedSourceId={sourceFocusId}
        draggedSourceId={draggedSourceId}
        addOpen={sourceAddOpen}
        deletedSource={deletedSource}
        onFocus={openSource}
        onToggleAdd={() => setSourceAddOpen((open) => !open)}
        onAdd={addSource}
        onDelete={deleteSource}
        onDragStart={beginSourceDrag}
        onDragMove={moveSourceDrag}
        onDrop={finishSourceDrag}
        onUndoDelete={undoDeleteSource}
      />

      <AuditionBar
        articulation={articulation}
        onArticulation={setArticulation}
        note={note}
        onNote={setNote}
        repeat={repeat}
        onRepeat={setRepeat}
        latch={latch}
        onLatch={setLatch}
        onTriggerStart={() => {
          triggerHeld.current = true;
          setCaptureCandidate(null);
          setAuditionStatus(note + " held · move a parameter to record");
          haptic("light");
        }}
        onTriggerEnd={() => {
          triggerHeld.current = false;
          setAuditionStatus((current) => current.startsWith("Recording:")
            ? current.replace("Recording:", "Ready:")
            : "Buffer waiting for a parameter gesture");
        }}
        canCapture={Boolean(captureCandidate)}
        onCapture={captureMotion}
        status={auditionStatus}
      />
    </main>
  );
}
