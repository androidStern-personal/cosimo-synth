# Builder Kit customer acceptance — 2026-09-05

Private candidate source: `c297eeed62aec66e85118df06a229d9cdd8491da`.
Customer lineage: `c840a394094f3c6a9ea14b5f1a8041eb424b22ac`.
Customer project: `[local path omitted]`.
Delivery: existing private loopback candidate; no public release was changed.

## Completed

- Executed the exact short delivery command privately, without exposing its access key. It downloaded the release, project-local Node and CMake, prepared the kit, installed npm dependencies, and passed its strict checks. Exit 0; no extra customer command or manual setup was needed.
- Followed the freshly installed root `AGENTS.md`, `README.md`, and `kit/AGENTS.md`. The first-use request is to build/install the unchanged included plugin; source edits, renamed copies, new tests, and mandatory browser previews are expressly excluded.
- Sourced the installer-owned runtime as instructed. `npm run typecheck` passed. `npm test` passed: 101 pass, 0 fail, 6 export-appropriate skips (107 total).
- All 10 included `fx/enhancer_lite` files exactly match the accepted source commit. No source overlay was applied.
- Fresh install leaves an untracked `package-lock.json`; no authored source is modified. The documented update path stops for uncommitted work. No update or automatic commit has been performed.

## Safety and limits

- This is a fresh project on the existing development Mac, not a clean-VM proof. Existing system tools, caches and credentials are present; dependency origin must be checked separately.
- Existing `[local path omitted]` has bundle ID `dev.cosimo.enhancer-lite` and executable SHA-256 `792534550f639a57b5cdc2d0cb2c4c0944edc3a58470203ccee7a1e70a3e8737`. It must remain recoverable during the test.
- Ableton is open in the existing unsaved set. Bob's test track and the original tracks are preserved. No plugin or host state has yet been changed by this acceptance run.
- Independent resident-data research owns the current bounded native slot. No competing native build was launched.
- The maintainer release checklist is used only for observer-side installation safety and qualification boundaries. It is not claimed as a necessary customer step, and no SeqFX release/notarization/publication is in scope.

## Build and install

- The exact README commands `npm run fx:prod:build -- enhancer-lite` and `npm run fx:prod:install -- enhancer-lite` both exited 0, using the installer-owned runtime. No source, wrapper, test, or shared dependency was edited. Build warnings were non-fatal compiler deprecations; no repair was performed.
- Installed `[local path omitted]`; strict deep signature verification passes. Installed executable SHA-256: `f613554813c461e1bf67fb122402f03deb297fe346e3bac7f2adb5ced44899ea`.
- Before the normal same-identity install, the previous installed bundle was copied to `previous-CosimoEnhancerLite.vst3` beside this report. Its strict signature and original executable hash were verified. This extra backup is observer-side preservation of Andrew's existing install, not a customer setup requirement.
- Installed cmaj SHA-256 `cd83280092e35ad7e3fa7c2824f52c171ee1ddc3ccad435caaa8a58debdd9c99` and archived CmajPlugin executable SHA-256 `63a36bb17f8eefb75b7dabec86f630a1fe96ebeea3aff29fe0059edb918b3782` match Bob's candidate handoff. No generic CmajPlugin build/install/association command was run.

## Actual Ableton observations

- Ableton Live 11.3.43 remained open in the existing Untitled set. An ordinary rescan changed the browser result from `CosimoEnhancerLite` to `Cosimo Enhancer Lite`.
- The installed plugin loaded on a new `BK Customer Acceptance` audio track. The actual device and editor title read `Cosimo Enhancer Lite`. `lsof` confirmed Live loaded the installed executable path above. No host crash or missing editor was observed.
- Clicking LOW changed the actual editor state. With editor HTML focused, native Space input produced stopped → playing → stopped in the host transport readback.
- A real pointer drag changed the graph from 130 Hz / 0 dB to 949 Hz / 5.6 dB. Space while the mouse remained down started transport; a second Space stopped it after release.
- In the real Save Preset text field, native Space was inserted into `BKCX ` while transport remained stopped. Saved unique preset `BKCX 20260905-ch1sNY10` successfully.
- After changing shape/frequency/amount and closing/reopening the editor, Revert restored the saved LOW / 130 Hz / 0 dB / Q 0.71 values. This verifies the plugin-preset/editor round trip; it is not a disk-saved Ableton project reload claim.
- Copied the existing OLIVER percussion clip into the new test track without moving or editing its source. Live playback generated changing input/output spectra in the actual plugin, including nonzero input/output with the altered sound. This is observed DSP/monitoring activity, not a subjective listening or captured-audio verdict.
- Playback is stopped. The added track is muted, not soloed, and its copied clip is stopped. The original four track snapshots compare exactly before/after; the existing clips and devices are intact. The temporary computer-keyboard toggle caused by the automation attempt was restored to its previous off state. Transport position was returned to the initially observed 1.3.1.

## Automation friction, not customer requirements

- CUA coordinate clicks returned AXError.notImplemented; its native paste timed out without replacing the Ableton search. The permitted cliclick/System Events fallback worked. Initial keyboard-only track naming did not enter rename mode; the new track was named with the existing host API instead. No claim is made that these are Builder Kit defects.
- Host API mutations can return their old state immediately; later read-only transport/track observations were used for assertions.
- Existing host API client was imported only; its unrelated probe harness was never executed. No audio recorder, ad-hoc wrapper, global key relay, or new source/test code was added.

## Remaining boundaries

- This first-use customer path passed. A real upgrade to a newer kit release, failed-update recovery, a disk-saved Ableton project reload, clean-VM/no-private-credentials proof, and subjective/captured-audio acceptance were not performed here. The one available installed release and initial untracked npm lockfile are recorded, not called new defects.
- The candidate remains private. No public feed, release, hosting deployment, or source repository was changed by this acceptance run.
