# Effect Plugin Architecture

This document describes the Builder Kit's effect-plugin system: how plugins under
`fx/` are discovered, developed, built, and packaged. The included plugin,
`fx/enhancer_lite` (Enhance That), is the running example.

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
  `fx/enhancer_lite`.
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
- The **shared view loader** is `kit/ui/view-loader.js`, the one
  module every plugin uses as its view entry.
- A **runtime folder** is a generated self-contained copy of a plugin under
  `build/fx/`. It is disposable output, never source.

## Source Tree Shape

```text
product-owner.json         (repository root: manufacturer, codes, bundle prefix)
kit/kit.json               (kit version + supported config schema versions)
kit/index.ts               (public import surface)
fx/enhancer_lite/
  EnhancerLite.cmajorpatch
  EnhancerLite.plugin.json (optional plugin config)
  EnhancerLite.cmajor
  state.ts                 (plugin state declaration, see PLUGIN_STATE.md)
  view/
    source.ts              (or source.tsx, any Vite-servable module)
```

A plugin created by `kit:new` also has `view/index.js`, a symlink to the shared
loader, so a host can load the source patch directly. Enhance That has none and
sets `jitInstallRuntime`, so hosts load its built runtime instead. The patch
manifest keeps one stable UI entrypoint:

```json
"view": {
  "src": "view/index.js",
  "devModule": "/fx/enhancer_lite/view/source.ts",
  "width": 820,
  "height": 560,
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
one discovery. It runs when a command first needs it, not when a module is
imported.

Per-patch settings come from the optional plugin config
`<PatchName>.plugin.json` (the patch file name with `.cmajorpatch` replaced by
`.plugin.json`):

```json
{
  "schemaVersion": 1,
  "alias": "enhancer-lite",
  "cmakeTarget": "EnhanceThat",
  "productName": "EnhanceThat",
  "product": { "...": "identity, see below" },
  "stateSource": "fx/enhancer_lite/state.ts",
  "runtimeOut": "build/fx/enhancer_lite_runtime",
  "juceOut": "build/enhancer_lite_juce",
  "jitInstallRuntime": true
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
  non-alphanumerics removed, e.g. "Enhance That" -> `EnhanceThat`. Overrides must stay
  identifier-shaped — they become cmake arguments and install/remove paths.
- `runtimeOut` / `juceOut`: `build/fx/<alias>_runtime` and `build/<alias>_juce`
  (alias `-` mapped to `_`). Overrides must resolve strictly inside `build/`.
  Runtime builds replace `runtimeOut`; native generation content-syncs a fresh
  `_build/generated-project-stage` into durable `juceOut` so unchanged files
  keep their timestamps while removed, changed, or missing outputs converge to
  the current inputs. `--clean` remains the explicit full `juceOut` reset.
- `previousProductName`: optional former bundle filename stem when renaming a
  plugin while retaining its identity. It must differ from `productName` and
  use the same identifier syntax. `fx:prod:install` removes
  `<previousProductName>.vst3` after the renamed bundle is installed and
  verified.
- `jitInstallRuntime`: defaults to true when the plugin has a state module or
  a worker bundle.

Config-only fields: `stateSource` (the plugin state declaration; the build
generates its worker), `workerSource`/`workerOut` (a hand-written worker entry
and its bundled file name, for plugins without a state module),
`includeInAll` (false excludes the target from the `all` build set), and
`disableMicrophonePermission`.

Configuration fails closed: a malformed or unknown-key config, an orphan
config whose name matches no patch, or a duplicate alias is an error naming the
file, never silently ignored. A broken plugin folder fails only the commands
that need it: building that plugin or `all`. Other plugins keep building, the
dev server keeps serving them and prints the error, and `kit:doctor` reports
it. A malformed patch manifest does not fail discovery (derivations fall back
to the file name and the build reports the parse error), so a patch being
edited stays visible.

`node kit/fx/build-effect.mjs --targets` prints the discovered aliases;
`--jit-plan <alias>` prints the JIT install plan for one target.

## Product Identity (the `product` object)

A plugin's customer-facing identity lives in the config's `product` object.
Keys: `productName` (display name), `manufacturerName`, `bundleIdentifier`
(reverse-DNS, e.g. `com.example.demo-verb`), `pluginCode` and
`manufacturerCode` (exactly 4 alphanumerics with at least one uppercase
letter), `version` (semantic), and the optional `supportUrl` (http/https).
The install filename is the top-level `productName`, not part of the object.

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
| `pluginCode` | owner `pluginCodePrefix` (default: first two characters of `manufacturerCode`) + the initials of the first two name words, e.g. `Yo` + `demo_verb` -> `YoDV` |
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
code/bundle-id/version shape or an unknown key is an error naming the file. Bundle identifiers and plugin codes are collision-checked
across **all** discovered plugins — config-driven and manifest-only alike —
and duplicates fail discovery naming both claiming patches.

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
it; nothing else does. The kit template ships the placeholder shown here. The
explicit doctor JSON report identifies those values; the first-use human
summary defers that configuration until the customer creates or distributes a
plug-in. A malformed owner file fails discovery; an absent one only matters
when a derivation needs it.

## Kit Version And Public Entry

`kit/kit.json` records the kit version and the schema versions of the files
the kit reads (`plugin` for `<Name>.plugin.json`, `toolchain` for
`kit/toolchain.json`, `feed` for `kit/feed.json`). `npm run kit:doctor`
prints the version and flags any plugin config whose `schemaVersion` is newer
than the kit supports.

`kit/index.ts` is the supported import surface: plugin code imports state,
presets, snapshots and controls from `kit/index` only, for example
`import { usePluginState, PresetBar } from "../../../kit/index"` in a plugin
view. Deep paths under `kit/ui/` are implementation layout and may move with
any kit update.

## Development Flow

`npm run fx:dev` starts one Vite server (`kit/fx/vite.config.mjs`) for all
plugin UIs on loopback port 5175 (`127.0.0.1` only). It also serves:

- `/__fx-dev-status`: a JSON status document with
  `kind: "fx-vite-dev-server"` and the discovered plugins (name, patch,
  `sourceModule`). Discovery is cached with a ~2s TTL, so new plugins appear
  without a restart. The project path and process id identify which project
  owns the shared port.
- `/fx/<dir>/view/harness.html`: a plugin's browser harness page, with the
  decoded path contained to `fx/` before any file is read.

When a plugin has no custom `view/harness.html`, this path serves the shared,
silent UI preview. It imports the manifest's real `view.devModule` factory and
passes the actual manifest identity with page-local parameter and stored-state
bindings. Stateful views automatically use the same session/client and shared
Undo/Redo as the plugin, with page-local storage in place of a host. Closing
and reopening a view retains that page's history. No author transport option
or extra state export is needed. The view exports a declarative `browserPreviewParameters` array in
the `BrowserPreviewParameter` shape, derived from its own parameter
definitions (see the included example and `kit:new` starter). This is only
metadata; it starts no development behavior in the production plugin.
Custom harness pages retain their existing behavior. Folders with more than
one patch need a custom harness to choose which patch to show.

The shared preview has no audio engine, DAW connection, or live analyzer
audio. Its state is independent for each page and resets on reload; it never
writes native user presets. Open it only when requested, using the server's
printed origin plus the path above. A browser preview is not a prerequisite
for building or installing a plugin, and a busy port must not be taken over.

The in-host loading chain is:

```text
DAW -> patched generic CmajPlugin.vst3 -> build/fx/enhancer_lite_runtime/EnhancerLite.cmajorpatch
    -> view/index.js (shared loader)
    -> http://127.0.0.1:5175/fx/enhancer_lite/view/source.ts
```

Cmajor owns the patch connection, parameter messages, stored state and DSP;
Vite owns module compilation, UI hot reload and shared imports. The host loads
a built copy of the runtime, so rerun `npm run fx:jit:install -- <alias>`
after a DSP edit.

## The Shared View Loader

`kit/ui/view-loader.js` default-exports a patch-view factory.
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
   another project is rejected and the loader falls back to the packaged UI.
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
build/fx/enhancer_lite_runtime/
  EnhancerLite.cmajorpatch (rewritten manifest)
  EnhancerLite.cmajor      (copied sources/resources)
  view/
    index.js               (materialized loader copy, not a symlink)
    app.js                 (Vite-bundled UI from devModule)
  worker.js                (the state worker, or the bundled workerSource)
```

Details:

- Manifest `source`/`resources`/`worker`/`sourceTransformer` entries that
  escape the patch directory (`../`, e.g. a shared repo file) are copied flat
  into the runtime folder under their base names, with collision checks, and
  the runtime manifest is rewritten to match — nothing is ever written outside
  the runtime folder.
- Output directories are validated to resolve strictly inside `build/` before
  any `rm -rf`.
- Worker builds: the state worker generated for `stateSource`, or the
  hand-written `workerSource`, is bundled by Vite into
  `<runtimeOut>/<workerOut>` (default `worker.js`) and the runtime manifest's
  `worker` key is rewritten to that file.
- The UI bundle is a single-file ES module (`inlineDynamicImports`), unminified,
  with source maps by default.
- Set `FX_DISTRIBUTABLE_RUNTIME=1` for a distribution build to omit UI and worker
  source maps. For example, `FX_DISTRIBUTABLE_RUNTIME=1 npm run fx:prod:build -- <alias>`
  rebuilds the runtime without maps before generating the dedicated plugin.
  Ordinary builds retain maps for debugging. This switch does not sign, notarize,
  or qualify a plugin for release.

**The prod devModule strip**: `npm run fx:prod:build` builds runtime folders
with `stripDevModule`, which removes `view.devModule` from the runtime patch
manifest for **every** plugin. Combined with the loader's opt-in rule above,
a released plugin can never probe a local port, execute code from a dev server,
or stall on startup. Plain `fx:build` keeps `devModule` so the runtime folder
still supports dev-server loading.

## Native Plugin Builds

`npm run fx:prod:build -- <alias>` then:

1. Resolves the `cmaj` executable: `BUILDER_KIT_CMAJ` when set (an absolute
   path to an executable, for your own build of the pinned fork;
   naming the downloaded tool keeps its hash check), otherwise
   `build/kit-tools/cmaj` when it matches the SHA-256 in `kit/toolchain.json`
   (`npm run kit:setup` downloads it from the feed named in `kit/feed.json`);
   otherwise the build stops with an error naming `npm run kit:setup`. The
   tool, the Cmajor source commit in `kit/cmake/dependencies.cmake`, and
   the generic `CmajPlugin.vst3` are pinned together. See
   [the toolchain contracts](TOOLCHAIN.md).
2. Runs `cmaj generate --target=juce` against the **generated runtime patch**
   (never the source patch) into
   `<juceOut>/_build/generated-project-stage`, rejects generated text that
   embeds that temporary path, then content-syncs the generated tree into
   `<juceOut>` via `kit/tools/effect_plugin_build`. Equal files retain
   timestamps, stale files are removed, missing files are restored, and
   `_build` is preserved. The stage is removed before CMake configures against
   the durable generated project. The public command invokes generation on
   every build; the sync avoids rewriting equal generated bytes. Framework and
   source dependency changes continue through CMake/compiler dependency
   tracking.
3. Configures and builds the generated JUCE project with CMake
   (`cmakeTarget`), with parallelism controlled by `BUILDER_KIT_PLUGIN_JOBS` /
   `BUILDER_KIT_CMAKE_JOBS` for `all` builds and `BUILDER_KIT_CMAKE` naming an
   exact CMake executable when one is required. JUCE and the pinned Cmajor sources
   are fetched by plain CPM from the URLs in
   `kit/cmake/dependency-sources.cmake`. The plugin package
   (`builder_kit_dependencies`) checks out the Cmajor headers plus
   the CHOC submodule only; the fork's LLVM, boost, and clap submodules are
   never fetched for a plugin build. The licensing obligations of the linked
   JUCE framework are the plugin owner's (`THIRD_PARTY_NOTICES.md`).
4. Verifies the built binary contains the patched CHOC WebView markers
   (`kit/scripts/check_choc_markers.mjs` is the single implementation of that
   check, shared by every caller).

`npm run fx:prod:install -- <alias>` copies the already-built, signed
`<productName>.vst3` into `~/Library/Audio/Plug-Ins/VST3`. It verifies the
bundle's signature and CHOC markers, copies it beside the destination,
replaces the previous copy, verifies the installed bundle again, and prints
the installed path. `--dry-run` runs the checks and prints the destination
without copying. Installation does not build, write `CmajPlugin.json`, or
touch AU plugins. See the
[native installation decision](decisions/native-vst3-installation.md).

## JIT Install (Development In A Host)

`npm run kit:setup` downloads the prebuilt, hash-pinned generic
`CmajPlugin.vst3` into `build/kit-tools/`. `npm run cmajplugin:install`
installs it. `npm run fx:jit:install -- <alias>` then writes the VST3
`CmajPlugin.json` pointing the generic plugin at one target:

- at the source patch by default, or
- at the built runtime patch when the target sets `jitInstallRuntime` (plugins
  whose source directory carries no loadable `view/index.js`, or that need a
  bundled worker): the installer builds the runtime first.

The installer checks the patch with `cmaj play --dry-run`, using the cmaj
resolved as for native builds, and verifies the installed generic plugin is
signed and carries the patched CHOC keyboard bridge. It never overwrites
`CmajPlugin.vst3` and never touches AU loaders. Both commands live in
`kit/scripts/cmajplugin.mjs`.

## Shared UI Kit

Plugin UIs compose the components and hooks exported from `kit/index.ts`
(state, presets, snapshots, knobs, sliders, filters, MSEG; see the
documentation table in `kit/AGENTS.md`). Every plugin shares the view entry
described above (`kit/ui/view-loader.js`), the silent browser preview behind
`/fx/<dir>/view/harness.html` (`kit/ui/preview/`), and the dev-server
inspector (`kit/ui/dev-inspector.js`). Presets and
snapshots are part of the plugin state declaration
([Plugin state](PLUGIN_STATE.md)): spread `presets()` and `snapshots()` into
`definePluginState` and render `PresetBar` and `SnapshotBar`.

## Adding A New Effect Plugin

For the opt-in shared state and Undo API, its generated worker, and React view
composition, see [Shared plugin state](PLUGIN_STATE.md). It requires the Cmajor
state-channel extension; it is not a replacement for an existing plugin's state
owner merely by importing the helpers.

```text
npm run kit:new -- <name>
```

The name is the `fx/` directory: lowercase letters and digits with `_` or `-`
separating words (`demo_verb`). The scaffold generates a minimal **working**
plugin — a stereo-gain `.cmajorpatch` + `.cmajor` example, the
`<PatchName>.plugin.json` config with its `product` object, the
`view/index.js` symlink to the shared loader, a `state.ts` declaration, an
editable React `view/source.tsx` using `createStatefulPatchView`, and a starter test at
`tests/test_<name>_state.mjs` (discovery registers the plugin, and its state
declaration loads and binds only DSP inputs) — then prints the next steps (`fx:dev`,
`fx:build -- <alias>`, the starter test). Every identity value derives from
the plugin name and `product-owner.json` (display name, patch base name,
alias, pluginCode, bundle identifier, manufacturer and its code); the
scaffold carries no manufacturer of its own and refuses to run without the
owner file. Its `stateSource` config generates the persistent state worker.
The view reads and edits `parameter("gainDb")` through `usePluginState` and
uses `usePluginHistory` for Undo/Redo; pointer drags form one history entry.
Add fields to this declaration instead of creating separate parameter caches
or Undo stacks. See [Plugin state](PLUGIN_STATE.md). It refuses names whose directory, alias, derived pluginCode, or
bundle identifier collides with any existing plugin. Because the registry is
discovery-driven, no shared file changes; `fx:dev`, `fx:build`,
`fx:prod:build`, and `fx:jit:install` all see the new plugin immediately.

Manual equivalent: create the directory with a `.cmajorpatch` whose `view.src`
is `view/index.js`, symlink `view/index.js` to
`../../../kit/ui/view-loader.js`, set `view.devModule`, add a
`<PatchName>.plugin.json` (with `"schemaVersion": 1`) only when a derivation
needs overriding, and give it a `product` object only when the plugin needs
customer-facing identity.

A plugin must never add its own build script, dev server, or committed UI
bundle — the shared pipeline owns those behaviors.
