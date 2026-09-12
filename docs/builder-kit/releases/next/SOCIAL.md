# Social announcement drafts

Not published. Use after the release audit clears and existing owners can fetch the update.

## Short post

Announcing `usePluginState()`.

Managing state between your UI and audio engine is complicated!

Builder Kit now handles the coordination, saving, and undo behind `usePluginState()`.

Plus music UI components, including multi-segment envelope editors, filter controls, and sliders.

## Longer post

Think `useQuery`, for audio-plugin state.

Your interface, saved project and real-time audio engine have different lifetimes and rules. Keeping them in agreement is work you should be able to hand to a framework.

The next Builder Kit update gives Cmajor plugins `usePluginState()`: one editing API for parameters, envelopes and wavetable selections, with saving, shared Undo and safe delivery to DSP handled underneath.

Declare your values and how to prepare your audio data. The framework coordinates the rest, including preparation directly into shared memory.

And the UI follows a familiar idea too: shadcn-style components with editable source. An MSEG editor, filter controls, sliders, and preset/snapshot controls you can make your own.

Included for existing Builder Kit owners. Built for Cmajor + React.

[Attach actual candidate recording and code excerpts. Insert the public release-note URL only after publication.]

## The hook and its proof

Positioning: **a state library for your whole audio plugin**. The useful promise is coherent editing across GUI, saved state and audio execution, with the difficult coordination handled underneath.

Demonstrate that promise with the same state hook for a simple parameter and a complex curve, followed by Undo reversing both. `usePluginState` is the kit's own hook; `usePluginHistory` exposes the shared history. Explain custom preparation and DSP interpretation in the linked guide.

The direct [TanStack Query comparison](https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQuery) is about approachable hooks over difficult state coordination. `usePluginState` also exposes editing and shared Undo; this is our audio-plugin API, not TanStack Query integration.

The [shadcn comparison](https://ui.shadcn.com/docs) is about editable source and composition. The exported kit contains the MSEG editor/surface, filter-range editor, sliders, parameter entry and preset/snapshot controls. The full composable Cosimo knob/context-menu extraction remains unfinished. Use “shadcn-style audio UI” for this release; do not imply that every Cosimo control has shipped as a polished component system.

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
