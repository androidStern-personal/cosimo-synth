# ADR-020: Declarative mappings compile to a sparse real-time program

Status: accepted — 2026-08-08

## Context

Cosimo exposed its DSP table directly as the user's modulation model. A compile-time capacity of
12 appeared in storage normalization, adapters, UI copy, articulation images, endpoint uploads,
tests, and the Cmajor engine. Every sample then inspected all 12 voice slots for all 16 voices and
inspected a second 12-slot rack table. Raising that constant to 100 would have raised worst-case
per-sample work by the same factor, including disabled slots.

The product needs two separate contracts:

- A patch can store every legal source/target mapping without an arbitrary UI ceiling.
- At least 100 mappings can execute simultaneously under the measured real-time budget.

Those are not the same promise. The first is a domain-capacity property; the second is a measured
performance property.

## Decision

### One declarative model, one compiler seam

`modulation.v2` remains the canonical user and preset model. It stores mappings as relationships:
source, target, amount, polarity, enabled state, and the applicable Max/Mean reducer. Mapping order
has no sonic meaning. One source/target pair may exist at most once.

`ui/shared/modulation-runtime-program.ts` is the only seam that translates those mappings into the
engine representation. The public adapter and UI do not expose a route-table capacity.

Cosimo's closed domain currently contains 13 sources and 48 destinations, so it has 624 legal
source/target cells:

- 108 voice-source → voice-destination cells
- 48 Macro → voice-destination cells
- 324 voice-source → rack-destination cells
- 144 Macro → rack-destination cells

The deterministic cell address is derived from the source and destination wire indices. It is not
allocated, recycled, or coupled to list order.

### Clean break at the stored-state boundary

There is one exact current `modulation.v2` schema. Hydration, live writes, and presets all use the
same parser. Unknown fields, unknown sources or destinations, duplicate ids, duplicate
source/destination pairs, non-finite values, and incomplete documents reject the whole document.
The parser never groups rows, repairs identities, clamps persisted values, or rewrites state.
Missing state selects the current defaults. Invalid state is different: at boot it installs nothing,
and after a valid install it leaves that last valid runtime program unchanged.

There is likewise one exact current `articulations.v3` schema. A route amount may reference only a
currently valid articulable mapping. A retired schema, duplicate slot, phantom mapping reference,
unknown field, or invalid value rejects the whole document. Presets validate the modulation and
articulation documents together and install modulation first, so a valid articulation can reference
a mapping created by that same preset without weakening either parser.

### Four flat active lanes

The compiler emits four flat structure-of-arrays lanes matching the four lifetime/cost rules above.
Each lane has an active count plus fixed-size arrays required by Cmajor's event type. The audio loop
iterates only each active prefix. Disabled mappings emit no instruction. An enabled 0% voice mapping
stays active because a per-note articulation may override it to a nonzero amount; it also allows a
base drag to cross zero without rebuilding topology. Rack/global mappings cannot be articulated, so
a 0% rack mapping remains declarative but emits no instruction; crossing zero installs a new active
prefix once.

The engine resolves each used voice source once per participating voice, resolves all four Macros
once per sample, and accumulates directly into indexed destination arrays. Macro → voice base
offsets are fanned out once per sample for ordinary voices; articulated voices apply their latched
per-note amounts. Voice → rack sources are accumulated once per source and then fanned out through
their destinations with the selected Mean/Max and polarity semantics.

The two audio-rate voice loops use bounds-proven fixed-range indices and stop at the published active
count. This lets generated WebAssembly address the active-route arrays directly instead of performing
a modulo division for each of those safe `.at(int32)` reads; validation still bounds every count and
coordinate before the active count is published. Computed destination and articulation lookups still
use safe `.at()` access and were not part of this optimization.

The compiler also validates the rack destination catalog itself at module initialization: every DSP
index must be an integer in the engine's 36-target domain and no two descriptors may claim the same
index. That makes a future UI/DSP catalog drift fail at the compiler seam rather than silently routing
to the wrong parameter.

Every current destination evaluates modulation at audio rate. Voice and rack/global targets use the
same temporal contract: a source change that lasts one sample must reach its destination. Rack
targets retain their existing 5 ms one-pole smoothing and voice-to-global contributions retain their
180 ms release, but neither behavior is a control-rate scheduler. A slower destination may be added
later only as an explicit, measured product decision with its own temporal contract; target location
alone is not a reason to reduce its update rate. The engine also uses its existing voice-liveness
predicate before source resolution, so idle voice slots perform no route work.

Production-DSP tests pin that temporal contract: one-sample Macro and per-voice MPE Slide pulses cross
the real rack/global path, the smoother reaches its one-time-constant point at 5 ms, the
voice-to-global contribution releases linearly to exact zero over 180 ms, and a newly participating
voice gates on immediately. These are behavioral tests of the real reducer/voice-engine seam, not
duplicated test-side math.

### One atomic topology event, tiny amount events

A topology change sends one complete `modulationProgram` aggregate. The Cmajor handler validates
all counts, sorted unique cells, source/target coordinates, polarities, and reducers before copying
anything; it also rejects non-finite amounts across the complete deterministic-cell payload before
an inactive tail can become an articulation inheritance input. Active counts are published last. A
rejected aggregate leaves the previous program live
and increments the public `modulationRejectedRouteCount` diagnostic. Cmajor does not interleave the
sample loop through one event handler, so this is an atomic replacement without allocation, staging
messages, generations, or a persistent double-buffer indirection.

A pure amount edit sends one `modulationAmount` event containing path, deterministic cell, and
amount. The stored-state worker owns runtime restoration: it installs as soon as stored state is
available rather than waiting for the render-loop epoch, and replays the full program when a later
DSP session appears. Native desktop and iOS wrappers do not maintain a second compiler. Each worker
lane serializes one session-addressed command at a time, sends without blocking the caller, and uses
correlated acknowledgements plus small sync probes to distinguish acceptance from a dropped input.
Every new lane incarnation must receive its own correlated baseline probe before it trusts a
same-session frontier; an acknowledgement queued by a retired worker cannot choose the new lane's
delivery serials. Modulation batches stop on a semantic rejection so topology remains atomic.
Articulation snapshots are independent, so that lane reports the first rejection but continues past
it; one malformed selector cannot starve valid selectors later in the bank.
Continuation is fixed by the articulation lane's domain semantics rather than exposed as a generic
configuration switch. The lane's implementation-only state and helpers use JavaScript-private
members, preserving readable source while allowing production minification to keep the complete
worker below its unchanged startup/parse budget.
The worker retries one complete image only when the accepted frontier proves that replay is needed;
if a later command is semantically rejected after earlier commands in its batch were accepted, the
worker performs one guarded full replay to reconcile that accepted prefix. A repeated rejection is
reported without entering a retry loop.

### Articulations remain sparse in storage

Articulation storage remains `mapping id → amount`. Runtime images use 156 deterministic voice
cells, independent of mapping list order: an explicit override is stored directly and an absent
override uses a safe out-of-range inheritance sentinel. The DSP resolves inherited cells from the
current base program once, when the note latches. A base amount drag therefore sends no articulation
images. Per-note mapping amounts apply only to voice destinations. Rack destinations are global and
cannot vary by note, so any such route amount makes the entire articulation document invalid.
Hydration and live writes invoke the same strict parser; neither path drops, remaps, or repairs
entries. On a fresh DSP session the worker sends only defined articulation slots because the engine's
other slots are already disabled; removed slots still receive an explicit disabled image within a
live session. The same acknowledged lane protects a completely populated 128-slot bank.

## Performance contracts

The committed benchmark runs at an asserted 48 kHz / 128-frame render quantum. It confirms 16 unique
voice starts—eight ordinary notes and eight articulated notes—and measures 1,536-block epochs by
default (configurable upward) for:

- no mappings;
- 100 voice → voice mappings (the worst polyphonic audio-rate lane);
- 100 voice → rack mappings with mixed Max/Mean reduction;
- 100 mixed mappings across all four lanes;
- 100 voice → voice plus 100 voice → rack mappings simultaneously;
- all 624 legal mappings as a capacity torture case;
- 625 saturated, acknowledged tiny amount events plus an independently paced 60 Hz product gesture;
- 250 saturated 100-mapping topology replacements;
- 250 saturated complete-domain topology replacements;
- an all-effects/two-way-unison nonlinear-load comparison with and without 100 voice mappings; and
- a doubled-process route-dominant soak that amplifies modulation-loop cost while retaining wall-clock
  headroom.

The doubled soak also installs all 624 mappings with every active count at zero while retaining their
nonzero tail payload. Its average render load may exceed the doubled empty-program baseline by at most
0.03. That timing comparison is supporting evidence, not the sole proof of the loop bound. Real DSP
residue tests populate each of the four lane payloads, set its active count to zero, and require the
destination to return to its unmodulated value. A source-level hot-path contract checks that every
production loop is bounded by its active count; mutation testing one macro-to-voice loop to its fixed
capacity makes that contract fail before the production source is restored.

A second production-graph test replaces a populated three-route voice-to-rack prefix with a one-route
prefix and requires the retained destination to keep its exact value while both removed destinations
return to exact zero. Direct compiler tests separately require enable, disable, add, remove, and
polarity changes to emit one atomic structural reinstall; they do not infer this from an obsolete
transport-table shape.

A separate semantic sentinel keeps 100 voice instructions active, makes instructions 1–99 zero-depth,
and uses instruction 100 alone to move live filter Q through MPE Slide. The amount acknowledgement must
then return Q to its base value. This proves the tail instruction executes; non-silent oscillator audio
by itself is not accepted as route coverage. Before the long loaded soak, all 16 notes are retriggered
and the newest 16 voice-start events must again contain 16 unique voice indices.

The required 100-mapping sustained cases must produce non-silent audio, remain below 75% average
measured render load, and complete no slower than 1.2× their audio duration in both desktop Chromium
and desktop Playwright WebKit. Amount and 100-map topology edit epochs enforce the same render-load
limit while cadence is measured separately. With a high-resolution worklet clock they permit zero
over-budget calls. The tested generated worklets currently expose only integer-millisecond
`Date.now()`, so a measured 3 ms call cannot distinguish a real 2.667 ms miss from clock quantization;
that environment instead requires fewer than 0.2% flagged calls and no measured call of 4 ms or more.
The 624-cell torture case is not a mobile real-time promise; sustained execution and complete-domain
topology replacement must remain below 90% average with fewer than 2% over-budget render calls. Every
epoch must also report zero rejected installs and zero silent held-note polls. Browser `currentFrame`
jumps are kept as a separate shared-machine scheduler diagnostic and must remain below 0.2% of measured
blocks; they are not relabeled as DSP execution time.

Stress-epoch environment overrides can only increase the committed defaults. A local or CI invocation
therefore cannot make the benchmark green by silently shortening its soak.

Cmajor installs modulation events between Web Audio render callbacks, so render-duration timing alone
does not cover edit stalls. Each edit phase is paired with a same-cadence, tiny-message probe under
the same or higher steady DSP load. The worklet marks the next render callback after every probe or
real edit and requires at least 90% one-event-per-adjacent-block coverage. For 100-route amount and
topology edits, the real phase may add at most 0.20 average callback-gap load over its matched probe.
The 624-cell topology torture phase allows 0.25 additional average gap load. At 48 kHz / 128 frames,
0.20 is about 0.533 ms. The thresholded late-callback count remains a coarse-clock diagnostic; the
average delta is the enforced edit-stall contract.

The nonlinear all-effects/two-way-unison comparison is deliberately relative: the browser WebAssembly
baseline itself can exceed realtime when nonlinear warp is active, so 100 mappings may add at most 15%
to its matched baseline rather than laundering that case into an absolute realtime claim. The doubled
route-dominant soak must still complete within 1.1× audio duration and may add at most 1% callback gaps
over its doubled empty-program baseline.

Rack gain safety uses an absolute peak ceiling. The current all-effects signal is about 0.017 RMS with
0.065–0.070 peak, while the dry reference is only about 0.0023 RMS; a relative dry-to-wet dB bound would
therefore measure gain staging against a near-silent reference rather than clipping risk. Macro-to-rack
inactive residue is instead required to stay below 5% of its active signal and measures about 3.25% in
both browser engines.

Every metrics reset is epoch-acknowledged by the worklet so stale blocks cannot enter a measurement.
The articulated notes assert that inherited mapping amounts resolve from the current base program.
Sustained DSP cost uses render load and over-budget blocks. Edit acceptance uses the matched
event-adjacent callback-gap deltas above, which include payload delivery and synchronous Cmajor
installation; raw callback maxima remain scheduler diagnostics.

Session safety is tested compositionally instead of adding a test-only engine-restart endpoint: lane
and mirror tests force an in-flight session rollover and reject stale acknowledgements; the product
browser test proves 60 Hz edits, persistence, and the sole worker's accepted frontier with 100 maps;
the Cmajor sentinel proves the accepted amount changes the effective DSP target. A browser reload
would only prove sequential restore and would add no overlapping-race coverage.

The native QuickJS path has a separate production-patch proof rather than a mocked compiler or worker.
It opens `WavetableSynth.cmajorpatch`, restores declarative stored state through the real worker,
requires an accepted modulation serial, observes Macro 1 move Filter Q from 0.707 to 10.707, then
clears the live state and requires Q to return to 0.707. Focused native regressions also exercise
Promise jobs at every QuickJS execution boundary and stored-string change detection. The pinned runtime
fixes are reproduced by `scripts/ensure_cmajor_runtime.py`; every source anchor must occur exactly once
or dependency preparation fails. Worker JavaScript errors report status without unloading an otherwise
playable patch, while compile/source-transformer failures remain fatal. A native constant-signal proof
requires audio to continue after that worker error. These fixes run on worker/control-message paths and
do not add work to the audio-rate DSP loop.

Physical iPhone AUv3 remains a separate acceptance environment. Playwright's iPhone descriptor
changes viewport and input behavior; WebKit still runs on the Mac and does not satisfy an iPhone CPU,
thermal, or audio-scheduler claim. The device benchmark therefore reads timing from the production
`GeneratedPlugin::processBlock` seam, proves the DSP itself is running at 48 kHz with no buffers above
128 frames, and requires all 16 voice indexes. Each phase must acknowledge a newer complete program
whose four installed active counts exactly match the strict profile compiler's counts. It also checks
audio coverage, process-block deadlines, callback-arrival pacing, non-finite output, silence, timeline
continuity, and thermal pressure. A qualifying result is three counterbalanced full-duration runs
from a fresh build; shorter or reused-build runs are labelled smoke-only and cannot qualify shipping.

The final controlled generated-engine runs kept every normal 100-map epoch free of flagged render
calls. Chromium averaged 22.4% empty, 38.7% for 100 voice routes, 24.0% for 100 voice-to-rack routes,
31.6% for mixed 100 routes, 50.8% for all 624, and 70.9% for the doubled-processing 100-voice case.
Desktop WebKit averaged 25.6%, 42.1%, 26.9%, 36.4%, 56.3%, and 76.1% for the same cases. With 624
stored and 100 active mappings, the real product UI accepted a paced stream of distinct amount inputs
at 59.1 Hz in Chromium and 59.9 Hz in WebKit. Average UI dispatch cost was 1.6 ms and 1.9 ms; the
separate sequential exact-acceptance proof measured worker/DSP acknowledgement latency at 23.6 ms and
9.6 ms. Direct runtime amount events sustained 164.3/second in Chromium and 125.3/second in WebKit.
The fixed-range indexing change reduced the incremental 100-voice-route load by about 20% in matched
pre/post runs. These are desktop results, not a substitute for the physical-iPhone acceptance above.

## Consequences

- Stored mappings and maximum execution cost are no longer the same number.
- The UI can create more than 100 mappings and reports a plain mapping count. Only duplicate pairs
  or exhaustion of the real 624-pair domain can prevent creation.
- Bypassed mappings cost no route instructions; deletion is no longer required to recover a slot.
- The simplest measured transport won: one aggregate topology event plus one tiny amount event.
  A staged transaction protocol, slot allocator, generation checks, public rate-policy layer, and
  second native restore owner were rejected as unmeasured complexity.
- Computed destination-offset writes remain the clearest later hot-loop lever. Do not reshape the
  voice target storage until measured device headroom shows it is necessary; that change would trade
  a simple flat state layout for an unproven gain.
- A future source or destination expands the semantic domain constants and compiler tables. It
  does not require changing the public mapping model.
- Audio-rate modulation is the default for every current target. A future slower target needs an
  explicit temporal requirement, smoothing/interpolation behavior, and benchmark evidence; it must
  not create a second bolt-on routing architecture.

This ADR supersedes the route-budget portions of ADR-018 and the iOS merge roadmap. ADR-018 remains
authoritative for explicit mapping creation and no-phantom-route behavior. ADR-014 remains
authoritative for sparse articulation storage, amended to use deterministic voice-mapping cells.
