# Third-Party Notices

The Builder Kit's own code is covered by `LICENSE` (MIT). The components below
are not: each is licensed by its own authors under its own terms, which you
accept by using it. None of them is relicensed, sublicensed, or included in the
kit purchase. This file is a pointer, not legal advice — read the linked terms
and, where a component requires it, obtain your own license before you
release a product.

## JUCE

- What it is: the C++ framework the dedicated plugin build (`fx:prod:build`)
  links into every native plugin bundle. The pinned commit is fetched by CPM
  from the official repository (`kit/cmake/dependencies.cmake`).
- License: dual-licensed by the JUCE team — AGPLv3 (open source) or a
  commercial JUCE license. Terms: https://juce.com/legal/juce-9-licence/
- What this means for you: a closed-source plugin built with JUCE needs a JUCE
  license held by you (the person or company releasing the plugin). Each
  customer of the Builder Kit who ships closed-source JUCE plugins needs their
  own JUCE license; the kit purchase does not include one, and the kit's
  seller cannot grant one. Releasing under the AGPLv3 instead is the
  open-source route. Which JUCE plan applies, and its cost, is decided by the
  JUCE team's terms at the link above, not by this file.
- `npm run kit:setup` shows this notice and records your acknowledgment once
  under `build/kit-tools/`; `npm run kit:doctor` reports it.

## Cmajor

- What it is: the DSP language and toolchain. `cmaj` (downloaded by
  `kit:setup` from the pinned toolchain) generates C++ from your patch for the
  dedicated plugin build; the generic `CmajPlugin.vst3` loader is the JIT
  development host used by `fx:jit:install`. The Cmajor source commit pinned
  in `kit/cmake/dependencies.cmake` is fetched by CPM.
- License: Cmajor is published by Cmajor Software Ltd under a dual GPLv3 (or
  later) / commercial license, with an end-user license agreement for the
  tools. Terms: https://cmajor.dev/docs/Licence (see also `LICENSE.md` and
  `EULA.md` in the Cmajor repository).
- What this means for you: built plugins are ahead-of-time generated C++ —
  the kit ships no Cmajor JIT engine inside a built plugin; the JIT lives
  only in the `cmaj` tool and the development-only `CmajPlugin.vst3`, which
  you do not distribute. Per Cmajor's license, C++ generated from your own
  Cmajor code is yours to use as you wish. Any Cmajor-copyright helper code
  that the generator places in your build remains under Cmajor's terms; you
  are responsible for complying with them for what ends up in your binaries.

## CHOC

- What it is: the header-only C++ utility library (WebView, JSON, audio
  helpers) used by Cmajor and by the generated plugin wrapper. It arrives as a
  submodule of the pinned Cmajor checkout; the kit's build verifies patched
  CHOC WebView markers in built binaries.
- License: ISC. Copyright (c) Tracktion Corporation. Terms:
  https://github.com/Tracktion/choc/blob/main/LICENSE.md
- What this means for you: keep the copyright and permission notice in copies
  of the source; no other obligation.

## CPM.cmake

- What it is: the CMake package manager script at `kit/cmake/CPM.cmake` that
  fetches the pinned Cmajor and JUCE sources at configure time.
- License: MIT. Terms: https://github.com/cpm-cmake/CPM.cmake/blob/master/LICENSE
- What this means for you: keep the notice in the script; no other obligation.

## npm packages

`npm ci` installs every package below from `package-lock.json`, each under the
license declared in its own `package.json` and `LICENSE` file.

These packages are bundled into the JavaScript of every plugin UI that uses
the kit's controls or examples, so they ship inside your plugins:

- `react` and `react-dom`: MIT. Copyright (c) Meta Platforms, Inc. and
  affiliates.
- `jotai`: MIT. Copyright (c) 2020 Poimandres.
- `@radix-ui/react-slot`: MIT. Copyright (c) 2022 WorkOS.
- `@radix-ui/react-context-menu`: MIT. Copyright (c) 2022 WorkOS.

The packages they depend on and that a bundle can include (`scheduler`, the
other `@radix-ui/*` primitives, `@floating-ui/*`, `react-remove-scroll`,
`aria-hidden` and similar) are MIT licensed too, except `tslib` (0BSD).

- What this means for you: MIT asks you to keep each copyright and permission
  notice with copies you distribute, for example in your plugin's About text or
  documentation. Each package's full notice is in
  `node_modules/<package>/LICENSE`.

The remaining packages are build tooling that never ships in a plugin:
`typescript`, `vite`, `@vitejs/plugin-react`, `esbuild`, `playwright`,
`@types/react` and `@types/react-dom`, with their own dependencies.
