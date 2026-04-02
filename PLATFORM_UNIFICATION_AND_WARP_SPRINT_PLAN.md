# Platform Unification And Warp Sprint Plan

Last updated: 2026-04-02

## Why This File Exists

This file is the durable roadmap for the next major stretch of work on Cosimo Synth.

It exists because there are several overlapping refactors and feature tracks in flight:

- getting desktop and iPhone onto the same React and Vite frontend stack
- getting desktop and iPhone onto the same repo-owned host architecture
- isolating platform-specific resource loading behind one shared browser-side contract
- keeping iPhone layout and viewport behavior correct during the frontend migration
- making room for upcoming oscillator waveform warp work
- eventually supporting larger architecture features like a modulation matrix and articulation slots

The goal of this file is that someone can come back later, read only this document, and understand:

- what state the repo is in
- what was already decided
- what order the work should happen in
- what not to do out of order

## Current State Snapshot

As of this file:

- The current branch is `codex/UI-refactor`.
- Desktop already has a new React, TypeScript, Tailwind, and Vite patch UI.
- iPhone does **not** yet use that new frontend. iPhone still uses the older `patch_gui/index.js` UI stack.
- iPhone **does** already have a repo-owned native shell built around raw `cmaj generate --target=cpp` output.
- Desktop does **not** yet have that repo-owned native shell. Desktop still uses the stock Cmajor and JUCE host path.
- Both platforms still depend on some browser-side Cmajor helper JavaScript, especially `cmaj-patch-view.js` and `cmaj-patch-connection.js`.
- The old local CHOC safe-area patch is no longer needed. The real iPhone app now works on stock CHOC with the real fix applied in repo-owned host code by setting the native `WKWebView` scroll view to stop auto-insetting itself for safe areas.
- The repo is moving away from a checked-in Cmajor runtime snapshot and toward a pinned fetched runtime.

## The Architecture Split We Have Right Now

There are two separate layers to keep straight:

### 1. Native host layer

This is the C++ or Objective-C++ layer that:

- creates the webview
- creates the JavaScript bridge
- loads resources from the app bundle, dev server, or elsewhere
- talks to the Cmajor patch engine

Current state:

- iPhone: mostly repo-owned
- desktop: still stock Cmajor and JUCE host path

### 2. Browser bootstrap and frontend layer

This is the JavaScript that runs inside the webview and:

- creates the browser-side `patchConnection`
- loads the actual synth UI module
- helps the UI talk to the patch

Current state:

- desktop: new React frontend, but still booted through Cmajor browser helpers
- iPhone: old non-React frontend, also still using Cmajor browser helpers

Important consequence:

Moving to a repo-owned native shell does **not** automatically remove the dependency on the browser-side Cmajor helper files. That is a separate cleanup.

## The Real Goal

The real goal is not just “use React everywhere.”

The real goal is:

- one shared frontend framework
- one shared browser-side host contract
- one shared resource-loading model
- small platform-specific adapters under that contract
- no platform-specific resource hacks leaking all over the UI code

That matters because desktop will likely eventually need the same flexibility iPhone already needed:

- resources not strictly living in the app bundle
- user-installed wavetable libraries
- shared content folders
- dev server overrides

So desktop should not stay “special” just because it currently gets away with plain URL fetches.

## The Core Design Decision

The UI should stop caring where a resource came from.

The UI should be able to ask for:

- the factory bank catalog
- the selected wavetable source audio
- any future user-installed or shared library resources

And it should not need to know whether those came from:

- a URL in the bundle
- a dev server
- a shared library location
- a native bridge call

That implies one shared browser-side abstraction. The working name for this in discussion was `resourceClient`.

### Target browser-side shape

The exact names can change, but the important shape is:

```ts
type ResourceClient = {
  readText(path: string): Promise<string>;
  readJSON<T>(path: string): Promise<T>;
  readBytes(path: string): Promise<Uint8Array>;
  readAudio(path: string): Promise<DecodedAudio>;
  getURL(path: string): string | null;
};
```

The important rule is:

- shared UI code talks to `resourceClient`
- shared UI code does **not** branch on “does this platform happen to have `readResource` or `readResourceAsAudioData`”

## Why The Order Matters

There are three separate kinds of work here:

### A. Frontend framework unification

This means:

- desktop and iPhone both use the React and Vite frontend
- shared components
- shared state hooks
- separate layout shells where needed

### B. Host and resource unification

This means:

- desktop and iPhone both expose the same browser-side host contract
- the resource-loading differences are isolated in small platform adapters
- the UI stops containing platform-specific fallback logic

### C. New synth feature work

This includes:

- waveform warp modes like bend, sync, FM, and related phase transformations
- later features like a modulation matrix
- later features like articulation slots

If these are all done at once, the codebase will become impossible to reason about.

So the sequence should deliberately separate them.

## Recommended Order Of Operations

### Step 1. Finish and merge the current refactor branch

This branch already contains two valuable foundation changes:

- the desktop React and Vite frontend
- the repo-owned iPhone native shell work

Do **not** start the next major architecture phase while this branch is still drifting away from `master`.

Before merging this branch, fix the concrete regressions already found in review:

- the iPhone deployment target regression
- the desktop Vite `/cmaj_api` path still pointing at the deleted vendored runtime location
- the desktop test gap that failed to catch that broken `/cmaj_api` path

This merge should be treated as the infrastructure reset PR.

### Step 2. Add one shared browser-side host contract

This is the next most important refactor.

The purpose is to stop the shared frontend code from knowing platform details.

This step should:

- define the shared browser-side host contract
- define `resourceClient`
- move resource-loading decisions out of the wavetable loader and UI components
- make both desktop and iPhone implement that contract

Do this before migrating iPhone to React.

Reason:

- if the host contract is not unified first, the iPhone React migration will carry more platform-specific hacks into the new frontend

### Step 3. Put both platforms on that shared contract

This can happen before desktop gets a repo-owned native shell.

That is the key sequencing trick.

#### iPhone first-pass adapter

Keep the current iPhone native bridge behavior under the hood:

- raw resource bytes
- decoded audio data
- existing message bridge

But expose it to the frontend through the new shared browser-side contract.

#### desktop first-pass adapter

Keep the current stock desktop host for now.

Under the hood, desktop can still use:

- `getResourceAddress(...)`
- plain browser `fetch(...)`

But the frontend should see the same host contract and the same `resourceClient` API as iPhone.

This gets the frontend architecture aligned without requiring the desktop native host rewrite first.

### Required revisit before the iPhone React migration

Do **not** treat `ui/desktop/DesktopPatchView.tsx` as the final shared component architecture.

The review recorded in `DESKTOP_PATCH_VIEW_ARCHITECTURE_REVIEW.md` concluded that the current desktop page is still:

- the desktop shell
- the transport integration layer
- the resource-loading coordinator
- the widget-mounting layer
- part of the synth interaction layer

That means the next frontend architecture pass needs to extract the shared synth surface before iPhone is ported to React.

Minimum revisit goal:

- move shared synth domain hooks out of `DesktopPatchView.tsx`
- move shared synth interaction hooks out of `DesktopPatchView.tsx`
- separate desktop-only layout shell code from shared synth components
- isolate desktop-only widget adapters like the Cmajor keyboard custom element and Nexus number field

Do this before the iPhone React migration so that iPhone is built on shared synth pieces, not on a copied desktop page.

### Step 4. Migrate iPhone to the new React and Vite frontend

Do this only after Step 2 and Step 3 are in place.

This avoids porting the old platform-specific assumptions into the new frontend.

#### Important constraint

The iPhone migration should **not** assume that desktop and iPhone can share one giant responsive layout.

The safer structure is:

- shared React component library
- shared state hooks and host contract
- separate layout shells:
  - desktop
  - phone portrait
  - phone landscape

The main risk in this step is viewport and safe-area breakage on iPhone.

So the acceptance bar must include:

- real iPhone standalone app
- simulator
- portrait
- landscape
- correct safe-area behavior
- working wavetable view
- working MSEG
- working keyboard
- working resource loading

Keep the old iPhone frontend alive until the new iPhone React version passes that bar.

### Step 5. Move desktop to the repo-owned native host architecture

Do this after both platforms already share:

- the same React frontend architecture
- the same browser-side host contract
- the same `resourceClient`

That makes the desktop native host rewrite smaller and less risky.

At that point, the desktop rewrite only needs to replace:

- the native window and webview host
- the native JavaScript bridge
- the desktop resource adapter implementation

The React UI should not need major changes.

### Step 6. Decide whether to remove the remaining browser-side Cmajor helper dependency

Even after both platforms use repo-owned native hosts, they may still be using:

- `cmaj-patch-view.js`
- `cmaj-patch-connection.js`

If the goal is full ownership of the browser bootstrap too, that is a separate cleanup.

This should happen only after the shared host contract is already in place, because at that point the browser-side Cmajor helper usage should already be thin and easier to replace.

### Step 7. Add waveform warp modes

Do not start bend, sync, FM, or related warp work before the frontend and host contracts are stable enough.

Warp work will touch:

- DSP parameters
- UI controls
- patch state
- testing and reference rendering

If started too early, it will get tangled with the host and frontend refactors.

This should be the first major feature branch after the frontend and host foundation settles.

### Step 8. Leave modulation matrix and articulation slots for later

Those are larger architecture-expanding features and will benefit from the frontend and host contract being settled first.

They should happen after warp.

## Proposed Pull Request Sequence

### PR 1. Infrastructure reset

Base branch:

- `codex/UI-refactor`, then merge to `master`

Scope:

- clean up the current refactor branch
- fix the concrete regressions
- land the desktop React and Vite UI
- land the repo-owned iPhone shell work
- land the pinned Cmajor runtime fetch

Must be true before merge:

- iPhone deployment target is correct
- desktop dev server resolves `/cmaj_api` from the pinned fetched runtime
- desktop tests actually start the dev server and fetch the real files they depend on

### PR 2. Shared browser-side host contract and `resourceClient`

Base branch:

- fresh branch from updated `master`

Scope:

- define the shared browser-side host contract
- define `resourceClient`
- migrate shared resource-loading code to use it
- remove shared UI logic that branches on platform-specific helper presence

Expected outcome:

- the frontend no longer knows whether resources came from a native bridge or a URL fetch

### PR 3. iPhone React and Vite frontend migration

Base branch:

- fresh branch from updated `master`

Scope:

- move iPhone onto the new frontend stack
- reuse shared components and state
- keep explicit iPhone-specific layout shells
- use the extraction work described in `DESKTOP_PATCH_VIEW_ARCHITECTURE_REVIEW.md` rather than treating `DesktopPatchView.tsx` itself as the reusable cross-platform component layer

Expected outcome:

- both platforms are now on the same frontend framework
- iPhone viewport and safe-area behavior remain correct

### PR 4. Repo-owned desktop native host

Base branch:

- fresh branch from updated `master`

Scope:

- replace the stock desktop Cmajor and JUCE host path
- keep the same frontend-facing host contract
- keep the same `resourceClient` shape

Expected outcome:

- both platforms now have repo-owned native hosts

### PR 5. Optional browser bootstrap cleanup

Scope:

- remove remaining dependence on browser-side Cmajor helper modules if that is still desired

Expected outcome:

- the frontend boot path is also repo-owned, not just the native shell

### PR 6. Waveform warp modes

Scope:

- implement the clean transfer-function style warp work first
- keep this feature branch focused on the synth feature itself

Expected outcome:

- the feature work is no longer entangled with the host and frontend refactors

### Later PRs

- modulation matrix
- articulation slots

## Why iPhone React Migration Should Not Happen First

This is worth stating explicitly.

The most tempting shortcut would be:

- port the iPhone UI to React immediately
- figure out host and resource cleanup later

That is the wrong order.

Reason:

- the current iPhone app already has custom native resource behavior
- if the shared contract does not exist first, the new iPhone React code will end up baking that platform-specific logic directly into the new frontend
- then the desktop migration will have to unwind it again

So the shared host contract is the real prerequisite for a clean iPhone frontend migration.

## Why Desktop Native Host Rewrite Should Not Happen First

This is also worth stating explicitly.

The desktop native host rewrite is real work, but it is not the best next move.

Reason:

- the frontend architecture can be unified without it
- the `resourceClient` abstraction can be introduced without it
- the iPhone React migration can happen without it

So the desktop native host rewrite should happen only after the frontend-facing contract is already stable.

## Warp Work Notes

Waveform warp work is intentionally being deferred until after the host and frontend shape stabilizes.

This is not because the warp work is unimportant.

It is because warp work will need clean surfaces for:

- selecting warp modes
- adjusting warp amounts
- saving and restoring patch state
- testing audio results

That work will go faster and cleaner once:

- the frontend is shared
- the host contract is shared
- resource loading is no longer a moving target

For the first warp milestone, the likely scope should stay small:

- start with clean phase-remap style warp modes
- leave larger architecture features like a modulation matrix and articulation slots for later

## Immediate Next Actions

1. Finish the current branch review cleanup and merge `codex/UI-refactor` to `master`.
2. Start the shared browser-side host contract and `resourceClient` work from fresh `master`.
3. Do not begin the iPhone React migration until the shared contract exists.
4. Do not begin waveform warp feature work until the shared contract and iPhone frontend migration are settled enough that feature work will stay focused.

## Resume Checklist For Future Sessions

If someone returns later with no memory of the discussion, confirm these facts first:

1. Is `codex/UI-refactor` already merged to `master`?
2. Do desktop and iPhone both use the same browser-side host contract yet?
3. Does the shared frontend already talk to a single `resourceClient` abstraction?
4. Is iPhone already on the React and Vite frontend?
5. Is desktop already on the repo-owned native host?
6. Are waveform warp modes still pending, or has that work already started?

Do not assume those answers. Check them before starting the next step.
