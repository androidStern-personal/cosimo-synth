import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("offline host clears output FIFOs before ack listeners send the next command", async () => {
    const { OfflineEngineHost } = await loadUIModule(
        repoRoot,
        "ui/speedrun/audio/offline-engine-host.ts",
    );
    const log = [];
    class ProbePerformer {
        outputCount = 1;
        async initialise() {}
        getInputEndpoints() {
            return [
                { endpointID: "next", endpointType: "event" },
                { endpointID: "gain", endpointType: "value", purpose: "parameter" },
            ];
        }
        getOutputEndpoints() {
            return [{ endpointID: "ack", endpointType: "event" }];
        }
        advance(frameCount) { log.push(["advance", frameCount]); }
        getOutputEventCount_ack() { return this.outputCount; }
        getOutputEvent_ack() { return { event: { serial: 1 } }; }
        resetOutputEventCount_ack() {
            log.push(["reset"]);
            this.outputCount = 0;
        }
        sendInputEvent_next(value) { log.push(["send", value]); }
        setInputValue_gain(value) { log.push(["value", value]); }
    }
    const host = new OfflineEngineHost(
        ProbePerformer,
        { modulation: {}, lane: {}, articulations: {} },
        "https://example.test/",
    );
    host.addEndpointListener("ack", () => host.sendEventOrValue("next", { serial: 2 }));
    await host.initialise(1, 48_000);
    await host.pump(257);

    assert.deepEqual(log.slice(0, 3), [
        ["advance", 128],
        ["reset"],
        ["send", { serial: 2 }],
    ]);
    assert.deepEqual(log.filter(([kind]) => kind === "advance"), [
        ["advance", 128],
        ["advance", 128],
        ["advance", 1],
    ]);
});
