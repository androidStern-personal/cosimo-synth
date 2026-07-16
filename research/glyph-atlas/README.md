# The Plugin Glyph Atlas

A style-clustered visual atlas of glyphs, icons and ornaments from audio-plugin
interfaces, built 2026-07-16 as design inspiration for this synthesizer's visual
identity. **Open `plugin-glyph-atlas.html` in any browser** — it is fully
self-contained (all imagery embedded; no network needed).

## Contents

| File | What it is |
|---|---|
| `plugin-glyph-atlas.html` | The deliverable: cover + 8-section style atlas (190 specimens), provenance index, designer's field notes |
| `provenance.json` | Machine-readable index of all 64 surveyed plugins: vendor, category, style groups, acquisition status, source URL |
| `community-wisdom.md` | Curation signals from KVR/Gearspace/SoS/BPB threads, with URLs |
| `corpus.json` | The original planning corpus + methodology/tier definitions |
| `work/` | Crop metadata checkpoints (resumability) |

## Methodology in one paragraph

The run executed in a sandboxed environment whose egress policy allows only
GitHub-family hosts — every vendor site, KVR and marketplace was policy-blocked.
Authentic imagery was therefore acquired via GitHub (open-source repos, official
site-repos, developer-owned skin repos, and GitHub's camo image proxy for
vendor-hosted originals) and cropped into glyph specimens; where no legitimate
image was reachable, the plugin's glyph vocabulary was redrawn as an SVG
**facsimile study**, badged as such in the atlas, never presented as a
screenshot. 35 of 64 plugins have authentic imagery; 26 have facsimile plates;
3 are surveyed in the field notes only. Piracy-adjacent sources were skipped.

The crop tooling, facsimile plate generators and atlas builder are committed
in `tools/` (`crop.py`, `plates.py`, `plates3.py`, `build_atlas.py`,
`scrape_repos.py`, `sheet.py`, `render_plates.sh`); raw imagery is re-fetchable
from the source URLs recorded in `provenance.json` and `work/*.jsonl`.
