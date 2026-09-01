import {
    DEFAULT_PRESET_BAR_ELEMENT_NAME,
    PresetBar,
} from "./preset-bar";
import type {
    StandaloneEffectPresetController,
    StandaloneEffectPresetMutationResult,
    StandaloneEffectPresetState,
} from "./standalone-effect-presets";
import type { SynthStandaloneEffectPresetController } from "./synth-standalone-presets";
import {
    createSoundShareURL,
    decodeSoundShareFragment,
    stripSoundShareFragment,
} from "../sound-share-link";
import type { SoundShareEnvelopeV2 } from "../sound-share-envelope";
import {
    SILENT_POLISH_METER_FRAME,
    advancePolishPeakDisplay,
    createPolishPeakDisplayState,
    formatPolishLoudnessDbfs,
    formatPolishPeakDbfs,
    normalizePolishMeterMessage,
    type PolishMeterFrame,
    type PolishPeakDisplayState,
} from "../polish";

// The Cosimo synth's presentation extension of the generic preset bar: the
// Polish master-chain meter, sound-share links, bounce actions, the compact
// synth-shell composition (ADR-026), and the perf-tuning hook. The synth
// registers this subclass under the shared default element name from its own
// entry, so effect-plugin pages never load any of these imports.

type SynthSoundMutations = ReturnType<SynthStandaloneEffectPresetController["getSynthMutations"]>;

// SVG markup copied from the lucide-static package.
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

// ── CSS ──────────────────────────────────────────────────

const SYNTH_PRESET_BAR_CSS = /* css */ `
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

  /* ── Compact synth-shell composition (ADR-026) ─────────
     Additive mode: without the attribute, nothing below applies and the
     standalone-effects presentation is untouched. */

  .shell-left-cluster, .shell-back, .polish-meter, .shell-more, .shell-menu { display: none; }

  :host([compact-synth]) .preset-bar {
    --shell-left-cluster-width: 134px;
    display: block;
    box-sizing: border-box;
    height: var(--compact-shell-row, 40px);
    padding: 0;
  }

  :host([compact-synth]) .nav-btn,
  :host([compact-synth]) .action-group,
  :host([compact-synth]) .source-tag,
  :host([compact-synth]) .chevron { display: none; }

  :host([compact-synth]) .shell-left-cluster {
    position: absolute;
    z-index: 2;
    top: 0;
    left: 0;
    display: flex;
    width: var(--shell-left-cluster-width);
    height: 100%;
    align-items: center;
    gap: 2px;
  }

  :host([compact-synth]) .shell-back {
    display: grid;
    width: 40px;
    flex: 0 0 40px;
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
    position: absolute;
    z-index: 2;
    top: 0;
    right: 0;
    display: grid;
    width: 40px;
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
    position: absolute;
    z-index: 1;
    top: 0;
    left: 50%;
    width: max(0px, calc(100% - (2 * var(--shell-left-cluster-width))));
    justify-content: center;
    min-width: 0;
    padding-inline: 2px;
    transform: translateX(-50%);
  }

  :host([compact-synth]) .polish-meter {
    display: grid;
    width: 92px;
    height: 24px;
    flex: 0 0 92px;
    grid-template-columns: 7px 35px 34px;
    align-items: center;
    gap: 3px;
    padding: 0 4px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 999px;
    background: rgba(0,0,0,0.34);
    box-shadow: inset 0 1px rgba(255,255,255,0.035);
    color: rgba(229,236,234,0.78);
    pointer-events: none;
  }

  .polish-meter-light {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--polish-meter-light, #77d9a2);
    box-shadow: 0 0 7px color-mix(in srgb, var(--polish-meter-light, #77d9a2) 72%, transparent);
    opacity: calc(0.32 + (var(--polish-meter-pulse, 0) * 0.68));
    transform: scale(calc(0.78 + (var(--polish-meter-pulse, 0) * 0.38)));
    transform-origin: center;
  }

  .polish-meter-readout {
    display: grid;
    min-width: 0;
    grid-template-columns: 8px minmax(0, 1fr);
    align-items: center;
    font-size: 8px;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    line-height: 1;
    white-space: nowrap;
  }

  .polish-meter-readout > b {
    color: rgba(229,236,234,0.42);
    font-weight: 600;
  }

  .polish-meter-readout > span {
    overflow: hidden;
    color: rgba(239,246,242,0.88);
    text-align: right;
  }

  .polish-meter[data-overload="true"] .polish-meter-readout:first-of-type > span {
    color: #ff6b61;
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
// Fragments the synth composes into the generic bar's shadow DOM. The shell
// cluster is prepended into .preset-bar so Back and the Polish meter render
// before the centered preset name.

const SYNTH_SHELL_CLUSTER_HTML = /* html */ `
  <div class="shell-left-cluster">
    <button class="shell-back" data-action="shell-back" data-el="shell-back" aria-label="Back" disabled>&#8249;</button>
    <div class="polish-meter" data-el="polish-meter" aria-label="Polish output meter">
      <span class="polish-meter-light" data-el="polish-meter-light" aria-hidden="true"></span>
      <output class="polish-meter-readout" aria-label="Peak dBFS"><b>P</b><span data-el="polish-meter-peak">-120</span></output>
      <output class="polish-meter-readout" aria-label="400 millisecond loudness dBFS"><b>L</b><span data-el="polish-meter-loudness">-120</span></output>
    </div>
  </div>
`;

const SYNTH_SHELL_MORE_HTML = /* html */ `
  <button class="shell-more" data-action="toggle-shell-menu" data-el="shell-more" aria-label="Preset actions" aria-haspopup="true" aria-expanded="false">&#8943;</button>
`;

const SYNTH_SHARE_ACTION_HTML = /* html */ `
  <span class="action-sep"></span>
  <button class="action-btn" data-action="share" data-el="btn-share" title="Share sound link" aria-label="Share sound link" disabled>${ICON_LINK}</button>
`;

const SYNTH_SHELL_MENU_HTML = /* html */ `
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
`;

const SYNTH_FLYOUT_ACTIONS_HTML = /* html */ `
  <div class="flyout-synth-actions" data-el="flyout-synth-actions" hidden>
    <button class="flyout-synth-action" data-action="bounce-audio" data-synth-bounce="audio" disabled>Bounce Audio</button>
    <button class="flyout-synth-action" data-action="bounce-video" data-synth-bounce="video" disabled>Bounce Video</button>
  </div>
`;

const SYNTH_DIALOGS_HTML = /* html */ `
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
`;

function htmlFragment(html: string): DocumentFragment {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content;
}

// ── Web Component ────────────────────────────────────────

export class SynthPresetBar extends PresetBar {
    static readonly observedAttributes = ["compact-synth"];

    declare protected _synthMutations: SynthSoundMutations | null;

    private _shellMenuOpen = false;
    private _shareFragmentChecked = false;
    private _pendingSharedEnvelope: SoundShareEnvelopeV2 | null = null;
    private _sharedLoadConfirmationOpen = false;
    private _sharedSoundReplacementPending = false;
    private _currentShareURL: string | null = null;
    private _audioBounceAvailable = false;
    private _videoBounceAvailable = false;
    private _polishMeterFrame: PolishMeterFrame = SILENT_POLISH_METER_FRAME;
    private _polishPeakDisplay: PolishPeakDisplayState = createPolishPeakDisplayState();
    private _polishMeterAnimationFrame: number | null = null;

    constructor() {
        super();
        const shadow = this.shadowRoot!;

        const synthStyle = document.createElement("style");
        synthStyle.textContent = SYNTH_PRESET_BAR_CSS;
        shadow.querySelector("style")!.after(synthStyle);

        const bar = shadow.querySelector(".preset-bar")!;
        bar.prepend(htmlFragment(SYNTH_SHELL_CLUSTER_HTML));
        bar.insertBefore(htmlFragment(SYNTH_SHELL_MORE_HTML), bar.querySelector(".action-group"));
        bar.querySelector(".action-group")!.append(htmlFragment(SYNTH_SHARE_ACTION_HTML));
        bar.after(htmlFragment(SYNTH_SHELL_MENU_HTML));
        this._els["flyout"].insertBefore(
            htmlFragment(SYNTH_FLYOUT_ACTIONS_HTML),
            this._els["flyout"].querySelector(".flyout-footer"),
        );
        this._els["dialog-overlay"].append(htmlFragment(SYNTH_DIALOGS_HTML));

        this._els = this._cacheElements(shadow);
    }

    attributeChangedCallback() {
        this._syncInitMenuRow();
        this._syncSynthBounceActions();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._polishMeterAnimationFrame !== null) {
            window.cancelAnimationFrame(this._polishMeterAnimationFrame);
            this._polishMeterAnimationFrame = null;
        }
    }

    // ── Generic-bar extension seams ──────────────────────

    protected override _prepareController(next: StandaloneEffectPresetController | null) {
        this._shareFragmentChecked = false;
        this._pendingSharedEnvelope = null;
        this._sharedLoadConfirmationOpen = false;
        this._sharedSoundReplacementPending = false;
        this._currentShareURL = null;
        super._prepareController(next);
    }

    protected override _hasOpenExtensionSurface(): boolean {
        return this._shellMenuOpen;
    }

    protected override _closeExtensionSurfaces() {
        this._closeShellMenu();
    }

    protected override _afterActionActivated(actionEl: HTMLElement) {
        if (actionEl.closest(".shell-menu")) {
            this._closeShellMenu();
        }
    }

    protected override _syncExtensionSurfaces(_state: StandaloneEffectPresetState) {
        this._syncInitMenuRow();
        this._syncSynthBounceActions();
    }

    protected override _afterStateRender(state: StandaloneEffectPresetState) {
        if (state.ready && !this._shareFragmentChecked) {
            this._shareFragmentChecked = true;
            void this._detectSharedSoundFragment();
        }
    }

    protected override _updateBar(state: StandaloneEffectPresetState) {
        super._updateBar(state);

        const canSave = this._canSaveActiveState(state);
        (this._els["menu-save"] as HTMLButtonElement).disabled = !canSave;
        (this._els["menu-revert"] as HTMLButtonElement).disabled = !state.dirty;
        const canShare = state.ready && state.supportsInit && this._canUseSoundLinks();
        (this._els["btn-share"] as HTMLButtonElement).disabled = !canShare;
        (this._els["menu-share"] as HTMLButtonElement).disabled = !canShare;
    }

    // ── Actions ──────────────────────────────────────────

    protected override _handleAction(action: string) {
        switch (action) {
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
            case "shell-back":
                this.dispatchEvent(new CustomEvent("cosimo-shell-back", { bubbles: true, composed: true }));
                break;
            case "perf-tuning":
                this.dispatchEvent(new CustomEvent("cosimo-open-perf-tuning", { bubbles: true, composed: true }));
                break;
            case "toggle-shell-menu": this._toggleShellMenu(); break;
            default: super._handleAction(action);
        }
    }

    private _doInit() {
        const result = this._synthMutations?.initSound();
        if (result) this._handleSoundReplacementResult(result);
    }

    // ── Compact synth-shell menu (ADR-026) ───────────────

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

    set polishMeterFrame(value: PolishMeterFrame) {
        const parsed = normalizePolishMeterMessage(value);
        if (parsed === null) {
            return;
        }
        this._polishMeterFrame = parsed;
        this._requestPolishMeterPresentation();
    }

    private _requestPolishMeterPresentation() {
        if (this._polishMeterAnimationFrame !== null) {
            return;
        }

        const present = (nowMs: number) => {
            this._polishMeterAnimationFrame = null;
            this._polishPeakDisplay = advancePolishPeakDisplay(
                this._polishPeakDisplay,
                this._polishMeterFrame,
                nowMs,
            );
            this._renderPolishMeter();

            const stillHolding = nowMs < this._polishPeakDisplay.heldUntilMs;
            const stillDecaying = this._polishPeakDisplay.peakDbfs
                > this._polishMeterFrame.peakDbfs + 0.01;
            if (stillHolding || stillDecaying) {
                this._polishMeterAnimationFrame = window.requestAnimationFrame(present);
            }
        };

        this._polishMeterAnimationFrame = window.requestAnimationFrame(present);
    }

    private _renderPolishMeter() {
        this._els["polish-meter-peak"].textContent = formatPolishPeakDbfs(
            this._polishPeakDisplay.peakDbfs,
        );
        this._els["polish-meter-loudness"].textContent = formatPolishLoudnessDbfs(
            this._polishMeterFrame.loudnessDbfs,
        );

        const pulse = Math.max(0, Math.min(1, (this._polishMeterFrame.loudnessDbfs + 60) / 60));
        const lightColor = this._polishPeakDisplay.peakDbfs >= 0
            ? "#ff5c52"
            : this._polishPeakDisplay.peakDbfs >= -6
                ? "#f4c86a"
                : "#77d9a2";
        const meter = this._els["polish-meter"];
        meter.style.setProperty("--polish-meter-pulse", String(pulse));
        meter.style.setProperty("--polish-meter-light", lightColor);
        meter.dataset.overload = this._polishPeakDisplay.peakDbfs >= 0 ? "true" : "false";
        meter.setAttribute(
            "aria-label",
            `Polish output: peak ${formatPolishPeakDbfs(this._polishPeakDisplay.peakDbfs)} dBFS, loudness ${formatPolishLoudnessDbfs(this._polishMeterFrame.loudnessDbfs)} dBFS`,
        );
    }

    /** Whether universal Back has somewhere to go (compact synth shell only). */
    set shellBackAvailable(available: boolean) {
        (this._els["shell-back"] as HTMLButtonElement).disabled = !available;
    }

    /** Developer builds only: reveals the shell menu's Developer settings row. */
    set perfTuningAvailable(available: boolean) {
        this._els["menu-perf-tuning"].toggleAttribute("hidden", !available);
    }

    // ── Bounce ───────────────────────────────────────────

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
            this._showToast("Video Bounce is available from the browser synth only.", "error");
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

    // ── Sound-share links ────────────────────────────────

    private async _doShareSound() {
        const captured = this._synthMutations?.captureSharedSound();
        if (!captured) {
            this._showToast("Sound links are available from the browser synth only.", "error");
            return;
        }
        if (!captured.ok) {
            return;
        }

        const created = await createSoundShareURL(captured.value, globalThis.location.href);
        if (!created.ok) {
            this._showToast(created.error.message, "error");
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
            this._showToast("Sound link copied.", "success");
            return;
        }
        this._showToast("Copy failed. Select the link and copy it manually.", "error");
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
        this._showDialog("share-dialog");
    }

    private _setShareDialogMessage(message: string, warning: boolean) {
        const element = this._els["share-message"];
        element.textContent = message;
        element.classList.toggle("warn", warning);
    }

    private async _detectSharedSoundFragment() {
        const controllerAtStart = this.controller;
        const result = await decodeSoundShareFragment(globalThis.location.hash);
        if (controllerAtStart !== this.controller) {
            return;
        }
        if (!result.ok) {
            this._showToast(result.error.message, "error");
            return;
        }
        if (result.value === null) {
            return;
        }
        this._pendingSharedEnvelope = result.value;
        this._openSharedLoadDialog(result.value);
    }

    private _openSharedLoadDialog(envelope: SoundShareEnvelopeV2) {
        const preset = envelope.preset as Record<string, unknown>;
        const label = typeof preset.label === "string" && preset.label.trim().length > 0
            ? ` “${preset.label.trim()}”`
            : "";
        this._els["shared-load-message"].textContent = `Load${label} from this link? Your current sound will not change until you confirm.`;
        this._sharedLoadConfirmationOpen = true;
        this._showDialog("shared-load-dialog");
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
            this._showToast(stripped.error.message, "warn");
            return;
        }
        this._showToast("Shared sound loaded.", "success");
    }

    // ── Sound replacement (share-aware wrappers) ─────────

    protected override _handleSoundReplacementResult(
        result: StandaloneEffectPresetMutationResult<unknown>,
        showSuccess = false,
    ) {
        if (result.ok && this._sharedSoundReplacementPending) {
            this._completeSharedSoundLoad();
            return;
        }

        super._handleSoundReplacementResult(result, showSuccess);

        if (
            !result.ok
            && !("actionRequired" in result)
            && this._sharedSoundReplacementPending
            && this._state?.pendingSoundReplacement?.kind !== "share"
        ) {
            this._pendingSharedEnvelope = null;
            this._sharedSoundReplacementPending = false;
        }
    }

    protected override _cancelSoundReplacement() {
        super._cancelSoundReplacement();
        if (this._sharedSoundReplacementPending) {
            this._pendingSharedEnvelope = null;
            this._sharedSoundReplacementPending = false;
        }
    }

    protected override _handleDialogDismissal() {
        if (this._sharedLoadConfirmationOpen) {
            this._pendingSharedEnvelope = null;
            this._sharedLoadConfirmationOpen = false;
        }

        super._handleDialogDismissal();

        if (this._dialogContinuesSoundReplacement && this._sharedSoundReplacementPending) {
            this._pendingSharedEnvelope = null;
            this._sharedSoundReplacementPending = false;
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
}

// ── Public API ───────────────────────────────────────────
// The synth registers its extension under the same default element name the
// generic bar would use, from its own entry, so every "cosimo-preset-bar" in
// the synth page carries the synth surface while plugin pages stay generic.

export function defineSynthPresetBarElement(elementName: string = DEFAULT_PRESET_BAR_ELEMENT_NAME): void {
    if (!window.customElements.get(elementName)) {
        window.customElements.define(elementName, SynthPresetBar);
    }
}

export function createSynthPresetBar(elementName: string = DEFAULT_PRESET_BAR_ELEMENT_NAME): SynthPresetBar {
    defineSynthPresetBarElement(elementName);
    return document.createElement(elementName) as SynthPresetBar;
}
