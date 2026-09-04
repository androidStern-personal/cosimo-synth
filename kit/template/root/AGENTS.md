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

## Owner Notes

Record your own durable, repo-specific decisions below this line. Keep
`kit/` untouched — Builder Kit updates replace it wholesale; your plugins in
`fx/` and this file are yours.
