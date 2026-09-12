import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

test("normal component result and history types are public and do not expose native identity fields", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kit-public-state-types-"));
    try {
        await symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"));
        await writeFile(path.join(directory, "fixture.ts"), `
import { usePluginState, usePluginHistory, definePluginState, parameter, storedValue, preparedState, sharedData, Native, type PluginStateControl,
    type PluginStateChanges, type PluginStateEditor,
    type PluginStateControlState, type PluginStateHistory, type PluginStateHistoryEntry,
    type PluginStateEditResult, type PluginStateApplicationState, type PluginStateRejectionReason } from ${JSON.stringify(path.join(root, "kit/index"))};
const control: PluginStateControl<number> = usePluginState(parameter("gain"));
const history: PluginStateHistory = usePluginHistory();
const state: PluginStateControlState<number> = control.state;
const application: PluginStateApplicationState = {kind:"acknowledged"};
const reason: PluginStateRejectionReason = "stale-history";
const definition = definePluginState({ gain: parameter("gain"), enabled: storedValue({ codec: Native.boolean(), initial: true }) });
const editor: PluginStateEditor<typeof definition> = usePluginState(definition);
const changes: PluginStateChanges<typeof definition> = { gain: 0.7, enabled: false };
const compoundResult: Promise<PluginStateEditResult> = editor.edit(changes);
void editor.edit({ gain: 0.5 });
// @ts-expect-error A field value must match its declared codec.
void editor.edit({ gain: 0.7, enabled: 1 });
// @ts-expect-error Parameters retain their number contract in compound edits.
void editor.edit({ gain: "loud" });
// @ts-expect-error Unknown field names cannot enter compound edits.
void editor.edit({ cutoff: 1000 });
const unknownField = { gain: 0.7, cutoff: 1000 };
// @ts-expect-error Passing a variable must not bypass unknown-field checking.
void editor.edit(unknownField);
// @ts-expect-error Rendered versions are private, not supplied by authors.
void editor.edit({ gain: { value: 0.7, expectedVersion: 0 } });
const floats = preparedState({ codec: Native.number(), initial: 1,
    engine: sharedData({ type: "float32" }),
    async prepare(value) {
        return { length: value * 4, write(destination) {
            const samples: Float32Array = destination;
            // @ts-expect-error Float resources must not infer the byte writer API.
            const bytes: Uint8Array = destination;
            samples.fill(value);
        } };
    },
});
preparedState({ codec: Native.number(), initial: 1,
    engine: sharedData({ type: "bytes", length: 4 }),
    prepare(value, destination) { const bytes: Uint8Array = destination; bytes[0] = value; },
});
// @ts-expect-error A shared writer cannot retain its reservation across an await.
preparedState({ codec: Native.number(), initial: 1, engine: sharedData({ type: "float32", length: 4 }), prepare: async () => {} });
// @ts-expect-error A dynamically sized plan's writer is also synchronous.
preparedState({ codec: Native.number(), initial: 1, engine: sharedData({ type: "float32" }), prepare: async () => ({ length: 4, write: async () => {} }) });
// @ts-expect-error Native acknowledgement correlation does not belong to component authors.
application.engineSession;
// @ts-expect-error Native operation identities do not belong to component authors.
application.operation;
// @ts-expect-error History tokens cannot be fabricated from public data.
const fake: PluginStateHistoryEntry = {};
if (history.undoEntry) {
    const eligible: boolean = history.canUndoEntry(history.undoEntry);
    const redoEligible: boolean = history.canRedoEntry(history.undoEntry);
    void history.undo(history.undoEntry);
    // @ts-expect-error The public token hides owner and document identities.
    history.undoEntry.scope;
    // @ts-expect-error The public token hides native entry IDs.
    history.undoEntry.id;
}
async function edit() {
    const result: PluginStateEditResult = await control.setValue(4);
    if (result.kind === "accepted") {
        const changed: boolean | undefined = result.changed;
        if (result.historyEntry) void history.undo(result.historyEntry);
        // @ts-expect-error Transport revisions are internal.
        result.revision;
        // @ts-expect-error Field versions are internal.
        result.version;
    }
}
`);
        await writeFile(path.join(directory, "tsconfig.json"), JSON.stringify({
            extends: path.join(root, "tsconfig.json"),
            files: [path.join(directory, "fixture.ts"), path.join(root, "kit/tests/helpers/plugin_state_public_react.tsx")], include: [],
        }));
        const result = spawnSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--project", path.join(directory, "tsconfig.json")], {
            cwd: root, encoding: "utf8", timeout: 30000,
        });
        assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
    } finally { await rm(directory, { recursive: true, force: true }); }
});
