# Knob composition

The knob uses shared gesture classification and dial geometry, with React parts for value context, the input surface and optional presentation. A single scalar value does not require routing or engine metadata. The two-axis input and read-only live marker are optional composition surfaces.

Use `@radix-ui/react-slot` for `KnobControl asChild`. The kit previously had no general slot/ref/event-composition implementation. Reusing the maintained primitive avoids a second custom implementation of nested trigger composition and React ref cleanup. The docs example uses `@radix-ui/react-context-menu`; the knob itself does not import a menu or prescribe its actions. Both dependencies and the demo are included in customer exports with matching lockfiles.

The useful reference is shadcn's default-plus-composition approach, rather than a requirement to copy its full styling or dependency set. See [shadcn Slider](https://ui.shadcn.com/docs/components/slider) and [Radix composition](https://www.radix-ui.com/primitives/docs/guides/composition).

## Shared control conventions

All four controls (knob, slider, MSEG and filter) follow one keyboard policy, implemented once in `kit/ui/keyboard-steps.ts` and taken from the knob: arrows step, Shift is ten times finer, Page Up/Down ten times coarser, Home/End reach the range ends, and a held key is one gesture. The slider and filter previously made Shift coarser; one rule means a plugin's controls behave alike without per-control documentation.

They also share one gesture contract (`onGestureStart`, `onGestureEnd(cancelled)`), forward refs and DOM props from their roots, and read one set of `--editor-*` color properties. Each control writes its default palette as the `var()` fallback rather than defining the properties on its root, so a theme set on any ancestor reaches it.

Default styles are installed per document or shadow root by `kit/ui/styles.ts`, from each control's CSS imported as a string. Plugin views render in a shadow root, where a stylesheet linked from the page cannot reach, and customers then need no stylesheet import.
