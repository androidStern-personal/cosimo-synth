# SeqFX supported-size visual qualification

Date: 2026-08-30  
Command: `npm run fx:seqfx:visual-proof`  
Result: pass

## What was proved

The reproducible Playwright qualification captured 56 named screenshots and
measured 56 rendered states:

- empty state plus top and lower inspector captures for all 12 effects at the
  1120 x 680 default;
- empty state plus top and lower inspector captures for all 12 effects at the
  900 x 600 compact size;
- empty state plus top and lower Twelve-effect Tour captures at the 720 x 520
  minimum;
- empty state plus top and lower Twelve-effect Tour captures at the 1440 x 800
  wide size.

The run also performed 26 full-depth inspector traversals. Each traversal
opened the effect's Advanced disclosure when present, sampled the inspector in
overlapping viewport-sized increments, finished at the exact lower scroll
edge, and accounted for every enabled button, select, and input. No inspector
control was missed, and no visible inspector child crossed its horizontal
bounds at any depth. This includes all Advanced controls for Pitch, Comb,
Ring, Reverse, Talk Box, Vibro, Flange, and Dirty at both default and compact
sizes.

Across those states the proof found no document/root overflow, no inspector
horizontal overflow, no inspector child outside its owned bounds, no clipped
effect name, no hidden chain label, and no enabled button, select, number input,
or range input below the 24 CSS px desktop target. Vertical overflow remained
owned by the inspector at every supported two-column size.

The same run evaluated 8,420 rendered normal-text contrast samples against
their composited backgrounds. Every sample met WCAG AA's 4.5:1 threshold; the
run has no low-contrast exception list. It also proved the reduced-motion media
override across every rendered child.

Seven representative controls were reached by actual Tab navigation and
exposed a solid 2 px or 3 px focus outline: SeqFX On, the loop ruler, a grid
cell, an effect choice, the Effect tab, Block Mix, and the last enabled control
at the bottom of the inspector.

Zoom was modeled as the CSS viewport produced when a 1120 x 680 host surface is
viewed at 80%, 100%, 125%, 150%, and 200%. At each effective viewport, nine
core controls could be scrolled into view and focused, and the document had no
horizontal overflow. This covers the global switch, clock source, factory
pattern, loop ruler, grid, effect picker, Effect tab, Block Mix, and the final
enabled inspector control.

## Server lifecycle

The proof starts Vite through its programmatic API only when port 5175 is free.
If the port is already serving this exact worktree, it reuses that server and
does not own or close it; if another workspace owns the port, it fails without
interrupting it. When this run owned the server, `server.close()` completed and
an independent TCP probe confirmed that port 5175 was no longer reachable.
The final manifest records `ownedByProof: true` and `closeVerified: true`.

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

The generated contact sheet plus full-resolution top and lower inspector
captures were inspected after the final run. The default, compact, minimum,
and wide surfaces preserve the product hierarchy; all named effects are
legible; chain identity and block effect identity remain visible; Advanced
controls remain readable at the lower scroll edge; the inspector owns its
scroll; and no remaining formatting defect was observed.

## Evidence identity

Generated artifacts live under ignored `build/seqfx_visual_proof/`. The script
now creates both the named captures and the contact sheet, so the entire visual
evidence set is reproducible from one command.

- `manifest.json` SHA-256:
  `65871b2dfec5d88489035358bb36baa1bba1f078b451e5f574a36ba50159c5e0`
- `contact-sheet.png` SHA-256:
  `436a1261f5b7c6006fde2661d89c32646f67431bc41c8383b5dcf43b38e5afa6`

## Boundary

This is automated Chromium and human screenshot qualification, not physical
display, Ableton WebView, macOS accessibility-inspector, or listening
acceptance. Those remain separate release-candidate gates.
