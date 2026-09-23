# Knob extraction handoff

Implemented on `codex/builder-kit-knob-318e`, based on integrated state-API commit `6febf1ea`. Original extraction: `84ac6415`; production composition and complete-copy examples: `69106bb6`; customer build command: `c820b9db`. The integration coordinator owns integration and publication.

## Result

- Customer API: `Knob`, `KnobRoot`, `KnobControl`, `KnobDial`, `KnobLabel`, `KnobValue`, `KnobInput`, `KnobRange`, `KnobMarker`, `useKnob`, `LiveValue` and associated prop types through `kit/index.ts`.
- Cosimo's common `ParameterKnobSurface` now uses the public `KnobRoot`, `KnobControl asChild`, `KnobRange`, `KnobMarker` and `useKnob` directly. Custom artwork, routing rules, menus and the private HUD remain product-owned. The old product pointer/keyboard implementation was removed. Other product controls can still use the extracted lower-level gesture/geometry code.
- A product-owned adapter exposes the existing modulation monitor as `LiveValue` in canonical parameter units. The public marker owns animation, smoothing and cleanup. Knobs, rail and HUD share one upstream telemetry subscription; no Cosimo protocol enters the kit.
- Two-axis mappings support independent drag sensitivity, preserving base versus modulation travel. Production modulated knobs adopt the documented kit keyboard defaults (1% continuous travel, 0.1% with Shift), replacing the former product-only 4%/1% increments. Stepped parameters remain stepped; ordinary parameter controls retain their canonical keyboard increment.
- Scoped defaults install in documents and plugin shadow roots. Exact entry, controlled values, numeric scales, keyboard behavior, continuous/two-axis gestures, context-menu composition and read-only live markers are included.
- All 11 Preview/Code examples are separate complete TSX files. The Code tab displays those exact files with imports/helpers and the copyable `examples.css`. Customers only adjust the public kit import path for their application.
- Demo telemetry is explicitly simulated. Local gesture history demonstrates callback grouping. These are visible application code, not hidden library behavior; actual plugin-state wiring is documented separately.
- `kit/docs/KNOBS.md` is linked from the shipped agent guide. Examples, demo scripts, dependencies and the customer lockfile ship in the export, including `ui:knobs:dev`, `ui:knobs:build` and `test:knobs`.

## Styling repair — 2026-09-21

The original integration missed drag-target and keyboard-focus presentation. `KnobControl` imposed a round CSS box on custom artwork, while the product painted both the surrounding tile and the nested input. Its broad `:focus-within` rule also combined two white outlines and cyan filters.

- `KnobControl` now owns interaction without input size, shape or focus decoration. `<Knob>` opts into `bk-knob-default-control`; composed default examples use the same documented class. Custom CSS does not need to undo a forced circular shape. `asChild` only controls the DOM composition.
- Rack and compact-filter tiles own drop hit testing and feedback. Their inner knobs retain the parameter identity for editing but no longer register duplicate drop targets. Standalone base/modulated controls remain their own targets.
- Keyboard focus paints one outline on a rack tile, with no filter over its artwork. Pointer selection keeps the existing effect-color treatment. The actual modulation range and live marker remain independent.
- The shipped custom example exercises a rectangular meter's selection, keyboard focus and source drop. The same test runs against its copied TSX/CSS in an isolated page.

Current verification:

- `npm run typecheck`, `npm run test:knobs` (20/20), `npm run ui:knobs:build`, and `npm run web:build`: passed.
- `node --test --test-name-pattern='rack knob tile owns|source preview and valid hover|a source drag dwell|T21: a drag' tests/test_desktop_patch_view_browser_rail.mjs`: 4/4.
- `node --test --test-name-pattern='ADR-025|T08A|production rack composition|rack Resonance' tests/test_desktop_patch_view_browser_fx_modulation.mjs`: 6/6, including mapping eligibility, capture, bypass/delete, colors and live telemetry.
- Real built WebAudio app checked at 390px and 600px: eligible/captured tiles, pointer selection and keyboard focus. Reviewed `build/knob-evidence/fixed-*.png`; assertions and capture script are in ignored `build/verify-knob-visual-fix.mjs`. Existing in-app web preview refreshed and visually checked.
- Three older `desktop chorus knob` cancellation/capture tests fail on legacy host-gesture assertions. All three reproduce unchanged in a clean archive of starting commit `89352b5c` with its own dependency install. They remain unresolved, separate from these visual repairs. Logs: `build/knob-style-baseline-tests.log` and `build/knob-production-focused.log`.

The original customer export below is historical; this pass verifies the updated kit through the copied-code tests, not a new customer install. No native launch/install or physical-device acceptance was performed.

## Prior qualification

- `npm run typecheck`: passed.
- `npm run test:knobs`: 19/19 browser cases. Includes real pointer/touch interaction, compound composition, current callbacks, cancellation, shadow-root styles, live-source replacement/unmount and per-axis sensitivity.
- The copied-example test reads all displayed TSX/CSS from the Code tabs, typechecks them, bundles only that copied application code plus public kit imports, and exercises it on an isolated page without the docs application. Checks include exact entry, shared custom artwork controls, styles and moving telemetry.
- Focused production rack/modulation browser cases: 10/10. Covers base/modulation drags, unavailable pointer capture, touch hold/menu cancellation, Resonance dial travel, and the production telemetry adapter driving the public marker. Three legacy host-scalar gesture assertions were replaced by actual shared Undo/Redo restoring the entire drag; the old assertions also failed on the unchanged baseline because these parameters now use document history.
- Production main-filter, rack-filter and lingering-HUD browser cases: 3/3.
- Live-value, source-monitor and axis-classifier unit tests: 23/23. Export contract tests: 8/8.
- `npm run ui:desktop:build` and `npm run ui:knobs:build`: passed. Current generated desktop bundle included.
- Exported committed source `c820b9db` to a fresh outside directory. Its own `npm ci` installed dependencies without a dependency-tree symlink. Customer typecheck, all 19 knob browser tests, all 3 live-driver tests and the production reference-page build passed.
- Desktop/phone viewport screenshots reviewed. Tailnet preview loaded over HTTPS. The standalone copied-code checks also verify behavior without docs-page dependencies.

Ignored evidence is under `build/knob-evidence/`; `customer-path.txt` points to the retained independent customer export. Preview host configuration stays in the ignored worktree-local launch wrapper.

## Remaining gates

The production telemetry browser test injects engine-format reports at the real connection boundary; it does not run the audio DSP or prove a native host. No standalone native launch, plug-in install, DAW/listening test or physical-phone acceptance was performed. Native launch/install can replace shared installed plug-ins and remains with the integration coordinator. No merge, push, release publication or email delivery occurred. MSEG composition/extraction and launch-copy work remain separate.

### Gesture-test closeout — September 24

The three old chorus tests asserted host scalar gesture messages, but rack edits now use shared document history. They also dispatched only the axis-classification move, without a committed value change. The replacement checks make multiple edits, terminate via cancellation, capture loss, or zero-button movement, and prove one Undo/Redo round trip plus an independently undoable subsequent key edit. Capture loss cancels according to the public kit contract already covered by the knob suite; it preserves accepted changes and ignores later pointer motion. All four focused chorus cases pass. No production changes were needed for this closeout.
