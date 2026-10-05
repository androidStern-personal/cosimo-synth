// The transient toast stack shared by the preset bar and the snapshot bar.
// Class and keyframe names are prefixed per component ("cpb" and "snapshot"
// historically) so each shadow root keeps its established selectors.

export type EffectToastTone = "success" | "warn" | "error";

export const EFFECT_TOAST_VISIBLE_MS = 2200;
export const EFFECT_TOAST_FADE_MS = 250;
export const EFFECT_TOAST_REMOVE_MS = 2500;

/** CSS for one `${classPrefix}-toast-host` stack and its toast tones. */
export function effectToastCSS(classPrefix: string): string {
    return /* css */ `
  .${classPrefix}-toast-host {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 400;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .${classPrefix}-toast {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(14, 18, 16, 0.95);
    backdrop-filter: blur(12px);
    font-size: 11px;
    color: rgba(239, 247, 238, 0.8);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    animation: ${classPrefix}-toast-in 160ms ease forwards;
    font-family: inherit;
  }

  .${classPrefix}-toast.success {
    color: var(--knob-track-value-color, #8ff0a4);
    border-color: rgba(143, 240, 164, 0.15);
  }

  .${classPrefix}-toast.warn {
    color: #ffe884;
    border-color: rgba(255, 232, 132, 0.15);
  }

  .${classPrefix}-toast.error {
    color: #ff9a7d;
    border-color: rgba(255, 154, 125, 0.15);
  }

  @keyframes ${classPrefix}-toast-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
}

export function showEffectToast({
    host,
    message,
    tone,
    classPrefix,
    datasetFlag,
}: {
    host: HTMLElement;
    message: string;
    tone: EffectToastTone;
    classPrefix: string;
    /** Optional empty `data-*` marker set on the toast (camelCase dataset key). */
    datasetFlag?: string;
}): HTMLElement {
    const toast = document.createElement("div");
    toast.className = `${classPrefix}-toast ${tone}`;

    if (datasetFlag) {
        toast.dataset[datasetFlag] = "";
    }

    toast.textContent = message;
    host.appendChild(toast);
    window.setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = `opacity ${EFFECT_TOAST_FADE_MS}ms`;
    }, EFFECT_TOAST_VISIBLE_MS);
    window.setTimeout(() => toast.remove(), EFFECT_TOAST_REMOVE_MS);
    return toast;
}
