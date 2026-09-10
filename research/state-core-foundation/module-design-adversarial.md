# Independent adversarial review

**Result: no unresolved design-level blockers in the reviewed candidate.** This is approval of a module sketch for implementation, not production qualification.

Reviewed file: `module-design-independent.md`.

Frozen candidate SHA-256: `48637b9d6b565c9e62602ba55293a1e33ede9f38b628950d2c8b1dfa35802723`.

The review inspected actual kit scalar/state/worker code, actual MSEG UI and delivery paths, the named Jotai experiments, and the cached Cmajor Patch/PatchConnection/worker implementation. It did not use earlier architecture proposals or the rejected dynamic-data research. No production code, dependencies, builds, installs, trackers, branches, or shared runtime resources were changed by this review.

## Accepted shape

The final sketch has four live collaborators: the patch-lifetime edit service, GUI client, Cmajor channel/native-state adapter, and prepared engine binding. Pure history policy belongs inside the edit service. Jotai owns local reactivity; explicit commands and receipts own operation ordering across runtimes. A single model atom is a permissible implementation choice, not a requirement imposed by Jotai.

The persistent owner earns its cost by centralizing accepted edits, grouped history, preparation invalidation, restore, and state after GUI closure. The new command channel is explicit authorized framework work. The GUI projection and immediate draft overlay have defined reconciliation rules; they are not another durable document. Host parameters remain host-owned, and native stored state remains the persisted representation.

## Findings repaired and re-reviewed

| Original failure sequence | Final repair |
| --- | --- |
| History changed before the value; a subscriber submitted B and B published before outer edit A. | One atomic Jotai model transition plus a non-reentrant command queue. The explicit ordered effects run before the next queued command. No local subscription is treated as the operation ledger. |
| A entered an acknowledged transport and waited for its baseline; B superseded A; the transport then sent A. | Currentness/cancellation reaches the last actual send after all adapter waits. The native receiver additionally checks document epoch before enqueueing. The sketch identifies the required change inside the existing `RuntimeInstallLane`. |
| A drain finished while new desired work arrived before its `finally`, leaving work stranded; a consumed active job defect left status pending. | The owned drain has catch/finally/restart handling, cancellation settlement, and a tracked last target for failure reporting. It does not invent a task runner in `PatchWorkerServiceHost`. |
| Missing stored data had no write identity; an early status report was discarded before field hydration. | Typed native initialization distinguishes absence from invalid state. Absent defaults get an explicit initial Target. Attach includes values, readiness, history, and application status in one snapshot. |
| The client could not match a receipt to a draft, or an old update could be mistaken for a new epoch. | Every receipt carries its CommandAddress. Receipt processing is independent of snapshot revision; only authoritative native controls change epochs. Per-field acknowledged floors prevent older drafts resurfacing. Unchanged fields/metadata retain identity after snapshot decoding. |
| Host restore occurred while old parameter payloads were still queued; a synchronous suppression flag ended before those payloads were delivered. | The new owner stream reads current native parameter state at FIFO dispatch. Old payloads become wakeups for a current observation. Native restore advances epoch before mutation, rejects old-epoch effects, and supplies a complete replacement snapshot. Legacy callback payloads need not change. |
| Rejecting an old-document sequence left a hole, causing the next new-document command to fail sequence validation forever. | Sequence scope is explicitly `(owner, document, client)`. Native, service, and GUI reset together through the authoritative handshake. Both owner and document are checked before native sequence advancement. |
| A service defect left active/queued promises pending, or called a partially executed command rejected. | The defect path settles all tickets and closes readiness. Known acceptance is preserved; uncertain active work is interrupted with unknown acceptance; only unstarted work is rejected. GUI close/reset uses the same distinction and never automatically replays uncertain work. |
| A one-shot edit to another control changed the active gesture's checkpoint. | An edit from a different client/key finishes the prior gesture first. End/detach completes the matching gesture; accepted values/history/work remain with the owner. |

## Source constraints preserved

- `kit/ui/cmajor-react.ts:164-175,178-199,244-278` requires an observed host baseline and balanced native gesture ownership. The proposal preserves those obligations without treating a hook fallback as patch truth.
- Cached Cmajor `cmaj-patch-connection.js:79,108,128-135,239-247` provides void sends and uncorrelated scalar observations. The design distinguishes service acceptance, native-state observation, send evidence, and matched DSP acknowledgement.
- Cached Cmajor `cmaj_Patch.h:470-490,745-829,2528-2605,2779-2903` establishes queued parameter notifications, independent patch-worker lifetime, ordinary full-state replacement, and the lack of an existing arbitrary GUI/worker relay. The proposal names the actual framework additions.
- `ui/shared/modulation.ts:1318-1348,1512-1527` preserves compact editable curves and parameter-owned Rate. `ui/shared/runtime-install-channel.ts:287-334` contains the baseline wait that necessitates the final-send guard. The real DSP MSEG handler applies its buffer before acknowledging (`cmajor/FixedFrameOscillator.cmajor:5615-5627`).
- The Jotai experiment separates publication from subscriptions, but its host and delivery fixtures do not establish native integration. Its automation test uses different scalar fields during a curve drag, so the proposal's same-field scalar history policy is an explicit design decision, not an already-qualified result.

## Deliberate limits and next proof

History is capped at 100 completed entries for the patch-service lifetime and is cleared on document replacement/worker recreation. One active gesture is supported. Scalar Undo reasserts a prior absolute value; automation may overwrite it. A local draft that never reached native has no survival guarantee. An accepted command survives GUI closure through the persistent owner, while native persistence can still be pending or failed.

The send-only adapter proves only its stated send evidence. Already-sent data cannot universally be recalled. Imported-asset retention, atomic DSP installation, crash durability, DAW history integration, and collaborative history are not silently promised.

No runtime tests were run for this design-only review. Implementation must exercise the reviewed event sequences through the actual native/browser channel, then qualify QuickJS/Cmajor and browser lifecycle behavior. Existing library experiments do not prove production transport, GUI response under real load, installed-host behavior, or audible live updates.
