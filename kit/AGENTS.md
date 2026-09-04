# Builder Kit agent guide

This file applies to plug-in repositories built on `kit/`. Owner, product, machine, signing, and device policy belongs in the repository root.

## Always

- Keep `kit/` generic and replaceable. Product behavior belongs under `fx/<plugin>/` or documented root extension seams; never add product-specific imports, personal identifiers, or machine paths to the kit.
- Use the pinned toolchain installed by `npm run kit:setup` and the single dependency seam in `kit/cmake/CosimoDependencies.cmake`. Never substitute a global `cmaj`, patch downloaded or generated sources, or copy another worktree's tools or dependency tree.
- Keep authored plug-in files under `fx/` and generated runtimes/native projects under `build/`. Discovery and plug-in config must fail closed; adding a plug-in must not add a central registry entry.
- Run focused tests for changed behavior and name them in the handoff. Repair stale assertions with equal-or-stronger checks; never weaken a failure to make a suite pass.
- Installs and host/device work mutate external state. Build first, install only when the task authorizes it, and report build, install, DAW discovery, and listening as separate results.

## Start with the relevant path

| Task | Reference or command |
|---|---|
| Check or prepare a machine | `npm run kit:doctor` is read-only. `npm run kit:setup` writes verified pinned tools and dependencies. |
| Create or change a plug-in | [`kit/skills/cosimo-make-plugin/SKILL.md`](skills/cosimo-make-plugin/SKILL.md) and [`kit/docs/PLUGIN_ARCHITECTURE.md`](docs/PLUGIN_ARCHITECTURE.md) |
| Browser UI development | `npm run fx:dev` uses the one shared loopback server on port 5175; never stop another worktree's server. Build a runtime with `npm run fx:build -- <alias>` before browser tests. |
| Dedicated native VST3 | `npm run fx:prod:build -- <alias>`, then, only when authorized, `npm run fx:prod:install -- <alias>` |
| Generic JIT loader | `npm run cmajplugin:install`, then `npm run fx:jit:install -- <alias>`; see [`kit/docs/HOST_COMPATIBILITY.md`](docs/HOST_COMPATIBILITY.md). |
| Tests | `npm test`; `npm run typecheck`; in customer exports, `npm run test:browser` after `npx playwright install chromium`; in the source monorepo, run the focused `test:*:view` command or direct browser test named by the task |
| Native release or DAW smoke test | [`kit/docs/RELEASE_VERIFICATION.md`](docs/RELEASE_VERIFICATION.md) and the shipped root notice (source template: [`kit/template/root/THIRD_PARTY_NOTICES.md`](template/root/THIRD_PARTY_NOTICES.md)) |
| Kit export, publishing, or customer update | [`kit/docs/EXPORT.md`](docs/EXPORT.md) or [`kit/skills/kit-update/SKILL.md`](skills/kit-update/SKILL.md) |

Across isolated worktrees, CPM may share its ordinary user cache; `build/kit-tools/` remains worktree-local. Use `node kit/fx/build-effect.mjs --targets` to list discovered aliases.
