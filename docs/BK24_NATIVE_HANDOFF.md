# BK-24C exported-customer Mac native qualification

Status: **locally qualified** on exact composed source `e13fa1f27dcb8129d9561205187306583c8082a3`; all nine phases passed. Hosted native CI remains pending.

Authoring provenance: source gate authored on `codex/bk-24-native-gate` from
`bec24a085bb08dbc9ef5a6e6c1255d0f6c09c1d4` / source baseline
`7341f96372e4561b5e02a5a7f870fdc3b8d64909`. The real native run subsequently used the reviewed BK-24A/B/D/E composition and the coordinator's sole native-build slot.
No plugin was installed and no DAW, device, customer checkout, feed, or
release was changed during authoring.

## Gate

The maintainer runs the gate from a clean exact source commit:

```text
node tests/tools/qualify_builder_kit_native.mjs \
  --source-sha <exact-40-character-commit> \
  --destination-config <absolute-non-secret-release-destination-json> \
  --report <absolute-private-report-json>
```

The harness creates an owned temporary customer export from the requested
commit. It obtains the existing cohort capability through
`scripts/release_builder_kit.mjs:readCapabilityFromKeychain`, composes only the
published hashes whose kit version, relative artifact paths, and Cmajor fork
commit exactly match the candidate, then invokes the exported customer's
existing `kit:setup`, strict doctor, `kit:new`, and `fx:prod:build` commands.
The capability and feed URL are redacted from captured child output. The
temporary export and downloads are deleted on success. On failure they remain
inside a mode-700 scratch directory with redacted mode-600 command logs and a
partial mode-600 report for diagnosis; nothing uploads them.

The run covers:

- a fresh dedicated Enhancer Lite VST3 build;
- an unchanged build with exact generated-byte and timestamp stability, no
  object timestamp changes, and no compile/link events in the CMake trace;
- isolated DSP and UI edits, each reaching the runtime, generated native
  input, object compilation, and dedicated VST3 binary;
- disabling and then removing the microphone setting in the same build tree,
  proving generated `MICROPHONE_PERMISSION_ENABLED FALSE` returns to `TRUE`;
- deletion and exact recovery of `cmajor_plugin.cpp`;
- a second plugin made by the exported kit's existing scaffold, with disjoint
  runtime/JUCE/VST3 outputs and distinct bundle and processor identities;
- a final `--clean` build whose runtime and generated project must equal the
  final incremental build byte-for-byte.

Every built artifact must be a valid ad-hoc-signed dedicated VST3, pass the
actual build-produced factory identity probe and patched-CHOC marker check,
carry the current compact native factory display name and human runtime name,
strip `view.devModule`, and contain no `CmajPlugin.json`. Clean comparison
checks the raw VST3 binary and whole bundle first. Only after an exact mismatch
may it compare a copy with the Mach-O `LC_UUID`, code-signature payload, and
bundle `_CodeSignature` files normalized; any remaining difference fails.
The report says whether this fallback was needed and retains the exact safe
tool artifact paths, archive hashes, kit version, and Cmajor commit.

## Workflow and current runner state

`.github/workflows/kit-native.yml` runs the fast harness contract on relevant
pull requests. Native execution is restricted to trusted non-PR events after
source review, and only when `BUILDER_KIT_NATIVE_ENABLED=true`. It requires an
approved Apple-silicon self-hosted runner labeled `builder-kit-native`, the
existing Keychain capability, and an absolute non-secret
`BUILDER_KIT_NATIVE_DESTINATION_CONFIG` repository variable. When those are
absent, a separately named job states that no native build ran and records the
qualification as pending rather than passing it silently or failing every
source push.

Read-only preflight on September 4, 2026 found no configured repository Actions
secrets and no self-hosted runner. The local macOS Keychain service
`builder-kit-feed-cohort` and `rclone` configuration are present; the Keychain
value was never read into output. The authoring search found no reusable non-secret destination JSON in source, Documents, `.config`, or `.codex`; the prior coordinator subsequently supplied the existing private release configuration. The local run reused it read-only without creating new release configuration or secrets. Hosted native CI remains pending; no
runner was purchased and no secret or publication infrastructure was added.

## Focused proof

The behavioral regression was written first and failed because the
qualification module did not exist. After implementation:

```text
node --test tests/test_builder_kit_native_qualification.mjs
```

passes 5/5. It covers exact CLI authority, secret redaction, published/candidate
tool compatibility including conflicting nonempty pins, compile/link trace
classification, and the narrow Mach-O comparison. `node --check` and
`git diff --check` also pass. Composed coordinator qualification subsequently passed 133 contract tests, source typecheck and the canonical exported proof.

## Material decisions and objection audit

1. The gate is a maintainer-owned scratch harness, not a shipped customer
   command. A customer command would have taught a normal project to mutate its
   own example source for qualification and expanded the public surface. The
   harness still proves the real exported commands and artifacts.
2. The source checkout intentionally has blank unreleased archive hashes. The
   harness reuses the existing release destination and Keychain readers, and
accepts published hashes only after exact version/artifact agreement and exact
agreement between the exported CMake source pin, toolchain fork pin, and
published Cmajor commit.
   Hard-coded capabilities, raw credential environment variables, and copied
   tools were rejected.
3. The unchanged assertion uses generated and object timestamps plus the
   captured CMake compile/link trace. It records the binary timestamp but does
   not assert it, because the unconditional post-build ad-hoc signing step may
   touch the bundle without compiling or relinking it.
4. Clean equivalence starts with exact bytes. The narrow Mach-O/signature
   fallback preserves useful proof if two native links differ only in UUID or
   signature metadata, while reporting that exact binary equality failed. It
   cannot turn other machine-code or resource differences into a pass.
5. Automated native execution does not run untrusted pull-request code against
   a machine Keychain. Until a trusted Apple-silicon runner is configured, the
   workflow reports pending. Adding a hosted secret or buying a runner was
   outside BK-24C authority.

This gate proves build and packaged-plugin behavior. It does not prove
Developer ID signing, notarization, Gatekeeper, installation, pluginval,
Ableton/Logic discovery, listening, audio behavior, or physical-device
acceptance.

## Actual native result — September 4, 2026

Exact source `e13fa1f27dcb8129d9561205187306583c8082a3`; worker branch `codex/bk-24-native-gate`, worktree `/Users/winterfell/.codex/worktrees/bk24-native/cosimo-synth`, clean at completion. Existing exported setup and strict doctor passed, followed by fresh, unchanged, DSP edit, UI edit, configuration disabled, configuration reset, missing-output recovery, isolated product and clean-equivalence phases.

Unchanged native rebuild: zero compile/link events and no generated/object content or timestamp changes. DSP/UI edits each compiled one changed generated object and reached the dedicated VST3. Removing the microphone setting restored TRUE after FALSE in the same build tree. Missing output recovered exactly. The isolated product had distinct bundle/processor identities and output paths and did not change or touch the main product. Every artifact passed compiled-mode, factory-identity, patched-CHOC and ad-hoc-signature checks.

Clean rebuild matched incremental runtime, generated files, binary and whole bundle **exactly**. No normalization fallback was used. Final binary SHA-256: `ac47b6df7eab3b9a409c6ec03fc318c4f83edb96f02c81a76da07aa381131a83`.

Safe mode-600 report: `/Users/winterfell/.codex/visualizations/2026/09/04/01a06ded-e922-7b60-83a7-44332a0e3fee/bk24-native-report.json`, SHA-256 `b4448c84ef90eb48b24c14701ad414999eb62816fb1465fc0d21de01b22bf0ed`. It records exact archive hashes and matching source/toolchain Cmajor `04ee24df55c4a3ba9f67d498a70c19de1aa1ad79`. URL/capability/config-path scan passed; successful scratch was removed. Native slot released. No install, DAW/device/HMR or publication occurred.
