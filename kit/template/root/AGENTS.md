# Plugin Monorepo Notes

For plug-in work, start with `kit/AGENTS.md` and follow only the route that
matches the task. It defines the universal source, dependency, generated
artifact, test, and install boundaries for this repository. The instructions
downloaded in this project govern its work.

`README.md` contains the recommended first-use request and its build/install flow.

<!-- builder-kit-install-runtime-v1 -->
Treat the folder containing this file as the project root. Resolve and retain
its exact path with `pwd -P`; confirm `git rev-parse --show-toplevel` names the
same folder. If `.builder-kit-install/env.sh` exists, source it from this exact
root in every new shell before running canonical npm/build commands:
`. .builder-kit-install/env.sh`. The one-command installer owns that local
Node/CMake runtime; do not change system tools or ask the customer to activate it.

## First Session

- Work from the exact project folder the installer printed. Inspect the folder,
  `git status --short --branch`, and existing files before changing anything.
  Never replace or recreate an occupied project.
- Keep this folder as the session root. If the app cannot change its session
  root, give every command this folder as its explicit working directory; a
  shell `cd` does not change the app's session root.
- Read this file and `kit/AGENTS.md`. Use the bundled skill through normal skill
  discovery; if it is unavailable, read
  `kit/skills/cosimo-make-plugin/SKILL.md` directly before plug-in work.
- Source the installer environment as above, then run
  `npm run kit:doctor -- --strict`. Run `npm run kit:setup` only when the doctor
  or a specific failure identifies setup as the repair, and rerun the strict
  doctor afterward. Stop and explain any remaining recovery step.
- Never infer JUCE consent or supply `--accept-juce-terms` without the customer's
  explicit acknowledgment. The customer's explicit acknowledgment of the
  shipped notice or its matching recorded receipt is sufficient; do not ask
  again. If neither exists, show the shipped notice and ask once, then use the
  exact accepting setup command only if the customer agrees.
- Once the strict doctor passes, ask: “What would you like to do first: build the
  included plugin as-is, change how it sounds, change its interface, or create a
  new plugin?”
- Keep progress updates about customer outcomes: checking readiness, preparing
  required tools, building the plug-in, and installing it.

## Owner Notes

Record your own durable, repo-specific decisions below this line. Keep
`kit/` untouched — Builder Kit updates replace it wholesale; your plugins in
`fx/` and this file are yours.
