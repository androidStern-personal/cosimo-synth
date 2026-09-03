import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { exportKit } from "../kit/scripts/export_kit.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("canonical customer npm test discovers a newly scaffolded failing plugin test", async () => {
    const scratch = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "kit-customer-tests-")));
    const root = path.join(scratch, "customer");
    try {
        await exportKit(root);
        // Exercise current script/template changes before their export commit.
        await fs.cp(path.join(repoRoot, "kit/scripts"), path.join(root, "kit/scripts"), { recursive: true });
        const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
        pkg.scripts = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/template/root/package.json.template"), "utf8")).scripts;
        await fs.writeFile(path.join(root, "package.json"), JSON.stringify(pkg));
        await fs.symlink(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"));
        const env = { ...process.env };
        delete env.NODE_TEST_CONTEXT; // Customer npm test is a new runner, not a nested node:test child.
        const run = (...args) => spawnSync("npm", args, { cwd: root, encoding: "utf8", env });
        const sharedBefore = await fs.readFile(path.join(root, "package.json"), "utf8");
        const scaffold = run("run", "kit:new", "--", "fixture_gain");
        assert.equal(scaffold.status, 0, scaffold.stderr);
        assert.equal((await fs.stat(path.join(root, "tests/test_fixture_gain_state.mjs"))).isFile(), true);
        assert.equal(await fs.readFile(path.join(root, "package.json"), "utf8"), sharedBefore);
        const valid = run("test");
        assert.equal(valid.status, 0, valid.stdout + valid.stderr);
        await fs.appendFile(path.join(root, "tests/test_fixture_gain_state.mjs"), '\nthrow new Error("GENERATED-PLUGIN-TEST-FAILURE");\n');
        const failing = run("test");
        assert.notEqual(failing.status, 0, `canonical npm test must execute newly generated tests\n${failing.stdout}${failing.stderr}`);
        assert.match(failing.stdout + failing.stderr, /GENERATED-PLUGIN-TEST-FAILURE/u);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});
