# MSEG composition and release handoff

September 24, 2026. Implementation branch: `codex/builder-kit-knob-318e`, following knob styling repair `16533cc1` and gesture-test closeout `8c1b52ad`. The integration coordinator owns rebasing, integration, publication and delivery.

## Delivered interface

The ready-made `Mseg.Editor` is composed entirely from public `Root`, `Surface`, `Grid`, `Fill`, `Curve`, `SegmentHighlight` and `Points`. Optional `Plot`, `TimeAxis`, `Playhead` and `useEditor` support custom layers and inspectors. `value`/`onValueChange` and ordinary classes/props/refs are consistent with the knob API. Selection can be local or controlled. The public editing hook exposes only value, selection and editing commands; no engine state or internal refs.

One behavior implementation handles pointer/touch hit testing, point insertion/deletion/movement, segment bending, keyboard editing and gesture cleanup. Custom point artwork spreads the supplied handle props. Read-only reference curves and sampled morphs never become edit targets. Keying Root ends a gesture when switching documents or A/B curves.

Cosimo's desktop, phone-layout and iOS source compositions use these public parts. Its duplicated pointer-handler plumbing was removed. Product A/B storage, routing, colors, drawer, history checkpoints and private HUD remain outside the kit. Cosimo supplies its observed position to the public Playhead; it retains its existing instrument-specific voice/slot selection.

The kit Reader additionally publishes `positionOut` at UI rate, with activity and trigger generation. `Mseg.positionSource(connection, endpoint)` hides packet validation, stale-generation rejection and subscription ownership behind `LiveValue<number | null>`. Playhead consumes that source without rerendering the editor or interpolating across wraps/retriggers. Existing audio-rate `progressOut` remains available.

## Customer examples and documentation

`kit/examples/mseg` contains five Preview/Code examples: default editor, custom layers/handles/menu/inspector, unequal-point A/B morph, vertical/read-only/external state, and actual Cmajor playback. The playback host executes the frozen real Reader as an offline control signal, not an audible synthesizer or fabricated progress timer. Its graph, compiled program, declarations, shared-reader artifact and fingerprints are shipped. `scripts/build_mseg_example.mjs` regenerates those assets using this worktree's pinned compiler; the customer does not need that maintainer script to run the example.

The copy-proof test takes the displayed TSX/CSS/runtime source, typechecks it and executes it in a separate application using public kit imports. Drawing, custom editing and the real playhead work without the docs app.

`kit/docs/MSEG.md` documents composition and playback; `kit/AGENTS.md` links it alongside state, shared-data and knob guides. Root and exported package scripts provide `ui:mseg:dev`, `ui:mseg:build` and `test:mseg`. The state guide and release examples use the final `onValueChange` signature.

The pinned Cmajor standard library supplies `std::envelopes::FixedASR`; it is not a full configurable ADSR. A reusable ADSR editor is not part of this change and is not claimed in the release.

## Qualification

- Source TypeScript check and MSEG reference production build passed.
- MSEG browser suite: 10 checks, including default/custom interaction, mobile orientation, controlled values, gesture termination, live subscriptions/stale reports, actual compiled playback and independent copied-source execution.
- Knob browser suite: all 20 checks passed during this pass; includes independent copied examples and custom styling states.
- Focused Cosimo MSEG, modulation/knob and session/Undo cases: 71 checks across four suites. The final combined rerun passed all 71 after repairing one additional obsolete boot assertion. Shared-hook coverage includes hold activation, cancel/unmount, rejected edits and guarded Undo.
- Actual pinned Cmajor Reader test passed loop wrap, legato retrigger, late-generation rejection, release/inactivity and retained final output through the public position source.
- Core MSEG/provenance/state compatibility checks: 5 passed.
- Current WebAudio Cosimo built successfully. At phone dimensions, the actual app used the public MSEG Surface, accepted pointer insertion and keyboard movement, and produced nonzero audio output with no page errors. Reviewed phone screenshots of the docs and actual editor. This is browser execution, not a claim of listening or physical-device acceptance.

Older tests expected `modulationMsegBuffer` / `modulationMsegPlayback` messages that the shared-data path no longer emits. Those failures were reproduced in a clean archive of `8c1b52ad` with independent dependencies. Replacements inspect the actual installed samples, session and delivery serial. The T71 editor Undo check now runs before unrelated later history entries, preserving the guarded-checkpoint contract.

## Release materials

Email HTML/text, social copy, write-up, complete examples and the kit changelog describe simplified state management, Global Undo and composable controls. They do not claim a bundled private HUD or general ADSR editor. Templates remain drafts with release/access placeholders.

The approved video lives in the launch worktree. v12 changes the callback to `onValueChange`; the 24-character/second rate is preserved. The binding zoom is bounded so the longer line fits. HyperFrames 0.8.36 → 0.8.65 passed checks. Final candidate is `videos/builder-kit-update/renders/full-cut-v12.mp4`; rendered-output verification is recorded in that project.

Fresh independent export qualification is recorded in the follow-up below. No master merge, push, kit release, email send, native install or DAW/device acceptance is implied by this handoff.

## Independent export closeout

Exported committed source `db13a3e0` (MSEG implementation `e515ac1a` plus self-contained CSS type declarations) to a fresh directory outside the repository. Its own `npm ci` installed 111 packages without a node_modules symlink. Canonical `npm run typecheck` passed; `npm test` passed 293 tests with six documented monorepo-only skips and no failures. `test:mseg` passed all 10 checks, `test:knobs` all 20. Both reference-page production builds passed. Six full release/video state/view files also typechecked against that independently installed export.

The first export exposed two previously missed packaging checks: plain TypeScript consumers needed the scoped-CSS module declaration, and the import-graph audit needed to resolve Vite asset queries to their real files. The fix ships its own declaration and still checks asset paths against the same private-source boundary. The second full export passed without changing its files after export.

Retained local evidence: `build/components-export-final.log`, `build/mseg-cosimo-final.log`, `build/mseg-position-dsp.log`, `build/release-example-qualification.log`, `build/mseg-web-proof.log`, `build/mseg-evidence/`, and the `/tmp/builder-kit-components-final-*` qualification logs. Customer tree: `/tmp/builder-kit-components-final-20260924-318e`.

Integration handoff: review the branch relative to `6febf1ea`, including the earlier knob commits. Rebase and integrate through the coordinator, then qualify the final release package/native build against that composed source. The update email's sending operation remains to implement/verify in the store before any customer delivery. No sender or customer list was changed here.
