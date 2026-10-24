import assert from "node:assert/strict";
import test from "node:test";
import { createCosimoMidiHandler } from "../web/cosimo-midi.mjs";

test("browser selection rules consume keyswitches and deliver an indivisible articulated note", () => {
    const delivered = [];
    const midi = createCosimoMidiHandler({ sendMessageToServer: message => delivered.push(message) });
    const config = { activeMode: "key", key: Array(128).fill(-1), chain: Array(128).fill(-1), velocity: Array(128).fill(-1) };
    config.key[36] = 5;
    const send = packed => midi.sendMessageToServer({ type: "send_value", id: "midiIn", value: { message: packed } });
    assert.equal(midi.handleStateHostEffect("cosimo.articulation-trigger-config", JSON.stringify(config)), true);
    send(0x902464); send(0x802400);
    assert.deepEqual(delivered, [], "configured switch note and its release are not sounding notes");
    send(0x923c40);
    assert.deepEqual(delivered, [{ type: "send_value", id: "articulatedNoteOn", value: {
        channel: 2, pitch: 60, velocity: 64 / 127, hasArticulation: true,
        selectorA: 5, selectorB: 0, durationSamples: 0, ageSamples: 0,
    } }]);
    assert.equal(midi.handleStateHostEffect("unrelated", JSON.stringify(config)), false);
    assert.equal(midi.handleStateHostEffect("cosimo.articulation-trigger-config", "{}"), false);
    send(0x903e40);
    assert.equal(delivered.at(-1).value.selectorA, 5, "invalid configuration preserves accepted rules");
    config.activeMode = "vel"; config.velocity[100] = 8;
    assert.equal(midi.handleStateHostEffect("cosimo.articulation-trigger-config", JSON.stringify(config)), true);
    send(0x903c64);
    assert.equal(delivered.at(-1).value.selectorA, 8);
    send(0x903c00);
    assert.deepEqual(delivered.at(-1), { type: "send_value", id: "midiIn", value: { message: 0x903c00 } }, "zero velocity remains note-off");
    const parameter = { type: "send_value", id: "filterCutoff", value: 4000 };
    midi.sendMessageToServer(parameter);
    assert.deepEqual(delivered.at(-1), parameter, "ordinary parameter/state traffic is untouched");
});
