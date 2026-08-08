import fs from "node:fs/promises";
import path from "node:path";

export const WEB_HOST_ASSET_ENTRIES = Object.freeze([
    { source: "index.html", target: "index.html" },
    { source: "favicon.svg", target: "favicon.svg" },
    { source: "cosimo-web-host.js", target: "cosimo-web-host.js" },
    { source: "browser-patch-state.mjs", target: "browser-patch-state.mjs" },
    { source: "desktop-production-loader.js", target: "patch_gui/desktop/index.js" },
]);

/** Copies the handwritten browser host boundary into the generated Cmajor app. */
export async function copyWebHostAssets({ sourceDirectory, outputDirectory }) {
    await Promise.all(WEB_HOST_ASSET_ENTRIES.map(async ({ source, target }) => {
        const targetPath = path.join(outputDirectory, target);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(path.join(sourceDirectory, source), targetPath);
    }));
}
