# Cosimo Mobile Visual System

This document defines the visual and layout contract for the parallel Cosimo iOS React prototype. The selected Ulm Scientific Instrument mock is the visual acceptance target. These foundations are intentionally opt-in and are not yet connected to the existing prototype.

## Principles

- Build a small number of coherent instrument surfaces, not a collection of independently boxed widgets.
- Geometry is owned by parents. Children fit their allocated slots and cannot resize neighboring regions.
- Each visible rule has exactly one owner.
- Values reserve their maximum display width before they change.
- Only named scroll surfaces may scroll.
- Color identifies modulation sources and articulation overrides. It does not decorate ordinary chrome.
- Visible decoration may be compact, but every interactive cell retains a 44-point minimum touch target.

## Token Rhythm

The spacing scale is `4 / 8 / 12 / 16 / 24`. A 2-pixel token exists only for optical correction. Component styles consume named tokens from `tokens.css`; they do not introduce local spacing numbers.

The stroke hierarchy is:

| Role | Width | Purpose |
| --- | ---: | --- |
| Hairline | 1px muted | Internal subdivisions and graph guides |
| Structural | 1px ink | Surface frames and major region boundaries |
| Active | 2px ink | Keyboard focus and selected outlines |
| Semantic | 3px color | Modulation and articulation ownership |

Hairlines use a lighter color rather than fractional CSS pixels so they rasterize consistently.

## Shell Geometry

The 852 x 1846 reference scales almost exactly to the 390 x 844 master viewport.

| Region | 390 x 844 | 375 x 667 |
| --- | ---: | ---: |
| Header | 48 | 40 |
| Rack | 96 | 72 |
| Workspace | 572 | 427 |
| Source rail | 48 | 44 |
| Audition transport | 80 | 84 |
| Total | 844 | 667 |

The compact viewport is a deliberate composition, not a proportional shrink. Its module layout may use a named compact variant, such as a three-column parameter matrix, while the master Phaser screen uses the reference's two-column matrix.

The current product requirement for a permanently allocated mapping-detail region conflicts with the reference's compact mapping band. The provided tokens reserve 152 points at master size and 120 at compact size so switching mappings cannot move surrounding regions. The canonical comparison state must include that inspector, or the visual reference must be updated before exact vertical proportions can be claimed.

## Border Ownership

Structural dividers follow a single rule: the later surface owns its leading edge.

| Boundary | Owner |
| --- | --- |
| App exterior | `MobileSynthShell` inline edges |
| Header to rack | Rack leading edge |
| Rack to workspace | Workspace leading edge |
| Workspace internal graphic | Graphic surface frame |
| Parameter grid perimeter and cells | `ParameterMatrix`; `ParameterControl` owns no outer border |
| Primary editor to modulation inspector | `ModulationInspector` leading edge |
| Inspector internal relationships | `ModulationInspector` only |
| Inspector to source rail | `SourceShelf` leading edge |
| Source rail to audition transport | `AuditionTransport` leading edge |
| Rack tile subdivisions | Rack list hairlines; tiles do not draw a perimeter |

Do not place a trailing border on one surface and a leading border on its neighbor. Buttons and selects are borderless after reset. Components opt into `.cosimo-control-frame`, `.cosimo-frame`, or an explicitly owned rule.

## Typography And Values

The named roles are module, navigation, label, value, and micro. Labels use the condensed instrument face; live values use the mono face with tabular numerals.

Every changing output uses `.cosimo-value` and declares `data-value-kind`. Widths are reserved for percent, signed, rate, frequency, phase, note, and status values. Outputs are end-aligned, single-line, and clipped with an ellipsis. Changing `834 Hz` to `1.35 kHz` must not change sibling geometry.

## Stable Geometry

- Shell and workspace regions use explicit grid tracks and `minmax(0, 1fr)` for the flexible track.
- Every grid or flex child that may shrink declares `min-inline-size: 0` and `min-block-size: 0`.
- Mapping chips replace content inside `.cosimo-inspector-slot`; they never collapse that slot.
- Empty, selected, mapped, overridden, disabled, bypassed, editing, and capture states preserve their component's outer box.
- Absolute positioning is reserved for markers, HUDs, and overlays. It is never used to construct the page layout.
- Hit targets occupy real grid or flex cells. Pseudo-elements may not overlap sibling targets.

## Scroll Surfaces

The only allowed scroll containers are explicitly named with:

- `data-scroll-surface="horizontal"` for racks and source rails.
- `data-scroll-surface="vertical"` for source target lists or another intentionally navigable list.

Normal module workspaces, mapping inspector slots, and audition controls clip overflow and must fit by contract. Adding `overflow: auto` to repair a component is not allowed.

## Stylesheet Ownership

- `design-system/tokens.css` owns fonts, colors, type metrics, spacing, strokes, shell geometry, touch sizes, value widths, and layers.
- `design-system/foundations.css` owns the scoped reset and opt-in primitives.
- Each product component owns one colocated stylesheet or CSS module.
- A component stylesheet may style its own root and descendants. It must not reach through another product component.
- Global tag styling is limited to the scoped reset. Product styles do not box every button or select by default.
- `!important` is forbidden.
- Arbitrary raw geometry is forbidden. If a genuinely reusable dimension is missing, add a named token with a short rationale rather than placing a number in a component rule.
- Do not append an override layer. Move a surface to the new system and remove its obsolete rules in the same change.

## React Boundary

Presentation components consume a prototype adapter that exposes a snapshot plus domain actions. They do not receive raw React state setters. The mock adapter will later be replaced by Cosimo's rack, modulation, articulation, audition, and parameter APIs without changing the component tree.

The intended product components are `MobileSynthShell`, `WorkspaceCarousel`, `EffectRack`, `EffectRackTile`, `ModuleEditor`, module-specific graphic surfaces, `ParameterMatrix`, `ParameterControl`, `ModulationInspector`, `MappingChip`, `MappingDetail`, `SourceShelf`, `SourceChip`, source editors, and `AuditionTransport`.

## Static Contract Check

Run:

```sh
node scripts/check-style-contract.mjs
```

The checker rejects `!important`, duplicate selectors in the same at-rule scope, raw colors outside `tokens.css`, and raw dimension units outside `tokens.css`. Named viewport breakpoint literals require an inline `style-contract-allow-raw` comment.
