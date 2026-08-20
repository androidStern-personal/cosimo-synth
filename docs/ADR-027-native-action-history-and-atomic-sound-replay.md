# ADR-027: Native action history and atomic sound replay

Status: accepted architecture — implementation not authorized — 2026-08-20

## Context

Undo has to cover one complete user action across every part of the sound: ordinary
parameters, wavetable selection, the effects rack, modulation, and articulations. Those
parts already have different accepted-state owners. Some edits also cross owner
boundaries; deleting a modulation source, for example, can remove routes and dependent
articulation data together.

The editor is not a safe history owner. A plugin host may destroy and recreate its
WebView while keeping the same synth instance alive. Conversely, Undo data must
disappear when that synth instance is destroyed and must never enter presets or DAW
project state.

Routine Undo also cannot reuse whole-preset restoration. The existing cold-restore path
rebuilds runtime state and resets voices and effect histories. Undo must preserve held
notes, effect tails, and the current page while changing the prior sound atomically.

## Decision

### One transient native history

Each running synth or plugin instance owns one native SoundEditHistory shared by desktop
and iOS. It survives editor closure but dies with the instance. History, cursors,
pending work, and replay metadata are explicitly excluded from every serialized sound,
preset, and project payload.

AcceptedLiveSound is a thin coordinating view over the existing ADR-021 parameter,
table, rack, modulation, and articulation owners. It can ask those owners to capture,
validate, stage, and publish their own data. It does not parse their documents, clone
the whole synth, or become another authority for accepted sound.

One completed history action stores:

- its user-facing name and stable editor context;
- the current sound epoch;
- owner-encoded before and after values for each changed logical fragment;
- the owner generations needed to detect a conflicting newer change.

An owner defines the smallest fragment that it can validate and restore independently,
and expands the dependency set when an edit crosses domain boundaries. Whole
modulation, articulation, or synth documents are not stored merely for convenience.
The small rack document may be one rack fragment because it is already one bounded,
independently validated value.

### Explicit user actions

The UI bridge exposes only:

- beginAction(name, context), returning an action token or temporary busy;
- normal mutations carrying that token, an ordered sequence, and their base generation;
- finishAction(token);
- undo() and redo().

One physical sound-editing gesture may actively issue changes at a time. If another
begins concurrently, it receives busy before it can mutate sound. Played notes,
auditioning, navigation, and host automation remain independent.

Begin, mutations, and finish travel through the same ordered UI-to-native ingress.
Finish seals fixed high-water marks for the owners touched by that action. Editor
teardown stops new ingress, seals everything already received, and lets registered
work finish or reject; it cannot strand a half-open action.

History observes only mutations accepted by the existing sound owners:

- the first accepted value of a fragment captures before;
- the latest accepted value captures after;
- a complete drag remains one action even when its dominant axis changes;
- rejected, cancelled-before-change, and net-zero actions create no entry;
- the first accepted new user edit after Undo clears Redo;
- Undo and Redo never record themselves.

Asynchronous actions reserve conservative conflict sets. A later disjoint action may
continue, while an overlapping action receives busy unless the owner first supersedes
the earlier request. Pending work has measured action and byte limits. Capacity pressure
is reported before admission; an admitted valid edit may not fail halfway because the
history ran out of memory.

When public history is enabled, every canonical user-originated sound mutation must
carry a valid action token. Tokenless user writes fail closed. Host changes, accepted
echoes, and nonpersistent previews do not.

### One all-or-none replay

Undo and Redo use one atomic protocol:

1. Each touched owner merges its requested fragments with current accepted state,
   validates the complete candidate, reserves bounded runtime capacity, and returns an
   opaque staged handle for one transaction and sound epoch.
2. The coordinator joins those handles without reinterpreting owner data.
3. If every owner prepared successfully, native submits one fixed-size commit
   description to the canonical Cmajor ingress.
4. At one causally observed audio-block boundary, ingress compares all owner
   generations and either publishes every staged change together or publishes none.
5. Commit identity is monotonic and idempotent. Repeating a status query or delivery
   after a delayed acknowledgement cannot apply the sound twice.
6. Accepted state, durable projections, visible controls, and the history cursor advance
   exactly once from the committed result.
7. Preset dirty state is recomputed from the resulting accepted sound against the active
   preset or Init baseline. It is not inferred from the history cursor.

The audio callback performs no allocation or unbounded lookup. Preparation and replay
storage are finite and reserved before the commit reaches it.

### Host changes and complete restores

Each real-time-visible fragment has an owner generation. Absolute pointer samples carry
the generation on which they were based. A stale sample is rejected with the current
accepted value and generation so the UI can reanchor instead of overwriting a newer host
change.

A host change is never recorded as a user action. It invalidates any intersecting active
contribution and completed history action, and clears Redo. Canonical ingress ordering
settles races:

- if the host change arrives first, generation comparison aborts replay;
- if replay commits first, the later host value applies and invalidates intersecting
  history.

Preset load, Init, effect-preset load, and full restore are nonundoable sound-epoch
barriers in the first release. Once a validated replacement claims the next epoch, new
UI edits wait and the current action settles before cutover. A successful replacement
clears Undo and Redo. A failed replacement preserves the old sound, epoch, and history.
Undoable preset replacement is deferred until it can reuse the same atomic protocol.

Source deletion must move behind canonical owner mutations with its complete dependency
set before public Undo ships. If that work is not ready, source deletion remains
disabled or protected by its legacy behavior rather than pretending to be reversible.

### Sound history does not restore navigation

Pages, tabs, open editors, scrolling, hover, focus, and selection are not sound history.
Undo repairs affected visible values wherever they are currently shown without moving
the user to another page.

The modulation-shape editor and Articulation editor must stop owning private recovery
state at public launch. Their existing recovery buttons become contextual views of the
global history and work only when its newest reversible action is the corresponding
kind of edit.

When articulation replay removes the selected slot, the articulation owner preserves
the selection if it remains valid or computes its existing deterministic fallback while
building the candidate. React receives only the final valid selection; navigation state
is never stored in the action.

### Measured memory, not an arbitrary step count

Before setting budgets, the accepted modulation-shape payload receives a finite product
bound. Release desktop and physical-iPhone measurements then establish:

- maximum pending actions;
- maximum pending bytes;
- total completed-history byte budget;
- the worst valid action in each domain and each cross-domain combination.

Completed records are evicted oldest-first when necessary. Moving an action between
Undo and Redo does not duplicate its payload. Normal supported editing must not
encounter pending-capacity busy. If one worst valid action cannot fit, the representation
or the product bound changes before shipping; that action may not silently bypass
history.

## Required feasibility proof

Before implementation proceeds beyond a hidden spike, the production-equivalent native
path must prove all-or-none replay for:

- several ordinary parameters;
- an ordinary parameter plus modulation;
- modulation plus dependent articulation data;
- rack structure;
- asynchronous wavetable activation;
- desktop and iOS;
- an actively held note and a sounding effect tail;
- every injected prepare, generation, timeout, and acknowledgement failure.

The failed case must produce the same audible and accepted result as doing nothing. If
any required combination cannot meet this contract with bounded real-time work, this
architecture is rejected rather than weakening atomic Undo.

## Rollout

1. Prove the replay boundary and measured real-time limits with the hidden spike.
2. Add the instance-owned history behind one scalar user action.
3. Connect the existing owners through small explicit fragment adapters.
4. Cover every enabled user sound-write path, add restore barriers, remove private
   recovery ownership, and canonicalize or disable source deletion.
5. Enable token enforcement and public Undo/Redo only after the complete coverage suite
   passes.

This sequence is an implementation order, not implementation authorization.

## Acceptance

Public Undo/Redo ships only when tests prove:

- one complete gesture or command creates one named action; rejection and net-zero
  changes create none;
- rolling-axis parameter drags remain one action;
- same-fragment pending edits block or supersede safely while disjoint edits proceed;
- capacity busy occurs only before mutation, always recovers, and does not occur during
  measured normal editing;
- teardown, timeout, delayed acknowledgements, and duplicate commit delivery cannot
  overlap, strand, or double-apply actions;
- host-versus-pointer and host-versus-replay races obey generation ordering;
- multi-owner replay exposes no intermediate audible, accepted, durable, or visible
  state;
- held notes and effect tails continue without a cold restore;
- preset dirty/clean state follows accepted sound versus its active baseline;
- successful preset/Init replacement clears both stacks and failed replacement preserves
  them;
- stale old-epoch work cannot reappear after a replacement;
- articulation fallback is valid without restoring navigation;
- local modulation-shape and Articulation recovery state no longer exists;
- the Settings menu shows specific commands such as Undo Delete Mapping and Redo Delete
  Mapping, with unavailable commands disabled;
- success and failure toasts use the locked concise wording and replace rather than
  stack; immediate Delete still has no confirmation or deletion toast;
- Undo/Redo updates sound and visible controls without changing page, tab, open editor,
  or scroll position;
- in a real DAW, focused Cosimo handles Command-Z and Shift-Command-Z exactly once,
  active text fields retain normal text-editing Undo, and unclaimed musical-typing and
  transport key-down/key-up events still reach the host;
- closing and reopening the editor preserves history, destroying the instance clears it,
  and serialized preset/project bytes contain no history metadata;
- byte budgets hold on release desktop and physical iPhone;
- adding any uncorrelated public user sound write fails the coverage gate.

## Rejected alternatives

- React state, a JavaScript singleton, or the current edit bus cannot own history because
  their lifetime and gesture grouping do not match a synth instance.
- Repeated whole-synth or whole-document snapshots were rejected because they duplicate
  presentation state, make valid large modulation shapes expensive, and encourage a
  second state authority.
- Cold preset restoration was rejected for routine Undo because it resets live musical
  state.
- Sequential best-effort restoration was rejected because users could hear and observe
  a partially restored sound.
- Separate modulation-shape and Articulation histories were rejected because commands
  would no longer have one chronological meaning.
