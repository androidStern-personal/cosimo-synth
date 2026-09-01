import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadDiscovery() {
    return import(pathToFileURL(path.join(repoRoot, "kit/fx/build-effect.mjs")));
}

test("glow_gate is discovered with its product identity", async () => {
    const { effectPlugins } = await loadDiscovery();
    const plugin = effectPlugins["glow-gate"];

    assert.ok(plugin, "discovery must include glow-gate");
    assert.equal(plugin.patch, "fx/glow_gate/GlowGate.cmajorpatch");
    assert.equal(plugin.productName, "GlowGate");
    assert.deepEqual(plugin.identity, {
        ID: "dev.cosimo.glow-gate",
        name: "Glow Gate",
        manufacturer: "Cosimo",
        version: "0.1.0",
        plugin: { pluginCode: "CsGG", manufacturerCode: "Cosi" },
    });
});

test("glow_gate keeps the kit view loader conventions", async () => {
    const manifest = JSON.parse(
        await fs.readFile(path.join(repoRoot, "fx/glow_gate/GlowGate.cmajorpatch"), "utf8"),
    );

    assert.equal(manifest.view.src, "view/index.js");
    assert.equal(manifest.view.devModule, "/fx/glow_gate/view/source.ts");
    assert.equal(
        await fs.realpath(path.join(repoRoot, "fx/glow_gate/view/index.js")),
        await fs.realpath(path.join(repoRoot, "kit/ui/effects/effect-view-loader.js")),
    );

    for (const sourceFile of manifest.source)
        await fs.access(path.join(repoRoot, "fx/glow_gate", sourceFile));
});
