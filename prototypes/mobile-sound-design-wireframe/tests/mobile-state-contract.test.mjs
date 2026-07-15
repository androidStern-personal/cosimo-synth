import assert from "node:assert/strict";
import test from "node:test";

import { mockCosimoReducer } from "../src/adapters/mockCosimoReducer.js";
import {
  createInitialMockCosimoState,
  createStressMockCosimoState,
} from "../src/domain/fixtures.js";
import {
  createSourceIdentity,
  firstAvailableSourceSlot,
  mappingNeedsReducer,
} from "../src/domain/policies.js";
import {
  selectEffectiveParameterValue,
  selectSourceLookup,
} from "../src/domain/selectors.js";
import { TARGETS } from "../src/domain/catalog.js";

function reduce(state, type, patch = {}) {
  return mockCosimoReducer(state, { type, ...patch });
}

test("effect reorder preserves module identity and modulation mappings", () => {
  const initial = createInitialMockCosimoState();
  const originalMappings = initial.patch.mappings;
  const next = reduce(initial, "REORDER_EFFECT", {
    effectId: "phaser",
    overEffectId: "filter",
  });

  assert.equal(next.patch.effectOrder[0], "phaser");
  assert.deepEqual(next.patch.mappings, originalMappings);
  assert.equal(next.patch.parameterValues["phaser.frequency"], 54);
});

test("voice edits create sparse absolute articulation overrides and reset only that override", () => {
  const initial = createInitialMockCosimoState();
  const edited = reduce(initial, "SET_PARAMETER", {
    targetId: "wavetable.warp",
    value: 73,
    layer: { kind: "articulationOverride", articulationId: "Pluck" },
  });

  assert.equal(edited.patch.parameterValues["wavetable.warp"], 58);
  assert.equal(edited.patch.articulationOverrides.Pluck["wavetable.warp"], 73);
  assert.equal(selectEffectiveParameterValue(edited.patch, "wavetable.warp", "Pluck"), 73);
  assert.equal(selectEffectiveParameterValue(edited.patch, "wavetable.warp", "Default"), 58);

  const reset = reduce(edited, "CLEAR_ARTICULATION_OVERRIDE", {
    targetId: "wavetable.warp",
    articulationId: "Pluck",
  });
  assert.equal(reset.patch.articulationOverrides.Pluck["wavetable.warp"], undefined);
  assert.equal(reset.patch.parameterValues["wavetable.warp"], 58);
});

test("reducer control is required only for per-note sources crossing into global effects", () => {
  const state = createInitialMockCosimoState();
  const sources = selectSourceLookup(state.patch);

  assert.equal(mappingNeedsReducer(sources["mseg-1"], TARGETS["phaser.frequency"]), true);
  assert.equal(mappingNeedsReducer(sources.pressure, TARGETS["phaser.frequency"]), true);
  assert.equal(mappingNeedsReducer(sources["macro-1"], TARGETS["phaser.frequency"]), false);
  assert.equal(mappingNeedsReducer(sources["mseg-1"], TARGETS["wavetable.index"]), false);
});

test("source delete and undo restore the exact source settings and mappings", () => {
  const initial = createInitialMockCosimoState();
  const source = initial.patch.sources.find((item) => item.id === "envelope-1");
  const settings = initial.patch.sourceSettings["envelope-1"];
  const mappings = initial.patch.mappings.filter((item) => item.sourceId === "envelope-1");

  const deleted = reduce(initial, "DELETE_SOURCE", { sourceId: "envelope-1" });
  assert.equal(deleted.patch.sources.some((item) => item.id === "envelope-1"), false);
  assert.equal(deleted.patch.mappings.some((item) => item.sourceId === "envelope-1"), false);

  const restored = reduce(deleted, "UNDO_DELETE_SOURCE");
  assert.deepEqual(
    restored.patch.sources.find((item) => item.id === "envelope-1"),
    source,
  );
  assert.deepEqual(restored.patch.sourceSettings["envelope-1"], settings);
  assert.deepEqual(
    restored.patch.mappings.filter((item) => item.sourceId === "envelope-1"),
    mappings,
  );
});

test("retrospective capture binds to the parameter moved while Trigger is held", () => {
  const initial = createInitialMockCosimoState();
  const held = reduce(initial, "BEGIN_TRIGGER");
  const moved = reduce(held, "SET_PARAMETER", {
    targetId: "wavetable.warp",
    value: 67,
    layer: { kind: "articulationOverride", articulationId: "Pluck" },
  });
  const released = reduce(moved, "END_TRIGGER");
  const captured = reduce(released, "CAPTURE_MOTION", {
    source: createSourceIdentity("mseg", 2),
  });

  const source = captured.patch.sources.find((item) => item.id === "mseg-2");
  const mapping = captured.patch.mappings.find(
    (item) => item.id === "wavetable.warp::mseg-2",
  );
  assert.deepEqual(source.capturedMotion, {
    targetKey: "wavetable.warp",
    layer: "Pluck override",
    articulation: "Pluck",
  });
  assert.equal(mapping.targetKey, "wavetable.warp");
  assert.equal(mapping.capturedLayer, "Pluck override");
  assert.equal(mapping.capturedArticulation, "Pluck");
});

test("lifecycle cancellation force-releases a latched audition note", () => {
  const initial = createInitialMockCosimoState();
  const latched = reduce(
    reduce(initial, "SET_LATCH", { enabled: true }),
    "BEGIN_TRIGGER",
  );
  const pointerReleased = reduce(latched, "END_TRIGGER");
  const lifecycleCancelled = reduce(pointerReleased, "CANCEL_TRIGGER");

  assert.equal(pointerReleased.audition.triggerActive, true);
  assert.equal(lifecycleCancelled.audition.triggerActive, false);
});

test("latched trigger release preserves the recorded capture candidate", () => {
  const initial = createInitialMockCosimoState();
  const latched = reduce(
    reduce(initial, "SET_LATCH", { enabled: true }),
    "BEGIN_TRIGGER",
  );
  const moved = reduce(latched, "SET_PARAMETER", {
    targetId: "phaser.depth",
    value: 77,
    layer: { kind: "patchBase" },
  });
  const pointerReleased = reduce(moved, "END_TRIGGER");
  const tapReleased = reduce(pointerReleased, "BEGIN_TRIGGER");

  assert.equal(tapReleased.audition.triggerActive, false);
  assert.equal(tapReleased.audition.captureCandidate.targetKey, "phaser.depth");
  assert.equal(tapReleased.audition.status, "Ready · Patch base · Phaser Depth");
});

test("reserved source families expose only unused slots", () => {
  const initial = createInitialMockCosimoState();
  assert.equal(firstAvailableSourceSlot(initial.patch.sources, "macro"), 2);
  assert.equal(firstAvailableSourceSlot(initial.patch.sources, "envelope"), 2);
  assert.equal(firstAvailableSourceSlot(initial.patch.sources, "mseg"), 2);

  const fullMsegs = [
    ...initial.patch.sources,
    createSourceIdentity("mseg", 2),
    createSourceIdentity("mseg", 3),
  ];
  assert.equal(firstAvailableSourceSlot(fullMsegs, "mseg"), null);
});

test("visual stress fixture covers maximum values, bypass, override, orphan, and capture", () => {
  const state = createStressMockCosimoState();
  const orphan = state.patch.sources.find((source) => source.id === "envelope-2");

  assert.equal(state.patch.parameterValues["phaser.frequency"], 100);
  assert.equal(state.patch.parameterValues["phaser.rate"], 100);
  assert.equal(state.patch.effectEnabled.delay, false);
  assert.equal(state.patch.articulationOverrides.Pluck["wavetable.warp"], 100);
  assert.ok(orphan);
  assert.equal(
    state.patch.mappings.some((mapping) => mapping.sourceId === orphan.id),
    false,
  );
  assert.equal(state.audition.repeat, true);
  assert.equal(state.audition.latch, true);
  assert.equal(state.audition.triggerActive, true);
  assert.equal(state.audition.captureCandidate.targetKey, "wavetable.warp");
});
