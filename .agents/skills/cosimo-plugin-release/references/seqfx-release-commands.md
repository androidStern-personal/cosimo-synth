# SeqFX Release Commands

Use these commands from the `cosimo-synth` repo root. Adjust versioned paths if `scripts/build_seqfx_beta_release.mjs` changes `releaseVersion`.

## Preflight

```bash
git status --short --untracked-files=no
npm ci
npm audit
node --check scripts/build_seqfx_beta_release.mjs
```

Check signing identities and notarization profile:

```bash
security find-identity -v
xcrun notarytool history --keychain-profile cosimo-notary --output-format json
```

Expected signing identities look like:

```text
Developer ID Application: Andrew Stern (JUFVT28775)
Developer ID Installer: Andrew Stern (JUFVT28775)
```

If the notary profile does not exist, the user must run:

```bash
xcrun notarytool store-credentials cosimo-notary \
  --apple-id "<apple-id>" \
  --team-id "<team-id>"
```

Use an Apple app-specific password at the secure prompt. Do not pass that password in a visible command.

## Regression Checks

Use the current test set from `TODO_RELEASE.md` or `PROGRESS.txt`. The 2026-04-30 SeqFX beta pass used:

```bash
node --test tests/test_seqfx_runtime_bridge.mjs tests/test_seqfx_patch_view_browser.mjs
node --test tests/test_seqfx_production_view_browser.mjs
node --test tests/test_seqfx_state.mjs tests/test_seqfx_runtime_bridge.mjs tests/test_seqfx_worker_service.mjs tests/test_seqfx_preset_adapter.mjs tests/test_seqfx_crusher_preview.mjs tests/test_seqfx_stutter_envelope.mjs tests/test_seqfx_tape_stop_envelope.mjs tests/test_seqfx_aux_source.mjs
node --test tests/test_seqfx_patch_view_browser.mjs
npm run test:effect-presets
PYTHONPATH=. uv run pytest -q tests/test_seqfx_probe.py
npm run fx:build -- seqfx
cmaj play --dry-run --stop-on-error build/fx/seqfx_runtime/SeqFx.cmajorpatch
npm run fx:prod:build -- seqfx --clean
codesign --verify --deep --strict --verbose=4 build/seqfx_juce/_build/CosimoSeqFX_artefacts/Release/VST3/CosimoSeqFX.vst3
lipo -archs build/seqfx_juce/_build/CosimoSeqFX_artefacts/Release/VST3/CosimoSeqFX.vst3/Contents/MacOS/CosimoSeqFX
```

If Cmajor runtime setup races in a fresh worktree, run this once before browser-heavy tests:

```bash
python3 scripts/ensure_cmajor_runtime.py --path
```

## Clean Release Build

If the active worktree has unrelated dirty tracked files, make a clean temporary worktree from the current release commit:

```bash
tmp="$(mktemp -d /tmp/seqfx-release.XXXXXX)"
git worktree add --detach "$tmp/worktree" HEAD
cd "$tmp/worktree"
npm ci
```

Run the release build:

```bash
COSIMO_DEVELOPER_ID_APPLICATION="Developer ID Application: Andrew Stern (JUFVT28775)" \
COSIMO_DEVELOPER_ID_INSTALLER="Developer ID Installer: Andrew Stern (JUFVT28775)" \
COSIMO_NOTARY_PROFILE="cosimo-notary" \
npm run seqfx:release:build -- --release
```

Copy artifacts back if the build happened in a temp worktree:

```bash
mkdir -p /path/to/main/worktree/release/seqfx/0.1.0-beta.1
rsync -a --exclude "_work/" release/seqfx/0.1.0-beta.1/ /path/to/main/worktree/release/seqfx/0.1.0-beta.1/
```

Remove the temp worktree when done:

```bash
git -C /path/to/main/worktree worktree remove --force "$tmp/worktree"
rmdir "$tmp" 2>/dev/null || true
```

## Artifact Paths

For `0.1.0-beta.1`:

```text
release/seqfx/0.1.0-beta.1/CosimoSeqFX-0.1.0-beta.1-macOS.zip
release/seqfx/0.1.0-beta.1/CosimoSeqFX-0.1.0-beta.1-macOS.pkg
release/seqfx/0.1.0-beta.1/CosimoSeqFX-0.1.0-beta.1-macOS-release-manifest.json
release/seqfx/0.1.0-beta.1/CosimoSeqFX-0.1.0-beta.1-macOS-checksums.txt
release/seqfx/0.1.0-beta.1/README.txt
```

## Package And Zip Verification

```bash
release_dir="release/seqfx/0.1.0-beta.1"
pkg="$release_dir/CosimoSeqFX-0.1.0-beta.1-macOS.pkg"
zip="$release_dir/CosimoSeqFX-0.1.0-beta.1-macOS.zip"
manifest="$release_dir/CosimoSeqFX-0.1.0-beta.1-macOS-release-manifest.json"
checksums="$release_dir/CosimoSeqFX-0.1.0-beta.1-macOS-checksums.txt"

cd "$release_dir" && shasum -a 256 -c "$(basename "$checksums")"
cd -
pkgutil --check-signature "$pkg"
xcrun stapler validate "$pkg"
spctl -a -vv -t install "$pkg"
unzip -t "$zip"
pkgutil --payload-files "$pkg"
```

Confirm payload metadata is absent:

```bash
if pkgutil --payload-files "$pkg" | grep -E '(^|/)\._|(^|/)\.DS_Store'; then
  echo "payload metadata found"
  exit 1
else
  echo "payload metadata check: ok"
fi
```

## VST3 Payload Verification

```bash
check_tmp="$(mktemp -d /tmp/seqfx-pkg-check.XXXXXX)"
pkgutil --expand-full "$pkg" "$check_tmp/pkg"
vst3="$check_tmp/pkg/Payload/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3"

codesign --verify --deep --strict --verbose=4 "$vst3"
codesign -dv "$vst3" 2>&1 | sed -n '1,80p'
lipo -archs "$vst3/Contents/MacOS/CosimoSeqFX"
```

Run pluginval if installed as a command:

```bash
pluginval --validate "$vst3" --strictness-level 5 --timeout-ms 120000 --output-dir "$release_dir/pluginval" --output-filename CosimoSeqFX-pluginval.txt
```

On this machine, pluginval is installed as an app:

```bash
/Applications/pluginval.app/Contents/MacOS/pluginval \
  --validate "$vst3" \
  --strictness-level 5 \
  --timeout-ms 120000 \
  --output-dir "$release_dir/pluginval" \
  --output-filename CosimoSeqFX-pluginval.txt
```

## Fresh Install Prep

Check for existing installed copies:

```bash
find /Library/Audio/Plug-Ins ~/Library/Audio/Plug-Ins -maxdepth 4 \( -iname '*CosimoSeqFX*' -o -iname '*SeqFX*' \) -print 2>/dev/null
ls -ld /Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3 ~/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3 2>/dev/null || true
```

Move an old user-level dev copy aside if present:

```bash
mv "$HOME/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3" "$HOME/Desktop/CosimoSeqFX.vst3.old-dev-$(date +%Y%m%d%H%M%S)"
```

Tell the user to run the exact package:

```text
release/seqfx/0.1.0-beta.1/CosimoSeqFX-0.1.0-beta.1-macOS.pkg
```

After install:

```bash
ls -ld /Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3
codesign --verify --deep --strict --verbose=4 /Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3
```

## Patreon Upload

Upload this file to a members-only Patreon post or product:

```text
release/seqfx/0.1.0-beta.1/CosimoSeqFX-0.1.0-beta.1-macOS.zip
```

Do not upload only the raw `.pkg`; the `.zip` carries the README, checksums, and manifest with the installer.
