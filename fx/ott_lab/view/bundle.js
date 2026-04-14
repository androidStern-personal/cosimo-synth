function escHTML(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function showToast(host, message, tone) {
  const el = document.createElement("div");
  el.className = `cpb-toast ${tone}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 250ms";
  }, 2200);
  setTimeout(() => el.remove(), 2500);
}
function handleMutationResult(result, toastHost, successMessage) {
  if (result.ok) {
    showToast(toastHost, successMessage ?? result.message, "success");
    return true;
  }
  showToast(toastHost, result.message, "error");
  return false;
}
const PRESET_BAR_CSS = (
  /* css */
  `
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
`
);
const PRESET_BAR_HTML = (
  /* html */
  `
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
`
);
const ELEMENT_NAME = "cosimo-preset-bar";
class PresetBar extends HTMLElement {
  _controller = null;
  _unsubscribe = null;
  _state = null;
  _mutations = null;
  _flyoutOpen = false;
  _ctxTarget = null;
  _saveDialogMode = "new";
  _saveDialogPresetKey = null;
  // Cached DOM refs
  _els;
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${PRESET_BAR_CSS}</style>${PRESET_BAR_HTML}`;
    this._els = this._cacheElements(shadow);
    this._attachEventListeners(shadow);
  }
  get controller() {
    return this._controller;
  }
  set controller(next) {
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
  _cacheElements(root) {
    const els = {};
    for (const el of root.querySelectorAll("[data-el]")) {
      els[el.dataset.el] = el;
    }
    return els;
  }
  // ── Event listeners ──────────────────────────────────
  _attachEventListeners(root) {
    root.addEventListener("click", (e) => {
      const target = e.target;
      const actionEl = target.closest("[data-action]");
      if (actionEl) {
        this._handleAction(actionEl.dataset.action);
        return;
      }
      const filterEl = target.closest("[data-filter]");
      if (filterEl) {
        this._handleFilterPill(filterEl);
        return;
      }
      const ctxEl = target.closest("[data-ctx]");
      if (ctxEl) {
        this._handleCtxAction(ctxEl.dataset.ctx);
        return;
      }
      const itemEl = target.closest("[data-preset-key]");
      if (itemEl && !target.closest(".item-ctx")) {
        this._applyPreset(itemEl.dataset.presetKey);
        return;
      }
      if (target === this._els["flyout-backdrop"]) {
        this._closeFlyout();
        return;
      }
      if (target === this._els["dialog-overlay"]) {
        this._closeDialog();
        return;
      }
      const ctxMenu = this._els["ctx-menu"];
      if (ctxMenu.classList.contains("open") && !ctxMenu.contains(target)) {
        this._closeCtxMenu();
      }
    });
    root.addEventListener("click", (e) => {
      const ctxBtn = e.target.closest(".item-ctx");
      if (!ctxBtn) return;
      e.stopPropagation();
      const itemEl = ctxBtn.closest("[data-preset-key]");
      if (!itemEl) return;
      this._openCtxMenu(e, itemEl.dataset.presetKey);
    });
    root.addEventListener("contextmenu", (e) => {
      const itemEl = e.target.closest("[data-preset-key][data-source='user']");
      if (!itemEl) return;
      e.preventDefault();
      this._openCtxMenu(e, itemEl.dataset.presetKey);
    });
    const searchInput = this._els["flyout-search"];
    searchInput.addEventListener("input", () => {
      this._mutations?.setFilter({ query: searchInput.value });
    });
    const dialogInput = this._els["dialog-input"];
    dialogInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._confirmDialog();
      if (e.key === "Escape") this._closeDialog();
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
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
  _handleAction(action) {
    switch (action) {
      case "prev":
        this._navigate(-1);
        break;
      case "next":
        this._navigate(1);
        break;
      case "toggle-flyout":
        this._toggleFlyout();
        break;
      case "save":
        this._doSave();
        break;
      case "save-as":
      case "footer-save-as":
        this._closeFlyout();
        this._openSaveDialog("new");
        break;
      case "revert":
        this._doRevert();
        break;
      case "copy":
        this._doCopy();
        break;
      case "paste":
      case "footer-paste":
        this._closeFlyout();
        this._doPaste();
        break;
      case "dialog-cancel":
        this._closeDialog();
        break;
      case "dialog-confirm":
        this._confirmDialog();
        break;
    }
  }
  _handleFilterPill(el) {
    const source = el.dataset.filter;
    this._mutations?.setFilter({ source });
    for (const pill of this.shadowRoot.querySelectorAll(".filter-pill")) {
      pill.classList.toggle("active", pill.dataset.filter === source);
    }
  }
  _handleCtxAction(action) {
    const target = this._ctxTarget;
    if (!target) {
      this._closeCtxMenu();
      return;
    }
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
        const result = this._mutations.overwriteUserPreset(target.presetKey);
        handleMutationResult(result, this._els["toast-host"]);
        this._closeCtxMenu();
        break;
      }
      case "copy": {
        void this._mutations.copyPresetToClipboard(target.presetKey).then((result) => {
          handleMutationResult(result, this._els["toast-host"]);
        });
        this._closeCtxMenu();
        break;
      }
      case "delete": {
        const result = this._mutations.deletePreset(target.presetKey);
        handleMutationResult(result, this._els["toast-host"]);
        this._closeCtxMenu();
        break;
      }
    }
  }
  _navigate(direction) {
    const state = this._state;
    if (!state || state.visiblePresets.length === 0) return;
    const currentIndex = state.visiblePresets.findIndex((p) => p.isActive);
    let nextIndex;
    if (currentIndex < 0) {
      nextIndex = direction > 0 ? 0 : state.visiblePresets.length - 1;
    } else {
      nextIndex = (currentIndex + direction + state.visiblePresets.length) % state.visiblePresets.length;
    }
    this._applyPreset(state.visiblePresets[nextIndex].presetKey);
  }
  _applyPreset(presetKey) {
    const result = this._mutations?.applyPreset(presetKey);
    if (result) handleMutationResult(result, this._els["toast-host"]);
    this._closeFlyout();
    this._closeCtxMenu();
  }
  _doSave() {
    const state = this._state;
    if (!state?.activePreset) return;
    const activeItem = state.presets.find((p) => p.isActive);
    if (!activeItem?.canOverwrite) return;
    const result = this._mutations.overwriteUserPreset(activeItem.presetKey);
    handleMutationResult(result, this._els["toast-host"]);
  }
  _doRevert() {
    const result = this._mutations?.reapplyActivePreset();
    if (result) handleMutationResult(result, this._els["toast-host"], "Reverted to saved values");
  }
  _doCopy() {
    const state = this._state;
    if (!state?.activePreset) return;
    const activeItem = state.presets.find((p) => p.isActive);
    if (!activeItem) return;
    void this._mutations.copyPresetToClipboard(activeItem.presetKey).then((result) => {
      handleMutationResult(result, this._els["toast-host"]);
    });
  }
  _doPaste() {
    void this._mutations?.pastePresetFromClipboard({ applyAfterImport: true }).then((result) => {
      if (result) handleMutationResult(result, this._els["toast-host"]);
    });
  }
  // ── Flyout ───────────────────────────────────────────
  _toggleFlyout() {
    if (this._flyoutOpen) {
      this._closeFlyout();
    } else {
      this._openFlyout();
    }
  }
  _openFlyout() {
    this._flyoutOpen = true;
    this._els["flyout"].classList.add("open");
    this._els["flyout-backdrop"].classList.add("open");
    this.shadowRoot.querySelector(".name-region").classList.add("open");
    this._renderFlyoutList();
    setTimeout(() => this._els["flyout-search"].focus(), 30);
  }
  _closeFlyout() {
    this._flyoutOpen = false;
    this._els["flyout"].classList.remove("open");
    this._els["flyout-backdrop"].classList.remove("open");
    this.shadowRoot.querySelector(".name-region").classList.remove("open");
  }
  // ── Context Menu ─────────────────────────────────────
  _openCtxMenu(event, presetKey) {
    const item = this._state?.presets.find((p) => p.presetKey === presetKey);
    if (!item || item.source !== "user") return;
    this._ctxTarget = item;
    const menu = this._els["ctx-menu"];
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.classList.add("open");
  }
  _closeCtxMenu() {
    this._els["ctx-menu"].classList.remove("open");
    this._ctxTarget = null;
  }
  // ── Save Dialog ──────────────────────────────────────
  _openSaveDialog(mode, presetKey, prefill) {
    this._saveDialogMode = mode;
    this._saveDialogPresetKey = presetKey ?? null;
    const titleEl = this._els["dialog-title"];
    const confirmEl = this._els["dialog-confirm"];
    const inputEl = this._els["dialog-input"];
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
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 30);
  }
  _closeDialog() {
    this._els["dialog-overlay"].classList.remove("open");
  }
  _confirmDialog() {
    const name = this._els["dialog-input"].value.trim();
    if (!name) return;
    let result;
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
  _onState(state) {
    this._state = state;
    this._updateBar(state);
    if (this._flyoutOpen) this._renderFlyoutList();
    if (state.lastError) {
      showToast(this._els["toast-host"], state.lastError, "error");
      this._mutations?.clearLastError();
    }
  }
  _updateBar(state) {
    this._els["preset-name"].textContent = state.activeLabel || "No Preset";
    this._els["dirty-dot"].classList.toggle("visible", state.dirty);
    const activeItem = state.presets.find((p) => p.isActive);
    this._els["source-tag"].textContent = activeItem?.source ?? "";
    this._els["btn-save"].disabled = !state.dirty || !activeItem?.canOverwrite;
    this._els["btn-revert"].disabled = !state.dirty;
    for (const pill of this.shadowRoot.querySelectorAll(".filter-pill")) {
      pill.classList.toggle("active", pill.dataset.filter === state.filter.source);
    }
  }
  _renderFlyoutList() {
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
  _presetItemHTML(item) {
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
function definePresetBarElement() {
  if (!window.customElements.get(ELEMENT_NAME)) {
    window.customElements.define(ELEMENT_NAME, PresetBar);
  }
}
function createPresetBar() {
  definePresetBarElement();
  return document.createElement(ELEMENT_NAME);
}

const EFFECT_PRESET_KIND = "cosimo.effectPreset";
const EFFECT_PRESET_SCHEMA_VERSION = 1;
const EFFECT_PRESET_STATE_KIND = "cosimo.effectPresetState";
const EFFECT_PRESET_STATE_SCHEMA_VERSION = 1;
const cmajorEndpointIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireString(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`Effect preset ${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Effect preset ${fieldName} must not be empty.`);
  }
  return trimmed;
}
function descriptorForEffect(effectID, descriptorRegistry) {
  const descriptor = descriptorRegistry[effectID];
  if (!descriptor) {
    throw new Error(`Unknown effectID "${effectID}".`);
  }
  return descriptor;
}
function normalizeEndpointID(endpointID) {
  if (endpointID.includes(".")) {
    throw new Error(`Preset endpoint "${endpointID}" must be a Cmajor identifier, not a dotted path.`);
  }
  if (!cmajorEndpointIdentifierPattern.test(endpointID)) {
    throw new Error(`Preset endpoint "${endpointID}" is not a valid Cmajor identifier.`);
  }
  return endpointID;
}
function normalizeNumberValue(endpointID, value, descriptor) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${endpointID} must be a finite number.`);
  }
  let normalized = value;
  const min = descriptor.min;
  const max = descriptor.max;
  if (typeof min === "number" && normalized < min) {
    if (descriptor.clamp) {
      normalized = min;
    } else {
      throw new Error(`${endpointID} value ${normalized} is below minimum ${min}.`);
    }
  }
  if (typeof max === "number" && normalized > max) {
    if (descriptor.clamp) {
      normalized = max;
    } else {
      throw new Error(`${endpointID} value ${normalized} is above maximum ${max}.`);
    }
  }
  return normalized;
}
function normalizeParamValue(endpointID, value, descriptor) {
  const type = descriptor.type ?? (typeof descriptor.defaultValue === "boolean" ? "boolean" : "number");
  if (type === "boolean") {
    if (typeof value !== "boolean") {
      throw new Error(`${endpointID} must be a boolean.`);
    }
    return value;
  }
  const normalized = normalizeNumberValue(endpointID, value, descriptor);
  if (type === "integer" && !Number.isInteger(normalized)) {
    throw new Error(`${endpointID} must be an integer.`);
  }
  return normalized;
}
function normalizePresetValues(rawValues, descriptor) {
  if (!isPlainObject(rawValues)) {
    throw new Error("Effect preset values must be an object.");
  }
  const providedEndpointIDs = Object.keys(rawValues);
  if (providedEndpointIDs.length === 0) {
    throw new Error("Effect preset values must not be empty.");
  }
  const normalizedValues = {};
  for (const endpointID of providedEndpointIDs) {
    const normalizedEndpointID = normalizeEndpointID(endpointID);
    const paramDescriptor = descriptor.params[normalizedEndpointID];
    if (!paramDescriptor) {
      throw new Error(`Unknown endpoint "${normalizedEndpointID}" for effect "${descriptor.effectID}".`);
    }
  }
  for (const endpointID of Object.keys(descriptor.params)) {
    if (Object.prototype.hasOwnProperty.call(rawValues, endpointID)) {
      normalizedValues[endpointID] = normalizeParamValue(endpointID, rawValues[endpointID], descriptor.params[endpointID]);
    }
  }
  return normalizedValues;
}
function normalizeEffectPreset(payload, descriptorRegistry) {
  if (!isPlainObject(payload)) {
    throw new Error("Effect preset payload must be an object.");
  }
  if (payload.kind !== EFFECT_PRESET_KIND) {
    throw new Error(`Effect preset kind must be "${EFFECT_PRESET_KIND}".`);
  }
  if (payload.version !== EFFECT_PRESET_SCHEMA_VERSION) {
    throw new Error(`Unsupported effect preset version "${String(payload.version)}".`);
  }
  const effectID = requireString(payload.effectID, "effectID");
  const presetID = requireString(payload.presetID, "presetID");
  const label = requireString(payload.label, "label");
  const descriptor = descriptorForEffect(effectID, descriptorRegistry);
  return {
    kind: EFFECT_PRESET_KIND,
    version: EFFECT_PRESET_SCHEMA_VERSION,
    effectID,
    presetID,
    label,
    values: normalizePresetValues(payload.values, descriptor)
  };
}
function captureEffectPreset({
  effectID,
  presetID,
  label,
  currentValues,
  descriptorRegistry
}) {
  const descriptor = descriptorForEffect(effectID, descriptorRegistry);
  const values = {};
  for (const endpointID of Object.keys(descriptor.params)) {
    if (Object.prototype.hasOwnProperty.call(currentValues, endpointID)) {
      values[endpointID] = currentValues[endpointID];
    }
  }
  return normalizeEffectPreset({
    kind: EFFECT_PRESET_KIND,
    version: EFFECT_PRESET_SCHEMA_VERSION,
    effectID,
    presetID,
    label,
    values
  }, descriptorRegistry);
}
function applyEffectPreset({
  patchConnection,
  preset,
  descriptorRegistry
}) {
  const normalizedPreset = normalizeEffectPreset(preset, descriptorRegistry);
  for (const [endpointID, value] of Object.entries(normalizedPreset.values)) {
    patchConnection.sendParameterGestureStart?.(endpointID);
    try {
      patchConnection.sendEventOrValue(endpointID, value);
    } finally {
      patchConnection.sendParameterGestureEnd?.(endpointID);
    }
  }
  return normalizedPreset;
}
function createDefaultEffectPresetState() {
  return {
    kind: EFFECT_PRESET_STATE_KIND,
    version: EFFECT_PRESET_STATE_SCHEMA_VERSION,
    userPresets: {},
    activePresetByEffect: {}
  };
}
function requireBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new Error(`Effect preset ${fieldName} must be a boolean.`);
  }
  return value;
}
function createActivePresetMetadataFromPreset(preset) {
  return {
    presetID: preset.presetID,
    label: preset.label,
    dirty: false
  };
}
function normalizeActivePresetMetadata(effectID, rawMetadata) {
  if (!isPlainObject(rawMetadata)) {
    throw new Error(`Active preset metadata for "${effectID}" must be an object.`);
  }
  const allowedKeys = /* @__PURE__ */ new Set(["presetID", "label", "dirty"]);
  for (const key of Object.keys(rawMetadata)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Active preset metadata for "${effectID}" contains unknown field "${key}".`);
    }
  }
  return {
    presetID: requireString(rawMetadata.presetID, `activePresetByEffect.${effectID}.presetID`),
    label: requireString(rawMetadata.label, `activePresetByEffect.${effectID}.label`),
    dirty: requireBoolean(rawMetadata.dirty, `activePresetByEffect.${effectID}.dirty`)
  };
}
function normalizeEffectPresetState(payload, descriptorRegistry) {
  if (!isPlainObject(payload)) {
    throw new Error("Effect preset state payload must be an object.");
  }
  if (payload.kind !== EFFECT_PRESET_STATE_KIND) {
    throw new Error(`Effect preset state kind must be "${EFFECT_PRESET_STATE_KIND}".`);
  }
  if (payload.version !== EFFECT_PRESET_STATE_SCHEMA_VERSION) {
    throw new Error(`Unsupported effect preset state version "${String(payload.version)}".`);
  }
  const rawUserPresets = payload.userPresets;
  const rawActivePresetByEffect = payload.activePresetByEffect;
  const userPresets = {};
  const activePresetByEffect = {};
  if (!isPlainObject(rawUserPresets)) {
    throw new Error("Effect preset state userPresets must be an object.");
  }
  for (const [effectID, presets] of Object.entries(rawUserPresets)) {
    descriptorForEffect(effectID, descriptorRegistry);
    if (!Array.isArray(presets)) {
      throw new Error(`Effect preset bank "${effectID}" must be an array.`);
    }
    userPresets[effectID] = presets.map((preset) => {
      const normalizedPreset = normalizeEffectPreset(preset, descriptorRegistry);
      if (normalizedPreset.effectID !== effectID) {
        throw new Error(`Effect preset bank "${effectID}" contains preset "${normalizedPreset.presetID}" for effect "${normalizedPreset.effectID}".`);
      }
      return normalizedPreset;
    });
  }
  if (!isPlainObject(rawActivePresetByEffect)) {
    throw new Error("Effect preset state activePresetByEffect must be an object.");
  }
  for (const [effectID, activePreset] of Object.entries(rawActivePresetByEffect)) {
    descriptorForEffect(effectID, descriptorRegistry);
    activePresetByEffect[effectID] = normalizeActivePresetMetadata(effectID, activePreset);
  }
  return {
    kind: EFFECT_PRESET_STATE_KIND,
    version: EFFECT_PRESET_STATE_SCHEMA_VERSION,
    userPresets,
    activePresetByEffect
  };
}
function serializeEffectPresetState(state, descriptorRegistry) {
  return JSON.stringify(normalizeEffectPresetState(state, descriptorRegistry));
}
function deserializeEffectPresetState(rawValue, descriptorRegistry) {
  if (rawValue === void 0 || rawValue === null || rawValue === "") {
    return createDefaultEffectPresetState();
  }
  const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
  return normalizeEffectPresetState(parsed, descriptorRegistry);
}
function assertNoDuplicateJsonKeys(jsonText) {
  const stack = [];
  let index = 0;
  const skipWhitespace = () => {
    while (index < jsonText.length && /\s/.test(jsonText[index])) {
      index += 1;
    }
  };
  const readString = () => {
    const start = index;
    index += 1;
    while (index < jsonText.length) {
      const char = jsonText[index];
      if (char === '"') {
        index += 1;
        return JSON.parse(jsonText.slice(start, index));
      }
      if (char === "\\") {
        index += 1;
        if (index < jsonText.length) {
          index += 1;
        }
        continue;
      }
      index += 1;
    }
    throw new Error("Invalid JSON string.");
  };
  while (index < jsonText.length) {
    skipWhitespace();
    const char = jsonText[index];
    if (char === "{") {
      stack.push({ keys: /* @__PURE__ */ new Set(), expectingKey: true });
      index += 1;
      continue;
    }
    if (char === "}") {
      stack.pop();
      index += 1;
      continue;
    }
    if (char === ",") {
      const current = stack[stack.length - 1];
      if (current) {
        current.expectingKey = true;
      }
      index += 1;
      continue;
    }
    if (char === ":") {
      const current = stack[stack.length - 1];
      if (current) {
        current.expectingKey = false;
      }
      index += 1;
      continue;
    }
    if (char === '"') {
      const value = readString();
      const current = stack[stack.length - 1];
      skipWhitespace();
      if (current?.expectingKey && jsonText[index] === ":") {
        if (current.keys.has(value)) {
          throw new Error(`Duplicate JSON key "${value}".`);
        }
        current.keys.add(value);
      }
      continue;
    }
    index += 1;
  }
}

const EFFECT_PRESET_DESCRIPTORS = {
  chorus: {
    effectID: "chorus",
    label: "Chorus",
    params: {
      chorusEnabled: { type: "integer", min: 0, max: 1, defaultValue: 0 },
      chorusMix: { type: "number", min: 0, max: 1, defaultValue: 0 },
      chorusMotionMode: { type: "integer", min: 0, max: 3, defaultValue: 1 },
      chorusBloomMode: { type: "integer", min: 0, max: 4, defaultValue: 0 },
      chorusTone: { type: "number", min: 0, max: 1, defaultValue: 0.5 },
      chorusFeedback: { type: "number", min: 0, max: 0.95, defaultValue: 0.42 },
      chorusRingAmount: { type: "number", min: 0, max: 1, defaultValue: 0 },
      chorusRingOffsetMode: { type: "integer", min: 0, max: 3, defaultValue: 0 },
      chorusRingFineSemitones: { type: "number", min: -2, max: 2, defaultValue: 0 }
    }
  },
  ott: {
    effectID: "ott",
    label: "OTT",
    params: {
      ottMix: { type: "number", min: 0, max: 100, defaultValue: 100 },
      ottAmount: { type: "number", min: 0, max: 100, defaultValue: 100 },
      ottTimePercent: { type: "number", min: 10, max: 1e3, defaultValue: 100, clamp: true },
      ottBandDrive: { type: "number", min: 0, max: 100, defaultValue: 0 },
      ottEnvelopeMatch: { type: "number", min: 0, max: 100, defaultValue: 0 }
    }
  }
};
const EFFECT_FACTORY_PRESETS = {
  chorus: [
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "chorus",
      presetID: "chorus.clean-wide",
      label: "Clean Wide",
      values: {
        chorusEnabled: 1,
        chorusMix: 0.62,
        chorusMotionMode: 1,
        chorusBloomMode: 0,
        chorusTone: 0.58,
        chorusFeedback: 0.28,
        chorusRingAmount: 0,
        chorusRingOffsetMode: 0,
        chorusRingFineSemitones: 0
      }
    },
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "chorus",
      presetID: "chorus.bloom-ring",
      label: "Bloom Ring",
      values: {
        chorusEnabled: 1,
        chorusMix: 0.76,
        chorusMotionMode: 0,
        chorusBloomMode: 2,
        chorusTone: 0.72,
        chorusFeedback: 0.42,
        chorusRingAmount: 0.26,
        chorusRingOffsetMode: 0,
        chorusRingFineSemitones: 0.07
      }
    }
  ],
  ott: [
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "ott",
      presetID: "ott.default-smash",
      label: "Default Smash",
      values: {
        ottMix: 100,
        ottAmount: 100,
        ottTimePercent: 100,
        ottBandDrive: 0,
        ottEnvelopeMatch: 0
      }
    },
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "ott",
      presetID: "ott.envelope-tamed",
      label: "Envelope Tamed",
      values: {
        ottMix: 86,
        ottAmount: 92,
        ottTimePercent: 100,
        ottBandDrive: 12,
        ottEnvelopeMatch: 38
      }
    }
  ]
};

const EFFECT_PRESETS_STATE_KEY = "effects.presets.v1";
function cloneState(state) {
  return {
    kind: state.kind,
    version: state.version,
    userPresets: Object.fromEntries(Object.entries(state.userPresets).map(([effectID, presets]) => [
      effectID,
      presets.map((preset) => ({
        ...preset,
        values: { ...preset.values }
      }))
    ])),
    activePresetByEffect: Object.fromEntries(Object.entries(state.activePresetByEffect).map(([effectID, activePreset]) => [
      effectID,
      { ...activePreset }
    ]))
  };
}
function storedStateEchoToken(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}
function replacePresetInBank(bank, preset) {
  const nextBank = bank.filter((candidate) => candidate.presetID !== preset.presetID);
  nextBank.push(preset);
  return nextBank;
}
class EffectPresetRuntimeBridge {
  constructor(patchConnection, descriptorRegistry = EFFECT_PRESET_DESCRIPTORS) {
    this.patchConnection = patchConnection;
    this.descriptorRegistry = descriptorRegistry;
    this.state = createDefaultEffectPresetState();
    this.handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  }
  state;
  attached = false;
  listeners = /* @__PURE__ */ new Set();
  pendingStoredStateEchoes = /* @__PURE__ */ new Map();
  handleStoredStateValueBound;
  attach() {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.patchConnection.addStoredStateValueListener?.(this.handleStoredStateValueBound);
  }
  detach() {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    this.patchConnection.removeStoredStateValueListener?.(this.handleStoredStateValueBound);
  }
  requestBootState() {
    if (typeof this.patchConnection.requestFullStoredState === "function") {
      this.patchConnection.requestFullStoredState((storedState) => {
        const value = storedState?.[EFFECT_PRESETS_STATE_KEY];
        if (value === void 0 && typeof this.patchConnection.requestStoredStateValue === "function") {
          this.patchConnection.requestStoredStateValue(EFFECT_PRESETS_STATE_KEY);
          return;
        }
        this.applyStoredState(value);
      });
      return;
    }
    this.patchConnection.requestStoredStateValue?.(EFFECT_PRESETS_STATE_KEY);
  }
  getState() {
    return cloneState(this.state);
  }
  subscribe(listener) {
    this.listeners.add(listener);
  }
  unsubscribe(listener) {
    this.listeners.delete(listener);
  }
  saveUserPreset(preset, options = {}) {
    const normalizedPreset = normalizeEffectPreset(preset, this.descriptorRegistry);
    const currentBank = this.state.userPresets[normalizedPreset.effectID] ?? [];
    const nextActivePresetByEffect = options.activate ? {
      ...this.state.activePresetByEffect,
      [normalizedPreset.effectID]: createActivePresetMetadataFromPreset(normalizedPreset)
    } : this.state.activePresetByEffect;
    this.commitState({
      ...this.state,
      userPresets: {
        ...this.state.userPresets,
        [normalizedPreset.effectID]: replacePresetInBank(currentBank, normalizedPreset)
      },
      activePresetByEffect: nextActivePresetByEffect
    });
    return normalizedPreset;
  }
  setUserPresetsForEffect(effectID, presets, activePresetMetadata) {
    const activePresetByEffect = { ...this.state.activePresetByEffect };
    if (activePresetMetadata === null) {
      delete activePresetByEffect[effectID];
    } else if (activePresetMetadata !== void 0) {
      activePresetByEffect[effectID] = activePresetMetadata;
    }
    const nextState = this.commitState({
      ...this.state,
      userPresets: {
        ...this.state.userPresets,
        [effectID]: presets
      },
      activePresetByEffect
    });
    return nextState.userPresets[effectID] ?? [];
  }
  applyPreset(preset) {
    if (typeof this.patchConnection.sendEventOrValue !== "function") {
      throw new Error("Cannot apply effect preset because the patch connection cannot write parameter values.");
    }
    const normalizedPreset = normalizeEffectPreset(preset, this.descriptorRegistry);
    this.commitState({
      ...this.state,
      activePresetByEffect: {
        ...this.state.activePresetByEffect,
        [normalizedPreset.effectID]: createActivePresetMetadataFromPreset(normalizedPreset)
      }
    });
    applyEffectPreset({
      patchConnection: {
        sendParameterGestureStart: this.patchConnection.sendParameterGestureStart?.bind(this.patchConnection),
        sendEventOrValue: this.patchConnection.sendEventOrValue.bind(this.patchConnection),
        sendParameterGestureEnd: this.patchConnection.sendParameterGestureEnd?.bind(this.patchConnection)
      },
      preset: normalizedPreset,
      descriptorRegistry: this.descriptorRegistry
    });
    return normalizedPreset;
  }
  setActivePresetMetadata(effectID, metadata) {
    this.commitState({
      ...this.state,
      activePresetByEffect: {
        ...this.state.activePresetByEffect,
        [effectID]: metadata
      }
    });
  }
  importPresetText(text) {
    if (typeof text !== "string") {
      throw new Error("Preset import text must be a string.");
    }
    assertNoDuplicateJsonKeys(text);
    const parsed = JSON.parse(text);
    const preset = normalizeEffectPreset(parsed, this.descriptorRegistry);
    this.saveUserPreset(preset);
    return preset;
  }
  applyStoredState(rawValue) {
    try {
      this.setState(deserializeEffectPresetState(rawValue, this.descriptorRegistry));
    } catch {
      this.setState(createDefaultEffectPresetState());
    }
  }
  handleStoredStateValue(message) {
    const nextMessage = message;
    if (nextMessage?.key !== EFFECT_PRESETS_STATE_KEY) {
      return;
    }
    if (this.consumePendingStoredStateEcho(nextMessage.value)) {
      return;
    }
    this.applyStoredState(nextMessage.value);
  }
  setState(nextState) {
    this.state = cloneState(nextState);
    this.notify();
  }
  notify() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
  commitState(nextState) {
    const normalizedState = normalizeEffectPresetState(nextState, this.descriptorRegistry);
    const serializedState = serializeEffectPresetState(normalizedState, this.descriptorRegistry);
    const sendStoredStateValue = this.patchConnection.sendStoredStateValue?.bind(this.patchConnection);
    if (sendStoredStateValue) {
      this.rememberPendingStoredStateEcho(serializedState);
      try {
        sendStoredStateValue(EFFECT_PRESETS_STATE_KEY, serializedState);
      } catch (error) {
        this.consumePendingStoredStateEcho(serializedState);
        throw error;
      }
    }
    this.setState(normalizedState);
    return this.getState();
  }
  rememberPendingStoredStateEcho(value) {
    const token = storedStateEchoToken(value);
    this.pendingStoredStateEchoes.set(token, (this.pendingStoredStateEchoes.get(token) ?? 0) + 1);
  }
  consumePendingStoredStateEcho(value) {
    const token = storedStateEchoToken(value);
    const count = this.pendingStoredStateEchoes.get(token);
    if (!count) {
      return false;
    }
    if (count <= 1) {
      this.pendingStoredStateEchoes.delete(token);
    } else {
      this.pendingStoredStateEchoes.set(token, count - 1);
    }
    return true;
  }
}

const defaultFilter = {
  query: "",
  source: "all"
};
function clonePreset(preset) {
  return {
    ...preset,
    values: { ...preset.values }
  };
}
function clonePresets(presets) {
  return presets.map(clonePreset);
}
function errorFromUnknown(error) {
  return error instanceof Error ? error : new Error(String(error));
}
function defaultCreatePresetID({
  effectID,
  attempt
}) {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const attemptSuffix = attempt === 0 ? "" : `-${attempt + 1}`;
  return `user.${effectID}.${timestamp}-${randomSuffix}${attemptSuffix}`;
}
function valuesEqual(left, right) {
  return Object.is(left, right);
}
function presetKeyFor(source, presetID) {
  return `${source}:${presetID}`;
}
function normalizeLabel(label) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Preset label must not be empty.");
  }
  return trimmed;
}
function ensureStoredStateWriter(patchConnection, operation) {
  if (typeof patchConnection.sendStoredStateValue !== "function") {
    throw new Error(`Cannot ${operation} because Cmajor stored state writes are unavailable.`);
  }
}
function ensureParameterWriter(patchConnection, operation) {
  if (typeof patchConnection.sendEventOrValue !== "function") {
    throw new Error(`Cannot ${operation} because the patch connection cannot write parameter values.`);
  }
}
class StandaloneEffectPresetController {
  constructor(options) {
    this.options = options;
    this.descriptorRegistry = options.descriptorRegistry ?? EFFECT_PRESET_DESCRIPTORS;
    this.factoryPresetRegistry = options.factoryPresets ?? EFFECT_FACTORY_PRESETS;
    this.createPresetID = options.createPresetID ?? defaultCreatePresetID;
    this.readClipboardText = options.readClipboardText;
    this.writeClipboardText = options.writeClipboardText;
    this.bridge = new EffectPresetRuntimeBridge(options.patchConnection, this.descriptorRegistry);
    this.bridgeState = this.bridge.getState();
    this.handleBridgeStateBound = this.handleBridgeState.bind(this);
    this.getDescriptor();
  }
  bridge;
  descriptorRegistry;
  factoryPresetRegistry;
  createPresetID;
  readClipboardText;
  writeClipboardText;
  listeners = /* @__PURE__ */ new Set();
  currentValues = /* @__PURE__ */ new Map();
  hydratingEndpointIDs = /* @__PURE__ */ new Set();
  suppressedParameterValues = /* @__PURE__ */ new Map();
  parameterListenerCleanups = [];
  handleBridgeStateBound;
  bridgeState;
  filter = { ...defaultFilter };
  attached = false;
  ready = false;
  lastError = null;
  attach() {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.bridge.subscribe(this.handleBridgeStateBound);
    this.bridge.attach();
    this.bridge.requestBootState();
    this.attachParameterListeners();
    this.ready = true;
    this.notify();
  }
  detach() {
    if (!this.attached) {
      return;
    }
    for (const cleanup of this.parameterListenerCleanups) {
      cleanup();
    }
    this.parameterListenerCleanups.length = 0;
    this.hydratingEndpointIDs.clear();
    this.suppressedParameterValues.clear();
    this.bridge.unsubscribe(this.handleBridgeStateBound);
    this.bridge.detach();
    this.attached = false;
    this.ready = false;
    this.notify();
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  getState() {
    const factoryPresets = this.buildPresetItems("factory", this.getFactoryPresets());
    const userPresets = this.buildPresetItems("user", this.getUserPresets());
    const presets = [...factoryPresets, ...userPresets];
    const visiblePresets = presets.filter((preset) => this.presetMatchesFilter(preset));
    const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID] ?? null;
    return {
      effectID: this.options.effectID,
      ready: this.ready,
      filter: { ...this.filter },
      presets,
      visiblePresets,
      factoryPresets,
      userPresets,
      activePreset: activePreset ? { ...activePreset } : null,
      activePresetID: activePreset?.presetID ?? null,
      activeLabel: activePreset?.label ?? "",
      dirty: activePreset?.dirty ?? false,
      currentValues: this.getCurrentValuesRecord(),
      missingCurrentValueEndpointIDs: this.getMissingCurrentValueEndpointIDs(),
      lastError: this.lastError
    };
  }
  getMutations() {
    return {
      setFilter: this.setFilter.bind(this),
      clearLastError: this.clearLastError.bind(this),
      refreshCurrentValues: this.refreshCurrentValues.bind(this),
      applyPreset: this.applyPreset.bind(this),
      reapplyActivePreset: this.reapplyActivePreset.bind(this),
      saveCurrentAsNewPreset: this.saveCurrentAsNewPreset.bind(this),
      overwriteUserPreset: this.overwriteUserPreset.bind(this),
      renamePreset: this.renamePreset.bind(this),
      deletePreset: this.deletePreset.bind(this),
      duplicatePresetAsUserPreset: this.duplicatePresetAsUserPreset.bind(this),
      exportPresetText: this.exportPresetText.bind(this),
      importPresetText: this.importPresetText.bind(this),
      copyPresetToClipboard: this.copyPresetToClipboard.bind(this),
      pastePresetFromClipboard: this.pastePresetFromClipboard.bind(this)
    };
  }
  setFilter(filter) {
    this.filter = {
      query: filter.query ?? this.filter.query,
      source: filter.source ?? this.filter.source
    };
    this.notify();
  }
  clearLastError() {
    this.lastError = null;
    this.notify();
  }
  refreshCurrentValues() {
    return this.runMutation(() => {
      this.requestCurrentParameterValues();
      return this.getMissingCurrentValueEndpointIDs();
    }, "Current parameter values refreshed.");
  }
  applyPreset(presetKey) {
    return this.runMutation(() => {
      ensureStoredStateWriter(this.options.patchConnection, "apply effect presets");
      ensureParameterWriter(this.options.patchConnection, "apply effect presets");
      const { preset } = this.resolvePreset(presetKey);
      this.bridge.setActivePresetMetadata(this.options.effectID, createActivePresetMetadataFromPreset(preset));
      this.applyPresetValuesToPatch(preset);
      return clonePreset(preset);
    }, "Preset applied.");
  }
  reapplyActivePreset() {
    return this.runMutation(() => {
      const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];
      if (!activePreset) {
        throw new Error("No active preset is available to reapply.");
      }
      ensureStoredStateWriter(this.options.patchConnection, "reapply effect presets");
      ensureParameterWriter(this.options.patchConnection, "reapply effect presets");
      const preset = this.findPresetByID(activePreset.presetID);
      if (!preset) {
        throw new Error(`Active preset "${activePreset.presetID}" is not available.`);
      }
      this.bridge.setActivePresetMetadata(this.options.effectID, createActivePresetMetadataFromPreset(preset));
      this.applyPresetValuesToPatch(preset);
      return clonePreset(preset);
    }, "Preset reapplied.");
  }
  saveCurrentAsNewPreset(label) {
    return this.runMutation(() => {
      ensureStoredStateWriter(this.options.patchConnection, "save effect presets");
      const normalizedLabel = normalizeLabel(label);
      const presetID = this.createUniqueUserPresetID(normalizedLabel);
      const preset = this.captureCurrentPreset(presetID, normalizedLabel);
      this.bridge.saveUserPreset(preset, { activate: true });
      return clonePreset(preset);
    }, "Preset saved.");
  }
  overwriteUserPreset(presetKey) {
    return this.runMutation(() => {
      ensureStoredStateWriter(this.options.patchConnection, "overwrite effect presets");
      const { source, preset } = this.resolvePreset(presetKey);
      if (source !== "user") {
        throw new Error("Factory presets cannot be overwritten.");
      }
      const nextPreset = this.captureCurrentPreset(preset.presetID, preset.label);
      this.bridge.saveUserPreset(nextPreset, { activate: true });
      return clonePreset(nextPreset);
    }, "Preset overwritten.");
  }
  renamePreset(presetKey, label) {
    return this.runMutation(() => {
      ensureStoredStateWriter(this.options.patchConnection, "rename effect presets");
      const { source, preset } = this.resolvePreset(presetKey);
      if (source !== "user") {
        throw new Error("Factory presets cannot be renamed.");
      }
      const nextPreset = normalizeEffectPreset({
        ...preset,
        label: normalizeLabel(label)
      }, this.descriptorRegistry);
      const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];
      const nextActivePreset = activePreset?.presetID === preset.presetID ? { ...activePreset, label: nextPreset.label } : void 0;
      this.bridge.setUserPresetsForEffect(
        this.options.effectID,
        this.getUserPresets().map((candidate) => candidate.presetID === preset.presetID ? nextPreset : candidate),
        nextActivePreset
      );
      return clonePreset(nextPreset);
    }, "Preset renamed.");
  }
  deletePreset(presetKey) {
    return this.runMutation(() => {
      ensureStoredStateWriter(this.options.patchConnection, "delete effect presets");
      const { source, preset } = this.resolvePreset(presetKey);
      if (source !== "user") {
        throw new Error("Factory presets cannot be deleted.");
      }
      const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];
      const nextActivePreset = activePreset?.presetID === preset.presetID ? null : void 0;
      this.bridge.setUserPresetsForEffect(
        this.options.effectID,
        this.getUserPresets().filter((candidate) => candidate.presetID !== preset.presetID),
        nextActivePreset
      );
      return clonePreset(preset);
    }, "Preset deleted.");
  }
  duplicatePresetAsUserPreset(presetKey, label) {
    return this.runMutation(() => {
      ensureStoredStateWriter(this.options.patchConnection, "duplicate effect presets");
      const { preset } = this.resolvePreset(presetKey);
      const normalizedLabel = normalizeLabel(label);
      const nextPreset = normalizeEffectPreset({
        ...preset,
        presetID: this.createUniqueUserPresetID(normalizedLabel),
        label: normalizedLabel
      }, this.descriptorRegistry);
      this.bridge.saveUserPreset(nextPreset);
      return clonePreset(nextPreset);
    }, "Preset duplicated.");
  }
  exportPresetText(presetKey) {
    return this.runMutation(() => {
      const { preset } = this.resolvePreset(presetKey);
      return JSON.stringify(preset, null, 2);
    }, "Preset exported.");
  }
  importPresetText(text, options = {}) {
    return this.runMutation(() => {
      ensureStoredStateWriter(this.options.patchConnection, "import effect presets");
      const preset = this.parseImportText(text);
      this.assertUserPresetIDCanBeStored(preset.presetID, options.overwriteExisting === true);
      if (options.applyAfterImport) {
        ensureParameterWriter(this.options.patchConnection, "import and apply effect presets");
        this.bridge.saveUserPreset(preset, { activate: true });
        this.applyPresetValuesToPatch(preset);
      } else {
        this.bridge.saveUserPreset(preset);
      }
      return clonePreset(preset);
    }, "Preset imported.");
  }
  async copyPresetToClipboard(presetKey) {
    const exported = this.exportPresetText(presetKey);
    if (!exported.ok) {
      return exported;
    }
    try {
      const writeClipboardText = this.writeClipboardText ?? globalThis.navigator?.clipboard?.writeText?.bind(globalThis.navigator.clipboard);
      if (!writeClipboardText) {
        throw new Error("Clipboard write API is unavailable.");
      }
      await writeClipboardText(exported.value);
      this.lastError = null;
      this.notify();
      return {
        ok: true,
        value: exported.value,
        message: "Preset copied."
      };
    } catch (error) {
      return this.fail(errorFromUnknown(error));
    }
  }
  async pastePresetFromClipboard(options = {}) {
    try {
      const readClipboardText = this.readClipboardText ?? globalThis.navigator?.clipboard?.readText?.bind(globalThis.navigator.clipboard);
      if (!readClipboardText) {
        throw new Error("Clipboard read API is unavailable.");
      }
      const text = await readClipboardText();
      return this.importPresetText(text, options);
    } catch (error) {
      return this.fail(errorFromUnknown(error));
    }
  }
  handleBridgeState(state) {
    this.bridgeState = state;
    this.notify();
  }
  attachParameterListeners() {
    const endpointIDs = Object.keys(this.getDescriptor().params);
    for (const endpointID of endpointIDs) {
      this.hydratingEndpointIDs.add(endpointID);
      const listener = (value) => this.handleParameterValue(endpointID, value);
      this.options.patchConnection.addParameterListener?.(endpointID, listener);
      this.parameterListenerCleanups.push(() => {
        this.options.patchConnection.removeParameterListener?.(endpointID, listener);
      });
    }
    this.requestCurrentParameterValues();
  }
  requestCurrentParameterValues() {
    for (const endpointID of Object.keys(this.getDescriptor().params)) {
      this.options.patchConnection.requestParameterValue?.(endpointID);
    }
  }
  handleParameterValue(endpointID, value) {
    let normalizedValue;
    try {
      normalizedValue = this.normalizeEndpointValue(endpointID, value);
    } catch {
      return;
    }
    this.currentValues.set(endpointID, normalizedValue);
    if (this.hydratingEndpointIDs.delete(endpointID)) {
      this.notify();
      return;
    }
    if (this.consumeSuppressedParameterValue(endpointID, normalizedValue)) {
      this.notify();
      return;
    }
    this.markActivePresetDirtyIfNeeded(endpointID, normalizedValue);
    this.notify();
  }
  normalizeEndpointValue(endpointID, value) {
    const normalizedPreset = normalizeEffectPreset({
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: this.options.effectID,
      presetID: "current.endpoint",
      label: "Current Endpoint",
      values: {
        [endpointID]: value
      }
    }, this.descriptorRegistry);
    const normalizedValue = normalizedPreset.values[endpointID];
    if (normalizedValue === void 0) {
      throw new Error(`No normalized value was produced for "${endpointID}".`);
    }
    return normalizedValue;
  }
  markActivePresetDirtyIfNeeded(endpointID, value) {
    const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];
    if (!activePreset || activePreset.dirty) {
      return;
    }
    const activePresetPayload = this.findPresetByID(activePreset.presetID);
    if (activePresetPayload && valuesEqual(activePresetPayload.values[endpointID], value)) {
      return;
    }
    this.bridge.setActivePresetMetadata(this.options.effectID, {
      ...activePreset,
      dirty: true
    });
  }
  getDescriptor() {
    const descriptor = this.descriptorRegistry[this.options.effectID];
    if (!descriptor) {
      throw new Error(`Unknown effectID "${this.options.effectID}".`);
    }
    return descriptor;
  }
  getFactoryPresets() {
    return clonePresets(this.factoryPresetRegistry[this.options.effectID] ?? []).map((preset) => normalizeEffectPreset(preset, this.descriptorRegistry));
  }
  getUserPresets() {
    return clonePresets(this.bridgeState.userPresets[this.options.effectID] ?? []);
  }
  buildPresetItems(source, presets) {
    const activePreset = this.bridgeState.activePresetByEffect[this.options.effectID];
    return presets.map((preset) => {
      const isActive = activePreset?.presetID === preset.presetID;
      const isUser = source === "user";
      return {
        presetKey: presetKeyFor(source, preset.presetID),
        presetID: preset.presetID,
        label: preset.label,
        effectID: preset.effectID,
        source,
        preset: clonePreset(preset),
        isActive,
        dirty: Boolean(isActive && activePreset?.dirty),
        canApply: true,
        canRename: isUser,
        canOverwrite: isUser,
        canDelete: isUser,
        canExport: true
      };
    });
  }
  presetMatchesFilter(preset) {
    if (this.filter.source !== "all" && preset.source !== this.filter.source) {
      return false;
    }
    const query = this.filter.query.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return preset.label.toLowerCase().includes(query) || preset.presetID.toLowerCase().includes(query);
  }
  getCurrentValuesRecord() {
    const values = {};
    for (const endpointID of Object.keys(this.getDescriptor().params)) {
      if (this.currentValues.has(endpointID)) {
        values[endpointID] = this.currentValues.get(endpointID);
      }
    }
    return values;
  }
  getMissingCurrentValueEndpointIDs() {
    return Object.keys(this.getDescriptor().params).filter((endpointID) => !this.currentValues.has(endpointID));
  }
  createUniqueUserPresetID(label) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const presetID = this.createPresetID({
        effectID: this.options.effectID,
        label,
        attempt
      }).trim();
      if (!presetID) {
        continue;
      }
      if (!this.findPresetByID(presetID)) {
        return presetID;
      }
    }
    throw new Error("Could not create a unique preset ID.");
  }
  captureCurrentPreset(presetID, label) {
    const missingEndpointIDs = this.getMissingCurrentValueEndpointIDs();
    if (missingEndpointIDs.length > 0) {
      throw new Error(`Cannot save preset because current values are missing for ${missingEndpointIDs.join(", ")}.`);
    }
    return captureEffectPreset({
      effectID: this.options.effectID,
      presetID,
      label,
      currentValues: this.getCurrentValuesRecord(),
      descriptorRegistry: this.descriptorRegistry
    });
  }
  resolvePreset(presetKeyOrID) {
    if (presetKeyOrID.startsWith("factory:")) {
      const presetID = presetKeyOrID.slice("factory:".length);
      const preset = this.getFactoryPresets().find((candidate) => candidate.presetID === presetID);
      if (!preset) {
        throw new Error(`Factory preset "${presetID}" was not found.`);
      }
      return { source: "factory", preset };
    }
    if (presetKeyOrID.startsWith("user:")) {
      const presetID = presetKeyOrID.slice("user:".length);
      const preset = this.getUserPresets().find((candidate) => candidate.presetID === presetID);
      if (!preset) {
        throw new Error(`User preset "${presetID}" was not found.`);
      }
      return { source: "user", preset };
    }
    const matches = [
      ...this.getFactoryPresets().map((preset) => ({ source: "factory", preset })),
      ...this.getUserPresets().map((preset) => ({ source: "user", preset }))
    ].filter(({ preset }) => preset.presetID === presetKeyOrID);
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      throw new Error(`Preset ID "${presetKeyOrID}" is ambiguous; use a presetKey.`);
    }
    throw new Error(`Preset "${presetKeyOrID}" was not found.`);
  }
  findPresetByID(presetID) {
    return this.getUserPresets().find((preset) => preset.presetID === presetID) ?? this.getFactoryPresets().find((preset) => preset.presetID === presetID) ?? null;
  }
  parseImportText(text) {
    if (typeof text !== "string") {
      throw new Error("Preset import text must be a string.");
    }
    assertNoDuplicateJsonKeys(text);
    const parsed = JSON.parse(text);
    const preset = normalizeEffectPreset(parsed, this.descriptorRegistry);
    if (preset.effectID !== this.options.effectID) {
      throw new Error(`Cannot import ${preset.effectID} preset into ${this.options.effectID}.`);
    }
    return preset;
  }
  assertUserPresetIDCanBeStored(presetID, overwriteExisting) {
    if (this.getFactoryPresets().some((preset) => preset.presetID === presetID)) {
      throw new Error(`Preset ID "${presetID}" conflicts with a factory preset.`);
    }
    if (!overwriteExisting && this.getUserPresets().some((preset) => preset.presetID === presetID)) {
      throw new Error(`User preset "${presetID}" already exists.`);
    }
  }
  applyPresetValuesToPatch(preset) {
    const sendEventOrValue = this.options.patchConnection.sendEventOrValue;
    if (typeof sendEventOrValue !== "function") {
      throw new Error("Cannot apply effect presets because the patch connection cannot write parameter values.");
    }
    this.queueSuppressedPresetValues(preset);
    try {
      applyEffectPreset({
        patchConnection: {
          sendParameterGestureStart: this.options.patchConnection.sendParameterGestureStart?.bind(this.options.patchConnection),
          sendEventOrValue: sendEventOrValue.bind(this.options.patchConnection),
          sendParameterGestureEnd: this.options.patchConnection.sendParameterGestureEnd?.bind(this.options.patchConnection)
        },
        preset,
        descriptorRegistry: this.descriptorRegistry
      });
    } catch (error) {
      this.suppressedParameterValues.clear();
      throw error;
    }
  }
  queueSuppressedPresetValues(preset) {
    for (const [endpointID, value] of Object.entries(preset.values)) {
      const queue = this.suppressedParameterValues.get(endpointID) ?? [];
      queue.push(value);
      this.suppressedParameterValues.set(endpointID, queue);
    }
  }
  consumeSuppressedParameterValue(endpointID, value) {
    const queue = this.suppressedParameterValues.get(endpointID);
    if (!queue || queue.length === 0) {
      return false;
    }
    const matchIndex = queue.findIndex((candidate) => valuesEqual(candidate, value));
    if (matchIndex === -1) {
      this.suppressedParameterValues.delete(endpointID);
      return false;
    }
    queue.splice(matchIndex, 1);
    if (queue.length === 0) {
      this.suppressedParameterValues.delete(endpointID);
    }
    return true;
  }
  runMutation(mutation, message) {
    try {
      const value = mutation();
      this.lastError = null;
      this.notify();
      return {
        ok: true,
        value,
        message
      };
    } catch (error) {
      return this.fail(errorFromUnknown(error));
    }
  }
  fail(error) {
    this.lastError = error.message;
    this.notify();
    return {
      ok: false,
      error,
      message: error.message
    };
  }
  notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
function createStandaloneEffectPresetController(options) {
  return new StandaloneEffectPresetController(options);
}

const SNAPSHOT_SLOT_IDS = ["A", "B", "C", "D", "E", "F", "G"];
const SNAPSHOT_STORAGE_KEY = "cosimo.ottLab.snapshotSlots.v1";
const SNAPSHOT_EXPORT_KIND = "cosimo.ottLab.snapshot";
const SNAPSHOT_PATCH_ID = "dev.cosimo.ott-lab";
const SNAPSHOT_SCHEMA = 1;

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
    this.activeSnapshotSlot = undefined;
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
    this.cancelSnapshotParameterListeners();
    this.clearSnapshotMessageTimer();

    if (this.statusListener)
      this.patchConnection.removeStatusListener(this.statusListener);
  }

  renderFromStatus(status) {
    for (const cleanupTarget of this.groupsHost.querySelectorAll("[data-cleanup-control]"))
      cleanupTarget.__cleanup?.();

    const parameters = (status?.details?.inputs || [])
      .filter(endpoint => endpoint?.purpose === "parameter" && !endpoint?.annotation?.hidden);

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

    this.activeSnapshotSlot = slotID;
    this.persistSnapshotStore();
    this.renderSnapshotSlots();
    this.focusSnapshotSlot(slotID);
    this.setSnapshotMessage(`Active ${slotID}.`, "success");
    return true;
  }

  ensureSnapshotSlot(slotID) {
    if (this.snapshotStore.slots[slotID])
      return true;

    const values = this.captureCurrentSnapshotValues();

    if (Object.keys(values).length === 0) {
      this.setSnapshotMessage("No visible parameters to capture.", "error");
      return false;
    }

    this.snapshotStore.slots[slotID] = {
      label: "",
      updatedAt: new Date().toISOString(),
      values,
    };
    return true;
  }

  updateActiveSnapshotParameter(endpointID, value) {
    if (!this.activeSnapshotSlot)
      return;

    if (!this.ensureSnapshotSlot(this.activeSnapshotSlot))
      return;

    const slot = this.snapshotStore.slots[this.activeSnapshotSlot];
    slot.values[endpointID] = value;
    slot.updatedAt = new Date().toISOString();
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

    const validation = validateSnapshotValues(slot.values, this.parameterInfoByID);

    if (!validation.ok) {
      this.setSnapshotMessage(validation.message, "error");
      return false;
    }

    this.applySnapshotValues(validation.values);
    this.activeSnapshotSlot = slotID;
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

    const validation = validateSnapshotPayload(parsed.payload, this.parameterInfoByID);

    if (!validation.ok) {
      this.setSnapshotMessage(validation.message, "error");
      return false;
    }

    this.snapshotStore.slots[slotID] = {
      label: validation.label,
      updatedAt: new Date().toISOString(),
      values: validation.values,
    };
    this.persistSnapshotStore();
    this.applySnapshotValues(validation.values);
    this.activeSnapshotSlot = slotID;
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

  captureCurrentSnapshotValues() {
    const values = {};

    for (const [endpointID, parameter] of this.parameterInfoByID) {
      if (parameter?.annotation?.hidden)
        continue;

      if (this.parameterValues.has(endpointID)) {
        const normalisedValue = normaliseParameterValue(parameter, this.parameterValues.get(endpointID));

        if (normalisedValue !== undefined)
          values[endpointID] = normalisedValue;

        continue;
      }

      const initValue = parameter?.annotation?.init;

      if (initValue !== undefined) {
        const normalisedValue = normaliseParameterValue(parameter, initValue);

        if (normalisedValue !== undefined)
          values[endpointID] = normalisedValue;
      }
    }

    return values;
  }

  applySnapshotValues(values) {
    for (const [endpointID, value] of Object.entries(values)) {
      this.parameterValues.set(endpointID, value);
      this.patchConnection.sendEventOrValue(endpointID, value, 0);
    }
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

function createEmptySnapshotStore() {
  return {
    schema: SNAPSHOT_SCHEMA,
    patchID: SNAPSHOT_PATCH_ID,
    slots: Object.fromEntries(SNAPSHOT_SLOT_IDS.map(slotID => [slotID, null])),
  };
}

function loadSnapshotStore() {
  try {
    const rawStore = window.localStorage?.getItem(SNAPSHOT_STORAGE_KEY);

    if (!rawStore)
      return createEmptySnapshotStore();

    const parsedStore = JSON.parse(rawStore);

    if (parsedStore?.schema !== SNAPSHOT_SCHEMA || parsedStore?.patchID !== SNAPSHOT_PATCH_ID)
      return createEmptySnapshotStore();

    const store = createEmptySnapshotStore();

    for (const slotID of SNAPSHOT_SLOT_IDS) {
      const slot = parsedStore.slots?.[slotID];

      if (!slot || typeof slot !== "object" || typeof slot.values !== "object" || Array.isArray(slot.values))
        continue;

      store.slots[slotID] = {
        label: typeof slot.label === "string" ? slot.label : "",
        updatedAt: typeof slot.updatedAt === "string" ? slot.updatedAt : undefined,
        values: { ...slot.values },
      };
    }

    return store;
  } catch {
    return createEmptySnapshotStore();
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
    kind: SNAPSHOT_EXPORT_KIND,
    schema: SNAPSHOT_SCHEMA,
    patchID: SNAPSHOT_PATCH_ID,
    slot: slotID,
    label: slot.label ?? "",
    values: { ...slot.values },
  };
}

function parseSnapshotText(snapshotText) {
  if (typeof snapshotText !== "string" || snapshotText.trim().length === 0)
    return { ok: false, message: "Paste JSON is empty." };

  try {
    return { ok: true, payload: JSON.parse(snapshotText) };
  } catch (error) {
    return { ok: false, message: `Invalid JSON: ${messageFromError(error)}` };
  }
}

function validateSnapshotPayload(payload, parameterInfoByID) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { ok: false, message: "Snapshot JSON must be an object." };

  if (payload.kind !== SNAPSHOT_EXPORT_KIND)
    return { ok: false, message: `Snapshot kind must be ${SNAPSHOT_EXPORT_KIND}.` };

  if (payload.schema !== SNAPSHOT_SCHEMA)
    return { ok: false, message: `Snapshot schema must be ${SNAPSHOT_SCHEMA}.` };

  if (payload.patchID !== SNAPSHOT_PATCH_ID)
    return { ok: false, message: `Snapshot patchID must be ${SNAPSHOT_PATCH_ID}.` };

  if (payload.label !== undefined && typeof payload.label !== "string")
    return { ok: false, message: "Snapshot label must be a string." };

  const validation = validateSnapshotValues(payload.values, parameterInfoByID);

  if (!validation.ok)
    return validation;

  return {
    ok: true,
    label: payload.label ?? "",
    values: validation.values,
  };
}

function validateSnapshotValues(values, parameterInfoByID) {
  if (!values || typeof values !== "object" || Array.isArray(values))
    return { ok: false, message: "Snapshot values must be an object." };

  if (Object.keys(values).length === 0)
    return { ok: false, message: "Snapshot values cannot be empty." };

  const validatedValues = {};

  for (const [endpointID, value] of Object.entries(values)) {
    const parameter = parameterInfoByID.get(endpointID);

    if (!parameter)
      return { ok: false, message: `Unknown parameter: ${endpointID}.` };

    const validatedValue = validateSnapshotValue(parameter, value);

    if (!validatedValue.ok)
      return { ok: false, message: `${endpointID}: ${validatedValue.message}` };

    validatedValues[endpointID] = validatedValue.value;
  }

  return { ok: true, values: validatedValues };
}

function validateSnapshotValue(parameter, value) {
  if (parameter?.annotation?.boolean) {
    if (value === true || value === false)
      return { ok: true, value };

    if (value === 0 || value === 1)
      return { ok: true, value: value === 1 };

    return { ok: false, message: "expected boolean value." };
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue))
    return { ok: false, message: "expected finite number." };

  const min = parameter?.annotation?.min;
  const max = parameter?.annotation?.max;
  const epsilon = 1.0e-6 * Math.max(1, Math.abs(min ?? 0), Math.abs(max ?? 0));

  if (min !== undefined && numericValue < min - epsilon)
    return { ok: false, message: `value ${numericValue} is below minimum ${min}.` };

  if (max !== undefined && numericValue > max + epsilon)
    return { ok: false, message: `value ${numericValue} is above maximum ${max}.` };

  return { ok: true, value: numericValue };
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

function createPatchView(patchConnection) {
  const elementName = "cosimo-ott-lab-view";

  if (!window.customElements.get(elementName))
    window.customElements.define(elementName, OttLabView);

  return new (window.customElements.get(elementName))(patchConnection);
}

export { createPatchView as default };
