import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DESKTOP_APP_HASH_TOKEN = "__COSIMO_DESKTOP_APP_HASH__";

export const WEB_HOST_ASSET_ENTRIES = Object.freeze([
    { source: "index.html", target: "index.html" },
    { source: "favicon.svg", target: "favicon.svg" },
    { source: "cosimo-web-host.js", target: "cosimo-web-host.js" },
    { source: "browser-audio-lifecycle.mjs", target: "browser-audio-lifecycle.mjs" },
    { source: "browser-patch-state.mjs", target: "browser-patch-state.mjs" },
    { source: "desktop-production-loader.js", target: "patch_gui/desktop/index.js" },
]);

/** Copies the handwritten browser host boundary into the generated Cmajor app. */
export async function copyWebHostAssets({ sourceDirectory, outputDirectory }) {
    await Promise.all(WEB_HOST_ASSET_ENTRIES.map(async ({ source, target }) => {
        const targetPath = path.join(outputDirectory, target);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        if (source !== "desktop-production-loader.js") {
            await fs.copyFile(path.join(sourceDirectory, source), targetPath);
            return;
        }

        const [loaderTemplate, desktopAppSource] = await Promise.all([
            fs.readFile(path.join(sourceDirectory, source), "utf8"),
            fs.readFile(path.join(outputDirectory, "patch_gui", "desktop", "app.js")),
        ]);
        const desktopAppFingerprint = createHash("sha256")
            .update(desktopAppSource)
            .digest("hex")
            .slice(0, 16);
        await fs.writeFile(
            targetPath,
            loaderTemplate.replaceAll(DESKTOP_APP_HASH_TOKEN, desktopAppFingerprint),
        );
    }));
}
