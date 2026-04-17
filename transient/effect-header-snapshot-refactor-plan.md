# Transient Plan: Shared Effect Header And Snapshot Bank

This is a transient implementation plan for extracting the plugin preset browser and A-G snapshot system into shared UI and state code. It is not product documentation.

## Goal

Every effect plugin should use the same top header:

- The existing preset browser.
- A shared A-G snapshot strip.
- The same persistence rules across OTTLab, ChorusLab, SeqFX, and future effect plugins.

The snapshot system must be correct across UI close/reopen. Opening a plugin UI must hydrate from Cmajor stored state and render; it must not upload blank state back into the plugin just because the JavaScript view was recreated.

## Current State

- `ui/shared/effects/preset-bar.ts` already provides the shared preset browser Web Component, `cosimo-preset-bar`.
- `ui/shared/effects/effect-snapshots.ts` already provides reusable snapshot data functions: capture, apply, normalize, and parse.
- `fx/ott_lab/view/source.js` currently owns the visible snapshot strip and most snapshot behavior inline.
- `fx/chorus_lab/view/source.js` uses the preset browser but has no snapshot strip.
- `fx/seqfx/view/SeqFxPatchView.tsx` uses the preset browser from React and already has `fx/seqfx/view/seqfx-preset-adapter.ts` for capturing and applying the sequencer grid as preset stored state.

## Target Shape

Add shared modules:

- `ui/shared/effects/effect-snapshot-bank.ts`
  - Headless controller for snapshot bank state.
  - Owns active slot, slot contents, stored-state hydration, capture, recall, label edit, copy/paste import/export, and active-slot write-through.

- `ui/shared/effects/snapshot-bar.ts`
  - Visible Web Component for A-G snapshots.
  - Talks only to the snapshot bank controller.
  - Contains shared snapshot styling and interaction behavior.

- `ui/shared/effects/effect-header.ts`
  - Visible Web Component that composes `cosimo-preset-bar` and `cosimo-snapshot-bar`.
  - Plugins pass in a preset controller and a snapshot controller.
  - Keeps the top UI identical across plugins while keeping each plugin responsible for its own state adapters.

## Snapshot Bank State

New snapshot banks live in Cmajor stored state, not localStorage.

Suggested stored-state shape:

```ts
{
  kind: "cosimo.effectSnapshotBank",
  version: 1,
  effectID: "ott",
  activeSlotID: "A",
  slots: {
    A: EffectSnapshot | null,
    B: EffectSnapshot | null,
    C: EffectSnapshot | null,
    D: EffectSnapshot | null,
    E: EffectSnapshot | null,
    F: EffectSnapshot | null,
    G: EffectSnapshot | null
  }
}
```

The active slot lives inside the same stored-state value as the slot contents. That avoids the two-key race where slot contents and active-slot highlight can hydrate at different times.

## Behavior

- Open UI:
  - Attach controllers.
  - Read the snapshot bank from Cmajor stored state.
  - Render the active A-G highlight, slot labels, and filled/empty state.
  - Do not write a blank bank during ordinary UI open.

- Create empty slot:
  - Clicking an empty slot captures current plugin state into that slot.
  - The slot becomes active.
  - The bank is persisted to Cmajor stored state.

- Recall filled slot:
  - Clicking a filled slot applies that snapshot's parameters and stored state.
  - The slot becomes active.
  - The active slot is persisted.

- Edit a parameter:
  - If a slot is active, update that slot with the new parameter value.
  - Persist the bank.

- Edit plugin-specific stored state:
  - If a slot is active and a stored-state adapter exposes a subscription, recapture the adapter state into the active slot.
  - This is required for SeqFX grid edits.

- Load or reapply a preset:
  - Apply the preset normally.
  - If a snapshot slot is active, write the applied preset's resulting parameters and stored state into the active slot.
  - This makes "load preset into active snapshot slot" behave deliberately instead of accidentally relying on parameter listener echoes.

- Copy/paste:
  - Copy exports one slot as `cosimo.effectSnapshot` JSON.
  - Paste validates and applies the pasted snapshot into the target slot.
  - Incompatible snapshots must not write parameters, stored state, or target slot contents.

## OTTLab Migration

OTTLab has existing localStorage snapshots under `cosimo.ottLab.snapshotSlots.v2`.

Migration rule:

- If the new Cmajor stored-state snapshot bank is missing, read the old localStorage store.
- Validate each old slot as a `cosimo.effectSnapshot` version 2 snapshot for OTT.
- Write the migrated bank to Cmajor stored state only after validation.
- Preserve the old localStorage value for now instead of deleting user data immediately.
- If both Cmajor stored state and localStorage exist, Cmajor stored state wins.

The old active-slot stored-state key `cosimo.ottLab.activeSnapshotSlot` should only be used as migration input when the new bank is missing. New writes should go to the single snapshot-bank stored-state value.

## Plugin Integration

OTTLab:

- Replace inline snapshot fields, methods, CSS, and markup with shared header/controller wiring.
- Pass no special stored-state adapters.
- Provide localStorage migration for the existing OTT snapshot store.

ChorusLab:

- Replace direct `cosimo-preset-bar` insertion with `cosimo-effect-header`.
- Add a snapshot bank controller for `effectID: "chorus"`.
- No special stored-state adapters are needed.

SeqFX:

- Replace the React preset row host with `cosimo-effect-header`.
- Reuse `createSeqFxPresetStateAdapter`.
- Extend the adapter/controller path so SeqFX grid edits can update the active snapshot slot.
- Snapshot recall should restore the grid as well as normal parameters.

## Tests

Use TDD. Add tests before implementation.

Shared controller tests:

- Hydrates a stored bank and restores active slot.
- Does not write stored state on ordinary UI open.
- Captures an empty slot into Cmajor stored state.
- Recalls a filled slot and writes expected parameters.
- Updates active slot on parameter edit.
- Updates active slot when a preset is applied.
- Captures adapter state and applies adapter state.
- Ignores stale boot stored-state replies after the user has already changed state.
- Rejects malformed stored state without uploading an empty replacement.

Visible component tests:

- Renders slots A-G.
- Shows active, filled, and empty states.
- Label input follows the active slot.
- Copy/paste invokes controller behavior and reports messages.

Plugin tests:

- OTTLab migrates old localStorage snapshots into Cmajor stored state.
- OTTLab reopens with active slot highlighted from the stored bank.
- OTTLab preset load writes into the active snapshot slot.
- ChorusLab renders the same effect header and can capture/recall a snapshot.
- SeqFX renders the same effect header and snapshots grid stored state through its adapter.

## Acceptance Criteria

- OTTLab, ChorusLab, and SeqFX use the same visible preset/snapshot header.
- The existing preset browser behavior still works.
- Snapshot slots persist per plugin instance in Cmajor stored state.
- Reopening the UI restores active snapshot highlight, slot labels, and filled/empty slot state.
- Loading a preset while a snapshot slot is active writes the loaded state into that slot.
- Editing a parameter while a snapshot slot is active updates that slot.
- SeqFX snapshots include the sequencer grid state.
- Opening a UI never uploads a blank snapshot bank over existing plugin state.
- Existing OTT localStorage snapshot data is migrated instead of lost.

## Main Risk

SeqFX is the hardest plugin because the meaningful state is the sequencer grid, not just Cmajor parameters. The existing SeqFX preset adapter already captures and applies the grid, so the shared snapshot controller should reuse that adapter pattern instead of introducing a separate mechanism.
