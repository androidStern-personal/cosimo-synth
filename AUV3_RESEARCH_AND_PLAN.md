# AUv3 Research And Implementation Plan

Historical note: this file was written before the iOS shell and repo cleanup landed.
Current live paths are `ios_auv3/`, `tools/desktop_native/`, and `cmajor/WavetableSynth.cmajor`.

## Why this file exists

This file is the durable record of what we learned about getting this synth onto iOS as an AUv3 without turning the repo into two separate synths.

The goal is to keep one shared synth and add a separate iOS shell around it.

## What is true right now

### The current macOS development plug-in works

The working desktop plug-in is `desktop_native`.

It is:
- a custom macOS development shell around Cmajor and JUCE
- loading `WavetableSynth.cmajorpatch` directly from the repo on disk
- hot-reloading patch changes for development in Ableton Live

It is not:
- an iOS-ready shell
- the stock generated Cmajor plug-in
- something we should try to reuse unchanged inside an AUv3 extension

### The current desktop shell is desktop-only by design

The current macOS shell depends on things that do not map to iPhone or iPad:
- `COSIMO_PATCH_PATH`
- a macOS bundle layout using `Contents/Resources`
- `libCmajPerformer.dylib`
- runtime file watching
- desktop Audio Unit installation into `~/Library/Audio/Plug-Ins/Components`
- ad-hoc macOS signing

### The repo does not have an iOS shell yet

Right now the repo does not contain:
- an iOS containing app target
- an AUv3 extension target
- an iOS Xcode project generated from the repo
- iOS asset catalog setup

The only wrapper project in the repo today is `desktop_native`.

## The clean boundary

### One shared synth

These files should stay the single source of truth:
- `WavetableSynth.cmajorpatch`
- `WavetableSynth.cmajor`
- `cmajor/FixedFrameOscillator.cmajor`
- `assets/factory-bank.wav`
- `patch_gui/`
- the future patch worker for wavetable loading
- asset tools like `build_assets.py` and `wtbank.py`

These things should exist in exactly one place:
- DSP logic
- parameter names
- parameter ranges
- stored state keys
- wavetable resource format
- preset semantics
- UI message names

### One desktop development shell

These files should stay desktop-only:
- `tools/desktop_native/CMakeLists.txt`
- `tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp`
- `scripts/build_desktop_native.sh`

Their job is:
- point at the repo patch on disk
- hot-reload source changes
- make macOS development in Live practical

### One iOS AUv3 shell

This still needs to be added.

It should own:
- the iOS containing app
- the AUv3 extension target
- iOS signing and entitlements
- iOS bundle and resource packaging
- device build settings

It should not redefine:
- DSP
- parameters
- patch behavior
- preset semantics

## What Apple expects

Apple’s AUv3 model is not a loose plug-in file. It is an app extension inside a containing app.

Important platform rules:
- the host embeds the extension UI as a remote view controller
- the host chooses the view container size
- the UI and the audio unit can be created in either order
- shared writable storage between app and extension needs an App Group
- extension-safe code matters
- debugging and profiling happen through the containing app and host process

This is why the current repo-path desktop loader is the wrong shape for iOS.

## What JUCE helps with

JUCE does help with the part that matters most: shared plug-in code.

JUCE can:
- build one shared plug-in core into `Standalone` and `AUv3`
- create the AUv3 extension target
- create the standalone app target
- embed the AUv3 extension into the standalone app on iOS when both are built
- let us keep shared processor/editor logic

JUCE does not remove:
- the containing app requirement
- signing and entitlements
- extension lifecycle rules
- the need for real-device testing
- resource packaging problems caused by desktop assumptions

## The best build direction for this repo

The safest iOS path is not to stretch the current JIT dev shell into AUv3.

The safest iOS path is:
1. keep `desktop_native` as the desktop dev tool
2. add a new `ios_auv3` sibling project
3. build the iOS shell from self-contained generated Cmajor JUCE code

That means using:
- `cmaj generate --target=juce`
- a generated `cmajor_plugin.cpp`
- a JUCE iOS target that builds `Standalone + AUv3`

Why this is the cleanest path:
- it removes the repo-path dependency
- it removes the macOS dylib dependency
- it bundles the patch and resources into the generated plug-in code
- it is much closer to what an iOS extension actually wants

## Why the current desktop JIT shell is a bad iOS starting point

The current shell:
- uses `cmaj::Engine::create()`
- depends on `CMAJOR_DLL=1`
- loads a macOS `libCmajPerformer.dylib`
- relies on file watching and repo files

The local Cmajor checkout also does not look like a clean source-built iOS JIT setup right now, which makes the generated self-contained route even more attractive for the first iOS pass.

## What repeated AUv3 failures look like in real projects

The DSP is often not the main problem.

The common failures are:
- multi-instance load and reopen failures because editors or assets use too much memory
- resource and file access failures because desktop-style paths do not work inside the extension
- saved-state failures when parameters change shape
- editor bugs because hosts create, resize, destroy, and reopen the UI on their own schedule
- confusion caused by host suspension when there is no active input
- host-specific behavior differences

For this repo, the most important warning is:
- do not assume the synth working once in a fresh insert means the AUv3 is reliable

## Repo-specific risks we already know about

### The current UI is too desktop-shaped

The patch view currently targets `1120 x 680`.

That is likely too wide for iPhone.

We may need one of these:
- make the current UI responsive enough for iPhone and iPad
- add `WavetableSynth.iOS.cmajorpatch`
- add an iOS-specific patch UI entry file later

### Resources must be available in both app and extension bundles

On iOS, the app and the AUv3 extension are separate bundles.

If runtime code loads resources from the current bundle, both bundles need the resources they use.

Minimum runtime resource set:
- patch manifest or generated embedded equivalent
- `assets/factory-bank.wav`
- `patch_gui/index.js`
- `patch_gui/wavetable-bank.js`
- `patch_gui/wavetable-display.js`

### Parameters are saved-project data

Once saved projects exist in the iOS host, we must treat parameter IDs, order, and count as compatibility-sensitive.

We should not casually change them later.

### Debugging on device will be awkward

We should expect:
- launching a host on a device
- attaching to the extension process
- using logs deliberately
- spending time on lifecycle bugs, not just DSP bugs

That is normal for AUv3 work.

## Deep testing strategy

The point of testing is to prove:
- the app installs
- the extension can be discovered
- the synth makes sound
- parameter behavior is correct
- saved state survives relaunch
- the UI survives real host lifecycle behavior
- several instances can coexist
- resources always load
- the extension behaves correctly in our own host on a real device

### Test evidence to keep

For every serious test, capture:
- device model
- iOS version
- host app build
- plug-in build identifier
- exact steps
- pass or fail in one sentence
- short screen recording when visual behavior matters
- app and extension logs
- memory number when memory is the topic
- CPU number when render load is the topic

### Test order

#### 1. Build and install smoke test

Purpose:
- prove the standalone app and AUv3 extension can be built, installed, and discovered

Steps:
- generate the iOS Xcode build
- build `Standalone + AUv3`
- install on a real device
- launch the standalone app
- verify the extension is visible to the host

Pass means:
- the app installs
- the app launches
- the host can discover the AUv3
- a fresh insert succeeds after a cold launch

#### 2. Fresh insert and sound test

Purpose:
- prove the AUv3 renders audio

Steps:
- create a fresh track
- insert the AUv3
- send notes
- test note on, note off, repeated notes, held notes, and velocity changes

Pass means:
- audio is heard
- no silence after insert
- no crash
- note behavior is stable across repeated inserts

#### 3. Parameter behavior test

Purpose:
- prove the host and the extension agree on parameters

Steps:
- enumerate parameters in the host
- change parameters from the UI
- change parameters from the host
- automate parameters
- reopen the editor and verify values still match

Pass means:
- names and ranges are correct
- host-side and UI-side changes stay in sync
- automation works
- no stale or dead parameters

#### 4. Save and reopen test

Purpose:
- prove project state survives a real shutdown

Steps:
- insert the synth
- set non-default parameters
- save a project
- kill the host app
- relaunch the host app
- reopen the project

Pass means:
- the plug-in loads
- sound matches
- parameters restore correctly
- no restore crash

#### 5. UI lifecycle and resize test

Purpose:
- prove the editor survives how AUv3 hosts really behave

Steps:
- open the editor before audio starts
- open it after audio starts
- repeatedly open and close it
- rotate the device
- resize if the host allows it
- background and foreground the app with the editor open and closed

Pass means:
- no blank or missing view
- no crash on open or close
- layout remains usable
- no assumption that the editor lives forever

#### 6. Resource loading test

Purpose:
- prove wavetable assets and patch UI resources always load from bundled data

Steps:
- cold install on device
- fresh insert
- verify the wavetable display loads
- verify sound still uses the bank
- repeat after host relaunch

Pass means:
- no missing bank errors
- no repo-path dependency
- no file-not-found behavior after install

#### 7. Multi-instance load and reopen test

Purpose:
- catch the AUv3 failure class that shows up most often in the wild

Steps:
- load several instances
- open some editors and leave others closed
- save the project
- relaunch the host
- reopen the project

Pass means:
- all instances load
- no memory spike that kills the process
- no silent instances
- no reopen crash

#### 8. Memory pressure test

Purpose:
- make sure editors and resources do not break real projects

Steps:
- measure memory after one insert
- measure after several inserts
- measure with many editors opened and then closed
- repeat around project reopen

Pass means:
- memory growth is understandable
- no runaway editor cost
- no reopen failure caused by UI allocation

#### 9. Suspension and interruption test

Purpose:
- verify real iOS lifecycle behavior

Steps:
- stop transport
- background the app
- return to foreground
- trigger interruptions if practical
- change audio route if practical

Pass means:
- the synth resumes correctly
- no permanent silence
- no wedged UI

#### 10. External host sanity test

Purpose:
- catch obvious AUv3 compliance mistakes after our own host works

Suggested hosts:
- GarageBand
- AUM
- Logic Pro for iPad if available

Pass means:
- discoverable
- insertable
- basic sound works
- editor opens

Important rule:
- do this after our own host is stable, not before

## End-to-end implementation plan

### Ticket 1: Add the iOS shell

Goal:
- add an iOS wrapper project without changing synth behavior

Work:
- create `ios_auv3/`
- add a JUCE CMake project there
- create one plug-in target that builds `Standalone + AUv3`
- keep `desktop_native/` unchanged as the macOS dev shell

Done when:
- the repo can generate an iOS Xcode project
- the repo clearly has one desktop shell and one iOS shell

Main risk:
- trying to make the current desktop shell serve both jobs

### Ticket 2: Build iOS from generated self-contained Cmajor code

Goal:
- remove repo-path and macOS runtime assumptions from the iOS path

Work:
- add a build step that runs `cmaj generate --target=juce`
- feed it `WavetableSynth.cmajorpatch` or `WavetableSynth.iOS.cmajorpatch`
- compile the generated `cmajor_plugin.cpp` inside the iOS JUCE project

Done when:
- the iOS target no longer depends on `COSIMO_PATCH_PATH`
- the iOS target no longer depends on `libCmajPerformer.dylib`
- the generated plug-in contains the synth and resources

Main risk:
- dragging the desktop JIT loader into the extension

### Ticket 3: Make resource loading work in both app and extension

Goal:
- prove the wavetable bank and patch UI resources load from bundled data on device

Work:
- verify the generated plug-in embeds needed resources
- verify the runtime path used by `patchConnection.getResourceAddress(...)`
- verify both the app and the extension can load what they need

Done when:
- the wavetable display loads on device
- sound uses the bank
- no missing-file behavior appears after install

Main risk:
- bundling resources only into the app or only into the extension

### Ticket 4: Add the smallest iOS host harness we control

Goal:
- test the extension in our own host as early as possible

Work:
- add a simple host screen that can:
  - discover the AUv3
  - instantiate it
  - send notes
  - set parameters
  - open and close the editor
  - save and reload state

Done when:
- the basic smoke suite can run entirely in our own host on a device

Main risk:
- relying only on the standalone app and testing the host-extension path too late

### Ticket 5: Make the editor usable on iPhone and iPad

Goal:
- fix the desktop-sized UI for mobile screens

Work:
- decide whether the current patch UI can become responsive
- if not, add `WavetableSynth.iOS.cmajorpatch`
- if needed, add an iOS-specific patch UI entry file
- keep the interaction model aligned with the shared synth parameters and messages

Done when:
- the editor is usable on iPhone
- the editor is usable on iPad
- no desktop-only sizing assumptions remain

Main risk:
- keeping a huge desktop canvas and hoping the host scales it acceptably

### Ticket 6: Freeze parameter and state behavior

Goal:
- prevent saved-project restore bugs later

Work:
- confirm stable parameter IDs, order, and names
- confirm saved state keys
- version the state if needed
- only port the desktop empty-state guard if a real iOS host proves it is needed

Done when:
- save and reopen work reliably
- automation survives relaunch

Main risk:
- changing parameter schema casually after saved projects exist

### Ticket 7: Add multi-instance and reopen reliability tests

Goal:
- catch the most common AUv3 failure class before broad rollout

Work:
- automate or document repeatable tests for:
  - several instances
  - mixed editor open and closed states
  - save and reopen
  - memory measurement

Done when:
- several instances survive reopen on a real device

Main risk:
- focusing only on one fresh insert and missing the real failure mode

### Ticket 8: Add interruption, route-change, and suspension tests

Goal:
- verify real iOS lifecycle behavior

Work:
- test background and foreground
- test audio interruptions
- test transport stop and start
- test route changes where practical

Done when:
- the synth recovers cleanly

Main risk:
- assuming render callbacks keep running when the host or system suspends work

### Ticket 9: Run one external-host sanity pass

Goal:
- catch obvious AUv3 compliance mistakes outside our own host

Work:
- test at least one external host after our own host is stable
- verify discovery, insert, sound, and editor open

Done when:
- we have one successful external-host sanity result

Main risk:
- doing this too early and debugging two moving targets at once

### Ticket 10: Return to renderer tuning only after the iOS shell is real

Goal:
- stop mixing platform bring-up with visual tuning

Work:
- keep renderer tuning paused until:
  - the iOS shell exists
  - the AUv3 can be inserted
  - basic sound works on device

Done when:
- platform bring-up is stable enough that visual tuning is not fighting platform uncertainty

## Immediate next step

Do not start by changing synth behavior.

Start with:
1. create `ios_auv3/`
2. add the JUCE `Standalone + AUv3` shell
3. wire in generated self-contained `cmajor_plugin.cpp`
4. prove it builds into an iOS app with an embedded AUv3 extension
5. test fresh insert and sound on a real device

## Sources

Apple
- [Audio Unit app extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/AudioUnit.html)
- [App extension creation, debugging, and testing](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionCreation.html)
- [Sharing code and data between app and extension](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionScenarios.html)
- [Audio units and sandboxed file access](https://developer.apple.com/library/archive/technotes/tn2312/_index.html)

JUCE
- [Features](https://juce.com/juce/features/)
- [App and plug-in packaging](https://juce.com/tutorials/tutorial_app_plugin_packaging/)

Community warnings
- [JUCE on extension-safe APIs](https://forum.juce.com/t/auv3-and-ios-app-extensions/44963)
- [JUCE on debugging AUv3 in a host](https://forum.juce.com/t/cant-debug-auv3-in-a-host-on-ios/67732)
- [JUCE on memory pressure in Logic Pro on iOS](https://forum.juce.com/t/juce-7-auv3-high-memory-pressure-in-logic-pro-on-ios/61534)
- [JUCE on AUv3 restore crashes with state changes](https://forum.juce.com/t/ios-auv3-crash-in-juceaudiounitv3-setfullstate/55394)
- [JUCE on GarageBand muting synths with input buses](https://forum.juce.com/t/audioplugindemo-no-sound-in-garageband-ios/34655)
- [Host resize and UI problems](https://forums.steinberg.net/t/3rd-party-issue-auv3-resizing-issues/929518)
