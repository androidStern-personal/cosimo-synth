# Knob composition

The knob uses shared gesture classification and dial geometry, with React parts for value context, the input surface and optional presentation. A single scalar value does not require routing or engine metadata. The two-axis input and read-only live marker are optional composition surfaces.

Use `@radix-ui/react-slot` for `KnobControl asChild`. The kit previously had no general slot/ref/event-composition implementation. Reusing the maintained primitive avoids a second custom implementation of nested trigger composition and React ref cleanup. The docs example uses `@radix-ui/react-context-menu`; the knob itself does not import a menu or prescribe its actions. Both dependencies and the demo are included in customer exports with matching lockfiles.

The useful reference is shadcn's default-plus-composition approach, rather than a requirement to copy its full styling or dependency set. See [shadcn Slider](https://ui.shadcn.com/docs/components/slider) and [Radix composition](https://www.radix-ui.com/primitives/docs/guides/composition).
