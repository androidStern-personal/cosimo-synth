import { readFileSync } from "node:fs";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("usage: EngineDataWasmRunner.mjs <generated-javascript>");
const source = readFileSync(sourcePath, "utf8");
const className = source.match(/^class\s+(\w+)/m)?.[1];
if (!className) throw new Error("Cmajor generated source has no performer class");
const Performer = Function(`${source}\nreturn ${className};`)();
const performer = new Performer();
await performer.initialise(19081, 48_000);

for (const line of readFileSync(0, "utf8").split("\n")) {
    if (!line) continue;
    const command = JSON.parse(line);
    const frames = command.frames ?? 1;
    if (!Number.isInteger(frames) || frames < 1 || frames > 512) {
        throw new Error("frames must be 1..512");
    }
    for (const [endpoint, value] of Object.entries(command.values ?? {})) {
        const setValue = performer[`setInputValue_${endpoint}`];
        if (typeof setValue !== "function") throw new Error(`Unknown value endpoint ${endpoint}`);
        setValue.call(performer, value, 0);
    }
    for (const { endpoint, value } of command.events ?? []) {
        const sendEvent = performer[`sendInputEvent_${endpoint}`];
        if (typeof sendEvent !== "function") throw new Error(`Unknown event endpoint ${endpoint}`);
        sendEvent.call(performer, value);
    }
    performer.advance(frames);
    const samples = Array.from({ length: frames }, (_, frame) => performer.getOutputFrame_out(frame));
    const count = performer.getOutputEventCount_receipt();
    if (count > 32) throw new Error("Cmajor output event overrun");
    const receipts = Array.from({ length: count }, (_, index) => performer.getOutputEvent_receipt(index).event);
    performer.resetOutputEventCount_receipt();
    process.stdout.write(JSON.stringify({ samples, receipts }) + "\n");
}
