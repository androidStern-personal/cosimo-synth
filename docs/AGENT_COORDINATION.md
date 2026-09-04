# Delegated task and integration workflow

Read this only for delegated implementation, source review, or integration. It is a coordination contract, not a replacement for the task's product specification.

## Ownership and preflight

- Use the worktree, branch, scope, coordinator, and authority recorded for the active task. A task-specific model choice does not become repository policy.
- Inspect `pwd`, branch, `git status`, and required file access before editing. Preserve existing changes and shared history; never copy the primary checkout's dirty tracker into a commit.
- The coordinator owns rebases, the moving integration base, final review, merges to `master`, pushes, deployments, and completion updates unless it explicitly delegates one of them.
- The linked `TODOS.txt` is live shared state. Its symlink/skip-worktree setup avoids stale branch copies but does not provide locking; serialize edits and never stage the link or its target accidentally. `PROGRESS.txt` is curated continuity, not a turn log.

## Review and qualification order

1. Review source and the scoped diff before broad suites or expensive native work.
2. Return a concrete repair to the owning task when review finds a problem. Repeat source review and the focused check that covers the repair.
3. Run the complete relevant suite or native gate against the reviewed, rebased candidate immediately before integration. A repaired or changed candidate invalidates stale evidence.
4. Keep automated source/runtime qualification separate from installed-host, listening, visual, and physical-device acceptance. Record every unperformed gate plainly.

Independent source work may run in parallel. Serialize mutations to `master`, shared trackers, fixed ports, generated output shared across worktrees, native build directories, installed plug-ins, DAW sessions, and physical devices. No repository lease mechanism currently makes those mutations safe automatically.

## Worker handoff

A completed worker handoff names the task and coordinator, branch and worktree, base and final commit, clean/dirty state, exact changed scope, focused commands and results, known failures, generated artifacts, and unperformed host/device acceptance. It also surfaces material choices through the `decision-provenance` skill: the chosen behavior, credible alternative, decisive evidence or tradeoff, and remaining uncertainty.

Call a branch ready only when its scoped work is committed and its worktree is clean. The coordinator independently reviews the final diff, decisions, scope, and evidence against the current integration base. It rebases and integrates one branch at a time, then records the merge result and tells the owning task.

## Provenance and unresolved limits

The isolation, coordinator, review order, shared-resource, and handoff rules entered the repository in `7611d96f`; the objection audit entered in `b4a76da7`. `86aacc4d` later added the live-tracker linker. That linker is partial enforcement: it protects against stale branch copies but cannot lock concurrent writes, authorize master operations, or prove review quality. Those gaps remain workflow constraints; this guidance cleanup does not create an orchestration platform or shared-resource lease system.
