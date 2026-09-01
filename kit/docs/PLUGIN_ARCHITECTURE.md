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
- A **build sidecar** is an optional `<PatchName>.build.json` next to the patch
  holding per-plugin build settings.
- A **product identity file** is an optional `product.json` next to the patch
  holding the plugin's customer-facing identity (names, bundle identifier,
  4-char codes, version, install filename).
- The **shared view loader** is `kit/ui/effects/effect-view-loader.js`, the one
  module every plugin uses as its view entry.
- A **runtime folder** is a generated self-contained copy of a plugin under
  `build/fx/`. It is disposable output, never source.

## Source Tree Shape

```text
fx/ott_lab/
  OttLab.cmajorpatch
  OttLab.build.json        (optional sidecar)
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

Per-patch settings come from the optional sidecar `<PatchName>.build.json`.
Absent fields fall back to derivations:

- `alias` (registry key and CLI name): the directory name lowercased with runs
  of non-alphanumerics collapsed to `-`. A directory holding more than one
  patch must disambiguate with sidecar aliases; duplicate aliases fail
  discovery.
- `cmakeTarget` / `productName`: the manifest `name` (falling back to the patch
  file base name) with non-alphanumerics removed, e.g. "OTT Lab" -> `OTTLab`.
  Sidecar overrides must stay identifier-shaped — they become cmake arguments
  and install/remove paths.
- `runtimeOut` / `juceOut`: `build/fx/<alias>_runtime` and `build/<alias>_juce`
  (alias `-` mapped to `_`). Overrides must resolve strictly inside `build/`;
  they are deleted before builds.
- `jitInstallRuntime`: defaults to true when the plugin has a worker bundle.

Sidecar-only fields: `workerSource`/`workerOut` (repo-relative worker entry and
its bundled file name), `includeInAll` (false excludes the target from the
`all` build set), and `disableMicrophonePermission`.

Configuration fails closed: a malformed or unknown-key sidecar, an orphan
sidecar whose name matches no patch, or a duplicate alias aborts discovery with
an error instead of being silently ignored. A malformed patch manifest does not
abort discovery (derivations fall back to the file name and the build reports
the parse error later), matching the dev server's tolerance for in-progress
patches.

`node kit/fx/build-effect.mjs --targets` prints the discovered aliases;
`--jit-plan <alias>` prints the JIT install plan for one target.

## Product Identity (`product.json`)

A plugin's customer-facing identity may live in a `product.json` beside its
patch. Required keys: `productName`, `manufacturerName`, `bundleIdentifier`
(reverse-DNS, e.g. `dev.cosimo.enhancer-lite`), `pluginCode` and
`manufacturerCode` (exactly 4 alphanumerics with at least one uppercase
letter), `version` (semantic), and `outputFileName` (the install filename —
`<outputFileName>.vst3`). Optional keys: `supportUrl` (http/https),
`wordmark` (a plugin-directory-relative file that must exist), and
`accentColor` (`#RRGGBB`). A directory holding several patches must set the
optional `patch` key to the `.cmajorpatch` the identity belongs to.

**Presence makes it authoritative; absence keeps the manifest authoritative.**
When `product.json` exists, discovery derives the manifest-facing identity
from it (`plugin.identity`: `ID`, `name`, `manufacturer`, `version`,
`plugin.pluginCode`/`manufacturerCode`), requires the source patch manifest
to agree (drift fails discovery — the source patch is what dev and JIT hosts
load, so a divergent manifest would ship two identities), writes that
identity into the generated runtime manifest, and owns the install filename —
a build sidecar that also sets `productName` fails discovery, so identity is
never duplicated across files. A plugin without `product.json` changes in no
way: its patch manifest remains the only identity authority.

Identity validation fails closed like the sidecars: a malformed or
unknown-key file, a bad code/bundle-id/version shape, a missing wordmark
file, or an unbound/ambiguous `patch` key aborts discovery. Bundle
identifiers and plugin codes are collision-checked across **all** discovered
plugins — product.json-driven and manifest-only alike — and duplicates fail
discovery naming both claiming patches.

Of the shipped plugins, only `fx/enhancer_lite/` (the customer-facing
product) carries a `product.json`; its values mirror the patch manifest, so
builds are byte-identical with or without it. The other plugins stay
manifest-only until they need customer-facing identity.

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

1. Builds (or reuses) the pinned `cmaj` executable from the fork pinned in
   `kit/cmake/CosimoDependencies.cmake`.
2. Runs `cmaj generate --target=juce` against the **generated runtime patch**
   (never the source patch) into `<juceOut>`, via `kit/tools/effect_plugin_build`.
3. Configures and builds the generated JUCE project with CMake
   (`cmakeTarget`), with parallelism controlled by `COSIMO_PLUGIN_JOBS` /
   `COSIMO_CMAKE_JOBS` for `all` builds.
4. Verifies the built binary contains the patched CHOC WebView markers
   (`kit/scripts/check_choc_markers.mjs` is the single implementation of that
   check, shared by every caller).

`npm run fx:prod:install -- <alias>` copies the already-built
`<productName>.vst3` into the user VST3 folder. It does not build, does not
write `CmajPlugin.json`, and does not touch AU plugins.

## JIT Install (Development In A Host)

`npm run cmajplugin:build` / `npm run cmajplugin:install` build and install the
patched generic `CmajPlugin.vst3` from the same pinned Cmajor source used by
production builds. `npm run fx:jit:install -- <alias>` then writes the VST3
`CmajPlugin.json` pointing the generic plugin at one target:

- at the source patch by default, or
- at the built runtime patch when the target sets `jitInstallRuntime` (plugins
  whose source directory carries no loadable `view/index.js`, or that need a
  bundled worker) — the installer builds the runtime first.

The installer validates the patch and verifies the installed generic plugin is
signed and carries the patched CHOC keyboard bridge. It never overwrites
`CmajPlugin.vst3` and never touches AU loaders.

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
`<PatchName>.build.json` sidecar, the `product.json` identity file (derived
`Cs..` pluginCode and `dev.cosimo.<alias>` bundle identifier), the
`view/index.js` symlink to the shared loader, an editable `view/source.ts`
wired to the `createPatchView` convention, and a starter test at
`tests/test_<name>_state.mjs` — then prints the next steps (`fx:dev`,
`fx:build -- <alias>`, the starter test). It refuses names whose directory,
alias, derived pluginCode, or bundle identifier collides with any existing
plugin. Because the registry is discovery-driven, no shared file changes;
`fx:dev`, `fx:build`, `fx:prod:build`, and `fx:jit:install` all see the new
plugin immediately.

Manual equivalent: create the directory with a `.cmajorpatch` whose `view.src`
is `view/index.js`, symlink `view/index.js` to
`../../../kit/ui/effects/effect-view-loader.js`, set `view.devModule`, add a
sidecar only when a derivation needs overriding, and add `product.json` only
when the plugin needs customer-facing identity.

A plugin must never add its own build script, dev server, or committed UI
bundle — the shared pipeline owns those behaviors.
