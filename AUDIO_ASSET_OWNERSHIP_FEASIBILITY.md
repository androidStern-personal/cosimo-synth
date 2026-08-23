# Feasibility Study: Renderer-Owned AudioAssetStore for Cosimo

Independent adversarial review. All file references are repo-relative at
commit `bc0f363` (the analysis was performed in a detached worktree at that
HEAD; the probe script is committed alongside this document).

Evidence classes:
- **[V]** verified fact — read directly from source/config at HEAD
- **[M]** measured evidence — numbers recorded in-repo from real runs, or
  reproduced by `PROBE_asset_math.mjs` at the repo root
- **[I]** source-backed inference
- **[U]** unresolved uncertainty

---

## 1. Verdict

The hypothesis is **confirmed in every premise** — and premise 5 is stronger
than stated: the renderer today owns *no state at all*, not merely no assets.
The proposal is **technically viable; no fatal blocker exists**. But as
written it is mistimed and under-specified:

1. Its stated future payoff ("internally bounced multisample banks") has
   **zero recorded product commitment** — the words never appear in any plan,
   ADR, PROGRESS or TODOS entry [V].
2. The measurable pain it would relieve (upload seconds; 50 MiB frozen state)
   has an **approved-deferred cheaper tier** already recorded in TODOS
   (per-mip wire shrink "without any engine storage change" + boot dedup)
   [V], and a strong latent motivator the proposal never mentions: a DAW
   sample-rate change rebuilds the performer and forces a **full ~3.3 s
   re-FFT + re-upload of all three tables** [V][M].
3. Its silent costs are real: first-ever renderer-owned lifetime under an
   external-function ABI with **no per-instance identity and no teardown
   hook** [V]; a browser memory-layout + safety-canary rework (renderer wasm
   has **no allocator**, a 2 MiB reservation, and a build-time-scraped
   `--global-base`) [V]; a restore-fence design that leans on FIFO ordering
   [V]; and a per-sample render path that **already fails its own frozen CPU
   budget**, leaving no headroom for a slower asset read [M].

**Recommendation:** ship the Tier-1 transport fixes now (§5); treat the store
as the right architecture **when** an asset roadmap (multisample, user
library growth, multi-instance memory pressure) is actually committed — and
build it in the refined form of §6 (store + handles + *derived-asset cache*,
acquire/release externals, publish-through-FIFO, instance keys inside
`packedInts`), which is smaller and safer than the proposal as written. The
record itself points this way: ADR-022 allows adapters to translate "memory
ownership", and SERUM_WAVETABLE_BUNDLING_PLAN.md:369-375 names a
*transport/asset-format* change (mip sidecar files) as the sanctioned escape
hatch.

---

## 2. Current architecture — reconstructed, premise by premise

| Hypothesis premise | Verdict | Key evidence |
|---|---|---|
| Cmajor owns the preallocated pool | **Verified [V][M]** | 16 × `int32[819904]` (4 slots × 4 chunks) as processor state — cmajor/FixedFrameOscillator.cmajor:1497-1512; 50.0 MiB (probe reproduces `12811`, `819904`); measured performer state 54,559,424 B ⇒ pool ≈ 96 % of it (experiments/effects_lane_capacity/REPORT.md:132) |
| Data arrives via event/FIFO upload | **Verified [V][M]** | `wavetableLoadBegin` + per-mip `float32[6144]` 24 KiB batches; audio-thread finiteness scan (:1738), 18/14-bit pack (:1685), scatter (:1698); 64 KiB native FIFO, exactly ONE batch in flight is reliable (:4-10; bisect in TODOS.txt:694) |
| Borrowed slices passed per render call | **Verified, stronger [V]** | called **once per sample** with 18 `(ptr,len)` slices, inside the per-sample `loop` (:4845-4858, `advance()` :4917); slice views rebuilt every call (native/three_oscillator_renderer/RendererBridge.cpp:19-34); failure ⇒ silence (:4866-4872) |
| Native (desktop/iPhone) + Wasm (browser) builds | **Verified [V]** | desktop: JIT + provider returning a raw fn ptr (tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp:723-724; RendererExternalFunctionProvider.h:44-54); iOS: AOT C++ via tools/cmajor_external_codegen, external bound by **textual macro substitution** (ios_auv3/Source/cmaj_StaticLibraryShim.cpp:15-18); browser: wasm32-wasip1, `--import-memory`, `--global-base` scraped from the Cmajor module's page count, 1 MiB stack, no allocator (scripts/build_three_oscillator_renderer_wasm.sh:36-52; scripts/generate_cmajor_javascript_with_renderer.mjs:48-55; web/canonical-renderer-wasm.mjs:22-46) |
| Renderer holds no persistent assets | **Verified and stronger [V]** | renderer owns *nothing*: phases/history/atlas all live in Cmajor arrays `rendererFloats`/`rendererInts` (:1485-1486; offset twin RendererBridge.h:15-65); zero statics/allocations; slot **handles already cross the ABI** (`rendererOscillatorSlotOffset` :225, written by `commitPackedStagingTable` :3353-3366) |

Already-existing pieces the proposal re-invents [V]:
- **Off-thread preparation**: mip pyramids are FFT-built in the patch worker
  (ui/worker/wavetable-worker.ts; ui/shared/wavetable-mip.ts).
- **Atomic publish**: one spare staging slot; "Active slots are immutable
  while visible… publish only after every mip/frame has arrived"
  (:1487-1488); all-mips completeness check then a **single int32 write** on
  the audio thread — the cheapest possible handoff.

What is genuinely *not* off-thread: the byte transfer + pack — every byte
crosses the audio thread as FIFO events with a 6,144-float scan and up to
6,147 pack+scatter ops per 24 KiB batch [M].

### Why it is shaped this way (decision archaeology) [V]

- The current design **is itself a reviewed decision, twice**:
  full-proposal.md:434-437 ("the mutable wavetable store should move into a
  single stateful processor that owns active/staging buffers… `external`
  data should not be treated as a runtime-write path") and
  SERUM_WAVETABLE_BUNDLING_PLAN.md:41-76 (worker as the single
  patch-lifetime loading owner).
- The 16-chunk ABI exists because **"Cmajor rejects the original
  13,118,464-element external array"** (PROGRESS.txt:481) — an empirical
  compiler limit, not taste.
- The 24 KiB / 1-in-flight window is a measured FIFO ceiling; batching alone
  took boot 9.0 s → 3.3 s and switch 455 ms → 203 ms (TODOS.txt:686-694).
- "Do not move wavetable rendering into native C++" was once locked
  (TRANSIENT_PATH1_POLYPHONY_IMPLEMENTATION_PLAN.md:33); ADR-022 superseded
  it for *rendering* and explicitly permits adapters to translate "calling
  conventions **and memory ownership**" (docs/ADR-022:28-30) while making
  "the packed A/B/C pool… the only table representation" (:75).
- **No prior evaluation of a renderer-owned store exists anywhere in the
  record** [V].

### Calibrated numbers [M]

| Quantity | Value | Source |
|---|---|---|
| Pool | 50.0 MiB/instance, content-independent | probe; PROGRESS.txt:482 (52,473,856 B) |
| Whole performer state | 54,559,424 B (pool ≈ 96 %) | effects_lane_capacity/REPORT.md:132 |
| Browser instance memory | 917 pages = 60,096,512 B declared | REPORT.md:132,147 |
| iPhone 14 Pro footprint | 71.5 MiB peak physical (synth) vs 19.1 MiB effect-only zero-pool baseline; frozen budget 128/160 MiB incremental | REPORT.md:330-359 |
| CPU | current patch **already fails** its frozen mean ≤ .30 / p95 ≤ .40 load budgets in every trial | REPORT.md:352-354 |
| Worker-side cache | up to 48 MiB LRU per instance (`defaultCacheBudgetBytes`) | ui/worker/wavetable-worker.ts:59 |
| Median factory table (238 tables; median frameCount 16) | 0.78 MiB packed; mean 3.22 MiB; max 12.51 MiB | probe over assets/factory-bank-catalog.json |
| Typical patch, dynamically sized | ≈ 3.1 MiB (vs 50 MiB static) — ~94 % waste today | probe |
| Full 256-frame table upload | 946 batches ≈ 22.2 MiB payload ≈ 2.9 s (calibrated ~3 ms/batch against T22) | probe + TODOS.txt:686 |
| DAW sample-rate change | performer rebuild → new `processor.session` → **all three lanes re-FFT + re-upload (~3.3 s boot-equivalent)** | cmaj_PatchLoaderPlugin.cpp:696-697; CosimoCmajorPlugin.h:2404-2412; wavetable-worker.ts:1216-1251 |
| 200 MiB bank via this protocol | 8,534 batches, ~0.4–1.4+ min, all bytes across the RT thread | probe — architecturally unusable |

---

## 3. Adversarial findings against the proposal

1. **Unfunded motivation.** "multisample" / "sample bank": zero hits across
   every plan/ADR/notes file [V]. The one adjacent intention is a passing
   "imported wavetable/assets library" mention (TODOS.txt:240).
2. **Handles don't fix uploads.** The pain is the byte path, not the render
   call. The proposal's actual engineering center of gravity — store-side
   ingest, reclamation, instance identity, cache persistence — is exactly
   the part it describes in one sentence.
3. **First renderer-owned lifetime, context-free ABI.** Upstream
   `ExternalFunctionProviderFn` resolves to a bare pointer at engine load —
   no performer identity, no teardown hook, "expert level… only available on
   some back-ends" (https://cmajor.dev/docs/LanguageReference,
   https://cmajor.dev/docs/Tools/C++API) [V]. Desktop registers the *same*
   pointer for every instance (cmaj_PatchLoaderPlugin.cpp:723-724); iOS
   binds it *textually at compile time* (cmaj_StaticLibraryShim.cpp:15-18);
   the 18-arg shape is checked in three places (provider :13, codegen
   main.cpp:86-88, run_three_oscillator_generated_integration.sh:31-40 —
   which asserts **exactly 16** chunk arrays in generated C++). Every one of
   those seams moves in a cutover [V].
4. **Browser layout + safety proof rework.** `--global-base` is a build-time
   constant regex-scraped from the Cmajor module's page count; the only
   reserve is `memory.grow(32)` = 2 MiB; there is no allocator and a 1 MiB
   stack; `tests/native/inspect_renderer_shared_memory.mjs:28-47` proves
   byte-exactly that the renderer never touches memory below its base. A
   store invalidates all of it; shrinking Cmajor state moves the base and
   forces paired regeneration [V].
5. **Restore fence entanglement.** Readiness metadata
   (`packedReadyFrameFlags`, `packedLoadedFrameCounts`) is Cmajor state
   (:1513-1514); ADR-021's restore fence proof leans on FIFO ordering
   (docs/ADR-021:688-725; docs/THREE_OSCILLATOR_HARD_CUT_ROADMAP.md:810-813
   — readiness requires all three table identities on one DSP session).
   Bytes outside the FIFO lose that ordering for free [V→I].
6. **No CPU headroom for indirection.** The per-sample path already exceeds
   its frozen budgets (REPORT.md:352-354) [M]; any store resolution must be
   provably ≤ the current 16-slice view rebuild. (Realistically it can be —
   one O(1) partition lookup per *call*, and dropping the per-lane chunk
   div/mod (WarpRenderer.cpp:1101-1111) may net out faster — but this must
   be gated, not assumed.)
7. **No instrument can currently prove the win.** Browser perf marks only
   modulation endpoints (web/audio-worklet-instrumentation.mjs:55); the iOS
   benchmark path is modulation-only; `wavetableMipFrame` has **no deadline
   instrumentation anywhere** [V]. First deliverable of any asset work must
   be measurement, or claims are unfalsifiable.
8. **What is silently given up**: Cmajor bounds-checked writes on the upload
   path; the pure-function renderer property that makes multi-instance
   trivially safe today (only process-global state on desktop is a
   `call_once` dylib load, cmaj_PatchLoaderPlugin.cpp:28-47) [V]; the
   existing QuickJS restore probe and shared-memory canary as-is.

## 4. The honest case for change (what is genuinely wrong today)

1. **RT-thread byte traffic** — ~22 MiB of events + ~1M pack ops per full
   table across the audio thread; glitch-free by design but seconds of
   trickle and permanent protocol complexity (generations, urgency tiers,
   acks, engine-wide single staging cursor that lets a new load preempt a
   pending one, :4460-4480) [V][M].
2. **content-independent 50 MiB × every instance** — ≈ 94 % waste for the
   median patch; N DAW instances ⇒ N × (50 MiB pool + ≤ 48 MiB worker
   cache) with zero sharing; AUv3 instances share one out-of-process
   extension budget (historically ~360 MB — old Core Audio statement,
   https://forums.developer.apple.com/thread/47396 [U]) and there is **no
   automated multi-instance coverage today** (harness holds one unit,
   CosimoAUv3HostHarness.mm:163) [V][M].
3. **Sample-rate change = full reload** — `setPlaybackParams` → performer
   rebuild → new session → re-FFT + re-upload everything (~seconds), plus
   the surprise trigger `setAutoRebuildOnFileChange(true)` shipping in
   desktop release builds (cmaj_PatchLoaderPlugin.cpp:721) [V].
4. **Compile-frozen capacity** — 256 frames × 4 slots; growth = regenerate
   everything, pay everywhere [V].
5. **Boot uploads three identical default tables** (TODOS.txt:689) [V].

## 5. Alternatives

| Option | Assessment |
|---|---|
| **Tier 1 (do now, ~1 wk):** per-mip wire shrink — engine already stores downsampled mips, "only the WIRE is full-size… without any engine storage change" (TODOS.txt:697); boot dedup of identical tables (:689); optionally ship *packed ints* in events to delete the RT-thread scan+pack | ~2× less wire, ~3× fewer boot uploads, RT work → memcpy. No ownership change, no invariant broken. Approved-deferred already |
| Bigger Cmajor pool / multisample-in-state | Rejected — 64 KiB FIFO + state economics [M] |
| Host/adapter-owned store per platform | Rejected — same registry problem, three owners, violates the single-owner goal |
| Cmajor `external`/patch resources | Rejected — load-time constants, no runtime swap (https://cmajor.dev/docs/PatchFormat; was v1's design, already abandoned for cause — full-proposal.md:437) |
| **Tier 2: refined renderer-owned store (§6)** | Viable; adopt when an asset roadmap is committed |

## 6. Recommended architecture (Tier 2, refined)

Smallest coherent shape — four deltas from the proposal as written:

1. **AssetStore in `native/three_oscillator_renderer/`** (one implementation;
   adapters differ only in allocation/ingest — ADR-022-compliant):
   - Immutable published assets `{assetId, generation, frameCount,
     contiguous packed mip pyramid}`, content-digest keyed ⇒ boot's three
     identical tables collapse to one asset; co-hosted AUv3 instances can
     share factory assets.
   - Publish = release-store of a slot record; **retire via epoch
     reclamation** (audio thread bumps an epoch each render; free after the
     epoch passes unpublish). Browser: single worklet thread ⇒ trivially
     safe. Native: real lock-free discipline, TSAN-gated.
   - **Instance identity inside `packedInts`**: a small `instanceKey`
     written once into `rendererInts` by the platform adapter through an
     ordinary hidden input (the `hostSlot0Guard` pattern), indexing a
     fixed-capacity atomic partition table. No ABI-signature change is
     needed for identity; iOS's macro substitution and the three 18-arg
     shape checks survive the migration phase untouched.
2. **Derived-asset cache, not shipped sidecars.** Baking all packed pyramids
   into the bundle is a trap: 767 MiB for the full catalog vs 124 MiB of
   shipped WAV sources [M — probe]. Instead: keep worker-side FFT/mip build
   as the *producer*, write the packed pyramid to a persistent derived cache
   (iOS App-Group container — the entitlement already exists,
   ios_auv3/Entitlements/CosimoSharedWavetableLibrary.entitlements; browser
   Cache/OPFS; desktop app support dir), and mmap (native) / fetch+memcpy on
   the worklet thread between quanta (browser — events already arrive in
   `port.onmessage` outside `process()`,
   web/audio-worklet-instrumentation.mjs:44-59, so paced ≤256 KiB copies are
   the same hazard class as today's event copies). First-use cost equals
   today's; every later load and every session rebuild becomes
   near-instant.
3. **Cmajor keeps everything musical** and gains one compact FIFO event +
   two externals: `assetPublish {oscillatorIndex, assetHandle, generation,
   frameCount, dspSessionId, deliverySerial}` handled by
   `assetAcquire(key, handle, generation) → frameCount|0` and
   `assetRelease(key, handle)`. Publishing **through the existing FIFO**
   preserves ADR-021 fence ordering; acquire pins (audio-thread O(1));
   release retires via epoch. Handles land exactly where slot indices live
   today. The worker's runtimeState/generation/dspSessionId handshake — who
   decides *what* to load — is unchanged.
4. **Deletions**: the 50 MiB chunk arrays, staging machinery, ready flags,
   pack functions, per-mip upload wire; `renderAll` shrinks to
   (`packedFloats`, `packedInts`); per-lane chunk div/mod disappears.
   **Lifecycle win**: the store outlives performer rebuilds — a sample-rate
   change becomes re-publish of existing handles (milliseconds) instead of
   re-FFT + re-upload (seconds).

Must remain: ADR-021 "selection is the only durable state" (neither wrapper
serializes performer memory today — verified for desktop
cmaj_PatchLoaderPlugin.cpp:566-584, iOS CosimoCmajorPlugin.h:1913-2017,
browser web/browser-patch-state.mjs — so the cutover has **zero preset/DAW
compatibility cost** [V]); worker as loading owner; oracle bit-exactness
(`1475307`); readiness gating semantics.

## 7. Evidence gates (ordered; each can kill or reshape the design)

- **G0 — instrumentation first**: extend the `cosimo-perf` marker set and the
  iOS benchmark to the wavetable upload path; capture today's baseline
  (nothing measures it now).
- **G1 — instance identity**: verify `processor.session` uniqueness across
  co-resident instances (desktop VST3 ×N; AUv3 out-of-process co-hosting);
  TSAN prototype of partition table + epoch reclamation.
- **G2 — browser memory probe**: renderer wasm with ingest exports +
  grow-based region against a real generated bundle (needs the macOS
  toolchain); paired `--global-base` regeneration; rewrite the shared-memory
  canary; measure worklet-thread memcpy budget.
- **G3 — bit-exactness AND CPU**: store-backed renderAll passes
  `tests/native/run_three_oscillator_renderer_oracle.sh` unchanged AND does
  not regress the (already-failing) load budgets on device.
- **G4 — restore fence**: design review that publish-through-FIFO +
  store-survival preserves ADR-021:688-725 ordering across performer
  restart; extend the QuickJS restore probe.
- **G5 — iOS payoff**: dirty-memory and multi-instance measurements
  (pool-in-state vs mmap cache); re-measure the AUv3 extension ceiling.

## 8. Implementation sequence and scope (if adopted)

0. Tier-1 transport fixes (independent; keep regardless) — ~1 wk.
1. G0 instrumentation + baselines — ~0.5 wk.
2. Derived-asset cache format + worker producer + digest ledger
   (ADR-021:39 pattern) — ~1–1.5 wk.
3. AssetStore core + native partitions + epoch reclamation + G1/G3 — ~1.5–2 wk.
4. Cmajor cutover (delete pool/staging, add publish event + externals,
   shrink ABI; regenerate all targets; rebuild oracle/integration/QuickJS/
   web-POC tests) — ~2 wk; the largest churn: the wavetable path is the most
   test-armored subsystem in the repo.
5. Browser adapter + G2 — ~1–1.5 wk.
6. iOS pass + G5 + multi-instance soak + perf fingerprints — ~1 wk.

**Total ≈ 7–9 engineering weeks** to wavetable parity under new ownership,
before any multisample feature work.

## 9. Major risks and unresolved uncertainties

- [U] Both load-bearing limits are **empirical, undocumented** upstream
  behaviors (64 KiB FIFO; 13.1 M-element array rejection) — upstream updates
  can move them silently; the design should stop depending on the second
  one (the store does) but still respects the first for control events.
- [U] External functions are "expert level… only available on some
  back-ends (e.g. LLVM)" — deepens an existing dependence.
- [U] AUv3 memory ceiling on modern iOS (old ~360 MB statement) and real
  co-hosting topology per host — measure in G1/G5.
- [U] Store-survival across performer recreation deliberately decouples
  asset lifetime from `dspSessionId`; the identity/`generation` story must
  be redesigned explicitly (G4), not inherited.
- [I] Registry + epoch reclamation is standard but new here; the browser
  needs none of it (single thread), so the risk concentrates on desktop
  multi-instance and AUv3.
- Regression surface: oracle, generated-integration source assertions
  (16-chunk count!), QuickJS restore, web POC, shared-memory canary, perf
  fingerprints — most must be rewritten in step 4.

## 10. Platform integration facts (verified)

- **Desktop**: JIT via `cmaj::Engine::create()` per instance
  (`isPrecompiled=false`, cmaj_PatchLoaderPlugin.cpp:605-606, :722); renderer
  compiled into the plugin (tools/desktop_native/CMakeLists.txt:56-60);
  provider registered per patch (:723-724); fresh `cmaj::Patch` + engine +
  ~54.5 MB state per instance; the stock `CmajPlugin.vst3` cannot host the
  synth (no provider) — FX patches only (scripts/install_fx_cmajplugin.sh:83-101).
- **iOS**: AOT C++ generated by `tools/cmajor_external_codegen` (sentinel
  resolver returns `(void*)1`; "generated C++ deliberately retains a
  link-time renderer symbol", main.cpp:82-93); external bound by macro
  substitution (cmaj_StaticLibraryShim.cpp:15-18); no compiler on device
  (:36-48); 128-frame block static-asserted (CosimoCmajorPlugin.h:630-632);
  out-of-process instantiation (CosimoAUv3HostHarness.mm:1673); QuickJS
  worker in-extension (CMakeLists.txt:249); manifest differs from desktop
  by the view entry only.
- **Browser**: events applied in `port.onmessage` on the worklet thread,
  outside `process()`, coalesced relative to render quanta
  (audio-worklet-instrumentation.mjs:44-59, :149-158); perf reporting each
  256 blocks; Cmajor module owns the single per-instance
  `WebAssembly.Memory`; renderer is a heap-less guest at a scraped fixed
  base with a 2 MiB reservation.
- **Lifecycle**: `dspSessionId = processor.session` (:1532); three worker
  services re-drive wavetables (re-read + re-FFT + re-upload), modulation/
  articulation, and rack on every session change
  (wavetable-worker.ts:1216-1251, :486-503;
  modulation-articulation-worker-service.ts:263-280;
  rack-state-worker-service.ts:11-19). No wrapper serializes performer
  memory; only selection survives a save.
- The most quotable in-repo line on the subject
  (tests/native/ThreeOscillatorGeneratedIntegration.cpp:36-38):
  *"Keep the 52 MB table pool out of the Wasm stack. The test process/module
  is single-use, so one statically allocated performer is the honest product
  shape."*
