# Compatibility

What a Builder Kit version number promises, and what it does not.

## Version numbers

Builder Kit is at 0.x. Until 1.0:

- A **minor** release (0.2 to 0.3) may change or remove public API. Each
  change is listed in the changelog with what to do about it.
- A **patch** release (0.2.0 to 0.2.1) only fixes bugs. It never needs an
  edit to your plugin. A fix to the kit always arrives as a new patch
  release; a published release is never changed.

The kit removes old API instead of keeping it beside its replacement. The
release that removes a name lists it under **Removed**.

## What is public

- The names exported from `kit/index.ts`.
- The `npm run` commands in the project `package.json`.
- The plugin config file, `<PatchName>.plugin.json`.
- The skills under `kit/skills/`.

Everything else under `kit/` is internal, including every path under `kit/ui`.
Importing a deep path works today and may break in any release, patch
releases included.

## Schema versions

`kit/kit.json` lists one `schemaVersions` number per file format the kit
reads: `plugin` for `<PatchName>.plugin.json`, `toolchain` for
`kit/toolchain.json`, and `feed` for `kit/feed.json`. A kit reads every file
written for its own number or lower. A release that raises a number says so
under **Changed**, with the edit to make. A plugin config with a higher number
stops the build with a message to update the kit.

## How a breaking change is announced

Every release has a section in [the changelog](../CHANGELOG.md):
**Changed** and **Removed** list what can break a plugin, and **Update
instructions** gives a prompt to paste into your coding agent. The
[kit-update skill](../skills/kit-update/SKILL.md) reads that section from
the new release before it merges anything.

## Supported platform

| | Supported |
|---|---|
| Computer | Apple silicon Mac, macOS 15 or newer |
| Node | 22 or newer; the installer keeps its own copy in the project |
| Plugin format | VST3. No AU, AAX, Windows or Intel builds. |
| Hosts | Any VST3 host on that Mac. Logic Pro and other AU-only hosts cannot load these plugins. [Host compatibility](HOST_COMPATIBILITY.md) lists known host problems. |

Release 0.2.0 was qualified on an Apple silicon Mac on 4 October 2026: a clean
install and test run, an update from 0.1.0 that kept customer edits, and
pluginval at strictness 5 for the included Enhance That and the generic
`CmajPlugin.vst3` loader. Each release is also heard in a DAW before it is
published.
