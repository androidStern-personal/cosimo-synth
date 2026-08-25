# FX Graph Connector Drawing Findings

Status: confirmed product bug on `master` at `1847b7d05cbb3ca540fe35292a919a1a70d9cb52` (2026-08-25)

## What is wrong

When an effect is wrapped in Parallel or Frequency Split, the incoming line reaches the split symbol and stops. The branch lines begin lower down as separate vertical lines. They do not emerge from the split and diverge, so the picture does not describe the audio flow it represents.

This is a drawing bug, not an error in the stored rack structure. The layout data correctly says that a fork exists and correctly identifies its branches.

## How the graph is drawn now

The graph has three relevant layers:

1. `ui/shared/lane-subway-layout.ts` turns the rack tree into rows: effects, forks, branch lanes, and merges. This layer correctly represents Parallel and Frequency Split groups.
2. `ui/desktop/subway-map-column.tsx` turns those rows into ordinary HTML elements.
3. `ui/desktop/effects-rack-workspace.css` draws the visible lines as small CSS rectangles using borders and `::before`/`::after` elements. There is no SVG, canvas, or continuous path drawing.

That last choice is why the current graph is easy to style as straight rails but awkward to make behave like a real flow diagram.

## Confirmed failure

For a two-way Parallel split:

- the fork is 40 pixels tall;
- the incoming line ends 20 pixels from its top;
- the horizontal split bar is drawn at that same 20-pixel position;
- the two branch lines do not begin until the next row, 40 pixels from the fork's top.

Nothing draws the two outgoing pieces between those positions. A browser check sampled the rendered line pixels and found that neither branch was connected to the incoming line: expected `[true, true]`, observed `[false, false]`.

The merge code already draws the missing kind of intermediate connection on the return side. The fork has no corresponding outgoing pieces.

## Why this happened

The incomplete fork drawing was introduced with the original interactive map in commit `6b1b6306`. Its comment describes the horizontal bar as the bar “the lanes hang from,” but no hanging connectors were implemented.

This is therefore an original implementation oversight that produces a visible bug. It is not a later regression and it is not an intentional visual treatment.

The existing tests confirm the rack structure, labels, symbols, branch count, and interactions. None checks whether the rendered lines actually connect. That gap allowed the drawing to pass while visually describing the wrong topology.

## Is the drawing system good enough for rounded paths?

Not as it stands. The CSS rectangles could be extended to close this specific gap with square, right-angle connectors. They are a poor foundation for proper rounded branches that leave one junction and smoothly diverge.

The rack model and interactive HTML can remain. Only the connector drawing should change to a scalable SVG layer with one continuous path from the incoming rail through the junction to each outgoing branch. SVG paths provide real curves, rounded joins, rounded ends, and a straightforward way to keep every branch visibly connected as the lane count and width change.

## Repair boundaries

The repair should:

- draw both Parallel and Frequency Split forks as continuous, smoothly diverging paths;
- draw their merges with the same geometry in reverse;
- support every allowed branch count and responsive width;
- preserve each branch's color, empty-branch dashes, bypass dimming, selection symbols, labels, and click targets;
- leave rack state, DSP routing, drag-and-drop behavior, menus, and parameter handling unchanged.

## Evidence required before closing the bug

A browser test must inspect the rendered result and prove that line-colored pixels connect the incoming rail to every outgoing rail and every incoming branch to the merged rail. It should cover Parallel and Frequency Split groups at their allowed branch counts and representative narrow and wide layouts.

Element counts, class names, or the presence of a fork symbol are not sufficient proof. The regression is specifically about visible continuity.
