import { createPresetBar } from "../../../ui/shared/effects/preset-bar.ts";
import { createStandaloneEffectPresetController } from "../../../ui/shared/effects/standalone-effect-presets.ts";
import { buildPluginStateContract } from "../../../ui/shared/effects/effect-state-contract.ts";
import {
  EFFECT_SNAPSHOT_KIND,
  EFFECT_SNAPSHOT_SCHEMA_VERSION,
  applyEffectSnapshot,
  captureEffectSnapshot,
  normalizeEffectSnapshot,
  parseEffectSnapshotText,
} from "../../../ui/shared/effects/effect-snapshots.ts";

const SNAPSHOT_SLOT_IDS = ["A", "B", "C", "D", "E", "F", "G"];
const SNAPSHOT_STORAGE_KEY = "cosimo.ottLab.snapshotSlots.v2";
const ACTIVE_SNAPSHOT_SLOT_STATE_KEY = "cosimo.ottLab.activeSnapshotSlot";
const LEGACY_SNAPSHOT_STORAGE_KEY = "cosimo.ottLab.snapshotSlots.v1";
const SNAPSHOT_EXPORT_KIND = EFFECT_SNAPSHOT_KIND;
const SNAPSHOT_PATCH_ID = "dev.cosimo.ott-lab";
const SNAPSHOT_SCHEMA = EFFECT_SNAPSHOT_SCHEMA_VERSION;

class OttLabView extends HTMLElement {
  constructor(patchConnection) {
    super();
    this.patchConnection = patchConnection;
    this.Controls = this.patchConnection.utilities.ParameterControls;
    this.startupSeedCleanups = [];
    this.startupSeedInFlight = false;
    this.startupSeedComplete = false;
    this.startupSeedToken = 0;
    this.snapshotStore = loadSnapshotStore();
    this.snapshotParameterCleanups = [];
    this.parameterValues = new Map();
    this.parameterInfoByID = new Map();
    this.snapshotContract = null;
    this.activeSnapshotSlot = undefined;
    this.activeSnapshotSlotStateRevision = 0;
    this.snapshotMessageTimeoutID = undefined;
    this.snapshotStorageWarningShown = false;
    this.copyFallbackToken = 0;
    this.pasteFallbackToken = 0;
    this.presetController = createStandaloneEffectPresetController({
      effectID: "ott",
      patchConnection,
    });
    this.presetBar = createPresetBar();
    this.presetBar.controller = this.presetController;

    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = this.getMarkup();
    this.shadowRoot.querySelector(".frame").before(this.presetBar);
    this.groupsHost = this.shadowRoot.querySelector("[data-groups]");
    this.snapshotHost = this.shadowRoot.querySelector("[data-snapshot-slots]");
    this.snapshotLabelInput = this.shadowRoot.querySelector("[data-snapshot-label-input]");
    this.snapshotMessageHost = this.shadowRoot.querySelector("[data-snapshot-message]");
    this.manualPasteHost = this.shadowRoot.querySelector("[data-snapshot-paste-host]");
    this.snapshotLabelInput?.addEventListener("input", () => {
      this.updateActiveSnapshotLabel(this.snapshotLabelInput.value);
    });
    this.renderSnapshotSlots();

    if (this.snapshotStore.__loadError) {
      window.queueMicrotask(() => this.setSnapshotMessage(this.snapshotStore.__loadError, "error"));
    }
  }

  connectedCallback() {
    this.activeSnapshotSlotStateListener = message => this.handleActiveSnapshotSlotState(message);
    this.patchConnection.addStoredStateValueListener?.(this.activeSnapshotSlotStateListener);
    this.requestActiveSnapshotSlotState();
    this.presetController.attach();
    this.statusListener = status => this.renderFromStatus(status);
    this.patchConnection.addStatusListener(this.statusListener);
    this.patchConnection.requestStatusUpdate();
  }

  disconnectedCallback() {
    this.presetController.detach();
    this.presetBar.controller = null;
    this.cancelStartupSeedProbe();
    this.cancelSnapshotParameterListeners();
    this.clearSnapshotMessageTimer();

    if (this.statusListener)
      this.patchConnection.removeStatusListener(this.statusListener);

    if (this.activeSnapshotSlotStateListener)
      this.patchConnection.removeStoredStateValueListener?.(this.activeSnapshotSlotStateListener);
  }

  requestActiveSnapshotSlotState() {
    if (typeof this.patchConnection.requestFullStoredState === "function") {
      const requestRevision = this.activeSnapshotSlotStateRevision;

      this.patchConnection.requestFullStoredState(storedState => {
        if (requestRevision !== this.activeSnapshotSlotStateRevision)
          return;

        const value = storedState?.[ACTIVE_SNAPSHOT_SLOT_STATE_KEY];

        if (value === undefined && typeof this.patchConnection.requestStoredStateValue === "function") {
          this.patchConnection.requestStoredStateValue(ACTIVE_SNAPSHOT_SLOT_STATE_KEY);
          return;
        }

        this.applyActiveSnapshotSlotState(value);
      });
      return;
    }

    this.patchConnection.requestStoredStateValue?.(ACTIVE_SNAPSHOT_SLOT_STATE_KEY);
  }

  handleActiveSnapshotSlotState(message) {
    if (!message || typeof message !== "object" || message.key !== ACTIVE_SNAPSHOT_SLOT_STATE_KEY)
      return;

    const slotID = normalizeSnapshotSlotID(message.value);

    if (this.activeSnapshotSlotStateRevision > 0 && slotID !== this.activeSnapshotSlot)
      return;

    this.applyActiveSnapshotSlotState(slotID);
  }

  applyActiveSnapshotSlotState(value) {
    const slotID = normalizeSnapshotSlotID(value);

    if (this.activeSnapshotSlot === slotID)
      return;

    this.activeSnapshotSlot = slotID;
    this.renderSnapshotSlots();
  }

  setActiveSnapshotSlot(slotID, { persist = true, render = true } = {}) {
    const normalizedSlotID = normalizeSnapshotSlotID(slotID);
    this.activeSnapshotSlot = normalizedSlotID;

    if (persist)
      this.persistActiveSnapshotSlot();

    if (render)
      this.renderSnapshotSlots();
  }

  persistActiveSnapshotSlot() {
    this.activeSnapshotSlotStateRevision += 1;
    this.patchConnection.sendStoredStateValue?.(
      ACTIVE_SNAPSHOT_SLOT_STATE_KEY,
      this.activeSnapshotSlot ?? null,
    );
  }

  renderFromStatus(status) {
    for (const cleanupTarget of this.groupsHost.querySelectorAll("[data-cleanup-control]"))
      cleanupTarget.__cleanup?.();

    const parameters = (status?.details?.inputs || [])
      .filter(endpoint => endpoint?.purpose === "parameter" && !endpoint?.annotation?.hidden);

    try {
      this.snapshotContract = buildPluginStateContract({
        effectID: "ott",
        status,
      });
    } catch {
      this.snapshotContract = null;
    }

    this.parameterInfoByID = new Map(parameters.map(parameter => [parameter.endpointID, parameter]));
    this.syncSnapshotParameterListeners(parameters);
    this.renderSnapshotSlots();
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

    // Keep Cmajor's stock controls, but silence host gesture notifications.
    // This follows the chorus lab workaround for Ableton AU gesture crashes.
    innerControl.beginGesture = () => {};
    innerControl.endGesture = () => {};

    return control;
  }

  cancelSnapshotParameterListeners() {
    for (const cleanup of this.snapshotParameterCleanups)
      cleanup();

    this.snapshotParameterCleanups = [];
  }

  syncSnapshotParameterListeners(parameters) {
    this.cancelSnapshotParameterListeners();

    for (const parameter of parameters) {
      const listener = value => {
        const normalisedValue = normaliseParameterValue(parameter, value);

        if (normalisedValue === undefined)
          return;

        this.parameterValues.set(parameter.endpointID, normalisedValue);
        this.updateActiveSnapshotParameter(parameter.endpointID, normalisedValue);
      };

      this.patchConnection.addParameterListener(parameter.endpointID, listener);
      this.snapshotParameterCleanups.push(() => this.patchConnection.removeParameterListener(parameter.endpointID, listener));
      this.patchConnection.requestParameterValue(parameter.endpointID);
    }
  }

  renderSnapshotSlots() {
    if (!this.snapshotHost)
      return;

    this.snapshotHost.innerHTML = "";

    for (const slotID of SNAPSHOT_SLOT_IDS) {
      const slot = this.snapshotStore.slots[slotID] ?? null;
      const isActive = this.activeSnapshotSlot === slotID;
      const slotElement = document.createElement("input");
      slotElement.type = "text";
      slotElement.inputMode = "none";
      slotElement.autoComplete = "off";
      slotElement.spellcheck = false;
      slotElement.maxLength = 1;
      slotElement.className = [
        "snapshot-slot",
        slot ? "has-snapshot" : "is-empty",
        isActive ? "is-active" : "",
      ].filter(Boolean).join(" ");
      slotElement.dataset.slot = slotID;
      slotElement.value = slotID;
      slotElement.setAttribute("aria-label", `${slot ? "Recall" : "Start"} snapshot ${slotID}`);
      slotElement.addEventListener("click", () => this.selectSnapshotSlot(slotID));
      slotElement.addEventListener("focus", () => slotElement.select());
      slotElement.addEventListener("input", () => {
        slotElement.value = slotID;
        slotElement.select();
      });
      slotElement.addEventListener("keydown", event => this.handleSnapshotSlotKeydown(event, slotID));
      slotElement.addEventListener("copy", event => {
        event.preventDefault();
        this.copyFallbackToken += 1;
        this.copySnapshotSlotToClipboardData(slotID, event.clipboardData);
      });
      slotElement.addEventListener("paste", event => {
        event.preventDefault();
        this.pasteFallbackToken += 1;
        this.importSnapshotText(slotID, event.clipboardData?.getData("text/plain") ?? "");
      });

      this.snapshotHost.appendChild(slotElement);
    }

    this.syncSnapshotLabelInput();
  }

  handleSnapshotSlotKeydown(event, slotID) {
    if (!event.metaKey && !event.ctrlKey)
      return;

    const key = event.key.toLowerCase();

    if (key === "c") {
      const token = ++this.copyFallbackToken;

      window.setTimeout(() => {
        if (token === this.copyFallbackToken)
          void this.copySnapshotSlot(slotID);
      }, 80);
      return;
    }

    if (key === "v") {
      const token = ++this.pasteFallbackToken;

      window.setTimeout(() => {
        if (token === this.pasteFallbackToken)
          void this.pasteSnapshotSlot(slotID);
      }, 80);
    }
  }

  selectSnapshotSlot(slotID) {
    if (!SNAPSHOT_SLOT_IDS.includes(slotID))
      return false;

    const slot = this.snapshotStore.slots[slotID] ?? null;

    if (slot)
      return this.recallSnapshotSlot(slotID);

    if (!this.ensureSnapshotSlot(slotID))
      return false;

    this.setActiveSnapshotSlot(slotID, { render: false });
    this.persistSnapshotStore();
    this.renderSnapshotSlots();
    this.focusSnapshotSlot(slotID);
    this.setSnapshotMessage(`Active ${slotID}.`, "success");
    return true;
  }

  ensureSnapshotSlot(slotID) {
    if (this.snapshotStore.slots[slotID])
      return true;

    let snapshot;

    try {
      snapshot = this.captureCurrentSnapshot(slotID);
    } catch (error) {
      this.setSnapshotMessage(`Snapshot ${slotID} failed: ${messageFromError(error)}`, "error");
      return false;
    }

    this.snapshotStore.slots[slotID] = {
      ...snapshot,
      updatedAt: new Date().toISOString(),
    };
    return true;
  }

  updateActiveSnapshotParameter(endpointID, value) {
    if (!this.activeSnapshotSlot)
      return;

    if (!this.ensureSnapshotSlot(this.activeSnapshotSlot))
      return;

    const slot = this.snapshotStore.slots[this.activeSnapshotSlot];
    const nextSnapshot = {
      ...slot,
      parameters: {
        ...slot.parameters,
        [endpointID]: value,
      },
    };

    try {
      this.snapshotStore.slots[this.activeSnapshotSlot] = {
        ...normalizeEffectSnapshot(nextSnapshot, {
          currentContract: this.requireSnapshotContract(),
        }),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.setSnapshotMessage(`Snapshot ${this.activeSnapshotSlot} failed: ${messageFromError(error)}`, "error");
      return;
    }

    this.persistSnapshotStore({ silent: true });
  }

  updateActiveSnapshotLabel(label) {
    if (!this.activeSnapshotSlot)
      return;

    if (!this.ensureSnapshotSlot(this.activeSnapshotSlot))
      return;

    const slot = this.snapshotStore.slots[this.activeSnapshotSlot];
    slot.label = label;
    slot.updatedAt = new Date().toISOString();
    this.persistSnapshotStore({ silent: true });
  }

  syncSnapshotLabelInput() {
    if (!this.snapshotLabelInput)
      return;

    if (!this.activeSnapshotSlot) {
      this.snapshotLabelInput.value = "";
      this.snapshotLabelInput.disabled = true;
      this.snapshotLabelInput.placeholder = "select A-G";
      return;
    }

    const slot = this.snapshotStore.slots[this.activeSnapshotSlot] ?? null;
    this.snapshotLabelInput.disabled = !slot;
    this.snapshotLabelInput.value = slot?.label ?? "";
    this.snapshotLabelInput.placeholder = slot ? `label ${this.activeSnapshotSlot}` : "select A-G";
  }

  recallSnapshotSlot(slotID) {
    const slot = this.snapshotStore.slots[slotID] ?? null;

    if (!slot) {
      this.setSnapshotMessage(`Snapshot ${slotID} is empty.`, "error");
      return false;
    }

    const previousActiveSlot = this.activeSnapshotSlot;
    this.setActiveSnapshotSlot(slotID, { persist: false, render: false });

    try {
      const appliedSnapshot = applyEffectSnapshot({
        snapshot: slot,
        currentContract: this.requireSnapshotContract(),
        patchConnection: this.patchConnection,
      });
      this.snapshotStore.slots[slotID] = {
        ...appliedSnapshot,
        updatedAt: slot.updatedAt,
      };
    } catch (error) {
      this.setActiveSnapshotSlot(previousActiveSlot, { persist: false, render: true });
      this.setSnapshotMessage(messageFromError(error), "error");
      return false;
    }

    this.persistActiveSnapshotSlot();
    this.renderSnapshotSlots();
    this.focusSnapshotSlot(slotID);
    this.setSnapshotMessage(`Active ${slotID}.`, "success");
    return true;
  }

  async copySnapshotSlot(slotID) {
    const slot = this.snapshotStore.slots[slotID] ?? null;

    if (!slot) {
      this.setSnapshotMessage(`Snapshot ${slotID} is empty.`, "error");
      return false;
    }

    const payload = createSnapshotExport(slotID, slot);

    try {
      await writeTextToClipboard(JSON.stringify(payload, null, 2));
      this.setSnapshotMessage(`Copied ${slotID}.`, "success");
      return true;
    } catch (error) {
      this.setSnapshotMessage(`Copy failed: ${messageFromError(error)}`, "error");
      return false;
    }
  }

  copySnapshotSlotToClipboardData(slotID, clipboardData) {
    const slot = this.snapshotStore.slots[slotID] ?? null;

    if (!slot) {
      this.setSnapshotMessage(`Snapshot ${slotID} is empty.`, "error");
      return false;
    }

    if (!clipboardData) {
      this.setSnapshotMessage("Copy failed: clipboard data is unavailable.", "error");
      return false;
    }

    const payload = createSnapshotExport(slotID, slot);
    clipboardData.clearData();
    clipboardData.setData("text/plain", JSON.stringify(payload, null, 2));
    this.setSnapshotMessage(`Copied ${slotID}.`, "success");
    return true;
  }

  async pasteSnapshotSlot(slotID) {
    try {
      const clipboardText = await readTextFromClipboard();
      return this.importSnapshotText(slotID, clipboardText);
    } catch {
      this.openManualPaste(slotID);
      return false;
    }
  }

  importSnapshotText(slotID, snapshotText) {
    const parsed = parseSnapshotText(snapshotText);

    if (!parsed.ok) {
      this.setSnapshotMessage(parsed.message, "error");
      return false;
    }

    let snapshot;

    try {
      snapshot = this.normalizeImportedSnapshot(parsed.payload, slotID);
    } catch (error) {
      this.setSnapshotMessage(messageFromError(error), "error");
      return false;
    }

    const previousActiveSlot = this.activeSnapshotSlot;
    this.setActiveSnapshotSlot(slotID, { persist: false, render: false });

    try {
      applyEffectSnapshot({
        snapshot,
        currentContract: this.requireSnapshotContract(),
        patchConnection: this.patchConnection,
      });
    } catch (error) {
      this.setActiveSnapshotSlot(previousActiveSlot, { persist: false, render: true });
      this.setSnapshotMessage(messageFromError(error), "error");
      return false;
    }

    this.snapshotStore.slots[slotID] = {
      ...snapshot,
      updatedAt: new Date().toISOString(),
    };
    this.persistSnapshotStore();
    this.persistActiveSnapshotSlot();
    this.renderSnapshotSlots();
    this.focusSnapshotSlot(slotID);
    this.setSnapshotMessage(`Pasted into ${slotID}.`, "success");
    return true;
  }

  openManualPaste(slotID) {
    if (!this.manualPasteHost)
      return;

    this.manualPasteHost.innerHTML = `
      <form class="snapshot-paste" data-snapshot-paste-form>
        <label>
          Paste JSON into ${slotID}
          <textarea data-snapshot-paste-text spellcheck="false" autocomplete="off"></textarea>
        </label>
        <div class="snapshot-paste-actions">
          <button type="submit">Apply</button>
          <button type="button" data-snapshot-paste-cancel>Cancel</button>
        </div>
      </form>
    `;

    const form = this.manualPasteHost.querySelector("[data-snapshot-paste-form]");
    const textarea = this.manualPasteHost.querySelector("[data-snapshot-paste-text]");
    const cancelButton = this.manualPasteHost.querySelector("[data-snapshot-paste-cancel]");
    const closePaste = () => {
      this.manualPasteHost.innerHTML = "";
    };

    form.addEventListener("submit", event => {
      event.preventDefault();

      if (this.importSnapshotText(slotID, textarea.value))
        closePaste();
    });
    cancelButton.addEventListener("click", closePaste);
    textarea.focus();
    this.setSnapshotMessage("Clipboard read was blocked. Paste JSON manually.", "warn");
  }

  requireSnapshotContract() {
    if (!this.snapshotContract)
      throw new Error("Snapshot contract is not available yet.");

    return this.snapshotContract;
  }

  captureCurrentSnapshot(slotID) {
    const currentParameterValues = {};

    for (const parameter of this.requireSnapshotContract().parameters) {
      if (this.parameterValues.has(parameter.endpointID))
        currentParameterValues[parameter.endpointID] = this.parameterValues.get(parameter.endpointID);
    }

    return captureEffectSnapshot({
      slotID,
      currentContract: this.requireSnapshotContract(),
      currentParameterValues,
      label: this.snapshotStore.slots[slotID]?.label ?? "",
    });
  }

  normalizeImportedSnapshot(payload, slotID) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new Error("Snapshot JSON must be an object.");

    if (payload.kind !== SNAPSHOT_EXPORT_KIND)
      throw new Error(`Snapshot kind must be ${SNAPSHOT_EXPORT_KIND}.`);

    if (payload.version !== SNAPSHOT_SCHEMA)
      throw new Error(`Snapshot version must be ${SNAPSHOT_SCHEMA}.`);

    if (payload.effectID !== "ott")
      throw new Error(`Cannot import ${payload.effectID} snapshot into ott.`);

    if (payload.label !== undefined && typeof payload.label !== "string")
      throw new Error("Snapshot label must be a string.");

    return normalizeEffectSnapshot({
      ...payload,
      slotID,
      label: payload.label ?? "",
    }, {
      currentContract: this.requireSnapshotContract(),
    });
  }

  focusSnapshotSlot(slotID) {
    const button = this.snapshotHost?.querySelector(`.snapshot-slot[data-slot="${slotID}"]`);

    if (button instanceof HTMLInputElement) {
      button.focus();
      button.select();
    }
  }

  persistSnapshotStore({ silent = false } = {}) {
    const result = saveSnapshotStore(this.snapshotStore);

    if (!result.ok && (!silent || !this.snapshotStorageWarningShown)) {
      this.snapshotStorageWarningShown = true;
      this.setSnapshotMessage(`Saved for this session only: ${result.message}`, "warn");
    }
  }

  clearSnapshotMessageTimer() {
    if (this.snapshotMessageTimeoutID !== undefined) {
      window.clearTimeout(this.snapshotMessageTimeoutID);
      this.snapshotMessageTimeoutID = undefined;
    }
  }

  setSnapshotMessage(message, tone = "neutral") {
    if (!this.snapshotMessageHost)
      return;

    this.clearSnapshotMessageTimer();
    this.snapshotMessageHost.textContent = message;
    this.snapshotMessageHost.dataset.tone = tone;
    this.snapshotMessageHost.dataset.visible = "true";
    this.snapshotMessageTimeoutID = window.setTimeout(() => {
      this.snapshotMessageHost.textContent = "";
      this.snapshotMessageHost.dataset.tone = "neutral";
      this.snapshotMessageHost.dataset.visible = "false";
      this.snapshotMessageTimeoutID = undefined;
    }, 3200);
  }

  getMarkup() {
    return `
      <style>
        :host {
          --foreground: #eff7ee;
          --background: rgba(10, 15, 13, 0.92);
          --knob-track-background-color: rgba(255, 255, 255, 0.14);
          --knob-track-value-color: #8ff0a4;
          --knob-dial-border-color: rgba(255, 255, 255, 0.88);
          --knob-dial-background-color: rgba(255, 255, 255, 0.05);
          --knob-dial-tick-color: #eff7ee;
          --switch-outline-color: rgba(255, 255, 255, 0.82);
          --switch-thumb-color: #8ff0a4;
          --switch-on-background-color: rgba(255, 255, 255, 0.04);
          --switch-off-background-color: rgba(255, 255, 255, 0.04);
          display: block;
          width: 920px;
          min-height: 720px;
          color: var(--foreground);
          background:
            radial-gradient(circle at 16% 6%, rgba(143, 240, 164, 0.19), transparent 30%),
            radial-gradient(circle at 86% 0%, rgba(255, 232, 132, 0.13), transparent 28%),
            linear-gradient(180deg, #111714 0%, #070a09 100%);
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
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
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
          color: rgba(239, 247, 238, 0.72);
          font-size: 12px;
          line-height: 1.5;
        }

        .frame-groups {
          display: contents;
        }

        .snapshot-panel {
          display: grid;
          grid-template-columns: auto auto minmax(150px, 1fr);
          align-items: center;
          gap: 8px;
          padding-top: 2px;
        }

        .snapshot-label {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(239, 247, 238, 0.58);
        }

        .snapshot-message {
          position: absolute;
          top: 14px;
          right: 14px;
          max-width: 320px;
          padding: 7px 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.72);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
          font-size: 10px;
          letter-spacing: 0.04em;
          color: rgba(239, 247, 238, 0.58);
          opacity: 0;
          pointer-events: none;
          transform: translateY(-4px);
          transition: opacity 120ms ease, transform 120ms ease;
        }

        .snapshot-message[data-visible="true"] {
          opacity: 1;
          transform: translateY(0);
        }

        .snapshot-message[data-tone="success"] {
          color: #8ff0a4;
        }

        .snapshot-message[data-tone="warn"] {
          color: #ffe884;
        }

        .snapshot-message[data-tone="error"] {
          color: #ff9a7d;
        }

        .snapshot-slots {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .snapshot-slot {
          appearance: none;
          position: relative;
          width: 30px;
          height: 24px;
          padding: 0;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 7px;
          color: rgba(239, 247, 238, 0.7);
          background: rgba(0, 0, 0, 0.22);
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          cursor: pointer;
          user-select: text;
          -webkit-user-select: text;
        }

        .snapshot-slot.has-snapshot {
          color: rgba(239, 247, 238, 0.95);
          background: rgba(255, 255, 255, 0.055);
        }

        .snapshot-slot.has-snapshot::after {
          content: "";
          position: absolute;
          right: 4px;
          bottom: 4px;
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: #8ff0a4;
          opacity: 0.78;
        }

        .snapshot-slot:hover,
        .snapshot-slot:focus-visible {
          border-color: rgba(143, 240, 164, 0.45);
          background: rgba(143, 240, 164, 0.11);
          outline: none;
        }

        .snapshot-slot.is-active {
          border-color: rgba(143, 240, 164, 0.76);
          color: #07100a;
          background: #8ff0a4;
          box-shadow: 0 0 0 1px rgba(143, 240, 164, 0.18);
        }

        .snapshot-slot.is-active::after {
          background: #07100a;
        }

        .snapshot-label-input {
          min-width: 0;
          height: 24px;
          padding: 0 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 7px;
          color: rgba(239, 247, 238, 0.92);
          background: rgba(0, 0, 0, 0.22);
          font-family: inherit;
          font-size: 11px;
          letter-spacing: 0.03em;
          user-select: text;
          -webkit-user-select: text;
        }

        .snapshot-label-input:disabled {
          opacity: 0.45;
        }

        .snapshot-label-input:focus {
          border-color: rgba(143, 240, 164, 0.52);
          outline: none;
          background: rgba(143, 240, 164, 0.08);
        }

        .snapshot-paste {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.32);
        }

        .snapshot-paste label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: rgba(239, 247, 238, 0.78);
          font-size: 11px;
        }

        .snapshot-paste textarea {
          width: 100%;
          min-height: 72px;
          resize: vertical;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          color: var(--foreground);
          background: rgba(0, 0, 0, 0.42);
          font-family: inherit;
          font-size: 11px;
          user-select: text;
          -webkit-user-select: text;
        }

        .snapshot-paste-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .snapshot-paste-actions button {
          appearance: none;
          min-width: 0;
          padding: 5px 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 7px;
          color: rgba(239, 247, 238, 0.9);
          background: rgba(255, 255, 255, 0.045);
          font-family: inherit;
          font-size: 9px;
          letter-spacing: 0.05em;
          cursor: pointer;
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
          color: rgba(239, 247, 238, 0.74);
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
          color: rgba(239, 247, 238, 0.74);
        }

        ${this.Controls.getAllCSS()}
      </style>

      <div class="frame">
        <section class="title">
          <h1>OTT Lab</h1>
          <p>Standalone multiband upward/downward dynamics lab. The view is generated from Cmajor parameters and uses stock controls so the DSP can be auditioned before synth integration.</p>
          <div class="snapshot-panel" aria-label="Local A through G snapshots">
            <strong class="snapshot-label">Snap</strong>
            <div class="snapshot-slots" data-snapshot-slots></div>
            <input class="snapshot-label-input" data-snapshot-label-input type="text" placeholder="select A-G" autocomplete="off" spellcheck="false" disabled>
            <span class="snapshot-message" data-snapshot-message data-tone="neutral" aria-live="polite"></span>
            <div data-snapshot-paste-host></div>
          </div>
        </section>
        <div data-groups class="frame-groups"></div>
      </div>
    `;
  }
}

function createEmptySnapshotStore(loadError) {
  const store = {
    schema: SNAPSHOT_SCHEMA,
    patchID: SNAPSHOT_PATCH_ID,
    slots: Object.fromEntries(SNAPSHOT_SLOT_IDS.map(slotID => [slotID, null])),
  };

  if (loadError) {
    Object.defineProperty(store, "__loadError", {
      value: loadError,
      enumerable: false,
    });
  }

  return store;
}

function normalizeSnapshotSlotID(value) {
  return SNAPSHOT_SLOT_IDS.includes(value) ? value : undefined;
}

function loadSnapshotStore() {
  try {
    window.localStorage?.removeItem(LEGACY_SNAPSHOT_STORAGE_KEY);
    const rawStore = window.localStorage?.getItem(SNAPSHOT_STORAGE_KEY);

    if (!rawStore)
      return createEmptySnapshotStore();

    const parsedStore = JSON.parse(rawStore);

    if (parsedStore?.schema !== SNAPSHOT_SCHEMA || parsedStore?.patchID !== SNAPSHOT_PATCH_ID)
      return createEmptySnapshotStore();

    const store = createEmptySnapshotStore();

    for (const slotID of SNAPSHOT_SLOT_IDS) {
      const slot = parsedStore.slots?.[slotID];

      if (!slot)
        continue;

      if (typeof slot !== "object" || slot.kind !== SNAPSHOT_EXPORT_KIND || slot.version !== SNAPSHOT_SCHEMA)
        throw new Error(`Stored snapshot ${slotID} is not valid ${SNAPSHOT_EXPORT_KIND} version ${SNAPSHOT_SCHEMA}.`);

      store.slots[slotID] = {
        ...slot,
        slotID,
        updatedAt: typeof slot.updatedAt === "string" ? slot.updatedAt : undefined,
      };
    }

    return store;
  } catch (error) {
    return createEmptySnapshotStore(`Stored snapshots were ignored: ${messageFromError(error)}`);
  }
}

function saveSnapshotStore(store) {
  if (!window.localStorage)
    return { ok: false, message: "localStorage is unavailable." };

  try {
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(store));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageFromError(error) };
  }
}

function createSnapshotExport(slotID, slot) {
  return {
    kind: slot.kind,
    version: slot.version,
    effectID: slot.effectID,
    slotID,
    label: slot.label ?? "",
    contract: slot.contract,
    parameters: { ...slot.parameters },
    storedState: { ...slot.storedState },
  };
}

function parseSnapshotText(snapshotText) {
  if (typeof snapshotText !== "string" || snapshotText.trim().length === 0)
    return { ok: false, message: "Paste JSON is empty." };

  try {
    return { ok: true, payload: parseEffectSnapshotText(snapshotText) };
  } catch (error) {
    return { ok: false, message: `Invalid JSON: ${messageFromError(error)}` };
  }
}

function normaliseParameterValue(parameter, value) {
  if (value === undefined || value === null)
    return undefined;

  if (parameter?.annotation?.boolean)
    return value === true || value === 1;

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : parameter?.annotation?.init;
}

async function writeTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Embedded WebViews can expose navigator.clipboard but still reject writes.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy"))
      throw new Error("document.execCommand('copy') returned false.");
  } finally {
    textarea.remove();
  }
}

async function readTextFromClipboard() {
  if (!navigator.clipboard?.readText)
    throw new Error("Clipboard read is unavailable.");

  return navigator.clipboard.readText();
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
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
  const elementName = "cosimo-ott-lab-view";

  if (!window.customElements.get(elementName))
    window.customElements.define(elementName, OttLabView);

  return new (window.customElements.get(elementName))(patchConnection);
}
