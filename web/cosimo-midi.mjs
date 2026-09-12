/** Browser counterpart of the native articulation MIDI handler. The worker
 * installs selection rules here after installing the matching sound settings. */
export function createCosimoMidiHandler(connection) {
    const send = connection.sendMessageToServer.bind(connection);
    let config = { activeMode: "chain", key: [], velocity: [] };
    let selected = -1;
    const swallowed = new Set();

    function handleStateHostEffect(name, value) {
        if (name !== "cosimo.articulation-trigger-config" || typeof value !== "string") return false;
        let next;
        try { next = JSON.parse(value); } catch { return false; }
        if (!next || !["chain", "key", "vel"].includes(next.activeMode)) return false;
        const validMap = map => Array.isArray(map) && map.length === 128
            && map.every(slot => Number.isInteger(slot) && slot >= -1 && slot < 128);
        if (![next.chain, next.key, next.velocity].every(validMap)) return false;
        config = next;
        selected = -1;
        swallowed.clear();
        return true;
    }

    function sendMessageToServer(message) {
        if (message?.type !== "send_value" || message.id !== "midiIn"
            || !Number.isInteger(message.value?.message)) return send(message);
        const packed = message.value.message;
        const status = (packed >>> 16) & 0xff;
        const note = (packed >>> 8) & 0x7f;
        const velocity = packed & 0x7f;
        const channel = status & 15;
        const on = (status & 0xf0) === 0x90 && velocity > 0;
        const off = (status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0);
        const key = channel * 128 + note;
        if (config.activeMode === "key") {
            if (on && config.key[note] >= 0) { selected = config.key[note]; swallowed.add(key); return; }
            if (off && (swallowed.has(key) || config.key[note] >= 0)) { swallowed.delete(key); return; }
        }
        const slot = config.activeMode === "key" ? selected : config.activeMode === "vel" ? config.velocity[velocity] : -1;
        if (on && slot >= 0) {
            // One DSP event carries both the note and its selection. They cannot
            // be separated by an audio block or another concurrently queued note.
            return send({ ...message, id: "articulatedNoteOn", value: {
                channel, pitch: note, velocity: velocity / 127, hasArticulation: true,
                selectorA: slot, selectorB: 0, durationSamples: 0, ageSamples: 0,
            } });
        }
        return send(message);
    }
    return { handleStateHostEffect, sendMessageToServer };
}
