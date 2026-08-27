# Enhancer Wrapper Prototype

**Question:** can a pinned JUCE 7.0.1 4x oversampler reproduce Spectre 1.5.6
Good's timing, phase, and high-frequency nonlinear behavior closely enough to
replace the current Cmajor node-oversampling wrapper without changing the recovered
bell or Tube/Solid curves?

This directory is throwaway measurement code. It is not production DSP and is not
wired into the synth, the installed Enhancer, or the Polish chain. It compiles only
the JUCE DSP modules, avoiding JUCE's obsolete GUI build helper on current macOS.

The runner builds a tiny JUCE probe, renders all JUCE FIR/IIR quality and latency
variants, selects on linear and nonlinear training probes, and evaluates only the
winner on held-out tones and musical material.

Run it with:

```sh
npm run prototype:enhancer-wrapper
```

The command verifies the exact JUCE 7.0.1 source revision, builds the probe, ranks
all eight FIR/IIR quality and latency variants on training material, and only then
reveals the held-out tone and music results. The pinned JUCE checkout, executable,
report, and A/B audio stay under ignored `build/t26-wrapper-prototype/`.

The measured result and production decision boundary are recorded in
`ENHANCER_WRAPPER_PROTOTYPE_FINDINGS.md` at the repository root.

## De-emphasis/DC ordering follow-up

**Question:** with that wrapper and the recovered bell/shaper laws fixed, does
Spectre DC-block the complete shaped-minus-bell residue, or does it condition the
shaped signal and apply the inverse bell afterward?

Spectre's De-Emphasis parameter is a binary switch: raw automation values through
0.5 resolve to Disabled and values above 0.5 resolve to Enabled. The follow-up uses
those two measured endpoints as ground truth. Cosimo's continuous 25%, 50%, and 75%
targets are exact sample-wise interpolation between them; they are not presented as
Spectre settings and use no dynamic gain measurement.

Run the isolated follow-up with:

```sh
npm run prototype:enhancer-deemphasis
```

It fits the shaped path and the `Spectre off - Spectre on` subtraction path
separately on training-only tones, locks both static filter choices, then evaluates
Subtle/Medium, Tube/Solid, control variants, and four musical fixtures. The ignored
report and A/B audio are written below `build/t26-deemphasis-prototype/`.
