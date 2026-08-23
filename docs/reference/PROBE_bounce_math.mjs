// Throwaway probe: bounce-in-place sizing/timing model from repo constants.
// Run: node PROBE_bounce_math.mjs
const SR = 48000, CH = 2, F32 = 4, I16 = 2;
const batchBytes = 3 * 2048 * 4;            // 24 KiB FIFO batch (measured ceiling: 1 in flight)
const rttMs = 3;                            // calibrated from T22 (203ms/66 batches)

function grid(range = [24, 96], step = 3) {
  const roots = [];
  for (let n = range[0]; n <= range[1]; n += step) roots.push(n);
  return roots;
}
const mb = (b) => (b / 1048576).toFixed(1);

console.log("root grid options (MIDI 24..96):");
for (const step of [3, 4, 6]) {
  const roots = grid([24, 96], step).length;
  // capture: hold H + release tail T per root; sustain+release segments contiguous
  for (const [H, T] of [[3, 3], [4, 6]]) {
    const seconds = roots * (H + T);
    const f32 = seconds * SR * CH * F32;
    const i16 = seconds * SR * CH * I16;
    const installBatches = Math.ceil(i16 / batchBytes);
    console.log(
      `  step ${step}st -> ${roots} roots | hold ${H}s + tail ${T}s = ${seconds}s audio | ` +
      `bank f32 ${mb(f32)} MiB / i16 ${mb(i16)} MiB | FIFO install(i16) ${installBatches} batches ≈ ${(installBatches * rttMs / 1000).toFixed(1)}s`);
  }
}

// Max repitch error with nearest-root selection: half the grid step.
for (const step of [3, 4, 6])
  console.log(`step ${step}st: max repitch ±${step / 2} st, rate ∈ [${(2 ** (-step / 24)).toFixed(3)}, ${(2 ** (step / 24)).toFixed(3)}] — no mip pyramid needed below ~±2st`);

// Offline render wall-clock at assumed speed factors (single voice, full chain).
// No measured single-voice offline number exists in-repo [U]; bounded guesses:
console.log("\nrender wall-clock for 78s of capture audio at offline speed X×:");
for (const x of [3, 6, 12, 25])
  console.log(`  ${x}× realtime -> ${(78 / x).toFixed(0)}s single-threaded; ÷4 workers (browser) -> ${(78 / x / 4).toFixed(1)}s`);

// Playback gain staging: capture is post trim(0.18)+rack+limiter; sampled voices
// re-enter pre-trim, so playback needs makeup 1/0.18 before trim for unity.
console.log(`\ntrim makeup gain = 1/0.18 = ${(1 / 0.18).toFixed(3)} (${(20 * Math.log10(1 / 0.18)).toFixed(1)} dB)`);

// State cost if the bank lives in Cmajor state (V1, 16-bit packed 2/int32):
const bankCap = 13 * 8 * SR * CH;           // samples, 13 roots x 8s
const bankInts = Math.ceil(bankCap / 2);
console.log(`\nV1 in-state bank cap (13 roots x 8s stereo, 16-bit packed): ${bankCap.toLocaleString()} samples -> ${bankInts.toLocaleString()} int32 = ${mb(bankInts * 4)} MiB added to the 52 MiB pool state`);
