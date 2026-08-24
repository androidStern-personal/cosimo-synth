# Sound-Speedrun Video + URL Sharing Log

## 2026-08-24 — M0: merged baseline green

### Effects Lane synchronization

- Started from `codex/speedrun-video-share` at `6ce638a6`.
- Merged the required `origin/claude/effects-lane-m1` commit `90e9a288`
  without rebasing. The resulting merge is `41763372`.
- Re-fetched at the M0 boundary and merged the then-current Effects Lane tip,
  range `90e9a288..fe1e9e7d`, in merge `7aa7ec0f`. Regenerated shared modules
  are committed as `8564ed46`.
- No Effects Lane feature work was completed, fixed, or extended on this
  branch. One stale lane-v1 browser-test assertion was updated to observe the
  merged lane-v2 contract (`rack.v2.chain[0].deviceId`); product lane code was
  left to its owning branch.

### Conflict inventory and generated output

- The required merge conflicted only in generated outputs:
  `patch_gui/desktop/app.js`, `patch_gui/desktop/app.js.map`,
  `patch_gui/index.ios.js`, `patch_gui/index.ios.js.map`, and
  `patch_gui/wavetable-worker.js`. The later tip sync conflicted in the
  generated desktop bundle and source map.
- Generated conflicts were not hand-merged. A temporary side was selected,
  then the desktop, iPhone, production-worker, Bounce-worker, and test-worker
  outputs were regenerated from the merged sources.
- The automatic merge in `ui/shared/effects/synth-init-state.ts` and
  `tests/test_synth_init_state.mjs` was reviewed. It retains the Bounce
  adapter while making `lane.v2` the canonical rack state and upgrading
  `lane.v1` input at the boundary.

### Merge residue repaired

- The intended lane-v2 worker payload measured 157,762 raw bytes / 38,295
  gzip bytes. The frozen bundle ceiling was raised only to 160,000 / 38,800,
  leaving about 1.5% headroom around the measured merged payload.
- The desktop preset assertion was updated for the merged Bounce adapter: a
  fresh preset contains the `bounce.v1` slot with a null value.
- The Bounce resident-bank G2 check was flaky because it compared a cold
  1280px baseline with a post-phone-layout 393px sample using an integer-ms
  AudioWorklet clock. The product threshold remains 10%. The test now warms
  both sides, restores the same viewport, and applies the same test-only 2x
  DSP multiplier to lift real work above timer quantization. Five consecutive
  focused passes stayed about 4–7% above baseline with zero deadline misses;
  the combined Bounce UI/waveform suite passed 3/3.
- `test:web:poc` previously launched Chromium and WebKit in parallel but a
  bare shell `wait` could report only the final job status and hide the other
  browser's failure. It now captures and checks both process statuses. The
  corrected authoritative command passes in both engines.

### Green baseline evidence

- State and JavaScript suites: orphan units 708/708; effect presets 113/113;
  Bounce fast-path suites 31/31; Bounce persistence 12/12; Web bundle 17/17;
  desktop UI 218/218; iPhone UI 20/20; browser orphans 117 pass plus one
  expected native-keyboard skip; lane/init/modulation focused gates 96/96.
- Generated browser product: Chromium and WebKit each pass 16 with two
  expected skips; modulation routing passes 34/34.
- Native/runtime: all four `test:bounce:native` stages pass; Cmajor rack
  73/73; native QuickJS passes its seven pytest cases plus content,
  Promise-job, and worker-restore checks; synth engine renderer/provider/
  hard-cut gates pass; warp-alias 3/3 and filter-stability 18/18.
- Adjacent production views: OTT 19/19 and SeqFX 7/7.
- `npm run ios:ui:build` plus desktop, production-worker, Bounce-worker, and
  test-worker generation complete successfully and reproducibly.
- A direct `npx tsc --noEmit` probe is not a repository gate and remains red
  on pre-existing Bounce `.mjs` declaration gaps and an existing cast in
  `use-bounce`. There is no `typecheck` package script. The owned generation
  paths and all repository suites above are green; this unrelated type-probe
  residue is not expanded under M0.

### M0 decisions

- Merge the active Effects Lane tip instead of repairing its exact-baseline
  behavior locally, preserving ownership and the required merge-only sync.
- Keep the Bounce 10% product gate unchanged and repair only its measurement
  comparability.
- Treat runner exit-status propagation as part of the acceptance gate so a
  future single-engine regression cannot be reported green.

Next: re-check the Effects Lane tip at the M1 boundary, then ship URL patch
sharing before beginning the video renderer spike.

## 2026-08-24 — M1 boundary Effects Lane sync

- Fetched the owner branch and merged `fe1e9e7d..412a2a87` without rebasing.
  The incoming T6b slice makes selection, parameter bindings, map actions,
  and modulation base controls address lane device instances.
- Generated conflicts: `patch_gui/desktop/app.js` and map,
  `patch_gui/index.ios.js.map`, and `patch_gui/wavetable-worker.js`. They were
  replaced by fresh desktop, iPhone, production-worker, Bounce-worker, and
  test-worker generation from the resolved sources.
- Source conflict: `ui/desktop/mobile-mod-mappings-panel.tsx`. The resolution
  preserves Bounce's oscillator-route inertness while threading T6b's parsed
  lane `deviceId` into each instance binding. No Effects Lane behavior was
  added beyond retaining both owners' already-implemented paths.
- Merge residue: an older browser assertion still required pool instances to
  be amount-only. It now observes T6b's current contract (each parsed instance
  exposes the type's base rail) and uses DOM text rather than layout-dependent
  `innerText` so content-visibility cannot erase the label under sharding.
- Green sync gates: focused lane/init units 40/40; subway + Bounce browser
  gates 11/11; full desktop browser suite 221/221; modulation runtime 34/34;
  generated Chromium and WebKit suites each 16 pass with two expected skips.

URL-sharing implementation begins from Effects Lane tip `412a2a87`.

## 2026-08-24 — M1 URL sharing and boundary status

- Shipped strict `cosimo.soundShare` v1 envelopes at
  `#p=1.<deflate-base64url>`, using native browser compression with bounded
  decode, corruption/version rejection, 2,000-character warning, and
  8,000-character refusal.
- Share capture uses the current preset-v2 contract plus the canonical lane
  document, refuses sampled/Bounced sounds, and loads through the existing
  sound transaction. A successful shared load becomes an unnamed clean
  baseline whose Revert target is the shared sound; the fragment is removed
  only after acceptance.
- Desktop and compact layouts expose Share. Opening a link requires the
  explicit `Load shared sound?` confirmation and then uses the existing
  Save/Discard/Cancel dirty guard when necessary.
- Fast-check round trips, strict-boundary tests, controller tests, and the real
  fresh-browser-context link flow pass 28/28. The full desktop suite passes
  222/222; browser orphans pass 117 with one expected native probe skip;
  iPhone UI passes 20/20; shared hooks pass 34/34; effect presets pass 113/113;
  and orphan units pass 708/708.
- The broad browser run exposed one dialog regression: pending Init state was
  temporarily rendered with generic Load copy. Commit `3ee6de12` preserves the
  Init-specific guard while still naming confirmed preset/share operations.

### Effects Lane boundary synchronization and blocker

- Merged `412a2a87..5733b556` in `116e4c42`, regenerated every generated
  desktop/iPhone/worker conflict, and preserved the incoming T6/T7 instance
  contract without adding owner-branch behavior. One source-test conflict kept
  both the incoming instance behavior and the existing layout-independent text
  assertion.
- Re-fetched at the boundary and merged the T7 close-out
  `5733b556..0a0eba9c` in `190bc903`; it changed only the owner plan document.
- The existing Bounce G2 relative-load gate is now reproducibly red after the
  T7 three-device starter became the fresh default: three isolated measurements
  put a resident bank about 22–31% above the fresh oscillator baseline versus
  the frozen 10% limit, with zero misses. Bounce/Revert behavior and the ten-
  cycle retirement gate remain green. `BLOCKED.md` contains exact reproduction
  and measurements.
- Decision: do not alter the Effects Lane default and do not weaken/mask the
  Bounce threshold. Under the handoff's stuck protocol, continue the
  non-dependent renderer spike while this boundary incompatibility remains
  explicit.

## 2026-08-24 — M2 browser renderer spike

- Pinned `remotion`, `@remotion/media`, and `@remotion/web-renderer` to exact
  version 4.0.491 and Mediabunny to the renderer-matched 1.50.8.
- Added the committed throwaway experiment at
  `experiments/remotion-web-renderer-spike/`: 10 seconds / 300 frames / 30 fps /
  640x360, with a moving SVG knob, frame-driven canvas wavetable, changing text,
  and one deterministic stereo PCM16 WAV passed as a blob URL to one `<Audio>`.
- The gate calls `renderMediaOnWeb` inside headless Chromium, then independently
  demuxes the returned Blob. A qualifying run produced a 372,884-byte MP4 in
  2,142 ms with duration 10.0693 seconds, exactly one AVC/H.264 video track and
  one AAC audio track. The decoded five-second pulse had RMS 0.18532 across
  15,360 frames; decoded video had minimum luma variance 487.95 and mean frame
  difference 5.00.
- The first run successfully reached MP4 verification but the verifier omitted
  Mediabunny's required `fit` option when requesting both decoded-frame
  dimensions. `fit: "fill"` repaired the verifier; neither blob-URL audio nor
  MP4 encoding needed a fallback.
- Decision: F2 stays one pre-spliced blob-URL WAV and F3 stays
  MP4/H.264/AAC on Chromium. Encoded byte identity is logged, not gated.
- Added `docs/SPEEDRUN_VIDEO_BROWSER_RENDERING.md`: a human must resolve
  Remotion licensing and production telemetry/key posture before public ship.
