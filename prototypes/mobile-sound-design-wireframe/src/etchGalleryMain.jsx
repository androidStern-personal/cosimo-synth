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
  handlePositionForValues,
  resolveFilterDragValues,
} from "../../../ui/shared/filter-energy-field.ts";
import {
  buildFilterFamilyCurves,
  buildNormalizedResponseCurve,
  computeStackLayout,
  createSpectrumHistoryRing,
  paintFilterCarvedMountain,
  paintFilterTable,
} from "../../../ui/shared/filter-depth-concepts.ts";
import { FILTER_SPECTRUM_RENDER_MODE_OPTIONS } from "../../../ui/shared/filter-spectrum.ts";
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
  makeDistortionHistoryFrame,
  makeDistortionScopeFrame,
  makeFilterSpectrumFrame,
  synthesizeFrames,
} from "./etchGalleryData.js";
import { WireRange } from "./design-system/WireRange.jsx";
import "./labs/lab.css";

/**
 * Phase-4 side-by-side: all three module graphics through the etched pass,
 * each with its own tuning surface. A scrolling DOCUMENT in the lab grammar —
 * lab.css only, never the fixed-shell stylesheet.
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

function LabSlider({ label, value, min, max, step, onChange, format = (v) => v }) {
  return (
    <div className="lab-field">
      <span className="lab-field__label cosimo-type-label">
        {label}
        <span className="lab-field__value">{format(value)}</span>
      </span>
      <WireRange
        ariaLabel={label}
        value={value}
        minimum={min}
        maximum={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function EtchControls({ etch, setEtch }) {
  return (
    <>
      <LabSlider label="GRAIN" value={etch.grainPx} min={1} max={5} step={0.25}
        onChange={(v) => setEtch((p) => ({ ...p, grainPx: v }))} format={(v) => v.toFixed(2)} />
      <LabSlider label="INK DENSITY" value={etch.inkDensity} min={3} max={28} step={1}
        onChange={(v) => setEtch((p) => ({ ...p, inkDensity: v }))} />
      <LabSlider label="EXPOSURE" value={etch.exposure} min={0.4} max={3} step={0.05}
        onChange={(v) => setEtch((p) => ({ ...p, exposure: v }))} format={(v) => v.toFixed(2)} />
      <LabSlider label="CONTRAST" value={etch.contrast} min={0.6} max={2.4} step={0.05}
        onChange={(v) => setEtch((p) => ({ ...p, contrast: v }))} format={(v) => v.toFixed(2)} />
    </>
  );
}

function DitherRow({ etch, setEtch }) {
  return (
    <div className="lab-buttons">
      {DITHERS.map((mode) => (
        <button key={mode} type="button" className="lab-button"
          aria-pressed={etch.dither === mode}
          onClick={() => setEtch((p) => ({ ...p, dither: mode }))}>
          {mode}
        </button>
      ))}
    </div>
  );
}

function CopySetup({ panel, payload }) {
  const [message, setMessage] = useState("");
  return (
    <div className="lab-buttons">
      <button type="button" className="lab-button"
        onClick={async () => {
          const text = JSON.stringify({ panel, ...payload() }, null, 1);
          try {
            await navigator.clipboard.writeText(text);
            setMessage("copied ✓");
          } catch {
            window.prompt("copy this setup:", text);
          }
          setTimeout(() => setMessage(""), 3000);
        }}>
        ⧉ Copy setup
      </button>
      <span className="lab-status">{message}</span>
    </div>
  );
}

function Panel({ title, canvasRef, children, onPointerHandlers = {} }) {
  return (
    <section className="lab-panel">
      <h2 className="lab-panel__title">{title}</h2>
      <canvas ref={canvasRef} className="lab-panel__canvas" {...onPointerHandlers} />
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
    <Panel title="Wavetable — frozen provisional preset" canvasRef={canvasRef}>
      <div className="lab-controls">
        <EtchControls etch={etch} setEtch={setEtch} />
        <LabSlider label="BAND ENERGY" value={energy.bandEnergy} min={0} max={0.8} step={0.01}
          onChange={(v) => setEnergy((e) => ({ ...e, bandEnergy: v }))} format={(v) => v.toFixed(2)} />
        <LabSlider label="HERO WIDTH" value={energy.heroWidthPx} min={0.5} max={14} step={0.5}
          onChange={(v) => setEnergy((e) => ({ ...e, heroWidthPx: v }))} format={(v) => v.toFixed(1)} />
        <LabSlider label="HERO GLOW" value={energy.heroGlowPx} min={0} max={24} step={1}
          onChange={(v) => setEnergy((e) => ({ ...e, heroGlowPx: v }))} />
        <LabSlider label="HERO GLOW STR" value={energy.heroGlowStrength} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, heroGlowStrength: v }))} format={(v) => v.toFixed(2)} />
        <LabSlider label="HERO ENERGY" value={energy.heroEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, heroEnergy: v }))} format={(v) => v.toFixed(2)} />
      </div>
      <DitherRow etch={etch} setEtch={setEtch} />
      <CopySetup panel="wavetable" payload={() => ({ etch: etchRef.current, energy: energyRef.current })} />
    </Panel>
  );
}

/* ── Filter panel ────────────────────────────────────────────────────── */

function formatHz(hz) {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${Math.round(hz)} Hz`;
}

function FilterPanel() {
  const canvasRef = useRef(null);
  const [etch, setEtch] = useState({ ...WAVETABLE_ETCHED_TREATMENT.etch });
  const [concept, setConcept] = useState("mountain");
  const [renderMode, setRenderMode] = useState("graph");
  const [stackCfg, setStackCfg] = useState({ layers: 12, depth: 0.4 });
  const [spectrum, setSpectrum] = useState({ fillEnergy: 0.05, lineEnergy: 0.08, peakEnergy: 0.5 });
  const [mountain, setMountain] = useState({ fillLayers: 3, depthFade: 1.4 });
  const [table, setTable] = useState({ familyEnergy: 0.5 });
  const [hero, setHero] = useState({ widthPx: 2.5, glowPx: 9, glowStrength: 0.05, energy: 0.95 });
  const [values, setValues] = useState({ cutoffHz: 2050, q: 0.707 });
  const etchRef = useRef(etch); etchRef.current = etch;
  const conceptRef = useRef(concept); conceptRef.current = concept;
  const renderModeRef = useRef(renderMode); renderModeRef.current = renderMode;
  const stackRef = useRef(stackCfg); stackRef.current = stackCfg;
  const spectrumRef = useRef(spectrum); spectrumRef.current = spectrum;
  const mountainRef = useRef(mountain); mountainRef.current = mountain;
  const tableRef = useRef(table); tableRef.current = table;
  const heroRef = useRef(hero); heroRef.current = hero;
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
    let historyRing = createSpectrumHistoryRing(26, 90);
    let familyCache = { q: null, layers: null, curves: [] };

    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      const { cutoffHz, q } = valuesRef.current;
      const stack = { layers: Math.round(stackRef.current.layers), depth: stackRef.current.depth };
      const frame = makeFilterSpectrumFrame(t, cutoffHz, q);
      const displayFrame = createFilterSpectrumDisplayFrame({ frame, bands, graphPoints });
      displayState = advanceFilterSpectrumDisplayState(displayState, displayFrame, now);
      if (displayState) {
        const geometry = buildFilterSpectrumRenderGeometry({
          renderMode: renderModeRef.current, width: WIDTH, height: HEIGHT, displayState,
        });
        const plot = {
          left: geometry.plotLeft, top: geometry.plotTop,
          width: geometry.plotWidth, height: geometry.plotHeight,
        };
        plotRectRef.current = plot;
        const heights = geometry.kind === "graph"
          ? geometry.points.map(
              (point) => Math.min(1, Math.max(0, (geometry.plotBottom - point.y) / plot.height)),
            )
          : geometry.bars.map(
              (bar) => Math.min(1, Math.max(0, bar.height / plot.height)),
            );
        historyRing.push(heights, now);

        energyContext.setTransform(1, 0, 0, 1, 0, 0);
        if (conceptRef.current === "mountain") {
          paintFilterCarvedMountain(energyContext, {
            width: WIDTH, height: HEIGHT, plot,
            frontGeometry: geometry,
            spectrumLayers: historyRing.getLayers(),
            responseCurve: buildNormalizedResponseCurve(cutoffHz, q),
          }, {
            stack,
            spectrum: spectrumRef.current,
            fillLayers: Math.round(mountainRef.current.fillLayers),
            depthFade: mountainRef.current.depthFade,
            hero: heroRef.current,
          });
        } else {
          if (familyCache.q !== q || familyCache.layers !== stack.layers) {
            familyCache = { q, layers: stack.layers, curves: buildFilterFamilyCurves(q, stack.layers) };
          }
          const cutoffNormalized = Math.log(cutoffHz / 20) / Math.log(1000);
          paintFilterTable(energyContext, {
            width: WIDTH, height: HEIGHT, plot,
            familyCurves: familyCache.curves,
            heroCurve: buildNormalizedResponseCurve(cutoffHz, q),
            heroDepth: Math.min(1, Math.max(0, cutoffNormalized)),
            floorGeometry: geometry,
          }, {
            stack,
            familyEnergy: tableRef.current.familyEnergy,
            spectrum: spectrumRef.current,
            hero: heroRef.current,
          });
        }
        pass.setParams({ ...etchRef.current, ink, backgroundKey: null });
        targetContext.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawChrome(targetContext, paper);
        pass.apply(energyCanvas, targetContext, WIDTH, HEIGHT);

        // The handle is host chrome: solid vector ink. In table mode it rides
        // the hero slice's depth offset so the slice IS the handle.
        const handle = handlePositionForValues({ cutoffHz, q, plotRect: plot });
        let handleX = handle.plotX;
        let handleY = handle.plotY;
        if (conceptRef.current === "table") {
          const layout = computeStackLayout(plot, stack);
          const cutoffNormalized = Math.min(1, Math.max(0, Math.log(cutoffHz / 20) / Math.log(1000)));
          const depthIndex = cutoffNormalized * (layout.layers - 1);
          handleX += depthIndex * layout.dx;
          handleY += -depthIndex * layout.dy;
        }
        targetContext.strokeStyle = inkHex;
        targetContext.lineWidth = 1.5;
        targetContext.beginPath();
        targetContext.arc(handleX, handleY, 6, 0, Math.PI * 2);
        targetContext.stroke();
        targetContext.beginPath();
        targetContext.moveTo(handleX - 9, handleY);
        targetContext.lineTo(handleX + 9, handleY);
        targetContext.moveTo(handleX, handleY - 9);
        targetContext.lineTo(handleX, handleY + 9);
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
    <Panel title="Voice filter — two 3D concepts" canvasRef={canvasRef}
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
      <div className="lab-buttons">
        <button type="button" className="lab-button" aria-pressed={concept === "mountain"}
          onClick={() => setConcept("mountain")}>Carved mountain</button>
        <button type="button" className="lab-button" aria-pressed={concept === "table"}
          onClick={() => setConcept("table")}>Filter table</button>
        <span className="lab-status">analyzer:</span>
        {FILTER_SPECTRUM_RENDER_MODE_OPTIONS.map((option) => (
          <button key={option.value} type="button" className="lab-button"
            aria-pressed={renderMode === option.value}
            onClick={() => setRenderMode(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      <p className="lab-page__note">
        CUTOFF {formatHz(values.cutoffHz)} · RESO Q {values.q.toFixed(2)} — drag the plot;
        the hand-tuned sigmoid drives the vertical feel.
        {concept === "mountain"
          ? " Depth = the signal's past; sweep the cutoff and watch the mountain get carved."
          : " Depth = the cutoff sweep; the bright slice travels the stack like the wavetable scan."}
      </p>
      <div className="lab-controls">
        <EtchControls etch={etch} setEtch={setEtch} />
        <LabSlider label="LAYERS" value={stackCfg.layers} min={4} max={26} step={1}
          onChange={(v) => setStackCfg((s) => ({ ...s, layers: v }))} />
        <LabSlider label="DEPTH" value={stackCfg.depth} min={0} max={1} step={0.01}
          onChange={(v) => setStackCfg((s) => ({ ...s, depth: v }))} format={(v) => v.toFixed(2)} />
        <LabSlider label="SPECTRUM FILL" value={spectrum.fillEnergy} min={0} max={0.2} step={0.005}
          onChange={(v) => setSpectrum((s) => ({ ...s, fillEnergy: v }))} format={(v) => v.toFixed(3)} />
        <LabSlider label="SPECTRUM LINE" value={spectrum.lineEnergy} min={0} max={1} step={0.02}
          onChange={(v) => setSpectrum((s) => ({ ...s, lineEnergy: v }))} format={(v) => v.toFixed(2)} />
        <LabSlider label="PEAK HOLD" value={spectrum.peakEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setSpectrum((s) => ({ ...s, peakEnergy: v }))} format={(v) => v.toFixed(2)} />
        {concept === "mountain" ? (
          <>
            <LabSlider label="FILL LAYERS" value={mountain.fillLayers} min={0} max={8} step={1}
              onChange={(v) => setMountain((m) => ({ ...m, fillLayers: v }))} />
            <LabSlider label="DEPTH FADE" value={mountain.depthFade} min={0.4} max={3} step={0.05}
              onChange={(v) => setMountain((m) => ({ ...m, depthFade: v }))} format={(v) => v.toFixed(2)} />
          </>
        ) : (
          <LabSlider label="FAMILY ENERGY" value={table.familyEnergy} min={0} max={1} step={0.02}
            onChange={(v) => setTable((s) => ({ ...s, familyEnergy: v }))} format={(v) => v.toFixed(2)} />
        )}
        <LabSlider label="HERO WIDTH" value={hero.widthPx} min={0.5} max={14} step={0.5}
          onChange={(v) => setHero((h) => ({ ...h, widthPx: v }))} format={(v) => v.toFixed(1)} />
        <LabSlider label="HERO GLOW" value={hero.glowPx} min={0} max={24} step={1}
          onChange={(v) => setHero((h) => ({ ...h, glowPx: v }))} />
        <LabSlider label="HERO GLOW STR" value={hero.glowStrength} min={0} max={1} step={0.05}
          onChange={(v) => setHero((h) => ({ ...h, glowStrength: v }))} format={(v) => v.toFixed(2)} />
        <LabSlider label="HERO ENERGY" value={hero.energy} min={0} max={1} step={0.05}
          onChange={(v) => setHero((h) => ({ ...h, energy: v }))} format={(v) => v.toFixed(2)} />
      </div>
      <DitherRow etch={etch} setEtch={setEtch} />
      <CopySetup panel="filter" payload={() => ({
        concept: conceptRef.current, analyzerMode: renderModeRef.current,
        etch: etchRef.current, stack: stackRef.current, spectrum: spectrumRef.current,
        mountain: mountainRef.current, table: tableRef.current, hero: heroRef.current,
        values: valuesRef.current,
      })} />
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
    <Panel title="Distortion — transfer + history" canvasRef={canvasRef}>
      <div className="lab-controls">
        <LabSlider label="DRIVE" value={drive.driveDb} min={0} max={36} step={0.5}
          onChange={(v) => setDrive((d) => ({ ...d, driveDb: v }))} format={(v) => `${v.toFixed(1)} dB`} />
        <LabSlider label="KNEE" value={drive.knee} min={0} max={1} step={0.01}
          onChange={(v) => setDrive((d) => ({ ...d, knee: v }))} format={(v) => v.toFixed(2)} />
        <EtchControls etch={etch} setEtch={setEtch} />
        <LabSlider label="OCCUPANCY" value={energy.occupancyEnergy} min={0} max={1} step={0.01}
          onChange={(v) => setEnergy((e) => ({ ...e, occupancyEnergy: v }))} format={(v) => v.toFixed(2)} />
        <LabSlider label="HISTORY" value={energy.historyEnergy} min={0} max={1} step={0.01}
          onChange={(v) => setEnergy((e) => ({ ...e, historyEnergy: v }))} format={(v) => v.toFixed(2)} />
        <LabSlider label="REMOVED" value={energy.removedEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, removedEnergy: v }))} format={(v) => v.toFixed(2)} />
        <LabSlider label="HERO WIDTH" value={energy.curveWidthPx} min={0.5} max={14} step={0.5}
          onChange={(v) => setEnergy((e) => ({ ...e, curveWidthPx: v }))} format={(v) => v.toFixed(1)} />
        <LabSlider label="HERO GLOW" value={energy.curveGlowPx} min={0} max={24} step={1}
          onChange={(v) => setEnergy((e) => ({ ...e, curveGlowPx: v }))} />
        <LabSlider label="HERO GLOW STR" value={energy.curveGlowStrength} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, curveGlowStrength: v }))} format={(v) => v.toFixed(2)} />
        <LabSlider label="HERO ENERGY" value={energy.curveEnergy} min={0} max={1} step={0.05}
          onChange={(v) => setEnergy((e) => ({ ...e, curveEnergy: v }))} format={(v) => v.toFixed(2)} />
      </div>
      <DitherRow etch={etch} setEtch={setEtch} />
      <CopySetup panel="distortion" payload={() => ({ etch: etchRef.current, energy: energyRef.current, drive: driveRef.current })} />
    </Panel>
  );
}

function Gallery() {
  return (
    <div className="cosimo-ui lab-page">
      <header>
        <h1 className="lab-page__title">ETCH GALLERY — SIDE BY SIDE</h1>
        <p className="lab-page__note">
          One treatment, three graphics. Tune each panel; Copy setup hands me the numbers.
        </p>
      </header>
      <WavetablePanel />
      <FilterPanel />
      <DistortionPanel />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Gallery />);
