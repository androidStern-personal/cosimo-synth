# Design QA

## Evidence

- Visual source of truth: `/Users/winterfell/.codex/generated_images/019f51fe-8cad-74e0-af19-5afb4e44104e/exec-576250f4-f394-424a-9e76-9bba8ad81fe4.png`
- Final Effects implementation at 390 × 844: `/tmp/cosimo-final-effects-390x844.png`
- Final Effects implementation at 375 × 667: `/tmp/cosimo-final-effects-375x667.png`
- Same-input source/implementation comparison: `/tmp/cosimo-final-comparison.png`
- Focused top comparison: `/tmp/cosimo-final-top-comparison.png`
- Focused lower-surface comparison: `/tmp/cosimo-final-bottom-comparison.png`
- Additional reviewed states: `/tmp/cosimo-polish-mapping-expanded-375x667.png` and `/tmp/cosimo-polish-source-editor-375x667.png`
- Comparison state: Phaser focused, Frequency selected, MSEG 1 and Pressure mapped, one stable relationship card visible, Pluck articulation active.

## Visual review

- No P0, P1, or P2 visual defect remains after comparing the reference and implementation together at the same viewport.
- The app reads as five coherent instrument surfaces: workspace/rack, graphic editor, calibration matrix, relationship/source bands, and audition transport.
- The global effects rack is one continuous surface. The active effect and active workspace invert black/white; quick control, bypass state, and reorder handle remain distinct.
- The responsive parameter matrix fits every label at 390 × 844 and 375 × 667. Four-parameter voice modules use a 2 × 2 matrix rather than empty cells.
- Modulation and articulation colors are confined to semantic glyphs, rails, ranges, and override handles. Structural hierarchy remains monochrome.
- Mapping chips swap one always-present relationship card without moving the primary module, source shelf, or audition transport. Source-first target rows remain directly editable and expose an explicit target-navigation action.
- Source attachment counts are separated into neutral badges; orphan sources are muted. The audition footer uses the same custom checkbox, rule, typography, and active-state grammar as the rest of the instrument.
- IBM Plex Sans Condensed and Departure Mono load from checked-in assets. No visible text is below 10 px.
- The final adversarial visual review reported no remaining P0, P1, or P2 blocker.

## Interaction review

- Effects → Voice → Effects restores the previous module and parameter.
- Rack quick controls follow the last-touched parameter. Bypass changes to an explicit `Off` state without losing module focus.
- A non-Default voice edit creates a sparse articulation override; Default exposes the patch base; Reset removes only the active articulation override.
- Parameter-first mappings keep one relationship card present. Switching `MSEG 1 ↔ Pressure`, including reselecting the active chip, preserves identical region geometry at 390 × 844 and 375 × 667. Source-first navigation follows `MSEG 1 → Wavetable Index → Back to MSEG 1 → Back to Phaser` and restores context.
- Adding Envelope 2 creates a muted zero-target source. Context deletion removes it; Undo restores the exact source and orphan state.
- Latched audition now remains active while another parameter receives focus. Moving Warp produces `Ready · Pluck override · Wavetable Warp`; Capture creates and opens MSEG 2 mapped to that exact target/layer.
- When MSEG 1–3 are occupied, Capture reports `MSEG full · delete one to capture`, retains the buffered gesture, and never reuses a slot silently.
- Trigger supports pointer, keyboard, click fallback, latch, cancel, window-blur, and visibility cleanup. ARIA labels and pressed/expanded state were audited after the final pass.
- The final focused accessibility review reported no remaining P0/P1 prototype blocker.

## Verification

- `npm run build` passes.
- `git diff --check -- src/App.jsx src/styles.css AGENTS.md design-qa.md` passes.
- The local prototype remains available at `http://127.0.0.1:4175/`.
- Actual DSP reorder/bypass, audio cadence, patch serialization, and gesture-to-MSEG conversion remain intentionally outside this UI prototype.

final result: passed
