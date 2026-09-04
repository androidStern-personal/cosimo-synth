# Builder Kit

After setup, a good first request for your coding agent is:

> Build and install the included plugin so I can try it in my DAW.

Try the included plugin as it is, then choose what you would like to change.
If you already have another request, start with that instead.

## For your coding agent

Read `kit/AGENTS.md`. For the request above, use the included `enhancer-lite`
target unchanged. Do not copy or rename it, create a new plugin or test,
edit plugin/test source, or make a browser preview or modification a
prerequisite. Normal generated build files are expected.

From this Builder Kit project folder, after setup and the customer's explicit
JUCE acknowledgment:

```sh
npm run typecheck
npm test
npm run fx:prod:build -- enhancer-lite
npm run fx:prod:install -- enhancer-lite
```

Stop on a failed command and explain it; do not change source to complete this
first-use request. After success, report the actual plugin name to find in the
DAW and the exact installed location from the build/install result. Invite the
customer to try it in their DAW and tell you their chosen first modification.
Build/install success is not a listening or DAW-acceptance result.

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
