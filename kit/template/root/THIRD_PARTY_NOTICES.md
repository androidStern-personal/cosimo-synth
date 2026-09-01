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
  from the official repository (`kit/cmake/CosimoDependencies.cmake`).
- License: dual-licensed by the JUCE team — AGPLv3 (open source) or a
  commercial JUCE license. Terms: https://juce.com/legal/juce-9-licence/
- What this means for you: a closed-source plugin built with JUCE needs a JUCE
  license held by you (the person or company releasing the plugin). Each
  customer of the Builder Kit who ships closed-source JUCE plugins needs their
  own JUCE license; the kit purchase does not include one, and Cosimo cannot
  grant one. Releasing under the AGPLv3 instead is the open-source route.
  Which JUCE plan applies, and its cost, is decided by the JUCE team's terms
  at the link above, not by this file.
- `npm run kit:setup` shows this notice and records your acknowledgment once
  under `build/kit-tools/`; `npm run kit:doctor` reports it.

## Cmajor

- What it is: the DSP language and toolchain. `cmaj` (downloaded by
  `kit:setup` from the pinned toolchain) generates C++ from your patch for the
  dedicated plugin build; the generic `CmajPlugin.vst3` loader is the JIT
  development host used by `fx:jit:install`. The Cmajor source commit pinned
  in `kit/cmake/CosimoDependencies.cmake` is fetched by CPM.
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

Build-time tooling (TypeScript, Vite, React, Playwright, esbuild, and their
dependencies) is installed by `npm install` under the licenses declared in
each package's `package.json`. React is bundled into plugin UIs and is MIT
licensed; the rest is development tooling that does not ship in a plugin.
