import { createEffectHeader } from "../../../ui/shared/effects/effect-header.ts";
import { EffectSnapshotBankController } from "../../../ui/shared/effects/effect-snapshot-bank.ts";
import { createStandaloneEffectPresetController } from "../../../ui/shared/effects/standalone-effect-presets.ts";
import {
  SPECTRAL_PARTIAL_PRESETS,
  applySpectralPartialPreset,
  clearSpectralPartialState,
  invertSpectralPartialState,
  normalizeSpectralPartialMagnitudes,
  setSpectralPartialCount,
  setSpectralPartialValue,
  smoothSpectralPartialState,
} from "./spectral-partial-state.ts";
import { SpectralPartialShapeRuntimeBridge } from "./spectral-partial-runtime-bridge.ts";
import { createSpectralPartialPresetStateAdapter } from "./spectral-partial-preset-adapter.ts";

const presetLabels = {
  flat: "Flat",
  saw: "Saw 1/h",
  square: "Square odd",
  triangle: "Triangle odd",
  organ: "Organ",
  nasal: "Nasal",
  air: "Air",
  pluck: "Pluck",
  custom: "Custom",
};

class SpectralChordResonatorView extends HTMLElement {
  constructor(patchConnection) {
    super();
    this.patchConnection = patchConnection;
    this.Controls = this.patchConnection.utilities.ParameterControls;
    this.bridge = new SpectralPartialShapeRuntimeBridge(patchConnection);
    this.partialState = this.bridge.getState();
    this.selectedPartial = 0;
    this.draggingPointerId = null;
    this.startupSeedCleanups = [];
    this.startupSeedInFlight = false;
    this.startupSeedComplete = false;
    this.startupSeedToken = 0;

    this.partialStateAdapter = createSpectralPartialPresetStateAdapter({
      bridge: this.bridge,
      patchConnection,
    });
    this.presetController = createStandaloneEffectPresetController({
      effectID: "spectral-chord-resonator",
      patchConnection,
      storedStateAdapters: [this.partialStateAdapter],
    });
    this.snapshotController = new EffectSnapshotBankController({
      effectID: "spectral-chord-resonator",
      patchConnection,
      storedStateAdapters: [this.partialStateAdapter],
    });
    this.effectHeader = createEffectHeader();
    this.effectHeader.presetController = this.presetController;
    this.effectHeader.snapshotController = this.snapshotController;

    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = this.getMarkup();
    this.shadowRoot.querySelector(".frame").before(this.effectHeader);
    this.groupsHost = this.shadowRoot.querySelector("[data-groups]");
    this.partialPlot = this.shadowRoot.querySelector("[data-partial-plot]");
    this.canvas = this.shadowRoot.querySelector("[data-partial-canvas]");
    this.canvasContext = this.canvas.getContext("2d");
    this.shapeName = this.shadowRoot.querySelector("[data-shape-name]");
    this.countPill = this.shadowRoot.querySelector("[data-count-pill]");
    this.selectedReadout = this.shadowRoot.querySelector("[data-selected-readout]");
    this.activeReadout = this.shadowRoot.querySelector("[data-active-readout]");
    this.centroidReadout = this.shadowRoot.querySelector("[data-centroid-readout]");
    this.resizeAnimationFrame = 0;
  }

  connectedCallback() {
    this.effectHeader.presetController = this.presetController;
    this.effectHeader.snapshotController = this.snapshotController;
    this.snapshotController.attach();
    this.presetController.attach();
    this.bridge.attach();
    this.unsubscribeBridge = this.bridge.subscribe(state => {
      this.partialState = state;
      this.selectedPartial = Math.min(this.selectedPartial, state.count - 1);
      this.renderPartialEditor();
    });
    this.bridge.requestBootState();

    this.statusListener = status => this.renderFromStatus(status);
    this.patchConnection.addStatusListener(this.statusListener);
    this.patchConnection.requestStatusUpdate();

    this.installPartialEditorListeners();
    this.installPartialResizeObserver();
    this.renderPartialEditor();
  }

  disconnectedCallback() {
    this.partialResizeObserver?.disconnect();
    this.partialResizeObserver = undefined;
    if (this.resizeAnimationFrame) {
      window.cancelAnimationFrame(this.resizeAnimationFrame);
      this.resizeAnimationFrame = 0;
    }
    this.snapshotController.detach();
    this.presetController.detach();
    this.effectHeader.presetController = null;
    this.effectHeader.snapshotController = null;
    this.cancelStartupSeedProbe();
    this.unsubscribeBridge?.();
    this.bridge.detach();

    if (this.statusListener)
      this.patchConnection.removeStatusListener(this.statusListener);
  }

  installPartialEditorListeners() {
    this.canvas.addEventListener("pointerdown", event => {
      if (event.button !== undefined && event.button !== 0)
        return;

      event.preventDefault();
      this.draggingPointerId = event.pointerId;
      this.canvas.setPointerCapture(event.pointerId);
      this.bridge.beginLiveEdit();
      this.paintFromPointer(event);
    });

    this.canvas.addEventListener("pointermove", event => {
      if (this.draggingPointerId !== event.pointerId)
        return;

      event.preventDefault();
      this.paintFromPointer(event);
    });

    const commitDrag = event => {
      if (this.draggingPointerId !== event.pointerId)
        return;

      this.draggingPointerId = null;
      this.canvas.releasePointerCapture(event.pointerId);
      this.bridge.commitLiveEdit();
    };
    this.canvas.addEventListener("pointerup", commitDrag);
    this.canvas.addEventListener("pointercancel", commitDrag);

    this.shadowRoot.querySelector("[data-preset-buttons]").addEventListener("click", event => {
      const button = event.target.closest("[data-preset]");
      if (!button)
        return;

      this.bridge.setState(applySpectralPartialPreset(this.partialState, button.dataset.preset));
    });

    this.shadowRoot.querySelector("[data-count-buttons]").addEventListener("click", event => {
      const button = event.target.closest("[data-count]");
      if (!button)
        return;

      this.bridge.setState(setSpectralPartialCount(this.partialState, Number(button.dataset.count)));
    });

    this.shadowRoot.querySelector("[data-smooth]").addEventListener("click", () => {
      this.bridge.setState(smoothSpectralPartialState(this.partialState));
    });
    this.shadowRoot.querySelector("[data-normalize]").addEventListener("click", () => {
      this.bridge.setState(normalizeSpectralPartialMagnitudes(this.partialState));
    });
    this.shadowRoot.querySelector("[data-invert]").addEventListener("click", () => {
      this.bridge.setState(invertSpectralPartialState(this.partialState));
    });
    this.shadowRoot.querySelector("[data-clear]").addEventListener("click", () => {
      this.bridge.setState(clearSpectralPartialState(this.partialState));
    });
  }

  paintFromPointer(event) {
    const point = this.pointerToPartial(event);
    this.selectedPartial = point.index;
    this.bridge.setState(setSpectralPartialValue(this.partialState, point.index, point.value));
  }

  pointerToPartial(event) {
    const rect = this.canvas.getBoundingClientRect();
    const geometry = this.getPartialPlotGeometry(rect.width, rect.height);
    const x = clamp((event.clientX - rect.left - geometry.leftPad) / Math.max(1, geometry.plotW), 0, 1);
    const y = clamp((event.clientY - rect.top - geometry.topPad) / Math.max(1, geometry.plotH), 0, 1);
    const index = Math.min(this.partialState.count - 1, Math.floor(x * this.partialState.count));
    return {
      index,
      value: clamp(1 - y, 0, 1),
    };
  }

  installPartialResizeObserver() {
    if (!("ResizeObserver" in window) || !this.partialPlot)
      return;

    this.partialResizeObserver = new ResizeObserver(() => this.schedulePartialRedraw());
    this.partialResizeObserver.observe(this);
    this.partialResizeObserver.observe(this.partialPlot);
  }

  schedulePartialRedraw() {
    if (this.resizeAnimationFrame)
      return;

    this.resizeAnimationFrame = window.requestAnimationFrame(() => {
      this.resizeAnimationFrame = 0;
      this.drawPartials();
    });
  }

  getPartialPlotGeometry(width, height) {
    const showLabels = height >= 150;
    const topPad = showLabels ? 24 : 6;
    const bottomPad = 2;
    const leftPad = 14;
    const rightPad = 14;
    const plotBottom = Math.max(topPad + 1, height - bottomPad);
    const plotH = Math.max(1, plotBottom - topPad);
    const plotW = Math.max(1, width - leftPad - rightPad);

    return {
      showLabels,
      topPad,
      bottomPad,
      leftPad,
      rightPad,
      plotBottom,
      plotH,
      plotW,
    };
  }

  renderPartialEditor() {
    this.shapeName.textContent = presetLabels[this.partialState.preset] || "Custom";
    this.countPill.textContent = `${this.partialState.count} partials`;
    this.shadowRoot.querySelectorAll("[data-preset]").forEach(button => {
      button.classList.toggle("active", button.dataset.preset === this.partialState.preset);
    });
    this.shadowRoot.querySelectorAll("[data-count]").forEach(button => {
      button.classList.toggle("active", Number(button.dataset.count) === this.partialState.count);
    });
    this.renderReadouts();
    this.schedulePartialRedraw();
  }

  renderReadouts() {
    const activeValues = this.partialState.values.slice(0, this.partialState.count);
    const selectedValue = activeValues[this.selectedPartial] ?? 0;
    const active = activeValues.filter(value => value > 0.001).length;
    const total = activeValues.reduce((sum, value) => sum + value, 0);
    const centroid = total > 0
      ? activeValues.reduce((sum, value, index) => sum + value * (index + 1), 0) / total
      : 0;

    this.selectedReadout.textContent = `H${this.selectedPartial + 1} ${selectedValue.toFixed(3)}`;
    this.activeReadout.textContent = `${active} / ${this.partialState.count}`;
    this.centroidReadout.textContent = centroid.toFixed(2);
  }

  drawPartials() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const ctx = this.canvasContext;
    const w = width / dpr;
    const h = height / dpr;
    const {
      showLabels,
      topPad,
      leftPad,
      rightPad,
      plotBottom,
      plotH,
      plotW,
    } = this.getPartialPlotGeometry(w, h);
    const slot = plotW / this.partialState.count;
    const gap = this.partialState.count > 48 ? 2 : 4;
    const barW = Math.max(3, slot - gap);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#12151b";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#2b3039";
    ctx.lineWidth = 1;
    for (let line = 0; line <= 4; line += 1) {
      const y = topPad + plotH * (line / 4);
      ctx.beginPath();
      ctx.moveTo(leftPad, y);
      ctx.lineTo(w - rightPad, y);
      ctx.stroke();
    }

    for (let index = 0; index < this.partialState.count; index += 1) {
      const value = this.partialState.values[index] ?? 0;
      const x = leftPad + index * slot + gap / 2;
      const barH = value * plotH;
      const y = plotBottom - barH;
      const color = value > 0.82 ? "#efb95d" : value > 0.1 ? "#78d29c" : "#556070";

      ctx.fillStyle = index === this.selectedPartial ? "#303745" : "#1d222b";
      ctx.fillRect(x - 1, topPad, barW + 2, plotH);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barW, Math.max(value > 0 ? 1 : 0, barH));

      const harmonic = index + 1;
      if (showLabels && (this.partialState.count <= 32 || harmonic === 1 || harmonic % 4 === 0)) {
        ctx.fillStyle = harmonic % 8 === 0 || harmonic === 1 ? "#a8aeb8" : "#747b88";
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(String(harmonic), x + barW / 2, 7);
      }
    }

    ctx.strokeStyle = "#efb95d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftPad, plotBottom - 0.5);
    ctx.lineTo(w - rightPad, plotBottom - 0.5);
    ctx.stroke();
  }

  renderFromStatus(status) {
    for (const cleanupTarget of this.groupsHost.querySelectorAll("[data-cleanup-control]"))
      cleanupTarget.__cleanup?.();

    const parameters = (status?.details?.inputs || [])
      .filter(endpoint => endpoint?.purpose === "parameter" && !endpoint?.annotation?.hidden);

    this.groupsHost.innerHTML = "";

    if (parameters.length === 0) {
      this.groupsHost.innerHTML = `<section class="empty">No patch parameters were exposed.</section>`;
      return;
    }

    this.ensureInitialParameterValues(parameters);

    const orderedGroups = [];
    const groups = new Map();

    for (const parameter of parameters) {
      const groupName = parameter.annotation?.group || "General";

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
        orderedGroups.push(groupName);
      }

      groups.get(groupName).push(parameter);
    }

    for (const groupName of orderedGroups) {
      const section = document.createElement("section");
      section.className = "group";
      section.innerHTML = `
        <header class="group-header">
          <h2>${groupName}</h2>
        </header>
        <div class="controls"></div>
      `;

      const controlsHost = section.querySelector(".controls");

      for (const parameter of groups.get(groupName)) {
        const control = this.createParameterControl(parameter);

        if (control)
          controlsHost.appendChild(control);
      }

      this.groupsHost.appendChild(section);
    }
  }

  cancelStartupSeedProbe() {
    for (const cleanup of this.startupSeedCleanups)
      cleanup();

    this.startupSeedCleanups = [];
  }

  ensureInitialParameterValues(parameters) {
    if (this.startupSeedComplete || this.startupSeedInFlight || parameters.length === 0)
      return;

    this.startupSeedInFlight = true;
    const probeToken = ++this.startupSeedToken;
    const receivedValues = new Map();
    let finished = false;

    const finishProbe = () => {
      if (finished || probeToken !== this.startupSeedToken)
        return;

      finished = true;
      this.cancelStartupSeedProbe();
      this.startupSeedInFlight = false;
      this.startupSeedComplete = true;

      const outOfRangeParameters = parameters.filter(parameter => (
        receivedValues.has(parameter.endpointID)
          && isOutOfRangeStartupValue(parameter, receivedValues.get(parameter.endpointID))
      ));

      if (outOfRangeParameters.length === 0)
        return;

      for (const parameter of outOfRangeParameters) {
        const initValue = parameter.annotation?.init;

        if (initValue === undefined)
          continue;

        this.patchConnection.sendEventOrValue(parameter.endpointID, initValue, 0);
      }
    };

    const maybeFinishProbe = () => {
      if (receivedValues.size >= parameters.length)
        finishProbe();
    };

    const timeoutID = window.setTimeout(finishProbe, 250);
    this.startupSeedCleanups.push(() => window.clearTimeout(timeoutID));

    for (const parameter of parameters) {
      const listener = value => {
        receivedValues.set(parameter.endpointID, value);
        maybeFinishProbe();
      };

      listener.endpointID = parameter.endpointID;
      this.patchConnection.addParameterListener(parameter.endpointID, listener);
      this.startupSeedCleanups.push(() => this.patchConnection.removeParameterListener(parameter.endpointID, listener));
      this.patchConnection.requestParameterValue(parameter.endpointID);
    }
  }

  createParameterControl(endpointInfo) {
    const control = this.Controls.createLabelledControl(this.patchConnection, endpointInfo);

    if (!control)
      return undefined;

    const innerControl = control.childControl || control;
    innerControl.beginGesture = () => {};
    innerControl.endGesture = () => {};

    return control;
  }

  getMarkup() {
    const presetButtons = SPECTRAL_PARTIAL_PRESETS
      .filter(preset => preset !== "custom")
      .map(preset => `<button type="button" data-preset="${preset}">${presetLabels[preset]}</button>`)
      .join("");

    return `
      <style>
        :host {
          --foreground: #f4efe6;
          --background: rgba(13, 14, 19, 0.88);
          --line: rgba(255, 255, 255, 0.1);
          --gold: #efb95d;
          --green: #78d29c;
          display: grid !important;
          grid-template-rows: auto minmax(0, 1fr);
          width: 100% !important;
          height: 100% !important;
          box-sizing: border-box;
          max-width: 100vw;
          max-height: 100vh;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          color: var(--foreground);
          background:
            radial-gradient(circle at top left, rgba(255, 214, 120, 0.16), transparent 32%),
            radial-gradient(circle at top right, rgba(108, 145, 255, 0.12), transparent 28%),
            linear-gradient(180deg, #17171d 0%, #0d0e13 100%);
          font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
        }

        * {
          box-sizing: border-box;
          user-select: none;
          -webkit-user-select: none;
        }

        button {
          min-height: 26px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          padding: 0 8px;
          color: var(--foreground);
          background: rgba(255,255,255,0.06);
          font: 12px/1 "SF Mono", Menlo, Monaco, Consolas, monospace;
          cursor: pointer;
        }

        button.active {
          border-color: rgba(239, 185, 93, 0.9);
          background: rgba(239, 185, 93, 0.22);
        }

        .frame {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 300px);
          grid-template-rows: minmax(0, 1fr);
          gap: 14px;
          width: 100%;
          height: 100%;
          max-height: 100%;
          min-height: 0;
          overflow: hidden;
          padding: 10px 14px 12px;
        }

        .partial-editor,
        .group,
        .empty {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
        }

        .partial-editor {
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          min-width: 0;
          min-height: 0;
          height: 100%;
          max-height: 100%;
          overflow: hidden;
        }

        .partial-head,
        .partial-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          padding: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .partial-head {
          justify-content: space-between;
          align-items: stretch;
        }

        .partial-head h1 {
          margin: 0;
          font-size: 16px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .partial-title {
          display: grid;
          align-content: center;
          gap: 5px;
          min-width: 0;
        }

        .shape-name,
        .pill {
          color: rgba(244, 239, 230, 0.72);
          font-size: 12px;
        }

        .partial-toolbar {
          align-items: flex-start;
          row-gap: 8px;
        }

        .button-group {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          padding-right: 8px;
          border-right: 1px solid rgba(255,255,255,0.08);
        }

        .button-group:last-child {
          border-right: 0;
        }

        .partial-plot {
          position: relative;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          background: #12151b;
        }

        canvas {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          min-height: 0;
          background: #12151b;
          cursor: crosshair;
          touch-action: none;
        }

        .partial-readouts {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          padding: 0;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          min-width: 300px;
          overflow: hidden;
        }

        .metric {
          min-width: 0;
          padding: 8px 10px;
          background: rgba(13,14,19,0.94);
        }

        .metric .k {
          color: rgba(244, 239, 230, 0.54);
          font-size: 10px;
          text-transform: uppercase;
        }

        .metric .v {
          margin-top: 4px;
          overflow: hidden;
          font-size: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .frame-groups {
          display: grid;
          align-content: start;
          gap: 12px;
          min-height: 0;
          height: 100%;
          overflow-x: hidden;
          overflow-y: auto;
          padding-right: 2px;
          scrollbar-gutter: stable;
        }

        .group {
          padding: 14px;
        }

        .group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        h2 {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(244, 239, 230, 0.74);
        }

        .controls {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 10px;
        }

        .controls .labelled-control {
          margin: 0;
        }

        .controls .labelled-control-centered-control {
          width: 6rem;
          height: 5.3rem;
        }

        .controls .labelled-control-label-container {
          max-width: 6rem;
          font-size: 11px;
        }

        @media (max-width: 760px) {
          .frame {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: minmax(260px, 62vh) auto;
            overflow-x: hidden;
            overflow-y: auto;
          }

          .frame-groups {
            height: auto;
            overflow: visible;
          }
        }

        .empty {
          padding: 18px;
          color: rgba(244, 239, 230, 0.74);
        }

        ${this.Controls.getAllCSS()}
      </style>

      <div class="frame">
        <section class="partial-editor">
          <header class="partial-head">
            <div class="partial-title">
              <h1>Spectral Chord Resonator</h1>
              <span class="shape-name" data-shape-name>Initializing</span>
              <span class="pill" data-count-pill></span>
            </div>
            <div class="partial-readouts">
              <div class="metric"><div class="k">Selected</div><div class="v" data-selected-readout></div></div>
              <div class="metric"><div class="k">Active</div><div class="v" data-active-readout></div></div>
              <div class="metric"><div class="k">Centroid</div><div class="v" data-centroid-readout></div></div>
            </div>
          </header>
          <div class="partial-toolbar">
            <div class="button-group" data-count-buttons>
              <button type="button" data-count="16">16</button>
              <button type="button" data-count="32">32</button>
              <button type="button" data-count="64">64</button>
            </div>
            <div class="button-group" data-preset-buttons>
              ${presetButtons}
            </div>
            <div class="button-group">
              <button type="button" data-smooth>Smooth</button>
              <button type="button" data-normalize>Normalize</button>
              <button type="button" data-invert>Invert</button>
              <button type="button" data-clear>Clear</button>
            </div>
          </div>
          <div class="partial-plot" data-partial-plot>
            <canvas data-partial-canvas width="1200" height="520" aria-label="Partial strength editor"></canvas>
          </div>
        </section>
        <div data-groups class="frame-groups"></div>
      </div>
    `;
  }
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

function isOutOfRangeStartupValue(endpointInfo, value) {
  if (value === undefined || value === null)
    return true;

  if (endpointInfo?.annotation?.boolean)
    return value !== true && value !== false && value !== 0 && value !== 1;

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue))
    return true;

  const min = endpointInfo?.annotation?.min;
  const max = endpointInfo?.annotation?.max;
  const epsilon = 1.0e-6 * Math.max(1, Math.abs(min ?? 0), Math.abs(max ?? 0));

  if (min !== undefined && numericValue < min - epsilon)
    return true;

  if (max !== undefined && numericValue > max + epsilon)
    return true;

  return false;
}

export default function createPatchView(patchConnection) {
  const elementName = "cosimo-spectral-chord-resonator-view";

  if (!window.customElements.get(elementName))
    window.customElements.define(elementName, SpectralChordResonatorView);

  return new (window.customElements.get(elementName))(patchConnection);
}
