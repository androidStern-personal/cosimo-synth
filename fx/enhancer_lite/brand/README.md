# Enhance That artwork

`logo.png` is a pinned, offline copy of the approved Song Machines brand master.
Do not edit this copy. `source.json` records its source repository, path and hash.

Maintainers: from the Song Machines website checkout, run
`npm run brand:sync -- --plugin-repo /path/to/this/checkout`, then
`npm run brand:check -- --plugin-repo /path/to/this/checkout`.

The product config names this asset; Vite embeds it in the production view.
Both trial and purchased variants share it. Logo changes require a new plugin
release through the existing release pipeline, not replacing published archives.
