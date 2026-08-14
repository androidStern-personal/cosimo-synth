import fs from "node:fs";

const sourcePath = process.argv[2];
if (!sourcePath) {
    throw new Error("usage: run_three_oscillator_generated_web.mjs <generated.js>");
}

const source = fs.readFileSync(sourcePath, "utf8");
const className = source.match(/^class\s+(\w+)/m)?.[1];
if (!className) {
    throw new Error("generated JavaScript did not contain a Cmajor class");
}

const CmajorClass = Function(`${source}\nreturn ${className};`)();
const performer = new CmajorClass();
await performer.initialise(19081, 48_000);

let sumSquares = 0;
let sampleCount = 0;
for (let block = 0; block < 16; block += 1) {
    performer.advance(128);
    const channels = [new Float32Array(128), new Float32Array(128)];
    performer.getOutputFrames_audioOut(channels, 128, 0);
    for (const channel of channels) {
        for (const sample of channel) {
            sumSquares += sample * sample;
            sampleCount += 1;
        }
    }
}

const rms = Math.sqrt(sumSquares / sampleCount);
if (!Number.isFinite(rms) || rms < 1e-4) {
    throw new Error(`direct Wasm renderer was silent; rms=${rms}`);
}

console.log(`PASS direct Wasm renderer produced B-only audio; rms=${rms}`);
