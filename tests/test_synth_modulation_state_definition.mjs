import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { createDefaultModulationState, createDefaultRoute } = await loadUIModule(root, "ui/shared/modulation.ts");
const { definePluginState, storedValue, parameter } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { createPluginStateSession } = await loadUIModule(root, "kit/ui/plugin-state-session.ts");

function assertDeepFrozen(value) {
    if (value === null || typeof value !== "object") return;
    assert.equal(Object.isFrozen(value), true, "every accepted domain object and array is immutable");
    for (const child of Object.values(value)) assertDeepFrozen(child);
}

test("the modulation codec owns exact v6 B-curve edits and shared history with a host scalar", async () => {
    const { modulationStateCodec } = await loadUIModule(root, "ui/shared/synth-modulation-state.ts");
    const definition = definePluginState({
        "modulation.v6": storedValue({ initial: createDefaultModulationState(), codec: modulationStateCodec }),
        gain: parameter("gain"),
    });
    const boot = createDefaultModulationState();
    boot.msegSlots[0].shapeB.points = [{ x: 0, y: 0.25, curvePower: 0 }, { x: 1, y: 0.75, curvePower: 0 }];
    boot.macroNames[0] = "Recorded Macro";
    boot.routes = [createDefaultRoute({ id: "codec-route", sourceKind: "env", sourceSlot: 1, targetKind: "oscA.pan", amount: 0.25 })];
    const bootText = JSON.stringify(boot);
    const scope = { owner: "modulation-codec", document: 0 };
    const publications = [], defects = [];
    const session = createPluginStateSession(definition, {
        native: { publish(value) { publications.push(value); }, update() {}, close() {} },
        onDefect: error => defects.push(error),
    });
    let sequence = 0;
    const command = command => session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: ++sequence }, command });
    try {
        await session.dispatch({ kind: "opened", scope, native: {
            values: { "modulation.v6": bootText },
            parameters: [{ endpoint: "gain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 }],
        } });
        const initial = session.getSnapshot().fields["modulation.v6"];
        assert.deepEqual(initial.readiness, { kind: "ready" }, "existing current-schema JSON hydrates through the actual field codec");
        assert.deepEqual(initial.value, boot);
        assertDeepFrozen(initial.value);
        assert.equal(session.getSnapshot().fields.gain.value, 2.5);
        assert.deepEqual(publications, [], "boot must not rewrite an existing current-schema document");

        const gainEdit = await command({ kind: "edit", key: "gain", value: 3 });
        assert.equal(gainEdit.kind, "accepted");
        const proposal = structuredClone(boot);
        proposal.msegSlots[0].shapeB.points = [
            { x: 0, y: 0.25, curvePower: 0 },
            { x: 0.5, y: 0.85, curvePower: 1.5 },
            { x: 1, y: 0.75, curvePower: 0 },
        ];
        const expected = structuredClone(proposal);
        const editedText = JSON.stringify(expected);
        const edit = await command({ kind: "edit", key: "modulation.v6", value: proposal, expectedVersion: 0 });
        assert.equal(edit.kind, "accepted");
        assert.equal(edit.changed, true);
        assert.equal(edit.version, 1);
        assert.ok(edit.historyEntry);
        const accepted = session.getSnapshot().fields["modulation.v6"].value;
        assert.deepEqual(accepted, expected);
        assert.deepEqual(accepted.msegSlots[0].shapeA, boot.msegSlots[0].shapeA, "editing B cannot replace A");
        assert.notStrictEqual(accepted, proposal);
        assert.notStrictEqual(accepted.msegSlots[0].shapeB.points, proposal.msegSlots[0].shapeB.points);
        assertDeepFrozen(accepted);
        assert.throws(() => { accepted.msegSlots[0].shapeB.points[1].y = 0.1; }, TypeError);
        proposal.msegSlots[0].shapeB.points[1].y = 0.99;
        proposal.routes[0].amount = -0.8;
        proposal.macroNames[0] = "Caller changed this";
        assert.deepEqual(accepted, expected, "caller mutations cannot alter the accepted bank or the history after-value");
        assert.deepEqual(publications[1].operations, [{ kind: "stored", key: "modulation.v6", value: editedText }]);

        const beforeRejected = session.getSnapshot();
        const unchanged = await command({ kind: "edit", key: "modulation.v6", value: structuredClone(expected), expectedVersion: 1 });
        assert.equal(unchanged.kind, "accepted");
        assert.equal(unchanged.changed, false, "codec equality recognizes the same document despite fresh allocation");
        assert.equal(unchanged.historyEntry, undefined);
        assert.strictEqual(session.getSnapshot(), beforeRejected);
        assert.equal(publications.length, 2);
        for (const malformed of [{ ...expected, version: 5 }, { ...expected, msegSlots: [] }]) {
            assert.equal(modulationStateCodec.parse(malformed).kind, "error");
            assert.deepEqual(await command({ kind: "edit", key: "modulation.v6", value: malformed }), { kind: "rejected", reason: "invalid-value" });
            assert.strictEqual(session.getSnapshot(), beforeRejected);
            assert.equal(publications.length, 2);
        }
        assert.equal((await command({ kind: "undo", expectedEntry: edit.historyEntry })).kind, "accepted");
        assert.deepEqual(session.getSnapshot().fields["modulation.v6"].value, boot);
        assert.equal(session.getSnapshot().fields.gain.value, 3, "the first shared Undo restores only the newest bank edit");
        assert.equal((await command({ kind: "undo", expectedEntry: gainEdit.historyEntry })).kind, "accepted");
        assert.equal(session.getSnapshot().fields.gain.value, 2.5);
        assert.equal((await command({ kind: "redo", expectedEntry: gainEdit.historyEntry })).kind, "accepted");
        assert.equal((await command({ kind: "redo", expectedEntry: edit.historyEntry })).kind, "accepted");
        assert.deepEqual(session.getSnapshot().fields["modulation.v6"].value, expected);
        assert.equal(session.getSnapshot().fields.gain.value, 3);
        const stored = publications.flatMap(value => value.operations).filter(value => value.kind === "stored");
        assert.deepEqual(stored, [
            { kind: "stored", key: "modulation.v6", value: editedText },
            { kind: "stored", key: "modulation.v6", value: bootText },
            { kind: "stored", key: "modulation.v6", value: editedText },
        ], "the exact current v6 string is the only persisted bank format and key");
        assert.deepEqual(defects, []);
    } finally { await session.stop(); }
});
