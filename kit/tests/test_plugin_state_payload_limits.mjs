import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Keep regression failures outside the main runner: unbounded conversion can
// expand a tiny cyclic/shared graph or copy millions of typed samples first.
for (const scenario of ["cycle", "shared-dag", "typed-array"]) {
    test(`prepared ${scenario} refuses within bounded memory/time and a later public edit recovers`, () => {
        const result = spawnSync(process.execPath, ["--stack-trace-limit=0", `--max-old-space-size=${scenario === "typed-array" ? 64 : 128}`,
            path.join(import.meta.dirname, "helpers/plugin_state_payload_probe.mjs"), scenario], {
            timeout: 2000, killSignal: "SIGKILL", encoding: "utf8", maxBuffer: 32 * 1024,
        });
        assert.equal(result.status, 0, JSON.stringify({ signal: result.signal, error: result.error?.code, stderr: result.stderr?.slice(-1000) }));
    });
}
