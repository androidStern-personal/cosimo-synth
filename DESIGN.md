---
name: Cosimo Music Software
description: Observed visual baseline for Cosimo Synth, SeqFX, and related music-production tools.
colors:
  synth-bg-deep: "#04070f"
  synth-bg-shell: "#080b14"
  synth-text: "#eef2f5"
  synth-text-warm: "#ffd8a6"
  synth-accent-cyan: "#87d7f5"
  synth-accent-blue: "#5f7aff"
  synth-accent-pink: "#f56cb6"
  synth-accent-green: "#32f0bc"
  synth-danger: "#f87171"
  synth-warning: "#fbbf24"
  overlay-weak: "#ffffff0a"
  overlay-border: "#ffffff14"
  editor-surface: "#e4ded3"
  editor-ink: "#1c1c1c"
  editor-ink-muted: "#6f716d"
  editor-cyan: "#00b4d8"
  editor-coral: "#e8604c"
  editor-gold: "#f2d16b"
  editor-cream: "#f0ece6"
  seqfx-filter: "#f4d35e"
  seqfx-crusher: "#ee6c4d"
  seqfx-tape-stop: "#98c1d9"
  seqfx-stutter: "#b5d99c"
  seqfx-playhead: "#8bbf9a"
  effect-ott-green: "#8ff0a4"
  effect-chorus-gold: "#f0b867"
typography:
  headline:
    fontFamily: "\"SF Pro Display\", \"SF Pro Text\", -apple-system, BlinkMacSystemFont, \"Avenir Next\", sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0"
  title:
    fontFamily: "\"Avenir Next\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "\"SF Pro Text\", -apple-system, BlinkMacSystemFont, \"Avenir Next\", sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "\"SF Mono\", \"IBM Plex Mono\", Menlo, monospace"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.16em"
  editor-label:
    fontFamily: "Menlo, Monaco, \"Liberation Mono\", monospace"
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
rounded:
  xs: "3px"
  sm: "6px"
  md: "8px"
  lg: "14px"
  panel: "22px"
  shell: "28px"
  pill: "999px"
spacing:
  xxs: "3px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  2xl: "24px"
  3xl: "32px"
  seqfx-section-gap: "56px"
components:
  synth-shell:
    backgroundColor: "{colors.synth-bg-shell}"
    textColor: "{colors.synth-text}"
    rounded: "{rounded.shell}"
    padding: "10px 16px 16px"
  synth-button:
    backgroundColor: "{colors.overlay-weak}"
    textColor: "{colors.synth-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  synth-icon-button:
    backgroundColor: "{colors.overlay-weak}"
    textColor: "{colors.synth-text}"
    rounded: "{rounded.lg}"
    height: "40px"
    width: "40px"
  synth-range:
    backgroundColor: "{colors.overlay-weak}"
    rounded: "{rounded.pill}"
    height: "10px"
  seqfx-pattern:
    backgroundColor: "{colors.editor-surface}"
    textColor: "{colors.editor-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "28px"
    width: "28px"
  seqfx-pattern-selected:
    backgroundColor: "{colors.seqfx-playhead}"
    textColor: "{colors.editor-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "28px"
    width: "28px"
  seqfx-field:
    backgroundColor: "{colors.editor-surface}"
    textColor: "{colors.editor-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 9px"
    height: "34px"
  editor-chip:
    backgroundColor: "{colors.editor-ink}"
    textColor: "{colors.editor-cream}"
    typography: "{typography.editor-label}"
    rounded: "{rounded.xs}"
    padding: "3px 6px"
---

# Design System: Cosimo Music Software

## 1. Overview

**Creative North Star: "The Sorayama Workbench"**

Cosimo's current interface language is an observed baseline, not a finished doctrine. It contains two active skins: Cosimo Synth uses a dark, instrument-like surface with cyan, pink, warm amber, and compact technical overlays; SeqFX and the shared editor controls use a warmer ink-on-material surface with tactile sequencer cells and graph-editor details. Future work should treat these as product-specific evidence, then tighten them into a clearer family.

The scene is a producer working late in Ableton or on an iPhone, making fast musical decisions under dim studio or transit light. Dark surfaces are justified for the synth because the wavetable, modulation, and keyboard views sit inside host/plugin contexts that are often used at night. The light SeqFX/editor surface is justified where grid editing, per-step blocks, and graph gestures benefit from paper-like contrast and precise black-ink geometry.

The aesthetic should keep the brand's Sorayama principle visible: old craft fused into new form. Current late-80s and early-90s pop-tech accents are allowed as product-specific character, but only when they help the tool feel like a distinct musical object. The system rejects generic neon-on-black plugin styling, photoreal hardware costume, clinical oscilloscope identity, and minimalism that hides the product's point of view.

**Key Characteristics:**
- Dense expert controls with readable hierarchy, not onboarding-first softness.
- Product-specific skins under one disciplined maker, not one templated line.
- Technical visual proof: waveforms, filter response, modulation curves, sequencer blocks, and state readouts.
- Retrofuturist accent details used sparingly, never as full cosplay.
- Current tokens are descriptive baseline tokens. Promote them to doctrine only after a deliberate cleanup pass.

## 2. Colors

The observed palette is split between a dark synth cockpit and a warm editor workbench; future additions should preserve that split only when the product behavior earns it.

### Primary
- **Oscillator Cyan** (`synth-accent-cyan`): the main synth information accent for curves, readouts, modulation arcs, and visual confirmation.
- **Editor Ink** (`editor-ink`): the main SeqFX/editor drawing color for text, graph lines, handles, chips, and structural marks.

### Secondary
- **Highlight Pink** (`synth-accent-pink`): the synth's expressive accent for active notes, drag handles, and high-salience state. Use it rarely.
- **Workbench Cyan** (`editor-cyan`): the light-editor accent for range starts, focus outlines, and graph highlights.
- **SeqFX Playhead Green** (`seqfx-playhead`): sequencer current-position feedback and selected pattern state.

### Tertiary
- **Warm Text Amber** (`synth-text-warm`): synth labels and wavetable stage warmth.
- **Editor Coral** (`editor-coral`): range ends, stutter/crusher detail, and destructive-ish energy inside the editor language.
- **Editor Gold** (`editor-gold`): focus rings, selection emphasis, and musical timing highlights.
- **SeqFX Lane Colors** (`seqfx-filter`, `seqfx-crusher`, `seqfx-tape-stop`, `seqfx-stutter`): fixed effect identities in the sequencer grid.

### Neutral
- **Deep Stage Black** (`synth-bg-deep`): the synth root background.
- **Shell Black-Blue** (`synth-bg-shell`): the synth app shell and host background.
- **Synth Text** (`synth-text`): primary text on dark UI.
- **Translucent Overlay** (`overlay-weak`): inactive dark-surface controls and panels.
- **Translucent Border** (`overlay-border`): dark-surface outlines and separators.
- **Warm Editor Surface** (`editor-surface`): SeqFX and graph-editor canvas.
- **Muted Editor Ink** (`editor-ink-muted`): secondary text, axes, inactive lane labels, and helper copy.
- **Editor Cream** (`editor-cream`): light text on dark editor chips.

### Named Rules

**The Baseline Is Not Gospel Rule.** Documented colors describe what exists now. New work should normalize future tokens to OKLCH and reduce one-off hex and inline rgba values instead of copying the current sprawl.

**The Accent Has a Job Rule.** Cyan, pink, amber, coral, and green must signal sound, interaction, selection, focus, or timing. They are not decorative confetti.

**The Product Skin Rule.** Cosimo Synth may stay dark and spectral; SeqFX may stay warm and gridded. Do not blend both palettes into one screen unless the workflow explicitly crosses both instruments.

## 3. Typography

**Display Font:** None as a global system. This is product UI, not a brand campaign.
**Body Font:** SF Pro / system sans for synth surfaces, Avenir Next / Helvetica Neue for SeqFX.
**Label/Mono Font:** SF Mono, IBM Plex Mono, Menlo, Monaco, and Liberation Mono.

**Character:** Typography is compact, technical, and task-first. The current system leans on uppercase micro-labels and mono readouts for instrument controls; that works when values and state need scanning, but it should not become the voice for prose.

### Hierarchy
- **Headline** (700, `18px`, `1.1`): compact product or panel titles such as SeqFX title and larger editor headings.
- **Title** (700, `15px`, `1.2`): section titles, inspector names, and active panel labels.
- **Body** (500, `13px`, `1.45`): helper text, field labels that need normal reading, and compact interface copy. Keep prose near 65 to 75 characters per line.
- **Label** (700, `10px`, `0.16em`, uppercase): synth section labels, active-state chips, mode tags, and short control labels.
- **Editor Label** (800, `10px`, `0` letter spacing, uppercase): graph labels, editor chips, tick sliders, and plot annotations.

### Named Rules

**The No Display Font Rule.** Product surfaces do not use decorative display fonts in labels, buttons, controls, data, or graph text.

**The Mono Means Measurement Rule.** Use mono type for values, timing, table positions, rates, MIDI notes, and technical labels. Do not use mono as a personality blanket.

**The Uppercase Budget Rule.** Uppercase labels are for compact scanning. Body copy and explanatory copy stay sentence case.

## 4. Elevation

Cosimo currently uses a hybrid depth model. Synth surfaces rely on tonal layering, inset highlights, radial stage light, translucent overlays, and medium outer shadows. SeqFX uses small tactile shadows and clipped material shapes to make grid cells and inspector islands feel movable. This is acceptable as observed product-specific language, but it is not permission for default glassmorphism or photoreal hardware.

### Shadow Vocabulary
- **Synth Shell Shadow** (`0 26px 80px rgba(0,0,0,0.48)`): outer desktop synth frame only.
- **Synth Panel Inset** (`inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -64px 80px rgba(0,0,0,0.34)`): dark graph and filter panels.
- **Overlay Control Shadow** (`0 10px 28px rgba(0,0,0,0.28)`): floating wavetable chips and compact controls on the synth stage.
- **SeqFX Cell Raised** (`1px 1.2px 2.1px rgba(126,116,101,0.3), -1px -1px 1.8px rgba(255,248,232,0.72), inset 0.5px 0.5px 0 rgba(255,248,232,0.44), inset -0.5px -0.5px 0 rgba(126,116,101,0.16)`): sequencer cells.
- **Editor Pill Shadow** (`0 2px 6px rgba(28,28,28,0.1)`): small readout pills on editor surfaces.

### Named Rules

**The Depth Proves Interaction Rule.** Use elevation for draggable cells, floating controls, active overlays, and panel layering. Do not use shadows to make empty decoration feel expensive.

**The No Hardware Costume Rule.** Tactile is allowed. Photoreal metal, screws, wood grain, faux rack gear, and decorative VU styling are forbidden.

## 5. Components

### Buttons

Buttons are compact controls, not brand moments.

- **Shape:** synth buttons use pill or soft rounded shapes (`14px` to `999px`); SeqFX pattern buttons use small rectangular rounds (`6px`).
- **Primary:** active product controls use the relevant product accent, usually cyan on synth surfaces or playhead green on SeqFX.
- **Hover / Focus:** hover should shift border or background slightly and finish within 120 to 200 ms. Focus must be visible, with editor surfaces using gold or cyan outlines.
- **Secondary / Ghost / Tertiary:** ghost controls may use translucent white on synth surfaces or low-alpha ink on editor surfaces. Disabled controls reduce opacity and keep the same geometry.

### Chips

Chips are value readouts, not badges for marketing.

- **Style:** synth chips are rounded pills over the wavetable stage with translucent dark fill and cyan or warm text. Editor chips invert to dark ink on cream, with tight `3px` corners.
- **State:** selected chips may brighten or use the product accent. Inactive chips stay quiet and readable.

### Cards / Containers

Cards exist because the plugin surface has bounded control groups, not because every item needs a card.

- **Corner Style:** large synth panels use `22px` to `28px`; filter and distortion panels use `14px` to `28px`; SeqFX inspector uses clipped `8px` material with `14px` bevel math.
- **Background:** synth containers use deep black-blue gradients and translucent overlays. SeqFX containers use warm material fills over `editor-surface`.
- **Shadow Strategy:** follow the Elevation section. One nested card inside another is prohibited unless the inner element is an actual control surface, such as a graph or keyboard.
- **Border:** dark surfaces use low-alpha white borders. Editor surfaces use low-alpha ink borders.
- **Internal Padding:** dense panels use `12px` to `16px`; stage overlays and inspector blocks use `10px` to `14px`; sequencer rhythm spacing uses `3px`, `9px`, and `56px`.

### Inputs / Fields

Inputs should feel like musical controls, not web forms pasted into a plugin.

- **Style:** synth ranges are pill tracks (`10px`) with warm-to-pink or lane-specific fills. SeqFX fields are raised warm controls (`34px` high, `7px` radius, `6px 9px` padding).
- **Focus:** focus rings must be visible and musical, usually cyan or gold. Do not rely only on color fill changes.
- **Error / Disabled:** error uses danger red with low-alpha background. Disabled controls lower opacity but preserve layout.

### Navigation

Navigation is shallow and tool-like.

- **Style:** effect plugin headers combine preset selection and snapshot actions in a compact `38px` bar. SeqFX pattern navigation uses numbered buttons. Synth navigation is mostly mode and table selection inside the instrument surface.
- **Default / Hover / Active:** hover is a small color or background response. Active state must be unambiguous without adding large decorative elements.
- **Mobile Treatment:** iPhone controls must keep safe-area padding, touch-sized targets, and direct stage gestures. Do not shrink labels below legibility to preserve desktop density.

### Wavetable Stage

The wavetable stage is the synth's signature component: a full visual instrument surface with table selection, frame position, readouts, and drag gestures living on top of the waveform canvas. It should remain the proof of the synth, not a background illustration.

### SeqFX Grid

The SeqFX grid is the effect plugin's signature component: a warm sequencer field with 32-step structure, lane color identity, clipped cell corners, draggable blocks, resize handles, and a visible playhead. Its tactile material language is allowed because block editing is the task.

### Editor Graph Surface

Shared graph editors use cream surfaces, black ink, cyan/coral/gold accents, and mono labels. They should stay precise and reusable across filter range, crusher, stutter, tape, and future graph editors.

### Modulation Knob

The modulation amount knob is a compact circular control with an arc, center marker, numeric percent readout, and polarity toggle. It is a good pattern for dense modulation editing, but it should be normalized across desktop and iPhone before becoming a permanent primitive.

## 6. Do's and Don'ts

### Do:
- **Do** treat this file as documentation of the current visual baseline, with explicit permission to improve it.
- **Do** make product visuals prove the product: waveform canvases, filter curves, modulation shapes, sequencer blocks, and real state readouts.
- **Do** keep Cosimo Synth dark only because it is an instrument surface used in dim host contexts.
- **Do** keep SeqFX and editor surfaces warm only where grid editing and graph reading benefit from high-contrast ink geometry.
- **Do** use late-80s and early-90s pop-tech references as precise accents: a sigil, a clipped cell, a chrome-like highlight, a CRT-like readout, or a restrained monospace footer.
- **Do** normalize future color work into OKLCH tokens before promoting it to a stable design system.
- **Do** keep controls dense, readable, and familiar to producers who already know Ableton, Bitwig, Serum, OTT, and plugin automation.
- **Do** preserve keyboard and touch affordances: visible focus, usable touch targets, safe-area padding, and reduced-motion respect.

### Don't:
- **Don't** follow Ableton's website by replacing product proof with conceptual editorial art direction.
- **Don't** follow Soundtoys by declaring attitude through cartoon names, red/orange maximalism, knobs with faces, or performed irreverence.
- **Don't** follow Universal Audio by using heritage hardware photography, brushed metal, provenance-first copy, or old equipment as proof of trust.
- **Don't** follow Output by using moody cinematic product shots, generic dark UI with neon accents, or casual copy that hides the technical idea.
- **Don't** follow Spitfire Audio by using institutional prestige, orchestral documentary styling, or gatekeeping seriousness as the aesthetic.
- **Don't** follow ECM Records sleeve language: no washed-out melancholy, faded palettes, or sadness as a seriousness signal.
- **Don't** follow Arc browser's softness: no pastel friendliness, rounded-everything visuals, or delight-first motion when function should carry the interface.
- **Don't** follow generic Swiss-design SaaS minimalism: no huge whitespace, anonymous Inter-only monochrome, abstract line illustrations, or restraint without a product-specific decision.
- **Don't** follow FabFilter as an identity model. Use analyzers when they help the task, but do not make the whole product a clinical oscilloscope.
- **Don't** use skeuomorphic plugin costume: no photoreal wood, brushed aluminum, decorative screws, or VU meters as decoration.
- **Don't** use side-stripe borders, gradient text, decorative glassmorphism, the hero-metric template, identical card grids, or modals as the first answer.
- **Don't** merge the dark synth palette and the warm SeqFX palette into one generic "Cosimo look" without a concrete workflow reason.
