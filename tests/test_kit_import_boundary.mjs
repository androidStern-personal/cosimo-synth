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

const SYNTH_MODULE_ROOTS = ["ui", "fx", "tools", "web", "bounce"];
const SKIPPED_DIRECTORIES = new Set(["node_modules", "build", "dist", "generated"]);

async function listSourceModules(roots) {
    const modulePaths = [];

    for (const root of roots) {
        const entries = await fs.readdir(path.join(repoRoot, root), { recursive: true, withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isFile() || !KIT_SOURCE_MODULE_PATTERN.test(entry.name)) {
                continue;
            }

            const parentRelativePath = path.relative(repoRoot, entry.parentPath).replaceAll(path.sep, "/");

            if (parentRelativePath.split("/").some((segment) => SKIPPED_DIRECTORIES.has(segment))) {
                continue;
            }

            modulePaths.push(path.posix.join(parentRelativePath, entry.name));
        }
    }

    return modulePaths.sort();
}

/** Specifiers of `export ... from` statements, and of imports whose names are exported again. */
function reExportSpecifiers(source) {
    const specifiers = new Set();

    for (const match of source.matchAll(/(?:^|[^.\w])export\s[^;]*?from\s*["']([^"']+)["']/gm)) {
        specifiers.add(match[1]);
    }

    const localExports = new Set();

    for (const match of source.matchAll(/(?:^|[^.\w])export\s+(?:type\s+)?\{([^}]*)\}\s*;/gm)) {
        for (const name of match[1].split(",")) {
            localExports.add(name.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]);
        }
    }

    for (const match of source.matchAll(/(?:^|[^.\w])import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm)) {
        const importedNames = match[1].split(",").map((name) => name.trim().replace(/^type\s+/, "").split(/\s+as\s+/).at(-1));

        if (importedNames.some((name) => localExports.has(name))) {
            specifiers.add(match[2]);
        }
    }

    return [...specifiers];
}

test("kit modules never import ui/shared, bounce, or fx plugin code", async () => {
    const modulePaths = await listSourceModules(KIT_MODULE_ROOTS);

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

test("synth and plugin code never re-exports a kit module", async () => {
    const modulePaths = await listSourceModules(SYNTH_MODULE_ROOTS);

    assert.ok(modulePaths.includes("ui/shared/mseg.ts"), "expected the walk to include ui/shared/mseg.ts");
    assert.ok(modulePaths.includes("fx/seqfx/view/SeqFxPatchView.tsx"), "expected the walk to include fx plugin views");

    for (const modulePath of modulePaths) {
        const source = await fs.readFile(path.join(repoRoot, modulePath), "utf8");

        for (const specifier of reExportSpecifiers(source)) {
            if (!specifier.startsWith(".")) {
                continue;
            }

            const target = path.posix.join(path.posix.dirname(modulePath), specifier);

            assert.doesNotMatch(
                target,
                /^kit\//,
                `${modulePath} re-exports "${specifier}"; import it from the kit module directly where it is used`,
            );
        }
    }
});
