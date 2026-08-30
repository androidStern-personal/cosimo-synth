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

## Product decisions required before public beta

- [ ] Andrew explicitly approves the current public name, bundle ID, plugin
  code, and manufacturer code. Changing these after users save projects can
  break recall or create duplicate plugin entries.
- [ ] Choose and verify the minimum supported macOS version.
- [ ] Choose the public support email or support URL for release notes.
- [ ] Choose the Patreon delivery surface: members-only post or digital product.

Until these fields are resolved in `scripts/seqfx-release-config.mjs`,
`--release` must refuse to sign or submit anything to Apple. Local unsigned
validation remains available.

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

Build a local unsigned validation artifact from a clean commit:

```bash
npm run seqfx:release:build -- --unsigned --verify-reproducible
```

Reuse an already-built VST3 without launching a native build:

```bash
npm run seqfx:release:build -- --unsigned --skip-build --verify-reproducible
```

`--allow-dirty` is only for a local unsigned diagnostic package. It disables a
clean-source claim and cannot be combined with repeat reproducibility or signed
release mode.

Signed/notarized candidate command, only after the product decisions and Apple
credential gates below are complete:

```bash
COSIMO_DEVELOPER_ID_APPLICATION="Developer ID Application: <name> (<team-id>)" \
COSIMO_DEVELOPER_ID_INSTALLER="Developer ID Installer: <name> (<team-id>)" \
COSIMO_NOTARY_PROFILE="<approved-keychain-profile>" \
npm run seqfx:release:build -- --release --skip-build
```

The command never installs a plugin, starts a DAW, uploads to Patreon, deploys,
or publishes. Those are separate gates and authorizations.

## Reproducibility contract

Unsigned reproducibility and release authenticity are different claims:

- The deterministic boundary is the normalized unsigned VST3 payload tree,
  generated package metadata, unsigned flat package, README/manifest/checksums,
  and ZIP. The source commit timestamp is the default `SOURCE_DATE_EPOCH`.
- `--verify-reproducible` assembles the unsigned output twice and requires
  byte-identical package, ZIP, manifest, checksum files, and README plus an
  identical path/kind/mode/content payload fingerprint.
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
- a reproducibility report when `--verify-reproducible` is used

The ZIP contains the installer, README, release manifest, and payload checksum
file. The adjacent `.zip.sha256` covers the completed download without creating
a checksum cycle inside the ZIP.

## Gate A — clean source and product qualification

- [ ] Source review and decision-provenance objection audit are complete.
- [ ] Branch is committed and `git status --short --untracked-files=no` is clean.
- [ ] Release config, patch manifest, and `fx/build-effect.mjs` identity/path
  contract passes.
- [ ] Complete focused SeqFX state/runtime/preset/browser suites pass.
- [ ] Production packaged-view suite passes.
- [ ] Complete SeqFX DSP/buffer/interpolation suites pass at the supported sample
  rates.
- [ ] Production SeqFX runtime build and Cmajor dry-run pass.
- [ ] Any open listening or host gate is written as open, not inferred from tests.

## Gate B — native release-candidate VST3

- [ ] Run `npm run fx:prod:build -- seqfx --clean` from the clean commit.
- [ ] Confirm the exact `_build/plugin/` VST3 path above exists.
- [ ] Confirm `lipo -archs` reports `arm64 x86_64`.
- [ ] Confirm strict code-sign verification passes on the local build signature.
- [ ] Confirm required patched CHOC WebView marker strings exist and retired
  keyboard-probe strings do not.
- [ ] Inspect `Info.plist` and `moduleinfo.json` for identity, versions, category,
  architecture, and any inappropriate generated permissions/usage text.
- [ ] Record VST3 bundle and executable sizes and SHA-256 values.

## Gate C — unsigned deterministic packaging

- [ ] Run the unsigned builder with `--verify-reproducible` from the same clean
  commit.
- [ ] Confirm the repeat report has no differing payload/package/ZIP bytes.
- [ ] Confirm `pkgutil --payload-files` contains exactly the VST3 under
  `/Library/Audio/Plug-Ins/VST3/` and contains no `._` or `.DS_Store` entries.
- [ ] Confirm `unzip -t` succeeds.
- [ ] Confirm the manifest says `local-unsigned-validation`,
  `distributionReady: false`, and names every unperformed host/public gate.
- [ ] Confirm the README visibly says the unsigned package is not for Patreon.

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
- [ ] Run pluginval strictness 5 against the packaged VST3 and preserve its log.
- [ ] If the Steinberg VST3 validator is unavailable, record it as unperformed.
- [ ] Confirm all twelve effects and the current state/preset version are present
  in the packaged product, not only source UI.

## Gate F — controlled install and Ableton acceptance

Before installation, inspect both locations:

- `/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3`
- `~/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3`

- [ ] Confirm no other task owns the installed SeqFX path.
- [ ] Recoverably move any stale user-level development copy out of the scan path;
  do not delete it by default.
- [ ] Install the exact qualified pkg.
- [ ] Prove Ableton scanned the system-level candidate, not another copy.
- [ ] Insert/open UI and verify audio, transport, automation, presets, state,
  save/close/reopen, loop/seek, bypass, and project recall.
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
