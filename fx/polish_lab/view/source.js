import { getControlHelp } from "./control-help.js";
import { SHAPER_ENDPOINTS, SHAPER_RESET_VALUES } from "./curve-model.js";
import { createPolishGraphStudio } from "./graph-studio.js";

const COMPRESSOR_CONTROLS = Object.freeze([
  "thresholdDb",
  "ratio",
  "kneeDb",
  "attackMs",
  "releaseMs",
  "makeupDb",
]);
const VISIBLE_CONTROLS = new Set([...COMPRESSOR_CONTROLS, "morph"]);
const PREVIEW_ENDPOINTS = Object.freeze([
  ...COMPRESSOR_CONTROLS,
  "bypass",
  ...SHAPER_ENDPOINTS,
]);

const RESET_VALUES = Object.freeze({
  bypass: false,
  thresholdDb: 0,
  ratio: 4,
  kneeDb: 6,
  attackMs: 10,
  releaseMs: 120,
  makeupDb: 0,
  morph: 0,
  ...SHAPER_RESET_VALUES,
});

class PolishVoicingLabView extends HTMLElement {
  constructor(patchConnection) {
    super();
    this.patchConnection = patchConnection;
    this.Controls = patchConnection.utilities.ParameterControls;
    this.parameters = [];
    this.parameterValues = new Map();
    this.parameterListeners = new Map();
    this.controlCleanups = [];
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = this.getMarkup();
    this.compressorControls = this.shadowRoot.querySelector("[data-compressor-controls]");
    this.morphControls = this.shadowRoot.querySelector("[data-morph-controls]");
    this.resetButton = this.shadowRoot.querySelector("[data-reset]");
    this.compareButton = this.shadowRoot.querySelector("[data-compare]");
    this.tooltip = this.shadowRoot.querySelector("[data-tooltip]");
    this.onHelpPointerOver = event => this.showHelp(event);
    this.onHelpPointerMove = event => this.moveHelp(event.clientX, event.clientY);
    this.onHelpPointerOut = event => {
      const current = this.helpControlForEvent(event);
      const next = event.relatedTarget?.closest?.("[data-control-help]");
      if (current && next !== current) this.hideHelp();
    };
    this.onHelpFocusIn = event => this.showHelp(event);
    this.onHelpFocusOut = () => this.hideHelp();
    this.graphStudio = createPolishGraphStudio({
      root: this.shadowRoot,
      patchConnection: this.patchConnection,
      parameterValues: this.parameterValues,
      sendParameter: (endpointID, value) => this.patchConnection.sendEventOrValue(endpointID, value, 0),
    });
    this.resetButton.addEventListener("click", () => this.reset());
    this.compareButton.addEventListener("click", () => this.toggleBypass());
    this.shadowRoot.addEventListener("pointerover", this.onHelpPointerOver);
    this.shadowRoot.addEventListener("pointermove", this.onHelpPointerMove);
    this.shadowRoot.addEventListener("pointerout", this.onHelpPointerOut);
    this.shadowRoot.addEventListener("focusin", this.onHelpFocusIn);
    this.shadowRoot.addEventListener("focusout", this.onHelpFocusOut);
  }

  connectedCallback() {
    this.statusListener = status => this.renderFromStatus(status);
    this.meterListener = frame => this.graphStudio.pushTelemetry(frame);
    this.patchConnection.addStatusListener(this.statusListener);
    this.patchConnection.addEndpointListener?.("meterOut", this.meterListener);
    this.patchConnection.requestStatusUpdate();
  }

  disconnectedCallback() {
    for (const [endpointID, listener] of this.parameterListeners)
      this.patchConnection.removeParameterListener?.(endpointID, listener);
    for (const cleanup of this.controlCleanups) cleanup();
    this.patchConnection.removeStatusListener?.(this.statusListener);
    this.patchConnection.removeEndpointListener?.("meterOut", this.meterListener);
    this.graphStudio.destroy();
    this.shadowRoot.removeEventListener("pointerover", this.onHelpPointerOver);
    this.shadowRoot.removeEventListener("pointermove", this.onHelpPointerMove);
    this.shadowRoot.removeEventListener("pointerout", this.onHelpPointerOut);
    this.shadowRoot.removeEventListener("focusin", this.onHelpFocusIn);
    this.shadowRoot.removeEventListener("focusout", this.onHelpFocusOut);
  }

  renderFromStatus(status) {
    for (const [endpointID, listener] of this.parameterListeners)
      this.patchConnection.removeParameterListener?.(endpointID, listener);
    for (const cleanup of this.controlCleanups) cleanup();
    this.parameterListeners.clear();
    this.controlCleanups = [];
    this.compressorControls.replaceChildren();
    this.morphControls.replaceChildren();

    this.parameters = (status?.details?.inputs ?? [])
      .filter(endpoint => endpoint?.purpose === "parameter");
    const parametersByID = new Map(this.parameters.map(parameter => [parameter.endpointID, parameter]));

    for (const endpointID of [...COMPRESSOR_CONTROLS, "morph"]) {
      const endpoint = parametersByID.get(endpointID);
      if (!endpoint || !VISIBLE_CONTROLS.has(endpointID)) continue;
      const control = this.createParameterControl(endpoint);
      if (!control) continue;
      (endpointID === "morph" ? this.morphControls : this.compressorControls).append(control);
    }

    for (const endpointID of PREVIEW_ENDPOINTS) {
      if (!parametersByID.has(endpointID)) continue;
      const listener = value => {
        this.parameterValues.set(endpointID, value);
        if (endpointID === "bypass") this.renderCompareState();
        this.graphStudio.render();
      };
      this.parameterListeners.set(endpointID, listener);
      this.patchConnection.addParameterListener(endpointID, listener);
      this.patchConnection.requestParameterValue(endpointID);
    }
  }

  createParameterControl(endpointInfo) {
    const control = this.Controls.createLabelledControl(this.patchConnection, endpointInfo);
    if (!control) return undefined;
    const help = getControlHelp(endpointInfo);
    if (help) {
      control.dataset.controlHelp = help;
      control.setAttribute("aria-description", help);
      control.setAttribute("title", help);
      control.childControl?.setAttribute?.("aria-description", help);
    }
    this.controlCleanups.push(() => control.__cleanup?.());
    return control;
  }

  reset() {
    for (const [endpointID, value] of Object.entries(RESET_VALUES))
      this.patchConnection.sendEventOrValue(endpointID, value, 0);
  }

  toggleBypass() {
    const bypassed = this.parameterValues.get("bypass") === true || this.parameterValues.get("bypass") === 1;
    this.patchConnection.sendEventOrValue("bypass", !bypassed, 0);
  }

  renderCompareState() {
    const bypassed = this.parameterValues.get("bypass") === true || this.parameterValues.get("bypass") === 1;
    this.compareButton.textContent = bypassed ? "Processed" : "Dry";
    this.compareButton.dataset.active = String(bypassed);
  }

  helpControlForEvent(event) {
    return event.composedPath().find(element => element?.dataset?.controlHelp);
  }

  showHelp(event) {
    const control = this.helpControlForEvent(event);
    if (!control) return;
    this.tooltip.textContent = control.dataset.controlHelp;
    this.tooltip.dataset.visible = "true";
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      this.moveHelp(event.clientX, event.clientY);
    } else {
      const bounds = control.getBoundingClientRect();
      this.moveHelp(bounds.right, bounds.top);
    }
  }

  moveHelp(clientX, clientY) {
    if (this.tooltip.dataset.visible !== "true") return;
    const left = Math.max(8, Math.min(window.innerWidth - 298, Number(clientX) + 14));
    const top = Math.max(8, Math.min(window.innerHeight - 74, Number(clientY) + 14));
    this.tooltip.style.left = left + "px";
    this.tooltip.style.top = top + "px";
  }

  hideHelp() {
    this.tooltip.dataset.visible = "false";
  }

  getMarkup() {
    return `
      <style>
        :host {
          --ink: #f5f0e8;
          --muted: rgba(245, 240, 232, .58);
          --line: rgba(255, 255, 255, .12);
          --panel: rgba(255, 255, 255, .045);
          --accent: #ffb45a;
          --cyan: #6edccd;
          --foreground: var(--accent);
          --background: rgba(255, 255, 255, .10);
          display: block;
          width: 1120px;
          min-height: 820px;
          color: var(--ink);
          background: linear-gradient(155deg, #17181c, #0a0b0e 72%);
          font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
        }
        * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
        button { font: inherit; }
        .shell { padding: 16px; }
        .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        h1 { margin: 0; font-size: 20px; letter-spacing: .04em; }
        h2 { margin: 0; color: var(--accent); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
        .actions { display: flex; gap: 7px; }
        .actions button, .tool-button {
          min-height: 36px; padding: 7px 11px; border: 1px solid var(--line); border-radius: 8px;
          color: var(--ink); background: rgba(255,255,255,.045); cursor: pointer;
        }
        .actions button:hover, .actions button[data-active="true"], .tool-button:hover { border-color: var(--accent); }
        .panel {
          margin-bottom: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 14px;
          background: var(--panel);
        }
        .panel-header { display: flex; align-items: center; justify-content: space-between; min-height: 24px; }
        .summary { color: var(--muted); font-size: 9px; }
        svg { display: block; width: 100%; touch-action: none; }
        .compressor-graph { height: 250px; }
        .shaper-graph { height: 430px; }
        .plot-border, .zero-axis { fill: none; stroke: rgba(255,255,255,.12); stroke-width: 1; }
        .unity-line { fill: none; stroke: rgba(255,255,255,.42); stroke-width: 1.5; }
        .transfer-curve { fill: none; stroke: var(--accent); stroke-width: 3; }
        .operating-point {
          fill: var(--cyan); stroke: #0b0c0f; stroke-width: 4; opacity: 0;
          filter: drop-shadow(0 0 6px rgba(110,220,205,.7)); pointer-events: none;
        }
        .operating-point[data-active="true"] { opacity: 1; }
        .graph-handle-hit, .shape-point-hit { fill: transparent; stroke: transparent; pointer-events: all; }
        .graph-handle { fill: #101115; stroke: var(--cyan); stroke-width: 2.5; }
        .graph-handle-label {
          fill: var(--ink); font-size: 8px; font-weight: 800; text-anchor: middle;
          dominant-baseline: central; pointer-events: none;
        }
        .graph-handle-connector { fill: none; stroke: rgba(110,220,205,.55); stroke-width: 1; pointer-events: none; }
        .gesture-readout { opacity: 0; pointer-events: none; }
        .gesture-readout[data-visible="true"] { opacity: 1; }
        .gesture-readout rect { fill: rgba(10,11,14,.94); stroke: var(--cyan); stroke-width: 1; }
        .gesture-readout text { fill: var(--ink); font-size: 11px; font-weight: 700; }
        .shape-point { fill: #101115; stroke: var(--cyan); stroke-width: 3; }
        .morph-endpoint-hit { fill: transparent; stroke: transparent; pointer-events: all; }
        .morph-endpoint { fill: #101115; stroke: var(--accent); stroke-width: 3; }
        [data-morph-endpoint="B"] .morph-endpoint { stroke: var(--cyan); }
        .morph-endpoint-label {
          fill: var(--ink); font-size: 9px; font-weight: 700; text-anchor: middle;
          dominant-baseline: central; pointer-events: none;
        }
        [data-morph-endpoint] { cursor: move; }
        .shape-segment-hit {
          fill: none; stroke: rgba(255,180,90,0); stroke-width: 44; pointer-events: stroke; cursor: ns-resize;
        }
        .shape-segment-hit:hover { stroke: rgba(255,180,90,.10); }
        [data-shape-point-handle] { cursor: move; }
        [data-shape-point-handle][data-selected="true"] .shape-point { stroke: var(--accent); }
        .shape-point-label {
          fill: var(--cyan); font-size: 10px; font-weight: 700; text-anchor: middle;
          pointer-events: none;
        }
        .axis-label { fill: var(--muted); font-size: 10px; }
        .gr-strip { display: grid; grid-template-columns: 70px 1fr; align-items: center; gap: 8px; height: 62px; }
        .gr-strip span { color: var(--muted); font-size: 9px; }
        .gr-trace { fill: none; stroke: var(--cyan); stroke-width: 2; }
        .controls-row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; margin-top: 8px; }
        .controls-row .labelled-control { --labelled-control-font-color: var(--ink); margin: 0; }
        .controls-row .labelled-control-centered-control { width: 5.4rem; height: 4.9rem; }
        .controls-row .labelled-control-label-container { max-width: 5.4rem; font-size: 9px; }
        .shaper-footer {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 12px; min-height: 86px;
          padding-top: 6px; border-top: 1px solid var(--line);
        }
        .shape-workbench { display: grid; gap: 7px; min-width: 0; }
        .shape-tools { display: flex; align-items: center; gap: 7px; min-height: 36px; }
        .shape-selection, .morph-owner { min-width: 128px; color: var(--cyan); font-size: 9px; }
        .shape-inspector { display: flex; align-items: center; gap: 8px; min-height: 34px; }
        .shape-inspector-label { min-width: 128px; color: var(--muted); font-size: 9px; }
        .shape-exact-field { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: 9px; }
        .shape-exact-field[hidden] { display: none; }
        .shape-exact-field input {
          width: 86px; min-height: 30px; padding: 4px 6px; border: 1px solid var(--line); border-radius: 6px;
          color: var(--ink); background: #101115; font: inherit; user-select: text; -webkit-user-select: text;
        }
        .shape-exact-field input:focus { outline: 1px solid var(--cyan); border-color: var(--cyan); }
        .tooltip {
          position: fixed; z-index: 20; width: max-content; max-width: 280px; padding: 7px 9px;
          border: 1px solid rgba(110,220,205,.5); border-radius: 7px; color: var(--ink);
          background: rgba(12,13,16,.97); font-size: 9px; line-height: 1.4; pointer-events: none;
          opacity: 0; transform: translateY(3px); transition: opacity 80ms linear, transform 80ms linear;
        }
        .tooltip[data-visible="true"] { opacity: 1; transform: translateY(0); }
        ${this.Controls.getAllCSS()}
      </style>
      <main class="shell">
        <header class="topbar">
          <h1>Curve Lab</h1>
          <div class="actions">
            <button type="button" data-compare data-control-help="Toggle between dry input and processed output.">Dry</button>
            <button type="button" data-reset data-control-help="Restore the neutral compressor and one ceiling per side.">Reset</button>
          </div>
        </header>

        <section class="panel">
          <div class="panel-header"><h2>Compressor</h2><span class="summary" data-compressor-summary></span></div>
          <svg
            class="compressor-graph"
            viewBox="0 0 800 280"
            role="img"
            aria-label="Compressor input to output curve"
            data-transfer-graph="compressor"
            data-input-min="-48"
            data-input-max="12"
            data-output-min="-48"
            data-output-max="12"
            data-plot-left="54"
            data-plot-right="746"
            data-plot-top="18"
            data-plot-bottom="262"
          >
            <rect class="plot-border" x="54" y="18" width="692" height="244" />
            <path class="unity-line" d="M54 262L746 18" />
            <path class="transfer-curve" data-compressor-curve />
            <circle class="operating-point" data-compressor-operating-point data-active="false" r="7" />
            <path class="graph-handle-connector" data-knee-connector />
            <g data-graph-handle="threshold" data-control-help="Threshold: drag horizontally." role="slider" aria-label="Threshold"><circle class="graph-handle-hit" r="25"/><circle class="graph-handle" r="11"/><text class="graph-handle-label" y=".5">T</text></g>
            <g data-graph-handle="ratio" data-control-help="Ratio: drag vertically." role="slider" aria-label="Ratio"><circle class="graph-handle-hit" r="25"/><circle class="graph-handle" r="11"/><text class="graph-handle-label" y=".5">R</text></g>
            <g data-graph-handle="knee" data-control-help="Knee width: drag horizontally." role="slider" aria-label="Knee"><circle class="graph-handle-hit" r="25"/><circle class="graph-handle" r="11"/><text class="graph-handle-label" y=".5">K</text></g>
            <g data-graph-handle="makeup" data-control-help="Makeup gain: drag vertically." role="slider" aria-label="Makeup"><circle class="graph-handle-hit" r="25"/><circle class="graph-handle" r="11"/><text class="graph-handle-label" y=".5">M</text></g>
            <g class="gesture-readout" data-compressor-readout data-visible="false" transform="translate(64 30)">
              <rect x="0" y="0" width="220" height="34" rx="7"/><text x="10" y="22" data-compressor-readout-text></text>
            </g>
          </svg>
          <div class="gr-strip"><span>Gain reduction</span><svg viewBox="0 0 692 60"><path class="gr-trace" data-gain-reduction-trace data-sample-count="0"/></svg></div>
          <div class="controls-row" data-compressor-controls></div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2>Waveshaper</h2></div>
          <svg
            class="shaper-graph"
            viewBox="0 0 800 430"
            role="img"
            aria-label="Editable bipolar input to output transfer curve"
            data-transfer-graph="shaper"
            data-input-min="-1.5"
            data-input-max="1.5"
            data-output-min="-1.5"
            data-output-max="1.5"
            data-plot-left="44"
            data-plot-right="756"
            data-plot-top="18"
            data-plot-bottom="402"
          >
            <rect class="plot-border" x="44" y="18" width="712" height="384" />
            <path class="zero-axis" d="M400 18V402 M44 210H756" />
            <path class="unity-line" data-unity-line d="M44 402L756 18" />
            <path class="transfer-curve" data-shaper-curve />
            <g data-shape-segments></g>
            <g data-shape-points></g>
            <g data-morph-visuals></g>
            <circle class="operating-point" data-shaper-operating-point data-active="false" r="8" />
            <g class="gesture-readout" data-shaper-readout data-visible="false" transform="translate(54 28)">
              <rect x="0" y="0" width="286" height="34" rx="7"/><text x="10" y="22" data-shaper-readout-text></text>
            </g>
            <text class="axis-label" data-shaper-axis-label data-axis="x" x="162.7" y="422" text-anchor="middle">−1</text>
            <text class="axis-label" data-shaper-axis-label data-axis="x" x="400" y="422" text-anchor="middle">0</text>
            <text class="axis-label" data-shaper-axis-label data-axis="x" x="637.3" y="422" text-anchor="middle">+1</text>
            <text class="axis-label" data-shaper-axis-label data-axis="y" x="38" y="342" text-anchor="end">−1</text>
            <text class="axis-label" data-shaper-axis-label data-axis="y" x="38" y="214" text-anchor="end">0</text>
            <text class="axis-label" data-shaper-axis-label data-axis="y" x="38" y="86" text-anchor="end">+1</text>
          </svg>
          <div class="shaper-footer">
            <div class="shape-workbench">
              <div class="shape-tools">
                <span class="shape-selection" data-shape-selection>Positive point 1</span>
                <button class="tool-button" type="button" data-shape-add data-control-help="Insert a point halfway along the selected segment.">Add point</button>
                <button class="tool-button" type="button" data-shape-delete data-control-help="Remove the selected point." disabled>Delete point</button>
                <span class="morph-owner" data-morph-owner>Morph A: Positive point 1</span>
                <button class="tool-button" type="button" data-morph-assign data-control-help="Make the selected point Morph position A; then drag B to set its destination.">Use selected as A</button>
              </div>
              <div class="shape-inspector" data-shape-inspector>
                <span class="shape-inspector-label" data-shape-inspector-label>Positive point 1</span>
                <label class="shape-exact-field" data-shape-exact-wrap="input">In
                  <input type="number" step="0.000001" data-shape-exact-field="input" aria-label="Selected point input">
                </label>
                <label class="shape-exact-field" data-shape-exact-wrap="output">Out
                  <input type="number" step="0.000001" min="-1.5" max="1.5" data-shape-exact-field="output" aria-label="Selected point output">
                </label>
                <label class="shape-exact-field" data-shape-exact-wrap="bend" hidden>Bend
                  <input type="number" step="0.000001" min="-1" max="1" data-shape-exact-field="bend" aria-label="Selected segment bend">
                </label>
              </div>
            </div>
            <div class="controls-row" data-morph-controls></div>
          </div>
        </section>
      </main>
      <div class="tooltip" data-tooltip data-visible="false" role="tooltip"></div>
    `;
  }
}

export default function createPatchView(patchConnection) {
  const elementName = "cosimo-polish-voicing-lab-view";
  if (!window.customElements.get(elementName))
    window.customElements.define(elementName, PolishVoicingLabView);
  return new (window.customElements.get(elementName))(patchConnection);
}
