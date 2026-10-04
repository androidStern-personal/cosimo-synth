/// <reference path="./style-modules.d.ts" />
import css from "./editor-tick-slider.css?inline";

type Sheet = { readonly element: HTMLStyleElement; count: number };
const sheets = new WeakMap<Node, Sheet>();

export function retainSliderStyles(control: HTMLElement): () => void {
    const root = control.getRootNode();
    const target = root.nodeType === Node.DOCUMENT_NODE ? control.ownerDocument.head : root;
    let sheet = sheets.get(target);
    if (!sheet) {
        const element = control.ownerDocument.createElement("style");
        element.dataset.builderKitSlider = "";
        element.textContent = css;
        target.insertBefore(element, target.firstChild);
        sheet = { element, count: 0 };
        sheets.set(target, sheet);
    }
    const owned = sheet;
    owned.count += 1;
    return () => {
        owned.count -= 1;
        if (owned.count === 0) { owned.element.remove(); sheets.delete(target); }
    };
}
