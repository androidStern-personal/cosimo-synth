#!/bin/sh

set -eu

fail()
{
    echo "Cosimo task-tracker setup failed: $*" >&2
    exit 1
}

source_tree=${1:-${CODEX_SOURCE_TREE_PATH:-}}
task_worktree=${2:-${CODEX_WORKTREE_PATH:-}}

[ -n "$source_tree" ] || fail "CODEX_SOURCE_TREE_PATH is not set"
[ -n "$task_worktree" ] || fail "CODEX_WORKTREE_PATH is not set"
[ -d "$source_tree" ] || fail "source checkout does not exist: $source_tree"
[ -d "$task_worktree" ] || fail "task worktree does not exist: $task_worktree"

source_tree=$(cd "$source_tree" && pwd -P)
task_worktree=$(cd "$task_worktree" && pwd -P)

[ "$source_tree" != "$task_worktree" ] || exit 0

source_root=$(git -C "$source_tree" rev-parse --show-toplevel 2>/dev/null) \
    || fail "source checkout is not a Git worktree: $source_tree"
task_root=$(git -C "$task_worktree" rev-parse --show-toplevel 2>/dev/null) \
    || fail "task checkout is not a Git worktree: $task_worktree"

[ "$source_root" = "$source_tree" ] || fail "source path is not the repository root: $source_tree"
[ "$task_root" = "$task_worktree" ] || fail "task path is not the repository root: $task_worktree"

source_common=$(git -C "$source_tree" rev-parse --path-format=absolute --git-common-dir)
task_common=$(git -C "$task_worktree" rev-parse --path-format=absolute --git-common-dir)
[ "$source_common" = "$task_common" ] \
    || fail "source and task paths are not worktrees of the same repository"

source_branch=$(git -C "$source_tree" symbolic-ref --quiet --short HEAD 2>/dev/null || true)
[ "$source_branch" = "master" ] \
    || fail "the source checkout must be on master; found '${source_branch:-detached HEAD}'"

source_todos="$source_tree/TODOS.txt"
worktree_todos="$task_worktree/TODOS.txt"

[ -f "$source_todos" ] && [ ! -L "$source_todos" ] \
    || fail "master's TODOS.txt must be a regular file: $source_todos"
git -C "$task_worktree" ls-files --error-unmatch -- TODOS.txt >/dev/null 2>&1 \
    || fail "TODOS.txt is not tracked in the task worktree"

if [ -n "$(git -C "$task_worktree" ls-files -u -- TODOS.txt)" ]; then
    fail "TODOS.txt has an unresolved merge conflict in $task_worktree"
fi

git -C "$task_worktree" diff --quiet -- TODOS.txt \
    || fail "TODOS.txt has uncommitted changes in $task_worktree"
git -C "$task_worktree" diff --cached --quiet -- TODOS.txt \
    || fail "TODOS.txt has staged changes in $task_worktree"

if [ -L "$worktree_todos" ]; then
    [ "$(readlink "$worktree_todos")" = "$source_todos" ] \
        || fail "TODOS.txt already links somewhere else in $task_worktree"
    git -C "$task_worktree" update-index --skip-worktree -- TODOS.txt
    exit 0
fi

[ -f "$worktree_todos" ] \
    || fail "TODOS.txt is missing or is not a regular file in $task_worktree"

backup="$task_worktree/.TODOS.txt.codex-setup-backup.$$"
mv "$worktree_todos" "$backup"

if ln -s "$source_todos" "$worktree_todos" \
    && git -C "$task_worktree" update-index --skip-worktree -- TODOS.txt; then
    rm "$backup"
else
    rm -f "$worktree_todos"
    mv "$backup" "$worktree_todos"
    git -C "$task_worktree" update-index --no-skip-worktree -- TODOS.txt 2>/dev/null || true
    fail "could not install the shared TODOS.txt link in $task_worktree"
fi
