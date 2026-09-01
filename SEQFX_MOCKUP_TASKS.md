# SeqFX Mockup Tasks

This is the sole task ledger for SeqFX mockup work authorized in the coordinator conversation. Future approved mockup work appends here. `TODOS.txt` and `PROGRESS.txt` are outside this ledger and must remain untouched.

## Compact layout: effect picker and loop range

- Status: Implementation and focused verification complete; awaiting commits
- Task/agent: `/root/seqfx_mockup_layout`, reporting to coordinator `/root`
- Branch: `codex/seqfx-mockup-compact-layout`
- Worktree: `/Users/winterfell/.codex/worktrees/seqfx-mockup-compact-layout/cosimo-synth`
- Base: `6064eba67120673a748602d706c46b852c52af69` (`origin/master` at task start)
- Authorization: Change the production twelve-effect picker from three rows by four columns to two rows by six columns, and replace the large visible 32-cell loop-range strip with compact Start and End controls.
- Required preservation: Effect order and identity; selection, keyboard, accessibility, and hit-target behavior; the loop domain `1..32`; whole-step semantics; `Start <= End`; pointer, keyboard, and temporary exact entry; host-gesture boundaries; saved state, automation, DSP, and existing loop behavior; the shipped segmented-slider contracts.
- Explicit non-scope: Dark theme/colors; workspace ratios; sequence-row height; margins/gutters; typography/title; block styling; inspector/graph; preset/Mix/transport; DSP; state schema/migration; effect order; any other mockup interpretation; native builds; HMR/fixed-port launches; installs; pluginval; Ableton; physical-device; Sites; release, merge, push, deploy, or publish work.

### Decisions

1. Keep the existing production `EditorTickSlider` Start and End controls as the sole loop-range UI and remove the redundant ruler path. Those controls already own discrete whole steps, dynamic endpoint constraints, temporary exact entry, keyboard/range input, and paired `loopStart`/`loopLength` gesture callbacks. A new compact-control component would duplicate shipped behavior and create a second automation seam.
2. Own the picker geometry in its existing production CSS grid with six equal columns. The twelve option buttons and their DOM order remain unchanged, preserving identity, selection, keyboard, accessibility, and native-button behavior. The rejected responsive-column alternative would return to more than two rows at supported narrow widths and violate the authorized 2×6 geometry.
3. Prove the change through the existing composed Playwright browser seam. Add only geometry/absence/overflow coverage that was missing, then retain the existing interaction, exact-entry, state, and gesture coverage instead of cloning it into a test-only projection.

### Decision-provenance objection audit

- Fixed six columns narrow each card at the 720px supported width, so long visible names can use their existing ellipsis behavior. A responsive fallback was rejected because it would break 2×6. Composed evidence verifies every button remains inside the picker at a minimum 44×36px, with the original icon, order, full ARIA name, native keyboard activation, and selection state.
- Removing the ruler also removes its secondary 32-button focus path and loop-header playhead marks. That is a direct consequence of the explicit instruction to replace the large strip, not an inferred redesign. The production sequence grid retains playhead presentation; the compact Start/End range inputs retain pointer and keyboard access to all 32 values and temporary exact entry.
- Reusing the shipped Start/End controls retains their existing paired host gestures and dynamic endpoint limits. A new dual-handle or mockup-only control was rejected because it would create new automation and exact-entry behavior without authorization.
- No unresolved implementation uncertainty remains. Human visual preference and DAW/host acceptance were not performed and are not inferred from browser evidence.

### Focused evidence

- Pre-edit boundary: exact branch/worktree/base verified clean; `HEAD`, `origin/master`, and merge-base all `6064eba67120673a748602d706c46b852c52af69`.
- Failing-before evidence: On an ephemeral Vite origin, the two new composed checks failed against untouched production source: the default effect picker reported row counts `[4, 4, 4]` instead of `[6, 6]`, and the production surface reported one `seqfx-loop-ruler` instead of zero.
- Passing-after evidence: The two new composed checks passed 2/2 across 720/900/1120/1440 widths. A six-test focused composed run passed the global control surface, compact loop, named picker, 2×6 geometry/keyboard selection, segmented-slider contract, and global exact-entry contract. The strengthened picker hit-width check passed separately. Strict SeqFX TypeScript passed all 19 production modules. Two focused runtime-bridge tests passed host-truth/clamping/automation and explicit global gesture contracts.
- Source/scoped-diff review: Working-tree diff from `6064eba67120673a748602d706c46b852c52af69` reviewed against the loaded domain, module, testing, and TypeScript standards with no findings. Production changes are limited to the existing global-control component, its caller, and its stylesheet; browser coverage remains at the real composed seam.
- Known failures: None. The first red-test attempt did not reach tests because the isolated worktree lacked `node_modules`; an ignored worktree-local symlink to the primary checkout's existing dependency tree resolved setup without installation or provisioning.
- Generated artifacts: None. `fx/seqfx/view/index.js` remains the tracked stable loader; no tracked generated UI output required rebuilding, and `patch_gui` was not edited.

### Final handoff

- Final commit: Pending.
- Clean status: Pending commit/closeout.
- Changed scope: Fixed the production effect picker at six columns; removed only the redundant loop ruler renderer, pointer ownership path, prop, and CSS; retained the existing compact Start/End `EditorTickSlider` controls and runtime bridge; replaced obsolete ruler-specific browser tests with compact endpoint coverage; added the dedicated mockup ledger. `TODOS.txt` and `PROGRESS.txt` remain untouched.
- Unperformed gates: Native builds, HMR/fixed-port launches, plugin builds/installs, pluginval, Ableton, listening/host acceptance, physical-device, Sites, release, merge, push, deployment, and publication remain unperformed by authorization.
