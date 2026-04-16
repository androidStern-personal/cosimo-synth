# CHOC Host Keyboard Forwarding

This document describes the current Ableton Musical Typing fix for Cmajor/CHOC
plugins that use macOS `WKWebView`.

The fix belongs in a patched CHOC checkout, not in individual plugin UI code.
Generated Cmajor plugins then pick up that patched CHOC through Cmajor's normal
`--cmajorIncludePath` setting.

## Problem

In Ableton, a focused Cmajor/CHOC `WKWebView` can consume QWERTY keyboard input
before Ableton receives it. That breaks Ableton Musical Typing and transport
shortcuts while the plugin UI is focused, especially during active knob drags.

The plugin still needs normal browser behavior: text fields must type, selects
must work, plugin shortcuts must work, and app code should not know about
Ableton, AppKit, `NSEvent`, or native forwarding.

## Dependency Shape

Use this durable dependency shape:

```text
patched CHOC fork
  choc/gui/choc_WebView.h contains the host-keyboard bridge

Cmajor checkout or fork
  include/cmajor is the pinned Cmajor release
  include/choc points at the patched CHOC fork commit

generated plugin build
  cmaj generate receives --cmajorIncludePath /absolute/path/to/cmajor/include
```

The current pushed CHOC fork is:

```text
https://github.com/androidStern/choc
branch: cosimo-keyboard-bridge
commit: 1e79d904209abd842d688433358f9e0df7d55454
```

The official prebuilt generic `CmajPlugin.vst3` and `CmajPlugin.component` do not
contain this fix. They were already compiled against stock CHOC. To use this
system in a generic loader, rebuild the loader from a Cmajor checkout whose
`include/choc` points at the patched CHOC fork.

## Migrating This Repo's Effect Plugins

The standalone effects use two different plugin workflows, and they need to be
handled separately.

Generated VST3 workflow:

- `ChorusLab` uses `npm run fx:prod:build -- chorus`.
- `OTT Lab` uses `npm run fx:prod:build -- ott`.
- `SeqFX`, on branch `codex/effect-sequencer`, uses
  `scripts/generate_seqfx_plugin.sh`.

The shared production build follows the same dependency pattern:

```text
scripts/ensure_cmajor_runtime.py
  -> build/deps/cmajor-1.0.3066-choc-1e79d904
  -> include/choc at 1e79d904209abd842d688433358f9e0df7d55454
  -> cmaj generate ... --cmajorIncludePath=<patched runtime>/include
```

That means the generated plugin builds pick up the patched CHOC checkout by
default. If `CMAJOR_SOURCE_PATH` is set manually, the scripts still validate
that its CHOC WebView header contains the bridge markers:

```text
chocHostKeyboard
__chocHostKeyboardBridgeInstalled
```

So the generated `ChorusLab` and `OTT Lab` VST3 workflow stays simple: run the
normal production build command and the build fails if it is not using patched
CHOC.

Generic JIT loader workflow:

`scripts/install_fx_cmajplugin.sh` validates a selected effect patch and writes
`~/Library/Audio/Plug-Ins/VST3/CmajPlugin.json` so the already-installed generic
`CmajPlugin.vst3` loads that patch.

```text
npm run fx:jit:install -- ott
npm run fx:jit:install -- chorus
```

That script does not install `CmajPlugin.vst3`, does not download the Cmajor
DMG, and does not touch AU plugins. It now requires the installed generic VST3
to already be signed and built with the patched CHOC keyboard bridge.

Build and install the patched generic VST3 separately:

```text
npm run cmajplugin:build
npm run cmajplugin:install
```

Only one generic `CmajPlugin.json` can be active in the user VST3 folder at a
time. Running `npm run fx:jit:install -- chorus` points `CmajPlugin.vst3` at
Chorus; running `npm run fx:jit:install -- ott` points the same
`CmajPlugin.vst3` at OTT. That is expected for the generic loader workflow.

Use the dedicated generated VST3s when testing final plugin identity, host
metadata, packaging, signing, and distribution behavior. Use the patched generic
`CmajPlugin.vst3` when actively editing `.cmajor` DSP source and wanting runtime
reloads inside the host.

## Building A Patched Generic CmajPlugin.vst3

Cmajor includes the generic loader source. It is not binary-only.

```text
cmajor/tools/CmajPlugin/Source/cmaj_PatchLoaderPlugin.cpp
```

That loader:

- includes CHOC through Cmajor's `include/choc` tree;
- creates a `cmaj::Patch`;
- calls `patch->setAutoRebuildOnFileChange(true)`;
- finds a `.cmajorpatch` from sibling JSON, sibling patch, or sibling folder;
- creates `cmaj::plugin::SinglePatchJITPlugin`, which compiles the patch at
  runtime and watches source files for changes.

So a patched generic loader is just the normal Cmajor `CmajPlugin.vst3` rebuilt
from a Cmajor checkout whose `include/choc` points at the patched CHOC fork.
In this repo, use:

```text
npm run cmajplugin:build
npm run cmajplugin:install
```

`npm run cmajplugin:build` uses `scripts/ensure_cmajor_runtime.py` by default,
configures Cmajor's `CmajPlugin_VST3` target with CMake, builds it, and verifies
that the built binary contains the bridge strings.

The built VST3 is expected under:

```text
build/cmajplugin_vst3/tools/CmajPlugin/CmajPlugin_artefacts/Release/VST3/CmajPlugin.vst3
```

`npm run cmajplugin:install` copies that already-built VST3 into:

```text
~/Library/Audio/Plug-Ins/VST3/CmajPlugin.vst3
```

Then write the active patch pointer with `npm run fx:jit:install -- ott` or
`npm run fx:jit:install -- chorus`:

```json
{
  "location": "/absolute/path/to/repo/fx/ott_lab/OttLab.cmajorpatch"
}
```

to:

```text
~/Library/Audio/Plug-Ins/VST3/CmajPlugin.json
```

The patched generic loader should keep the same Cmajor hot-reload behavior as
the official generic loader, because the hot-reload behavior comes from
`SinglePatchJITPlugin` and `Patch::setAutoRebuildOnFileChange(true)`, not from
anything unique to the official prebuilt binary.

Do not use the official generic AU loader for Ableton development. The official
generic VST3 did not reproduce the Ableton WebView knob crash; the official
generic AU did.

## Setup

1. Fork CHOC from the exact CHOC commit used by the target Cmajor release.
2. Patch `choc/gui/choc_WebView.h` in that CHOC fork.
3. In the Cmajor checkout or fork, point `include/choc` at the patched CHOC fork.
4. Generate plugins with an absolute `--cmajorIncludePath`.

Example:

```bash
cmaj generate \
  --target=juce \
  /path/to/MyPlugin.cmajorpatch \
  --output=/path/to/build/MyPlugin_juce \
  --jucePath=/path/to/JUCE \
  --cmajorIncludePath=/path/to/patched-cmajor/include
```

Then build the generated JUCE project normally:

```bash
cmake -S /path/to/build/MyPlugin_juce -B /path/to/build/MyPlugin_juce/build
cmake --build /path/to/build/MyPlugin_juce/build --target MyPlugin_VST3 -j 8
```

`--cmajorIncludePath` should be absolute. A relative path is emitted literally
into generated CMake and can resolve relative to the generated plugin folder
instead of the source repo.

If `include/choc` is a Git submodule and you test with a local file-path remote,
Git may reject it with `fatal: transport 'file' not allowed`. That is a local
test issue. A hosted CHOC fork does not need that override.

## New Plugin Repo Quickstart

For a new Cmajor plugin repo, vendor a Cmajor checkout and replace its CHOC
submodule with the patched CHOC fork.

```bash
git clone https://github.com/cmajor-lang/cmajor.git vendor/cmajor
cd vendor/cmajor
git checkout 172db53232337154d5a1c0f9a448318129dfacd9

git submodule deinit -f include/choc
rm -rf include/choc .git/modules/include/choc

git submodule add https://github.com/androidStern/choc.git include/choc
cd include/choc
git checkout 1e79d904209abd842d688433358f9e0df7d55454
cd ../..
```

Then generate with the vendored Cmajor include directory:

```bash
cmaj generate \
  --target=juce \
  /path/to/MyPlugin.cmajorpatch \
  --output=/path/to/build/MyPlugin_juce \
  --jucePath=/path/to/JUCE \
  --cmajorIncludePath=/absolute/path/to/vendor/cmajor/include
```

Build the generated plugin:

```bash
cmake -S /path/to/build/MyPlugin_juce -B /path/to/build/MyPlugin_juce/build
cmake --build /path/to/build/MyPlugin_juce/build --target MyPlugin_VST3 -j 8
```

Replace `MyPlugin_VST3` with the actual generated target name.

## Patched Behavior

The native CHOC layer does this:

- Registers a `WKScriptMessageHandler` named `chocHostKeyboard`.
- Injects one document-start browser script into every CHOC `WKWebView`.
- Subclasses `WKWebView` and captures original AppKit `keyDown:` and `keyUp:`
  `NSEvent` objects before WebKit can lose them.
- Retains those events in a short-lived FIFO buffer.
- Lets WebKit continue normal DOM event dispatch.
- When JavaScript asks to forward or discard an event, matches the request to a
  retained native event by event type, modifiers, repeat state, and key.
- Forwards a matched retained event to the WebView's `nextResponder` by calling
  `keyDown:` or `keyUp:`.
- Releases retained native events after forward, discard, expiry, trim, or
  WebView destruction.

The current native buffer settings are:

```text
maxPendingKeyboardEvents = 64
pendingKeyboardEventTTLMillis = 1000
```

The injected browser router does this:

- Runs at document start before normal plugin app code.
- Observes normal DOM `keydown` and `keyup` events.
- Waits until after browser/framework event dispatch so app code can call
  `event.preventDefault()`.
- Treats `preventDefault()` as the plugin claiming the event.
- Treats text-entry targets as plugin-owned: `input`, `textarea`, `select`,
  contenteditable elements, and `role="textbox"`.
- Treats IME composition as plugin-owned.
- Treats `Cmd`, `Ctrl`, and `Option` modified keys as plugin-owned.
- Forwards unclaimed Ableton Musical Typing keys to the host.
- Forwards unclaimed Spacebar to the host for transport.
- If a keydown was forwarded, forwards the matching keyup too.
- Discards buffered native events for plugin-owned keys so stale buffered events
  cannot match later.

The Ableton Musical Typing key set is:

```text
a w s e d f t g y h u j k z x c v b n m
```

Normal plugin code should use ordinary browser keyboard handling:

```js
window.addEventListener("keydown", (event) => {
  if (event.metaKey && event.key === "k") {
    event.preventDefault();
    openCommandPalette();
  }
});
```

Plugin app code should not call native forwarding APIs. The native bridge is a
platform adapter hidden below the browser runtime.

## Select Focus Release

Native browser `<select>` controls can remain focused after a mouse selection.
While a select remains focused, the router correctly treats keyboard events as
text-entry/select-owned, so Ableton Musical Typing does not resume until the user
clicks elsewhere.

The injected router fixes this for pointer-used selects:

- It tracks `pointerdown`, `mousedown`, and `touchstart` on selects.
- On the select's `change` event, it waits one macrotask.
- If the same select is still active, it calls `select.blur()`.
- It installs this behavior on `document` and on future shadow roots created
  through `Element.prototype.attachShadow`.

Keyboard-driven select changes keep focus.

## Dead Ends

Do not use `[NSApp currentEvent]` for JavaScript-requested forwarding. It races
with `LeftMouseDragged`, `MouseMoved`, and `Pressure` events during active knob
drags, so the native event can no longer match the DOM key event.

Do not call `resignFirstResponder` on `WKWebView`. Direct and deferred
`resignFirstResponder` calls crashed Ableton during earlier testing.

Do not buffer `flagsChanged:` by default. Modifier-only native events polluted
the pending buffer, while plugin shortcuts can use normal DOM `keydown` and
`keyup` events with modifier flags.

Do not synthesize global input with `CGEventPost`. Forward the original retained
host-delivered `NSEvent` through the normal responder chain.

Do not put forwarding calls into product UI components. Product UI code should
claim shortcuts with normal browser `preventDefault()` behavior.

## Verification

After building a plugin from the patched Cmajor/CHOC checkout, verify the binary
contains the generic bridge names and not the old probe names:

```bash
strings /path/to/MyPlugin.vst3/Contents/MacOS/MyPlugin \
  | rg "chocHostKeyboard|__chocHostKeyboardBridgeInstalled"

strings /path/to/MyPlugin.vst3/Contents/MacOS/MyPlugin \
  | rg "cosimoKeyboard|cosimoKeyboardProbe|cosimo-keyboard-probe-panel|forwarded-buffered-flags-changed"
```

The first command should find bridge strings. The second command should produce
no output.

For development logging, compile with:

```text
CHOC_HOST_KEYBOARD_BRIDGE_DEBUG_LOG=1
```

Logs are written to:

```text
/tmp/choc-host-keyboard-bridge.log
```

Test this in Ableton with a VST3 build. Do not use the official generic AU
loader for keyboard testing; that AU loader separately crashed Ableton during
WebView knob parameter tests, which is unrelated to keyboard forwarding.
