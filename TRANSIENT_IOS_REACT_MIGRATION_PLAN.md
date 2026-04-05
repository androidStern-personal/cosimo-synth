# Transient iPhone React Migration Plan

Last updated: 2026-04-03

## Why This File Exists

This is the transient implementation plan for the next sprint task after the shared browser-side `resourceClient` work and the `DesktopPatchView.tsx` extraction.

The goal is to replace the old iPhone web UI with the new React and Vite frontend without losing the current iPhone-specific behavior that already works on device.

This file is transient because the durable roadmap still lives in `PLATFORM_UNIFICATION_AND_WARP_SPRINT_PLAN.md`. This file is only the concrete execution plan for the iPhone React migration itself.

## What The Current iPhone App Actually Does

The iPhone patch manifest in `WavetableSynth.iOS.cmajorpatch` still points at `patch_gui/index.ios.js`.

That path now contains the built React and Vite iPhone frontend, not a wrapper around `patch_gui/index.js`.

The iPhone host bootstrap in `patch_gui/index.ios-host.js` is still the existing repo-owned host and shared `resourceClient` contract. The remaining work after the migration is cleanup and validation, not a host rewrite.

The reusable React synth surface that should become the new iPhone frontend base now exists in:

- `ui/shared/synth-hooks.ts`
- `ui/shared/synth-components.tsx`

## What This Migration Is

This task is not a native-host rewrite.

This task is:

- build a real React iPhone entrypoint
- build iPhone-specific layout shells around the shared synth surface
- preserve the current iPhone resource-loading behavior
- preserve the current iPhone safe-area, keyboard, stage, and MSEG behavior
- switch the iPhone patch view to the new React bundle only after the replacement is proven

## What Needs To Happen

### 1. Freeze the current iPhone behavior with characterization tests first

Before changing the iPhone frontend, lock down the old behavior that already works.

Use `tests/test_wavetable_display.mjs` as the main characterization suite for:

- portrait-safe-area shell behavior
- landscape-safe-area shell behavior where relevant
- wavetable stage structure and gesture affordances
- overlay table picker behavior
- retry button placement and visibility
- play mode and glide controls
- MSEG launcher and modal behavior
- keyboard footer behavior
- octave controls
- resource loading, especially the known `BS2 - Acid.wav` path

The point is that the React migration should have to satisfy these tests instead of hand-wavy visual matching.

### 2. Extract the remaining mobile-only stage and layout behavior out of the old iPhone UI

The shared React synth surface is ready for a lot of the synth behavior, but the old iPhone shell contained mobile-specific stage and layout behavior that should not be forced into the desktop-shaped shared components.

That includes:

- the iPhone wavetable stage shell
- the overlay table picker placement
- retry button placement
- the `Swipe + Drag` stage hint
- the iPhone keyboard footer layout
- iPhone-safe-area treatment
- the iPhone MSEG modal shell behavior

Do one last extraction pass for these mobile-ready UI shells instead of copying the old monolith into React or forcing the desktop shell onto iPhone.

### 3. Build a real React iPhone entrypoint and harness before cutover

Add a real iPhone React entrypoint and a browser harness so the new shell can be developed and tested before it replaces the live app view.

Expected new files:

- `ui/ios/patch-view-entry.tsx`
- `ui/ios/IOSPatchView.tsx`
- `ui/ios/harness-main.tsx`
- `ui/ios/index.html`
- `ui/ios/styles.css`

The harness must mount the real iPhone React shell, not a simplified fake.

### 4. Add an iPhone Vite build target

Add a dedicated iPhone Vite config and update the UI build so the iPhone React frontend becomes a real generated artifact.

Expected new or changed files:

- `ios_auv3/vite.config.mjs`
- `ui/build.mjs`

The end state should be that the build writes the real iPhone React bundle to `patch_gui/index.ios.js`, because the patch manifest already points at that path.

### 5. Build iPhone-specific adapters instead of reusing the desktop adapters by force

Desktop already has desktop-only adapters for the Cmajor keyboard custom element and the Nexus glide number field.

The iPhone frontend should get its own thin adapter layer for the behavior that is specifically iPhone-shaped, especially:

- footer keyboard geometry
- root-note and note-count wiring
- octave controls
- compact footer layout

The iPhone shell should not inherit desktop Nexus usage if the current iPhone behavior is better served by native select or range controls.

### 6. Build explicit iPhone layout shells

The new iPhone React frontend should not reuse the desktop page layout wholesale.

Build explicit iPhone layout shells for:

- phone portrait
- phone landscape

Add a tablet shell only if the current behavior actually needs it.

These layout shells should compose:

- shared synth state from `ui/shared/synth-hooks.ts`
- shared synth components from `ui/shared/synth-components.tsx`
- iPhone-specific geometry and safe-area treatment from the new iPhone files

### 7. Preserve the existing iPhone host and resource behavior

Do not turn this into another host rewrite.

Keep the current iPhone host bootstrap in `patch_gui/index.ios-host.js` unless the React shell requires a truly necessary small change.

The new iPhone React frontend must preserve the current resource behavior:

- catalog JSON can use the bridge-backed path
- source WAVs must stay URL-first where available
- the audio bridge remains only a fallback when no URL exists

That rule is required to avoid reintroducing the `BS2 - Acid.wav` regression.

### 8. Add a browser safety net for the new iPhone React shell before cutover

Add a browser-mounted iPhone harness suite similar in spirit to the desktop browser safety net.

Expected new files:

- `tests/test_ios_patch_view_browser.mjs`
- `tests/helpers/ios_harness_browser.mjs`

This suite should cover:

- shell boot without a blank page
- portrait layout
- landscape layout
- safe-area behavior
- wavetable stage behavior
- table selection and retry
- MSEG open, edit, and close
- keyboard footer and octave controls
- resource-backed wavetable loading

### 9. Switch the actual iPhone app only after the new shell is proven

Once the new React iPhone shell and its tests are green, let `ui/build.mjs` emit the real `patch_gui/index.ios.js` bundle and keep `WavetableSynth.iOS.cmajorpatch` unchanged if possible.

The manifest already points at the correct path. The point is to replace the implementation at that path only after the replacement is proven.

### 10. Verify on the real acceptance targets, not only in browser tests

The final acceptance bar is not just local browser coverage.

Rebuild and verify:

- the iPhone simulator
- the real iPhone standalone app
- portrait mode
- landscape mode
- safe-area behavior
- wavetable stage behavior
- MSEG behavior
- keyboard behavior
- resource loading, including known tricky source WAV paths

The new React shell cleared that acceptance bar. The remaining cleanup is to remove the deleted legacy browser entrypoint and keep only the current shared-module coverage.

## Files I Expect To Add

- `ui/ios/patch-view-entry.tsx`
- `ui/ios/IOSPatchView.tsx`
- `ui/ios/harness-main.tsx`
- `ui/ios/index.html`
- `ui/ios/styles.css`
- `ui/ios/ios-keyboard-adapter.tsx`
- `ios_auv3/vite.config.mjs`
- `tests/test_ios_patch_view_browser.mjs`
- `tests/helpers/ios_harness_browser.mjs`

## Files I Expect To Change

- `ui/build.mjs`
- `patch_gui/index.ios.js`
- `tests/test_wavetable_display.mjs`
- `ui/shared/synth-components.tsx`
- possibly `ui/shared/synth-hooks.ts`
- possibly `patch_gui/index.ios-host.js`

## Hard Part

The hard part is not `resourceClient`. That foundation is already done.

The hard part in this migration was the iPhone-specific UI behavior that used to live inside `patch_gui/index.js`, especially:

- the stage shell
- the overlay picker
- the footer keyboard geometry
- MSEG modal orientation and shell behavior
- portrait and landscape layout differences
- safe-area behavior

So the right order is:

- lock down the old behavior with tests
- extract the remaining mobile-ready stage and layout shells
- then migrate the iPhone frontend to React

## Done When

This task is done only when:

- the iPhone app no longer depends on the old `patch_gui/index.js` UI path, and that old entrypoint is deleted
- the new iPhone React shell uses the shared synth hooks and shared synth components
- portrait and landscape both work in simulator and on the real phone
- safe areas are correct
- wavetable loading still works, including the known tricky source files
- MSEG and keyboard behavior still work
- the old frontend is no longer needed
