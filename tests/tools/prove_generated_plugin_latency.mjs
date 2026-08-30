import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { effectPlugins, repoRoot } from "../../fx/build-effect.mjs";

const cases = [
    { pluginName: "enhancer", expectedLatency: 60 },
    { pluginName: "enhancer-lite", expectedLatency: 3 },
    { pluginName: "ott", expectedLatency: 0 },
];

function run(command, args, { capture = false } = {}) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new Error(output || `${command} ${args.join(" ")} failed.`);
    }

    return result.stdout?.trim() ?? "";
}

for (const { pluginName, expectedLatency } of cases) {
    const plugin = effectPlugins[pluginName];
    const cmakeBuildDirectory = path.join(repoRoot, plugin.juceOut, "_build");
    const probe = path.join(cmakeBuildDirectory, "latency_probe", "cosimo_generated_latency_probe");

    run(process.execPath, [path.join(repoRoot, "fx/prod-effect.mjs"), "build", pluginName, "--clean"]);
    run("cmake", [
        "--build", cmakeBuildDirectory,
        "--config", "Release",
        "--target", "cosimo_generated_latency_probe",
    ]);

    const output = run(probe, [String(expectedLatency)], { capture: true });
    const result = output.match(/creation=(\d+) reload=(\d+)/);

    assert.ok(result, `${pluginName} probe did not report creation/reload latency: ${output}`);
    assert.equal(Number(result[1]), expectedLatency, `${pluginName} creation latency`);
    assert.equal(Number(result[2]), expectedLatency, `${pluginName} reload latency`);
    console.log(`${pluginName}: ${output}`);
}
