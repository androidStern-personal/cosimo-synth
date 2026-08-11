import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const imageModulePromise = loadUIModule(repoRoot, "ui/shared/articulation-image.ts");
const arbitraryModulePromise = loadUIModule(repoRoot, "ui/shared/articulation-image.arbitrary.ts");

async function modules() {
    return {
        image: await imageModulePromise,
        arb: await arbitraryModulePromise,
    };
}

function deepFreeze(value) {
    if (value === null || typeof value !== "object") return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
}

function expectOk(result, label) {
    assert.equal(result._tag, "ok", `${label}: expected ok, got ${result._tag === "err" ? result.error.message : "?"}`);
    return result.value;
}

function expectErr(result, label) {
    assert.equal(result._tag, "err", `${label}: expected err, got ok`);
    return result.error;
}

/**
 * Oracle mapping each overridable parameter id to its location on the
 * resolved runtime image. Every id in ARTICULATION_VOICE_PARAMETER_IDS must
 * appear here — the completeness test enforces it.
 */
function imageAccessorTable() {
    const scalar = (field) => (image) => image[field];
    return {
        "framePosition": scalar("framePosition"),
        "pan": scalar("pan"),
        "warpMode": scalar("warpMode"),
        "warpAmount": scalar("warpAmount"),
        "filterMode": scalar("filterMode"),
        "filterCutoffHz": scalar("filterCutoffHz"),
        "filterQ": scalar("filterQ"),
        "unisonVoices": scalar("unisonVoices"),
        "unisonDetune": scalar("unisonDetune"),
        "unisonBlend": scalar("unisonBlend"),
        "unisonWidth": scalar("unisonWidth"),
        "unisonPhase": scalar("unisonPhase"),
        "unisonRandom": scalar("unisonRandom"),
        "unisonPhaseMode": scalar("unisonPhaseMode"),
        "unisonDetuneMode": scalar("unisonDetuneMode"),
        "unisonStackMode": scalar("unisonStackMode"),
        "unisonWavetablePositionSpread": scalar("unisonWavetablePositionSpread"),
        "unisonWarpSpread": scalar("unisonWarpSpread"),
        "msegMorph1": (image) => image.msegMorphs[0],
        "msegMorph2": (image) => image.msegMorphs[1],
        "msegMorph3": (image) => image.msegMorphs[2],
        "env1.attackSeconds": (image) => image.envelopeAttackSeconds[0],
        "env1.decaySeconds": (image) => image.envelopeDecaySeconds[0],
        "env1.sustain": (image) => image.envelopeSustain[0],
        "env1.releaseSeconds": (image) => image.envelopeReleaseSeconds[0],
        "env2.attackSeconds": (image) => image.envelopeAttackSeconds[1],
        "env2.decaySeconds": (image) => image.envelopeDecaySeconds[1],
        "env2.sustain": (image) => image.envelopeSustain[1],
        "env2.releaseSeconds": (image) => image.envelopeReleaseSeconds[1],
        "env3.attackSeconds": (image) => image.envelopeAttackSeconds[2],
        "env3.decaySeconds": (image) => image.envelopeDecaySeconds[2],
        "env3.sustain": (image) => image.envelopeSustain[2],
        "env3.releaseSeconds": (image) => image.envelopeReleaseSeconds[2],
    };
}

function makeMinimalSlot(index) {
    return {
        id: `slot-${index}`,
        runtimeSlot: index,
        name: `Slot ${index}`,
        color: "#d2a128",
        key: 24,
        velRange: { min: 0, max: 127 },
        chainRange: { min: 0, max: 127 },
        overrides: {},
        routeAmounts: {},
    };
}

function storedRouteIds(state) {
    return new Set(state.slots.flatMap((slot) => Object.keys(slot.routeAmounts)));
}

function applyBaseChange(base, change, newValue) {
    if (change.kind === "voiceParameter") {
        return { ...base, parameters: { ...base.parameters, [change.parameterId]: newValue } };
    }
    if (change.kind === "routeAmount") {
        return { ...base, routeAmounts: { ...base.routeAmounts, [change.routeId]: newValue } };
    }
    // routeOrder: rotate by one — a pure repositioning of the same routes.
    const rotated = base.routeOrder.length > 1
        ? [...base.routeOrder.slice(1), base.routeOrder[0]]
        : [...base.routeOrder];
    return { ...base, routeOrder: rotated };
}

test("accessor oracle covers every overridable parameter id exactly", async () => {
    const { image } = await modules();
    const table = imageAccessorTable();
    assert.deepEqual(
        Object.keys(table).sort(),
        [...image.ARTICULATION_VOICE_PARAMETER_IDS].sort(),
        "the test oracle and the module's id list must agree field-for-field",
    );
});

test("serialize→parse roundtrips arbitrary banks unchanged", async () => {
    const { image, arb } = await modules();
    fc.assert(
        fc.property(arb.articulationsStateArbitrary(fc), (state) => {
            const parsed = expectOk(
                image.parseArticulationsV3(image.serializeArticulationsV3(state), storedRouteIds(state)),
                "roundtrip",
            );
            assert.deepEqual(parsed, state);
        }),
    );
});

test("serialized banks survive actual JSON encoding", async () => {
    const { image, arb } = await modules();
    fc.assert(
        fc.property(arb.articulationsStateArbitrary(fc), (state) => {
            const viaJson = JSON.parse(JSON.stringify(image.serializeArticulationsV3(state)));
            const parsed = expectOk(image.parseArticulationsV3(viaJson, storedRouteIds(state)), "json roundtrip");
            assert.deepEqual(parsed, state);
        }),
    );
});

test("a v2 payload is just a malformed current-schema document", async () => {
    const { image } = await modules();
    const v2Payload = {
        format: "cosimo.articulations",
        version: 2,
        selectedSlotId: null,
        activeTriggerMode: "chain",
        slots: [],
        chainAssignments: [],
        keyAssignments: [],
        velocityAssignments: [],
    };
    const error = expectErr(image.parseArticulationsV3(v2Payload, new Set()), "v2 payload");
    assert.equal(error._tag, "ArticulationsParseError");
    assert.equal(error.reason, "malformed");
});

test("malformed payloads are rejected, never repaired", async () => {
    const { image } = await modules();
    const base = () => ({
        format: "cosimo.articulations",
        version: 3,
        selectedSlotId: null,
        activeTriggerMode: "chain",
        slots: [makeMinimalSlot(0)],
    });

    const cases = [
        ["not an object", 42],
        ["null", null],
        ["wrong format", { ...base(), format: "cosimo.nonsense" }],
        ["future version", { ...base(), version: 4 }],
        ["slots not an array", { ...base(), slots: {} }],
        ["unknown override key", { ...base(), slots: [{ ...makeMinimalSlot(0), overrides: { chorusMix: 0.5 } }] }],
        ["non-finite override", { ...base(), slots: [{ ...makeMinimalSlot(0), overrides: { pan: Number.NaN } }] }],
        ["runtime slot out of range", { ...base(), slots: [{ ...makeMinimalSlot(0), runtimeSlot: 128 }] }],
        ["negative runtime slot", { ...base(), slots: [{ ...makeMinimalSlot(0), runtimeSlot: -1 }] }],
        ["duplicate runtime slot", { ...base(), slots: [makeMinimalSlot(0), { ...makeMinimalSlot(1), runtimeSlot: 0 }] }],
        ["duplicate slot id", { ...base(), slots: [makeMinimalSlot(0), { ...makeMinimalSlot(1), id: "slot-0" }] }],
        ["inverted vel range", { ...base(), slots: [{ ...makeMinimalSlot(0), velRange: { min: 90, max: 10 } }] }],
        ["fractional key", { ...base(), slots: [{ ...makeMinimalSlot(0), key: 60.5 }] }],
        ["selected id not in bank", { ...base(), selectedSlotId: "ghost" }],
        ["bad trigger mode", { ...base(), activeTriggerMode: "hold" }],
        ["route amount not a number", { ...base(), slots: [{ ...makeMinimalSlot(0), routeAmounts: { "route-a": "loud" } }] }],
        ["current route amount above the articulation domain", {
            ...base(),
            slots: [{ ...makeMinimalSlot(0), routeAmounts: { "route-a": 360 } }],
        }],
        ["route amount cannot impersonate the runtime inherit sentinel", {
            ...base(),
            slots: [{ ...makeMinimalSlot(0), routeAmounts: { "route-a": 1_000_000 } }],
        }],
    ];

    for (const [label, payload] of cases) {
        const error = expectErr(image.parseArticulationsV3(payload, new Set(["route-a"])), label);
        assert.equal(error.reason, "malformed", `${label}: expected malformed, got ${error.reason}`);
    }
});

test("a finite phantom route amount rejects the complete current document", async () => {
    const { image } = await modules();
    const payload = {
        format: "cosimo.articulations",
        version: 3,
        selectedSlotId: "slot-0",
        activeTriggerMode: "chain",
        slots: [{
            ...makeMinimalSlot(0),
            routeAmounts: { "unknown-route": 0.5 },
        }],
    };

    const error = expectErr(image.parseArticulationsV3(payload, new Set(["current-route"])), "phantom route");
    assert.equal(error.reason, "malformed");
    assert.match(error.detail, /unknown-route.*current articulable mapping/);
});

test("the empty bank is valid and roundtrips", async () => {
    const { image } = await modules();
    const empty = image.createEmptyArticulationsState();
    assert.equal(empty.slots.length, 0);
    assert.equal(empty.selectedSlotId, null);
    const parsed = expectOk(image.parseArticulationsV3(image.serializeArticulationsV3(empty), new Set()), "empty roundtrip");
    assert.deepEqual(parsed, empty);
});

test("resolution: scalar fields are complete while route amounts stay sparse until note latch", async () => {
    const { image, arb } = await modules();
    const table = imageAccessorTable();
    fc.assert(
        fc.property(
            arb.patchVoiceBaseArbitrary(fc),
            arb.articulationsStateArbitrary(fc),
            (base, state) => {
                deepFreeze(base);
                deepFreeze(state);
                const images = image.resolveArticulationImages(base, state);
                assert.equal(images.length, state.slots.length);
                state.slots.forEach((slot, slotIndex) => {
                    const resolved = images[slotIndex];
                    assert.equal(resolved.selectorA, slot.runtimeSlot);
                    assert.equal(resolved.enabled, true);
                    for (const [parameterId, accessor] of Object.entries(table)) {
                        const expected = Object.hasOwn(slot.overrides, parameterId)
                            ? slot.overrides[parameterId]
                            : base.parameters[parameterId];
                        assert.equal(
                            accessor(resolved),
                            expected,
                            `${slot.id}: ${parameterId}`,
                        );
                    }
                    assert.equal(resolved.routeAmounts.length, image.MODULATION_ARTICULATION_ROUTE_CELL_COUNT);
                    const assignedCells = new Set();
                    base.routeOrder.forEach((routeId) => {
                        const cellIndex = base.routeCells[routeId];
                        assignedCells.add(cellIndex);
                        const expected = Object.hasOwn(slot.routeAmounts, routeId)
                            ? slot.routeAmounts[routeId]
                            : image.ARTICULATION_ROUTE_AMOUNT_INHERIT;
                        assert.equal(resolved.routeAmounts[cellIndex], expected, `${slot.id}: route ${routeId}`);
                    });
                    for (let cellIndex = 0; cellIndex < image.MODULATION_ARTICULATION_ROUTE_CELL_COUNT; cellIndex += 1) {
                        if (!assignedCells.has(cellIndex)) {
                            assert.equal(
                                resolved.routeAmounts[cellIndex],
                                image.ARTICULATION_ROUTE_AMOUNT_INHERIT,
                                `${slot.id}: empty cell ${cellIndex}`,
                            );
                        }
                    }
                });
            },
        ),
    );
});

test("resolveArticulationImage agrees with the batch resolver", async () => {
    const { image, arb } = await modules();
    fc.assert(
        fc.property(
            arb.patchVoiceBaseArbitrary(fc),
            arb.articulationsStateArbitrary(fc),
            (base, state) => {
                const batch = image.resolveArticulationImages(base, state);
                state.slots.forEach((slot, index) => {
                    assert.deepEqual(image.resolveArticulationImage(base, slot), batch[index]);
                });
            },
        ),
    );
});

test("affectedSelectors matches its specification exactly", async () => {
    const { image, arb } = await modules();
    fc.assert(
        fc.property(
            arb.patchVoiceBaseArbitrary(fc).chain((base) =>
                fc.tuple(
                    fc.constant(base),
                    arb.articulationsStateArbitrary(fc),
                    arb.baseChangeArbitrary(fc, base),
                ),
            ),
            ([, state, change]) => {
                const affected = image.affectedSelectors(change, state);
                let expected;
                if (change.kind === "voiceParameter") {
                    expected = state.slots
                        .filter((slot) => !Object.hasOwn(slot.overrides, change.parameterId))
                        .map((slot) => slot.runtimeSlot);
                } else if (change.kind === "routeAmount") {
                    expected = [];
                } else {
                    expected = state.slots.map((slot) => slot.runtimeSlot);
                }
                assert.deepEqual([...affected], expected);
            },
        ),
    );
});

test("re-uploading only affected selectors is equivalent to a full re-upload", async () => {
    const { image, arb } = await modules();
    fc.assert(
        fc.property(
            arb.patchVoiceBaseArbitrary(fc).chain((base) =>
                fc.tuple(
                    fc.constant(base),
                    arb.articulationsStateArbitrary(fc),
                    arb.baseChangeArbitrary(fc, base),
                    arb.engineValueArbitrary(fc),
                ),
            ),
            ([base, state, change, newValue]) => {
                const changedBase = applyBaseChange(base, change, newValue);
                const before = image.resolveArticulationImages(base, state);
                const after = image.resolveArticulationImages(changedBase, state);
                const affected = new Set(image.affectedSelectors(change, state));

                state.slots.forEach((slot, index) => {
                    if (affected.has(slot.runtimeSlot)) return;
                    assert.deepEqual(
                        after[index],
                        before[index],
                        `${slot.id}: unaffected selector's image must not change`,
                    );
                });
            },
        ),
    );
});

test("lowestFreeRuntimeSlot returns the minimal unowned selector and null at capacity", async () => {
    const { image, arb } = await modules();
    fc.assert(
        fc.property(arb.articulationsStateArbitrary(fc), (state) => {
            const free = image.lowestFreeRuntimeSlot(state);
            const owned = new Set(state.slots.map((slot) => slot.runtimeSlot));
            assert.notEqual(free, null, "a bank of ≤8 slots always has free selectors");
            assert.equal(owned.has(free), false);
            for (let candidate = 0; candidate < free; candidate += 1) {
                assert.equal(owned.has(candidate), true, `selector ${candidate} below the answer must be taken`);
            }
        }),
    );

    const fullBank = {
        format: "cosimo.articulations",
        version: 3,
        selectedSlotId: null,
        activeTriggerMode: "chain",
        slots: Array.from({ length: image.ARTICULATION_MAX_SLOTS }, (_, index) => makeMinimalSlot(index)),
    };
    assert.equal(image.lowestFreeRuntimeSlot(fullBank), null);
});
