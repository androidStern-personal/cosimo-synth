# Builder Kit agent guide

This guide applies to every plugin project built on `kit/`. Owner, product and
machine decisions belong in the root `AGENTS.md`.

## Always

- Work from the project root. In each new shell, source
  `.builder-kit-install/env.sh` when it exists, then run
  `npm run kit:doctor -- --strict`. Run `npm run kit:setup` only when the
  doctor names it as the fix, then run the strict doctor again.
- Never bypass a hash or signature check, and never substitute a global `cmaj`
  or any other tool for the pinned ones. A failed check means stop and report
  it.
- Import the kit only from `kit/index`. Paths under `kit/ui` are internal and
  can change in any release; see [Compatibility](docs/COMPATIBILITY.md).
- Do not edit `kit/`; updates replace it. Plugin source lives under
  `fx/<plugin>/` and generated output under `build/`. Adding a plugin never
  edits a shared list.
- Run focused tests for what you changed and report them by name. Replace a
  stale assertion only with an equal or stronger one; never weaken a check to
  make a suite pass.
- Build first. Install only when the customer asks, and never install a build
  whose tests or checks failed. Report build, install, DAW discovery and
  listening as separate results.

## Documentation

| Topic | Reference |
|---|---|
| State, saving, Undo, presets and snapshots | [Plugin state](docs/PLUGIN_STATE.md) |
| Preparing data for the audio engine | [Shared audio data](docs/SHARED_DATA.md) |
| Knobs and live indicators | [Knob](docs/KNOBS.md) |
| Envelope editing and playback position | [MSEG](docs/MSEG.md) |
| Filter response, modulation handles and spectrum | [Filter](docs/FILTERS.md) |
| Segmented values, exact entry and modulation ranges | [Slider](docs/SLIDERS.md) |
| What a kit version promises | [Compatibility](docs/COMPATIBILITY.md) |

## Start with the relevant path

| Task | Reference or command |
|---|---|
| Build the included Enhance That unchanged | The included-plugin route in [the make-plugin skill](skills/make-plugin/SKILL.md). Placeholder owner details do not block it. |
| Create or change a plugin | [The make-plugin skill](skills/make-plugin/SKILL.md), then [plugin architecture](docs/PLUGIN_ARCHITECTURE.md). Set the real owner identity in `product-owner.json` first. |
| Browser UI development | `npm run fx:dev` serves every plugin UI on `127.0.0.1:5175`; never stop another project's server. Run `npm run fx:build -- <alias>` before browser tests, and `npx playwright install chromium` once when a task needs them. |
| Dedicated native VST3 | `npm run fx:prod:build -- <alias>`, then, when asked, `npm run fx:prod:install -- <alias>`. |
| Generic JIT loader | `npm run cmajplugin:install`, then `npm run fx:jit:install -- <alias>`; see [host compatibility](docs/HOST_COMPATIBILITY.md). |
| Tests | `npm run typecheck` and `npm test`; `npm run test:browser` for browser-facing work. `node --test <file>` runs one file. |
| Release a plugin or smoke-test it in a DAW | [Release verification](docs/RELEASE_VERIFICATION.md) and the project's `THIRD_PARTY_NOTICES.md`. |
| Update the kit or its pinned tools | [The kit-update skill](skills/kit-update/SKILL.md) or [toolchain](docs/TOOLCHAIN.md). |

`node kit/fx/build-effect.mjs --targets` lists every plugin alias.
