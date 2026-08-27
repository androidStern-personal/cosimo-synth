import type {
    StandaloneEffectPresetController,
    StandaloneEffectPresetListItem,
    StandaloneEffectPresetMutationResult,
    StandaloneEffectPresetSourceFilter,
    StandaloneEffectPresetState,
} from "./standalone-effect-presets";
import {
    createSoundShareURL,
    decodeSoundShareFragment,
    stripSoundShareFragment,
} from "../sound-share-link";
import type { SoundShareEnvelopeV1 } from "../sound-share-envelope";

// ── Types ────────────────────────────────────────────────

type SaveDialogMode = "new" | "rename" | "duplicate";

// SVG markup copied from the lucide-static package.
const ICON_SAVE = /* html */ `
<svg
  class="lucide lucide-save"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
  <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
  <path d="M7 3v4a1 1 0 0 0 1 1h7" />
</svg>`;

const ICON_SAVE_AS = /* html */ `
<svg
  class="lucide lucide-file-plus-2"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d="M11.35 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v5.35" />
  <path d="M14 2v5a1 1 0 0 0 1 1h5" />
  <path d="M14 19h6" />
  <path d="M17 16v6" />
</svg>`;

const ICON_REVERT = /* html */ `
<svg
  class="lucide lucide-undo-2"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d="M9 14 4 9l5-5" />
  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
</svg>`;

const ICON_COPY = /* html */ `
<svg
  class="lucide lucide-copy"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
</svg>`;

const ICON_PASTE = /* html */ `
<svg
  class="lucide lucide-clipboard-paste"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d="M11 14h10" />
  <path d="M16 4h2a2 2 0 0 1 2 2v1.344" />
  <path d="m17 18 4-4-4-4" />
  <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113" />
  <rect x="8" y="2" width="8" height="4" rx="1" />
</svg>`;

const ICON_LINK = /* html */ `
<svg
  class="lucide lucide-link-2"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d="M9 17H7A5 5 0 0 1 7 7h2" />
  <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
  <line x1="8" x2="16" y1="12" y2="12" />
</svg>`;

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

    // Controller failures are presented from StandaloneEffectPresetState.lastError.
    // Keeping that as the sole error channel also covers asynchronous bridge errors
    // without duplicating the returned mutation result.
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
    width: 32px;
    height: 100%;
    padding: 0;
    background: transparent;
    color: rgba(239,247,238,0.4);
    font: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 80ms;
    flex-shrink: 0;
  }
  .action-btn svg {
    width: 15px;
    height: 15px;
    stroke-width: 2;
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
    pointer-events: none;
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

  .flyout-synth-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 8px 14px 0;
    border-top: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .flyout-synth-actions[hidden] { display: none; }

  .flyout-synth-action {
    appearance: none;
    min-height: 34px;
    border: 1px solid rgba(135,215,245,0.16);
    border-radius: 7px;
    background: rgba(135,215,245,0.05);
    color: rgba(218,242,250,0.78);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .flyout-synth-action:hover {
    border-color: rgba(135,215,245,0.34);
    background: rgba(135,215,245,0.10);
    color: #e7f9ff;
  }
  .flyout-synth-action[disabled] {
    cursor: default;
    opacity: 0.34;
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
  .dialog[hidden] { display: none; }

  .dialog h3 {
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .dialog p {
    margin: 0 0 16px;
    color: rgba(239,247,238,0.62);
    font-size: 11px;
    line-height: 1.55;
  }

  .dialog p.warn { color: #ffe884; }

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

  .dialog input[readonly] {
    cursor: text;
    color: rgba(239,247,238,0.78);
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

  /* ── Compact synth-shell composition (ADR-026) ─────────
     Additive mode: without the attribute, nothing below applies and the
     standalone-effects presentation is untouched. */

  .shell-back, .shell-more, .shell-menu { display: none; }

  :host([compact-synth]) .preset-bar {
    display: grid;
    box-sizing: border-box;
    grid-template-columns: 40px minmax(0, 1fr) 40px;
    align-items: center;
    height: var(--compact-shell-row, 40px);
    padding: 0;
  }

  :host([compact-synth]) .nav-btn,
  :host([compact-synth]) .action-group,
  :host([compact-synth]) .source-tag,
  :host([compact-synth]) .chevron { display: none; }

  :host([compact-synth]) .shell-back {
    display: grid;
    place-items: center;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: rgba(226, 232, 234, 0.78);
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
  }

  /* The left slot stays reserved so the centered name never shifts. */
  :host([compact-synth]) .shell-back[disabled] {
    visibility: hidden;
    pointer-events: none;
  }

  :host([compact-synth]) .shell-more {
    display: grid;
    place-items: center;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: rgba(226, 232, 234, 0.78);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
  }

  :host([compact-synth]) .name-region {
    justify-content: center;
    min-width: 0;
  }

  :host([compact-synth]) .shell-menu.open {
    display: flex;
    position: absolute;
    top: calc(100% + 6px);
    right: 4px;
    z-index: 40;
    flex-direction: column;
    min-width: 208px;
    max-height: min(320px, 70vh);
    overflow-y: auto;
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: #14191c;
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55);
  }

  :host([compact-synth]) .shell-menu-row {
    display: flex;
    min-height: 44px;
    align-items: center;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(233, 238, 240, 0.86);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    text-align: left;
  }

  :host([compact-synth]) .shell-menu-row:hover { background: rgba(255, 255, 255, 0.06); }
  :host([compact-synth]) .shell-menu-row[disabled] { color: rgba(233, 238, 240, 0.32); cursor: default; }
  :host([compact-synth]) .shell-menu-row[disabled]:hover { background: transparent; }
  .shell-menu-row[hidden] { display: none !important; }
`;

// ── HTML ─────────────────────────────────────────────────

const PRESET_BAR_HTML = /* html */ `
  <div class="preset-bar">
    <button class="shell-back" data-action="shell-back" data-el="shell-back" aria-label="Back" disabled>&#8249;</button>

    <button class="nav-btn" data-action="prev" title="Previous preset">&#8249;</button>

    <div class="name-region" data-action="toggle-flyout">
      <span class="preset-name" data-el="preset-name">No Preset</span>
      <span class="dirty-indicator" data-el="dirty-dot"></span>
      <span class="source-tag" data-el="source-tag"></span>
      <span class="chevron">&#9662;</span>
    </div>

    <button class="nav-btn" data-action="next" title="Next preset">&#8250;</button>

    <button class="shell-more" data-action="toggle-shell-menu" data-el="shell-more" aria-label="Preset actions" aria-haspopup="true" aria-expanded="false">&#8943;</button>

    <div class="action-group">
      <button class="action-btn highlight" data-action="save" data-el="btn-save" title="Save preset" aria-label="Save preset" disabled>${ICON_SAVE}</button>
      <span class="action-sep"></span>
      <button class="action-btn" data-action="save-as" title="Save as new preset" aria-label="Save as new preset">${ICON_SAVE_AS}</button>
      <span class="action-sep"></span>
      <button class="action-btn" data-action="revert" data-el="btn-revert" title="Revert preset" aria-label="Revert preset" disabled>${ICON_REVERT}</button>
      <span class="action-sep"></span>
      <button class="action-btn" data-action="copy" title="Copy preset JSON" aria-label="Copy preset JSON">${ICON_COPY}</button>
      <span class="action-sep"></span>
      <button class="action-btn" data-action="paste" title="Paste preset JSON" aria-label="Paste preset JSON">${ICON_PASTE}</button>
      <span class="action-sep"></span>
      <button class="action-btn" data-action="share" data-el="btn-share" title="Share sound link" aria-label="Share sound link" disabled>${ICON_LINK}</button>
    </div>
  </div>

  <div class="shell-menu" data-el="shell-menu" role="menu" aria-label="Preset actions">
    <button class="shell-menu-row" role="menuitem" data-action="prev">Previous preset</button>
    <button class="shell-menu-row" role="menuitem" data-action="next">Next preset</button>
    <button class="shell-menu-row" role="menuitem" data-action="bounce-audio" data-synth-bounce="audio" hidden disabled>Bounce Audio</button>
    <button class="shell-menu-row" role="menuitem" data-action="bounce-video" data-synth-bounce="video" hidden disabled>Bounce Video</button>
    <button class="shell-menu-row" role="menuitem" data-action="save" data-el="menu-save" disabled>Save</button>
    <button class="shell-menu-row" role="menuitem" data-action="save-as">Save as new preset</button>
    <button class="shell-menu-row" role="menuitem" data-action="revert" data-el="menu-revert" disabled>Revert</button>
    <button class="shell-menu-row" role="menuitem" data-action="copy">Copy preset JSON</button>
    <button class="shell-menu-row" role="menuitem" data-action="paste">Paste preset JSON</button>
    <button class="shell-menu-row" role="menuitem" data-action="share" data-el="menu-share" disabled>Share sound link</button>
    <button class="shell-menu-row" role="menuitem" data-action="perf-tuning" data-el="menu-perf-tuning" hidden>Developer settings</button>
  </div>

  <div class="flyout" data-el="flyout">
    <div class="flyout-header">
      <input class="flyout-search" data-el="flyout-search" type="text" placeholder="Search presets..." autocomplete="off" spellcheck="false">
      <button class="filter-pill active" data-filter="all">All</button>
      <button class="filter-pill" data-filter="factory">Factory</button>
      <button class="filter-pill" data-filter="user">User</button>
    </div>
    <div class="flyout-list" data-el="flyout-list"></div>
    <div class="flyout-synth-actions" data-el="flyout-synth-actions" hidden>
      <button class="flyout-synth-action" data-action="bounce-audio" data-synth-bounce="audio" disabled>Bounce Audio</button>
      <button class="flyout-synth-action" data-action="bounce-video" data-synth-bounce="video" disabled>Bounce Video</button>
    </div>
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
    <div class="dialog" data-el="save-dialog">
      <h3 data-el="dialog-title">Save Preset</h3>
      <label for="cpb-save-name">Preset Name</label>
      <input type="text" id="cpb-save-name" data-el="dialog-input" value="">
      <div class="dialog-actions">
        <button data-action="dialog-cancel">Cancel</button>
        <button class="primary" data-action="dialog-confirm" data-el="dialog-confirm">Save</button>
      </div>
    </div>
    <div class="dialog" data-el="sound-replacement-dialog" hidden>
      <h3>Unsaved Changes</h3>
      <div class="dialog-actions">
        <button data-action="sound-replacement-cancel">Cancel</button>
        <button data-action="sound-replacement-discard" data-el="sound-replacement-discard">Discard and Init</button>
        <button class="primary" data-action="sound-replacement-save" data-el="sound-replacement-save">Save and Init</button>
      </div>
    </div>
    <div class="dialog" data-el="shared-load-dialog" hidden>
      <h3>Load shared sound?</h3>
      <p data-el="shared-load-message">This link contains a sound that can replace the current sound.</p>
      <div class="dialog-actions">
        <button data-action="shared-load-cancel">Cancel</button>
        <button class="primary" data-action="shared-load-confirm">Load</button>
      </div>
    </div>
    <div class="dialog" data-el="share-dialog" hidden>
      <h3>Share Sound</h3>
      <p data-el="share-message">Copy this link to share the current sound.</p>
      <input type="text" data-el="share-link" aria-label="Shared sound link" value="" readonly>
      <div class="dialog-actions">
        <button data-action="share-close">Close</button>
        <button class="primary" data-action="share-copy">Copy Link</button>
      </div>
    </div>
  </div>

  <div class="cpb-toast-host" data-el="toast-host"></div>
`;

// ── Web Component ────────────────────────────────────────

const ELEMENT_NAME = "cosimo-preset-bar";

class PresetBar extends HTMLElement {
    static readonly observedAttributes = ["compact-synth"];

    private _controller: StandaloneEffectPresetController | null = null;
    private _unsubscribe: (() => void) | null = null;
    private _state: StandaloneEffectPresetState | null = null;
    private _mutations: ReturnType<StandaloneEffectPresetController["getMutations"]> | null = null;
    private _synthMutations: ReturnType<StandaloneEffectPresetController["getSynthMutations"]> = null;

    private _flyoutOpen = false;
    private _ctxTarget: StandaloneEffectPresetListItem | null = null;
    private _saveDialogMode: SaveDialogMode = "new";
    private _saveDialogPresetKey: string | null = null;
    private _dialogContinuesSoundReplacement = false;
    private _shareFragmentChecked = false;
    private _pendingSharedEnvelope: SoundShareEnvelopeV1 | null = null;
    private _sharedLoadConfirmationOpen = false;
    private _sharedSoundReplacementPending = false;
    private _currentShareURL: string | null = null;
    private _audioBounceAvailable = false;
    private _videoBounceAvailable = false;

    // Cached DOM refs
    private _els!: Record<string, HTMLElement>;

    private readonly _handleDocumentPointerDown = (event: PointerEvent) => {
        if (
            !this._flyoutOpen
            && !this._shellMenuOpen
            && !this._els["ctx-menu"].classList.contains("open")
        ) {
            return;
        }

        if (event.composedPath().includes(this)) {
            return;
        }

        this._closeFlyout();
        this._closeCtxMenu();
        this._closeShellMenu();
    };

    private readonly _handleDocumentWheel = (event: WheelEvent) => {
        if (!this._flyoutOpen) {
            return;
        }

        if (event.composedPath().includes(this._els["flyout"])) {
            return;
        }

        this._closeFlyout();
    };

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
        this._synthMutations = null;
        this._state = null;
        this._shareFragmentChecked = false;
        this._pendingSharedEnvelope = null;
        this._sharedLoadConfirmationOpen = false;
        this._sharedSoundReplacementPending = false;
        this._currentShareURL = null;

        if (next) {
            this._mutations = next.getMutations();
            this._synthMutations = typeof next.getSynthMutations === "function"
                ? next.getSynthMutations()
                : null;
            this._unsubscribe = next.subscribe((state) => this._onState(state));
            this._onState(next.getState());
        }
    }

    disconnectedCallback() {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }

        this._removeDocumentListeners();
        this._closeFlyout();
        this._closeCtxMenu();
        this._closeDialog();
    }

    attributeChangedCallback() {
        this._syncInitMenuRow();
        this._syncSynthBounceActions();
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
                if (actionEl.closest(".shell-menu")) {
                    this._closeShellMenu();
                }
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
            case "share": void this._doShareSound(); break;
            case "bounce-audio":
                this._closeFlyout();
                this.dispatchEvent(new CustomEvent("cosimo-bounce-audio", { bubbles: true, composed: true }));
                break;
            case "bounce-video": this._doBounceVideo(); break;
            case "share-copy": void this._copyCurrentShareURL(); break;
            case "share-close": this._closeDialog(false); break;
            case "shared-load-cancel": this._cancelSharedSoundLoad(); break;
            case "shared-load-confirm": this._confirmSharedSoundLoad(); break;
            case "init": this._doInit(); break;
            case "dialog-cancel": this._closeDialog(); break;
            case "dialog-confirm": this._confirmDialog(); break;
            case "sound-replacement-cancel": this._cancelSoundReplacement(); break;
            case "sound-replacement-discard": this._discardSoundReplacement(); break;
            case "sound-replacement-save": this._saveSoundReplacement(); break;
            case "shell-back":
                this.dispatchEvent(new CustomEvent("cosimo-shell-back", { bubbles: true, composed: true }));
                break;
            case "perf-tuning":
                this.dispatchEvent(new CustomEvent("cosimo-open-perf-tuning", { bubbles: true, composed: true }));
                break;
            case "toggle-shell-menu": this._toggleShellMenu(); break;
        }
    }

    // ── Compact synth-shell menu (ADR-026) ───────────────

    private _shellMenuOpen = false;

    private _toggleShellMenu() {
        if (this._shellMenuOpen) {
            this._closeShellMenu();
            return;
        }
        this._shellMenuOpen = true;
        this._els["shell-menu"].classList.add("open");
        this._els["shell-more"].setAttribute("aria-expanded", "true");
        this._addDocumentListeners();
    }

    private _closeShellMenu() {
        if (!this._shellMenuOpen) {
            return;
        }
        this._shellMenuOpen = false;
        this._els["shell-menu"].classList.remove("open");
        this._els["shell-more"].setAttribute("aria-expanded", "false");
    }

    private _syncInitMenuRow() {
        const shellMenu = this._els["shell-menu"];
        const existingRow = shellMenu.querySelector('[data-action="init"]');
        const shouldShow = this.hasAttribute("compact-synth") && this._state?.supportsInit === true;

        if (!shouldShow) {
            existingRow?.remove();
            return;
        }

        if (existingRow) {
            return;
        }

        const row = document.createElement("button");
        row.className = "shell-menu-row";
        row.setAttribute("role", "menuitem");
        row.dataset.action = "init";
        row.textContent = "Init";
        const nextRow = shellMenu.querySelector('[data-action="next"]');
        shellMenu.insertBefore(row, nextRow?.nextSibling ?? shellMenu.firstChild);
    }

    private _syncSynthBounceActions() {
        const isSynth = this._state?.supportsInit === true;
        this._els["flyout-synth-actions"].hidden = !isSynth;
        for (const action of this.shadowRoot!.querySelectorAll<HTMLButtonElement>("[data-synth-bounce]")) {
            action.hidden = !isSynth && action.classList.contains("shell-menu-row");
            const available = action.dataset.synthBounce === "audio"
                ? this._audioBounceAvailable
                : this._videoBounceAvailable;
            action.disabled = !isSynth || this._state?.ready !== true || !available;
        }
    }

    set audioBounceAvailable(available: boolean) {
        this._audioBounceAvailable = available;
        this._syncSynthBounceActions();
    }

    set videoBounceAvailable(available: boolean) {
        this._videoBounceAvailable = available;
        this._syncSynthBounceActions();
    }

    /** Whether universal Back has somewhere to go (compact synth shell only). */
    set shellBackAvailable(available: boolean) {
        (this._els["shell-back"] as HTMLButtonElement).disabled = !available;
    }

    /** Developer builds only: reveals the shell menu's Developer settings row. */
    set perfTuningAvailable(available: boolean) {
        this._els["menu-perf-tuning"].toggleAttribute("hidden", !available);
    }

    /** Entry point used by the source panel so Bounce shares the synth's
        existing Save/Discard dirty guard instead of inventing another one. */
    requestBounceSoundReplacement(apply: () => void) {
        const result = this._synthMutations?.bounceSound(apply);
        if (result) {
            this._handleSoundReplacementResult(result);
        }
        return result;
    }

    private _doBounceVideo() {
        const captured = this._synthMutations?.captureCurrentSound();
        if (!captured) {
            showToast(this._els["toast-host"], "Video Bounce is available from the browser synth only.", "error");
            return;
        }
        if (!captured.ok) {
            return;
        }

        this._closeFlyout();
        this.dispatchEvent(new CustomEvent("cosimo-bounce-video", {
            bubbles: true,
            composed: true,
            detail: { patchInput: captured.value },
        }));
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
        if (result) this._handleSoundReplacementResult(result);
        this._closeFlyout();
        this._closeCtxMenu();
    }

    private _doInit() {
        const result = this._synthMutations?.initSound();
        if (result) this._handleSoundReplacementResult(result);
    }

    private _doSave() {
        const state = this._state;
        if (!state) return;

        if (!state.activePreset && state.supportsInit && state.dirty) {
            this._openSaveDialog("new");
            return;
        }

        if (!state.activePreset) return;

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
            if (result) this._handleSoundReplacementResult(result, true);
        });
    }

    private async _doShareSound() {
        const captured = this._synthMutations?.captureSharedSound();
        if (!captured) {
            showToast(this._els["toast-host"], "Sound links are available from the browser synth only.", "error");
            return;
        }
        if (!captured.ok) {
            return;
        }

        const created = await createSoundShareURL(captured.value, globalThis.location.href);
        if (!created.ok) {
            showToast(this._els["toast-host"], created.error.message, "error");
            return;
        }

        this._currentShareURL = created.value.url;
        const message = created.value.lengthClass === "warning"
            ? `This link is ${created.value.length.toLocaleString()} characters. Some apps may shorten it; copy the complete link below.`
            : "Anyone with this link can choose to load this sound. The sound data stays in the URL fragment.";
        this._openShareDialog(message, created.value.lengthClass === "warning");

        const copied = await this._writeShareURLToClipboard(created.value.url);
        if (copied) {
            const prefix = created.value.lengthClass === "warning" ? `${message} ` : "";
            this._setShareDialogMessage(`${prefix}Link copied.`, created.value.lengthClass === "warning");
        }
    }

    private async _copyCurrentShareURL() {
        if (!this._currentShareURL) {
            return;
        }
        const copied = await this._writeShareURLToClipboard(this._currentShareURL);
        if (copied) {
            showToast(this._els["toast-host"], "Sound link copied.", "success");
            return;
        }
        showToast(this._els["toast-host"], "Copy failed. Select the link and copy it manually.", "error");
    }

    private async _writeShareURLToClipboard(url: string) {
        try {
            if (typeof globalThis.navigator.clipboard?.writeText !== "function") {
                return false;
            }
            await globalThis.navigator.clipboard.writeText(url);
            return true;
        } catch {
            return false;
        }
    }

    private _openShareDialog(message: string, warning: boolean) {
        (this._els["share-link"] as HTMLInputElement).value = this._currentShareURL ?? "";
        this._setShareDialogMessage(message, warning);
        this._els["save-dialog"].hidden = true;
        this._els["sound-replacement-dialog"].hidden = true;
        this._els["shared-load-dialog"].hidden = true;
        this._els["share-dialog"].hidden = false;
        this._els["dialog-overlay"].classList.add("open");
    }

    private _setShareDialogMessage(message: string, warning: boolean) {
        const element = this._els["share-message"];
        element.textContent = message;
        element.classList.toggle("warn", warning);
    }

    private async _detectSharedSoundFragment() {
        const controllerAtStart = this._controller;
        const result = await decodeSoundShareFragment(globalThis.location.hash);
        if (controllerAtStart !== this._controller) {
            return;
        }
        if (!result.ok) {
            showToast(this._els["toast-host"], result.error.message, "error");
            return;
        }
        if (result.value === null) {
            return;
        }
        this._pendingSharedEnvelope = result.value;
        this._openSharedLoadDialog(result.value);
    }

    private _openSharedLoadDialog(envelope: SoundShareEnvelopeV1) {
        const preset = envelope.preset as Record<string, unknown>;
        const label = typeof preset.label === "string" && preset.label.trim().length > 0
            ? ` “${preset.label.trim()}”`
            : "";
        this._els["shared-load-message"].textContent = `Load${label} from this link? Your current sound will not change until you confirm.`;
        this._sharedLoadConfirmationOpen = true;
        this._els["save-dialog"].hidden = true;
        this._els["sound-replacement-dialog"].hidden = true;
        this._els["share-dialog"].hidden = true;
        this._els["shared-load-dialog"].hidden = false;
        this._els["dialog-overlay"].classList.add("open");
    }

    private _cancelSharedSoundLoad() {
        this._pendingSharedEnvelope = null;
        this._sharedLoadConfirmationOpen = false;
        this._sharedSoundReplacementPending = false;
        this._closeDialog(false);
    }

    private _confirmSharedSoundLoad() {
        const envelope = this._pendingSharedEnvelope;
        if (!envelope || !this._synthMutations) {
            this._cancelSharedSoundLoad();
            return;
        }

        this._sharedLoadConfirmationOpen = false;
        this._sharedSoundReplacementPending = true;
        this._closeDialog(false);
        const result = this._synthMutations.loadSharedSound(envelope);
        this._handleSoundReplacementResult(result, true);
    }

    private _completeSharedSoundLoad() {
        this._pendingSharedEnvelope = null;
        this._sharedLoadConfirmationOpen = false;
        this._sharedSoundReplacementPending = false;
        const stripped = stripSoundShareFragment();
        if (!stripped.ok) {
            showToast(this._els["toast-host"], stripped.error.message, "warn");
            return;
        }
        showToast(this._els["toast-host"], "Shared sound loaded.", "success");
    }

    private _handleSoundReplacementResult(
        result: StandaloneEffectPresetMutationResult<unknown>,
        showSuccess = false,
    ) {
        if (result.ok) {
            if (this._sharedSoundReplacementPending) {
                this._completeSharedSoundLoad();
                return;
            }
            if (showSuccess) {
                showToast(this._els["toast-host"], result.message, "success");
            }
            return;
        }

        if ("actionRequired" in result) {
            if (result.actionRequired === "confirm-sound-replacement") {
                this._openSoundReplacementDialog();
                return;
            }

            this._openSaveDialog("new", undefined, undefined, true);
            return;
        }

        if (
            this._sharedSoundReplacementPending
            && this._state?.pendingSoundReplacement?.kind !== "share"
        ) {
            this._pendingSharedEnvelope = null;
            this._sharedSoundReplacementPending = false;
        }
    }

    private _openSoundReplacementDialog() {
        const pendingKind = this._state?.pendingSoundReplacement?.kind;
        const actionLabel = pendingKind === "bounce"
            ? "Bounce"
            : pendingKind === "preset" || pendingKind === "import" || pendingKind === "share"
                ? "Load"
                : "Init";
        this._els["sound-replacement-discard"].textContent = `Discard and ${actionLabel}`;
        this._els["sound-replacement-save"].textContent = `Save and ${actionLabel}`;
        this._dialogContinuesSoundReplacement = true;
        this._els["save-dialog"].hidden = true;
        this._els["shared-load-dialog"].hidden = true;
        this._els["share-dialog"].hidden = true;
        this._els["sound-replacement-dialog"].hidden = false;
        this._els["dialog-overlay"].classList.add("open");
    }

    private _cancelSoundReplacement() {
        this._synthMutations?.cancelSoundReplacement();
        if (this._sharedSoundReplacementPending) {
            this._pendingSharedEnvelope = null;
            this._sharedSoundReplacementPending = false;
        }
        this._closeDialog(false);
    }

    private _discardSoundReplacement() {
        const result = this._synthMutations?.discardAndContinueSoundReplacement();
        if (result) {
            this._handleSoundReplacementResult(result);
        }
        this._closeDialog(false);
    }

    private _saveSoundReplacement() {
        const result = this._synthMutations?.saveAndContinueSoundReplacement();
        if (!result) {
            return;
        }

        if (!result.ok && "actionRequired" in result && result.actionRequired === "save-as-for-sound-replacement") {
            this._openSaveDialog("new", undefined, undefined, true);
            return;
        }

        this._handleSoundReplacementResult(result);
        if (result.ok) {
            this._closeDialog(false);
        }
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
        this._addDocumentListeners();
        this._renderFlyoutList();
        setTimeout(() => (this._els["flyout-search"] as HTMLInputElement).focus(), 30);
    }

    private _closeFlyout() {
        this._flyoutOpen = false;
        this._els["flyout"].classList.remove("open");
        this._els["flyout-backdrop"].classList.remove("open");
        this.shadowRoot!.querySelector(".name-region")!.classList.remove("open");
        this._removeDocumentListeners();

        if (this.shadowRoot?.activeElement === this._els["flyout-search"]) {
            (this._els["flyout-search"] as HTMLInputElement).blur();
        }
    }

    private _addDocumentListeners() {
        document.addEventListener("pointerdown", this._handleDocumentPointerDown, { capture: true });
        document.addEventListener("wheel", this._handleDocumentWheel, { capture: true, passive: true });
    }

    private _removeDocumentListeners() {
        document.removeEventListener("pointerdown", this._handleDocumentPointerDown, true);
        document.removeEventListener("wheel", this._handleDocumentWheel, true);
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

    private _openSaveDialog(
        mode: SaveDialogMode,
        presetKey?: string,
        prefill?: string,
        continuesSoundReplacement = false,
    ) {
        this._saveDialogMode = mode;
        this._saveDialogPresetKey = presetKey ?? null;
        this._dialogContinuesSoundReplacement = continuesSoundReplacement;

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

        this._els["sound-replacement-dialog"].hidden = true;
        this._els["shared-load-dialog"].hidden = true;
        this._els["share-dialog"].hidden = true;
        this._els["save-dialog"].hidden = false;
        this._els["dialog-overlay"].classList.add("open");
        setTimeout(() => { inputEl.focus(); inputEl.select(); }, 30);
    }

    private _closeDialog(cancelPendingSoundReplacement = true) {
        if (cancelPendingSoundReplacement && this._sharedLoadConfirmationOpen) {
            this._pendingSharedEnvelope = null;
            this._sharedLoadConfirmationOpen = false;
        }
        if (cancelPendingSoundReplacement && this._dialogContinuesSoundReplacement) {
            this._synthMutations?.cancelSoundReplacement();
            if (this._sharedSoundReplacementPending) {
                this._pendingSharedEnvelope = null;
                this._sharedSoundReplacementPending = false;
            }
        }

        this._dialogContinuesSoundReplacement = false;
        this._els["dialog-overlay"].classList.remove("open");
    }

    private _confirmDialog() {
        const name = (this._els["dialog-input"] as HTMLInputElement).value.trim();
        if (!name) return;

        let result: StandaloneEffectPresetMutationResult<unknown> | undefined;

        switch (this._saveDialogMode) {
            case "new":
                result = this._dialogContinuesSoundReplacement
                    ? this._synthMutations?.saveCurrentAsNewPresetAndContinueSoundReplacement(name)
                    : this._mutations?.saveCurrentAsNewPreset(name);
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

        if (!result) {
            return;
        }

        if (this._dialogContinuesSoundReplacement) {
            this._handleSoundReplacementResult(result);
            if (result.ok) {
                this._closeDialog(false);
            }
            return;
        }

        handleMutationResult(result, this._els["toast-host"]);
        this._closeDialog(false);
    }

    // ── State → DOM ──────────────────────────────────────

    private _onState(state: StandaloneEffectPresetState) {
        this._state = state;
        this._syncInitMenuRow();
        this._syncSynthBounceActions();
        this._updateBar(state);
        if (this._flyoutOpen) this._renderFlyoutList();

        if (state.ready && !this._shareFragmentChecked) {
            this._shareFragmentChecked = true;
            void this._detectSharedSoundFragment();
        }

        // Controller state is the sole presentation channel for controller errors.
        // clearLastError makes a later identical failure a new visible occurrence.
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
        const canSave = state.dirty && (activeItem?.canOverwrite === true || (state.supportsInit && !state.activePreset));
        (this._els["btn-save"] as HTMLButtonElement).disabled = !canSave;
        (this._els["btn-revert"] as HTMLButtonElement).disabled = !state.dirty;
        (this._els["menu-save"] as HTMLButtonElement).disabled = !canSave;
        (this._els["menu-revert"] as HTMLButtonElement).disabled = !state.dirty;
        const canShare = state.ready && state.supportsInit && this._canUseSoundLinks();
        (this._els["btn-share"] as HTMLButtonElement).disabled = !canShare;
        (this._els["menu-share"] as HTMLButtonElement).disabled = !canShare;

        // Sync filter pill active state
        for (const pill of this.shadowRoot!.querySelectorAll<HTMLElement>(".filter-pill")) {
            pill.classList.toggle("active", pill.dataset.filter === state.filter.source);
        }
    }

    private _canUseSoundLinks() {
        try {
            const protocol = new URL(globalThis.location.href).protocol;
            return protocol === "http:" || protocol === "https:";
        } catch {
            return false;
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
