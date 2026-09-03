# Effect Plugin Architecture

This document describes the Builder Kit's effect-plugin system: how plugins under
`fx/` are discovered, developed, built, and packaged. It replaces the pre-kit
`FX_PLUGIN_UI_ARCHITECTURE.md`, which described an older hand-written registry
and loader.

## Goals

- Adding a plugin touches zero shared files: the registry is derived by scanning
  `fx/*/`, and per-plugin settings live beside the plugin's own patch.
- One shared Vite dev server, one shared view loader, one shared build pipeline
  for every plugin.
- Release builds contain zero dev behavior: no dev-server probe, no timers, no
  network, no repo-internal error copy.
- Patch manifests stay stable between development and production; generated
  output lives only under `build/`.

## Terms

- An **effect plugin** is a standalone Cmajor effect under `fx/`, such as
  `fx/ott_lab`.
- A **patch manifest** is the `.cmajorpatch` JSON file naming the DSP source and
  UI entry.
- A **plugin config** is the optional `<PatchName>.plugin.json` next to the
  patch holding every per-plugin setting: build settings and, in its `product`
  object, the plugin's customer-facing identity (names, bundle identifier,
  4-char codes, version).
- The **product owner file** is the repository-root `product-owner.json`
  (manufacturer, manufacturer code, bundle-identifier prefix) every plugin's
  identity derives from.
- The **kit manifest** is `kit/kit.json`: the kit version and the config
  schema versions this kit reads.
- The **public entry** is `kit/index.ts`, the one module plugin code imports
  kit components from.
- The **shared view loader** is `kit/ui/effects/effect-view-loader.js`, the one
  module every plugin uses as its view entry.
- A **runtime folder** is a generated self-contained copy of a plugin under
  `build/fx/`. It is disposable output, never source.

## Source Tree Shape

```text
product-owner.json         (repository root: manufacturer, codes, bundle prefix)
kit/kit.json               (kit version + supported config schema versions)
kit/index.ts               (public import surface)
fx/ott_lab/
  OttLab.cmajorpatch
  OttLab.plugin.json       (optional plugin config)
  OttLab.cmajor
  view/
    index.js -> ../../../kit/ui/effects/effect-view-loader.js
    source.js              (or source.tsx, any Vite-servable module)
```

`view/index.js` is a symlink to the shared loader. The patch manifest keeps one
stable UI entrypoint:

```json
"view": {
  "src": "view/index.js",
  "devModule": "/fx/ott_lab/view/source.js",
  "width": 920,
  "height": 720,
  "resizable": true
}
```

`src` must be `view/index.js` (the build fails otherwise). `devModule` is the
repo-absolute path of the editable UI module the shared dev server serves for
this plugin; it is the only plugin-specific UI path that is declared anywhere.

The source tree must not contain generated UI bundles (`view/app.js`,
`view/bundle.js`); the build writes those into runtime folders only.

## Discovery Registry

There is no hand-written plugin list. `kit/fx/build-effect.mjs` exports
`discoverEffectPlugins()`, which scans every `fx/<dir>/` for `.cmajorpatch`
files (a directory may hold several; all are enumerated, sorted). The dev
server, both build pipelines, the JIT installer, and the tests all consume this
one discovery.

Per-patch settings come from the optional plugin config
`<PatchName>.plugin.json` (the patch file name with `.cmajorpatch` replaced by
`.plugin.json`):

```json
{
  "schemaVersion": 1,
  "alias": "ott",
  "cmakeTarget": "OTTLab",
  "productName": "OTTLab",
  "product": { "...": "identity, see below" },
  "runtimeOut": "build/fx/ott_lab_runtime",
  "juceOut": "build/ott_lab_juce"
}
```

`schemaVersion` is required and must not exceed `schemaVersions.plugin` in
`kit/kit.json`; a config written for a newer kit fails discovery naming the
fix (update the kit) instead of tripping over keys this kit does not know.
Every other field is optional and falls back to a derivation:

- `alias` (registry key and CLI name): the directory name lowercased with runs
  of non-alphanumerics collapsed to `-`. A directory holding more than one
  patch must disambiguate with explicit aliases; duplicate aliases fail
  discovery.
- `cmakeTarget` / `productName` (the install filename, `<productName>.vst3`):
  the manifest `name` (falling back to the patch file base name) with
  non-alphanumerics removed, e.g. "OTT Lab" -> `OTTLab`. Overrides must stay
  identifier-shaped — they become cmake arguments and install/remove paths.
- `runtimeOut` / `juceOut`: `build/fx/<alias>_runtime` and `build/<alias>_juce`
  (alias `-` mapped to `_`). Overrides must resolve strictly inside `build/`;
  they are deleted before builds.
- `jitInstallRuntime`: defaults to true when the plugin has a worker bundle.

Config-only fields: `workerSource`/`workerOut` (repo-relative worker entry and
its bundled file name), `includeInAll` (false excludes the target from the
`all` build set), `editorMaxWidth`, `visualReviewAdapter`, and
`disableMicrophonePermission`.

Configuration fails closed: a malformed or unknown-key config, an orphan
config whose name matches no patch, or a duplicate alias aborts discovery with
an error instead of being silently ignored. A malformed patch manifest does not
abort discovery (derivations fall back to the file name and the build reports
the parse error later), matching the dev server's tolerance for in-progress
patches.

`node kit/fx/build-effect.mjs --targets` prints the discovered aliases;
`--jit-plan <alias>` prints the JIT install plan for one target.

**Legacy two-file configs.** The previous scheme — a `<PatchName>.build.json`
build sidecar plus a directory-level `product.json` (with `patch` and
`outputFileName` keys) — is still read for one release so checkouts that
have not migrated keep building; `npm run kit:doctor` warns about every such
file. A patch may not mix the schemes: a `.plugin.json` beside a `.build.json`
or a `product.json` bound to the same patch fails discovery.

## Product Identity (the `product` object)

A plugin's customer-facing identity lives in the config's `product` object.
Keys: `productName` (display name), `manufacturerName`, `bundleIdentifier`
(reverse-DNS, e.g. `dev.cosimo.enhancer-lite`), `pluginCode` and
`manufacturerCode` (exactly 4 alphanumerics with at least one uppercase
letter), `version` (semantic), and the optional `supportUrl` (http/https),
`wordmark` (a plugin-directory-relative file that must exist), and
`accentColor` (`#RRGGBB`). The install filename is the top-level
`productName`, not part of the object.

**Presence makes it authoritative; absence keeps the manifest authoritative.**
When the `product` object exists — even empty — discovery fills every
omitted key from the plugin name, the patch manifest, and the repository's
`product-owner.json`:

| key | derived from |
| --- | --- |
| `productName` | manifest `name`, else the directory name as words ("demo_verb" -> "Demo Verb") |
| `manufacturerName` | `product-owner.json` `manufacturer` |
| `manufacturerCode` | `product-owner.json` `manufacturerCode` |
| `bundleIdentifier` | `product-owner.json` `bundleIdentifierPrefix` + `.` + alias |
| `pluginCode` | owner `pluginCodePrefix` (default: first two characters of `manufacturerCode`) + the initials of the first two name words, e.g. `Cs` + `demo_verb` -> `CsDV` |
| `version` | manifest `version`, else `0.1.0` |
| `supportUrl` | `product-owner.json` `supportUrl` when set |

A derivation that needs the owner file fails discovery when the file is
absent, naming the key to set explicitly. The resolved identity is validated
like explicit values, then discovery derives the manifest-facing identity
(`plugin.identity`: `ID`, `name`, `manufacturer`, `version`,
`plugin.pluginCode`/`manufacturerCode`), requires the source patch manifest to
agree (drift fails discovery — the source patch is what dev and JIT hosts load,
so a divergent manifest would ship two identities), and writes that identity
into the generated runtime manifest. A plugin without a `product` object
changes in no way: its patch manifest remains the only identity authority.

Identity validation fails closed like the build fields: a bad
code/bundle-id/version shape, an unknown key, or a missing wordmark file
aborts discovery. Bundle identifiers and plugin codes are collision-checked
across **all** discovered plugins — config-driven and manifest-only alike —
and duplicates fail discovery naming both claiming patches.

Of the shipped plugins, only `fx/enhancer_lite/` (the customer-facing
product) carries a `product` object; its values mirror the patch manifest, so
builds are byte-identical with or without it. The other plugins stay
manifest-only until they need customer-facing identity.

## Product Owner (`product-owner.json`)

The repository root holds one `product-owner.json`:

```json
{
  "manufacturer": "Your Company",
  "manufacturerCode": "Yoco",
  "bundleIdentifierPrefix": "com.example",
  "supportUrl": "https://example.com/support"
}
```

`manufacturer`, `manufacturerCode` (4-char code), and `bundleIdentifierPrefix`
(reverse-DNS prefix) are required; `supportUrl` and `pluginCodePrefix` (two
characters) are optional. `kit:new` and the identity derivations above read
it; nothing else does. The kit template ships the placeholder shown here, and
`npm run kit:doctor` warns while the placeholder values are still in place.
A malformed owner file fails discovery; an absent one only matters when a
derivation needs it.

## Kit Version And Public Entry

`kit/kit.json` records the kit version and the schema versions of the files
the kit reads (`plugin` for `<Name>.plugin.json`, `toolchain` for
`kit/toolchain.json`, `feed` for `kit/feed.json`). `npm run kit:doctor`
prints the version and flags any plugin config whose `schemaVersion` is newer
than the kit supports.

`kit/index.ts` is the supported import surface: plugin code imports the effect
core (presets, preset bar, snapshots and snapshot bar, effect header, state
contract, stored-state runtime mirror, patch worker services) and the
primitives (React patch-connection bindings, editor tokens and surfaces,
curve geometry, filter range editor, parameter value entry, the spectrum
display) from `kit/index` only — `import { createPresetBar } from
"../../../kit/index"` from a plugin view. Deep paths under `kit/ui/` are
implementation layout and may move with any kit update.

## Development Flow

`npm run fx:dev` starts one Vite server (`kit/fx/vite.config.mjs`) for all
plugin UIs on port 5175. It also serves:

- `/__fx-dev-status`: a JSON status document with
  `kind: "fx-vite-dev-server"` and the discovered plugins (name, patch,
  `sourceModule`). Discovery is cached with a ~2s TTL, so new plugins appear
  without a restart. The repo checkout path and pid are included only for
  loopback requests (worktree disambiguation stays off the wire).
- `/fx/<dir>/view/harness.html`: a plugin's browser harness page, with the
  decoded path contained to `fx/` before any file is read.

The in-host loading chain is:

```text
DAW -> patched generic CmajPlugin.vst3 -> fx/ott_lab/OttLab.cmajorpatch
    -> view/index.js (shared loader)
    -> http://127.0.0.1:5175/fx/ott_lab/view/source.js
```

Cmajor owns the patch connection, parameter messages, stored state, and DSP hot
reload; Vite owns module compilation, UI hot reload, and shared imports.

## The Shared View Loader

`kit/ui/effects/effect-view-loader.js` default-exports a patch-view factory.
Its behavior:

1. Read `view.devModule` from the patch connection's manifest (or an explicit
   `options.source` when created via `createEffectPatchView(options)`).
2. **No `devModule` means no dev behavior at all**: the loader immediately
   imports the packaged production module (`./app.js` beside the loader) — no
   probe, no timer, no network.
3. With a `devModule`, probe `GET <origin>/__fx-dev-status` (default origin
   `http://127.0.0.1:5175`, 500 ms timeout guarding only the probe). The
   response must identify itself as the fx dev server **and** list this exact
   `devModule` among its served plugins — a reachable-but-stale server from
   another worktree is rejected and the loader falls back to the packaged UI.
4. On a confirmed dev server: load the Vite client, the React refresh preamble
   (optional), and the effect dev tools overlay, then import the dev module.
5. Either path must yield a module whose default export (or `createPatchView`)
   returns an `HTMLElement`.

Load failures render a neutral message-only error view (`data-role`
`effect-load-error`); stacks and cause chains go to the console only.

## Production Runtime Builds

`npm run fx:build -- <alias>` (or `-- all`) produces a self-contained runtime
folder:

```text
build/fx/ott_lab_runtime/
  OttLab.cmajorpatch       (rewritten manifest)
  OttLab.cmajor            (copied sources/resources)
  view/
    index.js               (materialized loader copy, not a symlink)
    app.js                 (Vite-bundled UI from devModule)
  worker.js                (only for plugins with workerSource)
```

Details:

- Manifest `source`/`resources`/`worker`/`sourceTransformer` entries that
  escape the patch directory (`../`, e.g. a shared repo file) are copied flat
  into the runtime folder under their base names, with collision checks, and
  the runtime manifest is rewritten to match — nothing is ever written outside
  the runtime folder.
- Output directories are validated to resolve strictly inside `build/` before
  any `rm -rf`.
- Worker builds: `workerSource` is bundled by Vite into
  `<runtimeOut>/<workerOut>` (default `worker.js`) and the runtime manifest's
  `worker` key is rewritten to that file.
- The UI bundle is a single-file ES module (`inlineDynamicImports`), unminified,
  with source maps by default.

**The prod devModule strip**: `npm run fx:prod:build` builds runtime folders
with `stripDevModule`, which removes `view.devModule` from the runtime patch
manifest for **every** plugin. Combined with the loader's opt-in rule above,
a released plugin can never probe a local port, execute code from a dev server,
or stall on startup. Plain `fx:build` keeps `devModule` so the runtime folder
still supports dev-server loading.

## Native Plugin Builds

`npm run fx:prod:build -- <alias>` then:

1. Resolves the pinned `cmaj` executable: `build/kit-tools/cmaj` when it
   matches the SHA-256 in `kit/toolchain.json` (`npm run kit:setup` downloads
   it from the feed named in `kit/feed.json`); a checkout carrying the Cmajor
   command-tool source may fall back to its own pinned build; otherwise the
   build stops with an error naming `npm run kit:setup`. The tool, the Cmajor
   source commit in `kit/cmake/CosimoDependencies.cmake`, and the generic
   `CmajPlugin.vst3` are pinned together.
2. Runs `cmaj generate --target=juce` against the **generated runtime patch**
   (never the source patch) into `<juceOut>`, via `kit/tools/effect_plugin_build`.
3. Configures and builds the generated JUCE project with CMake
   (`cmakeTarget`), with parallelism controlled by `COSIMO_PLUGIN_JOBS` /
   `COSIMO_CMAKE_JOBS` for `all` builds. JUCE and the pinned Cmajor sources
   are fetched by plain CPM from the URLs in
   `kit/cmake/dependency-sources.cmake`. The plugin package
   (`cosimo_add_production_dependencies`) checks out the Cmajor headers plus
   the CHOC submodule only; the fork's LLVM, boost, and clap submodules are
   never fetched for a plugin build. The licensing obligations of the linked
   JUCE framework are the plugin owner's (`THIRD_PARTY_NOTICES.md`).
4. Verifies the built binary contains the patched CHOC WebView markers
   (`kit/scripts/check_choc_markers.mjs` is the single implementation of that
   check, shared by every caller).

`npm run fx:prod:install -- <alias>` copies the already-built
`<productName>.vst3` into the user VST3 folder. It does not build, does not
write `CmajPlugin.json`, and does not touch AU plugins.

## JIT Install (Development In A Host)

`npm run kit:setup` downloads the prebuilt, hash-pinned generic
`CmajPlugin.vst3` into `build/kit-tools/`. `npm run cmajplugin:install`
installs that pinned setup artifact by default. `npm run cmajplugin:build`
followed by `npm run cmajplugin:install -- --from-source` is the explicit source route
(`cosimo_add_cmajor_toolchain_dependencies`: the full Cmajor fork checkout with
its LLVM, boost, and clap submodules from their upstream GitHub SSH URLs, so
this is a maintainer path that needs GitHub SSH access). `npm run fx:jit:install -- <alias>` then writes the VST3
`CmajPlugin.json` pointing the generic plugin at one target:

- at the source patch by default, or
- at the built runtime patch when the target sets `jitInstallRuntime` (plugins
  whose source directory carries no loadable `view/index.js`, or that need a
  bundled worker) — the installer builds the runtime first.

The installer validates the patch and verifies the installed generic plugin is
signed and carries the patched CHOC keyboard bridge. It never overwrites
`CmajPlugin.vst3` and never touches AU loaders.
Patch validation uses setup's archive-and-payload-verified `cmaj`; no global
command is required or accepted. A maintainer can explicitly pass `--from-source`
only when the repo contains `tools/cmajor_command_build` and its executable at
`build/cmajor_command/bin/cmaj`.

## Shared UI Kit

Plugin UIs compose modules from `kit/ui/` (generic editor primitives, tokens,
curve/slider surfaces) and `kit/ui/effects/`:

- `effect-view-loader.js` — the view entry described above.
- `effect-state-contract.ts` — endpoint/state contract checks (globally unique
  endpoint ids, hidden endpoints not preset-addressable).
- `effect-preset-v2.ts`, `effect-preset-store-v2.ts`,
  `standalone-effect-presets.ts`, `use-standalone-effect-presets.ts`,
  `preset-bar.ts` — the v2 preset system: wire format, persistent store,
  generic controller, React hook, and the preset-bar custom element.
- `effect-snapshots.ts`, `effect-snapshot-bank.ts`, `snapshot-bar.ts` — the
  A–G snapshot system for fast local experimentation.
- `effect-header.ts`, `effect-toast.ts`, `effect-utils.ts` — shared chrome and
  helpers.

Custom-element names (`cosimo-preset-bar`, `cosimo-snapshot-bar`,
`cosimo-effect-header`) are defaults — the defining/creating functions take an
element-name parameter — and the snapshot bank's stored-state key is likewise
an option. The `"cosimo.*"` wire-format kinds are exported constants shared by
every producer and consumer of those envelopes.

**Extension seams**: the generic preset controller
(`StandaloneEffectPresetController`) and the preset bar (`PresetBar`) are
extended by subclassing and overriding their `protected` hooks — the
controller's identity/sound-replacement seams (`getUnnamedLabel`,
`supportsInit`, `requestSoundReplacement`, ...) and the bar's presentation
hooks (`_prepareController`, `_afterStateRender`, `_hasOpenExtensionSurface`,
...). A host product registers its subclass under the default element name
before any generic caller does; registering a non-subclass under that name
throws. The generic modules must stay free of product-specific imports —
import-graph tests enforce this. See `kit/skills/cosimo-make-plugin/SKILL.md`
for the worked extension example.

## Adding A New Effect Plugin

```text
npm run kit:new -- <name>
```

The name is the `fx/` directory: lowercase letters and digits with `_` or `-`
separating words (`demo_verb`). The scaffold generates a minimal **working**
plugin — a stereo-gain `.cmajorpatch` + `.cmajor` example, the
`<PatchName>.plugin.json` config with its `product` object, the
`view/index.js` symlink to the shared loader, an editable `view/source.ts`
wired to the `createPatchView` convention, and a starter test at
`tests/test_<name>_state.mjs` — then prints the next steps (`fx:dev`,
`fx:build -- <alias>`, the starter test). Every identity value derives from
the plugin name and `product-owner.json` (display name, patch base name,
alias, pluginCode, bundle identifier, manufacturer and its code); the
scaffold carries no manufacturer of its own and refuses to run without the
owner file. It refuses names whose directory, alias, derived pluginCode, or
bundle identifier collides with any existing plugin. Because the registry is
discovery-driven, no shared file changes; `fx:dev`, `fx:build`,
`fx:prod:build`, and `fx:jit:install` all see the new plugin immediately.

Manual equivalent: create the directory with a `.cmajorpatch` whose `view.src`
is `view/index.js`, symlink `view/index.js` to
`../../../kit/ui/effects/effect-view-loader.js`, set `view.devModule`, add a
`<PatchName>.plugin.json` (with `"schemaVersion": 1`) only when a derivation
needs overriding, and give it a `product` object only when the plugin needs
customer-facing identity.

A plugin must never add its own build script, dev server, or committed UI
bundle — the shared pipeline owns those behaviors.
