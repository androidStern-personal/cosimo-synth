import type {
    StandaloneEffectPresetController,
    StandaloneEffectPresetListItem,
    StandaloneEffectPresetMutationResult,
    StandaloneEffectPresetSourceFilter,
    StandaloneEffectPresetState,
} from "./standalone-effect-presets";

// ── Types ────────────────────────────────────────────────

type SaveDialogMode = "new" | "rename" | "duplicate";

// ── Helpers ──────────────────────────────────────────────

function escHTML(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showToast(host: HTMLElement, message: string, tone: "success" | "warn" | "error") {
    const el = document.createElement("div");
    el.className = `cpb-toast ${tone}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity 250ms"; }, 2200);
    setTimeout(() => el.remove(), 2500);
}

function handleMutationResult<T>(
    result: StandaloneEffectPresetMutationResult<T>,
    toastHost: HTMLElement,
    successMessage?: string,
): boolean {
    if (result.ok) {
        showToast(toastHost, successMessage ?? result.message, "success");
        return true;
    }

    showToast(toastHost, result.message, "error");
    return false;
}

// ── CSS ──────────────────────────────────────────────────

const PRESET_BAR_CSS = /* css */ `
  :host {
    display: block;
    position: relative;
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    color: var(--foreground, #eff7ee);
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ── Preset Bar ─────────────────────────────────────── */
  .preset-bar {
    display: flex;
    align-items: center;
    gap: 0;
    height: 38px;
    background: rgba(0,0,0,0.22);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    border-radius: var(--preset-bar-border-radius, 0);
    overflow: hidden;
    position: relative;
    z-index: 60;
  }

  .nav-btn {
    appearance: none;
    border: none;
    width: 32px;
    height: 100%;
    background: transparent;
    color: rgba(239,247,238,0.45);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 80ms;
    flex-shrink: 0;
  }
  .nav-btn:hover {
    color: var(--knob-track-value-color, #8ff0a4);
    background: rgba(143,240,164,0.06);
  }
  .nav-btn:active { background: rgba(143,240,164,0.12); }

  /* ── Name Region ────────────────────────────────────── */
  .name-region {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
    padding: 0 12px;
    cursor: pointer;
    transition: background 80ms;
    position: relative;
    min-width: 0;
  }
  .name-region:hover { background: rgba(255,255,255,0.03); }
  .name-region.open { background: rgba(143,240,164,0.04); }

  .preset-name {
    font-size: 12px;
    letter-spacing: 0.03em;
    color: rgba(239,247,238,0.92);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dirty-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffe884;
    flex-shrink: 0;
    display: none;
  }
  .dirty-indicator.visible { display: block; }

  .source-tag {
    font-size: 8px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(239,247,238,0.25);
    flex-shrink: 0;
  }

  .chevron {
    color: rgba(239,247,238,0.25);
    font-size: 9px;
    margin-left: auto;
    flex-shrink: 0;
    transition: transform 150ms;
  }
  .name-region.open .chevron { transform: rotate(180deg); }

  /* ── Action Group ───────────────────────────────────── */
  .action-group {
    display: flex;
    align-items: center;
    height: 100%;
    border-left: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .action-btn {
    appearance: none;
    border: none;
    height: 100%;
    padding: 0 12px;
    background: transparent;
    color: rgba(239,247,238,0.4);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 80ms;
    white-space: nowrap;
  }
  .action-btn:hover {
    color: var(--knob-track-value-color, #8ff0a4);
    background: rgba(143,240,164,0.06);
  }
  .action-btn:active { background: rgba(143,240,164,0.1); }
  .action-btn:disabled { opacity: 0.25; pointer-events: none; }
  .action-btn.highlight { color: rgba(143,240,164,0.7); }

  .action-sep {
    width: 1px;
    height: 16px;
    background: rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  /* ── Flyout Dropdown ────────────────────────────────── */
  .flyout-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 49;
  }
  .flyout-backdrop.open { display: block; }

  .flyout {
    display: none;
    position: absolute;
    top: 38px;
    left: 0;
    right: 0;
    background: rgba(12,16,14,0.98);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.08);
    border-top: none;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
    z-index: 50;
    max-height: 400px;
    flex-direction: column;
    overflow: hidden;
  }
  .flyout.open { display: flex; }

  .flyout-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .flyout-search {
    flex: 1;
    height: 28px;
    padding: 0 10px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 7px;
    background: rgba(0,0,0,0.3);
    color: rgba(239,247,238,0.9);
    font: inherit;
    font-size: 11px;
    letter-spacing: 0.02em;
  }
  .flyout-search::placeholder { color: rgba(239,247,238,0.25); }
  .flyout-search:focus { border-color: rgba(143,240,164,0.4); outline: none; }

  .filter-pill {
    appearance: none;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 999px;
    padding: 4px 10px;
    height: 28px;
    background: transparent;
    color: rgba(239,247,238,0.4);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 100ms;
    white-space: nowrap;
  }
  .filter-pill:hover:not(.active) {
    background: rgba(255,255,255,0.04);
    color: rgba(239,247,238,0.6);
  }
  .filter-pill.active {
    background: rgba(143,240,164,0.12);
    border-color: rgba(143,240,164,0.25);
    color: var(--knob-track-value-color, #8ff0a4);
  }

  /* Preset list */
  .flyout-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }
  .flyout-list::-webkit-scrollbar { width: 5px; }
  .flyout-list::-webkit-scrollbar-track { background: transparent; }
  .flyout-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

  .section-header {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(239,247,238,0.25);
    padding: 10px 16px 4px;
  }
  .section-header:first-child { padding-top: 6px; }

  .preset-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    height: 32px;
    cursor: pointer;
    transition: background 60ms;
  }
  .preset-item:hover { background: rgba(255,255,255,0.04); }
  .preset-item.active { background: rgba(143,240,164,0.08); }

  .preset-item .item-name {
    flex: 1;
    font-size: 12px;
    letter-spacing: 0.02em;
    color: rgba(239,247,238,0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .preset-item.active .item-name { color: var(--knob-track-value-color, #8ff0a4); }

  .preset-item .item-source {
    font-size: 8px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(239,247,238,0.2);
    flex-shrink: 0;
  }

  .preset-item .item-dirty-star {
    color: #ffe884;
    font-size: 11px;
    flex-shrink: 0;
    display: none;
  }

  .preset-item .item-ctx {
    appearance: none;
    border: none;
    background: transparent;
    color: rgba(239,247,238,0.2);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
    opacity: 0;
    transition: opacity 60ms;
    flex-shrink: 0;
  }
  .preset-item:hover .item-ctx { opacity: 1; }
  .preset-item .item-ctx:hover { color: rgba(239,247,238,0.6); }

  .flyout-empty {
    padding: 28px 16px;
    text-align: center;
    font-size: 11px;
    color: rgba(239,247,238,0.25);
  }

  /* Flyout footer */
  .flyout-footer {
    display: flex;
    gap: 6px;
    padding: 8px 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .flyout-footer-btn {
    appearance: none;
    flex: 1;
    height: 30px;
    border: 1px dashed rgba(255,255,255,0.1);
    border-radius: 7px;
    background: transparent;
    color: rgba(239,247,238,0.4);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 100ms;
  }
  .flyout-footer-btn:hover {
    border-color: rgba(143,240,164,0.3);
    color: var(--knob-track-value-color, #8ff0a4);
    background: rgba(143,240,164,0.05);
  }

  /* ── Context Menu ───────────────────────────────────── */
  .ctx-menu {
    display: none;
    position: fixed;
    min-width: 200px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    background: rgba(14,18,16,0.98);
    backdrop-filter: blur(24px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.65);
    z-index: 200;
    padding: 4px 0;
    overflow: hidden;
  }
  .ctx-menu.open { display: block; }

  .ctx-sep {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 4px 0;
  }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    cursor: pointer;
    transition: background 60ms;
    font-size: 11px;
    color: rgba(239,247,238,0.75);
    letter-spacing: 0.02em;
  }
  .ctx-item:hover {
    background: rgba(143,240,164,0.1);
    color: var(--knob-track-value-color, #8ff0a4);
  }
  .ctx-item .shortcut {
    margin-left: auto;
    font-size: 9px;
    color: rgba(239,247,238,0.2);
    letter-spacing: 0.04em;
  }
  .ctx-item.danger { color: #ff9a7d; }
  .ctx-item.danger:hover { background: rgba(255,154,125,0.1); color: #ff9a7d; }

  /* ── Save Dialog ────────────────────────────────────── */
  .dialog-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 300;
    align-items: center;
    justify-content: center;
  }
  .dialog-overlay.open { display: flex; }

  .dialog {
    width: 380px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    background: rgba(14,18,16,0.98);
    backdrop-filter: blur(24px);
    padding: 22px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    font-family: inherit;
    color: var(--foreground, #eff7ee);
  }

  .dialog h3 {
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .dialog label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(239,247,238,0.45);
    margin-bottom: 6px;
  }

  .dialog input[type="text"] {
    width: 100%;
    height: 34px;
    padding: 0 12px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    background: rgba(0,0,0,0.3);
    color: rgba(239,247,238,0.92);
    font: inherit;
    font-size: 12px;
    margin-bottom: 18px;
  }
  .dialog input[type="text"]:focus {
    border-color: rgba(143,240,164,0.5);
    outline: none;
  }

  .dialog-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .dialog-actions button {
    appearance: none;
    height: 32px;
    padding: 0 18px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px;
    background: rgba(255,255,255,0.04);
    color: rgba(239,247,238,0.65);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 100ms;
  }
  .dialog-actions button:hover { background: rgba(255,255,255,0.08); }
  .dialog-actions button.primary {
    background: rgba(143,240,164,0.16);
    border-color: rgba(143,240,164,0.35);
    color: var(--knob-track-value-color, #8ff0a4);
  }
  .dialog-actions button.primary:hover { background: rgba(143,240,164,0.26); }

  /* ── Toast ──────────────────────────────────────────── */
  .cpb-toast-host {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 400;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .cpb-toast {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(14,18,16,0.95);
    backdrop-filter: blur(12px);
    font-size: 11px;
    color: rgba(239,247,238,0.8);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: cpb-toast-in 160ms ease forwards;
    font-family: inherit;
  }
  .cpb-toast.success { color: var(--knob-track-value-color, #8ff0a4); border-color: rgba(143,240,164,0.15); }
  .cpb-toast.warn { color: #ffe884; border-color: rgba(255,232,132,0.15); }
  .cpb-toast.error { color: #ff9a7d; border-color: rgba(255,154,125,0.15); }

  @keyframes cpb-toast-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// ── HTML ─────────────────────────────────────────────────

const PRESET_BAR_HTML = /* html */ `
  <div class="preset-bar">
    <button class="nav-btn" data-action="prev" title="Previous preset">&#8249;</button>

    <div class="name-region" data-action="toggle-flyout">
      <span class="preset-name" data-el="preset-name">No Preset</span>
      <span class="dirty-indicator" data-el="dirty-dot"></span>
      <span class="source-tag" data-el="source-tag"></span>
      <span class="chevron">&#9662;</span>
    </div>

    <button class="nav-btn" data-action="next" title="Next preset">&#8250;</button>

    <div class="action-group">
      <button class="action-btn highlight" data-action="save" data-el="btn-save" disabled>Save</button>
      <span class="action-sep"></span>
      <button class="action-btn" data-action="save-as">Save As</button>
      <span class="action-sep"></span>
      <button class="action-btn" data-action="revert" data-el="btn-revert" disabled>Revert</button>
      <span class="action-sep"></span>
      <button class="action-btn" data-action="copy">Copy</button>
      <span class="action-sep"></span>
      <button class="action-btn" data-action="paste">Paste</button>
    </div>
  </div>

  <div class="flyout" data-el="flyout">
    <div class="flyout-header">
      <input class="flyout-search" data-el="flyout-search" type="text" placeholder="Search presets..." autocomplete="off" spellcheck="false">
      <button class="filter-pill active" data-filter="all">All</button>
      <button class="filter-pill" data-filter="factory">Factory</button>
      <button class="filter-pill" data-filter="user">User</button>
    </div>
    <div class="flyout-list" data-el="flyout-list"></div>
    <div class="flyout-footer">
      <button class="flyout-footer-btn" data-action="footer-save-as">+ Save current as new preset</button>
      <button class="flyout-footer-btn" data-action="footer-paste">Paste JSON</button>
    </div>
  </div>

  <div class="flyout-backdrop" data-el="flyout-backdrop"></div>

  <div class="ctx-menu" data-el="ctx-menu">
    <div class="ctx-item" data-ctx="rename">Rename <span class="shortcut">F2</span></div>
    <div class="ctx-item" data-ctx="duplicate">Duplicate</div>
    <div class="ctx-item" data-ctx="overwrite">Overwrite with current</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" data-ctx="copy">Copy as JSON <span class="shortcut">&#8984;C</span></div>
    <div class="ctx-sep"></div>
    <div class="ctx-item danger" data-ctx="delete">Delete <span class="shortcut">&#9003;</span></div>
  </div>

  <div class="dialog-overlay" data-el="dialog-overlay">
    <div class="dialog">
      <h3 data-el="dialog-title">Save Preset</h3>
      <label for="cpb-save-name">Preset Name</label>
      <input type="text" id="cpb-save-name" data-el="dialog-input" value="">
      <div class="dialog-actions">
        <button data-action="dialog-cancel">Cancel</button>
        <button class="primary" data-action="dialog-confirm" data-el="dialog-confirm">Save</button>
      </div>
    </div>
  </div>

  <div class="cpb-toast-host" data-el="toast-host"></div>
`;

// ── Web Component ────────────────────────────────────────

const ELEMENT_NAME = "cosimo-preset-bar";

class PresetBar extends HTMLElement {
    private _controller: StandaloneEffectPresetController | null = null;
    private _unsubscribe: (() => void) | null = null;
    private _state: StandaloneEffectPresetState | null = null;
    private _mutations: ReturnType<StandaloneEffectPresetController["getMutations"]> | null = null;

    private _flyoutOpen = false;
    private _ctxTarget: StandaloneEffectPresetListItem | null = null;
    private _saveDialogMode: SaveDialogMode = "new";
    private _saveDialogPresetKey: string | null = null;

    // Cached DOM refs
    private _els!: Record<string, HTMLElement>;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: "open" });
        shadow.innerHTML = `<style>${PRESET_BAR_CSS}</style>${PRESET_BAR_HTML}`;
        this._els = this._cacheElements(shadow);
        this._attachEventListeners(shadow);
    }

    get controller(): StandaloneEffectPresetController | null {
        return this._controller;
    }

    set controller(next: StandaloneEffectPresetController | null) {
        if (this._controller === next) return;

        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }

        this._controller = next;
        this._mutations = null;
        this._state = null;

        if (next) {
            this._mutations = next.getMutations();
            this._unsubscribe = next.subscribe((state) => this._onState(state));
            this._onState(next.getState());
        }
    }

    disconnectedCallback() {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }

        this._closeFlyout();
        this._closeCtxMenu();
        this._closeDialog();
    }

    // ── DOM cache ────────────────────────────────────────

    private _cacheElements(root: ShadowRoot): Record<string, HTMLElement> {
        const els: Record<string, HTMLElement> = {};

        for (const el of root.querySelectorAll<HTMLElement>("[data-el]")) {
            els[el.dataset.el!] = el;
        }

        return els;
    }

    // ── Event listeners ──────────────────────────────────

    private _attachEventListeners(root: ShadowRoot) {
        // Delegate clicks on [data-action] and [data-ctx] and [data-filter]
        root.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;

            // Action buttons
            const actionEl = target.closest<HTMLElement>("[data-action]");
            if (actionEl) {
                this._handleAction(actionEl.dataset.action!);
                return;
            }

            // Filter pills
            const filterEl = target.closest<HTMLElement>("[data-filter]");
            if (filterEl) {
                this._handleFilterPill(filterEl);
                return;
            }

            // Context menu items
            const ctxEl = target.closest<HTMLElement>("[data-ctx]");
            if (ctxEl) {
                this._handleCtxAction(ctxEl.dataset.ctx!);
                return;
            }

            // Preset item click
            const itemEl = target.closest<HTMLElement>("[data-preset-key]");
            if (itemEl && !target.closest(".item-ctx")) {
                this._applyPreset(itemEl.dataset.presetKey!);
                return;
            }

            // Flyout backdrop
            if (target === this._els["flyout-backdrop"]) {
                this._closeFlyout();
                return;
            }

            // Dialog overlay
            if (target === this._els["dialog-overlay"]) {
                this._closeDialog();
                return;
            }

            // Close ctx menu on click outside
            const ctxMenu = this._els["ctx-menu"];
            if (ctxMenu.classList.contains("open") && !ctxMenu.contains(target)) {
                this._closeCtxMenu();
            }
        });

        // Context menu button (kebab) inside preset items
        root.addEventListener("click", (e) => {
            const ctxBtn = (e.target as HTMLElement).closest<HTMLElement>(".item-ctx");
            if (!ctxBtn) return;
            e.stopPropagation();

            const itemEl = ctxBtn.closest<HTMLElement>("[data-preset-key]");
            if (!itemEl) return;

            this._openCtxMenu(e as MouseEvent, itemEl.dataset.presetKey!);
        });

        // Right-click on preset items
        root.addEventListener("contextmenu", (e) => {
            const itemEl = (e.target as HTMLElement).closest<HTMLElement>("[data-preset-key][data-source='user']");
            if (!itemEl) return;

            e.preventDefault();
            this._openCtxMenu(e as MouseEvent, itemEl.dataset.presetKey!);
        });

        // Search input
        const searchInput = this._els["flyout-search"] as HTMLInputElement;
        searchInput.addEventListener("input", () => {
            this._mutations?.setFilter({ query: searchInput.value });
        });

        // Dialog input enter key
        const dialogInput = this._els["dialog-input"] as HTMLInputElement;
        dialogInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") this._confirmDialog();
            if (e.key === "Escape") this._closeDialog();
        });

        // Escape key
        root.addEventListener("keydown", (e) => {
            if ((e as globalThis.KeyboardEvent).key === "Escape") {
                if (this._els["dialog-overlay"].classList.contains("open")) {
                    this._closeDialog();
                } else if (this._els["ctx-menu"].classList.contains("open")) {
                    this._closeCtxMenu();
                } else if (this._flyoutOpen) {
                    this._closeFlyout();
                }
            }
        });
    }

    // ── Actions ──────────────────────────────────────────

    private _handleAction(action: string) {
        switch (action) {
            case "prev": this._navigate(-1); break;
            case "next": this._navigate(1); break;
            case "toggle-flyout": this._toggleFlyout(); break;
            case "save": this._doSave(); break;
            case "save-as":
            case "footer-save-as":
                this._closeFlyout();
                this._openSaveDialog("new");
                break;
            case "revert": this._doRevert(); break;
            case "copy": this._doCopy(); break;
            case "paste":
            case "footer-paste":
                this._closeFlyout();
                this._doPaste();
                break;
            case "dialog-cancel": this._closeDialog(); break;
            case "dialog-confirm": this._confirmDialog(); break;
        }
    }

    private _handleFilterPill(el: HTMLElement) {
        const source = el.dataset.filter as StandaloneEffectPresetSourceFilter;
        this._mutations?.setFilter({ source });

        // Update pill active states immediately
        for (const pill of this.shadowRoot!.querySelectorAll<HTMLElement>(".filter-pill")) {
            pill.classList.toggle("active", pill.dataset.filter === source);
        }
    }

    private _handleCtxAction(action: string) {
        const target = this._ctxTarget;
        if (!target) { this._closeCtxMenu(); return; }

        switch (action) {
            case "rename":
                this._closeCtxMenu();
                this._openSaveDialog("rename", target.presetKey, target.label);
                break;
            case "duplicate":
                this._closeCtxMenu();
                this._openSaveDialog("duplicate", target.presetKey, `${target.label} (Copy)`);
                break;
            case "overwrite": {
                const result = this._mutations!.overwriteUserPreset(target.presetKey);
                handleMutationResult(result, this._els["toast-host"]);
                this._closeCtxMenu();
                break;
            }
            case "copy": {
                void this._mutations!.copyPresetToClipboard(target.presetKey).then((result) => {
                    handleMutationResult(result, this._els["toast-host"]);
                });
                this._closeCtxMenu();
                break;
            }
            case "delete": {
                const result = this._mutations!.deletePreset(target.presetKey);
                handleMutationResult(result, this._els["toast-host"]);
                this._closeCtxMenu();
                break;
            }
        }
    }

    private _navigate(direction: number) {
        const state = this._state;
        if (!state || state.visiblePresets.length === 0) return;

        const currentIndex = state.visiblePresets.findIndex((p) => p.isActive);
        let nextIndex: number;

        if (currentIndex < 0) {
            nextIndex = direction > 0 ? 0 : state.visiblePresets.length - 1;
        } else {
            nextIndex = (currentIndex + direction + state.visiblePresets.length) % state.visiblePresets.length;
        }

        this._applyPreset(state.visiblePresets[nextIndex].presetKey);
    }

    private _applyPreset(presetKey: string) {
        const result = this._mutations?.applyPreset(presetKey);
        if (result) handleMutationResult(result, this._els["toast-host"]);
        this._closeFlyout();
        this._closeCtxMenu();
    }

    private _doSave() {
        const state = this._state;
        if (!state?.activePreset) return;

        const activeItem = state.presets.find((p) => p.isActive);
        if (!activeItem?.canOverwrite) return;

        const result = this._mutations!.overwriteUserPreset(activeItem.presetKey);
        handleMutationResult(result, this._els["toast-host"]);
    }

    private _doRevert() {
        const result = this._mutations?.reapplyActivePreset();
        if (result) handleMutationResult(result, this._els["toast-host"], "Reverted to saved values");
    }

    private _doCopy() {
        const state = this._state;
        if (!state?.activePreset) return;

        const activeItem = state.presets.find((p) => p.isActive);
        if (!activeItem) return;

        void this._mutations!.copyPresetToClipboard(activeItem.presetKey).then((result) => {
            handleMutationResult(result, this._els["toast-host"]);
        });
    }

    private _doPaste() {
        void this._mutations?.pastePresetFromClipboard({ applyAfterImport: true }).then((result) => {
            if (result) handleMutationResult(result, this._els["toast-host"]);
        });
    }

    // ── Flyout ───────────────────────────────────────────

    private _toggleFlyout() {
        if (this._flyoutOpen) {
            this._closeFlyout();
        } else {
            this._openFlyout();
        }
    }

    private _openFlyout() {
        this._flyoutOpen = true;
        this._els["flyout"].classList.add("open");
        this._els["flyout-backdrop"].classList.add("open");
        this.shadowRoot!.querySelector(".name-region")!.classList.add("open");
        this._renderFlyoutList();
        setTimeout(() => (this._els["flyout-search"] as HTMLInputElement).focus(), 30);
    }

    private _closeFlyout() {
        this._flyoutOpen = false;
        this._els["flyout"].classList.remove("open");
        this._els["flyout-backdrop"].classList.remove("open");
        this.shadowRoot!.querySelector(".name-region")!.classList.remove("open");
    }

    // ── Context Menu ─────────────────────────────────────

    private _openCtxMenu(event: MouseEvent, presetKey: string) {
        const item = this._state?.presets.find((p) => p.presetKey === presetKey);
        if (!item || item.source !== "user") return;

        this._ctxTarget = item;
        const menu = this._els["ctx-menu"];
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        menu.classList.add("open");
    }

    private _closeCtxMenu() {
        this._els["ctx-menu"].classList.remove("open");
        this._ctxTarget = null;
    }

    // ── Save Dialog ──────────────────────────────────────

    private _openSaveDialog(mode: SaveDialogMode, presetKey?: string, prefill?: string) {
        this._saveDialogMode = mode;
        this._saveDialogPresetKey = presetKey ?? null;

        const titleEl = this._els["dialog-title"];
        const confirmEl = this._els["dialog-confirm"];
        const inputEl = this._els["dialog-input"] as HTMLInputElement;

        switch (mode) {
            case "new":
                titleEl.textContent = "Save Preset";
                confirmEl.textContent = "Save";
                inputEl.value = prefill ?? (this._state?.dirty ? this._state.activeLabel : "My New Preset");
                break;
            case "rename":
                titleEl.textContent = "Rename Preset";
                confirmEl.textContent = "Rename";
                inputEl.value = prefill ?? "";
                break;
            case "duplicate":
                titleEl.textContent = "Duplicate Preset";
                confirmEl.textContent = "Duplicate";
                inputEl.value = prefill ?? "";
                break;
        }

        this._els["dialog-overlay"].classList.add("open");
        setTimeout(() => { inputEl.focus(); inputEl.select(); }, 30);
    }

    private _closeDialog() {
        this._els["dialog-overlay"].classList.remove("open");
    }

    private _confirmDialog() {
        const name = (this._els["dialog-input"] as HTMLInputElement).value.trim();
        if (!name) return;

        let result: StandaloneEffectPresetMutationResult<unknown> | undefined;

        switch (this._saveDialogMode) {
            case "new":
                result = this._mutations?.saveCurrentAsNewPreset(name);
                break;
            case "rename":
                if (this._saveDialogPresetKey) {
                    result = this._mutations?.renamePreset(this._saveDialogPresetKey, name);
                }
                break;
            case "duplicate":
                if (this._saveDialogPresetKey) {
                    result = this._mutations?.duplicatePresetAsUserPreset(this._saveDialogPresetKey, name);
                }
                break;
        }

        if (result) handleMutationResult(result, this._els["toast-host"]);
        this._closeDialog();
    }

    // ── State → DOM ──────────────────────────────────────

    private _onState(state: StandaloneEffectPresetState) {
        this._state = state;
        this._updateBar(state);
        if (this._flyoutOpen) this._renderFlyoutList();

        // Show error toast if lastError transitions to non-null
        if (state.lastError) {
            showToast(this._els["toast-host"], state.lastError, "error");
            this._mutations?.clearLastError();
        }
    }

    private _updateBar(state: StandaloneEffectPresetState) {
        // Preset name
        this._els["preset-name"].textContent = state.activeLabel || "No Preset";

        // Dirty indicator
        this._els["dirty-dot"].classList.toggle("visible", state.dirty);

        // Source tag
        const activeItem = state.presets.find((p) => p.isActive);
        this._els["source-tag"].textContent = activeItem?.source ?? "";

        // Action buttons
        (this._els["btn-save"] as HTMLButtonElement).disabled = !state.dirty || !activeItem?.canOverwrite;
        (this._els["btn-revert"] as HTMLButtonElement).disabled = !state.dirty;

        // Sync filter pill active state
        for (const pill of this.shadowRoot!.querySelectorAll<HTMLElement>(".filter-pill")) {
            pill.classList.toggle("active", pill.dataset.filter === state.filter.source);
        }
    }

    private _renderFlyoutList() {
        const state = this._state;
        if (!state) return;

        const list = this._els["flyout-list"];
        const visible = state.visiblePresets;

        if (visible.length === 0) {
            list.innerHTML = `<div class="flyout-empty">No presets match.</div>`;
            return;
        }

        const factory = visible.filter((p) => p.source === "factory");
        const user = visible.filter((p) => p.source === "user");
        let html = "";

        if (factory.length) {
            html += `<div class="section-header">Factory</div>`;
            for (const p of factory) {
                html += this._presetItemHTML(p);
            }
        }

        if (user.length) {
            html += `<div class="section-header">User</div>`;
            for (const p of user) {
                html += this._presetItemHTML(p);
            }
        }

        list.innerHTML = html;
    }

    private _presetItemHTML(item: StandaloneEffectPresetListItem): string {
        const isActive = item.isActive;
        const showDirty = isActive && item.dirty;
        const showCtx = item.source === "user";

        return `<div class="preset-item ${isActive ? "active" : ""}"
                     data-preset-key="${escHTML(item.presetKey)}"
                     data-source="${item.source}">
            <span class="item-name">${escHTML(item.label)}</span>
            <span class="item-dirty-star" style="display:${showDirty ? "block" : "none"}">*</span>
            <span class="item-source">${item.source}</span>
            ${showCtx ? `<button class="item-ctx">&#8943;</button>` : ""}
        </div>`;
    }
}

// ── Public API ───────────────────────────────────────────

export function definePresetBarElement(): void {
    if (!window.customElements.get(ELEMENT_NAME)) {
        window.customElements.define(ELEMENT_NAME, PresetBar);
    }
}

export function createPresetBar(): PresetBar {
    definePresetBarElement();
    return document.createElement(ELEMENT_NAME) as PresetBar;
}
