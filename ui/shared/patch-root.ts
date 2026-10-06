/**
 * The synth's patch folder, where its resources and patch_gui/ live. A page is
 * served from it; without a page this module runs in a bundle in patch_gui/,
 * one folder below it.
 */
export function synthPatchRoot() {
    const page = globalThis.location?.href;
    if (typeof page === "string" && page.length > 0) return new URL("/", page);
    return new URL("../", import.meta.url);
}
