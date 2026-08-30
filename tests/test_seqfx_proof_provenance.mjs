import test from "node:test";
import assert from "node:assert/strict";

import {
    compareSeqFxProofProvenance,
    createSeqFxSourceFingerprint,
} from "../scripts/seqfx-proof-provenance.mjs";

function proof(source) {
    return {
        head: "a".repeat(40),
        tree: "b".repeat(40),
        branch: "codex/seqfx",
        dirtyStatus: [],
        packageLockSha256: "c".repeat(64),
        source,
        artifacts: [{ path: "build/app.js", bytes: 3, sha256: "d".repeat(64) }],
    };
}

test("SeqFX source provenance is deterministic and changes when source bytes change", () => {
    const first = createSeqFxSourceFingerprint([
        { path: "fx/seqfx/a.ts", bytes: "alpha" },
        { path: "fx/seqfx/b.ts", bytes: "beta" },
    ]);
    const reordered = createSeqFxSourceFingerprint([
        { path: "fx/seqfx/b.ts", bytes: "beta" },
        { path: "fx/seqfx/a.ts", bytes: "alpha" },
    ]);
    const edited = createSeqFxSourceFingerprint([
        { path: "fx/seqfx/a.ts", bytes: "alpha dirty edit" },
        { path: "fx/seqfx/b.ts", bytes: "beta" },
    ]);

    assert.deepEqual(reordered, first);
    assert.notEqual(edited.aggregateSha256, first.aggregateSha256);
});

test("SeqFX proof provenance rejects absolute and parent-relative paths", () => {
    assert.throws(
        () => createSeqFxSourceFingerprint([{ path: "/Users/example/source.ts", bytes: "x" }]),
        /repository-relative/,
    );
    assert.throws(
        () => createSeqFxSourceFingerprint([{ path: "../foreign/source.ts", bytes: "x" }]),
        /repository-relative/,
    );
});

test("SeqFX proof provenance reports source, status, and artifact drift", () => {
    const source = createSeqFxSourceFingerprint([{ path: "fx/seqfx/a.ts", bytes: "alpha" }]);
    const before = proof(source);
    const after = {
        ...proof(createSeqFxSourceFingerprint([{ path: "fx/seqfx/a.ts", bytes: "changed" }])),
        dirtyStatus: [" M fx/seqfx/a.ts"],
        artifacts: [{ path: "build/app.js", bytes: 4, sha256: "e".repeat(64) }],
    };
    const failures = compareSeqFxProofProvenance(before, after);

    assert.ok(failures.includes("dirtyStatus changed during capture"));
    assert.ok(failures.includes("source aggregate changed during capture"));
    assert.ok(failures.includes("built artifact hashes changed during capture"));
});
