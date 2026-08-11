import { compileModulationRuntimeProgram } from "../../patch_gui/modulation-runtime-program.js";

let input = "";
for await (const chunk of process.stdin) {
    input += chunk;
}

const { routes, dspSessionId, deliverySerial } = JSON.parse(input);
const program = compileModulationRuntimeProgram(routes);
process.stdout.write(JSON.stringify({
    ...program,
    dspSessionId,
    deliverySerial,
}));
