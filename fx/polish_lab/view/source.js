import {
  CURVE_DEFAULTS,
  clamp,
  finiteOr,
} from "./curve-model.js";
import { getControlHelp } from "./control-help.js";
import { createPolishGraphStudio } from "./graph-studio.js";

const PREVIEW_ENDPOINTS = [
  ...Object.keys(CURVE_DEFAULTS),
  "amount",
  "macroCurve",
  "inputTrimDb",
  "macroInputDriveDb",
  "makeupDb",
  "macroMakeupDb",
  "thresholdDb",
  "ratio",
  "kneeDb",
  "macroRatioTarget",
  "compMix",
  "clipDriveDb",
  "clipMix",
  "bypass",
];
const CURVE_ENDPOINTS = new Set(Object.keys(CURVE_DEFAULTS));

const GROUP_NOTES = Object.freeze({
  Master: "Decoded input/output trims plus the live Amount control.",
  "Macro Wiring": "Decoded drive and makeup ranges; limiting target is an explicit lab approximation.",
  "Tone - Pre": "Exploratory low-cut alternatives. The preset's embedded convolution IR is not reproduced.",
  "Tone - Post": "Exploratory parametric color stage. The decoded preset is flat here at its saved default.",
  Compressor: "Decoded values are the reset state. Detector, RMS, sidechain HP, link, and mix are lab controls.",
  Clipper: "Drive and Mix stay immediate. Shape the curve in the graph; exact decoded coefficients remain available under Advanced Reference.",
});

function formatDb(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  if (numeric <= -119.9) return "-∞";
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(1)} dB`;
}

class PolishVoicingLabView extends HTMLElement {
  constructor(patchConnection) {
    super();
    this.patchConnection = patchConnection;
    this.Controls = patchConnection.utilities.ParameterControls;
    this.parameters = [];
    this.parameterValues = new Map();
    this.parameterListeners = new Map();
    this.controlCleanups = [];
    this.lastMeterFingerprint = "";
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = this.getMarkup();
    this.groupsHost = this.shadowRoot.querySelector("[data-groups]");
    this.controlTooltip = this.shadowRoot.querySelector("[data-control-tooltip]");
    this.resetButton = this.shadowRoot.querySelector("[data-reset]");
    this.compareButton = this.shadowRoot.querySelector("[data-compare]");
    this.graphStudio = createPolishGraphStudio({
      root: this.shadowRoot,
      patchConnection: this.patchConnection,
      parameterValues: this.parameterValues,
      sendParameter: (endpointID, value) => this.patchConnection.sendEventOrValue(endpointID, value, 0),
    });
    this.onControlPointerOver = event => {
      const control = event.target?.closest?.("[data-control-help]");
      if (control) this.showControlTooltip(control);
    };
    this.onControlPointerOut = event => {
      const control = event.target?.closest?.("[data-control-help]");
      if (control && !control.contains(event.relatedTarget)) this.hideControlTooltip();
    };
    this.onControlFocusIn = event => {
      const control = event.target?.closest?.("[data-control-help]");
      if (control) this.showControlTooltip(control);
    };
    this.onControlFocusOut = event => {
      const control = event.target?.closest?.("[data-control-help]");
      if (control && !control.contains(event.relatedTarget)) this.hideControlTooltip();
    };
    this.onControlPointerDown = event => {
      if (event.target?.closest?.("[data-control-help]")) this.hideControlTooltip();
    };
    this.onViewportChange = () => {
      if (this.tooltipControl?.isConnected) this.showControlTooltip(this.tooltipControl);
    };
    this.groupsHost.addEventListener("pointerover", this.onControlPointerOver);
    this.groupsHost.addEventListener("pointerout", this.onControlPointerOut);
    this.groupsHost.addEventListener("focusin", this.onControlFocusIn);
    this.groupsHost.addEventListener("focusout", this.onControlFocusOut);
    this.groupsHost.addEventListener("pointerdown", this.onControlPointerDown);
    this.resetButton.addEventListener("click", () => this.resetToDecodedStart());
    this.compareButton.addEventListener("click", () => this.toggleBypass());
  }

  connectedCallback() {
    this.statusListener = status => this.renderFromStatus(status);
    this.meterListener = frame => this.renderMeter(frame);
    this.patchConnection.addStatusListener(this.statusListener);
    this.patchConnection.addEndpointListener?.("meterOut", this.meterListener);
    window.addEventListener("scroll", this.onViewportChange, true);
    window.addEventListener("resize", this.onViewportChange);
    this.patchConnection.requestStatusUpdate();
  }

  disconnectedCallback() {
    this.clearParameterListeners();
    this.clearControls();
    this.hideControlTooltip();
    this.patchConnection.removeStatusListener?.(this.statusListener);
    this.patchConnection.removeEndpointListener?.("meterOut", this.meterListener);
    window.removeEventListener("scroll", this.onViewportChange, true);
    window.removeEventListener("resize", this.onViewportChange);
    this.graphStudio.destroy();
  }

  clearControls() {
    for (const cleanup of this.controlCleanups)
      cleanup();
    this.controlCleanups = [];
  }

  clearParameterListeners() {
    for (const [endpointID, listener] of this.parameterListeners)
      this.patchConnection.removeParameterListener?.(endpointID, listener);
    this.parameterListeners.clear();
  }

  renderFromStatus(status) {
    this.hideControlTooltip();
    this.clearControls();
    this.clearParameterListeners();
    this.parameters = (status?.details?.inputs ?? [])
      .filter(endpoint => endpoint?.purpose === "parameter" && !endpoint?.annotation?.hidden);
    this.groupsHost.replaceChildren();

    const groups = new Map();
    for (const parameter of this.parameters) {
      const groupName = parameter.annotation?.group || "Other";
      const entries = groups.get(groupName) ?? [];
      entries.push(parameter);
      groups.set(groupName, entries);
    }

    for (const [groupName, parameters] of groups) {
      const section = document.createElement("section");
      section.className = `group group-${groupName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
      const header = document.createElement("header");
      const title = document.createElement("h2");
      const note = document.createElement("p");
      const controls = document.createElement("div");
      title.textContent = groupName;
      note.textContent = GROUP_NOTES[groupName] ?? "Tunable lab parameters.";
      controls.className = "controls";
      header.append(title, note);
      section.append(header, controls);

      const primaryParameters = groupName === "Clipper"
        ? parameters.filter(parameter => !CURVE_ENDPOINTS.has(parameter.endpointID))
        : parameters;
      const referenceParameters = groupName === "Clipper"
        ? parameters.filter(parameter => CURVE_ENDPOINTS.has(parameter.endpointID))
        : [];

      for (const parameter of primaryParameters) {
        const control = this.createParameterControl(parameter);
        if (control) controls.append(control);
      }

      if (referenceParameters.length > 0) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        const explanation = document.createElement("p");
        const referenceControls = document.createElement("div");
        details.className = "curve-reference-details";
        details.dataset.curveReferenceDetails = "";
        summary.textContent = "Advanced Reference · exact decoded coefficients";
        explanation.textContent = "For forensic reset and exact entry. These coefficients are not the primary sound-design interface.";
        referenceControls.className = "controls curve-reference-controls";
        for (const parameter of referenceParameters) {
          const control = this.createParameterControl(parameter);
          if (control) referenceControls.append(control);
        }
        details.append(summary, explanation, referenceControls);
        section.append(details);
      }

      this.groupsHost.append(section);
    }

    this.bindPreviewParameters();
  }

  createParameterControl(endpointInfo) {
    const control = this.Controls.createLabelledControl(this.patchConnection, endpointInfo);
    if (!control) return undefined;

    const innerControl = control.childControl || control;
    const help = getControlHelp(endpointInfo);
    control.dataset.endpointId = endpointInfo.endpointID;
    control.dataset.controlHelp = help.text;
    control.dataset.controlHelpSource = help.source;
    control.setAttribute("aria-description", help.text);
    innerControl.setAttribute?.("aria-description", help.text);
    innerControl.beginGesture = () => {};
    innerControl.endGesture = () => {};
    this.controlCleanups.push(() => control.__cleanup?.());
    return control;
  }

  showControlTooltip(control) {
    const text = control?.dataset?.controlHelp;
    if (!text) return;
    this.tooltipControl = control;

    const anchorRect = control.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const margin = 9;
    const gap = 9;

    this.controlTooltip.textContent = text;
    this.controlTooltip.dataset.visible = "true";
    this.controlTooltip.dataset.placement = "above";
    this.controlTooltip.setAttribute("aria-hidden", "false");
    this.controlTooltip.style.left = `${anchorRect.left + anchorRect.width * 0.5}px`;
    this.controlTooltip.style.top = `${anchorRect.top - gap}px`;

    let tooltipRect = this.controlTooltip.getBoundingClientRect();

    if (tooltipRect.top < margin) {
      this.controlTooltip.dataset.placement = "below";
      this.controlTooltip.style.top = `${anchorRect.bottom + gap}px`;
      tooltipRect = this.controlTooltip.getBoundingClientRect();
    }

    const halfWidth = tooltipRect.width * 0.5;
    const minimumCenter = margin + halfWidth;
    const maximumCenter = viewportWidth - margin - halfWidth;
    const anchorCenter = anchorRect.left + anchorRect.width * 0.5;
    const centeredLeft = minimumCenter <= maximumCenter
      ? Math.min(maximumCenter, Math.max(minimumCenter, anchorCenter))
      : viewportWidth * 0.5;
    this.controlTooltip.style.left = `${centeredLeft}px`;

    tooltipRect = this.controlTooltip.getBoundingClientRect();
    if (tooltipRect.bottom > viewportHeight - margin && this.controlTooltip.dataset.placement === "below") {
      this.controlTooltip.dataset.placement = "above";
      this.controlTooltip.style.top = `${anchorRect.top - gap}px`;
    }
  }

  hideControlTooltip() {
    if (!this.controlTooltip) return;
    this.tooltipControl = undefined;
    this.controlTooltip.dataset.visible = "false";
    this.controlTooltip.setAttribute("aria-hidden", "true");
  }

  bindPreviewParameters() {
    const available = new Set(this.parameters.map(parameter => parameter.endpointID));

    for (const endpointID of PREVIEW_ENDPOINTS.filter(id => available.has(id))) {
      const listener = value => {
        this.parameterValues.set(endpointID, value);
        this.renderEffectiveSettings();
        this.renderCompareState();
        this.graphStudio.render();
      };
      this.parameterListeners.set(endpointID, listener);
      this.patchConnection.addParameterListener(endpointID, listener);
      this.patchConnection.requestParameterValue(endpointID);
    }
  }

  resetToDecodedStart() {
    for (const parameter of this.parameters) {
      if (parameter.annotation?.init === undefined) continue;
      this.patchConnection.sendEventOrValue(parameter.endpointID, parameter.annotation.init, 0);
    }

    const status = this.shadowRoot.querySelector("[data-reset-status]");
    status.textContent = "Decoded start restored";
    window.setTimeout(() => {
      if (status.textContent === "Decoded start restored") status.textContent = "";
    }, 1600);
  }

  toggleBypass() {
    const next = !(this.parameterValues.get("bypass") === true || this.parameterValues.get("bypass") === 1);
    this.patchConnection.sendEventOrValue("bypass", next, 0);
  }

  renderCompareState() {
    const bypassed = this.parameterValues.get("bypass") === true || this.parameterValues.get("bypass") === 1;
    this.compareButton.dataset.active = String(bypassed);
    this.compareButton.textContent = bypassed ? "Hear processed" : "Hear dry";
  }

  renderEffectiveSettings() {
    const amount = clamp(finiteOr(this.parameterValues.get("amount"), 0) / 100, 0, 1);
    const curve = clamp(finiteOr(this.parameterValues.get("macroCurve"), 1), 0.25, 4);
    const macro = amount ** curve;
    const inputDb = finiteOr(this.parameterValues.get("inputTrimDb"), -0.285017081)
      + finiteOr(this.parameterValues.get("macroInputDriveDb"), 35.9712) * macro;
    const makeupDb = finiteOr(this.parameterValues.get("makeupDb"), -0.04)
      + finiteOr(this.parameterValues.get("macroMakeupDb"), 4.12) * macro;
    const baseRatio = finiteOr(this.parameterValues.get("ratio"), 11.4155251);
    const targetRatio = finiteOr(this.parameterValues.get("macroRatioTarget"), 1000);
    const effectiveRatio = baseRatio + (targetRatio - baseRatio) * macro;
    this.shadowRoot.querySelector("[data-effective-input]").textContent = formatDb(inputDb);
    this.shadowRoot.querySelector("[data-effective-makeup]").textContent = formatDb(makeupDb);
    this.shadowRoot.querySelector("[data-effective-ratio]").textContent = `${effectiveRatio.toFixed(effectiveRatio >= 100 ? 0 : 2)}:1`;
  }

  renderMeter(frame = {}) {
    this.graphStudio.pushTelemetry(frame);
    const inputRms = Number(frame.inputRmsDb);
    const outputRms = Number(frame.outputRmsDb);
    const values = {
      inPeak: formatDb(frame.inputPeakDb),
      outPeak: formatDb(frame.outputPeakDb),
      inRms: formatDb(inputRms),
      outRms: formatDb(outputRms),
      delta: Number.isFinite(inputRms) && Number.isFinite(outputRms)
        ? formatDb(outputRms - inputRms)
        : "--",
      gainReduction: formatDb(-Math.abs(Number(frame.gainReductionDb) || 0)),
      clipActivity: `${Math.max(0, Number(frame.clipActivityPercent) || 0).toFixed(1)}%`,
    };
    const fingerprint = Object.values(values).join("|");
    if (fingerprint === this.lastMeterFingerprint) return;
    this.lastMeterFingerprint = fingerprint;

    this.shadowRoot.querySelector("[data-meter-in-peak]").textContent = values.inPeak;
    this.shadowRoot.querySelector("[data-meter-out-peak]").textContent = values.outPeak;
    this.shadowRoot.querySelector("[data-meter-in-rms]").textContent = values.inRms;
    this.shadowRoot.querySelector("[data-meter-out-rms]").textContent = values.outRms;
    this.shadowRoot.querySelector("[data-meter-delta]").textContent = values.delta;
    this.shadowRoot.querySelector("[data-meter-gr]").textContent = values.gainReduction;
    this.shadowRoot.querySelector("[data-meter-clip]").textContent = values.clipActivity;
  }

  getMarkup() {
    return `
      <style>
        :host {
          --ink: #f4f0e8;
          --muted: rgba(244, 240, 232, 0.62);
          --line: rgba(255, 255, 255, 0.11);
          --panel: rgba(255, 255, 255, 0.045);
          --accent: #ffb65d;
          --accent-2: #67d6c7;
          /* Required by Cmajor's stock control factory. Its knob, switch, and
             options CSS maps every painted part through these two tokens. */
          --foreground: var(--accent);
          --background: rgba(255, 255, 255, 0.10);
          display: block;
          width: 1180px;
          min-height: 820px;
          color: var(--ink);
          background:
            radial-gradient(circle at 4% 0%, rgba(255, 182, 93, 0.19), transparent 31%),
            radial-gradient(circle at 95% 12%, rgba(103, 214, 199, 0.13), transparent 27%),
            linear-gradient(155deg, #19191d 0%, #0d0e12 70%);
          font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
        }

        * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
        button { font: inherit; }

        .shell { padding: 18px; }
        .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 14px; }
        .eyebrow { color: var(--accent); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; }
        h1 { margin: 4px 0 4px; font-size: 25px; letter-spacing: 0.04em; }
        .subtitle { margin: 0; max-width: 700px; color: var(--muted); font-size: 11px; line-height: 1.55; }
        .actions { display: flex; align-items: center; gap: 8px; padding-top: 4px; }
        .actions button {
          border: 1px solid var(--line); border-radius: 999px; padding: 9px 13px;
          color: var(--ink); background: rgba(255,255,255,0.05); cursor: pointer;
        }
        .actions button:hover, .actions button[data-active="true"] { border-color: var(--accent); background: rgba(255,182,93,0.12); }
        [data-reset-status] { min-width: 138px; color: var(--accent-2); font-size: 10px; }

        .graph-studio, .analysis { margin-bottom: 14px; }
        .graph-panel, .meter-panel, .group {
          border: 1px solid var(--line); border-radius: 16px; background: var(--panel);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); backdrop-filter: blur(14px);
        }
        .graph-panel { position: relative; padding: 12px 14px 10px; }
        .graph-panel header { display: flex; justify-content: space-between; gap: 18px; align-items: baseline; }
        .graph-panel header p { margin: 0; color: var(--muted); font-size: 9px; }
        .graph-panel svg { display: block; width: 100%; height: 330px; touch-action: none; overflow: visible; }
        .graph-grid { stroke: rgba(255,255,255,0.08); stroke-width: 1; }
        .graph-unity { stroke: rgba(255,255,255,0.32); stroke-width: 1.2; stroke-dasharray: 7 6; }
        .graph-knee-region { fill: rgba(103,214,199,.10); pointer-events: none; }
        .clipped-region { fill: rgba(255,182,93,.09); pointer-events: none; }
        .drive-guide { fill: none; stroke: rgba(103,214,199,.45); stroke-width: 1.5; stroke-dasharray: 3 4; pointer-events: none; }
        .decoded-curve { fill: none; stroke: rgba(244,240,232,.42); stroke-width: 2; stroke-dasharray: 7 6; pointer-events: none; }
        .graph-curve { fill: none; stroke: var(--accent); stroke-width: 3; }
        .curve-segment-hit { fill: none; stroke: rgba(255,182,93,0); stroke-width: 44; pointer-events: stroke; cursor: ns-resize; }
        .curve-segment-hit:hover, .curve-segment-hit:focus { stroke: rgba(255,182,93,.11); outline: none; }
        .operating-guide { fill: none; stroke: rgba(103,214,199,.42); stroke-width: 1; stroke-dasharray: 3 4; opacity: 0; }
        .operating-guide[data-active="true"] { opacity: 1; }
        .operating-dot { fill: var(--accent-2); stroke: #101114; stroke-width: 4; opacity: 0; filter: drop-shadow(0 0 7px rgba(103,214,199,.75)); }
        .operating-dot[data-active="true"] { opacity: 1; }
        .operating-dot[data-active="true"][data-clipped="true"] { fill: var(--accent); filter: drop-shadow(0 0 8px rgba(255,182,93,.78)); }
        .operating-label { fill: var(--accent-2); font-size: 10px; opacity: 0; }
        .operating-label[data-active="true"] { opacity: 1; }
        .graph-axis-label { fill: var(--muted); font-size: 10px; }
        .threshold-line { stroke: var(--accent-2); stroke-width: 1.5; stroke-dasharray: 3 5; }
        .threshold-grip, .ratio-grip, .knee-grip, .makeup-grip, .drive-grip, .knot-grip { fill: #101114; stroke: var(--accent-2); stroke-width: 2.5; }
        .ratio-grip-mark, .knee-grip-mark, .makeup-grip-mark, .drive-grip-mark { stroke: var(--accent-2); stroke-width: 2; pointer-events: none; }
        [data-graph-handle] { cursor: ew-resize; outline: none; }
        [data-graph-handle]:not(.curve-segment-hit) { pointer-events: all; }
        [data-graph-handle="ratio"] { cursor: ns-resize; }
        [data-graph-handle="makeup"] { cursor: ns-resize; }
        [data-graph-handle="drive"] { cursor: ew-resize; }
        [data-graph-handle^="knot"] { cursor: move; }
        .knot-number { fill: var(--accent-2); font-size: 9px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
        [data-graph-handle]:not(.curve-segment-hit):focus { stroke: var(--ink); }
        .graph-readout {
          position: fixed; top: 18px; left: 50%; z-index: 1200; transform: translateX(-50%);
          min-width: 170px; padding: 8px 12px; border: 1px solid rgba(103,214,199,.5);
          border-radius: 999px; color: var(--ink); background: rgba(10,11,14,.94);
          text-align: center; font-size: 11px; pointer-events: none; opacity: 0;
        }
        .graph-readout[data-visible="true"] { opacity: 1; }
        .gr-history { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px; align-items: center; margin-top: -8px; padding: 0 8px 4px; }
        .gr-history-copy { color: var(--muted); font-size: 9px; line-height: 1.45; }
        .gr-history-copy strong { display: block; margin-top: 4px; color: var(--accent-2); font-size: 14px; font-weight: 500; }
        .gr-history svg { display: block; width: 100%; height: 72px; }
        .gr-grid { stroke: rgba(255,255,255,.09); stroke-width: 1; }
        .gr-trace { fill: none; stroke: var(--accent-2); stroke-width: 2.5; }

        .analysis { display: block; }
        .meter-panel { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; }
        .readout { min-height: 76px; padding: 13px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .readout:nth-child(4n) { border-right: 0; }
        .readout-label { display: block; margin-bottom: 8px; color: var(--muted); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
        .readout-value { color: var(--accent-2); font-size: 17px; }
        .readout-effective .readout-value { color: var(--accent); }

        .groups { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; }
        .group { padding: 13px; min-height: 164px; }
        .group-clipper { grid-column: span 2; }
        .group header { min-height: 50px; margin-bottom: 8px; }
        h2 { margin: 0 0 5px; color: var(--accent); font-size: 12px; letter-spacing: .09em; text-transform: uppercase; }
        .group header p { margin: 0; color: var(--muted); font-size: 9px; line-height: 1.45; }
        .controls { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 7px; }
        .controls .labelled-control { --labelled-control-font-color: var(--ink); margin: 0; }
        .controls .labelled-control-centered-control { width: 5.15rem; height: 4.75rem; }
        .controls .labelled-control-label-container { max-width: 5.15rem; font-size: 9px; }
        .controls .labelled-control-name, .controls .labelled-control-value { letter-spacing: .02em; }
        .curve-reference-details { width: 100%; margin-top: 11px; padding-top: 10px; border-top: 1px solid var(--line); }
        .curve-reference-details summary { color: var(--muted); font-size: 9px; cursor: pointer; list-style-position: inside; }
        .curve-reference-details[open] summary { color: var(--accent); }
        .curve-reference-details > p { margin: 8px 0 10px; color: var(--muted); font-size: 9px; line-height: 1.45; }

        .control-tooltip {
          position: fixed;
          z-index: 1000;
          width: max-content;
          max-width: min(310px, calc(100vw - 18px));
          padding: 9px 11px;
          border: 1px solid rgba(255, 182, 93, 0.48);
          border-radius: 9px;
          color: var(--ink);
          background: rgba(12, 13, 17, 0.97);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.48);
          font-size: 10px;
          line-height: 1.45;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transform: translate(-50%, -100%);
          transition: opacity 70ms ease;
        }
        .control-tooltip[data-placement="below"] { transform: translate(-50%, 0); }
        .control-tooltip[data-visible="true"] { opacity: 1; visibility: visible; }

        ${this.Controls.getAllCSS()}
      </style>

      <main class="shell">
        <header class="topbar">
          <div>
            <span class="eyebrow">T27 · isolated sound-design instrument</span>
            <h1>Polish Voicing Lab</h1>
            <p class="subtitle">Decoded values are one reset state. Orange controls shape the live chain; mint measurements are for level-matched A/B. Tone, detector variants, limiting target, and 4× oversampling are explicit Cosimo lab choices—not claims about a closed implementation.</p>
          </div>
          <div class="actions">
            <span data-reset-status></span>
            <button type="button" data-compare>Hear dry</button>
            <button type="button" data-reset>Restore decoded start</button>
          </div>
        </header>

        <section class="graph-studio">
          <article class="graph-panel">
            <header>
              <div><h2>Compressor transfer</h2><p>Detector input dB → static output dB. Unity is dashed; knee shape is the DSP's fixed quadratic.</p></div>
              <p data-compressor-graph-summary></p>
            </header>
            <output class="graph-readout" data-graph-readout data-visible="false"></output>
            <svg
              viewBox="0 0 780 380"
              role="img"
              aria-label="Interactive compressor input to output transfer graph"
              data-transfer-graph="compressor"
              data-input-min="-48"
              data-input-max="12"
              data-output-min="-48"
              data-output-max="12"
              data-plot-left="58"
              data-plot-right="722"
              data-plot-top="24"
              data-plot-bottom="346"
            >
              <path class="graph-grid" d="M58 24V346 M224 24V346 M390 24V346 M556 24V346 M722 24V346 M58 24H722 M58 104.5H722 M58 185H722 M58 265.5H722 M58 346H722" />
              <path class="graph-unity" d="M58 346L722 24" />
              <rect class="graph-knee-region" data-compressor-knee-region y="24" height="322" x="0" width="0" />
              <path class="graph-curve" data-compressor-curve d="" />
              <path class="operating-guide" data-compressor-operating-input data-active="false" d="" />
              <circle class="operating-dot" data-compressor-operating-point data-active="false" data-input-db="" data-output-db="" cx="0" cy="0" r="8" />
              <text class="operating-label" data-compressor-operating-output data-active="false" x="0" y="0"></text>
              <g
                data-graph-control="threshold"
                data-graph-handle="threshold"
                role="slider"
                tabindex="0"
                aria-label="Compressor threshold"
                aria-valuemin="-36"
                aria-valuemax="6"
              >
                <rect
                  x="-26"
                  y="24"
                  width="52"
                  height="322"
                  fill="transparent"
                  stroke="transparent"
                />
                <path class="threshold-line" d="M0 24V346" />
                <circle class="threshold-grip" cx="0" cy="346" r="10" />
              </g>
              <g
                data-graph-control="ratio"
                data-graph-handle="ratio"
                role="slider"
                tabindex="0"
                aria-label="Effective compressor ratio"
                aria-valuemin="1"
                aria-valuemax="1000"
              >
                <rect x="-26" y="-26" width="52" height="52" fill="transparent" stroke="transparent" />
                <circle class="ratio-grip" cx="0" cy="0" r="11" />
                <path class="ratio-grip-mark" d="M-4 -2L0 -7L4 -2 M-4 2L0 7L4 2" />
              </g>
              <g
                data-graph-control="knee"
                data-graph-handle="knee"
                role="slider"
                tabindex="0"
                aria-label="Compressor knee width"
                aria-valuemin="0"
                aria-valuemax="24"
              >
                <rect x="-26" y="-26" width="52" height="52" fill="transparent" stroke="transparent" />
                <circle class="knee-grip" cx="0" cy="0" r="10" />
                <path class="knee-grip-mark" d="M-7 0L-2 -4 M-7 0L-2 4 M7 0L2 -4 M7 0L2 4" />
              </g>
              <g
                data-graph-control="makeup"
                data-graph-handle="makeup"
                role="slider"
                tabindex="0"
                aria-label="Compressor base makeup gain"
                aria-valuemin="-24"
                aria-valuemax="24"
              >
                <rect x="-26" y="-26" width="52" height="52" fill="transparent" stroke="transparent" />
                <circle class="makeup-grip" cx="0" cy="0" r="10" />
                <path class="makeup-grip-mark" d="M0 -7L-4 -2 M0 -7L4 -2 M0 7L-4 2 M0 7L4 2" />
              </g>
              <text class="graph-axis-label" x="58" y="369">−48 input dB</text>
              <text class="graph-axis-label" x="722" y="369" text-anchor="end">+12 input dB</text>
              <text class="graph-axis-label" x="66" y="38">+12 output dB</text>
              <text class="graph-axis-label" x="66" y="339">−48 output dB</text>
            </svg>
            <div class="gr-history">
              <div class="gr-history-copy">Gain reduction over time<br><span>Attack ↓ · Release ↑</span><strong data-gain-reduction-live-value>--</strong></div>
              <svg viewBox="0 0 780 84" role="img" aria-label="Live compressor gain reduction history">
                <path class="gr-grid" d="M42 12H758 M42 42H758 M42 72H758" />
                <path class="gr-trace" data-gain-reduction-trace data-sample-count="0" d="" />
              </svg>
            </div>
          </article>
          <article class="graph-panel clipper-graph-panel">
            <header>
              <div><h2>Clipper transfer</h2><p>Positive magnitude; the negative side mirrors automatically. Dashed is decoded reference, orange is working curve.</p></div>
              <p data-clipper-graph-summary></p>
            </header>
            <svg
              viewBox="0 0 780 380"
              role="img"
              aria-label="Interactive clipper input to output transfer graph"
              data-transfer-graph="clipper"
              data-input-min="0"
              data-input-max="1.5"
              data-output-min="0"
              data-output-max="1.5"
              data-plot-left="58"
              data-plot-right="722"
              data-plot-top="24"
              data-plot-bottom="346"
            >
              <path class="graph-grid" d="M58 24V346 M224 24V346 M390 24V346 M556 24V346 M722 24V346 M58 24H722 M58 104.5H722 M58 185H722 M58 265.5H722 M58 346H722" />
              <path class="graph-unity" d="M58 346L722 24" />
              <rect class="clipped-region" data-clipped-region y="24" height="322" x="722" width="0" />
              <path class="decoded-curve" data-decoded-clipper-curve d="" />
              <path class="graph-curve" data-clipper-curve d="" />
              <path class="curve-segment-hit" data-curve-segment="1" data-graph-handle="segment1" role="slider" tabindex="0" aria-label="Drag curve segment 1 vertically to change its roundness" aria-valuemin="-1" aria-valuemax="1" d="" />
              <path class="curve-segment-hit" data-curve-segment="2" data-graph-handle="segment2" role="slider" tabindex="0" aria-label="Drag curve segment 2 vertically to change its roundness" aria-valuemin="-1" aria-valuemax="1" d="" />
              <path class="curve-segment-hit" data-curve-segment="3" data-graph-handle="segment3" role="slider" tabindex="0" aria-label="Drag the ceiling transition vertically to change its roundness" aria-valuemin="-1" aria-valuemax="1" d="" />
              <path class="operating-guide" data-clipper-operating-guide data-active="false" d="" />
              <circle class="operating-dot" data-clipper-operating-point data-active="false" data-clipped="false" data-input="" data-output="" cx="0" cy="0" r="8" />
              <text class="operating-label" data-clipper-operating-label data-active="false" x="0" y="0"></text>
              <path class="drive-guide" data-drive-guide d="" />
              <g
                data-graph-control="drive"
                data-graph-handle="drive"
                role="slider"
                tabindex="0"
                aria-label="Clipper Drive"
                aria-valuemin="-24"
                aria-valuemax="36"
              >
                <rect x="-26" y="-26" width="52" height="52" fill="transparent" stroke="transparent" />
                <circle class="drive-grip" cx="0" cy="0" r="11" />
                <path class="drive-grip-mark" d="M-7 0L-2 -4 M-7 0L-2 4 M7 0L2 -4 M7 0L2 4" />
              </g>
              <g
                data-graph-control="knot1"
                data-graph-handle="knot1"
                role="slider"
                tabindex="0"
                aria-label="Clipper point 1 input and output; drag freely"
              >
                <rect x="-26" y="-26" width="52" height="52" fill="transparent" stroke="transparent" />
                <circle class="knot-grip" cx="0" cy="0" r="11" />
                <text class="knot-number" x="0" y="0">1</text>
              </g>
              <g
                data-graph-control="knot2"
                data-graph-handle="knot2"
                role="slider"
                tabindex="0"
                aria-label="Clipper point 2 input and output; drag freely"
              >
                <rect x="-26" y="-26" width="52" height="52" fill="transparent" stroke="transparent" />
                <circle class="knot-grip" cx="0" cy="0" r="11" />
                <text class="knot-number" x="0" y="0">2</text>
              </g>
              <g
                data-graph-control="knot3"
                data-graph-handle="knot3"
                role="slider"
                tabindex="0"
                aria-label="Clipper ceiling input and output; drag freely"
              >
                <rect x="-26" y="-26" width="52" height="52" fill="transparent" stroke="transparent" />
                <circle class="knot-grip" cx="0" cy="0" r="11" />
                <text class="knot-number" x="0" y="0">3</text>
              </g>
              <text class="graph-axis-label" x="58" y="369">0 input</text>
              <text class="graph-axis-label" x="722" y="369" text-anchor="end">+1.5 input</text>
              <text class="graph-axis-label" x="66" y="38">+1.5 output</text>
              <text class="graph-axis-label" x="66" y="339">0 output</text>
            </svg>
          </article>
        </section>

        <section class="analysis">
          <div class="meter-panel">
            <div class="readout"><span class="readout-label">Input peak</span><span class="readout-value" data-meter-in-peak>--</span></div>
            <div class="readout"><span class="readout-label">Output peak</span><span class="readout-value" data-meter-out-peak>--</span></div>
            <div class="readout"><span class="readout-label">Input RMS</span><span class="readout-value" data-meter-in-rms>--</span></div>
            <div class="readout"><span class="readout-label">Output RMS</span><span class="readout-value" data-meter-out-rms>--</span></div>
            <div class="readout"><span class="readout-label">RMS delta</span><span class="readout-value" data-meter-delta>--</span></div>
            <div class="readout"><span class="readout-label">Gain reduction</span><span class="readout-value" data-meter-gr>--</span></div>
            <div class="readout"><span class="readout-label">Clip activity</span><span class="readout-value" data-meter-clip>--</span></div>
            <div class="readout readout-effective"><span class="readout-label">Effective input</span><span class="readout-value" data-effective-input>--</span></div>
            <div class="readout readout-effective"><span class="readout-label">Effective makeup</span><span class="readout-value" data-effective-makeup>--</span></div>
            <div class="readout readout-effective"><span class="readout-label">Effective ratio</span><span class="readout-value" data-effective-ratio>--</span></div>
          </div>
        </section>

        <section class="groups" data-groups></section>
        <div id="control-help-tooltip" class="control-tooltip" data-control-tooltip data-visible="false" data-placement="above" role="tooltip" aria-hidden="true"></div>
      </main>
    `;
  }
}

export default function createPatchView(patchConnection) {
  const elementName = "cosimo-polish-voicing-lab-view";

  if (!window.customElements.get(elementName))
    window.customElements.define(elementName, PolishVoicingLabView);

  return new (window.customElements.get(elementName))(patchConnection);
}
