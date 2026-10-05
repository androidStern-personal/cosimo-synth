import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

function importSpecifiers(source) {
    const specifiers = new Set();
    const patterns = [
        /(?:^|[^.\w])import\s[^;]*?from\s*["']([^"']+)["']/gm,
        /(?:^|[^.\w])export\s[^;]*?from\s*["']([^"']+)["']/gm,
        /(?:^|[^.\w])import\s*["']([^"']+)["']/gm,
        /import\(\s*["']([^"']+)["']\s*\)/gm,
    ];

    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            specifiers.add(match[1]);
        }
    }

    return [...specifiers];
}

async function resolveRelativeImport(fromRelativePath, specifier) {
    const baseDirectory = path.posix.dirname(fromRelativePath);
    // Vite asset queries select a loader; the boundary still follows the real file.
    const assetPath = specifier.replace(/\?(?:inline|raw)$/u, "");
    const joined = path.posix.normalize(path.posix.join(baseDirectory, assetPath));

    for (const candidate of [joined, `${joined}.ts`, `${joined}.tsx`, `${joined}.js`, `${joined}.mjs`, `${joined}/index.ts`]) {
        try {
            const stats = await fs.stat(path.join(repoRoot, candidate));

            if (stats.isFile()) {
                return candidate;
            }
        } catch {
            // Try the next candidate.
        }
    }

    throw new Error(`Could not resolve import "${specifier}" from ${fromRelativePath}.`);
}

const KIT_MODULE_ROOTS = ["kit/ui", "kit/fx"];
const KIT_SOURCE_MODULE_PATTERN = /\.(?:ts|tsx|js|mjs)$/;

const KIT_FORBIDDEN_IMPORT_TARGETS = [
    { name: "synth ui/shared", pattern: /^ui\/shared\// },
    { name: "bounce", pattern: /^bounce\// },
    { name: "fx plugin", pattern: /^fx\// },
];

async function listKitSourceModules() {
    const modulePaths = [];

    for (const root of KIT_MODULE_ROOTS) {
        const entries = await fs.readdir(path.join(repoRoot, root), { recursive: true, withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isFile() || !KIT_SOURCE_MODULE_PATTERN.test(entry.name)) {
                continue;
            }

            const parentRelativePath = path.relative(repoRoot, entry.parentPath).replaceAll(path.sep, "/");
            modulePaths.push(path.posix.join(parentRelativePath, entry.name));
        }
    }

    return modulePaths.sort();
}

test("kit modules never import ui/shared, bounce, or fx plugin code", async () => {
    const modulePaths = await listKitSourceModules();

    assert.ok(
        modulePaths.length >= 25,
        `expected the kit module walk to cover the relocated UI kit (found ${modulePaths.length})`,
    );
    assert.ok(modulePaths.includes("kit/ui/cmajor-react.ts"), "expected the walk to include kit/ui/cmajor-react.ts");
    assert.ok(modulePaths.includes("kit/fx/build-effect.mjs"), "expected the walk to include kit/fx/build-effect.mjs");

    for (const modulePath of modulePaths) {
        const source = await fs.readFile(path.join(repoRoot, modulePath), "utf8");

        for (const specifier of importSpecifiers(source)) {
            if (!specifier.startsWith(".")) {
                continue; // Bare specifiers (react, node builtins) are not repo modules.
            }

            const resolved = await resolveRelativeImport(modulePath, specifier);

            for (const { name, pattern } of KIT_FORBIDDEN_IMPORT_TARGETS) {
                assert.doesNotMatch(
                    resolved,
                    pattern,
                    `${modulePath} imports "${specifier}" (${name}) across the kit boundary`,
                );
            }
        }
    }
});
