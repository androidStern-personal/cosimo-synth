# BK-24E guidance disposition

This review accounts for every substantive rule in the source-baseline root `AGENTS.md` and `kit/AGENTS.md`. Continuation bullets such as file lists and shell commands are grouped with the rule they qualify. The baseline is `7341f96372e4561b5e02a5a7f870fdc3b8d64909`; the BK-24 planning commit is `bec24a085bb08dbc9ef5a6e6c1255d0f6c09c1d4`.

The disposition terms are:

- **Keep**: still a minimum universal boundary in the relevant `AGENTS.md`.
- **Relocate**: still current or unresolved, now in a focused reference loaded only for that work.
- **Enforced**: the behavior is owned by source and a relevant behavioral test executed against the candidate. Source inspection or structural/string checks alone count only as a partial guard; safety guidance remains conditional until behavioral proof exists.
- **Retire**: obsolete history, duplicated navigation, or machine-specific receipt; current truth is derived elsewhere.
- **Duplicate**: already owned by the personal overlay and not repeated as repository policy unless the repository adds a distinct constraint.

Relocation is not enforcement. Every unresolved compatibility or workflow limit below remains explicit.

## Instruction size

| File | Before | After |
|---|---:|---:|
| Root `AGENTS.md` | 123 lines / 15,775 bytes | 19 lines / 2,170 bytes |
| `kit/AGENTS.md` | 50 lines / 8,715 bytes | 26 lines / 2,905 bytes |
| Mandatory total | 173 lines / 24,490 bytes | 45 lines / 5,075 bytes |

The focused references are conditional. An unrelated task does not load them all.

## Verification in this guidance branch

The commands and results in this section are the only tests executed for BK-24E. Test names elsewhere in the inventory describe inspected current coverage or historical evidence; they are not claims that those suites ran in this branch.

- `node --test tests/test_kit_export.mjs`: 7 passed, 0 failed. This exercised committed-source export provenance, public-entry imports, customer proof command selection, private-identifier scanning, dependency-source rendering, the exported starter tree, and the new cold-reader guidance routes/link resolution.
- `node --test tests/test_desktop_standalone_loader.mjs`: 5 passed, 0 failed. This exercised compiled/dev loader selection and invalid-mode handling; it did not launch a native app.
- `node --test tests/test_desktop_standalone_loader.mjs tests/test_seqfx_fontaudio_assets.mjs`: the five loader cases passed, then the fontaudio test file failed before its assertions because this worktree has no `esbuild` package (`ERR_MODULE_NOT_FOUND` from `kit/tests/helpers/load_ui_module.mjs`). No dependency install was performed; fontaudio coverage remains source-inspected/unexecuted here.
- Static checks passed: Markdown-link resolution across the nine routed guidance files; every documented `npm run` command resolved in the source or exported package scripts; ordered disposition IDs R01-R68 and K01-K30; protected-file exclusion; `git diff --check`; and zero product/private identifiers in changed exported instruction files.
- No native build, install, HMR server, DAW, device, release, publication, or broad suite was run by BK-24E.

Composed worker evidence, reviewed as an integration dependency and not executed by BK-24E: rebased BK-24A/B/D commit `ef2fa4d7` (integrated by `8d9e2878`) reports `node --test tests/test_fx_build_args.mjs` with 57 passed and 0 failed. The coordinator owns final composed verification.

## Root rule inventory

Original line numbers refer to the 123-line baseline file.

| ID / original lines | Original rule | Disposition | Current owner and evidence |
|---|---|---|---|
| R01 / 5 | Read all of `kit/AGENTS.md` for every plug-in task. | **Relocate** | Root now routes plug-in work to the shorter kit index; the triggered `cosimo-make-plugin` skill carries the detailed workflow. No giant replacement became mandatory. Provenance: `ace6fc2c`. |
| R02 / 6 | Architecture and release checklist paths. | **Retire navigation duplication** | Conditional root/kit indexes link `kit/docs/PLUGIN_ARCHITECTURE.md` and `kit/docs/RELEASE_VERIFICATION.md`; both paths exist. Provenance: `ace6fc2c`. |
| R03 / 7 | Everything under `kit/` ships; exclude private/product material. | **Keep** | Root and kit retain this publication boundary. `tests/test_kit_export.mjs` checks the export allowlist and forbidden identifiers, but review is still needed because a string scan cannot prove confidentiality. Provenance: `bf607a9f`. |
| R04 / 8 | Shared CPM cache; never link/copy another worktree's dependency tree. | **Relocate + keep in kit** | Kit universal boundary and worktree note; `kit/cmake/CosimoDependencies.cmake` and dependency/export tests own the cache/pin seam. This overlaps the personal worktree/Portless policy but is a distinct native dependency rule. Provenance: `d2afd23e`, replacing the old `28fa20db` symlink advice. |
| R05 / 9 | Everything below is Cosimo-specific. | **Retire** | The file is now organized as universal boundaries plus an explicit conditional index. No behavior depended on this heading sentence. |
| R06 / 13 | Fontaudio identities, generic-icon exception, vendoring/licenses, replaceable seam. | **Relocate** | `ui/assets/fontaudio/README.md` and `CREDITS.md`; `tests/test_seqfx_fontaudio_assets.mjs` covers only current SeqFX assets/credit. Literal synth glyphs remain, so this is not claimed as fully enforced. Provenance: `b6a071ea`. |
| R07 / 17 | Each implementation uses an isolated task/worktree, records ownership, SOL/max, coordinator, and no master/push/deploy. | **Relocate + partial keep** | `docs/AGENT_COORDINATION.md` owns task mechanics; root keeps coordinator authority. The live tracker linker is partial enforcement. The active user/task model preference supersedes the old SOL/max phrase; model choice is not made permanent. Provenance: `7611d96f`. |
| R08 / 18 | Complete, committed, clean handoff fields. | **Relocate** | `docs/AGENT_COORDINATION.md`; no schema currently enforces completeness, so every field remains a workflow requirement. Provenance: `7611d96f`. |
| R09 / 19 | One coordinator owns queue/rebases/reviews/master/push/deploy; isolate artifacts. | **Keep + relocate detail** | Root keeps authority; coordination guide keeps serialized integration and artifact isolation. No repository lock or branch protection was proven. Provenance: `7611d96f`. |
| R10 / 20 | Review source first, focused repair loops, broad/native gates last. | **Relocate** | `docs/AGENT_COORDINATION.md`. This is review policy, not source-enforced behavior. Provenance: `7611d96f`. |
| R11 / 21 | Decision-provenance objection audit and independent coordinator severity. | **Duplicate + relocate** | The personal overlay already requires the skill; the coordination guide keeps the project-specific independent review consequence. Presence of a record cannot prove judgment quality. Provenance: `b4a76da7`. |
| R12 / 22 | Parallelize independent work; serialize master, generated output, fixed ports, installs, native builds. | **Keep + relocate** | Root keeps the shared/external-state boundary; coordination guide names resources. The personal Portless overlay also prohibits taking another worktree's server, but no shared-resource lease exists. Provenance: `7611d96f`. |
| R13 / 23 | Compare final scope, preserve tracker history, separate acceptance, record merge and notify worker. | **Relocate** | `docs/AGENT_COORDINATION.md`. The `TODOS.txt` linker protects against stale branch copies but not concurrent writes or authoritative acceptance. Provenance: `7611d96f`, partial linker enforcement in `86aacc4d`. |
| R14 / 27-28 | Generate the iOS project when absent; `npm run ios:project`. | **Relocate** | `docs/IOS_BUILD_AND_DEVICE.md`; package script exists and `tests/test_ios_auv3_build.py` checks the alias. Existence is not freshness, so reconfiguration remains explicit. Provenance: `b03abe07`, `1a2deed0`. |
| R15 / 29 | Build the `CosimoSynth_Standalone` scheme. | **Relocate** | iOS guide. CMake distinguishes packaged targets, but there is no single production device workflow choosing/validating the product. Provenance: `9308a8ed`. |
| R16 / 30 | Install the current worktree's exact Debug app. | **Relocate** | iOS guide preserves exact artifact/worktree validation. Installation remains external state and no general installer enforces selection. Provenance: `b03abe07`. |
| R17 / 31 | Never install generated/intermediate iOS targets. | **Relocate; retire obsolete target name** | iOS guide keeps the safety contract. The named `cosimo_ios_auv3_generated_plugin` no longer exists; current intermediates and `generated/cmajor` remain non-products. `tests/test_ios_auv3_build.py` checks the old target is absent and inspects product bundles. |
| R18 / 35 | Only `npm run ios:ui:dev` for iPhone Vite. | **Relocate** | iOS guide and package scripts; structural tests reject stale aliases/configs. Physical/LAN behavior is not inferred from the loopback command. Provenance: `1a2deed0`. |
| R19 / 36 | `npm run ios:ui:build` is the frontend build. | **Relocate** | iOS guide, package script, and `tests/test_ios_auv3_build.py`. Provenance: `a44d6fd3`. |
| R20 / 37 | One Vite config serves three iPhone runtime URLs. | **Relocate; partial source enforcement** | `ios_auv3/vite.config.mjs` and structural/HTTP coverage in `tests/test_ios_auv3_build.py`; iOS guide retains the rule. That suite was inspected, not executed here. Provenance: `a44d6fd3`. |
| R21 / 38 | `ui/ios` owns host source; build generates two runtime files. | **Relocate; partial source enforcement** | `ui/build.mjs --ios` and iOS build tests encode ownership/output; iOS guide retains the rule because generation was not exercised here. Provenance: `a44d6fd3`. |
| R22 / 39-44 | Exact five-file iPhone runtime allowlist. | **Relocate with unexecuted bundle coverage** | `ios_auv3/CMakeLists.txt` copies the allowlist; actual `.app`/`.appex` inventory tests exist but were not run. The focused guide keeps the list near iOS work. Provenance: `a44d6fd3`. |
| R23 / 45 | Never copy all of `patch_gui` into iOS bundles. | **Relocate with source enforcement** | CMake clears and selectively copies; tests reject the old directory copy and desktop runtime leakage. The conditional iOS rule remains because no simulator/native packaging ran here. Provenance: `a44d6fd3`. |
| R24 / 49 | Raw device build fails without a development team. | **Relocate** | iOS guide preserves the known failure and current missing local-configuration seam. Provenance: `b03abe07`. |
| R25 / 50 | Personal team and certificate display name. | **Relocate historical receipt** | `docs/IOS_DEVICE_RECEIPT_2026-03-29.md` preserves the exact internal value/date/provenance and requires current verification before reuse. It stays outside customer exports and mandatory context. |
| R26 / 51-52 | Exact successful `xcodebuild` command. | **Relocate historical receipt** | The internal receipt preserves the runnable command; the iOS guide describes current selection/validation requirements. No production `ios:device` wrapper exists yet. |
| R27 / 53-55 | Exact provisioning profile bundle IDs created. | **Relocate history + derive current truth** | The internal receipt preserves what Xcode created. Current product identity comes from CMake/built Info.plists and each build's embedded provisioning result. |
| R28 / 56-58 | Two exact Apple identifiers for the paired phone. | **Relocate historical receipt + current warning** | Internal receipt preserves both identifiers; iOS guide states they may differ and must be correlated from current inventories. |
| R29 / 62-63 | Exact successful `devicectl install` command. | **Relocate historical receipt + current safety** | Internal receipt preserves the command. The iOS guide requires the validated current-worktree product and deliberate device selection. Provenance: `b03abe07`. |
| R30 / 64 | Standalone bundle identifier literal. | **Retire duplicate** | Defined in `ios_auv3/CMakeLists.txt` and built Info.plist; launch derives from the validated artifact. |
| R31 / 65-66 | Exact successful launch command. | **Relocate historical receipt + acceptance boundary** | Internal receipt preserves the command; iOS guide separates process launch, UI readiness, AUv3 hosting, and listening. |
| R32 / 70 | Assets are copied in target `POST_BUILD`. | **Retire implementation trivia** | `ios_auv3/CMakeLists.txt` owns staging and actual-bundle tests inspect outputs. Resource-only incremental freshness remains a test concern, not a universal rule. |
| R33 / 71 | Wrong iOS target can omit factory assets and break UI. | **Relocate known failure** | iOS guide preserves the March 2026 incident and negative validation requirement. Provenance: `9308a8ed`. |
| R34 / 75-77 | App must contain catalog and factory sources. | **Relocate; partial source enforcement** | CMake packaging plus actual-bundle tests describe catalog/source checks; focused guide strengthens the intended gate to validate referenced assets. No simulator/native packaging ran here. |
| R35 / 81 | Desktop manifest keeps `patch_gui/desktop/index.js`. | **Relocate; partial source enforcement** | Authored manifest, `ui/build.mjs`, and `tests/test_patch_view_layout.mjs`; desktop guide retains the contract. The mutating layout/build coverage was not run here. Provenance: `84d0ad46`. |
| R36 / 82 | Both synth manifests are authored, not generated. | **Relocate; partial source enforcement** | `88d0b198` removed the competing writer; preservation tests exist but were not run here. Desktop guide records ownership. |
| R37 / 83 | Stable desktop loader defaults to packaged `./app.js` and is not rewritten. | **Relocate with focused loader proof** | `tests/test_desktop_standalone_loader.mjs` covers loader modes; repeated mutating build coverage was not run. Provenance: `84d0ad46`, repaired in `88d0b198`. |
| R38 / 84 | Wrapper path is `tools/desktop_native`. | **Retire navigation duplication** | Conditional root index and desktop guide make the current source discoverable. Package/build scripts select it. |
| R39 / 85 | Compiled desktop command. | **Relocate** | Desktop guide; package script is current. Its install side effect remains material and explicit. |
| R40 / 86 | Desktop HMR command. | **Relocate** | Desktop guide; package script is current. Fixed port 5174 remains outside personal Portless until separately qualified. |
| R41 / 87 | Desktop UI delivery leaves a running dev app unless excluded. | **Relocate unchanged** | Desktop guide preserves the exact product delivery default and explicit user exception. BK-24 itself explicitly excludes launch. Provenance: `25fb78dc`/later command rename. |
| R42 / 88 | Fresh server, rebuilt wrapper, relaunched app before claiming HMR review. | **Relocate unresolved** | Desktop guide. Launcher exposes server identity but lacks positive app/session readiness correlation. Provenance: `0b77932a`, `88d0b198`. |
| R43 / 89 | Do not present compiled standalone as active HMR. | **Relocate** | Desktop guide keeps process launch and HMR as separate evidence. |
| R44 / 90 | Build/dev share one builder and output directory. | **Retire as implementation fact; preserve consequence** | Desktop guide records the unresolved install collision. At `7341f963`, dev still invokes a builder that replaces installed AU/VST3 artifacts. |
| R45 / 91 | Completed desktop feature builds/installs VST3 unless excluded. | **Relocate unchanged** | Desktop guide preserves the delivery default, exact path, and explicit exception while separating listening acceptance. BK-24 excludes install. Provenance: `d26bdcc1`/`ec99995a`. |
| R46 / 92 | Compiled is default; dev starts Vite/builds/launches. | **Relocate; partial source enforcement** | Build/launcher source and focused loader tests describe the modes; no launcher/native app ran. The cross-mode install collision prevents claiming full isolation. |
| R47 / 93 | Native wrapper injects source mode/origin before loader. | **Relocate; structural enforcement only** | `tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp` owns injection; current tests are largely source inspection and native startup ordering was not exercised. |
| R48 / 94 | Dev build fails when the fixed endpoint is unreachable. | **Relocate with unexecuted source guard** | `scripts/build_desktop_native.sh` contains an HTTP preflight. No server/build ran, and it does not prove module usability/app attachment; desktop guide keeps the gap. |
| R49 / 95 | `build_assets.py` only derives catalog, never manifests. | **Relocate; partial source enforcement** | Source ownership and preservation tests from `88d0b198`; desktop guide retains the rule because the mutating generator test was not run. |
| R50 / 96 | Exact React Grab imports/MCP command; avoid deprecated package. | **Relocate** | Desktop guide preserves `react-grab`, `@react-grab/mcp/client`, and `npx -y @react-grab/mcp --stdio`. Tool routing is also covered by the personal overlay, not application source. |
| R51 / 97 | React Grab only in Vite dev, absent compiled bundle. | **Relocate; partial enforcement** | Source DEV guard and build assertions exist; current tests do not fully prove compiled dependency/network absence. Desktop guide keeps the invariant. |
| R52 / 101 | Retained original key events plus DOM ownership router. | **Relocate** | `KEYBOARD_INVESTIGATION.md`; behavior belongs in pinned CHOC/native adapter. Host qualification remains incomplete. Provenance: `0f186e63`. |
| R53 / 102 | Never use asynchronous `[NSApp currentEvent]`; drag event race. | **Relocate known failure** | `KEYBOARD_INVESTIGATION.md` retains the observed mouse/pressure race. No current host test closes it. |
| R54 / 103 | Never resign the `WKWebView` first responder; Ableton crash. | **Relocate known failure** | `KEYBOARD_INVESTIGATION.md`; no evidence says the external crash disappeared. |
| R55 / 104 | Do not buffer `flagsChanged:`; DOM handles modified shortcuts. | **Relocate** | `KEYBOARD_INVESTIGATION.md`; marker checks reject a stale build but are not native behavioral proof. |
| R56 / 105 | Native forwarding stays below adapter; UI uses browser `preventDefault`. | **Relocate** | `KEYBOARD_INVESTIGATION.md`; current diagnostic UI calls do not establish a general host transport. |
| R57 / 106 | Keyboard learnings pointer. | **Retire root duplication** | Conditional root and desktop indexes now route only keyboard/native-host tasks to the document. |
| R58 / 110 | Recorded generic AU knob crash and stack. | **Relocate known failure** | Exported product-neutral `kit/docs/HOST_COMPATIBILITY.md`; historical evidence is explicitly not current-health proof. Provenance: `da6c8786`. |
| R59 / 111 | Use setup-pinned VST3 or explicit source fallback for JIT. | **Relocate** | Kit index and host compatibility guide; setup/install payload verification is tested. Provenance updated in `d2afd23e`. |
| R60 / 112 | Do not install/recommend official generic AU except reproduction. | **Relocate unchanged** | Host compatibility guide. Supported installers target VST3 and do not alter AU state. |
| R61 / 113 | JIT installer validates patch/loader and writes only VST3 JSON. | **Relocate; inspected source guard** | `kit/scripts/install_fx_cmajplugin.sh` and host compatibility guide encode the boundary, but no behavioral JIT-association/AU-nonmutation fixture ran in BK-24E. Generic-loader dry-run/path coverage and marker validation do not prove this install behavior or keyboard semantics. |
| R62 / 114 | Installer moved to kit; dependencies are in kit instructions. | **Retire migration notice** | Current package commands and conditional indexes point directly to final paths. |
| R63 / 118 | Spectral has one stereo `audioIn` named Input. | **Relocate; partial enforcement** | `fx/spectral_chord_resonator/README.md`, DSP declaration, and audio probes. Compiled endpoint inventory still needs an exact contract. Provenance: `de7ce33f`. |
| R64 / 119 | MIDI controls notes/bend/voices; no public audio sidechain. | **Relocate** | Spectral README and DSP routing. Existing generic multibus tests do not prove this product endpoint policy. |
| R65 / 120 | Poly independent voices; Mono retunes voice 0 for fast notes. | **Relocate with behavioral evidence** | Spectral README and fast-note probe. Required provisioned qualification and wider note-off/expression cases remain. |
| R66 / 121 | Resonator preserves feedback; Imprint is source-driven, no fake excitation. | **Relocate with behavioral evidence** | Spectral README and Imprint source-scaling probe; fresh-state zero-source coverage remains desirable. Provenance: `b723b2d2`. |
| R67 / 122 | Mode changes preserve held-note state without host resend. | **Relocate unresolved** | Spectral README. Probe covers selected-note continuity into Mono, not full held-chord restoration returning to Poly. No product behavior was invented in this cleanup. |
| R68 / 123 | `hostSlot0Guard` remains first. | **Relocate unresolved** | Spectral README and source-order assertion. The guard and released order stay unchanged until compiled host inventory/upstream cause and automation compatibility are proven. |

## Builder Kit rule inventory

Original line numbers refer to the 50-line baseline `kit/AGENTS.md`. Most rules entered during the September 2026 extraction (`ace6fc2c`, `bf607a9f`, `d2afd23e`, `97655c94`).

| ID / original lines | Original rule | Disposition | Current owner and evidence |
|---|---|---|---|
| K01 / 3 | Kit guidance is generic; no owner/machine/product/signing/device data. | **Keep** | Kit opening scope plus universal generic/replaceable boundary; export forbidden-string and allowlist tests provide partial enforcement. |
| K02 / 7 | Architecture reference and covered topics. | **Relocate navigation** | Conditional kit table links `PLUGIN_ARCHITECTURE.md`. |
| K03 / 8 | Release verification reference. | **Relocate navigation** | Conditional kit table links `RELEASE_VERIFICATION.md`. |
| K04 / 9 | Plug-in creation/build/install skill. | **Relocate navigation** | Conditional kit table links `cosimo-make-plugin/SKILL.md`. |
| K05 / 10 | Third-party notices/JUCE product-license obligation. | **Relocate, keep discoverable** | Native release row links root `THIRD_PARTY_NOTICES.md`; architecture and release docs repeat the relevant boundary. |
| K06 / 14 | `kit:doctor` is read-only and reports environment/registry; flags. | **Keep concise + relocate detail** | Kit command table states read-only; doctor/setup tests cover flags and no-write behavior. Detailed output stays in command help/skill. |
| K07 / 15 | `kit:setup` writes acknowledged, hash-pinned tools/deps; idempotent/dry-run/force. | **Keep concise + relocate detail** | Kit command table and make-plugin skill; setup/tool-integrity tests cover receipts, payloads, dry-run and repair. |
| K08 / 16 | Archive hash differs from extracted payload digest; shared verifier repairs stale receipts. | **Relocate** | `kit/docs/EXPORT.md`, setup/doctor implementation, and tool-integrity tests. This implementation explanation need not load for every plug-in edit. |
| K09 / 17 | Production uses setup-pinned `cmaj`; source fallback is explicit; pins agree. | **Keep universal + relocate detail** | Kit pinned-toolchain boundary and `PLUGIN_ARCHITECTURE.md`; source/tool integrity tests reject stale payloads and silent fallback. |
| K10 / 18 | Playwright Chromium install is separate from npm install. | **Relocate conditional command** | Kit tests row names `npx playwright install chromium` only for browser work. |
| K11 / 22 | `kit:new` scaffold contents, collision refusal, discovery, no shared edit. | **Relocate with enforcement** | Make-plugin skill and architecture; scaffold/discovery tests own collisions and generated shape. |
| K12 / 23 | One shared effect Vite server on port 5175; no per-plugin server. | **Keep conditional** | Kit browser row preserves the fixed shared port and never-stop-other-worktree rule. `PLUGIN_ARCHITECTURE.md` owns loader/repository identity checks. |
| K13 / 24 | `fx:build` creates self-contained runtime under `build/fx`. | **Relocate navigation** | Kit command table and architecture; build tests inspect runtime closure. |
| K14 / 25 | `fx:prod:build` creates dedicated native bundle and strips `devModule`. | **Relocate with enforcement** | Kit command table and architecture; production build tests assert compiled-mode/no-JIT packaging. |
| K15 / 26 | `fx:prod:install` only installs an already-built VST3, never JSON/AU/build. | **Keep install boundary + relocate detail** | Kit universal install rule/table, architecture, native-install decision/tests. |
| K16 / 27 | Install pinned generic VST3; explicit source-build fallback; bridge markers. | **Relocate** | `kit/docs/HOST_COMPATIBILITY.md` and setup/install tests. Marker evidence is accurately limited. |
| K17 / 28 | JIT association validates patch/loader, writes only VST3 JSON, optional source cmaj. | **Relocate with enforcement** | Host compatibility guide and installer tests; no AU/loader mutation. |
| K18 / 29 | Customer test discovery; browser build prerequisite; typecheck meaning. | **Keep concise + relocate detail** | Kit tests row and exported package runner. `tests/test_kit_export.mjs` proves customer canonical gates. |
| K19 / 30 | Discovery command lists aliases. | **Keep concise** | Closing kit line; source discovery implements it. |
| K20 / 34 | CPM cache is shared; no linked trees/worktree Cmajor checkout. | **Keep universal** | Pinned dependency boundary plus closing worktree note; dependency tests cover single seam/pins. |
| K21 / 35 | Downloaded tools are worktree-local; setup fresh instead of copying. | **Keep universal** | Pinned-toolchain boundary and closing worktree note; payload receipts bind the local install. |
| K22 / 39 | Single dependency seam; pinned Cmajor/CHOC/JUCE; URL data seam; no source patches. | **Keep concise + relocate mechanics** | Kit universal boundary and architecture native-build section; plain-CPM/export tests inspect callers, pins, and URL rendering. |
| K23 / 40 | Pin bumps arrive through kit update with matching toolchain; never patch downloads/generated source. | **Keep universal + relocate update mechanics** | Kit universal no-patch rule, `kit-update` skill, dependency/toolchain manifests. |
| K24 / 44 | Every plug-in change has focused tests named in handoff. | **Keep** | Kit universal test boundary. Test selection remains human/task judgment. |
| K25 / 45 | Never weaken assertions; repoint with equal/stronger check. | **Keep** | Kit universal test boundary. This is review policy, not automatically enforceable. |
| K26 / 46 | Never commit generated UI beside source; output goes under build. | **Keep** | Kit universal authored/generated boundary; ignore rules and build tests support it. |
| K27 / 47 | New plug-in touches no shared registry; discovery/config are local. | **Keep concise; source/test guard** | Kit universal discovery rule; scaffold/discovery tests reject collisions and avoid a central list. Those focused tests were inspected, not run in BK-24E. |
| K28 / 48 | Invalid/orphan/new-schema/duplicate/identity-defective config fails closed. | **Keep concise; source/test guard** | Kit universal fail-closed rule; detailed cases live in architecture and discovery/config tests. The composed A/B/D worker ran its focused config/build suite; BK-24E did not re-run it. |
| K29 / 49 | Kit stays generic/replaceable; product extension seams/root ownership. | **Keep** | Kit universal boundary and export/import-graph tests. Review still guards semantic confidentiality. |
| K30 / 50 | Pre-kit moves require one-line re-export shim; preserve generated module names/content. | **Relocate** | `PLUGIN_ARCHITECTURE.md` compatibility-move section. This applies only when moving a kit module, not routine plug-in work. Existing import-graph tests cover current shims but not every future move. |

## Shipped/exported instruction references

- `kit/template/root/AGENTS.md` no longer orders a full mandatory read. It sends plug-in tasks to the short kit index and retains the installer-owned local runtime activation boundary.
- `kit/template/root/README.md` remains the first-use contract: unchanged Enhancer Lite, typecheck/test/build/install order, optional browser preview, occupied-port safety, and separate DAW/listening acceptance.
- `kit/skills/cosimo-make-plugin/SKILL.md` remains the detailed task-triggered workflow. Its specificity is appropriate because it loads only for plug-in work.
- `kit/docs/PLUGIN_ARCHITECTURE.md` is updated for the composed BK-24A/B/D result in `ef2fa4d7` / integration `8d9e2878`: no `editorMaxWidth` field or generated-source width splice, and native generation stages then content-syncs durable output. Equal files keep timestamps; stale/missing files converge to current inputs. Framework/source changes remain CMake/compiler dependencies.
- `kit/docs/HOST_COMPATIBILITY.md` is exported and product-neutral. It carries the unresolved generic AU crash and VST3/JIT install safety without private Cosimo or machine data.
- The maintainer-only BK-24C Mac native qualification harness is not a customer command and does not appear in exported guidance. It exports committed source into owned scratch and invokes existing customer setup/build commands; it does not install a plug-in or run a DAW.

## Personal overlay duplication

The personal `/Users/winterfell/.codex/AGENTS.md` was read but not edited.

| Personal rule | Repository disposition |
|---|---|
| Domain-first, conversation-shaped reporting | Personal preference only; not duplicated in repository guidance. |
| Curated `PROGRESS.txt` continuity | Referenced only in the conditional coordination guide where repo-local shared history matters. |
| Decision-provenance skill | Personal default; repo adds only the delegated-task independent-review consequence. |
| `@chrome` tool discovery | Desktop app/tooling issue, unrelated to product source; not copied. |
| Portless external wrapper, worktree route ownership, loopback-only exposure, separate Node 24 | Personal infrastructure. Repository keeps fixed native/test/protocol ports outside Portless and preserves shared-server ownership; no kit/customer Portless dependency or Node pin was added. |
| Run `portless doctor` on routing failure | Personal diagnostic; not copied into product guidance. |

## Remaining unresolved issues

1. Desktop HMR still builds through a path that replaces installed AU/VST3 bundles, and the launcher can stop processes by broad name. The focused guide preserves serialization/install warnings; no source fix was authorized here.
2. Desktop native/UI readiness is not positively tied to the current Vite session. React Grab compiled-absence and keyboard behavior need stronger native/composed proof.
3. There is no complete production iPhone device entrypoint. Signing selection, exact product/resource validation, install, launch, and UI readiness remain separate; private identifiers moved to a dated internal receipt outside mandatory/customer guidance.
4. The recorded generic AU parameter-notification crash is unresolved. The supported JIT workflow remains VST3-only; marker checks do not prove keyboard semantics.
5. Spectral full held-chord restoration on Mono-to-Poly and compiled host parameter/slot-zero compatibility are not proven. DSP and `hostSlot0Guard` were not changed.
6. The fontaudio rule is not universal source enforcement while literal synth instrument paths remain.
7. The live tracker linker does not lock concurrent writes or authorize integration. Shared ports/build outputs/installs likewise have no repository lease mechanism.
8. BK-24A/B/D commit `ef2fa4d7` is now composed through `8d9e2878`; the maintainer Mac gate remains a separate integration dependency. This guidance records the approved width removal and incremental/config-reset behavior; the coordinator must review it against final native-gate evidence before integration.

## Material decisions and objection audit

1. **Keep four root boundaries and make everything else conditional.** The alternative was moving the 123 lines into another mandatory document. That would reduce the visible file without reducing agent burden. The chosen boundaries are ownership, coordinator authority/evidence separation, shared/external state, and exported-kit confidentiality.
2. **Relocate unresolved behavior without calling it enforced.** The alternative was retiring warnings because source contains partial tests. Host keyboard/AU behavior, Spectral held-note/slot-zero compatibility, desktop install collision, iPhone device flow, and icon completion all have evidence gaps; their focused references say so.
3. **Move personal and historical receipts out of mandatory context without discarding them.** Exact signing identity/device IDs and successful shell invocations can drift, but they remain useful diagnosis and handoff evidence. A dated internal receipt preserves them with `b03abe07` provenance and an explicit current-verification condition; the focused iOS guide carries the durable selection/safety rules.
4. **Keep the desktop delivery defaults.** A running HMR standalone and installed compiled VST3 remain required for completed desktop work unless the user explicitly excludes each gate. The BK-24 scope excludes them; that exception is recorded as unperformed rather than becoming weaker policy.
5. **Describe the approved BK-24 build behavior, including width removal.** Retaining the 1120 cap would require disproportionate fork/generator work; the approved fallback restores ordinary supported resizing while keeping SeqFX responsive/default/min-size behavior. Configure passes microphone permission explicitly on every run; native generation stages and content-syncs to preserve unchanged mtimes and remove stale outputs. These claims must be matched to the final A/B/D commit during integration.
6. **Do not create the previous audit's proposed orchestration or device platform.** The approved scope is guidance cleanup. Coordination locks/leases and a complete device command remain concrete follow-ups, not silently adopted architecture.
