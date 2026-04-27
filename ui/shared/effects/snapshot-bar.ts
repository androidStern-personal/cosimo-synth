import type {
    EffectSnapshotBankController,
    EffectSnapshotBankState,
} from "./effect-snapshot-bank";

type SnapshotBankMutations = ReturnType<EffectSnapshotBankController["getMutations"]>;

const SNAPSHOT_BAR_CSS = /* css */ `
  :host {
    display: block;
    color: var(--foreground, #eff7ee);
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  .snapshot-panel {
    min-height: 38px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.16);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .snapshot-label {
    color: rgba(239, 247, 238, 0.56);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
  }

  .snapshot-camera-icon {
    display: block;
    width: 15px;
    height: 15px;
  }

  .snapshot-slots {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 0 0 auto;
  }

  .snapshot-slot {
    appearance: none;
    width: 24px;
    height: 24px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(239, 247, 238, 0.58);
    font: inherit;
    font-size: 11px;
    line-height: 1;
    text-align: center;
    cursor: pointer;
    outline: none;
  }

  .snapshot-slot.has-snapshot {
    background: rgba(143, 240, 164, 0.12);
    border-color: rgba(143, 240, 164, 0.34);
    color: rgba(239, 247, 238, 0.92);
  }

  .snapshot-slot.is-active {
    border-color: rgba(239, 247, 238, 0.86);
    box-shadow: 0 0 0 2px rgba(143, 240, 164, 0.35);
  }

  .snapshot-label-input {
    width: 132px;
    min-width: 0;
    height: 24px;
    padding: 0 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.2);
    color: rgba(239, 247, 238, 0.9);
    font: inherit;
    font-size: 10px;
  }

  .snapshot-label-input:disabled {
    opacity: 0.5;
  }

  .snapshot-message {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .snapshot-toast-host {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 400;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .snapshot-toast {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(14, 18, 16, 0.95);
    backdrop-filter: blur(12px);
    font-size: 11px;
    color: rgba(239, 247, 238, 0.8);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    animation: snapshot-toast-in 160ms ease forwards;
    font-family: inherit;
  }

  .snapshot-toast.success {
    color: var(--knob-track-value-color, #8ff0a4);
    border-color: rgba(143, 240, 164, 0.15);
  }

  .snapshot-toast.error {
    color: #ff9a7d;
    border-color: rgba(255, 154, 125, 0.15);
  }

  @keyframes snapshot-toast-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .snapshot-paste {
    position: absolute;
    z-index: 80;
    right: 10px;
    top: 42px;
    width: min(360px, calc(100vw - 24px));
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    background: rgba(12, 16, 14, 0.98);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.46);
  }

  .snapshot-paste label {
    display: grid;
    gap: 6px;
    color: rgba(239, 247, 238, 0.72);
    font-size: 10px;
  }

  .snapshot-paste textarea {
    width: 100%;
    min-height: 118px;
    resize: vertical;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.3);
    color: rgba(239, 247, 238, 0.88);
    font: 10px/1.45 Menlo, Monaco, Consolas, monospace;
  }

  .snapshot-paste-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 8px;
  }

  .snapshot-paste-actions button {
    height: 26px;
    padding: 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(239, 247, 238, 0.8);
    font: inherit;
    font-size: 10px;
    cursor: pointer;
  }
`;

const SNAPSHOT_BAR_HTML = /* html */ `
  <div class="snapshot-panel" aria-label="A through G snapshots">
    <span class="snapshot-label" aria-hidden="true">
      <svg class="snapshot-camera-icon" viewBox="0 0 24 24" focusable="false">
        <path d="M4 8.5h4l1.5-2h5l1.5 2h4v10H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="12" cy="13.5" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    </span>
    <div class="snapshot-slots" data-el="slots"></div>
    <input class="snapshot-label-input" data-el="label-input" data-snapshot-label-input type="text" placeholder="select A-G" autocomplete="off" spellcheck="false" disabled>
    <span class="snapshot-message" data-el="message" data-snapshot-message data-tone="neutral" aria-live="polite"></span>
    <div class="snapshot-toast-host" data-el="toast-host" data-snapshot-toast-host></div>
    <div data-el="paste-host" data-snapshot-paste-host></div>
  </div>
`;

const ELEMENT_NAME = "cosimo-snapshot-bar";

class SnapshotBar extends HTMLElement {
    private _controller: EffectSnapshotBankController | null = null;
    private _mutations: SnapshotBankMutations | null = null;
    private _unsubscribe: (() => void) | null = null;
    private _state: EffectSnapshotBankState | null = null;
    private _messageTimeout: number | null = null;
    private _activeMessageKey = "";
    private _copyFallbackToken = 0;
    private _pasteFallbackToken = 0;
    private readonly _els: Record<string, HTMLElement>;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: "open" });
        shadow.innerHTML = `<style>${SNAPSHOT_BAR_CSS}</style>${SNAPSHOT_BAR_HTML}`;
        this._els = this._cacheElements(shadow);
        this._attachEvents(shadow);
    }

    get controller(): EffectSnapshotBankController | null {
        return this._controller;
    }

    set controller(next: EffectSnapshotBankController | null) {
        if (this._controller === next) {
            return;
        }

        this._unsubscribe?.();
        this._unsubscribe = null;
        this._controller = next;
        this._mutations = next?.getMutations() ?? null;
        this._state = null;

        if (next) {
            this._unsubscribe = next.subscribe((state) => this._render(state));
            this._render(next.getState());
        } else {
            this._renderEmpty();
        }
    }

    disconnectedCallback() {
        this._unsubscribe?.();
        this._unsubscribe = null;
        this._clearMessageTimer();
    }

    private _cacheElements(root: ShadowRoot) {
        const elements: Record<string, HTMLElement> = {};

        for (const element of root.querySelectorAll<HTMLElement>("[data-el]")) {
            elements[element.dataset.el!] = element;
        }

        return elements;
    }

    private _attachEvents(root: ShadowRoot) {
        root.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const slot = target.closest<HTMLInputElement>("[data-slot]");

            if (slot) {
                this._selectSlot(slot.dataset.slot!);
            }
        });

        const labelInput = this._els["label-input"] as HTMLInputElement;
        labelInput.addEventListener("input", () => {
            this._mutations?.updateActiveSlotLabel(labelInput.value);
        });
    }

    private _render(state: EffectSnapshotBankState) {
        this._state = state;
        const focusedSlotID = (this.shadowRoot?.activeElement as HTMLElement | null)?.dataset?.slot;
        const slotsHost = this._els.slots;
        slotsHost.replaceChildren();

        for (const slotID of state.slotIDs) {
            const snapshot = state.slots[slotID] ?? null;
            const input = document.createElement("input");
            input.type = "text";
            input.inputMode = "none";
            input.autocomplete = "off";
            input.spellcheck = false;
            input.maxLength = 1;
            input.value = slotID;
            input.dataset.slot = slotID;
            input.className = [
                "snapshot-slot",
                snapshot ? "has-snapshot" : "is-empty",
                state.activeSlotID === slotID ? "is-active" : "",
            ].filter(Boolean).join(" ");
            input.setAttribute("aria-label", `${snapshot ? "Recall" : "Start"} snapshot ${slotID}`);
            input.addEventListener("focus", () => input.select());
            input.addEventListener("input", () => {
                input.value = slotID;
                input.select();
            });
            input.addEventListener("keydown", (event) => this._handleSlotKeydown(event, slotID));
            input.addEventListener("copy", (event) => this._copySnapshotEvent(event, slotID));
            input.addEventListener("paste", (event) => this._pasteSnapshotEvent(event, slotID));
            slotsHost.appendChild(input);
        }

        const labelInput = this._els["label-input"] as HTMLInputElement;
        const activeSnapshot = state.activeSlotID ? state.slots[state.activeSlotID] : null;
        labelInput.disabled = !activeSnapshot;
        labelInput.value = activeSnapshot?.label ?? "";
        labelInput.placeholder = activeSnapshot && state.activeSlotID ? `label ${state.activeSlotID}` : "select A-G";

        const message = state.lastMessage ?? state.lastError;

        if (message) {
            this._setMessage(message, state.lastError ? "error" : "success");
        }

        if (focusedSlotID) {
            this._focusSlot(focusedSlotID);
        }
    }

    private _renderEmpty() {
        this._els.slots.replaceChildren();
        const labelInput = this._els["label-input"] as HTMLInputElement;
        labelInput.value = "";
        labelInput.disabled = true;
        this._setMessage("", "neutral");
    }

    private _selectSlot(slotID: string) {
        const result = this._mutations?.selectSlot(slotID);

        if (result && !result.ok) {
            this._setMessage(result.message, "error");
        }

        this._focusSlot(slotID);
    }

    private _handleSlotKeydown(event: KeyboardEvent, slotID: string) {
        if (!event.metaKey && !event.ctrlKey) {
            return;
        }

        const key = event.key.toLowerCase();

        if (key === "c") {
            const token = ++this._copyFallbackToken;
            window.setTimeout(() => {
                if (token === this._copyFallbackToken) {
                    void this._copySnapshot(slotID);
                }
            }, 80);
        }

        if (key === "v") {
            const token = ++this._pasteFallbackToken;
            window.setTimeout(() => {
                if (token === this._pasteFallbackToken) {
                    void this._pasteSnapshot(slotID);
                }
            }, 80);
        }
    }

    private _copySnapshotEvent(event: ClipboardEvent, slotID: string) {
        event.preventDefault();
        this._copyFallbackToken += 1;
        const result = this._mutations?.exportSnapshotText(slotID);

        if (!result) {
            return;
        }

        if (!result.ok) {
            this._setMessage(result.message, "error");
            return;
        }

        event.clipboardData?.clearData();
        event.clipboardData?.setData("text/plain", result.value);
        this._setMessage(`Copied ${slotID}.`, "success");
    }

    private _pasteSnapshotEvent(event: ClipboardEvent, slotID: string) {
        event.preventDefault();
        this._pasteFallbackToken += 1;
        const result = this._mutations?.importSnapshotText(slotID, event.clipboardData?.getData("text/plain") ?? "");

        if (result && !result.ok) {
            this._setMessage(result.message, "error");
        }
    }

    private async _copySnapshot(slotID: string) {
        const result = await this._mutations?.copySnapshotToClipboard(slotID);

        if (result && !result.ok) {
            this._setMessage(result.message, "error");
        }
    }

    private async _pasteSnapshot(slotID: string) {
        const result = await this._mutations?.pasteSnapshotFromClipboard(slotID);

        if (result && !result.ok) {
            if (/clipboard read/i.test(result.message)) {
                this._openManualPaste(slotID);
                this._setMessage("Clipboard read was blocked. Paste JSON manually.", "error");
                return;
            }

            this._setMessage(result.message, "error");
        }
    }

    private _openManualPaste(slotID: string) {
        const pasteHost = this._els["paste-host"];
        const form = document.createElement("form");
        const label = document.createElement("label");
        const textarea = document.createElement("textarea");
        const actions = document.createElement("div");
        const apply = document.createElement("button");
        const cancel = document.createElement("button");

        form.className = "snapshot-paste";
        form.dataset.snapshotPasteForm = "";
        label.append(document.createTextNode(`Paste JSON into ${slotID}`), textarea);
        textarea.dataset.snapshotPasteText = "";
        textarea.spellcheck = false;
        textarea.autocomplete = "off";
        actions.className = "snapshot-paste-actions";
        apply.type = "submit";
        apply.textContent = "Apply";
        cancel.type = "button";
        cancel.dataset.snapshotPasteCancel = "";
        cancel.textContent = "Cancel";
        actions.append(apply, cancel);
        form.append(label, actions);
        pasteHost.replaceChildren(form);

        form.addEventListener("submit", (event) => {
            event.preventDefault();

            const result = this._mutations?.importSnapshotText(slotID, textarea.value);

            if (result?.ok) {
                pasteHost.replaceChildren();
            }
        });
        cancel.addEventListener("click", () => pasteHost.replaceChildren());
        textarea.focus();
    }

    private _focusSlot(slotID: string) {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>(`.snapshot-slot[data-slot="${slotID}"]`);
        input?.focus();
        input?.select();
    }

    private _setMessage(message: string, tone: "neutral" | "success" | "error") {
        const messageHost = this._els.message;
        const nextMessageKey = message ? `${tone}:${message}` : "";
        const shouldShowToast = Boolean(message) && nextMessageKey !== this._activeMessageKey;
        this._clearMessageTimer();
        this._activeMessageKey = nextMessageKey;
        messageHost.textContent = message;
        messageHost.dataset.tone = tone;
        messageHost.dataset.visible = message ? "true" : "false";

        if (message) {
            if (shouldShowToast && tone === "error") {
                this._showToast(message, "error");
            }

            this._messageTimeout = window.setTimeout(() => {
                messageHost.textContent = "";
                messageHost.dataset.tone = "neutral";
                messageHost.dataset.visible = "false";
                this._activeMessageKey = "";
                this._messageTimeout = null;
                this._mutations?.clearLastMessage();
            }, 3200);
        } else {
            this._activeMessageKey = "";
        }
    }

    private _showToast(message: string, tone: "success" | "error") {
        const toastHost = this._els["toast-host"];
        const toast = document.createElement("div");
        toast.className = `snapshot-toast ${tone}`;
        toast.dataset.snapshotToast = "";
        toast.textContent = message;
        toastHost.appendChild(toast);
        window.setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 250ms";
        }, 2200);
        window.setTimeout(() => toast.remove(), 2500);
    }

    private _clearMessageTimer() {
        if (this._messageTimeout !== null) {
            window.clearTimeout(this._messageTimeout);
            this._messageTimeout = null;
        }
    }
}

export function defineSnapshotBarElement(): void {
    if (!window.customElements.get(ELEMENT_NAME)) {
        window.customElements.define(ELEMENT_NAME, SnapshotBar);
    }
}

export function createSnapshotBar(): SnapshotBar {
    defineSnapshotBarElement();
    return document.createElement(ELEMENT_NAME) as SnapshotBar;
}
