import type { EffectSnapshotBankController } from "./effect-snapshot-bank";
import { createPresetBar, DEFAULT_PRESET_BAR_ELEMENT_NAME } from "./preset-bar";
import type { StandaloneEffectPresetController } from "./standalone-effect-presets";
import { createSnapshotBar, DEFAULT_SNAPSHOT_BAR_ELEMENT_NAME } from "./snapshot-bar";

function effectHeaderCSS(presetBarElementName: string, snapshotBarElementName: string): string {
    return /* css */ `
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

  ${presetBarElementName} {
    min-width: 0;
  }

  ${snapshotBarElementName} {
    min-width: 420px;
  }

  @media (max-width: 780px) {
    .effect-header {
      grid-template-columns: 1fr;
    }

    ${snapshotBarElementName} {
      min-width: 0;
    }
  }
`;
}

/** The historical registration name; pass another name to the factories to change it. */
export const DEFAULT_EFFECT_HEADER_ELEMENT_NAME = "cosimo-effect-header";

export type EffectHeaderElementOptions = {
    /** Registration name for the header itself. */
    elementName?: string;
    /** Registration name the header uses for its embedded preset bar. */
    presetBarElementName?: string;
    /** Registration name the header uses for its embedded snapshot bar. */
    snapshotBarElementName?: string;
};

class EffectHeader extends HTMLElement {
    /** Child element names the constructor reads; configured registrations subclass with overrides. */
    static readonly presetBarElementName: string = DEFAULT_PRESET_BAR_ELEMENT_NAME;
    static readonly snapshotBarElementName: string = DEFAULT_SNAPSHOT_BAR_ELEMENT_NAME;

    private readonly presetBar: ReturnType<typeof createPresetBar>;
    private readonly snapshotBar: ReturnType<typeof createSnapshotBar>;
    private _presetController: StandaloneEffectPresetController | null = null;
    private _snapshotController: EffectSnapshotBankController | null = null;

    constructor() {
        super();
        const { presetBarElementName, snapshotBarElementName } = this.constructor as typeof EffectHeader;
        this.presetBar = createPresetBar(presetBarElementName);
        this.snapshotBar = createSnapshotBar(snapshotBarElementName);
        const shadow = this.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        const frame = document.createElement("div");
        style.textContent = effectHeaderCSS(presetBarElementName, snapshotBarElementName);
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

export function defineEffectHeaderElement(options: EffectHeaderElementOptions = {}): void {
    const elementName = options.elementName ?? DEFAULT_EFFECT_HEADER_ELEMENT_NAME;
    if (window.customElements.get(elementName)) {
        return;
    }

    const presetBarElementName = options.presetBarElementName ?? DEFAULT_PRESET_BAR_ELEMENT_NAME;
    const snapshotBarElementName = options.snapshotBarElementName ?? DEFAULT_SNAPSHOT_BAR_ELEMENT_NAME;
    const headerClass = presetBarElementName === DEFAULT_PRESET_BAR_ELEMENT_NAME
        && snapshotBarElementName === DEFAULT_SNAPSHOT_BAR_ELEMENT_NAME
        ? EffectHeader
        : class extends EffectHeader {
            static override readonly presetBarElementName = presetBarElementName;
            static override readonly snapshotBarElementName = snapshotBarElementName;
        };
    window.customElements.define(elementName, headerClass);
}

export function createEffectHeader(options: EffectHeaderElementOptions = {}): EffectHeader {
    defineEffectHeaderElement(options);
    const elementName = options.elementName ?? DEFAULT_EFFECT_HEADER_ELEMENT_NAME;
    return document.createElement(elementName) as EffectHeader;
}
