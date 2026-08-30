import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("T79 keyboard presentation preferences preserve responsive defaults and bound persisted geometry", async () => {
    const preferences = await loadUIModule(
        repoRoot,
        "ui/shared/keyboard-presentation-preferences.ts",
    );

    assert.deepEqual(preferences.KEYBOARD_PRESENTATION_DEFAULTS, {
        visibleNoteCount: "responsive",
        heightScale: 1,
    });
    assert.equal(
        preferences.resolveKeyboardVisibleNoteCount(
            preferences.KEYBOARD_PRESENTATION_DEFAULTS,
            18,
        ),
        18,
    );
    assert.equal(
        preferences.resolveKeyboardVisibleNoteCount(
            preferences.KEYBOARD_PRESENTATION_DEFAULTS,
            25,
        ),
        25,
    );

    for (const visibleNoteCount of [
        preferences.KEYBOARD_VISIBLE_NOTE_COUNT_MIN,
        18,
        preferences.KEYBOARD_VISIBLE_NOTE_COUNT_MAX,
    ]) {
        const value = { visibleNoteCount, heightScale: 1.23 };
        assert.deepEqual(
            preferences.parseStoredKeyboardPresentationPreferences(
                preferences.serializeKeyboardPresentationPreferences(value),
            ),
            value,
        );
    }

    assert.equal(preferences.parseStoredKeyboardPresentationPreferences(null), null);
    assert.equal(preferences.parseStoredKeyboardPresentationPreferences("not json"), null);
    assert.equal(preferences.parseStoredKeyboardPresentationPreferences("[]"), null);
    assert.deepEqual(
        preferences.parseStoredKeyboardPresentationPreferences(JSON.stringify({
            visibleNoteCount: 999,
            heightScale: 999,
        })),
        {
            visibleNoteCount: preferences.KEYBOARD_VISIBLE_NOTE_COUNT_MAX,
            heightScale: preferences.KEYBOARD_HEIGHT_SCALE_MAX,
        },
    );
    assert.deepEqual(
        preferences.parseStoredKeyboardPresentationPreferences(JSON.stringify({
            visibleNoteCount: -999,
            heightScale: -999,
        })),
        {
            visibleNoteCount: preferences.KEYBOARD_VISIBLE_NOTE_COUNT_MIN,
            heightScale: preferences.KEYBOARD_HEIGHT_SCALE_MIN,
        },
    );
    assert.deepEqual(
        preferences.parseStoredKeyboardPresentationPreferences(JSON.stringify({
            visibleNoteCount: "wide",
            heightScale: "tall",
        })),
        preferences.KEYBOARD_PRESENTATION_DEFAULTS,
    );
    assert.match(preferences.KEYBOARD_PRESENTATION_STORAGE_KEY, /preferences/u);
    assert.doesNotMatch(
        preferences.KEYBOARD_PRESENTATION_STORAGE_KEY,
        /preset|patch|sound|host|modulation/u,
    );
});

test("T79 Copy settings exports both keyboard presentation values", async () => {
    const tuning = await loadUIModule(repoRoot, "ui/shared/perf-tuning.ts");
    const copied = tuning.formatPerfTuningSettings(
        tuning.PERF_TUNING_DEFAULTS,
        {
            scale: 1.1,
            placement: "parked",
            parkedVisibility: "hidden",
        },
        {
            visibleNoteCount: 14,
            heightScale: 1.25,
        },
    );

    assert.match(copied, /\n\[Keyboard\]\nkeyboard\.visibleNoteCount: 14\nkeyboard\.heightScale: 1\.25$/u);
    assert.equal(copied.match(/keyboard\.visibleNoteCount/gu)?.length, 1);
    assert.equal(copied.match(/keyboard\.heightScale/gu)?.length, 1);
});

test("T79 sound, URL, host, Init, automation, and modulation inventories exclude keyboard presentation", async () => {
    const inventoryFiles = new Map([
        ["host and automation", [
            "cmajor/WavetableSynth.cmajor",
            "WavetableSynth.cmajorpatch",
            "WavetableSynth.iOS.cmajorpatch",
        ]],
        ["preset and sound", [
            "ui/shared/effects/effect-preset-v2.ts",
            "ui/shared/synth-hooks.ts",
        ]],
        ["shared URL", [
            "ui/shared/sound-share-envelope.ts",
            "ui/shared/sound-share-link.ts",
        ]],
        ["Init", ["ui/shared/effects/synth-init-state.ts"]],
        ["modulation", [
            "ui/shared/modulation-targets.ts",
            "ui/shared/modulation.ts",
        ]],
    ]);
    const presentationToken = /cosimo\.keyboard\.presentation|keyboardPresentation|visibleNoteCount|heightScale/u;

    for (const [inventory, relativePaths] of inventoryFiles) {
        for (const relativePath of relativePaths) {
            const source = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
            assert.doesNotMatch(
                source,
                presentationToken,
                `${inventory} inventory ${relativePath} must not own keyboard presentation.`,
            );
        }
    }

    const preferenceSource = await fs.readFile(
        path.join(repoRoot, "ui/shared/keyboard-presentation-preferences.ts"),
        "utf8",
    );
    assert.doesNotMatch(preferenceSource, /^import\s/mu);
    assert.doesNotMatch(preferenceSource, /PatchConnection|sendEventOrValue|sendStoredStateValue/u);
});
