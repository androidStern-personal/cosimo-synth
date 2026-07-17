# Interaction Contract

This matrix freezes the product behavior while the prototype's React and visual
architecture are rebuilt. Visual refactoring may change component anatomy, but it
must not remove these flows.

Amended 2026-07-16 (unified source rail): the mapping-chip row and the permanently
allocated relationship-detail band are removed. One persistent source rail carries
every source exactly once; the selected parameter's attachments render as lit chip
states with amounts. A chip tap now navigates to the source editor; relationship
metadata (polarity, reducer, remove) moves to the source editor's target rows.
Rows below describe the amended contract.

Amended again 2026-07-16 after first hands-on review: the ~¼s hold-to-carry is
removed — a lit chip's vertical drag always scrubs, and assigning an attached
source elsewhere routes through selecting the destination parameter first (which
unlights the chip) or the chip's long-press menu. A ghost chip follows every
assignment drag, the long-press menu gains "Remove from <parameter>" for lit
chips (fixed sources included), rail scope is strictly the selected parameter
(unattached chips recede; global orphan-ness shows only in the count badge),
and chip focus renders as a corner-tick frame, never black/white inversion.

| Surface | Intent | Required behavior | Geometry invariant |
| --- | --- | --- | --- |
| Workspace carousel | Move between Voice and Effects | Tap either neighbor or swipe horizontally; restore the last module and parameter in each workspace | Header height and neighboring controls do not move |
| Effect rack | Focus an effect | Tapping the identity opens its editor | Tile width, quick-control lane, enable cell, and reorder cell are stable |
| Effect rack | Adjust a quick value | Scrub the module's last deliberately touched parameter; keep it selected | All formatted values occupy a reserved value column |
| Effect rack | Enable or bypass | Toggle the named effect without removing or moving it | Enabled and bypassed tiles have identical metrics |
| Effect rack | Reorder | Drag only the dedicated reorder handle; preserve effect and mapping identity | Actual handle cell is at least 44px and does not overlap quick adjustment |
| Module graphic | Shape the focused module | Direct manipulation edits the module's named X/Y parameters and updates the transient HUD | Compound controls remain in a reserved overlay lane |
| Parameter matrix | Select and edit | Tap selects; horizontal drag edits the effective base layer; vertical drag edits the focused mapping's amount | Every cell has stable tracks, source marks, and value lanes |
| Articulation override | Edit a non-default voice layer | Editing an eligible voice parameter creates/updates an absolute sparse override; Reset — the override chip in the module-editor header — clears only that target's base-value and route-amount overrides | Override marks appear without changing cell size; the reset chip lives in the module header's reserved context slot |
| Parameter-first modulation | Inspect mappings | Focused module remains visible; the persistent source rail lights the selected parameter's attached sources and shows each amount on its chip | Rail is permanently allocated; lit and unlit chips share identical metrics and never reflow |
| Source rail (lit chip) | Quick-adjust or focus a relationship | Vertical scrub adjusts that mapping's amount and makes it the focused mapping while the module remains operable | Amount lives only on the chip; scrub feedback is transient and nothing moves |
| Explicit source navigation | Edit a modulation source deeply | Tapping a user source's rail chip or a source-editor target action opens the source editor; fixed performance sources (Velocity/Pressure/Slide) have no editor and their tap is a quiet no-op; returning restores the module and selected target | Navigation replaces only the workspace and preserves shallow return context |
| Source rail | Read source identity | Icon, slot, and attachment count remain visible on every chip; chips attached to the selected parameter light with their amounts while every other chip recedes | The rail is a fixed 7×2 grid holding full source capacity; it never scrolls and chip metrics are fixed |
| Source rail | Assign by drag | Drag an unlit chip in ANY direction onto an eligible parameter (the rail has no pan gesture to conflict with); a ghost chip follows the pointer, drop targets become visible, and drop creates or focuses the mapping. A lit chip's vertical drag always scrubs and its horizontal drag is inert — assign an attached source elsewhere by selecting the destination parameter first (the chip unlights) or via its long-press menu | Ghost and drop targets are overlays and do not reflow controls |
| Source rail | Manage/add/undo | Long-press a chip for its action menu — for lit chips: polarity toggle (Unipolar/Bipolar), Enable/Disable, and Remove from the selected parameter (fixed sources included); for user sources additionally Delete with mapping count. Add reveals reserved Macro/Envelope/MSEG slots progressively; Undo restores the exact source when possible | Menus and Undo are overlays outside structural flow |
| Source editor | Edit source and targets | Source graphic remains focused; compact target rows expose relationship values and own polarity, reducer when required, and remove; one row may expose deeper settings inside the target scroll surface | Shell bands remain fixed; target list is a named scroll surface |
| Source-to-target navigation | Open a target and return | Open the target module with that relationship selected; Back restores source, expanded target, and scroll position | Navigation replaces the workspace; it is not an inline expansion |
| Audition transport | Trigger/retrigger | Trigger remains reachable in every focused editor; Repeat and Latch preserve their established behavior | Transport occupies a fixed shell row |
| Retrospective capture | Capture performed motion | While MIDI note or Trigger is held, remember the parameter actually moved and its patch/articulation layer; Capture creates the next available MSEG already mapped to it | Status text is bounded and cannot resize the transport |

Amended 2026-07-16 (real-synth mod-matrix parity, from `ui/shared/modulation.ts`
and `cmajor/FixedFrameOscillator.cmajor`): every mapping has an enabled flag
(long-press menu toggles it; a disabled mapping keeps its amount, rendered
muted/struck, and its cell band ghosts). Polarity transforms the source —
unipolar pushes one way from base, bipolar swings symmetrically around it —
so a bipolar mapping's band straddles the base on cell and target-row tracks,
and the long-press menu toggles polarity (unipolar is the default for every
source). Amounts are signed values in the target's own units (±6 oct for
frequency targets, ±48 st, −48..+6 dB for amp level, pan reads L/R when
unipolar, percent elsewhere); readouts show +X/−X for unipolar and ±X for
bipolar. Articulations override route amounts: with a non-Default articulation
active, chip amounts, cell Y-scrub, and target rows read and write that
articulation's sparse route-amount override on per-note voice targets, and
Reset clears them with the base-value override. The Max/Mean reducer is a
deliberate divergence from today's engine (which has no global-effect targets)
and is specified here as the intended engine addition.

## Reducer policy

- Macro to voice/global target: no reducer.
- Per-note Envelope, MSEG, Velocity, Pressure, or Slide to a global effect:
  show Maximum or Mean; Maximum is the default.
- Per-note source to a per-note voice target: no reducer control.

## Capacity policy

- Four Macro slots, three Envelope slots, and three MSEG slots are reserved.
- A new patch exposes only Macro 1, Envelope 1, and MSEG 1 plus Add.
- There is no separate LFO family.

## Layout-state fixtures

The final verification pass must cover:

1. Phaser Frequency with MSEG 1 and Pressure mappings.
2. Phaser Depth with one Macro mapping.
3. An unmapped Phaser parameter.
4. Wavetable with and without a Pluck override.
5. Envelope 1 with multiple targets and Envelope 2 as an orphan.
6. Enabled and bypassed rack effects with short and maximum-length values.
7. Trigger idle, held, repeated, latched, capture-ready, captured, and MSEG-full states.
8. A disabled mapping (struck amount on its lit chip, ghosted band on its cell).
9. A bipolar mapping at an extreme amount, its band straddling the base.
10. An articulation route-amount override whose value differs from the patch base.
