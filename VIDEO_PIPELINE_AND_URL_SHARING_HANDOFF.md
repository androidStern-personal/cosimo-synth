# Handoff: Sound-Speedrun Video Pipeline + URL Patch Sharing

You are an autonomous coding agent working unsupervised in a GitHub Codespace
(Linux). Your job is to implement two features in Cosimo Synth's browser
product, end to end:

- **A. The sound-speedrun video pipeline** — take any Cosimo patch plus a MIDI
  performance and generate a downloadable MP4 entirely in the browser: patch
  analysis → ordered reconstruction recipe → cumulative partial-patch audio →
  animated phone-UI speedrun with batched captions → MP4 via Remotion's
  `@remotion/web-renderer`. No server-side rendering anywhere.
- **B. URL patch sharing** — share a Cosimo sound as a link with the patch
  state encoded in the URL itself. No server.

Nobody will answer questions mid-run. Product decisions are locked in §4,
known drift and traps in §5, forks with pivot rules in §6. When reality
contradicts this document, trust reality, log it, and follow §8.

---

## 1. Branch, baseline, and Milestone 0

- You are on branch **`codex/speedrun-video-share`**, forked from
  `codex/bounce-in-place` at `cb43d6a8` (the completed Bounce in Place work).
  Work here, push here. Never rebase or force-push this branch. Never push to
  `codex/bounce-in-place` or `claude/effects-lane-m1`.
- **Milestone 0 — land on the latest effects-lane base.** Merge commit
  **`90e9a28`** of `origin/claude/effects-lane-m1` into this branch, resolve
  conflicts, and get every existing suite green (including the bounce tests)
  before any feature work. A rebase of this branch onto `90e9a28` was
  attempted at handoff time and conflicts at bounce commit 8/17
  ("M5: persist and safely restore bounced banks") in
  `patch_gui/desktop/app.js` and `app.js.map` — **those are generated
  bundles: never hand-merge them; take either side, regenerate with
  `npm run ui:desktop:build` (and any other affected build outputs), and
  commit the regenerated files.** Watch `ui/shared/effects/synth-init-state.ts`
  and `tests/test_synth_init_state.mjs`: both sides touched the Init
  machinery; the auto-merge there must be reviewed by hand and covered by the
  passing tests, not trusted.
- **Effects-lane sync protocol.** Another agent is actively finishing the
  Effects Lane work on `claude/effects-lane-m1` (it had already advanced to
  `57d449d` at handoff time). At every milestone boundary, and at least once
  per working day: `git fetch origin claude/effects-lane-m1`; if there are
  new commits, **merge** the branch tip in, fix what breaks, re-green the
  suites, log the sync (SHA range, conflicts, what changed for you). Never
  rebase to take these updates.
- **Do not complete, fix, or extend Effects Lane work.** It is intentionally
  incomplete. Build against the contracts as they exist at your current merge
  point; treat them as "the expected result." Where a needed piece is
  unfinished or broken, degrade gracefully (skip, generic label, documented
  stub in your own code), write it in the log, and move on. Your diff must
  not wander into effects-lane files except where merges force resolution.

### Working agreements (identical to the bounce run)

Commit and push constantly — after every milestone and at least every couple
of hours. Everything you produce (analysis, probes, measurements, fixtures,
logs) is committed in-repo; the container is disposable. Keep a running,
dated `SPEEDRUN_LOG.md` at the repo root (do not write into `BOUNCE_LOG.md`).
Never delete failed-path work silently — revert with a message or park behind
a flag. Do not open a pull request; the human reviews the branch.

---

## 2. Reference material (read before coding)

Already committed on this branch under `docs/reference/`:

- **`SOUND_SPEEDRUN_PIPELINE_PLAN.md` — the architecture authority for
  feature A.** Its stage decomposition (A patch-io → B analyzer → C recipe →
  D timeline → E checkpoint audio → F Remotion composition → G studio page),
  data-flow, ownership rules, pacing/caption model, testing strategy, and
  Remotion facts stand. Read it fully. Its **amendments** are in §5 below —
  it was written at commit `bc0f363`, several important things have changed
  since.
- `BOUNCE_IN_PLACE_FEASIBILITY.md`, `AUDIO_ASSET_OWNERSHIP_FEASIBILITY.md`,
  `PROBE_bounce_math.mjs` — background; line references in them are stale
  (`bc0f363`), re-locate by symbol name.
- **`BOUNCE_M0_OFFLINE_SPEED.json` — measured on this Codespace**: the full
  patch renders offline at ≈2.7× realtime single-threaded (48 kHz, real
  generated engine). Use this, not guesses, to budget checkpoint rendering.
- Also on this branch from the bounce run: `docs/BOUNCE_CODESPACE_SETUP.md`
  (the Linux toolchain bring-up that already worked here — follow it) and
  `BOUNCE_LOG.md` (read for context on what was built and why).

---

## 3. What already exists that you MUST reuse (do not rebuild)

The bounce implementation built most of the plan's stage-E machinery. Reuse
it; extend it only where the video pipeline genuinely needs more:

- `bounce/offline-render-core.mjs` — drives a fresh offline engine instance
  (install → schedule → capture). The plan's "OfflineEngineHost" is this;
  do not write a second one.
- `bounce/worker-pool.mjs`, `bounce/offline-worker-handler.mjs`,
  `ui/worker/bounce-render-worker.ts` — the Web Worker render pool.
- `bounce/runtime-restorer.mjs`, `bounce/patch-document-adapter.mjs` — clone
  a patch document (parameters + stored state) into an offline engine. Your
  cumulative partial-patch states go through this.
- `bounce/capture-plan.mjs`, `bounce/capture.mjs` — note scheduling +
  PCM capture patterns; your MIDI-performance capture generalizes these.
- `bounce/digest.mjs`, `bounce/wav-decode.mjs`, `bounce/waveform.mjs`,
  `bounce/browser-bank-store.mjs` (OPFS) — hashing, WAV handling, waveform
  drawing, browser binary persistence.
- `web/build.mjs` was extended by the bounce run (check what engine
  artifacts it now emits — a worker-loadable engine bundle likely already
  exists).
- For URL sharing: `web/browser-patch-state.mjs` (the browser patch-state
  document), the preset-v2 normalization/migration machinery in
  `ui/shared/effects/`, and the dirty-guarded two-phase sound-replacement
  flow (`prepareInitSoundReplacement` / `requestSoundReplacement` pattern in
  `ui/shared/effects/standalone-effect-presets.ts`) are the load path — a
  shared link must go through the same confirm-then-replace flow, never a
  silent clobber.

If reusing a module requires refactoring it (e.g., extracting a function),
prefer small extractions over copies; keep the bounce tests green.

---

## 4. Locked product decisions

### Feature B — URL sharing

1. **What a link carries:** the complete non-bounced sound — all public
   parameters plus the modulation, rack/lane, and articulation documents —
   as a versioned envelope, compressed (native `CompressionStream`,
   deflate) and base64url-encoded, in the **URL fragment**:
   `…/#p=1.<payload>`. Fragments never reach servers or logs. The `1` is
   the share-format version; include the sound-schema/contract identity
   inside the payload so the existing preset migration machinery can run on
   open.
2. **Opening a link:** the app boots normally, detects the fragment, shows a
   clear "Load shared sound?" step through the existing dirty-guard
   confirm-then-replace flow (offer save/discard when the current sound is
   dirty). Never silently replace the user's sound. After loading, strip
   the fragment from the address bar.
3. **Bounced (sampled-mode) patches are refused** with a clear message
   ("Bounced sounds can't be shared by link yet") — the audio bank is
   15–35 MB and cannot ride a URL. Leave a documented seam for future
   digest-based sharing. Do not ship a half-working share that loads a
   silent patch.
4. **Size rules:** typical patches compress to ~1–2 KB. If the final URL
   exceeds 2,000 characters, warn but allow copy; above 8,000, refuse with
   a clear message.
5. **UI:** a Share action in the preset bar's overflow menu (desktop and
   phone layouts) that copies the link and shows it; the video studio page
   (feature A) also offers "Copy share link" for the patch it rendered.
6. Round-trip fidelity is absolute: decode(encode(patch)) must equal the
   patch (property-tested), and migrations must run on version-skewed
   payloads exactly as preset loads do.

### Feature A — video pipeline (amendments to the plan; plan governs the rest)

7. **V1 scope: oscillator-mode patches.** A sampled-mode (bounced) patch is
   refused with a clear message ("Speedrun videos for bounced sounds come
   later") — its reconstruction cannot be demonstrated as knob operations.
8. **Reuse mandate:** checkpoint audio rendering goes through the bounce
   worker pool + offline core (§3). Budget with the measured ≈2.7×
   realtime figure; parallelize checkpoints across workers as the plan
   describes.
9. **Rack/effects sections of the analyzer, recipe, captions, and UI
   replica must be derived from the CURRENT contracts on your merged
   base**, not from the plan's snapshot (see §5 drift). If the lane/device
   model is mid-flight at your merge point, pin to what is green and note
   the residue in the log.
10. Remotion: pin `remotion`, `@remotion/media`, `@remotion/web-renderer`
    at one exact version ≥ 4.0.491. MP4 (H.264/AAC) on Chromium is the
    acceptance target; WebM is a fallback path, not a gate. Record in
    `docs/` that Remotion's company-license question must be resolved by a
    human before public shipping.
11. MIDI input per the plan: a small vendored SMF parser + a JSON note-list
    alternative + one bundled default demo performance.
12. The composition is the plan's frame-pure replica (Track 1). Do not
    attempt to mount the real patch view inside Remotion first (§6 F1).
13. End of video: a simple end-card (patch name, "Made with Cosimo"). The
    share link is offered next to the MP4 download in the studio UI, not
    baked into the video pixels.

---

## 5. Drift warnings — where the plan and older docs are stale

1. **The modulation target domain was reworked on effects-lane** ("dynamic
   target domain", "one target-kind grammar for every device",
   `be5309e..367922d` and beyond). The plan's stage-B/C references to the
   frozen 13-source/51-voice-target/36-rack-target domain, `modulation.v6`
   route shapes, and `rack-parameter-descriptors.ts` as the effects catalog
   may all have moved. Re-derive the analyzer/recipe vocabulary from the
   code at your merge point before writing stage B.
2. **The rack model is becoming `lane.v2`** (effects-lane commits: "lane.v2
   is the document", "the rack column becomes the line"). Wherever the plan
   says `rack.v1` / `rackOrder` / `rackEnable`, verify what the document and
   runtime events actually are now, and what "displayed order" means in the
   lane world. The video's effects sections follow the *current* display
   model.
3. **Bounce exists.** Patch documents can carry sampled-mode state
   (`bounce.v1`-style documents, OPFS banks). Stage A intake must recognize
   it (to refuse per §4.7 and §4.3), and the URL-share encoder must detect
   it. The synth also now has a real amplitude release parameter (added in
   the bounce run) — your defaults/diff tables must be regenerated from the
   live engine contract, not copied from the plan.
4. The plan's §7.3 speed estimate ("3–10× realtime") is superseded by the
   measured 2.7× in `BOUNCE_M0_OFFLINE_SPEED.json`. Also verified in the
   bounce run: offline installs are advance-pumped memcpys, fresh session id
   per engine instance, `advance()` ≤ 128 frames on product bundles.
5. Every `file:line` in the reference docs is from `bc0f363`. Symbols over
   line numbers, always re-verify.

---

## 6. Forks with pivot rules

- **F1 — video UI layer.** PRIMARY: the plan's purpose-built frame-pure
  phone-UI replica reusing real leaf components/tokens. FALLBACK (only
  after the replica demonstrably cannot be made faithful AND a spike shows
  the real view captures acceptably under the web renderer): mounting the
  real patch view. Do not start with the fallback.
- **F2 — audio into the composition.** PRIMARY: one pre-spliced master WAV
  as a blob URL in a single `<Audio>`. FALLBACK: per-section audio
  sequences; LAST RESORT: data-URLs. Pivot on demonstrated web-renderer
  failure with blob URLs, not speculation.
- **F3 — encoder.** PRIMARY: MP4/H.264/AAC on Chromium. FALLBACK: WebM
  VP9/Opus (and the Firefox path). Feature-detect; never silently produce
  the wrong container.
- **F4 — worker infrastructure.** PRIMARY: reuse the bounce pool as-is.
  PIVOT (one timebox of failed adaptation): a thin dedicated pool that
  still reuses `offline-render-core`.
- **F5 — URL compression.** PRIMARY: native
  `CompressionStream`/`DecompressionStream`. FALLBACK: a small vendored
  deflate implementation if a supported browser lacks it.
- **Timebox:** ~6 focused hours per blocker, then execute the fallback and
  log it. Don't pivot the same fork twice without new evidence.

## 7. Milestones and acceptance criteria

Each milestone ends with suites green, docs updated, log entry, push.
"A/B within tolerance" and test idioms follow the plan's §11.

- **M0 — merged baseline green** (§1): `90e9a28` merged, conflicts
  resolved, generated bundles regenerated, bounce + existing suites pass on
  Linux; log records the conflict inventory.
- **M1 — URL sharing shipped first** (small, independent, high value):
  encode/decode module with property-based round-trip tests (random valid
  patches, version skew, corrupt payloads rejected cleanly); share UI in
  both layouts; open-link flow with dirty guard; bounced-patch refusal;
  length rules; Playwright end-to-end: configure sound → share → fresh
  browser context → open link → document equality with the source patch.
- **M2 — renderer spike:** a 10-second throwaway composition (SVG + canvas
  + text + a blob-URL WAV) renders to an MP4 blob in headless Chromium via
  `renderMediaOnWeb`; parse it (duration, one H.264 video + one AAC audio
  track), decode a window and assert non-silence. This validates F2/F3
  before real work. Commit the spike under `experiments/`.
- **M3 — pure pipeline core:** stages A–D from the plan (patch intake,
  analyzer, recipe, timeline) against the CURRENT contracts; fast-check
  round-trip invariant (recipe applied to defaults reproduces the audible
  patch); fixtures must include an effects-lane device configuration as it
  exists on your base; golden recipe snapshots.
- **M4 — checkpoint audio:** cumulative partial states → bounce
  worker-pool renders → master WAV splice with crossfades; determinism
  (identical input → identical PCM digest); differential audibility tests
  (adding a section changes the audio in the expected direction); measured
  wall-time logged against the 2.7× budget.
- **M5 — composition:** phone-UI replica + caption waterfall + gesture/
  finger overlay + master audio; frame-purity test (same frame twice →
  identical pixels); section-boundary screenshots as goldens; A/V
  alignment fixture (a click-track patch whose audio onsets must land
  within ±1 frame of their caption events).
- **M6 — studio page end to end:** patch picker (current sound / file /
  share-link paste), MIDI upload + default performance, progress + cancel,
  MP4 download, share-link copy; Playwright E2E: fixture patch + MIDI →
  MP4 blob verified (duration ≈ timeline, tracks, non-silent windows at
  section boundaries); a second E2E driving a patch that uses an
  effects-lane device.
- **M7 — hardening:** duration ceiling + compression behavior on a
  maximal patch; memory teardown (pool + object URLs) across 5 consecutive
  renders bounded; WebM fallback exercised once; all gates re-run; final
  log summary (what shipped, numbers, residue, next human action).

## 8. Gates, stuck protocol, deliverable

**Gates (measure relatively on Codespace hardware):** all pre-existing
suites green at every push; M1 round-trip property tests 100%; M4
determinism exact; E2E MP4 checks as above; pipeline wall time for the
default fixture reported (investigate if a ~40 s video projects past ~10
minutes end to end); no gate on encoded video byte-identity (encoders are
nondeterministic).

**Stuck:** hard-blocked → `BLOCKED.md` with exact state and repro, push,
continue on non-dependent milestones. **Descope ladder (in order):** M7
extras → finger-overlay polish → caption richness → WebM path. **Never
descope:** M0, M1, M3, M4, M6, tests, or the sync protocol.

**Deliverable:** this branch, pushed, with: URL sharing live in the browser
app; the speedrun studio producing verified MP4s end to end on Chromium;
`SPEEDRUN_LOG.md`; updated setup docs; all suites green on your final
merged effects-lane base.
