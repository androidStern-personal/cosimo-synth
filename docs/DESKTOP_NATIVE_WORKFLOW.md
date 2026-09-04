# Desktop synth UI and native workflow

Use this reference for the Cosimo desktop synth, its standalone app, and `CosimoDesktopNative` plug-ins. Effect plug-ins under `fx/` use the Builder Kit workflow instead.

## Authored and generated UI

- `WavetableSynth.cmajorpatch` and `WavetableSynth.iOS.cmajorpatch` are authored source. Build tools must preserve them.
- The desktop manifest loads `patch_gui/desktop/index.js`. That stable generated loader defaults to packaged `./app.js`; development mode may select the Vite module only through native startup configuration.
- `build_assets.py` derives `assets/factory-bank-catalog.json` from `assets/factory-table-catalog.json`; it does not own either patch manifest.
- React Grab is a development-only import in `ui/desktop/patch-view-entry.tsx`: Vite development mode imports `react-grab` and `@react-grab/mcp/client`; the Codex MCP command is `npx -y @react-grab/mcp --stdio`, not the deprecated `@react-grab/codex` package. Compiled bundles must not load React Grab.

`tests/test_patch_view_layout.mjs` and `tests/test_desktop_standalone_loader.mjs` protect the manifest/loader boundary. These source and browser checks do not prove a native app is attached to the current HMR session.

## Commands and evidence

- `npm run synth:desktop:build` builds the compiled desktop wrapper through `scripts/build_desktop_native.sh`.
- `npm run synth:desktop:dev` starts the fixed loopback Vite endpoint at `http://127.0.0.1:5174`, rebuilds in `dev-server` mode, and launches the standalone app from `build/desktop_native/CosimoDesktopNative_artefacts/Release/Standalone/CosimoDesktopNative.app`.
- A desktop UI change must leave a running standalone development app unless the user explicitly excludes launch. Review requires a fresh server for this worktree, a wrapper rebuilt for that server, and a relaunched app. Report process launch and active HMR as separate facts; a compiled standalone build is not HMR proof.
- A completed desktop feature must build and install the current compiled VST3 at `~/Library/Audio/Plug-Ins/VST3/CosimoDesktopNative.vst3` unless the user explicitly excludes that gate. Build/test success does not establish installation, Ableton discovery, or listening acceptance. When a task explicitly excludes launch or install, record the gate as unperformed rather than weakening the standing delivery contract.

Port 5174 and `build/desktop_native` are shared operational resources. Never seize the port, terminate another worktree's process, or treat another tree's build as evidence.

## Known install collision

At source baseline `7341f963`, `scripts/run_desktop_native_dev.sh` calls `scripts/build_desktop_native.sh` in `dev-server` mode, while that builder replaces installed AU and VST3 bundles in both modes. A development launch can therefore replace the installed compiled plug-ins. This is unresolved.

Until the build/install ownership is separated and behaviorally qualified, treat `npm run synth:desktop:dev` as an installed-plug-in mutation: run it only with that authority, serialize it with all plug-in installs, and rebuild/reinstall the compiled artifact before subsequent host acceptance. Do not infer that an installed binary is current after HMR work.

## Host-specific work

For the macOS `WKWebView` keyboard bridge, event lifetime, and known focus crashes, use [`../KEYBOARD_INVESTIGATION.md`](../KEYBOARD_INVESTIGATION.md). For generic `CmajPlugin` AU/VST3 compatibility and install boundaries, use [`../kit/docs/HOST_COMPATIBILITY.md`](../kit/docs/HOST_COMPATIBILITY.md).
