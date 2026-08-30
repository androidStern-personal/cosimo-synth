# SeqFX User Guide

SeqFX turns a 32-step timeline into four serial effect chains. A block says when an effect begins, how many steps it occupies, which effect it uses, and which settings it recalls. Patterns, blocks, effect choices, Mix, and Mod authoring are saved with the project.

## Start here

1. Choose one of the 12 pattern slots.
2. Click an empty cell in any chain to create a block.
3. Choose a named effect in the inspector.
4. Drag the block's right edge to make the block longer.
5. Set Block Mix, choose a factory effect preset, or edit the effect controls.
6. Open the Mod tab when a parameter should move during the block.

The four chains run in order: Chain 1 feeds Chain 2, then Chain 3, then Chain 4. Two blocks may overlap when they are in different chains. Blocks in one chain may touch, but they cannot overlap.

## Clock, rate, swing, and loop

- **Host** follows the DAW transport and tempo. Manual BPM and the in-plugin Play button are disabled because the host owns them.
- **Internal** uses Manual BPM and the in-plugin Play/Stop control.
- **Manual** uses Manual BPM and runs continuously. It does not wait for the host transport.
- **Rate** chooses eighth-, sixteenth-, or thirty-second-note cells.
- **Swing** alternately shortens and lengthens neighboring cells without changing the two-cell total.
- **Loop Start/End** limits playback and the loop edit commands. Drag either end on the 32-step ruler or enter the step numbers.

Reset returns the sequencer to the loop start and clears effect history according to each effect's lifecycle. SeqFX On and the global Mix are host-automatable controls.

## Editing blocks

- Click a cell to create or select a block.
- Drag the right edge to resize.
- Drag the body to move. Option-drag copies.
- Shift-click blocks in one chain to select a group; drag, edit, copy, or delete the group together.
- Command-C/Command-V copies and pastes block values.
- Double-click a block to delete it.
- Undo and Redo operate on complete gestures. A drag, factory preset, full factory pattern, or Vary action is one history step.

Invalid drops are shown before release and do not change the pattern. Adjacent blocks remain separate triggers even when they use the same effect.

### Pattern and loop actions

- **Init** clears the current pattern only.
- **Clear** removes blocks touching the current loop.
- **Copy/Paste** copies the authored blocks in the loop, clipping them to the loop boundaries when required.
- **Vary** keeps block timing, length, chain, and effect identity. It changes only Block Mix and parameters by choosing among that effect's bounded factory presets.
- **Factory** replaces the current pattern with one of 12 complete patterns. Undo restores the previous pattern.

## Triggers, gates, captures, and tails

A block boundary does not mean the same thing for every algorithm:

- Filter, Crush, Ring, Talk Box, and Dirty are gated: they enter and leave with the block.
- Vibro and Flange use modulated delay while the block is active and return to dry at the boundary.
- Pitch captures and remaps audio during its authored block. It adds no plugin-wide reported latency.
- Reverse reads a rolling window of audio already heard. It adds no lookahead latency and returns dry at block exit. On a cold start, it stays dry until the requested history exists.
- Stutter captures immediately, then repeats. A retrigger captures into a second bank so the old repeat is not destroyed before the new capture is ready.
- Comb has a resonant tail. The triggering block can end while its bounded feedback decay continues.
- Tape Stop is a motor gesture. The block triggers it, but configured Stop and Start times can outlive that cell. Crossfade to Live hands off directly in 10 ms. Spin Up restarts the captured motor from 0x to 1x over Start Time, then hands off without pretending to catch up to the moving live timeline. A second gesture crossfades rather than killing the first.

Transport stops, seeks, authoritative state loads, and resets clear or relatch history according to the documented lifecycle so old buffered audio does not leak into a new context.

## The effects

### Filter

Low-pass, high-pass, or band-pass filtering with cutoff, Q, and a drawable modulation range. Use it for tonal movement and utility cuts.

### Crush

Converter-style bit depth and sample-rate reduction. Drive, Character, ADC Q, DAC Q, and deterministic Dither distinguish clean reduction from damaged conversion. Rate is displayed in Hz and remains stable when the host sample rate changes.

### Tape Stop

Choose synced divisions or Free time, then set the braking Curve, Return behavior, Start Time, and tape Character. One-cell Brake is the central starting preset; the cell starts the gesture rather than forcibly ending its audio.

### Stutter

Slices controls repeat density, Speed changes playback rate, Shape moves through the repeat envelope family, and Gate controls how much of each repeat remains audible.

### Pitch

Semitone and cent shifting with a complementary-grain engine. Grain changes transient/smear tradeoffs; Jitter and Spread add controlled motion and stereo separation.

### Comb

A tuned, four-path vector-dispersive feedback network. Tune and Decay establish the note; Polarity changes the modal series; Dispersion, Damping, Motion, Drive, and Width move from a recognizable comb toward animated, inharmonic resonances. Feedback and output are bounded.

### Ring

Phase-continuous ring modulation with Sine, Triangle, Square, or Noise carriers. Frequency establishes the sidebands; Motion and Rate move them; Spread separates channel frequencies; Bias and Rectify move from bipolar ring modulation toward tremolo and asymmetric shapes.

### Reverse

A zero-added-latency rolling lookback looper. Choose a synced Length or Free Length, Crossfade the wrap, and use Decay for repeated reverse echoes.

### Talk Box

A formant filter, not a sidechain vocoder. Choose From and To vowels, then Morph between measured vowel targets. Resonance, Lows, Highs, and Drive control articulation and passthrough.

### Vibro

Wet-only Doppler pitch modulation. Rate/Division, Depth in cents, Wave, and stereo Spread create vibrato without Flange's dry comb or feedback.

### Flange

Classic short dry-plus-delay comb modulation. Delay, Depth, Rate/Division, Feedback, Spread, and loop Polarity cover subtle silk through pronounced jet sweeps.

### Dirty

Fixed-quality oversampled distortion with Soft, Hard, Fold, and Bias characters. Bias is DC-controlled; Dynamics restores useful envelope contrast; Tone affects the nonlinear residue; Trim provides output compensation.

## Effect presets and factory patterns

Every effect includes three musically named, range-checked starting points. Applying one sets the current block's base parameters and Block Mix in one undoable edit. Existing Mod routing remains authored separately.

The 12 full patterns cover drums, vocals, bass, sustained harmony, transitions, subtle utility, and a Twelve-effect Tour. They do not require sidechain audio or external assets. Loading one replaces only the selected pattern.

## Mod

The Effect and Mod tabs stay in the same place. Block Mix remains visible in both.

Mod uses one auxiliary source per block and a separate target range for each eligible parameter. Choose a tempo- or slice-relative rate, source Shape and Curve, then enable only the parameter targets you need. Trigger-latched choices—such as an effect Character, waveform family, synced/free mode, or Tape Stop timing—cannot be swept live when that would make the DSP lifecycle ambiguous or unsafe.

## State and compatibility

Current projects store sparse `seqfx.v7` block state. The plugin migrates valid legacy `seqfx.v6`/internal-version-5 documents, preserving Filter, Crusher/Crush, Tape Stop, and Stutter blocks. Crush keeps persisted effect ID 2; its display name changed without renumbering. Tape Stop legacy values use the documented v2 migration mapping.

Host or preset loads are authoritative history boundaries: they replace the current authored document and clear in-memory Undo/Redo. The loop clipboard and edit history are intentionally instance-local.

The first-use editing hint stays dismissed only while the editor remains open. Its dismissal is not saved in project state.

## Current host limitations

- The release-candidate target is macOS VST3. AU and Windows are not part of this tranche.
- Reverse and Pitch do not delay the entire plugin to provide future audio. Their first transient can therefore differ from a plugin-wide lookahead implementation.
- The maximum Reverse window is four seconds; Tape Stop and Stutter use their documented bounded history tiers.
- Manual clock runs continuously; use Internal when an in-plugin Play/Stop control is required.
- Final Ableton save/reopen, automation, multiple-instance, and subjective listening results belong in the release qualification ledger. Do not infer them from browser or offline DSP tests.
