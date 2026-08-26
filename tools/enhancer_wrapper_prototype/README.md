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
