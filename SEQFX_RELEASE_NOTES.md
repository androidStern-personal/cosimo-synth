# SeqFX Release Candidate Notes

Status: pre-release candidate under qualification. This document records implemented behavior; it is not a public-release announcement.

## Highlights

- Twelve named, step-sequenced effects: Filter, Crush, Tape Stop, Stutter, Pitch, Comb, Ring, Reverse, Talk Box, Vibro, Flange, and Dirty.
- Tape Stop rebuilt from documented mature-product vocabulary and frozen benchmark decisions: synced/free Stop Time, Curve, Crossfade to Live or Spin Up return, Start Time, bounded character, overlapping retriggers, and gestures that may outlive the triggering cell.
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

Local candidate evidence from 2026-08-30:

- The complete SeqFX source qualification aggregate passed, including strict
  TypeScript, state/property, source and packaged browser, Cmajor, DSP/runtime,
  lifecycle, performance, and clean visual-proof gates.
- Clean source commit `56eb5c2fda90b5d67490bc83103a8600f5b84a3f`
  produced a universal `arm64 x86_64` VST3. Both the build output and the exact
  untouched VST3 expanded from the PKG passed pluginval strictness 5, including
  cold/warm load, state, editor, processing, and automation at 44.1/48/96 kHz
  and block sizes 64–1024.
- Repeatable local packaging passed for two assemblies of that one native build.
  PKG SHA-256: `2a75678e3934bb19d804cc8e09948a72c7b34c60198d0e34eeb987763af7a664`.
  ZIP SHA-256: `0b5a33aba4aafea0e072593b469118681d931cd4d285641c90ffd0a3743fc206`.
- The exact packaged VST3 is installed at
  `~/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3`; its executable SHA-256 is
  `89f1b25c2460a5b6d595528de4e5767b51daa14c570e4606e1200ca3bb42ef4e`.
  The prior user copy is preserved under the dated `CosimoSeqFX Backups` folder.
- Ableton Live 11.3.43 discovered and inserted that exact user-path binary. A
  disposable Live set saved, unloaded, and reopened it; the recalled process
  again mapped exactly one SeqFX executable with the packaged hash.
- The local VST3 is ad-hoc signed so hosts can load it. The installer is unsigned;
  neither artifact is Developer ID-signed, notarized, stapled, Gatekeeper-ready,
  or approved for distribution.

The following remain separate open release gates and must not be inferred from
the evidence above:

- matched-level subjective listening across the named fixtures;
- Ableton custom-editor open/resize, live audio, in-host automation, transport,
  preset, loop/seek, bypass, and multiple-instance interaction;
- signing, notarization, stapling, and Gatekeeper testing when approved credentials/environment exist;
- clean-machine/account install test.

No merge, push, deployment, upload, or publication is implied by a local candidate succeeding.
