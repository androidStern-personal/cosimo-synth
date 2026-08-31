# SeqFX macOS VST3 release checklist

Status: release automation is prepared for review; no artifact produced by this
checklist is public-release evidence until every gate below is recorded against
one clean commit.

This file is a release checklist, not a claim that signing, notarization,
installation, Ableton acceptance, listening acceptance, Patreon upload, or
publication has happened.

## Authoritative contract

`scripts/seqfx-release-config.mjs` is the single release-facing identity and
packaging contract. The builder rejects drift against the Cmajor patch manifest
and the effect build registry before it builds or writes a package.

Current candidate values:

- public name: `Cosimo SeqFX`
- plugin bundle name: `CosimoSeqFX`
- Cmajor/plugin bundle ID: `dev.cosimo.seqfx`
- plugin version: `0.1.0`
- beta channel/artifact version: `0.1.0-beta.1`
- plugin code: `CsFx`
- manufacturer/code: `Cosimo` / `Cosi`
- installer ID: `dev.cosimo.seqfx.pkg`
- platform/format: macOS VST3 only
- architectures: `arm64` and `x86_64`
- distribution gate: Patreon-hosted download only; no in-plugin activation

The current native build path is:

`build/seqfx_juce/_build/plugin/CosimoSeqFX_artefacts/Release/VST3/CosimoSeqFX.vst3`

The older path without `_build/plugin/` is stale and must not be used in release
automation or evidence.

The native dependency contract is also fail-closed:

- Cmajor: `androidStern-personal/cmajor` at
  `a97d8846605c433db561d07f23fc9ff372e20ced`
- CHOC: the Cmajor `include/choc` gitlink at
  `98b52fb54c3b9fec03c0c13218f6557aef33eabe`
- JUCE: `juce-framework/JUCE` at
  `501c07674e1ad693085a7e7c398f205c2677f5da`

Plan mode parses `cmake/CosimoDependencies.cmake` and refuses Cmajor or JUCE
repository/revision drift before any native build. After the fresh build, the
builder resolves the actual Cmajor and JUCE source directories from that
build's `CMakeCache.txt`, verifies exact Cmajor/CHOC/JUCE revisions and clean
checkouts plus their declared repository origins, and records the attestation
in the release manifest. Absolute machine-local checkout paths are deliberately
not recorded.

Production builds compile the canonical Cmajor command from those pinned sources
at `build/cmajor_command/bin/cmaj` and pass that absolute repository build output
to generation. There is no external Cmajor 1.0.3066 authority,
`COSIMO_RELEASE_CMAJ` override, or `PATH` fallback. The pinned generator owns the
declared plugin latency; the release proof checks its creation and reload
behavior without rewriting generated C++.

## Product decisions required before public beta

- [ ] Andrew explicitly approves the current public name, bundle ID, plugin
  code, and manufacturer code. Changing these after users save projects can
  break recall or create duplicate plugin entries.
- [ ] Andrew explicitly approves `0.1.0-beta.1` as the public beta version.
- [ ] Confirm that this exact binary is covered by applicable Cmajor and JUCE
  commercial distribution entitlements, or approve a fully compliant GPL/AGPL
  distribution plan. Third-party notices do not replace this rights check.
- [ ] Andrew explicitly authorizes Developer ID signing and Apple notarization
  submission for this candidate.
- [ ] Choose and verify the minimum supported macOS version.
- [ ] Choose the public support email or support URL for release notes.
- [ ] Choose the Patreon delivery surface: members-only post or digital product.

Until these fields are resolved in `scripts/seqfx-release-config.mjs`,
`--release` must refuse to sign or submit anything to Apple. Local validation
remains available with an unsigned installer and an ad-hoc-signed VST3 payload.

## Commands and safety boundary

Read-only plan; no build, filesystem write, signing, install, upload, or deploy:

```bash
npm run seqfx:release:plan
node scripts/build_seqfx_beta_release.mjs --plan --json
```

Focused automation tests; no native build:

```bash
npm run test:seqfx:release-builder
```

Build a local validation artifact from a clean commit. The installer remains
unsigned; the VST3 payload is ad-hoc signed for local host loading:

```bash
npm run seqfx:release:build -- --unsigned --verify-repeatable-packaging
```

`--allow-dirty` is only for a local diagnostic package. It disables a
clean-source claim and cannot be combined with repeatability verification or signed
release mode.

Signed/notarized candidate command, only after the product decisions and Apple
credential gates below are complete:

```bash
COSIMO_NOTARY_PROFILE="<approved-keychain-profile>" \
npm run seqfx:release:build -- --release
```

The approved application and installer identities come from
`scripts/seqfx-release-config.mjs`; identity environment variables are not a
release authority.

The command never installs a plugin, starts a DAW, uploads to Patreon, deploys,
or publishes. Those are separate gates and authorizations.

## Packaging repeatability contract

Local packaging repeatability, native-build reproducibility, and release
authenticity are different claims:

- The deterministic boundary is the normalized ad-hoc-signed VST3 payload tree,
  generated package metadata, unsigned flat package, README/manifest/checksums,
  and ZIP. The source commit timestamp is the default `SOURCE_DATE_EPOCH`.
- `--verify-repeatable-packaging` assembles the same freshly built ad-hoc-signed
  VST3 twice and requires
  byte-identical package, ZIP, manifest, checksum files, and README plus an
  identical path/kind/mode/content payload fingerprint.
- This compares one native binary through two packaging assemblies. It does not
  claim that two independent native builds are byte-identical.
- A dirty worktree cannot receive that claim.
- Developer ID signing uses secure timestamps and notarization adds an Apple
  ticket. Signed/notarized bytes are intentionally not claimed reproducible.
  Their claim is authenticity, integrity, and Apple acceptance, recorded by
  identities, notarization ID, stapling, Gatekeeper, and checksums.

Expected output directory:

`release/seqfx/0.1.0-beta.1/`

Expected files:

- `CosimoSeqFX-0.1.0-beta.1-macOS.pkg`
- `CosimoSeqFX-0.1.0-beta.1-macOS.zip`
- `CosimoSeqFX-0.1.0-beta.1-macOS-release-manifest.json`
- `CosimoSeqFX-0.1.0-beta.1-macOS-checksums.txt`
- `CosimoSeqFX-0.1.0-beta.1-macOS.zip.sha256`
- `README.txt`
- `THIRD_PARTY_NOTICES.txt`
- a packaging-repeatability report when `--verify-repeatable-packaging` is used

The ZIP contains the installer, README, third-party notices, release manifest,
and payload checksum file. The notices are also embedded inside the VST3
resources before signing. The adjacent `.zip.sha256` covers the completed
download without creating a checksum cycle inside the ZIP.

## Gate A — clean source and product qualification

Evidence previously recorded for commit `56eb5c2f` is historical only. It does
not qualify the repaired candidate; every source, build, artifact, pluginval,
install, and Ableton check below must be rerun against the eventual final commit.

- [ ] Source review and decision-provenance objection audit are complete.
- [ ] Branch is committed and `git status --short --untracked-files=all` is clean.
- [ ] Release config, patch manifest, and `fx/build-effect.mjs` identity/path
  contract passes.
- [ ] Plan mode records the exact CMake-declared Cmajor and JUCE repositories
  and revisions plus the expected Cmajor-pinned CHOC gitlink.
- [ ] Complete focused SeqFX state/runtime/preset/browser suites pass.
- [ ] Production packaged-view suite passes.
- [ ] Complete SeqFX DSP/buffer/interpolation suites pass at the supported sample
  rates.
- [ ] Production SeqFX runtime build and Cmajor dry-run pass.
- [ ] Any open listening or host gate is written as open, not inferred from tests.

## Gate B — native release-candidate VST3

- [ ] Run the clean production build through the release builder from the clean
  candidate commit.
- [ ] Confirm the exact `_build/plugin/` VST3 path above exists.
- [ ] Confirm `lipo -archs` reports `arm64 x86_64`.
- [ ] Confirm strict code-sign verification passes on the local build signature.
- [ ] Confirm required patched CHOC WebView marker strings exist and retired
  keyboard-probe strings do not.
- [ ] Confirm the release manifest records matching declared and actual
  Cmajor/CHOC/JUCE revisions, the Cmajor CHOC gitlink, and `clean: true` for all
  three selected checkouts, with every declared repository origin verified.
- [ ] Inspect `Info.plist` and `moduleinfo.json` for identity, versions, category,
  architecture, and any inappropriate generated permissions/usage text.
- [ ] Record VST3 bundle and executable sizes and SHA-256 values.

## Gate C — repeatable local packaging

- [ ] Run the local builder with `--unsigned --verify-repeatable-packaging` from the same clean
  commit.
- [ ] Confirm the repeat report has no differing payload/package/ZIP bytes.
- [ ] Confirm `pkgutil --payload-files` contains exactly the VST3 under
  `/Library/Audio/Plug-Ins/VST3/` and contains no `._` or `.DS_Store` entries.
- [ ] Confirm `unzip -t` succeeds.
- [ ] Confirm the manifest says `local-ad-hoc-validation`,
  `distributionReady: false`, and names every unperformed host/public gate.
- [ ] Confirm the README visibly says the unsigned installer and ad-hoc-signed
  VST3 are not for Patreon.
- [ ] Confirm `THIRD_PARTY_NOTICES.txt` is present at the ZIP root and inside
  the staged VST3 resources, and is covered by checksums.

## Gate D — Apple credentials, signing, and notarization

User/account-owner preparation:

- [ ] Valid `Developer ID Application` identity is installed.
- [ ] Valid `Developer ID Installer` identity is installed.
- [ ] Apple agreements are accepted and the approved notarytool keychain profile
  exists.

Candidate verification:

- [ ] Build signed mode from the same clean commit and already-qualified binary.
- [ ] `codesign --verify --deep --strict --verbose=4` passes on the staged VST3.
- [ ] `pkgutil --check-signature` names the intended Developer ID Installer.
- [ ] Apple notarization returns `Accepted`; record submission ID.
- [ ] `xcrun stapler validate` succeeds.
- [ ] `spctl -a -vv -t install` accepts the package.
- [ ] Re-run ZIP and checksum verification after final stapling/package assembly.

Never put Apple passwords, app-specific passwords, private keys, or Patreon
credentials in the repo, config, manifest, release notes, or command history.

## Gate E — packaged binary validation

- [ ] Expand the final pkg into a temporary directory.
- [ ] Strictly verify the VST3 signature inside the expanded package.
- [ ] Confirm the packaged binary is universal (`arm64 x86_64`).
- [ ] Run pluginval strictness 5 against the packaged VST3 and record fresh
  `SUCCESS`/exit-0 evidence; do not reuse the historical `56eb5c2f` log.
- [ ] Record the separate Steinberg VST3 validator as unperformed because no
  validator path was configured.
- [ ] Confirm all twelve effects and the current state/preset version are present
  in the packaged product, not only source UI.

## Gate F — controlled install and Ableton acceptance

Before installation, inspect both locations:

- `/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3`
- `~/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3`

- [ ] Confirm no other task owns the installed SeqFX path.
- [ ] Recoverably move any stale user-level development copy out of the scan path;
  do not delete it by default.
- [ ] Install the exact qualified packaged VST3 at the controlled user scan path.
- [ ] Prove Ableton loaded the intended user-path candidate, not the stale system
  copy: Live mapped exactly one SeqFX executable and its hash matched the package.
- [ ] Insert SeqFX in Ableton and verify disposable-project save, replacement with
  a new set, reopen, state presence, and exact-binary recall.
- [ ] Open/resize the custom editor and verify live audio, in-host automation,
  presets, loop/seek, bypass, and multiple-instance interaction. Live 11's canvas
  did not expose these controls to the available UI automation; do not infer them
  from pluginval or browser proof.
- [ ] Run the structured listening matrix; Andrew records subjective acceptance
  separately from automated evidence.

## Gate G — clean-account and distribution acceptance

- [ ] Test the package on a Gatekeeper-enabled clean macOS account or machine.
- [ ] Confirm install, first scan, UI assets, audio, and uninstall instructions.
- [ ] Finalize release notes with verified facts, known limits, minimum macOS,
  support contact, and exact artifact checksum.
- [ ] Upload the ZIP, not the raw pkg, to the explicitly chosen Patreon surface.
- [ ] Restrict the download to the approved members/tiers.
- [ ] Verify the member download itself and checksum.
- [ ] Record the Patreon URL and publication state only after upload is separately
  authorized and completed.

## Final handoff evidence

The coordinator handoff must name the task/thread, branch, worktree, final clean
commit, exact changed scope, native binary/artifact paths and hashes, test counts,
signing identity, notarization ID, pluginval result, Ableton result, listening
result, clean-account result, known failures, and every unperformed physical,
host, credential, upload, or publication gate.
