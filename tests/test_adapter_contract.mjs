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
    expectOkValue(commands.addMapping({ targetId: "wavetable.warp", sourceId: "envelope-1" }), "seed warp mapping");
    commands.setMappingAmount("wavetable.warp::envelope-1", 40, { _tag: "patchBase" });
    expectOkValue(commands.addMapping({ targetId: "wavetable.tune", sourceId: "mseg-1" }), "seed tune mapping");
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
        adapter.commands.setParameter({ targetId: "wavetable.warp", value: 0.9, layer: { _tag: "patchBase" } });
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.parameterValues["wavetable.warp"], 0.9);
        for (const overrides of Object.values(patch.articulationOverrides)) {
            assert.equal(Object.hasOwn(overrides, "wavetable.warp"), false);
        }
    });

    t("articulation-layer edits write the override and never move the base", (adapter) => {
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        const baseBefore = adapter.getSnapshot().patch.parameterValues["wavetable.warp"];
        adapter.commands.setParameter({
            targetId: "wavetable.warp",
            value: 0.77,
            layer: { _tag: "articulationOverride", articulationId },
        });
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.articulationOverrides[articulationId]["wavetable.warp"], 0.77);
        assert.equal(patch.parameterValues["wavetable.warp"], baseBefore);
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

    t("the complete 624-pair product domain is reachable", async (adapter) => {
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
        assert.equal(sources.length, 13);
        assert.equal(targets.length, 48);

        for (const targetId of targets) {
            for (const sourceId of sources) {
                const result = adapter.commands.addMapping({ targetId, sourceId });
                if (result._tag === "err") {
                    assert.equal(result.error._tag, "MappingAlreadyExists");
                }
            }
        }

        assert.equal(adapter.getSnapshot().patch.mappings.length, 624);
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
            .filter((source) => source.type === "envelope")
            .map((source) => source.slot)
            .sort();
        assert.deepEqual(envelopeSlots, [1, 2, 3], "three envelope slots, no gaps");
        assert.equal(created.length, 2, "new patch starts with envelope-1 only");
    });

    t("deleteSource removes its mappings; undoDeleteSource restores both", (adapter) => {
        const sourceId = "envelope-1";
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
    });

    t("macro value and name commands are reflected in the source state", (adapter) => {
        adapter.commands.setMacroValue("macro-1", 0.31);
        adapter.commands.renameMacro("macro-1", "Shimmer");
        const macro = adapter.getSnapshot().patch.sources.find((source) => source.id === "macro-1");
        assert.equal(macro.state._tag, "macro");
        assert.equal(macro.state.value, 0.31);
        assert.equal(macro.state.name, "Shimmer");
    });

    t("fixed sources exist, are unmapped-deletable never, and typed fixed", (adapter) => {
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
            targetId: "wavetable.index", value: 0.42,
            layer: { _tag: "articulationOverride", articulationId: sourceArticulation },
        });
        adapter.commands.setMappingAmount(mappingId, 71, { _tag: "articulationOverride", articulationId: sourceArticulation });
        const result = adapter.commands.duplicateArticulation(sourceArticulation);
        assert.equal(result._tag, "ok");
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.articulationOverrides[result.value]["wavetable.index"], 0.42);
        assert.equal(patch.articulationMappingAmounts[result.value][mappingId], 71);
    });

    t("deleteArticulation prunes its layers and audition falls back", (adapter) => {
        const articulationId = adapter.getSnapshot().patch.articulations[0].id;
        adapter.commands.setAuditionArticulation(articulationId);
        adapter.commands.setParameter({
            targetId: "wavetable.index", value: 0.9,
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
        const mapping = adapter.getSnapshot().patch.mappings[0];
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
            overrides: { "wavetable.warp": 0.11 },
            mappingAmounts: { [mappingId]: 12 },
        };
        adapter.commands.setParameter({
            targetId: "wavetable.index", value: 0.5,
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
        const order = [...adapter.getSnapshot().patch.effectOrder];
        adapter.commands.setEffectEnabled("phaser", false);
        const { patch } = adapter.getSnapshot();
        assert.equal(patch.effectEnabled.phaser, false);
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
        adapter.commands.setParameter({ targetId: "phaser.phaserFrequency", value: 0.8, layer: { _tag: "patchBase" } });
        adapter.commands.endTrigger();
        const captured = adapter.commands.captureMotion();
        assert.notEqual(captured, null);
        const { patch } = adapter.getSnapshot();
        const source = patch.sources.find((s) => s.id === captured);
        assert.equal(source.type, "mseg");
        const capturedMapping = patch.mappings.find(
            (m) => m.sourceId === captured && m.targetId === "phaser.phaserFrequency",
        );
        assert.notEqual(capturedMapping, undefined, "capture commits to an MSEG mapped to the moved parameter");
        assert.equal(capturedMapping.amount, 6, "capture commits at FULL spec amount (±6 oct), same on every adapter");
    });

    t("reset returns to the product-initial new patch", async (adapter) => {
        const blank = (await makeAdapter()).getSnapshot();
        adapter.commands.setParameter({ targetId: "wavetable.warp", value: 0.9, layer: { _tag: "patchBase" } });
        adapter.commands.setRepeatEnabled(true);
        adapter.commands.reset();
        assert.deepEqual(adapter.getSnapshot().patch, blank.patch);
        assert.deepEqual(adapter.getSnapshot().audition, blank.audition);
    });

    t("the product-initial new patch is identical across adapters by construction", async () => {
        const blank = (await makeAdapter()).getSnapshot();
        assert.deepEqual(
            blank.patch.sources.map((source) => source.id).sort(),
            ["envelope-1", "macro-1", "mseg-1", "pressure", "slide", "velocity"],
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

test("bridge rejects a duplicate mapping document without migration", async () => {
    const { createCosimoBridgeAdapter } = await bridgeFactoryPromise;
    const { MockPatchConnection } = await mockConnectionPromise;
    const { createDefaultModulationState } = await modulationPromise;
    const connection = new MockPatchConnection({ name: "Duplicate pair regression", version: 1 });
    const modulationState = createDefaultModulationState();
    const storedModulation = JSON.stringify({
        ...modulationState,
        routes: [
            {
                id: "earlier-legacy-duplicate",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "wavetablePosition",
                amount: 0.25,
                reducer: "max",
            },
            {
                id: "legacy-route-without-canonical-product-identity",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "wavetablePosition",
                amount: 0.75,
                reducer: "max",
            },
        ],
    });
    connection.setStoredStateValue("modulation.v2", storedModulation);
    connection.setStoredStateValue("articulations.v3", JSON.stringify({
        format: "cosimo.articulations",
        version: 3,
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
    const { createDefaultModulationState } = await modulationPromise;
    const connection = new MockPatchConnection({ name: "Strict rack articulation rejection", version: 1 });
    connection.setStoredStateValue("modulation.v2", JSON.stringify({
        ...createDefaultModulationState(),
        routes: [
            {
                id: "wavetable.index::mseg-1",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "wavetablePosition",
                amount: 1,
                reducer: "max",
            },
            {
                id: "phaser.phaserPhase::macro-1",
                enabled: true,
                sourceKind: "macro",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "rack.phaserPhase",
                amount: 180,
                reducer: "max",
            },
        ],
    }));
    connection.setStoredStateValue("articulations.v3", JSON.stringify({
        format: "cosimo.articulations",
        version: 3,
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
            overrides: { pan: 0.25 },
            routeAmounts: {
                "wavetable.index::mseg-1": 0.75,
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

    connection.setStoredStateValue("articulations.v3", JSON.stringify({
        format: "cosimo.articulations",
        version: 3,
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
    connection.setStoredStateValue("articulations.v3", {
        format: "cosimo.articulations",
        version: 3,
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

test("bridge never persists an inaudible articulation amount for an engine-gapped UI mapping", async () => {
    const { createCosimoBridgeAdapter } = await bridgeFactoryPromise;
    const { MockPatchConnection } = await mockConnectionPromise;
    const connection = new MockPatchConnection({ name: "UI mapping articulation guard", version: 1 });
    const adapter = createCosimoBridgeAdapter({ connection });
    await waitForReady(adapter);

    const articulationId = expectOkValue(adapter.commands.addArticulation(), "add articulation");
    const mappingId = expectOkValue(adapter.commands.addMapping({
        targetId: "amp-pan.attack",
        sourceId: "mseg-1",
    }), "add engine-gapped mapping");
    adapter.commands.setMappingAmount(
        mappingId,
        100,
        { _tag: "articulationOverride", articulationId },
    );

    assert.equal(
        Object.hasOwn(adapter.getSnapshot().patch.articulationMappingAmounts[articulationId] ?? {}, mappingId),
        false,
    );
    const stored = JSON.parse(connection.getDebugSnapshot().storedState["articulations.v3"]);
    assert.equal(Object.hasOwn(stored.slots[0].routeAmounts, mappingId), false);
});
