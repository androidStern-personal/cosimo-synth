# Bounded single-performer Effects Lane capacity — ADR candidate

Status: **physical characterization complete; architecture direction retained,
but no supported product capacity point**

Physical iPhone evidence shows that inactive preallocation, state, startup, and
the representative router are not the blocking axes through four additional
instances of every type. The provisional two-each pool also switches without
artifacts or memory growth and remained nominal and miss-free for 20 minutes.
However, the unchanged current patch already exceeds the predeclared comfortable
mean and p95 callback budgets, every capacity point inherits that failure, and
the mandatory dependent-framework Allocations evidence could not be captured.
No per-effect vector or active-device cap can therefore be called supported
under the frozen acceptance contract. This is not evidence for multiple
performers: inactive preallocation itself did not fail.

## Product interpretation

The desired Effects Lane still supports multiple instances of the same effect,
utility band splits, and parallel effect paths. The 119 physical runs establish
only that a representative set of fixed serial, parallel, nested, and multiband
plans was feasible on the measured direct performer for the residency, memory,
startup, switching, and internally observed real-time checks described below.

That result does **not** approve a production routing engine, a resident or
active-device capacity, a tail policy, host-automation behavior, AUv3 behavior,
or external real-time safety. No capacity or production-engine decision is due
until the integrated product passes `QA-AUV3-PERF-01` and its comparable direct
performer passes `PERF-01` and `PERF-02`.

## Requirements

- Decide with physical-iPhone memory, callback, startup, thermal, and audio-safety
  measurements. Desktop native and WASM are supporting evidence only.
- Measure every real production effect independently, mixed vectors, inactive
  residency, active DSP, routing utilities, topology switching, and a physical
  soak.
- The minimum pass includes zero post-prepare audio-thread allocations/locks,
  zero deadline misses/underruns, bounded memory, and no unexplained switch
  artifact outside the declared transition.
- Report a conservative point below the unsafe knee, never the first failing or
  barely passing point.

## Inherited constraints and product assumptions

- Cmajor topology is compile-time fixed, so hard resident capacity is a vector
  by effect type. A separate active-device budget is allowed only if the active
  curve supports it.
- A visible finite device limit is acceptable.
- **Product assumption, not measurement:** two additional resident instances of
  every type is the provisional minimum because duplicate devices are required.
- The copied current patch retains its existing instance of every effect. Thus
  `2_each` measures two additional lane instances plus the eight legacy rack
  instances. Reusing the legacy instances after a future migration would reduce
  the generated-state case by about one-each, 6.403 MiB measured.
- The 45 existing fixed FX host endpoints remain untouched. Future lane-created
  devices use only the permanent macro bank for DAW automation; this experiment
  adds no second assignable bank.

## Exact evidence boundary

Repository source is detached `HEAD`
`34ae7e005d5b7333c90469f04fe89933cb4d8aa2`, equal to the default branch at
experiment start. The generator records hashes for copied production sources,
generated Cmajor, generated C++, native executables, signed apps, and trial
records. Production DSP/UI/state/preset code and public manifests are untouched.

Inspected/generated backends and tools:

- Cmajor 1.0.3066 (build 2025-11-22), `cmaj generate -O3`, raw C++ and
  JavaScript/WASM backends, maximum block 512.
- Apple clang and Xcode 26.5 (17F5022i), iPhoneOS SDK 26.5; Release arm64
  disposable app with bundle ID `dev.cosimo.effects-lane-capacity`.
- Node 22.16.0, npm 11.4.1, Python 3.14.6.
- Desktop host: macOS 26.5.1 (25F80), arm64. Desktop sweeps used 48 kHz,
  128 frames, one-second warm-up, three measured seconds, and three trials per
  point.
- Physical baseline device: iPhone 14 Pro (`iPhone15,2`), iOS 27.0 beta build
  24A5390f, Developer Mode enabled; Xcode UDID
  `00008120-000139383644C01E`, CoreDevice ID
  `00C7F433-8B6A-5CAC-856F-56D7385E12F9`.

The source-contract audit is reproducible with
`audit_source_contract.py`; its raw result is
`build/effects_lane_capacity/source-contract-audit.json`.

The canonical completed-device handoff is
`build/effects_lane_capacity/device_campaigns/iphone14pro-20260810/runner-handoff.json`,
SHA-256
`aade21299fd25548d55d6db460d904efaf04023cbc40d373bf792be4d763276a`.
It freezes 119 complete physical app runs: four baselines, 64 per-effect
resident/active trials, eight mixed trials, 24 routing trials, four provisional
switch/growth trials, nine candidate-profile trials, one 20-minute soak, and
five external-trace workloads. The quarantined USB-interrupted Distortion-4
attempt and failed trace probes are not part of those counts.

## Source measurements

The production inventory is exactly eight `wt::*Bus` processors:

| Type | Production processor | Explicit rate-scaled float-buffer estimate at 192 kHz |
|---|---|---:|
| Global Filter | `wt::GlobalFilterBus` | 0 B |
| Distortion | `wt::DistortionBus` | 0 B |
| OTT | `wt::OttBus` | 0 B |
| Chorus | `wt::ChorusBus` | 3,036,480 B |
| Flanger | `wt::FlangerBus` | 36,928 B |
| Phaser | `wt::PhaserBus` | 0 B |
| Delay | `wt::DelayBus` | 3,072,064 B |
| Reverb | `wt::ReverbBus` | 565,632 B |

The source estimate is 6,711,104 B (6.4002 MiB) for one of each and
13,422,208 B for two of each. It counts only explicit rate-scaled float arrays,
not complete generated state or runtime memory. Chorus plus Delay contribute
about 91% of that estimate.

The existing rack's disabled state is not a valid inactive-pool benchmark:
`EffectsRack` advances all eight children and its sleep hook returns false.
Filter-Off and Phaser-mix-zero have cheap internal paths, Chorus is partial, and
the other five still execute DSP. The harness therefore implements true inactive
residency by not advancing a preallocated node and proves it with per-type
advance canaries on every block.

The host contract has 29 pre-FX value slots followed by exactly 45 fixed FX
endpoints in absolute slots 29–73: Distortion 6, Chorus 8, OTT 5, Filter 4,
Flanger 4, Phaser 8, Delay 6, Reverb 4. The permanent macros are slots 6–9.

## Generated artifact measurements

| Variant | Generated state | Performer | C++ source | Native executable at desktop sweep | Signed iOS executable | WASM SIMD / non-SIMD | Initial WASM pages |
|---|---:|---:|---:|---:|---:|---:|---:|
| Current patch, zero added pool | 54,551,200 B | 54,559,424 B | 1,043,048 B | 213,872 B | 296,256 B | 206,050 / 209,932 B | 917 |
| Current patch + two each + 65-tap router | 67,982,304 B | 67,990,528 B | 1,286,014 B | 236,992 B | 318,480 B | 263,503 / 269,048 B | 1,123 |

The signed current/provisional iOS executables are SHA-256 `56e14fed90e81118...`
and `872f8166ae544e84...`; their generated C++ is `fb341b30110eab34...`
and `c2d516c2b7f281a7...`. Full hashes and signatures are frozen in the device
matrix rather than abbreviated in this narrative.

The provisional case adds 13,431,104 B (12.8089 MiB) of generated state:
13,428,096 B for the two-each serial pool and 3,008 B for the representative
router. Its three process-cold C++ generations were 2.84, 2.74, and 2.72 s;
the current-patch baseline was 3.02, 3.25, and 2.86 s. Filesystem cache state was
uncontrolled, so these are process-cold, not guaranteed storage-cold trials.

The default dual JavaScript/WASM backend validated in Node. Current-patch
generation took 38.50 s and declared 917 initial 64-KiB pages (60,096,512 B);
provisional took 40.53 s and declared 1,123 pages (73,596,928 B). These are
compile/runtime-layout measurements, not iPhone physical footprint.

One additional real instance contributed the following generated artifacts.
The executable column is the optimized desktop native probe delta and therefore
measures code, not state or iPhone resident memory.

| Type | Generated state | Generated C++ | Native executable |
|---|---:|---:|---:|
| Global Filter | 120 B | 5,499 B | 144 B |
| Distortion | 744 B | 18,915 B | 640 B |
| OTT | 616 B | 7,421 B | 368 B |
| Chorus | 3,037,184 B | 32,697 B | 480 B |
| Flanger | 37,000 B | 7,304 B | 128 B |
| Phaser | 376 B | 10,158 B | 400 B |
| Delay | 3,072,160 B | 8,803 B | 128 B |
| Reverb | 565,880 B | 16,097 B | 272 B |

## Desktop native capacity curves — supporting measurements

Each entry below is `generated-state delta MiB / inactive thread-CPU p99 load /
active thread-CPU p99 load`. Counts are additional pool instances. Raw trials
and summaries are under `build/effects_lane_capacity/desktop_results/`. The
authoritative provenance-complete directories are `core-20260810T221759Z`,
`extended-20260810T222159Z`, and `routing-20260810T222451Z`; every raw row
records generator, metadata, generated C++, probe source, and executable hashes.

| Effect | 1 | 2 | 3 | 4 | 8 | 12 | 16 |
|---|---|---|---|---|---|---|---|
| Global Filter | 0.000 / .132 / .135 | 0.000 / .145 / .164 | 0.000 / .169 / .115 | 0.000 / .116 / .122 | 0.001 / .171 / .138 | 0.001 / .118 / .140 | 0.002 / .165 / .173 |
| Distortion | 0.001 / .119 / .129 | 0.001 / .147 / .147 | 0.002 / .184 / .143 | 0.003 / .168 / .208 | 0.006 / .114 / .191 | 0.008 / .113 / .206 | 0.011 / .120 / .289 |
| OTT | 0.001 / .154 / .196 | 0.001 / .136 / .197 | 0.002 / .171 / .200 | 0.002 / .124 / .189 | 0.005 / .119 / .239 | 0.007 / .113 / .301 | 0.009 / .119 / .361 |
| Chorus | 2.896 / .135 / .170 | 5.793 / .131 / .221 | 8.689 / .135 / .290 | 11.586 / .131 / .354 | 23.172 / .139 / .592 | 34.758 / .124 / .770 | 46.344 / .119 / .774 |
| Flanger | 0.035 / .159 / .142 | 0.071 / .138 / .129 | 0.106 / .156 / .138 | 0.141 / .139 / .149 | 0.282 / .140 / .116 | 0.423 / .142 / .202 | 0.565 / .112 / .148 |
| Phaser | 0.000 / .141 / .149 | 0.001 / .120 / .137 | 0.001 / .135 / .147 | 0.001 / .124 / .156 | 0.003 / .136 / .149 | 0.004 / .143 / .150 | 0.006 / .121 / .158 |
| Delay | 2.930 / .187 / .132 | 5.860 / .133 / .146 | 8.790 / .149 / .128 | 11.719 / .127 / .171 | 23.439 / .124 / .124 | 35.158 / .143 / .155 | 46.877 / .122 / .174 |
| Reverb | 0.540 / .176 / .167 | 1.079 / .145 / .138 | 1.619 / .141 / .174 | 2.159 / .151 / .196 | 4.317 / .120 / .278 | 6.476 / .118 / .248 | 8.635 / .124 / .255 |

Every inactive canary observed zero advances; every active canary observed the
requested count. There were zero C++ `new` calls in the measured callback scope,
zero canary mismatches, and zero non-finite samples. The non-monotonic inactive
timings reflect workstation noise rather than inferred node work; physical
memory and callback evidence remain required.

Mixed serial curves:

| Additional count of every type | State delta | Inactive thread p99 | Active thread p99 | Active thread maximum |
|---:|---:|---:|---:|---:|
| 1 each (8 active) | 6.403 MiB | .166 | .243 | .381 |
| 2 each (16 active) | 12.806 MiB | .130 | .284 | .452 |
| 3 each (24 active) | 19.209 MiB | .126 | .602 | .774 |
| 4 each (32 active) | 25.612 MiB | .111 | .428 | .788 |

Chorus is the dominant desktop CPU sensitivity; its active maximum exceeded one
deadline at counts 8, 12, and 16. Delay is a similarly large resident-state
sensitivity but comparatively cheap when active. This suggests that any eventual
active cap may need a weighted or per-type rule, not just a total count. It is
not an iPhone limit.

An earlier exploratory run measured mixed active p99 values .235 / .459 / .458 /
.996 for one-to-four each, versus .243 / .284 / .602 / .428 in the final
provenance-complete rerun. Chorus 8/12/16 p99 likewise ranged .592–.700 /
.770–.968 / .774–1.260 across the two runs. The ordering is too unstable to call
a desktop supported point; this variability is itself evidence against using
desktop timing as an iPhone projection.

Desktop wall-clock tails contained deadline misses even at inactive points while
thread CPU remained low; the host load average was roughly 14–30 across the
sweeps. Wall results are therefore scheduling-contaminated and are not used as
capacity evidence.

## Routing and switch measurements

Generated-state deltas over current-patch zero-pool were 1,600 / 3,008 / 5,824 B
for 33 / 65 / 129 crossover taps; fan-out 2 / 4 / 8 added no persistent state;
nested rack depths 1 / 2 / 3 added 48 / 96 / 144 B. Across the representative
provisional plans, desktop thread-CPU p99 ranged from .310 to .379 in the final
rerun.

The harness represents:

- maximum-length serial processing;
- normalized acyclic fan-out/fan-in;
- explicit nested rack processors;
- complementary two-stage FIR three-band splitting, independent band chains,
  recombination, crossover state, delayed dry/reference, high-band and
  non-multiband compensation;
- block-boundary switching among predeclared plans without performer swapping.

Feedback cannot be expressed by the generated plans. Active-count, stimulus,
and route changes commit together at the fade nadir. For a 65-tap router, the
transition holds zero for the 64-sample compensation latency before fading up;
this fixed a measured time-alignment defect found during harness validation.

Four-second desktop captures with 23 switches passed the reproducible detector:

- inactive: maximum non-transition error versus delayed dry
  `7.45e-9`, stable-window lag 0 and correlation ~1, with no silence,
  unexplained discontinuity, tail loss, or latency jump;
- active two-each: no isolated unexpected silence, unexplained discontinuity,
  tail loss, or qualifying latency jump; maximum absolute sample 1.149966 and
  RMS gain 9.04 dB. The 1.15 ceiling comes from the fixed production-derived
  `RackOutputStage`, not a post-result product limit.

An earlier detector revision classified the intentional initial fill of the
100%-wet two-second Delay as dropped audio. The detector now distinguishes an
isolated unexpected silent block from an expected effect latency/tail. That
calibration result is retained and not counted as a switch failure.

## Experiment choices and consequences

1. **Copy and mechanically wrap production sources.** The copied current graph
   is renamed, and the pool is spliced after its fixed output stage. Exact anchor
   assertions and hashes make upstream drift fail generation. Consequence: the
   baseline includes the real current synth and rack while production files stay
   untouched.
2. **Use real processors at stress-oriented settings.** Every active pool node is
   one of the eight production `wt::*Bus` processors with maximum or demanding
   configuration values. Consequence: no placeholder can inflate a reported cap.
3. **Use one non-parameter control event.** All 95 inherited inputs stay first;
   the 44-byte experiment control is appended. Consequence: no new host
   automation contract is implied.
4. **Call the generated performer directly on iPhone.** The disposable app uses
   `AVAudioSourceNode` and preallocated control/metric/audio rings. Consequence:
   measurements isolate performer/pool costs rather than known wrapper costs.
   The pinned `cmaj::Patch` wrapper takes a mutex each callback, the current MIDI
   bridge may allocate on MIDI-bearing blocks, and the plugin wrapper atomically
   loads a shared pointer; those inherited costs must not be attributed to
   preallocation.
5. **Do not use VST3/AUv3 as the primary capacity path.** The generic wrappers
   reintroduce the callback confounds above and do not provide a clean host path
   for the struct control event. Desktop raw C++ and iPhone standalone are the
   meaningful backends for this experiment. AUv3 remains a secondary follow-up
   only if a safe existing host/harness can preserve the same measurement scope.
6. **Use executable-local allocator hooks, not a dyld interpose claim.** The
   first physical smoke test proved that a linked `__interpose` section did not
   intercept a malloc call originating in the iOS main executable. That run was
   rejected before audio started. The replacement app defines local
   malloc/calloc/realloc/posix_memalign symbols backed by the default malloc zone;
   its runtime self-test and two subsequent smokes passed. Consequence: the
   counters cover experiment/generated executable calls, while dependent
   frameworks remain an explicit external Allocations-trace obligation. The
   invalid pre-smoke matrix is archived under `build/effects_lane_capacity/obsolete/`
   and is not measurement evidence.

## Predeclared physical budgets

`budget-policy.json` is authoritative. It was written before any physical
capacity point. Three explicit current-patch sustained baselines at 48 kHz / 128
frames, each with at least 15 s warm-up and 60 s measured, must pass
instrumentation validity before `resolve_budgets.py` writes and hashes a budget
file exactly once. Capacity commands refuse to run before that freeze.

- Memory: steady delta `min(128 MiB, 20% of conservative baseline available
  memory)`; peak delta `min(160 MiB, 25%)`; at least 512 MiB and 20% of baseline
  availability remain; repeated-switch range <=2 MiB and slope <=64 KiB per
  1,000 switches.
- Callback load: mean <=.30, p95 <=.40, p99 <=.50, steady maximum <=.80,
  switch-window maximum <=.90; zero measured deadline misses, late callback
  starts over 1.5 deadlines, and sample-time discontinuities.
- Startup: prepare `min(500 ms, max(100 ms, 2*baseline p95 + 50 ms))`;
  engine-start to first nonzero `min(1 s, baseline p95 + 250 ms)`; launch proxy
  to first nonzero `min(2 s, baseline p95 + 500 ms)`.
- Audio thread: zero C++ new/new[] and executable-local
  malloc/calloc/realloc/posix_memalign in the full experiment-owned render
  callback, with a mandatory on-device hook self-test; zero dependent-framework
  allocations, locks, file/network/VM allocation, or other non-real-time work
  in the external device trace.
- Switching: fixed 5 ms down / latency hold / 5 ms up, no unexplained
  discontinuity, silent block, lost tail, latency jump, non-finite sample, or
  sample beyond the fixed 1.15 hard ceiling.
- Thermal: a supported-point soak is 20 minutes; only nominal/fair states are
  accepted, and every one-minute callback bucket and five-minute memory bucket
  must pass.

## Physical baseline and frozen budgets

Three Release-arm64 current-patch trials ran on the iPhone at a granted 48 kHz
and exactly 128 frames per callback, each after 15 s warm-up for 60 s measured.
Raw evidence is under
`build/effects_lane_capacity/device_results/iphone14pro-20260810-baseline-current-{1,2,3}-r1/`.

| Trial | Mean load | p95 | p99 | Maximum | Peak physical footprint | Deadline misses |
|---|---:|---:|---:|---:|---:|---:|
| 1 | .3657 | .4239 | .4661 | .5534 | 71.502 MiB | 0 |
| 2 | .3682 | .4457 | .4881 | .5658 | 71.627 MiB | 0 |
| 3 | .3678 | .4469 | .4938 | .5906 | 71.502 MiB | 0 |

All three had zero late callback starts, sample-time discontinuities, C++ or C
allocation-counter hits, canary errors, rejected controls, non-finite samples,
session interruptions, route changes, and engine reconfigurations; the local C
allocator-hook self-test passed and thermal state remained nominal. A separate
effect-only zero-pool baseline measured mean/p95/p99/max
`.0070/.0104/.0111/.0192` and 19.095 MiB peak footprint.

The corresponding `TASK_VM_INFO.resident_size_peak` values were 145.781,
145.938, and 145.766 MiB. They include the process's earlier launch/prepare
high-water mark; the physical-footprint series above is the iOS pressure-aware
metric used for baseline-relative capacity, and both are retained in every raw
memory sample rather than conflated.

The current patch itself fails the predeclared comfortable mean <=.30 and p95
<=.40 budgets in every trial, while passing p99 <=.50, maximum <=.80, and the
zero-miss continuity gates. Those limits are retained unchanged: this is a
measured baseline constraint, not grounds to relax the acceptance rule.

`build/effects_lane_capacity/budgets.resolved.json` is frozen at SHA-256
`0b67fc66bd0aaacfc8e00c843b68c36f9b3b3cbc755beb99dd5c9e45ea11b8e0`.
It resolves a 70.752 MiB steady baseline, 71.627 MiB peak, conservative
3,001.201 MiB available memory, 128/160 MiB steady/peak incremental limits,
100 ms prepare, 293.597 ms engine-start-to-first-nonzero, and 1,176.262 ms
launch-proxy-to-first-nonzero limits.

## Physical capacity evidence

The separate signed app calls the generated class directly and records complete
harness callback time (control injection, advance, copies, diagnostics, event
reset), actual callback frame histogram, AVAudio sample/host timestamps,
inter-callback gaps, generated state/IO/performer sizes, startup intervals,
physical footprint, available memory, thermal state, canaries, and stereo
output/reference captures. Its Mach-O defines and verifies four executable-local
C allocator hooks; every trial must also pass a runtime malloc self-test.
Dependent-framework activity remains explicitly outside that counter's scope
and requires the external Allocations/System traces.

All 72 canonical variants are signed and frozen in
`build/effects_lane_capacity/device-build-matrix.json`, SHA-256
`d3ed1a3b3d3b6d54c87671ee2599069240fe505db601ee72c3039ed458ed706e`.
Read-only verification rechecks all configs, generated artifacts, executable
hashes, and code signatures. Compilation and signing succeeded through 16
instances of each effect when swept independently; no compiler topology limit
was reached in the prepared range.

The current analysis task can recheck every frozen hash but its managed keychain
exposes zero signing identities; a fresh strict chain verification consequently
returns `CSSMERR_TP_NOT_TRUSTED`. The executable hashes still match exactly, the
unrestricted runner's signing preflight passed before the campaign, and the
signed apps installed and executed on the paired phone. Re-signing would change
the frozen artifacts, so it was deliberately not done.

The frozen 48 kHz / 128-frame discovery sweep contains 104 complete raw trials:
four baselines, 64 per-effect trials, eight mixed trials, 24 routing trials, and
four provisional switch/growth trials. Every trial was nominal-temperature with
zero deadline misses, late starts, sample-time discontinuities, non-finite
samples, canary mismatches, or locally counted callback allocations. All memory
checks passed. Every full-patch trial nevertheless failed at least the frozen
mean/p95 callback budgets and remains non-passing.

After the nine profile repeats, the final 113-trial non-trace summary is
`build/effects_lane_capacity/device_campaigns/iphone14pro-20260810/device-results-summary.json`,
SHA-256
`0ced45967a86addc16a550baa6b1ed10964184cbd27d8884f997c51c1719ba83`;
its CSV is SHA-256
`7bd8ef6801cc03c46590053b82b3659a1109126e5eada9d9e4c8269ec7e3279e`.
The soak and five traced workloads are separate so trace-induced faults cannot
contaminate the capacity summary.

Per-effect cells below are `inactive mean -> active mean` callback load. Counts
are additional pool instances; the copied legacy rack's eight processors still
advance. Each discovery cell is one 60-second trial, so non-monotonic differences
are retained as measurement noise rather than smoothed into an invented curve.

| Additional instances | 1 | 2 | 3 | 4 |
|---|---:|---:|---:|---:|
| Global Filter | .3728 -> .3666 | .3691 -> .3755 | .3662 -> .3692 | .3660 -> .3705 |
| Distortion | .3649 -> .3817 | .3665 -> .4037 | .3658 -> .4201 | .3758 -> .4348 |
| OTT | .3782 -> .3893 | .3674 -> .4264 | .3747 -> .4671 | .3728 -> .4285 |
| Chorus | .3734 -> .4353 | .3738 -> .4235 | .3687 -> .4549 | .3745 -> .4587 |
| Flanger | .3701 -> .3713 | .3702 -> .3730 | .3714 -> .3746 | .3726 -> .3800 |
| Phaser | .3677 -> .3700 | .3739 -> .3802 | .3708 -> .3814 | .3760 -> .3808 |
| Delay | .3723 -> .3783 | .3734 -> .3757 | .3704 -> .3793 | .3720 -> .3796 |
| Reverb | .3758 -> .3753 | .3698 -> .3890 | .3713 -> .4026 | .3720 -> .4187 |

The corresponding generated-state resident curves in MiB are deterministic:

| Additional instances | 1 | 2 | 3 | 4 |
|---|---:|---:|---:|---:|
| Global Filter | .0001 | .0002 | .0003 | .0005 |
| Distortion | .0007 | .0014 | .0021 | .0028 |
| OTT | .0006 | .0012 | .0017 | .0023 |
| Chorus | 2.896 | 5.793 | 8.689 | 11.586 |
| Flanger | .0353 | .0706 | .1059 | .1411 |
| Phaser | .0004 | .0007 | .0011 | .0014 |
| Delay | 2.930 | 5.860 | 8.790 | 11.719 |
| Reverb | .540 | 1.079 | 1.619 | 2.159 |

At four resident instances, the inactive physical-footprint measurements were:

| Type | Inactive peak footprint |
|---|---:|
| Global Filter | 71.39 MiB |
| Distortion | 71.38 MiB |
| OTT | 71.41 MiB |
| Chorus | 83.20 MiB |
| Flanger | 71.74 MiB |
| Phaser | 71.47 MiB |
| Delay | 83.31 MiB |
| Reverb | 73.53 MiB |

The mixed curve is the clearest resident/active separation. `Active` means every
additional pool node advances at a stress-oriented setting; the legacy eight
continue advancing in both modes.

| Additional pool | State delta | Inactive mean | All-active mean | Matched delta | Active p95 / p99 | Active peak | Misses |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 each (8) | 6.403 MiB | .3774 | .4625 | +.0851 | .5305 / .5462 | 78.11 MiB | 0 |
| 2 each (16) | 12.806 MiB | .3747 | .4523 | +.0777 | .4838 / .5049 | 84.42 MiB | 0 |
| 3 each (24) | 19.209 MiB | .3679 | .4582 | +.0904 | .4880 / .5044 | 90.70 MiB | 0 |
| 4 each (32) | 25.612 MiB | .3760 | .4795 | +.1035 | .5019 / .5122 | 97.35 MiB | 0 |

Thus four each is the largest physically tested resident vector and 32 is the
largest tested concurrent additional-DSP count; neither is a supported product
limit. The first absolute unsafe knee is already the zero-added current patch,
so extending physical discovery to 8/12/16 could not create a passing point.
At four each, the peak grew only 25.72 MiB over baseline and at least 2,975 MiB
remained available, far inside the frozen 160 MiB / 512 MiB limits. No resident
memory knee was found. Desktop state curves through 16 remain available for
sizing only.

The routing-only suite covered fan-out 2/4/8, nesting depth 1/2/3, crossover taps
33/65/129, and every serial/parallel/nested/multiband plan. Mean load ranged
.3683-.3937, p95 .4444-.4654, peak footprint 71.36-71.80 MiB, and all safety
checks passed. The worst routing mean is only about 2.6 percentage points over
the median current-patch baseline, so fixed routing is not the measured blocker.

The two-each provisional suite produced 23 clean inactive and 23 clean active
captured transitions, with no silent block, unexplained discontinuity, latency
jump, lost tail, or sample beyond 1.150001. Its 11,250-switch growth trial had a
.266 MiB memory range and -0.94 KiB/1,000-switch fitted slope; the analyzer
covered 249 captured transitions with no artifact. Active stress measured
.4632 mean, .4933 p95, and .5323 switch maximum with zero misses. It passes the
memory, switching, startup, and internally observable real-time axes, but fails
the absolute callback budget.

The frozen candidate qualification repeated that same active two-each/four-plan
stress workload three times at each requested 48 kHz / 64, 128, and 256 frames.
Only the requested block size changed; every callback histogram contained the
requested size and no other. Each cell is the range over three 60-second trials.

| Granted profile | Mean | p95 | p99 | Maximum | Peak footprint | Misses / thermal |
|---|---:|---:|---:|---:|---:|---:|
| 48 kHz / 64 | .4659-.4677 | .5219-.5258 | .5488-.5535 | .6388-.6467 | 84.16-84.30 MiB | 0 / nominal |
| 48 kHz / 128 | .4626-.4635 | .4911-.4924 | .5102-.5165 | .5760-.5985 | 84.27-84.41 MiB | 0 / nominal |
| 48 kHz / 256 | .4685-.4697 | .4940-.4977 | .5189-.5235 | .5619-.5657 | 84.22-84.39 MiB | 0 / nominal |

All nine pass prepare (maximum 24.84 ms), engine-start-to-first-nonzero
(maximum 52.81 ms), memory, continuity, local allocation, canary, and switch
maximum gates. All nine fail mean, p95, and p99 callback budgets. The manifest is
`candidate-profiles/manifest.json`, SHA-256
`c2e69c0941dd95edccf8e3673498d44e766591519d97768a46a2879c3c87f81d`.

For startup attribution, the three current-patch trials measured construction
7.88-14.23 ms, initialization 4.40-5.94 ms, and prepare 13.34-19.46 ms. The nine
candidate trials measured construction 6.96-16.40 ms, initialization 2.48-8.34
ms, and prepare 9.56-24.84 ms. Candidate engine-start-to-first-nonzero was
40.81-52.81 ms; the conservative devicectl-launch-plus-main proxy was
669.39-973.71 ms. All are inside the frozen limits, and the overlapping ranges
give no evidence that preallocation causes a startup knee.

### Twenty-minute candidate characterization

The active two-each/four-plan candidate ran for 15 s warm-up plus 20 measured
minutes at an exact 48 kHz / 128 frames. This is a characterization of the
provisional product assumption, not a supported-point soak, because its callback
budget had already failed. The raw characterization is
`build/effects_lane_capacity/device_results/iphone14pro-20260810-soak/soak-characterization.json`,
SHA-256
`cde7f587864af9e8e34d32435916f879058fc6d8cf626138258f1b7402add674`.

Across 450,004 measured callbacks and 7,031 switches, mean/p95/p99/maximum load
was `.4631/.4896/.5063/.6005`. Every one-minute bucket failed the frozen CPU
contract: means ranged `.4581-.4643`, p95 `.4866-.4909`, and p99
`.5036-.5106`; maxima `.5484-.6005` remained below the `.80` limit. There were
zero deadline misses, late starts, timestamp discontinuities, non-finite
samples, canary mismatches, rejected controls, callback/switch record overflows,
or locally counted post-prepare allocations. All 16 requested added processors
advanced, and thermal state remained nominal for the entire run.

| Measured minutes | Footprint min-max | Minimum available | Thermal |
|---:|---:|---:|---:|
| 0-5 | 129.689-130.377 MiB | 2,941.623 MiB | nominal |
| 5-10 | 129.689-129.689 MiB | 2,942.311 MiB | nominal |
| 10-15 | 129.689-129.908 MiB | 2,942.092 MiB | nominal |
| 15-20 | 129.861-129.861 MiB | 2,942.139 MiB | nominal |

The full-run footprint range was .922 MiB and its fitted switch-growth slope was
+28.65 KiB/1,000 switches, inside the frozen 2 MiB / 64 KiB limits. The
130.721 MiB peak is not comparable to the short-trial 84 MiB peak without
accounting for experiment instrumentation: the app preallocates 919,442
56-byte callback records for the 64-frame worst case, 49.10 MiB, before audio
starts. That allocation remained bounded. Thermal and memory sub-axes pass; the
soak as a whole fails mean, p95, and p99 callback budgets.

### External trace findings and blockers

Five raw Instruments captures are accepted under
`build/effects_lane_capacity/device_traces/`. Local filtering used Xcode 26.5
`xctrace export` with table XPath
`/trace-toc/run[@number="1"]/data/table[@schema="..."]`; the managed analyst
redirected only Instruments' disposable cache to `/tmp` because its normal
cache directory was not writable. The accepted capture manifest hashes are App
Launch `4a0db16d286085d05585d8c76f02c7915b08a6462ba43c827ed3b1b0d6ea2baa`,
Audio System `dc87638d08c8dfafbfde9c46fbcaa1d25033e78574cd8f3706e67dc86003bdbc`,
File `0b72076940076a4ecd55d0470956d2bffa3379bbee6c505d9837bd01a99bbba6`,
Network `23517e9b2768ee5e9dc911b9250c7122c825831d71ca9de76a9889e447eeccd7`,
and System `209634f4de02cc0132f3078ffe8c076ce37fe6f08782047d7193a7043740cbcc`.

| Capture | Target-filtered observation | Traced workload integrity | Interpretation |
|---|---|---|---|
| App Launch | PID 7090 and full workload arguments resolved; process creation was 316.53 ms and foreground-active began at 587.997 ms; target exited 0 | 0 misses, 0 discontinuities | Supports bounded launch/startup; not an audio-thread allocation trace |
| Audio System | PID 6945 is in the TOC, but client-cycle tables have no rows and 4,076/4,077 exported HAL rows resolve only to `audiomxd`/Unknown | 2 misses, 5 discontinuities | Target underrun attribution is inconclusive; trace overhead also invalidates this trial as a capacity pass |
| File | PID 6990 is in `process-info`; populated `fs-syscall`, raw-VFS, disk-I/O, descriptor, and antipattern tables contain no target-resolved row | 0 misses, 3 discontinuities | Supporting absence observation only; missing attribution is not promoted to a zero-I/O proof |
| Network | PID 7003 was alive before and after capture but is absent from the recovered exported TOC | 0 misses, 1 discontinuity | Inconclusive; absence cannot mean zero network work |
| System | PID 7037 and `AURemoteIO::IOThread` TID 857171 resolve. Its 7,500 syscall rows are all `mach_msg2_trap`; 4,123 time-profile samples span the 10 s trace with no `malloc`/`calloc`/`realloc`/`operator new`, mutex/ulock, file, or network frame | 0 misses, 3 discontinuities | Supports the direct render path and finds no kernel-visible forbidden call, but statistical samples and unresolved symbols cannot prove literal zero locks/allocations |

Allocations and Power remain exact external-evidence blockers. PID and name
attach failed for the live target under Allocations, its all-process mode is
unsupported, and a launch-mode retry lost the Instruments device. Power
Profiler likewise rejected all-process capture. Every failed attempt is
quarantined under `build/effects_lane_capacity/device_traces/quarantine`,
manifest SHA-256
`7f56c86b2b72af70bbf1dd5ff77fc2ade4c384fef60b265d18c56dd8ed825ec8`,
and none counts as evidence. Therefore framework allocation zero, complete lock
zero, target-resolved network zero, external underrun zero, and an energy/power
profile remain unproven. The local counters and source scan are clean, but the
mandatory external real-time-safety gate is not closed.

`run_device_trial.py` refuses unsigned/stale apps, changed source/generated
hashes, active counts above compiled capacity, invalid plans, and capacity runs
before budget freeze. The complete signed device matrix is separately hashed.

## Estimates and remaining untested hypotheses

Estimates:

- Explicit Cmajor arrays predict most of the two-each generated-state delta;
  generated state measures the remainder.
- Single per-effect discovery pairs suggest Distortion, OTT, Chorus, and Reverb
  dominate incremental active cost, but one trial per cell is insufficient for
  a weighted product cap.

Remaining untested hypotheses:

- A product baseline optimized below the frozen mean/p95 limits will retain
  enough headroom for the measured incremental two-each cost.
- Dependent frameworks perform no post-prepare audio-thread allocation or
  userspace lock operation that escaped executable-local counters and the
  sampled System trace. This remains untested because no accepted Allocations
  capture exists.
- The same curves hold on a supported non-beta iOS release, older target iPhones,
  96/192 kHz, and AUv3. None was measured here.

Remaining risks and evidence limits:

- Physical measurements cover one iPhone 14 Pro on beta iOS 27.0. The device
  granted 48 kHz; 96/192 kHz real-time execution is unmeasured even though
  generated state is sized for the 192 kHz maximum frequency.
- Per-effect discovery points have one physical trial each. The two-each
  candidate has three repeats per block size, but a weighted per-type active cap
  would need repeated matched inactive/active pairs after baseline optimization.
- The direct-performer standalone removes known wrapper confounds. It does not
  qualify AUv3, VST3, MIDI-bearing callbacks, or the shipping `cmaj::Patch`
  wrapper's mutex and bridge behavior.
- Executable-local counters cannot see dependent-framework allocations, locks,
  VM calls, file I/O, or network I/O. The System and File captures are partial
  supporting evidence, while Allocations, target-resolved Audio/Network, and
  Power remain unavailable or inconclusive.
- The fixed four-plan router is a representative cost model, not the future
  routing engine, preset format, tail policy, or automation mapping product.

## Compatibility and failure behavior

No endpoint was removed, renamed, reordered, or converted into a host parameter.
Legacy endpoint migration is explicitly deferred. Internal future lane-device
parameters may remain editable, internally modulatable, and preset-saved, but
must be mapped to the existing permanent macros for DAW automation.

The harness fails closed on invalid control vectors, sample rate, plan bounds,
hash/signature drift, missing budgets, callback/capture record overflow, canary
mismatch, allocator self-test failure, non-finite output, session interruption,
route change, or engine reconfiguration. The app output is muted at the system
mixer, while captured DSP still passes through the fixed 1.15 safety stage.

## Decision

**Architecture approval is deferred; retain the single-performer/preallocated
pool as the only justified candidate, and do not investigate multiple performers
next.** The largest axis-specific point tested cleanly for residency was four
additional instances of every type, and the two-each provisional router passed
its memory/startup/switching checks. Neither is a supported product vector
because the unchanged baseline already fails the absolute callback headroom
contract. There is likewise no evidence-based total active-device limit: the
per-type cost is heterogeneous, discovery pairs are noisy, and every candidate
inherits the baseline failure.

- Conservative supported per-effect pool vector: **none under the frozen
  contract**.
- Provisional product target for the next campaign: **two additional instances
  of each type**, still an assumption rather than an approved limit.
- Largest resident vector physically demonstrated: **four additional instances
  of each type**; this is a measured sizing point, not a comfort limit.
- Total active-device limit: **not justified by the evidence**. Thirty-two
  additional processors ran without a miss for one short trial, but all tested
  mixes failed absolute callback headroom.

This is an explicit statement of insufficient physical evidence for product
feasibility under the declared budgets, not a claim that the performer cannot
run. It ran up to 32 additional active processors without a missed deadline in
the short discovery trial. Splitting performers would not remove the aggregate
DSP cost and is not warranted by the clean inactive results.

The next step is not another routing engine. First integrate the voice and
modulation-limit work, then qualify that same product through
`QA-AUV3-PERF-01`. Run the comparable direct performer through `PERF-01` and
`PERF-02` so product-wrapper cost and performer cost can be interpreted together.
Only after those gates may the team decide on production-engine shape or reopen
a capacity campaign. Investigate separate persistent effect performers only if
that evidence identifies inactive state, startup, resident memory, or unavoidable
idle execution as the limiting axis.
