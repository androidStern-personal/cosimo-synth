/**
 * Write a same-origin iframe's document so that it loads one module with the
 * page's web storage shadowed. A written document takes this page's URL, so
 * the product code inside resolves the synth's web root as the page does; a
 * srcdoc document's URL, about:srcdoc, resolves nothing. The iframe must
 * already be in the page.
 */
export function writeFrameDocument(iframe: HTMLIFrameElement, { head, moduleScript }: {
    readonly head: string;
    readonly moduleScript: string;
}) {
    const frameDocument = iframe.contentDocument;
    if (frameDocument === null) throw new Error("The frame has no document; add it to the page first.");
    frameDocument.open();
    frameDocument.write(`<!doctype html>
<html><head><meta charset="utf-8">${head}</head>
<body><script type="module">
// The frame shares this page's web storage. Shadow both stores with in-memory
// stubs before product code loads, so a stale shell or rail-dock state cannot
// leak in and the scripted navigation cannot change the user's real session.
for (const storageName of ["sessionStorage", "localStorage"]) {
    const entries = new Map();
    Object.defineProperty(window, storageName, {
        configurable: true,
        value: {
            get length() { return entries.size; },
            key: (index) => [...entries.keys()][index] ?? null,
            getItem: (key) => (entries.has(String(key)) ? entries.get(String(key)) : null),
            setItem: (key, value) => { entries.set(String(key), String(value)); },
            removeItem: (key) => { entries.delete(String(key)); },
            clear: () => { entries.clear(); },
        },
    });
}
${moduleScript}
</script></body></html>`);
    frameDocument.close();
}
