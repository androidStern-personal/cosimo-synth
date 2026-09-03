---
name: kit-update
description: Use when a Builder Kit customer repo should take a newer kit release — "update the kit", "is there a new kit version", "merge the latest kit tag", or when kit:doctor reports the kit is behind the feed. Drives the whole update: checkpoint, fetch the feed's kit.git, inspect local changes, git merge the release tag, resolve mechanical conflicts, verify with kit:doctor / npm test / fx:build, and production-build + install only when everything is green. Not for creating or editing plugins (use $cosimo-make-plugin) and not for cutting kit releases.
---

# Kit Update

## Core Rules

- Updates arrive as a `git merge` of a kit release tag. Never rebase, amend,
  reset, `--force`, or otherwise rewrite history; never stash.
- `kit/` and the root files the kit ships are the kit's. `fx/<plugin>/` and
  `tests/test_<plugin>_*.mjs` are the customer's. Kit commits never touch
  customer plugins, so most updates merge clean.
- Install nothing unless every verification step passes.
- Ask the user only when a conflict is genuinely mixed. Everything else is
  mechanical: do it and report it.

## 1. Establish A Safe Starting Point

1. `git status --porcelain` and `git branch --show-current`. Refuse to start
   from a detached HEAD or with `.git/MERGE_HEAD` / `.git/REBASE_HEAD` present —
   tell the user to finish or abandon that operation first.
2. If the tree is dirty, stop. Do not stage, stash, or commit it on the user's
   behalf. Ask them to commit or remove the changes, then rerun the update.
3. From a clean tree, create `git branch update-checkpoint-<YYYY-MM-DD>` at HEAD (suffix `-<HHMM>` if the
   name exists). This is the return point; name it in the final report.

## 2. Fetch The Feed

1. Run `node kit/scripts/fetch_kit_releases.mjs`. It reads `kit/feed.json`
   internally, passes the capability-bearing URL to git through a temporary
   config environment, and fetches only release tags into
   `refs/kit/releases/v*`. It neither creates a remote nor writes the URL to
   repository config or argv. Empty feed or a failed fetch is terminal: do
   not guess or print a replacement URL.
2. The command prints the available release tag names. Product tags in
   `refs/tags/v*` are independent and must never be treated as kit releases.

## 3. Inspect Local State

1. Last kit release already merged:
   `git for-each-ref --merged HEAD --sort=-version:refname --format='%(refname:strip=3)' refs/kit/releases | head -1`. If none,
   the repo has no kit lineage (a merge would have no common ancestor) — stop
   and ask the user how the repo was created.
2. Target tag: the newest listed unless the user named one. If the last tag is
   the target, report "already up to date" and stop.
3. Convert both names to their full refs (`refs/kit/releases/<tag>`). What the
   update brings: `git log --oneline <last-ref>..<target-ref>` and
   `git diff --stat <last-ref> <target-ref>`.
4. What the customer changed since the last tag, so it is carried forward
   knowingly: `git diff --stat <last-ref> HEAD`. Note every kit-owned path in that
   list (anything under `kit/`, `.agents/skills/`, `cmajor/`, `ui/`, or root
   `package.json`, `tsconfig.json`, `.gitignore`, `AGENTS.md`, `LICENSE`,
   `THIRD_PARTY_NOTICES.md`) — those are the only places a conflict can occur.
5. Summarize both lists to the user in a few lines before merging.

## 4. Merge

```bash
git merge --no-ff -m "Update Builder Kit to <target>" refs/kit/releases/<target>
```

If it completes, go to step 6. If it stops on conflicts, list them with
`git diff --name-only --diff-filter=U` and resolve each per step 5, then
`git commit --no-edit`.

## 5. Resolve Conflicts

Classify each conflicting path, then act. `ORIG_HEAD` is the pre-merge
customer HEAD; `<last>` is the last merged kit tag.

- **Customer never touched it** (`git diff --quiet <last> ORIG_HEAD -- <path>`
  exits 0): take the kit side. `git checkout --theirs -- <path>` (or `git rm`
  if the kit deleted it), then `git add <path>`.
- **Kit-owned** (`kit/**`, `.agents/skills/**`, `cmajor/**`, `ui/**`, root
  `tsconfig.json`, `.gitignore`, `LICENSE`, `THIRD_PARTY_NOTICES.md`): take the
  kit side as above, and tell the user which local edit to a kit file was
  dropped (`git diff <last> ORIG_HEAD -- <path>` shows it). Local kit edits
  belong in a plugin subclass, not in `kit/`.
- **Customer plugin** (`fx/<plugin>/**`, `tests/test_<plugin>_*.mjs`,
  including `fx/enhancer_lite/` once the customer has edited it): take the
  customer side. `git checkout --ours -- <path>` then `git add <path>`. Then
  read the kit-side diff for that path and tell the user what the kit changed
  there, so they can adopt it by hand if they want it.
- **Mixed** (root `package.json` or `AGENTS.md` with both sides changing the
  same hunk; a rename/delete conflict; a customer plugin that stops compiling
  because the kit renamed an API): stop. Show the user a plain-English summary
  per file — what the kit changed, what they changed, why the two collide —
  and the two concrete options. Apply what they choose; do not guess.

Never leave conflict markers behind: `git grep -n '^<<<<<<< ' -- .` must be
empty before committing.

## 6. Verify

Run in order; stop at the first failure.

1. If the merge changed `package.json`, run `npm install`.
2. `npm run kit:doctor`. If it reports a toolchain mismatch (new pinned `cmaj`
   or `CmajPlugin.vst3` in `kit/toolchain.json`), run `npm run kit:setup` and
   rerun the doctor.
3. `npm test`.
4. `node kit/fx/build-effect.mjs --targets` to list plugin aliases, then
   `npm run fx:build -- <alias>` for each.
5. Only when 1–4 are green: `npm run fx:prod:build -- <alias>` then
   `npm run fx:prod:install -- <alias>` for each plugin the user ships.

On a failure caused by the update (a plugin using a kit API the release
changed), fix the plugin with the user's agreement and rerun from step 3. On
anything else, do not install; report the failure and the checkpoint ref.
Leave the merge commit in place — the user decides whether to keep it or
return to `update-checkpoint-<date>`.

## 7. Report

State: last tag → target tag, the checkpoint ref, conflicts and how each was
resolved (including any dropped local kit edits and any kit changes to
customer files the user may want to adopt), each verification step's result,
and what was installed. Suggest deleting the checkpoint branch once the user
is happy with the update.
