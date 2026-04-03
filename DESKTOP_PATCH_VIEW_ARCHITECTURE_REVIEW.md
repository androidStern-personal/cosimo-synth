# DesktopPatchView Architecture Review

Last updated: 2026-04-02

Status on 2026-04-02

- This file is the architectural review that drove the extraction pass.
- The extraction described here has now landed: the shared hooks, desktop-only adapters, and shared synth components were moved out of `ui/desktop/DesktopPatchView.tsx`.
- Keep this file as the record of why that split was necessary, not as a claim that the repo is still in the pre-extraction state.

## Why This File Exists

This file records the architectural review of `ui/desktop/DesktopPatchView.tsx`.

It exists because the desktop React refactor did succeed at getting the desktop UI onto React, TypeScript, Tailwind, and Vite, but that does **not** mean the file is already a reusable component surface for both desktop and iPhone.

This review is meant to answer one specific question:

- is `DesktopPatchView.tsx` good enough to become the shared synth UI layer for desktop and iPhone?

Short answer:

- no

It is working transitional code, but it is still architected as a desktop page that owns too many jobs at once.

## The Main Conclusion

`DesktopPatchView.tsx` is not trash code, but it is bad architecture for the long-term goal.

The goal is:

- one shared frontend framework
- one reusable synth component system
- different layout shells for desktop and iPhone
- small platform-specific adapters under that shared UI

The current file is still:

- the desktop page
- the transport integration layer
- the resource-loading coordinator
- the widget-mounting layer
- part of the synth interaction layer

all at the same time.

That means it is not yet a good foundation for “reuse this on iPhone.”

## Actual Problems

### 1. It is still the whole feature shell, not a reusable component surface

The main page body in `DesktopPatchView.tsx` owns:

- patch parameter bindings
- runtime sync
- retry behavior
- catalog loading
- frame loading
- keyboard routing
- MSEG orchestration
- final page layout

The strongest evidence is that several hooks that should already be separate feature modules are still defined inside the same file:

- `useFactoryBankCatalog`
- `useFactoryTableFrames`
- `useObservedDisplayPosition`
- `useMsegState`
- `useStagePositionDrag`
- `useMsegEditorInteractions`

So the “component system” is still mostly one desktop page with helper code embedded inside it.

### 2. Desktop-specific widget glue is embedded directly into the page file

The file directly mounts and manages desktop/runtime-specific UI primitives:

- `KeyboardDock` subclasses and mounts the Cmajor `PianoKeyboard` custom element
- `NexusNumberField` manually instantiates and wires `Nexus.Number`

That kind of code is not inherently wrong, but it should live in small adapter components, not in the main desktop page file.

As it stands, the page file still owns:

- custom element registration
- custom element mount and teardown
- third-party widget creation
- widget DOM styling
- widget focus and event lifecycle

That is not a stable reusable component boundary.

### 3. State ownership is fragmented across too many systems

This file currently splits state across:

- React patch bindings
- class-based `MsegController`
- Cmajor keyboard element instance state
- Nexus widget instance state
- local React interaction state

That makes the page harder to reason about and harder to reuse cleanly.

The desired end state is closer to:

- domain state and synth transport state in shared hooks or shared model adapters
- platform widget integration isolated in tiny wrappers
- layout shells composing those pieces

The current file is still mixing all three.

### 4. Desktop layout-shell decisions are mixed with supposed shared synth components

The file hardcodes a desktop composition:

- top row split between wavetable and MSEG
- keyboard row at the bottom
- modal MSEG editor
- desktop-oriented spacing and geometry

And several subcomponents already encode desktop presentation assumptions, including explicit sizes and proportions.

That is fine for a `DesktopEditor` shell.

It is not fine if the same file is also where the shared synth behavior and reusable controls live.

The layout shell and the shared synth component layer are not separated yet.

### 5. The file is still too close to the current Cmajor host contract

The file still directly depends on:

- Cmajor endpoint IDs
- `patchConnection.utilities.PianoKeyboard`
- current patch transport bindings
- the current wavetable display class

That means the file is still “desktop synth page that knows the current host,” not “shared synth UI on top of a small adapter contract.”

This is exactly the kind of coupling that will make the iPhone React migration messy if it is not cleaned up first.

## What This Means Practically

This file should **not** be treated as the final reusable component architecture.

It should be treated as:

- a successful desktop React migration
- a working desktop UI
- a transitional implementation that still needs architectural extraction

Before iPhone moves to the React frontend, this file should be split conceptually into four layers:

1. Shared synth domain hooks and data loaders
2. Shared synth interaction hooks
3. Shared synth components
4. Desktop-only layout shell and desktop-only widget/host adapters

## The Split We Eventually Want

### Shared synth domain hooks

These should move out of the desktop page:

- factory bank catalog loading
- factory table frame loading
- observed wavetable position state
- MSEG state access

These should not live inside `DesktopPatchView.tsx`.

### Shared synth interaction hooks

These should also move out of the desktop page:

- wavetable stage drag behavior
- MSEG editor pointer behavior
- keyboard routing rules

These are synth interaction semantics, not desktop page layout concerns.

### Shared synth components

These should become presentation components that accept plain props and callbacks:

- wavetable stage
- MSEG overview
- MSEG editor surface
- voice mode control
- glide control surface
- keyboard section shell

The shared pieces should not know whether they are being used on desktop or iPhone.

### Desktop-only shell and adapters

These should remain desktop-specific:

- desktop page grid and spacing
- desktop keyboard adapter for the Cmajor custom element
- desktop Nexus adapter
- desktop-specific modal or toolbar choices

That is where the runtime-specific glue belongs.

## The Key Rule For Future Work

Do not port `DesktopPatchView.tsx` to iPhone by copying it or by trying to make the file itself “responsive enough.”

Instead:

- extract shared synth pieces out of it
- keep a desktop shell on top
- build a separate iPhone shell on the same extracted pieces

## Bottom Line

`DesktopPatchView.tsx` is a good proof that the desktop can run on the new stack.

It is **not** yet the shared synth component system the repo ultimately needs.

The next revisit should be an extraction pass, not a styling pass.
