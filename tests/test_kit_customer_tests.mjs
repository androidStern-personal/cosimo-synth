import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { exportKit } from "../kit/scripts/export_kit.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function verifyScaffoldedUnitTestDiscovery(pluginName) {
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
        const scaffold = run("run", "kit:new", "--", pluginName);
        assert.equal(scaffold.status, 0, scaffold.stderr);
        const unitTest = `tests/test_${pluginName}_state.mjs`;
        assert.equal((await fs.stat(path.join(root, unitTest))).isFile(), true);
        assert.equal(await fs.readFile(path.join(root, "package.json"), "utf8"), sharedBefore);
        const browserTest = `tests/test_${pluginName}_view_browser.mjs`;
        await fs.writeFile(path.join(root, browserTest), [
            'import assert from "node:assert/strict";',
            'import test from "node:test";',
            'test("browser-test exclusion probe", () => assert.fail("BROWSER-TEST-MUST-STAY-SEPARATE"));',
        ].join("\n"));
        const directBrowser = spawnSync(process.execPath, ["--test", browserTest], { cwd: root, encoding: "utf8", env });
        assert.equal(directBrowser.status, 1);
        assert.match(directBrowser.stdout + directBrowser.stderr, /BROWSER-TEST-MUST-STAY-SEPARATE/u);
        const nativeTest = "kit/tests/fixture_native.test.mjs";
        await fs.writeFile(path.join(root, nativeTest), [
            'import assert from "node:assert/strict";',
            'import test from "node:test";',
            'test("native-test exclusion probe", () => assert.fail("NATIVE-TEST-MUST-STAY-SEPARATE"));',
        ].join("\n"));
        const directNative = spawnSync(process.execPath, ["--test", nativeTest], { cwd: root, encoding: "utf8", env });
        assert.equal(directNative.status, 1);
        assert.match(directNative.stdout + directNative.stderr, /NATIVE-TEST-MUST-STAY-SEPARATE/u);
        const valid = run("test");
        assert.equal(valid.status, 0, valid.stdout + valid.stderr);
        assert.doesNotMatch(valid.stdout + valid.stderr, /BROWSER-TEST-MUST-STAY-SEPARATE/u);
        assert.doesNotMatch(valid.stdout + valid.stderr, /NATIVE-TEST-MUST-STAY-SEPARATE/u);
        await fs.appendFile(path.join(root, unitTest), '\ntest("generated plugin failure probe", () => assert.fail("GENERATED-PLUGIN-TEST-FAILURE"));\n');
        const directUnit = spawnSync(process.execPath, ["--test", unitTest], { cwd: root, encoding: "utf8", env });
        assert.equal(directUnit.status, 1);
        assert.match(directUnit.stdout + directUnit.stderr, /GENERATED-PLUGIN-TEST-FAILURE/u);
        const failing = run("test");
        assert.notEqual(failing.status, 0, `canonical npm test must execute newly generated tests\n${failing.stdout}${failing.stderr}`);
        assert.match(failing.stdout + failing.stderr, /GENERATED-PLUGIN-TEST-FAILURE/u);
        assert.doesNotMatch(failing.stdout + failing.stderr, /BROWSER-TEST-MUST-STAY-SEPARATE/u);
        assert.doesNotMatch(failing.stdout + failing.stderr, /NATIVE-TEST-MUST-STAY-SEPARATE/u);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
}

for (const pluginName of ["fixture_gain", "browser_gain"]) {
    test(`canonical customer npm test discovers ${pluginName} unit tests but excludes browser and native gates`, () => verifyScaffoldedUnitTestDiscovery(pluginName));
}
