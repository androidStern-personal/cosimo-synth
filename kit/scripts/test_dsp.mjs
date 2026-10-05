// npm run test:dsp: runs every .cmajtest under tests/ with the pinned cmaj
// from npm run kit:setup (or BUILDER_KIT_CMAJ).
import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { projectRoot } from "./common.mjs";
import { resolveCmajExecutable } from "./toolchain.mjs";

function findDspTests() {
    try {
        return readdirSync(path.join(projectRoot, "tests"), { recursive: true })
            .filter((file) => file.endsWith(".cmajtest"))
            .map((file) => path.join("tests", file))
            .sort();
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
    }
}

const tests = findDspTests();

if (tests.length === 0) {
    console.error("No DSP tests found: add .cmajtest files under tests/.");
    process.exitCode = 1;
} else {
    try {
        const cmaj = await resolveCmajExecutable();
        const result = spawnSync(cmaj, ["test", "--singleThread", ...tests], { cwd: projectRoot, stdio: "inherit" });
        if (result.error) throw result.error;
        process.exitCode = result.status ?? 1;
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
