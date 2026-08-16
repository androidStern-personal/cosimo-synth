# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Prototype Goal

- This is an interaction comparison, not a production implementation.
- Keep the accepted rack model fixed: ordered named effects, one quick parameter per strip, and progressively disclosed Macro 1, Env 1, and MSEG 1 sources.
- Filter editing and MSEG editing are separate focus states, never competing layout options.
- Never replace the focused Filter editor with an MSEG merely because the user opens a Filter modulation mapping.
- The Filter flow keeps Filter centered while showing its incoming mappings. The MSEG flow begins only when the user explicitly selects MSEG 1 and keeps MSEG centered while showing its outgoing targets.
- Preserve a 390 × 844 app surface for each concept.
