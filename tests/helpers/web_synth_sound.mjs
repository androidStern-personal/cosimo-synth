import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const synthPluginId = JSON.parse(await fs.readFile(path.join(repoRoot, "WavetableSynth.cmajorpatch"), "utf8")).ID;

/**
 * Loads sound values with the preset bar's Paste JSON: one recall through the
 * synth's state. Values the preset leaves out keep their current setting.
 */
export async function pasteSound(page, values) {
    // A compact layout keeps the preset bar inside the Sound actions menu.
    const presets = page.getByRole("group", { name: "Presets" });
    const soundActions = page.locator('[data-action="toggle-sound-actions"]');
    const inMenu = !await presets.isVisible();
    if (inMenu) await soundActions.click();
    await presets.getByRole("button", { name: "More", exact: true }).click();
    await presets.getByRole("button", { name: "Paste JSON", exact: true }).click();
    await presets.getByLabel("Preset JSON").fill(JSON.stringify({
        kind: "builder-kit.preset", version: 1, plugin: synthPluginId, name: "Test sound", values,
    }));
    await presets.getByRole("button", { name: "Load", exact: true }).click();
    if (inMenu && await page.locator('[data-role="sound-actions"]').isVisible()) await soundActions.click();
}

/** Sets synth parameters through the synth's state and waits until the engine reports them. */
export async function setSoundParameters(page, parameters) {
    await pasteSound(page, parameters);
    await page.waitForFunction((expected) => {
        const current = globalThis.__COSIMO_WEB_POC__.getSnapshot().parameterValues;
        // The engine keeps parameters as 32-bit floats.
        return Object.entries(expected).every(([endpointID, value]) => (
            Math.abs(current[endpointID] - value) <= Math.abs(value) * 1e-6
        ));
    }, parameters, { timeout: 10_000 });
}
