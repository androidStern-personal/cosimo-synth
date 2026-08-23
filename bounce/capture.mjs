import {
    BOUNCE_BANK_FRAME_CAPACITY,
    buildBounceBank,
    encodeBounceBank,
} from "./bank-format.mjs";
import { createBounceCapturePlan } from "./capture-plan.mjs";
import { digestBounceBank } from "./digest.mjs";
import { renderBouncePlanInWorkers } from "./worker-pool.mjs";

export { digestBounceBank } from "./digest.mjs";

/** Snapshot -> plan -> fresh worker renders -> bank -> content digest. */
export async function captureBounceBank({
    snapshot,
    planOptions,
    workerURL,
    engineModuleURL,
    workerFactory,
    concurrency,
    signal,
    onProgress,
    renderPlan = renderBouncePlanInWorkers,
}) {
    const plan = createBounceCapturePlan(snapshot, planOptions);
    const results = await renderPlan({
        plan,
        workerURL,
        engineModuleURL,
        workerFactory,
        concurrency,
        signal,
        onProgress,
    });
    if (!Array.isArray(results) || results.length !== plan.roots.length) {
        throw new Error("Bounce capture did not return every planned root");
    }
    const ordered = [...results].sort((left, right) => left.rootIndex - right.rootIndex);
    ordered.forEach((result, index) => {
        if (result.rootIndex !== index || result.rootNote !== plan.roots[index]
            || !(result.samples instanceof Int16Array)) {
            throw new Error(`Bounce capture returned an invalid root at index ${index}`);
        }
    });

    const totalFrameCount = ordered.reduce((sum, result) => sum + result.frameCount, 0);
    if (totalFrameCount > BOUNCE_BANK_FRAME_CAPACITY) {
        throw new Error(
            `Bounce capture needs ${totalFrameCount} frames; the live bank capacity is ${BOUNCE_BANK_FRAME_CAPACITY}`,
        );
    }
    const bank = buildBounceBank({
        sampleRate: plan.snapshot.sampleRate,
        roots: ordered.map((result) => ({
            note: result.rootNote,
            noteOffFrameOffset: result.noteOffFrameOffset,
            samples: result.samples,
        })),
    });
    const bytes = encodeBounceBank(bank);
    const digest = await digestBounceBank(bytes);
    const segments = Object.freeze(ordered.map((result, index) => Object.freeze({
        rootNote: result.rootNote,
        frameOffset: bank.roots[index].frameOffset,
        frameCount: result.frameCount,
        noteOffFrameOffset: result.noteOffFrameOffset,
        tailFrameCount: result.tailFrameCount,
    })));

    return Object.freeze({
        plan,
        bank,
        bytes,
        digest,
        segments,
        metrics: Object.freeze(ordered.map((result) => Object.freeze({
            rootNote: result.rootNote,
            ...result.metrics,
        }))),
    });
}
