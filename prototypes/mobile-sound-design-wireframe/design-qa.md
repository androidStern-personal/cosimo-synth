# Design QA

## Comparison setup

- Structural before/after: `/tmp/cosimo-structure-compare.jpg`
- Palette and final-state contact sheet: `/tmp/cosimo-palette-layout-compare-v2.jpg`
- Palette references: Native Instruments Super 8 and XLN DB-30 Drum Butter landing pages captured at `/tmp/native-instruments-super-8-landing.jpg` and `/tmp/xln-drum-butter-landing-clean.jpg`
- Final Effects state: `/tmp/cosimo-effects-final-390x844.jpg`
- Final sparse articulation override: `/tmp/cosimo-voice-override-final-375x667-retry.jpg`
- Final compact Envelope editor: `/tmp/cosimo-envelope-source-final-375x667-retry.jpg`
- Final orphan-source state: `/tmp/cosimo-orphan-source-final-375x667-retry.jpg`
- Viewports: 390 × 844 and 375 × 667.

## Findings

- No actionable P0, P1, or P2 issue remains in the requested structural pass.
- The underlying language remains white, black, square, and wireframe. Color is now semantic rather than decorative: Pluck and each modulator retain their own subdued Super 8 / Drum Butter-inspired accent wherever that identity appears.
- Sparse articulation state is legible without adding icons everywhere. Only the overridden Warp control receives the Pluck icon/color, patch-base anchor, and contextual `Pluck Reset` action.
- Effect-rack quick controls now use the same wireframe track, position handle, and default tick as the rest of the system. Separate six-dot handles make rack reordering distinct from value adjustment.
- The contextual region starts with compact amount-bearing mapping chips. Tapping one reveals exactly one relationship card; its amount, polarity, reducer, removal, and source-editor entry are available without covering the primary module.
- Reducers remain contextual. The per-note MSEG → global Phaser mapping shows Max/Mean; Envelope → per-note Wavetable does not.
- The Envelope editor integrates A/D/S/R manipulation and readouts into its shape graphic. The target list begins immediately below it, recovering the former slider-row and primary-panel dead space.
- Source chips use icon + slot, target-count badges, and stable source colors. The new unattached Envelope 2 is visibly muted with a zero badge.
- The 375 × 667 layout has no document overflow. Measured regions end exactly at the viewport: primary 108–268, contextual 268–543, sources 543–585, audition 585–667.

## Interaction checks

- Created a Pluck Warp override by manipulating Warp while Pluck was active; the effective value, patch-base marker, icon, and reset action all appeared.
- Opened Envelope 1 → Wavetable Warp, confirmed `Back to Envelope 1`, and confirmed return restored the Wavetable target as the expanded source relationship.
- Expanded and collapsed the MSEG 1 mapping card while keeping Phaser visible.
- Reordered Phaser ahead of Flanger using only the rack drag handle.
- Added Envelope 2 and confirmed its zero-target empty state, muted shelf treatment, and zero badge.
- Verified the production Vite build.
- Checked browser warnings and errors: none.

## Comparison history

- Previous P1: blue/native rack sliders broke the wireframe language. Fixed with the shared black wireframe range component.
- Previous P1: articulation base, override, and modulation state were visually conflated. Fixed with a base anchor, articulation-colored override handle/icon, and separately colored modulation range.
- Previous P2: the Envelope source view spent space on redundant A/D/S/R slider rows. Fixed by moving those interactions into the graphic and starting targets immediately below it.
- Previous P2: mapping identity required opening a card to see amount. Fixed by putting the live amount on each source chip and preserving the detailed card only for deeper settings.
- Previous P2: rack reorder and rack quick-adjust used ambiguous gestures. Fixed with a dedicated drag handle and a separate shared-language range track.

## Open questions

- None block this wireframe iteration. Exact production color values, haptic strength, and long-press onboarding remain later visual/interaction polish decisions.

final result: passed
