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
    const oscillatorFields = {
        framePosition: "framePositions",
        pan: "pans",
        octave: "octaves",
        semitone: "semitones",
        fineCents: "fineCents",
        phase: "phases",
        phaseRandom: "phaseRandoms",
        retrigger: "retriggers",
        volumeDb: "volumeDbs",
        mute: "mutes",
        solo: "solos",
        warpMode: "warpModes",
        warpAmount: "warpAmounts",
        unisonVoices: "unisonVoices",
        unisonDetune: "unisonDetunes",
        unisonBlend: "unisonBlends",
        unisonWidth: "unisonWidths",
        unisonDetuneMode: "unisonDetuneModes",
        unisonStackMode: "unisonStackModes",
        unisonWavetablePositionSpread: "unisonWavetablePositionSpreads",
        unisonWarpSpread: "unisonWarpSpreads",
    };
    const table = {
        "filterMode": scalar("filterMode"),
        "filterCutoffHz": scalar("filterCutoffHz"),
        "filterQ": scalar("filterQ"),
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
    ["A", "B", "C"].forEach((oscillatorID, oscillatorIndex) => {
        Object.entries(oscillatorFields).forEach(([parameterID, imageField]) => {
            table[`osc${oscillatorID}.${parameterID}`] = (image) => image[imageField][oscillatorIndex];
        });
    });
    return table;
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
                image.parseArticulationsV4(image.serializeArticulationsV4(state), storedRouteIds(state)),
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
            const viaJson = JSON.parse(JSON.stringify(image.serializeArticulationsV4(state)));
            const parsed = expectOk(image.parseArticulationsV4(viaJson, storedRouteIds(state)), "json roundtrip");
            assert.deepEqual(parsed, state);
        }),
    );
});

test("an earlier payload is rejected with the hard-cut reason", async () => {
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
    const error = expectErr(image.parseArticulationsV4(v2Payload, new Set()), "v2 payload");
    assert.equal(error._tag, "ArticulationsParseError");
    assert.equal(error.reason, "unsupported-version");
    const futureError = expectErr(image.parseArticulationsV4({
        ...v2Payload,
        version: 5,
        chainAssignments: undefined,
        keyAssignments: undefined,
        velocityAssignments: undefined,
    }, new Set()), "future payload");
    assert.equal(futureError.reason, "unsupported-version");
});

test("malformed payloads are rejected, never repaired", async () => {
    const { image } = await modules();
    const base = () => ({
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: null,
        activeTriggerMode: "chain",
        slots: [makeMinimalSlot(0)],
    });

    const cases = [
        ["not an object", 42],
        ["null", null],
        ["wrong format", { ...base(), format: "cosimo.nonsense" }],
        ["slots not an array", { ...base(), slots: {} }],
        ["unknown override key", { ...base(), slots: [{ ...makeMinimalSlot(0), overrides: { chorusMix: 0.5 } }] }],
        ["non-finite override", { ...base(), slots: [{ ...makeMinimalSlot(0), overrides: { "oscA.pan": Number.NaN } }] }],
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
        const error = expectErr(image.parseArticulationsV4(payload, new Set(["route-a"])), label);
        assert.equal(error.reason, "malformed", `${label}: expected malformed, got ${error.reason}`);
    }
});

test("a finite phantom route rejects the complete v4 document", async () => {
    const { image } = await modules();
    const payload = {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: "slot-0",
        activeTriggerMode: "chain",
        slots: [{
            ...makeMinimalSlot(0),
            routeAmounts: { "unknown-route": 0.5 },
        }],
    };

    const error = expectErr(
        image.parseArticulationsV4(payload, new Set(["current-route"])),
        "phantom route",
    );
    assert.equal(error.reason, "malformed");
    assert.match(error.detail, /unknown-route.*current articulable mapping/);
});

test("the empty bank is valid and roundtrips", async () => {
    const { image } = await modules();
    const empty = image.createEmptyArticulationsState();
    assert.equal(empty.slots.length, 0);
    assert.equal(empty.selectedSlotId, null);
    const parsed = expectOk(
        image.parseArticulationsV4(image.serializeArticulationsV4(empty), new Set()),
        "empty roundtrip",
    );
    assert.deepEqual(parsed, empty);
});

test("the runtime compiler preserves sparse overrides with explicit presence masks", async () => {
    const { image, arb } = await modules();
    const table = imageAccessorTable();
    fc.assert(
        fc.property(
            arb.articulationsStateArbitrary(fc),
            (state) => {
                const routeIds = [...storedRouteIds(state)].sort();
                const routeCells = Object.fromEntries(routeIds.map((routeId, index) => [routeId, index]));
                const uploads = image.compileArticulationOverrideImages(state, routeCells);
                assert.equal(uploads.length, state.slots.length);
                state.slots.forEach((slot, slotIndex) => {
                    const upload = uploads[slotIndex];
                    assert.equal(upload.selectorA, slot.runtimeSlot);
                    assert.equal(upload.enabled, true);
                    for (const [parameterId, accessor] of Object.entries(table)) {
                        const explicit = Object.hasOwn(slot.overrides, parameterId);
                        const expected = explicit ? slot.overrides[parameterId] : 0;
                        assert.equal(
                            accessor(upload),
                            expected,
                            `${slot.id}: ${parameterId}`,
                        );

                        if (parameterId.startsWith("osc")) {
                            const oscillatorIndex = "ABC".indexOf(parameterId[3]);
                            const localParameterId = parameterId.slice(5);
                            const bitIndex = image.OSCILLATOR_ARTICULATION_PARAMETER_IDS.indexOf(localParameterId);
                            assert.notEqual(oscillatorIndex, -1, `${parameterId}: known oscillator`);
                            assert.notEqual(bitIndex, -1, `${parameterId}: known local parameter`);
                            assert.equal(
                                (upload.oscillatorOverrideMasks[oscillatorIndex] & (1 << bitIndex)) !== 0,
                                explicit,
                                `${slot.id}: ${parameterId} mask`,
                            );
                        } else {
                            const bitIndex = image.SHARED_ARTICULATION_VOICE_PARAMETER_IDS.indexOf(parameterId);
                            assert.notEqual(bitIndex, -1, `${parameterId}: known shared parameter`);
                            assert.equal(
                                (upload.sharedOverrideMask & (1 << bitIndex)) !== 0,
                                explicit,
                                `${slot.id}: ${parameterId} mask`,
                            );
                        }
                    }
                    assert.equal(upload.routeAmounts.length, image.MODULATION_ARTICULATION_ROUTE_CELL_COUNT);
                    const assignedCells = new Set();
                    routeIds.forEach((routeId) => {
                        const cellIndex = routeCells[routeId];
                        assignedCells.add(cellIndex);
                        const expected = Object.hasOwn(slot.routeAmounts, routeId)
                            ? slot.routeAmounts[routeId]
                            : image.ARTICULATION_ROUTE_AMOUNT_INHERIT;
                        assert.equal(upload.routeAmounts[cellIndex], expected, `${slot.id}: route ${routeId}`);
                    });
                    for (let cellIndex = 0; cellIndex < image.MODULATION_ARTICULATION_ROUTE_CELL_COUNT; cellIndex += 1) {
                        if (!assignedCells.has(cellIndex)) {
                            assert.equal(
                                upload.routeAmounts[cellIndex],
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

test("single-slot and bank articulation compilation agree", async () => {
    const { image, arb } = await modules();
    fc.assert(
        fc.property(
            arb.articulationsStateArbitrary(fc),
            (state) => {
                const routeIds = [...storedRouteIds(state)].sort();
                const routeCells = Object.fromEntries(routeIds.map((routeId, index) => [routeId, index]));
                const batch = image.compileArticulationOverrideImages(state, routeCells);
                state.slots.forEach((slot, index) => {
                    assert.deepEqual(image.compileArticulationOverrideImage(slot, routeCells), batch[index]);
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
        version: 4,
        selectedSlotId: null,
        activeTriggerMode: "chain",
        slots: Array.from({ length: image.ARTICULATION_MAX_SLOTS }, (_, index) => makeMinimalSlot(index)),
    };
    assert.equal(image.lowestFreeRuntimeSlot(fullBank), null);
});
