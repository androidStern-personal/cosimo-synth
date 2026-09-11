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
import { usePluginState, usePluginHistory, parameter, preparedState, sharedData, Native, type PluginStateControl,
    type PluginStateControlState, type PluginStateHistory, type PluginStateHistoryEntry,
    type PluginStateEditResult, type PluginStateApplicationState, type PluginStateRejectionReason } from ${JSON.stringify(path.join(root, "kit/index"))};
const control: PluginStateControl<number> = usePluginState(parameter("gain"));
const history: PluginStateHistory = usePluginHistory();
const state: PluginStateControlState<number> = control.state;
const application: PluginStateApplicationState = {kind:"acknowledged"};
const reason: PluginStateRejectionReason = "stale-history";
const floats = preparedState({ codec: Native.number(), initial: 1,
    engine: sharedData({ type: "float32", length: (value: number) => value * 4 }),
    prepare(value, destination) {
        const samples: Float32Array = destination;
        // @ts-expect-error Float resources must not infer the byte writer API.
        const bytes: Uint8Array = destination;
        samples.fill(value);
    },
});
preparedState({ codec: Native.number(), initial: 1,
    engine: sharedData({ type: "bytes", length: 4 }),
    prepare(value, destination) { const bytes: Uint8Array = destination; bytes[0] = value; },
});
// @ts-expect-error A shared writer cannot retain its reservation across an await.
preparedState({ codec: Native.number(), initial: 1, engine: sharedData({ type: "float32", length: 4 }), prepare: async () => {} });
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
            files: [path.join(directory, "fixture.ts")], include: [],
        }));
        const result = spawnSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--project", path.join(directory, "tsconfig.json")], {
            cwd: root, encoding: "utf8", timeout: 30000,
        });
        assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
    } finally { await rm(directory, { recursive: true, force: true }); }
});
