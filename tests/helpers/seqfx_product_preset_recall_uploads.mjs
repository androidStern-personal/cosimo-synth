// Prints the pattern uploads SeqFX's real state service sends for an edit and
// then for a preset recall, so the DSP probe can play them back.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "../../kit/tests/helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { default: definition } = await loadUIModule(repoRoot, "fx/seqfx/state.ts");
const { createCmajorPluginStateService } = await loadUIModule(repoRoot, "kit/ui/plugin-state-cmajor.ts");
const {
    SEQFX_LANES,
    applySeqFxBlockCreate,
    applySeqFxBlockParamEdit,
    createDefaultSeqFxState,
    seqFxPatternsCodec,
} = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");

const scope = { owner: "seqfx-probe", document: 0 };
const sent = [];
const listeners = new Set();
const deliver = (body) => { for (const listener of listeners) listener(JSON.parse(JSON.stringify(body))); };
const connection = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    sendMessageToServer(message) {
        const body = JSON.parse(JSON.stringify(message.message));
        sent.push(body);
        if (body.kind === "publish") {
            queueMicrotask(() => deliver({ kind: "published", request: body.request, scope: body.scope, result: { kind: "observed" } }));
        }
    },
};
const settle = () => new Promise(setImmediate);
const uploads = () => sent.filter((body) => body.kind === "publish").flatMap((body) => body.operations)
    .filter((operation) => operation.kind === "event" && operation.endpoint === "patternUpload").map((operation) => operation.value);

let stutterState = applySeqFxBlockCreate(createDefaultSeqFxState(), { patternIndex: 0, lane: SEQFX_LANES.stutter, startStep: 0, length: 1 });
for (const [paramIndex, value] of [8, 1, 0, 1].entries()) {
    stutterState = applySeqFxBlockParamEdit(stutterState, { patternIndex: 0, lane: SEQFX_LANES.stutter, startStep: 0, paramIndex, value });
}

const defects = [];
const service = createCmajorPluginStateService(definition, connection, { onDefect: (error) => defects.push(error) });
const starting = service.start();
deliver({ kind: "opened", request: 1, scope, native: {
    parameters: [
        { endpoint: "enabled", value: 1, min: 0, max: 1, step: 1, defaultValue: 1 },
        { endpoint: "globalMix", value: 1, min: 0, max: 1, step: 0, defaultValue: 1 },
        { endpoint: "patternSelect", value: 0, min: 0, max: 11, step: 1, defaultValue: 0 },
        { endpoint: "clockMode", value: 0, min: 0, max: 2, step: 1, defaultValue: 0 },
        { endpoint: "manualBpm", value: 120, min: 20, max: 300, step: 0, defaultValue: 120 },
        { endpoint: "rate", value: 2, min: 0, max: 2, step: 1, defaultValue: 1 },
        { endpoint: "swing", value: 0, min: 0, max: 0.45, step: 0, defaultValue: 0 },
        { endpoint: "loopStart", value: 0, min: 0, max: 31, step: 1, defaultValue: 0 },
        { endpoint: "loopLength", value: 32, min: 1, max: 32, step: 1, defaultValue: 32 },
    ],
    values: {},
} });
await starting;
await settle();

// The user draws the stutter block: an ordinary edit.
deliver({ kind: "command", address: { ...scope, client: 1, sequence: 1 },
    command: { kind: "edit", key: "patterns", value: seqFxPatternsCodec.encode(stutterState) } });
await settle();
const initialUpload = uploads().at(-1);

// A preset is recalled, as PresetBar does. It keeps the playing stutter cell and
// adds a filter block later in the bar, so only the recall itself can clear captured audio.
const recalledState = applySeqFxBlockCreate(stutterState, { patternIndex: 0, lane: SEQFX_LANES.filter, startStep: 16, length: 2 });
const before = uploads().length;
deliver({ kind: "command", address: { ...scope, client: 1, sequence: 2 },
    command: { kind: "edit-many", recall: true, edits: [{ key: "patterns", value: seqFxPatternsCodec.encode(recalledState) }] } });
await settle();
const replacementUploads = uploads().slice(before);
await service.stop();

if (defects.length > 0 || !initialUpload || replacementUploads.length === 0) {
    throw new Error(`The SeqFX preset recall path did not produce the expected uploads: ${defects.map(String).join("; ")}`);
}

process.stdout.write(JSON.stringify({ initialUpload, replacementUploads }));
