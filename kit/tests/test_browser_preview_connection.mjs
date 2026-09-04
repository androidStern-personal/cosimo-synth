import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { createBrowserPreviewConnection } = await loadUIModule(root, "kit/ui/effects/browser-preview-connection.ts");
const { buildPluginStateContract } = await loadUIModule(root, "kit/ui/effects/effect-state-contract.ts");
const parameters = [{ endpointID: "gainDb", type: "number", min: -24, max: 24, defaultValue: 0 }];

function connect(ID) {
    const manifest = { ID, name: "Preview Gain", version: "1.0.0" };
    const result = createBrowserPreviewConnection(manifest, parameters);
    assert.equal(result._tag, "ok", result.message);
    assert.deepEqual(result.value.manifest, manifest);
    return result.value;
}

test("preview reports the real manifest and parameter contract through normal bindings", async () => {
    const connection = connect("test.preview.gain");
    const status = await new Promise((resolve) => {
        connection.addStatusListener(resolve);
        connection.requestStatusUpdate();
    });
    assert.equal(status.manifest.ID, "test.preview.gain");
    assert.deepEqual(buildPluginStateContract({ effectID: "gain", status }).parameters, parameters);

    const observed = [];
    const listener = (value) => observed.push(value);
    connection.addParameterListener("gainDb", listener);
    connection.requestParameterValue("gainDb");
    await Promise.resolve();
    connection.sendEventOrValue("gainDb", 6);
    connection.removeParameterListener("gainDb", listener);
    connection.sendEventOrValue("gainDb", 9);
    assert.deepEqual(observed, [0, 6]);

    const output = [];
    connection.addEndpointListener("meterOut", (value) => output.push(value));
    connection.sendEventOrValue("gainDb", 12);
    assert.deepEqual(output, [], "the UI preview does not invent DSP or analyzer output");
});

test("preview stored state is per connection and reload never persists native presets", async () => {
    const first = connect("test.preview.first");
    const other = connect("test.preview.other");
    const reloaded = connect("test.preview.first");
    const writes = [];
    first.addStoredStateValueListener((value) => writes.push(value));
    first.sendStoredStateValue("presets", { name: "My sound" });
    first.sendEventOrValue("gainDb", 4);
    assert.deepEqual(writes, [{ key: "presets", value: { name: "My sound" } }]);
    assert.deepEqual(await new Promise((resolve) => first.requestFullStoredState(resolve)), {
        parameters: { gainDb: 4 }, values: { presets: { name: "My sound" } },
    });
    for (const connection of [other, reloaded]) {
        assert.deepEqual(await new Promise((resolve) => connection.requestFullStoredState(resolve)), {
            parameters: { gainDb: 0 }, values: {},
        });
    }
});

test("preview refuses missing identity, missing metadata, and duplicate parameter definitions", () => {
    assert.equal(createBrowserPreviewConnection({}, parameters)._tag, "err");
    assert.match(createBrowserPreviewConnection({ ID: "test.preview" }, undefined).message, /browserPreviewParameters/u);
    assert.match(createBrowserPreviewConnection({ ID: "test.preview" }, [...parameters, ...parameters]).message, /Duplicate/u);
});
