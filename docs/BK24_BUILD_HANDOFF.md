# BK-24A/B/D build reliability handoff

## Identity and scope

- Task: BK-24A/B/D build/configuration/generation owner
- Worker: `/root/build` (reporting through `/root` to coordinator Bob)
- Branch: `codex/bk-24-build-reliability`
- Worktree: `/Users/winterfell/.codex/worktrees/bk24-build/cosimo-synth`
- Base: `bec24a085bb08dbc9ef5a6e6c1255d0f6c09c1d4`
- Source audit baseline represented by that base: `7341f96372e4561b5e02a5a7f870fdc3b8d64909`
- Final commit: the branch HEAD containing this handoff; report its exact hash in the coordinator handoff.

The production configure now passes the microphone policy on every run as an
explicit `ON` or `OFF`. Removing or disabling the setting therefore replaces a
cached `ON` value while unrelated customer cache values survive.

Configure-time Cmajor generation remains in place because the generated
`CMakeLists.txt` is needed by `add_subdirectory`. Each configure generates into
`<juceOut>/_build/generated-project-stage`, synchronizes the complete staged
tree into the durable `<juceOut>` by content, then removes the stage. Equal
files retain their timestamps, differing and missing files are written, stale
files are removed, file/directory/symlink transitions are reconciled, and the
durable `_build` tree is reserved. Generated text that embeds the absolute
staging path fails configuration instead of publishing location-dependent
output. `--clean` still removes the complete output and build tree first.

The optional `editorMaxWidth` setting and consumer-side generated C++ rewrite
are removed. SeqFX keeps the Cmajor-supported resizable editor and its manifest
default size of 1120 by 680. Its responsive layout and minimum-size UI source
were not changed.

## Exact changed scope

- `kit/fx/prod-effect.mjs`: explicit option reset and durable generated-output preparation.
- `kit/fx/build-effect.mjs`: remove `editorMaxWidth` from the accepted plugin config and discovered model.
- `kit/tools/effect_plugin_build/CMakeLists.txt`: fresh staging generation followed by content synchronization; remove the width splice.
- `kit/tools/effect_plugin_build/sync_generated_project.cmake`: complete, timestamp-preserving generated-tree reconciliation.
- `kit/tools/effect_plugin_build/read_generated_plugin_info_class.cmake`: accept exactly the stock generator-authored `GeneratedPlugin` alias.
- `kit/tools/effect_plugin_build/CosimoBoundedGeneratedPlugin.h`: removed.
- `kit/tools/effect_plugin_build/apply_generated_editor_width_ceiling.cmake`: removed.
- `fx/seqfx/SeqFx.plugin.json`: remove the unsupported width cap setting.
- `tests/test_fx_build_args.mjs`: same-cache reset, ordinary resizing, generated-tree reconciliation, clean equivalence, and staging-path regressions.

`TODOS.txt`, `PROGRESS.txt`, user-global instructions, dependency pins,
downloaded/generated sources, UI source, native products, and installed plugins
were not changed.

## Focused proof

Red on the original implementation:

- Same-cache `ON -> OFF` remained `ON` because the disabled value was omitted.
- Normal preparation deleted durable generated files.
- The synchronization helper/staging path did not exist.
- SeqFX still exposed `editorMaxWidth` and the generated-source mutation helpers.

Green after the repair:

```text
node --test tests/test_fx_build_args.mjs
57 tests passed, 0 failed
```

The focused cases include `ON -> OFF -> ON -> setting absent` in one real CMake
cache while an unrelated customer value remains unchanged; equal-file mtime
preservation across repeated synchronization; changed, missing, stale, hidden,
file/directory and symlink cases; incremental/clean byte equivalence; staging
path rejection; strict generated factory extraction; and width-config/helper
absence with `view.resizable: true`.

## Generated artifacts and remaining gates

No generated artifact is committed. `npm ci --ignore-scripts` created the
ignored local `node_modules` needed for focused tests. No native build, HMR
session, plugin install, DAW/device action, customer-playground mutation,
release, feed/site publication, push, or master integration was performed.

BK-24C still owns public-command native proof that a first build succeeds, an
unchanged rebuild performs no compile/link work, DSP-only and UI-only edits
update the right artifact, configuration removal resets the cache, a deleted
generated output recovers, and incremental output agrees with a clean build.
That gate also provides the first real pinned-generator confirmation that no
staging path appears in generated output.

## Material decisions

1. **Remove the width cap.** The pinned Cmajor helper has a hard-coded
   `setResizeLimits(250, 160, 32768, 32768)` and exposes no manifest or generator
   maximum-width option. The credible alternative was a reviewed Cmajor-fork
   feature with matching source/tool pins. That is disproportionate for this
   optional constraint, and the approved ticket explicitly prefers removing it
   over retaining generated-source surgery. Product risk is that hosts may let
   SeqFX grow wider than 1120; the responsive UI remains functional.
2. **Run the generator every configure, then synchronize by content.** This
   naturally observes DSP, manifest, UI/resource, generator and framework
   inputs while keeping the generated project available during configuration.
   An input-hash cache or build-time generation would add an orchestration seam
   and risk incomplete dependency accounting. The remaining cost is generator
   invocation itself; no timing improvement is claimed.
3. **Fail on staging-path leakage.** Copying or normalizing path-dependent
   generated text would make the consumer own generator output semantics.
   Failing closed preserves the rule that generated code belongs to Cmajor and
   makes a future generator regression visible.
