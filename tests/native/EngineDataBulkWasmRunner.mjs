import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const capacity = 3_279_616;
const packetWords = 6144;
const periodFrames = 64;
const source = readFileSync(process.argv[2], "utf8");
const className = source.match(/^class\s+(\w+)/m)?.[1];
assert.ok(className, "Generated source must declare its performer class");
const Performer = Function(`${source}\nreturn ${className};`)();
const now = () => process.hrtime.bigint();
const elapsedUs = start => Number(now() - start) / 1000;
const word = (generation, index) => (index * 811 + generation * 194971) % 2_000_003 - 1_000_001;

function summary(values) {
    const samples = [...values].sort((a, b) => a - b);
    assert.ok(samples.length > 0);
    return { count: samples.length, medianUs: samples[Math.floor(samples.length / 2)],
        p95Us: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))],
        maximumUs: samples.at(-1) };
}

async function runCase(wordCount) {
    const performer = new Performer();
    const start = now();
    await performer.initialise(19081, 48_000);
    const createPerformerUs = elapsedUs(start);
    const times = Object.fromEntries(["begin", "chunkEvent", "advance64Frames", "commitEvent",
        "metadataResetEvent", "wholePerformerReinitialise", "queryEventBaseline", "idle64FramesBaseline"]
        .map(key => [key, []]));
    let scannedWordsPerChannel = 0;

    function send(endpoint, value) {
        const started = now();
        performer[`sendInputEvent_${endpoint}`](value);
        return elapsedUs(started);
    }
    function advance(frames) {
        const started = now();
        performer.advance(frames);
        return elapsedUs(started);
    }
    function expectReceipt(operation, scope, generation, receivedWords) {
        assert.equal(performer.getOutputEventCount_receipt(), 1, "One actual DSP receipt");
        const actual = performer.getOutputEvent_receipt(0).event;
        for (const [key, value] of Object.entries({ operation, scope, generation, receivedWords, status: 0 })) {
            assert.equal(actual[key], value, `Receipt ${key}: ${JSON.stringify(actual)}`);
        }
        performer.resetOutputEventCount_receipt();
    }
    function scan(currentGeneration, heldGeneration) {
        send("scanFrom", 0);
        for (let base = 0; base < wordCount; base += 512) {
            const frames = Math.min(512, wordCount - base);
            advance(frames);
            for (let index = 0; index < frames; index++) {
                const sample = performer.getOutputFrame_out(index);
                const current = currentGeneration === 0 ? 0 : word(currentGeneration, base + index);
                const held = heldGeneration === 0 ? 0 : word(heldGeneration, base + index);
                if (sample[0] !== current || sample[1] !== held || sample[2] !== held) {
                    assert.fail(`Wasm DSP word mismatch at ${base + index}: ${sample}; expected ${current},${held},${held}`);
                }
            }
        }
        scannedWordsPerChannel += wordCount;
        send("stopScan", 0);
        advance(periodFrames);
    }

    advance(periodFrames);
    for (let request = 1; request <= 32; request++) {
        times.queryEventBaseline.push(send("query", { request }));
        times.idle64FramesBaseline.push(advance(periodFrames));
        expectReceipt(5, 0, 0, 0);
    }
    const words = Array(packetWords).fill(0);
    const uploadStart = now();
    for (let generation = 1; generation <= 8; generation++) {
        times.begin.push(send("begin", { scope: 1, generation, wordCount }));
        advance(periodFrames);
        expectReceipt(1, 1, generation, 0);
        for (let offset = 0; offset < wordCount; offset += packetWords) {
            const count = Math.min(packetWords, wordCount - offset);
            for (let index = 0; index < count; index++) words[index] = word(generation, offset + index);
            times.chunkEvent.push(send("chunk", { scope: 1, generation, offset, count, words }));
            times.advance64Frames.push(advance(periodFrames));
            expectReceipt(2, 1, generation, offset + count);
            if (generation === 2 && offset === packetWords * Math.floor(Math.floor(wordCount / packetWords) / 2)) {
                scan(1, 1);
            }
        }
        if (generation === 2) scan(1, 1);
        times.commitEvent.push(send("commit", { scope: 1, generation }));
        advance(periodFrames);
        expectReceipt(3, 1, generation, wordCount);
        if (generation === 1) {
            for (let reader = 0; reader < 16; reader++) send("holdReader", reader);
            advance(periodFrames);
        }
        scan(generation, 1);
    }
    const uploadAndOracleUs = elapsedUs(uploadStart);
    for (let scope = 2; scope <= 33; scope++) {
        times.metadataResetEvent.push(send("resetScope", { scope }));
        advance(periodFrames);
        expectReceipt(4, scope, 0, 0);
    }
    scan(8, 1);
    // Generated JavaScript has a public async initialise operation, not the
    // C++ Performer.reset API. Report its full reinitialisation separately.
    for (let trial = 0; trial < 8; trial++) {
        const started = now();
        await performer.initialise(19081, 48_000);
        times.wholePerformerReinitialise.push(elapsedUs(started));
    }
    scan(0, 0);
    return { wordCount, capacityWords: capacity, slots: 3, heldReaders: 16, packetWords,
        packetPayloadBytes: packetWords * 4,
        logicalPayloadCapacityBytes: capacity * 3 * 4,
        minimumUploadAudioMs: Math.ceil(wordCount / packetWords) * periodFrames / 48,
        createPerformerUs, uploadAndOracleUs, ...Object.fromEntries(Object.entries(times).map(([key, value]) => [key, summary(value)])),
        scannedWordsPerChannel };
}

console.log(JSON.stringify([await runCase(257), await runCase(capacity)]));
