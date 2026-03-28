# Serum Wavetable Bundling And Runtime Mip Plan

This file is the current plan for one specific problem:

- keep shipping the Serum-style source WAV files as separate bundle assets
- restore proper mip-selected wavetable playback in the synth
- stop relying on the current raw-frame upload path that bypasses mip selection

This replaces the older plan in this file. The older plan assumed the synth would
keep using a precompiled shared bank. That is no longer the active architecture.

## What Exists Right Now

The current app ships the wavetable source files separately:

- `assets/factory-bank-catalog.json` is the table catalog
- `assets/factory_sources/` contains the source WAV files

The current synth runtime does not use mip selection:

- `cmajor/FixedFrameOscillator.cmajor` currently plays one uploaded raw table
- it does not select a mip level at render time
- it is not reading the older compiled `factory-bank.wav` format

The current iPhone standalone app already loads bundle files successfully, but it
does that through custom generated-plugin glue:

- `ios_auv3/CMakeLists.txt` copies the catalog and source WAVs into the app bundle
- `scripts/generate_ios_auv3_plugin.sh` patches the generated iOS plugin so the
  patch runtime can open bundled files from the app bundle
- that same generated plugin currently contains custom native wavetable upload code

So the part that is already solved is:

- separate bundled wavetable files can be shipped in the iPhone app and opened at runtime

The part that is not solved is:

- mip-selected playback from those bundled files

## Final Architectural Decision

Use a Cmajor patch worker as the single cross-target wavetable loading layer.

That means:

- keep the source WAV files as separate shipped assets
- add a patch worker to load and compile one selected table at runtime
- restore mip-aware playback inside the oscillator
- remove the current host-specific wavetable upload code after the worker path works

This is the reviewed decision after an architecture pass and adversarial review.

## Why The Worker Is The Right Boundary

The patch worker is the correct place for wavetable loading because it belongs to
the patch runtime, not to the visible editor and not to one host wrapper.

That gives us one place that owns:

- startup preload
- `wavetableSelect` changes
- stored-state restore
- table-loading policy
- runtime mip compilation

This avoids having one wavetable loader in the desktop editor and a second,
different wavetable loader inside the generated iPhone wrapper.

The important distinction is:

- the visible patch GUI is optional
- the patch worker is part of patch lifetime

## Packaging Rule

Do not add `assets/factory_sources/**` to `resources` in the iPhone generated
patch path.

Reason:

- in Cmajor, `resources` is used by exporters to decide which files to embed
- `cmaj generate --target=juce` inlines every matching resource into generated
  `PatchClass::files`
- if we list the full wavetable source library there, the generator will stuff
  the whole library back into generated C++

That is exactly what we do not want.

So the packaging rule is:

- keep the WAV files in the app bundle
- let the runtime open them from the bundle filesystem
- do not mark the whole library as generated embedded resources

## iPhone Runtime File Access

The iPhone app already has a custom hybrid manifest loader.

That hybrid loader is the mechanism we should keep using.

What it does:

- embedded files still work for generated patch code and UI files
- bundle-backed file reads work for shipped runtime files such as:
  - `assets/factory-bank-catalog.json`
  - `assets/factory_sources/...`

This means the worker plan does not require inventing a brand-new bundle loader.
It requires reusing the current bundle-aware manifest path and removing the
current native raw-table uploader that sits on top of it.

Desktop does not need this patch because the live development plugin already
loads the patch from the real filesystem.

## Target Runtime Shape

### Assets

Keep these as the shipped source-of-truth assets:

- `assets/factory-bank-catalog.json`
- `assets/factory_sources/**`

Do not bring back a full shared compiled bank as the primary runtime asset.

### Manifests

Add a `worker` entry to:

- `WavetableSynth.cmajorpatch`
- `WavetableSynth.iOS.cmajorpatch`

The worker should be pure JavaScript with no DOM or WebAudio dependency so it
can run under the current hidden-WebView worker backend and any future QuickJS
worker backend.

### Worker Responsibilities

The worker becomes the single owner of runtime wavetable loading.

It must:

- read `assets/factory-bank-catalog.json`
- load the selected `sourceWav`
- decode the WAV audio data
- compile the selected table into mip frames
- stream those mip frames into the patch
- react to `wavetableSelect`
- restore the selected table when the patch reloads

The worker should not own display rendering. The visible UI can still load source
WAVs for visualization, but it should stop sending audio wavetable data into the
patch once the worker path exists.

### DSP Responsibilities

Restore mip-aware playback in `cmajor/FixedFrameOscillator.cmajor`.

The oscillator should:

- store one compiled current table in v1
- choose a mip level at render time from oscillator pitch
- read the selected mip with the same padded-frame layout used by the old bank
- fall back to darker loaded mips if the demanded brighter mip is not ready yet
- output silence while a new table is loading and no usable mip is ready

The current raw-frame-only upload path is not enough, because it bypasses mip
selection entirely.

## Runtime Mip Compiler Contract

The worker mip compiler must match the existing Python reference in `wtbank.py`.

Per source frame:

1. subtract the frame mean
2. run an `rfft`
3. zero the DC bin
4. for mip index `0..10`, keep only harmonics `1..(1 << mipIndex)`
5. run `irfft(..., n=2048)`
6. pad the result to the same cubic-read layout used by the old bank

The runtime mip-selection rule in DSP must match the reference logic already used
by the older offline path.

This is not the place to invent a new mip algorithm.

## Runtime Protocol

Use explicit load and frame messages between worker and DSP.

- `LoadBegin { generation, tableIndex, frameCount }`
- `MipFrame { generation, tableIndex, mipIndex, frameIndex, float32[2048] }`
- `UploadAck { generation, tableIndex, mipIndex, frameIndex }`
- `MipRequestOut { generation, tableIndex, mipIndex }`

Important rule:

- `UploadAck` must include both `generation` and `tableIndex`

That prevents stale acknowledgements from an older table load from accidentally
advancing a newer table load.

## DSP State Machine

V1 keeps one compiled-table buffer only.

That means:

- no old/new double buffer
- no click-free crossfade
- table change is allowed to interrupt active notes

The state machine is:

### `Loading`

Entered on `LoadBegin`.

Actions:

- clear readiness for the pending generation
- mark the active table unavailable
- output silence

### `Playable`

Entered when the mip currently demanded by playback has all frames ready for the
current generation.

Actions:

- reset oscillator phase to `0`
- resume normal playback

While in `Playable`:

- if a brighter demanded mip is not loaded yet, fall back only to the nearest
  darker loaded mip in the same generation
- if no darker loaded mip exists, output silence

Stale generations must be ignored.

## Transport Discipline

The transport is the real risk in this design, not the FFT math.

So the worker must be strict:

- do not pre-materialize a whole-table upload queue
- do not blast the entire mip pyramid into the patch at once
- keep only a tiny in-flight credit window
- treat `UploadAck` as a hard credit signal

The worker may cache spectra for the current table only. That cache is allowed
because it avoids repeating FFT work while keeping memory bounded.

## What Gets Removed

After the worker path is proven, remove the current host-owned audio upload code:

- the custom native wavetable uploader in `scripts/generate_ios_auv3_plugin.sh`
- the GUI-driven wavetable uploader in `patch_gui/index.js`

After that cleanup:

- hosts only provide patch lifetime and bundled files
- the worker owns wavetable loading
- the UI owns browsing and display

## Implementation Steps

### 1. Prove Worker Lifetime

Add the worker to both patch manifests and confirm that it starts before the
editor opens on both desktop and iPhone.

Success means:

- the worker can read the catalog
- the worker can read one source WAV
- this works without opening the editor

### 2. Restore Mip-Aware Oscillator Logic

Replace the raw-frame-only oscillator upload contract with the mip-aware one.

Success means:

- the oscillator can receive mip frames
- the oscillator selects a mip at render time
- the oscillator can reject stale generations cleanly

### 3. Build The Worker Mip Compiler

Implement the runtime compiler in JavaScript and match it against the Python
reference.

Success means:

- the JS runtime compiler emits the same mip data as `wtbank.py` for fixture tables

### 4. Wire Worker Loading

Have the worker respond to `wavetableSelect`, compile the selected table, and
stream it into DSP using the credit-based protocol.

Success means:

- the default table loads automatically
- selecting a new table changes the audible table
- this still works when the editor is closed

### 5. Remove The Old Upload Paths

Delete the temporary host-specific upload code once the worker path is working.

Success means:

- there is one wavetable-loading path, not two

### 6. Validate On iPhone

Run the actual standalone iPhone app and confirm:

- app launch still succeeds
- the default table loads without opening the editor
- switching tables changes the sound
- no new crash or watchdog issue appears

## Tests Required

### Golden Algorithm Tests

- JS mip compiler matches `wtbank.py` for:
  - sine
  - saw
  - square
  - at least one real Serum-exported table

### DSP Protocol Tests

- stale `MipFrame` messages are ignored
- stale `UploadAck` messages are ignored
- `LoadBegin` clears readiness
- the oscillator becomes playable only when the demanded mip is ready
- fallback to a darker loaded mip works

### Runtime Lifecycle Tests

- the worker starts when the patch loads
- the worker can load a table without the visible GUI
- `wavetableSelect` restore triggers the correct table load

### Device Validation

- the iPhone standalone app launches
- the audible table changes after a table switch
- high notes sound darker than low notes because mip selection is active again

## Go Or No-Go Gate

The worker architecture is the approved plan, but it still has one practical
gate:

- worst-case table load on iPhone must not crash, watchdog, or stall badly

If that gate fails, the fallback is not "rewrite the same worker in native C++".
The fallback would be a deeper transport or asset-format change, such as:

- precomputed per-table mip sidecar files
- or another runtime file-backed compiled-table format

That fallback is intentionally not the v1 plan.

## This Plan Removes One Specific Mess

The current repo has three different ideas mixed together:

- separate shipped source WAVs
- a raw-frame upload oscillator with no mip selection
- custom host-owned wavetable loading code

The point of this plan is to collapse that back to one coherent architecture:

- separate shipped source WAVs stay
- the worker owns wavetable loading
- the oscillator does mip-selected playback again

