import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const catalogPromise = loadUIModule(repoRoot, "ui/shared/target-descriptor.ts");

/** The frozen 42-target surface (the prototype's locked instrument model). */
const EXPECTED_TARGET_IDS = [
    "filter.cutoff", "filter.resonance", "filter.drive",
    "drive.amount", "drive.tone", "drive.mix",
    "ott.depth", "ott.time", "ott.mix",
    "chorus.rate", "chorus.depth", "chorus.delay", "chorus.mix",
    "flanger.rate", "flanger.depth", "flanger.feedback", "flanger.mix",
    "phaser.rate", "phaser.depth", "phaser.frequency", "phaser.feedback", "phaser.phase", "phaser.mix",
    "delay.time", "delay.feedback", "delay.filter", "delay.mix",
    "reverb.size", "reverb.decay", "reverb.damping", "reverb.mix",
    "wavetable.index", "wavetable.warp", "wavetable.unison", "wavetable.tune",
    "voice-filter.cutoff", "voice-filter.resonance", "voice-filter.drive",
    "amp-pan.level", "amp-pan.pan", "amp-pan.attack", "amp-pan.release",
];

/**
 * Binding policy (roadmap Phase 1): rack targets stay honestly unbacked until
 * the rack DSP lands; voice targets bind to real endpoints where one exists.
 * [tag, endpointId-or-reason, articulationParameterId]
 */
const EXPECTED_VOICE_BINDINGS = {
    "wavetable.index": ["endpoint", "wavetablePosition", "framePosition"],
    "wavetable.warp": ["endpoint", "warpAmount", "warpAmount"],
    "wavetable.unison": ["endpoint", "unisonDetune", "unisonDetune"],
    "wavetable.tune": ["unbacked", "no-endpoint", null],
    "voice-filter.cutoff": ["endpoint", "filterCutoff", "filterCutoffHz"],
    "voice-filter.resonance": ["endpoint", "filterQ", "filterQ"],
    "voice-filter.drive": ["unbacked", "no-endpoint", null],
    "amp-pan.level": ["unbacked", "no-endpoint", null],
    "amp-pan.pan": ["endpoint", "pan", "pan"],
    "amp-pan.attack": ["unbacked", "no-endpoint", null],
    "amp-pan.release": ["unbacked", "no-endpoint", null],
};

/** Engine-unit extremes for every bound endpoint (from the cmajor annotations). */
const EXPECTED_ENGINE_EXTREMES = {
    "wavetable.index": [0, 1],
    "wavetable.warp": [0, 1],
    "wavetable.unison": [0, 1],
    "voice-filter.cutoff": [20, 20000],
    "voice-filter.resonance": [0.1, 20],
    "amp-pan.pan": [-1, 1],
};

const EXPECTED_QUICK = new Set([
    "filter.cutoff", "drive.amount", "ott.depth", "chorus.depth", "flanger.rate",
    "phaser.frequency", "delay.time", "reverb.size",
    "wavetable.index", "voice-filter.cutoff", "amp-pan.level",
]);

const EXPECTED_COMPOUND = new Set(["chorus.rate", "flanger.rate", "phaser.rate", "delay.time"]);

test("the catalog covers exactly the frozen 42-target surface", async () => {
    const catalog = await catalogPromise;
    const all = catalog.allTargetDescriptors();
    assert.deepEqual(all.map((d) => d.targetId).sort(), [...EXPECTED_TARGET_IDS].sort());
    for (const descriptor of all) {
        const [moduleId] = descriptor.targetId.split(".");
        assert.equal(descriptor.moduleId, moduleId, descriptor.targetId);
        assert.equal(descriptor.workspace, ["wavetable", "voice-filter", "amp-pan"].includes(moduleId) ? "voice" : "effects");
        assert.equal(descriptor.defaultValue >= 0 && descriptor.defaultValue <= 1, true, `${descriptor.targetId} default`);
        assert.equal(descriptor.initialValue >= 0 && descriptor.initialValue <= 1, true, `${descriptor.targetId} initial`);
        assert.equal(descriptor.isQuick, EXPECTED_QUICK.has(descriptor.targetId), `${descriptor.targetId} quick`);
        assert.equal(descriptor.compound, EXPECTED_COMPOUND.has(descriptor.targetId) ? "sync" : null, `${descriptor.targetId} compound`);
    }
});

test("binding policy: rack unbacked, voice bound to real endpoints, gaps explicit", async () => {
    const catalog = await catalogPromise;
    for (const descriptor of catalog.allTargetDescriptors()) {
        const expected = EXPECTED_VOICE_BINDINGS[descriptor.targetId];
        if (expected === undefined) {
            assert.equal(descriptor.workspace, "effects", descriptor.targetId);
            assert.equal(descriptor.binding._tag, "unbacked", descriptor.targetId);
            assert.equal(descriptor.binding.reason, "rack-dsp", descriptor.targetId);
            assert.equal(descriptor.articulationParameterId, null, descriptor.targetId);
            continue;
        }
        const [tag, detail, articulationParameterId] = expected;
        assert.equal(descriptor.binding._tag, tag, descriptor.targetId);
        if (tag === "endpoint") {
            assert.equal(descriptor.binding.endpointId, detail, descriptor.targetId);
        } else {
            assert.equal(descriptor.binding.reason, detail, descriptor.targetId);
        }
        assert.equal(descriptor.articulationParameterId, articulationParameterId, descriptor.targetId);
    }
});

test("bound conversions roundtrip and hit the engine extremes exactly", async () => {
    const catalog = await catalogPromise;
    for (const descriptor of catalog.allTargetDescriptors()) {
        if (descriptor.binding._tag !== "endpoint") continue;
        const { toEngine, fromEngine } = descriptor.binding;
        const [engineMin, engineMax] = EXPECTED_ENGINE_EXTREMES[descriptor.targetId];
        assert.ok(Math.abs(toEngine(0) - engineMin) < 1e-9, `${descriptor.targetId} min`);
        assert.ok(Math.abs(toEngine(1) - engineMax) < 1e-9, `${descriptor.targetId} max`);
        fc.assert(
            fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (value) => {
                const engine = toEngine(value);
                assert.equal(engine >= Math.min(engineMin, engineMax) - 1e-9, true);
                assert.equal(engine <= Math.max(engineMin, engineMax) + 1e-9, true);
                assert.ok(Math.abs(fromEngine(engine) - value) < 1e-6, `${descriptor.targetId} roundtrip at ${value}`);
            }),
        );
    }
});

test("modAmount specs follow the locked per-unit policy", async () => {
    const catalog = await catalogPromise;
    for (const descriptor of catalog.allTargetDescriptors()) {
        const spec = descriptor.modAmount;
        if (descriptor.format.kind === "frequency") {
            assert.deepEqual(spec, { min: -6, max: 6, unit: "oct", digits: 1 }, descriptor.targetId);
        } else if (descriptor.format.kind === "semitone") {
            assert.deepEqual(spec, { min: -48, max: 48, unit: "st", digits: 0 }, descriptor.targetId);
        } else if (descriptor.targetId === "amp-pan.level") {
            assert.deepEqual(spec, { min: -48, max: 6, unit: "dB", digits: 0 }, descriptor.targetId);
        } else if (descriptor.targetId === "amp-pan.pan") {
            assert.deepEqual(spec, { min: -100, max: 100, unit: "pan", digits: 0 }, descriptor.targetId);
        } else {
            assert.deepEqual(spec, { min: -100, max: 100, unit: "%", digits: 0 }, descriptor.targetId);
        }
    }
});

test("formatTargetValue reproduces the locked display strings on the normalized scale", async () => {
    const catalog = await catalogPromise;
    const byId = new Map(catalog.allTargetDescriptors().map((d) => [d.targetId, d]));
    const fmt = (targetId, value) => catalog.formatTargetValue(byId.get(targetId), value);

    assert.equal(fmt("filter.resonance", 0.64), "64%");
    assert.equal(fmt("filter.cutoff", 0.62), "1.45 kHz");
    assert.equal(fmt("filter.cutoff", 0.2), "80 Hz");
    assert.equal(fmt("chorus.rate", 0), "0.05 Hz");
    assert.equal(fmt("chorus.rate", 1), "10.00 Hz");
    assert.equal(fmt("phaser.phase", 0.25), "90°");
    assert.equal(fmt("amp-pan.pan", 0.75), "50%");
    assert.equal(fmt("amp-pan.pan", 0.25), "-50%");
    assert.equal(fmt("amp-pan.pan", 0.5), "0%");
    assert.equal(fmt("wavetable.tune", 0.5), "+0 st");
    assert.equal(fmt("wavetable.tune", 0.75), "+13 st");
    assert.equal(fmt("wavetable.tune", 0.2), "-15 st");
});

test("parseTargetId accepts exactly the catalog surface", async () => {
    const catalog = await catalogPromise;
    for (const targetId of EXPECTED_TARGET_IDS) {
        const parsed = catalog.parseTargetId(targetId);
        assert.equal(parsed._tag, "ok", targetId);
        assert.equal(catalog.getTargetDescriptor(parsed.value).targetId, targetId);
    }
    for (const bad of ["", "wavetable", "wavetable.ghost", "chorusMix", "Filter.Cutoff"]) {
        const parsed = catalog.parseTargetId(bad);
        assert.equal(parsed._tag, "err", bad);
        assert.equal(parsed.error._tag, "UnknownTarget", bad);
    }
});

test("the shared catalog transcribes the prototype catalog exactly (until catalog.js retires)", async () => {
    const catalog = await catalogPromise;
    const prototypeCatalog = await loadUIModule(
        repoRoot,
        "prototypes/mobile-sound-design-wireframe/src/domain/catalog.js",
    );
    for (const descriptor of catalog.allTargetDescriptors()) {
        const legacy = prototypeCatalog.TARGETS[descriptor.targetId];
        assert.notEqual(legacy, undefined, descriptor.targetId);
        assert.equal(descriptor.label, legacy.label, `${descriptor.targetId} label`);
        assert.ok(Math.abs(descriptor.initialValue - legacy.initial / 100) < 1e-12, `${descriptor.targetId} initial`);
        assert.ok(Math.abs(descriptor.defaultValue - legacy.defaultValue / 100) < 1e-12, `${descriptor.targetId} default`);
        const legacyFormat = legacy.format ?? "percent";
        const kindMap = {
            percent: "percent", frequency: "frequency", rate: "rate",
            phase: "phase", signed: "signed-percent", semitone: "semitone",
        };
        assert.equal(descriptor.format.kind, kindMap[legacyFormat], `${descriptor.targetId} format`);
    }
});
