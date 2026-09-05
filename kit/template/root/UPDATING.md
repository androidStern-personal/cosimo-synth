# Updates and recovery

Open your existing project in your coding agent and ask:

> Update my Builder Kit using the kit-update skill. Preserve my plugin changes. Show me what changes, make a recovery checkpoint, and stop before installing if any check fails. Do not commit, stash, or discard my uncommitted work.

The agent reads the configured delivery feed; you do not need another install
command. Repeating the original installer resumes setup at its original release
and does not update a customized project. Keep your private delivery command
and access address out of messages, screenshots, and source changes.

An update starts from a clean branch. If you have unsaved changes, decide what
to keep and commit those changes yourself, or ask your agent to help you review
them. The update must wait for that decision. Upstream kit files and your edits
can both change; an update is not guaranteed to merge automatically.

Your agent fetches release tags, names a checkpoint branch, and merges the
selected kit release. If a conflict would lose one of your edits, it explains
the alternatives before changing that file. It then checks the environment,
tests, and builds. Installation happens only after those checks pass.

## If an update fails

> Recover the working version from the update checkpoint. Preserve the failed update and all my edits so we can inspect them. Tell me which version is installed before replacing anything.

For an unresolved merge started from a clean tree, the agent can use
`git merge --abort` after confirming you have made no further edits during
the merge. If you have, preserve those edits before deciding how to recover.

After a completed merge that fails checks, keep its branch intact and open a
separate recovery worktree from the named checkpoint. Do not reset the branch,
delete changes, or install the failed build. Run setup and verification in the
recovery folder before deciding to install its version. The installed plugin
is unaffected by a failed fetch, merge, test, or build.

Keep the checkpoint until you have tried the updated plugin and reopened a
saved DAW project successfully. Customized plugin repair and merge decisions
remain yours; upstream releases do not include bespoke development support.
