import { useMemo, useRef } from "react";

const clamp = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, value));

const PLOT = Object.freeze({ left: 18, right: 342, top: 18, bottom: 164 });

function point(x, y) {
  return `${x},${y}`;
}

function sourceReadouts(source, settings) {
  if (source.type === "envelope") {
    return [
      ["A", settings.attack],
      ["D", settings.decay],
      ["S", settings.sustain],
      ["R", settings.release],
    ];
  }
  if (source.type === "macro" || source.type === "fixed") {
    return [["VALUE", settings.value]];
  }
  return [
    ["TIME", settings.time],
    ["SCALE", settings.scale],
    ["CURVE", settings.curve],
  ];
}

function SourceShape({ source, settings }) {
  const width = PLOT.right - PLOT.left;
  const height = PLOT.bottom - PLOT.top;

  if (source.type === "envelope") {
    const attackX = PLOT.left + width * (0.08 + settings.attack * 0.0022);
    const decayX = attackX + width * (0.08 + settings.decay * 0.0016);
    const sustainY = PLOT.bottom - height * (settings.sustain / 100);
    const releaseX = PLOT.left + width * (0.73 + settings.release * 0.0022);
    const points = [
      [PLOT.left, PLOT.bottom],
      [attackX, PLOT.top],
      [decayX, sustainY],
      [PLOT.left + width * 0.7, sustainY],
      [releaseX, PLOT.bottom],
    ];
    return (
      <g>
        <polyline className="cosimo-source-shape__line" points={points.map(([x, y]) => point(x, y)).join(" ")} />
        {points.slice(1).map(([x, y], index) => (
          <rect
            className="cosimo-source-shape__handle"
            height="8"
            key={`${x}-${y}-${index}`}
            width="8"
            x={x - 4}
            y={y - 4}
          />
        ))}
      </g>
    );
  }

  if (source.type === "macro" || source.type === "fixed") {
    const x = PLOT.left + width * (settings.value / 100);
    const y = PLOT.top + height * 0.5;
    return (
      <g>
        <line className="cosimo-source-shape__track" x1={PLOT.left} x2={PLOT.right} y1={y} y2={y} />
        <line className="cosimo-source-shape__line" x1={PLOT.left} x2={x} y1={y} y2={y} />
        <rect className="cosimo-source-shape__handle" height="10" width="10" x={x - 5} y={y - 5} />
      </g>
    );
  }

  const scale = settings.scale / 100;
  const curve = (settings.curve - 50) / 50;
  const points = [
    [0, 0.72],
    [0.16, 0.18 + curve * 0.08],
    [0.34, 0.62 - scale * 0.32],
    [0.55, 0.32 + curve * 0.12],
    [0.73, 0.76 - scale * 0.28],
    [1, 0.2 + (1 - scale) * 0.28],
  ].map(([x, y]) => [PLOT.left + x * width, PLOT.top + y * height]);
  return (
    <g>
      <polyline className="cosimo-source-shape__line" points={points.map(([x, y]) => point(x, y)).join(" ")} />
      {points.slice(1, -1).map(([x, y], index) => (
        <rect
          className="cosimo-source-shape__handle"
          height="8"
          key={`${x}-${y}-${index}`}
          width="8"
          x={x - 4}
          y={y - 4}
        />
      ))}
    </g>
  );
}

export function SourceShapeEditor({
  source,
  settings,
  semanticColor,
  onSettingsChange,
  onTransientValue,
  onHaptic,
}) {
  const gesture = useRef(null);
  const readouts = useMemo(() => sourceReadouts(source, settings), [settings, source]);

  const reportChange = (patch) => {
    const [field, value] = Object.entries(patch).at(-1);
    onSettingsChange?.({ sourceId: source.id, patch, field, value });
    onTransientValue?.({
      sourceId: source.id,
      field,
      label: `${source.label} · ${field[0].toUpperCase()}${field.slice(1)}`,
      value,
      formattedValue: `${Math.round(value)}%`,
    });
  };

  const updateFromPointer = (event) => {
    if (source.type === "fixed") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - bounds.left) / bounds.width) * 100);
    const y = clamp((1 - (event.clientY - bounds.top) / bounds.height) * 100);
    if (source.type === "envelope") {
      const stage = gesture.current?.stage || "sustain";
      if (stage === "attack") reportChange({ attack: clamp(x * 2.6) });
      else if (stage === "decay") reportChange({ decay: clamp((x - 25) * 2.6), sustain: y });
      else if (stage === "sustain") reportChange({ sustain: y });
      else reportChange({ release: clamp((x - 65) * 2.85) });
      return;
    }
    if (source.type === "macro") {
      reportChange({ value: x });
      return;
    }
    reportChange({ time: x, scale: y });
  };

  return (
    <div
      aria-label={`${source.label} direct editor`}
      className="cosimo-source-shape"
      data-source-type={source.type}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        gesture.current = null;
      }}
      onPointerDown={(event) => {
        if (source.type === "fixed") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * 100;
        gesture.current = {
          pointerId: event.pointerId,
          stage: x < 28 ? "attack" : x < 50 ? "decay" : x < 72 ? "sustain" : "release",
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        onHaptic?.("light");
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
      role="application"
      style={{ "--cosimo-source-color": semanticColor }}
      tabIndex={source.type === "fixed" ? -1 : 0}
    >
      <svg aria-hidden="true" className="cosimo-source-shape__graphic" preserveAspectRatio="none" viewBox="0 0 360 200">
        <g className="cosimo-source-shape__grid">
          {[0.25, 0.5, 0.75].map((position) => (
            <line
              key={position}
              x1={PLOT.left + (PLOT.right - PLOT.left) * position}
              x2={PLOT.left + (PLOT.right - PLOT.left) * position}
              y1={PLOT.top}
              y2={PLOT.bottom}
            />
          ))}
          <line x1={PLOT.left} x2={PLOT.right} y1={(PLOT.top + PLOT.bottom) / 2} y2={(PLOT.top + PLOT.bottom) / 2} />
        </g>
        <SourceShape settings={settings} source={source} />
      </svg>
      <div className="cosimo-source-shape__readouts">
        {readouts.map(([label, value]) => (
          <span key={label}>
            <span className="cosimo-type-label">{label}</span>
            <span className="cosimo-value" data-value-kind="percent">{Math.round(value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
