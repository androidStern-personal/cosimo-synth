# Design QA

## Comparison targets

- Viewport: `390 × 844`.
- Product rule under test: the focused editor changes only after explicit module or modulator selection.
- Source visual truth:
  - `references/parameter-first.png` for Filter focus with incoming mappings.
  - `references/source-first.png` for explicit MSEG focus with outgoing targets.
- Browser-rendered implementation:
  - `artifacts/filter-focus.png`
  - `artifacts/mseg-focus.png`
- Full-view comparisons:
  - `artifacts/comparisons/filter-focus.png`
  - `artifacts/comparisons/mseg-focus.png`

## Findings

- No actionable P0, P1, or P2 issues remain for the interaction prototype.
- Filter focus remains visually dominant while Cutoff mappings open around it.
- MSEG focus occurs only after explicitly selecting MSEG 1; editing a target row does not replace the MSEG editor with Filter.
- Returning to Filter requires explicitly selecting Filter in the rack.
- [P3] Exact production fonts and decorative analyzer detail remain a later visual-fidelity pass.

## Required fidelity surfaces

- Fonts and typography: condensed labels and mono values preserve the source hierarchy; exact font files are not bundled.
- Spacing and layout rhythm: both states fit 390 × 844, persistent docks remain visible, and mapping actions are not clipped.
- Colors and visual tokens: dark instrument surfaces, cyan signal information, pink modulation state, and amber macro state match the established Cosimo direction.
- Image quality and asset fidelity: Filter and MSEG graphics render sharply as live canvases at device pixel ratio.
- Copy and content: rack quick parameters, mapping amounts, polarity, reducers, targets, and progressive source labels match the accepted vocabulary.

## Interaction verification

- Opened Filter Cutoff mappings and confirmed Filter remained the focused editor.
- Closed the mappings and explicitly selected MSEG 1 from the dock.
- Edited the Filter · Cutoff target and confirmed MSEG remained the focused editor.
- Explicitly selected Filter in the rack and confirmed Filter focus returned.
- Browser console and page errors: none.

## Comparison history

- The previous three-option prototype incorrectly treated Filter-focused and MSEG-focused editing as competing layouts. It was removed from the visible prototype.
- The replacement encodes one model with two explicit focus states and no implicit editor switching.

## Follow-up polish

- Once the focus model is accepted, compare alternative ways for incoming mappings to coexist with the Filter without changing focus.

final result: passed
