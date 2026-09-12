# Social announcement drafts

Not published. Use after the release audit clears and existing owners can fetch the update.

## Short post

State management for audio plugins, built into Builder Kit.

Parameters, envelopes and wavetable changes can share one Undo history. State survives closing the UI. Prepared audio data goes into shared memory.

Built for Cmajor + React. Editable source included.

## Longer post

The next Builder Kit update handles a part of audio-plugin development that usually spreads through the whole project: state.

You declare the values. The kit handles saving, shared Undo/Redo, reconnecting the GUI, and getting prepared data into the audio engine.

A gain control and an editable envelope can use the same history. A wavetable can be prepared directly into shared storage, with the handoff to audio handled underneath.

The MSEG editor is included. The source is yours to change.

Built for Cmajor and React. Included for existing Builder Kit owners.

[Attach actual candidate recording and code excerpts. Insert the public release-note URL only after publication.]

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

## Release-day sequence

1. Verify the release is reachable from the feeds existing owners use.
2. Publish the full changelog and exact update instructions.
3. Send the factual entitled-update email to the reviewed customer list.
4. Publish the short post with the actual recording; use the longer post where useful.

Do not claim “out now” while the release remains blocked.
