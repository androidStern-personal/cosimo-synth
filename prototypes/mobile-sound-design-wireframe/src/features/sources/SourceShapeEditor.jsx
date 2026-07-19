import { useRef, useState } from "react";
import { EditableMsegSurface } from "../../../../../ui/shared/synth-components.tsx";
import { useMsegEditorInteractions } from "../../../../../ui/shared/synth-hooks.ts";
import { useAxisDrag } from "../../interactions/useAxisDrag.js";
import { createMsegPortController } from "./msegPortController.js";

const ENVELOPE_MIN_SECONDS = 0.001;
const ENVELOPE_MAX_SECONDS = 10;
const MSEG_MIN_SECONDS = 0.02;
const MSEG_MAX_SECONDS = 2;
const PLOT = Object.freeze({ left: 18, right: 342, top: 14, bottom: 112 });

const clamp = (value, minimum, maximum) => (
  Math.max(minimum, Math.min(maximum, Number(value)))
);

const formatPercent = (value) => `${Math.round(clamp(value, 0, 1) * 100)}%`;

function formatEnvelopeSeconds(value) {
  const seconds = clamp(value, ENVELOPE_MIN_SECONDS, ENVELOPE_MAX_SECONDS);
  return seconds < 1
    ? `${Math.round(seconds * 1000)} ms`
    : `${seconds.toFixed(2)} s`;
}

const secondsToLogPosition = (seconds) => (
  Math.log(clamp(seconds, ENVELOPE_MIN_SECONDS, ENVELOPE_MAX_SECONDS) / ENVELOPE_MIN_SECONDS)
  / Math.log(ENVELOPE_MAX_SECONDS / ENVELOPE_MIN_SECONDS)
);

const logPositionToSeconds = (position) => (
  ENVELOPE_MIN_SECONDS
  * ((ENVELOPE_MAX_SECONDS / ENVELOPE_MIN_SECONDS) ** clamp(position, 0, 1))
);

function ScrubRow({
  label,
  value,
  minimum,
  maximum,
  formattedValue,
  dragValue = value,
  dragMinimum = minimum,
  dragMaximum = maximum,
  valueFromDrag = (next) => next,
  onChange,
  onTransientValue,
  onHaptic,
  valueKind,
}) {
  const commitDragValue = (nextDragValue) => {
    const nextValue = valueFromDrag(nextDragValue);
    onChange(nextValue);
    onTransientValue?.({ label, value: nextValue, formattedValue: formattedValue(nextValue) });
  };
  const drag = useAxisDrag({
    xValue: dragValue,
    xMinimum: dragMinimum,
    xMaximum: dragMaximum,
    onXChange: commitDragValue,
    onAxisLock: () => onHaptic?.("light"),
  });
  const displayValue = formattedValue(value);

  return (
    <button
      {...drag}
      aria-label={`Edit ${label}`}
      aria-valuemax={maximum}
      aria-valuemin={minimum}
      aria-valuenow={value}
      className="cosimo-source-setting-row"
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const step = (dragMaximum - dragMinimum) / 100;
        commitDragValue(clamp(dragValue + direction * step, dragMinimum, dragMaximum));
      }}
      role="slider"
      type="button"
    >
      <span className="cosimo-type-label">{label}</span>
      <output className="cosimo-value" data-value-kind={valueKind}>{displayValue}</output>
    </button>
  );
}

function GridLines() {
  return (
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
      <line
        x1={PLOT.left}
        x2={PLOT.right}
        y1={(PLOT.top + PLOT.bottom) / 2}
        y2={(PLOT.top + PLOT.bottom) / 2}
      />
    </g>
  );
}

function MacroEditor({ source, state, onSettingsChange, onTransientValue, onHaptic }) {
  const width = PLOT.right - PLOT.left;
  const y = (PLOT.top + PLOT.bottom) / 2;
  const x = PLOT.left + width * state.value;
  const setValue = (value) => onSettingsChange({
    kind: "macroValue",
    sourceId: source.id,
    value: clamp(value, 0, 1),
  });

  return (
    <>
      <svg aria-hidden="true" className="cosimo-source-shape__graphic" preserveAspectRatio="none" viewBox="0 0 360 126">
        <GridLines />
        <line className="cosimo-source-shape__track" x1={PLOT.left} x2={PLOT.right} y1={y} y2={y} />
        <line className="cosimo-source-shape__line" x1={PLOT.left} x2={x} y1={y} y2={y} />
        <rect className="cosimo-source-shape__handle" height="10" width="10" x={x - 5} y={y - 5} />
      </svg>
      <div className="cosimo-source-shape__settings is-single">
        <ScrubRow
          formattedValue={formatPercent}
          label="VALUE"
          maximum={1}
          minimum={0}
          onChange={setValue}
          onHaptic={onHaptic}
          onTransientValue={({ formattedValue }) => onTransientValue?.({
            label: `${source.label} · Value`,
            formattedValue,
          })}
          value={state.value}
          valueKind="percent"
        />
      </div>
    </>
  );
}

function EnvelopeGraphic({ envelope }) {
  const width = PLOT.right - PLOT.left;
  const height = PLOT.bottom - PLOT.top;
  const attackX = PLOT.left + width * 0.25 * secondsToLogPosition(envelope.attackSeconds);
  const decayX = attackX + width * (0.12 + 0.16 * secondsToLogPosition(envelope.decaySeconds));
  const sustainEndX = PLOT.left + width * 0.72;
  const releaseX = sustainEndX + width * (0.08 + 0.18 * secondsToLogPosition(envelope.releaseSeconds));
  const sustainY = PLOT.bottom - height * envelope.sustain;
  const points = [
    [PLOT.left, PLOT.bottom],
    [attackX, PLOT.top],
    [decayX, sustainY],
    [sustainEndX, sustainY],
    [releaseX, PLOT.bottom],
  ];

  return (
    <svg aria-hidden="true" className="cosimo-source-shape__graphic" preserveAspectRatio="none" viewBox="0 0 360 126">
      <GridLines />
      <polyline
        className="cosimo-source-shape__line"
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
      />
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
    </svg>
  );
}

function EnvelopeEditor({ source, state, onSettingsChange, onTransientValue, onHaptic }) {
  const envelope = state.envelope;
  const setEnvelopeField = (field, value) => {
    onSettingsChange({
      kind: "envelope",
      sourceId: source.id,
      envelope: { ...envelope, [field]: value },
    });
  };
  const secondsRow = (label, field) => (
    <ScrubRow
      dragMaximum={1}
      dragMinimum={0}
      dragValue={secondsToLogPosition(envelope[field])}
      formattedValue={formatEnvelopeSeconds}
      key={field}
      label={label}
      maximum={ENVELOPE_MAX_SECONDS}
      minimum={ENVELOPE_MIN_SECONDS}
      onChange={(value) => setEnvelopeField(field, value)}
      onHaptic={onHaptic}
      onTransientValue={({ formattedValue }) => onTransientValue?.({
        label: `${source.label} · ${label}`,
        formattedValue,
      })}
      value={envelope[field]}
      valueFromDrag={logPositionToSeconds}
      valueKind="seconds"
    />
  );

  return (
    <>
      <EnvelopeGraphic envelope={envelope} />
      <div className="cosimo-source-shape__settings">
        {secondsRow("ATTACK", "attackSeconds")}
        {secondsRow("DECAY", "decaySeconds")}
        <ScrubRow
          formattedValue={formatPercent}
          label="SUSTAIN"
          maximum={1}
          minimum={0}
          onChange={(value) => setEnvelopeField("sustain", value)}
          onHaptic={onHaptic}
          onTransientValue={({ formattedValue }) => onTransientValue?.({
            label: `${source.label} · Sustain`,
            formattedValue,
          })}
          value={envelope.sustain}
          valueKind="percent"
        />
        {secondsRow("RELEASE", "releaseSeconds")}
      </div>
    </>
  );
}

function MsegShapeToggle({ editShapeIndex, onChange }) {
  return (
    <span className="cosimo-source-shape__shape-toggle" role="group" aria-label="Edited MSEG shape">
      {[0, 1].map((shapeIndex) => (
        <button
          aria-label={`Edit shape ${shapeIndex === 0 ? "A" : "B"}`}
          aria-pressed={editShapeIndex === shapeIndex}
          className="cosimo-type-label"
          key={shapeIndex}
          onClick={() => onChange(shapeIndex)}
          type="button"
        >
          {shapeIndex === 0 ? "A" : "B"}
        </button>
      ))}
    </span>
  );
}

function MsegEditor({ source, state, onSettingsChange, onTransientValue, onHaptic }) {
  const slot = state.slot;
  const slotRef = useRef(slot);
  const sourceIdRef = useRef(source.id);
  const settingsChangeRef = useRef(onSettingsChange);
  const editShapeIndexRef = useRef(0);
  const controllerRef = useRef(null);
  const surfaceRef = useRef(null);
  const [editShapeIndex, setEditShapeIndex] = useState(0);
  slotRef.current = slot;
  sourceIdRef.current = source.id;
  settingsChangeRef.current = onSettingsChange;

  if (controllerRef.current === null) {
    controllerRef.current = createMsegPortController({
      getSlot: () => slotRef.current,
      setShape: (shapeIndex, shape) => settingsChangeRef.current({
        kind: "msegShape",
        sourceId: sourceIdRef.current,
        shapeIndex,
        shape,
      }),
      setPlayback: (playback) => settingsChangeRef.current({
        kind: "msegPlayback",
        sourceId: sourceIdRef.current,
        playback,
      }),
      editShapeIndexRef,
    });
  }

  const msegState = controllerRef.current.getState();
  const interactions = useMsegEditorInteractions({
    msegState,
    msegController: controllerRef,
    surfaceRef,
    orientation: "horizontal",
    curveEditActivationMode: "hold-or-drag",
    onCurveEditHoldActivated: () => onHaptic?.("light"),
  });
  const setPlayback = (playback) => controllerRef.current.setPlayback(playback);

  return (
    <>
      <EditableMsegSurface
        activeSegmentIndex={interactions.activeSegmentIndex}
        className="cosimo-source-shape__mseg-surface"
        dataRole="mobile-mseg-editor"
        hoveredSegmentIndex={interactions.hoveredSegmentIndex}
        morphShapeAPoints={msegState.shapeA.points}
        morphShapeBPoints={msegState.shapeB.points}
        morphValue={msegState.morph}
        onPointerDown={interactions.handlePointerDown}
        onPointerLeave={interactions.handlePointerLeave}
        onPointerMove={interactions.handlePointerMove}
        onPointerUp={interactions.handlePointerUp}
        orientation="horizontal"
        points={msegState.shape.points}
        referencePoints={msegState.referenceShape.points}
        selectedPointIndex={interactions.selectedPointIndex}
        showMorphCurve
        surfaceRef={surfaceRef}
      />
      <div className="cosimo-source-shape__settings">
        <div className="cosimo-source-setting-row is-toggle">
          <span className="cosimo-type-label">SHAPE</span>
          <MsegShapeToggle
            editShapeIndex={editShapeIndex}
            onChange={(shapeIndex) => {
              controllerRef.current.setEditShapeIndex(shapeIndex);
              setEditShapeIndex(shapeIndex);
              onHaptic?.("light");
            }}
          />
        </div>
        <ScrubRow
          formattedValue={formatPercent}
          label="MORPH"
          maximum={1}
          minimum={0}
          onChange={(morph) => onSettingsChange({
            kind: "msegMorph",
            sourceId: source.id,
            morph,
          })}
          onHaptic={onHaptic}
          onTransientValue={({ formattedValue }) => onTransientValue?.({
            label: `${source.label} · Morph`,
            formattedValue,
          })}
          value={slot.morph}
          valueKind="percent"
        />
        <ScrubRow
          formattedValue={(seconds) => `${seconds.toFixed(2)} s`}
          label="TIME"
          maximum={MSEG_MAX_SECONDS}
          minimum={MSEG_MIN_SECONDS}
          onChange={(seconds) => setPlayback({
            ...slot.playback,
            rate: { kind: "seconds", seconds },
          })}
          onHaptic={onHaptic}
          onTransientValue={({ formattedValue }) => onTransientValue?.({
            label: `${source.label} · Time`,
            formattedValue,
          })}
          value={slot.playback.rate.seconds}
          valueKind="seconds"
        />
        <button
          aria-label="Toggle MSEG loop"
          aria-pressed={slot.playback.loop !== null}
          className="cosimo-source-setting-row is-toggle"
          onClick={() => setPlayback({
            ...slot.playback,
            loop: slot.playback.loop === null ? { startX: 0, endX: 1 } : null,
          })}
          type="button"
        >
          <span className="cosimo-type-label">LOOP</span>
          <span className="cosimo-value">{slot.playback.loop === null ? "OFF" : "ON"}</span>
        </button>
      </div>
    </>
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
  if (!settings || source.type === "fixed") return null;

  return (
    <div
      aria-label={`${source.label} direct editor`}
      className="cosimo-source-shape"
      data-source-type={source.type}
      style={{ "--cosimo-source-color": semanticColor }}
    >
      {settings._tag === "macro" ? (
        <MacroEditor
          onHaptic={onHaptic}
          onSettingsChange={onSettingsChange}
          onTransientValue={onTransientValue}
          source={source}
          state={settings}
        />
      ) : settings._tag === "envelope" ? (
        <EnvelopeEditor
          onHaptic={onHaptic}
          onSettingsChange={onSettingsChange}
          onTransientValue={onTransientValue}
          source={source}
          state={settings}
        />
      ) : settings._tag === "mseg" ? (
        <MsegEditor
          onHaptic={onHaptic}
          onSettingsChange={onSettingsChange}
          onTransientValue={onTransientValue}
          source={source}
          state={settings}
        />
      ) : null}
    </div>
  );
}
