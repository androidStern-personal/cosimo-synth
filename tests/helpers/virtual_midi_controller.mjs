/**
 * A MIDI controller plugged into the page, as Web MIDI presents one. The synth
 * page opens every Web MIDI input when audio starts; this one is the only
 * input, and the test plays it with sendMidi().
 *
 * Call before the page loads: the controller exists from the first script on.
 */
export async function installVirtualMidiController(page) {
    await page.addInitScript(() => {
        const input = {
            id: "virtual-midi-controller",
            name: "Virtual MIDI Controller",
            manufacturer: "Cosimo tests",
            type: "input",
            state: "connected",
            connection: "open",
            onmidimessage: null,
        };
        const access = {
            inputs: new Map([[input.id, input]]),
            outputs: new Map(),
            sysexEnabled: true,
            onstatechange: null,
        };
        Object.defineProperty(Navigator.prototype, "requestMIDIAccess", {
            configurable: true,
            value: async () => access,
        });
        Object.defineProperty(globalThis, "virtualMidiController", {
            value: Object.freeze({
                get opened() { return typeof input.onmidimessage === "function"; },
                send(bytes) { input.onmidimessage({ data: Uint8Array.from(bytes) }); },
            }),
        });
    });
}

/** Sends one MIDI message from the virtual controller once the synth has opened it. */
export async function sendMidi(page, bytes) {
    await page.waitForFunction(() => globalThis.virtualMidiController.opened, null, { timeout: 10_000 });
    await page.evaluate((message) => globalThis.virtualMidiController.send(message), bytes);
}

/** MPE slide: CC74 on a member channel (0-based), with a 0...1 value. */
export function mpeSlide(value, channel) {
    return [0xb0 | channel, 74, Math.round(value * 127)];
}

/** MPE pressure: channel pressure on a member channel (0-based), with a 0...1 value. */
export function mpePressure(value, channel) {
    return [0xd0 | channel, Math.round(value * 127)];
}
