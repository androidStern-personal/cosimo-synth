# ADR-018: Explicit mobile modulation workflow

Status: accepted — 2026-08-08

## Context

The first integrated mobile modulation surface blurred three different states: selecting a source/target pair, creating a route, and editing an existing route. It also squeezed the desktop route matrix and MSEG editor into a phone, approximated the approved Variant-D source artwork, and left several touch paths vulnerable to scroll ownership or clipped controls. The result could show an editable amount for a nonexistent route and could not present one complete routing relationship without panning.

## Decision

- Source and target selection establish context only. A route is created explicitly by dropping a source on a target or invoking `CREATE MAPPING +`. An unassigned pair has no draft amount, and a failed creation at the 12-route ceiling leaves no phantom state.
- Rack parameter knobs use the approved dual-ring contract. Vertical movement edits the inner/base value; horizontal movement edits the selected real route on the outer ring after a six-pixel direction lock. Unmapped, zero-percent, and bypassed routes remain visually and behaviorally distinct.
- Mobile Mod uses a vertical route list and full-width detail screen rather than the desktop matrix. Creation drills through source, destination family, effect, and parameter. Source/target filters are removable context tokens; route order remains display-only because it has no sonic meaning.
- The 12-route engine limit remains unchanged pending a measured DSP-budget decision. The UI exposes the count and disables creation cleanly at the limit instead of implying expandable capacity.
- The approved Variant-D generated raster faces are shipped byte-for-byte with layered artwork and number markup. Selection belongs to the circular art plus a separate underline, never to the square button compositor surface. MSEG is purple, Envelope lime, Macro orange, and there is no LFO family.
- The compact MSEG editor is a modal instrument surface: graph-first, 44-pixel controls, A/B, Undo, Done, coordinate HUD, compact Morph/Time/Loop controls, enlarged touch hit geometry, focus containment, and inert background content. The desktop editor retains its existing layout.
- Mobile source navigation is laid out in contained touch rows down to 320 pixels. FX-to-Mod deep links preserve the exact source and expose a 44-pixel Back action that restores the originating context.
- Persistent `armedSource` and transient drag/preview source are separate state. Armed source owns outer-ring presentation; drag source owns only the temporary eligible-drop halo. Preview, cancellation, blur, and a rejected drop cannot change the armed relationship.
- One source-target pair owns at most one route. Shared normalization and runtime mutation keep the earliest loaded route deterministically and discard later duplicate pairs; a blank Mod Matrix Add chooses the next free pair. This makes stored state, rack editing, badges, matrix editing, and DSP upload use the same identity.
- Parameter descriptors state DSP modulation application independently from display scale. Frequency-like targets apply octave multiplication; log-displayed Global Filter Resonance, OTT Time, Flanger Rate, and Phaser Rate still apply linear deltas. The outer ring depicts only the selected route's clamped contribution, never the aggregate of all routes.
- A configured but mode-ineffective target stays discoverable as suspended when selected or routed. Effect bypass suspends active glow at editor level while retaining route geometry/topology; route bypass remains the distinct dashed/hollow mapping state and survives amount editing.

## Consequences

- A selected source/target pair can no longer be mistaken for a modulation assignment. Editing never silently creates or re-enables a route.
- Mobile routing is one-dimensional and understandable as relationships rather than a viewport onto a spreadsheet. Desktop users keep the denser matrix that suits their available width.
- The exact approved face art is now a protected product asset rather than an illustration to be regenerated or approximated.
- The route model deliberately remains limited to capabilities the engine actually supports: source, target, amount, polarity, enabled state, and the conditional Max/Mean reducer. Serum-style shaping, auxiliary sources, and route-cap expansion remain separate future DSP decisions.
- Existing duplicate pairs normalize destructively but predictably: the earliest route's id, order, enabled state, and amount win. This favors stable historical intent and one authoritative edit seam over attempting to merge incompatible route amounts or summing a pair the UI cannot identify separately.
- A route's outer geometry is truthful per route, including sign, polarity, clamping, base-value host echoes, zero-depth markers, and fully rail-clipped nonzero mappings. It deliberately does not claim to be the fully summed live parameter value when other routes also target the parameter.
- ADR-017 remains authoritative for the accordion, sticky keyboard, reversible deep links, no-LFO model, and mobile navigation grammar. This ADR supersedes its earlier implication that selecting a pair necessarily exposes an authoritative amount control.
