# ADR-019: Global mobile modulation rail

Status: accepted — 2026-08-08

## Context

The approved Mod Bar was embedded in the FX editor footer. That made modulation sources disappear whenever Voice or Mod was open and coupled source access to whichever effect happened to be selected. Moving the same controls into a normal full-width row would reclaim too much phone height. A floating control also introduces competing touch meanings: moving the control, selecting or opening a source, dragging a source onto a target, paging sources, and ordinary page scrolling.

## Decision

- Mobile renders one Mod Bar through a portal above the Voice/FX/Mod accordion and below the persistent synth shell. It remains mounted while accordion sections change. Desktop retains the existing inline Mod Bar.
- Its resting form is a narrow right-edge rail with a curved silhouette rather than a hard perpendicular tab. It shows the selected source, real route count, a disclosure cue, and real MSEG playhead activity when that telemetry exists. Envelope and Macro activity are not fabricated.
- A tap expands or collapses the drawer inward. A vertical drag on the grip repositions it after a seven-pixel threshold. The final position magnetizes near top, middle, or bottom, gives an optional light haptic, persists as a normalized value, and is reprojected within safe bounds after resize, orientation, toolbar, or keyboard changes.
- Touch ownership is explicit. The grip only moves or toggles the rail; source art only selects, deep-links, or begins route mapping; paddles only page sources. The transparent portal layer never owns ordinary page scroll.
- Source mapping keeps pointer capture, retracts the drawer, shows a source-colored ghost, highlights valid targets, dims invalid controls, and uses controlled edge scrolling. While mapping, the entire rail becomes hit-transparent so it cannot block a target beneath its visible or invisible bounds. Ending, cancelling, losing capture, blurring, hiding the page, or unmounting clears the gesture exactly once.
- A successful drop uses the existing canonical explicit route-creation path and leaves the dropped target selected. Invalid drops and route-cap failures create no route and retain no draft amount.
- A left-edge alternative and additional grip gestures are deferred. There is no half-open rail state or nested drawer scrolling.

## Consequences

- Modulation sources are globally reachable without permanently consuming vertical instrument space.
- Moving the rail cannot create a route, and mapping a source cannot move the rail. Even controls directly beneath the rail remain valid drop targets during mapping.
- Position persistence survives materially different phone viewports instead of replaying a stale pixel offset.
- The activity display stays honest but is intentionally incomplete for source families whose live value is not currently exposed by the engine.
- ADR-018 remains authoritative for explicit mapping, route limits, source artwork, the no-LFO product model, and source/target semantics.
