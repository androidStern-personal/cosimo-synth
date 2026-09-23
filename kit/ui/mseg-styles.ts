import css from './mseg.css?inline'

type Sheet = { readonly element: HTMLStyleElement; count: number }
const sheets = new WeakMap<Node, Sheet>()

/** Install the scoped defaults once per document or shadow root, for the mounted controls' lifetime. */
export function retainMsegStyles(control: SVGSVGElement): () => void {
    const root = control.getRootNode()
    const target = root.nodeType === Node.DOCUMENT_NODE ? control.ownerDocument.head : root
    let sheet = sheets.get(target)
    if (!sheet) {
        const element = control.ownerDocument.createElement('style')
        element.dataset.builderKitMseg = ''
        element.textContent = css
        // Author styles follow defaults and can override equal-specificity rules.
        target.insertBefore(element, target.firstChild)
        sheet = { element, count: 0 }
        sheets.set(target, sheet)
    }
    const owned = sheet
    owned.count += 1
    return () => {
        owned.count -= 1
        if (owned.count === 0) {
            owned.element.remove()
            sheets.delete(target)
        }
    }
}
