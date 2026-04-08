# Plan: Replace ModulationMatrixSection with Option D "Pip Selector" design

## Summary

Replace the current `ModulationMatrixSection` component (lines 1504–1637) and slim down `DesktopEnvelopeEditor` (lines 636–1049) in `DesktopPatchView.tsx`. The new design uses numbered square pips for MSEG/ENV selection, a loop icon button, a rate readout, and a full-bleed body for either the MSEG preview or the ADSR envelope editor. All existing functionality is preserved — only the visual layout and CSS classes change.

## Scope

**Single file:** `ui/desktop/DesktopPatchView.tsx`
**Two components touched:**
1. `ModulationMatrixSection` — full rewrite of JSX return
2. `DesktopEnvelopeEditor` — slim down containers/padding to go flush inside the new card

**No changes to:** `MsegPreview`, `RangeField`, props, callbacks, types, state management, or any parent/child wiring.

## Changes

### 1. Replace the outer `<section>` container (ModulationMatrixSection)

**Before:** `rounded-[22px] border border-white/[0.05] bg-white/[0.025] p-4 gap-3` + `DESKTOP_GRID_CARD_CLASS`
**After:** `rounded-[14px] bg-white/[0.02] overflow-hidden` + `DESKTOP_GRID_CARD_CLASS`

Remove the border and padding. The new design is borderless with no internal padding — the top-bar and canvas go edge-to-edge.

### 2. Replace the pill-shaped tab bar with the pip selector top-bar

**Before:** Scrollable `overflow-x-auto` wrapper → `rounded-full border bg-white/[0.03] p-1` pill → full-text buttons ("MSEG 1", "MSEG 2", etc.)

**After:** Single flex row (`flex items-center gap-1.5 px-2.5 py-1.5 shrink-0`):
- **MSEG pips:** 3 square buttons (18×18px, `rounded-[5px]`, numbered "1"/"2"/"3"). Active = cyan highlight. Each calls `onSelectMsegSlot(slotIndex)` + `setActiveEditorTab({ kind: "mseg", slotIndex })`.
- **"Mseg" label:** `text-[10px] uppercase tracking-[0.12em] text-cyan-100/60`
- **Separator:** 1px × 12px vertical divider
- **ENV pips:** 3 square buttons, same size. Active = emerald highlight. Each calls `onSelectEnvelopeSlot(slotIndex)` + `setActiveEditorTab({ kind: "envelope", slotIndex })`.
- **"Env" label:** same style, emerald tint
- **Right-aligned controls** (`ml-auto flex items-center gap-2`):
  - **Loop icon button** (22×22px, `rounded-[6px]`): calls `onToggleMsegLoop`. Shows active (cyan glow) when `msegState?.playback.loop`. Inline SVG loop icon. Only visible when MSEG tab is active.
  - **Rate readout** (`font-mono text-[10px] text-cyan-200/70`, `bg-white/[0.03] border border-white/[0.04] rounded px-1.5 py-0.5`): displays `formatSeconds(msegState.playback.rate.seconds)`. Only visible when MSEG tab is active.

### 3. Content body: scale-to-fit, no scrolling

**Critical constraint:** Both the MSEG preview and the envelope editor must scale to fit whatever space the body provides. The user must never scroll within this card. The old card used `overflow-y-auto` — we eliminate that entirely.

**Layout structure** (outer card is `flex flex-col`, top-bar is `shrink-0`):
```
<section flex flex-col overflow-hidden>     ← card, height set by DESKTOP_GRID_CARD_CLASS
  <div shrink-0>                            ← top-bar (pip selector), fixed height
  <div flex-1 min-h-0>                      ← body, takes ALL remaining space
    (MSEG preview OR envelope editor)       ← scales to fill body, never overflows
  </div>
</section>
```

The body uses `flex-1 min-h-0`. `min-h-0` is essential — it overrides the default `min-height: auto` that would let children push the body taller than the remaining space.

### 4. MSEG tab content

**Before:** Scrollable wrapper → nested card with padding → `MsegPreview` at fixed `h-24` → `RangeField` → loop button.

**After:** A `<button>` with `h-full w-full relative` filling the body:
- `onClick={onOpenMsegEditor}`, `aria-label="Open MSEG editor"`
- `<MsegPreview>` with `className="h-full w-full"` — fills the entire button. `MsegPreview` uses `useResizeObserver` internally, so it measures its actual rendered size and rebuilds SVG paths to match. Giving it `h-full w-full` makes it scale to whatever the body provides.
- Hover overlay: centered "Edit Shape" hint (opacity transition, small label on semi-transparent pill).
- No redundant labels, no separate loop/rate controls (they're in the top-bar now).

### 5. Slim down DesktopEnvelopeEditor to scale-to-fit

The envelope editor must fill the body and scale its SVG to fit — no scrolling.

**Changes to `DesktopEnvelopeEditor`'s return JSX:**

a) **Remove outer `grid gap-3` wrapper** (line 833) — replace with a single `relative h-full overflow-hidden` container. The `h-full` makes it fill the body. `overflow-hidden` prevents any content from leaking.

b) **Strip container chrome from the SVG wrapper** (line 834):
   - **Before:** `rounded-[22px] border border-white/8 bg-[linear-gradient(...)]` — this is a separate nested div.
   - **After:** Merge into the single container above. Remove rounded corners and border (the parent card's `overflow-hidden` clips). Keep the gradient background.

c) **Scale the SVG to fit** (line 839):
   - **Before:** `className="relative z-10 block h-auto w-full touch-none"` — `h-auto` lets the SVG's intrinsic aspect ratio determine height, which can overflow the container.
   - **After:** `className="relative z-10 block h-full w-full touch-none"` — `h-full` constrains the SVG to the container's height. The `viewBox="0 0 920 520"` + default `preserveAspectRatio="xMidYMid meet"` scales the ADSR curve proportionally within the available space.

d) **Tighten the ADSR overlay bar** (lines 973–1045):
   - **Before:** `p-3` outer padding → `rounded-2xl bg-black/30 px-3 py-2` inner bar
   - **After:** `p-1.5` outer padding → `rounded-lg bg-black/30 px-2 py-1.5` inner bar. Reduces vertical footprint.

e) **All ADSR functionality preserved:** SVG drag handles, A/D/S/R input fields, pointer event handlers, draft state — completely untouched. Only container/SVG class names change.

### 6. Envelope tab rendering in ModulationMatrixSection

When `activeEditorTab.kind === "envelope"`:
- Render `<DesktopEnvelopeEditor>` directly in the `flex-1 min-h-0` body.
- The slimmed-down envelope editor (`h-full overflow-hidden`) fills the body, and its SVG (`h-full w-full`) scales to fit. No scrolling.

### 6. Responsive mobile styles

Via Tailwind responsive prefixes (no CSS file changes needed):

**≤480px (mobile):**
- Pip buttons: `max-[480px]:size-7` (28×28px, larger touch targets)
- Loop icon: `max-[480px]:size-7`
- Rate readout: slightly larger font, more padding
- Tighter gaps

**≤360px (iPhone SE):**
- Pip buttons: `max-[360px]:size-[26px]`
- Even tighter gaps/text

## What stays the same

- `ModulationMatrixSectionProps` type — no changes
- All callback wiring (`onSelectMsegSlot`, `onOpenMsegEditor`, `onMsegRateChange`, `onToggleMsegLoop`, `onSelectEnvelopeSlot`, `onEnvelopeChange`, route callbacks)
- `activeEditorTab` state and `activeMsegSlot`/`activeEnvelopeSlot` derivations
- `DesktopEnvelopeEditor` internal logic — SVG geometry, drag handlers, ADSR input fields, draft state, pointer events all untouched
- `MsegPreview` component — untouched (just different className)
- `RangeField` component — still exists in codebase, just not used in this card anymore
- Parent rendering in `DesktopPatchViewBody` — no changes needed
- `DESKTOP_GRID_CARD_CLASS` — still applied

## Implementation order

1. Slim down `DesktopEnvelopeEditor` wrapper classes (step 4)
2. Rewrite `ModulationMatrixSection` return JSX (steps 1–3, 5)
3. Add responsive classes (step 6)
4. Build and verify no TypeScript errors
