# Knob extraction handoff

Implemented on `codex/builder-kit-knob-318e`, based on integrated state-API commit `6febf1ea`. Implementation commit: `84ac64152684f1a823ce947e58f0fa8f772e61e7`. The integration coordinator owns integration and publication.

## Result

- Customer API: `Knob`, `KnobRoot`, `KnobControl`, `KnobDial`, `KnobLabel`, `KnobValue`, `KnobInput`, `KnobRange`, `KnobMarker`, `useKnob`, `LiveValue` and associated prop types through `kit/index.ts`.
- Shared drag controller/classifier and dial geometry extracted into `kit/ui`; existing product controls use that shared code. Product routing and the private HUD remain outside the kit. This does not rewrite every existing product wrapper around the new JSX parts.
- Scoped defaults install in ordinary documents and plugin shadow roots. Exact entry, controlled values, numeric scales, keyboard behavior, continuous/two-axis gestures, context-menu composition and read-only live markers are included.
- `kit/examples/knobs/` contains 11 interactive Preview/Code examples and an interface/keyboard reference. The live example explicitly simulates telemetry; it is not a native/audio-engine demo. Local gesture history demonstrates callback grouping; the page documents the actual plugin-state wiring separately.
- Guide is `kit/docs/KNOBS.md`, linked from the shipped agent guide. Demo scripts, Radix Slot/menu dependencies and the matching customer lockfile ship in the export.

## Qualification

- `npm run typecheck`: passed, including the demo examples.
- `npm run test:knobs`: 17/17 browser cases, including real mouse/touch input, menu long press, compound composition, current callback use, cancellation, shadow-root styling and live-source replacement/unmount.
- `node --test kit/tests/test_live_value.mjs tests/test_rolling_axis_classifier.mjs tests/test_mod_source_live.mjs`: 22/22.
- Existing main-filter and rack-filter HUD browser cases: 2/2 using the extracted gesture/geometry path.
- `node --test tests/test_kit_export.mjs`: 8/8.
- Exported committed source `84ac6415` into an outside customer directory, installed dependencies with its own `npm ci`, and passed customer typecheck, all 17 knob browser tests, all 3 live-driver tests and a production Vite build of the reference page. No dependency-tree symlink was used.
- Desktop and phone viewport screenshots reviewed. The tailnet page loaded over HTTPS with 11 examples and no page errors.

Ignored artifacts are under `build/knob-evidence/`; `customer-path.txt` points to the retained independent customer export. The local Portless launch wrapper and tailnet host allowance are ignored worktree-local configuration.

No merge, push, release publication, email delivery, installed-plugin/DAW test or physical-phone acceptance was performed. MSEG composition/extraction and launch-copy work remain separate work.
