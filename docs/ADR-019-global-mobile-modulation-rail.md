# ADR-019: Global mobile modulation rail

Status: accepted — 2026-08-08; corrected 2026-08-15 and 2026-08-17

## Context

The approved Mod Bar was embedded in the FX editor footer. That made modulation sources disappear whenever Voice or Mod was open and coupled source access to whichever effect happened to be selected. Moving the same controls into a normal full-width row would reclaim too much phone height. A floating control also introduces competing touch meanings: moving the control, selecting or opening a source, dragging a source onto a target, paging sources, and ordinary page scrolling.

## Decision

- Mobile renders one Mod Bar through a portal above the Voice/FX/Mod accordion and below the persistent synth shell. It remains mounted while accordion sections change. Desktop retains the existing inline Mod Bar.
- Its resting form is a narrow right-edge rail with a curved silhouette rather than a hard perpendicular tab. It shows the selected source, real route count, a disclosure cue, and real MSEG playhead activity when that telemetry exists. Envelope and Macro activity are not fabricated.
- A tap expands or collapses the drawer inward. A vertical drag on the grip repositions it after a seven-pixel threshold. The final position magnetizes near top, middle, or bottom, gives an optional light haptic, persists as a normalized value, and is reprojected within safe bounds after resize, orientation, toolbar, or keyboard changes.
- Touch ownership is explicit. The grip only moves or toggles the rail; source art only selects, deep-links, or begins route mapping; paddles only page sources. The transparent portal layer never owns ordinary page scroll.
- Source mapping keeps pointer capture, retracts the drawer, shows a source-colored ghost, highlights valid targets, dims invalid controls, and uses controlled edge scrolling. While mapping, the entire rail becomes hit-transparent so it cannot block a target beneath its visible or invisible bounds. Ending, cancelling, losing capture, blurring, hiding the page, or unmounting clears the gesture exactly once.
- A successful drop uses the existing canonical explicit route-creation path and leaves the dropped target selected. Invalid drops and duplicate/domain-exhaustion failures create no route and retain no draft amount.
- A left-edge alternative and additional grip gestures are deferred. There is no half-open rail state or nested drawer scrolling.

## Consequences

- Modulation sources are globally reachable without permanently consuming vertical instrument space.
- Moving the rail cannot create a route, and mapping a source cannot move the rail. Even controls directly beneath the rail remain valid drop targets during mapping.
- Position persistence survives materially different phone viewports instead of replaying a stale pixel offset.
- The activity display stays honest but is intentionally incomplete for source families whose live value is not currently exposed by the engine.
- ADR-018 remains authoritative for explicit mapping, source artwork, the no-LFO product model, and source/target semantics. ADR-020 owns scalable capacity and runtime execution.

## 2026-08-17 correction: amplified finger-clearing touch drag

Direct one-to-one touch tracking left the source ghost under the finger and hid the
destination at the moment of placement. The first correction added a bounded 64-pixel
lead, but physical-phone testing showed that it solved occlusion only: once established,
the preview returned to one-to-one tracking and still required nearly full-screen thumb
travel.

- Touch source drags now use progressive control-display gain. After the existing
  seven-pixel drag threshold, gain eases from 1x to a viewport-responsive 2.1–2.5x over
  64 pixels of thumb travel; it is approximately 2.34x at a 393-pixel viewport and stays
  amplified afterward. This preserves continuous pickup while allowing roughly 150
  pixels of thumb travel to cross about 330 pixels of the surface.
- The preview hotspot is the authoritative point for highlighting, target capture, edge
  scrolling, and drop. Mouse and pen remain direct so their precise cursor contract does
  not change.
- The transfer function derives each step from consecutive absolute mapped positions, so
  event frequency cannot change the result. Each step clamps to the preview-safe viewport
  and discards overshoot; reversing the thumb therefore leaves an edge immediately rather
  than paying back a hidden dead distance.
- Targets have a minimum 44-pixel capture region, retain capture with 12 pixels of
  hysteresis, and can be acquired when a fast movement segment crosses them. Capture is
  communicated by the target's source-colored highlight and one light haptic bump. The
  preview remains full-sized on its uninterrupted amplified trajectory; it never snaps
  or resizes when a target claims the prospective drop. Releasing commits to the retained
  target even when the preview has moved outside its exact bounds but remains within the
  capture hysteresis region.
- Once source mapping activates, the right-edge rail retreats fully beyond the viewport
  in 120 milliseconds while the preview remains visible. It returns to the same persisted
  vertical position after drop or cancellation. This uses a stable horizontal edge retreat
  rather than vertical collision chasing, which could unpredictably cover a different
  destination; reduced-motion makes the retreat and return effectively immediate.

## 2026-08-15 correction: shared Voice/FX targets

The source-drag gesture was still discovering targets through an FX-only DOM attribute
and converting every drop into a `rack.*` address. That made the global rail visually
available over Voice while leaving the existing oscillator and shared-filter runtime
targets unreachable.

- Every drop surface now publishes its exact canonical modulation target kind through
  one workspace-independent attribute. The gesture validates that identity against the
  current 86-target catalog before creating a route; it does not infer an address from
  the current tab or selected effect.
- The selected oscillator exposes frame position, warp amount, aggregate tune, level,
  pan, detune, blend, width, wavetable-position spread, and warp spread. Switching A/B/C
  changes those identities rather than falling through to another oscillator. Shared
  filter cutoff and resonance retain their global identities. FX parameters use the same
  contract while preserving their effect-selection behavior.
- All valid visible targets receive the same source-colored eligible and hover treatment
  during a drag. The rail remains hit-transparent, so this also applies to controls below
  its on-screen bounds.
- Structural source settings remain configuration, not modulation destinations. MSEG
  point geometry, loop window/mode, note-off policy, and other discrete switches do not
  acquire a target merely because their editor is visible.

## 2026-08-15 correction: continuous MSEG and envelope targets

The explicit DSP/schema expansion is now accepted and implemented for the continuous
controls beneath those source editors.

- MSEG 1/2/3 Morph and Time, plus Envelope 1/2/3 Attack, Decay, Sustain, and Release,
  are public host parameters and real modulation destinations.
- Each visible desktop/mobile control publishes its exact target identity through the
  same workspace-independent drop contract as oscillator, filter, and FX controls.
- Touch-drop behavior is not a visual-only marker: route creation compiles into the
  50-target voice program and changes the real generator behavior in Cmajor.
- These values are saved once in the host parameter snapshot. `modulation.v6` keeps
  MSEG shapes/discrete playback policy, envelope names, and routes; it does not keep a
  second copy of Time or ADSR.
- MSEG/envelope self- or cross-modulation consumes the prior audio frame's source value.
  That one-frame delay avoids an algebraic cycle while remaining audio-rate.

## 2026-08-08 correction: true edge tab

The first shipped rail was rejected on geometry: collapsed art spilled past the tab
silhouette, expansion opened a detached horizontal popup joined by an angular
connector wedge, and the parameter gesture HUD docked at the workspace top where
the expanded drawer (and its modulation amount slider) could sit underneath it.

- The silhouette is now composed in CSS instead of a fixed-viewBox SVG: an opaque
  body with convex left corners plus two concave radial-gradient shoulder fillets
  that merge tangentially into the right screen edge — a browser tab rotated onto
  the edge. The rail layer is fixed to the visual viewport so the tab is flush with
  the physical screen edge rather than the padded app surface.
- Expansion animates `width`/`height` of the same element. The drawer content is
  laid out inside the tab body at a fixed inner width and is revealed by the
  widening surface; the grip remains the tab's right column at every width, so
  there is no second surface, no popup, and no exposed sharp corners. Collapsed
  contents (grip handle, selected art, activity, route count, chevron) stack in
  one vertical column that fits inside the tab from 320px to 430px widths.
- Vertical bounds are re-clamped from the rail's own ResizeObserver entry so the
  expanded height stays clear of the sticky keyboard, and measure-driven
  reprojection is suppressed while a grip gesture owns the position.
- The gesture HUD now carries its anchor rect and live pointer, and the renderer
  chooses a stable placement (side order depends on drag axis) that must not
  intersect the active control, the rail, the sticky keyboard, the finger zone, or
  the viewport edges, falling back to a safe top dock. It remains pointer-events
  none and positions absolutely, so layout never moves.
- Source mapping still compacts the tab to its collapsed geometry, keeps the
  ghost, makes the rail hit-transparent, and feeds the explicit route-creation
  flow unchanged.

## 2026-08-08 correction: fixed tab with space-aware vertical drawer

The widening edge tab was rejected because disclosure changed the persistent
tab's dimensions and exposed the source page as a horizontal tray. The source
art also combined a generated face with a white identity glyph, so each control
looked like two overlapping icons.

- The persistent tab now keeps one fixed width, height, and top position.
  Disclosure extends a same-width drawer downward when its full contents fit.
  When the tab is too close to the sticky keyboard, the drawer opens upward
  instead; if neither side can fit the full drawer, the larger side owns a
  contained scroller. The preset bar is part of the top safe boundary, so the
  movable tab never becomes trapped behind it.
- The established three numbered source groups remain. Each group is one
  vertical page containing MSEG, Envelope, and Macro, and the existing 280 ms
  page transition runs vertically through up/down paddles.
- Every source uses one source-colored fontaudio identity glyph plus its slot
  number. The generated face artwork remains available to surfaces that still
  own that visual treatment, but it is no longer layered underneath the glyph
  in the Mod Bar.
- The compact rail follows one measured rhythm: a centered 44-pixel source
  target, compact geometric chevrons in 28-pixel paging controls, four-pixel
  gaps between source rows, and symmetric visual spacing above and below the
  collapsed source. The route count is a notification-style badge on the
  source's upper-right corner rather than a separate row.
- The active source in the collapsed tab is a real source button. It shares the
  canonical source-drag lifecycle with drawer sources, so a drag can create a
  route without expanding or moving the rail; a stationary tap still toggles
  disclosure. The remaining tab surface continues to own rail movement.
- Route amount, unmapped creation, and route-status feedback remain in the FX
  editor. The narrow drawer owns source navigation only and therefore does not
  distort the authoritative amount control.

## 2026-08-08 correction: one vector silhouette

The CSS-composed shoulders produced an invalid visual ownership split: radial
gradients painted the concave shoulders, inset shadows painted the body edges,
and an opaque grip covered part of those edges. The bottom body shadow also
crossed the independently painted shoulder curve.

- One closed, height-aware SVG path now owns the complete tab shape, including
  both concave shoulders, the convex left corners, the fill, and the external
  stroke. Expansion changes that path's height without changing its radii.
- The grip and body are transparent and draw no external border. Interactive
  content remains ordinary HTML above the SVG, preserving touch, focus, and
  accessibility behavior without participating in the silhouette.
- The drawer divider is inset from the external contour. It cannot intersect or
  visually continue the outer stroke in either expansion direction.
