import { quantizeFloatToInt16 } from "./bank-format.mjs";
import { validateBounceCapturePlan } from "./capture-plan.mjs";

function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function endpointMethod(performer, prefix, endpointID) {
    const name = `${prefix}_${endpointID}`;
    const method = performer[name];
    invariant(typeof method === "function", `Offline performer is missing ${name}()`);
    return method.bind(performer);
}

function advanceDiscard(performer, frameCount, blockFrames) {
    let remaining = frameCount;
    while (remaining > 0) {
        const count = Math.min(blockFrames, remaining);
        performer.advance(count);
        remaining -= count;
    }
}

function renderInto(performer, destination, destinationFrameOffset, frameCount, blockFrames) {
    const left = new Float32Array(blockFrames);
    const right = new Float32Array(blockFrames);
    let rendered = 0;
    while (rendered < frameCount) {
        const count = Math.min(blockFrames, frameCount - rendered);
        performer.advance(count);
        performer.getOutputFrames_audioOut([left, right], count, 0);
        for (let frame = 0; frame < count; frame += 1) {
            const target = (destinationFrameOffset + rendered + frame) * 2;
            destination[target] = left[frame];
            destination[target + 1] = right[frame];
        }
        rendered += count;
    }
}

function stereoWindowRms(samples, firstFrame, frameCount) {
    let sumSquares = 0;
    const lastFrame = Math.min(samples.length / 2, firstFrame + frameCount);
    const actualFrames = Math.max(0, lastFrame - firstFrame);
    if (actualFrames === 0) return 0;
    for (let frame = firstFrame; frame < lastFrame; frame += 1) {
        const offset = frame * 2;
        const left = samples[offset];
        const right = samples[offset + 1];
        sumSquares += ((left * left) + (right * right)) * 0.5;
    }
    return Math.sqrt(sumSquares / actualFrames);
}

function findTailEndFrame(samples, noteOffFrameOffset, plan) {
    const totalFrames = samples.length / 2;
    let lastActiveFrame = noteOffFrameOffset;
    for (let firstFrame = noteOffFrameOffset;
        firstFrame < totalFrames;
        firstFrame += plan.silenceWindowFrames) {
        const count = Math.min(plan.silenceWindowFrames, totalFrames - firstFrame);
        if (stereoWindowRms(samples, firstFrame, count) >= plan.silenceThresholdLinear) {
            lastActiveFrame = firstFrame + count;
        }
    }
    return Math.min(totalFrames, Math.max(
        noteOffFrameOffset + 4,
        lastActiveFrame + plan.tailPaddingFrames,
    ));
}

function peakAbsolute(samples, frameCount = samples.length / 2) {
    let peak = 0;
    for (let index = 0; index < frameCount * 2; index += 1) {
        peak = Math.max(peak, Math.abs(samples[index]));
    }
    return peak;
}

async function preparePerformer(CmajorClass, plan, job) {
    invariant(typeof CmajorClass === "function", "Offline engine module has no performer class");
    const performer = new CmajorClass();
    invariant(typeof performer.initialise === "function", "Offline performer has no initialise() method");
    await performer.initialise(job.sessionID, plan.snapshot.sampleRate);

    for (const parameter of plan.snapshot.parameters) {
        invariant(typeof parameter.value === "number",
            `Cmajor value endpoint ${parameter.endpointID} must receive a number`);
        endpointMethod(performer, "setInputValue", parameter.endpointID)(parameter.value, 0);
    }

    endpointMethod(performer, "sendInputEvent", "tempo")({ bpm: plan.snapshot.tempoBpm });
    advanceDiscard(performer, 1, plan.blockFrames);

    for (const event of plan.snapshot.setupEvents) {
        const value = event.sessionScoped
            ? { ...event.value, dspSessionId: job.sessionID }
            : event.value;
        endpointMethod(performer, "sendInputEvent", event.endpointID)(value);
        advanceDiscard(performer, event.advanceFrames, plan.blockFrames);
    }
    advanceDiscard(performer, plan.snapshot.settleFrames, plan.blockFrames);
    return performer;
}

/** Render one root using a fresh generated performer. This function is worker-safe. */
export async function renderBounceRoot(CmajorClass, planInput, jobInput) {
    const plan = validateBounceCapturePlan(planInput);
    const job = plan.jobs.find((candidate) => candidate.rootIndex === jobInput?.rootIndex);
    invariant(job !== undefined && job.rootNote === jobInput?.rootNote,
        "Bounce worker received a job outside its plan");

    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    const performer = await preparePerformer(CmajorClass, plan, job);
    const totalRenderFrames = plan.holdFrames + plan.tailCapFrames;
    const rendered = new Float32Array(totalRenderFrames * 2);

    for (const event of plan.snapshot.rootSetupEvents) {
        const value = {
            ...event.value,
            [event.rootNoteField]: job.rootNote,
            ...(event.sessionScoped ? { dspSessionId: job.sessionID } : {}),
        };
        endpointMethod(performer, "sendInputEvent", event.endpointID)(value);
        advanceDiscard(performer, event.advanceFrames, plan.blockFrames);
    }
    endpointMethod(performer, "sendInputEvent", "midiIn")({
        message: packMidi(0x90, job.rootNote, plan.captureVelocity),
    });
    renderInto(performer, rendered, 0, plan.holdFrames, plan.blockFrames);
    endpointMethod(performer, "sendInputEvent", "midiIn")({
        message: packMidi(0x80, job.rootNote, 0),
    });
    renderInto(
        performer,
        rendered,
        plan.holdFrames,
        plan.tailCapFrames,
        plan.blockFrames,
    );

    const retainedFrameCount = findTailEndFrame(rendered, plan.holdFrames, plan);
    const peak = peakAbsolute(rendered, retainedFrameCount);
    invariant(peak >= plan.silenceThresholdLinear,
        `Bounce root ${job.rootNote} captured silence`);
    const samples = new Int16Array(retainedFrameCount * 2);
    for (let index = 0; index < samples.length; index += 1) {
        samples[index] = quantizeFloatToInt16(rendered[index]);
    }
    const elapsedMilliseconds = (globalThis.performance?.now?.() ?? Date.now()) - startedAt;

    return {
        rootIndex: job.rootIndex,
        rootNote: job.rootNote,
        noteOffFrameOffset: plan.holdFrames,
        frameCount: retainedFrameCount,
        tailFrameCount: retainedFrameCount - plan.holdFrames,
        peak,
        samples,
        metrics: {
            renderedFrameCount: totalRenderFrames,
            elapsedMilliseconds,
            realtimeMultiplier: elapsedMilliseconds > 0
                ? totalRenderFrames / (elapsedMilliseconds * plan.snapshot.sampleRate / 1000)
                : null,
        },
    };
}

export const bounceOfflineRenderInternals = Object.freeze({
    findTailEndFrame,
    stereoWindowRms,
});
