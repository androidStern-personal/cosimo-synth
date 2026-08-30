# SeqFX Release Candidate Notes

Status: pre-release candidate under qualification. This document records implemented behavior; it is not a public-release announcement.

## Highlights

- Twelve named, step-sequenced effects: Filter, Crush, Tape Stop, Stutter, Pitch, Comb, Ring, Reverse, Talk Box, Vibro, Flange, and Dirty.
- Tape Stop rebuilt from documented mature-product vocabulary and frozen benchmark decisions: synced/free Stop Time, Curve, Catch Up or Spin Up return, Start Time, bounded character, overlapping retriggers, and gestures that may outlive the triggering cell.
- New vector-dispersive Comb extends a neutral tuned comb into four coupled paths with damping, dispersion, motion, drive, and width.
- Capture-safe Stutter retriggers, rolling zero-lookahead Reverse, complementary-grain Pitch, pure Doppler Vibro, canonical Flange, phase-continuous Ring, measured-vowel Talk Box, converter-style Crush, and fixed-quality oversampled Dirty.
- Sparse `seqfx.v7` state with strict parsing and legacy v5/v6 migration.
- Complete global surface: bypass, global Mix, Host/Internal/Manual clocking, BPM, rate, swing, loop, internal transport, reset, Undo/Redo, Init, loop clipboard, and safe Vary.
- Named effect cards, visible chain and block identities, fixed Effect/Mod tabs, fixed Block Mix, honest units, and first-use guidance for the current editor session.
- Three curated factory presets per effect and 12 complete factory patterns across drums, vocals, bass, harmony, transitions, subtle processing, and all-effect demonstration.

## Compatibility

- Release-candidate format: macOS VST3.
- Existing effect IDs are preserved. Crusher remains ID 2 and is displayed as Crush.
- Valid `seqfx.v6`/internal-version-5 documents migrate to sparse state v7. Tape Stop legacy values follow the mapping in `research/seqfx/tape-stop-v2-evidence.md`.
- AU, Windows, and public Patreon distribution are outside this release-candidate scope.

## Known issues and intentional limits

- Reverse is a rolling lookback effect. After a cold start or reset it stays dry until its selected source window exists; it adds no host lookahead latency.
- Pitch does not delay the entire plugin. Grain settings trade transient precision against smoothness inside the selected block.
- Reverse is capped at four seconds. Tape Stop, Stutter, Pitch, and delay effects use bounded buffers documented in the research ledger.
- Loading a host state or top-level plugin preset is authoritative and clears instance-local Undo/Redo. Factory pattern and effect-preset actions remain undoable.
- Manual clock runs continuously. Internal clock is the mode with an in-plugin Play/Stop button; Host follows the DAW.
- First-use dismissal lasts only while the editor stays open. Loop clipboard and Undo/Redo history last for the current plugin instance. None are project state.
- Final public display name, bundle identifier, plugin/manufacturer codes, beta version, support address, and distribution channel still require product approval.

## Qualification status

Implemented behavior is covered by focused state, migration, browser, DSP, lifecycle, sample-rate, finite-output, and generated-runtime tests recorded in `SEQFX_EXCELLENCE_ROADMAP.md` and `research/seqfx/`.

The following are separate release gates and must be recorded as performed or unperformed in the final handoff:

- source and scoped-diff review;
- complete relevant automated suites after review repair;
- universal macOS VST3 build and bundle inspection;
- strict pluginval cold-open validation;
- installed-plugin discovery and codesign verification;
- Ableton insert, resize, audio, automation, transport, save/reopen, preset recall, and multiple-instance stress;
- matched-level subjective listening across the named fixtures;
- signing, notarization, stapling, and Gatekeeper testing when approved credentials/environment exist;
- clean-machine/account install test.

No merge, push, deployment, upload, or publication is implied by a local candidate succeeding.
