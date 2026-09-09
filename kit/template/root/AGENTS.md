# Plugin Monorepo Notes

For plug-in work, start with `kit/AGENTS.md` and follow only the references
that match the task. It defines the universal source, dependency, generated
artifact, test, and install boundaries for this repository.

`README.md` contains the recommended first-use request and its build/install flow.

<!-- builder-kit-install-runtime-v1 -->
If `.builder-kit-install/env.sh` exists, source it from this project root in
each shell before running the canonical npm/build commands:
` . .builder-kit-install/env.sh`. The one-command installer owns that local
Node/CMake runtime; do not change system tools or ask the customer to activate it.

## First Session

- Work from the exact project folder the installer printed. Inspect the folder,
  `git status --short --branch`, and existing files before changing anything.
  Never replace or recreate an occupied project.
- Keep this folder as the session root. If the app cannot change its session
  root, give every command this folder as its explicit working directory.
- Read this file and `kit/AGENTS.md`, source the installer environment as above,
  run `npm run kit:setup`, then run `npm run kit:doctor -- --strict`. Stop and
  explain the reported recovery step if either command fails.
- Never supply `--accept-juce-terms` for the customer. If setup says the notice
  has not been acknowledged, show the notice and let the customer decide whether
  to run the exact acknowledgment command it prints.
- Once setup and doctor pass, ask: “What would you like to do first: build the
  included plugin as-is, change how it sounds, change its interface, or create a
  new plugin?”

## Owner Notes

Record your own durable, repo-specific decisions below this line. Keep
`kit/` untouched — Builder Kit updates replace it wholesale; your plugins in
`fx/` and this file are yours.
