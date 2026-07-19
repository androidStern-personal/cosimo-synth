import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CanvasWavetableDisplay,
  buildWavetableRenderModel,
  buildWavetableStaticScene,
} from "../../../patch_gui/wavetable-display.js";
import { createEtchedInkPass } from "../../../ui/shared/etched-ink.ts";
import {
  createDefaultWavetableEnergyParams,
  paintWavetableEnergyField,
} from "../../../ui/shared/wavetable-energy-field.ts";
import { WAVETABLE_ETCHED_TREATMENT } from "../../../ui/shared/etched-treatment-presets.ts";
import "./labs/lab.css";

/**
 * Phase-4 etch bench: the REAL desktop CanvasWavetableDisplay (untouched —
 * its 3D projection, scan-index animation, and warp rendering run verbatim on
 * a hidden canvas) with the depth-stack ink-on-paper pass over its output.
 * transient/DEPTHSTACK_LAB.html is the approved reference treatment.
 */

const WIDTH = 372;
const HEIGHT = 236;
const FRAME_COUNT = 24;
const SAMPLES = 256;

// The display's hardcoded panel gradient — keyed out so empty panel area
// contributes zero energy and prints clean paper.
const SOURCE_BACKGROUND_KEY = { top: [75, 22, 79], bottom: [31, 79, 92] };

function synthesizeFrames() {
  const frames = [];
  for (let f = 0; f < FRAME_COUNT; f += 1) {
    const morph = f / (FRAME_COUNT - 1);
    const frame = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i += 1) {
      const phase = (i / SAMPLES) * Math.PI * 2;
      const sine = Math.sin(phase);
      const folded = Math.sin(phase + morph * 2.6 * Math.sin(2 * phase));
      const squared = Math.tanh((1 + morph * 9) * sine) / Math.tanh(1 + morph * 9);
      frame[i] = (1 - morph) * sine + morph * (0.55 * folded + 0.45 * squared);
    }
    frames.push(frame);
  }
  return frames;
}

function EtchBench() {
  const targetRef = useRef(null);
  const [params, setParams] = useState({ ...WAVETABLE_ETCHED_TREATMENT.etch });
  const [warp, setWarp] = useState({ mode: 0, amount: 0 });
  const [scan, setScan] = useState({ auto: true, position: 0.4 });
  const [sourceMode, setSourceMode] = useState("model");
  const sourceModeRef = useRef(sourceMode);
  sourceModeRef.current = sourceMode;
  const [energy, setEnergy] = useState({ ...WAVETABLE_ETCHED_TREATMENT.energy });
  const energyRef = useRef(energy);
  energyRef.current = energy;
  const [hybrid, setHybrid] = useState(false);
  const hybridRef = useRef(hybrid);
  hybridRef.current = hybrid;
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const warpRef = useRef(warp);
  warpRef.current = warp;
  const scanRef = useRef(scan);
  scanRef.current = scan;

  const frames = useMemo(synthesizeFrames, []);

  useEffect(() => {
    const target = targetRef.current;
    const dpr = window.devicePixelRatio || 1;
    target.width = WIDTH * dpr;
    target.height = HEIGHT * dpr;
    target.style.width = `${WIDTH}px`;
    target.style.height = `${HEIGHT}px`;
    const targetContext = target.getContext("2d");

    const hidden = document.createElement("canvas");
    const display = new CanvasWavetableDisplay(hidden);
    display.resize(WIDTH, HEIGHT, 2);
    display.setFrames(frames);

    const style = getComputedStyle(document.documentElement);
    const paper = style.getPropertyValue("--cosimo-color-paper").trim() || "#fafaf7";
    const inkHex = style.getPropertyValue("--cosimo-color-ink").trim() || "#171717";
    const ink = [1, 3, 5].map((offset) => parseInt(inkHex.slice(offset, offset + 2), 16));

    const pass = createEtchedInkPass({ ink, backgroundKey: SOURCE_BACKGROUND_KEY });
    const linePass = createEtchedInkPass({ ink, backgroundKey: null });
    const lineCanvas = document.createElement("canvas");
    lineCanvas.width = WIDTH;
    lineCanvas.height = HEIGHT;
    const lineContext = lineCanvas.getContext("2d");

    // Path B: pure geometry builders + native white-on-black energy painter.
    const energyCanvas = document.createElement("canvas");
    energyCanvas.width = WIDTH;
    energyCanvas.height = HEIGHT;
    const energyContext = energyCanvas.getContext("2d");
    const staticScene = buildWavetableStaticScene({
      frames, width: WIDTH, height: HEIGHT, pixelRatio: 1,
      drawableInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const baseEnergyParams = createDefaultWavetableEnergyParams();

    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      const currentScan = scanRef.current;
      const position = currentScan.auto
        ? 0.5 + 0.46 * Math.sin(t * 0.5)
        : currentScan.position;
      const useModelPath = sourceModeRef.current === "model";
      const useHybrid = useModelPath && hybridRef.current;
      let etchSource = hidden;
      let model = null;
      if (useModelPath) {
        model = buildWavetableRenderModel({
          staticScene,
          position,
          warpMode: warpRef.current.mode,
          warpAmount: warpRef.current.amount,
        });
        const energyParamsNow = { ...baseEnergyParams, ...energyRef.current };
        energyContext.setTransform(1, 0, 0, 1, 0, 0);
        paintWavetableEnergyField(energyContext, model, energyParamsNow, useHybrid ? "tone" : "all");
        if (useHybrid) {
          lineContext.setTransform(1, 0, 0, 1, 0, 0);
          paintWavetableEnergyField(lineContext, model, energyParamsNow, "lines");
        }
        etchSource = energyCanvas;
      } else {
        display.setPosition(position);
        display.setWarp(warpRef.current.mode, warpRef.current.amount);
        display.render();
      }

      pass.setParams({
        ...paramsRef.current,
        // The native energy field is pre-calibrated; luma of the colored
        // render needs gain + background keying.
        energyGain: useModelPath ? 1 : 2.4,
        energyFloor: useModelPath ? 0.02 : 0.045,
        backgroundKey: useModelPath ? null : SOURCE_BACKGROUND_KEY,
      });
      targetContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      targetContext.fillStyle = paper;
      targetContext.fillRect(0, 0, WIDTH, HEIGHT);
      targetContext.strokeStyle = "rgba(23,23,23,0.12)";
      targetContext.lineWidth = 1;
      for (let gx = 1; gx < 8; gx += 1) {
        targetContext.beginPath();
        targetContext.moveTo((gx * WIDTH) / 8, 0);
        targetContext.lineTo((gx * WIDTH) / 8, HEIGHT);
        targetContext.stroke();
      }
      for (let gy = 1; gy < 4; gy += 1) {
        targetContext.beginPath();
        targetContext.moveTo(0, (gy * HEIGHT) / 4);
        targetContext.lineTo(WIDTH, (gy * HEIGHT) / 4);
        targetContext.stroke();
      }
      pass.apply(etchSource, targetContext, WIDTH, HEIGHT);
      if (useHybrid) {
        // The engraver's split: stippled shading underneath, crisp continuous
        // ink for the ripple linework and scan slice on top.
        linePass.setParams({
          ...paramsRef.current,
          dither: "wash",
          energyGain: 1,
          energyFloor: 0.02,
          backgroundKey: null,
        });
        linePass.apply(lineCanvas, targetContext, WIDTH, HEIGHT);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames]);

  const slider = (label, value, min, max, step, onChange, format = (v) => v) => (
    <label style={{ display: "grid", gap: 4, fontSize: 11, letterSpacing: 1 }}>
      <span>{label} · {format(value)}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--cosimo-color-paper)", padding: 16 }}>
    <div style={{ maxWidth: 420, margin: "0 auto", display: "grid", gap: 14, fontFamily: "var(--cosimo-font-value, monospace)", color: "var(--cosimo-color-ink)" }}>
      <h1 style={{ fontSize: 13, letterSpacing: 2 }}>WAVETABLE — ETCHED TREATMENT BENCH</h1>
      <p style={{ fontSize: 11, color: "#57544c" }}>
        The real desktop 3D display (scan animation + warp intact) → depth-stack ink pass.
      </p>
      <canvas ref={targetRef} data-role="etched-target" style={{ border: "1px solid var(--cosimo-color-ink)", borderRadius: 2 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {slider("GRAIN", params.grainPx, 1, 5, 0.25, (v) => setParams((p) => ({ ...p, grainPx: v })), (v) => v.toFixed(2))}
        {slider("INK DENSITY", params.inkDensity, 3, 28, 1, (v) => setParams((p) => ({ ...p, inkDensity: v })))}
        {slider("EXPOSURE", params.exposure, 0.4, 3, 0.05, (v) => setParams((p) => ({ ...p, exposure: v })), (v) => v.toFixed(2))}
        {slider("CONTRAST", params.contrast, 0.6, 2.4, 0.05, (v) => setParams((p) => ({ ...p, contrast: v })), (v) => v.toFixed(2))}
        {slider("WARP AMOUNT", warp.amount, 0, 1, 0.01, (v) => setWarp((w) => ({ ...w, amount: v })), (v) => v.toFixed(2))}
        {slider("SCAN", scan.position, 0, 1, 0.01, (v) => setScan({ auto: false, position: v }), (v) => v.toFixed(2))}
        {slider("BAND ENERGY", energy.bandEnergy, 0, 0.8, 0.01, (v) => setEnergy((e) => ({ ...e, bandEnergy: v })), (v) => v.toFixed(2))}
        {slider("HERO WIDTH", energy.heroWidthPx, 0.5, 14, 0.5, (v) => setEnergy((e) => ({ ...e, heroWidthPx: v })), (v) => v.toFixed(1))}
        {slider("HERO GLOW", energy.heroGlowPx, 0, 24, 1, (v) => setEnergy((e) => ({ ...e, heroGlowPx: v })))}
        {slider("HERO GLOW STR", energy.heroGlowStrength, 0, 1, 0.05, (v) => setEnergy((e) => ({ ...e, heroGlowStrength: v })), (v) => v.toFixed(2))}
        {slider("HERO ENERGY", energy.heroEnergy, 0, 1, 0.05, (v) => setEnergy((e) => ({ ...e, heroEnergy: v })), (v) => v.toFixed(2))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {["stipple", "noise", "diffusion", "hatch", "wash"].map((mode) => (
          <button key={mode} type="button"
            onClick={() => setParams((p) => ({ ...p, dither: mode }))}
            style={{ padding: "6px 12px", fontSize: 11, letterSpacing: 1.5, border: "1px solid var(--cosimo-color-ink)", borderRadius: 2, background: params.dither === mode ? "var(--cosimo-color-ink)" : "transparent", color: params.dither === mode ? "var(--cosimo-color-paper)" : "inherit" }}>
            {mode.toUpperCase()}
          </button>
        ))}
        {[0, 1, 2, 3, 4].map((mode) => (
          <button key={`warp-${mode}`} type="button"
            onClick={() => setWarp((w) => ({ ...w, mode }))}
            style={{ padding: "6px 8px", fontSize: 11, border: "1px solid #999", borderRadius: 2, background: warp.mode === mode ? "#ddd" : "transparent" }}>
            W{mode}
          </button>
        ))}
        <button type="button" onClick={() => setScan((s) => ({ ...s, auto: !s.auto }))}
          style={{ padding: "6px 10px", fontSize: 11, border: "1px solid #999", borderRadius: 2 }}>
          {scan.auto ? "AUTO SCAN" : "MANUAL"}
        </button>
        <button type="button" data-role="source-mode"
          onClick={() => setSourceMode((m) => (m === "model" ? "luma" : "model"))}
          style={{ padding: "6px 10px", fontSize: 11, border: "1px solid var(--cosimo-color-ink)", borderRadius: 2 }}>
          {sourceMode === "model" ? "ENERGY: MODEL" : "ENERGY: LUMA"}
        </button>
        <button type="button" data-role="hybrid-mode"
          onClick={() => setHybrid((h) => !h)}
          style={{ padding: "6px 10px", fontSize: 11, letterSpacing: 1, border: "1px solid var(--cosimo-color-ink)", borderRadius: 2, background: hybrid ? "var(--cosimo-color-ink)" : "transparent", color: hybrid ? "var(--cosimo-color-paper)" : "inherit" }}>
          HYBRID: {hybrid ? "ON" : "OFF"}
        </button>
      </div>
    </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<EtchBench />);
