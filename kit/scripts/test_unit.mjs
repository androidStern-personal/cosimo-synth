// npm test: runs every test_*.mjs under kit/tests and tests/ except the
// *_browser.mjs suites, which npm run test:browser runs.
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { projectRoot } from "./common.mjs";

const testRoots = ["kit/tests", "tests"];
const tests = [];

async function discover(directory) {
    let entries;
    try {
        entries = await fs.readdir(path.join(projectRoot, directory), { withFileTypes: true });
    } catch (error) {
        // A project may delete the example plugin and its tests/ folder.
        if (error.code === "ENOENT") return;
        throw error;
    }
    for (const entry of entries) {
        const relative = path.join(directory, entry.name);
        if (entry.isDirectory()) await discover(relative);
        else if (entry.isFile() && /^test_.+\.mjs$/u.test(entry.name) && !entry.name.endsWith("_browser.mjs"))
            tests.push(relative);
    }
}

for (const directory of testRoots) await discover(directory);

if (tests.length === 0) {
    console.error(`No unit tests found: add test_*.mjs files under ${testRoots.join(" or ")}.`);
    process.exitCode = 1;
} else {
    const result = spawnSync(process.execPath, ["--test", ...tests.sort()], { cwd: projectRoot, stdio: "inherit" });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
}
