import type { EffectSnapshotBankController } from "./effect-snapshot-bank";
import { createPresetBar } from "./preset-bar";
import type { StandaloneEffectPresetController } from "./standalone-effect-presets";
import { createSnapshotBar } from "./snapshot-bar";

const EFFECT_HEADER_CSS = /* css */ `
  :host {
    display: block;
    position: relative;
    z-index: 60;
  }

  .effect-header {
    display: grid;
    grid-template-columns: minmax(280px, 1fr) auto;
    align-items: stretch;
    background: rgba(0, 0, 0, 0.14);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  cosimo-preset-bar {
    min-width: 0;
  }

  cosimo-snapshot-bar {
    min-width: 420px;
  }

  @media (max-width: 780px) {
    .effect-header {
      grid-template-columns: 1fr;
    }

    cosimo-snapshot-bar {
      min-width: 0;
    }
  }
`;

const ELEMENT_NAME = "cosimo-effect-header";

class EffectHeader extends HTMLElement {
    private readonly presetBar = createPresetBar();
    private readonly snapshotBar = createSnapshotBar();
    private _presetController: StandaloneEffectPresetController | null = null;
    private _snapshotController: EffectSnapshotBankController | null = null;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        const frame = document.createElement("div");
        style.textContent = EFFECT_HEADER_CSS;
        frame.className = "effect-header";
        frame.append(this.presetBar, this.snapshotBar);
        shadow.replaceChildren(style, frame);
    }

    get presetController(): StandaloneEffectPresetController | null {
        return this._presetController;
    }

    set presetController(next: StandaloneEffectPresetController | null) {
        this._presetController = next;
        this.presetBar.controller = next;
    }

    get snapshotController(): EffectSnapshotBankController | null {
        return this._snapshotController;
    }

    set snapshotController(next: EffectSnapshotBankController | null) {
        this._snapshotController = next;
        this.snapshotBar.controller = next;
    }

    disconnectedCallback() {
        this.presetBar.controller = null;
        this.snapshotBar.controller = null;
    }
}

export function defineEffectHeaderElement(): void {
    if (!window.customElements.get(ELEMENT_NAME)) {
        window.customElements.define(ELEMENT_NAME, EffectHeader);
    }
}

export function createEffectHeader(): EffectHeader {
    defineEffectHeaderElement();
    return document.createElement(ELEMENT_NAME) as EffectHeader;
}
