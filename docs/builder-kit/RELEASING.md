# Releasing the Builder Kit

Maintainer runbook. Nothing here ships to customers; the customer-facing
contracts are in `kit/docs/TOOLCHAIN.md`.

## Export

`npm run kit:export -- <outputDir> [--force] [--prove]`
(`node scripts/export_kit.mjs`) produces a customer project: the `kit/` tree,
the editable Enhance That plugin, its tests, the shared analyzer it needs
(`cmajor/EnhancerLiteSpectrumAnalyzer.cmajor`), and a root generated from
`kit/template/root`: `package.json` with tool versions taken from this
repository, a `package-lock.json` cut from this repository's own lock (only the
packages the customer's dependencies reach, at the versions tested here),
starter `AGENTS.md`, tsconfig and .gitignore. Every directory under
`kit/skills/` gets a relative `.agents/skills/<name>` symlink at the root for
agent skill discovery.

All payload, template, dependency-version, and export-policy inputs come from
one Git commit (HEAD by default; the release command passes its asserted source
SHA). Ignored, untracked, and modified working-tree bytes are not export
inputs. Feed stamping and root templating are explicit derived output.

`scripts/builder-kit-export-policy.json` is the single wall between customer
content and everything else in this repository. The export fails closed when
an allowlisted path is missing, any output file falls outside the allowlist, a
required output is absent, any text file contains a forbidden identifier
(personal names, signing team ids, device ids, distribution-channel terms), or
`kit/ui` imports a package that `THIRD_PARTY_NOTICES.md` does not name (those
packages are bundled into every plugin UI). `tests/test_kit_export.mjs` keeps
the gates honest.

`--prove` additionally copies the export to a sibling `<outputDir>-proof-*`
directory and, in that copy, runs the canonical `npm run typecheck` and
`npm test`, builds Enhance That, and simulates the customer update flow
(starter commit, local plugin edit, kit-update merge; both must survive). The
named export stays exactly as exported; the command prints where the proof
ran. The copy reuses this repository's `node_modules`. CI's `exported-lockfile`
job (`.github/workflows/kit.yml`) installs a second export cold with `npm ci`
from its own lockfile and runs the same customer gates, so the lockfile a
customer installs from is exercised on every push.

## Feed stamping

Two committed contracts describe where a customer machine fetches things:

- `kit/feed.json` — the feed base URL. Empty in this monorepo; the
  maintainer-only release process supplies it programmatically.
- `kit/toolchain.json` — the pinned `cmaj` / `CmajPlugin.vst3` artifacts
  (paths relative to the feed base URL), their sha256 (written by `kit:release`),
  local paths under `build/kit-tools/`, and required tool ranges.

When the effective base URL is non-empty (stamped or already present in
`kit/feed.json`), the exported `kit/cmake/dependency-sources.cmake` is rendered
so the Cmajor fork resolves from `<baseUrl>/cmajor.git` (CHOC follows as its
`include/choc` submodule through the fork's relative `../choc.git` URL; plugin
builds check out no other submodule); JUCE keeps its official URL. `dependencies.cmake` includes
that data-only file and keeps every commit pin, so plain CPM does the fetching
in both the monorepo and the customer tree. Without a feed URL the export is
byte-identical to the monorepo's seam (GitHub origins). The export manifest
records only whether a feed was configured, never its capability-bearing URL.

This repository builds `cmaj` from the pinned fork in `tools/cmajor_command_build`
instead of downloading it: `scripts/source_cmaj.mjs` builds
`build/cmajor_command/bin/cmaj` and runs a command with `BUILDER_KIT_CMAJ`
pointing at it. The root `fx:prod:build` and `fx:jit:install` scripts go
through it; the release scripts call it directly.

## Publishing and updates

`npm run kit:release` (not exported) exports with feed stamping,
runs the gates and proof, builds and hashes the pinned tools, records the hashes
in the staged `kit/toolchain.json`, commits and tags the release in the private
lineage repository, and mirrors bare `kit.git` / `cmajor.git` / `choc.git`
repositories plus the tool artifacts to a static feed. Customers created their
repo from that lineage, so `git merge <kit release tag>` (driven by the
`kit-update` skill) delivers updates; their plugins live in `fx/<their plugin>/`,
which kit commits never touch.

## Customer installation delivery

Initial delivery is a coding-agent prompt containing one personalized shell
line and the JUCE licensing notice the customer explicitly acknowledged. The
agent runs that exact line; copying the same line directly into Terminal is an
optional route. The access credential, approved public bootstrap address, and
explicit `--accept-juce-terms` acknowledgment are already populated. The
hosted installer selects `~/Documents/Builder Kit` by default; occupied content
is preserved and a versioned sibling is selected. Do not send a placeholder
recipe, ask an agent to choose a folder, or require separate Git, setup, doctor,
or consent commands.

The supported prerequisite is macOS 15 or newer on Apple silicon, with Apple
Command Line Tools already installed and their agreements accepted by the
customer. The installer does not accept OS agreements, use sudo, or install a
package manager. It downloads pinned official Node and CMake archives into
`.builder-kit-install/runtime/`, verifies their SHA-256 before extraction,
and uses a project-local npm cache. No shell profile or system runtime changes.
The root agent instruction activates `.builder-kit-install/env.sh` from the
project root in each new shell before canonical npm/build commands.

The installer verifies the complete downloaded script against the supplied
SHA-256 before execution, fetches the exact release tag with an ephemeral Git
remote, checks its commit, and runs the existing archive/payload-verified setup
and strict environment checks. A completed npm-install receipt distinguishes
successful dependency installation from a partial `node_modules` directory.
Success names the exact project folder. An agent that ran the installer
continues the same task with that exact folder as its working directory and
follows the root `AGENTS.md`; a customer who ran it directly in Terminal opens
that folder in their coding agent. Installation does not build or install a
plugin, change the included example, or launch a browser or DAW.

An unrelated occupied destination is refused. Repeating the same delivery
command resumes an installer-owned destination, skips completed tools, and
preserves customer commits, dirty source and untracked files. It does not reset
the branch or update to another release. An interrupted lock or altered runtime
is reported for inspection, not automatically deleted or overwritten.

Maintainers prepare delivery from an exact release manifest using:

```text
node scripts/prepare_builder_kit_install.mjs --manifest <release manifest> --destination-config <non-secret destination JSON> --output-dir <new private output folder> [--public-bootstrap-url <HTTPS or loopback test URL>] [--kit-origin <HTTPS or loopback origin>]
```

This uses the existing Keychain capability and release destination parser.
`command.sh` contains the exact one-liner and `delivery.txt` includes the
licensing disclosure; both are private mode-600 files in a mode-700 directory.
The output directory must be outside Git. Never commit, log, or attach their
populated contents to test evidence.
`feed/installers/<sha256>.sh` is credential-free, release-pinned delivery
payload. The release command stages it after lineage/tool pins are final,
records its hash in `manifest.json`, and includes it in the existing verified
immutable-object publication phase. Preparation does not publish it:
publication remains a separately authorized release operation. Render delivery
from the matching release source; mismatched installer/manifest hashes refuse.
The customer never needs these maintainer files.

For unpublished qualification, `--public-bootstrap-url` selects the exact
candidate public entry and `--kit-origin` selects its Git mirror. Each accepts
HTTPS or explicit loopback HTTP; other plain HTTP origins are rejected. This
allows an exact candidate installer and Git mirror to be served inside a
disposable guest while tool downloads retain the real stamped feed and runtime
archives retain official URLs. For owned headless proof, pass a validated
absolute `BUILDER_KIT_PROJECT_DIR` in the subprocess environment; do not add it
to the delivered command or replace `HOME`. Qualify the composed release with
the activation instruction; an older release without it is not a completed
one-command delivery. Do not confuse fixture proof with a published release or
DAW acceptance.

## Releasing

`scripts/release_builder_kit.mjs` (`npm run kit:release`) is the release
command. Before running it, rename the `## Unreleased` heading in
`kit/CHANGELOG.md` to `## <version>` (keep any title after it) and commit; the
release refuses a version without exactly one such section, and the staged
export gets the source commit's date added to that heading. Run it on the Mac
from a clean checkout:

```
npm run kit:release -- --version 1.0.0 \
    --source-sha <exact 40-hex clean source commit> \
    --lineage ~/src/builder-kit-releases \
    --destination-config <non-secret destination json> \
    [--dry-run] [--skip-tools] [--tools-dir <dir>] [--staging <dir>]
    [--cmajor-source <url|path>] [--choc-source <url|path>]
```

The destination JSON contains only `feedOrigin`, `rcloneRoot`, and optionally
`keychainService`. A real release reads the cohort capability from macOS
Keychain; a dry run uses the stand-in cohort `dry-run` and never reads the
Keychain, so it runs on Linux and in CI. The capability is never accepted in
command-line arguments; the object destination is passed to
rclone through a temporary environment-backed alias, not argv.

Steps, in order; every step fails closed:

1. **Source + export gates.** The command verifies HEAD is the exact
   `--source-sha` and that tracked and untracked state is clean, then
   `exportKit(staging/export, { feedUrl, sourceCommit: sourceSha })` exports
   committed inputs only and stamps the feed
   URL into `kit/feed.json` and renders `kit/cmake/dependency-sources.cmake`,
   then the allowlist, stray-file, forbidden-string and notices gates run, and
   the `kit/CHANGELOG.md` section for the version is required and dated. A
   second export in `staging/proof` runs `proveExport` (canonical
   typecheck/test, Enhance That build, update-flow merge); the proof dirties
   its tree, which is why the release tree is a separate copy.
2. **Pins.** `kit/cmake/dependencies.cmake` is the sole authored Cmajor
   commit for the native SDK and tool producer. Export derives the customer
   `kit/toolchain.json` `cmaj.forkCommit` from that committed declaration;
   release verifies they agree. Both tool artifact paths must remain
   under `tools/v<version>/`, matching the exported kit version. The mirror source is the upstream
   fork URL the monorepo declares (`BUILDER_KIT_CMAJOR_GIT_URL`), overridable with
   `--cmajor-source`; `--choc-source` overrides the CHOC source likewise.
3. **Tools (macOS).** Builds the pinned `cmaj` (`scripts/source_cmaj.mjs`:
   `tools/cmajor_command_build` → `build/cmajor_command/bin/cmaj`) and
   `CmajPlugin.vst3` (`node scripts/build_cmajplugin.mjs build`), archives them under the names in
   `kit/toolchain.json` (`cmaj-macos-arm64.tar.gz`, `CmajPlugin-macos-arm64.zip`),
   hashes them, and writes the SHA-256s into the staged `kit/toolchain.json`.
   `--skip-tools` skips the build; a real release then needs `--tools-dir`
   holding prebuilt archives with those exact names.
   After an interrupted run, retry against the kept staging directory with
   `--skip-tools --tools-dir <staging>/tools` to reuse the exact archived
   bytes whose hashes are already committed into the local release tag.
4. **Lineage.** In the `--lineage` clone (must be clean and on a branch) the
   working tree is replaced by the export, committed as `Builder Kit
   <version>`, tagged `v<version>`, and branch plus tag are pushed atomically.
   A retry reuses an existing local or remote tag only when its tag object,
   commit, and export match exactly; a mismatch fails closed. The manifest
   timestamp comes from the annotated tag, so retries reproduce it unchanged.
5. **Mirrors.** `staging/feed/kit.git`, `cmajor.git`, `choc.git` are bare clones
   (`git clone --bare`, `repack -a -d`, `update-server-info`) so git's dumb-HTTP
   protocol can serve them from a static bucket. The cmajor mirror must contain
   the pin, its `.gitmodules` entry for `include/choc` must use a **relative**
   URL (`../choc.git`, resolved against the cmajor URL exactly as git does), and
   the choc mirror must contain the gitlink commit. An absolute CHOC URL aborts
   the release: customers would leave the feed.
6. **Manifest + additive publish.** Versioned tool archives are copied to
   `staging/feed/tools/v<version>/` and
   `staging/feed/manifest.json` records version, tag, monorepo source commit,
   lineage commit, cmajor/choc commits, and tool hashes (no fork URLs). Then
   publication proceeds in separately verified phases: immutable Git objects
   and versioned tools (`copy --immutable --checksum`), cumulative pack
   discovery, Git refs, then the manifest last. Each phase is checked with
   `check --download --one-way` before the next begins. Bare-repo config,
   hooks, and logs are not published. Existing pack-list entries are retained
   alongside new packs, so old source pins remain discoverable even when no
   current fork ref reaches them. Publishing never deletes old release objects
   or overwrites versioned tool bytes. Serialize publishers per feed; retention
   cleanup is a separate operation.

Resulting feed layout under the cohort prefix:

```
kit.git/            bare mirror of builder-kit-releases (tag v<version>)
cmajor.git/         bare mirror of the Cmajor fork (pin in dependencies.cmake)
choc.git/           bare mirror of the CHOC fork (the cmajor gitlink commit)
tools/v<version>/cmaj-macos-arm64.tar.gz
tools/v<version>/CmajPlugin-macos-arm64.zip
manifest.json
```

`--dry-run` performs every local step: export and proof, the lineage commit
and tag on a throwaway clone under `staging/lineage` (an empty repo when
`--lineage` is omitted), mirrors whose sources are local paths, the manifest,
and prints the staging layout. It skips the push, object publication, tool builds
off macOS, and mirrors whose sources are remote URLs, printing what it would
have done. The staging dir is kept in every mode (default: a fresh
`builder-kit-release-<version>-*` dir in the OS temp dir).

`tests/test_release_builder_kit.mjs` covers the non-argv secret boundary,
source/version checks, relative submodule URL resolution, toolchain and
manifest rendering, atomic/ref-idempotent publication, interruption retries,
mirror creation, and a full Linux dry run against local fork repos.
`tests/test_kit_publication_order.mjs` injects failures into every publication
phase and verifies old/new tags and old source pins with cold dumb-HTTP clients.
