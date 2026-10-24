type Sheet = { readonly element: HTMLStyleElement; count: number };
const sheets = new WeakMap<Node, Map<string, Sheet>>();

/**
 * Install a component's default styles once per document or shadow root, for as long as
 * any instance stays mounted. Returns the release function for the unmounting instance.
 */
export function retainStyles(node: Element, id: string, css: string): () => void {
    const root = node.getRootNode();
    const target = root.nodeType === Node.DOCUMENT_NODE ? node.ownerDocument.head : root;
    let installed = sheets.get(target);
    if (!installed) { installed = new Map(); sheets.set(target, installed); }
    let sheet = installed.get(id);
    if (!sheet) {
        const element = node.ownerDocument.createElement("style");
        element.dataset.builderKitStyles = id;
        element.textContent = css;
        // Author styles come later in the root, so equal-specificity author rules win.
        target.insertBefore(element, target.firstChild);
        sheet = { element, count: 0 };
        installed.set(id, sheet);
    }
    const owned = sheet, registry = installed;
    owned.count += 1;
    return () => {
        owned.count -= 1;
        if (owned.count > 0) return;
        owned.element.remove();
        registry.delete(id);
    };
}
