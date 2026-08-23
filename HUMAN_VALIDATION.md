# Bounce in Place — Mac, iPhone, AUv3, and Ableton validation

Status: required M8 human run. The browser product and Linux-native probes are
automated. This VM cannot build, sign, install, profile, or host the Apple
targets, so every result cell below is intentionally blank.

M8 is **native readiness, code-complete only**. The branch compiles the native
capture driver, real desktop JIT adapter, generated-iOS AOT factory binding,
streaming bank writer, content store, and binary project envelope into the
native source lists. It does not claim that a user-facing native Bounce action
or the **Embed bounced audio in project** switch has passed host integration.
If either control is absent, record `NOT EXPOSED — M8 SCOPE` rather than calling
the associated scenario a pass. The working end-to-end product target on this
branch is the browser.

## Decision rules

- Functional corruption, stale-session commit, audio-thread I/O/allocation,
  unbounded render work, a deadline-miss regression, jetsam/extension death,
  or memory that ratchets across cycles is a hard failure.
- Absolute render/JIT time is a reported UX measurement. A slow result on the
  small cloud VM is never a native rejection. Mac/iPhone results also require
  hardware, OS, thermal state, sample rate, root count, hold, and tail settings.
- Compare adjacent before/after or oscillator/sampled windows on the same
  machine. A bank-resident oscillator window must remain within 10% of its
  adjacent pre-install window and add no deadline misses.
- If capture is unsafe inside AUv3 memory limits, the locked pivot is
  standalone-only capture into the shared App Group; AUv3 remains a reader.
  Do not weaken session fencing or retain multiple transient performers.
- If an Ableton/host state limit rejects an embedded bank, retain digest-only
  state and show an explicit portability failure. Never truncate or silently
  fall back to an unverified same-named file.

## 1. Record the test identity

From a clean checkout on the Mac:

```bash
git switch codex/bounce-in-place
git pull --ff-only origin codex/bounce-in-place
git status --short
git rev-parse HEAD
sw_vers
uname -m
system_profiler SPHardwareDataType | sed -n '1,20p'
cmaj version
node --version
npm --version
xcodebuild -version
```

Required identity:

| Field | Result |
|---|---|
| Commit | |
| Mac model / chip / RAM | |
| macOS / architecture | |
| Cmajor (must be 1.0.3066) | |
| Xcode | |
| iPhone model / iOS / free storage | |
| Ableton Live version | |

Stop if the worktree is dirty for an unexplained reason or Cmajor is not
1.0.3066. Preserve logs under `build/human-validation/`:

```bash
mkdir -p build/human-validation
npm ci
```

## 2. Mac compile and native-driver gate

Build/install the current desktop wrappers first. This also places the pinned
Cmajor runtime where the JIT probe can find it:

```bash
npm run synth:desktop:build \
  2>&1 | tee build/human-validation/desktop-build.log
test -d "$HOME/Library/Audio/Plug-Ins/VST3/CosimoDesktopNative.vst3"
test -d "$HOME/Library/Audio/Plug-Ins/Components/CosimoDesktopNative.component"
test -d build/desktop_native/CosimoDesktopNative_artefacts/Release/Standalone/CosimoDesktopNative.app
```

The installed VST3 path must be exactly
`~/Library/Audio/Plug-Ins/VST3/CosimoDesktopNative.vst3`.

Run the platform-neutral driver/store tests, generated production sampler, and
the actual production-manifest JIT/QuickJS adapter:

```bash
npm run test:bounce:native:driver \
  2>&1 | tee build/human-validation/native-driver.log
npm run test:bounce:native:store \
  2>&1 | tee build/human-validation/native-store.log
npm run test:bounce:native:generated \
  2>&1 | tee build/human-validation/native-generated.log
/usr/bin/time -lp npm run test:bounce:native:quickjs \
  2>&1 | tee build/human-validation/native-quickjs-run1.log
/usr/bin/time -lp npm run test:bounce:native:quickjs \
  2>&1 | tee build/human-validation/native-quickjs-run2.log
/usr/bin/time -lp npm run test:bounce:native:quickjs \
  2>&1 | tee build/human-validation/native-quickjs-run3.log
```

The QuickJS probe must say that three recursive production-patch roots passed.
For each run, copy its three `initSeconds`, `totalSeconds`, captured frames,
peaks, and realtime multipliers below. The init values include production JIT
load/readiness for a fresh root. Timing may be slow; a thrown error, silent
root, bad session rejection, or non-finite output is the failure.

| Run | root 48 init s | root 60 init s | root 72 init s | total s | render × realtime | result |
|---|---:|---:|---:|---:|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

Record generated `sizeof(WavetableSynth)` here: ______ bytes. The Linux proof
was 135,615,616 bytes; an Apple difference must be explained before device
profiling.

For UI review, start the required HMR wrapper in another terminal and verify
the server and freshly launched app, then stop it normally after review:

```bash
npm run synth:desktop:dev
curl --fail http://127.0.0.1:5174/__cosimo-dev-status
```

Confirm the desktop and 393×852 layouts expose Bounce, progress/cancel,
waveform, inert controls, Re-Bounce, and Revert. The native backend is not
considered integrated merely because this browser UI is visible.

## 3. Desktop performance and thread audit

Use Instruments **Time Profiler**, **Allocations**, and **System Trace** on the
standalone. Name/mark these windows in the trace:

1. 30 s oscillator baseline with a held C4.
2. JIT/offline capture initialization and three roots.
3. 30 s sampled playback.
4. 30 s oscillator playback after Revert while the bank remains resident.
5. Ten Bounce → Revert cycles if the native host action is exposed.

Inspect the audio callback stacks. `BounceBankStore`, `Sha256`, filesystem,
`flock`, `malloc/new`, QuickJS initialization, and JIT symbols must never be
under `processBlock`. Offline work must remain on one background job, use
blocks no larger than 128 frames, and flush roots sequentially.

| Metric | Pre oscillator | Sampled | Resident-bank oscillator | Gate/result |
|---|---:|---:|---:|---|
| mean process load | | | | resident delta ≤10% |
| p99 process load | | | | report |
| deadline misses | | | | no added misses |
| steady physical memory MiB | | | | no ratchet |
| post-ten-cycle memory MiB | n/a | n/a | | bounded |

## 4. Ableton VST3 state/chunk matrix

Use the installed VST3, not the generic Cmajor AU loader. Start from a new Live
Set with one MIDI track, load `CosimoDesktopNative.vst3`, make a clearly
audible pad with delay/reverb, and record the branch commit in the Set notes.

The native store must resolve under:

```text
~/Library/Application Support/CosimoSynth/BounceBanks/v1/
```

After a successful exposed native Bounce, capture the reference without
modifying it:

```bash
for bank_file in "$HOME/Library/Application Support/CosimoSynth/BounceBanks/v1"/bank-*.csbk; do
  test -f "$bank_file" || continue
  printf '%s\n' "$bank_file"
  shasum -a 256 "$bank_file"
done
du -sk "$HOME/Library/Application Support/CosimoSynth/BounceBanks/v1"
```

Run this matrix. Save after each numbered case and fully quit/relaunch Live
where stated.

1. **Digest-only:** Bounce, save, quit, relaunch, and play C3/C4/C5. The same
   digest and sampled source must restore without rendering.
2. **Duplicate:** duplicate the device and track. Both instances must share
   one verified bank file and play identically; no second content file appears.
3. **Collect All and Save:** run Ableton's command, archive the project, reopen
   locally, and record whether Ableton copied the external bank. Digest-only
   mode is allowed to remain machine-local, but must never imply portability.
4. **Missing local bank:** quit Live, move—not delete—the selected bank aside,
   reopen, and confirm a typed `missing-bank` oscillator fallback. Restore the
   exact file before continuing.
5. **Portable embed:** enable **Embed bounced audio in project**, save as a new
   Set, quit, move the local bank aside, reopen, and require exact recovery into
   the content store before sampled mode commits. The recovered SHA-256 must
   equal the original. Restore the moved file if the test aborts.
6. **Corrupt embed:** work on a disposable copy of the Set/chunk. Alter one byte
   of the `COSIMOB1` payload and confirm `corrupt-embedded-bank`; it must not
   fall through to a same-named local file.
7. **Project transfer:** copy the portable Set to a second Mac user or clean Mac
   without the bank store. It must recover and play; the digest-only Set must
   show the explicit missing-bank state.

Use a reversible bank hide for cases 4–5:

```bash
bank_path='/replace/with/the/printed/bank-file.csbk'
mv "$bank_path" "$bank_path.human-validation-hidden"
# Run the restore case, then always put it back:
mv "$bank_path.human-validation-hidden" "$bank_path"
```

If the native action or embed switch is absent, mark its cases
`NOT EXPOSED — M8 SCOPE`; do not simulate a pass with browser OPFS. Record:

| Case | bank bytes | Live Set/chunk bytes | save s | load s | digest after | result/error |
|---|---:|---:|---:|---:|---|---|
| digest-only | | | | | | |
| duplicate | | | | | | |
| collect/archive | | | | | | |
| missing local | | | | | | |
| embedded | | | | | | |
| corrupt embedded | | | | | | |
| transferred | | | | | | |

## 5. Build, sign, install, and inspect iPhone products

Generate the checked-in UI and Xcode project, then use the known physical
device/team command. Substitute IDs only if Xcode reports a different paired
phone or signing team:

```bash
npm run ios:ui:build
npm run ios:project
xcodebuild \
  -project build/ios_device_run/CosimoSynthAUv3.xcodeproj \
  -scheme CosimoSynth_Standalone \
  -configuration Debug \
  -destination id=00008120-000139383644C01E \
  DEVELOPMENT_TEAM=JUFVT28775 \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY='Apple Development' \
  -allowProvisioningUpdates build \
  2>&1 | tee build/human-validation/ios-device-build.log
```

The Xcode compile must instantiate
`createIOSAOTBounceConfiguration<WavetableSynth>`; any template, filesystem,
Objective-C++, or linker failure is an M8 failure.

Sanity-check and install only the standalone wrapper app:

```bash
test -f 'build/ios_device_run/CosimoSynth_artefacts/Debug/Standalone/Cosimo Synth.app/assets/factory-bank-catalog.json'
test -d 'build/ios_device_run/CosimoSynth_artefacts/Debug/Standalone/Cosimo Synth.app/assets/factory_sources'
xcrun devicectl device install app \
  --device 00C7F433-8B6A-5CAC-856F-56D7385E12F9 \
  'build/ios_device_run/CosimoSynth_artefacts/Debug/Standalone/Cosimo Synth.app'
xcrun devicectl device process launch \
  --device 00C7F433-8B6A-5CAC-856F-56D7385E12F9 \
  dev.cosimo.wavetable-synth
```

Do not install the `CosimoSynth` target output or anything under
`generated/cmajor`. Verify both standalone and AUv3 signatures contain
`group.dev.cosimo.wavetable-synth` in Xcode's Signing & Capabilities view.

Before physical profiling, run the existing Simulator state/layout smoke:

```bash
uv run python scripts/run_ios_auv3_host_smoke.py \
  --build-dir build/ios_bounce_simulator_smoke \
  --output build/human-validation/ios-auv3-smoke.json
```

## 6. iPhone transient-memory gate

Use a physical iPhone, unplugged from a debugger for one final confirmation.
First profile under Xcode with **Allocations** plus **VM Tracker**. Run the
standalone once and the AUv3 extension once through the `CosimoSynthHost`
scheme or another known AUv3 host.

At 48 kHz, use the default 19 roots, 3 s hold, and 6 s tail cap. Start from a
cool device (`ProcessInfo.thermalState == nominal`), close unrelated apps, and
record:

1. 30 s live-synth baseline after factory tables settle.
2. Memory immediately before constructing the transient AOT performer.
3. Peak physical footprint during initialization, recursive-bank staging, and
   each sequential root.
4. Memory 60 s after the performer and per-root buffers are released.
5. Ten Bounce → Revert → Bounce cycles, or `NOT EXPOSED — M8 SCOPE` if the host
   action is not wired.
6. One final run without the debugger; collect any jetsam report from
   Settings → Privacy & Security → Analytics & Improvements → Analytics Data.

| Process | baseline MiB | transient peak MiB | delta MiB | +60 s MiB | cycle 10 MiB | jetsam/kill |
|---|---:|---:|---:|---:|---:|---|
| Standalone | | | | | | |
| AUv3 extension | | | | | | |

Also record total render seconds and per-root realtime multipliers. Slowness
alone is advisory. Hard failure is jetsam/extension termination, an allocation
or file operation on the render callback, concurrent root performers, a block
over 128 frames, or post-cycle memory growth that does not settle.

If AUv3 fails memory but standalone passes, enact the prescribed product pivot:
disable AUv3 capture, expose a clear **Bounce in the Cosimo app** action, write
the bank in the App Group, and keep AUv3 playback/restore. Re-run the lifecycle
matrix after that pivot.

## 7. AUv3 lifecycle and shared-container matrix

Build/run the `CosimoSynthHost` scheme on the physical phone, instantiate the
Cosimo AUv3, and verify the standalone and extension resolve the same App Group
bank digest. For each case below, begin with a known audible active bank and
note its digest. A partially staged candidate must never replace it.

1. Start capture, press Home during staging, wait 10 s, foreground.
2. Start capture, lock/unlock the phone during staging.
3. Start capture, trigger an audio interruption (phone call/Siri/another audio
   app), then resume.
4. Cancel at root 1 and again near the final root.
5. Tear down/recreate the AUv3 while an install acknowledgement is pending.
6. Change host sample rate between 44.1 and 48 kHz, then start a new capture.
7. Kill/relaunch host, standalone, and device; play the existing shared bank.
8. Run standalone and AUv3 concurrently, publish the same digest, then run GC.

Required outcome: cancellation/teardown retains the previous sound and
document; a callback from the old DSP session cannot commit; reactivation
requests the new session and restages from verified bytes; sample-rate capture
uses the current rate; racing publication creates one bank; lock contention
retains rather than deletes.

| Case | old digest retained | new session observed | stale commit blocked | audio after recovery | result/error |
|---|---|---|---|---|---|
| Home/foreground | | | | | |
| lock/unlock | | | | | |
| interruption | | | | | |
| cancel early/late | | | | | |
| AUv3 teardown | | | | | |
| SR 44.1↔48 kHz | | | | | |
| relaunch/reboot | | | | | |
| concurrent publish/GC | | | | | |

## 8. Closeout

Attach the logs, Instruments traces, Ableton test Set(s), and iOS smoke JSON to
the review. Copy the completed tables and any pivot decision into
`BOUNCE_LOG.md`. The native gate is not complete until every applicable case
has evidence; `NOT EXPOSED — M8 SCOPE` is a scope finding, not a passing result.
