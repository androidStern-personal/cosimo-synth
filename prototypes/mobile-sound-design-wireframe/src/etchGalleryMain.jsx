import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  buildWavetableRenderModel,
  buildWavetableStaticScene,
} from "../../../patch_gui/wavetable-display.js";
import { createEtchedInkPass } from "../../../ui/shared/etched-ink.ts";
import { paintWavetableEnergyField } from "../../../ui/shared/wavetable-energy-field.ts";
import { WAVETABLE_ETCHED_TREATMENT } from "../../../ui/shared/etched-treatment-presets.ts";
import {
  createDefaultFilterEnergyParams,
  handlePositionForValues,
  paintFilterEnergyField,
  resolveFilterDragValues,
} from "../../../ui/shared/filter-energy-field.ts";
import {
  createDefaultDistortionEnergyParams,
  paintDistortionEnergyField,
} from "../../../ui/shared/distortion-energy-field.ts";
import {
  buildFilterSpectrumBands,
  buildFilterSpectrumGraphPoints,
  createFilterSpectrumDisplayFrame,
  advanceFilterSpectrumDisplayState,
  buildFilterSpectrumRenderGeometry,
} from "../../../ui/shared/filter-spectrum.ts";
import {
  FILTER_MODE_LOWPASS,
  createFilterResponseModel,
  magnitudeAtFrequency,
  normalizedToFilterCutoffHz,
} from "../../../ui/shared/filter-response.ts";
import {
  makeDistortionHistoryFrame,
  makeDistortionScopeFrame,
  makeFilterSpectrumFrame,
  synthesizeFrames,
} from "./etchGalleryData.js";
import "./styles.css";

/**
 * Phase-4 side-by-side: all three module graphics through the etched pass,
 * each with its own tuning surface. The wavetable panel boots from the frozen
 * provisional preset; filter and distortion start from the same etch baseline
 * so consistency is judged from a common origin and tuned per graphic.
 */

const WIDTH = 372;
const HEIGHT = 236;
const DITHERS = ["stipple", "noise", "diffusion", "hatch", "wash"];

function readTokens() {
  const style = getComputedStyle(document.documentElement);
  const paper = style.getPropertyValue("--cosimo-color-paper").trim() || "#fafaf7";
  const inkHex = style.getPropertyValue("--cosimo-color-ink").trim() || "#171717";
  const ink = [1, 3, 5].map((offset) => parseInt(inkHex.slice(offset, offset + 2), 16));
  return { paper, ink, inkHex };
}

function drawChrome(context, paper) {
  context.fillStyle = paper;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.strokeStyle = "rgba(23,23,23,0.12)";
  context.lineWidth = 1;
  for (let gx = 1; gx < 8; gx += 1) {
    context.beginPath();
    context.moveTo((gx * WIDTH) / 8, 0);
    context.lineTo((gx * WIDTH) / 8, HEIGHT);
    context.stroke();
  }
  for (let gy = 1; gy < 4; gy += 1) {
    context.beginPath();
    context.moveTo(0, (gy * HEIGHT) / 4);
    context.lineTo(WIDTH, (gy * HEIGHT) / 4);
    context.stroke();
  }
}

function Slider({ label, value, min, max, step, onChange, format = (v) => v }) {
  return (
    <label style={{ display: "grid", gap: 3, fontSize: 10, letterSpacing: 1 }}>
      <span>{label} · {format(value)}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function EtchControls({ etch, setEtch }) {
  return (
    <>
      <Slider label="GRAIN" value={etch.grainPx} min={1} max={5} step={0.25}
        onChange={(v) => setEtch((p) => ({ ...p, grainPx: v }))} format={(v) => v.toFixed(2)} />
      <Slider label="INK DENSITY" value={etch.inkDensity} min={3} max={28} step={1}
        onChange={(v) => setEtch((p) => ({ ...p, inkDensity: v }))} />
      <Slider label="EXPOSURE" value={etch.exposure} min={0.4} max={3} step={0.05}
        onChange={(v) => setEtch((p) => ({ ...p, exposure: v }))} format={(v) => v.toFixed(2)} />
      <Slider label="CONTRAST" value={etch.contrast} min={0.6} max={2.4} step={0.05}
        onChange={(v) => setEtch((p) => ({ ...p, contrast: v }))} format={(v) => v.toFixed(2)} />
    </>
  );
}

function DitherRow({ etch, setEtch }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {DITHERS.map((mode) => (
        <button key={mode} type="button"
          onClick={() => setEtch((p) => ({ ...p, dither: mode }))}
          style={{ padding: "5px 10px", fontSize: 10, letterSpacing: 1.5, border: "1px solid var(--cosimo-color-ink)", borderRadius: 2, background: etch.dither === mode ? "var(--cosimo-color-ink)" : "transparent", color: etch.dither === mode ? "var(--cosimo-color-paper)" : "inherit" }}>
          {mode.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function CopySetup({ panel, payload }) {
  const [message, setMessage] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button type="button"
        onClick={async () => {
          const text = JSON.stringify({ panel, ...payload() }, null, 1);
          try {
            await navigator.clipboard.writeText(text);
            setMessage("copied ✓");
          } catch {
            window.prompt("copy this setup:", text);
          }
          setTimeout(() => setMessage(""), 3000);
        }}
        style={{ padding: "5px 10px", fontSize: 10, letterSpacing: 1.5, border: "1px solid var(--cosimo-color-ink)", borderRadius: 2 }}>
        ⧉ COPY SETUP
      </button>
      <span style={{ fontSize: 10, color: "#57544c" }}>{message}</span>
    </div>
  );
}

function Panel({ title, canvasRef, children, onPointerHandlers = {} }) {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ fontSize: 12, letterSpacing: 2 }}>{title}</h2>
      <canvas ref={canvasRef} {...onPointerHandlers}
        style={{ border: "1px solid var(--cosimo-color-ink)", borderRadius: 2, touchAction: "none" }} />
      {children}
    </section>
  );
}

function useTargetCanvas(canvasRef) {
  useEffect(() => {
    const target = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    target.width = WIDTH * dpr;
    target.height = HEIGHT * dpr;
    target.style.width = `${WIDTH}px`;
    target.style.height = `${HEIGHT}px`;
  }, [canvasRef]);
}

/* ── Wavetable panel ─────────────────────────────────────────────────── */

function WavetablePanel() {
  const canvasRef = useRef(null);
  const [etch, setEtch] = useState({ ...WAVETABLE_ETCHED_TREATMENT.etch });
  const [energy, setEnergy] = useState({ ...WAVETABLE_ETCHED_TREATMENT.energy });
  const etchRef = useRef(etch); etchRef.current = etch;
  const energyRef = useRef(energy); energyRef.current = energy;
  useTargetCanvas(canvasRef);

  useEffect(() => {
    const { paper, ink } = readTokens();
    const dpr = window.devicePixelRatio || 1;
    const targetContext = canvasRef.current.getContext("2d");
    const frames = synthesizeFrames();
    const staticScene = buildWavetableStaticScene({
      frames, width: WIDTH, height: HEIGHT, pixelRatio: 1,
      drawableInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const energyCanvas = document.createElement("canvas");
    energyCanvas.width = WIDTH;
    energyCanvas.height = HEIGHT;
    const energyContext = energyCanvas.getContext("2d");
    const pass = createEtchedInkPass({ ink });

    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      const model = buildWavetableRenderModel({
        staticScene,
        position: 0.5 + 0.46 * Math.sin(t * 0.5),
        warpMode: 0,
        warpAmount: 0,
      });
      energyContext.setTransform(1, 0, 0, 1, 0, 0);
      paintWavetableEnergyField(energyContext, model, energyRef.current, "all");
      pass.setParams({ ...etchRef.current, ink, backgroundKey: null });
      targetContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawChrome(targetContext, paper);
      pass.apply(energyCanvas, targetContext, WIDTH, HEIGHT);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Panel title="WAVETABLE — frozen provisional preset" canvasRef={canvasRef}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <EtchControls etch={etch} setEtch={setEtch} />
        <Slider label="BAND ENERGY" value={energy.bandEnergy} min={0} max={0.8} step={0.01}
          onChange={(v) => setEnergy((e) => ({ ...e, bandEnergy: v }))} format={(v) => v.toFixed(2)} />
        <Slider label="HERO WIDTH" value={energy.heroWidthPx} min={0.5} max={14} step={0.5}
          onChange={(v) => setEnergy((e) => ({ ...e, heroWidthPx: v }))} format={(v) => v.toFixed(1)} />
        <Slider label="HERO GLOW" value={energy.heroGlowPx} min={0} max={24} step={1}
          onChange={(v) => setEnergy((e) => ({ ...e, heroGlowPx: v }))} />
        <Slider label="HERO GLOW STR" value={energy.heroGlowStrength} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, heroGlowStrength: v }))} format={(v) => v.toFixed(2)} />
        <Slider label="HERO ENERGY" value={energy.heroEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, heroEnergy: v }))} format={(v) => v.toFixed(2)} />
      </div>
      <DitherRow etch={etch} setEtch={setEtch} />
      <CopySetup panel="wavetable" payload={() => ({ etch: etchRef.current, energy: energyRef.current })} />
    </Panel>
  );
}

/* ── Filter panel ────────────────────────────────────────────────────── */

const RESPONSE_DB_MIN = -24;
const RESPONSE_DB_MAX = 18;
const RESPONSE_POINT_COUNT = 160;

function buildResponsePoints(cutoffHz, q) {
  const model = createFilterResponseModel({
    mode: FILTER_MODE_LOWPASS, cutoffHz, q, sampleRate: 48_000,
  });
  const points = [];
  for (let index = 0; index < RESPONSE_POINT_COUNT; index += 1) {
    const x = index / (RESPONSE_POINT_COUNT - 1);
    const frequencyHz = normalizedToFilterCutoffHz(x);
    const db = magnitudeAtFrequency(model, frequencyHz);
    const y = 1 - (Math.min(RESPONSE_DB_MAX, Math.max(RESPONSE_DB_MIN, db)) - RESPONSE_DB_MIN)
      / (RESPONSE_DB_MAX - RESPONSE_DB_MIN);
    points.push({ x, y });
  }
  return points;
}

function formatHz(hz) {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${Math.round(hz)} Hz`;
}

function FilterPanel() {
  const canvasRef = useRef(null);
  const [etch, setEtch] = useState({ ...WAVETABLE_ETCHED_TREATMENT.etch });
  const [energy, setEnergy] = useState(createDefaultFilterEnergyParams());
  const [values, setValues] = useState({ cutoffHz: 2050, q: 0.707 });
  const etchRef = useRef(etch); etchRef.current = etch;
  const energyRef = useRef(energy); energyRef.current = energy;
  const valuesRef = useRef(values); valuesRef.current = values;
  const plotRectRef = useRef(null);
  const draggingRef = useRef(false);
  useTargetCanvas(canvasRef);

  useEffect(() => {
    const { paper, ink, inkHex } = readTokens();
    const dpr = window.devicePixelRatio || 1;
    const targetContext = canvasRef.current.getContext("2d");
    const energyCanvas = document.createElement("canvas");
    energyCanvas.width = WIDTH;
    energyCanvas.height = HEIGHT;
    const energyContext = energyCanvas.getContext("2d");
    const pass = createEtchedInkPass({ ink });
    const bands = buildFilterSpectrumBands();
    const graphPoints = buildFilterSpectrumGraphPoints();
    let displayState = null;

    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      const { cutoffHz, q } = valuesRef.current;
      const frame = makeFilterSpectrumFrame(t, cutoffHz, q);
      const displayFrame = createFilterSpectrumDisplayFrame({ frame, bands, graphPoints });
      displayState = advanceFilterSpectrumDisplayState(displayState, displayFrame, now);
      if (displayState) {
        const geometry = buildFilterSpectrumRenderGeometry({
          renderMode: "graph", width: WIDTH, height: HEIGHT, displayState,
        });
        plotRectRef.current = {
          left: geometry.plotLeft, top: geometry.plotTop,
          width: geometry.plotWidth, height: geometry.plotHeight,
        };
        energyContext.setTransform(1, 0, 0, 1, 0, 0);
        paintFilterEnergyField(energyContext, {
          spectrumGeometry: geometry,
          responsePoints: buildResponsePoints(cutoffHz, q),
          width: WIDTH,
          height: HEIGHT,
        }, energyRef.current);
        pass.setParams({ ...etchRef.current, ink, backgroundKey: null });
        targetContext.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawChrome(targetContext, paper);
        pass.apply(energyCanvas, targetContext, WIDTH, HEIGHT);

        // The handle is host chrome: solid vector ink, never energy.
        const handle = handlePositionForValues({
          cutoffHz, q, plotRect: plotRectRef.current,
        });
        targetContext.strokeStyle = inkHex;
        targetContext.lineWidth = 1.5;
        targetContext.beginPath();
        targetContext.arc(handle.plotX, handle.plotY, 6, 0, Math.PI * 2);
        targetContext.stroke();
        targetContext.beginPath();
        targetContext.moveTo(handle.plotX - 9, handle.plotY);
        targetContext.lineTo(handle.plotX + 9, handle.plotY);
        targetContext.moveTo(handle.plotX, handle.plotY - 9);
        targetContext.lineTo(handle.plotX, handle.plotY + 9);
        targetContext.stroke();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const applyPointer = (event) => {
    const plotRect = plotRectRef.current;
    if (!plotRect) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const next = resolveFilterDragValues({
      plotX: event.clientX - bounds.left,
      plotY: event.clientY - bounds.top,
      plotRect,
    });
    setValues(next);
  };

  return (
    <Panel title="VOICE FILTER — tuned drag + live analyzer" canvasRef={canvasRef}
      onPointerHandlers={{
        onPointerDown: (event) => {
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          applyPointer(event);
        },
        onPointerMove: (event) => { if (draggingRef.current) applyPointer(event); },
        onPointerUp: (event) => {
          draggingRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        },
      }}>
      <p style={{ fontSize: 10, letterSpacing: 1, color: "#57544c" }}>
        CUTOFF {formatHz(values.cutoffHz)} · RESO Q {values.q.toFixed(2)} — drag the plot
        (the hand-tuned sigmoid drives the vertical feel)
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <EtchControls etch={etch} setEtch={setEtch} />
        <Slider label="SPECTRUM ENERGY" value={energy.spectrumEnergy} min={0} max={0.6} step={0.01}
          onChange={(v) => setEnergy((e) => ({ ...e, spectrumEnergy: v }))} format={(v) => v.toFixed(2)} />
        <Slider label="SPECTRUM LINE" value={energy.spectrumLineEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, spectrumLineEnergy: v }))} format={(v) => v.toFixed(2)} />
        <Slider label="HERO WIDTH" value={energy.responseWidthPx} min={0.5} max={14} step={0.5}
          onChange={(v) => setEnergy((e) => ({ ...e, responseWidthPx: v }))} format={(v) => v.toFixed(1)} />
        <Slider label="HERO GLOW" value={energy.responseGlowPx} min={0} max={24} step={1}
          onChange={(v) => setEnergy((e) => ({ ...e, responseGlowPx: v }))} />
        <Slider label="HERO GLOW STR" value={energy.responseGlowStrength} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, responseGlowStrength: v }))} format={(v) => v.toFixed(2)} />
        <Slider label="HERO ENERGY" value={energy.responseEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, responseEnergy: v }))} format={(v) => v.toFixed(2)} />
      </div>
      <DitherRow etch={etch} setEtch={setEtch} />
      <CopySetup panel="filter" payload={() => ({ etch: etchRef.current, energy: energyRef.current, values: valuesRef.current })} />
    </Panel>
  );
}

/* ── Distortion panel ────────────────────────────────────────────────── */

function DistortionPanel() {
  const canvasRef = useRef(null);
  const [etch, setEtch] = useState({ ...WAVETABLE_ETCHED_TREATMENT.etch });
  const [energy, setEnergy] = useState(createDefaultDistortionEnergyParams());
  const [drive, setDrive] = useState({ driveDb: 12, knee: 0.35 });
  const etchRef = useRef(etch); etchRef.current = etch;
  const energyRef = useRef(energy); energyRef.current = energy;
  const driveRef = useRef(drive); driveRef.current = drive;
  useTargetCanvas(canvasRef);

  useEffect(() => {
    const { paper, ink } = readTokens();
    const dpr = window.devicePixelRatio || 1;
    const targetContext = canvasRef.current.getContext("2d");
    const energyCanvas = document.createElement("canvas");
    energyCanvas.width = WIDTH;
    energyCanvas.height = HEIGHT;
    const energyContext = energyCanvas.getContext("2d");
    const pass = createEtchedInkPass({ ink });

    let raf = 0;
    let frameCount = 0;
    let scopeFrame = null;
    let historyFrame = null;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      const { driveDb, knee } = driveRef.current;
      // The real endpoint cadence is 20 fps — regenerate every 3rd tick.
      if (frameCount % 3 === 0 || scopeFrame === null) {
        scopeFrame = makeDistortionScopeFrame(t, driveDb, knee);
        historyFrame = makeDistortionHistoryFrame(t, driveDb, knee);
      }
      frameCount += 1;
      energyContext.setTransform(1, 0, 0, 1, 0, 0);
      paintDistortionEnergyField(energyContext, {
        knee, scopeFrame, historyFrame, width: WIDTH, height: HEIGHT,
      }, energyRef.current);
      pass.setParams({ ...etchRef.current, ink, backgroundKey: null });
      targetContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawChrome(targetContext, paper);
      pass.apply(energyCanvas, targetContext, WIDTH, HEIGHT);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Panel title="DISTORTION — transfer + history" canvasRef={canvasRef}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Slider label="DRIVE" value={drive.driveDb} min={0} max={36} step={0.5}
          onChange={(v) => setDrive((d) => ({ ...d, driveDb: v }))} format={(v) => `${v.toFixed(1)} dB`} />
        <Slider label="KNEE" value={drive.knee} min={0} max={1} step={0.01}
          onChange={(v) => setDrive((d) => ({ ...d, knee: v }))} format={(v) => v.toFixed(2)} />
        <EtchControls etch={etch} setEtch={setEtch} />
        <Slider label="OCCUPANCY" value={energy.occupancyEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, occupancyEnergy: v }))} format={(v) => v.toFixed(2)} />
        <Slider label="HISTORY" value={energy.historyEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, historyEnergy: v }))} format={(v) => v.toFixed(2)} />
        <Slider label="REMOVED" value={energy.removedEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, removedEnergy: v }))} format={(v) => v.toFixed(2)} />
        <Slider label="HERO WIDTH" value={energy.curveWidthPx} min={0.5} max={14} step={0.5}
          onChange={(v) => setEnergy((e) => ({ ...e, curveWidthPx: v }))} format={(v) => v.toFixed(1)} />
        <Slider label="HERO GLOW" value={energy.curveGlowPx} min={0} max={24} step={1}
          onChange={(v) => setEnergy((e) => ({ ...e, curveGlowPx: v }))} />
        <Slider label="HERO GLOW STR" value={energy.curveGlowStrength} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, curveGlowStrength: v }))} format={(v) => v.toFixed(2)} />
        <Slider label="HERO ENERGY" value={energy.curveEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, curveEnergy: v }))} format={(v) => v.toFixed(2)} />
      </div>
      <DitherRow etch={etch} setEtch={setEtch} />
      <CopySetup panel="distortion" payload={() => ({ etch: etchRef.current, energy: energyRef.current, drive: driveRef.current })} />
    </Panel>
  );
}

function Gallery() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--cosimo-color-paper)", padding: 16 }}>
      <div style={{ maxWidth: 430, margin: "0 auto", display: "grid", gap: 28, fontFamily: "var(--cosimo-font-value, monospace)", color: "var(--cosimo-color-ink)" }}>
        <header>
          <h1 style={{ fontSize: 13, letterSpacing: 2 }}>ETCH GALLERY — SIDE BY SIDE</h1>
          <p style={{ fontSize: 11, color: "#57544c", marginTop: 4 }}>
            One treatment, three graphics. Tune each panel; COPY SETUP hands me the numbers.
          </p>
        </header>
        <WavetablePanel />
        <FilterPanel />
        <DistortionPanel />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Gallery />);
