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

## Qualification

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
