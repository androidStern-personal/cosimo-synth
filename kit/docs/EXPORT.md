# Builder Kit Export

`node kit/scripts/export_kit.mjs <outputDir> [--force] [--prove] [--feed-url=<url>]`
produces the customer starter monorepo: the `kit/` tree, the editable Enhancer
Lite plugin, its tests, the shared analyzer it needs
(`cmajor/EnhancerLiteSpectrumAnalyzer.cmajor`), and a root generated from `kit/template/root`
(package.json with pinned tool versions taken from the monorepo, starter
AGENTS.md, tsconfig, .gitignore). Every directory under `kit/skills/` gets a
relative `.agents/skills/<name>` symlink at the root for agent skill discovery.

`kit/export-allowlist.json` is the single wall between customer content and
everything else in this monorepo. The export fails closed when: an allowlisted
path is missing, any output file falls outside the allowlist, a required output
is absent, or any text file contains a forbidden identifier (personal names,
signing team ids, device ids, distribution-channel terms). `tests/test_kit_export.mjs`
keeps the gates honest.

`--prove` additionally builds Enhancer Lite inside the export, runs the kit
unit tests there, and simulates the customer update flow (starter commit →
local plugin edit → kit-update merge; both must survive). On a customer
machine `npm install` replaces the proof's node_modules symlink shortcut.

## Feed stamping

Two committed contracts describe where a customer machine fetches things:

- `kit/feed.json` — the feed base URL. Empty in this monorepo; the export
  stamps it when `--feed-url=<url>` is passed (trailing slash trimmed).
- `kit/toolchain.json` — the pinned `cmaj` / `CmajPlugin.vst3` artifacts
  (paths relative to the feed base URL), their sha256 (written by `kit:release`),
  local paths under `build/kit-tools/`, and required tool ranges.

When the effective base URL is non-empty (stamped or already present in
`kit/feed.json`), the exported `kit/cmake/dependency-sources.cmake` is rendered
so the Cmajor fork resolves from `<baseUrl>/cmajor.git` (CHOC follows as its
submodule); JUCE keeps its official URL. `CosimoDependencies.cmake` includes
that data-only file and keeps every commit pin, so plain CPM does the fetching
in both the monorepo and the customer tree. Without a feed URL the export is
byte-identical to the monorepo's seam (GitHub origins). The manifest records
the stamped base URL as `feedBaseUrl`.

`kit/fx/prod-effect.mjs` picks the Cmajor command the same way on both sides:
`build/kit-tools/cmaj` when it matches the hash in `kit/toolchain.json`
(`npm run kit:setup` downloads it), else the monorepo's pinned source build
(`tools/cmajor_command_build`, absent from exports), else a clear error naming
`npm run kit:setup`.

## Publishing and updates

`npm run kit:release` (monorepo-side, not exported) exports with feed stamping,
runs the gates and proof, builds and hashes the pinned tools, records the hashes
in the staged `kit/toolchain.json`, commits and tags the release in the private
lineage repository, and mirrors bare `kit.git` / `cmajor.git` / `choc.git`
repositories plus the tool artifacts to a static feed. Customers created their
repo from that lineage, so `git merge <kit release tag>` (driven by the
`kit-update` skill) delivers updates; their plugins live in `fx/<their plugin>/`,
which kit commits never touch.

## Releasing

`scripts/release_builder_kit.mjs` (`npm run kit:release`) is the kit
maintainer's release command in the source monorepo. It is not exported. Run it
on the Mac from a clean checkout:

```
npm run kit:release -- --version 1.0.0 \
    --feed-url https://<feed host>/<cohort secret> \
    --lineage ~/src/builder-kit-releases \
    --r2 r2:<bucket>/<cohort secret> \
    [--dry-run] [--skip-tools] [--tools-dir <dir>] [--staging <dir>]
    [--cmajor-source <url|path>] [--choc-source <url|path>]
```

Steps, in order; every step fails closed:

1. **Export + gates.** `exportKit(staging/export, { feedUrl })` stamps the feed
   URL into `kit/feed.json` and renders `kit/cmake/dependency-sources.cmake`,
   then the allowlist, stray-file, and forbidden-string gates run. A second
   export in `staging/proof` runs `proveExport` (Enhancer Lite build, kit unit
   tests, update-flow merge); the proof dirties its tree, which is why the
   release tree is a separate copy.
2. **Pins.** The Cmajor commit comes from the exported
   `kit/cmake/CosimoDependencies.cmake` and must equal
   `kit/toolchain.json` `cmaj.forkCommit`. The mirror source is the upstream
   fork URL the monorepo declares (`COSIMO_CMAJOR_GIT_URL`), overridable with
   `--cmajor-source`; `--choc-source` overrides the CHOC source likewise.
3. **Tools (macOS).** Builds the pinned `cmaj` (`tools/cmajor_command_build` →
   `build/cmajor_command/bin/cmaj`) and `CmajPlugin.vst3`
   (`kit/scripts/build_cmajplugin_vst3.sh`), archives them under the names in
   `kit/toolchain.json` (`cmaj-macos-arm64.tar.gz`, `CmajPlugin-macos-arm64.zip`),
   hashes them, and writes the SHA-256s into the staged `kit/toolchain.json`.
   `--skip-tools` skips the build; a real release then needs `--tools-dir`
   holding prebuilt archives with those exact names.
4. **Lineage.** In the `--lineage` clone (must be clean, on a branch, tag not
   yet present) the working tree is replaced by the export, committed as
   `Builder Kit <version>`, tagged `v<version>`, and pushed with the tag. The
   commit fails if the export is identical to the lineage tip.
5. **Mirrors.** `staging/feed/kit.git`, `cmajor.git`, `choc.git` are bare clones
   (`git clone --bare`, `repack -a -d`, `update-server-info`) so git's dumb-HTTP
   protocol can serve them from a static bucket. The cmajor mirror must contain
   the pin, its `.gitmodules` entry for `include/choc` must use a **relative**
   URL (`../choc.git`, resolved against the cmajor URL exactly as git does), and
   the choc mirror must contain the gitlink commit. An absolute CHOC URL aborts
   the release: customers would leave the feed.
6. **Manifest + sync.** Tool archives are copied to `staging/feed/tools/` and
   `staging/feed/manifest.json` records version, tag, monorepo source commit,
   lineage commit, cmajor/choc commits, and tool hashes (no fork URLs). Then
   `rclone sync staging/feed <r2>`. The feed URL and the R2 prefix must end in
   the same cohort segment, since customers read `<feed-url>/kit.git`.

Resulting feed layout under the cohort prefix:

```
kit.git/            bare mirror of builder-kit-releases (tag v<version>)
cmajor.git/         bare mirror of the Cmajor fork (pin in CosimoDependencies.cmake)
choc.git/           bare mirror of the CHOC fork (the cmajor gitlink commit)
tools/cmaj-macos-arm64.tar.gz
tools/CmajPlugin-macos-arm64.zip
manifest.json
```

`--dry-run` performs every local step: export and proof, the lineage commit
and tag on a throwaway clone under `staging/lineage` (an empty repo when
`--lineage` is omitted), mirrors whose sources are local paths, the manifest,
and prints the staging layout. It skips the push, the rclone sync, tool builds
off macOS, and mirrors whose sources are remote URLs, printing what it would
have done. The staging dir is kept in every mode (default: a fresh
`builder-kit-release-<version>-*` dir in the OS temp dir).

`tests/test_release_builder_kit.mjs` covers argument validation, relative
submodule URL resolution, the pin cross-check, toolchain and manifest
rendering, tool archiving and hashing, the lineage commit, mirror creation,
and a full Linux dry run against local fork repos.
