import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CARPET_PALETTE,
  buildCarpetColumnMap,
  computeCarpetLayout,
  glideColumns,
  magnitudeFromDb,
  paintCarpetField,
  smoothColumns,
} from "../../../ui/shared/carpet-field.ts";
import { buildCubeChain, paintCubeChain } from "../../../ui/shared/cube-curve.ts";
import { createSpectrumHistoryRing } from "../../../ui/shared/filter-depth-concepts.ts";
import {
  handlePositionForValues,
  resolveFilterDragValues,
} from "../../../ui/shared/filter-energy-field.ts";
import {
  FILTER_Q_MAX,
  FILTER_Q_MIN,
  filterCutoffHzToNormalized,
  normalizedToFilterCutoffHz,
} from "../../../ui/shared/filter-response.ts";
import { WireRange } from "./design-system/WireRange.jsx";
import "./labs/lab.css";

/**
 * ELECTRIC++CARPET filter lab — faithful adaptation of the reference video:
 * a pin lattice (rest gray / mid white / crest acid yellow, stems below the
 * dots) whose columns are the tuned 20–20k cutoff axis, rows are time into
 * the past, and dot height is band magnitude. NOTHING is faked: a sequenced
 * synth voice (or white noise) plays through a real BiquadFilterNode, a real
 * AnalyserNode taps the post-filter signal, and the hero curve is the
 * biquad's own getFrequencyResponse. Dragging the plot uses the desktop's
 * hand-tuned cutoff/resonance sigmoid.
 */

const WIDTH = 412;
const HEIGHT = 300;
const PAD = 12;
const DEFAULT_DENSITY = 72;
const CUBE_SIZE = 5;
const MIN_HZ = 20;
const MAX_HZ = 20000;
const FFT_SIZE = 8192;
const RESPONSE_POINT_COUNT = 180;
const RESPONSE_DB_TOP = 18;
const RESPONSE_DB_SPAN = 60;
const PLOT_RECT = { left: PAD, top: PAD, width: WIDTH - PAD * 2, height: HEIGHT - PAD * 2 };

const STEP_SECONDS = 60 / 116 / 4;
const BASS_STEPS = [28, null, 40, null, 38, null, 40, 31, 28, null, 43, null, 33, null, 35, 26];
const PLUCK_STEPS = [null, null, 76, null, null, null, 79, null, null, null, 74, null, null, null, 83, null];
const SNARE_STEPS = new Set([4, 12]);

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function biquadQFor(type, q) {
  // Web Audio lowpass/highpass Q is in dB; bandpass Q is the plain Q factor.
  return type === "bandpass" ? q : 20 * Math.log10(Math.max(1e-4, q));
}

function createCarpetAudioEngine() {
  const context = new AudioContext();
  const output = context.createGain();
  output.gain.value = 0.5;
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.55;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = biquadQFor("lowpass", 2.5);
  const sourceBus = context.createGain();
  sourceBus.connect(filter);
  filter.connect(analyser);
  analyser.connect(output);
  output.connect(context.destination);

  const noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  let running = false;
  let sourceMode = "seq";
  let schedulerTimer = null;
  let stepIndex = 0;
  let nextStepTime = 0;
  let noiseNode = null;

  function scheduleTone(time, midi, wave, duration, level) {
    const osc = context.createOscillator();
    osc.type = wave;
    osc.frequency.value = midiToHz(midi);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0008, time + duration);
    osc.connect(envelope);
    envelope.connect(sourceBus);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  function scheduleNoiseHit(time, duration, level) {
    const hit = context.createBufferSource();
    hit.buffer = noiseBuffer;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0008, time + duration);
    hit.connect(envelope);
    envelope.connect(sourceBus);
    hit.start(time);
    hit.stop(time + duration + 0.02);
  }

  function scheduleStep(step, time) {
    const bass = BASS_STEPS[step];
    if (bass != null) {
      scheduleTone(time, bass, "sawtooth", 0.26, 0.5);
    }
    const pluck = PLUCK_STEPS[step];
    if (pluck != null) {
      scheduleTone(time, pluck, "square", 0.14, 0.13);
    }
    if (step % 2 === 0) {
      scheduleNoiseHit(time, 0.03, 0.12);
    }
    if (SNARE_STEPS.has(step)) {
      scheduleNoiseHit(time, 0.09, 0.22);
    }
  }

  function pumpScheduler() {
    while (nextStepTime < context.currentTime + 0.15) {
      scheduleStep(stepIndex % 16, nextStepTime);
      stepIndex += 1;
      nextStepTime += STEP_SECONDS;
    }
  }

  function startSequencer() {
    stepIndex = 0;
    nextStepTime = context.currentTime + 0.06;
    pumpScheduler();
    schedulerTimer = setInterval(pumpScheduler, 25);
  }

  function stopSequencer() {
    if (schedulerTimer != null) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  }

  function startNoise() {
    noiseNode = context.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;
    const level = context.createGain();
    level.gain.value = 0.3;
    noiseNode.connect(level);
    level.connect(sourceBus);
    noiseNode.start();
    noiseNode._level = level;
  }

  function stopNoise() {
    if (noiseNode != null) {
      noiseNode.stop();
      noiseNode.disconnect();
      noiseNode._level.disconnect();
      noiseNode = null;
    }
  }

  function startSource() {
    if (sourceMode === "seq") {
      startSequencer();
    } else {
      startNoise();
    }
  }

  function stopSource() {
    stopSequencer();
    stopNoise();
  }

  return {
    context,
    analyser,
    filter,
    async start() {
      await context.resume();
      if (!running) {
        running = true;
        startSource();
      }
    },
    async stop() {
      if (running) {
        running = false;
        stopSource();
      }
      await context.suspend();
    },
    setSource(mode) {
      if (mode === sourceMode) {
        return;
      }
      if (running) {
        stopSource();
      }
      sourceMode = mode;
      if (running) {
        startSource();
      }
    },
    setFilter({ type, cutoffHz, q }) {
      if (filter.type !== type) {
        filter.type = type;
      }
      filter.frequency.setTargetAtTime(cutoffHz, context.currentTime, 0.016);
      filter.Q.setTargetAtTime(biquadQFor(type, q), context.currentTime, 0.016);
    },
    setVolume(volume) {
      output.gain.setTargetAtTime(volume, context.currentTime, 0.03);
    },
  };
}

function formatHz(hz) {
  return hz < 1000 ? `${Math.round(hz)} Hz` : `${(hz / 1000).toFixed(2)} kHz`;
}

function LabField({ label, value, children }) {
  return (
    <label className="lab-field">
      <span className="lab-field__label">
        <span>{label}</span>
        <span className="lab-field__value">{value}</span>
      </span>
      {children}
    </label>
  );
}

function Chip({ pressed, onClick, children }) {
  return (
    <button aria-pressed={pressed} className="lab-button" onClick={onClick} type="button">
      {children}
    </button>
  );
}

function CarpetLab() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const ringRef = useRef(null);
  const responseRingRef = useRef(null);
  const glidePreviousRef = useRef(null);
  const columnsRef = useRef(buildCarpetColumnMap({
    fftSize: FFT_SIZE,
    sampleRate: 48000,
    columnCount: DEFAULT_DENSITY,
    minHz: MIN_HZ,
    maxHz: MAX_HZ,
  }));
  const fftBufferRef = useRef(new Float32Array(FFT_SIZE / 2));
  const responseFreqsRef = useRef(null);
  const responseMagsRef = useRef(new Float32Array(RESPONSE_POINT_COUNT));
  const responsePhasesRef = useRef(new Float32Array(RESPONSE_POINT_COUNT));

  const [power, setPower] = useState(false);
  const [source, setSource] = useState("seq");
  const [filterType, setFilterType] = useState("lowpass");
  const [cutoffHz, setCutoffHz] = useState(900);
  const [q, setQ] = useState(2.5);
  const [rows, setRows] = useState(24);
  const [strideMs, setStrideMs] = useState(90);
  const [heightRatio, setHeightRatio] = useState(0.55);
  const [floorDb, setFloorDb] = useState(-80);
  const [ceilDb, setCeilDb] = useState(-24);
  const [toneT1, setToneT1] = useState(0.25);
  const [toneT2, setToneT2] = useState(0.62);
  const [volume, setVolume] = useState(0.5);
  const [density, setDensity] = useState(DEFAULT_DENSITY);
  const [mesh, setMesh] = useState(2);
  const [glide, setGlide] = useState(0.6);
  const [trail, setTrail] = useState(0.6);

  const state = {
    power, source, filterType, cutoffHz, q, rows, strideMs,
    heightRatio, floorDb, ceilDb, toneT1, toneT2, volume,
    density, mesh, glide, trail,
  };
  const stateRef = useRef(state);
  stateRef.current = state;

  useMemo(() => {
    responseFreqsRef.current = new Float32Array(RESPONSE_POINT_COUNT);
    for (let i = 0; i < RESPONSE_POINT_COUNT; i += 1) {
      responseFreqsRef.current[i] = normalizedToFilterCutoffHz(i / (RESPONSE_POINT_COUNT - 1));
    }
  }, []);

  useEffect(() => {
    ringRef.current = createSpectrumHistoryRing(Math.max(1, rows - 1), strideMs);
    responseRingRef.current = createSpectrumHistoryRing(Math.max(1, rows - 1), strideMs);
  }, [rows, strideMs]);

  useEffect(() => {
    columnsRef.current = buildCarpetColumnMap({
      fftSize: FFT_SIZE,
      sampleRate: engineRef.current?.context.sampleRate ?? 48000,
      columnCount: density,
      minHz: MIN_HZ,
      maxHz: MAX_HZ,
    });
    glidePreviousRef.current = null;
  }, [density]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine != null) {
      engine.setFilter({ type: filterType, cutoffHz, q });
    }
  }, [filterType, cutoffHz, q]);

  useEffect(() => {
    engineRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    engineRef.current?.setSource(source);
  }, [source]);

  async function togglePower() {
    if (engineRef.current == null) {
      const engine = createCarpetAudioEngine();
      engineRef.current = engine;
      columnsRef.current = buildCarpetColumnMap({
        fftSize: FFT_SIZE,
        sampleRate: engine.context.sampleRate,
        columnCount: stateRef.current.density,
        minHz: MIN_HZ,
        maxHz: MAX_HZ,
      });
      glidePreviousRef.current = null;
      const current = stateRef.current;
      engine.setFilter({ type: current.filterType, cutoffHz: current.cutoffHz, q: current.q });
      engine.setVolume(current.volume);
      engine.setSource(current.source);
    }
    if (power) {
      await engineRef.current.stop();
      setPower(false);
    } else {
      await engineRef.current.start();
      setPower(true);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;
    const context = canvas.getContext("2d");

    let frameId = 0;
    const draw = () => {
      frameId = requestAnimationFrame(draw);
      const current = stateRef.current;
      const engine = engineRef.current;
      const columns = columnsRef.current;
      const ring = ringRef.current;

      const nowMs = performance.now();
      let magnitudes;
      if (engine != null && current.power) {
        const fft = fftBufferRef.current;
        engine.analyser.getFloatFrequencyData(fft);
        const raw = columns.map((column) => {
          let peakDb = Number.NEGATIVE_INFINITY;
          for (let bin = column.binStart; bin <= column.binEnd; bin += 1) {
            if (fft[bin] > peakDb) {
              peakDb = fft[bin];
            }
          }
          return magnitudeFromDb(peakDb, current.floorDb, current.ceilDb);
        });
        const meshed = smoothColumns(raw, current.mesh);
        magnitudes = glideColumns(
          glidePreviousRef.current ?? meshed,
          meshed,
          1 - current.glide * 0.35,
          Math.max(0.08, 1 - current.glide),
        );
      } else {
        magnitudes = columns.map(() => 0);
      }
      glidePreviousRef.current = magnitudes;
      ring.push(magnitudes, nowMs);
      const rowMagnitudes = ring.getLayers();

      const responseRing = responseRingRef.current;
      if (engine != null) {
        const freqs = responseFreqsRef.current;
        const mags = responseMagsRef.current;
        engine.filter.getFrequencyResponse(freqs, mags, responsePhasesRef.current);
        const yNorms = new Array(RESPONSE_POINT_COUNT);
        for (let i = 0; i < RESPONSE_POINT_COUNT; i += 1) {
          const db = 20 * Math.log10(Math.max(1e-6, mags[i]));
          yNorms[i] = Math.min(1, Math.max(0, (RESPONSE_DB_TOP - db) / RESPONSE_DB_SPAN));
        }
        responseRing.push(yNorms, nowMs);
      }
      const responseLayers = responseRing.getLayers();

      const plotW = WIDTH - PAD * 2;
      const pitch = plotW / columns.length;
      const layout = computeCarpetLayout({
        width: WIDTH,
        height: HEIGHT,
        padPx: PAD,
        rows: current.rows,
        depthSpanRatio: 0.5,
        depthInsetRatio: 0.08,
        frontBaseRatio: 0.97,
        heightRatio: current.heightRatio,
        frontDotRadiusPx: Math.min(3.6, Math.max(1.6, pitch * 0.4)),
        backScale: 0.62,
      });
      // The trail is SPARSE: at most 5 ghost planes sampled evenly across the
      // depth, never a chain on every plane — a full quilt of chains buries
      // the carpet (bounded-overlap law).
      const ghostCount = Math.round(current.trail * 5);
      const cubePlanes = new Set([0]);
      for (let k = 1; k <= ghostCount; k += 1) {
        cubePlanes.add(Math.round((k * (layout.length - 1)) / Math.max(1, ghostCount)));
      }

      const paintCubePlane = (rowIndex, row) => {
        if (engine == null || !cubePlanes.has(rowIndex)) {
          return;
        }
        const layer = responseLayers[rowIndex];
        if (layer == null || layer.length < 2) {
          return;
        }
        const depthOffset = layout[0].baseY - row.baseY;
        const points = new Array(layer.length);
        for (let i = 0; i < layer.length; i += 1) {
          points[i] = {
            x: row.xLeft + (i / (layer.length - 1)) * row.xSpan,
            y: PLOT_RECT.top + layer[i] * PLOT_RECT.height - depthOffset,
          };
        }
        const scale = row.dotRadius / layout[0].dotRadius;
        const size = CUBE_SIZE * scale;
        const spacing = size * (2.6 + 2.2 * row.depthT);
        // Cull cubes pushed above the frame by the depth offset — dropped,
        // never clamped into a ceiling.
        const chain = buildCubeChain(points, spacing)
          .filter((center) => center.y >= PAD + size * 2);
        paintCubeChain(context, chain, size, {
          alpha: rowIndex === 0 ? 1 : 0.55 * (1 - 0.55 * row.depthT),
        });
      };

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = "#060607";
      context.fillRect(0, 0, WIDTH, HEIGHT);
      paintCarpetField(context, {
        layout,
        columns,
        rowMagnitudes,
        toneT1: current.toneT1,
        toneT2: current.toneT2,
        palette: CARPET_PALETTE,
        onRowPainted: paintCubePlane,
      });

      if (engine != null) {
        const handle = handlePositionForValues({
          cutoffHz: current.cutoffHz,
          q: current.q,
          plotRect: PLOT_RECT,
        });
        context.beginPath();
        context.arc(handle.plotX, handle.plotY, 7, 0, Math.PI * 2);
        context.strokeStyle = "rgba(245,243,238,0.95)";
        context.lineWidth = 1.5;
        context.stroke();
        context.beginPath();
        context.arc(handle.plotX, handle.plotY, 1.8, 0, Math.PI * 2);
        context.fillStyle = "rgba(245,243,238,0.95)";
        context.fill();
      } else {
        context.fillStyle = "rgba(160,163,168,0.8)";
        context.font = "10px ui-monospace, monospace";
        context.textAlign = "center";
        context.fillText("POWER ON TO FEED THE CARPET", WIDTH / 2, HEIGHT / 2);
        context.textAlign = "start";
      }

      window.__carpetDebug = {
        liveMax: Math.max(...magnitudes),
        layerCount: rowMagnitudes.length,
        contextState: engine?.context.state ?? "none",
      };
    };
    draw();
    return () => cancelAnimationFrame(frameId);
  }, []);

  function applyDrag(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    const values = resolveFilterDragValues({
      plotX: event.clientX - rect.left,
      plotY: event.clientY - rect.top,
      plotRect: PLOT_RECT,
    });
    setCutoffHz(values.cutoffHz);
    setQ(values.q);
  }

  function onPointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    applyDrag(event);
  }

  function onPointerMove(event) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      applyDrag(event);
    }
  }

  const cutoffNorm = filterCutoffHzToNormalized(cutoffHz);

  return (
    <main className="lab-page">
      <h1 className="lab-page__title">ELECTRIC CARPET — FILTER LAB</h1>
      <p className="lab-page__note">
        Pin-carpet spectrum + cube-chain filter: columns are the tuned 20–20k cutoff axis, depth
        is time into the past, dot height is post-filter band magnitude from a REAL AnalyserNode
        (MESH/GLIDE make the cloud cohere as a surface). The filter is drawn as isometric cubes
        from the live BiquadFilter&apos;s own frequency response, with its history trailing into
        the depth planes (TRAIL). Drag the plot to play the filter — desktop sigmoid feel.
      </p>

      <section className="lab-panel">
        <canvas
          className="lab-panel__canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          ref={canvasRef}
        />
        <div className="lab-buttons">
          <Chip onClick={togglePower} pressed={power}>{power ? "POWER: ON" : "POWER: OFF"}</Chip>
          <Chip onClick={() => setSource("seq")} pressed={source === "seq"}>SEQ</Chip>
          <Chip onClick={() => setSource("noise")} pressed={source === "noise"}>NOISE</Chip>
          <Chip onClick={() => setFilterType("lowpass")} pressed={filterType === "lowpass"}>LP</Chip>
          <Chip onClick={() => setFilterType("bandpass")} pressed={filterType === "bandpass"}>BP</Chip>
          <Chip onClick={() => setFilterType("highpass")} pressed={filterType === "highpass"}>HP</Chip>
        </div>
        <div className="lab-controls">
          <LabField label="CUTOFF" value={formatHz(cutoffHz)}>
            <WireRange
              ariaLabel="Cutoff"
              maximum={1000}
              minimum={0}
              onChange={(event) => setCutoffHz(normalizedToFilterCutoffHz(Number(event.target.value) / 1000))}
              value={Math.round(cutoffNorm * 1000)}
            />
          </LabField>
          <LabField label="RESONANCE" value={q.toFixed(2)}>
            <WireRange
              ariaLabel="Resonance"
              maximum={FILTER_Q_MAX}
              minimum={FILTER_Q_MIN}
              onChange={(event) => setQ(Number(event.target.value))}
              step={0.05}
              value={q}
            />
          </LabField>
          <LabField label="ROWS" value={String(rows)}>
            <WireRange
              ariaLabel="Rows"
              maximum={34}
              minimum={8}
              onChange={(event) => setRows(Number(event.target.value))}
              value={rows}
            />
          </LabField>
          <LabField label="STRIDE" value={`${strideMs} ms`}>
            <WireRange
              ariaLabel="Stride"
              maximum={240}
              minimum={30}
              onChange={(event) => setStrideMs(Number(event.target.value))}
              step={10}
              value={strideMs}
            />
          </LabField>
          <LabField label="DENSITY" value={String(density)}>
            <WireRange
              ariaLabel="Column density"
              maximum={96}
              minimum={44}
              onChange={(event) => setDensity(Number(event.target.value))}
              step={4}
              value={density}
            />
          </LabField>
          <LabField label="MESH" value={String(mesh)}>
            <WireRange
              ariaLabel="Mesh smoothing"
              maximum={4}
              minimum={0}
              onChange={(event) => setMesh(Number(event.target.value))}
              value={mesh}
            />
          </LabField>
          <LabField label="GLIDE" value={glide.toFixed(2)}>
            <WireRange
              ariaLabel="Temporal glide"
              maximum={0.9}
              minimum={0}
              onChange={(event) => setGlide(Number(event.target.value))}
              step={0.05}
              value={glide}
            />
          </LabField>
          <LabField label="TRAIL" value={trail.toFixed(2)}>
            <WireRange
              ariaLabel="Cube trail depth"
              maximum={1}
              minimum={0}
              onChange={(event) => setTrail(Number(event.target.value))}
              step={0.05}
              value={trail}
            />
          </LabField>
          <LabField label="HEIGHT" value={heightRatio.toFixed(2)}>
            <WireRange
              ariaLabel="Height"
              maximum={1}
              minimum={0.15}
              onChange={(event) => setHeightRatio(Number(event.target.value))}
              step={0.01}
              value={heightRatio}
            />
          </LabField>
          <LabField label="VOLUME" value={volume.toFixed(2)}>
            <WireRange
              ariaLabel="Volume"
              maximum={1}
              minimum={0}
              onChange={(event) => setVolume(Number(event.target.value))}
              step={0.01}
              value={volume}
            />
          </LabField>
          <LabField label="FLOOR" value={`${floorDb} dB`}>
            <WireRange
              ariaLabel="Analyzer floor"
              maximum={-50}
              minimum={-100}
              onChange={(event) => setFloorDb(Number(event.target.value))}
              value={floorDb}
            />
          </LabField>
          <LabField label="CEIL" value={`${ceilDb} dB`}>
            <WireRange
              ariaLabel="Analyzer ceiling"
              maximum={-6}
              minimum={-40}
              onChange={(event) => setCeilDb(Number(event.target.value))}
              value={ceilDb}
            />
          </LabField>
          <LabField label="TONE T1" value={toneT1.toFixed(2)}>
            <WireRange
              ariaLabel="Tone threshold 1"
              maximum={1}
              minimum={0}
              onChange={(event) => setToneT1(Number(event.target.value))}
              step={0.01}
              value={toneT1}
            />
          </LabField>
          <LabField label="TONE T2" value={toneT2.toFixed(2)}>
            <WireRange
              ariaLabel="Tone threshold 2"
              maximum={1}
              minimum={0}
              onChange={(event) => setToneT2(Number(event.target.value))}
              step={0.01}
              value={toneT2}
            />
          </LabField>
        </div>
        <p className="lab-status">
          {`FILTER ${filterType.toUpperCase()} · ${formatHz(cutoffHz)} · Q ${q.toFixed(2)} · `}
          {power ? `LIVE (${source.toUpperCase()})` : "IDLE"}
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<CarpetLab />);
