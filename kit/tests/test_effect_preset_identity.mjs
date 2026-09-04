import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const { createStandaloneEffectPresetController } = await loadUIModule(repoRoot, "kit/ui/effects/standalone-effect-presets.ts");
const { buildPluginStateContract } = await loadUIModule(repoRoot, "kit/ui/effects/effect-state-contract.ts");
const status = { details: { inputs: [{ endpointID: "amount", purpose: "parameter", annotation: { min: 0, max: 100, init: 50 } }] } };
const originalID = "com.example.original";
const effectID = "shared-ui";
const presetID = "user.same-id";
const presetStateKey = "effects.presets.v2";

function storageScope(pluginID, bankID = effectID) {
    return `plugin-${createHash("sha256").update(JSON.stringify([pluginID, bankID])).digest("hex")}`;
}

function preset({ bankID = effectID, label = "Existing", amount = 32 } = {}) {
    return {
        kind: "cosimo.effectPreset", version: 2, effectID: bankID, presetID, label,
        contract: buildPluginStateContract({ effectID: bankID, status }),
        parameters: { amount }, storedState: {},
    };
}

class PatchConnection {
    constructor({ pluginID = originalID, version = "1.0.0", storedState = {}, amount = 50 } = {}) {
        this.manifest = { ID: pluginID, version, name: "Same UI", view: { devModule: "/shared/source.ts" } };
        this.storedState = structuredClone(storedState);
        this.amount = amount;
        this.statusListeners = new Set();
        this.storedListeners = new Set();
        this.parameterListeners = new Set();
        this.storedWrites = [];
        this.soundWrites = [];
    }
    addStatusListener(listener) { this.statusListeners.add(listener); }
    removeStatusListener(listener) { this.statusListeners.delete(listener); }
    requestStatusUpdate() { for (const listener of this.statusListeners) listener(status); }
    addStoredStateValueListener(listener) { this.storedListeners.add(listener); }
    removeStoredStateValueListener(listener) { this.storedListeners.delete(listener); }
    requestFullStoredState(callback) { callback(structuredClone(this.storedState)); }
    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        this.storedState[key] = value;
        for (const listener of this.storedListeners) listener({ key, value });
    }
    addParameterListener(_endpointID, listener) { this.parameterListeners.add(listener); }
    removeParameterListener(_endpointID, listener) { this.parameterListeners.delete(listener); }
    requestParameterValue() { for (const listener of this.parameterListeners) listener(this.amount); }
    sendEventOrValue(endpointID, value) {
        this.soundWrites.push({ endpointID, value });
        this.amount = value;
        this.requestParameterValue();
    }
}

// The same production composition function and identical options are used for
// original and derived products. Only the host-supplied manifest varies.
function sharedUI(connection, { legacyFileStorePluginID, bankID = effectID } = {}) {
    const controller = createStandaloneEffectPresetController({
        patchConnection: connection, effectID: bankID, legacyFileStorePluginID,
        createPresetID: () => presetID,
    });
    controller.attach();
    return controller;
}

function userFiles(initialFiles = {}) {
    const files = new Map(Object.entries(initialFiles));
    const calls = [];
    let failure;
    let listGate;
    const record = (operation, scope, fileName) => {
        calls.push({ operation, scope, fileName });
        if (failure?.operation === operation && failure.scope === scope) throw new Error(`Test ${operation} failed`);
    };
    return {
        files, calls,
        fail(operation, scope) { failure = { operation, scope }; },
        clearFailure() { failure = undefined; },
        pauseLists(gate) { listGate = gate; },
        api: {
            async list(scope) {
                record("list", scope);
                await listGate;
                return [...files.keys()].filter((key) => key.startsWith(`${scope}/`)).map((key) => key.slice(scope.length + 1));
            },
            async read(scope, fileName) {
                record("read", scope, fileName);
                const value = files.get(`${scope}/${fileName}`);
                if (value === undefined) throw new Error("Missing fixture file");
                return value;
            },
            async write(scope, fileName, contents) {
                record("write", scope, fileName);
                files.set(`${scope}/${fileName}`, contents);
            },
            async delete(scope, fileName) {
                record("delete", scope, fileName);
                files.delete(`${scope}/${fileName}`);
            },
        },
    };
}

async function settle() {
    await new Promise((resolve) => setImmediate(resolve));
}

async function withFiles(files, run) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "chocUserFiles");
    Object.defineProperty(globalThis, "chocUserFiles", { configurable: true, value: files.api });
    try { await run(); } finally {
        if (previous) Object.defineProperty(globalThis, "chocUserFiles", previous);
        else delete globalThis.chocUserFiles;
    }
}

test("two plugin identities using one UI isolate save, read, rename, overwrite and delete", async () => {
    const files = userFiles();
    await withFiles(files, async () => {
        const aConnection = new PatchConnection({ pluginID: "com.example.a", amount: 21 });
        const bConnection = new PatchConnection({ pluginID: "com.example.b", amount: 87 });
        const a = sharedUI(aConnection);
        const b = sharedUI(bConnection);
        await settle();
        assert.equal(a.saveCurrentAsNewPreset("A").ok, true);
        assert.equal(b.saveCurrentAsNewPreset("B").ok, true);
        await settle();
        const aPath = `${storageScope("com.example.a")}/${presetID}.json`;
        const bPath = `${storageScope("com.example.b")}/${presetID}.json`;
        const aBytes = files.files.get(aPath);
        assert.equal(JSON.parse(aBytes).parameters.amount, 21);
        assert.equal(JSON.parse(files.files.get(bPath)).parameters.amount, 87);
        assert.deepEqual(JSON.parse(aConnection.storedState[presetStateKey]).userPresets, {});
        a.detach();
        b.detach();

        const upgradeConnection = new PatchConnection({ pluginID: "com.example.a", version: "2.0.0" });
        upgradeConnection.manifest.name = "Renamed product";
        upgradeConnection.manifest.view.devModule = "/moved/source.ts";
        const upgraded = sharedUI(upgradeConnection);
        const reopenedB = sharedUI(new PatchConnection({ pluginID: "com.example.b", amount: 68 }));
        await settle();
        assert.equal(upgraded.getState().userPresets[0].label, "A");
        assert.equal(upgraded.applyPreset(`user:${presetID}`).ok, true);
        assert.equal(upgradeConnection.amount, 21);
        assert.equal(reopenedB.getState().userPresets[0].label, "B");
        assert.equal(reopenedB.renamePreset(`user:${presetID}`, "B renamed").ok, true);
        await settle();
        assert.equal(reopenedB.overwriteUserPreset(`user:${presetID}`).ok, true);
        await settle();
        assert.equal(JSON.parse(files.files.get(bPath)).parameters.amount, 68);
        assert.equal(reopenedB.deletePreset(`user:${presetID}`).ok, true);
        await settle();
        assert.equal(files.files.get(aPath), aBytes);
        assert.equal(files.files.has(bPath), false);
        assert.deepEqual(new Set(files.calls.map(({ scope }) => scope)), new Set([storageScope("com.example.a"), storageScope("com.example.b")]));
        upgraded.detach();
        reopenedB.detach();
    });
});

test("only the original identity keeps its legacy folder, including when derivatives reuse identical UI", async () => {
    const legacyBytes = JSON.stringify(preset(), null, 4);
    const legacyPath = `${effectID}/${presetID}.json`;
    const files = userFiles({ [legacyPath]: legacyBytes });
    await withFiles(files, async () => {
        const options = { legacyFileStorePluginID: originalID };
        const derivative = sharedUI(new PatchConnection({ pluginID: "com.example.derived" }), options);
        await settle();
        assert.deepEqual(derivative.getState().userPresets, []);
        assert.equal(files.calls.some(({ scope }) => scope === effectID), false);
        assert.equal(derivative.saveCurrentAsNewPreset("Derivative").ok, true);
        await settle();
        const callCount = files.calls.length;
        const original = sharedUI(new PatchConnection({ version: "3.4.5" }), options);
        await settle();
        assert.equal(original.getState().userPresets[0].label, "Existing");
        assert.deepEqual(files.calls.slice(callCount).map(({ operation, scope }) => ({ operation, scope })), [
            { operation: "list", scope: effectID }, { operation: "read", scope: effectID },
        ]);
        assert.equal(original.applyPreset(`user:${presetID}`).ok, true);
        assert.equal(files.files.get(legacyPath), legacyBytes);
        assert.equal(files.calls.some(({ operation }) => operation === "delete"), false);
        assert.equal(files.files.has(`${storageScope(originalID)}/${presetID}.json`), false, "no migration copy is created");
        original.detach();
        derivative.detach();
    });
});

test("scope encoding survives case folding, sanitization and native 160-character truncation", async () => {
    const ids = ["com.example.Case", "com.example.case", "com.example/a", "com.example?a", `com.example.${"x".repeat(180)}a`, `com.example.${"x".repeat(180)}b`];
    const files = userFiles();
    await withFiles(files, async () => {
        const controllers = ids.map((pluginID) => sharedUI(new PatchConnection({ pluginID })));
        await settle();
        for (const controller of controllers) assert.equal(controller.saveCurrentAsNewPreset("Saved").ok, true);
        await settle();
        assert.equal(files.files.size, ids.length);
        for (const id of ids) assert.ok(files.files.has(`${storageScope(id)}/${presetID}.json`));
        for (const { scope } of files.calls) assert.match(scope, /^plugin-[a-f0-9]{64}$/);
        for (const controller of controllers) controller.detach();
    });
});

test("separate effect banks inside one plugin identity do not collide", async () => {
    const files = userFiles();
    await withFiles(files, async () => {
        const a = sharedUI(new PatchConnection(), { bankID: "bank-a" });
        const b = sharedUI(new PatchConnection(), { bankID: "bank-b" });
        await settle();
        assert.equal(a.saveCurrentAsNewPreset("A").ok, true);
        assert.equal(b.saveCurrentAsNewPreset("B").ok, true);
        await settle();
        assert.equal(files.files.size, 2);
        a.detach(); b.detach();
    });
});

test("missing or malformed native identity blocks file mutations without crashing sound/UI or falling back", async () => {
    for (const manifest of [undefined, null, "wrong", {}, { ID: 123 }, { ID: "" }, { ID: " trailing " }, { ID: "bad\nidentity" }]) {
        const files = userFiles({ [`${effectID}/${presetID}.json`]: JSON.stringify(preset()) });
        await withFiles(files, async () => {
            const connection = new PatchConnection();
            connection.manifest = manifest;
            const controller = sharedUI(connection, { legacyFileStorePluginID: originalID });
            await settle();
            assert.equal(controller.getState().ready, true);
            assert.match(controller.getState().lastError, /permanent ID/);
            const result = controller.saveCurrentAsNewPreset("Must not save");
            assert.equal(result.ok, false);
            assert.match(result.message, /permanent ID/);
            assert.deepEqual(files.calls, []);
            assert.deepEqual(connection.storedWrites, []);
            assert.deepEqual(connection.soundWrites, []);
            assert.deepEqual(controller.getState().userPresets, []);
            controller.detach();
        });
    }
});

test("a manifest arriving on status resumes storage after the view has already attached", async () => {
    const files = userFiles();
    await withFiles(files, async () => {
        const connection = new PatchConnection();
        connection.manifest = undefined;
        const controller = sharedUI(connection);
        assert.equal(controller.saveCurrentAsNewPreset("Too early").ok, false);
        connection.manifest = { ID: originalID, version: "2.0.0" };
        connection.requestStatusUpdate();
        await settle();
        assert.equal(controller.getState().lastError, null);
        assert.equal(controller.saveCurrentAsNewPreset("Now ready").ok, true);
        await settle();
        assert.ok(files.files.has(`${storageScope(originalID)}/${presetID}.json`));
        controller.detach();
        assert.equal(connection.statusListeners.size, 0);
    });
});

test("an existing controller never follows a changed plugin identity into another file bank", async () => {
    const files = userFiles();
    await withFiles(files, async () => {
        const connection = new PatchConnection();
        const controller = sharedUI(connection);
        await settle();
        connection.manifest.ID = "com.example.other";
        const result = controller.saveCurrentAsNewPreset("Wrong identity");
        assert.equal(result.ok, false);
        assert.match(result.message, /identity changed/);
        assert.deepEqual(connection.storedWrites, []);
        assert.equal(files.files.size, 0);
        assert.equal(files.calls.some(({ scope }) => scope === storageScope("com.example.other")), false);
        controller.detach();
    });
});

test("a delayed file load cannot be overtaken by an incomplete-bank mutation", async () => {
    const files = userFiles();
    const gate = Promise.withResolvers();
    files.pauseLists(gate.promise);
    await withFiles(files, async () => {
        const connection = new PatchConnection();
        const controller = sharedUI(connection);
        const result = controller.saveCurrentAsNewPreset("Too soon");
        assert.equal(result.ok, false);
        assert.match(result.message, /still loading/);
        assert.deepEqual(connection.storedWrites, []);
        gate.resolve();
        await settle();
        assert.equal(controller.saveCurrentAsNewPreset("Loaded").ok, true);
        await settle();
        assert.equal(files.files.size, 1);
        controller.detach();
    });
});

test("failed and invalid native file loads preserve all data and never fall back to the legacy folder", async () => {
    for (const failure of ["list", "read", "invalid-json", "wrong-effect"]) {
        const scope = storageScope(originalID);
        const badBytes = failure === "invalid-json" ? "{broken" : JSON.stringify(preset({ bankID: failure === "wrong-effect" ? "another-ui" : effectID }));
        const initial = { [`${scope}/${presetID}.json`]: badBytes, [`${effectID}/untouched.json`]: JSON.stringify(preset()) };
        const files = userFiles(initial);
        if (failure === "list" || failure === "read") files.fail(failure, scope);
        await withFiles(files, async () => {
            const connection = new PatchConnection();
            const controller = sharedUI(connection);
            await settle();
            assert.ok(controller.getState().lastError);
            assert.equal(controller.saveCurrentAsNewPreset("Do not erase unread data").ok, false);
            assert.deepEqual(Object.fromEntries(files.files), initial);
            assert.deepEqual(connection.storedWrites, []);
            assert.ok(files.calls.every((call) => call.scope === scope));
            controller.detach();
        });
    }
});

test("native write and delete failures stay in their own scope and surface through the controller", async () => {
    for (const operation of ["write", "delete"]) {
        const scope = storageScope(originalID);
        const initial = { [`${scope}/${presetID}.json`]: JSON.stringify(preset()), "unrelated/keep.json": "keep" };
        const files = userFiles(initial);
        await withFiles(files, async () => {
            const controller = sharedUI(new PatchConnection());
            await settle();
            files.fail(operation, scope);
            if (operation === "write") controller.overwriteUserPreset(`user:${presetID}`);
            else controller.deletePreset(`user:${presetID}`);
            await settle();
            assert.match(controller.getState().lastError, new RegExp(`Test ${operation} failed`));
            assert.deepEqual(Object.fromEntries(files.files), initial);
            assert.ok(files.calls.every((call) => call.scope === scope));
            controller.detach();
        });
    }
});

test("a failed legacy read can retry on host status without copying or losing old presets", async () => {
    const legacyPath = `${effectID}/${presetID}.json`;
    const legacyBytes = JSON.stringify(preset(), null, 4);
    const files = userFiles({ [legacyPath]: legacyBytes });
    files.fail("read", effectID);
    await withFiles(files, async () => {
        const connection = new PatchConnection();
        const controller = sharedUI(connection, { legacyFileStorePluginID: originalID });
        await settle();
        assert.match(controller.getState().lastError, /Test read failed/);
        assert.equal(controller.saveCurrentAsNewPreset("Still unavailable").ok, false);
        assert.deepEqual(connection.storedWrites, []);
        files.clearFailure();
        connection.requestStatusUpdate();
        await settle();
        assert.equal(controller.getState().lastError, null);
        assert.equal(controller.getState().userPresets[0].label, "Existing");
        assert.equal(files.files.get(legacyPath), legacyBytes);
        assert.ok(files.calls.every(({ operation }) => ["list", "read"].includes(operation)));
        assert.equal(controller.applyPreset(`user:${presetID}`).ok, true);
        assert.equal(connection.amount, 32);
        controller.detach();
    });
});

test("without native files, per-connection stored-state fallback retains the existing wire format and updates", () => {
    const first = new PatchConnection({ amount: 13 });
    const other = new PatchConnection({ pluginID: "com.example.other", amount: 84 });
    first.manifest = undefined; // Non-native/test views need no disk identity.
    const a = sharedUI(first);
    const b = sharedUI(other);
    assert.equal(a.saveCurrentAsNewPreset("A").ok, true);
    assert.equal(b.saveCurrentAsNewPreset("B").ok, true);
    const saved = JSON.parse(first.storedState[presetStateKey]);
    assert.equal(saved.version, 2);
    assert.equal(saved.userPresets[effectID][0].parameters.amount, 13);
    assert.equal(JSON.parse(other.storedState[presetStateKey]).userPresets[effectID][0].parameters.amount, 84);
    a.detach(); b.detach();
    const upgrade = sharedUI(new PatchConnection({ storedState: first.storedState, version: "9.0.0" }));
    assert.equal(upgrade.getState().userPresets[0].label, "A");
    upgrade.detach();
});

test("existing original-owner declarations match authoritative manifests, without central kit product rules", async () => {
    const consumers = [
        ["fx/enhancer_lite/view/source.ts", "fx/enhancer_lite/EnhancerLite.cmajorpatch", "enhancer-lite"],
        ["fx/chorus_lab/view/source.js", "fx/chorus_lab/ChorusLab.cmajorpatch", "chorus"],
        ["fx/ott_lab/view/source.js", "fx/ott_lab/OttLab.cmajorpatch", "ott"],
        ["fx/spectral_chord_resonator/view/source.js", "fx/spectral_chord_resonator/SpectralChordResonator.cmajorpatch", "spectral-chord-resonator"],
        ["fx/seqfx/view/SeqFxPatchView.tsx", "fx/seqfx/SeqFx.cmajorpatch", "seqfx"],
        ["ui/desktop/DesktopPatchView.tsx", "WavetableSynth.cmajorpatch", "cosimo-synth"],
    ];
    for (const [sourcePath, manifestPath, bankID] of consumers) {
        if (!existsSync(path.join(repoRoot, sourcePath))) continue; // Export includes only the shipped example.
        const source = await readFile(path.join(repoRoot, sourcePath), "utf8");
        const manifest = JSON.parse(await readFile(path.join(repoRoot, manifestPath), "utf8"));
        const owner = source.match(/legacyFileStorePluginID:\s*"([^"]+)"/);
        assert.equal(owner?.[1], manifest.ID, sourcePath);
        const bytes = JSON.stringify(preset({ bankID }));
        const files = userFiles({ [`${bankID}/${presetID}.json`]: bytes });
        await withFiles(files, async () => {
            const controller = sharedUI(new PatchConnection({ pluginID: manifest.ID }), { legacyFileStorePluginID: owner[1], bankID });
            await settle();
            assert.equal(controller.getState().userPresets[0].label, "Existing", sourcePath);
            assert.equal(files.files.get(`${bankID}/${presetID}.json`), bytes);
            assert.ok(files.calls.every(({ scope, operation }) => scope === bankID && ["list", "read"].includes(operation)));
            controller.detach();
        });
    }
});

test("the extracted hash preserves the existing UTF-8 SHA-256 algorithm", async () => {
    const { sha256 } = await loadUIModule(repoRoot, "kit/ui/sha256.ts");
    for (const text of ["", "abc", "🛠️ presets", "a".repeat(160), "x".repeat(1000)]) {
        assert.equal(sha256(text), createHash("sha256").update(text).digest("hex"));
    }
});
