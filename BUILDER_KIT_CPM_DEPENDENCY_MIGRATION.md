# Plain CPM Dependency System for Cmajor, CHOC, and JUCE

Status: **completed and integrated**

Date: 2026-08-29

Decision owner: Andrew Stern

Roadmap owner: Codex thread `01a04461-bd5b-71d0-8c75-a3c5287216be`

Implementation owner: Codex thread `01a04c57-fedd-7c23-b84a-7cc076a6ab4c`

Integrated implementation: `0c38ad96607423d246fc2048851635b21148419f`

Qualified master checkpoint: `e3b832ebe8010a40a40e86780bd549467ed744d1`

## What was required

Every supported Cosimo build must use the same patched Cmajor and CHOC sources and the same pinned JUCE source. The fixes live as ordinary commits in private repositories. A build must never download official source and patch, replace, copy, or edit it afterward.

The dependency setup must stay simple:

```txt
build
  -> include cmake/CosimoDependencies.cmake
  -> ordinary CPMAddPackage calls
  -> ordinary shared CPM source cache
  -> exact private Cmajor commit
       -> exact private CHOC submodule commit
  -> exact official JUCE commit
```

There is no separate setup command. CPM downloads missing source during the first build and reuses its normal user-level source cache on later builds and in other worktrees. Each worktree keeps its own CMake build folders and generated output.

## Exact source versions

Production builds use:

- vendored CPM `0.43.1` from `cmake/CPM.cmake`;
- private `androidStern-personal/cmajor` at `f1c9a9a8e85dcc82141326a2fc1c5160241f346c`;
- private `androidStern-personal/choc` at `037e34a2b382175c8bee4be5a0707724130f10e8`, pinned by Cmajor's `include/choc` submodule;
- official JUCE at `501c07674e1ad693085a7e7c398f205c2677f5da`.

The separate T26 research wrapper uses official JUCE 7 at `b08520c2de1771af3dfcbfbc0e0b6b0b5eb083b0` through the same CMake module. That exception preserves the historical T26 research tool; it is not a second production dependency stack.

## The implementation

`cmake/CosimoDependencies.cmake` is the only dependency seam. It:

1. uses `CPM_SOURCE_CACHE` when explicitly supplied;
2. otherwise uses the ordinary user cache at `$HOME/.cache/CPM`;
3. includes the vendored CPM release;
4. exposes `cosimo_add_production_dependencies()` for Cmajor, recursive CHOC, and production JUCE;
5. exposes `cosimo_add_t26_research_juce()` for the separate T26 JUCE 7 tool.

All active production CMake callers include that module. Non-CMake scripts reach dependencies by invoking those CMake builds. The old Python source provisioners and independent Cmajor, CHOC, JUCE, and desktop-runtime download paths are gone.

## What is forbidden

This architecture must not grow any of the following:

- a Python, JavaScript, shell, or second CMake dependency resolver;
- a custom cache lock or concurrent-access manager;
- custom corruption detection or cache repair;
- credential filtering or rewritten Git diagnostics;
- cache receipts, source-tree fingerprints, read-only enforcement, or a custom offline mode;
- environment-variable policing beyond CPM's ordinary cache location;
- a second source/version authority, fallback checkout, or local source override;
- post-download patching, source overlays, dependency copies, or dependency symlinks;
- a manual clone, submodule, or worktree setup step;
- a moving branch or tag in place of an exact commit.

If ordinary CPM or Git fails, the build may fail normally. Do not construct another dependency-management product inside Cosimo to hide or reinterpret that failure.

## Private fork rule

The Cmajor and CHOC repositories stay private. Their upstream history and licenses remain intact. Cosimo fixes are committed there before the production pin changes. No build applies those fixes after download, and no task may push them to Andrew's public CHOC repository.

CHOC remains Cmajor's recursively fetched submodule rather than a second top-level CPM package. This gives Cmajor the source layout it expects while keeping one private CHOC identity.

## Small build-lifecycle fixes retained

The final source review found four ordinary build issues. Their fixes do not add dependency policy:

- simultaneous browser tests use separate PID/port-scoped CMake build folders while sharing CPM's normal source cache;
- an effect build discards its `_build` folder only when CMake says it belongs to the obsolete source project, while a matching incremental build folder is preserved;
- CmajPlugin build and dry-run install use one shared function for the real artifact path;
- the existing PatchWorker re-entrant queue and early-detachment regression probe builds through the shared native-test CMake project and plain CPM.

## Completion evidence

The integrated result passed:

- a fresh exact production dependency resolution and a later warm-cache resolution;
- the plain-CPM caller and no-second-resolver tests;
- simultaneous browser staging tests;
- clean and incremental Enhancer Lite effect builds;
- the generic CmajPlugin VST3 build with the AppleClang conversion error fixed in the private Cmajor fork and no warning waiver;
- Cmajor runtime and external-code-generation builds;
- desktop AU, VST3, and standalone builds;
- web build and the retained PatchWorker behavior probe;
- T26's separate JUCE 7 configure, build, and executable probe.

Nothing was installed, signed for release, notarized, deployed, or published by this task.

One broader iOS benchmark assertion still fails on a tiny float32-versus-Python-double cancellation difference. It fails identically before this migration and is not a dependency regression. No product/DSP change was folded into this work.

## Still separate

This work does not decide how the `cmaj` command-line program is obtained or distributed to Builder Kit customers. It also does not create the customer repository, change product behavior, implement DAW automation, build the production AU release, sign or notarize anything, or resolve commercial licensing.

Those remain separate roadmap items.
