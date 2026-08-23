import {
    BOUNCE_BANK_FRAME_CAPACITY,
    BOUNCE_BANK_MAX_ROOTS,
    BOUNCE_BANK_VERSION,
} from "./bank-format.mjs";

export const BOUNCE_BANK_BATCH_FRAMES = 6_000;

function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function packStereoFrame(left, right) {
    return ((right & 0xffff) << 16) | (left & 0xffff);
}

export function validateInstallableBounceBank(bank) {
    invariant(bank?.version === BOUNCE_BANK_VERSION, "Unsupported Bounce bank version");
    invariant(Number.isInteger(bank.sampleRate) && bank.sampleRate > 0,
        "Bounce bank has an invalid sample rate");
    invariant(Array.isArray(bank.roots) && bank.roots.length > 0
        && bank.roots.length <= BOUNCE_BANK_MAX_ROOTS,
    "Bounce bank has an invalid root count");
    invariant(bank.pcm instanceof Int16Array && bank.pcm.length === bank.totalFrameCount * 2,
        "Bounce bank PCM does not match its frame count");
    invariant(bank.totalFrameCount <= BOUNCE_BANK_FRAME_CAPACITY,
        "Bounce bank exceeds live-engine capacity");
    return bank;
}

function rootMetadata(bank) {
    const rootNotes = new Int32Array(BOUNCE_BANK_MAX_ROOTS);
    const rootFrameOffsets = new Int32Array(BOUNCE_BANK_MAX_ROOTS);
    const rootFrameCounts = new Int32Array(BOUNCE_BANK_MAX_ROOTS);
    bank.roots.forEach((root, index) => {
        rootNotes[index] = root.note;
        rootFrameOffsets[index] = root.frameOffset;
        rootFrameCounts[index] = root.frameCount;
    });
    return { rootNotes, rootFrameOffsets, rootFrameCounts };
}

/** Yield the exact ack-paced Cmajor protocol without retaining duplicate PCM. */
export function* bounceBankInstallMessages(bankInput, {
    dspSessionId,
    generation,
    firstDeliverySerial = 1,
} = {}) {
    const bank = validateInstallableBounceBank(bankInput);
    invariant(Number.isInteger(dspSessionId) && dspSessionId >= 0,
        "Bounce install requires a non-negative integer session ID");
    invariant(Number.isInteger(generation) && generation > 0,
        "Bounce install requires a positive generation");
    invariant(Number.isInteger(firstDeliverySerial) && firstDeliverySerial > 0,
        "Bounce install requires a positive delivery serial");
    let deliverySerial = firstDeliverySerial;
    yield {
        endpointID: "bounceBankLoadBegin",
        deliverySerial,
        value: {
            dspSessionId,
            generation,
            deliverySerial,
            sampleRate: bank.sampleRate,
            rootCount: bank.roots.length,
            totalFrameCount: bank.totalFrameCount,
            ...rootMetadata(bank),
        },
    };
    deliverySerial += 1;

    for (let frameIndexBase = 0;
        frameIndexBase < bank.totalFrameCount;
        frameIndexBase += BOUNCE_BANK_BATCH_FRAMES) {
        const frameCount = Math.min(
            BOUNCE_BANK_BATCH_FRAMES,
            bank.totalFrameCount - frameIndexBase,
        );
        const packedFrames = new Int32Array(BOUNCE_BANK_BATCH_FRAMES);
        for (let frame = 0; frame < frameCount; frame += 1) {
            const source = (frameIndexBase + frame) * 2;
            packedFrames[frame] = packStereoFrame(bank.pcm[source], bank.pcm[source + 1]);
        }
        yield {
            endpointID: "bounceBankFrameBatch",
            deliverySerial,
            value: {
                dspSessionId,
                generation,
                deliverySerial,
                frameIndexBase,
                frameCount,
                packedFrames,
            },
        };
        deliverySerial += 1;
    }

    yield {
        endpointID: "bounceBankCommit",
        deliverySerial,
        value: { dspSessionId, generation, deliverySerial },
    };
}

/** Pump an install into a generated offline class, one acknowledged event at a time. */
export function installBounceBankInOfflinePerformer(performer, bank, options) {
    let lastDeliverySerial = 0;
    for (const message of bounceBankInstallMessages(bank, options)) {
        const method = performer[`sendInputEvent_${message.endpointID}`];
        invariant(typeof method === "function",
            `Offline performer is missing ${message.endpointID}`);
        method.call(performer, message.value);
        performer.advance(2);
        lastDeliverySerial = message.deliverySerial;
    }
    return lastDeliverySerial;
}
