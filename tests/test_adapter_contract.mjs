import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

// patch-connection-mock's module graph registers a custom element at import
// time; a minimal stub keeps the bridge factory loadable under plain node.
if (typeof globalThis.HTMLElement === "undefined") {
    globalThis.HTMLElement = class HTMLElementStub {
        attachShadow() {
            this.shadowRoot = { innerHTML: "" };
            return this.shadowRoot;
        }
    };
}

const repoRoot = path.resolve(import.meta.dirname, "..");

const targetDescriptorPromise = loadUIModule(repoRoot, "ui/shared/target-descriptor.ts");
const mockFactoryPromise = loadUIModule(
    repoRoot,
    "prototypes/mobile-sound-design-wireframe/src/adapters/createMockCosimoAdapter.ts",
);
const fixturesPromise = loadUIModule(
    repoRoot,
    "prototypes/mobile-sound-design-wireframe/src/domain/fixtures.js",
);
const bridgeFactoryPromise = loadUIModule(repoRoot, "ui/shared/cosimo-bridge-adapter.ts");
const mockConnectionPromise = loadUIModule(repoRoot, "ui/shared/patch-connection-mock.ts");
const modulationPromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");
const laneStateV2Promise = loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");

function expectOkValue(result, label) {
    assert.equal(result._tag, "ok", `${label}: ${result._tag === "err" ? result.error.message : ""}`);
    return result.value;
}

/**
 * Build the shared demo fixture ENTIRELY through port commands, on top of the
 * product-initial "new patch" both adapters boot into. Fixture parity across
 * mock and bridge holds by construction — the same commands run on both.
 */
function seedDemoPatch(adapter) {
    const { commands } = adapter;
    const a = expectOkValue(commands.addArticulation(), "seed articulation a");
    const b = expectOkValue(commands.addArticulation(), "seed articulation b");
    const c = expectOkValue(commands.addArticulation(), "seed articulation c");
    // Defaults: keys 30/31/32, vel and chain [0,127]. Partition vel and chain
    // deterministically under the flush-clamp law (order matters).
    commands.setArticulationRange(a, "vel", "max", 63);
    commands.setArticulationRange(b, "vel", "min", 64);
    commands.setArticulationRange(c, "vel", "min", 110);
    commands.setArticulationRange(b, "vel", "max", 109);
    commands.setArticulationRange(a, "chain", "max", 41);
    commands.setArticulationRange(b, "chain", "min", 42);
    commands.setArticulationRange(c, "chain", "min", 90);
    commands.setArticulationRange(b, "chain", "max", 89);
    expectOkValue(commands.addMapping({ targetId: "oscA.warpAmount", sourceId: "envelope-1" }), "seed warp mapping");
    commands.setMappingAmount("oscA.warpAmount::envelope-1", 40, { _tag: "patchBase" });
    expectOkValue(commands.addMapping({ targetId: "oscA.pitchSemitones", sourceId: "mseg-1" }), "seed tune mapping");
    expectOkValue(commands.addMapping({ targetId: "phaser.phaserDepth", sourceId: "macro-1" }), "seed rack mapping");
    return { articulationIds: [a, b, c] };
}

/**
 * The behavioral contract every adapter must satisfy. The bridge runs this
 * exact suite — the factories differ, the assertions never do.
 */
function contractSuite(adapterName, makeAdapter) {
    const t = (title, fn) => test(`[${adapterName}] ${title}`, async () => {
        const adapter = await makeAdapter();
        seedDemoPatch(adapter);
        return fn(adapter);
    });

    // ── Snapshot & subscription mechanics ─────────────────────────────────

    t("snapshot reference is stable until a command changes state", (adapter) => {
        const first = adapter.getSnapshot();
        assert.equal(adapter.getSnapshot(), first);
        adapter.commands.setRepeatEnabled(true);
        const second = adapter.getSnapshot();
        assert.notEqual(second, first);
        assert.equal(adapter.getSnapshot(), second);
    });

    t("subscribers fire once per change and stop after unsubscribe", (adapter) => {
        let calls = 0;
        const unsubscribe = adapter.subscribe(() => { calls += 1; });
        adapter.commands.setLatchEnabled(true);
        assert.equal(calls, 1);
        adapter.commands.setLatchEnabled(false);
        assert.equal(calls, 2);
        unsubscribe();
        adapter.commands.setLatchEnabled(true);
        assert.equal(calls, 2);
    });

    t("port reads survive detachment from the adapter object", (adapter) => {
        // useSyncExternalStore passes getSnapshot/subscribe by value — an
        // implementation relying on `this` via property access breaks only
        // in React, so the contract pins it here.
        const { getSnapshot, subscribe } = adapter;
        const before = getSnapshot();
        const unsubscribe = subscribe(() => {});
        unsubscribe();
        assert.equal(getSnapshot(), before);
    });

    t("the connection reports ready", (adapter) => {
        assert.deepEqual(adapter.getSnapshot().connection, { _tag: "ready" });
    });

    t("every parameter value is on the normalized 0..1 scale", (adapter) => {
        for (const [targetId, value] of Object.entries(adapter.getSnapshot().patch.parameterValues)) {
            assert.equal(value >= 0 && value <= 1, true, `${targetId} = ${value}`);
        }
    });

    // ── Parameters & edit layers ──────────────────────────────────────────

    t("patch-base edits land in parameterValues and only there", (adapter) => {
        adapter.commands.setParameter({ targetId: "oscA.warpAmount", value: 0.9, layer: { _tag: "patchBase" } });
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.parameterValues["oscA.warpAmount"], 0.9);
        for (const overrides of Object.values(patch.articulationOverrides)) {
            assert.equal(Object.hasOwn(overrides, "oscA.warpAmount"), false);
        }
    });

    t("articulation-layer edits write the override and never move the base", (adapter) => {
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        const baseBefore = adapter.getSnapshot().patch.parameterValues["voice-filter.cutoff"];
        adapter.commands.setParameter({
            targetId: "voice-filter.cutoff",
            value: 0.77,
            layer: { _tag: "articulationOverride", articulationId },
        });
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.articulationOverrides[articulationId]["voice-filter.cutoff"], 0.77);
        assert.equal(patch.parameterValues["voice-filter.cutoff"], baseBefore);
    });

    // ── Mappings ──────────────────────────────────────────────────────────

    t("addMapping creates one enabled unipolar mapping with the default amount", (adapter) => {
        const result = adapter.commands.addMapping({ targetId: "phaser.phaserDepth", sourceId: "velocity" });
        assert.equal(result._tag, "ok");
        const mapping = adapter.getSnapshot().patch.mappings.find((m) => m.id === result.value);
        assert.equal(mapping.targetId, "phaser.phaserDepth");
        assert.equal(mapping.sourceId, "velocity");
        assert.equal(mapping.polarity, "Unipolar");
        assert.equal(mapping.enabled, true);
        assert.equal(mapping.amount, 0.25, "default = 25% of the parameter span");
    });

    t("a second mapping for the same pair is MappingAlreadyExists", (adapter) => {
        const first = adapter.commands.addMapping({ targetId: "phaser.phaserDepth", sourceId: "velocity" });
        assert.equal(first._tag, "ok");
        const second = adapter.commands.addMapping({ targetId: "phaser.phaserDepth", sourceId: "velocity" });
        assert.equal(second._tag, "err");
        assert.equal(second.error._tag, "MappingAlreadyExists");
    });

    t("controls without an engine modulation target cannot create mappings", (adapter) => {
        const before = adapter.getSnapshot().patch.mappings;
        const result = adapter.commands.addMapping({
            targetId: "filter.globalFilterMode",
            sourceId: "mseg-1",
        });

        assert.equal(result._tag, "err");
        assert.equal(result.error._tag, "TargetNotModulatable");
        assert.equal(result.error.targetId, "filter.globalFilterMode");
        assert.deepEqual(adapter.getSnapshot().patch.mappings, before);
    });

    t("more than 100 unique mappings are accepted", async (adapter) => {
        const { allTargetDescriptors } = await targetDescriptorPromise;
        const snapshot = adapter.getSnapshot();
        const sources = snapshot.patch.sources.map((source) => source.id);
        const targets = allTargetDescriptors()
            .filter((descriptor) => descriptor.modulationTargetKind !== null)
            .map((descriptor) => descriptor.targetId);
        const initialCount = snapshot.patch.mappings.length;
        let added = 0;
        outer: for (const targetId of targets) {
            for (const sourceId of sources) {
                const result = adapter.commands.addMapping({ targetId, sourceId });
                if (result._tag === "ok") {
                    added += 1;
                    if (added === 101) {
                        break outer;
                    }
                }
            }
        }
        assert.equal(added, 101);
        assert.equal(adapter.getSnapshot().patch.mappings.length, initialCount + 101);
    });

    t("the complete 1484-pair product domain is reachable", async (adapter) => {
        const { allTargetDescriptors } = await targetDescriptorPromise;
        for (const sourceType of ["mseg", "envelope", "macro"]) {
            while (adapter.commands.createSource(sourceType)._tag === "ok") {
                // Fill every declared source slot.
            }
        }

        const sources = adapter.getSnapshot().patch.sources.map((source) => source.id);
        const targets = allTargetDescriptors()
            .filter((descriptor) => descriptor.modulationTargetKind !== null)
            .map((descriptor) => descriptor.targetId);
        assert.equal(sources.length, 14);
        assert.equal(targets.length, 106);

        for (const targetId of targets) {
            for (const sourceId of sources) {
                const result = adapter.commands.addMapping({ targetId, sourceId });
                if (result._tag === "err") {
                    assert.equal(result.error._tag, "MappingAlreadyExists");
                }
            }
        }

        assert.equal(adapter.getSnapshot().patch.mappings.length, 1484);
    });

    t("mapping setters are reflected verbatim", (adapter) => {
        const mappingId = adapter.getSnapshot().patch.mappings[0].id;
        adapter.commands.setMappingEnabled(mappingId, false);
        adapter.commands.setMappingPolarity(mappingId, "Bipolar");
        const mapping = adapter.getSnapshot().patch.mappings.find((m) => m.id === mappingId);
        assert.equal(mapping.enabled, false);
        assert.equal(mapping.polarity, "Bipolar");
    });

    t("setMappingAmount respects the edit layer", (adapter) => {
        const mappingId = adapter.getSnapshot().patch.mappings[0].id;
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        adapter.commands.setMappingAmount(mappingId, 40, { _tag: "patchBase" });
        assert.equal(adapter.getSnapshot().patch.mappings.find((m) => m.id === mappingId).amount, 40);
        adapter.commands.setMappingAmount(mappingId, 80, { _tag: "articulationOverride", articulationId });
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.mappings.find((m) => m.id === mappingId).amount, 40, "base amount must not move");
        assert.equal(patch.articulationMappingAmounts[articulationId][mappingId], 80);
    });

    t("global rack mappings never create inaudible per-note amount overrides", (adapter) => {
        const mapping = adapter.getSnapshot().patch.mappings.find((candidate) => (
            candidate.targetId === "phaser.phaserDepth" && candidate.sourceId === "macro-1"
        ));
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        const baseAmount = mapping.amount;

        adapter.commands.setMappingAmount(
            mapping.id,
            91,
            { _tag: "articulationOverride", articulationId },
        );

        const { patch } = adapter.getSnapshot();
        assert.equal(patch.mappings.find((candidate) => candidate.id === mapping.id).amount, baseAmount);
        assert.equal(
            Object.hasOwn(patch.articulationMappingAmounts[articulationId] ?? {}, mapping.id),
            false,
        );
    });

    t("removeMapping prunes the mapping and every articulation amount override for it", (adapter) => {
        const mappingId = adapter.getSnapshot().patch.mappings[0].id;
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        adapter.commands.setMappingAmount(mappingId, 66, { _tag: "articulationOverride", articulationId });
        adapter.commands.removeMapping(mappingId);
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.mappings.some((m) => m.id === mappingId), false);
        for (const amounts of Object.values(patch.articulationMappingAmounts)) {
            assert.equal(Object.hasOwn(amounts, mappingId), false, "orphaned amount override");
        }
    });

    // ── Sources ───────────────────────────────────────────────────────────

    t("createSource fills the lowest free slot per type and exhausts at the limit", (adapter) => {
        const created = [];
        for (;;) {
            const result = adapter.commands.createSource("envelope");
            if (result._tag === "err") {
                assert.equal(result.error._tag, "SourceSlotsExhausted");
                assert.equal(result.error.sourceType, "envelope");
                break;
            }
            created.push(result.value);
        }
        const envelopeSlots = adapter.getSnapshot().patch.sources
            .filter((source) => String(source.id).startsWith("envelope-"))
            .map((source) => source.slot)
            .sort();
        assert.deepEqual(envelopeSlots, [1, 2, 3], "three envelope slots, no gaps");
        assert.equal(created.length, 2, "new patch starts with envelope-1 only");
    });

    t("deleteSource removes its mappings; undoDeleteSource restores both", (adapter) => {
        const sourceId = "envelope-1";
        adapter.commands.setEnvelope(sourceId, {
            name: "Undo Env", attackSeconds: 0.47, decaySeconds: 0.36, sustain: 0.73, releaseSeconds: 1.2,
        });
        const before = adapter.getSnapshot();
        const mappingsBefore = before.patch.mappings.filter((m) => m.sourceId === sourceId);
        assert.equal(mappingsBefore.length > 0, true, "fixture must map envelope-1 somewhere");
        adapter.commands.deleteSource(sourceId);
        const afterDelete = adapter.getSnapshot().patch;
        assert.equal(afterDelete.sources.some((source) => source.id === sourceId), false);
        assert.equal(afterDelete.mappings.some((m) => m.sourceId === sourceId), false);
        adapter.commands.undoDeleteSource();
        const afterUndo = adapter.getSnapshot().patch;
        assert.equal(afterUndo.sources.some((source) => source.id === sourceId), true);
        assert.deepEqual(
            afterUndo.mappings.filter((m) => m.sourceId === sourceId).map((m) => m.id).sort(),
            mappingsBefore.map((m) => m.id).sort(),
        );
        const restoredEnvelope = afterUndo.sources.find((source) => source.id === sourceId)?.state.envelope;
        assert.equal(restoredEnvelope?.name, "Undo Env");
        for (const [field, expected] of Object.entries({
            attackSeconds: 0.47,
            decaySeconds: 0.36,
            sustain: 0.73,
            releaseSeconds: 1.2,
        })) {
            assert.ok(Math.abs(restoredEnvelope[field] - expected) < 1e-12, `${field} restored`);
        }
    });

    t("macro value and name commands are reflected in the source state", (adapter) => {
        adapter.commands.setMacroValue("macro-1", 0.31);
        adapter.commands.renameMacro("macro-1", "Shimmer");
        const macro = adapter.getSnapshot().patch.sources.find((source) => source.id === "macro-1");
        assert.equal(macro.state._tag, "macro");
        assert.equal(macro.state.value, 0.31);
        assert.equal(macro.state.name, "Shimmer");
    });

    t("fixed performance sources and Amp Envelope are permanent", (adapter) => {
        const { sources } = adapter.getSnapshot().patch;
        for (const id of ["velocity", "pressure", "slide"]) {
            const fixed = sources.find((source) => source.id === id);
            assert.equal(fixed.type, "fixed");
            assert.equal(fixed.state._tag, "fixed");
            adapter.commands.deleteSource(id);
            assert.equal(
                adapter.getSnapshot().patch.sources.some((source) => source.id === id),
                true,
                `${id} must survive deleteSource`,
            );
        }
        const ampEnvelope = sources.find((source) => source.id === "amp-envelope");
        assert.equal(ampEnvelope.type, "envelope");
        assert.equal(ampEnvelope.state._tag, "envelope");
        assert.equal(
            adapter.getSnapshot().patch.mappings.some((mapping) => mapping.sourceId === "amp-envelope"),
            false,
            "the permanent amplitude job must not consume a user mapping row",
        );
        const mappingResult = adapter.commands.addMapping({
            targetId: "voice-filter.cutoff",
            sourceId: "amp-envelope",
        });
        assert.equal(mappingResult._tag, "ok");
        adapter.commands.setEnvelope("amp-envelope", {
            name: "Ignored Rename",
            attackSeconds: 0.43,
            decaySeconds: 0.67,
            sustain: 0.38,
            releaseSeconds: 2.4,
        });
        const editedAmpEnvelope = adapter.getSnapshot().patch.sources
            .find((source) => source.id === "amp-envelope")?.state.envelope;
        assert.deepEqual(editedAmpEnvelope, {
            name: "Amp Envelope",
            attackSeconds: 0.43,
            decaySeconds: 0.67,
            sustain: 0.38,
            releaseSeconds: 2.4,
        });
        adapter.commands.setEnvelope("amp-envelope", {
            ...editedAmpEnvelope,
            releaseSeconds: 0.001,
        });
        assert.equal(
            adapter.getSnapshot().patch.sources
                .find((source) => source.id === "amp-envelope")?.state.envelope.releaseSeconds,
            0.005,
            "Amp Release keeps its established public minimum",
        );
        adapter.commands.deleteSource("amp-envelope");
        assert.equal(
            adapter.getSnapshot().patch.sources.some((source) => source.id === "amp-envelope"),
            true,
            "Amp Envelope must survive deleteSource",
        );
        assert.equal(
            adapter.getSnapshot().patch.mappings.some((mapping) => mapping.id === mappingResult.value),
            true,
            "ordinary Amp Envelope mappings remain independently editable",
        );
    });

    t("envelope and mseg source state uses real units and accepts writes", (adapter) => {
        const envelope = adapter.getSnapshot().patch.sources.find((s) => s.id === "envelope-1");
        assert.equal(envelope.state._tag, "envelope");
        assert.equal(envelope.state.envelope.attackSeconds > 0, true);
        adapter.commands.setEnvelope("envelope-1", {
            name: "Env 1", attackSeconds: 0.5, decaySeconds: 0.2, sustain: 0.8, releaseSeconds: 1.5,
        });
        const updated = adapter.getSnapshot().patch.sources.find((s) => s.id === "envelope-1");
        assert.equal(updated.state.envelope.attackSeconds, 0.5);
        assert.equal(updated.state.envelope.sustain, 0.8);

        const mseg = adapter.getSnapshot().patch.sources.find((s) => s.id === "mseg-1");
        assert.equal(mseg.state._tag, "mseg");
        assert.equal(Array.isArray(mseg.state.slot.shapeA.points), true);
        adapter.commands.setMsegMorph({ sourceId: "mseg-1", morph: 0.6, layer: { _tag: "patchBase" } });
        const morphed = adapter.getSnapshot().patch.sources.find((s) => s.id === "mseg-1");
        assert.equal(morphed.state.slot.morph, 0.6);
    });

    // ── Articulations ─────────────────────────────────────────────────────

    t("addArticulation mints a unique id and the lowest free selector", (adapter) => {
        const before = adapter.getSnapshot().patch.articulations;
        const result = adapter.commands.addArticulation();
        assert.equal(result._tag, "ok");
        const after = adapter.getSnapshot().patch.articulations;
        assert.equal(after.length, before.length + 1);
        const added = after.find((a) => a.id === result.value);
        assert.equal(before.some((a) => a.id === added.id), false);
        assert.equal(before.some((a) => a.selector === added.selector), false);
    });

    t("duplicateArticulation copies overrides and route amounts to the new slot", (adapter) => {
        const sourceArticulation = adapter.getSnapshot().patch.articulations[0].id;
        const mappingId = adapter.getSnapshot().patch.mappings[0].id;
        adapter.commands.setParameter({
            targetId: "voice-filter.cutoff", value: 0.42,
            layer: { _tag: "articulationOverride", articulationId: sourceArticulation },
        });
        adapter.commands.setMappingAmount(mappingId, 71, { _tag: "articulationOverride", articulationId: sourceArticulation });
        const result = adapter.commands.duplicateArticulation(sourceArticulation);
        assert.equal(result._tag, "ok");
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.articulationOverrides[result.value]["voice-filter.cutoff"], 0.42);
        assert.equal(patch.articulationMappingAmounts[result.value][mappingId], 71);
    });

    t("deleteArticulation prunes its layers and audition falls back", (adapter) => {
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        adapter.commands.setAuditionArticulation(articulationId);
        adapter.commands.setParameter({
            targetId: "voice-filter.cutoff", value: 0.9,
            layer: { _tag: "articulationOverride", articulationId },
        });
        adapter.commands.deleteArticulation(articulationId);
        const snapshot = adapter.getSnapshot();
        assert.equal(snapshot.patch.articulations.some((a) => a.id === articulationId), false);
        assert.equal(Object.hasOwn(snapshot.patch.articulationOverrides, articulationId), false);
        assert.equal(Object.hasOwn(snapshot.patch.articulationMappingAmounts, articulationId), false);
        assert.notEqual(snapshot.audition.articulation, articulationId);
    });

    t("keyswitch walking stops flush against a neighbor and reports the contact", (adapter) => {
        const [first, second] = adapter.getSnapshot().patch.articulations;
        assert.equal(first.key, 30, "seeded default keys");
        assert.equal(second.key, 31);
        const walk = adapter.commands.setArticulationKey(first.id, second.key + 5);
        assert.equal(walk.touching, true);
        assert.equal(walk.neighborId, second.id);
        assert.equal(Math.abs(walk.key - second.key), 1, "flush = adjacent semitone");
        assert.equal(adapter.getSnapshot().patch.articulations.find((a) => a.id === first.id).key, walk.key);
    });

    t("range bounds clamp flush at the neighboring range's edge", (adapter) => {
        const articulations = adapter.getSnapshot().patch.articulations;
        const [first, second] = [...articulations].sort((a, b) => a.velRange.min - b.velRange.min);
        const clamp = adapter.commands.setArticulationRange(second.id, "vel", "min", first.velRange.min);
        assert.equal(clamp.touching, true);
        assert.equal(clamp.neighborId, first.id);
        assert.equal(clamp.value, first.velRange.max + 1, "stops flush above the neighbor");
    });

    t("clearArticulationOverride removes the base override and the target's route amounts", (adapter) => {
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        const mappingId = expectOkValue(adapter.commands.addMapping({
            targetId: "voice-filter.cutoff",
            sourceId: "velocity",
        }), "add articulable filter mapping");
        const mapping = adapter.getSnapshot().patch.mappings.find((candidate) => candidate.id === mappingId);
        adapter.commands.setParameter({
            targetId: mapping.targetId, value: 0.6,
            layer: { _tag: "articulationOverride", articulationId },
        });
        adapter.commands.setMappingAmount(mapping.id, 55, { _tag: "articulationOverride", articulationId });
        adapter.commands.clearArticulationOverride(mapping.targetId, articulationId);
        const { patch } = adapter.getSnapshot();
        assert.equal(Object.hasOwn(patch.articulationOverrides[articulationId] ?? {}, mapping.targetId), false);
        assert.equal(Object.hasOwn(patch.articulationMappingAmounts[articulationId] ?? {}, mapping.id), false);
    });

    t("restoreArticulationLayer is a faithful transactional restore", (adapter) => {
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        const mappingId = adapter.getSnapshot().patch.mappings[0].id;
        const backup = {
            overrides: { "voice-filter.cutoff": 0.5 },
            mappingAmounts: { [mappingId]: 12 },
        };
        adapter.commands.setParameter({
            targetId: "voice-filter.cutoff", value: 0.5,
            layer: { _tag: "articulationOverride", articulationId },
        });
        adapter.commands.restoreArticulationLayer(articulationId, backup);
        const { patch } = adapter.getSnapshot();
        assert.deepEqual(patch.articulationOverrides[articulationId], backup.overrides);
        assert.deepEqual(patch.articulationMappingAmounts[articulationId], backup.mappingAmounts);
    });

    // ── Effects rack ──────────────────────────────────────────────────────

    t("reorderEffect moves identity, restoreEffectOrder restores wholesale", (adapter) => {
        const originalOrder = [...adapter.getSnapshot().patch.effectOrder];
        adapter.commands.reorderEffect(originalOrder[0], originalOrder[2]);
        const moved = adapter.getSnapshot().patch.effectOrder;
        assert.notDeepEqual(moved, originalOrder);
        assert.deepEqual([...moved].sort(), [...originalOrder].sort(), "same identities");
        adapter.commands.restoreEffectOrder(originalOrder);
        assert.deepEqual(adapter.getSnapshot().patch.effectOrder, originalOrder);
    });

    t("setEffectEnabled toggles bypass state only", (adapter) => {
        // Commands address the DOCUMENT's devices (a fresh bridge doc is the
        // starter trio), so the probe effect comes from the projection.
        const order = [...adapter.getSnapshot().patch.effectOrder];
        const effectId = order[order.length - 1];
        adapter.commands.setEffectEnabled(effectId, false);
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.effectEnabled[effectId], false);
        assert.deepEqual(patch.effectOrder, order, "disabling never moves rack position (ADR-009)");
    });

    // ── Audition & session ────────────────────────────────────────────────

    t("audition state follows its commands", (adapter) => {
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        adapter.commands.setAuditionArticulation(articulationId);
        adapter.commands.setAuditionNote("C2");
        adapter.commands.beginTrigger();
        let audition = adapter.getSnapshot().audition;
        assert.equal(audition.articulation, articulationId);
        assert.equal(audition.note, "C2");
        assert.equal(audition.triggerActive, true);
        adapter.commands.endTrigger();
        audition = adapter.getSnapshot().audition;
        assert.equal(audition.triggerActive, false);
    });

    t("captureMotion without a candidate is null, with one it mints a mapped mseg", (adapter) => {
        assert.equal(adapter.commands.captureMotion(), null);
        adapter.commands.beginTrigger();
        // A log-scale target the STARTER TRIO document owns (delay#1); its
        // full-spec amount is the same ±6 oct every log rack target gets.
        adapter.commands.setParameter({ targetId: "delay.delayFilter", value: 0.8, layer: { _tag: "patchBase" } });
        adapter.commands.endTrigger();
        const captured = adapter.commands.captureMotion();
        assert.notEqual(captured, null);
        const { patch } = adapter.getSnapshot();
        const source = patch.sources.find((s) => s.id === captured);
        assert.equal(source.type, "mseg");
        const capturedMapping = patch.mappings.find(
            (m) => m.sourceId === captured && m.targetId === "delay.delayFilter",
        );
        assert.notEqual(capturedMapping, undefined, "capture commits to an MSEG mapped to the moved parameter");
        assert.equal(capturedMapping.amount, 6, "capture commits at FULL spec amount (±6 oct), same on every adapter");
    });

    t("reset returns to the product-initial new patch", async (adapter) => {
        const blank = (await makeAdapter()).getSnapshot();
        adapter.commands.setParameter({ targetId: "oscA.warpAmount", value: 0.9, layer: { _tag: "patchBase" } });
        adapter.commands.setRepeatEnabled(true);
        adapter.commands.reset();
        assert.deepEqual(adapter.getSnapshot().patch, blank.patch);
        assert.deepEqual(adapter.getSnapshot().audition, blank.audition);
    });

    t("the product-initial new patch is identical across adapters by construction", async () => {
        const blank = (await makeAdapter()).getSnapshot();
        assert.deepEqual(
            blank.patch.sources.map((source) => source.id).sort(),
            ["amp-envelope", "envelope-1", "macro-1", "mseg-1", "pressure", "slide", "velocity"],
        );
        assert.deepEqual(blank.patch.mappings, []);
        assert.deepEqual(blank.patch.articulations, []);
        assert.equal(blank.audition.articulation, "Default");
        assert.equal(blank.patch.articulationTriggerMode, "chain");
    });
}

async function waitForReady(adapter) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const { connection } = adapter.getSnapshot();
        if (connection._tag === "ready") return;
        if (connection._tag === "detached") {
            assert.fail(`adapter detached during boot: ${connection.reason}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.fail("adapter never became ready");
}

async function waitForDetached(adapter) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const { connection } = adapter.getSnapshot();
        if (connection._tag === "detached") return connection.reason;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.fail("adapter never detached");
}

contractSuite("mock", async () => {
    const { createMockCosimoAdapter } = await mockFactoryPromise;
    const { createNewPatchMockCosimoState } = await fixturesPromise;
    return createMockCosimoAdapter({ createInitialState: createNewPatchMockCosimoState });
});

contractSuite("bridge", async () => {
    const { createCosimoBridgeAdapter } = await bridgeFactoryPromise;
    const { MockPatchConnection } = await mockConnectionPromise;
    const connection = new MockPatchConnection({ name: "Adapter contract", version: 1 });
    const adapter = createCosimoBridgeAdapter({ connection });
    await waitForReady(adapter);
    return adapter;
});

test("bridge rack commands preserve desired state across an older effective readback", async () => {
    const { createCosimoBridgeAdapter } = await bridgeFactoryPromise;
    const { MockPatchConnection } = await mockConnectionPromise;
    const connection = new MockPatchConnection({ name: "Rack intent regression", version: 1 });
    const adapter = createCosimoBridgeAdapter({ connection });
    await waitForReady(adapter);

    adapter.commands.setEffectEnabled("delay", true);
    connection.emitEndpoint("effectiveRackState", {
        laneCommittedChainLength: 8,
        laneCommittedChainCode: [0, 1, 2, 3, 4, 5, 6, 7].reduce(
            (code, moduleId, position) => code | (moduleId << (position * 3)),
            0,
        ),
        laneCommittedPositionMask: 0,
        laneCommittedGeneration: 0,
        laneRejectedUploadCount: 0,
        laneParamsAcknowledgedSerial: 0,
    });
    adapter.commands.reorderEffect("reverb", "drive");

    // The stored document is lane.v2 now: structure lives in the chain tree.
    // (A fresh bridge doc is the starter trio: drive → delay → reverb.)
    const storedRack = JSON.parse(String(connection.getDebugSnapshot().storedState["lane.v1"]));
    assert.equal(storedRack.version, 2);
    assert.equal(storedRack.chain[0].deviceId, "reverb#1");
    assert.equal(storedRack.chain.find((node) => node.deviceId === "delay#1").enabled, true);
    assert.equal(adapter.getSnapshot().patch.effectEnabled.delay, true);
    adapter.dispose();
});

test("bridge hydration rejects old or incomplete T78 lane state before runtime writes", async () => {
    const [{ createCosimoBridgeAdapter }, { MockPatchConnection }, laneState] = await Promise.all([
        bridgeFactoryPromise,
        mockConnectionPromise,
        laneStateV2Promise,
    ]);
    const current = laneState.createDefaultLaneStateV2();
    const oldVersion = { ...current, version: 1 };
    const missingTrim = structuredClone(current);
    delete missingTrim.devices["delay#1"].params.delayOutputTrimDb;

    for (const invalidLane of [oldVersion, missingTrim]) {
        const connection = new MockPatchConnection({ name: "T78 lane rejection", version: 1 });
        connection.setStoredStateValue("lane.v1", JSON.stringify(invalidLane));
        connection.clearDebugLog();
        const adapter = createCosimoBridgeAdapter({ connection });

        assert.match(await waitForDetached(adapter), /lane\.v2/i);
        assert.deepEqual(
            connection.sentMessages.filter(({ endpointID }) => endpointID.startsWith("lane")),
            [],
            "invalid hydration must not publish any lane parameter, record, or topology event",
        );
        adapter.dispose();
    }
});

test("bridge rejects a duplicate mapping document without migration", async () => {
    const { createCosimoBridgeAdapter } = await bridgeFactoryPromise;
    const { MockPatchConnection } = await mockConnectionPromise;
    const { MODULATION_STATE_KEY, createDefaultModulationState } = await modulationPromise;
    const connection = new MockPatchConnection({ name: "Duplicate pair regression", version: 1 });
    const modulationState = createDefaultModulationState();
    const storedModulation = JSON.stringify({
        ...modulationState,
        routes: [
            {
                id: "oscA.framePosition::mseg-1",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "oscA.wavetablePosition",
                amount: 0.25,
                reducer: "max",
            },
            {
                id: "oscA.framePosition::mseg-1",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "oscA.wavetablePosition",
                amount: 0.75,
                reducer: "max",
            },
        ],
    });
    connection.setStoredStateValue(MODULATION_STATE_KEY, storedModulation);
    connection.setStoredStateValue("articulations.v4", JSON.stringify({
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: "legacy-articulation",
        activeTriggerMode: "chain",
        slots: [{
            id: "legacy-articulation",
            runtimeSlot: 0,
            name: "Legacy",
            color: "#d2a128",
            key: 0,
            velRange: { min: 0, max: 127 },
            chainRange: { min: 0, max: 127 },
            overrides: {},
            routeAmounts: {
                "earlier-legacy-duplicate": 0.5,
                "legacy-route-without-canonical-product-identity": 0.75,
            },
        }],
    }));
    const adapter = createCosimoBridgeAdapter({ connection });
    assert.match(await waitForDetached(adapter), /current modulation schema/);
});

test("bridge rejects a hydration document containing a non-articulable rack mapping amount", async () => {
    const { createCosimoBridgeAdapter } = await bridgeFactoryPromise;
    const { MockPatchConnection } = await mockConnectionPromise;
    const { MODULATION_STATE_KEY, createDefaultModulationState } = await modulationPromise;
    const connection = new MockPatchConnection({ name: "Strict rack articulation rejection", version: 1 });
    connection.setStoredStateValue(MODULATION_STATE_KEY, JSON.stringify({
        ...createDefaultModulationState(),
        routes: [
            {
                id: "oscA.framePosition::mseg-1",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "oscA.wavetablePosition",
                amount: 1,
                reducer: "max",
            },
            {
                id: "phaser.phaserPhase::macro-1",
                enabled: true,
                sourceKind: "macro",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "lane.phaser#1.phaserPhase",
                amount: 180,
                reducer: "max",
            },
        ],
    }));
    connection.setStoredStateValue("articulations.v4", JSON.stringify({
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: "legacy-articulation",
        activeTriggerMode: "chain",
        slots: [{
            id: "legacy-articulation",
            runtimeSlot: 0,
            name: "Legacy",
            color: "#d2a128",
            key: 0,
            velRange: { min: 0, max: 127 },
            chainRange: { min: 0, max: 127 },
            overrides: { "oscA.pan": 0.25 },
            routeAmounts: {
                "oscA.framePosition::mseg-1": 0.75,
                "phaser.phaserPhase::macro-1": 0.5,
            },
        }],
    }));

    const adapter = createCosimoBridgeAdapter({ connection });
    assert.match(await waitForDetached(adapter), /phaser\.phaserPhase::macro-1.*current articulable mapping/);
});

test("live articulation writes use the same strict route-reference parser as hydration", async () => {
    const { createCosimoBridgeAdapter } = await bridgeFactoryPromise;
    const { MockPatchConnection } = await mockConnectionPromise;
    const connection = new MockPatchConnection({ name: "Strict current articulation write", version: 1 });
    const adapter = createCosimoBridgeAdapter({ connection });
    await waitForReady(adapter);

    connection.setStoredStateValue("articulations.v4", JSON.stringify({
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: "current-articulation",
        activeTriggerMode: "chain",
        slots: [{
            id: "current-articulation",
            runtimeSlot: 0,
            name: "Current",
            color: "#d2a128",
            key: 0,
            velRange: { min: 0, max: 127 },
            chainRange: { min: 0, max: 127 },
            overrides: {},
            routeAmounts: { "new-phantom-route": 0.5 },
        }],
    }));

    assert.match(await waitForDetached(adapter), /new-phantom-route.*current articulable mapping/);
});

test("bridge rejects a non-finite phantom articulation amount without sanitizing it", async () => {
    const { createCosimoBridgeAdapter } = await bridgeFactoryPromise;
    const { MockPatchConnection } = await mockConnectionPromise;
    const connection = new MockPatchConnection({ name: "Non-finite legacy articulation", version: 1 });
    connection.setStoredStateValue("articulations.v4", {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: "legacy-articulation",
        activeTriggerMode: "chain",
        slots: [{
            id: "legacy-articulation",
            runtimeSlot: 0,
            name: "Legacy",
            color: "#d2a128",
            key: 0,
            velRange: { min: 0, max: 127 },
            chainRange: { min: 0, max: 127 },
            overrides: {},
            routeAmounts: { "phantom-route": Number.NaN },
        }],
    });

    const adapter = createCosimoBridgeAdapter({ connection });
    assert.match(await waitForDetached(adapter), /phantom-route must be a finite route amount/);
});

test("mock DSP session changes reset both acknowledged install frontiers", async () => {
    const { MockPatchConnection } = await mockConnectionPromise;
    const connection = new MockPatchConnection({ name: "Runtime frontier reset", version: 1 });

    await new Promise((resolve) => setTimeout(resolve, 20));
    connection.setRuntimeState({ dspSessionId: 2 });

    const acknowledgement = await new Promise((resolve) => {
        const handleAcknowledgement = (value) => {
            if (value?.syncSerial !== 73) return;
            connection.removeEndpointListener("runtimeInstallAck", handleAcknowledgement);
            resolve(value);
        };
        connection.addEndpointListener("runtimeInstallAck", handleAcknowledgement);
        connection.sendEventOrValue("runtimeSyncRequest", 73);
    });

    assert.equal(acknowledgement.dspSessionId, 2);
    assert.equal(acknowledgement.acceptedModulationSerial, 0);
    assert.equal(acknowledgement.acceptedArticulationSerial, 0);
    assert.equal(acknowledgement.syncSerial, 73);
});

test("bridge never persists a mapping for a control without an engine modulation target", async () => {
    const { createCosimoBridgeAdapter } = await bridgeFactoryPromise;
    const { MockPatchConnection } = await mockConnectionPromise;
    const connection = new MockPatchConnection({ name: "UI mapping articulation guard", version: 1 });
    const adapter = createCosimoBridgeAdapter({ connection });
    await waitForReady(adapter);

    const result = adapter.commands.addMapping({
        targetId: "filter.globalFilterMode",
        sourceId: "mseg-1",
    });

    assert.equal(result._tag, "err");
    assert.equal(result.error._tag, "TargetNotModulatable");
    assert.equal(connection.getDebugSnapshot().storedState["uiMappings.v1"], undefined);
});
