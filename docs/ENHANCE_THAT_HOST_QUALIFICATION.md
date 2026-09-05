# Enhance That final-host run

Prepared by L3 on September 5, 2026. **No final-host result is recorded here.**
Bob allocates the install/host slot; the release evidence index binds each
observation to the final distributed artifacts. Repeat this run on retained
Apple Silicon macOS 15 and 26, and for each retained format. AU remains pending
the explicit format decision.

## Exact inputs and protected state

Record download SHA-256, source/kit lineage, extracted and installed payload
digests, signature/notary result, OS build, CPU, host version and format.
The VST3 processor CID must be `ABCDEF019182FAEB436F73694373454C`, bundle ID
`dev.cosimo.enhancer-lite`, and displayed name **Enhance That**. Enumerate both
user and system scan roots; a second old/new copy is a failure to resolve,
not permission to change the permanent identity.

Before using an existing DAW session, record transport, tempo, selection,
tracks/devices, arm/monitor/mute/solo states and the saved/unsaved state. Modify
only the allocated test track. Preserve original tracks and their clips.
Disk-project close/reload belongs in an owned saved project in the clean test
environment; an existing unsaved user set must not be closed or overwritten
to satisfy this check. Snapshot restoration does not undo lost unsaved work.

Use an identified stereo source with distinct left/right material so Side
processing has a signal. Record its original hash, sample rate/channels/frames,
gain, warp state, project tempo and export settings. Use the same source and
time interval for before/after exports; disable normalization and dither for
technical comparisons. Preserve the original audio alongside the results.

## Parameter and recall oracle

Enumerate actual host parameters and map by the unique visible names below;
do not assume parameter indices or that the host uses physical values. Derive
normalization from its reported range, then confirm its displayed value.
Check the eight sound parameters are automatable. An analyzer or host bypass
parameter is not a ninth sound control.

| Host label | Permanent endpoint | State A | State B | Additional choice |
| --- | --- | --- | --- | --- |
| Frequency | `freqHzIn` | 220 Hz | 1800 Hz | Continuous ramp between A/B |
| Q | `qIn` | 0.71 | 2.5 | Continuous ramp between A/B |
| Routing | `modeIn` | Stereo | Mid/Side | Both labels must remain discrete |
| Amount / Mid | `midAmountIn` | 0.20 | 0.65 | Continuous ramp between A/B |
| Side | `sideAmountIn` | 0.10 | 0.55 | Exercise with Mid/Side selected |
| Character | `curveIn` | Solid | Tube | Both labels must remain discrete |
| Intensity | `saturationModeIn` | Subtle | Medium | Both labels must remain discrete |
| Shape | `shapeIn` | Bell | Low | High must also be exercised |

For each control, record an actual editor gesture into host automation, then
release the control and play the recorded automation. Confirm the host value,
editor value and resulting audio agree while playback owns the control.
Include a pointer drag with arrow keys and a Frequency drag that adds Q with
the modifier; a touch must end on release/cancel so automation can resume.
Programmatically inserting envelope points can additionally test playback,
but does not prove the editor recorded the host gesture.

Save state A as a named plugin preset, change all values to B, and recall A.
Record every value and the audible result. In a separate owned project, save B
and the automation to disk, confirm the project file exists and hash it, close
the project, reopen that exact file, and read back all values/envelopes. Close
and reopen the editor separately. In-memory preset recall or hiding the editor
does not satisfy disk-project recall. Check a preserved old-plugin project
against the renamed plugin in the same way when the old project is available.

## Keyboard, playback and audio evidence

Exercise Space on ordinary controls, genuine preset-name text entry, numeric
entry and an active drag. Record whether the host transport changes and whether
text/value editing receives the intended key; a synthetic DOM key event is
insufficient. Cover keyup and cancel/focus-loss so a held key cannot remain
latched after closing the editor.

Capture ordinary playback and an offline export over the same interval. Retain
source, dry, processed A, processed B and post-reload outputs with hashes and
format details. Compare frame counts, finite samples, unintended silence and
pre/post-reload differences with alignment and any tolerance explicitly stated.
Do not require bit equality between different host render modes without first
establishing their timing/state behavior. Check audible continuity at continuous
automation and discrete changes; numerical plots alone cannot pass that check.

Andrew's musical acceptance records the exact output files and settings he
heard and his explicit outcome. Technical export completion and source-level
DSP tests remain separate from that acceptance.

## Available local observation seam

The existing `scripts/drum_buss_harness.py` exports `AbletonClient`; importing
that class does not launch its unrelated capture harness. Its commands
`get_session_info`, `get_is_playing`, `get_track_info` and
`get_device_parameters` provide readback through the existing loopback bridge.
The bridge's parameter setter/envelope writer use normalized values. Recheck
actual command availability and parameter ranges in the allocated host slot.
Do not start/restart the bridge or run the Drum Buss harness to perform this
release run. Native UI input, disk save/reload and offline export remain real
host operations; API readback is supporting evidence, not a substitute.
