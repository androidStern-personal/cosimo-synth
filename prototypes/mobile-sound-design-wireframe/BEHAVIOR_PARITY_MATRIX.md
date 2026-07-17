# Cosimo Mobile Interaction Parity Matrix

> **Superseded 2026-07-16.** This checklist validated the restoration of the
> pre-rail prototype. The mapping-chip row and relationship-detail band it
> references were removed by the unified source rail amendment; the current
> behavior contract is `INTERACTION_MATRIX.md`. Kept for history only.

This is the acceptance checklist for restoring the interaction-complete mobile
prototype after the Ulm visual/component refactor.

Sources of truth, in precedence order:

1. Later explicit decisions in `docs/COSIMO_IOS_UI_DECISION_LEDGER.md`.
2. Observable interaction behavior in checkpoint `b3d8944` (with `b3a40dc`
   retained only as the earlier visual reference).
3. The current component architecture where it improves arbitration without
   changing product behavior.

The old expanding mapping card is intentionally **not** restored. The later fixed
relationship-surface decision supersedes it.

## Direct manipulation

| Surface | Tap | Horizontal drag | Vertical drag | Required feedback |
|---|---|---|---|---|
| Module parameter | Select target | Edit current base/edit layer | Edit selected mapping amount | Dominant-axis lock, one haptic, transient HUD, no synthetic tap after drag |
| Mapping chip | Select relationship in the fixed detail surface | No edit | Edit that relationship's amount | Amount on chip updates, transient HUD, no synthetic tap after drag |
| Source target row | Select relationship settings | Edit target base/edit layer | Edit this source-to-target amount | Dominant-axis lock, transient HUD, no synthetic tap after drag |
| Module graphic | Focus its manipulated axis/target | Edit the declared horizontal graphic axis | Edit the declared vertical graphic axis | Real graphic moves, transient HUD, no unrelated parameter changes |
| Rack quick control | Keep/open effect focus | Edit the tile's last-tweaked parameter | None | Stable formatted value and transient HUD |
| Source shape | Keep source focus | Source-specific stage/time edit | Source-specific level/scale edit | Shape and transient HUD update |

## Mapping relationships

- [x] A mapping chip always shows source identity and signed amount.
- [x] A chip pointer-down makes that relationship current so subsequent parameter
      Y-drags edit the same mapping.
- [x] Chip tap swaps one permanently allocated detail surface in place.
- [x] Reselecting the active chip does not collapse anything.
- [x] The focused module remains visible and operable while relationship settings
      are edited.
- [x] The fixed detail contains source navigation, polarity, conditional reducer,
      and remove. It does not make a redundant amount slider the primary control.
- [x] Empty and populated relationship states use the same reserved geometry.
- [x] Reducer appears only for a voice/per-note source crossing into a global
      destination; v1 choices are Max and Mean.
- [x] Clearing an articulation override removes only that sparse override.

## Source-first flow

- [x] Tapping a shelf chip explicitly opens that source editor.
- [x] Tapping the source preview in mapping detail opens the same editor.
- [x] Source target rows reflect the selected source's real targets.
- [x] Each target row supports X base / Y source amount.
- [x] A separate open-target affordance navigates to the owning module.
- [x] The target module shows a contextual `Back to <source>` action.
- [x] Back restores the exact source, selected relationship, and target-list scroll.
- [x] `+ Target` and target-side `+ Source` create the same mapping model.

## Drag-to-assign and source management

- [x] A vertical lift gesture on a source chip starts assignment; horizontal motion
      remains shelf scrolling.
- [x] As soon as lift begins, eligible parameter targets are visibly droppable and
      ineligible/already-mapped targets quiet down.
- [x] Entering a valid target and completing a drop provide haptic feedback.
- [x] Dropping on a new target creates and selects the mapping.
- [x] Dropping on an already-related target selects/focuses that relationship rather
      than duplicating it.
- [x] Cancel clears all drag affordances and does not open the source.
- [x] Long press opens source actions without also opening the editor.
- [x] Delete communicates mapping impact, removes the source and its mappings,
      frees the slot, and offers Undo.
- [x] Orphans are visually quiet and every chip has a distinct attachment-count badge.

## Shell, rack, and navigation

- [x] Voice/Oscillator and Effects are sibling workspaces reachable by tap or swipe.
- [x] Each workspace restores its last focused module and parameter.
- [x] Effects rack quick control tracks that effect's last touched parameter.
- [x] Rack quick control, effect focus, enable toggle, and reorder handle are distinct
      touch regions.
- [x] Reorder occurs only from the handle; cancel does not commit a reorder.
- [x] Selected effects use the established black/white inversion.

## Audition and capture

- [x] Audition remains present in module, source, and relationship contexts.
- [x] Trigger supports repeated press/hold/release without a synthetic second trigger.
- [x] Latch, Repeat, note, and articulation state remain stable during navigation.
- [x] Moving a parameter while Trigger is held records that physically moved target,
      edit layer, articulation, and note lifecycle as the retrospective candidate.
- [x] Selecting a different parameter afterward does not retarget Capture.
- [x] Capture creates an MSEG mapped to the recorded target and confirms success.
- [x] Every continuous edit uses the same reserved transient HUD and cannot reflow
      the page as formatted values change.

## Responsive and regression proof

- [x] No overlap, clipping, or value-driven layout shift at 375×667.
- [x] No overlap, clipping, or value-driven layout shift at 390×844.
- [x] Mapping-chip selection preserves the module/inspector boundary at both sizes.
- [x] Automated tests cover axis lock, no axis switching, click suppression,
      cancellation, mapping selection, duplicate drop behavior, navigation restore,
      and capture target ownership.

Verified on 2026-07-15 in the live React prototype at both iPhone sizes. The
automated parity suite passes 28/28; browser verification covered parameter and
graphic X/Y gestures, mapping-chip Y scrub, source lift/drop and duplicate drop,
source target disclosure/reset, source-to-target return, capture ownership,
delete/Undo, rack reorder, and workspace swipe.
