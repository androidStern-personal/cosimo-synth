// Throwaway probe: derive the decision-relevant numbers for the AudioAssetStore
// feasibility study from the constants in cmajor/FixedFrameOscillator.cmajor.
// Run: node PROBE_asset_math.mjs   (read-only; prints a table)

const samplesPerFrame = 2048;
const mipLevelCount = 11;
const maxFramesPerTable = 256;
const wavetableSlotCount = 4;
const chunkCount = 4;
const batchFrames = 3; // wavetableMipFrameBatchSize
const batchPayloadBytes = batchFrames * samplesPerFrame * 4; // float32[6144] = 24 KiB
const fifoBytes = 64 * 1024; // measured note at FixedFrameOscillator.cmajor:5-9

// packedMipLength(mip) = min(2048, max(256, 32 << mip))
const mipLen = (m) => Math.min(samplesPerFrame, Math.max(256, 32 << m));
const perFrameSet = Array.from({ length: mipLevelCount }, (_, m) => mipLen(m) + 1)
  .reduce((a, b) => a + b, 0);
console.log("packed ints per frame-set:", perFrameSet, "(source says 12811)");

const slotInts = perFrameSet * maxFramesPerTable;
const chunkInts = Math.ceil(slotInts / chunkCount);
const poolBytes = chunkInts * 4 * chunkCount * wavetableSlotCount;
console.log("slot ints:", slotInts, "chunk ints:", chunkInts, "(source asserts 819904)");
console.log("pool bytes total:", poolBytes, `= ${(poolBytes / 1048576).toFixed(1)} MiB in Cmajor performer state`);

// Upload traffic for ONE full 256-frame table (all 11 mips):
const batchesPerMip = Math.ceil(maxFramesPerTable / batchFrames);
const totalBatches = batchesPerMip * mipLevelCount;
const totalPayload = totalBatches * batchPayloadBytes;
console.log("\nfull 256-frame table upload:");
console.log("  batches:", totalBatches, `payload ≈ ${(totalPayload / 1048576).toFixed(1)} MiB of float32 events`);

// With ONE 24 KiB batch in flight (measured ceiling), each batch costs one
// ack round trip: >= 1 audio block on the DSP side + host/UI hop each way.
for (const rttMs of [3, 6, 10, 20]) {
  console.log(`  wall-clock at ${rttMs} ms/batch round-trip: ${(totalBatches * rttMs / 1000).toFixed(1)} s`);
}

// RT-thread work per batch event (receiveWavetableMipBatch):
// finiteness scan of 6144 floats + up to 3*(mipLen+1) pack ops (worst mip: 2049/frame)
console.log("\nper-batch audio-thread work: 6144-float finiteness scan + up to",
  3 * (samplesPerFrame + 1), "pack+scatter writes");

// Motivating future case: a modest multisample bank via the same protocol
const bankBytes = 200 * 1048576; // 200 MiB of sample data
const bankBatches = Math.ceil(bankBytes / batchPayloadBytes);
console.log("\nhypothetical 200 MiB multisample bank through the same event protocol:");
for (const rttMs of [3, 10]) {
  console.log(`  ${bankBatches} batches -> ${(bankBatches * rttMs / 1000 / 60).toFixed(1)} min at ${rttMs} ms/batch`);
}

// Browser wasm sizing: reserved renderer pages today
console.log("\nwasm: renderer reserved pages = 32 (2 MiB incl. 1 MiB stack); pool lives in Cmajor pages:",
  Math.ceil(poolBytes / 65536), "pages just for the pool");
