import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preparePublicWebAssets } from "./public-build.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(repo, "build", "vercel-shared-memory");
const args = process.argv.slice(2);
for (const arg of args) {
    if (!["--prod", "--dry-run"].includes(arg)) throw new Error(`Unknown deployment option: ${arg}`);
}
if (args.includes("--prod") && process.env.COSIMO_CMAJOR_SOURCE) {
    throw new Error("Production uses the committed Cmajor pin. Unset COSIMO_CMAJOR_SOURCE; use preview deployment for local Cmajor development.");
}

function run(command, arguments_, environment = process.env) {
    const result = spawnSync(command, arguments_, { cwd: repo, env: environment, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

// Build first; do not destroy the previous deployable output on build failure.
run("npm", ["run", "web:build"]);
await fs.rm(output, { recursive: true, force: true });
await preparePublicWebAssets(path.join(repo, "build", "web"), output);
await fs.copyFile(new URL("./vercel.json", import.meta.url), path.join(output, "vercel.json"));
await fs.mkdir(path.join(output, ".vercel"));
await fs.writeFile(path.join(output, ".vercel", "project.json"), JSON.stringify({
    projectId: "prj_1D5F6A3OyMkcYNNwn8Aag2PIeoi2",
    orgId: "team_RaVGuT9IWG2C1QTbs2lst85x",
    projectName: "cosimo-synth",
}));
await fs.writeFile(path.join(output, ".vercelignore"), ".env*\n.gitignore\n.vercel\n");

// Exercise the exact packaged site, including the real keyboard and audio,
// before either preview or production upload. No repository-root deployment.
run(process.execPath, ["--test", "--test-concurrency=1", "--test-name-pattern=generated browser proof keeps the real keyboard|web shell keeps the actual phone UI|real Cosimo parameter drags",
    "tests/test_web_poc_browser.mjs", "tests/test_web_phone_shell_browser.mjs", "tests/test_cosimo_parameter_drag_browser.mjs"], { ...process.env, COSIMO_WEB_ROOT: output, COSIMO_WEB_BROWSER: "chromium", COSIMO_WEB_BASE_URL: "" });
if (args.includes("--dry-run")) {
    console.log(`Verified static synth: ${output}. Nothing deployed.`);
} else {
    run("npx", ["--yes", "vercel@59.16.0", "deploy", output, "--yes", "--scope", "andrew-sterns-projects",
        ...(args.includes("--prod") ? ["--prod"] : [])]);
}
