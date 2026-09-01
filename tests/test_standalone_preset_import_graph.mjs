import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

const GENERIC_ENTRY = "ui/shared/effects/standalone-effect-presets.ts";
const SYNTH_ADAPTER = "ui/shared/effects/synth-standalone-presets.ts";

// Builder-kit boundary: the generic preset controller must never reach synth,
// bounce, sound-share, or wavetable code — those live in the synth adapter.
const FORBIDDEN_SPECIFIER_PATTERNS = [
    { name: "bounce", pattern: /(^|\/)bounce\// },
    { name: "sound-share", pattern: /sound-share/ },
    { name: "synth", pattern: /synth/i },
    { name: "wavetable", pattern: /wavetable/i },
];

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
    const joined = path.posix.normalize(path.posix.join(baseDirectory, specifier));

    for (const candidate of [joined, `${joined}.ts`, `${joined}.tsx`, `${joined}/index.ts`]) {
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

/** Walk every transitive relative import; returns { modulePath: [specifiers] }. */
async function collectImportGraph(entryRelativePath) {
    const graph = new Map();
    const queue = [entryRelativePath];

    while (queue.length > 0) {
        const moduleRelativePath = queue.shift();

        if (graph.has(moduleRelativePath)) {
            continue;
        }

        const source = await fs.readFile(path.join(repoRoot, moduleRelativePath), "utf8");
        const specifiers = importSpecifiers(source);
        graph.set(moduleRelativePath, specifiers);

        for (const specifier of specifiers) {
            if (!specifier.startsWith(".")) {
                continue; // Bare specifiers (react, node builtins) end the walk.
            }

            queue.push(await resolveRelativeImport(moduleRelativePath, specifier));
        }
    }

    return graph;
}

test("the generic standalone preset controller's import graph reaches no synth, bounce, share, or wavetable module", async () => {
    const graph = await collectImportGraph(GENERIC_ENTRY);

    assert.ok(graph.size >= 2, "expected the walk to traverse the preset module family");

    for (const [modulePath, specifiers] of graph) {
        for (const { name, pattern } of FORBIDDEN_SPECIFIER_PATTERNS) {
            assert.doesNotMatch(
                modulePath,
                pattern,
                `${modulePath} is a ${name} module but is reachable from ${GENERIC_ENTRY}`,
            );

            for (const specifier of specifiers) {
                assert.doesNotMatch(
                    specifier,
                    pattern,
                    `${modulePath} imports "${specifier}" (${name}) inside the generic preset import graph`,
                );
            }
        }
    }
});

test("the synth adapter owns the bounce, sound-share, and wavetable imports the generic core shed", async () => {
    const source = await fs.readFile(path.join(repoRoot, SYNTH_ADAPTER), "utf8");
    const specifiers = importSpecifiers(source);

    assert.ok(
        specifiers.some((specifier) => /(^|\/)bounce\/document\.mjs$/.test(specifier)),
        "synth adapter must import the bounce document (BOUNCE_STATE_KEY)",
    );
    assert.ok(
        specifiers.some((specifier) => specifier.endsWith("sound-share-envelope")),
        "synth adapter must import the sound-share envelope",
    );
    assert.ok(
        specifiers.some((specifier) => specifier.endsWith("sound-share-wavetable")),
        "synth adapter must import the sound-share wavetable validation",
    );
    assert.match(source, /parameters\.sourceMode === 1/, "the sourceMode bounce guard is synth-adapter-owned");

    // The runtime-minted preset id prefix is one configurable constant whose
    // default preserves the historical "cosimo." ids.
    assert.match(source, /DEFAULT_RUNTIME_PRESET_ID_PREFIX = "cosimo"/);
    assert.match(source, /runtimePresetIDPrefix\s*\?\?\s*DEFAULT_RUNTIME_PRESET_ID_PREFIX/);

    const genericSource = await fs.readFile(path.join(repoRoot, GENERIC_ENTRY), "utf8");
    assert.doesNotMatch(genericSource, /"cosimo\./, "the generic core must not mint cosimo-prefixed ids");
});

// Task 2.4 preset-bar split: the generic header/bar elements must stay free of
// polish, sound-share, bounce, and synth modules; the synth's registered
// preset-bar extension owns that surface.
const GENERIC_HEADER_ENTRY = "ui/shared/effects/effect-header.ts";
const GENERIC_BAR = "ui/shared/effects/preset-bar.ts";
const SYNTH_BAR = "ui/shared/effects/synth-preset-bar.ts";

const BAR_FORBIDDEN_SPECIFIER_PATTERNS = [
    ...FORBIDDEN_SPECIFIER_PATTERNS,
    { name: "polish", pattern: /polish/i },
];

test("the generic effect header and preset bar import graph reaches no polish, synth, bounce, share, or wavetable module", async () => {
    const graph = await collectImportGraph(GENERIC_HEADER_ENTRY);

    assert.ok(
        graph.has(GENERIC_BAR),
        "expected the header walk to traverse the generic preset bar",
    );
    assert.ok(
        graph.has("ui/shared/effects/snapshot-bar.ts"),
        "expected the header walk to traverse the snapshot bar",
    );

    for (const [modulePath, specifiers] of graph) {
        for (const { name, pattern } of BAR_FORBIDDEN_SPECIFIER_PATTERNS) {
            assert.doesNotMatch(
                modulePath,
                pattern,
                `${modulePath} is a ${name} module but is reachable from ${GENERIC_HEADER_ENTRY}`,
            );

            for (const specifier of specifiers) {
                assert.doesNotMatch(
                    specifier,
                    pattern,
                    `${modulePath} imports "${specifier}" (${name}) inside the generic bar import graph`,
                );
            }
        }
    }

    // The synth-only presentation must not leak back into the generic bar.
    const genericBarSource = await fs.readFile(path.join(repoRoot, GENERIC_BAR), "utf8");
    assert.doesNotMatch(genericBarSource, /cosimo-bounce-audio|cosimo-bounce-video|cosimo-shell-back|cosimo-open-perf-tuning/);
    assert.doesNotMatch(genericBarSource, /polish-meter|shell-menu|compact-synth|share-dialog|shared-load-dialog/);
    assert.doesNotMatch(genericBarSource, /location\.hash/);
});

test("the synth preset-bar extension owns the polish, sound-share, and bounce surface the generic bar shed", async () => {
    const source = await fs.readFile(path.join(repoRoot, SYNTH_BAR), "utf8");
    const specifiers = importSpecifiers(source);

    assert.ok(
        specifiers.some((specifier) => specifier.endsWith("/polish")),
        "synth bar must import the polish meter helpers",
    );
    assert.ok(
        specifiers.some((specifier) => specifier.endsWith("sound-share-link")),
        "synth bar must import the sound-share link helpers",
    );
    assert.ok(
        specifiers.some((specifier) => specifier.endsWith("sound-share-envelope")),
        "synth bar must import the sound-share envelope type",
    );
    assert.ok(
        specifiers.some((specifier) => specifier.endsWith("./preset-bar")),
        "synth bar must extend the generic preset bar",
    );

    // The synth's events and shell stay synth-owned…
    assert.match(source, /cosimo-bounce-audio/);
    assert.match(source, /cosimo-bounce-video/);
    assert.match(source, /cosimo-shell-back/);
    assert.match(source, /cosimo-open-perf-tuning/);
    // …and it registers under the same configurable tag the generic bar defaults to.
    assert.match(source, /DEFAULT_PRESET_BAR_ELEMENT_NAME/);

    const genericBarSource = await fs.readFile(path.join(repoRoot, GENERIC_BAR), "utf8");
    assert.match(genericBarSource, /DEFAULT_PRESET_BAR_ELEMENT_NAME = "cosimo-preset-bar"/);
});
