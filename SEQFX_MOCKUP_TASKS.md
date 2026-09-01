# SeqFX Mockup Tasks

This is the sole task ledger for SeqFX mockup work authorized in the coordinator conversation. Future approved mockup work appends here. `TODOS.txt` and `PROGRESS.txt` are outside this ledger and must remain untouched.

## Compact layout: effect picker and loop range

- Status: Complete
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

- Final implementation commit: `6f4dd089452d2a921058f5c324a6fab003c7ddbb` (`Compact SeqFX picker and loop controls`).
- Ledger closeout commit: This record's branch-tip commit; its exact hash is reported to the coordinator because a commit cannot embed its own hash.
- Clean status: Clean after the ledger-only closeout commit; verified in the coordinator handoff.
- Changed scope: Fixed the production effect picker at six columns; removed only the redundant loop ruler renderer, pointer ownership path, prop, and CSS; retained the existing compact Start/End `EditorTickSlider` controls and runtime bridge; replaced obsolete ruler-specific browser tests with compact endpoint coverage; added the dedicated mockup ledger. `TODOS.txt` and `PROGRESS.txt` remain untouched.
- Unperformed gates: Native builds, HMR/fixed-port launches, plugin builds/installs, pluginval, Ableton, listening/host acceptance, physical-device, Sites, release, merge, push, deployment, and publication remain unperformed by authorization.

## Responsive workspace audit: proportional contraction and stacking

- Status: Complete (proposal only; no product, CSS, test, or generated-file changes)
- Task/agent: `/root/seqfx_mockup_layout`, reporting to coordinator `/root`
- Branch/worktree: `codex/seqfx-mockup-compact-layout` at `/Users/winterfell/.codex/worktrees/seqfx-mockup-compact-layout/cosimo-synth`
- Audit start tip: `566025150fd50cfed6bf75eeab63fc5a1e505108`; original branch base: `6064eba67120673a748602d706c46b852c52af69`
- Authorization: Audit and propose only how the sequencer and effect-editor columns should contract to content-specific usable minima, then stack with the sequencer above the editor.
- Explicit non-scope: Implementation; product/CSS/test/generated changes; effect/state/DSP/automation changes; `TODOS.txt` or `PROGRESS.txt`; broad/native builds; HMR/fixed ports; installs; pluginval; Ableton/device acceptance; deploy, merge, rebase, or push.

### Measured facts and source ownership

- Production already contains the fixed two-row/six-column effect picker and compact Start/End controls; the removed 32-cell loop ruler is absent. The global controls precede the workspace, so this proposal does not move or redefine them.
- `.seqfx-workspace` currently owns two equal `minmax(0, 1fr)` columns, an 18px gap, and 18px side margins. Both outer columns therefore contract equally; the perceived asymmetry comes from the sequencer reaching its usable content floor much earlier than the editor. At `max-width: 680px`, production hard-switches to one column.
- The sequencer reserves 40px on each side, renders 16 steps per bar row, and uses a 12px hard cell minimum with 3px normal and 9px beat gaps. Its shell owns overflow. Lane labels are 37px wide; block-resize handles remain 24px wide and at least 24px high.
- The editor has 14px internal padding. Its picker is fixed at six equal columns with five 5px gaps and 36px-high buttons. Tabs, factory preset/help, Mix, graphs, segmented sliders, and Mod controls use fluid tracks; shared container seams already reflow Filter readouts at 420px, Tape Stop controls at 350px, and segmented sliders at 280px. The current Mod row has a source-derived technical minimum of about 302px of content (330px including inspector padding).
- A composed browser probe used the real source harness, the Twelve-effect Tour, selected Stutter content, a Vite-assigned port `0`, and a 900px viewport height. No HMR launcher, fixed port, screenshots, or product files were used. Representative decreasing-width results:

| Plugin width | Current columns | Cell | Picker button | Observation |
| ---: | ---: | ---: | ---: | --- |
| 1120px | 533 / 533px | 24.375px | 80 × 36px | Last measured equal split above the proposed 24px cell floor. |
| 1100px | 523 / 523px | 23.75px | 78.33 × 36px | Sequencer first crosses the practical pointer floor. |
| 1000px | 473 / 473px | 20.625px | 70 × 36px | Editor still has a 445px Stutter graph and 305.8px Mix track; sequencer is already cramped. |
| 900px | 423 / 423px | 17.5px | 61.66 × 36px | All 12 full picker names ellipsize, but no outer overflow occurs. |
| 760px | 353 / 353px | 13.125px | 50 × 36px | A two-step block abbreviation begins clipping. |
| 720px | 333 / 333px | 12px | 46.66 × 36px | Cell grid is at its hard visual minimum. |
| 681px | 313.5 / 313.5px | 12px | 43.41 × 36px | Picker also falls below a 44px pointer-width floor. |
| 680px | stacked, 656px each | 32.0625px | 100.5 × 36px | Abrupt stack restores both panels to comfortable widths. |

- Across the successful samples, the document, inspector, and picker had no horizontal overflow. Compression down to 680px is therefore a usability failure, not a clipping detector failure. Harmless compression includes help-copy wrapping, graph-height clamping, and intentional label abbreviation; failure begins when step/resize targets compete below 24px or picker labels become ambiguous despite technically fitting.

### Provisional recommendation

1. Set the sequencer side-by-side minimum to **528px**. With the existing 80px shell reserve and 63px of rhythmic gaps, this yields `(528 - 80 - 63) / 16 = 24.0625px` cells. Keep 16 steps per row, the 3/9px rhythmic gaps, 40px frame/label reserve, 10px step and lane type, 37px lane labels, and 24px resize targets; do not shrink cells below 24px while side-by-side.
2. Set the effect-editor side-by-side minimum to **480px**. Its content width is then 452px and each fixed-grid button is about `(452 - 25) / 6 = 71.17px` by 36px. Below roughly 520px, render the existing unique short names (`FLT`, `CRSH`, `TAPE`, `STUT`, and peers) as visible picker copy while retaining full names as accessible names; do not rely on ambiguous `Ta…`-style ellipses or hide effects.
3. Use **16px** between columns and retain **18px** side margins. Allocate surplus width proportionally with the equivalent of `minmax(528px, 1.1fr) minmax(480px, 1fr)`. This ratio matches the two minima, lets both columns contract, and gives the denser sequencer a modestly larger share without fixing either panel.
4. Derive the wrap threshold as **1060px**: `18 + 528 + 16 + 480 + 18`. Use the SeqFX host/workspace inline size as the responsive input. Side-by-side is valid at and above 1060px; below 1060px, stack rather than compress either column past its floor.

The rejected 1000px alternative used a 420px editor floor. Although it avoids technical overflow, the measured 423px editor gives only 61.66px picker buttons and ellipsizes all full effect names, making similarly prefixed effects dependent on icons. The rejected equal-column solution would need to wrap near 1110px and wastes 48px on the editor at the threshold. Continuing the current equal split to 680px fails the measured sequencer and picker floors.

### Internal adaptation while shrinking

- Sequencer: let cell and block geometry absorb surplus width down to the 24px floor; preserve the bar count, 16-step row, rhythmic gutters, labels, glyph/waveform content, keyboard focus, drag surface, and resize surface. Keep the existing four-character label for multi-step blocks and one-character treatment for a one-step block rather than reducing type. If a stacked host becomes narrower than 552px overall, keep a 528px sequencer content minimum and let only the grid shell scroll horizontally; do not hide steps or shrink targets further.
- Picker and tabs: keep exactly 2×6, icon size, DOM order, 36px height, native buttons, full accessible names, and at least 44px width. Use unique short visible names at compact editor widths. Keep Effect/Mod tabs at least 34px high with focus rings inside the panel.
- Preset/help and parameter rows: reflow the factory-preset label, full-width select, and help copy vertically when the select would otherwise become cramped; wrap help copy rather than ellipsizing it. Preserve value readouts and units. Segmented/range tracks should retain at least 96px of horizontal manipulation space and the existing 24px input-height floor.
- Graph/editor controls: continue using the existing container-query seams. Keep graph plot areas at least 140px high, reflow Filter readouts rather than overlap them, and collapse Tape Stop cards to one column at their existing content threshold. Labels/chips may reflow but controls and readouts remain present.
- Mod: at narrow stacked content widths, reflow each target into rows (name and 28px toggle; full-width amount track; destination/readouts) before the current approximately 302px row minimum is reached. Do not truncate the destination into a misleading value or hide a target.

### Stacked behavior and restoration

- Preserve DOM order: sequencer first, effect editor second. Both use the full available workspace width and intrinsic height; the sequencer shows both bars and the editor grows to its selected effect rather than forcing equal panel heights.
- The SeqFX root owns the single vertical scroll in stacked mode. Remove panel max-height constraints and nested inspector vertical scrolling. The grid shell may own horizontal scrolling only below its 528px content floor; an exceptionally narrow picker may own its own horizontal scroll to preserve six 44px columns, never the whole page.
- Widening back through 1060px restores the proportional two-column layout without remounting. Pattern/block selection, effect and Mod tab, focusability, Start/End values, parameter values, scrollable content, state, automation, and DSP remain unchanged.

### Observable acceptance criteria

- At **1061px**, panels are side-by-side, both contract, the sequencer is at least 528px, the editor at least 480px, cells are at least 24px, and picker buttons are approximately 71 × 36px or larger.
- At **1060px**, side margins are 18px, the gap is 16px, and the columns resolve to 528px and 480px with no overlap, clipping, or page-level horizontal scroll.
- At **1059px**, the sequencer is above the editor; both fill the workspace, use intrinsic height, and a single root vertical scrollbar exposes all content. No control is hidden to make the stack fit.
- Across a narrow/wide/narrow round trip, all 12 effects remain in 2×6 order with unambiguous visible and full accessible names; keyboard tabbing, Enter/Space activation, slider arrow keys, temporary exact entry, focus rings, pointer gestures, and host gesture boundaries remain intact. Selection, loop range, saved state, automation values, DSP, and transport behavior do not change.

### Confidence, unresolved feel, and handoff

- Confidence is high in current ownership, breakpoint behavior, and measured geometry; medium-high in the 528px sequencer floor; and medium in the 480px editor floor and 1060px wrap because they intentionally include a legibility judgment.
- The unresolved physical-feel question is whether 24px sequence cells and 71 × 36px picker buttons with short names feel comfortable in the actual resizable Ableton WebView. That requires a later human host pass and is not inferred from browser measurements.
- Changed scope: this proposal entry in `SEQFX_MOCKUP_TASKS.md` only. `TODOS.txt`, `PROGRESS.txt`, production source, CSS, tests, and generated output remain untouched.
- Evidence run: read-only source/DOM/CSS inspection and the focused ephemeral composed-browser measurements above. No product test suite was run because no product code changed.
- Generated artifacts: None.
- Final commit: This ledger-only commit; its exact hash is reported to the coordinator because a commit cannot embed its own hash.
- Unperformed gates: implementation, broad/native builds, HMR/fixed-port launches, installs, pluginval, Ableton/physical-feel acceptance, device work, release, merge, rebase, push, deploy, and publication.

## Content-aware responsive workspace

- Status: Complete
- Task/agent: `/root/seqfx_mockup_layout`, reporting to coordinator `/root`
- Branch/worktree: `codex/seqfx-mockup-compact-layout` at `/Users/winterfell/.codex/worktrees/seqfx-mockup-compact-layout/cosimo-synth`
- Start tip: `df569d28871e5de5fe86842a9b82a8fca8053f89`; original branch base and merge-base: `6064eba67120673a748602d706c46b852c52af69`
- Authorization: Implement the approved content-aware responsive workspace in production: make the SeqFX root, sequencer, and inspector own inline-size responsiveness; use `minmax(528px, 1.1fr) minmax(480px, 1fr)` columns with a 16px gap and 18px side margins; remain side-by-side at 1060px and stack sequencer-first below it without remounting; preserve the sequencer's 24px practical content floor with grid-shell-only horizontal scrolling in exceptionally narrow stacks; adapt the fixed 2x6 picker, preset/help, slider/graph seams, and dense Mod rows to their actual inspector width; and give stacked mode intrinsic panel heights with one root vertical scroll owner.
- Required preservation: All 16 steps and rhythmic gutters; labels, glyphs, waveforms, drag/resize and pointer/keyboard surfaces; effect order, full accessible names, fixed 2x6 geometry, help and every Mod control/readout; selection, Effect/Mod tab, focus, loop values, parameters, state, automation, DSP, transport, and widening round-trip behavior.
- Explicit non-scope: Dark theme/colors; visual redesign; a broad responsive framework/design system; JavaScript resize observation/window sizing; transform scaling; global font or hit-target shrinking; hidden controls; effect-specific breakpoint proliferation; DSP, state, schema, migration, effect-order, or global-control changes; backwards compatibility; any other mockup item; generated-bundle rebuilds; broad/native builds; HMR/fixed ports; installs; pluginval; Ableton/device acceptance; Sites, release, merge, rebase, push, deploy, or publication; `TODOS.txt` and `PROGRESS.txt`.
- Intended focused evidence: Extend the existing real composed SeqFX browser seam with one responsive round trip covering 1061/1060/1059 and one genuinely narrow stacked width, proving content-informed contraction, exact stack boundary, short-name and internal reflows, scroll ownership, practical targets, no clipping/overlap, and preserved focus/interaction/state. Run only that seam plus the narrow strict SeqFX TypeScript and directly affected contract checks after source/scoped-diff review.

### Decisions and tradeoffs

1. Keep responsive ownership entirely in CSS at the existing production seams: name the root, sequencer shell, and inspector as inline-size containers; use the root query for the single workspace transition and inspector queries for local content reflow. No component is remounted and no JavaScript observes the window or panel size.
2. Express the sequencer floor twice for its two responsibilities: `24px` is the minimum cell/target size, while `447px` is the default 16-cell track floor after preserving twelve 3px gaps and three 9px beat gaps. The shell's existing 40px side reserves bring the default panel requirement to 527px, fitting the authorized 528px column. When a rate produces more beat gutters, the grid shell may need a small horizontal scroll at the exact column floor; preserving cell and rhythmic-gutter contracts wins over shrinking either.
3. Keep the picker as one ordered set of twelve native buttons with unchanged full `aria-label` values. Each button now carries full and existing unique short visible-name spans; inspector CSS switches copy below 520px and places icon above the short name below 480px while retaining 2x6 geometry and practical targets.
4. Reflow only existing groups: the preset label/select/help becomes vertical below 520px; dense Mod rows use named grid areas below 420px; shared segmented-slider tracks have a 96px minimum and gain a two-line fallback only below 280px; existing graph/editor container seams continue to own their plot and effect-specific geometry.
5. Keep the root as the stacked vertical scroll owner at every width, but side-by-side content remains height-bounded so the root does not acquire extra overflow. Below 1060px the workspace and panels become intrinsic-height, inspector overflow becomes visible, DOM order remains sequencer then inspector, and only the grid shell contains horizontal overflow below its content floor.

### Decision-provenance objection audit

- A media query or JavaScript resize path was rejected because it would respond to the global viewport rather than the actual embedded SeqFX/panel inline size. Named container seams directly encode the product ownership and preserve component identity through resize.
- Hiding effect copy, help, Mod destinations, or targets was rejected. Unique short names, vertical preset flow, multi-line Mod rows, and the existing shared editor reflows preserve all behavior and accessible names.
- Lowering the cell floor or rhythmic gaps was rejected. The narrow shell scroll is localized and observable, while smaller pointer/drag/resize geometry would silently degrade the sequencer's core interaction.
- Confidence is high in the CSS ownership, exact 1060px transition, measured geometry, scroll containment, and resize identity/state preservation. The remaining physical-feel question is whether 24px cells and roughly 71x36px compact picker buttons feel comfortable in the resizable Ableton WebView; that host pass was explicitly not performed.

### Focused evidence

- Pre-edit boundary: exact worktree, branch, clean start tip `df569d28871e5de5fe86842a9b82a8fca8053f89`, origin/master, and merge-base `6064eba67120673a748602d706c46b852c52af69` verified before changes.
- Failing-before evidence: The new composed responsive test failed against untouched production at 1061px because the old equal split gave the sequencer 503.5px instead of the required 528px floor.
- Passing-after evidence: The real composed responsive round trip passed at 1061/1060/1059/420px, including exact 528/480px columns, 18px margins, 16px gap, 24px cells with 3/9px rhythmic gutters, sequencer-first stacking, fixed 2x6 short-name picker, vertical preset/help, 140px graph floor, 96px slider and Mod tracks, root/grid scroll ownership, no inspector/root horizontal clipping, keyboard activation, unchanged element identity/focus, and no resize-driven host events or state writes.
- Directly affected composed contracts passed 3/3: fixed 2x6 picker order/keyboard selection, side-by-side inspector/grid-plate alignment, and responsive Mod panel containment. The rate-driven rhythmic-grid reflow contract passed 1/1. Strict SeqFX TypeScript passed all 19 production modules.
- Source and scoped diff were reviewed before green proof and again after the final test edit. Only this ledger, the production SeqFX view/style owners, and the existing composed browser suite changed; `TODOS.txt` and `PROGRESS.txt` are unchanged. Known failures: None.
- Test setup: an ignored worktree-local `node_modules` symlink reused the primary checkout's existing dependency tree without installation and was removed before commit. Every browser run used a Vite-assigned ephemeral port, not HMR or a fixed port.

### Final handoff

- Final implementation commit: This entry's single source/test/ledger commit; its exact hash is reported to the coordinator because a commit cannot embed its own hash.
- Clean status: Clean after the implementation commit; verified in the coordinator handoff.
- Changed scope: Content-informed workspace columns and exact container-query stack boundary; named root/panel containers; sequencer cell/track floor; compact visible effect-name adaptation; preset, segmented-slider, and Mod-row reflows; stacked scroll ownership; focused composed browser coverage and directly affected responsive assertions. No behavior, state, automation, DSP, transport, loop, effect order, or global-control logic changed.
- Generated artifacts: None. No tracked UI bundle or `patch_gui` output was rebuilt or edited.
- Unperformed gates: Broad suite, native/plugin builds, HMR/fixed-port launch, install, pluginval, Ableton/host physical-feel acceptance, physical device, Sites, release, merge, rebase, push, deploy, and publication.

## Responsive workspace ownership review and narrow-width repair

- Status: Complete
- Task/thread: Visible implementation ownership review in `01a05c67-c2f3-7a63-bf43-5f4fd51f824e`, reporting to coordinator task `01a05c09-ce2d-7120-bc44-cd8102a2f0d7`.
- Branch/worktree: `codex/seqfx-responsive-workspace-review` at `/Users/winterfell/.codex/worktrees/3a82/cosimo-synth`.
- Starting handoff: Exact preliminary branch tip `23d76e3a314ea240acdd1ea435886b3379ee79bc` from `codex/seqfx-mockup-compact-layout`; responsive implementation start `df569d28871e5de5fe86842a9b82a8fca8053f89`; original branch base `6064eba67120673a748602d706c46b852c52af69`.
- Branch ownership decision: The preliminary branch was still checked out in its original worker worktree. This isolated task began detached at its exact handoff commit and created `codex/seqfx-responsive-workspace-review` for repairs rather than moving that other worktree's checked-out branch ref.
- Authorization and non-scope: Independently review the complete responsive source/test/ledger diff, repair evidenced defects only, and preserve the compact Start/End and fixed 2x6 picker behavior. Native/plugin builds, installs, HMR/fixed ports, pluginval, Ableton/device acceptance, broad suites, integration, rebase, merge, push, deploy, publication, `TODOS.txt`, and `PROGRESS.txt` remained outside this task.

### Review findings and repairs

1. The composed 420px sample masked a graph-floor defect. At a 320px host width, the Filter plot measured 121px because CSS reserved 14px above the plot while the shared geometry subtracted 34px. Crusher and Stutter had the same 20px shared-top-padding omission. The CSS owners now reserve the full 34px, and the real Filter, Crusher, and Stutter plot areas each retain at least 140px.
2. At the same 320px width, fixed six-column picker buttons shrank to 38.5x52px. The picker now preserves six 44px columns plus the five existing gutters and owns only the resulting horizontal overflow; its focus-ring breathing room stays inside the inspector, and it does not become a vertical scroll owner.
3. At the exact 1060px side-by-side floor, the inspector's 480px outer width produces a 452px container-query content box. The preliminary `<480px` rule therefore stacked picker icons above labels and raised the buttons to 52px even though the accepted floor geometry is approximately 71x36px. The vertical picker presentation now begins below 420px of inspector content; 1060px keeps horizontal 36px chips, while a 420px stacked host uses the 52px fallback.
4. No further defect survived source tracing and focused reproduction. The workspace still uses CSS container queries only, preserves component identity and focus across resize, keeps the exact 1060px boundary and 528/480px floors, wraps preset/slider/Mod content without hiding controls, and leaves state, automation, DSP, transport, loop, and global-control logic unchanged.

### Decision-provenance objection audit

- The Filter reserve was repaired in `ui/shared/filter-range-editor.css`, its actual owning seam, instead of adding a SeqFX-only override that would leave the shared CSS/geometry invariant contradictory. The existing compact shared Filter browser contract remained green.
- Exceptionally narrow picker width is handled with local horizontal scrolling. Shrinking below 44px, changing the authorized 2x6 arrangement, or hiding copy were rejected because each would violate a preserved interaction or accessibility contract.
- The icon-over-label picker breakpoint is based on inspector content width, so its threshold is 420px rather than the 480px outer panel floor. This preserves the accepted compact 71x36px side-by-side geometry without using JavaScript or a viewport media query.
- The 140px floor was applied to the primary editable Filter, Crusher, and Stutter plot areas. Existing small informational previews and the Tape Stop trajectory overview were not reclassified as manipulation surfaces or enlarged as part of this focused responsive repair.
- Confidence is high in the browser-composed geometry, overflow ownership, keyboard activation, DOM identity, and no-write resize behavior. Physical feel in the actual Ableton WebView remains deliberately unproven.

### Focused evidence

- Before repair, the existing responsive round trip passed 1/1 at its 420px sample. Strengthening that same composed case to 320px failed first with a 121px Filter plot and then, after the graph repair, with 38.5px picker columns. Coordinator review additionally identified the 52px picker height at the exact 1060px floor. These were the three confirmed repair targets.
- Final directly affected composed group passed 5/5: fixed 2x6 picker order/keyboard selection; responsive 1061/1060/1059/420/320px round trip with 36px horizontal picker chips at 1060 and the 52px stacked fallback at 420; rate-driven rhythmic grid geometry; side-by-side inspector/grid alignment; and responsive Mod containment.
- Graph-adjacent behavior passed 4/4: the shared compact Filter chip contract plus SeqFX Crusher parameter writes, Stutter parameter writes, and Stutter live-edit/persistence boundaries.
- Strict SeqFX TypeScript passed all 19 production modules. `git diff --check` passed. The temporary ignored `node_modules` symlink used existing dependencies and was removed before commit.
- Known failures: None in the focused evidence. No broad qualification claim is made.

### Final handoff

- Repair commit: `75e595d8` (`Harden SeqFX narrow responsive layout`).
- Ledger closeout commit: This record's branch-tip commit; its exact hash is reported to the coordinator because a commit cannot embed its own hash.
- Exact changed scope after the preliminary handoff: SeqFX picker overflow/minimum-column and vertical-presentation breakpoint CSS; Filter, Crusher, and Stutter plot-reserve CSS; the existing composed responsive test strengthened at 1060/420/320px; this ledger entry. `TODOS.txt`, `PROGRESS.txt`, DSP/state/automation/runtime code, generated UI bundles, and `patch_gui` are unchanged.
- Generated artifacts: None.
- Clean status: Clean after the ledger-only closeout commit; verified in the coordinator handoff.
- Unperformed gates: Broad suite; native/plugin/release builds; generated-bundle rebuild; HMR/fixed-port launch; install; codesign/notarization; pluginval; Ableton/listening/host physical-feel acceptance; physical device; Sites; release; merge; rebase; push; deploy; publication.

## Approved interface queue — 2026-09-01

- Status: Approved and coordinator-owned. This entry is the durable product authority for the work below; implementation remains isolated from the coordinator thread.
- Coordinator: Task `01a05c09-ce2d-7120-bc44-cd8102a2f0d7`.
- Execution contract: Visible isolated Codex tasks use `gpt-5.6-sol` at `xhigh`, return clean committed handoffs, and do not merge, push master, install, deploy, or publish. The coordinator owns source review, focused qualification, repair requests, rebase, and serialized integration.
- Saved-sound policy: No backward-compatibility or migration work is authorized; the existing greenfield policy remains unchanged.

### Persistent declutter

- Permanently remove the bottom `First pattern?` / `Got it` onboarding banner. Remove its copy, presentation, dismissal state, and any narrowly owned persistence path, with no replacement, first-run variant, empty gap, or persistence write.
- Remove the visible `Chain 1` through `Chain 4` row labels from every sequencer section and reclaim the entire label gutter. Preserve the four-chain data model and order, useful chain-aware accessible names, editing and interaction behavior, DSP, state, and automation.
- Active implementation task: `Remove SeqFX welcome and chain labels`, thread `01a05c76-d755-7a62-8a2d-24b63baa3320`, branch `codex/seqfx-interface-declutter`, worktree `/Users/winterfell/.codex/worktrees/b782/cosimo-synth`, based on reviewed responsive tip `c25fed5a6afb3011a65105a91489fcfd452025d4`.

### Shared sequencer-cell geometry for the effect picker

- Each effect-picker chip must use the sequencer cell's exact visual/CSS system: height, border, radius, background, interaction states, and skeuomorphic shadow.
- Each chip is a true two-cell-wide control with live width `cell + ordinary adjacent-cell gap + cell`. It must follow the resolved sequencer cell size as the plugin resizes, through one shared CSS variable/primitive rather than JavaScript measurement or duplicated formulas/constants.
- Preserve the fixed 2x6 picker, all twelve identities and order, native-button behavior, visible content, and full accessible names.
- Implementation is queued as a separate visible task after the overlapping declutter branch is integrated.

### Effect inspector corrections

- Tape Stop: Start Time and Stop Time must each lay out their label, `Trigger` control, segmented slider, and value without overlap at every supported width.
- Modulation affordances: Vibro Rate and Depth are modulatable and must show the `M` toggle. Audit every parameter across every SeqFX effect against the real modulation metadata; every modulatable parameter must expose the toggle, and non-modulatable parameters must not gain one.
- Presets: Remove the Effect Preset card/container, `EFFECT PRESET` label, explanatory copy, and extra spacing. Keep only the preset dropdown.
- Move the bare preset dropdown into the top effect header on the same row as the current chain/effect/selected-cell summary. It must remain usable and responsive without crowding, clipping, or obscuring that summary.
- These inspector changes may share one implementation task only where source inspection confirms a coherent owner and independently visible acceptance for Tape Stop layout, modulation metadata parity, and preset-header placement. They must not be grouped with the effect-picker cell-geometry task.

### Qualification boundaries

- Use existing composed browser seams and representative responsive widths. Do not create screenshot farms, duplicate suites, tests about tests, or process-only artifacts.
- Automated qualification, native/plugin packaging, pluginval, Ableton host behavior, listening approval, and physical-device acceptance remain separate claims. Expensive native, install, and deployment gates wait until the review-clean UI queue is integrated.

## Persistent interface declutter: onboarding banner and chain-label gutter

- Status: Complete
- Task/thread: Visible implementation task `01a05c76-d755-7a62-8a2d-24b63baa3320`, reporting to coordinator task `01a05c09-ce2d-7120-bc44-cd8102a2f0d7`.
- Branch/worktree: `codex/seqfx-interface-declutter` at `/Users/winterfell/.codex/worktrees/b782/cosimo-synth`.
- Base: Reviewed responsive branch `codex/seqfx-responsive-workspace-review` at exact tip `c25fed5a6afb3011a65105a91489fcfd452025d4`.
- Authorization: Permanently remove the bottom `First pattern?` onboarding banner and its dismissal state/copy/presentation, with no replacement, persistence, first-run variant, or empty gap. Remove the visible `Chain 1` through `Chain 4` row labels from both sequencer bars and reclaim their occupied left gutter so the sequence grid expands into that space.
- Required preservation: Four-chain data model and order; useful chain-aware accessible names on cells, blocks, duration controls, and inspector selection; pointer, keyboard, drag, resize, selection, and block editing behavior; DSP, saved state, automation, global controls, and responsive round-trip behavior.
- Explicit non-scope: Responsive breakpoints; effect-picker geometry or the later shared-cell-geometry task; theme; DSP; saved-sound policy; any other mockup item; generated bundles; broad/native/release builds; HMR/fixed-port launch; install; pluginval; Ableton/device acceptance; rebase, merge, push, deploy, or publish; `TODOS.txt` and `PROGRESS.txt`.

### Decisions

1. Preserve `SEQFX_LANE_NAMES` as domain/accessibility vocabulary while removing only its visible row-label projection. Renaming or deleting the chain identities would weaken cell, block, duration, and inspector announcements without changing the four-chain model Andrew explicitly asked to preserve.
2. Reclaim the label allocation at the existing sequencer-shell layout seam. Retain only the narrower left clearance required for the existing decorative bar frame; that clearance is frame ownership, not an empty label column. Responsive thresholds, rhythmic gutters, cell floors, and frame geometry remain unchanged.
3. Extend the existing composed SeqFX browser suite rather than adding a parallel suite: remove obsolete banner/dismissal and visible-label assertions, then prove absence/no-gap/no-storage behavior plus four ordered interactive lanes with surviving accessible names at representative wide and narrow widths.

### Decision-provenance objection audit

- `SEQFX_LANE_NAMES` remains production vocabulary even though its standalone row-label elements are gone. Deleting or neutralizing those names was rejected because cells, blocks, duration controls, and the inspector still need useful chain-aware announcements; retaining them does not recreate a visible row label.
- The old 40px left reserve served both the 37px label and the decorative frame. The sequence now starts after only 16px of frame clearance, while the right frame reserve remains 40px. Leaving 40px would preserve the empty label gutter; using zero would clip the existing frame. This asymmetric shell padding is the smallest layout change that visibly expands the grid without changing frame geometry, rhythmic gutters, cell floors, or responsive thresholds.
- The first test revision intercepted `Storage.prototype.setItem` and prohibited every write. Coordinator review correctly rejected that as method patching and an overbroad persistence contract. The final test observes only the browser storage namespace for first-use/onboarding/welcome keys before and after representative rerenders, so unrelated legitimate persistence remains allowed.
- The responsive picker renders full and short copy spans simultaneously, so `textContent` is not its stable naming seam. The existing picker assertion now reads each native button's full `aria-label`, matching the preserved accessibility contract instead of responsive presentation internals.
- Confidence is high in composed banner absence, ordinary global-to-workspace spacing, visible label/gutter removal, four-row ordering, accessible names, and pointer/keyboard/resize behavior. Native host appearance and physical feel remain deliberately unproven.

### Focused evidence

- Pre-edit boundary: This worktree began detached and clean at the exact reviewed responsive tip `c25fed5a6afb3011a65105a91489fcfd452025d4`, then created the isolated branch `codex/seqfx-interface-declutter` without moving the predecessor worktree's checked-out branch.
- Failing-before evidence: The three updated composed checks failed against untouched production at the authorized seams: eight `.seqfx-lane-label` elements remained across the two bar sections, one onboarding banner remained, and the narrow sample retained the old 40px left reserve.
- Passing-after evidence: The final directly affected composed group passed 9/9 through the real SeqFX browser harness: 567px shell/gutter behavior; onboarding absence, ordinary 12px global-to-workspace gap, and no onboarding storage key across rerenders; wide four-row order and chain-aware selection/resize; 1061/1060/1059/420/320 responsive round trip; frame clearance; cell/inspector edits; keyboard block creation; bounded duration keyboard access; and duration focus across bar boundaries.
- Source/scoped-diff review: No onboarding copy/state/style or visible lane-label/spacer owner remains in `fx/seqfx/view`; `SEQFX_LANE_NAMES` continues to drive accessible names. `git diff --check` passed. The diff from the base contains only this ledger, `SeqFxPatchView.tsx`, `styles.css`, and the existing composed browser suite. `TODOS.txt` and `PROGRESS.txt` are unchanged.
- Test setup: The focused browser server used an ephemeral loopback port, shared dependencies read-only, and a task-owned writable Vite cache under `/private/tmp`; the server, cache, temporary config, and ignored `node_modules` symlink were all removed before commit.
- Known failure: `./node_modules/.bin/tsc -p fx/seqfx/tsconfig.json` did not pass on this base because its 19-module project follows imports into existing shared owners and reports eight unrelated errors in effect snapshot/preset optionality, a missing `bounce/document.mjs` declaration, rack descriptor optionality, and sound-share stream/blob types. No diagnostic names the changed SeqFX view, and this task did not widen scope to repair those shared modules.

### Final handoff

- Final implementation commit: This entry's single source/test/ledger commit; its exact hash is reported to the coordinator because a commit cannot embed its own hash.
- Clean status: Clean after the implementation commit; verified in the coordinator handoff.
- Exact changed scope: Removed the local first-use state and complete banner JSX/CSS island; removed the step-header spacer and eight visible chain-label elements plus their dead CSS; reduced only the sequencer's left reserve from the combined 40px frame/label gutter to 16px frame clearance; updated existing composed assertions for absence, spacing, storage namespace, gutter geometry, four ordered lane rows, accessible chain identity, and retained interaction. DSP, runtime state, automation, responsive breakpoints, effect-picker geometry, saved-sound policy, generated bundles, and `patch_gui` are unchanged.
- Generated artifacts: None.
- Unperformed gates: Broad suite; native/plugin/release builds; generated-bundle rebuild; HMR/fixed-port launch; install; codesign/notarization; pluginval; Ableton/listening/host visual or physical-feel acceptance; physical device; Sites; release; rebase; merge; push; deploy; publication.

## Element-size standardization audit

- Status: Complete (proposal revised to Andrew's approved product direction; no production source, CSS, generated bundle, test, or snapshot changes)
- Task/thread: SeqFX element-size standardization audit, thread `01a05c67-c5f3-7460-a9f6-1c03d05d0fef`, reporting to coordinator `01a05c09-ce2d-7120-bc44-cd8102a2f0d7`
- Branch/worktree: `codex/seqfx-element-size-audit` at `/Users/winterfell/.codex/worktrees/ca60/cosimo-synth`
- Base: `23d76e3a314ea240acdd1ea435886b3379ee79bc` (`codex/seqfx-mockup-compact-layout` at audit start)
- Product authority: Andrew explicitly superseded the audit's tentative 24/36 recommendation. FX picker chips must literally use the sequencer-cell visual system and live geometry: the same height, border, radius, background, skeuomorphic shadow, and interaction states; each chip is exactly `cell + gap + cell` wide; changing the resolved sequencer-cell size changes the chip geometry. Preserve 2x6 order, effect content/identity, accessibility, and behavior.
- Explicit non-scope: Production implementation; other control redesign or normalization; source/CSS/tests/generated output; `TODOS.txt` or `PROGRESS.txt`; build, install, host acceptance, integration, push, or deployment.

### Measured current-state inventory

These measurements remain evidence of the current branch, not the approved target. The real source harness used the Twelve-effect Tour with Stutter selected plus a Mod-panel pass at 1440px comfortable, the exact 1060px side-by-side floor, and 420px narrow; HMR was disabled and the localhost port was OS-assigned.

| Role | Current CSS/composed size and frequency | Approved or provisional disposition |
| --- | --- | --- |
| Sequencer cells and block lanes | 128 cells and eight lane rows. Cells/row height are 36.5px at 1440, 24.06px at 1060, and 24px at 420; blocks inherit that height. Twelve resize surfaces are 24px wide while their visible grip is a 2px line; block fill is inset 1px inside the full block hit surface. | The resolved cell size and ordinary gap become shared geometry authority for both the sequencer and picker. Multi-cell block width, the 24px cell floor, beat-gap cadence, and resize overlay remain sequencer behavior rather than picker styling. |
| Effect-picker chips, icons, and padding | Twelve chips in 2x6. Current chips are about 101.3x36px at 1440, 71.2x52px at 1060, and 55.2x52px at 420. They currently use a 24px icon, independent 5px gap, 4x6px or 4px padding, 6px radius, border, and picker-specific states; visible and native-button hit boxes coincide. | This independent 36/52px system is superseded. Approved target dimensions derived from the measured cells and ordinary 3px gap are about 76x36.5px at 1440, 51.13x24.06px at 1060, and 51x24px at 420. Chip content may adapt within the box, but the box and states do not diverge from the live cell primitive. |
| Effect tab and Mod toggle | One of each, both 34px high with 6px radius; the Mod badge is a passive 18x18px box. | Measured only. No product decision authorizes folding these into the cell system or changing their height. |
| Primary and secondary actions | Twelve 28px pattern buttons; five 28px On/transport/edit buttons; five 24px loop actions; one 34px full-width Delete action. | Measured only. Their hierarchy remains distinct from the approved cell/picker relationship. |
| Selects and temporary text entry | Four visible selects: Clock/Rate and effect preset are 28px, factory-pattern is 24px. Temporary Start exact entry measured 38x28px. | Preserve current ownership and temporary-entry lifecycle; do not generalize cell geometry to fields or reintroduce persistent numeric rows. |
| Segmented and ordinary sliders | Five visible segmented controls: visual rails/ticks are 18px, transparent range hit boxes are 24px or 28px, global wrappers are 22px, and inspector rows are 36px. The two global ranges and Block Mix range have 24px hit boxes; Block Mix's material row is 36px. | Preserve visual-ink versus hit-target separation. Slider geometry is not part of the approved picker-cell primitive. |
| Preset/help cards and graph floors | Factory-preset card is 61.3px at 1440 and 79.8px after vertical reflow; Stutter help is 41.7px at 1440 and 56.5px at 420. Stutter viewport is 354/280/232px and owns a 140–300px plot clamp plus 54px reserves. | Content-driven exceptions remain component-owned; do not force them onto the cell scale. |
| Tags, badges, header, and material rhythm | Mod badge is 18px, passive `TRIGGER` pill 19.5px, interactive Gate tag 24px, and topbar 41px around 28px pattern controls. Inspector shell uses 14px padding/10px gap/8px radius; repeated inspector rows use 6px radius; cells use 3px. | Only the picker moves to the **cell's** 3px radius/material/state system. The prior suggestion to introduce a general 6px material-radius token is withdrawn. |

### Approved geometry and ownership seam

Replace the prior 24/28/36 size ladder with one local cell primitive and the smallest live geometry contract:

- `--seqfx-cell-min`: the existing 24px practical floor.
- `--seqfx-cell-size`: the resolved live cell edge used by the actual sequencer tracks, not a second guessed or copied constant.
- `--seqfx-cell-gap`: the shared ordinary adjacent-cell gap, currently the existing 3px `--seqfx-normal-gap`; the 9px beat gap remains a sequencing-cadence exception.
- One shared `.seqfx-cell-surface` CSS primitive (name provisional) owns border, radius, background, skeuomorphic shadow, hover, active, selected, and focus presentation for both `.seqfx-cell` and picker buttons.

The future picker grid consumes those owners directly: six columns of `calc(var(--seqfx-cell-size) + var(--seqfx-cell-gap) + var(--seqfx-cell-size))`, with row height `var(--seqfx-cell-size)`. No picker rule may independently set 36px/52px height, 6px radius, border/background/shadow, or parallel interaction-state values. Container queries may adapt the internal icon/name arrangement and full-versus-short visible copy, but cannot change the approved outer geometry or surface. The existing full accessible names, native buttons, effect order, selection, keyboard activation, and 2x6 DOM identity remain intact.

The critical DRY requirement is the **resolved** size. Aliasing both surfaces to a static 24px minimum would still drift whenever wide sequencer cells grow. Future implementation must promote the current emergent grid-track calculation to the common root/primitive owner so the sequencer and picker consume the same `--seqfx-cell-size`; it must not measure one DOM element in JavaScript or maintain duplicate responsive formulas.

### Decision-provenance objection audit

1. Andrew's literal same-system decision is binding and supersedes the audit's earlier density-based preference for distinct 24/36 roles. The measured differences remain useful only to show what implementation must remove.
2. “Use the same constants” is insufficient and rejected: copied 24px/3px declarations would match only at the floor. One resolved geometry owner is required so both surfaces change together across resize.
3. The approved outer geometry does not authorize hiding, reordering, or renaming effects. The existing short-name seam may solve narrow visible copy while full accessible names and effect identity remain stable; exact icon/text packing is left to implementation review.
4. No product decision was made about tabs, Delete, transport, fields, sliders, cards, graphs, tags, or general material tokens. Earlier suggestions to fold 34px controls into 36px and add a 6px material-radius token are withdrawn rather than presented as implied follow-on work.

### Confidence, unresolved implementation questions, and final handoff

- Confidence: High in the approved outcome, current measurements, and required shared ownership; medium-high in the proposed CSS seam names. There is no remaining product uncertainty about cell/chip equality or the two-cell-plus-gap formula.
- Unresolved implementation questions: the exact CSS formula that promotes the first workspace column's resolved track size without duplicate responsive math; alignment of the exact-width 2x6 picker inside surplus inspector width; icon/full-or-short-label packing at the 24px floor; and host physical feel of the resulting 51x24px chip hit box. These are implementation/acceptance questions, not invitations to change the approved relationship.
- Evidence inspected: the supplied reference image; `fx/seqfx/view/styles.css`, `SeqFxPatchView.tsx`, `SeqFxGlobalControls.tsx`, `stutter-envelope-editor.css`, and `ui/shared/editor-tick-slider.css`; composed 1440/1060/420px source-harness states including Effect and Mod. No new browser pass or product test was needed for this documentation-only authority update.
- Changed scope: this revised audit entry in `SEQFX_MOCKUP_TASKS.md` only. `TODOS.txt`, `PROGRESS.txt`, production source/CSS, tests, snapshots, and generated output remain untouched.
- Generated artifacts: None.
- Final commit: This ledger-only revision commit; its exact hash is reported to the coordinator because a commit cannot embed its own hash.
- Unperformed gates: implementation, product tests/broad suite, screenshots, native/plugin builds, HMR/fixed-port launch, installs, pluginval, Ableton/host physical-feel or listening acceptance, device work, release, merge, rebase, push, deploy, and publication.

## Reusable three-size plugin visual review capture

- Status: Approved and queued as an independent tooling task.
- Coordinator: Task `01a05c09-ce2d-7120-bc44-cd8102a2f0d7`; implementation must use a visible isolated Codex task with `gpt-5.6-sol` at `xhigh` and return a clean committed handoff.
- Authorization: Add one short, low-ceremony command/script that takes a plugin target parameter. A single invocation must use the repository's existing plugin registry/build and representative production browser-view seams to build the current target UI, open it, and capture exactly three deterministic PNGs: wide, medium, and narrow.
- Reuse contract: It must work for SeqFX immediately and for other registered repository plugins without editing the script or hard-coding SeqFX. Provide sensible default viewport dimensions, stable filenames/output location, and a concise optional output-directory override.
- Runtime contract: Reject an unknown plugin and report build/launch/capture failures clearly. Own and clean up every temporary server or process the command starts, including failure paths.
- Inspection output: Print the exact three PNG paths. Add one contact sheet or tiny HTML index only if it is essentially free and does not expand the workflow materially; the three screenshots remain the required artifact.
- Explicit non-scope: New framework, daemon, screenshot farm, duplicate build system, DAW automation, native-host dependency, plugin installation, Ableton, deployment, publication, release, or changes to product behavior.
- Focused proof: One narrow test must cover target selection plus the three named dimensions and output files through the real script seam. Avoid broad suites and tests about tests.
- Integration: After source-first review, repair, clean rebase, and focused qualification, the coordinator may merge and push this tooling to master under Andrew's standing authorization, then run it for SeqFX and report the pushed commit and three PNG paths.
