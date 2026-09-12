import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadUIModule } from "../../kit/tests/helpers/load_ui_module.mjs";
import { stageCmajorWebRuntime } from "../../ui/vite.shared.mjs";
import { createSynthParameterFixture } from "./synth_parameter_fixture.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const modules = Promise.all([
    loadUIModule(root, "ui/shared/mock-plugin-state-host.ts"),
    loadUIModule(root, "ui/shared/modulation-client.ts"),
    loadUIModule(root, "kit/ui/plugin-state-cmajor.ts"),
    loadUIModule(root, "ui/shared/synth-plugin-state.ts"),
]);
let runtime;
export async function loadChannel() {
    runtime ??= process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE
        ? path.join(process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE, "javascript/cmaj_api")
        : stageCmajorWebRuntime(root, { buildDirectory: path.join(root, "build/cmajor_web_runtime-modulation-regressions"), instanceId: String(process.pid) });
    return import(pathToFileURL(path.join(runtime, "cmaj-plugin-state-channel.js")).href);
}
export async function waitForModulation(predicate, describe = () => "") {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, `production modulation client did not settle ${describe()}`);
        await new Promise(resolve => setImmediate(resolve));
    }
}

/** Only native saved storage is substituted. The real channel/service/client
 * hydrate, validate, accept, publish, restore and record every edit. No engine
 * receiver is supplied: the declared engine reports unavailable while these
 * retain the GUI module's no-direct-upload oracle. */
export async function createModulationFixture(t, connection) {
    const [{ createMockPluginStateHost }, { createModulationStateClient }, { createCmajorPluginStateClient }, { synthPluginState }] = await modules;
    const defects = [];
    const { readParameter } = createSynthParameterFixture();
    const host = createMockPluginStateHost({
        loadChannel,
        readParameter,
        writeParameter() { assert.fail("Modulation must not write a host-owned parameter"); },
        storedValues: {
            read(key) { connection.requestedKeys?.push(key); return connection.storedState[key]; },
            write: (key, value) => connection.sendStoredStateValue(key, value),
        },
        beginGesture() {}, endGesture() {}, onDefect: error => defects.push(error),
    });
    const client = createCmajorPluginStateClient(synthPluginState, host, { onDefect: error => defects.push(error) });
    const bridge = createModulationStateClient(client);
    t.after(async () => { await bridge.stop(); client.stop(); await host.stop(); assert.deepEqual(defects, []); });
    await host.ready;
    await waitForModulation(() => client.getSnapshot().kind === "ready");
    return {
        bridge, client,
        async restore(key, value) {
            const document = client.getSnapshot().state.scope.document;
            assert.equal(host.replaceStoredValue(key, () => {
                connection.storedState[key] = value;
                // Exercise the legacy raw notification surface too. The shared
                // client must use its authenticated state update, not this echo.
                for (const listener of connection.storedStateListeners ?? connection.listeners ?? []) listener({ key, value });
            }), true);
            await waitForModulation(() => client.getSnapshot().kind === "ready" && client.getSnapshot().state.scope.document > document,
                () => JSON.stringify({ state: client.getSnapshot().kind === "ready" ? client.getSnapshot().state.scope : client.getSnapshot(), defects: defects.map(error => String(error)) }));
        },
    };
}
