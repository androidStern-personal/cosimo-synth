// Customer unit-test entrypoint. Browser acceptance remains a separate gate.
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tests = [];
async function discover(directory) {
    for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
        const relative = path.join(directory, entry.name);
        if (entry.isDirectory()) await discover(relative);
        else if (entry.isFile() && /^test_.+\.mjs$/u.test(entry.name) && !entry.name.includes("_browser"))
            tests.push(relative);
    }
}
await discover("kit/tests");
await discover("tests");
if (tests.length === 0) throw new Error("No Builder Kit or plugin unit tests found.");
const result = spawnSync(process.execPath, ["--test", ...tests.sort()], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
