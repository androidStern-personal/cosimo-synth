# One CPM Dependency System for Cmajor, CHOC, and JUCE

Status: **approved implementation specification**

Date: 2026-08-28

Decision owner: Andrew Stern

Implementation coordinator: Codex thread `01a04461-bd5b-71d0-8c75-a3c5287216be`

This specification covers dependency source, versioning, retrieval, caching, and verification. It does not redesign the products, the Cmajor CLI, or the customer delivery system.

## Summary

Replace the repository's custom dependency cloning and patching with one CPM-based system.

Every supported build must receive the same patched Cmajor source, the same patched CHOC source, and the same JUCE source from that system. Patches are permanent commits in private GitHub repositories. Builds never manufacture, replace, or edit dependency source after download.

The completed change is deliberately simple from a caller's point of view:

```txt
build entrypoint
  -> one dependency resolver
  -> CPM shared source cache
  -> exact private Cmajor commit
       -> exact private CHOC commit
  -> exact JUCE commit
  -> existing build
```

## Current state

The current dependency provider is `scripts/ensure_cmajor_runtime.py`. It:

- clones official Cmajor commit `172db53232337154d5a1c0f9a448318129dfacd9`;
- replaces Cmajor's CHOC checkout with `androidStern/choc@e50b21a272a1729bc1dd1fd368c112095cb18d5a`;
- edits both dependency trees after checkout to apply the Cosimo fixes;
- writes into a repository-relative `build/deps` directory;
- uses a fixed temporary destination without a shared-cache concurrency contract.

JUCE is separately cloned by several build scripts from its moving default branch. The current machine cache happens to contain JUCE 8.0.12 at `501c07674e1ad693085a7e7c398f205c2677f5da`, but the repository does not currently make that commit authoritative.

This creates multiple download paths, post-download mutation, worktree setup requirements, moving versions, and competing cache behavior.

## Locked outcome

### Canonical repositories

The implementation creates and uses these repositories:

- `androidStern-personal/cmajor` — **private**; full upstream Cmajor ancestry plus every required Cosimo Cmajor fix as ordinary commits.
- `androidStern-personal/choc` — **private**; full upstream/Andrew CHOC ancestry plus every required Cosimo CHOC fix as ordinary commits.
- `juce-framework/JUCE` — official upstream source, locked to one full commit because Cosimo currently carries no JUCE source patch.

The existing `androidStern/choc` repository is public. It may be used as historical ancestry while constructing the new private repository, but the task must not push any new patch work to it or use it as a production dependency source. Do not delete or change the public repository as part of this task.

Do not use GitHub's public-fork flow if it prevents private visibility. Create normal private repositories and preserve the upstream commit history and license files.

### Initial upstream pins

- Cmajor upstream base: `172db53232337154d5a1c0f9a448318129dfacd9` (`1.0.3066`).
- CHOC existing Andrew base: `e50b21a272a1729bc1dd1fd368c112095cb18d5a`.
- JUCE: `501c07674e1ad693085a7e7c398f205c2677f5da` (the currently observed JUCE 8.0.12 checkout).
- CPM: vendor and identify one exact CPM release/commit; no moving download of CPM itself.

The final Cmajor and CHOC pins will be the new private commits containing the complete current patch set. Record their full hashes in the single dependency lock file.

### Required patch inventory

The private repositories must contain every behavior currently installed by `scripts/ensure_cmajor_runtime.py`, including:

#### CHOC repository

- the host-keyboard relay and user-file bridge already present in the existing Andrew fork;
- QuickJS pending-job draining;
- timer `clearTimeout` support.

#### Cmajor repository

- re-entrant patch-worker queue handling;
- safe early worker detachment/lifetime handling;
- non-fatal patch-worker error handling;
- stored-state string content comparison;
- the QuickJS resource bridge;
- external-function provider support;
- split JUCE main-input and sidechain bus handling.

Before deleting the old provisioner, compare its complete patch call graph and working-tree diff against the private fork commits. A marker list alone is not sufficient evidence that the code was preserved.

### One version authority

Add one lock file, recommended as `cmake/dependencies.lock.cmake`. It alone names:

- the private Cmajor repository and full commit;
- the private CHOC repository and full commit;
- the official JUCE repository and full commit;
- the vendored CPM version/commit and integrity value.

No shell, JavaScript, Python, CMake, documentation, environment fallback, or package script may independently choose another dependency URL, branch, tag, commit, or local checkout.

The private Cmajor repository must already point its `include/choc` submodule at the private CHOC repository and exact locked commit. CPM performs the recursive checkout. No later command may replace the URL, change the commit, copy another CHOC tree over it, or create a symlink in its place.

## Non-negotiable invariants

The implementation is unacceptable if any of these are false:

1. Every supported build uses the same patched Cmajor and CHOC commits.
2. Every supported build obtains Cmajor, CHOC, and JUCE through the one CPM resolver.
3. Dependency source is never edited after CPM retrieves it.
4. There is no `git apply`, patch script, text replacement, source-copy overlay, submodule replacement, or symlink workaround applied to retrieved dependency source.
5. There is no alternate public Cmajor/CHOC source, moving branch/tag, local-path fallback, PATH-derived source, or repository-relative backup checkout.
6. Full commit hashes, not `main`, `master`, `latest`, or a moving tag, determine every dependency version.
7. The normal build requires no setup command, dependency symlink, manual submodule command, or worktree-specific clone.
8. All worktrees share only the CPM source cache. Each worktree keeps separate build output.
9. Retrieved source is treated as read-only. A dirty, incomplete, corrupt, or wrong-commit cache is rejected and narrowly repaired rather than used.
10. Private Git credentials never appear in repository files, command arguments recorded by the project, dependency URLs, logs, errors, generated manifests, or cache metadata.
11. Failure to access a private repository or exact commit stops the build. It never falls back to public upstream, a different local checkout, or an older cache.
12. Each retained Cmajor/CHOC bug fix has behavior evidence that would fail if the fix disappeared during a future upstream update.
13. The old provider and every independent dependency download path are removed, not retained as a backup.

## Explicit non-goals

- Do not decide how the `cmaj` executable is downloaded, built, cached, or distributed. Existing CLI use remains outside this task.
- Do not create the customer Builder Kit repository or customer source-delivery feed.
- Do not change Enhancer Lite, T26, T28, T61, T62, product DSP, plugin state, UI, automation, presets, signing, notarization, installation, or deployment.
- Do not upgrade Cmajor, CHOC, JUCE, or CPM merely because a newer version exists.
- Do not contact Cmajor, JUCE, or another vendor.
- Do not merge or push `master`.
- Do not make either patched dependency repository public.

## Alternatives rejected

### Continue patching official checkouts

Rejected because it preserves the current multiple-step source manufacturing process, makes cache contents mutable, and requires Cosimo-specific patch logic in every fresh environment.

### Use CPM for JUCE only

Rejected because it leaves the larger Cmajor/CHOC provisioner and its manual patching untouched.

### Keep a second fallback downloader

Rejected because a fallback becomes a second source of truth and allows builds to succeed with different code.

### Vendor dependency source into Cosimo

Rejected because it duplicates repository ownership and turns Cosimo into another maintained copy of Cmajor, CHOC, or JUCE.

### Work around CPM problems with copying or symlinking

Rejected. If CPM cannot produce the required exact checkout cleanly, stop and report the blocker instead of adding another path.

## Proposed interface

The exact implementation may follow the repository's existing JavaScript/CMake conventions, but it must expose one resolver interface. The intended contract is:

```ts
type FullGitCommit = string;
type AbsolutePath = string;

type LockedDependency = {
  readonly name: "cmajor" | "choc" | "juce";
  readonly repository: string;
  readonly commit: FullGitCommit;
};

type ResolvedDependencies = {
  readonly cmajorSource: AbsolutePath;
  readonly chocSource: AbsolutePath;
  readonly juceSource: AbsolutePath;
  readonly evidence: {
    readonly cmajorCommit: FullGitCommit;
    readonly chocCommit: FullGitCommit;
    readonly juceCommit: FullGitCommit;
    readonly cacheRoot: AbsolutePath;
  };
};

type DependencyResolutionFailure =
  | { readonly tag: "LockInvalid"; readonly dependency: string }
  | { readonly tag: "PrivateRepositoryUnavailable"; readonly dependency: string }
  | { readonly tag: "CommitUnavailable"; readonly dependency: string }
  | { readonly tag: "CacheIncomplete"; readonly dependency: string }
  | { readonly tag: "CacheDirty"; readonly dependency: string }
  | { readonly tag: "CommitMismatch"; readonly dependency: string }
  | { readonly tag: "SubmoduleMismatch"; readonly dependency: "choc" }
  | { readonly tag: "ConcurrentResolutionFailed"; readonly dependency: string }
  | { readonly tag: "OfflineCacheMiss"; readonly dependency: string };

resolveBuildDependencies(options?: {
  readonly cacheRoot?: AbsolutePath; // tests and CI only; never changes URLs or commits
}): Promise<Result<ResolvedDependencies, DependencyResolutionFailure>>;
```

The supported local path chooses a deterministic user-level cache automatically. A test/CI cache-root option is allowed because it changes only storage location, not dependency identity. Repository URLs and commits are never overridable.

All failures must identify the dependency and safe operation without including credentials or raw Git output that may contain authenticated URLs.

## Required flow

### Current flow to delete

```txt
build script
  -> environment/local-path fallback
  -> Python Cmajor clone
  -> recursive submodules
  -> replace CHOC
  -> edit Cmajor and CHOC source in place
  -> separate moving JUCE clone
  -> build
```

### New flow

```txt
build script
  -> resolveBuildDependencies()
  -> configure the one CPM dependency project
  -> CPM source-cache lock
  -> retrieve exact private Cmajor commit and recursive private CHOC commit
  -> retrieve exact JUCE commit
  -> verify repository URL, HEAD, clean tree, required files, and CHOC submodule commit
  -> return the three resolved absolute paths plus commit evidence
  -> existing build
```

### Warm-cache and concurrent flow

```txt
worktree A build output ----\
                              -> one locked CPM source cache -> exact read-only sources
worktree B build output ----/
```

No worktree shares generated projects, CMake build directories, plugin artifacts, fixed output files, or installed plugins as part of this migration.

### Failure flow

```txt
missing credentials / missing commit / wrong submodule
  -> typed failure
  -> concise safe diagnostic
  -> non-zero exit
  -> no fallback

dirty / incomplete / corrupt exact cache entry
  -> refuse to build from it
  -> remove only the verified dependency cache entry when safe
  -> retry the same locked source once
  -> return a typed failure if the exact source still cannot be restored
```

## Files and call sites

### Add

- one vendored, pinned CPM bootstrap file;
- `cmake/dependencies.lock.cmake` as the sole dependency identity authority;
- one dependency resolver project/module;
- caller-facing resolver tests;
- private-fork behavior tests or retained reproducible probes for every bug fix.

### Replace or update

Migrate every active reference found through repository search, including:

- `fx/prod-effect.mjs`;
- `scripts/build_desktop_native.sh`;
- `scripts/build_cmajplugin_vst3.sh`;
- `scripts/generate_ios_auv3_xcode_project.sh`;
- `ios_auv3/CMakeLists.txt`;
- `web/build.mjs`;
- `ui/vite.shared.mjs`;
- external-codegen scripts and CMake projects;
- native/QuickJS test launchers;
- browser, desktop, iOS, spectral, and patch-layout tests that currently invoke or assume the old provider;
- package commands and documentation that describe `build/deps`, `CMAJOR_SOURCE_PATH`, manual symlinks, independent JUCE clones, or the Python provisioner.

Audit historical tools such as `tools/enhancer_wrapper_prototype/run.py`. They may remain separate product experiments, but no checked-in active or runnable path may continue independently cloning a dependency. Migrate the retrieval path, retire the tool, or return it as an explicit blocker; do not silently exempt it.

### Delete

- `scripts/ensure_cmajor_runtime.py` after its entire patch set is committed and proven in the private repositories;
- `tests/test_ensure_cmajor_runtime.py` after its behavior responsibilities move to fork/resolver tests;
- every direct Cmajor/CHOC/JUCE clone path, post-download dependency patch, source-path fallback, and manual worktree dependency instruction made obsolete by the resolver.

## Vertical implementation and test sequence

Work in red-green-refactor slices through the resolver's public behavior:

1. **Lock parsing:** a malformed, moving, or incomplete dependency declaration fails before network or filesystem changes; then implement the smallest strict lock reader.
2. **Private fork creation:** convert one CHOC fix into a committed private-repository change with its behavior test; repeat fix-by-fix, then do the same for Cmajor. Verify repository visibility before every first push and after completion.
3. **Cold resolution:** an empty isolated cache retrieves all three exact commits through CPM and reports their paths/hashes; then implement the minimum resolver path.
4. **Integrity:** dirty, wrong-commit, wrong-submodule, and incomplete cache cases fail rather than build; then add narrow safe repair.
5. **Warm/offline resolution:** after one successful resolution, disable network and resolve successfully from cache.
6. **Concurrency:** start two independent worktree/build-directory resolutions against one empty shared cache and prove both return the same clean commits without corruption.
7. **First real build caller:** migrate one representative existing build entrypoint and prove its dependency evidence and focused build behavior are unchanged.
8. **Caller-by-caller migration:** move each remaining active build/test entrypoint through the same resolver, one behavior test and implementation slice at a time.
9. **Removal:** make a repository-wide negative test fail while any forbidden clone, provisioner, patch, fallback, or manual worktree path remains; remove each remaining path until it passes.
10. **Broad qualification:** after source review is clean, run the relevant existing Cmajor, CHOC bridge, plugin generation, desktop, web, iOS, and effect build tests once. Serialize native builds and shared fixed-output operations.

Do not write a horizontal pile of tests before implementation. Each test must fail for the missing behavior and then pass through the real resolver or build entrypoint.

## Acceptance proof

The task is complete only when all of the following evidence exists:

1. Both new dependency repositories exist under `androidStern-personal`, report `PRIVATE`, contain the complete committed fixes, preserve license/upstream history, and have no uncommitted source mutation.
2. One lock file contains full final Cmajor, CHOC, and JUCE commits and the pinned CPM identity.
3. A clean worktree with an empty isolated cache retrieves each dependency exactly once through CPM and builds a representative supported target.
4. A second clean worktree resolves and builds from the shared warm cache without another dependency clone.
5. Two clean worktrees can resolve concurrently against one initially empty shared cache and receive identical clean source commits.
6. A warm-cache resolution succeeds with the network unavailable.
7. Wrong, dirty, incomplete, interrupted, and corrupt cache cases are detected; narrowly repairing them never accepts another URL or commit.
8. Missing private-repository access fails clearly and never falls back.
9. The complete current Cmajor/CHOC bug-fix behavior suite passes against the final private fork commits.
10. Every supported build/test entrypoint reports the same Cmajor, CHOC, and JUCE commits.
11. Repository search finds no active direct clone of Cmajor, CHOC, or JUCE; no old provisioner; no source patching after checkout; no `CMAJOR_SOURCE_PATH` or equivalent source override; no `build/deps` worktree requirement; and no alternate dependency URL or version authority.
12. The Cosimo implementation branch is committed and clean. Its handoff lists the new private repository URLs and commits, final branch/worktree/commit, exact changed files, tests run, known failures, and any supported build path not exercised.

## Stop conditions

Stop and return a concrete blocker instead of adding a workaround if:

- private repositories cannot be created or verified as private;
- the current patched trees cannot be reconstructed exactly as reviewable commits;
- CPM cannot retrieve the exact private Cmajor repository and its private CHOC commit without post-download mutation;
- concurrent resolution corrupts or dirties the shared source cache;
- an active build genuinely requires a different Cmajor or CHOC source;
- a required fix lacks enough evidence to tell whether it survived the fork conversion;
- completing the migration would require changing the Cmajor CLI, product behavior, plugin source/state, signing, installation, deployment, or `master`.

No stop condition authorizes a public repository, alternate downloader, source override, copied dependency tree, symlink workaround, post-download patch, weakened test, or partial completion claim.

## Decision account

- **One patched stack for every build is a requirement, not an optimization.** The bug fixes are baseline correctness. Absence of a patch-specific file or feature in one plugin is not evidence that an unpatched framework is acceptable.
- **Private committed forks replace patch-at-setup.** This makes the correct source reviewable, versioned, cacheable, and reproducible.
- **CHOC is pinned by the private Cmajor repository and fetched recursively through CPM.** This preserves Cmajor's expected tree layout without a second installer or post-fetch replacement.
- **One resolver owns dependency policy.** Callers request resolved paths; they do not know download URLs, select versions, patch sources, or choose fallbacks.
- **The CLI is deliberately deferred.** Dependency source cleanup should not be blocked or distorted by a separate executable-distribution decision.
