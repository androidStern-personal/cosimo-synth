# Transient Unison Implementation Plan

This is a working implementation plan for the current unison goal. It is not a durable product spec.

## V1 Product Contract

Cosimo adds Serum-style unison control-model parity without trying to clone Serum's exact oscillator math. One allocated MIDI voice still means one synth voice. Unison is an oscillator sub-voice layer inside that allocated voice.

Default state must preserve today's synth:

- `Unison = 1`
- phase memory is contiguous/free-running
- detune, width, wavetable-position spread, warp spread, blend, mode, stack, phase, and random do not change audio while `Unison = 1`

## Parameters

- `unisonVoices`: integer `1..8`, default `1`, host automatable as a stepped parameter.
- `unisonDetune`: `0..1`, default `0.10`, maps to `0..50` cents before stack offsets and pitch modulation.
- `unisonBlend`: `0..1`, default `0.75`. At `0`, only center voice(s) are audible. At `0.75`, center and side voices have equal pre-normalized weights.
- `unisonWidth`: `0..1`, default `1`. `0` collapses sub-voices to the base pan; `1` spreads sub-voices across the stereo field around base pan.
- `unisonPhase`: `0..1`, default `0`. Used as the restart phase when phase memory is reset.
- `unisonRandom`: `0..1`, default `0`. Adds deterministic per-note/per-sub-voice phase offset when phase memory is reset.
- `unisonPhaseMode`: integer `0..1`, default `0`.
  - `0`: contiguous/free-running phase, the current Cosimo behavior.
  - `1`: reset phase on note start/retrigger using `unisonPhase` plus `unisonRandom`.
- `unisonDetuneMode`: integer `0..4`, default `0`.
  - `0`: Linear
  - `1`: Super
  - `2`: Exp
  - `3`: Inv
  - `4`: Random
- `unisonStackMode`: integer `0..4`, default `0`.
  - `0`: Off
  - `1`: `12`, voices distributed through octave layers.
  - `2`: `12+7`, voices distributed through octave/fifth layers.
  - `3`: Center-12, center voice(s) down one octave.
  - `4`: Center-24, center voice(s) down two octaves.
- `unisonWtPositionSpread`: `0..1`, default `0`, spreads frame position around the effective wavetable position by up to `+/-0.5`.
- `unisonWarpSpread`: `0..1`, default `0`, spreads warp amount around the effective warp amount by up to `+/-0.5`.

## DSP Rules

- Keep the existing single-oscillator path for `Unison = 1`. This is the no-regression path.
- For `Unison > 1`, loop sub-voices inside `SharedVoiceEngine`.
- Each sub-voice has its own phasor and its own warp oversampling decimator history.
- Filters remain one filter stage per allocated MIDI voice:
  - `Unison = 1`: use the current mono filter path, then base pan.
  - `Unison > 1`: build a stereo sub-voice mix first, then use left/right filter state for that allocated voice.
- Gain compensation normalizes sub-voice weights by summed absolute weight so detune-zero unison does not get louder simply because more sub-voices are active.
- Existing pitch bend, glide, mono, legato, MSEG, filter, warp, articulation, and modulation behavior must remain unchanged when `Unison = 1`.

## Modulation And Automation

All new Cmajor input value parameters are host parameters unless explicitly discrete. The modulation matrix adds continuous targets:

- `unisonDetune`
- `unisonBlend`
- `unisonWidth`
- `unisonWtPositionSpread`
- `unisonWarpSpread`

The modulation matrix does not route to `unisonVoices`, detune mode, stack mode, phase mode, phase, or random in v1.

## Articulations

Articulation snapshots include every new unison parameter. Runtime articulation uploads mirror those fields into Cmajor. A note that uses an articulation latches that articulation's unison settings at note start, the same way it latches frame position, pan, warp, filter, MSEG morphs, envelope values, and mod-route amounts.

## UI And Visualization

The desktop synth gets a compact unison panel matching the existing dark synth panel language. It should sit with the voice/glide controls rather than becoming a large modal.

The visualization must show:

- active voice count
- pitch detune distribution
- stereo width distribution
- wavetable-position spread
- warp spread
- stack/tuning offsets

The visualization is a functional readout, not decoration. It must fit dense producer workflow: compact controls, mono numeric readouts where useful, and visible state without instructional copy.

## Acceptance Criteria

- Existing Cmajor warp fixtures pass unchanged with `Unison = 1`.
- Existing Cmajor filter fixtures pass unchanged with `Unison = 1`.
- Existing Python probes for shared voice behavior, modulation, tracking pitch, note dispatch, and runtime table switching still pass.
- New DSP tests prove:
  - `Unison = 1` matches the old single path for oscillator, warp, filter, pan, mono/legato, and polyphonic cases.
  - `Unison > 1` does not allocate extra MIDI/polyphonic voices.
  - detune creates measurable pitch-sideband or stereo decorrelation behavior.
  - width changes stereo distribution while preserving mono behavior at width `0`.
  - wavetable-position spread reads multiple frame positions.
  - warp spread reads multiple warp amounts with independent warp history.
  - phase reset/random behavior is deterministic when random is `0` and changes the onset when random is nonzero.
  - stack modes produce expected semitone-offset families.
- New modulation tests prove the five continuous unison modulation targets change effective audio behavior and clamp safely.
- New articulation tests prove snapshots capture, normalize, upload, recall, dirty-check, and replace all unison fields.
- Browser/UI tests prove the unison controls render, clamp/commit values, expose the visualization, and preserve existing keyboard routing.
- Performance evidence covers the agreed worst case for this implementation: 16 polyphonic MIDI voices x 8 unison sub-voices at 44.1 kHz, including warp-enabled render. The implementation should remain fast enough for interactive desktop use; any iOS risk is reported explicitly.
- Final delivery runs the regression suite selected above, builds and installs `/Users/winterfell/Library/Audio/Plug-Ins/VST3/CosimoDesktopNative.vst3`, and launches the standalone dev synth against `http://127.0.0.1:5174`.
