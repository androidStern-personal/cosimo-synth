import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDirectory, "..");
const webBuildDirectory = path.join(repoRoot, "build", "web");
const distDirectory = path.join(repoRoot, "dist");

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: process.env,
        stdio: "inherit",
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.`);
    }
}

await fs.rm(distDirectory, { recursive: true, force: true });
run("npm", ["run", "web:build"]);
await fs.mkdir(path.join(distDirectory, "server"), { recursive: true });
await fs.cp(webBuildDirectory, path.join(distDirectory, "assets"), { recursive: true });
await fs.writeFile(
    path.join(distDirectory, "server", "index.js"),
    `const worker = {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === "/") {
            url.pathname = "/index.html";
            return env.ASSETS.fetch(new Request(url, request));
        }
        return env.ASSETS.fetch(request);
    },
};

export default worker;
`,
);

console.log(`Cosimo Sites bundle built at ${distDirectory}`);
