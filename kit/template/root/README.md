# Builder Kit

Install using the personalized one-line command supplied with your delivery;
read its JUCE notice before running it. When it reports success, continue in the
printed project folder. If you ran the command directly in Terminal, open that
folder in your coding agent. No plugin has been built or installed yet.

The usual folder is `~/Documents/Builder Kit`. If that folder already contains
something else, the installer chooses a versioned folder beside it and prints
the exact path. Repeating the same command resumes only the installation it owns.

For a guided first session, ask your coding agent:

> Read AGENTS.md, check this existing project without overwriting anything, run
> the strict doctor from this exact folder, use setup only if a reported problem
> needs it, then ask what I want to build or modify.

The agent will offer to build the included plugin as-is, change its sound or
interface, or start a new plugin. You can also give it your own request.

When you are ready: [try the Wavefold example](WAVEFOLD.md),
[update or recover your kit](UPDATING.md), or [get setup help](SUPPORT.md).

## If you choose to build the included plugin as-is

After the first-session strict doctor and choice above, follow this section only
when you choose to build the included plugin as-is.

Ask your coding agent to follow the **Included Enhance That, Unchanged** route in
`kit/skills/cosimo-make-plugin/SKILL.md`. That is the authoritative procedure.
It keeps the included `enhancer-lite` target unchanged, runs the typecheck and
tests, builds the dedicated native plug-in, and installs it. Product-owner
placeholder details do not block this unchanged included plug-in.

The agent must not copy or rename the included plug-in, create a new plug-in or
test, edit plug-in/test source, or make a browser preview or modification a
prerequisite. Normal generated build files are expected.

After success, the agent reports “Enhance That is built and installed,” followed
by the exact installed path as secondary detail. It may briefly invite your next
change. Build/install success is not a listening or DAW-acceptance result, and
the agent does not launch a DAW or begin a tutorial unless you ask for help.

## Optional browser UI development

When you want to inspect or edit the interface locally, run `npm run fx:dev`
and open
`http://127.0.0.1:5175/fx/enhancer_lite/view/harness.html` yourself. Use the
server's printed origin if you chose another port. An occupied port is an
error; do not stop another project's server to use it.

This loads the real plugin interface with local parameter and preset state.
There is no audio engine, DAW connection, or live analyzer audio here. Use the
installed plugin in your DAW to hear it. Preview is optional and never opens
automatically. Preview state resets on reload and never changes DAW presets.
