import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { exportKit, readAllowlist, scanForForbiddenStrings } from "../kit/scripts/export_kit.mjs";

test("forbidden_string_scan_catches_a_planted_identifier", async () => {
    const allowlist = await readAllowlist();
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-scan-"));
    try {
        await fs.writeFile(path.join(scratch, "leak.txt"), `built on ${allowlist.forbiddenStrings[0]}'s machine`);
        const violations = await scanForForbiddenStrings(scratch, allowlist);
        assert.equal(violations.length, 1);
        assert.equal(violations[0].file, "leak.txt");
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("export_produces_a_gated_starter_tree_with_no_private_material", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-"));
    const outputRoot = path.join(scratch, "starter");
    try {
        const { fileCount } = await exportKit(outputRoot);
        assert.equal(fileCount > 50, true);

        for (const required of ["kit/AGENTS.md", "kit/fx/build-effect.mjs", "fx/enhancer_lite/EnhancerLite.cmajorpatch", "package.json", "EXPORT_MANIFEST.json"]) {
            assert.equal(existsSync(path.join(outputRoot, required)), true, `missing ${required}`);
        }
        for (const forbidden of ["TODOS.txt", "PROGRESS.txt", "reference_labs", "experiments", "cmajor/WavetableSynth.cmajor", "ui/desktop", "fx/seqfx", "AGENTS.md.orig"]) {
            assert.equal(existsSync(path.join(outputRoot, forbidden)), false, `must not export ${forbidden}`);
        }

        const skillLink = await fs.readlink(path.join(outputRoot, ".agents/skills/cosimo-make-plugin"));
        assert.equal(skillLink, "../../kit/skills/cosimo-make-plugin");
        JSON.parse(await fs.readFile(path.join(outputRoot, "package.json"), "utf8"));
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});
