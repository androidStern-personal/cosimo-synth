# BK-24C exported-customer Mac native qualification

Status: source gate authored on `codex/bk-24-native-gate` from
`bec24a085bb08dbc9ef5a6e6c1255d0f6c09c1d4` / source baseline
`7341f96372e4561b5e02a5a7f870fdc3b8d64909`. The real native run waits for
the reviewed BK-24A/B/D composition and the coordinator's native-build slot.
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
value was never read into output. No reusable non-secret destination JSON was
found in the searched source, Documents, `.config`, or `.codex` locations, so
the coordinator must supply or create that non-secret file in owned temporary
space before the authorized local run. Hosted native CI remains pending; no
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
`git diff --check` also pass. Native build evidence is intentionally pending.

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
