import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");
const hookPath = path.join(repoRoot, ".claude", "hooks", "session-start.sh");

async function writeExecutable(filePath, source) {
    await writeFile(filePath, source, "utf8");
    await chmod(filePath, 0o755);
}

test("Claude remote setup is lockfile-exact and keeps Git rewrites inside the session", async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-session-start-"));
    const binDirectory = path.join(fixtureRoot, "bin");
    const logPath = path.join(fixtureRoot, "commands.log");
    const environmentPath = path.join(fixtureRoot, "session.env");
    await mkdir(binDirectory);

    try {
        await Promise.all([
            writeExecutable(path.join(binDirectory, "npm"), `#!/bin/bash
printf 'npm %s\\n' "$*" >> "$SESSION_START_TEST_LOG"
if [ "\${1:-}" = "--version" ]; then printf '10.8.2\\n'; fi
`),
            writeExecutable(path.join(binDirectory, "node"), `#!/bin/bash
printf 'v22.12.0\\n'
`),
            writeExecutable(path.join(binDirectory, "apt-get"), `#!/bin/bash
printf 'apt-get %s\\n' "$*" >> "$SESSION_START_TEST_LOG"
`),
            writeExecutable(path.join(binDirectory, "dpkg-query"), `#!/bin/bash
printf 'wasi-libc=0.0~git20240101\\nlibc++-18-dev-wasm32=18.1.8\\nlibclang-rt-18-dev-wasm32=18.1.8\\nlld-18=18.1.8\\n'
`),
            writeExecutable(path.join(binDirectory, "git"), `#!/bin/bash
printf 'git %s | count=%s key0=%s value0=%s key1=%s value1=%s\\n' "$*" "\${GIT_CONFIG_COUNT:-}" "\${GIT_CONFIG_KEY_0:-}" "\${GIT_CONFIG_VALUE_0:-}" "\${GIT_CONFIG_KEY_1:-}" "\${GIT_CONFIG_VALUE_1:-}" >> "$SESSION_START_TEST_LOG"
exit 0
`),
        ]);

        const { stdout, stderr } = await execFileAsync(hookPath, [], {
            cwd: fixtureRoot,
            env: {
                ...process.env,
                CLAUDE_CODE_REMOTE: "true",
                CLAUDE_ENV_FILE: environmentPath,
                CLAUDE_PROJECT_DIR: fixtureRoot,
                PATH: `${binDirectory}:/usr/bin:/bin`,
                SESSION_START_TEST_LOG: logPath,
            },
        });
        assert.equal(stderr, "");

        const [commands, sessionEnvironment, hookSource] = await Promise.all([
            readFile(logPath, "utf8"),
            readFile(environmentPath, "utf8"),
            readFile(hookPath, "utf8"),
        ]);
        assert.match(commands, /^npm ci --no-audit --no-fund$/mu);
        assert.match(commands, /^apt-get install -y -qq wasi-libc libc\+\+-18-dev-wasm32 libclang-rt-18-dev-wasm32 lld-18$/mu);
        assert.match(commands, /git ls-remote .*count=2/u);
        assert.match(commands, /value0=git@github\.com:/u);
        assert.match(commands, /value1=ssh:\/\/git@github\.com\//u);
        assert.doesNotMatch(commands, /git config/u);

        assert.match(sessionEnvironment, /export COSIMO_RENDERER_LLVM_DIR=\/usr\/lib\/llvm-18/u);
        assert.match(sessionEnvironment, /export GIT_CONFIG_KEY_0=url\.https:\/\/github\.com\/\.insteadOf/u);
        assert.match(sessionEnvironment, /export GIT_CONFIG_VALUE_0=git@github\.com:/u);
        assert.match(sessionEnvironment, /export GIT_CONFIG_VALUE_1=ssh:\/\/git@github\.com\//u);
        assert.match(sessionEnvironment, /export GIT_CONFIG_COUNT=2/u);

        assert.match(stdout, /JavaScript toolchain: node v22\.12\.0, npm 10\.8\.2/u);
        assert.match(stdout, /wasi-libc=0\.0~git20240101/u);
        assert.match(hookSource, /npm ci --no-audit --no-fund/u);
        assert.doesNotMatch(hookSource, /npm install --no-audit/u);
        assert.doesNotMatch(hookSource, /git config --global/u);
    } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
    }
});
