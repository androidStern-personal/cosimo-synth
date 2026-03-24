# Wavetable Synthesizer - Technical Design Proposal

NOTE: this documents represents the pre-implementation design and is subject to change. Use as guide, not truth.

## System Boundary

Cmajor DSP backend. JS/HTML GUI communicating over PatchConnection. No spectral morphing. Classical band-limited mipmap wavetable playback with phase warp, per-voice filtering, MSEG modulation, and post-voice effects.

This document covers algorithms, data flow, and architectural decisions. No code.

V1 assumption: factory wavetables are precomputed offline and packaged with the patch as shared read-only external data. Runtime wavetable changes select among preloaded tables by index. User wavetable import/edit and hot-swap are future work.

## 1. Wavetable Data Model

### 1.1 Terminology

A wavetable is an ordered collection of frames (single-cycle waveforms). A user-facing "wavetable position" knob scans across frames. Each frame has multiple mipmap levels - band-limited versions of itself at progressively lower harmonic counts, spaced one octave apart.

### 1.2 Dimensions

| Parameter                | Value | Rationale                                                                                                                                         |
| ------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Samples per frame        |  2048 | Common power-of-two size with good FFT behavior and broad Serum-style wavetable compatibility.                                                    |
| Max frames per wavetable |   256 | Matches Serum's documented upper bound and comfortably covers dense wavetables.                                                                   |
| Mipmap levels per frame  |    11 | One-octave spacing from 1 harmonic through 1024 harmonics. Covers the practical harmonic-count range for a 44.1 kHz system.                       |
| Extra samples per buffer |     3 | Wrap padding for a 4-point cubic interpolation read. The implementation uses one wrapped sample on the left and two on the right so the hot read path can use `base + i .. base + i + 3` without modulo branches. |

### 1.3 Memory Layout

Each mipmap level stores 2051 floats (2048 + 3 wrap samples). Total raw storage for one maximum-size wavetable:

```text
256 frames x 11 levels x 2051 samples x 4 bytes ~= 22.5 MB
```

Typical wavetables with 64 frames cost about 5.6 MB. In v1 this data is packaged with the patch and shared across voices as read-only external content rather than duplicated per voice.

### 1.4 Mipmap Level Assignment

Mipmap level `k` (0-indexed) contains harmonics up to `2^k`. Level 0 has only the fundamental. Level 10 has up to 1024 harmonics.

At runtime, given a voice's phase increment `DeltaPhi` in cycles per sample, the largest alias-safe harmonic count is:

```text
maxHarmonics = clamp(floor(1.0 / (2.0 * DeltaPhi)), 1, 1024)
```

The mipmap level is then:

```text
level = clamp(floor(log2(maxHarmonics)), 0, 10)
```

This chooses the largest mip level whose harmonic count does not exceed Nyquist for the current pitch.

## 2. Mipmap Generation Pipeline

This runs offline in Python tooling, not in the Cmajor audio path. Zero FFT at runtime.

### 2.1 Steps (per frame)

1. FFT the 2048-sample time-domain frame into 1025 complex bins (DC through Nyquist).
2. For each mipmap level `k` (0 through 10):
   - Copy the frequency-domain data.
   - Zero all bins above index `2^k`.
   - iFFT back to 2048 time-domain samples.
   - Write the padded frame as `[last, frame[0..2047], first, second]` so cubic reads can use `base + i .. base + i + 3`.
3. Pack the result into a flat `Float32Array` or equivalent build-time resource format.

### 2.2 Offline Compiler Notes

Use the existing Python toolchain for this build step. NumPy and SciPy already provide the real-input FFT and inverse FFT the bank compiler needs, and they keep the offline bank pipeline in the same language and test harness as the rest of the build tooling. If a browser-side editor is added later, that separate UI path will need its own FFT backend, but that is outside the v1 compiler path. Build time depends on the chosen implementation, platform, and wavetable size, so any exact latency target should be measured on the real target platforms rather than baked into the design.

### 2.3 Normalization

After band-limiting, each mipmap level will have different peak amplitude. Two options:

- Do not normalize. Accept that lower mipmaps are quieter. This preserves the natural loss of high-frequency energy at high pitches and avoids level jumps at mip boundaries.
- Normalize per level. Scale each mipmap so peak matches the original. This can make octave transitions more level-consistent, but it increases the chance of audible discontinuities when crossing mip boundaries.

Recommendation for v1: do not normalize unless level-matching becomes a user experience issue during sound-design testing.

## 3. Data Transport: JS -> Cmajor

### 3.1 Endpoint Design (v1)

In v1, factory wavetable data is loaded as shared read-only external content when the patch is loaded. Runtime wavetable changes select among preloaded tables by index rather than pushing full wavetable banks over PatchConnection.

Proposed v1 endpoint:

```text
input event int wavetableSelect;   // Select active preloaded wavetable
```

PatchConnection is still used for regular parameter changes, MSEG buffers, and display/diagnostic endpoints.

### 3.2 Optional Custom Import Path (future work)

If user-imported tables are added later, the GUI-side mipmap generation pipeline remains valid. Bulk transport from JS to DSP should then be treated as a prototype item rather than a solved part of v1 architecture. PatchConnection can send array/object payloads to event endpoints, but real throughput, chunk sizing, and buffering behavior need validation on the target host/runtime.

For that future feature, the mutable wavetable store should live inside a stateful processor, not in a graph.

### 3.3 Double-Buffering (future work)

If hot-swap import is added, the processor that owns wavetable memory should maintain active and staging banks. Loads write into staging, then swap at a safe boundary. This avoids mid-update reads of partially written table data.

## 4. Per-Voice Oscillator

### 4.1 Phase Accumulator

Use a normalized floating-point phase accumulator in Cmajor:

```text
phase: float64 in [0, 1)
phaseIncrement: float64 in cycles/sample

phase += phaseIncrement
if phase >= 1.0:
    phase -= 1.0
```

To index into the 2048-sample frame:

```text
x = phase * 2048.0
sampleIndex = floor(x)        // 0..2047
fractional  = x - sampleIndex // 0.0..1.0
```

This avoids relying on unsigned overflow semantics and fits the current Cmajor type model cleanly.

### 4.2 Pitch Tracking

```text
phaseIncrement = noteFrequencyHz / sampleRate
```

The frequency incorporates MIDI note, pitch bend, tuning, detune (for unison), and any pitch modulation.

### 4.3 Mipmap Selection

From `phaseIncrement`:

```text
maxHarmonics = clamp(floor(1.0 / (2.0 * phaseIncrement)), 1, 1024)
level = clamp(floor(log2(maxHarmonics)), 0, 10)
```

V1 default: hard-switch mip levels at octave boundaries. One mip per octave is usually a good perceptual tradeoff between quality and simplicity.

Optional smoothing path for prototyping:

```text
harmonicLog = log2(maxHarmonics)
levelLo = clamp(floor(harmonicLog), 0, 10)
levelHi = clamp(levelLo + 1, 0, 10)
levelT = harmonicLog - floor(harmonicLog)
```

If adjacent-level smoothing is enabled, it is a perceptual smoothing tradeoff rather than a strict alias-free guarantee, because the higher adjacent level may contain more harmonics than the conservative hard-switched choice.

### 4.4 Sample Interpolation - Catmull-Rom Cubic

For each sample output, read 4 adjacent points from the selected mipmap buffer and apply Catmull-Rom interpolation:

```text
Given points p0, p1, p2, p3 and fractional position t (0..1):
out = p1 + 0.5 * t * (
    (p2 - p0) + t * (
        (2*p0 - 5*p1 + 4*p2 - p3) + t * (
            -p0 + 3*p1 - 3*p2 + p3
        )
    )
)
```

The implementation uses this fixed read neighborhood:

```text
base = table.sampleOffset + (((mip_index * table.frameCount) + frame_index) * 2051)
p0 = sampleBlob.frames[base + i]
p1 = sampleBlob.frames[base + i + 1]
p2 = sampleBlob.frames[base + i + 2]
p3 = sampleBlob.frames[base + i + 3]
```

with padded frames stored as `[last, frame[0..2047], first, second]`. This makes boundary reads valid without paying a per-sample modulo cost in the hot path.

### 4.5 Frame Scanning (Wavetable Position)

The wavetable position parameter (0.0 to 1.0, modulated by LFO/envelope/MSEG) maps to a fractional frame index:

```text
frameIndex = wavetablePosition * (numFrames - 1)
frameLo = floor(frameIndex)
frameHi = min(frameLo + 1, numFrames - 1)
frameT  = frameIndex - frameLo
```

Read from both `frameLo` and `frameHi` at the selected mipmap level, then linearly interpolate the two cubic-interpolated results:

```text
out = lerp(readCubic(frameLo, level, phase),
           readCubic(frameHi, level, phase),
           frameT)
```

With the v1 hard-switched mip policy, this is 2 cubic reads per sample in the common case (8 point lookups). If optional adjacent-level smoothing is enabled, this becomes 4 cubic reads per sample (16 point lookups).

## 5. Phase Warp (Distortion)

Phase warp modifies the read phase after the base accumulator and before the wavetable lookup.

### 5.1 Hard Sync

Reset the oscillator's phase accumulator when a virtual sync oscillator completes a cycle. The sync oscillator runs at a different frequency set by the sync ratio parameter.

```text
syncPhase += syncIncrement
if syncPhase wrapped:
    oscillatorPhase = 0
```

This produces the classic sync sweep. Anti-aliasing beyond the underlying band-limited tables is out of scope for v1, so hard sync can still alias at extreme settings.

### 5.2 Bend

Piecewise-linear phase remapping. Accelerate through the first half of the cycle and decelerate through the second, or vice versa, controlled by a bend amount parameter.

```text
if phase < 0.5:
    warpedPhase = phase * (1 + bendAmount)
else:
    warpedPhase = 0.5 * (1 + bendAmount) + (phase - 0.5) * (1 - bendAmount)
```

The mapping is normalized so the full cycle still lands on 0..1.

### 5.3 Squeeze / Formant

Compress the waveform into a portion of the cycle, filling the remainder with a DC value.

```text
warpedPhase = phase / squeezeAmount   // if < 1.0, read from table
                                      // if >= 1.0, output DC
```

This creates formant-like effects as the squeezed waveform's harmonics shift upward.

### 5.4 Phase Modulation (PM)

Add a modulation signal directly to the read phase:

```text
effectivePhase = phase + pmDepth * modulatorSample
```

Wrap `effectivePhase` back into 0..1 before the lookup. This is phase modulation rather than strict increment-modulated FM, but it serves the intended audio-rate sideband use case cleanly in a wavetable oscillator. As with other digital PM/FM-style modes, strong modulation can alias.

### 5.5 Pulse Width

For a single-waveform PWM effect, remap the read position around a variable midpoint:

```text
if phase < pulseWidth:
    warpedPhase = phase * (0.5 / pulseWidth)
else:
    warpedPhase = 0.5 + (phase - pulseWidth) * (0.5 / (1 - pulseWidth))
```

## 6. MSEG Modulation System

Carried forward from prior architecture work. Buffer-based pre-rendered approach.

### 6.1 Architecture

8 MSEG slots. Each MSEG is pre-rendered in the JS GUI into an 8192-sample float buffer representing one full envelope cycle. The buffer is sent to the Cmajor processor via event endpoint.

```text
input event float[] msegBuffer;   // 8192 floats per MSEG
input event int     msegSlot;     // which slot (0-7) this buffer targets
```

### 6.2 MSEG Evaluation

Cubic bezier evaluation happens in JS at render time. The Cmajor processor just reads from the pre-rendered buffer using a phase accumulator, with the MSEG's rate/sync setting controlling the accumulator speed.

```text
msegPhase += msegIncrement
msegValue = cubicInterpolate(msegBuffer, msegPhase * 8192)
```

### 6.3 Mod Matrix

The mod matrix maps MSEG outputs and other sources (velocity, aftertouch, LFOs, envelopes) to destinations (wavetable position, filter cutoff, warp amount, amplitude, pan, etc.). This is a fixed-size routing table in the Cmajor processor:

```text
struct ModRoute {
    int sourceIndex;
    int destIndex;
    float depth;
}
```

Up to 32 routes. Evaluate at block rate for slow destinations, and at sample rate only where genuinely needed (for example pitch, PM amount, or fast filter modulation).

## 7. Per-Voice Filter

### 7.1 Topology

TPT SVF using Cmajor's filter library. One filter per voice, placed after the oscillator.

### 7.2 Modes

V1 modes: low-pass, high-pass, and band-pass. Notch can be derived from multimode outputs or deferred to a later revision. A series/parallel dual-filter architecture is also future work rather than a v1 requirement.

### 7.3 Drive

Pre-filter soft-clip saturation. Apply `tanh(input * driveAmount)` before the filter input.

### 7.4 Modulation

Filter cutoff and resonance are primary mod matrix destinations. Keyboard tracking (cutoff follows pitch) is hardwired with a configurable tracking amount (0-100 percent).

For slow modulation, event-rate or block-rate updates are fine. For audio-rate cutoff modulation, the implementation should either reduce the filter parameter update interval or use the lower-level filter implementation directly rather than relying on the default processor update cadence.

## 8. Voice Architecture

### 8.1 Voice Allocation

Raw MIDI/MPE input is converted to note events with `std::midi::MPEConverter`. Polyphony is managed with `std::voices::VoiceAllocator`, which routes note events to an array of voice processors. Each voice processor instance owns its own phase accumulator, filter state, envelope state, and MSEG phase.

### 8.2 Per-Voice Signal Chain

```text
Oscillator (mipmap lookup + phase warp)
  -> Drive (soft-clip)
  -> SVF Filter
  -> Amplitude Envelope (ADSR)
  -> Pan
  -> Voice Output
```

### 8.3 Unison

Each allocated MIDI voice spawns `N` unison sub-voices (up to 8). These share the same note but have:

- Detuned pitch (spread parameter)
- Spread wavetable position (frame spread parameter)
- Stereo spread (pan offset per sub-voice)

Unison sub-voices are implemented as a loop inside the voice processor, not as separate polyphonic voice allocations. This is important: `VoiceAllocator` handles note polyphony, while unison is an inner-layer oscillator stack inside each note voice.

This means the oscillator inner loop runs `N` times per sample per allocated voice. At 8 unison x 8 polyphony, that is 64 oscillator evaluations per sample. At 44.1 kHz, that is about 2.82 million oscillator evaluations per second. With hard-switched mip levels, each evaluation is 2 cubic reads (8 table-point loads), or about 22.6 million table-point loads per second. Optional adjacent-level smoothing roughly doubles the table reads. This is still reasonable for a desktop target, but it should be validated by profiling rather than assumed from paper math.

### 8.4 Polyphony Target

16 voices (MIDI polyphony) x 8 unison = 128 oscillator instances at maximum. Typical usage is closer to 8 voices x 4 unison = 32 instances. The mipmap approach keeps per-instance work to arithmetic plus memory reads - no FFT and no spectral processing in the realtime path.

## 9. Post-Voice Effects Chain

Effects operate on the summed voice output (stereo bus), not per voice.

### 9.1 Proposed Chain (v1)

```text
Voice Sum -> Chorus -> Delay -> Reverb -> Limiter -> Output
```

### 9.2 Effect Specifications

Chorus: stereo modulated delay with 2-3 taps. LFO-modulated delay time in the 1-20 ms range.

Delay: stereo ping-pong or straight. Tempo-syncable. Feedback with a one-pole filter in the feedback path to simulate high-frequency loss.

Reverb: algorithmic plate or hall. FDN with 8 delay lines and a Hadamard mixing matrix. Damping filter per delay line.

Limiter: simple lookahead brickwall to prevent clipping at the output.

### 9.3 Effect Bypass

Each effect has a runtime bypass path implemented inside the effect processor or via a wet/dry mix path. Graph-level conditional routing is not used for runtime bypass.

## 10. Cmajor Processor Graph

### 10.1 Top-Level Structure

Illustrative pseudo-structure:

```text
graph WavetableSynth [[ main ]]
{
    input event std::midi::Message midiIn;
    input event int     wavetableSelect;
    input event float[] msegBuffer;
    input event int     msegSlot;
    // ... parameter inputs (cutoff, resonance, warp, etc.)

    output stream float<2> audioOut;

    node mpe        = std::midi::MPEConverter;
    node allocator  = std::voices::VoiceAllocator;
    node voices     = Voice[16];
    node chorus     = ChorusEffect;
    node delay      = DelayEffect;
    node reverb     = ReverbEffect;
    node limiter    = LimiterEffect;

    // Raw MIDI -> note events -> voice allocation -> summed stereo bus -> FX chain
}
```

The exact wiring depends on the concrete `VoiceAllocator` integration pattern, but the architectural split is fixed: MIDI/MPE conversion, voice allocation, summed voice bus, then post-voice effects.

### 10.2 Voice Processor

```text
processor Voice
{
    // Receives routed note events from VoiceAllocator
    // Contains oscillator state, filter state, envelope state, and unison loop
    // Reads shared preloaded wavetable data and per-voice modulation state
}
```

### 10.3 Shared State

For v1, shared factory wavetable banks are the clean path:

1. Wavetable banks are precomputed offline.
2. The patch manifest provides them as `external` data.
3. All voices read the same shared read-only wavetable bank.
4. Runtime changes choose among preloaded banks by index.

This avoids per-voice duplication entirely for the baseline instrument. The shared bank is a single `external` object containing the flat sample blob plus per-table metadata. The sample blob is loaded from an audio resource in the patch bundle, and the table metadata comes from the manifest's normal JSON object coercion.

If user-imported hot-swap tables become a product requirement later, the mutable wavetable store should move into a single stateful processor that owns active/staging buffers. Graphs should not be treated as owning mutable state, and `external` data should not be treated as a runtime-write path.

## 11. GUI <-> DSP Interaction Model

### 11.1 PatchConnection Bridge

The JS GUI communicates with the Cmajor processor via `PatchConnection`:

- Parameters (knobs, sliders): sent as parameter value changes. Cmajor exposes these as `input value` or `input event` endpoints.
- Bulk control data (MSEG buffers, optional future editor/import data): sent via event endpoints carrying array payloads.
- Display data (waveform visualization, oscilloscope, meters): Cmajor sends data back via `output event` endpoints.

### 11.2 Wavetable Editor (GUI-Side)

The product can still have a wavetable browser and editor architecture on the GUI side. In v1, factory wavetables are authored and mipmapped offline, then packaged with the patch. The DSP side only selects among these precomputed assets.

If a later revision adds user import or direct wavetable editing, all FFT work, frame interpolation for import, and mipmap generation should still remain outside the realtime DSP path.

### 11.3 Latency Budget

V1 wavetable switching is effectively a table-index change among preloaded assets, so it should feel immediate from the user's perspective.

If future user-import/hot-swap is added, end-to-end latency will depend on mipmap generation time, host/runtime event throughput, and the chosen staging/swap strategy. That path should be measured on the target platforms rather than specified from paper estimates.

## 12. MPE Support

MPE support enters through `std::midi::MPEConverter`, which produces per-note events such as `PitchBend`, `Slide`, and `Pressure`. Proposed mappings:

- Slide (CC74): filter cutoff, wavetable position, or another mod matrix destination
- Pressure: amplitude, vibrato depth, or drive
- Pitch bend (per note): applied directly to voice pitch

These per-note sources are routed through the mod matrix like any other voice-local modulation source.

## 13. Performance Estimates

### 13.1 Per-Oscillator Evaluation Cost (order of magnitude)

| Operation                | Approximate cost                                                         |
| ------------------------ | ------------------------------------------------------------------------ |
| Phase accumulator update | A few floating-point ops                                                 |
| Phase warp computation   | 3-10 ops, warp-dependent                                                 |
| Mip level selection      | A `log2`/`floor` path when pitch changes materially; otherwise cached    |
| Cubic interpolation      | 2 cubic reads in v1 default path; 4 if optional mip smoothing is enabled |
| Frame interpolation      | 1 lerp                                                                   |
| Drive                    | 1 `tanh` or approximation                                                |
| SVF filter tick          | Roughly tens of arithmetic ops                                           |
| Envelope                 | A few ops                                                                |

The exact counts will depend on how aggressively the implementation caches pitch-derived values and how modulation is scheduled. The realtime cost is dominated by table reads, cubic interpolation, and filter work.

### 13.2 Scaling

At 44.1 kHz, 16 voices, and 4 unison:

```text
44,100 x 16 x 4 = 2,822,400 oscillator evaluations per second
```

With hard-switched mip levels, that corresponds to roughly:

```text
2,822,400 x 8 ~= 22.6 million table-point loads per second
```

With optional adjacent-level smoothing enabled, that roughly doubles.

One mip level is about 8.0 KiB (`2051 x 4 bytes`). Two adjacent levels across two frames are about 32 KiB of table data in the fully smoothed read path. Real cache behavior will depend on voice count, frame spread, modulation rate, and host block size.

Conclusion: the oscillator path is desktop-feasible, but final CPU claims should be based on profiling in the real patch rather than on static FLOP estimates.

### 13.3 Cmajor vs Hand-Written SIMD

A hand-written SIMD oscillator core may still outperform a more general implementation, but the proposal should be judged on measured end-to-end performance rather than on assumed scalar-vs-SIMD ratios. The current design keeps the inner loop structurally simple enough that profiling should drive any later optimization step.

## 14. Open Questions for Prototyping

1. Mip policy: is one-per-octave hard switching sufficient, or is adjacent-level smoothing audibly worthwhile?
2. Filter modulation mode: does the stock processor update cadence suffice, or should cutoff modulation move to a lower-level implementation for audio-rate cases?
3. Unison count: is 8 necessary for v1, or does 4 cover the practical sound-design space?
4. Future custom import: if user wavetable hot-swap becomes a requirement, what chunk size and ownership model perform best on the actual target hosts?
5. Effect scope: for v1, should chorus ship alongside delay and reverb, or should it wait for a later revision?


### 15 Phase Plan

Foundation layer

1. Reference fixtures and render harness

Build a tiny fixed test set before touching the real synth. A few tables are enough: sine, saw, square, one bright complex table, and one “nasty” edge-case table.

This unit exists so every later block can be judged the same way: fixed notes, fixed sweeps, fixed parameter moves, and repeatable offline renders. Without this, every test turns into “does this sound kind of right?”

2. Wavetable bank pipeline

Treat the whole path from raw frame data to packaged immutable bank as one module. That includes FFT/iFFT mip generation, harmonic truncation, wrap padding, metadata, and the packed layout that Cmajor will read.

This is worth isolating because it has no realtime concerns at all. You should be able to validate it entirely offline: harmonic caps per mip, padding correctness, level counts, frame counts, and deterministic pack/unpack behavior.

Oscillator core

3. Fixed-frame read kernel

This is the hottest loop in the whole synth, so it deserves its own unit. Keep it brutally small at first: phase accumulator, phase-to-index mapping, and Catmull-Rom lookup from one fixed frame at one fixed mip level.

No frame scanning. No mip switching. No warp. No modulation. Just “can I read a single cycle cleanly and at the correct pitch?”

4. Mip selection policy

Once the fixed read kernel is stable, add only the logic that maps pitch to mip level. Keep it separate because this is where aliasing policy lives, and you’ll want to A/B hard switching against optional adjacent-level smoothing without touching the core lookup code.

This unit should answer one question cleanly: “For a given phase increment, which table do I read?”

5. Frame scanning layer

Now add wavetable position. This unit owns frameLo, frameHi, frameT, and the crossfade between two already-working cubic reads.

That makes it easy to test by sweeping position slowly through a table and listening for clicks, level jumps, or weird interpolation behavior, without any warp or modulation muddying the waters.

6. Warp layer

Treat warp as a phase-transform module that sits between base phase generation and lookup. Bend, squeeze, pulse-width style remap, and PM all fit that pattern. Hard sync is the outlier because it adds a second phase source and reset behavior, so I’d still keep it under the same umbrella, but test it as a separate sub-unit.

This boundary is good because it lets you answer “is the oscillator wrong?” versus “is the phase remap wrong?” without guessing.

Voice engine

7. Filter and drive block

Build the drive plus SVF as a standalone audio processor before wiring it into the full voice. Feed it oscillator output or even noise and prove the basics: stability, resonance behavior, keyboard tracking, and modulation cadence.

This keeps filter problems from being mistaken for oscillator problems.

8. Mono voice shell

Now make the first actually musical thing: one note voice with note on/off, ADSR, oscillator, optional filter, gain, and pan.

At this stage, avoid the allocator. Feed it synthetic note events and make sure voice start, sustain, release, and cleanup are all clean. This is your first “playable” milestone.

9. Polyphony engine

Only after the mono voice is boringly reliable should you add MPEConverter plus VoiceAllocator and multiple voices.

Keep MPE expression turned off at first. This unit is just about lifecycle: note assignment, note stealing, release tails, and shared-bank access across many voices.

Modulation and control

10. Modulation core

This is one of the places I’d split more aggressively than your current phases. Build the mod matrix before MSEG.

Start with simple sources only: constants, velocity, ADSR, a plain LFO, maybe aftertouch if available. This unit owns route storage, depth scaling, destination accumulation, and the rule for what runs at block rate versus sample rate.

That gives you a clean plumbing layer before GUI buffer transport enters the picture.

11. MSEG subsystem

Now bolt MSEG onto the already-existing modulation core. This unit includes the JS-side pre-render, PatchConnection transport, slot addressing, DSP-side playback, and its exposure as just another modulation source.

That keeps MSEG from becoming “the modulation system.” It’s just one source type.

12. Unison layer

Add unison only after a single voice and the mod plumbing are stable. It is a multiplier on almost everything: CPU, level staging, stereo behavior, and modulation distribution.

Because it lives inside the voice, it should stay its own unit: detune spread, frame spread, pan spread, phase behavior, and gain compensation. This is where you want focused profiling before any bus FX are active.

13. MPE mappings

MPE should come after polyphony and after the mod system. That way per-note pitch bend, slide, and pressure are just extra source signals feeding a known routing layer.

This prevents “basic note handling” bugs from being confused with “expressive control” bugs.

Output layer

14. Post-voice FX bus

Treat the FX chain as bus processors, not as part of the voice engine. And inside this layer, each effect is its own mini-unit: chorus, delay, reverb, limiter.

Each one should get its own standalone bypass and stability tests before you wire the chain together. Otherwise reverb and limiter can hide gain-staging or CPU problems coming from the core synth.

How I’d build it, in order

I’d do it in these milestones:
	1.	Audible oscillator: units 1 through 5.
This gets you a band-limited scanning wavetable oscillator with no voice complexity.
	2.	Playable synth core: units 7 through 9.
Now it’s a real instrument: filter, mono voice, then polyphony.
	3.	Modulated synth: units 10 and 11.
Build the routing plumbing first, then add MSEG as a source.
	4.	Character and scale: units 6, 12, and 13.
Warp, then unison, then MPE. These add personality, but they also multiply debug surface, so I’d keep them out of the early core.
	5.	Finish and productize: unit 14, plus the real GUI/preset layer.
By now the sound engine is already trustworthy, so UI work is mostly control and presentation.

One important framing choice

I would not treat the GUI/PatchConnection side as one giant late-phase feature. I’d keep it as a thin adapter around whatever unit is currently under test.

Early on, that might just be:
	•	wavetable select
	•	a few oscillator params
	•	one debug render or meter
	•	later, MSEG upload

That way the GUI stays a test panel until the DSP architecture is settled.

Boundaries worth freezing early

There are four contracts I’d lock down very early:
	•	Phase is always normalized 0..1 everywhere.
	•	The cubic read neighborhood and the wrap-padding convention are one fixed contract.
	•	Modulation source ranges are explicit and consistent, especially bipolar versus unipolar.
	•	Mutable state ownership is clear: bank data is shared read-only, voices own voice state, FX own bus state, GUI owns editor-only structures.

Those four choices stop a lot of ugly refactors later.

Things I would deliberately keep as experiments, not architecture

Adjacent-level mip smoothing, per-level normalization, audio-rate filter update strategy, max unison count, and chorus-in-v1 are all good prototype questions. I wouldn’t let any of them block the baseline design.

The cleanest mental model is this:

Immutable bank
→ oscillator read path
→ mono voice
→ polyphony
→ modulation
→ expressive extras
→ bus FX

That gives you a chain where every step is testable on its own and every later step sits on a smaller set of already-proven pieces.

A useful next step is a one-page checklist with a “done means…” acceptance test for each unit.
