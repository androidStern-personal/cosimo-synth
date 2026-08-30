import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("every selectable SeqFX identity resolves to a vendored Fontaudio SVG", async () => {
    const definitions = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-effect-definitions.ts");

    for (const effectType of definitions.SEQFX_SELECTABLE_EFFECT_IDS) {
        const definition = definitions.getSeqFxEffectDefinition(effectType);
        assert.match(definition.fontaudioIcon, /^fad-[A-Za-z0-9-]+$/);

        const assetPath = path.join(
            repoRoot,
            "ui/assets/fontaudio",
            `${definition.fontaudioIcon}.svg`,
        );
        const asset = await readFile(assetPath, "utf8");
        assert.match(asset, /^<svg\b/);
        assert.match(asset, /<path\b|<g\b/);
    }
});

test("the shared credit covers SeqFX's vendored Fontaudio identity assets", async () => {
    const credits = await readFile(path.join(repoRoot, "CREDITS.md"), "utf8");
    assert.match(credits, /fontaudio.*CC BY 4\.0/i);
});
