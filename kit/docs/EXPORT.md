# Builder Kit Export

`node kit/scripts/export_kit.mjs <outputDir> [--force] [--prove]` produces the
customer starter monorepo: the `kit/` tree, the editable Enhancer Lite plugin,
its tests, the two shared modules they need (`cmajor/EnhancerLiteSpectrumAnalyzer.cmajor`,
`ui/shared/enhancer-spectrum.ts`, `ui/vite.shared.mjs`), and a root generated
from `kit/template/root` (package.json with pinned tool versions taken from the
monorepo, starter AGENTS.md, tsconfig, .gitignore, and the `.agents/skills`
symlink for agent skill discovery).

`kit/export-allowlist.json` is the single wall between customer content and
everything else in this monorepo. The export fails closed when: an allowlisted
path is missing, any output file falls outside the allowlist, a required output
is absent, or any text file contains a forbidden identifier (personal names,
signing team ids, device ids, distribution-channel terms). `tests/test_kit_export.mjs`
keeps the gates honest.

`--prove` additionally builds Enhancer Lite inside the export, runs the kit
unit tests there, and simulates the customer update flow (starter commit →
local plugin edit → kit-update merge; both must survive). On a customer
machine `npm install` replaces the proof's node_modules symlink shortcut.

## Publishing and updates

Publishing pushes an export snapshot as a commit to the private `builder-kit`
distribution repository (one commit per kit release, tagged). Customers created
their repo from that lineage, so `git merge <kit release tag>` delivers
updates; their plugins live in `fx/<their plugin>/`, which kit commits never
touch. The transport that delivers those commits/tags to customers (per the
roadmap: an authenticated feed, no Git-host accounts) is a distribution
decision outside this repo.
