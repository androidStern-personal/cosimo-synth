# ADR-016: Mobile rack workspace and no separate LFO family

Status: accepted — 2026-08-06

## Context

The approved mobile effects design must show all eight 56-pixel rack faceplates, a useful selected-effect editor, modulation controls, and a playable sticky keyboard in a 375-by-667 viewport. Keeping that composition in the existing scrolling voice page made the rack incomplete on screen and diluted the approved two-column relationship. Earlier prototype assets also introduced LFO icons even though Cosimo's modulation model deliberately assigns repeating shapes to looping MSEGs.

## Decision

- On compact viewports, the effects rack is a dedicated subpage in the existing synth surface. A visible FX Rack entry opens it; Back to synth controls returns to the scrollable wavetable/voice content. The sticky keyboard remains mounted and playable on both pages.
- The rack's left column owns all eight faceplates for the full workspace height. Modulation-source selection and amount editing belong only to the selected-effect column.
- The compact mod bar exposes exactly three numbered engine-backed families: MSEG, Envelope, and Macro. Pages 1–3 show the matching numbered instance of each family and transition over 280 ms.
- There is no LFO source, state, route, icon family, or engine work. Looping MSEG remains the single representation of repeating modulation.
- Selecting a source and a target identifies their route intersection. The one bipolar amount control reads or writes that real route; selecting in either order is supported.

## Consequences

- Mobile users make one explicit page transition to reach the rack, and can scroll the voice page normally when they return.
- No fourth placeholder source is invented merely to fill the bar.
- LFO prototype assets are removed rather than left as dormant product vocabulary.
- The desktop layout continues to place the same shared rack workspace inline; parameter descriptors, state, and engine writes are not forked by viewport.
