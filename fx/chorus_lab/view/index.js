import { createPresetBar } from "../../../ui/shared/effects/preset-bar.ts";
import { createStandaloneEffectPresetController } from "../../../ui/shared/effects/standalone-effect-presets.ts";

class ChorusLabView extends HTMLElement {
  constructor(patchConnection) {
    super();
    this.patchConnection = patchConnection;
    this.Controls = this.patchConnection.utilities.ParameterControls;
    this.startupSeedCleanups = [];
    this.startupSeedInFlight = false;
    this.startupSeedComplete = false;
    this.startupSeedToken = 0;
    this.presetController = createStandaloneEffectPresetController({
      effectID: "chorus",
      patchConnection,
    });
    this.presetBar = createPresetBar();
    this.presetBar.controller = this.presetController;

    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = this.getMarkup();
    this.shadowRoot.querySelector(".frame").before(this.presetBar);
    this.groupsHost = this.shadowRoot.querySelector("[data-groups]");
  }

  connectedCallback() {
    this.presetController.attach();
    this.statusListener = status => this.renderFromStatus(status);
    this.patchConnection.addStatusListener(this.statusListener);
    this.patchConnection.requestStatusUpdate();
  }

  disconnectedCallback() {
    this.presetController.detach();
    this.presetBar.controller = null;
    this.cancelStartupSeedProbe();

    if (this.statusListener)
      this.patchConnection.removeStatusListener(this.statusListener);
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

      const hasOutOfRangeValue = parameters.some(parameter => (
        isOutOfRangeStartupValue(parameter, receivedValues.get(parameter.endpointID))
      ));

      if (!hasOutOfRangeValue)
        return;

      for (const parameter of parameters) {
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

    // Ableton was crashing when the stock AU view sent gesture start/end messages.
    // Keep the standard Cmajor controls, but silence DAW gesture notifications here.
    innerControl.beginGesture = () => {};
    innerControl.endGesture = () => {};

    return control;
  }

  getMarkup() {
    return `
      <style>
        :host {
          --foreground: #f4efe6;
          --background: rgba(13, 14, 19, 0.88);
          --knob-track-background-color: rgba(255, 255, 255, 0.14);
          --knob-track-value-color: #f0b867;
          --knob-dial-border-color: rgba(255, 255, 255, 0.88);
          --knob-dial-background-color: rgba(255, 255, 255, 0.05);
          --knob-dial-tick-color: #f4efe6;
          --switch-outline-color: rgba(255, 255, 255, 0.82);
          --switch-thumb-color: #f0b867;
          --switch-on-background-color: rgba(255, 255, 255, 0.04);
          --switch-off-background-color: rgba(255, 255, 255, 0.04);
          display: block;
          width: 920px;
          min-height: 680px;
          color: var(--foreground);
          background:
            radial-gradient(circle at top left, rgba(255, 214, 120, 0.18), transparent 34%),
            radial-gradient(circle at top right, rgba(108, 145, 255, 0.15), transparent 26%),
            linear-gradient(180deg, #17171d 0%, #0d0e13 100%);
          font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
        }

        * {
          box-sizing: border-box;
          user-select: none;
          -webkit-user-select: none;
        }

        .frame {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          width: 100%;
          min-height: 100%;
          padding: 18px;
        }

        .title,
        .group,
        .empty {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.04);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
        }

        .title {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 18px;
          grid-column: 1 / -1;
        }

        .title h1,
        .title p,
        .group h2 {
          margin: 0;
        }

        .title h1 {
          font-size: 22px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .title p {
          color: rgba(244, 239, 230, 0.72);
          font-size: 12px;
          line-height: 1.5;
        }

        .frame-groups {
          display: contents;
        }

        .group {
          padding: 16px;
        }

        .group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        h2 {
          font-size: 13px;
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

        .controls .labelled-control-name,
        .controls .labelled-control-value {
          letter-spacing: 0.04em;
        }

        .empty {
          grid-column: 1 / -1;
          padding: 18px;
          color: rgba(244, 239, 230, 0.74);
        }

        ${this.Controls.getAllCSS()}
      </style>

      <div class="frame">
        <section class="title">
          <h1>Chorus Lab</h1>
          <p>This view is generated directly from the patch parameters. It uses Cmajor’s built-in knob controls, but suppresses host gesture messages so the AU wrapper does not trip the Ableton crash path.</p>
        </section>
        <div data-groups class="frame-groups"></div>
      </div>
    `;
  }
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
  const elementName = "cosimo-chorus-lab-view";

  if (!window.customElements.get(elementName))
    window.customElements.define(elementName, ChorusLabView);

  return new (window.customElements.get(elementName))(patchConnection);
}
