# Enhancer Lite Shelf Measurement And Reproduction Findings

Status: implemented and automatically qualified with one explicit Ableton editor-load gap, 2026-08-27. This document covers only the Low Shelf and High Shelf modes of Wavesfactory Spectre 1.5.6 and their application to Cosimo Enhancer Lite. The accepted Bell implementation remains governed by `ENHANCER_MATCHING_FINDINGS.md`, `ENHANCER_DEEMPHASIS_FINDINGS.md`, and `ENHANCER_WRAPPER_PROTOTYPE_FINDINGS.md`.

## Evidence Set

`scripts/measure_spectre_enhancer_shelves.py` renders and analyzes the activated AU without using its editor. The complete local corpus is at `build/t26-spectre-shelves`:

- 284 cases, 20 generated stimuli, 17 fresh plugin sessions;
- 374 saved files and 382,212,268 saved audio/data bytes;
- impulse responses at 44.1, 48, 96, and 192 kHz;
- Low and High shelves across Frequency, Gain, and Q;
- Subtle/Medium, Solid/Tube, three input levels, and representative routing;
- mono-correlated, pure Mid, pure Side, left-only, and right-only material;
- 9 kHz alias probes at 48 kHz;
- four musical stimuli with both raw and static LUFS-matched outputs;
- three fresh-instance repeat renders, bit-identical with a maximum absolute difference of 0.

The full report and raw row table are ignored build evidence. Their current SHA-256 hashes are:

- `report.json`: `17e56c3b5fcb0ab1eb300c4934f6aae593982dafb531c740e9055685e7663c83`
- `measurements.json`: `fe9e29bfc7f0f937447ba959aea30305471f061970577f813a49e4ef774661aa`

`tests/fixtures/enhancer_spectre_shelves_v1.json` is the compact, committed golden. It retains provenance, fit rankings, representative complex-response anchors, rate checks, distortion error, alias levels, and listening-bundle bounds.

## Decoded Facts

These are observations, not model assumptions.

- Spectre exposes separate activated Low Shelf and High Shelf bands. Each has Frequency, Gain, Q, Color, and Processing controls.
- Frequency spans 20 Hz to 20 kHz, Gain spans 0 to 12 dB, and Q spans 0.1 to 10. The editor and host both call the third control **Q**, not Slope.
- The Frequency host parameter is quantized through Spectre's display law. For example, a nominal 10 kHz request resolves to a displayed/effective 10023.74 Hz. Comparisons must use the displayed value.
- A zero-Gain shelf contributes no selected signal. It does not reveal evidence for a hidden dynamic or auto-gain stage.
- Stereo processing applies the selected contribution independently to both channels. Mid applies it to the Mid component while leaving Side dry; Side applies it to Side while leaving Mid dry. Left/right symmetry is preserved.
- The four previously decoded fixed shapers continue to predict the shelf harmonic spectra. Across the shelf corpus, the worst harmonic-point error is 0.44645 dB and the worst row RMS error is 0.13353 dB.
- No shelf-specific latency was observed beyond Spectre Good's already decoded 4x wrapper. The selected impulse is pre/post-ringing because the wrapper is the same JUCE 7.0.1 maximum-quality FIR path used by Bell.
- The static level match required by the 32 musical listening renders ranges from 0 to -11.1 dB. This is ordinary static output matching, not evidence of a signal-dependent compensator.

## Inferred Selection Model

Both shelves are explained by the same topology:

1. Construct a full RBJ/JUCE Q-form Low Shelf or High Shelf at four times the host sample rate.
2. Use the displayed Frequency directly.
3. Use the displayed Q directly. Unlike Spectre Bell, there is no measured gain-dependent `Q * sqrt(A)` conversion.
4. Set `A = 10^(Gain dB / 40)` where `Gain dB = 12 * Amount`.
5. Normalize the biquad coefficients by `a0` and take `H(z) - 1`; this is the selected contribution sent into the fixed shaper.
6. After reconstruction, apply Spectre's already decoded selected-path conditioner: a 20.01631809314913 Hz, Q 0.7071067811865476 second-order high-pass with linear gain 1.0023994109214078.
7. Add the conditioned shaped contribution to the latency-matched dry path.

For `w0 = 2*pi*Frequency/(4*hostRate)`, `A = 10^(Gain/40)`, and `beta = sin(w0)*sqrt(A)/Q`, the candidate uses the standard RBJ/JUCE Q-form shelf coefficients. The measured object is the normalized transfer minus unity, not a low-pass/high-pass selector.

The design-rate comparison is decisive:

| Candidate rate | Mean magnitude RMS error | Mean phase RMS error |
| --- | ---: | ---: |
| 1x | 1.34388 dB | 3.01380 deg |
| 2x | 0.21121 dB | 0.56342 deg |
| **4x** | **0.02081 dB** | **0.02322 deg** |
| 8x | 0.06751 dB | 0.13193 deg |

Across all linear cases, the direct 4x model has a worst magnitude RMS error of 0.020824 dB, worst phase RMS error of 0.032449 degrees, and worst plateau error of 0.020820 dB. The nearly constant 0.0208 dB residual is the measured selected-path conditioning gain. Allowing Frequency and Q to float only within a diagnostic fit yields Frequency ratios 0.99417 to 1.00593 and Q ratios 0.99607 to 1.00114; that does not support a distinct hidden law.

## What The Measurements Reject

- Low Shelf is not the Bell selector changed to a low-pass output.
- High Shelf is not the Bell selector changed to a high-pass output.
- Q is not merely a renamed shelf-slope percentage.
- Shelf Q does not use Bell's gain-dependent effective-Q law.
- The shelf gain is not normalized away before distortion.
- The measured routing and level sweeps do not require RMS following, envelope following, correlation-based gain, or any other dynamic compensation.

## Remaining Ambiguity

Black-box equivalence cannot prove Spectre's source-code identity. It establishes that the 4x RBJ/JUCE difference model is behaviorally sufficient over the measured parameter, rate, level, and routing space. As with the accepted Bell Lite, Cosimo deliberately retains its low-latency three-sample polyphase-IIR wrapper and rational shaper rather than copying Spectre Good's 60-sample FIR wrapper and exact `tanh`. Those known wrapper and shaper differences must be reported separately from shelf-selection error.

## Enhancer Lite Implementation Contract

- Add one saved, static, non-modulatable Shape setting with values Low, Bell, and High. Default and legacy-state migration are Bell.
- Append the new endpoint after existing host parameters so all accepted parameter slots remain stable.
- Keep the current Bell calculations and signal path unchanged at the Bell endpoint. Verify this numerically against checkpoint `2a652a4035519be1fbe12de9a8c6487ed736e3c5`.
- Smooth one-hot Shape weights over 15 ms. At a stable endpoint, run only the selected filter and conditioner and reset inactive states; on a change, warm the newly selected path from reset behind its initially near-zero crossfade weight. At stable Bell, the output resolves to the original Bell arithmetic without an additional gain stage.
- Use independent shelf coefficients for Mid and Side because Amount is independently adjustable in M/S mode.
- Preserve horizontal Frequency drag, vertical Amount/Mid/Side drag, and Shift-drag Q. The UI label remains Q because that is what the measurements support.
- Draw the full shelf response for visual truth. Keep the parameter handle on the accepted `0..12 dB` Amount axis for direct manipulation in every shape; a shelf's measured curve still crosses half gain at Frequency, so the Amount handle is intentionally not a fake response sample.
- Zero Amount must remain bit-identical dry for all three Shapes.

## Implemented Model

- State version 2 adds exactly one saved `shape` value: `low`, `bell`, or `high`. Bell is the default, and an exact version-1 state migrates to Bell.
- `shapeIn` is appended after the accepted host endpoints as a discrete, non-automatable parameter. Existing slots are unchanged.
- Low and High use Cmajor's RBJ/JUCE Q-form shelf biquads at 4x and subtract the oversampled input to obtain `H(z) - 1`. Each M/S lane has coefficients derived from its own Amount.
- Bell retains its checkpoint coefficient, drive, shaper, conditioning, routing, and reconstruction arithmetic. A generated-runtime lock across Stereo/M/S, Tube/Solid, and Subtle/Medium is bit-identical to checkpoint `2a652a4035519be1fbe12de9a8c6487ed736e3c5` with maximum absolute difference 0.
- The shelf conditioner uses float64 coefficients and state. The accepted float32 Bell conditioner remains untouched. This is required because a 20.016 Hz biquad running at 4x loses material low-frequency accuracy at a 192 kHz host rate in float32.
- The graph evaluates the measured shelf transfer rather than drawing a generic slope. Bell and the analyzer retain their accepted `0..12 dB` rows and handle geometry exactly. Shelf response inside that range uses the same scale; only real high-Q excursions are compressed into labeled `+12..+30 dB` and `0..-18 dB` top/bottom margins. Low/Bell/High handles all use full-range Amount geometry, and a shelf-only guide joins the full-Amount control point to the truthful half-gain response at Frequency. Vertical pointer travel therefore remains coherent while horizontal Frequency and Shift-drag Q semantics stay unchanged.

## Reproduction And Regression Result

`scripts/measure_enhancer_lite_shelves.mjs --check` first verifies the exact Spectre report and measurement hashes, all 20 pinned input stimuli, and all 284 declared golden outputs as decoded planar Float32 audio. Only then does it regenerate the checkpoint, current Lite, and accepted full-Enhancer JavaScript runtimes, compare them to the corpus, and write 96 level-matched listening files. The fast `--verify-corpus` mode runs that same preflight without comparison. A focused tamper test proves that changing one decoded sample in copied input and output WAVs is rejected. The existing final DSP report remains `build/enhancer-lite-shelf-review/report.json` (SHA-256 `ec168de4147d2aa559b6bdcd210ff6b3881ea023e5f748d7d8d33213eb3c2b9c`).

- Bell checkpoint maximum absolute difference: `0`.
- Zero-Amount maximum absolute difference for Low/Bell/High: `0`.
- Shape switching maximum adjacent step: `0.0261911`; the transition maximum is slightly below the stable 100 Hz fixture step.
- Linear shelf magnitude: `0.03529 dB` worst RMS and `0.02292 dB` p95 across the full grid.
- Shaped transfer: `2.55968 dB` worst per-harmonic RMS, while the worst aggregate harmonic-energy error is `-32.05 dB` relative and level delta is `0.21025 dB`.
- Routing level delta: `0.14751 dB` worst over linked Stereo, Mid, Side, mono, and channel-asymmetric cases.
- Musical level delta: `0.20219 dB` worst over 32 raw/static-matched comparisons.
- Finite output, reset, state/restore, mono preservation, pure Side, M/S coherence, source UI, compiled UI, and 44.1/48/96/192 kHz probes pass.

The remaining mismatch is concentrated in the wrappers and rational shaper, not the inferred shelf law:

- Spectre Good's 60-sample FIR wrapper and Lite's accepted three-sample IIR wrapper differ by up to `72.2468 degrees` phase RMS in the measured high-shelf anchors. Changing Lite's declared latency would also change accepted Bell timing, so it was rejected.
- The most wrapper-sensitive, level-matched high-shelf pink-noise pair has correlation `0.14998`; level remains within `0.191 dB`. The committed comparison intentionally reports this rather than hiding it with a free time alignment.
- Lite's worst shelf alias is `-50.2511 dBc`. The worst regression against Spectre is `15.0375 dB`; this remains the principal quality cost of the short IIR wrapper.
- No measured result requires RMS following, envelope following, correlation-based auto-gain, or any other dynamic compensation, so none was added.

## Performance And Packaging

The final generated-runtime medians at 48 kHz are `845.0 ns/frame` for the checkpoint Lite, `896.4` Bell, `1136.4` Low, `1085.8` High, and `4059.5` for the accepted full two-band Enhancer. Low is the slowest new mode: `1.34x` the checkpoint cost and `3.57x` faster than the accepted full Enhancer. Bell remains `4.53x` faster than the full Enhancer. These are same-process comparative medians, not absolute real-time guarantees.

The explicit-only `enhancer-lite-shelves-audition` target is excluded from `fx:build -- all`. Its installed artifact is `/Users/winterfell/Library/Audio/Plug-Ins/VST3/CosimoEnhancerLiteShelvesAudition.vst3`, ID `dev.cosimo.enhancer-lite-shelves-audition`, binary SHA-256 `9e3a0502e6e635e903b69ac620d00503eb0d7acf0be3170db2e09affc7c50379`, universal `x86_64 arm64`, and valid ad-hoc signed. Pluginval strictness 5 reports `SUCCESS`. The accepted installed `CosimoEnhancerLite.vst3` binary remained unchanged at SHA-256 `7e89cd2ae0e063a0d25b2ca4f7f1e2d2e422affc154f41164fbdb29fb9c7fcd3` before and after installation.

After Andrew cleared the host, Ableton Live 11.3.43 restarted into a blank `Untitled` set and exposed the distinct `CosimoEnhancerLiteShelvesAudition` browser entry. Live's log records v0.2.0, VST3 class ID `ABCDEF019182FAEB436F736943734C53`, and 10 parameters for the loaded device. The compiled floating editor opened as `CosimoEnhancerLiteShelvesAudition/2-Audio`; its wordmark, analyzer/response graph, Shape, routing, character, and intensity controls rendered. Low, High, and Bell toggled in the host WebView without a close or crash; M/S exposed independent Mid and Side amounts and two graph handles; Bell/Stereo were restored. No set was saved, and the empty audition set/editor was left open for inspection. This closes the load/editor smoke only; it is not a new musical listening sign-off. The earlier same-bundle second-instance failure remains a host-routing warning: use a user-cleared host or a PID-addressable tool rather than another indistinguishable Live process.
