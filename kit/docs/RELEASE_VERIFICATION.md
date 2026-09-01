# macOS Release Verification Checklist

Product-neutral steps for verifying a signed, notarized macOS plugin release
built from a Builder Kit repo. Substitute your product name for `<Product>`,
your artifact directory for `<release-dir>`, and your own signing identities.
Product-specific release flows (versioning, distribution surfaces, support
copy) stay in the owning repo; this checklist covers only what makes an
artifact verifiably releasable.

Never call an ad-hoc-signed or non-notarized artifact releasable. A releasable
macOS plugin build is Developer ID signed, notarized, stapled, Gatekeeper
accepted, and DAW smoke tested.

## Preflight

```bash
git status --short --untracked-files=all
npm ci
npm audit
```

Check signing identities and the notarization profile:

```bash
security find-identity -v
xcrun notarytool history --keychain-profile <notary-profile> --output-format json
```

Expected signing identities look like:

```text
Developer ID Application: <name> (<team-id>)
Developer ID Installer: <name> (<team-id>)
```

If the notary profile does not exist, the account owner must create it:

```bash
xcrun notarytool store-credentials <notary-profile> \
  --apple-id "<apple-id>" \
  --team-id "<team-id>"
```

Use an Apple app-specific password at the secure prompt. Do not pass that
password in a visible command, and never store Apple credentials, app-specific
passwords, or notarization secrets in the repo, the plugin, frontend
JavaScript, release notes, or chat-visible command lines.

If identities or certificates are missing, the account owner sets them up in
Xcode Settings > Apple Accounts > Manage Certificates (add `Developer ID
Application` and `Developer ID Installer`), accepting any pending Apple
Developer Program License Agreement first.

## Build Boundary

Verify the unsigned deterministic boundary before signing: assemble one fresh
normalized unsigned native build into two payload/package/ZIP sets and compare
bytes. Do not call that independent native-build reproducibility, and do not
call signed/notarized bytes reproducible — Developer ID secure timestamps and
Apple notarization tickets are intentionally time-varying. Signed releases are
proved through identities, notarization, stapling, Gatekeeper, and checksums
instead.

Run the signed release build only with the signing identities and notary
profile supplied by the environment, e.g.:

```bash
COSIMO_DEVELOPER_ID_APPLICATION="Developer ID Application: <name> (<team-id>)" \
COSIMO_DEVELOPER_ID_INSTALLER="Developer ID Installer: <name> (<team-id>)" \
COSIMO_NOTARY_PROFILE="<notary-profile>" \
<release build command> -- --release
```

## Package And Zip Verification

For a release directory holding `<Product>-<version>-macOS.{pkg,zip}` with a
checksums file:

```bash
cd "<release-dir>" && shasum -a 256 -c <checksums-file>
pkgutil --check-signature "<pkg>"
xcrun stapler validate "<pkg>"
spctl -a -vv -t install "<pkg>"
unzip -t "<zip>"
pkgutil --payload-files "<pkg>"
```

Confirm payload metadata is absent:

```bash
if pkgutil --payload-files "<pkg>" | grep -E '(^|/)\._|(^|/)\.DS_Store'; then
  echo "payload metadata found"
  exit 1
else
  echo "payload metadata check: ok"
fi
```

## Plugin Payload Verification

Expand the package and verify the plugin bundle inside it:

```bash
check_tmp="$(mktemp -d)"
pkgutil --expand-full "<pkg>" "$check_tmp/pkg"
vst3="$check_tmp/pkg/Payload/Library/Audio/Plug-Ins/VST3/<Product>.vst3"

codesign --verify --deep --strict --verbose=4 "$vst3"
codesign -dv "$vst3" 2>&1 | sed -n '1,80p'
lipo -archs "$vst3/Contents/MacOS/<Product>"
```

Confirm `lipo -archs` reports every architecture the release claims (for a
universal build: `x86_64 arm64`).

Run pluginval if installed:

```bash
pluginval --validate "$vst3" --strictness-level 5 --timeout-ms 120000 \
  --output-dir "<release-dir>/pluginval" --output-filename <Product>-pluginval.txt
```

The Steinberg VST3 validator is optional unless it is installed locally or
explicitly requested. If any optional validator is skipped, say so in the
report.

## Fresh Install Prep

Check both install locations for existing copies before install testing:

```bash
find /Library/Audio/Plug-Ins ~/Library/Audio/Plug-Ins -maxdepth 4 -iname '*<Product>*' -print 2>/dev/null
```

If an old user-level dev copy exists, move it out of the scan path (with a name
marking it as an old dev copy) instead of deleting it, unless deletion is
explicitly requested.

After installing the `.pkg`, verify:

```bash
ls -ld /Library/Audio/Plug-Ins/VST3/<Product>.vst3
codesign --verify --deep --strict --verbose=4 /Library/Audio/Plug-Ins/VST3/<Product>.vst3
```

## DAW Smoke Test

In the target VST3 host:

- Rescan plugins if needed.
- Confirm `<Product>` appears as a VST3 audio effect.
- Load it on an audio track.
- Open the UI.
- Exercise basic effect and preset/state behavior.
- Confirm no Gatekeeper warning, crash, or missing WebView UI.

## Reporting

Report the exact artifact path and the facts that make it releasable:

- signing identity used
- notarization accepted ID
- Gatekeeper accepted result
- pluginval result (or that it was skipped)
- DAW smoke result or missing DAW test
- exact remaining owner actions (e.g. upload to the distribution surface)
