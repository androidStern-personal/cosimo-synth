# ADR-025: Parameter color and mapping feedback truth table

Status: accepted — 2026-08-18

## Context

The shared production knob currently gives every active base value the same pale
neutral accent. The same neutral treatment reaches compact Voice through
`BaseParameterKnob` and every FX parameter through `RackParameterKnob`. Selection and
drop targeting add more pale borders, so an active control can lose the identity of the
instrument or effect that owns it.

At the same time, modulation color must remain truthful. Selecting a source is not the
same as mapping it, a mapped route may have an amount of zero, and a bypassed route is
still a real route. A successful drop must be obvious without silently changing the
sound.

The accepted design was reviewed with the real production dual-ring knob in the
throwaway board at `ui/desktop/parameter-color-prototype/`. Its three views show the
complete state matrix, the states at FX-rack density, and one mapping from selection
through bypass.

## Decision

### Two independent color jobs

- The inside of a control describes the parameter itself. An active Voice parameter
  uses the Voice identity color, an active FX parameter uses that effect's existing
  accent, and an active Mod-source parameter uses its source-family accent.
- Selection brightens the same identity color. It does not replace that color with
  white or grey. Editing the base value adds a glow in that same color.
- The outside ring describes only the currently selected modulation source's
  relationship to this parameter. It uses the selected source's established family
  color.
- Grey is state-bearing only when something is turned off, bypassed, unavailable, or
  invalid for the current action.
- Neutral ink may still be used for typography, separators, the factory-default tick,
  and small contrast details. It must not carry the active/default/selected state of a
  control.
- The small stationary white factory-default tick remains visible. It marks the value
  that the parameter menu's Reset action will restore; it is not a default-state color.

### Approved state matrix

| Actual state | Required presentation |
| --- | --- |
| Active parameter, not selected | Inside value uses the owning Voice/effect/source-editor color. No outside ring appears when no modulation source is selected. |
| Selected parameter | The border brightens in the same owning color. |
| Base value being changed | The inside value glows in the owning color. |
| Source selected, pair not mapped | A dotted outside ring uses the selected source color. Dots, rather than a solid point or arc, explicitly mean “selected but not mapped.” |
| Pair mapped at 0% | The modulation-amount arc's full travel is drawn as a source-colored dotted outline. At 0%, none of the amount is drawn as a solid arc. One solid source-colored point at the parameter's current base position proves that the mapping exists. |
| Pair mapped above or below 0% | The same source-colored dotted outline remains behind the amount display. A solid source-colored arc covers the portion representing the real route amount and direction, and the solid route-presence point remains. |
| Other mappings exist on the parameter | A count badge reports the real total. With no source selected, no outside ring is shown. Selecting a source shows only that source's outside ring; it never combines unrelated mappings or borrows another source's color. |
| Selected route bypassed | The inside stays in the owning color. The outside ring for that mapping becomes grey and dashed. Its matrix/list row remains visible, shows a grey amount and a `BYPASSED` label, and still contributes to the Mod rail's mapping count. |
| Owning effect or oscillator bypassed | The whole control becomes grey because the parameter cannot currently affect sound. |
| Parameter unavailable in the current mode | The whole control becomes grey and carries the existing `MODE` explanation. |
| Dragged source cannot map here | The target becomes grey for the duration of that drag and cannot show an eligible or success treatment. |
| Dragged source can map here | A thin outline in the dragged source color marks eligibility. |
| Drag is captured by this target | A stronger outline in the dragged source color identifies where release will land. |
| Creation waiting for confirmation | The source-colored outline pulses, the target rejects additional drops, and no mapped point or solid amount arc appears yet. |
| New mapping confirmed | The target flashes in the source color, emits a small source-colored checkmark that rises and fades, and gives one light haptic tick. It then settles into the mapped-at-0% presentation. The Mod rail count and new 0% matrix/list row briefly pulse in the same source color. No success toast appears. |
| Pair already mapped | The target is not eligible: it receives no available-target or stronger hover highlight and cannot accept the drop. Holding the dragged source directly over it for 500 ms gives one deliberately noticeable warning buzz and one top-of-screen `DUPLICATE` toast. Leaving before 500 ms cancels both. Each duplicate target can report at most once per drag. Releasing there changes nothing. |
| Creation rejected or times out | A top-of-screen `MAPPING NOT CREATED` toast and a warning buzz shorter than the duplicate buzz report the failure. No route point, amount arc, Mod rail count change, or matrix/list row is retained, and the target returns to its truthful prior state. |

### Successful-drop behavior

- A new mapping keeps the existing explicit amount contract and starts at exactly 0%.
  Route creation must not make an unrequested sound change.
- Release on an eligible target first shows the pending pulse. Only confirmation from
  the authoritative route state may trigger the success flash and mapped-at-0% point.
- The Mod rail and matrix/list must update from that same confirmed route. They may not
  show success optimistically if no route exists.
- Duplicate and failure messages use non-blocking, Sonner-style toasts at the top of
  the screen. Success uses the local flash and floating checkmark instead of a toast.
- A duplicate target remains visibly unavailable throughout the drag. Its delayed buzz
  and toast explain the existing mapping without making the target look droppable.
- Exact animation duration and easing remain implementation tuning. The confirmation
  must be unmistakable without outliving the transient action.

### Existing-route behavior

- Editing an existing mapping amount updates the solid outside arc and the percentage
  in its matrix/list row from the same live value. It does not show a toast or
  checkmark and does not change the Mod rail count.
- Deleting a mapping removes its outside ring, matrix/list row, and contribution to the
  Mod rail count with a quick fade and no toast.
- Bypassing a mapping does not delete it. The knob's inside remains in its owning
  color; only that mapping's outside ring becomes grey and dashed. The retained
  matrix/list row shows a grey amount and `BYPASSED`, and the Mod rail count does not
  change.

## Current production divergences for the implementation ticket

- **Voice:** `ui/desktop/rack-parameter-knob.tsx` hardcodes
  `--rack-knob-accent: #d5dcde`; compact Voice's `BaseParameterKnob` inherits it.
- **FX:** the same hardcoded value makes every base ring neutral. The selected-target
  wrapper in `ui/desktop/effects-rack-workspace.css` uses a neutral border, the unmapped
  outside ring is neutral instead of source-colored, and hover outlines are mixed
  toward white instead of remaining in the dragged source color.
- **Mod:** explicit creation correctly requests amount `0`, but the mobile matrix
  returns directly to an ordinary route row with no confirmed-success state. Its route
  amount uses the generic Mod-card accent rather than the route's actual source color,
  and bypass currently dims the whole row rather than isolating the inactive mapping
  treatment.
- **Shared creation feedback:** FX clears `CREATING MAPPING…` as soon as the route
  appears, so no confirmed-success state survives for the target, rail, or matrix/list.

These are implementation inputs, not production changes made by this ADR.

## Consequences

- Active controls no longer become colorless simply because they are idle or selected.
- Parameter identity and modulation-source identity remain readable at the same time.
- Color never claims a mapping, effective route, or sound change that the underlying
  state does not contain.
- The next implementation must centralize these states across Voice, FX, the Mod rail,
  and the matrix/list rather than applying independent CSS fixes to each surface.
- The source-family colors and FX accent palette remain the existing production colors;
  this decision changes their semantic placement, not the palette.

## Rejected alternatives

- Neutral or white base rings for all active controls were rejected because default and
  selected controls became colorless.
- Using source color for the inside value was rejected because it would erase the
  parameter's owning instrument/effect identity and could falsely imply a mapping.
- Starting a new route with a small non-zero amount was rejected because dropping a
  source would change the sound without an explicit amount edit.
- Treating selected-but-unmapped and mapped-at-0% as the same ring was rejected because
  it would make color lie about whether a route exists.
- Immediate duplicate warnings on incidental flyover were rejected because they would
  spam the user while dragging toward another target. The 500 ms uninterrupted hover
  distinguishes deliberate inspection from transit.

## Deferred interaction experiment

- Speed-sensitive knob dragging remains worth testing later: faster finger movement
  would change the value by larger increments and slower movement by smaller
  increments. It is not part of this implementation or its acceptance criteria.
