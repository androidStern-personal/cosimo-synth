# Design QA

## Evidence

- Source visual truth: `/Users/winterfell/.codex/generated_images/019f51fe-8cad-74e0-af19-5afb4e44104e/exec-576250f4-f394-424a-9e76-9bba8ad81fe4.png`
- Canonical browser render: `/tmp/cosimo-final-canonical-390x844.png`
- Compact browser render: `/tmp/cosimo-final-canonical-375x667.png`
- Same-input comparison: `/tmp/cosimo-final-reference-comparison-390x844.png`
- Independent final comparison: `/tmp/cosimo-readonly-audit-comparison-390x844.png`
- Same-input overlay: `/tmp/cosimo-final-reference-overlay-390x844.png`
- Focused upper/lower comparisons: `/tmp/cosimo-final-reference-top-390x430.png`, `/tmp/cosimo-final-reference-bottom-390x414.png`
- Responsive state matrix: `/tmp/cosimo-final-state-matrix-375x667.png`
- Stress fixture: `/tmp/cosimo-final-stress-375x667.png`
- Mapping, override, orphan, attached-source, and bypass states: `/tmp/cosimo-final-mapping-focus-375x667.png`, `/tmp/cosimo-final-override-375x667.png`, `/tmp/cosimo-final-orphan-375x667.png`, `/tmp/cosimo-final-attached-375x667.png`, `/tmp/cosimo-delay-bypassed-375x667.png`
- Canonical comparison state: Effects workspace, Phaser focused, Depth selected, Macro 1 mapping focused, Pluck articulation active. The rack quick control independently remains Frequency.

## Findings

- No actionable P0, P1, or P2 finding remains.
- Intentional product differences from the Ulm visual reference: rack sequence numbers are omitted, source attachment-count badges remain, and the canonical source/parameter fixture uses the approved product state. These are decisions, not rendering defects.

## Fidelity surfaces

- Typography: checked-in IBM Plex Sans Condensed and Departure Mono assets load correctly. Labels and tabular live values have reserved geometry, so changing values does not move neighboring controls.
- Layout: the five persistent shell regions fit at 390 × 844 and 375 × 667. Borders have single ownership, the parameter matrix uses alignment instead of nested cards, and the relationship editor occupies reserved workspace rather than inserting content and shifting the shell.
- Color: paper/ink owns structure. Teal is the instrument accent; source and articulation colors appear only on semantic glyphs, rails, mapping ranges, and override markers.
- Graphics: Phaser, Filter, Wavetable, Envelope, and MSEG views are interactive React/Canvas surfaces with consistent grid, line, and handle rules.
- Content: module identities, quick controls, mapping counts, articulation state, reducer policy, capture ownership, source orphan state, and return paths remain coherent across the matrix.

## Defects found and closed

1. The earlier ad-hoc screen had inconsistent borders, spacing, nested cards, value-driven reflow, and overlapping controls.
   - Rebuilt it as tokenized React surfaces: header, rack, primary editor, relationship band, source legend, and audition transport.
2. Compact rack tiles clipped quick controls and confused reordering with parameter adjustment.
   - Added a dedicated drag handle, fixed-width live-value tracks, and separate quick-control, enable, focus, and reorder gestures.
3. Opening a relationship inserted a large card and shifted the interface.
   - Reserved the secondary workspace and made relationship detail swap in place; only one mapping focus is expanded at a time.
4. Source drag capture failed for mouse input and duplicate mapping drops appeared successful.
   - Added pointer capture, visible eligible targets, and adapter/controller duplicate rejection.
5. Releasing a latched Trigger could restart the note and clear its retrospective capture candidate.
   - Added lifecycle-safe release/cancel behavior and reducer contract coverage.
6. The product controller imported prototype fixture constants.
   - Controller defaults now derive from the adapter snapshot/catalog; only `App` injects prototype session state.
7. Delay exposed Rate labels and compact capture feedback hid the recorded target.
   - Compound labels are parameter-derived and the compact HUD retains a full accessible capture description.
8. Source colors and obsolete tokens drifted outside the design system.
   - Semantic values now live in CSS tokens only; every declared token has a current consumer.

## Interaction and responsive verification

- Effects ↔ Voice workspace carousel preserves module focus.
- Rack quick control, bypass, selection, and dedicated reorder handle remain distinct.
- Parameter tiles support direct X base editing and Y selected-mapping editing.
- Mapping chips expose amount directly and swap one fixed-region relationship editor for polarity, reducer, navigation, and removal.
- Source-first target navigation restores the exact source and selected target.
- Sparse absolute articulation overrides are visually identified and clear independently from the patch base.
- Source add, delete, Undo, count badges, orphan state, target navigation, and drag-to-target assignment are implemented in React.
- Trigger, Repeat, Latch, note/articulation choice, and retrospective capture preserve the parameter moved while Trigger was held.
- Mean/Max appears only when a per-note source crosses into a global destination.
- The deterministic `?fixture=stress` state covers maximum and signed values, bypass, override, orphan/attached sources, and an active capture candidate.
- Browser geometry checks found zero document overflow or element intersections in the reviewed states. Browser console checks found no warnings or errors.
- Independent visual, responsive, and React-interaction reviewers found no remaining high- or medium-severity defect.

## Verification commands

- `npm test` — 9/9 passed.
- `npm run check:styles` — 10 CSS files passed the style contract.
- `npm run build` — Vite production build passed.
- `git diff --check` — passed.
- Live prototype: `http://127.0.0.1:4175/`.

Actual DSP audio, native patch serialization, haptic feel on physical iPhone hardware, and gesture-to-MSEG signal processing remain intentionally outside this parallel UI prototype.

final result: passed
