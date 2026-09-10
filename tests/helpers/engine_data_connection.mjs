import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { buildEngineDataProbe } from "../test_engine_data_support.mjs";

// Test adapter for the real compiled Cmajor performer. It only frames stdin/stdout;
// all receipts, word storage and reader behavior come from the production module.
export function openEngineDataConnection() {
    const { executable, runtime, modulePath, fixturePath } = buildEngineDataProbe();
    const child = spawn(executable, [runtime, modulePath, fixturePath], { stdio: ["pipe", "pipe", "pipe"] });
    const lines = createInterface({ input: child.stdout });
    const pending = [];
    let diagnostics = "";
    let failure;
    let closing = false;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", data => { diagnostics += data; });
    const fail = error => {
        failure = error;
        for (const request of pending.splice(0)) request.reject(error);
    };
    child.on("error", fail);
    lines.on("line", line => {
        const request = pending.shift();
        if (!request) { fail(new Error("Unsolicited native probe output")); return; }
        try { request.resolve(JSON.parse(line)); }
        catch (error) { request.reject(error); fail(error); }
    });
    const exited = new Promise(resolve => child.on("exit", (code, signal) => {
        if (code !== 0 || !closing || pending.length)
            fail(new Error(`Native data probe exited (${code ?? signal}): ${diagnostics}`));
        resolve();
    }));
    return {
        request(command) {
            if (failure) return Promise.reject(failure);
            if (closing) return Promise.reject(new Error("Native data probe is closed"));
            return new Promise((resolve, reject) => {
                pending.push({ resolve, reject });
                child.stdin.write(JSON.stringify(command) + "\n", error => { if (error) fail(error); });
            });
        },
        async close() {
            closing = true;
            child.stdin.end();
            const deadline = setTimeout(() => child.kill("SIGKILL"), 2000);
            await exited;
            clearTimeout(deadline);
            lines.close();
            if (failure) throw failure;
        },
    };
}
