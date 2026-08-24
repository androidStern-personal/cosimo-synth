import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function be16(value) {
    return [(value >>> 8) & 0xff, value & 0xff];
}

function be32(value) {
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function ascii(value) {
    return [...value].map((character) => character.charCodeAt(0));
}

function vlq(value) {
    const bytes = [value & 0x7f];
    for (let remaining = value >>> 7; remaining > 0; remaining >>>= 7) {
        bytes.unshift((remaining & 0x7f) | 0x80);
    }
    return bytes;
}

function smf(format, division, tracks) {
    return Uint8Array.from([
        ...ascii("MThd"), ...be32(6), ...be16(format), ...be16(tracks.length), ...be16(division),
        ...tracks.flatMap((track) => [...ascii("MTrk"), ...be32(track.length), ...track]),
    ]);
}

function status(code) {
    return (code >>> 16) & 0xff;
}

function note(code) {
    return (code >>> 8) & 0x7f;
}

test("the vendored demo SMF parses to one exact one-second note and all-notes-off", async () => {
    const [{ parseSMF }, bytes] = await Promise.all([
        loadUIModule(repoRoot, "ui/speedrun/midi/smf.ts"),
        fs.readFile(path.join(repoRoot, "demo", "one_note.mid")),
    ]);
    const performance = parseSMF(bytes);

    assert.equal(performance.durationSec, 1);
    assert.deepEqual(performance.events.map((event) => ({ atSec: event.atSec, status: status(event.code), note: note(event.code) })), [
        { atSec: 0, status: 0x90, note: 60 },
        { atSec: 1, status: 0x80, note: 60 },
        { atSec: 1, status: 0xb0, note: 123 },
    ]);
});

test("format 0 preserves running status, CC, pitch bend, and tempo timing", async () => {
    const { parseSMF } = await loadUIModule(repoRoot, "ui/speedrun/midi/smf.ts");
    const track = [
        ...vlq(0), 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
        ...vlq(0), 0x90, 60, 100,
        ...vlq(240), 60, 0,
        ...vlq(0), 0xb0, 1, 64,
        ...vlq(0), 0xe0, 0, 64,
        ...vlq(240), 0xff, 0x2f, 0,
    ];
    const performance = parseSMF(smf(0, 480, [track]));

    assert.equal(performance.durationSec, 0.5);
    assert.deepEqual(performance.events.slice(0, -1).map((event) => [event.atSec, status(event.code)]), [
        [0, 0x90],
        [0.25, 0x90],
        [0.25, 0xb0],
        [0.25, 0xe0],
    ]);
    assert.equal(status(performance.events.at(-1).code), 0xb0);
    assert.equal(note(performance.events.at(-1).code), 123);
});

test("format 1 merges tracks through the shared tempo map", async () => {
    const { parseSMF } = await loadUIModule(repoRoot, "ui/speedrun/midi/smf.ts");
    const tempoTrack = [
        ...vlq(0), 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
        ...vlq(480), 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40,
        ...vlq(480), 0xff, 0x2f, 0,
    ];
    const noteTrack = [
        ...vlq(0), 0x91, 64, 100,
        ...vlq(960), 0x81, 64, 0,
        ...vlq(0), 0xff, 0x2f, 0,
    ];
    const performance = parseSMF(smf(1, 480, [tempoTrack, noteTrack]));

    assert.equal(performance.durationSec, 1.5);
    assert.deepEqual(performance.events.map((event) => [event.atSec, status(event.code)]), [
        [0, 0x91],
        [1.5, 0x81],
        [1.5, 0xb1],
    ]);
});

test("JSON note lists validate, sort, pack channels, and imply all-notes-off", async () => {
    const { parseJSONNoteList } = await loadUIModule(repoRoot, "ui/speedrun/midi/smf.ts");
    const performance = parseJSONNoteList([
        { note: 67, velocity: 88, onSec: 0.5, offSec: 1.1, channel: 2 },
        { note: 60, velocity: 100, onSec: 0, offSec: 0.4 },
    ]);

    assert.equal(performance.durationSec, 1.1);
    assert.deepEqual(performance.events.map((event) => [event.atSec, status(event.code), note(event.code)]), [
        [0, 0x90, 60],
        [0.4, 0x80, 60],
        [0.5, 0x92, 67],
        [1.1, 0x82, 67],
        [1.1, 0xb0, 123],
        [1.1, 0xb2, 123],
    ]);
    assert.throws(() => parseJSONNoteList([{ note: 60, velocity: 100, onSec: 1, offSec: 0.5 }]), /end after/i);

    const clipped = parseJSONNoteList({
        durationSec: 0.75,
        notes: [
            { note: 60, velocity: 100, onSec: 0.5, offSec: 2 },
            { note: 72, velocity: 100, onSec: 1, offSec: 2 },
        ],
    });
    assert.equal(clipped.durationSec, 0.75);
    assert.deepEqual(clipped.events.map((event) => [event.atSec, status(event.code), note(event.code)]), [
        [0.5, 0x90, 60],
        [0.75, 0x80, 60],
        [0.75, 0xb0, 123],
    ]);
});

test("malformed and unsupported SMF inputs fail at the parser boundary", async () => {
    const { parseSMF } = await loadUIModule(repoRoot, "ui/speedrun/midi/smf.ts");
    assert.throws(() => parseSMF(Uint8Array.from([1, 2, 3])), /truncated midi header/i);
    assert.throws(() => parseSMF(smf(2, 480, [[0, 0xff, 0x2f, 0]])), /format 2 is not supported/i);
    assert.throws(() => parseSMF(smf(0, 0x8001, [[0, 0xff, 0x2f, 0]])), /smpte/i);
});
