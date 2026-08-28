# Enhancer Wrapper Prototype

**Question:** can a pinned JUCE 7.0.1 4x oversampler reproduce Spectre 1.5.6
Good's timing, phase, and high-frequency nonlinear behavior closely enough to
replace the current Cmajor node-oversampling wrapper without changing the recovered
bell or Tube/Solid curves?

This directory is throwaway measurement code. It is not production DSP and is not
wired into the synth, the installed Enhancer, or the Polish chain. It compiles only
the JUCE DSP modules, avoiding JUCE's obsolete GUI build helper on current macOS.

The original JUCE runner was retired when Cosimo adopted its single CPM source
resolver. Its measured results remain recorded below; this directory no longer
contains an independently runnable dependency downloader.

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

The follow-up fit the shaped path and the `Spectre off - Spectre on` subtraction
path separately on training-only tones, locked both static filter choices, then
evaluated Subtle/Medium, Tube/Solid, control variants, and four musical fixtures.
Its independently downloading JUCE runner and package command are retired; the
result remains recorded in `ENHANCER_DEEMPHASIS_FINDINGS.md`.
