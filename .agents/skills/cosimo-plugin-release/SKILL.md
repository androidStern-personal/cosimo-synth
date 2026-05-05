---
name: cosimo-plugin-release
description: Use when preparing, auditing, building, signing, notarizing, validating, installing, or distributing Cosimo Synth audio plugin releases, especially SeqFX macOS VST3 beta releases for Patreon subscribers. Trigger for requests about release checklists, Developer ID certificates, Apple notarization, Gatekeeper, pluginval, DAW smoke tests, old installed plugin copies, Patreon download gating, or release artifact verification.
---

# Cosimo Plugin Release

## Core Rule

Treat release work as an end-to-end product shipment, not just a build command. Always move from source state to an artifact that a subscriber can download, install, and open in a DAW.

Keep the user oriented in plain language. Name the actual item: `Developer ID Installer`, `CosimoSeqFX-0.1.0-beta.1-macOS.pkg`, `~/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3`, `Patreon members-only post`, etc.

## First Reads

When working in `cosimo-synth`, read these before changing or releasing anything:

1. `AGENTS.md` for repo-specific rules and known local-machine facts.
2. `PROGRESS.txt` for the latest release state and completed checks.
3. `TODO_RELEASE.md` if the user asks for audit, plan, release readiness, or remaining work.
4. `package.json` and `scripts/build_seqfx_beta_release.mjs` for the actual release command.

For exact command patterns, read `references/seqfx-release-commands.md` before running release builds or verification.

## Scope Defaults

Use the currently chosen beta 1 scope unless the user explicitly changes it:

- Product: Cosimo SeqFX.
- Platform: macOS only.
- Plugin format: VST3 only.
- Distribution: Patreon-hosted download gate only.
- Do not include AU, Logic Pro support, Windows support, in-plugin Patreon activation, or a custom Patreon OAuth portal in beta 1 unless the user explicitly changes scope.

If the user asks "what is next?", answer with the next concrete release task and who must do it: Codex, the user, Apple account owner, or Patreon admin.

## Worktree Discipline

Check the tracked worktree before release operations:

```bash
git status --short --untracked-files=no
```

Do not revert unrelated dirty files. If release mode needs a clean checkout and unrelated files are dirty, create a temporary detached worktree at the current release commit and build there.

Commit code/script/doc changes that are part of release automation or durable release state. Do not commit generated release artifacts unless the repo already tracks them.

## Required Release Flow

1. Confirm scope and artifact name.
2. Install dependencies with the repo lockfile.
3. Run the relevant SeqFX tests and production build checks.
4. Confirm Apple Developer ID signing identities and notarization profile.
5. Build with `npm run seqfx:release:build -- --release`.
6. Verify the copied `.pkg` and `.zip`.
7. Check for old installed plugin copies before DAW testing.
8. Install the `.pkg` and run DAW smoke tests.
9. Upload the `.zip` to a Patreon members-only post or product.
10. Record results in `PROGRESS.txt` and state remaining gaps plainly.

## Apple Credential Boundary

Developer ID and notarization setup is user-gated because it uses private Apple account credentials, 2FA, keychain items, and app-specific passwords.

If missing, tell the user exactly what to do:

- Open Xcode Settings > Apple Accounts > Manage Certificates.
- Add `Developer ID Application`.
- Add `Developer ID Installer`.
- Accept any Apple Developer Program License Agreement prompt on the Apple Developer website if Xcode shows `PLA Update available`.
- Store a notary profile with `xcrun notarytool store-credentials`.

After the credentials exist, Codex can run the terminal verification and release build.

## Build And Verify

Use the repo release script. It is the source of truth for packaging behavior:

```bash
COSIMO_DEVELOPER_ID_APPLICATION="Developer ID Application: <name> (<team-id>)" \
COSIMO_DEVELOPER_ID_INSTALLER="Developer ID Installer: <name> (<team-id>)" \
COSIMO_NOTARY_PROFILE="cosimo-notary" \
npm run seqfx:release:build -- --release
```

Never call an ad-hoc-signed or non-notarized artifact Patreon-ready. A Patreon-ready macOS beta must be Developer ID signed, notarized, stapled, Gatekeeper accepted, and DAW smoke tested.

Verify at minimum:

- `shasum -a 256 -c ...checksums.txt`
- `pkgutil --check-signature ...pkg`
- `xcrun stapler validate ...pkg`
- `spctl -a -vv -t install ...pkg`
- `unzip -t ...zip`
- `pkgutil --payload-files ...pkg` and confirm no `._` or `.DS_Store`
- `codesign --verify --deep --strict --verbose=4` on the VST3 inside the expanded package
- `lipo -archs` on the VST3 binary and confirm `x86_64 arm64`
- `pluginval` on the VST3 extracted from the package

The Steinberg VST3 validator is optional unless it is installed locally or the user asks for it. If it is skipped, say so.

## Install And DAW Test

Before fresh install tests, check both install locations:

- `/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3`
- `~/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3`

If an old user-level copy exists, move it out of the scan path instead of deleting it unless the user asks for deletion. A safe destination is the Desktop with a name that says it is an old dev copy.

After installing the release `.pkg`, verify the VST3 exists at:

```text
/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3
```

Run the DAW smoke test in Ableton Live unless the user names a different VST3 host:

- Rescan plugins if needed.
- Confirm `CosimoSeqFX` appears as a VST3 audio effect.
- Load it on an audio track.
- Open the UI.
- Exercise basic effects and preset/state behavior.
- Confirm no Gatekeeper warning, crash, or missing WebView UI.

## Patreon Gate

For beta 1, Patreon gating means the download is restricted by Patreon. The plugin itself does not phone home and does not contain Patreon credentials.

Upload the `.zip`, not the raw `.pkg`, because the zip includes the installer, README, checksums, and release manifest.

Patreon post/product text should include:

- macOS only.
- VST3 only.
- install steps.
- uninstall path.
- known beta limits.
- support report details: macOS version, Mac model, CPU type, DAW name/version, exact steps, and crash report if any.

Do not put Patreon API credentials, Apple credentials, app-specific passwords, or notarization secrets in the repo, plugin, frontend JavaScript, release notes, or chat-visible command lines.

## Reporting

When done, report the exact artifact path and the facts that make it releasable. Keep it short:

- signed identity
- notarization accepted ID
- Gatekeeper accepted result
- pluginval result
- DAW smoke result or missing DAW test
- exact remaining user action, usually Patreon upload
