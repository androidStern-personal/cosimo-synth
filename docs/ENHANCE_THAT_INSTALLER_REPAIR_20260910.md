# Enhance That installer repair — 2026-09-10

User requested normal overwrite/update behavior, with no recovery folders, extra prompts, or internal release notes in the README.

- Branch: `codex/enhance-that-installer-update`, based on the released native source `585370f39d5f695a0ddab5e558b4b4459df922d6`; packaging repair `a733bcc8`.
- Confirmed failure: production 0.1.4 preinstall aborted because a user-level `EnhanceThat.vst3` existed. `/var/log/install.log` records the abort on September 10 at 13:34:34 +02.
- Native Installer now owns system-bundle replacement. After successful payload installation, a quiet postinstall removes matching current/legacy user duplicates and matching legacy system bundles. It checks the product bundle ID and avoids symlinked paths. Other products, presets, and projects are outside its targets. No backup/recovery workflow or old-signature gate remains.
- README contains only platform, install, installed paths, and uninstall instructions.
- Focused Enhance That plus shared package-builder tests: **55/55 passed**, including actual flat-package extraction with both scripts and executable modes. Use `TMPDIR=/private/tmp` for the existing shared Git-provenance fixture (macOS `/var` alias mismatch otherwise).

## Corrected artifact

Worktree-relative output: `release/enhance-that/0.1.5/release/EnhanceThat-0.1.5-macOS.zip`.

- ZIP SHA256: `8ee66ee0b1ee215bba2d180c77aa094484b4a7d8f5bec0c17af59cd37ce85091`.
- Input production ZIP SHA256: `de02ca9fee840bf1eec755896607d762f3c1e7711856375900a0f918ca01aede`.
- Packaging-only repair using `scripts/repackage_enhance_that_release.mjs`; full extracted plugin file hashes and modes match the original signed payload. Native/plugin versions are unchanged.
- Developer ID Installer signature verified. Apple notarization accepted `c0f8fccd-09d4-4a95-b002-fc9d68424bc8`; staple validation and Gatekeeper passed. ZIP and enclosed checksums passed.
- Extracted VST3 passed pluginval strictness 5, including editor, audio processing, state, and automation. Optional Steinberg validator skipped (not configured). This is not a new Ableton/listening acceptance claim.

## Installation and production publication complete

Andrew completed native installation and confirmed the plugin loaded in Ableton. Read-only checks verified package receipt 0.1.5, strict signatures on installed VST3/AU, byte-for-byte equality with the signed package, and absence of the old user-level VST3 duplicate.

The exact ZIP was downloaded and checksum-verified through sandbox, then promoted unchanged to Song Machines production. Current production deployment: `dpl_74r3uJsRW5J81gCR3oetmhdecUYk`; public URL `https://song-machines.com/`. The live free endpoint returned 200, 9,939,499 bytes, and the ZIP SHA256 recorded above. Store manifest is `enhance-that/production/store/releases/0.1.6/delivery.json`; free installer is 0.1.5 and paid Builder Kit remains 0.1.5. Homepage bytes, checkout configuration, paid installer, setup instructions, and friend code were preserved. No shared master merge was performed.

## Historical approval gate (resolved)

Actual local upgrade installation requires the user's normal macOS administrator approval (`sudo -n` has no authorization). The corrected package has been opened in Installer. Existing user/system plugins have not been manually removed or moved to make the test pass.

The subsequent installation and publication evidence above resolves this historical gate. Repeatability of hook cleanup is covered by fixtures; a second native install was not performed. Production was unchanged at the end of the repair-build turn, then updated after Andrew's installation/Ableton acceptance and explicit go-ahead.
