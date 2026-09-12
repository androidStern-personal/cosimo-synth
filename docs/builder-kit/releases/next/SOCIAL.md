# Social announcement drafts

Not published. Use after the release audit clears and existing owners can fetch the update.

## Short post

Changing a wavetable should be as easy as turning a knob.

Builder Kit gives both the same React state API and Undo history—across your UI and audio engine.

Saving, restoring and safe data delivery included. Built for Cmajor.

## Longer post

Change a knob. Edit an envelope. Load a wavetable. Undo any of them.

Those should feel like ordinary state changes, even when the data has to cross from a WebView to the audio engine.

The next Builder Kit update gives Cmajor plugins one state system and a React hook: `usePluginState()`.

Declare your values and how to prepare your audio data. The framework coordinates saving, restoring, shared Undo and safe delivery to DSP—including preparation directly into shared memory.

Your interface can treat a curve or wavetable selection like another editable value. The framework handles the different lifetimes and delivery paths underneath.

The MSEG editor is included. The source is yours to change. Included for existing Builder Kit owners.

[Attach actual candidate recording and code excerpts. Insert the public release-note URL only after publication.]

## The hook and its proof

Positioning: **a state library for your whole audio plugin**. The useful promise is coherent editing across GUI, saved state and audio execution, with the difficult coordination handled underneath.

Demonstrate that promise with the same state hook for a simple parameter and a complex curve, followed by Undo reversing both. `usePluginState` is the kit's own hook; `usePluginHistory` exposes the shared history. Explain custom preparation and DSP interpretation in the linked guide.

The Zustand comparison can help explain the product verbally: familiar state-library ergonomics extended to audio-plugin lifetimes and data delivery. Keep the post focused on the concrete result. It is not a claim that this is built on Zustand or that it replaces arbitrary DSP code.

## Two-image code carousel

**Image 1 — “Declare it once.”**

```ts
const state = definePluginState({
  gain: parameter("gain"),
  envelope: Mseg.state(),
}, { memoryBudgetBytes: 64 * 1024 });
```

Caption: “An existing DSP parameter and the included MSEG. One state system.”

**Image 2 — “One Undo history.”**

```tsx
const gain = usePluginState(state.gain);
const envelope = usePluginState(state.envelope);
const history = usePluginHistory();

// After editing either field:
await history.undo();
```

Caption: “Undo restores the last user action through the same engine connection.”

These are API excerpts within a configured plugin, not complete standalone programs. The gain endpoint and envelope DSP routing are supplied by the plugin. A carousel should show the small API; the linked guide supplies setup and sound wiring.

Use [Carbon](https://carbon.now.sh/) for the syntax-highlighted screenshots. Its [official project](https://github.com/carbon-app/carbon) supports theme, font, background, padding and shadow customization. Use the same TypeScript theme and scale on both cards, a dark background with the Song Machines lime accent, and only the code above. Keep the text legible on a phone. Export images for review; do not use its sharing action to publish.

## Release-day sequence

1. Verify the release is reachable from the feeds existing owners use.
2. Publish the full changelog and exact update instructions.
3. Send the factual entitled-update email to the reviewed customer list.
4. Publish the short post with the actual recording; use the longer post where useful.

Do not claim “out now” while the release remains blocked.
