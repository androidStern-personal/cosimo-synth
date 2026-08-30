# SeqFX supported-size visual qualification

Date: 2026-08-30  
Command: `npm run fx:seqfx:visual-proof`  
Result: pass

## What was proved

The reproducible Playwright qualification captured 30 named screenshots and
measured 30 rendered states:

- empty state plus all 12 selected effect inspectors at the 1120 x 680 default;
- empty state plus all 12 selected effect inspectors at the 900 x 600 compact
  size;
- empty state plus the Twelve-effect Tour at the 720 x 520 minimum;
- empty state plus the Twelve-effect Tour at the 1440 x 800 wide size.

Across those states the proof found no document/root overflow, no inspector
horizontal overflow, no inspector child outside its owned bounds, no clipped
effect name, no hidden chain label, and no enabled button, select, number input,
or range input below the 24 CSS px desktop target. Vertical overflow remained
owned by the inspector at every supported two-column size.

The same run evaluated 4,322 rendered normal-text contrast samples against
their composited backgrounds. Every sample met WCAG AA's 4.5:1 threshold; the
run has no low-contrast exception list. It also proved the reduced-motion media
override across every rendered child.

Six representative controls were reached by actual Tab navigation and exposed
a solid 2 px or 3 px focus outline: SeqFX On, the loop ruler, a grid cell, an
effect choice, the Effect tab, and Block Mix.

Zoom was modeled as the CSS viewport produced when a 1120 x 680 host surface is
viewed at 80%, 100%, 125%, 150%, and 200%. At each effective viewport, eight
core controls could be scrolled into view and focused, and the document had no
horizontal overflow. This covers the global switch, clock source, factory
pattern, loop ruler, grid, effect picker, Effect tab, and Block Mix.

## Defects found and repaired by the matrix

- The 12-effect picker's narrow cards truncated longer names. Its minimum card
  width is now 90 px.
- Filter, Crush, and Stutter exposed several controls below 24 px. Their scoped
  hit targets and stop buttons now meet the desktop minimum, and SeqFX range
  controls have a 24 px minimum height.
- Muted labels, step numbers, Filter's span readout, and trigger-latched badges
  missed 4.5:1. SeqFX now uses a darker muted-ink token and dark-on-amber
  trigger badges.
- Focus treatment varied between native, shared-editor, grid, and inspector
  controls. SeqFX now supplies a high-contrast two-tone focus treatment while
  preserving the grid's existing focus state.

## Human inspection

The generated contact sheet and the full-resolution default Tape Stop capture
were inspected after the final repairs. The default, compact, minimum, and wide
surfaces preserve the product hierarchy; all named effects are legible; chain
identity and block effect identity remain visible; the inspector owns its
scroll; and no remaining formatting defect was observed.

## Evidence identity

Generated artifacts live under ignored `build/seqfx_visual_proof/` and can be
reproduced from the committed script.

- `manifest.json` SHA-256:
  `b0b9ed458cf2191b4bf2837a4e6b6ca90b09c2ee3a56c4d81e38332d83fe5f81`
- `contact-sheet.png` SHA-256:
  `75f3660688977767b9ba208ba5a0f2cd1fdde30b7f26ed33b6a688b9c87d0988`

## Boundary

This is automated Chromium and human screenshot qualification, not physical
display, Ableton WebView, macOS accessibility-inspector, or listening
acceptance. Those remain separate release-candidate gates.
