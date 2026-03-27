# Vital And Serum LFO Research

This file records the concrete findings from the 2026-03-27 research pass on Vital `.vitallfo` files, Vital's LFO runtime, and the officially documented Serum LFO behavior we can target for compatibility.

Scope:

- real `.vitallfo` files from `/Users/winterfell/Downloads/Sonicspore FREE BUNDLE VITAL/Sonicspore Free LFO Shpaes VITAL`
- current public Vital source code cloned to `/Users/winterfell/src/vital`
- official Xfer Serum docs and official Xfer forum posts

Vital source caveat:

- the cloned Vital repo HEAD used for this research is `636ca0ef517a4db087a6a08a6a8a5e704e21f836` dated 2022-04-20
- the Vital GitHub README says the repository is updated on a delay after binary releases
- so the source is good enough to establish the public `.vitallfo` schema and runtime architecture, but not safe to treat as a perfect mirror of the newest shipped Vital build

What this file is not:

- it is not a byte-level Serum `.shp` reverse-engineering report
- it is not a guarantee that Vital has a dedicated Serum LFO importer
- it is not a finished import spec for this repo

## Bottom line

Vital and Serum both separate two things:

- the editable graph shape
- the playback and routing behavior around that shape

That separation matters. If we want a durable LFO spec for this repo, we should not bake trigger mode, tempo sync, depth, or destination routing into the same object as the point list itself.

## Vital shape file format

Vital `.vitallfo` files are plain JSON files.

Observed sample files:

- all 30 attached sample files are JSON, not binary
- filenames use the `.vitallfo` extension
- file sizes in the sample pack range from 278 bytes to 1125 bytes

Vital's extension constant:

- `src/common/synth_constants.h` defines `kLfoExtension = "vitallfo"`

The core serializer lives in `LineGenerator::stateToJson()` and the parser in `LineGenerator::jsonToState()` in `src/common/line_generator.cpp`.

### Concrete schema

The real shape schema produced by `LineGenerator::stateToJson()` is:

```json
{
  "num_points": 35,
  "points": [x0, y0, x1, y1, ...],
  "powers": [p0, p1, ...],
  "name": "Linear",
  "smooth": false
}
```

The attached sample files add one more top-level key:

```json
{
  "author": "Sonicspore"
}
```

That extra `author` key is not emitted by `LineGenerator::stateToJson()` itself. It is added later by Vital's save UI in `SaveSection::save()` when saving a non-preset file.

### Field meanings

`num_points`

- integer point count
- the `points` array length should be `2 * num_points`
- the `powers` array length should be `num_points`

`points`

- flat array of normalized point coordinates
- even indexes are `x`
- odd indexes are `y`
- `x` is normalized `0.0 .. 1.0`
- `y` is normalized `0.0 .. 1.0`

`powers`

- one curve-power value per point
- segment `i -> i + 1` uses `powers[i]`
- in looped rendering, the closing segment can use the last power
- in non-looped rendering, the last power is effectively spare metadata

`name`

- display name for the shape

`smooth`

- global per-shape boolean
- when `true`, Vital applies the same sine-ease transition to every segment before applying the segment's `power`

`author`

- optional metadata key written by the save UI
- ignored by `LineGenerator::jsonToState()`

### Parser strictness

Vital's validation is loose.

`LineGenerator::isValidJson()` only checks:

- `num_points` exists
- `points` exists and is an array
- `powers` exists and is an array

It does not fully validate:

- exact `points` length
- exact `powers` length
- `x` ordering
- `x` and `y` range bounds
- `num_points <= 100`

For this repo we should be stricter than Vital here.

## Vital shape semantics

### Point ordering and duplicate x values

Vital allows repeated `x` values. The editor constrains a point's `x` between its neighbors, but equality is allowed.

That means duplicate `x` values are the real representation for vertical steps.

Observed in the attached sample pack:

- all files use monotonically non-decreasing `x`
- many files use repeated `x` pairs heavily
- the sample pack histogram of duplicate adjacent `x` pairs is:
  - 3: 1 file
  - 5: 1 file
  - 7: 1 file
  - 9: 1 file
  - 11: 1 file
  - 12: 4 files
  - 14: 2 files
  - 15: 2 files
  - 16: 5 files
  - 17: 11 files
  - 19: 1 file

So if we want Vital compatibility, we need to preserve duplicate `x` values rather than normalizing them away.

### Endpoint rules

Vital's editor pins:

- the first point to `x = 0`
- the last point to `x = 1`

Interior points can be removed. Endpoint points cannot.

The shape does not have to end where it starts.

Observed in the sample pack:

- 25 files start at `(0.0, 1.0)` and end at `(1.0, 0.0)`
- 4 files start at `(0.0, 1.0)` and end at `(1.0, 1.0)`
- 1 file ends at `(1.0, 0.5096153616905212)`

So Vital does not require a closed loop at the file level.

### Y-axis inversion

This is one of the most important Vital-specific details.

The stored `y` value in the JSON is not the final modulation value. In `LineGenerator::render()` Vital computes the interpolated `y` and then writes:

```cpp
buffer_[i + 1] = 1.0f - y;
```

So the file stores editor-space `y`, and the rendered modulation buffer uses the inverted value.

If we import a Vital `.vitallfo` into our own output-space representation, the safe conversion is:

```text
our_output_y = 1.0 - vital_file_y
```

If we export back to Vital:

```text
vital_file_y = 1.0 - our_output_y
```

### Segment curve power

Vital bends a segment with `futils::powerScale()`:

```cpp
numerator = exp(power * value) - 1.0f
denominator = exp(power) - 1.0f
result = numerator / denominator
```

Behavior:

- `power = 0` is linear
- positive power biases the motion toward the segment end
- negative power biases the motion toward the segment start
- Vital clamps editor changes to `[-20, 20]`

Observed sample-pack power range:

- minimum: `-14.802629470825195`
- maximum: `13.79604434967041`

### Global smooth flag

When `smooth` is true, Vital first warps the normalized segment time with:

```cpp
0.5 * sin((t - 0.5) * pi) + 0.5
```

Then it applies the per-segment `power`.

So Vital has:

- one global boolean for sine-eased transitions
- one per-segment power control for extra bend

Observed sample pack:

- all 30 files have `"smooth": false`

## Vital render resolution and interpolation

Vital's stored graph is not evaluated analytically at runtime. It is pre-rendered.

Shape-render details from `LineGenerator` and `SynthLfo`:

- shape buffer resolution: `2048`
- extra pad samples: `3`
- runtime lookup: Catmull-Rom cubic interpolation
- lookup source buffer: `getCubicInterpolationBuffer()`

This is very close to the architecture already proposed for this repo's MSEG work:

- authorable point data in the editor
- pre-rendered buffer for DSP playback
- cubic interpolation at playback time

## Vital runtime LFO behavior

The `.vitallfo` file only stores the shape. Playback behavior lives elsewhere.

Vital's runtime LFO processor is `SynthLfo` in `src/synthesis/modulators/synth_lfo.{h,cpp}`.

Vital has 8 LFOs:

- `kNumLfos = 8`

### Runtime controls

The LFO module wires these controls:

- frequency
- phase
- note trigger
- sync type
- smooth mode
- fade time
- smooth time
- stereo phase
- delay time

The parameter table in `src/common/synth_parameters.cpp` adds the user-facing details.

### Trigger and playback modes

Vital supports these sync types:

- `Trigger`
- `Sync`
- `Envelope`
- `Sustain Envelope`
- `Loop Point`
- `Loop Hold`

Concrete meanings from `SynthLfo`:

`Trigger`

- note-retriggered looping playback
- phase offset resets on note-on
- playback wraps with `mod()`

`Sync`

- host-time-synced looping playback
- on note-on it aligns to the host playhead time instead of restarting at zero

`Envelope`

- one-shot playback
- offset clamps at `1.0`

`Sustain Envelope`

- one-shot while note is held
- the end point is limited by the current phase while the voice is held

`Loop Point`

- when offset reaches the end, it jumps back to the current `phase` control value

`Loop Hold`

- similar loopback behavior, but constrained against held-note state

Vital uses the `phase` control for more than visual start position. In loop-point modes it is the loop return point.

### Time domain modes

Vital has these frequency-sync domains:

- `Seconds`
- `Tempo`
- `Tempo Dotted`
- `Tempo Triplets`
- `Keytrack`

The runtime mapping is handled by `TempoChooser` in `src/synthesis/framework/operators.cpp`.

Synced tempo ratios:

- `Freeze`
- `32/1`
- `16/1`
- `8/1`
- `4/1`
- `2/1`
- `1/1`
- `1/2`
- `1/4`
- `1/8`
- `1/16`
- `1/32`
- `1/64`

Implementation details:

- dotted multiplies by `2/3`
- triplet multiplies by `3/2`
- keytrack converts MIDI note plus transpose and tune into a frequency directly

### Fade vs smooth mode

Vital separates two amplitude-shaping behaviors:

`FADE IN`

- ramps the LFO amplitude from zero to full over `fade_time`

`SMOOTH`

- does not fade amplitude from zero
- instead low-pass smooths the LFO output toward the new value over `smooth_time`

This distinction is easy to miss in the UI and important if we want real Vital compatibility.

### Stereo phase

Vital has a stereo offset control from `-0.5 .. 0.5`.

Runtime implementation:

- left and right sides get opposite half offsets through `phase + stereo * (0.5, -0.5)`

### Delay

Vital delays the start of the active LFO by `delay_time`, and in triggered modes it also accounts for per-voice trigger offset inside the processing block.

## Vital save and import behavior

### Saving an LFO

Vital exports `.vitallfo` by dumping JSON text to disk.

There are two save paths:

- direct export from the LFO section
- save through the generic save dialog

The save dialog injects:

- `name`
- `author`

before writing the JSON file.

### Loading an LFO

The LFO section parses JSON and passes it straight into `LineGenerator::jsonToState()`.

Unknown keys are ignored.

That means:

- `author` survives in the file
- but it is not loaded into the `LineGenerator` object itself

## Vital sample-pack findings

From the attached `Sonicspore Free LFO Shpaes VITAL` pack:

- 30 files
- keys seen across the pack:
  - `author`
  - `name`
  - `num_points`
  - `points`
  - `powers`
  - `smooth`
- point-count range:
  - minimum `10`
  - maximum `38`
  - mean `30.5`
- `x` range:
  - `0.0 .. 1.0`
- `y` range:
  - `0.0 .. 1.0`
- all files have monotonic non-decreasing `x`
- all files have `smooth = false`

This pack looks like a realistic validation target for our own importer.

## Vital and Serum wavetable interoperability

This is separate from the LFO system, but it matters because the user asked whether Vital's Serum import path helps us.

### What Vital actually imports

Vital's wavetable editor imports:

- `.vitaltable`
- `.wav`
- `.flac`

Vital does not appear to contain a dedicated `"Serum"` code path by name.

Instead, the `.wav` import path reads the RIFF `clm ` metadata chunk in `WavetableEditSection::getWavetableDataString()`.

### `clm ` chunk parsing

Vital looks for a RIFF chunk named `clm ` and reads it as text.

Then:

- `getFadeStyleFromWavetableString()` checks for a string starting with `<!>`
- it tokenizes the remainder by spaces
- it reads the first character of token 2 to decide the fade style:
  - `'0'` -> `No Interpolate`
  - `'1'` -> `Time Interpolate`
  - anything else -> `Freq Interpolate`

It also extracts optional author metadata from bracketed text:

- `[author]`

### Vital's own wavetable WAV export

When Vital exports a wavetable `.wav`, it writes this `clm ` string:

```text
<!>2048 20000000 wavetable (vital.audio)
```

So Vital participates in the same family of wavetable WAV metadata conventions used by other synths, but the checked-in source does not show a Serum-specific branch.

### WaveEdit detection

Vital also has a special heuristic for WaveEdit-style tables:

- exact sample count `64 * 256`
- frequency-domain energy check
- if it matches, Vital switches the file source window size to `256`

That is a real explicit format heuristic in source.

## Serum LFO behavior from official Xfer sources

Primary sources available:

- official Serum 2 manual snippets from `xferrecords.com/manual/serum-2/docs`
- official Xfer forum posts by Steve Duda

### What the official sources confirm

Serum 2 has:

- ten LFOs
- loadable and savable shape presets
- a dedicated `LFO Shapes` folder inside the Serum preset folder

Officially documented LFO controls include:

- `TYPE`
  - `Normal`
  - `Path`
  - `Chaos: Lorenz`
  - `Chaos: Rossler`
  - `S&H`
- `MODE`
  - `FREE`
  - `RETRIG`
  - `ENVELOPE`
- `MONO`
- `SHAPE`
  - load shape preset
  - save current graph as user-defined preset
- `DIRECTION`
  - `Forward`
  - `Reverse`
  - `Ping Pong`

The official manual also states:

- in `ENVELOPE` mode you can set a loopback point
- the loopback point is chosen from the graph context menu
- `FREE` follows host clock and ignores note timing
- `RETRIG` restarts on each new note

Official Xfer forum posts also confirm:

- LFO shapes can be saved from the LFO folder icon
- Alt-click or Shift-Alt-click on the folder icon browses shapes
- graph editing uses:
  - right-click for context menu
  - Shift-click for segment drawing
  - Alt-click on a curve point to change all curves at once
  - double-click to add or remove points
- modulation polarity is not purely a shape property
  - Steve Duda explained that assignment polarity depends on the destination state and can be toggled separately

### What the primary sources do not confirm

I did not find a primary-source byte-level Serum LFO file-format specification.

So from primary sources we can say with confidence:

- Serum has saved LFO shape assets
- Serum's graph editor supports point editing, segment drawing, loopback, direction, and multiple playback modes

But we cannot honestly claim from primary sources:

- the exact `.shp` binary or text schema
- the exact per-point curve encoding on disk
- the exact saved-field list for a standalone Serum LFO shape file

## Comparison Against `full-proposal.md`

The original proposal is closest to Vital in one narrow way and farthest from Vital in another.

Where the proposal was already right:

- the proposal chose a pre-rendered control-buffer architecture instead of evaluating curve math in the DSP hot path
- the proposal chose cubic interpolation for runtime playback
- the proposal chose 8 slots, which matches Vital's 8 LFOs exactly
- the proposal kept modulation routing in a separate matrix instead of baking route depth into the shape itself

Where the proposal differs from Vital in ways that matter:

1. Shape math

- the proposal describes "cubic bezier evaluation happens in JS at render time"
- Vital does not store bezier handles
- Vital stores a point list plus one curve-power value per point plus one global `smooth` flag

This is the biggest mismatch. If we keep a bezier-native saved format, we will only be able to approximate Vital imports instead of round-tripping them.

2. Shape schema

- the proposal defines a transport buffer only
- Vital has a real import-export shape file schema: `num_points`, `points`, `powers`, `name`, `smooth`, optional `author`

The proposal was missing the authorable persisted shape format, which is exactly the part we need for compatibility.

3. Buffer resolution

- the proposal picked an `8192`-sample control buffer
- Vital uses `2048` rendered samples plus `3` pad samples for cubic reads

Nothing is inherently wrong with `8192`, but if the goal is Vital compatibility, `2048` is the concrete reference.

4. Shape semantics

- the proposal never defined duplicate `x` handling
- Vital allows duplicate `x` values and uses them for step edges
- the proposal never defined endpoint rules
- Vital pins first `x` to `0` and last `x` to `1`
- the proposal never defined the saved `y` convention
- Vital stores editor-space `y` and inverts it into output-space on render

5. Playback behavior

- the proposal says "rate/sync setting" but does not define the actual modes
- Vital has concrete playback modes:
  - `Trigger`
  - `Sync`
  - `Envelope`
  - `Sustain Envelope`
  - `Loop Point`
  - `Loop Hold`
- Vital also has concrete time domains:
  - `Seconds`
  - `Tempo`
  - `Tempo Dotted`
  - `Tempo Triplets`
  - `Keytrack`

So the proposal was architecturally compatible with Vital, but behaviorally underspecified.

6. Parameter semantics

- the proposal never defined delay, fade, output smoothing, stereo phase, or loopback behavior
- Vital defines all of those
- Vital also overloads `phase` in loop-point modes so it acts as the loop return position

For this repo we should not copy that overload. We should separate `start_phase` and `loopback_x` explicitly.

7. Routing schema

- the proposal's `ModRoute` only has `sourceIndex`, `destIndex`, and `depth`
- Serum behavior shows that polarity belongs with the route, not with the shape

So the final route schema should add polarity at minimum.

## Final Decision

If the goal is "Vital-compatible first, Serum-compatible later", the final model for this repo should be:

1. A Vital-style point-based shape format
2. A separate playback object
3. A separate route object
4. A derived runtime buffer that is not itself the saved format

That keeps the proposal's good architectural choice, which is buffer playback in DSP, while replacing the wrong abstraction, which was treating bezier rendering as the core saved representation.

## Final Expected Behavior

This is the behavior I recommend we treat as the source of truth.

### Slot count

- `8` drawable LFO slots
- each slot owns one shape object and one playback object
- routes reference a slot by id and stay separate from the slot's shape

### Shape editing

- point-based editor
- first point fixed at `x = 0`
- last point fixed at `x = 1`
- duplicate `x` values allowed
- duplicate `x` values are preserved because they represent step edges
- points store normalized output-space `y` in `0 .. 1`
- each segment uses a Vital-style exponential curve control
- one optional global `smooth` flag applies the sine-ease pass before segment curve power

### Playback

- default mode: `trigger`
- supported modes:
  - `trigger`
  - `sync`
  - `envelope`
  - `sustain_envelope`
  - `loop_point`
- `loop_hold` can wait until a later pass unless we decide we need exact Vital parity immediately
- supported time domains:
  - `seconds`
  - `tempo`
  - `tempo_dotted`
  - `tempo_triplets`
- `keytrack` can stay in the schema but can be deferred in implementation if it does not help the first sound-design goals
- `start_phase` is always a real start offset
- `loopback_x` is a separate field and is only used by loopback modes
- `delay_seconds` delays the modulation start
- `fade_seconds` ramps modulation depth from `0` to full
- `smooth_seconds` low-pass smooths the output over time
- `stereo_phase` is optional and can be ignored by mono destinations

### Runtime evaluation

- the GUI owns the editable shape
- the GUI renders a `2048`-sample unipolar buffer from the shape
- the runtime playback buffer adds `3` cubic pad samples as `[last, body[0..2047], first, second]`
- DSP playback uses cubic interpolation over that rendered buffer
- the DSP never evaluates point curves directly in the audio loop

### Routing

- routes are stored separately from shapes
- each route has:
  - source
  - destination
  - depth
  - polarity
- shape import should remain valid even if a destination does not exist in this synth

## Final Schema

This is the concrete schema I recommend.

### Shape object

Store our own shape format in direct output space, not in Vital's inverted editor space.

```json
{
  "format": "cosimo.lfo.shape",
  "version": 1,
  "name": "Example",
  "author": "Optional",
  "global_smooth": false,
  "points": [
    { "x": 0.0, "y": 0.0, "curve": 0.0 },
    { "x": 0.25, "y": 1.0, "curve": -2.0 },
    { "x": 0.25, "y": 0.35, "curve": 0.0 },
    { "x": 1.0, "y": 0.0, "curve": 0.0 }
  ]
}
```

Rules:

- `points.length >= 2`
- first point `x == 0`
- last point `x == 1`
- `x` values are non-decreasing
- duplicate `x` values are allowed
- `y` is clamped to `0 .. 1`
- `curve` is finite and should usually be clamped to `[-20, 20]`

Import Vital with:

- `x = vital_x`
- `y = 1.0 - vital_y`
- `curve = vital_powers[i]`
- `global_smooth = vital_smooth`

Export Vital with:

- `vital_y = 1.0 - y`
- flatten points into `[x0, y0, x1, y1, ...]`
- emit one `powers[i]` value per point

### Playback object

Use explicit fields instead of one overloaded `rate` field.

```json
{
  "format": "cosimo.lfo.playback",
  "version": 1,
  "mode": "trigger",
  "time_mode": "seconds",
  "seconds": 1.0,
  "tempo_division": "1/4",
  "keytrack_transpose_semitones": 0,
  "keytrack_tune_cents": 0,
  "start_phase": 0.0,
  "loopback_x": null,
  "direction": "forward",
  "delay_seconds": 0.0,
  "fade_seconds": 0.0,
  "smooth_seconds": 0.0,
  "stereo_phase": 0.0,
  "voice_scope": "per_voice"
}
```

Rules:

- `mode`:
  - `trigger`
  - `sync`
  - `envelope`
  - `sustain_envelope`
  - `loop_point`
  - reserved later: `loop_hold`
- `time_mode`:
  - `seconds`
  - `tempo`
  - `tempo_dotted`
  - `tempo_triplets`
  - reserved later: `keytrack`
- `start_phase` is always `0 .. 1`
- `loopback_x` is either `null` or a normalized `0 .. 1` position
- `direction` defaults to `forward`; it is included now so we have a clean place for later Serum-compatible reverse and ping-pong behavior
- `voice_scope` defaults to `per_voice`

### Route object

```json
{
  "format": "cosimo.lfo.route",
  "version": 1,
  "source": "lfo_1",
  "destination": "wavetable_position",
  "depth": 1.0,
  "polarity": "unipolar"
}
```

Rules:

- `source` references a slot id, not a file or shape name
- `polarity` is route data, not shape data
- unsupported destinations should not invalidate the shape or playback object

## Compatibility decisions I recommend

Implement now:

- Vital `.vitallfo` import and export
- point-plus-curve saved shapes
- duplicate-`x` step support
- `2048` rendered samples plus `3` cubic pad samples
- `trigger`, `sync`, `envelope`, `sustain_envelope`, and `loop_point`
- `seconds`, `tempo`, `tempo_dotted`, and `tempo_triplets`
- separate route polarity

Defer but leave room for:

- exact Vital `loop_hold`
- `keytrack`
- Serum `Path`
- Serum chaos modes
- Serum `S&H`
- a real Serum shape-file parser once we have actual `.shp` files or primary-source documentation

## Concrete implementation note for this repo

The current repo already wants:

- GUI-owned editable curve state
- pre-rendered float buffer upload to DSP
- cubic playback from shared control memory

Vital's design confirms that this split is workable. The final correction to the original proposal is:

- save point-based shapes, not bezier-native shapes
- save playback separately from shape
- save routing separately from both
- treat the rendered float buffer as derived runtime data, not as the canonical saved representation

## Sources used

Local sample files:

- `/Users/winterfell/Downloads/Sonicspore FREE BUNDLE VITAL/Sonicspore Free LFO Shpaes VITAL`

Vital source files:

- `/Users/winterfell/src/vital/src/common/line_generator.h`
- `/Users/winterfell/src/vital/src/common/line_generator.cpp`
- `/Users/winterfell/src/vital/src/common/load_save.cpp`
- `/Users/winterfell/src/vital/src/common/synth_constants.h`
- `/Users/winterfell/src/vital/src/common/synth_parameters.cpp`
- `/Users/winterfell/src/vital/src/synthesis/modulators/synth_lfo.h`
- `/Users/winterfell/src/vital/src/synthesis/modulators/synth_lfo.cpp`
- `/Users/winterfell/src/vital/src/synthesis/modules/lfo_module.cpp`
- `/Users/winterfell/src/vital/src/synthesis/framework/operators.cpp`
- `/Users/winterfell/src/vital/src/interface/editor_components/line_editor.cpp`
- `/Users/winterfell/src/vital/src/interface/editor_components/lfo_editor.cpp`
- `/Users/winterfell/src/vital/src/interface/editor_sections/lfo_section.cpp`
- `/Users/winterfell/src/vital/src/interface/editor_sections/save_section.cpp`
- `/Users/winterfell/src/vital/src/interface/editor_sections/wavetable_edit_section.cpp`
- `/Users/winterfell/src/vital/src/common/wavetable/file_source.cpp`
- `/Users/winterfell/src/vital/src/common/wavetable/wavetable_creator.cpp`

Official Xfer sources:

- `https://www.xferrecords.com/manual/serum-2/docs`
- `https://xferrecords.com/forums/general/can-lfos-be-loaded-saved-with-serum`
- `https://xferrecords.com/forums/general/serum-shorcuts`
- `https://www.xferrecords.com/forums/general/lfo-polarity`
- `https://xferrecords.com/forums/general/moving-serum-presets-to-external-hard-drive-mac`
