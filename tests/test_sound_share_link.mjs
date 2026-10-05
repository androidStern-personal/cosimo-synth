import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const [share, kitPresets, state, modulation] = await Promise.all([
    loadUIModule(repoRoot, "ui/shared/sound-share-link.ts"),
    loadUIModule(repoRoot, "kit/ui/presets.ts"),
    loadUIModule(repoRoot, "ui/shared/synth-plugin-state.ts"),
    loadUIModule(repoRoot, "ui/shared/modulation.ts"),
]);

async function deflateFragment(text, version = share.SOUND_SHARE_FRAGMENT_VERSION) {
    const bytes = new TextEncoder().encode(text);
    const compressed = new Uint8Array(await new Response(
        new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer());
    return `#p=${version}.${Buffer.from(compressed).toString("base64url")}`;
}

/** Text of exactly `byteLength` UTF-8 bytes. */
function textOfLength(byteLength) {
    return "x".repeat(byteLength);
}

const soundArbitrary = fc.record({
    name: fc.string({ minLength: 1, maxLength: 24 }).filter((name) => name.trim().length > 0),
    oscAWavetableSelect: fc.integer({ min: 0, max: 238 }),
    filterMix: fc.integer({ min: 0, max: 1_000 }).map((value) => value / 1_000),
    ampAttack: fc.integer({ min: 1, max: 10_000 }).map((value) => value / 1_000),
    globalTune: fc.integer({ min: -2_400, max: 2_400 }).map((value) => value / 100),
    polishOutputTrimDb: fc.integer({ min: -2_400, max: 1_200 }).map((value) => value / 100),
    polishEnhancerBypass: fc.integer({ min: 0, max: 1 }),
    mseg1Rate: fc.integer({ min: 0, max: 2_000 }).map((value) => value / 1_000),
});

test("random synth preset files survive deflate/base64url round trips exactly", async () => {
    const defaultModulation = modulation.serializeModulationState(modulation.createDefaultModulationState());
    await fc.assert(fc.asyncProperty(soundArbitrary, async ({ name, ...parameters }) => {
        const text = kitPresets.presetFileText(share.SYNTH_PLUGIN_ID, {
            name,
            values: { ...parameters, "modulation.v6": defaultModulation },
        });
        const fragment = await share.encodeSoundShareFragment(text);
        assert.equal(fragment.ok, true, fragment.ok ? undefined : fragment.error.message);
        assert.match(fragment.value, /^#p=3\.[A-Za-z0-9_-]+$/);
        const decoded = await share.decodeSoundShareFragment(fragment.value);
        assert.equal(decoded.ok, true, decoded.ok ? undefined : decoded.error.message);
        assert.equal(decoded.value, text);
        const parsed = kitPresets.parsePresetFile(decoded.value, share.SYNTH_PLUGIN_ID, state.synthPluginState);
        assert.equal(parsed.kind, "ok", parsed.message);
        assert.deepEqual(parsed.value.values, { ...parameters, "modulation.v6": defaultModulation });
    }), { numRuns: 40 });
});

test("malformed, corrupt, oversized, and unsupported fragments are rejected as values", async () => {
    const cases = [
        ["#p=", "InvalidFragment"],
        ["#p=3.!", "InvalidFragment"],
        ["#p=3.AAAA", "DecompressionFailed"],
        ["#p=2.AAAA", "UnsupportedVersion"],
        ["#p=4.AAAA", "UnsupportedVersion"],
        [`#p=3.${"A".repeat(128_001)}`, "PayloadTooLarge"],
    ];
    for (const [fragment, expectedTag] of cases) {
        const result = await share.decodeSoundShareFragment(fragment);
        assert.equal(result.ok, false, fragment.slice(0, 24));
        assert.equal(result.error._tag, expectedTag, fragment.slice(0, 24));
    }
    const old = await share.decodeSoundShareFragment("#p=2.AAAA");
    assert.equal(old.error.message, 'Shared sound link version "2" is not supported.');
    assert.deepEqual(await share.decodeSoundShareFragment("#section=voice"), { ok: true, value: null });
});

test("a link whose text is not a synth preset file is refused by the preset reader", async () => {
    const notJson = await share.decodeSoundShareFragment(await deflateFragment("not-json"));
    assert.equal(notJson.ok, true, "the link layer carries text; the preset reader judges it");
    const parsed = kitPresets.parsePresetFile(notJson.value, share.SYNTH_PLUGIN_ID, state.synthPluginState);
    assert.equal(parsed.kind, "error");
    assert.match(parsed.message, /not valid JSON/);
});

test("measured URL policy has exact warning and refusal boundaries", () => {
    assert.equal(share.classifySoundShareURLLength(8_000), "normal");
    assert.equal(share.classifySoundShareURLLength(8_001), "warning");
    assert.equal(share.classifySoundShareURLLength(128_000), "warning");
    assert.equal(share.classifySoundShareURLLength(128_001), "refused");
});

test("the decompressed cap accepts its exact size and refuses one byte over", async () => {
    assert.equal(share.SOUND_SHARE_DECOMPRESSED_MAX_BYTES, 3_250_000);
    const atCap = textOfLength(3_250_000);
    const accepted = await share.encodeSoundShareFragment(atCap);
    assert.equal(accepted.ok, true, accepted.ok ? undefined : accepted.error.message);
    const restored = await share.decodeSoundShareFragment(accepted.value);
    assert.equal(restored.ok, true, restored.ok ? undefined : restored.error.message);
    assert.equal(restored.value, atCap);

    const overCap = textOfLength(3_250_001);
    const refusedEncode = await share.encodeSoundShareFragment(overCap);
    assert.equal(refusedEncode.ok, false);
    assert.equal(refusedEncode.error._tag, "PayloadTooLarge");
    const refusedDecode = await share.decodeSoundShareFragment(await deflateFragment(overCap));
    assert.equal(refusedDecode.ok, false);
    assert.equal(refusedDecode.error._tag, "PayloadTooLarge");
});

test("links are made only from browser pages and keep the page address", async () => {
    const text = kitPresets.presetFileText(share.SYNTH_PLUGIN_ID, { name: "Plain", values: { filterMix: 0.5 } });
    const made = await share.createSoundShareURL(text, "https://cosimo.example/synth/?panel=fx#old");
    assert.equal(made.ok, true, made.ok ? undefined : made.error.message);
    const url = new URL(made.value.url);
    assert.equal(`${url.origin}${url.pathname}${url.search}`, "https://cosimo.example/synth/?panel=fx");
    assert.equal(made.value.lengthClass, "normal");
    const decoded = await share.decodeSoundShareFragment(url.hash);
    assert.equal(decoded.value, text);

    const fileURL = await share.createSoundShareURL(text, "file:///synth/index.html");
    assert.equal(fileURL.ok, false);
    assert.equal(fileURL.error._tag, "InvalidURL");
});
