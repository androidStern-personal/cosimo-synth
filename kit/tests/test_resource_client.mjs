import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { createPatchConnectionResourceClient } = await loadUIModule(root, "kit/ui/resource-client.ts");

function monoWave(samples, sampleRate = 48000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const ascii = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
    ascii(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); ascii(8, "WAVE");
    ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ascii(36, "data"); view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.round(sample * 32768), true));
    return buffer;
}

test("text, JSON and bytes come through the host's resource bridge", async () => {
    const files = { "a.txt": "hello", "b.json": new TextEncoder().encode('{"gain":2}'), "c.bin": [1, 2, 3] };
    const client = createPatchConnectionResourceClient({ readResource: async path => files[path] });
    assert.equal(await client.readText("a.txt"), "hello");
    assert.deepEqual(await client.readJSON("b.json"), { gain: 2 });
    assert.deepEqual([...await client.readBytes("c.bin")], [1, 2, 3]);
    await assert.rejects(client.readBytes("missing.bin"), /returned missing\.bin in a form this kit cannot read/u);
});

test("audio decodes mono 16-bit WAV bytes and host-decoded mono frames, and names the fix for anything else", async () => {
    const wave = monoWave([0, 0.5, -0.5]);
    const fromBytes = await createPatchConnectionResourceClient({ readResource: async () => wave }).readAudio("tone.wav");
    assert.equal(fromBytes.sampleRate, 48000);
    assert.deepEqual([...fromBytes.samples], [0, 0.5, -0.5]);
    const decoded = await createPatchConnectionResourceClient({
        readResourceAsAudioData: async () => ({ sampleRate: 44100, frames: [[0.25], [0.75]] }),
    }).readAudio("tone.wav");
    assert.deepEqual({ sampleRate: decoded.sampleRate, samples: [...decoded.samples] }, { sampleRate: 44100, samples: [0.25, 0.75] });
    const stereo = createPatchConnectionResourceClient({ readResourceAsAudioData: async () => ({ sampleRate: 44100, frames: [[0, 1]] }) });
    await assert.rejects(stereo.readAudio("pair.wav"), /pair\.wav is not mono/u);
    const text = createPatchConnectionResourceClient({ readResource: async () => "not audio" });
    await assert.rejects(text.readAudio("notes.txt"), /notes\.txt is not a WAV file/u);
});

test("URLs use an absolute host address as given and resolve relative ones from the page's origin", t => {
    globalThis.location = { href: "http://127.0.0.1:5173/fx/gain/view/index.html" };
    t.after(() => { delete globalThis.location; });
    const client = createPatchConnectionResourceClient({ getResourceAddress: path => path === "remote.wav" ? "https://example.com/remote.wav" : `/assets/${path}` });
    assert.equal(client.getURL("remote.wav").href, "https://example.com/remote.wav");
    assert.equal(client.getURL("table.wav").href, "http://127.0.0.1:5173/assets/table.wav");
    assert.equal(createPatchConnectionResourceClient({}).getURL("table.wav").href, "http://127.0.0.1:5173/table.wav");
});

test("a bundle served outside the patch folder names the patch folder, and relative reads resolve from it", async t => {
    const originalFetch = globalThis.fetch;
    const fetched = [];
    globalThis.fetch = async url => {
        fetched.push(url);
        return { ok: true, arrayBuffer: async () => monoWave([0.5]) };
    };
    t.after(() => { globalThis.fetch = originalFetch; });
    const patchRoot = new URL("file:///plugins/MyPatch/");
    const client = createPatchConnectionResourceClient({ getResourceAddress: path => `/${path}` }, { patchRoot });
    assert.equal(client.getURL("assets/table.wav").href, "file:///plugins/MyPatch/assets/table.wav");
    assert.equal(createPatchConnectionResourceClient({}, { patchRoot }).getURL("notes.txt").href, "file:///plugins/MyPatch/notes.txt");
    const audio = await client.readAudio("assets/table.wav");
    assert.deepEqual([...audio.samples], [0.5]);
    assert.deepEqual(fetched, ["file:///plugins/MyPatch/assets/table.wav"]);
});
