import assert from "node:assert/strict";
import test from "node:test";

import {
    assertCanonicalRuntimePhaseOrder,
    createCanonicalRuntimeBuildInvocation,
    qualificationPhases,
} from "../scripts/qualify_seqfx_source.mjs";

test("aggregate SeqFX runtime regeneration is isolated from the later interactive Vite server", () => {
    assert.deepEqual(createCanonicalRuntimeBuildInvocation("/approved/node"), {
        command: "/approved/node",
        arguments: ["kit/fx/build-effect.mjs", "seqfx"],
        environment: {
            SEQFX_CANONICAL_RUNTIME_PREBUILT: "0",
        },
    });
});

test("aggregate SeqFX qualification regenerates one canonical runtime before every packaged claim", () => {
    const generationIndexes = qualificationPhases
        .map((phase, index) => phase.producesCanonicalRuntime ? index : -1)
        .filter((index) => index >= 0);
    const claimIndexes = qualificationPhases
        .map((phase, index) => phase.requiresCanonicalRuntime ? index : -1)
        .filter((index) => index >= 0);

    assert.equal(generationIndexes.length, 1);
    assert.ok(claimIndexes.length > 0);
    assert.ok(claimIndexes.every((index) => index > generationIndexes[0]));
    assert.doesNotThrow(() => assertCanonicalRuntimePhaseOrder(qualificationPhases));
    assert.throws(
        () => assertCanonicalRuntimePhaseOrder(
            qualificationPhases.filter((phase) => !phase.producesCanonicalRuntime),
        ),
        /exactly one canonical SeqFX runtime regeneration/u,
    );
    assert.throws(
        () => assertCanonicalRuntimePhaseOrder([
            ...qualificationPhases.filter((phase) => phase.requiresCanonicalRuntime),
            ...qualificationPhases.filter((phase) => !phase.requiresCanonicalRuntime),
        ]),
        /must run before every packaged runtime claim/u,
    );
    assert.throws(
        () => assertCanonicalRuntimePhaseOrder([{
            producesCanonicalRuntime: true,
            requiresCanonicalRuntime: true,
        }]),
        /must run before every packaged runtime claim/u,
    );
});
