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
| Workspace carousel | Move between Voice, Effects, and Articulations | Tap either neighbor or swipe horizontally; instrument workspaces restore their last module and parameter | Header height and neighboring controls do not move |
| Effect rack | Focus an effect | Tapping the identity opens its editor | Tile width, quick-control lane, enable cell, and reorder cell are stable |
| Effect rack | Adjust a quick value | Scrub the module's last deliberately touched parameter; keep it selected | All formatted values occupy a reserved value column |
| Effect rack | Enable or bypass | Toggle the named effect without removing or moving it | Enabled and bypassed tiles have identical metrics |
| Effect rack | Reorder | Drag only the dedicated reorder handle; preserve effect and mapping identity | Actual handle cell is at least 44px and does not overlap quick adjustment |
| Module graphic | Shape the focused module | Direct manipulation edits the module's named X/Y parameters and updates the transient HUD | Compound controls remain in a reserved overlay lane |
| Parameter matrix | Select and edit | Tap selects; horizontal drag edits the effective base layer; vertical drag edits the focused mapping's amount | Every cell has stable tracks, source marks, and value lanes |
| Articulation override | Edit a non-default voice layer | Overrides are authored ONLY while wearing an articulation (see the worn-layer row); with no layer worn, every edit writes patch base regardless of the audition articulation. Reset — the override chip in the module-editor header — clears only that target's base-value and route-amount overrides | Override marks appear without changing cell size; the reset chip lives in the module header's reserved context slot |
| Articulation strip (transport) | Choose audition articulation / enter the edit layer | The transport articulation control lives on the instrument workspaces only, never on the Articulations workspace; selecting a non-Default articulation exposes an EDIT latch beside it; the latch wears that articulation | Transport row geometry is fixed; the latch occupies reserved space within the articulation group |
| Worn edit layer | Author an articulation's sparse overrides in context | Entering wear snapshots the layer; while worn, every eligible per-note voice edit (cells, rail scrubs, module graphic) writes that articulation's override, while global effect edits stay patch-base; ✓ commits the session and ✕ restores the snapshot; exit returns to wherever wear began (transport latch → stay in place, Articulations card → back to the workspace). Wearing is MODAL: the articulation tab replaces the system menu in the header (icon, name, ✓, ✕) and the menu returns on exit | The worn frame wraps the ENTIRE shell in the articulation's color on every screen; the header tab is flush with the top edge, solid articulation-colored fill, contoured bottom. Solid colored fill and the tab's contour radius are reserved for this mode indicator alone — no control may reuse either. Nothing reflows |
| Articulations workspace · bank | Manage the articulation bank | Cards show identity (color, name, SEL number), the active trigger mode's assignment, and the override count; press-and-hold ▶ previews the articulation through the audition path; long-press opens Duplicate/Delete (rename deferred); Add creates the next slot with the next selector | Cards occupy the rack region's fixed band |
| Articulations workspace · trigger lane | Assign playback triggers | One mode visible at a time (Key/Vel/Chain). Key: a ~1.5-octave piano is display only, with octave paddles; a separate labeled drag handle (plus ∓1 nudges) moves the selected articulation's keyswitch so the finger never occludes placement, and movement clamps flush against neighbors with a haptic at first contact. Vel/Chain: partition strips with tap-to-select segments and scrubbed MIN/MAX values. Play-to-set appears only when MIDI input is present and is never required | The lane is display plus chunky controls; no manipulation target may fall below the touch minimum |
| Articulations workspace · diff | Inventory and edit the layer | The selected card lists every override as a full-width row: a track with base tick and handle (dragging the row edits the override), struck base beside the live value, and a full-height remove; tapping the row's name opens that module with the parameter selected and flashing, and a Back action in the module header returns to the Articulations workspace | Rows are touch-scale and the whole row is the control; no dead space between name and value |
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

Amended 2026-07-18 (articulation flow, ratified from the interactive models):
articulations are a bank of slots (id, name, color, selectorA number, trigger
assignments) plus the implicit Default layer. Editing selection and playback
selection are distinct: the audition articulation only chooses what audition
plays, and sparse overrides are authored exclusively inside the explicit worn
edit layer — deleting the old invisible mode where a non-Default audition
selection silently rerouted edits. The rows above describe the amended
contract. Deferred, recorded here so they are not mistaken for omissions:
slot rename; per-articulation envelope/MSEG-morph overrides (the engine
supports them — parity gap); card snapshot thumbnails (they visualize the
per-articulation envelope/morph data the mobile model does not yet carry);
play-to-set trigger assignment (requires MIDI input).

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
11. The Articulations workspace with adjacent keyswitches (flush, post-clamp) and a
    non-empty diff.
12. A worn edit layer over the voice matrix, with ✓/✕ visible and one uncommitted edit.
